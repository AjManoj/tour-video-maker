import json
import subprocess
import sys
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import tour_server  # noqa: E402


@pytest.fixture()
def cfg_file(tmp_path):
    p = tmp_path / "tour.config.json"
    p.write_text(json.dumps({
        "ai": {"providers": {
            "gemini": {"enabled": True, "apiKey": "secret-gem"},
            "claude": {"apiKey": "sk-secret"},
            "ollama": {"url": "http://127.0.0.1:9", "model": "qwen3-vl:4b"},
        }}
    }))
    return p


@pytest.fixture()
def client(cfg_file):
    return TestClient(tour_server.create_app(str(cfg_file), "server"))


@pytest.fixture(scope="module")
def video(tmp_path_factory):
    exe = tour_server.ffmpeg_exe()
    if not exe:
        pytest.skip("ffmpeg not available")
    out = tmp_path_factory.mktemp("v") / "test.mp4"
    subprocess.run([exe, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=25:duration=8",
                    "-f", "lavfi", "-i", "sine=frequency=440:duration=8",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(out)], check=True)
    return out


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    j = r.json()
    assert j["ok"] is True and j["runtime"] == "server" and j["version"] == "0.1.0"
    assert j["opencv"] is True
    assert j["ollama"] is False  # port 9 is closed
    assert j["ffmpeg"]


def test_config_masks_keys(client):
    j = client.get("/config.json").json()
    assert j["runtime"] == "server"
    assert j["ai"]["providers"]["gemini"]["apiKey"] == "***"
    assert j["ai"]["providers"]["claude"]["apiKey"] == "***"
    assert j["ai"]["providers"]["openai"]["apiKey"] == ""  # empty stays empty
    assert "secret" not in json.dumps(j)


def test_static_index(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "<html" in r.text.lower()


def test_autopick(client, video):
    with open(video, "rb") as f:
        r = client.post("/api/autopick", files={"file": ("test.mp4", f, "video/mp4")}, data={"length": "2", "top": "3"})
    j = r.json()
    assert j["ok"] is True, j
    assert 7.5 < j["duration"] < 8.5
    c = j["candidates"]
    assert 1 <= len(c) <= 3
    for a in c:
        assert 0 <= a["t"] <= j["duration"] - 2 + 0.01
    for i in range(len(c)):
        for k in range(i + 1, len(c)):
            assert abs(c[i]["t"] - c[k]["t"]) >= 2 - 1e-6
    assert c == sorted(c, key=lambda x: -x["score"])


def test_transcode(client, video):
    with open(video, "rb") as f:
        r = client.post("/api/transcode", files={"file": ("clip.webm", f, "video/webm")}, data={"crf": "28"})
    assert r.status_code == 200
    assert r.headers["content-type"] == "video/mp4"
    assert r.content[4:8] == b"ftyp"
    assert len(r.content) > 1000


def test_ai_ollama_mocked(client, monkeypatch):
    seen = {}

    class FakeResp:
        status_code = 200
        def raise_for_status(self): pass
        def json(self): return {"response": '```json\n{"title":"Pool day","sub":"Splash"}\n```', "prompt_eval_count": 50, "eval_count": 9}

    class FakeClient:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, url, json=None, **k):
            seen["url"], seen["body"] = url, json
            return FakeResp()

    monkeypatch.setattr(tour_server.httpx, "AsyncClient", FakeClient)
    r = client.post("/api/ai/ollama", json={"prompt": "caption this", "images": ["data:image/jpeg;base64,QUJD"], "json": True})
    j = r.json()
    assert j == {"ok": True, "data": {"title": "Pool day", "sub": "Splash"}, "tokens": {"in": 50, "out": 9}}
    assert seen["url"] == "http://127.0.0.1:9/api/generate"
    assert seen["body"]["images"] == ["QUJD"] and seen["body"]["format"] == "json"


def test_ai_errors(client):
    assert client.post("/api/ai/nope", json={"prompt": "x"}).status_code == 404
    assert client.post("/api/ai/ollama", json={"prompt": ""}).status_code == 400
    r = client.post("/api/ai/ollama", json={"prompt": "hi"})  # closed port
    assert r.status_code == 502 and r.json()["ok"] is False


def test_ai_gemini_needs_key(tmp_path):
    c = TestClient(tour_server.create_app(str(tmp_path / "none.json"), "exe"))
    r = c.post("/api/ai/gemini", json={"prompt": "hi"})
    assert r.status_code == 502 and "apiKey" in r.json()["error"]
    assert c.get("/api/health").json()["runtime"] == "exe"


def test_parse_json_loose():
    p = tour_server.parse_json_loose
    assert p('{"a":1}') == {"a": 1}
    assert p('Sure! {"a": [1,2]} hope it helps') == {"a": [1, 2]}
    assert p("```\n[1,2]\n```") == [1, 2]
    with pytest.raises(Exception):
        p("no json here")
