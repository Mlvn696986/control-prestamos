/* Optional, first-party acquisition measurement. Never receives customer/loan data. */
(() => {
  'use strict';
  const VERSION = '2026-10-16';
  const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
  const KEYS = {
    choice: 'ermif-measurement-choice-v1',
    visitor: 'ermif-acquisition-visitor-v1',
    revoke: 'ermif-acquisition-revoke-v1',
  };
  const PATHS = new Set(['/', '/precios/', '/como-funciona/', '/contacto/', '/privacidad/', '/terminos/', '/app/']);
  const SOURCES = new Set(['directo', 'google', 'bing', 'duckduckgo', 'facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'whatsapp', 'email', 'otro']);
  const MEDIA = new Set(['direct', 'organic', 'paid_search', 'paid_social', 'social', 'email', 'referral', 'other']);
  const CAMPAIGNS = new Set(['lanzamiento-ermif', 'contenido-educativo']);
  const safeId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ } };
  const remove = key => { try { localStorage.removeItem(key); } catch { /* In-memory choice still applies. */ } };
  const savedChoice = read(KEYS.choice);
  let choice = savedChoice?.version === VERSION && ['accepted', 'rejected'].includes(savedChoice.value) ? savedChoice.value : 'pending';
  let visitor = validVisitor(read(KEYS.visitor));
  let tombstones = (Array.isArray(read(KEYS.revoke)) ? read(KEYS.revoke) : []).filter(safeId);
  let generation = 0;
  let visitPromise = null;
  let revokePromise = null;
  let chooser;
  let preferencesButton;
  const identityRequests = new Set();
  const knownVisitorIds = new Set(visitor ? [visitor.visitor_id] : []);
  const entry = getEntry();

  function validAttribution(value) {
    if (!value || !PATHS.has(value.landing_path) || !SOURCES.has(value.source) || !MEDIA.has(value.medium) || (value.campaign_id !== '' && !CAMPAIGNS.has(value.campaign_id))) return null;
    return { landing_path: value.landing_path, source: value.source, medium: value.medium, campaign_id: value.campaign_id };
  }

  function validVisitor(value) {
    if (!value || !safeId(value.visitor_id)) return null;
    const expires = Date.parse(value.expires_at);
    if (!Number.isFinite(expires) || expires <= Date.now()) return null;
    const registered = value.registered !== false; // Previously acknowledged records had no explicit flag.
    const attribution = validAttribution(value.attribution);
    if (!registered && !attribution) return null;
    return { visitor_id: value.visitor_id, expires_at: new Date(Math.min(expires, Date.now() + MAX_AGE)).toISOString(), registered, ...(attribution ? { attribution } : {}) };
  }

  function getEntry() {
    const query = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const sensitive = ['code', 'access_token', 'refresh_token', 'token', 'token_hash', 'error', 'error_code', 'error_description'];
    if (sensitive.some(key => query.has(key) || hash.has(key)) || query.has('billing') || hash.get('type') === 'recovery') return null;
    if (!PATHS.has(location.pathname)) return null;
    let source = 'directo';
    let medium = 'direct';
    try {
      const ref = new URL(document.referrer);
      if (ref.origin !== location.origin) {
        const host = ref.hostname.toLowerCase().replace(/^www\./, '');
        source = 'otro';
        medium = 'referral';
        const matches = domain => host === domain || host.endsWith('.' + domain);
        if (/^(?:[^.]+\.)?google\.(?:com|es|com\.pe|com\.mx|com\.ar|cl|co\.uk)$/.test(host)) source = 'google';
        else if (matches('bing.com')) source = 'bing';
        else if (matches('duckduckgo.com')) source = 'duckduckgo';
        else if (matches('facebook.com') || matches('fb.com')) source = 'facebook';
        else if (matches('instagram.com')) source = 'instagram';
        else if (matches('tiktok.com')) source = 'tiktok';
        else if (matches('youtube.com') || matches('youtu.be')) source = 'youtube';
        else if (matches('linkedin.com')) source = 'linkedin';
        else if (matches('whatsapp.com') || matches('wa.me')) source = 'whatsapp';
        if (['google', 'bing', 'duckduckgo'].includes(source)) medium = 'organic';
        else if (source !== 'otro') medium = 'social';
      }
    } catch { /* No referrer means a direct visit. */ }
    const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
    const sourceAliases = { meta: 'facebook', fb: 'facebook', ig: 'instagram' };
    const requestedSource = normalize(query.get('utm_source'));
    if (query.has('utm_source')) {
      const resolvedSource = Object.hasOwn(sourceAliases, requestedSource) ? sourceAliases[requestedSource] : requestedSource;
      source = SOURCES.has(resolvedSource) ? resolvedSource : 'otro';
      medium = source === 'directo' ? 'direct' : source === 'email' ? 'email' : ['google', 'bing', 'duckduckgo'].includes(source) ? 'organic' : source === 'otro' ? 'other' : 'social';
    }
    if (query.has('utm_medium')) {
      const requestedMedium = normalize(query.get('utm_medium'));
      const mediumAliases = { paidsocial: 'paid_social', social_paid: 'paid_social', 'social-paid': 'paid_social', organic_search: 'organic' };
      if (['cpc', 'ppc', 'paidsearch'].includes(requestedMedium)) {
        medium = ['google', 'bing', 'duckduckgo'].includes(source) ? 'paid_search' : ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'whatsapp'].includes(source) ? 'paid_social' : 'other';
      } else {
        const resolvedMedium = Object.hasOwn(mediumAliases, requestedMedium) ? mediumAliases[requestedMedium] : requestedMedium;
        medium = MEDIA.has(resolvedMedium) ? resolvedMedium : 'other';
      }
    }
    const campaign = normalize(query.get('utm_campaign'));
    return { landing_path: location.pathname, source, medium, campaign_id: CAMPAIGNS.has(campaign) ? campaign : '' };
  }

  async function post(path, payload, accessToken, identity = false) {
    if (window.__PRESTAMOS_TEST__ || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return null;
    const controller = new AbortController();
    if (identity) identityRequests.add(controller);
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
      const response = await fetch(path, {
        method: 'POST', headers, body: JSON.stringify(payload), credentials: 'same-origin',
        referrerPolicy: 'no-referrer', signal: controller.signal,
      });
      if (!response.ok) return null;
      return response.status === 204 ? {} : await response.json();
    } catch { return null; }
    finally { clearTimeout(timer); identityRequests.delete(controller); }
  }

  function queueRevocation(id) {
    if (!safeId(id)) return;
    const saved = read(KEYS.revoke);
    tombstones = [...new Set([...tombstones, ...(Array.isArray(saved) ? saved.filter(safeId) : []), id])];
    write(KEYS.revoke, tombstones);
  }

  function revokeKnownVisitors() {
    const saved = read(KEYS.visitor);
    if (safeId(saved?.visitor_id)) knownVisitorIds.add(saved.visitor_id);
    if (visitor) knownVisitorIds.add(visitor.visitor_id);
    for (const id of knownVisitorIds) queueRevocation(id);
    knownVisitorIds.clear();
    visitor = null;
    remove(KEYS.visitor);
    if (tombstones.length) void retryRevocations();
  }

  function retryRevocations() {
    if (revokePromise) return revokePromise;
    revokePromise = (async () => {
      for (const id of [...tombstones]) {
        const result = await post('/api/acquisition/revoke', { visitor_id: id });
        if (result !== null) {
          const saved = read(KEYS.revoke);
          tombstones = [...new Set([...tombstones, ...(Array.isArray(saved) ? saved.filter(safeId) : [])])].filter(value => value !== id);
          if (tombstones.length) write(KEYS.revoke, tombstones);
          else remove(KEYS.revoke);
        }
      }
      return tombstones.length === 0;
    })().finally(() => { revokePromise = null; });
    return revokePromise;
  }

  function ensureVisitor() {
    if (choice !== 'accepted') return Promise.resolve(null);
    visitor = validVisitor(visitor);
    if (visitPromise) return visitPromise;
    const started = generation;
    const capture = async () => {
      // Re-read inside the origin-wide lock: another tab may already have created the pending visit.
      if (choice !== 'accepted' || read(KEYS.choice)?.value === 'rejected' || started !== generation) return null;
      const saved = validVisitor(read(KEYS.visitor));
      if (saved) visitor = saved;
      if (visitor) knownVisitorIds.add(visitor.visitor_id);
      if (tombstones.length && !(await retryRevocations())) return null;
      if (choice !== 'accepted' || read(KEYS.choice)?.value === 'rejected' || started !== generation) return null;
      if (visitor?.registered) return visitor;
      // A callback may retry an existing consented record, never become a new landing entry.
      if (!entry && !visitor?.attribution) return null;
      if (!visitor) {
        if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') return null;
        const id = crypto.randomUUID();
        if (!safeId(id)) return null;
        visitor = { visitor_id: id, expires_at: new Date(Date.now() + MAX_AGE).toISOString(), registered: false, attribution: entry };
        knownVisitorIds.add(id);
        // Persist before the request: timeout/reload retries reuse the same ID and opt-out can revoke it.
        write(KEYS.visitor, visitor);
      }
      const pending = visitor;
      const result = await post('/api/acquisition/visit', { visitor_id: pending.visitor_id, consent: true, consent_version: VERSION, ...pending.attribution });
      if (choice !== 'accepted' || read(KEYS.choice)?.value === 'rejected' || started !== generation) {
        queueRevocation(pending.visitor_id);
        void retryRevocations();
        return null;
      }
      if (result?.revoked === true) {
        // A late visit must not resurrect an ID already revoked in another tab.
        generation++;
        choice = 'rejected';
        write(KEYS.choice, { value: choice, version: VERSION });
        revokeKnownVisitors();
        window.dispatchEvent(new CustomEvent('ermif-acquisition-consent', { detail: { accepted: false } }));
        return null;
      }
      const next = validVisitor(result);
      if (!next || next.visitor_id !== pending.visitor_id) return null;
      visitor = { ...next, registered: true, attribution: pending.attribution };
      write(KEYS.visitor, visitor);
      return visitor;
    };
    visitPromise = Promise.resolve().then(() => typeof navigator !== 'undefined' && navigator.locks?.request
      ? navigator.locks.request('ermif-acquisition-create', capture)
      : capture()).catch(() => null).finally(() => { visitPromise = null; });
    return visitPromise;
  }

  async function identify(accessToken) {
    if (choice !== 'accepted' || typeof accessToken !== 'string' || !accessToken || accessToken.length > 16384) return false;
    const started = generation;
    const current = await ensureVisitor();
    if (!current || choice !== 'accepted' || started !== generation || tombstones.length) return false;
    const result = await post('/api/acquisition/identify', { visitor_id: current.visitor_id }, accessToken, true);
    return result !== null && choice === 'accepted' && started === generation;
  }

  function choose(value) {
    if (choice !== value) generation++;
    choice = value;
    write(KEYS.choice, { value, version: VERSION });
    for (const request of identityRequests) request.abort();
    if (value === 'rejected') {
      revokeKnownVisitors();
    } else {
      void ensureVisitor();
    }
    setChooser(false);
    window.dispatchEvent(new CustomEvent('ermif-acquisition-consent', { detail: { accepted: value === 'accepted' } }));
  }

  function setChooser(open) {
    if (!chooser) return;
    chooser.hidden = !open;
    preferencesButton.setAttribute('aria-expanded', String(open));
  }

  function preferences() {
    if (!chooser) mount();
    setChooser(true);
  }

  function mount() {
    if (chooser || !document.body) return;
    chooser = document.createElement('aside');
    chooser.id = 'ermif-measurement-choice';
    chooser.className = 'ermif-measurement';
    chooser.setAttribute('aria-labelledby', 'ermif-measurement-title');
    chooser.innerHTML = '<div class="ermif-measurement-heading"><strong id="ermif-measurement-title">Medición opcional</strong><button class="ermif-measurement-close" type="button" aria-label="Cerrar preferencias de medición">×</button></div>' +
      '<p>Con tu permiso, relacionamos el origen de tu visita con el registro, el primer uso y el primer pago de tu suscripción a ERMIF. No medimos los datos de tus clientes ni de sus préstamos.</p>' +
      '<p>Puedes usar ERMIF sin aceptar y cambiar tu elección cuando quieras. <a href="/privacidad/">Ver privacidad</a></p>' +
      '<div class="ermif-measurement-actions"><button type="button" data-measurement="accept">Aceptar medición</button><button type="button" data-measurement="reject">Continuar sin medición</button></div>';
    chooser.querySelector('[data-measurement="accept"]').addEventListener('click', () => choose('accepted'));
    chooser.querySelector('[data-measurement="reject"]').addEventListener('click', () => choose('rejected'));
    chooser.querySelector('.ermif-measurement-close').addEventListener('click', () => setChooser(false));
    preferencesButton = document.createElement('button');
    preferencesButton.type = 'button';
    preferencesButton.className = 'ermif-measurement-preferences';
    preferencesButton.textContent = 'Medición';
    preferencesButton.setAttribute('aria-controls', chooser.id);
    preferencesButton.setAttribute('aria-label', 'Cambiar preferencias de medición opcional');
    preferencesButton.addEventListener('click', preferences);
    document.body.append(preferencesButton, chooser);
    setChooser(choice === 'pending' && Boolean(entry));
  }

  function start() {
    // Do not place a consent prompt over a transient OAuth/password/payment callback.
    if (PATHS.has(location.pathname)) mount();
    if (choice !== 'accepted') {
      revokeKnownVisitors();
    }
    if (tombstones.length) void retryRevocations();
    if (choice === 'accepted' && entry) void ensureVisitor();
  }

  window.ERMIFAcquisition = Object.freeze({ identify, preferences });
  window.addEventListener('online', () => {
    if (tombstones.length) void retryRevocations();
    else if (choice === 'accepted' && entry) void ensureVisitor();
  });
  window.addEventListener('storage', event => {
    if (event.key === KEYS.visitor) {
      const latest = validVisitor(read(KEYS.visitor));
      if (latest) knownVisitorIds.add(latest.visitor_id);
      if (choice === 'accepted') visitor = latest;
      else if (latest) revokeKnownVisitors();
      return;
    }
    if (event.key !== KEYS.choice) return;
    const saved = read(KEYS.choice);
    const next = saved?.version === VERSION && ['accepted', 'rejected'].includes(saved.value) ? saved.value : 'pending';
    if (next === choice) return;
    generation++;
    choice = next;
    for (const request of identityRequests) request.abort();
    if (choice !== 'accepted') {
      revokeKnownVisitors();
    } else {
      visitor = validVisitor(read(KEYS.visitor));
      if (entry) void ensureVisitor();
    }
    setChooser(choice === 'pending' && Boolean(entry));
    window.dispatchEvent(new CustomEvent('ermif-acquisition-consent', { detail: { accepted: choice === 'accepted' } }));
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
