const { transformSync } = require('esbuild');

// Only first-party public UI assets. The application and vendor scripts stay separate.
const optimizedFiles = new Set(['landing.js', 'landing.css', 'acquisition.js', 'acquisition.css']);
function optimizePublicAsset(name, content) {
  if (!optimizedFiles.has(name)) return content;
  return transformSync(String(content), {
    loader: name.endsWith('.css') ? 'css' : 'js',
    minify: true,
    charset: 'utf8',
    legalComments: 'inline',
    target: ['chrome100', 'firefox100', 'safari15'],
  }).code;
}

module.exports = { optimizePublicAsset };
