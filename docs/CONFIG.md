# Configuration

The app reads `tour.config.json`: from the server (`GET /config.json`), from next to `index.html`, or from built-in defaults. In-app settings (AI options and Engines screens) are saved in the browser and win over the file.

Examples for each runtime are in [`config/`](../config/); the schema is in [`config/tour.config.schema.json`](../config/tour.config.schema.json).
Put your personal copy in `config/tour.config.local.json`; git ignores it.

## Top level

| Key | Type | Default | Meaning |
|---|---|---|---|
| `runtime` | `"auto"`\|`"browser"`\|`"file"`\|`"server"`\|`"exe"`\|`"apk"` | `"auto"` | Force a runtime, or detect it (see ARCHITECTURE.md) |
| `ai` | object | — | AI options |
| `engines` | object | — | Execution engines |
| `lan` | object | — | Phone access to the laptop server |
| `storage` | object | — | Where projects and exports are saved (server/EXE) |

## `ai`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `ai.tasks.pick` | `"auto"`\|`"none"`\|provider | `"auto"` | Who judges the best moment among candidates |
| `ai.tasks.captions` | same | `"auto"` | Who writes titles and captions |
| `ai.tasks.sort` | same | `"auto"` | Who sorts a whole day's files into steps |
| `ai.tasks.plan` | same | `"auto"` | Who drafts the day's steps ("Plan my day") |
| `ai.order` | provider[] | `["browserai","ollama","openai","gemini","claude"]` | Order tried when a task is `"auto"` |

`"auto"` = the first provider in `order` that is enabled and passes its test. `"none"` = code only, no AI.

### `ai.providers.claude`
| Key | Type | Default | Meaning |
|---|---|---|---|
| `enabled` | bool | `true` | |
| `via` | `"claude.ai"`\|`"apiKey"` | `"claude.ai"` | `claude.ai` = the page's `sample` capability (no key, uses your Claude plan). `apiKey` = server calls the Anthropic API (billed separately) |
| `apiKey` | string | `""` | Only for `via: "apiKey"`; masked as `***` when the server sends config |
| `model` | string | `"claude-haiku-5-5"` | Model for API calls |

### `ai.providers.ollama`
| Key | Type | Default | Meaning |
|---|---|---|---|
| `enabled` | bool | `true` | |
| `url` | string | `"http://localhost:11434"` | Ollama address. On APK you can point at the laptop server's proxy: `http://<laptop-ip>:8765/api/ollama` |
| `model` | string | `"qwen3-vl:4b"` | Must be a **vision** model for pick/sort/captions (e.g. `qwen3-vl:4b`, `gemma3:4b`, `minicpm-v4.6`) |

### `ai.providers.openai` (LM Studio / any OpenAI-compatible endpoint)
| Key | Type | Default | Meaning |
|---|---|---|---|
| `enabled` | bool | `false` | |
| `label` | string | `"LM Studio / OpenAI-compatible"` | Shown in the UI |
| `url` | string | `"http://localhost:1234/v1"` | Base URL (needs `/chat/completions`) |
| `apiKey` | string | `""` | Optional for local servers |
| `model` | string | `""` | Model id |

### `ai.providers.gemini`
| Key | Type | Default | Meaning |
|---|---|---|---|
| `enabled` | bool | `false` | |
| `apiKey` | string | `""` | Google AI key |
| `model` | string | `"gemini-flash-latest"` | Model id |

### `ai.providers.browserai` (planned)
| Key | Type | Default | Meaning |
|---|---|---|---|
| `enabled` | bool | `false` | In-page AI with MediaPipe / Transformers.js |
| `backend` | `"webgpu"`\|`"wasm"` | `"webgpu"` | WebGPU is faster; WASM works everywhere |
| `models` | object | `{"faces":"mediapipe-face","sort":"clip-vit-b32"}` | Model per job |

## `engines`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `engines.jobs.export` | engine[] | `["python","webcodecs","browser","android"]` | Final video encoder, in fallback order. Android native is last until its export supports titles, transitions and audio |
| `engines.jobs.autopick` | engine[] | `["python","wasm","browser"]` | Who scores frames |
| `engines.jobs.routeMap` | engine[] | `["python","browser"]` | Satellite map (Python, planned) or drawn map (browser) |
| `engines.providers.<name>.enabled` | bool \| `"auto"` | see example | `"auto"` = use it if detected |
| `engines.providers.python.url` | string | `""` | `""` = same origin. Set to `http://<laptop-ip>:8765` on APK or file |

Engine names: `android`, `python`, `webcodecs`, `wasm`, `browser`.

## `lan`
| Key | Type | Default | Meaning |
|---|---|---|---|
| `allowPhone` | bool | `false` | Server listens on all interfaces so a phone on the same Wi-Fi can connect |
| `port` | int | `8765` | Server port |

## `storage`
| Key | Type | Default | Meaning |
|---|---|---|---|
| `projects` | string | `"~/Videos/TourMaker"` | Server/EXE folder for projects and exports |

---

## Examples

**Free and offline on the laptop (Ollama for everything):**
```json
{ "ai": { "tasks": { "pick": "ollama", "captions": "ollama", "sort": "ollama", "plan": "ollama" } } }
```

**Best words from Claude, free judgement locally:**
```json
{ "ai": { "tasks": { "pick": "ollama", "captions": "claude", "sort": "none", "plan": "claude" },
          "providers": { "claude": { "enabled": true, "via": "apiKey", "apiKey": "sk-ant-..." } } } }
```

**Phone using the laptop over Wi-Fi:**
```json
{ "engines": { "providers": { "python": { "enabled": true, "url": "http://192.168.1.50:8765" } } },
  "ai": { "providers": { "ollama": { "url": "http://192.168.1.50:8765/api/ollama" } } } }
```

**Code only, no AI anywhere:**
```json
{ "ai": { "tasks": { "pick": "none", "captions": "none", "sort": "none", "plan": "none" } } }
```
