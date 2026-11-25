# Day Tour Video Maker

Turn one day of a trip into a vertical vacation reel. You plan the day as **steps** (✈️ Travel → ☕ Breakfast → 🧭 Explore → 🍽️ Dinner → 🏁 Exit), drop photos and videos into each step, and the app builds a 9:16 video with titles, captions, transitions, an animated route map and music.

One shared web app runs in five places. A config file decides which **AI options** and **Engines** are switched on.

> Version 0.1.0 · MIT licensed

---

## Ways to run it

| Runtime | What it is | Start |
|---|---|---|
| 🌐 **Browser** | The app hosted on claude.ai or any static web host | Open the page URL |
| 📄 **File** | `web/index.html` opened from disk, offline | Double-click `web/index.html` |
| 💻 **Laptop server** | Python server with real ffmpeg, OpenCV and an AI proxy; your phone can use it over Wi-Fi | `server\start_server.bat` → open http://localhost:8765 |
| 🖥️ **EXE** | The same server in one desktop app window | `server\build_exe.bat` → run `dist\TourMaker.exe` |
| 📱 **APK** | Android app (Capacitor) with native export | See [`android/README-android.md`](android/README-android.md) |

### Quick start: laptop server (Windows)
```bat
cd server
start_server.bat
```
The script creates a virtual environment, installs `requirements.txt` and starts the server on port 8765. ffmpeg comes from the `imageio-ffmpeg` package, so you don't need a separate install.

### Quick start: EXE
```bat
cd server
build_exe.bat
dist\TourMaker.exe
```
You must build the EXE on Windows; PyInstaller can't cross-compile.

### Quick start: APK
Needs Node 18+, Android Studio and the Android SDK. Follow [`android/README-android.md`](android/README-android.md).

---

## Two settings you choose from

| Layer | What it decides | Options |
|---|---|---|
| 🤖 **AI options** | *Who thinks*: picking moments, writing captions, sorting files, planning the day | Claude · Ollama · LM Studio / OpenAI-compatible · Gemini · In-browser AI · None (code only) |
| ⚙️ **Engines** | *Who does the work*: export, auto-pick scoring, route map | Android native · Python server · WebCodecs · WASM · Browser |

- Every job has a **fallback order**. The app uses the first option that's enabled and responding.
- Each AI choice shows a **cost badge**: Free, Claude usage, or Paid API.
- Every AI result can be edited before you export.

Details: [`docs/CONFIG.md`](docs/CONFIG.md) · [`docs/FEATURES.md`](docs/FEATURES.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/ROADMAP.md`](docs/ROADMAP.md)

---

## Repo layout
```
tour-video-maker/
├─ web/                 shared app (plain HTML/CSS/JS, no bundler)
│  ├─ index.html  css/app.css
│  ├─ js/config.js      config + runtime detection
│  ├─ js/ai.js          AI provider layer
│  ├─ js/engines.js     engine layer
│  ├─ js/app.js         UI, timeline, renderer
│  └─ samples/          sample photos and clips
├─ server/              FastAPI laptop server + EXE packaging
├─ android/             Capacitor shell + native plugin skeleton
├─ config/              example configs per runtime + JSON schema
├─ docs/                architecture, config, features, roadmap
├─ README.md  LICENSE  .gitignore
```

---

## Privacy
- **Your media stays on your device.** Files you add are opened as local `blob:` URLs. Nothing is uploaded unless you pick an engine or AI provider that needs it, and then only to the one you chose: your own laptop server, or the AI provider for small preview frames.
- **API keys stay in your local config.** The server never sends key values to the page; `/config.json` replaces them with `***`, and the server calls providers itself through `/api/ai/{provider}`.
- On claude.ai, Claude runs through your own account, so no key is needed.
- Put personal configs in `config/*.local.json`; git ignores them.

## Credits and attribution
- Map imagery must be credited on screen (for example "Imagery: Google Earth" or your tile provider's credit). **Check each map provider's terms before using its tiles.**
- Fonts: Poppins and Manrope (Google Fonts, Open Font License).
- AI models you connect (Ollama, Gemini, Claude and others) have their own terms.

## License
MIT © 2026 Day Tour Video Maker contributors. See [`LICENSE`](LICENSE).
