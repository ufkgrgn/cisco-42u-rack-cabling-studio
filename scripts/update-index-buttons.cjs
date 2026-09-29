const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const replacements = [
  [
    '<button class="hud-btn" id="btn-2d-face-toggle" title="Kabin ön veya arka yüzü">Ön / Arka</button>',
    '<button class="hud-btn" id="btn-2d-face-toggle" title="Kabin ön veya arka yüzü"><span class="btn-text">Ön Yüz</span></button>'
  ],
  [
    '<button class="hud-action-btn btn-close-hud" id="btn-hud-close" title="Kapat">✕</button>',
    '<button class="hud-action-btn btn-close-hud" id="btn-hud-close" title="Kapat" aria-label="Kapat"></button>'
  ],
  [
    '<button class="hud-btn" id="btn-close-schedule">✕</button>',
    '<button class="hud-btn icon-only" id="btn-close-schedule" title="Kapat" aria-label="Kapat"></button>'
  ],
  [
    '<button class="hud-btn" id="btn-close-cable-edit">✕</button>',
    '<button class="hud-btn icon-only" id="btn-close-cable-edit" title="Kapat" aria-label="Kapat"></button>'
  ],
  [
    '<button class="hud-btn" id="btn-close-wizard">✕</button>',
    '<button class="hud-btn icon-only" id="btn-close-wizard" title="Kapat" aria-label="Kapat"></button>'
  ],
  [
    '<button class="hud-btn" id="btn-close-device-edit">✕</button>',
    '<button class="hud-btn icon-only" id="btn-close-device-edit" title="Kapat" aria-label="Kapat"></button>'
  ],
  [
    '<button class="hud-btn" id="btn-close-port-edit">✕</button>',
    '<button class="hud-btn icon-only" id="btn-close-port-edit" title="Kapat" aria-label="Kapat"></button>'
  ],
  [
    '<button type="button" class="hud-btn" id="btn-close-add-rack">Kapat</button>',
    '<button type="button" class="hud-btn icon-only" id="btn-close-add-rack" title="Kapat" aria-label="Kapat"></button>'
  ],
  [
    '<button type="button" class="btn-icon" id="btn-close-cisco-catalog" title="Kapat">✕</button>',
    '<button type="button" class="btn-icon" id="btn-close-cisco-catalog" title="Kapat" aria-label="Kapat"></button>'
  ],
  [
    '<button type="button" id="cisco-search-clear" class="cisco-search-clear-btn" style="display:none;">✕</button>',
    '<button type="button" id="cisco-search-clear" class="cisco-search-clear-btn" title="Temizle" aria-label="Temizle" style="display:none;"></button>'
  ],
  [
    '<button type="button" class="hint-dismiss" id="btn-dismiss-viewport-hint" title="İpucunu gizle" aria-label="İpucunu gizle">×</button>',
    '<button type="button" class="hint-dismiss" id="btn-dismiss-viewport-hint" title="İpucunu gizle" aria-label="İpucunu gizle"></button>'
  ],
  [
    '<button type="button" class="mobile-schedule-close" id="btn-mobile-schedule-close" aria-label="Bağlantı panelini kapat">×</button>',
    '<button type="button" class="mobile-schedule-close" id="btn-mobile-schedule-close" title="Kapat" aria-label="Bağlantı panelini kapat"></button>'
  ]
];

for (const [target, replacement] of replacements) {
  if (!html.includes(target)) {
    console.error('Target not found:', target);
  } else {
    html = html.replace(target, replacement);
  }
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('Finished updating index.html');
