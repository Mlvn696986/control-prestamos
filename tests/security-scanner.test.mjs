import test from "node:test";
import assert from "node:assert/strict";
import scanner from "../scripts/check-secrets.js";
test("distingue claves publicables y credenciales privadas", () => {
  assert.equal(scanner.detectSecrets("sb_publishable_" + "a".repeat(30)).length, 0);
  assert.deepEqual(scanner.detectSecrets("sb_" + "secret_" + "a".repeat(30)), ["Supabase secret"]);
  const token = Buffer.from('{"alg":"HS256"}').toString("base64url") + "." +
    Buffer.from('{"role":"service_role"}').toString("base64url") + "." + "a".repeat(30);
  assert.deepEqual(scanner.detectSecrets(token), ["JWT service_role"]);
});
