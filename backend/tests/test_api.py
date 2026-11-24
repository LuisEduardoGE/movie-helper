from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_ok():
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["tmdb"] in {"key", "fallback"}


def test_proxy_image_rejects_host_outside_allowlist():
    response = client.get("/api/proxy-image", params={"url": "https://example.com/poster.jpg"})
    assert response.status_code == 400


def test_proxy_image_rejects_plain_http():
    response = client.get("/api/proxy-image", params={"url": "http://image.tmdb.org/t/p/w500/x.jpg"})
    assert response.status_code == 400


def test_create_room_returns_code_and_host_player():
    response = client.post("/api/rooms", json={"name": "Ana", "avatar": "A"})
    assert response.status_code == 200
    body = response.json()
    room, player = body["room"], body["player"]
    assert len(room["code"]) == 5
    assert room["code"].isalnum() and room["code"].upper() == room["code"]
    assert room["players"] == [player]
    assert player["name"] == "Ana"


def test_create_room_rejects_empty_name():
    response = client.post("/api/rooms", json={"name": ""})
    assert response.status_code == 422


def test_join_and_read_room():
    code = client.post("/api/rooms", json={"name": "Ana"}).json()["room"]["code"]
    joined = client.post(f"/api/rooms/{code.lower()}/join", json={"name": "Ben"})
    assert joined.status_code == 200
    room = client.get(f"/api/rooms/{code}").json()["room"]
    assert [p["name"] for p in room["players"]] == ["Ana", "Ben"]


def test_unknown_room_is_404():
    assert client.get("/api/rooms/ZZZZZ9").status_code == 404
