const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcJs = path.join(rootDir, 'js');
const distDir = path.join(rootDir, 'dist');
const distJs = path.join(distDir, 'js');

const srcCss = path.join(rootDir, 'css');
const distCss = path.join(distDir, 'css');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

if (fs.existsSync(srcJs)) {
  fs.cpSync(srcJs, distJs, { recursive: true });
  console.log(`[build:dist] Successfully copied js/ to dist/js/ (${fs.readdirSync(distJs).length} files)`);
}

if (fs.existsSync(srcCss)) {
  fs.cpSync(srcCss, distCss, { recursive: true });
  console.log(`[build:dist] Successfully copied css/ to dist/css/ (${fs.readdirSync(distCss).length} files)`);
}
