const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const local = process.argv.includes("--local");
const distDir = path.join(rootDir, local ? "dist-local" : "dist");
const publicFiles = ["index.html", "app.js", "styles.css", "supabase-config.js"];
const publicDirs = ["assets"];

// Solo se eliminan las carpetas generadas, nunca enlaces ni rutas externas.
if (!["dist", "dist-local"].some((name) => distDir === path.join(rootDir, name))) {
  throw new Error("Directorio de construccion no permitido.");
}
if (fs.existsSync(distDir) && fs.lstatSync(distDir).isSymbolicLink()) {
  throw new Error("No se reconstruyen directorios enlazados.");
}
if (!local) fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

if (local) {
  // Mantener el directorio para el observador, pero excluir archivos ajenos al build.
  const expected = new Set(publicFiles);
  function listAssets(directory, prefix) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const source = path.join(directory, entry.name);
      const relative = prefix + "/" + entry.name;
      if (entry.isSymbolicLink()) throw new Error("Los assets no pueden ser enlaces.");
      if (entry.isDirectory()) listAssets(source, relative);
      else expected.add(relative);
    }
  }
  for (const name of publicDirs) if (fs.existsSync(path.join(rootDir, name))) listAssets(path.join(rootDir, name), name);
  function prune(directory, prefix = "") {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix ? prefix + "/" + entry.name : entry.name;
      const target = path.resolve(directory, entry.name);
      if (!target.startsWith(distDir + path.sep)) throw new Error("Ruta fuera del build.");
      if (entry.isSymbolicLink()) throw new Error("El build contiene un enlace inesperado.");
      if (entry.isDirectory()) {
        if ([...expected].some(name => name.startsWith(relative + "/"))) prune(target, relative);
        else fs.rmSync(target, { recursive: true, force: true });
      } else if (!expected.has(relative)) fs.unlinkSync(target);
    }
  }
  prune(distDir);
}


for (const fileName of publicFiles) {
  if (local && fileName === "supabase-config.js") {
    fs.writeFileSync(path.join(distDir, fileName), 'window.SUPABASE_CONFIG = { url: "", publishableKey: "" };\n');
    continue;
  }
  fs.copyFileSync(path.join(rootDir, fileName), path.join(distDir, fileName));
}

for (const dirName of publicDirs) {
  const sourceDir = path.join(rootDir, dirName);
  if (fs.existsSync(sourceDir)) {
    fs.cpSync(sourceDir, path.join(distDir, dirName), { recursive: true });
  }
}

console.log(`Cloudflare build listo: ${[...publicFiles, ...publicDirs].join(", ")}`);
