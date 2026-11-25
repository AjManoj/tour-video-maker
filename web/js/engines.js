/* Day Tour Video Maker — TV.engines: which code runs each job.
   Engines: python (laptop server), android (Capacitor TourNative plugin), webcodecs, wasm, browser. */
(function () {
  const TV = (window.TV = window.TV || {});
  const C = () => TV.config;
  const E = id => C().get('engines.providers.' + id, {}) || {};
  let PY = null;        // last /api/health payload or false
  let NATIVE = null;    // TourNative.info() result or false

  const base = () => C().serverUrl() ?? '';
  const plugin = () => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TourNative) || null;

  const ENGINES = {
    python: {
      id: 'python', name: 'Laptop server (Python)', icon: '🐍',
      state() {
        if (E('python').enabled === false) return [false, 'Turned off'];
        if (PY) return [true, `Connected · ffmpeg ${PY.ffmpeg || 'missing'} · OpenCV ${PY.opencv ? 'yes' : 'no'}`];
        if (C().runtime === 'browser') return [false, 'Not reachable from this page'];
        return [false, C().serverUrl() === null ? 'Not running (open the app through tour_server.py, or set its address)' : 'Not reachable'];
      },
      async refresh() {
        if (E('python').enabled === false || C().serverUrl() === null) { PY = false; return; }
        try { const r = await fetch(base() + '/api/health', { cache: 'no-store' }); const j = await r.json(); PY = j && j.ok ? j : false; } catch (e) { PY = false; }
      }
    },
    android: {
      id: 'android', name: 'Android native (Media3)', icon: '📱',
      state() {
        if (E('android').enabled === false) return [false, 'Turned off'];
        if (NATIVE && NATIVE.ok) return [true, 'Media3 export' + (NATIVE.mlkit ? ' · ML Kit faces' : '')];
        return [false, C().runtime === 'apk' ? 'Native plugin not found' : 'Only in the Android app'];
      },
      async refresh() { const p = plugin(); if (!p) { NATIVE = false; return; } try { NATIVE = await p.info(); } catch (e) { NATIVE = false; } }
    },
    webcodecs: {
      id: 'webcodecs', name: 'WebCodecs (hardware encoder)', icon: '⚡',
      state() {
        if (E('webcodecs').enabled === false) return [false, 'Turned off'];
        return [false, typeof window.VideoEncoder === 'function' ? 'Detected · export planned for v0.2' : 'Not supported in this browser'];
      },
      async refresh() {}
    },
    wasm: {
      id: 'wasm', name: 'WASM (OpenCV.js / ffmpeg.wasm)', icon: '🧩',
      state() {
        if (E('wasm').enabled === false) return [false, 'Turned off'];
        return [false, typeof WebAssembly === 'object' ? 'Detected · planned for v0.2' : 'Not supported'];
      },
      async refresh() {}
    },
    browser: {
      id: 'browser', name: 'Browser (Canvas + MediaRecorder)', icon: '🌐',
      state() { return [true, typeof MediaRecorder === 'function' ? 'Real-time recording' : 'Preview only (no MediaRecorder)']; },
      async refresh() {}
    }
  };
  const JOBS = { export: 'Final export', autopick: 'Auto-pick scoring', routeMap: 'Route map (satellite via server: planned)' };

  const engines = {
    ENGINES, JOBS,
    available(id) { return !!(ENGINES[id] && ENGINES[id].state()[0]); },
    status() { return Object.values(ENGINES).map(e => { const [available, reason] = e.state(); return { id: e.id, name: e.name, icon: e.icon, available, reason }; }); },
    /** First available engine id for a job (falls back to 'browser'). */
    pick(job) {
      const planned = { routeMap: ['python'] }; // engines listed but not built yet in v0.1
      for (const id of C().get('engines.jobs.' + job, ['browser'])) if (engines.available(id) && !(planned[job] || []).includes(id)) return id;
      return 'browser';
    },
    async init() { await Promise.all(Object.values(ENGINES).map(e => e.refresh())); },
    async refresh() { return engines.init(); },
    async test(id) { const e = ENGINES[id]; if (!e) return { ok: false, msg: 'Unknown engine' }; await e.refresh(); const [ok, msg] = e.state(); return { ok, msg }; },

    /** Re-encode a MediaRecorder recording to H.264/AAC MP4 on the laptop server. */
    async transcode(blob, crf = 20) {
      const fd = new FormData(); fd.append('file', blob, 'recording.' + (/mp4/.test(blob.type) ? 'mp4' : 'webm')); fd.append('crf', String(crf));
      const r = await fetch(base() + '/api/transcode', { method: 'POST', body: fd });
      if (!r.ok) throw { code: 'transcode_failed', message: 'Server could not convert the video (HTTP ' + r.status + ')' };
      return await r.blob();
    },
    /** Ask the laptop server for the best non-overlapping windows of `length` seconds. */
    async autopick(fileOrBlob, length, top = 4) {
      const fd = new FormData(); fd.append('file', fileOrBlob, fileOrBlob.name || 'clip.mp4'); fd.append('length', String(length)); fd.append('top', String(top));
      const r = await fetch(base() + '/api/autopick', { method: 'POST', body: fd });
      const j = await r.json();
      if (!j.ok) throw { code: 'autopick_failed', message: j.error || 'Server auto-pick failed' };
      return j; // {duration, candidates:[{t,score}]}
    },
    /** Android native export (Media3). Skeleton until the plugin implements it. */
    async nativeExport(projectJson, outName) {
      const p = plugin(); if (!p) throw { code: 'no_plugin', message: 'Android plugin missing' };
      return p.exportProject({ projectJson: JSON.stringify(projectJson), outName });
    }
  };
  TV.engines = engines;
})();
