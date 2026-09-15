const esbuild = require('esbuild');
const fs = require('fs');

const entryCode = `
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
window.THREE = THREE;
window.THREE.OrbitControls = OrbitControls;
`;

esbuild.buildSync({
  stdin: { contents: entryCode, resolveDir: process.cwd() },
  bundle: true,
  minify: true,
  outfile: 'js/three-bundle.min.js',
  format: 'iife'
});

console.log('Successfully bundled Three.js into js/three-bundle.min.js, size:', fs.statSync('js/three-bundle.min.js').size);
