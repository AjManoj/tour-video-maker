# Roadmap

Statuses match [`FEATURES.md`](FEATURES.md). Each phase is usable by itself.

## v0.1: Foundations (this release)
- Shared web core: steps, templates, ✨ Plan my day, canvas preview, transitions, themes, music, undo.
- Config loader and runtime detection (browser / file / server / EXE / APK).
- AI options layer: Claude, Ollama, OpenAI-compatible (LM Studio), Gemini, none.
- Engines layer with fallback; in-browser auto-pick scoring; MediaRecorder export.
- Laptop server: health, config with masked keys, AI proxy, Ollama proxy, `/api/transcode` (H.264), `/api/autopick` (OpenCV).
- EXE packaging scripts; Android Capacitor shell + `TourNative` plugin skeleton.

## Phase 1: Faster, better exports
- **WebCodecs export:** hardware H.264 in the browser with a JS MP4 writer, faster than real time. Audio through `AudioEncoder`.
- **ffmpeg.wasm** fallback for browsers without WebCodecs.
- **Media3 overlays** in the APK: titles, captions and transitions rendered natively; `exportProject` fully implemented.

## Phase 2: Free on-device AI
- **MediaPipe** face and smile detection for auto-pick and 9:16 reframing (browser + APK).
- **CLIP** (Transformers.js) for sorting files into steps and removing near-duplicates.
- ML Kit faces in the APK; optional Gemma on-device for captions.
- Privacy blur using on-device face grouping.

## Phase 3: Real maps
- **Satellite map engine (Python):** download and cache tiles from a provider whose terms allow it, georeference them, render the zoom-out route with plane, glow and selfie bubble. Credit shown on screen.
- **Map packs:** pre-built tile bundles for claude.ai and phone use where live downloads are blocked.
- Route from flight number or place names (airport list + geocoding).

## Phase 4: Story features
- **Trip recap:** all days into one reel with a story arc.
- **Whisper subtitles:** in-browser, via Ollama, or via Claude.
- Beat-synced pacing, target length ("make it 30 s"), music by mood.
- Auto-duck music under speech; quality check before export.
- Cover image and social post text.

## Phase 5: Polish & sharing
- Export project for Claude cloud render (`project.json` + media zip).
- Project files on the server (`storage.projects`), phone ↔ laptop sync over LAN.
- Installer and signed APK release builds.
