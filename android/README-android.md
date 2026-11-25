# Day Tour Video Maker: Android (APK)

A [Capacitor](https://capacitorjs.com) shell that packages the shared web app (`../web`) into an Android app, plus a native plugin (`TourNative`) for hardware video export (Media3 Transformer) and on-device face/smile detection (ML Kit).

Pinned versions: **Capacitor 7** (`^7.0.0`), **Media3 1.5.1**, **ML Kit face-detection 16.1.7**, **Kotlin 2.0.21**. Bump them in `package.json` / `scripts/install-plugin.mjs` if you want newer ones.

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20 or newer |
| Android Studio | Ladybug (2024.2) or newer, with Android SDK 35 |
| JDK | **21** (Capacitor 7 requires it; Android Studio bundles a JDK 21) |
| A phone | Android 6.0+ with USB debugging, or an emulator |

## Build the APK

Run these from this `android/` folder:

```bash
npm install                        # Capacitor CLI + platform packages
npm run add                        # copies ../web to www/, runs "npx cap add android", installs the plugin
npm run sync                       # re-copy ../web and sync (run after every web change)
npm run build:apk                  # gradlew assembleDebug
```

`npm run add` runs `scripts/install-plugin.mjs` for you. To re-run it on its own (it's idempotent): `npm run install-plugin`.

The debug APK lands at:

```
android/native-android/app/build/outputs/apk/debug/app-debug.apk
```

Copy it to your phone and open it (allow "install unknown apps"), or press **Run** in Android Studio (`npm run open`).

### What `install-plugin.mjs` changes in the generated project
- Copies `plugin/TourNativePlugin.kt` into `app/src/main/java/com/tourvideomaker/app/`
- Registers it in `MainActivity` (`registerPlugin(TourNativePlugin.class)` before `super.onCreate`)
- Adds Kotlin support (`kotlin-gradle-plugin`, `apply plugin: 'kotlin-android'`, matching `jvmTarget`)
- Adds dependencies: `media3-transformer`, `media3-effect`, `media3-common`, `mlkit:face-detection`
- Adds the `INTERNET` permission and `network_security_config.xml` so the app can call a laptop server over plain http on your Wi-Fi

## Use the laptop as the engine (optional)

1. On the laptop, start the server with phone access on (`"lan": {"allowPhone": true}` in the config, then `server/start_server.bat`).
2. Find the laptop's IP (`ipconfig` → IPv4, e.g. `192.168.1.20`).
3. In the app: **Settings → Engines → Python URL** = `http://192.168.1.20:8765` → **Test**.

With that connected, export, auto-pick and satellite route maps run on the laptop; the phone just shows the editor.

## Native plugin API (`Capacitor.Plugins.TourNative`)

| Method | Returns | Status |
|---|---|---|
| `info()` | `{ok, media3, mlkit, version}` | ✅ |
| `detectFaces({imageBase64})` | `{faces:[{x,y,w,h,smile,eyesOpen}], width, height}`, boxes as 0–1 fractions | ✅ ML Kit, offline |
| `exportProject({projectJson \| project, outName})` | `{ok, path, durationMs, bytes}` | ⚠️ Basic, see below |

`projectJson` shape:

```json
{ "width": 1080, "height": 1920, "fps": 30,
  "items": [
    { "uri": "samples/gate.jpg", "kind": "image", "durationMs": 2600 },
    { "uri": "content://media/external/video/media/123", "kind": "video", "startMs": 1000, "endMs": 4600 }
  ] }
```

`uri` may be `content://` / `file://` (from the gallery picker or the Filesystem plugin) or a path inside the bundled web assets. **`blob:` URLs from the WebView can't be read natively**, so the web layer must pass real URIs when this engine is used.

Output goes to the app's own Movies folder (`Android/data/com.tourvideomaker.app/files/Movies/`); no storage permission is needed.

## Limitations (v0.1)
- **Native export is basic:** clips are scaled/cropped to 9:16, trimmed and joined with hard cuts as H.264, **without sound, titles, captions, badges, transitions or the route map**. Those are still drawn by the web canvas. Until the native path catches up (TODOs in `TourNativePlugin.kt`), the app should prefer the WebCodecs or laptop engine when you want the full look.
- Clip audio is dropped in native export (images have no audio track; mixing needs silent audio for photos).
- Kotlin was written against the Media3 1.5 and ML Kit APIs but couldn't be compiled in the environment it was written in. Expect to fix small compile issues on the first Android Studio build.
- `network_security_config.xml` allows plain http app-wide (Android can't allow-list IP ranges). Tighten it for a store release.
- Claude helpers in the APK need an Anthropic API key in Settings (billed separately from your Claude plan); the claude.ai built-in Claude access only works on claude.ai.
