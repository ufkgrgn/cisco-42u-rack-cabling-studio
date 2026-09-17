/**
 * Build script for Standalone Universal Bundles (2D Studio, 3D Engine, 3D UI)
 * Powered by esbuild (fast, zero external runtime dependencies)
 */
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');

console.log('🚀 Building standalone studio bundles via esbuild...');

try {
  // 1. Build 3D Studio Engine Bundle
  const start3D = Date.now();
  esbuild.buildSync({
    entryPoints: [path.join(root, 'js/src/3d/engine.js')],
    bundle: true,
    outfile: path.join(root, 'js/studio3d.js'),
    format: 'iife',
    target: ['es2020'],
    legalComments: 'inline'
  });
  if (fs.existsSync(path.join(root, 'dist/js'))) {
    fs.copyFileSync(path.join(root, 'js/studio3d.js'), path.join(root, 'dist/js/studio3d.js'));
  }
  console.log(`✅ Built js/studio3d.js (${fs.statSync(path.join(root, 'js/studio3d.js')).size} bytes) in ${Date.now() - start3D}ms`);

  // 3. Build 3D Studio UI Bundle
  const startUI = Date.now();
  esbuild.buildSync({
    entryPoints: [path.join(root, 'js/src/3d-ui/index.js')],
    bundle: true,
    outfile: path.join(root, 'js/studio3d-ui.js'),
    format: 'iife',
    target: ['es2020'],
    legalComments: 'inline'
  });
  if (fs.existsSync(path.join(root, 'dist/js'))) {
    fs.copyFileSync(path.join(root, 'js/studio3d-ui.js'), path.join(root, 'dist/js/studio3d-ui.js'));
  }
  console.log(`✅ Built js/studio3d-ui.js (${fs.statSync(path.join(root, 'js/studio3d-ui.js')).size} bytes) in ${Date.now() - startUI}ms`);

  console.log('🎉 All standalone bundles compiled successfully!');
} catch (err) {
  console.error('❌ Bundle build failed:', err);
  process.exit(1);
}
