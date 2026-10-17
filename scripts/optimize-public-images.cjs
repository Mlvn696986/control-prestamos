const path = require('node:path');
const fs = require('node:fs');
const sharp = require('sharp');

// Generate display-sized derivatives; keep the original brand artwork unchanged.
const root = path.resolve(__dirname, '..');
async function main() {
  const outputs = [
    ['assets/ermif-mark.png', 'public/favicon.png', { width: 96, height: 96, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }, 'png'],
    ['assets/ermif-mark.png', 'public/ermif-mark-small.png', { height: 96 }, 'png'],
    ['assets/ermif-logo.png', 'public/ermif-logo-480.webp', { width: 480 }, 'webp'],
    ['assets/ermif-logo.png', 'public/ermif-logo-960.webp', { width: 960 }, 'webp'],
    // Fresh 2x app capture, never an upscaled or previously compressed thumbnail.
    ['marketing/dashboard-source.jpg', 'public/dashboard-preview-hd.webp', { width: 1280 }, 'dashboard'],
    ['marketing/dashboard-source.jpg', 'public/dashboard-preview-1920.webp', { width: 1920 }, 'dashboard'],
    ['marketing/dashboard-source.jpg', 'public/dashboard-preview-2560.webp', { width: 2560 }, 'dashboard'],
  ];
  for (const [source, destination, size, format] of outputs) {
    let image = sharp(path.join(root, source)).resize({ ...size, withoutEnlargement: true });
    image = format === 'png' ? image.png({ compressionLevel: 9 })
      : image.webp({ quality: format === 'dashboard' ? 94 : 88, smartSubsample: format === 'dashboard', effort: 6 });
    await image.toFile(path.join(root, destination));
    console.log(destination + ': ' + fs.statSync(path.join(root, destination)).size + ' bytes');
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
