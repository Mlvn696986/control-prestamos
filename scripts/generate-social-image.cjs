const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { SOCIAL_IMAGE } = require('../marketing/metadata.cjs');

// Compose a share card from the original brand and a real capture with fictitious data.
// Never substitute a customer's account screenshot.
async function main() {
  const root = path.resolve(__dirname, '..');
  const mark = await sharp(path.join(root, 'assets/ermif-mark.png')).resize({ height: 58 }).png().toBuffer();
  const preview = await sharp(path.join(root, 'marketing/dashboard-source.jpg'))
    .resize({ width: 1028 }).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x2="1" y2="1"><stop stop-color="#061d2a"/><stop offset="1" stop-color="#0d3c43"/></linearGradient>
      <linearGradient id="line"><stop stop-color="#00b88b"/><stop offset="1" stop-color="#00b88b" stop-opacity="0"/></linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <circle cx="1110" cy="180" r="430" fill="none" stroke="#24565a" stroke-width="1"/>
    <circle cx="1110" cy="180" r="350" fill="none" stroke="#24565a" stroke-width="1"/>
    <path d="M60 144H542" stroke="url(#line)" stroke-width="2"/>
    <rect x="60" y="50" width="72" height="72" rx="18" fill="#fff"/>
    <image href="data:image/png;base64,${mark.toString('base64')}" x="72" y="57" width="48" height="58"/>
    <g font-family="Arial, Helvetica, sans-serif" font-weight="700">
      <text x="150" y="101" font-size="44" fill="#fff">ERMIF<tspan fill="#25d8a7">.</tspan></text>
      <text x="60" y="203" font-size="18" letter-spacing="1.3" fill="#66e4c2">SOFTWARE PARA PRESTAMISTAS</text>
      <text x="57" y="283" font-size="64" fill="#fff">Tu cartera,</text>
      <text x="57" y="358" font-size="64" fill="#59e2bb">bajo control.</text>
      <text x="60" y="418" font-size="23" fill="#d1e2e5">Clientes, préstamos y cobranzas.</text>
      <text x="60" y="560" font-size="25" fill="#fff">ermif.com</text>
      <path d="M208 551h28m-9-9 9 9-9 9" fill="none" stroke="#59e2bb" stroke-width="3"/>
      <rect x="610" y="130" width="542" height="414" rx="18" fill="#061d2a" opacity=".5"/>
      <rect x="610" y="118" width="542" height="414" rx="18" fill="#fff"/>
      <circle cx="635" cy="143" r="4" fill="#009d78"/>
      <circle cx="650" cy="143" r="4" fill="#b7d5d0"/>
      <circle cx="665" cy="143" r="4" fill="#b7d5d0"/>
      <text x="684" y="149" font-size="15" fill="#153e4b">Resumen financiero</text>
      <image href="data:image/jpeg;base64,${preview.toString('base64')}" x="624" y="164" width="514" height="347"/>
      <text x="881" y="563" text-anchor="middle" font-size="15" fill="#bfd8da">Vista real · Datos ficticios de demostración</text>
    </g>
  </svg>`;
  const target = path.join(root, 'public', SOCIAL_IMAGE.path.slice(1));
  await sharp(Buffer.from(svg)).jpeg({ quality: 94, chromaSubsampling: '4:4:4', mozjpeg: true }).toFile(target);
  const metadata = await sharp(target).metadata();
  if (metadata.width !== SOCIAL_IMAGE.width || metadata.height !== SOCIAL_IMAGE.height) throw new Error('Dimensiones sociales inesperadas.');
  console.log(path.relative(root, target) + ': ' + metadata.width + 'x' + metadata.height + ', ' + fs.statSync(target).size + ' bytes');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
