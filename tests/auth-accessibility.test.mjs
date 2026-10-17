import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const source = read('app.js');
const html = read('index.html');
function functionSource(name) {
  const start = source.search(new RegExp('(?:async )?function ' + name + '\\('));
  assert.ok(start >= 0, name);
  const ends = [source.indexOf('\nfunction ', start + 1), source.indexOf('\nasync function ', start + 1), source.length];
  return source.slice(start, Math.min(...ends.filter(index => index >= 0)));
}

function setup() {
  let focused = '';
  const nodes = {};
  const createNode = id => {
    const classes = new Set();
    return {
      id, value: '', checked: false, required: false, attributes: {}, listeners: {},
      classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }, contains(name) { return classes.has(name); } },
      setAttribute(name, value) { this.attributes[name] = value; },
      closest() { return nodes[id + 'Label']; },
      focus() { focused = id; },
      addEventListener(name, handler) { this.listeners[name] = handler; },
    };
  };
  for (const id of ['authTitle', 'authFields', 'authMode', 'showSignup', 'showLogin', 'authEmail', 'authPassword', 'authPasswordLabelText', 'authConfirmPassword', 'authConfirmPasswordLabel', 'authTermsLabel', 'authTermsAccept', 'authSubmitText', 'googleAuthButton', 'googleAuthText', 'forgotPassword', 'businessName', 'businessNameLabel', 'ownerName', 'ownerNameLabel', 'currency', 'currencyLabel']) nodes[id] = createNode(id);
  const context = vm.createContext({ elements: nodes, $: selector => nodes[selector.slice(1)], setAuthNotice() {}, updateConfirmPasswordFeedback() {}, saas: { passwordRecovery: false } });
  vm.runInContext(functionSource('setAuthMode') + '\n' + functionSource('handleAuthTabKeydown'), context);
  const bindings = source.slice(source.indexOf('  elements.showSignup.addEventListener("click"'), source.indexOf('  elements.forgotPassword.addEventListener("click"'));
  vm.runInContext(bindings, context);
  return { nodes, context, focused: () => focused };
}

test('auth exposes a visible heading, named tabs, their shared panel and announced notices', () => {
  const heading = html.match(/<h1\b[^>]*id="authTitle"[^>]*>([^<]+)<\/h1>/)[0];
  assert.doesNotMatch(heading, /sr-only|hidden/);
  assert.match(heading, /Crea tu cuenta en ERMIF/);
  assert.match(html, /Gestiona tus clientes, préstamos y cobranzas/);
  for (const id of ['showSignup', 'showLogin']) {
    const button = html.match(new RegExp('<button id="' + id + '"[^>]+>'))[0];
    assert.match(button, /role="tab"/);
    assert.match(button, /aria-controls="authFields"/);
    assert.match(button, new RegExp('aria-selected="' + (id === 'showSignup') + '"'));
    assert.match(button, new RegExp('tabindex="' + (id === 'showSignup' ? '0' : '-1') + '"'));
  }
  assert.match(html, /id="authFields"[^>]+role="tabpanel"[^>]+aria-labelledby="showSignup"[^>]+tabindex="0"/);
  assert.match(html, /id="authNotice"[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);
  assert.equal((html.match(/id="registerForm"/g) || []).length, 1, 'one existing form, no duplicated credentials');
  assert.match(html, /id="authEmail"[^>]+autocomplete="username"/);
});

test('selection, heading, password autofill and existing validation remain coherent in login, signup and recovery', () => {
  const { context, nodes } = setup();
  const email = nodes.authEmail;
  email.value = 'demo@example.invalid';
  for (const mode of ['signup', 'login', 'recovery', 'signup']) {
    context.setAuthMode(mode);
    const signup = mode === 'signup';
    const active = signup ? nodes.showSignup : nodes.showLogin;
    const inactive = signup ? nodes.showLogin : nodes.showSignup;
    assert.equal(active.attributes['aria-selected'], 'true');
    assert.equal(active.tabIndex, 0);
    assert.equal(inactive.attributes['aria-selected'], 'false');
    assert.equal(inactive.tabIndex, -1);
    assert.equal(active.classList.contains('active'), true);
    assert.equal(nodes.authFields.attributes['aria-labelledby'], active.id);
    assert.equal(nodes.authMode.value, mode);
    assert.equal(nodes.authPassword.autocomplete, mode === 'login' ? 'current-password' : 'new-password');
    assert.equal(nodes.authTitle.textContent, mode === 'recovery' ? 'Recupera tu acceso' : signup ? 'Crea tu cuenta en ERMIF' : 'Inicia sesión en ERMIF');
    for (const id of ['businessName', 'ownerName', 'authConfirmPassword', 'authTermsAccept']) assert.equal(nodes[id].required, signup, id);
    for (const id of ['businessNameLabel', 'ownerNameLabel', 'currencyLabel', 'authConfirmPasswordLabel', 'authTermsLabel']) assert.equal(nodes[id].classList.contains('is-hidden'), !signup, id);
    assert.equal(nodes.forgotPassword.classList.contains('is-hidden'), mode !== 'login');
    assert.equal(nodes.googleAuthButton.classList.contains('is-hidden'), mode === 'recovery');
    assert.equal(nodes.authEmail, email, 'same field survives mode changes');
    assert.equal(email.value, 'demo@example.invalid');
  }
});

test('arrow, Home and End navigation moves focus without activating tabs or clearing entered data', () => {
  const { nodes, context, focused } = setup();
  context.setAuthMode('signup');
  nodes.authConfirmPassword.value = 'fixture-confirmation';
  for (const [from, key, expected] of [
    ['showSignup', 'ArrowRight', 'showLogin'], ['showLogin', 'ArrowRight', 'showSignup'],
    ['showSignup', 'ArrowLeft', 'showLogin'], ['showLogin', 'ArrowLeft', 'showSignup'],
    ['showLogin', 'Home', 'showSignup'], ['showSignup', 'End', 'showLogin'],
  ]) {
    let prevented = false;
    nodes[from].listeners.keydown({ key, currentTarget: nodes[from], preventDefault() { prevented = true; } });
    assert.equal(focused(), expected);
    assert.equal(prevented, true);
    assert.equal(nodes.authMode.value, 'signup', 'manual activation preserves the current panel');
    assert.equal(nodes.showSignup.attributes['aria-selected'], 'true');
    assert.equal(nodes.authConfirmPassword.value, 'fixture-confirmation');
  }
  for (const key of ['Tab', 'Enter', ' ', 'ArrowDown', 'ArrowUp', 'Escape']) {
    nodes.showSignup.listeners.keydown({ key, currentTarget: nodes.showSignup, preventDefault() { assert.fail(key + ' must retain its native behavior'); } });
  }
});

test('native tab activation retains the original recovery exit and login validation behavior', () => {
  const { nodes, context } = setup();
  context.saas.passwordRecovery = true;
  context.setAuthMode('recovery');
  nodes.showSignup.listeners.click();
  assert.equal(context.saas.passwordRecovery, false);
  assert.equal(nodes.authMode.value, 'signup');
  nodes.authConfirmPassword.value = 'fixture-confirmation';
  nodes.authTermsAccept.checked = true;
  nodes.showLogin.listeners.click();
  assert.equal(nodes.authMode.value, 'login');
  assert.equal(nodes.authConfirmPassword.value, '');
  assert.equal(nodes.authTermsAccept.checked, false);
  assert.equal(nodes.authTermsAccept.required, false);
});

test('public pages, auth and 404 declare the same real square ERMIF favicon', async () => {
  const { renderPages } = require('../marketing/site.cjs');
  const favicon = new URL('../public/favicon.png', import.meta.url);
  const image = await require('sharp')(fs.readFileSync(favicon)).metadata();
  assert.equal(image.format, 'png');
  assert.equal(image.width, 96);
  assert.equal(image.height, 96);
  for (const document of [html, read('404.html'), ...Object.values(renderPages(html))]) {
    const icons = [...document.matchAll(/<link\b[^>]*rel="icon"[^>]*>/g)];
    assert.equal(icons.length, 1);
    assert.match(icons[0][0], /href="\/favicon\.png"/);
    assert.match(icons[0][0], /sizes="96x96"/);
    assert.match(icons[0][0], /type="image\/png"/);
  }
});
