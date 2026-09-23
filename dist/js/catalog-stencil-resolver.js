/**
 * Cisco Enterprise Rack & Cabling Studio - Catalog Stencil Resolver & Hover Preview
 * Handles matching Cisco device models to official front stencils,
 * generating procedural SVG stencils as lightweight fallbacks, and rendering
 * floating hover preview overlays for high-resolution graphics.
 */
(function () {
  'use strict';

  const escapeHtml = (val) => window.RackStudio?.escapeHtml ? window.RackStudio.escapeHtml(val) : String(val ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const normalize = (value) => String(value || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]/g, '');

  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };

  const stencilHoverPreview = make('div', undefined, 'catalog-stencil-hover-preview');
  const stencilHoverImage = document.createElement('img');
  stencilHoverImage.alt = '';
  stencilHoverPreview.setAttribute('aria-hidden', 'true');
  stencilHoverPreview.append(stencilHoverImage);
  document.body.append(stencilHoverPreview);

  let stencilHoverGeneration = 0;
  let stencilHoverTimer = 0;
  let stencilHoverClearTimer = 0;
  let stencilHoverAnchor = null;
  let stencilHoverOriginalButton = null;
  let stencilHoverOriginalUrl = '';

  function hideStencilHoverPreview() {
    stencilHoverGeneration++;
    clearTimeout(stencilHoverTimer);
    const cancelPendingStencil = stencilHoverPreview.dataset.state === 'loading';
    stencilHoverPreview.classList.remove('visible');
    stencilHoverPreview.dataset.state = 'idle';
    if (stencilHoverOriginalButton?.isConnected) {
      stencilHoverOriginalButton.textContent = 'Gerçek stencil’i göster';
      stencilHoverOriginalButton.removeAttribute('aria-busy');
    }
    stencilHoverAnchor = null;
    stencilHoverOriginalButton = null;
    stencilHoverOriginalUrl = '';
    clearTimeout(stencilHoverClearTimer);
    if (cancelPendingStencil) stencilHoverImage.removeAttribute('src');
    else stencilHoverClearTimer = setTimeout(() => { stencilHoverImage.removeAttribute('src'); }, 1800);
  }

  function showStencilHoverPreview(sourceImage, anchor, originalStencilUrl = '') {
    if (!sourceImage?.src) return;
    const generation = ++stencilHoverGeneration;
    stencilHoverAnchor = anchor;
    clearTimeout(stencilHoverTimer);
    clearTimeout(stencilHoverClearTimer);
    stencilHoverImage.src = sourceImage.currentSrc || sourceImage.src;
    stencilHoverImage.alt = sourceImage.alt || '';
    const anchorRect = anchor.getBoundingClientRect();
    const previewWidth = Math.min(420, Math.max(280, window.innerWidth * .28));
    const previewHeight = Math.min(132, Math.max(92, previewWidth * .29));
    const gap = 12;
    let left = anchorRect.right + gap;
    if (left + previewWidth > window.innerWidth - gap) left = Math.max(gap, anchorRect.left - previewWidth - gap);
    const top = Math.min(
      Math.max(gap, anchorRect.top + (anchorRect.height - previewHeight) / 2),
      Math.max(gap, window.innerHeight - previewHeight - gap)
    );
    stencilHoverPreview.style.setProperty('--preview-width', `${previewWidth}px`);
    stencilHoverPreview.style.setProperty('--preview-height', `${previewHeight}px`);
    stencilHoverPreview.style.left = `${Math.round(left)}px`;
    stencilHoverPreview.style.top = `${Math.round(top)}px`;
    requestAnimationFrame(() => {
      if (generation === stencilHoverGeneration) stencilHoverPreview.classList.add('visible');
    });

    if (originalStencilUrl) {
      stencilHoverOriginalButton = anchor.matches('button') ? anchor : null;
      stencilHoverOriginalUrl = new URL(originalStencilUrl, document.baseURI).href;
      stencilHoverPreview.dataset.state = 'loading';
      if (stencilHoverOriginalButton) {
        stencilHoverOriginalButton.textContent = 'Stencil yükleniyor…';
        stencilHoverOriginalButton.setAttribute('aria-busy', 'true');
      }
      stencilHoverTimer = setTimeout(() => {
        if (generation === stencilHoverGeneration) stencilHoverImage.src = stencilHoverOriginalUrl;
      }, 120);
    } else {
      stencilHoverPreview.dataset.state = 'preview';
    }
  }

  stencilHoverImage.addEventListener('load', () => {
    if (!stencilHoverOriginalUrl || stencilHoverImage.src !== stencilHoverOriginalUrl) return;
    stencilHoverPreview.dataset.state = 'ready';
    if (stencilHoverOriginalButton?.isConnected) {
      stencilHoverOriginalButton.textContent = 'Gerçek stencil’i kapat';
      stencilHoverOriginalButton.removeAttribute('aria-busy');
    }
  });

  stencilHoverImage.addEventListener('error', () => {
    if (!stencilHoverOriginalUrl || stencilHoverImage.src !== stencilHoverOriginalUrl) return;
    stencilHoverPreview.dataset.state = 'error';
    if (stencilHoverOriginalButton?.isConnected) {
      stencilHoverOriginalButton.textContent = 'Stencil açılamadı — yeniden dene';
      stencilHoverOriginalButton.removeAttribute('aria-busy');
    }
  });

  document.addEventListener('pointerdown', event => {
    if (stencilHoverPreview.classList.contains('visible') && !stencilHoverAnchor?.contains(event.target)) hideStencilHoverPreview();
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && stencilHoverPreview.classList.contains('visible')) {
      event.preventDefault();
      event.stopPropagation();
      hideStencilHoverPreview();
    }
  });

  function getAccessPortCount(item) {
    if (!Array.isArray(item?.ports)) return 0;
    return item.ports.filter(p => p.type !== 'pdu-outlet').length;
  }

  function createGeneratedStencil(item, sku) {
    const portCount = Math.min(48, Math.max(4, getAccessPortCount(item) || 24));
    const columns = Math.min(24, Math.ceil(portCount / (portCount > 24 ? 2 : 1)));
    const rows = Math.ceil(portCount / columns);
    const category = String(item?.category || '').toLowerCase();
    const kind = category === 'patch' ? 'patch' : (category === 'fiber' ? 'fiber' : (category === 'fiber-switch' ? 'fiber-switch' : (category === 'switch' ? 'switch' : category || 'device')));
    const portWidth = Math.min(12, (kind === 'patch' ? 420 : 286) / columns);
    const startX = kind === 'patch' ? 146 : 244;
    const ports = Array.from({ length: portCount }, (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const x = startX + column * (portWidth + 2);
      const y = rows === 1 ? 31 : 20 + row * 23;
      if (kind === 'patch') return `<rect x="${x.toFixed(1)}" y="${y}" width="${portWidth.toFixed(1)}" height="15" rx="2" fill="#0b1724" stroke="#f59e0b" stroke-width="1.2"/><path d="M${(x + 2).toFixed(1)} ${y + 5}h${Math.max(2, portWidth - 4).toFixed(1)}M${(x + 2).toFixed(1)} ${y + 9}h${Math.max(2, portWidth - 4).toFixed(1)}" stroke="#fcd34d" stroke-width=".7"/>`;
      const port = item?.ports?.[index];
      const isOptical = kind === 'fiber' || /sfp|qsfp|fiber|lc|sc/i.test(port?.type || '');
      const stroke = kind === 'fiber' || isOptical ? '#a78bfa' : '#38bdf8';
      const shape = kind === 'fiber' ? `<rect x="${x.toFixed(1)}" y="${y}" width="${portWidth.toFixed(1)}" height="15" rx="2" fill="#100f26" stroke="${stroke}" stroke-width="1.2"/><rect x="${(x + 2).toFixed(1)}" y="${y + 4}" width="${Math.max(2, (portWidth - 5) / 2).toFixed(1)}" height="7" rx="1" fill="#c4b5fd"/><rect x="${(x + portWidth / 2 + .5).toFixed(1)}" y="${y + 4}" width="${Math.max(2, (portWidth - 5) / 2).toFixed(1)}" height="7" rx="1" fill="#818cf8"/>` : (isOptical ? `<rect x="${x.toFixed(1)}" y="${y}" width="${portWidth.toFixed(1)}" height="15" rx="2" fill="#0b1324" stroke="${stroke}" stroke-width="1.2"/><rect x="${(x + 2).toFixed(1)}" y="${y + 3}" width="${Math.max(2, portWidth - 4).toFixed(1)}" height="9" rx="1" fill="#352b67"/>` : `<rect x="${x.toFixed(1)}" y="${y}" width="${portWidth.toFixed(1)}" height="15" rx="1.8" fill="#07111d" stroke="${stroke}" stroke-width="1"/><circle cx="${(x + portWidth / 2).toFixed(1)}" cy="${y + 7.5}" r="1.5" fill="#22c55e"/>`);
      return shape;
    }).join('');
    const label = escapeHtml(item.modelTag || sku || item.name || 'NETWORK DEVICE');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 80" role="img" data-preview-kind="${kind}"><defs><linearGradient id="chassis" x1="0" x2="0" y2="1"><stop stop-color="#26384b"/><stop offset="1" stop-color="#101923"/></linearGradient></defs><rect x="8" y="12" width="584" height="56" rx="5" fill="url(#chassis)" stroke="${kind === 'patch' ? '#f59e0b' : (kind === 'fiber' ? '#a78bfa' : '#64748b')}" stroke-width="2"/><rect x="1" y="20" width="12" height="40" rx="2" fill="#1e293b" stroke="#64748b"/><rect x="587" y="20" width="12" height="40" rx="2" fill="#1e293b" stroke="#64748b"/><circle cx="7" cy="40" r="2" fill="#94a3b8"/><circle cx="593" cy="40" r="2" fill="#94a3b8"/><text x="28" y="36" fill="#38bdf8" font-family="ui-monospace,Consolas,monospace" font-size="12" font-weight="700">${label}</text><text x="28" y="53" fill="#94a3b8" font-family="ui-sans-serif,Arial" font-size="8">${kind === 'patch' ? 'PASSIVE COPPER PATCH' : (kind === 'fiber' ? 'PASSIVE FIBER ODF' : (kind === 'fiber-switch' ? 'FIBER ACCESS SWITCH' : 'NETWORK DEVICE'))}</text>${kind !== 'patch' && kind !== 'fiber' ? '<circle cx="203" cy="32" r="3" fill="#22c55e"/><circle cx="214" cy="32" r="3" fill="#22c55e"/>' : ''}${ports}</svg>`;
    const img = document.createElement('img');
    img.className = 'hw-stencil-preview hw-generated-stencil';
    img.dataset.previewKind = kind;
    img.src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    img.alt = `${sku} oluşturulmuş ön panel önizlemesi`;
    img.setAttribute('draggable', 'false');
    return img;
  }

  const LEGACY_FRONT_STENCILS = [
    '1u_CISCO_C9200_24_FRONT.svg','1U__CISCO_C9200-24T Front.svg','4u_C9404R Front.svg','C1111-8PLTEEA_Front.svg',
    'C9120AXE_Front.svg','C9120AXI_Front.svg','C9120AXP_Front.svg','C9200-24P Front.svg','C9200-24P_Front.svg',
    'C9200-24T_Front.svg','C9200-48P Front.svg','C9200-48P_Front.svg','C9200-48T Front.svg','C9200-48T_Front.svg',
    'C9200CX-12P-2X2G Front.svg','C9200CX-12P-2X2G_Front.svg','C9200CX-12P-2XGH Front.svg','C9200CX-12P-2XGH_Front.svg',
    'C9200CX-12T-2X2G Front.svg','C9200CX-12T-2X2G_Front.svg','C9200CX-8P-2X2G Front.svg','C9200CX-8P-2X2G_Front.svg',
    'C9200CX-8P-2XGH Front.svg','C9200CX-8P-2XGH_Front.svg','C9200CX-8UXG-2X Front.svg','C9200CX-8UXG-2XH Front.svg',
    'C9200CX-8UXG-2XH_Front.svg','C9200CX-8UXG-2X_Front.svg','C9200L-24P-4G Front.svg','C9200L-24P-4G_Front.svg',
    'C9200L-24P-4X_Front.svg','C9200L-24T-4G_Front.svg','C9200L-24T-4X_Front.svg','C9200L-48P-4G Front.svg',
    'C9200L-48P-4G_Front.svg','C9200L-48P-4X_Front.svg','C9200L-48T-4G_Front.svg','C9200L-48T-4X_Front.svg',
    'C9300-24P Front.svg','C9300-24P_Front.svg','C9300-24S Front.svg','C9300-24S_Front.svg','C9300-24U Front.svg',
    'C9300-24U_Front.svg','C9300-48P Front.svg','C9300-48P_Front.svg','C9300-48S Front.svg','C9300-48S_Front.svg',
    'C9300-48U Front.svg','C9300-48U_Front.svg','C9300L-24P-4G Front.svg','C9300L-24P-4G_Front.svg',
    'C9300L-24P-4X_Front.svg','C9300L-24T-4G_Front.svg','C9300L-24T-4X_Front.svg','C9300L-48P-4G Front.svg',
    'C9300L-48P-4G_Front.svg','C9300L-48P-4X_Front.svg','C9300L-48T-4G_Front.svg','C9300L-48T-4X_Front.svg',
    'C9300LM-24U-4Y Front.svg','C9300LM-24U-4Y_Front.svg','C9300LM-48T-4Y Front.svg','C9300LM-48T-4Y_Front.svg',
    'C9300LM-48U-4Y_Front.svg','C9300LM-48UX-4Y_Front.svg','C9300X-12Y Front.svg','C9300X-12Y_Front.svg',
    'C9300X-24HX Front.svg','C9300X-24HX_Front.svg','C9300X-24Y Front.svg','C9300X-24Y_Front.svg',
    'C9300X-48HX Front.svg','C9300X-48HXN Front.svg','C9300X-48HXN_Front.svg','C9300X-48HX_Front.svg',
    'C9300X-48TX Front.svg','C9300X-48TX_Front.svg','C9404R_Front.svg','C9407R_Front.svg','C9410R_Front.svg',
    'C9500-16X Front.svg','C9500-16X_Front.svg','C9500-24Y4C Front.svg','C9500-24Y4C_Front.svg','C9500-32C Front.svg',
    'C9500-32C_Front.svg','C9500-32QC_Front.svg','C9500-40X.svg','C9500-48Y4C_Front.svg','C9500X-28C8D_Front.svg',
    'C9500X-60L4D_Front.svg','C9606-FAN_Front.svg','C9606R_Front.svg','C9610R_Front.svg','C9800-40-K9 Front.svg',
    'C9800-40-K9_Front.svg','C9800-80-K9 Front.svg','C9800-80-K9_Front.svg','C9800-L-C-K9 Front.svg',
    'C9800-L-C-K9_Front.svg','C9800-L-F-K9 Front.svg','C9800-L-F-K9_Front.svg','Cisco_ISR_C1111-4P_Front.svg',
    'Cisco_ISR_C1111-8P_Front.svg','Cisco_R42610_Front.svg','Cisco_R42610_Front_2.svg','ISR1100-4GLTE_Front.svg',
    'ISR1100-4G_Front.svg','ISR1100-6G_Front.svg','N3K-C3016Q-40GE_Front.svg','N3K-C3048TP_Front.svg',
    'N3K-C3064PQ_Front.svg','N3K-C3064TQ-10GT_Front.svg','N3K-C3132Q-40GE_Front.svg','N3K-C3164Q-40GE_Front.svg',
    'N3K-C3172PQ-10GE_Front.svg','N3K-C3172TQ-10GT_Front.svg','N3K-C3548P-10G_Front.svg','N5K-C5010P-BF_Front.svg',
    'N5K-C5548P-FA_Front.svg','N5K-C5548UP-FA_Front.svg','N5K-C5596UP-FA_Front.svg','N5K-C5672UP-16G_Front.svg',
    'WS-C2960S-24PD-L_Front.svg','WS-C2960S-24PS-L_Front.svg','WS-C2960S-24TD-L_Front.svg','WS-C2960S-24TS-L_Front.svg',
    'WS-C2960S-24TS-S_Front.svg','WS-C2960S-48FPD-L_Front.svg','WS-C2960S-48FPS-L_Front.svg','WS-C2960S-48LPD-L_Front.svg',
    'WS-C2960S-48LPS-L_Front.svg','WS-C2960S-48TD-L_Front.svg','WS-C2960S-48TS-L_Front.svg','WS-C2960S-48TS-S_Front.svg',
    'WS-C4948E-F_Front.svg','WS-C4948E_Front.svg','WS-C4948_Front.svg'
  ];

  const FRONT_STENCILS = Array.isArray(window.RACK_STENCIL_MANIFEST) && window.RACK_STENCIL_MANIFEST.length
    ? window.RACK_STENCIL_MANIFEST
    : LEGACY_FRONT_STENCILS;

  const STENCIL_BY_NORMALIZED_NAME = new Map(FRONT_STENCILS.map(file => [normalize(file), file]));
  const stencilCoverage = { matched: [], missing: [] };
  window.RACK_STENCIL_COVERAGE = stencilCoverage;

  function recordStencilCoverage(deviceId, stencilUrl) {
    const target = stencilUrl ? stencilCoverage.matched : stencilCoverage.missing;
    const other = stencilUrl ? stencilCoverage.missing : stencilCoverage.matched;
    const otherIndex = other.findIndex(entry => entry.deviceId === deviceId);
    if (otherIndex >= 0) other.splice(otherIndex, 1);
    if (!target.some(entry => entry.deviceId === deviceId)) target.push({ deviceId, stencilUrl: stencilUrl || null });
  }

  function resolveStencil(item, deviceId) {
    if (!item) return null;
    const tag = (item.modelTag || '').replace(/[\(\)]/g, '').trim();
    const id = (deviceId || '').trim();

    // 1. Direct candidate matching
    const exactCandidates = [
      tag + '_Front.svg', tag + ' Front.svg', tag + '.svg',
      'WS-' + tag + '_Front.svg', tag.replace(/^WS-/, '') + '_Front.svg',
      id + '_Front.svg', id.replace(/^cisco-m-/, '').toUpperCase() + '_Front.svg'
    ];
    for (const c of exactCandidates) {
      const f = STENCIL_BY_NORMALIZED_NAME.get(normalize(c));
      if (f) return 'assets/stencils/' + f;
    }

    // 2. Clean base tag without trailing suffixes (-S, -I, -L, etc.)
    const cleanTag = tag.split(' ')[0].replace(/-(S|I|L|FX|10GE|K9)$/i, '');
    const baseCandidates = [
      cleanTag + '_Front.svg', cleanTag + ' Front.svg', cleanTag + '.svg',
      cleanTag.replace(/^WS-/, '') + '_Front.svg',
      'WS-' + cleanTag + '_Front.svg'
    ];
    for (const c of baseCandidates) {
      const f = STENCIL_BY_NORMALIZED_NAME.get(normalize(c));
      if (f) return 'assets/stencils/' + f;
    }

    // 3. Catalyst 2960 family alias to authentic 2960S stencils
    if (/2960/i.test(tag) || /2960/i.test(id)) {
      const is48 = /48/i.test(tag) || /48/i.test(id);
      const isPoe = /p|poe/i.test(tag) || /p|poe/i.test(id);
      if (is48 && isPoe) return 'assets/stencils/WS-C2960S-48FPS-L_Front.svg';
      if (is48) return 'assets/stencils/WS-C2960S-48TS-L_Front.svg';
      if (isPoe) return 'assets/stencils/WS-C2960S-24PS-L_Front.svg';
      return 'assets/stencils/WS-C2960S-24TS-L_Front.svg';
    }

    // 4. Substring normalized matching
    const norm = cleanTag.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (norm.length >= 5) {
      const f = FRONT_STENCILS.find(s => normalize(s).includes(norm));
      if (f) return 'assets/stencils/' + f;
    }

    return null;
  }

  function toggleStencilHover(sourceImage, button, stencilUrl) {
    if (stencilHoverOriginalButton === button && stencilHoverPreview.classList.contains("visible") && stencilHoverPreview.dataset.state !== "error") {
      hideStencilHoverPreview();
    } else {
      showStencilHoverPreview(sourceImage, button, stencilUrl);
    }
  }

  window.CatalogStencil = {
    normalize,
    createGeneratedStencil,
    showStencilHoverPreview,
    hideStencilHoverPreview,
    resolveStencil,
    recordStencilCoverage,
    stencilCoverage,
    getStencilHoverAnchor: () => stencilHoverAnchor,
    getStencilHoverOriginalButton: () => stencilHoverOriginalButton,
    isHoverVisible: () => stencilHoverPreview.classList.contains('visible'),
    getHoverState: () => stencilHoverPreview.dataset.state,
    toggleStencilHover
  };
})();
