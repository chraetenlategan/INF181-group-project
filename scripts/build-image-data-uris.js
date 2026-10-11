// build-image-data-uris.js — regenerates web/vendor/image-data-uris.js
//
// The "Edit with I Love INF181" hand-off rasterises the generated document with
// html2canvas. When the web tool is opened directly (file://), letterhead/logo
// images loaded by URL taint the canvas and block PDF export. To avoid that we
// inline these bundled images as data URIs and swap them in before rasterising.
//
// Run from the web/ folder:  node scripts/build-image-data-uris.js
// Re-run whenever images in web/images/ change.

const fs = require('fs');
const path = require('path');

const webDir = path.join(__dirname, '..');
const imagesDir = path.join(webDir, 'images');
const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

const files = fs.readdirSync(imagesDir).filter(f => mime[path.extname(f).toLowerCase()]);
const map = {};
for (const f of files) {
  const b64 = fs.readFileSync(path.join(imagesDir, f)).toString('base64');
  map[f] = `data:${mime[path.extname(f).toLowerCase()]};base64,${b64}`;
}

const header =
  '// Auto-generated data-URI copies of the bundled letterhead/logo images.\n' +
  '// Used by PreviewManager when rasterising pages for the offline I Love INF181\n' +
  '// hand-off, so canvases are not tainted by file:// images. Regenerate with:\n' +
  '//   node scripts/build-image-data-uris.js\n';

fs.writeFileSync(
  path.join(webDir, 'vendor', 'image-data-uris.js'),
  header + 'window.POLICYGEN_IMAGE_DATA_URIS = ' + JSON.stringify(map, null, 2) + ';\n'
);

console.log('Wrote vendor/image-data-uris.js with keys:', Object.keys(map).join(', '));
