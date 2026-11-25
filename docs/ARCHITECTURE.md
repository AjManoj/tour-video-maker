# Architecture

## One core, several runtimes

```
              ┌──────────────── Shared core: web/ ────────────────┐
              │ index.html · css/app.css                           │
              │ js/app.js     steps · templates · timeline ·       │
              │               canvas preview · captions · export UI│
              │ js/config.js  defaults + load + detect runtime     │
              │ js/ai.js      AI provider layer   (TV.ai)          │
              │ js/engines.js engine layer        (TV.engines)     │
              └───────────────┬────────────────────────────────────┘
                              │ "what do I have here?"
   ┌────────────┬─────────────┼───────────────┬──────────────────────┐
   ▼            ▼             ▼               ▼                      ▼
 🌐 browser   📄 file      💻 server        🖥️ exe                  📱 apk
 claude.ai /  index.html   tour_server.py   launcher.py +           Capacitor shell
 any host     from disk    (FastAPI) serves pywebview window        + TourNative plugin
 Claude via                web/ + /api/*    around the same server  (Media3, ML Kit)
 `sample`                  ffmpeg · OpenCV  (PyInstaller, 1 file)   + optional LAN
                           AI proxy                                   laptop server
```

## Runtime detection (`TV.config.detect()`)
1. `window.Capacitor?.isNativePlatform?.()` → **apk**
2. Same-origin `fetch('/api/health')` succeeds → its `runtime` field (**server** or **exe**)
3. `location.protocol === 'file:'` → **file**
4. Otherwise → **browser** (Claude may be reachable via `window.claude.use('sample')`)

If `runtime` in the config isn't `"auto"`, it overrides detection.

## Config loading
1. Built-in defaults in `config.js`.
2. `GET config.json` (from the server, or next to `index.html`), merged over the defaults. On the server, every `apiKey` arrives as `"***"`.
3. The user's settings from the in-app screens, saved in `localStorage`, are merged last.

## AI provider layer (`TV.ai`)

```
task (pick | captions | sort | plan)
   │  ai.tasks[task] = "auto" | "none" | <provider>
   ▼
resolve → "auto": first provider in ai.order that is enabled AND passes test()
   │
   ├─ claude    browser: window.claude.use('sample').json(prompt,{images})
   │            server/exe/apk: POST /api/ai/claude (key stays on the server)
   ├─ ollama    server/exe: /api/ollama/* proxy · file/apk: direct URL
   ├─ openai    LM Studio / OpenAI-compatible: /api/ai/openai or direct
   ├─ gemini    /api/ai/gemini or direct with a key typed into the app
   ├─ browserai MediaPipe / CLIP in the page (WASM or WebGPU), planned
   └─ none      code-only path
   ▼
JSON result → shown in the UI, editable; token estimate added to the cost meter
```

Every provider has the same shape: `test()`, `json(prompt, images[]) → object`, plus a cost badge (`free`, `claude`, `paid`). Frames are shrunk to about 320 px JPEGs before sending.

## Engine layer (`TV.engines`)

```
job (export | autopick | routeMap)
   │  engines.jobs[job] = ordered list
   ▼
first engine that is enabled AND available() → run; on error → next in list
```

| Engine | Available when |
|---|---|
| android | Capacitor plugin `TourNative` responds to `info()` |
| python | `/api/health` (same origin, or `engines.providers.python.url`) answers |
| webcodecs | `'VideoEncoder' in window` |
| wasm | `typeof WebAssembly === 'object'` |
| browser | Always |

## Data flows

**Export**
```
canvas timeline ─▶ engine?
  android   → TourNative.exportProject(projectJson)     (Media3, hardware encoder)
  python    → MediaRecorder WebM ─POST /api/transcode─▶ H.264/AAC MP4 (ffmpeg)
  webcodecs → VideoEncoder + MP4 writer (planned)
  browser   → MediaRecorder → MP4/WebM, saved via downloads capability or <a download>
```

**Auto-pick**
```
video ─▶ python: POST /api/autopick → candidates[] (OpenCV: Laplacian sharpness,
                frame-difference motion, light penalty, non-overlapping windows)
       └▶ wasm/browser: same scoring on a 48×86 canvas every ~0.5 s
candidates (top 4) ─▶ AI pick task? → provider chooses one (faces, smiles, action)
                    └▶ none → best score wins
```

**Captions / sort / plan**
```
2 frames per step (or thumbnails, or itinerary text) ─▶ TV.ai task ─▶ JSON
{title, sub} | {labels[]} | {steps[]} ─▶ applied to the project ─▶ user edits
```

## Security
- **claude.ai (CSP):** the page may load scripts only from approved CDNs and can't `fetch` other hosts. So there's no Ollama, no remote tiles and no remote model weights; Claude runs through the `sample` capability, and files are saved through the `downloads` capability.
- **CORS:** a page opened from `file://` has origin `null`. Ollama needs `OLLAMA_ORIGINS=*` for direct calls. The laptop server avoids this by proxying `/api/ollama/*` and `/api/ai/*` from the same origin.
- **Keys:** stored only in the server's config file, or in the app's local settings on file and APK. They're never written into a page that's hosted for other people. `/config.json` masks them as `***`.
- **LAN:** `lan.allowPhone=true` binds the server to `0.0.0.0` so a phone on the same Wi-Fi can connect. Keep it off on untrusted networks.
- **Media:** stays local; it's only sent to engines or providers you enable.
