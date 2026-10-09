import test from "node:test";
import assert from "node:assert/strict";
import { prepareTransactionalEmail, enqueueTransactionalEmail, EMAIL_EVENTS } from "../src/transactional-email.mjs";
const makeMessage = kind => ({
  eventKey: kind + ":test-id", recipient: "prueba@example.invalid",
  subject: "ERMIF - prueba local", payload: { claimCode: "TEST-001", requestCode: "TEST-002", response: '<script>alert("x")</script>', requestSummary: "Texto de prueba" },
});
for (const kind of Object.keys(EMAIL_EVENTS)) {
  test("plantilla " + kind + " escapa HTML y conserva texto", () => {
    const result = prepareTransactionalEmail(makeMessage(kind));
    assert.ok(result.text.includes("<script>"));
    assert.ok(!result.html.includes("<script>"));
    assert.ok(result.html.includes("&lt;script&gt;"));
    assert.equal(result.to, "prueba@example.invalid");
  });
}
test("rechaza inyeccion de cabeceras y multiples destinatarios", () => {
  assert.throws(() => prepareTransactionalEmail({ ...makeMessage("claim_received"), subject: "Hola\r\nBcc: x@example.com" }));
  assert.throws(() => prepareTransactionalEmail({ ...makeMessage("claim_received"), recipient: "a@example.com,b@example.com" }));
});
test("la cola queda pendiente y nunca afirma un envio real", async () => {
  let captured;
  const result = await enqueueTransactionalEmail(makeMessage("claim_received"), {
    insert: async row => { captured = row; return row; },
    findByEventKey: async () => { throw new Error("No deberia consultar"); },
  });
  assert.equal(result.status, "pending_configuration");
  assert.equal(captured.payload.rendered.templateVersion, 2);
  assert.equal(captured.sent_at, undefined);
});
test("un reintento conserva la evidencia de un evento ya enviado", async () => {
  const result = await enqueueTransactionalEmail(makeMessage("claim_response"), {
    insert: async () => null,
    findByEventKey: async key => ({ event_key: key, status: "sent", last_error: null }),
  });
  assert.equal(result.status, "sent");
});
test("un fallo de persistencia produce error y oculta datos del error", async () => {
  const result = await enqueueTransactionalEmail(makeMessage("privacy_received"), {
    insert: async () => { throw new Error("informacion privada"); },
    findByEventKey: async () => null,
  });
  assert.equal(result.status, "error");
  assert.ok(!result.error.includes("privada"));
});

test('todas las plantillas de acceso conservan los enlaces y códigos de Supabase',async()=>{
 const fs=await import('node:fs');
 const manifest=JSON.parse(fs.readFileSync(new URL('../emails/auth/manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.length,13);
 for(const template of manifest) {
  const html=fs.readFileSync(new URL('../emails/auth/'+template.file,import.meta.url),'utf8');
  assert.match(html,/<html lang="es">/);assert.match(html,/ermif\.com/);
  if(template.key==='reauthentication')assert.ok(html.includes('{{ .Token }}'));
  else if(!template.requiresSecurityNotificationToggle)assert.ok(html.includes('{{ .ConfirmationURL }}'));
  else assert.ok(!html.includes('{{ .ConfirmationURL }}'));
 }
});
