/* Day Tour Video Maker — TV.ai: one interface over every AI provider.
   TV.ai.json(task, prompt, imageBlobs, opts) → parsed JSON.
   Providers: claude, ollama, openai (LM Studio / any OpenAI-compatible), gemini, browserai (stub). */
(function () {
  const TV = (window.TV = window.TV || {});
  const C = () => TV.config;
  const P = id => C().get('ai.providers.' + id, {}) || {};
  const isLocalUrl = u => /^https?:\/\/(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u || '');

  // ---------- helpers ----------
  const b64 = blob => new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(',')[1]); f.onerror = rej; f.readAsDataURL(blob); });
  function parseJSON(text) {
    if (text && typeof text === 'object') return text;
    const s = String(text || '').trim();
    try { return JSON.parse(s); } catch (e) {}
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) { try { return JSON.parse(fence[1]); } catch (e) {} }
    const a = s.search(/[\[{]/), b = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
    if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
    throw { code: 'invalid_json', message: 'Reply was not JSON', text: s.slice(0, 400) };
  }
  async function postJSON(url, body, headers = {}) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const t = await r.text();
    if (!r.ok) throw { code: 'http_' + r.status, message: `HTTP ${r.status}: ${t.slice(0, 200)}` };
    try { return JSON.parse(t); } catch (e) { throw { code: 'bad_response', message: t.slice(0, 200) }; }
  }
  async function viaServer(provider, prompt, images) {
    const base = C().serverUrl() ?? '';
    const r = await postJSON(base + '/api/ai/' + provider, { prompt, images: await Promise.all((images || []).map(b64)), json: true });
    if (!r.ok) throw { code: 'provider_error', message: r.error || 'Server AI call failed' };
    return { data: parseJSON(r.data), tokens: r.tokens || {} };
  }
  const hasServer = () => C().serverUrl() !== null && !!(C().server || C().get('engines.providers.python.url'));
  const JSON_HINT = '\nReply with JSON only, no other text.';

  // ---------- Claude ----------
  let SAMPLE = null, SAMPLE_IMG = false, SAMPLE_TRIED = false;
  async function initSample() {
    if (SAMPLE_TRIED) return SAMPLE; SAMPLE_TRIED = true;
    try {
      if (window.claude && window.claude.use) {
        SAMPLE = (await window.claude.use('sample')) || null;
        if (SAMPLE) { const L = await SAMPLE.limits().catch(() => null); SAMPLE_IMG = !!(L && L.images); }
      }
    } catch (e) { SAMPLE = null; }
    return SAMPLE;
  }
  const claude = {
    id: 'claude', name: 'Claude', icon: '✨',
    cost() { return SAMPLE ? 'Claude usage' : 'Paid API'; },
    fields: ['apiKey', 'model'],
    state() {
      const p = P('claude');
      if (!p.enabled) return [false, 'Turned off'];
      if (SAMPLE) return [true, SAMPLE_IMG ? 'Ready via claude.ai (asks permission on first use)' : 'Ready (text only in this view)'];
      if (hasServer()) return p.apiKey === '***' ? [true, 'Through the laptop server (key in its config)'] : [false, 'Add an Anthropic API key to the server config'];
      if (p.apiKey && p.apiKey !== '***') return [true, 'Direct API with your key'];
      return [false, C().runtime === 'browser' ? 'Not available in this view' : 'Add an Anthropic API key, or use the claude.ai page'];
    },
    async json(prompt, images, opts = {}) {
      if (SAMPLE) {
        if (images && images.length && !SAMPLE_IMG) images = [];
        const data = await SAMPLE.json(prompt, { images: images && images.length ? images : undefined, modelTier: 'quick', ...(opts.cache === false ? { cache: false } : {}) });
        return { data, tokens: { est: (images ? images.length : 0) * 300 + Math.ceil(prompt.length / 4) + 120 } };
      }
      if (hasServer()) return viaServer('claude', prompt, images);
      const p = P('claude'); const content = [];
      for (const im of images || []) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await b64(im) } });
      content.push({ type: 'text', text: prompt + JSON_HINT });
      const r = await postJSON('https://api.anthropic.com/v1/messages', { model: p.model || 'claude-haiku-5-5', max_tokens: 600, messages: [{ role: 'user', content }] },
        { 'x-api-key': p.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' });
      const text = (r.content || []).map(c => c.text || '').join('');
      return { data: parseJSON(text), tokens: { in: r.usage?.input_tokens, out: r.usage?.output_tokens } };
    },
    async test() { await initSample(); const [ok, why] = claude.state(); if (!ok) return { ok, msg: why };
      if (SAMPLE) return { ok: true, msg: why };
      try { await claude.json('Reply {"ok":true}', []); return { ok: true, msg: '✅ Claude answered' }; } catch (e) { return { ok: false, msg: e.message || e.code }; } }
  };

  // ---------- Ollama ----------
  let OLLAMA_OK = null, OLLAMA_MODELS = [];
  const ollamaBase = () => (C().viaServer() || (hasServer() && C().runtime === 'apk')) ? (C().serverUrl() ?? '') + '/api/ollama' : (P('ollama').url || 'http://localhost:11434').replace(/\/$/, '');
  const ollama = {
    id: 'ollama', name: 'Ollama', icon: '🦙', cost: () => 'Free · laptop', fields: ['url', 'model'],
    state() {
      const p = P('ollama');
      if (!p.enabled) return [false, 'Turned off'];
      if (C().runtime === 'browser') return [false, 'Pages on claude.ai can’t reach apps on your laptop'];
      if (OLLAMA_OK === false) return [false, 'Not reachable — is Ollama running?'];
      if (OLLAMA_OK === null) return [false, 'Not tested yet'];
      return [true, 'Connected · ' + (p.model || 'no model set')];
    },
    async refresh() {
      if (C().runtime === 'browser' || !P('ollama').enabled) { OLLAMA_OK = false; return; }
      try {
        const r = await fetch(ollamaBase() + '/api/tags'); if (!r.ok) throw 0;
        const j = await r.json(); OLLAMA_MODELS = (j.models || []).map(m => m.name); OLLAMA_OK = true;
        const p = P('ollama');
        if (OLLAMA_MODELS.length && !OLLAMA_MODELS.some(n => n.startsWith(p.model || '#'))) {
          const v = OLLAMA_MODELS.find(n => /qwen3-vl|qwen3\.5|minicpm|gemma3|vl|vision|llava|moondream/i.test(n));
          if (v) { C().set('ai.providers.ollama.model', v); C().save(); }
        }
      } catch (e) { OLLAMA_OK = false; }
    },
    async json(prompt, images) {
      const body = { model: P('ollama').model, prompt: prompt + JSON_HINT, stream: false, format: 'json' };
      if (images && images.length) body.images = await Promise.all(images.map(b64));
      const j = await postJSON(ollamaBase() + '/api/generate', body);
      return { data: parseJSON(j.response), tokens: { in: j.prompt_eval_count, out: j.eval_count, free: true } };
    },
    async test() { await ollama.refresh(); return OLLAMA_OK ? { ok: true, msg: '✅ Models: ' + (OLLAMA_MODELS.slice(0, 5).join(', ') || 'none installed') } : { ok: false, msg: ollama.state()[1] }; },
    models: () => OLLAMA_MODELS
  };

  // ---------- OpenAI-compatible (LM Studio, Groq, OpenRouter, any /v1) ----------
  const openai = {
    id: 'openai', name: 'OpenAI-compatible', icon: '🔌', fields: ['url', 'model', 'apiKey'],
    cost: () => isLocalUrl(P('openai').url) ? 'Free · laptop' : 'Paid API',
    state() {
      const p = P('openai');
      if (!p.enabled) return [false, 'Turned off'];
      if (!p.model) return [false, 'Set a model name'];
      if (hasServer()) return [true, 'Through the laptop server'];
      if (C().runtime === 'browser') return [false, 'Not reachable from this page'];
      return [true, (p.label || 'Endpoint') + ' · ' + p.model];
    },
    async json(prompt, images) {
      if (hasServer()) return viaServer('openai', prompt, images);
      const p = P('openai'); const content = [{ type: 'text', text: prompt + JSON_HINT }];
      for (const im of images || []) content.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + (await b64(im)) } });
      const r = await postJSON(p.url.replace(/\/$/, '') + '/chat/completions', { model: p.model, messages: [{ role: 'user', content }], temperature: 0.4 },
        p.apiKey && p.apiKey !== '***' ? { Authorization: 'Bearer ' + p.apiKey } : {});
      return { data: parseJSON(r.choices?.[0]?.message?.content), tokens: { in: r.usage?.prompt_tokens, out: r.usage?.completion_tokens, free: isLocalUrl(p.url) } };
    },
    async test() { const [ok, why] = openai.state(); if (!ok) return { ok, msg: why };
      try { await openai.json('Reply {"ok":true}', []); return { ok: true, msg: '✅ Endpoint answered' }; } catch (e) { return { ok: false, msg: e.message || e.code }; } }
  };

  // ---------- Gemini ----------
  const gemini = {
    id: 'gemini', name: 'Gemini', icon: '💎', cost: () => 'Paid API', fields: ['apiKey', 'model'],
    state() {
      const p = P('gemini');
      if (!p.enabled) return [false, 'Turned off'];
      if (hasServer()) return [true, 'Through the laptop server'];
      if (C().runtime === 'browser') return [false, 'Not reachable from this page'];
      if (!p.apiKey || p.apiKey === '***') return [false, 'Add a Gemini API key'];
      return [true, 'Direct API · ' + p.model];
    },
    async json(prompt, images) {
      if (hasServer()) return viaServer('gemini', prompt, images);
      const p = P('gemini'); const parts = [{ text: prompt + JSON_HINT }];
      for (const im of images || []) parts.push({ inline_data: { mime_type: 'image/jpeg', data: await b64(im) } });
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model)}:generateContent`;
      const r = await postJSON(url, { contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } }, { 'x-goog-api-key': p.apiKey });
      const text = (r.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('');
      return { data: parseJSON(text), tokens: { in: r.usageMetadata?.promptTokenCount, out: r.usageMetadata?.candidatesTokenCount } };
    },
    async test() { const [ok, why] = gemini.state(); if (!ok) return { ok, msg: why };
      try { await gemini.json('Reply {"ok":true}', []); return { ok: true, msg: '✅ Gemini answered' }; } catch (e) { return { ok: false, msg: e.message || e.code }; } }
  };

  // ---------- In-browser AI (planned) ----------
  const browserai = {
    id: 'browserai', name: 'In-browser AI', icon: '🧠', cost: () => 'Free · on device', fields: [],
    state() { return [false, 'Coming soon (MediaPipe faces, CLIP sorting)']; },
    async json() { throw { code: 'unavailable', message: 'In-browser AI is not built yet' }; },
    async test() { return { ok: false, msg: 'Coming soon' }; }
  };

  const PROVIDERS = { claude, ollama, openai, gemini, browserai };
  const TASKS = { pick: 'Pick best moment', captions: 'Titles & captions', sort: 'Sort files into steps', plan: 'Plan my day' };

  const ai = {
    PROVIDERS, TASKS, parseJSON,
    onTokens: null,
    totals: { claude: 0, paid: 0, free: 0 },
    get(id) { return PROVIDERS[id]; },
    available(id) { const p = PROVIDERS[id]; return !!(p && p.state()[0]); },
    status() {
      return Object.values(PROVIDERS).map(p => { const [available, reason] = p.state(); return { id: p.id, name: p.name, icon: p.icon, enabled: !!P(p.id).enabled, available, reason, cost: p.cost() }; });
    },
    /** Provider object for a task, or null when the task is set to "none" or nothing is available. */
    providerFor(task) {
      const mode = C().get('ai.tasks.' + task, 'auto');
      if (mode === 'none') return null;
      if (mode !== 'auto') return ai.available(mode) ? PROVIDERS[mode] : null;
      for (const id of C().get('ai.order', [])) if (ai.available(id)) return PROVIDERS[id];
      return null;
    },
    async init() { await initSample(); await ollama.refresh(); },
    async refresh() { await ollama.refresh(); },
    async test(id) { return PROVIDERS[id] ? PROVIDERS[id].test() : { ok: false, msg: 'Unknown provider' }; },
    async json(task, prompt, images, opts = {}) {
      const p = opts.provider ? PROVIDERS[opts.provider] : ai.providerFor(task);
      if (!p) throw { code: 'no_provider', message: 'No AI provider available for ' + (TASKS[task] || task) };
      const r = await p.json(prompt, images || [], opts);
      const t = r.tokens || {}; const n = (t.in || 0) + (t.out || 0) || t.est || 0;
      const kind = p.cost().startsWith('Free') ? 'free' : (p.id === 'claude' && SAMPLE ? 'claude' : 'paid');
      ai.totals[kind] += n;
      if (ai.onTokens) try { ai.onTokens({ provider: p.id, task, tokens: n, kind, totals: ai.totals }); } catch (e) {}
      return r.data;
    },
    isFatal(e) { return e && ['not_granted', 'sampling_disabled', 'capability_disabled', 'not_declared'].includes(e.code); },
    disableClaudeView() { SAMPLE = null; }
  };
  TV.ai = ai;
})();
