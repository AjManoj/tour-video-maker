# Build contract (shared by all parts)

Repo root: `tour-video-maker/`

```
web/                 shared app (plain HTML/CSS/JS, classic <script> tags, no bundler, works from file://)
  index.html  css/app.css
  js/config.js       TV.config: defaults + load + runtime detection
  js/ai.js           TV.ai: AI provider layer
  js/engines.js      TV.engines: execution engine layer
  js/app.js          UI, timeline, renderer (existing app)
  samples/           sample media (gate.jpg, selfie.jpg, term1/term2/jet1/jet2/cabin.mp4)
server/              Python laptop server (FastAPI) + EXE packaging
  tour_server.py  requirements.txt  launcher.py  build_exe.bat  start_server.bat  tour.spec(optional)
android/             Capacitor shell + native plugin skeleton
config/              tour.config.<runtime>.json examples + schema
docs/                ARCHITECTURE.md CONFIG.md FEATURES.md (rankings) ROADMAP.md
README.md  .gitignore  LICENSE(MIT)
```

## Runtimes
`browser` (claude.ai artifact or any web host) · `file` (index.html opened from disk) · `server` (served by tour_server.py) · `exe` (same server inside TourMaker.exe window) · `apk` (Capacitor, `window.Capacitor` present).

Detection order in `TV.config.detect()`:
1. `window.Capacitor?.isNativePlatform?.()` → `apk`
2. `fetch('/api/health')` same origin succeeds → value of `runtime` field (`server` or `exe`)
3. `location.protocol === 'file:'` → `file`
4. else `browser` (Claude `sample` capability may be available via `window.claude.use('sample')`)

## Config (`tour.config.json`)
```json
{
  "runtime": "auto",
  "ai": {
    "tasks": { "pick": "auto", "captions": "auto", "sort": "auto", "plan": "auto" },
    "order": ["browserai", "ollama", "openai", "gemini", "claude"],
    "providers": {
      "claude":   { "enabled": true,  "via": "claude.ai", "apiKey": "", "model": "claude-haiku-5-5" },
      "ollama":   { "enabled": true,  "url": "http://localhost:11434", "model": "qwen3-vl:4b" },
      "openai":   { "enabled": false, "label": "LM Studio / OpenAI-compatible", "url": "http://localhost:1234/v1", "apiKey": "", "model": "" },
      "gemini":   { "enabled": false, "apiKey": "", "model": "gemini-flash-latest" },
      "browserai":{ "enabled": false, "backend": "webgpu", "models": { "faces": "mediapipe-face", "sort": "clip-vit-b32" } }
    }
  },
  "engines": {
    "jobs": {
      "export":   ["python", "webcodecs", "browser", "android"],
      "autopick": ["python", "wasm", "browser"],
      "routeMap": ["python", "browser"]
    },
    "providers": {
      "python":    { "enabled": true, "url": "" },
      "android":   { "enabled": "auto" },
      "webcodecs": { "enabled": "auto" },
      "wasm":      { "enabled": "auto" },
      "browser":   { "enabled": true }
    }
  },
  "lan": { "allowPhone": false, "port": 8765 },
  "storage": { "projects": "~/Videos/TourMaker" }
}
```
`"auto"` task = first enabled+available provider in `ai.order`; `"none"` = code only. Engines: first available in job list.
Secrets: the server never sends `apiKey` values to the page (`/config.json` replaces them with `"***"`); server-side providers are called through `/api/ai/{provider}`.

## Server HTTP API (tour_server.py, default port 8765)
- `GET /` → serves `web/` (static)
- `GET /config.json` → merged config with keys masked, `runtime` filled (`server`|`exe`)
- `GET /api/health` → `{"ok":true,"runtime":"server","version":"0.1.0","ffmpeg":"<version or null>","opencv":true,"ollama":true|false}`
- `POST /api/ai/{provider}` body `{"prompt": str, "images": [base64 jpeg...], "json": true}` → `{"ok":true,"data":<parsed JSON>,"tokens":{"in":n,"out":n}}` or `{"ok":false,"error":str}`. Providers: `ollama`, `openai`, `gemini`, `claude` (API key from config).
- `POST /api/transcode` multipart `file` (webm/mp4 from MediaRecorder), optional `crf` → returns `video/mp4` H.264/AAC (+faststart).
- `POST /api/autopick` multipart `file` (video), form `length` (seconds), `top` (int, default 4) → `{"ok":true,"duration":d,"candidates":[{"t":start,"score":s}...]}` (best first; sharpness = Laplacian variance, motion = frame diff, light penalty; non-overlapping windows).
- `GET /api/ollama/{path}` and `POST /api/ollama/{path}` → proxy to configured Ollama URL (avoids browser CORS).

## Android plugin (Capacitor) JS interface
`Capacitor.Plugins.TourNative`:
- `info()` → `{ok, media3:true, mlkit:true}`
- `exportProject({projectJson, outName})` → `{ok, path}` (Media3 Transformer; skeleton allowed)
- `detectFaces({imageBase64})` → `{faces:[{x,y,w,h,smile}]}` (ML Kit; skeleton allowed)

## Ownership (parallel build)
- Agent WEB: everything under `web/` only.
- Agent SERVER: everything under `server/` only.
- Agent ANDROID: everything under `android/` only.
- Agent DOCS: `README.md`, `docs/`, `config/`, `.gitignore`, `LICENSE`.
Do not edit other agents' folders. Version: 0.1.0. App name: "Day Tour Video Maker".
