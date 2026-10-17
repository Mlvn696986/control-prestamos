import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/acquisition-admin.js', import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
const report = (overrides = {}) => ({ totals: { visitors: 10, registrations: 4, activated: 3, first_payments: 1 }, rows: [], since: '2026-10-01T05:00:00Z', cutover_at: '2026-10-16T05:00:00Z', ...overrides });

function harness({ fastTimeout = false } = {}) {
  const nodes = [];
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.style = {}; this.listeners = new Map(); this.ownText = ''; nodes.push(this); }
    set textContent(value) { this.ownText = String(value); this.children = []; }
    get textContent() { return this.ownText + this.children.map(child => child.textContent).join(' '); }
    set innerHTML(_value) { throw Error('Dynamic HTML is forbidden'); }
    setAttribute(key, value) { this.attrs[key] = value; }
    addEventListener(key, fn) { this.listeners.set(key, fn); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.ownText = ''; this.children = children; }
  }
  const ids = new Map(['acquisitionReport', 'acquisitionReportBody', 'acquisitionPeriod', 'acquisitionRefresh'].map(id => [id, new Element('div')]));
  ids.get('acquisitionPeriod').value = '30';
  const window = {};
  vm.runInContext(source, vm.createContext({
    window, document: { getElementById: id => ids.get(id), createElement: tag => new Element(tag), createDocumentFragment: () => new Element('fragment') },
    Date, Intl, setTimeout: (fn, duration) => setTimeout(fn, fastTimeout ? 1 : duration), clearTimeout,
  }));
  return { api: window.ERMIFAcquisitionReport, nodes, ids, body: ids.get('acquisitionReportBody') };
}

test('el informe representa cifras reales, conversión y período en una petición propia', async () => {
  const h = harness();
  const paths = [];
  assert.equal(await h.api.load(async path => { paths.push(path); return report(); }), true);
  assert.deepEqual(paths, ['/api/admin/acquisition?days=30']);
  assert.equal(h.nodes.filter(node => node.className === 'acquisition-report-card').length, 6);
  assert.match(h.body.textContent, /25%/);
  assert.match(h.body.textContent, /Todavía no hay visitas medidas/);
  assert.match(h.body.textContent, /Lima/);
  assert.equal(h.ids.get('acquisitionRefresh').disabled, false);
});

test('cero registros produce un guion, no una conversión falsa ni NaN', async () => {
  const h = harness();
  await h.api.load(async () => report({ totals: { visitors: 0, registrations: 0, activated: NaN, first_payments: Infinity } }));
  assert.match(h.body.textContent, /—/);
  assert.match(h.body.textContent, /Aún no hay registros/);
  assert.doesNotMatch(h.body.textContent, /NaN|Infinity/);
  assert.doesNotMatch(h.body.textContent, /0%/);
});

test('reset elimina datos y evita que una respuesta antigua vuelva a mostrarlos', async () => {
  const h = harness();
  let finish;
  const pending = h.api.load(() => new Promise(resolve => { finish = resolve; }));
  await settle();
  h.api.reset();
  finish(report({ totals: { visitors: 987654, registrations: 4, activated: 3, first_payments: 1 } }));
  assert.equal(await pending, false);
  assert.match(h.body.textContent, /entrar como administrador/);
  assert.doesNotMatch(h.body.textContent, /987|Visitantes medidos/);
  h.ids.get('acquisitionRefresh').listeners.get('click')();
  await settle();
  assert.match(h.body.textContent, /entrar como administrador/);
});

test('una carga nueva gana frente a una respuesta lenta de otro período', async () => {
  const h = harness();
  let finish;
  const old = h.api.load(() => new Promise(resolve => { finish = resolve; }));
  await settle();
  h.ids.get('acquisitionPeriod').value = '90';
  await h.api.load(async path => { assert.equal(path, '/api/admin/acquisition?days=90'); return report({ totals: { visitors: 22, registrations: 2, activated: 1, first_payments: 1 } }); });
  finish(report({ totals: { visitors: 987654, registrations: 3, activated: 0, first_payments: 0 } }));
  assert.equal(await old, false);
  assert.match(h.body.textContent, /50%/);
  assert.doesNotMatch(h.body.textContent, /987/);
});

test('datos de texto no se interpretan como HTML y las categorías desconocidas tienen etiqueta segura', async () => {
  const h = harness();
  const attack = '<img src=x onerror=alert(1)>';
  await h.api.load(async () => report({ rows: [{ source: '__proto__', medium: attack, campaign_id: attack, landing_path: attack, visitors: -10, registrations: 0, activated: 'bad', first_payments: null }] }));
  assert.match(h.body.textContent, /Otro/);
  assert.match(h.body.textContent, /Campaña no reconocida/);
  assert.ok(h.body.textContent.includes(attack));
  assert.equal(h.nodes.some(node => node.tagName === 'img' || node.tagName === 'script'), false);
  assert.doesNotMatch(h.body.textContent, /NaN|Infinity|-10/);
});

test('un error o timeout ofrece reintento sin exponer mensajes internos y luego se recupera', async () => {
  const h = harness();
  let calls = 0;
  await h.api.load(async () => { if (!calls++) throw Error('private-secret-db-info'); return report(); });
  assert.match(h.body.textContent, /No pudimos cargar/);
  assert.doesNotMatch(h.body.textContent, /private-secret/);
  const retry = h.nodes.find(node => node.className === 'acquisition-report-retry');
  retry.listeners.get('click')();
  await settle();
  assert.match(h.body.textContent, /Visitantes medidos/);
  const timeout = harness({ fastTimeout: true });
  assert.equal(await timeout.api.load(() => new Promise(() => {})), false);
  assert.match(timeout.body.textContent, /No pudimos cargar/);
  assert.equal(timeout.ids.get('acquisitionRefresh').disabled, false);
});

test('el selector solo envía períodos permitidos y refresca sin recargar el resto del Admin', async () => {
  const h = harness();
  const paths = [];
  await h.api.load(async path => { paths.push(path); return report(); });
  h.ids.get('acquisitionPeriod').value = '180';
  h.ids.get('acquisitionPeriod').listeners.get('change')();
  await settle();
  h.ids.get('acquisitionPeriod').value = '30&user_id=private';
  h.ids.get('acquisitionRefresh').listeners.get('click')();
  await settle();
  assert.deepEqual(paths, ['/api/admin/acquisition?days=30', '/api/admin/acquisition?days=180', '/api/admin/acquisition?days=30']);
});
