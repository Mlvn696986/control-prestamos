const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "dist-local");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".png": "image/png" };
function createLocalServer() {
  return http.createServer((request, response) => {
    let name;
    try { name = decodeURIComponent(new URL(request.url, "http://localhost").pathname).slice(1) || "index.html"; }
    catch { response.writeHead(400); response.end("Ruta invalida"); return; }
    if (!["GET", "HEAD"].includes(request.method) ||
        !(/^(index\.html|app\.js|styles\.css|supabase-config\.js)$/.test(name) || /^assets\/[a-zA-Z0-9_-]+\.png$/.test(name))) {
      response.writeHead(404); response.end("No encontrado"); return;
    }
    const file = path.join(root, name);
    fs.realpath(file, (error, real) => {
      if (error || !real.startsWith(fs.realpathSync(root) + path.sep)) {
        response.writeHead(404); response.end("No encontrado"); return;
      }
      fs.readFile(real, (readError, content) => {
        if (readError) { response.writeHead(404); response.end("No encontrado"); return; }
        response.writeHead(200, {
          "Content-Type": types[path.extname(file)] || "application/octet-stream",
          "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        });
        response.end(request.method === "HEAD" ? undefined : content);
      });
    });
  });
}
if (require.main === module) {
  // La construccion local siempre sustituye Supabase por configuracion demo.
  const { execFileSync } = require("node:child_process");
  execFileSync(process.execPath, [path.join(__dirname, "scripts/build-cloudflare.js"), "--local"], { stdio: "inherit" });
  createLocalServer().listen(3000, "127.0.0.1", () => console.log("Demo local: http://127.0.0.1:3000"));
}
module.exports = { createLocalServer };
