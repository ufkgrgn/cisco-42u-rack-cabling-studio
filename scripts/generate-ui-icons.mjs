import fs from 'node:fs';
import * as lucide from 'lucide';

// Unified Lucide icon family for static application chrome. Keep names semantic.
const bindings = {
  'btn-3d-undo': 'Undo2',
  'btn-3d-redo': 'Redo2',
  'btn-command-palette': 'Search',
  'btn-tools-menu-toggle': 'Settings2',
  'btn-mobile-catalog': 'PanelLeft',
  'btn-mobile-schedule': 'Cable',
  'btn-view-3d': 'Box',
  'btn-view-2d': 'Server',
  'cam-focus': 'Focus',
  'btn-cable-tools': 'Cable',
  'btn-field-sheet': 'List',
  'btn-compact-view': 'Eye',
  'btn-2d-face-toggle': 'FlipHorizontal',
  'btn-export-json': 'Download',
  'btn-import-json': 'Upload',
  'btn-legacy-export-visio': 'FileCode',
  'btn-switch-to-3d': 'Box',
  'btn-clear-all': 'RotateCcw',
  'btn-preset-mdf': 'Server',
  'btn-preset-idf': 'Layers',
  'btn-preset-site': 'LayoutGrid',
  'btn-tidy-cables': 'Sparkles',
  'btn-clear-cables': 'Trash2',
  'btn-view-mode-single': 'Square',
  'btn-view-mode-multi': 'Columns2'
};

const extraShapes = {
  'Plus': lucide['Plus'],
  'ArrowLeft': lucide['ArrowLeft'],
  'ArrowRight': lucide['ArrowRight'],
  'ChevronLeft': lucide['ChevronLeft'],
  'ChevronRight': lucide['ChevronRight'],
  'Unplug': lucide['Unplug'],
  'Copy': lucide['Copy'],
  'Trash2': lucide['Trash2'],
  'Server': lucide['Server'],
  'Zap': lucide['Zap']
};

const names = [...new Set([...Object.values(bindings), ...Object.keys(extraShapes)])];
const shapes = Object.fromEntries(names.map(name => [name, lucide[name]]));

const output = `/* Generated from lucide. Run node scripts/generate-ui-icons.mjs. */
(function () {
  'use strict';
  const bindings = ${JSON.stringify(bindings)};
  const shapes = ${JSON.stringify(shapes)};
  const ns = 'http://www.w3.org/2000/svg';

  function createSvgIcon(name, size = 14) {
    const shape = shapes[name];
    if (!shape) return null;
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('class', 'ui-icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    for (const [tag, attributes] of shape) {
      const node = document.createElementNS(ns, tag);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
      svg.append(node);
    }
    return svg;
  }

  for (const [id, name] of Object.entries(bindings)) {
    const button = document.getElementById(id);
    if (!button) continue;
    // Remove existing icons (both old bootstrap inline SVGs and previously attached ui-icons)
    button.querySelectorAll('svg.ui-icon, svg.ico, svg:not(.brand-logo)').forEach(s => s.remove());
    const svg = createSvgIcon(name, 14);
    if (svg) button.prepend(svg);
  }

  for (const [id, text] of Object.entries({ 'btn-3d-undo': 'Geri al', 'btn-3d-redo': 'İleri al' })) {
    const button = document.getElementById(id);
    if (!button) continue;
    button.classList.remove('icon-only');
    if (!button.textContent.includes(text)) {
      button.append(document.createTextNode(text));
    }
  }

  window.getLucideIconSvg = function(name, size = 14) {
    const svg = createSvgIcon(name, size);
    return svg ? svg.outerHTML : '';
  };
  window.__UI_ICONS__ = shapes;
})();
`;

fs.writeFileSync(new URL('../js/ui-icons.js', import.meta.url), output);
console.log('Successfully generated js/ui-icons.js with ' + Object.keys(bindings).length + ' icon bindings.');
