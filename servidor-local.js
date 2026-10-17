const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "dist-local");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8" };
function createLocalServer() {
  return http.createServer((request, response) => {
    let url, pathname;
    try {
      url = new URL(request.url, "http://localhost");
      pathname = decodeURIComponent(url.pathname);
    } catch { response.writeHead(400); response.end("Ruta invalida"); return; }
    if (!["GET", "HEAD"].includes(request.method) || pathname.includes("\\") || pathname.includes("\0") || pathname.split("/").some((segment) => segment.startsWith(".")) || pathname.startsWith("/api/")) {
      response.writeHead(404); response.end("No encontrado"); return;
    }
    const legacyEntry = pathname === "/" || pathname === "/index.html";
    if (legacyEntry && (["code", "error", "error_code"].some((key) => url.searchParams.has(key)) || url.searchParams.get("billing") === "return")) {
      response.writeHead(302, { Location: "/app/" + url.search, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
      response.end(); return;
    }
    let file = path.resolve(root, "." + pathname);
    if (!file.startsWith(root + path.sep) && file !== root) { response.writeHead(404); response.end("No encontrado"); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!pathname.endsWith("/")) {
        response.writeHead(301, { Location: url.pathname + "/" + url.search, "Cache-Control": "no-store" });
        response.end(); return;
      }
      file = path.join(file, "index.html");
    }
    let status = 200;
    if (!fs.existsSync(file) || !fs.statSync(file).isFile() || !types[path.extname(file)]) {
      file = path.join(root, "404.html"); status = 404;
    }
    fs.realpath(file, (error, real) => {
      if (error || !real.startsWith(fs.realpathSync(root) + path.sep)) {
        response.writeHead(404); response.end("No encontrado"); return;
      }
      fs.readFile(real, (readError, content) => {
        if (readError) { response.writeHead(404); response.end("No encontrado"); return; }
        const headers = {
          "Content-Type": types[path.extname(file)],
          "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        };
        if (pathname === "/app" || pathname.startsWith("/app/") || status === 404) headers["X-Robots-Tag"] = "noindex";
        if (pathname.startsWith("/app/")) headers["Referrer-Policy"] = "no-referrer";
        response.writeHead(status, headers);
        response.end(request.method === "HEAD" ? undefined : content);
      });
    });
  });
}
if (require.main === module) {
  // La construccion local siempre sustituye Supabase por configuracion demo.
  const { execFileSync } = require("node:child_process");
  execFileSync(process.execPath, [path.join(__dirname, "scripts/build-cloudflare.js"), "--local"], { stdio: "inherit" });
  createLocalServer().listen(3000, "127.0.0.1", () => console.log("Web local: http://127.0.0.1:3000 | Demo: http://127.0.0.1:3000/app/"));
}
module.exports = { createLocalServer };
