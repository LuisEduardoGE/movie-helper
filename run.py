from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
NPM_INSTALL_TIMEOUT_SECONDS = 300


def backend_python() -> str:
    if os.name == "nt":
        venv_python = BACKEND / ".venv" / "Scripts" / "python.exe"
    else:
        venv_python = BACKEND / ".venv" / "bin" / "python"
    return str(venv_python) if venv_python.exists() else sys.executable


def npm_command() -> list[str]:
    return ["npm.cmd", "run", "dev"] if os.name == "nt" else ["npm", "run", "dev"]


def npm_install_command() -> list[str]:
    command = ["npm.cmd"] if os.name == "nt" else ["npm"]
    return [*command, "install", "--no-audit", "--no-fund"]


def vite_binary() -> Path:
    name = "vite.cmd" if os.name == "nt" else "vite"
    return FRONTEND / "node_modules" / ".bin" / name


def ensure_frontend_dependencies() -> None:
    if vite_binary().exists():
        return

    print("Frontend dependencies are missing. Running npm install...", flush=True)
    try:
        result = subprocess.run(
            npm_install_command(),
            cwd=FRONTEND,
            timeout=NPM_INSTALL_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as error:
        raise RuntimeError(
            "npm install timed out. Run `npm install --no-audit --no-fund` "
            "inside the frontend folder, then retry `python run.py`."
        ) from error

    if result.returncode != 0:
        raise RuntimeError(
            "npm install failed. Run `npm install --no-audit --no-fund` "
            "inside the frontend folder, then retry `python run.py`."
        )


def start_process(name: str, command: list[str], cwd: Path) -> subprocess.Popen:
    print(f"Starting {name}: {' '.join(command)}", flush=True)
    kwargs = {}
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True
    return subprocess.Popen(command, cwd=cwd, **kwargs)


def stop_process(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return

    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(process.pid)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return
    else:
        os.killpg(process.pid, signal.SIGTERM)

    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=3)


def main() -> int:
    try:
        ensure_frontend_dependencies()
    except RuntimeError as error:
        print(f"Error: {error}", file=sys.stderr, flush=True)
        return 1

    backend_cmd = [
        backend_python(),
        "-m",
        "uvicorn",
        "app.main:app",
        "--reload",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
    ]

    processes = [
        start_process("backend", backend_cmd, BACKEND),
        start_process("frontend", npm_command(), FRONTEND),
    ]

    print("", flush=True)
    print("Backend:  http://127.0.0.1:8000", flush=True)
    print("Frontend: http://127.0.0.1:5173", flush=True)
    print("Press Ctrl+C to stop both.", flush=True)

    try:
        while True:
            for process in processes:
                if process.poll() is not None:
                    return process.returncode or 0
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nStopping services...", flush=True)
        return 0
    finally:
        for process in reversed(processes):
            stop_process(process)


if __name__ == "__main__":
    raise SystemExit(main())
