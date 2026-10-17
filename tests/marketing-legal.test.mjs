import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { renderLegalContent } = require("../marketing/legal.cjs");
const appHtml = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

function sourceContent(type) {
  const id = type === "terms" ? "termsDialog" : "privacyDialog";
  const dialog = appHtml.split(`<dialog id="${id}"`)[1].split("</dialog>")[0];
  return dialog.split('<div class="legal-copy">')[1].split('<div class="legal-actions">')[0].trim();
}

for (const type of ["terms", "privacy"]) {
  test(`public ${type} retains every existing legal paragraph, heading and date unchanged`, () => {
    const result = renderLegalContent(appHtml, type);
    assert.equal(result.split('<div class="legal-actions">')[0].trim(), sourceContent(type));
    assert.match(result, /HOYOS BUENO MELVIN/);
    assert.match(result, /10735063818/);
    assert.match(result, /Ultima actualizacion:/);
    assert.doesNotMatch(result, /<\/?(?:html|head|body|dialog|button)\b|data-open-|data-close-dialog/i);
    assert.match(result, /<a class="ghost-button" href="\/">Regresar<\/a>/);
  });
}

test("privacy publication keeps pending-verification disclosures and links the existing request form", () => {
  const result = renderLegalContent(appHtml, "privacy");
  assert.match(result, /Los bancos de datos de ERMIF aun no han sido inscritos ante la ANPD/);
  assert.match(result, /REQUIERE VERIFICACION DEL TITULAR/);
  assert.match(result, /REQUIERE CONFIRMACION CONTABLE\/LEGAL/);
  assert.match(result, /href="\/app\/\?dialog=privacy-request">Privacidad y mis datos<\/a>/);
  assert.doesNotMatch(result, /<h3\b/);
});

test("all supported dialog controls become usable public links without changing their labels", () => {
  const source = appHtml.replace(
    '<button class="ghost-button" type="button" data-open-privacy-request>Privacidad y mis datos</button>',
    `<button data-open-terms>Términos</button>
     <button data-open-privacy>Privacidad</button>
     <button data-open-claims>Reclamaciones</button>
     <button data-open-privacy-request>Mis datos</button>`,
  );
  const result = renderLegalContent(source, "privacy");
  assert.match(result, /href="\/terminos\/">Términos<\/a>/);
  assert.match(result, /href="\/privacidad\/">Privacidad<\/a>/);
  assert.match(result, /href="\/app\/\?dialog=claims">Reclamaciones<\/a>/);
  assert.match(result, /href="\/app\/\?dialog=privacy-request">Mis datos<\/a>/);
});

test("nested blocks, comments and reordered quoted attributes do not truncate legal content", () => {
  const source = appHtml
    .replace('<dialog id="termsDialog" class="modal">', "<dialog class='modal' data-note='x > y' id='termsDialog'>")
    .replace('<div class="legal-copy">', '<div data-note="x > y" class="extra legal-copy"><!-- <div> -->')
    .replace('<h4>1. Servicio</h4>', '<div><div><h4>1. Servicio</h4></div></div>');
  const result = renderLegalContent(source, "terms");
  assert.match(result, /<div><div><h4>1\. Servicio<\/h4><\/div><\/div>/);
  assert.match(result, /10\. Legislacion aplicable/);
  assert.match(result, /09 de septiembre de 2026/);
  assert.match(result, /href="\/">Regresar/);
});

test("invalid legal structure fails the build rather than publishing partial or empty documents", () => {
  assert.throws(() => renderLegalContent(appHtml, "unknown"), /desconocido/);
  assert.throws(() => renderLegalContent(appHtml, "toString"), /desconocido/);
  assert.throws(() => renderLegalContent("", "terms"), /falta el HTML/);
  assert.throws(() => renderLegalContent(appHtml.replace('id="termsDialog"', 'id="missing"'), "terms"), /diálogo termsDialog/);
  assert.throws(() => renderLegalContent(appHtml.replace("<h3>Terminos y Condiciones</h3>", ""), "terms"), /encabezado h3/);
  assert.throws(() => renderLegalContent(appHtml.replace("<h3>Terminos y Condiciones</h3>", "<h3>Otro documento</h3>"), "terms"), /encabezado inesperado/);
  assert.throws(() => renderLegalContent(appHtml.replace('class="legal-copy"', 'class="missing"'), "terms"), /bloque legal-copy/);
  assert.throws(() => renderLegalContent(appHtml.replace('class="legal-date"', 'class="missing"'), "terms"), /fecha legal-date/);
  const unknownAction = appHtml.replace(
    '<button class="ghost-button" type="button" data-open-privacy-request>Privacidad y mis datos</button>',
    '<button class="ghost-button" type="button" data-unknown>Privacidad y mis datos</button>',
  );
  assert.throws(() => renderLegalContent(unknownAction, "privacy"), /sin una acción pública reconocida/);
});
