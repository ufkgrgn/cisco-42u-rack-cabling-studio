// Vendor-only runtime: the official CSP adapter replaces generated uniform functions.
// Application features remain individually loaded classic scripts.
import * as PIXI from 'pixi.js';
import 'pixi.js/unsafe-eval';
window.PIXI=PIXI;
