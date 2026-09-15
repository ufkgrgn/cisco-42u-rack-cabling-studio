const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcJs = path.join(rootDir, 'js');
const distDir = path.join(rootDir, 'dist');
const distJs = path.join(distDir, 'js');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

if (fs.existsSync(srcJs)) {
  fs.cpSync(srcJs, distJs, { recursive: true });
  console.log(`[build:dist] Successfully copied js/ to dist/js/ (${fs.readdirSync(distJs).length} files)`);
}
