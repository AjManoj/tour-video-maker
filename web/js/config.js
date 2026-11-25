/* Day Tour Video Maker — TV.config: defaults, loading, runtime detection.
   Classic script (no modules) so it works from file:// too. */
(function () {
  const TV = (window.TV = window.TV || {});
  const VERSION = '0.1.0';

  const DEFAULTS = {
    runtime: 'auto',
    ai: {
      tasks: { pick: 'auto', captions: 'auto', sort: 'auto', plan: 'auto' },
      order: ['browserai', 'ollama', 'openai', 'gemini', 'claude'],
      providers: {
        claude: { enabled: true, via: 'claude.ai', apiKey: '', model: 'claude-haiku-5-5' },
        ollama: { enabled: true, url: 'http://localhost:11434', model: 'qwen3-vl:4b' },
        openai: { enabled: false, label: 'LM Studio / OpenAI-compatible', url: 'http://localhost:1234/v1', apiKey: '', model: '' },
        gemini: { enabled: false, apiKey: '', model: 'gemini-flash-latest' },
        browserai: { enabled: false, backend: 'webgpu', models: { faces: 'mediapipe-face', sort: 'clip-vit-b32' } }
      }
    },
    engines: {
      jobs: {
        export: ['python', 'webcodecs', 'browser', 'android'],
        autopick: ['python', 'wasm', 'browser'],
        routeMap: ['python', 'browser']
      },
      providers: {
        python: { enabled: true, url: '' },
        android: { enabled: 'auto' },
        webcodecs: { enabled: 'auto' },
        wasm: { enabled: 'auto' },
        browser: { enabled: true }
      }
    },
    lan: { allowPhone: false, port: 8765 },
    storage: { projects: '~/Videos/TourMaker' }
  };

  const clone = o => JSON.parse(JSON.stringify(o));
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  function merge(base, over) {
    if (!isObj(over)) return base;
    for (const k of Object.keys(over)) {
      if (isObj(over[k]) && isObj(base[k])) merge(base[k], over[k]);
      else if (over[k] !== undefined) base[k] = clone(over[k]);
    }
    return base;
  }
  const LS_KEY = 'tourConfig';
  function readLocal() { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; } }

  async function fetchJSON(url, ms = 2500) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), ms) : null;
    try {
      const r = await fetch(url, { cache: 'no-store', signal: ctl && ctl.signal });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; } finally { if (t) clearTimeout(t); }
  }

  const cfg = {
    VERSION,
    DEFAULTS,
    data: clone(DEFAULTS),
    runtime: 'browser',
    server: null,            // /api/health payload when served by tour_server.py
    fileConfig: null,        // config.json contents (if any)
    get(path, dflt) {
      let o = cfg.data;
      for (const p of String(path).split('.')) { if (o == null) return dflt; o = o[p]; }
      return o === undefined ? dflt : o;
    },
    set(path, val) {
      const parts = String(path).split('.'); let o = cfg.data;
      for (const p of parts.slice(0, -1)) { if (!isObj(o[p])) o[p] = {}; o = o[p]; }
      o[parts[parts.length - 1]] = val;
    },
    async detect() {
      try { if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return (cfg.runtime = 'apk'); } catch (e) {}
      if (location.protocol === 'http:' || location.protocol === 'https:') {
        const h = await fetchJSON('/api/health', 1500);
        if (h && h.ok) { cfg.server = h; return (cfg.runtime = h.runtime === 'exe' ? 'exe' : 'server'); }
      }
      if (location.protocol === 'file:') return (cfg.runtime = 'file');
      return (cfg.runtime = 'browser');
    },
    async load() {
      cfg.data = clone(DEFAULTS);
      // config.json next to index.html (file/apk/static hosting) or served by the server
      let fc = null;
      if (location.protocol !== 'file:') fc = (await fetchJSON('/config.json')) || (await fetchJSON('config.json'));
      else fc = await fetchJSON('config.json'); // usually blocked on file://; ignored
      if (fc) { cfg.fileConfig = fc; merge(cfg.data, fc); }
      const loc = readLocal(); if (loc) merge(cfg.data, loc);
      const forced = cfg.data.runtime;
      await cfg.detect();
      if (forced && forced !== 'auto' && ['browser', 'file', 'server', 'exe', 'apk'].includes(forced) && !cfg.server) cfg.runtime = forced;
      return cfg.data;
    },
    save() {
      // Only user-editable sections are kept locally; secrets typed in the page stay in this browser.
      try { localStorage.setItem(LS_KEY, JSON.stringify({ ai: cfg.data.ai, engines: cfg.data.engines })); } catch (e) {}
    },
    reset() { try { localStorage.removeItem(LS_KEY); } catch (e) {} cfg.data = clone(DEFAULTS); if (cfg.fileConfig) merge(cfg.data, cfg.fileConfig); },
    /** True when an AI/engine call should go through the laptop server. */
    viaServer() { return cfg.runtime === 'server' || cfg.runtime === 'exe'; },
    serverUrl() {
      const u = cfg.get('engines.providers.python.url', '');
      if (u) return u.replace(/\/$/, '');      // e.g. phone → http://192.168.1.20:8765
      return cfg.viaServer() ? '' : null;       // '' = same origin; null = no server known
    },
    label() { return ({ browser: '🌐 Browser', file: '💾 Laptop file', server: '💻 Laptop server', exe: '🖥️ Desktop app', apk: '📱 Android app' })[cfg.runtime] || cfg.runtime; }
  };
  TV.config = cfg;
})();
