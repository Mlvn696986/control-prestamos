import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
function functionSource(name) {
  const marker = new RegExp("(?:async )?function " + name + "\\(");
  const start = source.search(marker);
  assert.ok(start >= 0, name);
  const end = source.indexOf("\nfunction ", start + 1);
  const asyncEnd = source.indexOf("\nasync function ", start + 1);
  return source.slice(start, Math.min(...[end, asyncEnd, source.length].filter((index) => index >= 0)));
}

test("app abre acceso por defecto y permite registro solo con el modo explicito", () => {
  for (const [search, expected] of [["", "login"], ["?mode=login", "login"], ["?mode=signup&utm_source=fixture", "signup"], ["?mode=recovery", "login"], ["?code=fixture", "login"]]) {
    const result = vm.runInNewContext(functionSource("getInitialAuthMode") + "\ngetInitialAuthMode()", { URLSearchParams, window: { location: { search } } });
    assert.equal(result, expected, search);
  }
});

test("recuperacion conserva el origen raiz ya autorizado sin copiar tokens", () => {
  for (const origin of ["https://ermif.com", "http://127.0.0.1:3000"]) {
    const result = vm.runInNewContext(functionSource("getAuthRedirectUrl") + "\ngetAuthRedirectUrl()", { window: { location: { protocol: new URL(origin).protocol, origin, pathname: "/app/", search: "?code=fixture", hash: "#access_token=fixture" } } });
    assert.equal(result, origin + "/");
  }
});

test("enlaces publicos abren solo formularios legales existentes y respetan recuperacion", () => {
  for (const [search, recovering, expected] of [["?dialog=claims", false, "claims"], ["?dialog=privacy-request", false, "privacy"], ["?dialog=account-deletion", false, ""], ["?dialog=claims", true, ""]]) {
    let opened = "";
    vm.runInNewContext(functionSource("openEntryDialog") + "\nopenEntryDialog()", { URLSearchParams, window: { location: { search } }, saas: { passwordRecovery: recovering }, openClaimBookDialog() { opened = "claims"; }, openPrivacyRequestDialog() { opened = "privacy"; } });
    assert.equal(opened, expected);
  }
});

test("el retorno de recuperacion conserva su modo aunque el SDK consuma el fragmento", async () => {
  for (const recovery of [true, false]) {
    const session = { user: { id: "fixture-user" } };
    let loads = 0;
    let mode;
    let authListener;
    const location = { hash: recovery ? "#type=recovery&access_token=fixture" : "#type=signup&access_token=fixture", search: "" };
    const context = { URLSearchParams, saas: {}, window: { location, SUPABASE_CONFIG: { url: "https://example.invalid", publishableKey: "fixture" }, supabase: { createClient() { return { auth: { async getSession() { location.hash = ""; return { data: { session } }; }, onAuthStateChange(callback) { authListener = callback; } } }; } } }, setAuthMode(value) { mode = value; }, setAuthNotice() {}, async loadCloudState() { loads++; }, showAuthRedirectMessage() {}, createEmptyState() { return {}; }, render() {} };
    await vm.runInNewContext(functionSource("initSaaS") + "\ninitSaaS()", context);
    assert.equal(context.saas.session, session);
    assert.equal(context.saas.loading, false);
    assert.equal(loads, recovery ? 0 : 1);
    assert.equal(mode, recovery ? "recovery" : undefined);
    if (recovery) assert.equal(context.saas.passwordRecovery, true);
    assert.equal(typeof authListener, "function");
  }
});
