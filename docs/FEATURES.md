# Features

Every feature, who can run it, and how the options rank.

- **Code** = an engine doing the work deterministically. **AI** = a model judging or writing.
- Rankings are **expected, not benchmarked**, for a typical laptop with no dedicated graphics card and a recent Android phone.
- **Status:** ✅ implemented in v0.1 · 🧩 stub / partial · 🗺️ planned

**Key:** Py = laptop Python server · And = Android native · WC = WebCodecs · WASM = OpenCV.js / ffmpeg.wasm · JS = plain browser code · 🧠 = in-browser AI (MediaPipe / CLIP / small VLM) · 📱 = on-device AI on the phone (ML Kit / Gemma) · Olm = Ollama / LM Studio · Gem = Gemini · Cl = Claude · ☁️ = Claude cloud render

**Default columns:** B = browser (claude.ai) · F = file · S = server / EXE · A = APK

---

## 1. Media in

| Feature | Code version | AI version | Ability (best → worst) | Speed (fast → slow) | B | F | S | A | Status |
|---|---|---|---|---|---|---|---|---|---|
| Add photos & videos | File picker, gallery | — | And = JS | And = JS | JS | JS | JS | And | ✅ (JS) |
| Read date / time / GPS | EXIF and file time | — | Py > JS | JS > Py | JS | JS | Py | And | 🧩 file time only |
| Thumbnails | Canvas / ffmpeg | — | Py = And > WASM > JS | And > Py > JS > WASM | JS | JS | Py | And | ✅ (JS) |
| Remove duplicates & blurry shots | Sharpness + image similarity | 🧠 CLIP similarity | 🧠 > Py > WASM > JS | Py > WASM > 🧠 > JS | JS | JS | Py | 🧠 | 🗺️ |

## 2. Organising the day

| Feature | Code version | AI version | Ability | Speed | B | F | S | A | Status |
|---|---|---|---|---|---|---|---|---|---|
| Day templates (Travel, City, Beach, Food, Theme park + your own) | Presets, saved templates | — | — | Instant | Code | Code | Code | Code | ✅ |
| ✨ Plan my day | Presets | Draft steps from an itinerary, description or photos | Cl > Olm > Gem > 🧠 WebLLM > presets | Presets > Olm > Gem > Cl > 🧠 | Cl | Olm | Olm/Cl | Gem/Olm | ✅ (text, via providers) |
| Sort a whole day into steps | Group by time taken | Label thumbnails by scene | Cl > Olm > Gem > 🧠 CLIP > time | Time > 🧠 > Olm > Gem > Cl | Cl | Olm | Olm | 🧠 | ✅ (time + AI providers) · 🗺️ 🧠 |
| Name places | GPS → place lookup | Read place from photos | Py lookup > Cl > Olm | Py > Olm > Cl | — | — | Py | Py | 🗺️ |
| Suggest missing steps | Rules ("no dinner clips") | Cl / Olm review | Cl > Olm > rules | Rules > Olm > Cl | Code | Code | Code | Code | 🗺️ |

## 3. Choosing moments

| Feature | Code version | AI version | Ability | Speed | B | F | S | A | Status |
|---|---|---|---|---|---|---|---|---|---|
| Score sharpness / motion / light | Laplacian variance, frame difference, brightness | — | Py ≈ WASM > JS | Py > WASM > JS | JS | JS | Py | Py/JS | ✅ JS + Py |
| Faces & smiles | Classic OpenCV face detector | MediaPipe / ML Kit | 📱 ≈ 🧠 > Olm > OpenCV | 📱 > 🧠 > OpenCV > Olm | 🧠 | 🧠 | 🧠 | 📱 | 🗺️ |
| Best-moment judgement | Top score | AI picks from 4 candidates | Cl > Olm ≈ Gem > 🧠 faces+score > score | Score > 🧠 > Olm > Gem > Cl | Cl | Olm | Olm | Olm (LAN) | ✅ |
| Reframe to 9:16 | Centre crop | Face / person tracking | 📱/🧠 > Py tracking > centre | Centre > 📱 > 🧠 > Py | Centre | Centre | Centre | Centre | 🧩 centre only |
| Pacing / clip length | Fixed or beat-synced | Hold great moments, cut dull ones | Cl > Olm > beat code > even | Code > Olm > Cl | Code | Code | Code | Code | 🧩 fixed lengths |
| Target length ("make it 30 s") | Trim all evenly | Choose what to drop | Cl > Olm > even trim | Code > Olm > Cl | Code | Code | Code | Code | 🗺️ |

## 4. Words & style

| Feature | Code version | AI version | Ability | Speed | B | F | S | A | Status |
|---|---|---|---|---|---|---|---|---|---|
| Titles & captions | Templates per step type | Write from 2 frames | Cl > Olm (qwen3-vl) ≈ Gem > 🧠 small VLM > templates | Templates > 🧠 > Olm > Gem > Cl | Cl | Olm | Olm/Cl | Gem/Olm | ✅ |
| Intro & ending cards | Day, place, date | One-line day summary | Cl > Olm > code | Code > Olm > Cl | Code | Code | Code | Code | ✅ code · 🗺️ AI |
| Emoji & icons | Lookup by step type | Pick from content | Cl > Olm > lookup | Lookup > Olm > Cl | Code | Code | Code | Code | ✅ code |
| Colour theme / look | 4 presets; auto levels (planned) | Match a look across clips | Py LUT > WASM > JS filters (AI picks the style) | JS > Py > WASM | JS | JS | JS | JS | ✅ presets · 🗺️ grading |
| Transition choice | One default + per-step override | Choose by mood and content | Cl ≈ Olm > rules | Rules > Olm > Cl | Code | Code | Code | Code | ✅ code · 🗺️ AI |
| Music choice | Your track; tempo sort (planned) | Pick by mood | Cl / Olm > tempo code | Code > Olm > Cl | Code | Code | Code | Code | ✅ manual · 🗺️ |
| Cover image | Highest-scoring frame | Best frame + title text | Cl > Olm > score | Score > Olm > Cl | Code | Code | Code | Code | 🗺️ |
| Social post & hashtags | Templates | Write in your style | Cl > Olm > 🧠 WebLLM > templates | Templates > Olm > Cl | Cl | Olm | Olm | Gem | 🗺️ |

## 5. Maps

| Feature | Code version | AI version | Ability | Speed | B | F | S | A | Status |
|---|---|---|---|---|---|---|---|---|---|
| Drawn route animation | Canvas curve, plane, pins | — | — | Instant | JS | JS | JS | JS | ✅ |
| Satellite zoom-out route | Georeferenced tiles + camera path | — | ☁️ Google Earth > Py satellite > map pack > drawn | Drawn > map pack > Py > ☁️ | Drawn | Drawn | Py | Py (LAN) | 🗺️ |
| Route from flight number / place names | Airport list, geocoding | Parse messy text | Cl > Py lookup > Olm | Py > Olm > Cl | Code | Code | Py | Py | 🗺️ |

## 6. Video & audio

| Feature | Code version | AI version | Ability | Speed | B | F | S | A | Status |
|---|---|---|---|---|---|---|---|---|---|
| Live preview | Canvas timeline | — | — | — | JS | JS | JS | JS | ✅ |
| Transitions & motion | Fade, zoom, slide, whip, iris; slow zoom on photos | — | Py ≈ JS | JS > Py | JS | JS | JS | JS | ✅ |
| Final export | MediaRecorder · ffmpeg transcode · WebCodecs · Media3 | — | Py > And > WC > WASM > MediaRecorder | And ≈ WC > Py > MediaRecorder (real time) > WASM | JS | JS | Py | JS (Py on Wi-Fi; And once overlays ship) | ✅ JS + Py transcode · 🧩 And · 🗺️ WC/WASM |
| Clip sound & music mix | Web Audio / ffmpeg | — | Py > WASM > Web Audio | Web Audio > Py > WASM | JS | JS | JS→Py | And | ✅ Web Audio |
| Auto-duck music under speech | Loudness detection | — | Py > WASM | Py > WASM | — | — | Py | — | 🗺️ |
| Subtitles from speech | Detect talking only | Whisper transcription | Cl ≈ Olm > 🧠 Whisper | Olm > 🧠 > Cl | — | 🧠 | Olm | 🧠 | 🗺️ |
| Stabilisation | ffmpeg vidstab / Media3 | — | Py > And > WASM | And > Py > WASM | — | — | Py | And | 🗺️ |
| Privacy blur (strangers, plates) | Blur all faces except chosen | Family vs stranger grouping | 📱/🧠 > Py > blur all | Blur all > 📱 > 🧠 > Py | 🧠 | 🧠 | Py | 📱 | 🗺️ |
| Quality check before export | Black frames, short clips, clipping audio, text overflow | Review the flow | Code + Cl > code > Olm | Code > Olm > Cl | Code | Code | Code | Code | 🗺️ |

## 7. Projects & settings

| Feature | Code version | AI version | Ability | Speed | B | F | S | A | Status |
|---|---|---|---|---|---|---|---|---|---|
| Save, undo, my templates | localStorage / files | — | — | — | JS | JS | JS (+Py files 🗺️) | JS | ✅ |
| AI options screen | Provider list, per-task choice, Test | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Engines screen | Status, per-job fallback | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cost meter | Token estimate, engine used | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Trip recap (all days → one reel) | Top clip per day | Story arc | Cl > Olm > top score | Code > Olm > Cl | Cl | Olm | Olm | Gem | 🗺️ |
| Export project for Claude render | project.json + media zip | ☁️ full pipeline | ☁️ best | Slow, costs tokens | ✅ | ✅ | ✅ | ✅ | 🗺️ |

---

## Patterns
- **Laptop Python** is the best all-round engine: top quality for heavy work, and free.
- **On-device / in-browser AI** wins for faces, reframing and privacy: fast, free, and private.
- **Claude** wins on words and judgement (captions, planning, story) in cheap 1–2K-token calls.
- **Ollama** is the best offline substitute for Claude: roughly second on quality and free, but slower on a laptop without a dedicated graphics card.
- **WASM** is the universal fallback: it always works but is rarely fastest.

## Rules the app follows
1. Engine first: anything code can do reliably never calls AI.
2. AI only for judgement and words.
3. `"auto"` tries the cheapest capable provider first (`ai.order`).
4. Every job can be overridden in AI options / Engines.
5. Every AI result is editable before export.
