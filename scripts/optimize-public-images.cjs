const path = require('node:path');
const fs = require('node:fs');
const sharp = require('sharp');

// Generate display-sized derivatives; keep the original brand artwork unchanged.
const root = path.resolve(__dirname, '..');
async function main() {
  const outputs = [
    ['assets/ermif-mark.png', 'public/ermif-mark-small.png', { height: 96 }, 'png'],
    ['assets/ermif-logo.png', 'public/ermif-logo-480.webp', { width: 480 }, 'webp'],
    ['assets/ermif-logo.png', 'public/ermif-logo-960.webp', { width: 960 }, 'webp'],
    ['public/dashboard-preview.webp', 'public/dashboard-preview-480.webp', { width: 480 }, 'webp'],
    ['public/dashboard-preview.webp', 'public/dashboard-preview-800.webp', { width: 800 }, 'webp'],
  ];
  for (const [source, destination, size, format] of outputs) {
    let image = sharp(path.join(root, source)).resize({ ...size, withoutEnlargement: true });
    image = format === 'png' ? image.png({ compressionLevel: 9 }) : image.webp({ quality: 88, effort: 6 });
    await image.toFile(path.join(root, destination));
    console.log(destination + ': ' + fs.statSync(path.join(root, destination)).size + ' bytes');
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
