"""Day Tour Video Maker - laptop server (FastAPI).

Serves the shared web app and offers heavy engines to it:
ffmpeg transcoding, OpenCV auto-pick, and an AI proxy (Ollama, OpenAI-compatible,
Gemini, Claude API) that keeps API keys on this machine.

Run:  python tour_server.py [--port 8765] [--host 127.0.0.1] [--config path] [--runtime server|exe]
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Optional

import httpx
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask

VERSION = "0.1.0"
APP_NAME = "Day Tour Video Maker"

# --------------------------------------------------------------------------- paths
def base_dir() -> Path:
    """Folder holding web/ and config/ (repo root, or PyInstaller's unpack dir)."""
    if getattr(sys, "_MEIPASS", None):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parent.parent


SERVER_DIR = Path(__file__).resolve().parent


def web_dir() -> Path:
    for cand in (base_dir() / "web", SERVER_DIR.parent / "web"):
        if (cand / "index.html").exists():
            return cand
    return base_dir() / "web"


# --------------------------------------------------------------------------- config
DEFAULT_CONFIG: dict[str, Any] = {
    "runtime": "auto",
    "ai": {
        "tasks": {"pick": "auto", "captions": "auto", "sort": "auto", "plan": "auto"},
        "order": ["browserai", "ollama", "openai", "gemini", "claude"],
        "providers": {
            "claude": {"enabled": True, "via": "claude.ai", "apiKey": "", "model": "claude-haiku-5-5"},
            "ollama": {"enabled": True, "url": "http://localhost:11434", "model": "qwen3-vl:4b"},
            "openai": {"enabled": False, "label": "LM Studio / OpenAI-compatible",
                       "url": "http://localhost:1234/v1", "apiKey": "", "model": ""},
            "gemini": {"enabled": False, "apiKey": "", "model": "gemini-flash-latest"},
            "browserai": {"enabled": False, "backend": "webgpu",
                          "models": {"faces": "mediapipe-face", "sort": "clip-vit-b32"}},
        },
    },
    "engines": {
        "jobs": {
            "export": ["android", "python", "webcodecs", "browser"],
            "autopick": ["python", "wasm", "browser"],
            "routeMap": ["python", "browser"],
        },
        "providers": {
            "python": {"enabled": True, "url": ""},
            "android": {"enabled": "auto"},
            "webcodecs": {"enabled": "auto"},
            "wasm": {"enabled": "auto"},
            "browser": {"enabled": True},
        },
    },
    "lan": {"allowPhone": False, "port": 8765},
    "storage": {"projects": "~/Videos/TourMaker"},
}


def deep_merge(a: dict, b: dict) -> dict:
    out = copy.deepcopy(a)
    for k, v in (b or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out


def find_config(explicit: Optional[str]) -> Optional[Path]:
    cands = []
    if explicit:
        cands.append(Path(explicit).expanduser())
    cands += [
        base_dir() / "config" / "tour.config.json",
        SERVER_DIR.parent / "config" / "tour.config.json",
        SERVER_DIR / "tour.config.json",
        Path.cwd() / "tour.config.json",
    ]
    for c in cands:
        if c.is_file():
            return c
    return None


def load_config(explicit: Optional[str] = None) -> tuple[dict, Optional[Path]]:
    path = find_config(explicit)
    cfg = copy.deepcopy(DEFAULT_CONFIG)
    if path:
        try:
            cfg = deep_merge(cfg, json.loads(path.read_text(encoding="utf-8")))
        except Exception as e:  # bad JSON should not kill the server
            print(f"[tour] config {path} unreadable ({e}); using defaults", file=sys.stderr)
    return cfg, path


def mask_keys(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: ("***" if k.lower() in ("apikey", "api_key") and v else mask_keys(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [mask_keys(v) for v in obj]
    return obj


# --------------------------------------------------------------------------- tools
def ffmpeg_exe() -> Optional[str]:
    try:
        import imageio_ffmpeg  # type: ignore
        p = imageio_ffmpeg.get_ffmpeg_exe()
        if p and Path(p).exists():
            return p
    except Exception:
        pass
    return shutil.which("ffmpeg")


def ffmpeg_version(exe: Optional[str]) -> Optional[str]:
    if not exe:
        return None
    try:
        out = subprocess.run([exe, "-version"], capture_output=True, text=True, timeout=10).stdout
        m = re.search(r"ffmpeg version (\S+)", out)
        return m.group(1) if m else "unknown"
    except Exception:
        return None


def parse_json_loose(text: str) -> Any:
    """Parse model output as JSON: whole text, fenced block, or first {...}/[...]."""
    if text is None:
        raise ValueError("empty reply")
    t = text.strip()
    try:
        return json.loads(t)
    except Exception:
        pass
    m = re.search(r"```(?:json)?\s*(.*?)```", t, re.S | re.I)
    if m:
        try:
            return json.loads(m.group(1).strip())
        except Exception:
            pass
    starts = [i for i in (t.find("{"), t.find("[")) if i >= 0]
    if starts:
        s = min(starts)
        e = max(t.rfind("}"), t.rfind("]"))
        if e > s:
            return json.loads(t[s : e + 1])
    raise ValueError("no JSON in reply")


def clean_b64(img: str) -> str:
    return img.split(",", 1)[1] if img.startswith("data:") else img


# --------------------------------------------------------------------------- app factory
def create_app(config_path: Optional[str] = None, runtime: str = "server") -> FastAPI:
    cfg, cfg_file = load_config(config_path)
    app = FastAPI(title=APP_NAME, version=VERSION)
    app.state.cfg = cfg
    app.state.cfg_file = cfg_file
    app.state.runtime = runtime
    app.state.ffmpeg = ffmpeg_exe()

    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^(null|https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?|capacitor://localhost|https?://localhost)$",
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def prov(name: str) -> dict:
        return app.state.cfg.get("ai", {}).get("providers", {}).get(name, {}) or {}

    # ---------------- config / health
    @app.get("/config.json")
    def get_config():
        c = mask_keys(copy.deepcopy(app.state.cfg))
        c["runtime"] = app.state.runtime
        return JSONResponse(c, headers={"Cache-Control": "no-store"})

    @app.get("/api/health")
    async def health():
        ollama_ok = False
        url = (prov("ollama").get("url") or "http://localhost:11434").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=1.0) as cl:
                r = await cl.get(url + "/api/tags")
                ollama_ok = r.status_code == 200
        except Exception:
            ollama_ok = False
        try:
            import cv2  # noqa: F401
            cv_ok = True
        except Exception:
            cv_ok = False
        return {
            "ok": True,
            "runtime": app.state.runtime,
            "version": VERSION,
            "ffmpeg": ffmpeg_version(app.state.ffmpeg),
            "opencv": cv_ok,
            "ollama": ollama_ok,
        }

    # ---------------- AI proxy
    async def call_ollama(p: dict, prompt: str, images: list[str], want_json: bool):
        url = (p.get("url") or "http://localhost:11434").rstrip("/")
        body: dict[str, Any] = {"model": p.get("model") or "qwen3-vl:4b", "prompt": prompt, "stream": False}
        if want_json:
            body["format"] = "json"
        if images:
            body["images"] = [clean_b64(i) for i in images]
        async with httpx.AsyncClient(timeout=300) as cl:
            r = await cl.post(url + "/api/generate", json=body)
        r.raise_for_status()
        j = r.json()
        return j.get("response", ""), {"in": j.get("prompt_eval_count", 0) or 0, "out": j.get("eval_count", 0) or 0}

    async def call_openai(p: dict, prompt: str, images: list[str], want_json: bool):
        url = (p.get("url") or "http://localhost:1234/v1").rstrip("/")
        content: list[dict] = [{"type": "text", "text": prompt}]
        for im in images:
            content.append({"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + clean_b64(im)}})
        body: dict[str, Any] = {"model": p.get("model") or "", "messages": [{"role": "user", "content": content}]}
        if want_json:
            body["response_format"] = {"type": "json_object"}
        headers = {"Content-Type": "application/json"}
        if p.get("apiKey"):
            headers["Authorization"] = "Bearer " + p["apiKey"]
        async with httpx.AsyncClient(timeout=300) as cl:
            r = await cl.post(url + "/chat/completions", json=body, headers=headers)
            if r.status_code == 400 and want_json:  # some servers reject response_format
                body.pop("response_format", None)
                r = await cl.post(url + "/chat/completions", json=body, headers=headers)
        r.raise_for_status()
        j = r.json()
        text = j["choices"][0]["message"]["content"]
        if isinstance(text, list):
            text = "".join(part.get("text", "") for part in text if isinstance(part, dict))
        u = j.get("usage") or {}
        return text, {"in": u.get("prompt_tokens", 0) or 0, "out": u.get("completion_tokens", 0) or 0}

    async def call_gemini(p: dict, prompt: str, images: list[str], want_json: bool):
        key = p.get("apiKey")
        if not key:
            raise ValueError("Gemini apiKey missing in config")
        model = p.get("model") or "gemini-flash-latest"
        parts: list[dict] = [{"text": prompt}]
        for im in images:
            parts.append({"inline_data": {"mime_type": "image/jpeg", "data": clean_b64(im)}})
        body: dict[str, Any] = {"contents": [{"role": "user", "parts": parts}]}
        if want_json:
            body["generationConfig"] = {"responseMimeType": "application/json"}
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        async with httpx.AsyncClient(timeout=300) as cl:
            r = await cl.post(url, json=body, headers={"x-goog-api-key": key})
        r.raise_for_status()
        j = r.json()
        text = "".join(pt.get("text", "") for pt in j["candidates"][0]["content"]["parts"])
        u = j.get("usageMetadata") or {}
        return text, {"in": u.get("promptTokenCount", 0) or 0, "out": u.get("candidatesTokenCount", 0) or 0}

    async def call_claude(p: dict, prompt: str, images: list[str], want_json: bool):
        key = p.get("apiKey")
        if not key:
            raise ValueError("Claude apiKey missing in config (claude.ai sign-in only works inside the claude.ai page)")
        content: list[dict] = [
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": clean_b64(im)}}
            for im in images
        ]
        content.append({"type": "text", "text": prompt + ("\nReply with JSON only." if want_json else "")})
        body = {"model": p.get("model") or "claude-haiku-5-5", "max_tokens": 1024,
                "messages": [{"role": "user", "content": content}]}
        headers = {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
        async with httpx.AsyncClient(timeout=300) as cl:
            r = await cl.post("https://api.anthropic.com/v1/messages", json=body, headers=headers)
        r.raise_for_status()
        j = r.json()
        text = "".join(b.get("text", "") for b in j.get("content", []) if b.get("type") == "text")
        u = j.get("usage") or {}
        return text, {"in": u.get("input_tokens", 0) or 0, "out": u.get("output_tokens", 0) or 0}

    CALLERS = {"ollama": call_ollama, "openai": call_openai, "gemini": call_gemini, "claude": call_claude}

    @app.post("/api/ai/{provider}")
    async def ai(provider: str, request: Request):
        if provider not in CALLERS:
            return JSONResponse({"ok": False, "error": f"unknown provider '{provider}'"}, status_code=404)
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"ok": False, "error": "body must be JSON"}, status_code=400)
        prompt = str(body.get("prompt") or "")
        images = [str(i) for i in (body.get("images") or [])]
        want_json = body.get("json", True) is not False
        if not prompt:
            return JSONResponse({"ok": False, "error": "prompt is empty"}, status_code=400)
        try:
            text, tokens = await CALLERS[provider](prov(provider), prompt, images, want_json)
        except httpx.HTTPStatusError as e:
            return JSONResponse({"ok": False, "error": f"{provider} HTTP {e.response.status_code}: {e.response.text[:300]}"}, status_code=502)
        except (httpx.ConnectError, httpx.ConnectTimeout):
            return JSONResponse({"ok": False, "error": f"{provider} is not reachable"}, status_code=502)
        except Exception as e:
            return JSONResponse({"ok": False, "error": f"{provider}: {e}"}, status_code=502)
        if not want_json:
            return {"ok": True, "data": text, "tokens": tokens}
        try:
            data = parse_json_loose(text)
        except Exception:
            return JSONResponse({"ok": False, "error": "reply was not JSON", "raw": text[:2000], "tokens": tokens}, status_code=502)
        return {"ok": True, "data": data, "tokens": tokens}

    # ---------------- transcode
    @app.post("/api/transcode")
    async def transcode(file: UploadFile = File(...), crf: int = Form(20)):
        exe = app.state.ffmpeg
        if not exe:
            return JSONResponse({"ok": False, "error": "ffmpeg not found"}, status_code=503)
        crf = max(14, min(35, int(crf)))
        tmpdir = tempfile.mkdtemp(prefix="tour_tx_")
        src = Path(tmpdir) / ("in" + (Path(file.filename or "in.webm").suffix or ".webm"))
        dst = Path(tmpdir) / "out.mp4"
        with src.open("wb") as f:
            shutil.copyfileobj(file.file, f)
        cmd = [exe, "-y", "-loglevel", "error", "-i", str(src), "-c:v", "libx264", "-preset", "veryfast",
               "-crf", str(crf), "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(dst)]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0 or not dst.exists():
            shutil.rmtree(tmpdir, ignore_errors=True)
            return JSONResponse({"ok": False, "error": "ffmpeg failed: " + proc.stderr[-400:]}, status_code=500)
        name = Path(file.filename or "video").stem + ".mp4"
        return FileResponse(dst, media_type="video/mp4", filename=name,
                            background=BackgroundTask(shutil.rmtree, tmpdir, True))

    # ---------------- autopick
    @app.post("/api/autopick")
    async def autopick(file: UploadFile = File(...), length: float = Form(3.5), top: int = Form(4)):
        try:
            import cv2
            import numpy as np
        except Exception:
            return JSONResponse({"ok": False, "error": "OpenCV not installed"}, status_code=503)
        tmpdir = tempfile.mkdtemp(prefix="tour_ap_")
        try:
            src = Path(tmpdir) / ("in" + (Path(file.filename or "in.mp4").suffix or ".mp4"))
            with src.open("wb") as f:
                shutil.copyfileobj(file.file, f)
            cap = cv2.VideoCapture(str(src))
            fps = cap.get(cv2.CAP_PROP_FPS) or 0
            nfr = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
            dur = (nfr / fps) if fps > 0 and nfr > 0 else 0.0
            if dur <= 0:
                cap.release()
                return JSONResponse({"ok": False, "error": "could not read video"}, status_code=400)
            step = max(0.25, dur / 160.0)
            samples = []  # (t, sharp, motion, bright)
            prev = None
            t = 0.0
            while t < dur:
                cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
                ok, frame = cap.read()
                if not ok:
                    break
                h, w = frame.shape[:2]
                sw = 96
                sh = max(1, int(round(h * sw / max(1, w))))
                g = cv2.cvtColor(cv2.resize(frame, (sw, sh), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
                sharp = float(cv2.Laplacian(g, cv2.CV_64F).var())
                motion = float(np.mean(np.abs(g.astype(np.float32) - prev))) if prev is not None else 0.0
                bright = float(g.mean())
                prev = g.astype(np.float32)
                samples.append((t, sharp, motion, bright))
                t += step
            cap.release()
            if not samples:
                return JSONResponse({"ok": False, "error": "no frames decoded"}, status_code=400)
            L = max(0.5, min(float(length), dur))
            ms = max(s[1] for s in samples) or 1.0
            mm = max(s[2] for s in samples) or 1.0
            vals = []
            for (_, sh_, mo, br) in samples:
                light_pen = max(0.0, abs(br - 125.0) - 70.0) / 60.0
                vals.append(0.6 * sh_ / ms + 0.3 * min(1.0, mo / mm * 1.4) - 0.4 * light_pen)
            n = max(1, int(round(L / step)))
            wins = []
            for i in range(0, max(1, len(vals) - n + 1)):
                seg = vals[i : i + n]
                start = samples[i][0]
                if start + L > dur + 1e-6:
                    start = max(0.0, dur - L)
                wins.append((sum(seg) / len(seg), start))
            wins.sort(key=lambda x: -x[0])
            cands: list[dict] = []
            for sc, st in wins:
                if all(abs(st - c["t"]) >= L for c in cands):
                    cands.append({"t": round(st, 2), "score": round(sc, 4)})
                if len(cands) >= max(1, int(top)):
                    break
            return {"ok": True, "duration": round(dur, 3), "candidates": cands}
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    # ---------------- ollama proxy
    @app.api_route("/api/ollama/{path:path}", methods=["GET", "POST"])
    async def ollama_proxy(path: str, request: Request):
        url = (prov("ollama").get("url") or "http://localhost:11434").rstrip("/") + "/" + path
        try:
            async with httpx.AsyncClient(timeout=300) as cl:
                if request.method == "GET":
                    r = await cl.get(url, params=dict(request.query_params))
                else:
                    r = await cl.post(url, content=await request.body(),
                                      headers={"Content-Type": request.headers.get("content-type", "application/json")})
        except (httpx.ConnectError, httpx.ConnectTimeout):
            return JSONResponse({"ok": False, "error": "Ollama is not reachable"}, status_code=502)
        return Response(content=r.content, status_code=r.status_code,
                        media_type=r.headers.get("content-type", "application/json"))

    # ---------------- static web app (last, so /api wins)
    wd = web_dir()
    if wd.exists():
        app.mount("/", StaticFiles(directory=str(wd), html=True), name="web")
    else:
        @app.get("/")
        def no_web():
            return JSONResponse({"ok": False, "error": f"web folder not found at {wd}"}, status_code=500)

    return app


# --------------------------------------------------------------------------- CLI
def main(argv: Optional[list[str]] = None) -> None:
    ap = argparse.ArgumentParser(description=APP_NAME + " server")
    ap.add_argument("--port", type=int, default=None)
    ap.add_argument("--host", default=None)
    ap.add_argument("--config", default=None)
    ap.add_argument("--runtime", choices=["server", "exe"], default="server")
    a = ap.parse_args(argv)
    cfg, path = load_config(a.config)
    lan = cfg.get("lan", {}) or {}
    host = a.host or ("0.0.0.0" if lan.get("allowPhone") else "127.0.0.1")
    port = a.port or int(lan.get("port") or 8765)
    import uvicorn
    print(f"[tour] {APP_NAME} {VERSION} · runtime={a.runtime} · config={path or 'built-in defaults'}")
    print(f"[tour] open http://{'localhost' if host in ('127.0.0.1', '0.0.0.0') else host}:{port}/")
    if host == "0.0.0.0":
        print("[tour] LAN mode: phones on the same Wi-Fi can open http://<this-laptop-IP>:%d/" % port)
    uvicorn.run(create_app(a.config, a.runtime), host=host, port=port, log_level="warning")


if __name__ == "__main__":
    main()
