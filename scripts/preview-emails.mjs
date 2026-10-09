import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareTransactionalEmail, EMAIL_EVENTS } from "../src/transactional-email.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".wrangler", "email-previews");
fs.mkdirSync(root, { recursive: true });
for (const kind of Object.keys(EMAIL_EVENTS)) {
  const rendered = prepareTransactionalEmail({
    eventKey: kind + ":demo", recipient: "prueba@example.invalid", subject: "ERMIF - demostracion local",
    payload: { claimCode: "DEMO-001", requestCode: "DEMO-002", response: "Esta es una respuesta de prueba.", requestSummary: "Solicitud ficticia.", dueAt: "2026-10-30", contactEmail: "soporte@example.invalid" },
  });
  fs.writeFileSync(path.join(root, kind + ".html"), rendered.html);
}
console.log("Vistas previas locales en " + root + ". No se enviaron correos.");
