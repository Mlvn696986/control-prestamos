import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import publicAssets from '../scripts/public-assets.cjs';

// Exercise the production transformation, including consent and callback handling.
const source = publicAssets.optimizePublicAsset('acquisition.js', fs.readFileSync(new URL('../public/acquisition.js', import.meta.url), 'utf8'));
const CHOICE = 'ermif-measurement-choice-v1';
const VISITOR = 'ermif-acquisition-visitor-v1';
const REVOKE = 'ermif-acquisition-revoke-v1';
const ID = '2a9c49b8-62ab-4d71-98e2-223fb72110b7';
const OTHER_ID = '0aad99a2-3d9e-4a41-88e8-927289a2e98e';
const expiry = () => new Date(Date.now() + 86400000).toISOString();
const response = (data = {}, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };

function harness({ url = 'https://ermif.com/', referrer = '', stored = {}, sharedValues, fetcher, blockedStorage = false, fastTimeout = false, uuid = () => ID, locks } = {}) {
  const values = sharedValues || new Map(Object.entries(stored));
  const nodes = [];
  const requests = [];
  const windowEvents = new Map();
  class Element {
    constructor(tag) { this.tag = tag; this.listeners = new Map(); this.attributes = {}; this.children = []; this.selectors = new Map(); nodes.push(this); }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    append(...elements) { this.children.push(...elements); }
    querySelector(selector) { if (!this.selectors.has(selector)) this.selectors.set(selector, new Element('button')); return this.selectors.get(selector); }
  }
  const document = { body: new Element('body'), readyState: 'complete', referrer, createElement: tag => new Element(tag) };
  const window = {
    addEventListener(name, fn) { windowEvents.set(name, fn); },
    dispatchEvent(event) { windowEvents.get(event.type)?.(event); },
  };
  const localStorage = {
    getItem(key) { if (blockedStorage) throw Error('Storage disabled'); return values.get(key) || null; },
    setItem(key, value) { if (blockedStorage) throw Error('Storage disabled'); values.set(key, value); },
    removeItem(key) { if (blockedStorage) throw Error('Storage disabled'); values.delete(key); },
  };
  const context = vm.createContext({
    window, document, localStorage, location: new URL(url), URL, URLSearchParams, Date, AbortController,
    crypto: { randomUUID: uuid }, navigator: { locks },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    setTimeout: (fn, time) => setTimeout(fn, fastTimeout ? 1 : time), clearTimeout,
    fetch: async (path, options) => {
      requests.push({ path, ...options, payload: JSON.parse(options.body) });
      if (fetcher) return fetcher(path, options);
      return response(path.endsWith('/visit') ? { visitor_id: JSON.parse(options.body).visitor_id, expires_at: expiry() } : { ok: true });
    },
  });
  vm.runInContext(source, context);
  const chooser = () => nodes.find(node => node.id === 'ermif-measurement-choice');
  return {
    window, values, requests, nodes, chooser,
    async choose(value) { window.ERMIFAcquisition.preferences(); chooser().querySelector(`[data-measurement="${value}"]`).listeners.get('click')(); await settle(); },
    async online() { windowEvents.get('online')(); await settle(); },
    async storage(key) { windowEvents.get('storage')({ key }); await settle(); },
  };
}

test('sin consentimiento no hay ID, almacenamiento de atribución ni petición de medición', async () => {
  const h = harness({ url: 'https://ermif.com/?utm_source=facebook' });
  assert.equal(h.chooser().hidden, false);
  assert.equal(h.values.size, 0);
  assert.equal(await h.window.ERMIFAcquisition.identify('secret-access-token'), false);
  assert.equal(h.requests.length, 0);
  await h.choose('reject');
  assert.equal(h.requests.length, 0);
  assert.equal(h.values.has(VISITOR), false);
  assert.equal(h.values.has(REVOKE), false);
  assert.equal(JSON.parse(h.values.get(CHOICE)).value, 'rejected');
  assert.equal(h.chooser().hidden, true);
});

test('la negativa persiste y deja accesible el cambio de preferencias', async () => {
  const h = harness({ stored: { [CHOICE]: JSON.stringify({ value: 'rejected', version: '2026-10-16' }) } });
  await settle();
  assert.equal(h.chooser().hidden, true);
  assert.equal(h.requests.length, 0);
  assert.ok(h.nodes.some(node => node.className === 'ermif-measurement-preferences'));
  h.window.ERMIFAcquisition.preferences();
  assert.equal(h.chooser().hidden, false);
});

test('aceptar crea una entrada mínima y el identificador devuelto por servidor', async () => {
  const h = harness();
  await h.choose('accept');
  assert.deepEqual(h.requests[0].payload, { visitor_id: ID, consent: true, consent_version: '2026-10-16', landing_path: '/', source: 'directo', medium: 'direct', campaign_id: '' });
  assert.equal(h.requests[0].referrerPolicy, 'no-referrer');
  assert.equal(JSON.parse(h.values.get(VISITOR)).visitor_id, ID);
  assert.equal(await h.window.ERMIFAcquisition.identify('token-in-memory-only'), true);
  assert.equal(h.requests[1].headers.Authorization, 'Bearer token-in-memory-only');
  assert.deepEqual(h.requests[1].payload, { visitor_id: ID });
  assert.ok(!JSON.stringify([...h.values]).includes('token-in-memory-only'));
});

test('clasifica referentes y acepta solo campañas y categorías conocidas', async () => {
  for (const [url, referrer, expected] of [
    ['https://ermif.com/precios/', 'https://www.google.com/search?q=private', ['google', 'organic', '']],
    ['https://ermif.com/?utm_source=facebook&utm_medium=paid_social&utm_campaign=lanzamiento-ermif', '', ['facebook', 'paid_social', 'lanzamiento-ermif']],
    ['https://ermif.com/?utm_source=private@example.com&utm_medium=private&utm_campaign=private@example.com', 'https://www.bing.com/search?q=private', ['otro', 'other', '']],
    ['https://ermif.com/?utm_source=email&utm_campaign=contenido-educativo', '', ['email', 'email', 'contenido-educativo']],
    ['https://ermif.com/app/', 'https://ermif.com/precios/?utm_source=facebook', ['directo', 'direct', '']],
  ]) {
    const h = harness({ url, referrer });
    await h.choose('accept');
    const payload = h.requests[0].payload;
    assert.deepEqual([payload.source, payload.medium, payload.campaign_id], expected);
    assert.ok(!JSON.stringify(payload).includes('private'));
    assert.ok(!JSON.stringify(payload).includes('?'));
  }
});

test('callbacks y rutas no admitidas no capturan URL, query, fragmento ni tokens', async () => {
  for (const url of [
    'https://ermif.com/?code=private-secret',
    'https://ermif.com/app/#access_token=private-secret&refresh_token=private-refresh',
    'https://ermif.com/app/?billing=return',
    'https://ermif.com/?error_description=private-email',
    'https://ermif.com/app/#type=recovery',
    'https://ermif.com/private-client-name/',
  ]) {
    const h = harness({ url });
    await h.choose('accept');
    assert.equal(h.requests.length, 0, url);
    assert.ok(!JSON.stringify([...h.values]).includes('private'));
  }
});

test('una atribución ya consentida se puede asociar tras un callback sin guardar sus tokens', async () => {
  const h = harness({ url: 'https://ermif.com/app/#access_token=private-secret', stored: {
    [CHOICE]: JSON.stringify({ value: 'accepted', version: '2026-10-16' }),
    [VISITOR]: JSON.stringify({ visitor_id: ID, expires_at: expiry() }),
  } });
  assert.equal(await h.window.ERMIFAcquisition.identify('fresh-token'), true);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].path, '/api/acquisition/identify');
  assert.ok(!JSON.stringify(h.requests[0].payload).includes('secret'));
});

test('la primera atribución persiste y no se reemplaza al visitar precios u otra campaña', async () => {
  const h = harness({ url: 'https://ermif.com/precios/?utm_source=facebook', stored: {
    [CHOICE]: JSON.stringify({ value: 'accepted', version: '2026-10-16' }),
    [VISITOR]: JSON.stringify({ visitor_id: ID, expires_at: expiry() }),
  } });
  await settle();
  assert.equal(h.requests.length, 0);
  await h.window.ERMIFAcquisition.identify('token');
  assert.equal(h.requests[0].path, '/api/acquisition/identify');
});

test('fallos de almacenamiento y red no impiden usar la API ni generan rechazos no controlados', async () => {
  const h = harness({ blockedStorage: true, fetcher: async () => { throw Error('Offline'); } });
  await h.choose('accept');
  assert.equal(await h.window.ERMIFAcquisition.identify('token'), false);
  await h.choose('reject');
  assert.equal(await h.window.ERMIFAcquisition.identify('token'), false);
});

test('cada petición tiene un timeout y devuelve fallo seguro', async () => {
  const h = harness({ fastTimeout: true, fetcher: async (_path, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(Error('Aborted')));
  }) });
  await h.choose('accept');
  assert.equal(await h.window.ERMIFAcquisition.identify('token'), false);
});

test('revocar elimina ID, detiene identify y reintenta el retiro hasta recibir confirmación', async () => {
  let online = false;
  const h = harness({ stored: {
    [CHOICE]: JSON.stringify({ value: 'accepted', version: '2026-10-16' }),
    [VISITOR]: JSON.stringify({ visitor_id: ID, expires_at: expiry() }),
  }, fetcher: async () => online ? response({ ok: true }) : response({}, 503) });
  await h.choose('reject');
  assert.equal(h.values.has(VISITOR), false);
  assert.deepEqual(JSON.parse(h.values.get(REVOKE)), [ID]);
  assert.equal(await h.window.ERMIFAcquisition.identify('token'), false);
  online = true;
  await h.online();
  assert.equal(h.values.has(REVOKE), false);
  assert.ok(h.requests.every(request => request.path === '/api/acquisition/revoke'));
});

test('un retiro pendiente sobrevive a recarga sin reactivar medición', async () => {
  const h = harness({ stored: {
    [CHOICE]: JSON.stringify({ value: 'rejected', version: '2026-10-16' }),
    [REVOKE]: JSON.stringify([ID]),
  } });
  await settle();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].path, '/api/acquisition/revoke');
  assert.equal(h.values.has(REVOKE), false);
  assert.equal(h.values.has(VISITOR), false);
});

test('rechazar durante captura evita identify tardío y revoca el ID que llegue después', async () => {
  let finishVisit;
  const h = harness({ fetcher: async path => path.endsWith('/visit') ? new Promise(resolve => { finishVisit = resolve; }) : response({ ok: true }) });
  await h.choose('accept');
  const identification = h.window.ERMIFAcquisition.identify('do-not-send-token');
  await h.choose('reject');
  finishVisit(response({ visitor_id: ID, expires_at: expiry() }));
  assert.equal(await identification, false);
  await settle();
  assert.equal(h.requests[0].path, '/api/acquisition/visit');
  assert.ok(h.requests.slice(1).every(request => request.path === '/api/acquisition/revoke'));
  assert.ok(h.requests.length >= 2);
  assert.equal(h.values.has(VISITOR), false);
  assert.ok(!JSON.stringify(h.requests).includes('do-not-send-token'));
});

test('la caducidad local nunca supera 180 días y un visitante vencido se renueva', async () => {
  const h = harness({ fetcher: async () => response({ visitor_id: ID, expires_at: new Date(Date.now() + 365 * 86400000).toISOString() }) });
  await h.choose('accept');
  assert.ok(Date.parse(JSON.parse(h.values.get(VISITOR)).expires_at) <= Date.now() + 180 * 86400000);
  const expired = harness({ stored: {
    [CHOICE]: JSON.stringify({ value: 'accepted', version: '2026-10-16' }),
    [VISITOR]: JSON.stringify({ visitor_id: ID, expires_at: '2020-01-01T00:00:00Z' }),
  } });
  await settle();
  assert.equal(expired.requests[0].path, '/api/acquisition/visit');
});

test('las elecciones anuncian un evento sin tokens y el entorno local no envía medición', async () => {
  const h = harness({ url: 'http://127.0.0.1:8787/app/' });
  const choices = [];
  h.window.addEventListener('ermif-acquisition-consent', event => choices.push(event.detail.accepted));
  await h.choose('accept');
  assert.equal(await h.window.ERMIFAcquisition.identify('local-demo-token'), false);
  await h.choose('reject');
  assert.deepEqual(choices, [true, false]);
  assert.equal(h.requests.length, 0);
});

test('retirar consentimiento en otra pestaña detiene identificación en la pestaña abierta', async () => {
  const h = harness({ stored: {
    [CHOICE]: JSON.stringify({ value: 'accepted', version: '2026-10-16' }),
    [VISITOR]: JSON.stringify({ visitor_id: ID, expires_at: expiry() }),
  } });
  h.values.set(CHOICE, JSON.stringify({ value: 'rejected', version: '2026-10-16' }));
  await h.storage(CHOICE);
  assert.equal(await h.window.ERMIFAcquisition.identify('must-not-send'), false);
  assert.equal(h.values.has(VISITOR), false);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].path, '/api/acquisition/revoke');
});

test('el ID pendiente se guarda antes del POST y un timeout reintenta exactamente la misma visita', async () => {
  let generated = 0;
  let attempts = 0;
  const sharedValues = new Map();
  const h = harness({ sharedValues, fastTimeout: true, url: 'https://ermif.com/precios/?utm_source=facebook&utm_campaign=lanzamiento-ermif', uuid: () => { generated++; return ID; }, fetcher: async (path, options) => {
    if (!path.endsWith('/visit')) return response({ ok: true });
    const pending = JSON.parse(sharedValues.get(VISITOR));
    assert.equal(pending.visitor_id, JSON.parse(options.body).visitor_id);
    assert.equal(pending.registered, false);
    if (!attempts++) return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Error('Lost acknowledgement'))));
    return response({ visitor_id: ID, expires_at: expiry() });
  } });
  await h.choose('accept');
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(JSON.parse(sharedValues.get(VISITOR)).registered, false);
  await h.online();
  assert.equal(generated, 1);
  assert.deepEqual(h.requests[0].payload, h.requests[1].payload);
  assert.equal(JSON.parse(sharedValues.get(VISITOR)).registered, true);
});

test('una recarga reenvía ID y primera atribución pendientes sin sustituirlos por la nueva página', async () => {
  const attribution = { landing_path: '/precios/', source: 'facebook', medium: 'paid_social', campaign_id: 'lanzamiento-ermif' };
  const h = harness({ url: 'https://ermif.com/app/?utm_source=google', uuid: () => { throw Error('Must reuse pending UUID'); }, stored: {
    [CHOICE]: JSON.stringify({ value: 'accepted', version: '2026-10-16' }),
    [VISITOR]: JSON.stringify({ visitor_id: ID, expires_at: expiry(), registered: false, attribution }),
  } });
  await settle();
  assert.deepEqual(h.requests[0].payload, { visitor_id: ID, consent: true, consent_version: '2026-10-16', ...attribution });
  assert.equal(JSON.parse(h.values.get(VISITOR)).registered, true);
});

test('retirar consentimiento revoca un ID todavía sin respuesta del servidor', async () => {
  let finish;
  const h = harness({ fetcher: async path => path.endsWith('/visit') ? new Promise(resolve => { finish = resolve; }) : response({ ok: true }) });
  await h.choose('accept');
  const pending = JSON.parse(h.values.get(VISITOR));
  assert.equal(pending.registered, false);
  await h.choose('reject');
  assert.equal(h.requests[1].path, '/api/acquisition/revoke');
  assert.deepEqual(h.requests[1].payload, { visitor_id: ID });
  assert.equal(h.values.has(VISITOR), false);
  finish(response({ revoked: true }));
  await settle();
  assert.equal(h.values.has(VISITOR), false);
  assert.equal(h.requests.filter(request => request.path.endsWith('/visit')).length, 1);
});

test('respuesta revoked no crea otro ID automáticamente y requiere nueva elección', async () => {
  let generated = 0;
  let visits = 0;
  const h = harness({ uuid: () => generated++ ? OTHER_ID : ID, fetcher: async (path, options) => {
    if (!path.endsWith('/visit')) return response({ ok: true });
    if (!visits++) return response({ revoked: true });
    return response({ visitor_id: JSON.parse(options.body).visitor_id, expires_at: expiry() });
  } });
  await h.choose('accept');
  await settle();
  assert.equal(JSON.parse(h.values.get(CHOICE)).value, 'rejected');
  assert.equal(h.values.has(VISITOR), false);
  await h.online();
  assert.equal(await h.window.ERMIFAcquisition.identify('do-not-send'), false);
  assert.equal(generated, 1);
  await h.choose('accept');
  assert.equal(generated, 2);
  assert.equal(JSON.parse(h.values.get(VISITOR)).visitor_id, OTHER_ID);
});

test('dos pestañas con Web Locks comparten una sola creación y primera atribución', async () => {
  const sharedValues = new Map([[CHOICE, JSON.stringify({ value: 'accepted', version: '2026-10-16' })]]);
  let tail = Promise.resolve();
  let lockCalls = 0;
  const locks = { request(name, callback) {
    assert.equal(name, 'ermif-acquisition-create');
    lockCalls++;
    const current = tail.then(callback);
    tail = current.catch(() => {});
    return current;
  } };
  let finish;
  const first = harness({ sharedValues, locks, url: 'https://ermif.com/precios/?utm_source=google', uuid: () => ID, fetcher: async () => new Promise(resolve => { finish = resolve; }) });
  const second = harness({ sharedValues, locks, url: 'https://ermif.com/?utm_source=facebook', uuid: () => { throw Error('Second tab must not create UUID'); } });
  await settle();
  assert.equal(first.requests.length, 1);
  assert.equal(second.requests.length, 0);
  finish(response({ visitor_id: ID, expires_at: expiry() }));
  await settle();
  assert.equal(lockCalls, 2);
  assert.equal(second.requests.length, 0);
  assert.equal(JSON.parse(sharedValues.get(VISITOR)).attribution.source, 'google');
  await second.window.ERMIFAcquisition.identify('second-tab-token');
  assert.deepEqual(second.requests[0].payload, { visitor_id: ID });
});

test('sin Web Locks opt-out revoca tanto ID en memoria como ID pendiente de otra pestaña', async () => {
  const h = harness({ stored: {
    [CHOICE]: JSON.stringify({ value: 'accepted', version: '2026-10-16' }),
    [VISITOR]: JSON.stringify({ visitor_id: ID, expires_at: expiry() }),
  } });
  await settle();
  h.values.set(VISITOR, JSON.stringify({ visitor_id: OTHER_ID, expires_at: expiry(), registered: false, attribution: { landing_path: '/', source: 'directo', medium: 'direct', campaign_id: '' } }));
  await h.choose('reject');
  assert.deepEqual(new Set(h.requests.map(request => request.payload.visitor_id)), new Set([ID, OTHER_ID]));
  assert.ok(h.requests.every(request => request.path.endsWith('/revoke')));
  assert.equal(h.values.has(VISITOR), false);
});

test('IDs ajenos al formato UUIDv4 nunca se guardan como visitantes reconocidos', async () => {
  const h = harness({ uuid: () => 'fake-user-secret', stored: {
    [CHOICE]: JSON.stringify({ value: 'accepted', version: '2026-10-16' }),
  } });
  await settle();
  assert.equal(h.values.has(VISITOR), false);
  assert.equal(h.requests.length, 0);
});

test('un callback puede confirmar atribución pendiente anterior sin capturar sus parámetros', async () => {
  const attribution = { landing_path: '/precios/', source: 'facebook', medium: 'social', campaign_id: '' };
  const h = harness({ url: 'https://ermif.com/app/#access_token=secret-callback-token', uuid: () => { throw Error('No new callback visitor'); }, stored: {
    [CHOICE]: JSON.stringify({ value: 'accepted', version: '2026-10-16' }),
    [VISITOR]: JSON.stringify({ visitor_id: ID, expires_at: expiry(), registered: false, attribution }),
  } });
  assert.equal(await h.window.ERMIFAcquisition.identify('session-token'), true);
  assert.deepEqual(h.requests[0].payload, { visitor_id: ID, consent: true, consent_version: '2026-10-16', ...attribution });
  assert.equal(h.requests[1].path, '/api/acquisition/identify');
  assert.ok(!JSON.stringify(h.requests).includes('secret-callback-token'));
});

test('UTM de anuncios y aliases normalizados no se confunden con tráfico orgánico', async () => {
  for (const [query, expected] of [
    ['utm_source=Google&utm_medium=cpc', ['google', 'paid_search']],
    ['utm_source=facebook&utm_medium=CPC', ['facebook', 'paid_social']],
    ['utm_source=%20META%20&utm_medium=%20ppc%20', ['facebook', 'paid_social']],
    ['utm_source=FB&utm_medium=paidsocial', ['facebook', 'paid_social']],
    ['utm_source=ig&utm_medium=social_paid', ['instagram', 'paid_social']],
    ['utm_source=instagram&utm_medium=social-paid', ['instagram', 'paid_social']],
    ['utm_source=BING&utm_medium=paidsearch', ['bing', 'paid_search']],
    ['utm_source=Google&utm_medium=organic_search', ['google', 'organic']],
  ]) {
    const h = harness({ url: 'https://ermif.com/?' + query });
    await h.choose('accept');
    assert.deepEqual([h.requests[0].payload.source, h.requests[0].payload.medium], expected);
  }
});

test('UTM explícita desconocida descarta texto personal y no hereda origen orgánico', async () => {
  for (const [query, expected] of [
    ['utm_source=private@example.com', ['otro', 'other']],
    ['utm_source=google&utm_medium=private@example.com', ['google', 'other']],
    ['utm_source=private@example.com&utm_medium=cpc', ['otro', 'other']],
    ['utm_source=', ['otro', 'other']],
  ]) {
    const h = harness({ url: 'https://ermif.com/?' + query + '&utm_campaign=private@example.com', referrer: 'https://www.google.com/search?q=private' });
    await h.choose('accept');
    assert.deepEqual([h.requests[0].payload.source, h.requests[0].payload.medium], expected);
    assert.ok(!JSON.stringify(h.requests[0].payload).includes('private'));
    assert.equal(h.requests[0].payload.campaign_id, '');
  }
});
