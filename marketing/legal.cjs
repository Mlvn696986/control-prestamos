"use strict";

// The application remains the source of truth for the published legal documents.
// This extracts trusted repository HTML; it does not sanitize arbitrary input.
const DOCUMENTS = {
  terms: { dialogId: "termsDialog", heading: "Terminos y Condiciones" },
  privacy: { dialogId: "privacyDialog", heading: "Politica de Privacidad" },
};

const ACTION_LINKS = {
  "data-open-terms": "/terminos/",
  "data-open-privacy": "/privacidad/",
  "data-open-privacy-request": "/app/?dialog=privacy-request",
  "data-open-claims": "/app/?dialog=claims",
  "data-close-dialog": "/",
};

function attributes(tag) {
  const result = new Map();
  const source = tag.replace(/^<\/?[a-z][\w:-]*/i, "").replace(/\/?\s*>$/, "");
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    result.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }
  return result;
}

function tags(html) {
  // Quoted attribute values may contain `>`; comments are ignored as whole tokens.
  const pattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?([a-z][\w:-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
  return [...html.matchAll(pattern)]
    .filter((match) => match[1])
    .map((match) => ({
      name: match[1].toLowerCase(),
      closing: /^<\//.test(match[0]),
      selfClosing: /\/\s*>$/.test(match[0]),
      attributes: attributes(match[0]),
      start: match.index,
      end: match.index + match[0].length,
    }));
}

function elementInner(html, predicate, label) {
  const tokens = tags(html);
  const candidates = tokens.filter((token) => !token.closing && predicate(token));
  if (candidates.length !== 1) {
    throw new Error(`Documento legal: se esperaba un único ${label}; encontrados ${candidates.length}.`);
  }

  const opening = candidates[0];
  let depth = 1;
  for (const token of tokens) {
    if (token.start < opening.end || token.name !== opening.name) continue;
    if (token.closing) depth -= 1;
    else if (!token.selfClosing) depth += 1;
    if (depth === 0) return html.slice(opening.end, token.start);
  }
  throw new Error(`Documento legal: ${label} no tiene cierre.`);
}

function hasClass(token, name) {
  return (token.attributes.get("class") || "").split(/\s+/).includes(name);
}

function normalizeHeading(value) {
  return value
    .replace(/<[^>]*>/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function linksForActions(html) {
  const buttonPattern = /(<button\b(?:[^>"']|"[^"]*"|'[^']*')*>)([\s\S]*?)<\/button\s*>/gi;
  const result = html.replace(buttonPattern, (_, opening, label) => {
    const attrs = attributes(opening);
    const actions = Object.keys(ACTION_LINKS).filter((action) => attrs.has(action));
    if (actions.length !== 1) {
      throw new Error("Documento legal: botón sin una acción pública reconocida.");
    }
    // Preserve existing class names without carrying dialog-only attributes.
    const className = attrs.get("class");
    const classAttribute = className
      ? ` class="${className.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`
      : "";
    return `<a${classAttribute} href="${ACTION_LINKS[actions[0]]}">${label}</a>`;
  });
  if (/<\/?button\b/i.test(result) || /\bdata-(?:open-|close-dialog)/i.test(result)) {
    throw new Error("Documento legal: quedan controles de diálogo sin enlace público.");
  }
  return result;
}

function renderLegalContent(appHtml, type) {
  const document = Object.hasOwn(DOCUMENTS, type) && DOCUMENTS[type];
  if (!document) throw new Error(`Documento legal desconocido: ${String(type)}.`);
  if (typeof appHtml !== "string" || !appHtml.trim()) {
    throw new Error("Documento legal: falta el HTML fuente de la aplicación.");
  }

  const dialog = elementInner(
    appHtml,
    (token) => token.name === "dialog" && token.attributes.get("id") === document.dialogId,
    `diálogo ${document.dialogId}`,
  );
  const heading = elementInner(dialog, (token) => token.name === "h3", "encabezado h3");
  if (normalizeHeading(heading) !== normalizeHeading(document.heading)) {
    throw new Error(`Documento legal: encabezado inesperado en ${document.dialogId}.`);
  }
  const content = elementInner(dialog, (token) => token.name === "div" && hasClass(token, "legal-copy"), "bloque legal-copy");
  const date = elementInner(content, (token) => token.name === "p" && hasClass(token, "legal-date"), "fecha legal-date");
  if (!date.trim() || !/<h4\b/i.test(content)) {
    throw new Error(`Documento legal incompleto: ${document.dialogId}.`);
  }

  return linksForActions(content).trim();
}

module.exports = { renderLegalContent };
