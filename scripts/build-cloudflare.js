const fs = require("node:fs");
const path = require("node:path");
const { renderPages } = require("../marketing/site.cjs");
const { optimizePublicAsset } = require("./public-assets.cjs");

const rootDir = path.resolve(__dirname, "..");
const local = process.argv.includes("--local");
const distDir = path.join(rootDir, local ? "dist-local" : "dist");
const staticFiles = ["app.js", "styles.css", "supabase-config.js", "robots.txt", "sitemap.xml", "404.html"];
const allowedPublicExtensions = new Set([".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".avif", ".ico", ".woff", ".woff2"]);
const appHtml = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
const pages = renderPages(appHtml);
if (!pages || typeof pages["index.html"] !== "string") throw new Error("La portada comercial no esta disponible.");
const copies = new Map(staticFiles.map((name) => [name, path.join(rootDir, name)]));

function collectFiles(directory, prefix, publicContent = false) {
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error("No se publican directorios enlazados.");
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const source = path.join(directory, entry.name);
    const relative = prefix ? prefix + "/" + entry.name : entry.name;
    if (entry.isSymbolicLink()) throw new Error("No se publican archivos enlazados.");
    if (entry.name.startsWith(".")) throw new Error("No se publican archivos ocultos.");
    if (entry.isDirectory()) collectFiles(source, relative, publicContent);
    else {
      if (publicContent && !allowedPublicExtensions.has(path.extname(entry.name).toLowerCase())) throw new Error("Extension publica no permitida: " + relative);
      if (copies.has(relative) || Object.hasOwn(pages, relative) || relative.startsWith("app/")) throw new Error("Archivo publico duplicado: " + relative);
      copies.set(relative, source);
    }
  }
}
collectFiles(path.join(rootDir, "assets"), "assets");
collectFiles(path.join(rootDir, "public"), "", true);
for (const [name, html] of Object.entries(pages)) {
  if (!/^(?:[a-z0-9-]+\/)*index\.html$/.test(name) || name.startsWith("app/") || typeof html !== "string") throw new Error("Pagina publica invalida: " + name);
}
const expected = new Set([...copies.keys(), ...Object.keys(pages), "app/index.html"]);

// Solo se eliminan las carpetas generadas dentro del proyecto, nunca enlaces.
if (!["dist", "dist-local"].some((name) => distDir === path.join(rootDir, name))) throw new Error("Directorio de construccion no permitido.");
if (fs.existsSync(distDir) && fs.lstatSync(distDir).isSymbolicLink()) throw new Error("No se reconstruyen directorios enlazados.");
if (!local) fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

function prune(directory, prefix = "") {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix ? prefix + "/" + entry.name : entry.name;
    const target = path.resolve(directory, entry.name);
    if (!target.startsWith(distDir + path.sep)) throw new Error("Ruta fuera del build.");
    if (entry.isSymbolicLink()) throw new Error("El build contiene un enlace inesperado.");
    if (entry.isDirectory()) {
      if ([...expected].some((name) => name.startsWith(relative + "/"))) prune(target, relative);
      else fs.rmSync(target, { recursive: true, force: true });
    } else if (!expected.has(relative)) fs.unlinkSync(target);
  }
}
if (local) prune(distDir); // Mantener el directorio que observa Wrangler.

function writeOutput(name, content) {
  const destination = path.join(distDir, name);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}
for (const [name, source] of copies) {
  const content = local && name === "supabase-config.js"
    ? 'window.SUPABASE_CONFIG = { url: "", publishableKey: "" };\n'
    : fs.readFileSync(source);
  writeOutput(name, optimizePublicAsset(name, content));
}
for (const [name, content] of Object.entries(pages)) writeOutput(name, content);
writeOutput("app/index.html", appHtml);
console.log("Cloudflare build listo: " + Object.keys(pages).length + " paginas publicas y aplicacion en /app/.");
