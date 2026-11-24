#!/usr/bin/env python3
"""Deploy movie-helper to a Linux VPS over SSH.

Usage:
    DEPLOY_SSH_HOST=myserver DEPLOY_PUBLIC_HOST=203.0.113.10 python deploy.py

(or put both in .env.deploy, which is git-ignored)

Steps:
  1. Build the Vite frontend locally (fast, deterministic).
  2. Stream source + built dist to /opt/movie-helper via tar | ssh.
  3. Always overwrite /opt/movie-helper/.env with the local .env.
  4. Create/refresh the Python venv on the server, install requirements.
  5. Write the systemd unit and nginx site config (idempotent).
  6. Allow the frontend port in UFW.
  7. Reload systemd, (re)start the backend service, reload nginx.
  8. Smoke-test the endpoints.

Requires on the local machine: python3, ssh, tar, npm, scp.
DEPLOY_SSH_HOST is an SSH host or alias with key auth; DEPLOY_PUBLIC_HOST is the
address nginx answers on.
"""

from __future__ import annotations

import os
import subprocess
import sys
import textwrap
from pathlib import Path

# ----- Configuration ---------------------------------------------------------

def _deploy_setting(name: str) -> str:
    """Read a deploy setting from the environment or a git-ignored .env.deploy."""
    if os.environ.get(name):
        return os.environ[name].strip()
    env_file = Path(__file__).resolve().parent / ".env.deploy"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            key, _, value = line.partition("=")
            if key.strip() == name:
                return value.strip()
    return ""


SERVER = _deploy_setting("DEPLOY_SSH_HOST")
REMOTE_DIR = "/opt/movie-helper"
PUBLIC_HOST = _deploy_setting("DEPLOY_PUBLIC_HOST")
BACKEND_PORT = 6030
FRONTEND_PORT = 6040
SERVICE_NAME = "movie-helper-backend"
NGINX_SITE = "movie-helper"

ROOT = Path(__file__).resolve().parent
LOCAL_ENV = ROOT / ".env"
FRONTEND_DIR = ROOT / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"


# ----- Small helpers ---------------------------------------------------------


def section(title: str) -> None:
    bar = "-" * (len(title) + 4)
    print(f"\n+{bar}+\n|  {title}  |\n+{bar}+")


def run_local(cmd: list[str], *, cwd: Path | None = None) -> None:
    pretty = " ".join(cmd)
    where = f"  (cwd={cwd})" if cwd else ""
    print(f"  $ {pretty}{where}")
    subprocess.run(cmd, cwd=cwd, check=True)


def ssh_run(remote_cmd: str) -> None:
    print(f"  ssh> {remote_cmd}")
    subprocess.run(["ssh", SERVER, remote_cmd], check=True)


def ssh_write_file(remote_path: str, content: str, *, mode: str = "0644") -> None:
    """Pipe content into the remote file, then chmod it."""
    print(f"  ssh> write {remote_path} (mode {mode})")
    subprocess.run(
        ["ssh", SERVER, f"cat > {remote_path} && chmod {mode} {remote_path}"],
        input=content.encode("utf-8"),
        check=True,
    )


# ----- Steps -----------------------------------------------------------------


def step_build_frontend() -> None:
    section("Build frontend locally")
    npm = "npm.cmd" if os.name == "nt" else "npm"
    run_local([npm, "install", "--no-audit", "--no-fund"], cwd=FRONTEND_DIR)
    run_local([npm, "run", "build"], cwd=FRONTEND_DIR)
    if not DIST_DIR.is_dir():
        raise RuntimeError(f"{DIST_DIR} not created after build")


def step_ship_code() -> None:
    section("Ship source + built dist via tar | ssh")
    ssh_run(f"mkdir -p {REMOTE_DIR}/backend {REMOTE_DIR}/frontend")
    # Wipe previous dist on the server so deletions in our build aren't left behind.
    ssh_run(f"rm -rf {REMOTE_DIR}/frontend/dist")

    tar_cmd = [
        "tar", "czf", "-",
        "--exclude=__pycache__",
        "--exclude=*.pyc",
        "--exclude=.venv",
        "--exclude=node_modules",
        "backend",
        "frontend/dist",
    ]
    print(f"  $ {' '.join(tar_cmd)} | ssh {SERVER} 'tar xzf - -C {REMOTE_DIR}'")
    tar_proc = subprocess.Popen(tar_cmd, cwd=ROOT, stdout=subprocess.PIPE)
    assert tar_proc.stdout is not None
    ssh_proc = subprocess.Popen(
        ["ssh", SERVER, f"tar xzf - -C {REMOTE_DIR}"],
        stdin=tar_proc.stdout,
    )
    tar_proc.stdout.close()
    ssh_rc = ssh_proc.wait()
    tar_rc = tar_proc.wait()
    if tar_rc != 0 or ssh_rc != 0:
        raise RuntimeError(f"tar transfer failed (tar={tar_rc}, ssh={ssh_rc})")


def step_write_env() -> None:
    section("Overwrite .env on server with local .env")
    if not LOCAL_ENV.is_file():
        raise RuntimeError(f"Local .env not found at {LOCAL_ENV}")
    ssh_write_file(f"{REMOTE_DIR}/.env", LOCAL_ENV.read_text(encoding="utf-8"), mode="0600")


def step_setup_venv() -> None:
    section("Python venv + dependencies")
    ssh_run(
        f"cd {REMOTE_DIR}/backend && "
        f"(test -d .venv || python3 -m venv .venv) && "
        f".venv/bin/pip install --quiet --upgrade pip && "
        f".venv/bin/pip install --quiet -r requirements.txt"
    )


def step_systemd_unit() -> None:
    section("systemd unit")
    unit = textwrap.dedent(f"""\
        [Unit]
        Description=Movie Helper Backend (FastAPI on uvicorn)
        After=network.target

        [Service]
        Type=simple
        User=root
        WorkingDirectory={REMOTE_DIR}/backend
        EnvironmentFile={REMOTE_DIR}/.env
        ExecStart={REMOTE_DIR}/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port {BACKEND_PORT}
        Restart=on-failure
        RestartSec=3

        [Install]
        WantedBy=multi-user.target
    """)
    ssh_write_file(f"/etc/systemd/system/{SERVICE_NAME}.service", unit)


def step_nginx_site() -> None:
    section("nginx site")
    conf = textwrap.dedent(f"""\
        # Generated by deploy.py — do not edit by hand.
        server {{
            listen {FRONTEND_PORT};
            server_name {PUBLIC_HOST} _;

            root {REMOTE_DIR}/frontend/dist;
            index index.html;

            access_log /var/log/nginx/{NGINX_SITE}.access.log;
            error_log /var/log/nginx/{NGINX_SITE}.error.log;

            client_max_body_size 2M;

            # FastAPI backend
            location /api/ {{
                proxy_pass http://127.0.0.1:{BACKEND_PORT};
                proxy_http_version 1.1;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
                proxy_read_timeout 30s;
            }}

            # Static SPA — every unknown path falls back to index.html so the
            # React app can handle client-side routing.
            location / {{
                try_files $uri $uri/ /index.html;
            }}
        }}
    """)
    ssh_write_file(f"/etc/nginx/sites-available/{NGINX_SITE}.conf", conf)
    ssh_run(
        f"ln -sf /etc/nginx/sites-available/{NGINX_SITE}.conf "
        f"/etc/nginx/sites-enabled/{NGINX_SITE}"
    )


def step_firewall() -> None:
    section("UFW firewall")
    # `ufw allow ... comment` is idempotent — it adds a rule once.
    ssh_run(f"ufw allow {FRONTEND_PORT}/tcp comment 'movie-helper'")


def step_restart() -> None:
    section("Reload systemd + nginx, (re)start backend")
    ssh_run("systemctl daemon-reload")
    ssh_run(f"systemctl enable --now {SERVICE_NAME}")
    ssh_run(f"systemctl restart {SERVICE_NAME}")
    ssh_run("nginx -t")
    ssh_run("systemctl reload nginx")


def step_smoke_test() -> None:
    section("Smoke test")
    ssh_run(f"curl -fsS http://127.0.0.1:{BACKEND_PORT}/api/health")
    ssh_run(f"curl -fsS http://127.0.0.1:{FRONTEND_PORT}/api/health")


# ----- Entry point -----------------------------------------------------------


def main() -> int:
    if not SERVER or not PUBLIC_HOST:
        print("Set DEPLOY_SSH_HOST and DEPLOY_PUBLIC_HOST (environment or .env.deploy).", file=sys.stderr)
        return 2
    try:
        step_build_frontend()
        step_ship_code()
        step_write_env()
        step_setup_venv()
        step_systemd_unit()
        step_nginx_site()
        step_firewall()
        step_restart()
        step_smoke_test()
    except subprocess.CalledProcessError as exc:
        print(f"\n[X] Step failed: {exc}", file=sys.stderr)
        return exc.returncode or 1
    except Exception as exc:
        print(f"\n[X] {exc}", file=sys.stderr)
        return 1

    print("\n[OK] Deployed.")
    print(f"   App:    http://{PUBLIC_HOST}:{FRONTEND_PORT}/")
    print(f"   Logs:   ssh {SERVER} 'journalctl -fu {SERVICE_NAME}'")
    print(f"   Nginx:  ssh {SERVER} 'tail -f /var/log/nginx/{NGINX_SITE}.access.log'")
    return 0


if __name__ == "__main__":
    sys.exit(main())
