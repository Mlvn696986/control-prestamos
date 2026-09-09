const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const publicFiles = ["index.html", "app.js", "styles.css", "supabase-config.js"];
const publicDirs = ["assets"];

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

for (const fileName of publicFiles) {
  fs.copyFileSync(path.join(rootDir, fileName), path.join(distDir, fileName));
}

for (const dirName of publicDirs) {
  const sourceDir = path.join(rootDir, dirName);
  if (fs.existsSync(sourceDir)) {
    fs.cpSync(sourceDir, path.join(distDir, dirName), { recursive: true });
  }
}

console.log(`Cloudflare build listo: ${[...publicFiles, ...publicDirs].join(", ")}`);
