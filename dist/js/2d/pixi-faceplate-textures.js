/**
 * Procedural Pixi faceplate and port textures.
 * Chassis, bezels, organizers, blanks, PDUs, and connector sprites live here
 * so the device scene can stay under the line budget.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const PixiContext = RS.PixiContext = RS.PixiContext || {};

  const CHASSIS_W = 256;
  const CHASSIS_H = 32;
  const PORT_CELL = 20;
  const chassisCache = new Map();
  const portTexturesByTheme = new Map();

  const PORT_STYLES = Object.freeze([
    { key: 'copper', shape: 'copper' },
    { key: 'keystone', shape: 'copper', keystone: true },
    { key: 'optic', shape: 'optic' },
    { key: 'fiber-lc', shape: 'lc' },
    { key: 'fiber-sc', shape: 'sc' },
    { key: 'power', shape: 'power' },
    { key: 'occupied', shape: 'copper', occupied: true },
    { key: 'occupied-keystone', shape: 'copper', keystone: true, occupied: true },
    { key: 'occupied-optic', shape: 'optic', occupied: true },
    { key: 'occupied-fiber-lc', shape: 'lc', occupied: true },
    { key: 'occupied-fiber-sc', shape: 'sc', occupied: true },
    { key: 'occupied-power', shape: 'power', occupied: true }
  ]);

  function lookupCatalog(catalogKey) {
    if (!catalogKey) return null;
    return (RS.HARDWARE_CATALOG && RS.HARDWARE_CATALOG[catalogKey])
      || (RS.catalog && RS.catalog[catalogKey])
      || (RS.STATE && RS.STATE.customCatalog && RS.STATE.customCatalog[catalogKey])
      || null;
  }

  function organizerKind(catalogKey, category) {
    if (category && category !== 'organizer') return '';
    const cat = lookupCatalog(catalogKey);
    const blob = `${catalogKey || ''} ${cat?.modelTag || ''} ${cat?.name || ''}`.toLowerCase();
    if (blob.includes('dring') || blob.includes('d-ring')) return 'dring';
    if (blob.includes('finger') || blob.includes('organizer-2u') || blob.includes('parmak')) return 'finger';
    if (category === 'organizer' || blob.includes('brush') || blob.includes('organizer-1u')) return 'brush';
    return '';
  }

  function isFingerOrganizer(device) {
    return organizerKind(device?.catalogKey, device?.category || 'organizer') === 'finger';
  }

  function seriesKey(spec, cat) {
    const explicit = spec?.series || cat?.series || '';
    if (explicit) return String(explicit);
    const tag = `${cat?.modelTag || ''} ${cat?.name || ''} ${spec?.catalogKey || ''}`;
    if (/1000|c1000|cat1k/i.test(tag)) return 'cat1k';
    if (/compact|3560-cx|2960-cx|c9200cx/i.test(tag)) return 'compact';
    if (/cbs|business/i.test(tag)) return 'cbs';
    if (/9300|9200|9500|cat9k/i.test(tag)) return 'cat9k';
    if (/3850|3750|3560/i.test(tag)) return 'cat3k';
    if (/2960-x|2960x|2960-xr/i.test(tag)) return 'cat2960x';
    if (/2960/i.test(tag)) return 'cat2960';
    if (/nexus|n9k|n5k|n3k/i.test(tag)) return 'nexus';
    if (/isr|asr/i.test(tag)) return 'isr';
    return '';
  }

  function bump(counter) {
    if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry[counter]++;
  }

  function makeTexture(width, height, draw, label, scaleFactor = 4) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scaleFactor);
    canvas.height = Math.round(height * scaleFactor);
    const ctx = canvas.getContext('2d');
    ctx.scale(scaleFactor, scaleFactor);
    draw(ctx, width, height);
    const PIXI = window.PIXI;
    if (PIXI.ImageSource) {
      const source = new PIXI.ImageSource({ resource: canvas, resolution: scaleFactor });
      return new PIXI.Texture({ source, label });
    }
    const texture = PIXI.Texture.from(canvas);
    texture.label = label;
    return texture;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function paintMetal(ctx, w, h, fill, edge) {
    const isLight = ['light', 'high-contrast'].includes(document.documentElement.getAttribute('data-theme'));
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);

    if (isLight) {
      // In light theme: crisp 3D metallic chamfer frame (brushed titanium top highlight & slate edge)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(0, 0, w, 1);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, h - 1, w, 1);
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, 3.5, h);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(0, 0, w, 1);
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, h - 1, w, 1);
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, 3, h);
    }
  }

  function paintLeds(ctx, x, y) {
    const colors = ['#22c55e', '#38bdf8', '#f59e0b'];
    colors.forEach((color, index) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + index * 7, y, 2.1, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawCisco(ctx, w, h, spec, cat) {
    const isLight = ['light', 'high-contrast'].includes(document.documentElement.getAttribute('data-theme'));
    const series = seriesKey(spec, cat);
    const isWhite = series === 'cat1k' || series === 'compact' || series === 'cbs';
    const isTeal = series === 'cat2960' || series === 'cat2960x' || series === 'cat3k';
    const isNexus = series === 'nexus';
    const isRouter = series === 'isr';

    if (isLight) {
      // Enterprise Light / Platinum Stencil Mode (Visio & NetBox Schema Standard)
      // Base Platinum Aluminum Chassis
      paintMetal(ctx, w, h, '#f8fafc', '#0284c7');

      // Determine series-specific bezel accents
      let bezelBg = '#f1f5f9';
      let edgeColor = '#0284c7';
      let modelColor = '#1e293b';
      let defaultModel = 'C9300';

      if (isTeal) {
        bezelBg = '#f0fdfa';
        edgeColor = '#0d9488';
        modelColor = '#0f766e';
        defaultModel = '2960';
      } else if (isNexus) {
        bezelBg = '#f0fdf4';
        edgeColor = '#059669';
        modelColor = '#047857';
        defaultModel = 'N3K';
      } else if (isRouter) {
        bezelBg = '#fff7ed';
        edgeColor = '#ea580c';
        modelColor = '#c2410c';
        defaultModel = 'ISR';
      }

      // Left Bezel
      ctx.fillStyle = bezelBg;
      ctx.fillRect(0, 0, 77.5, h);
      ctx.fillStyle = edgeColor;
      ctx.fillRect(0, 0, 3.5, h);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(77.5, 0, 1, h);

      // Cisco Logo
      ctx.fillStyle = '#005073';
      ctx.font = '800 8.5px Segoe UI, sans-serif';
      ctx.fillText('CISCO', 8, 12);

      if (isNexus) {
        ctx.fillStyle = '#059669';
        ctx.font = '800 8px Segoe UI, sans-serif';
        ctx.fillText('NEXUS', 42, 12);
      } else if (isRouter) {
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(42, 4.5, 30, 8);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 6px Segoe UI, sans-serif';
        ctx.fillText('ROUTER', 44, 11);
      }

      // Model Name
      const model = RS.getShortModelName ? RS.getShortModelName(cat?.modelTag, cat?.name) : (cat?.modelTag || defaultModel);
      ctx.fillStyle = modelColor;
      ctx.font = '700 9.5px ui-monospace, monospace';
      ctx.fillText(String(model).slice(0, 9), 8, 24);

      // Status LEDs on bezel
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(60, 10, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = edgeColor;
      ctx.beginPath();
      ctx.arc(68, 10, 2, 0, Math.PI * 2);
      ctx.fill();

      return;
    }

    if (isWhite) {
      // 1. Cisco Catalyst 1000 & Compact Series (Clean White / Platinum Stencil Faceplate)
      paintMetal(ctx, w, h, '#0f172a', '#0284c7');
      // Left Bezel (Platinum Grey with Navy Cisco Logo)
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, 77.5, h);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 0, 3.5, h);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(77.5, 0, 1, h);
      // Cisco Logo
      ctx.fillStyle = '#005073';
      ctx.font = '800 8.5px Segoe UI, sans-serif';
      ctx.fillText('CISCO', 8, 12);
      // Model Name
      const model = RS.getShortModelName ? RS.getShortModelName(cat?.modelTag, cat?.name) : (cat?.modelTag || 'C1000');
      ctx.fillStyle = '#1e293b';
      ctx.font = '700 9.5px ui-monospace, monospace';
      ctx.fillText(String(model).slice(0, 9), 8, 24);
      // Status LEDs on bezel
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(60, 10, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(68, 10, 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (isTeal) {
      // 2. Cisco Catalyst 2960 / 3750 Series (Classic Cisco Teal/Green Bezel Stencil - Clean Flat)
      paintMetal(ctx, w, h, '#131924', '#14b8a6');
      ctx.fillStyle = '#1e525e';
      ctx.fillRect(0, 0, 77.5, h);
      ctx.fillStyle = '#14b8a6';
      ctx.fillRect(0, 0, 3.5, h);
      ctx.fillStyle = '#0f2930';
      ctx.fillRect(77.5, 0, 1, h);
      // Crisp White Cisco Logo
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 8.5px Segoe UI, sans-serif';
      ctx.fillText('CISCO', 8, 12);
      // Model Name
      const model = RS.getShortModelName ? RS.getShortModelName(cat?.modelTag, cat?.name) : (cat?.modelTag || '2960');
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '700 9.5px ui-monospace, monospace';
      ctx.fillText(String(model).slice(0, 9), 8, 24);
      // Mode button & LED cluster
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(52, 10, 2.5, 0, Math.PI * 2);
      ctx.fill();
      paintLeds(ctx, 48, 22);
      return;
    }

    if (isNexus) {
      // 3. Cisco Nexus Series (Obsidian Black & Emerald Green Stencil)
      paintMetal(ctx, w, h, '#0d1117', '#10b981');
      ctx.fillStyle = '#06080b';
      ctx.fillRect(0, 0, 77.5, h);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(0, 0, 3.5, h);
      ctx.fillStyle = '#1c2432';
      ctx.fillRect(77.5, 0, 1, h);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 8px Segoe UI, sans-serif';
      ctx.fillText('CISCO', 8, 12);
      ctx.fillStyle = '#10b981';
      ctx.font = '800 8px Segoe UI, sans-serif';
      ctx.fillText('NEXUS', 42, 12);
      const model = RS.getShortModelName ? RS.getShortModelName(cat?.modelTag, cat?.name) : (cat?.modelTag || 'N3K');
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 9px ui-monospace, monospace';
      ctx.fillText(String(model).slice(0, 9), 8, 24);
      ['#10b981', '#34d399', '#f59e0b'].forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(58 + i * 6, 22, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });
      return;
    }

    if (isRouter) {
      // 4. Cisco ISR Routers (Two-Tone Slate & Router Orange)
      paintMetal(ctx, w, h, '#141923', '#ea580c');
      ctx.fillStyle = '#0f141d';
      ctx.fillRect(0, 0, 77.5, h);
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(0, 0, 3.5, h);
      ctx.fillStyle = '#334155';
      ctx.fillRect(77.5, 0, 1, h);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 8px Segoe UI, sans-serif';
      ctx.fillText('CISCO', 8, 12);
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(42, 4.5, 30, 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 6px Segoe UI, sans-serif';
      ctx.fillText('ROUTER', 44, 11);
      const model = RS.getShortModelName ? RS.getShortModelName(cat?.modelTag, cat?.name) : (cat?.modelTag || 'ISR');
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '700 9px ui-monospace, monospace';
      ctx.fillText(String(model).slice(0, 9), 8, 24);
      paintLeds(ctx, 56, 22);
      return;
    }

    // 5. Cisco Catalyst 9000 Series (Modern Dark Graphite & Blue Beacon)
    const cat9kBg = '#131924';
    const cat9kBezel = '#0d121c';
    const cat9kDivider = '#1e293b';

    paintMetal(ctx, w, h, cat9kBg, '#00bceb');
    ctx.fillStyle = cat9kBezel;
    ctx.fillRect(0, 0, 77.5, h);
    ctx.fillStyle = '#00bceb';
    ctx.fillRect(0, 0, 3.5, h);
    ctx.fillStyle = cat9kDivider;
    ctx.fillRect(77.5, 0, 1, h);
    ctx.fillStyle = '#00bceb';
    ctx.font = '800 8.5px Segoe UI, sans-serif';
    ctx.fillText('CISCO', 8, 12);
    const model = RS.getShortModelName ? RS.getShortModelName(cat?.modelTag, cat?.name) : (cat?.modelTag || 'C9300');
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 9.5px ui-monospace, monospace';
    ctx.fillText(String(model).slice(0, 9), 8, 24);
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(62, 9, 2.2, 0, Math.PI * 2);
    ctx.fill();
    paintLeds(ctx, 54, 22);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(44.5, 6, 5, 5);
  }

  function drawPatch(ctx, w, h, spec, cat) {
    const isLight = ['light', 'high-contrast'].includes(document.documentElement.getAttribute('data-theme'));
    const fiber = spec.category === 'fiber' || cat?.category === 'fiber';
    const name = `${cat?.name || ''} ${cat?.modelTag || ''} ${spec.catalogKey || ''}`;

    if (fiber) {
      if (isLight) {
        paintMetal(ctx, w, h, '#f8fafc', '#7c3aed');
        ctx.fillStyle = '#faf5ff';
        ctx.fillRect(0, 0, 78, h);
        ctx.fillStyle = '#7c3aed';
        ctx.fillRect(0, 0, 3, h);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(77.5, 0, 1, h);
        ctx.fillStyle = '#6b21a8';
        ctx.font = '800 8.5px Segoe UI, sans-serif';
        ctx.fillText('FIBER ODF', 8, 12);
        ctx.fillStyle = '#7e22ce';
        ctx.font = '700 9px ui-monospace, monospace';
        const badge = /sc/i.test(name) ? 'SC DUPLEX' : 'LC DUPLEX';
        ctx.fillText(badge, 8, 24);
        return;
      }
      // Fiber ODF Panel (Dark / Modern Violet Accent)
      paintMetal(ctx, w, h, '#0f1118', '#a855f7');
      ctx.fillStyle = '#0a0c12';
      ctx.fillRect(0, 0, 78, h);
      ctx.fillStyle = '#261b3d';
      ctx.fillRect(77.5, 0, 1, h);
      ctx.fillStyle = '#c084fc';
      ctx.font = '800 8.5px Segoe UI, sans-serif';
      ctx.fillText('FIBER ODF', 8, 12);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '700 9px ui-monospace, monospace';
      const badge = /sc/i.test(name) ? 'SC DUPLEX' : 'LC DUPLEX';
      ctx.fillText(badge, 8, 24);
      return;
    }

    // Copper Patch Panel (Sleek Datacenter Matte Black & Subtle Keystone Accent - Sharp & Flat)
    const isCat6A = /cat6a/i.test(name) || /patch-cat6-24/i.test(spec.catalogKey || '');
    const portsCount = cat?.ports?.length || 24;

    if (isLight) {
      paintMetal(ctx, w, h, '#f8fafc', '#ea580c');
      ctx.fillStyle = '#fff7ed';
      ctx.fillRect(0, 0, 78, h);
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(0, 0, 3, h);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(77.5, 0, 1, h);

      ctx.fillStyle = '#c2410c';
      ctx.font = '800 8.5px Segoe UI, sans-serif';
      ctx.fillText(isCat6A ? 'CAT6A UTP' : 'CAT6 PANEL', 8, 12);

      ctx.fillStyle = '#ea580c';
      ctx.fillRect(8, 16, 38, 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 7px Segoe UI, sans-serif';
      ctx.fillText('PATCH', 11, 24);

      ctx.fillStyle = '#ea580c';
      ctx.font = '700 9px ui-monospace, monospace';
      ctx.fillText(`${portsCount}P`, 50, 24);
      return;
    }

    // Dark Mode: Precision Matte Anodized Aluminum Faceplate (Crisp & Flat)
    paintMetal(ctx, w, h, '#11141c', '#f97316');
    // Safety orange indicator edge
    ctx.fillStyle = '#f97316';
    ctx.fillRect(0, 0, 3, h);

    // Left Bezel: Distinctive Dark Identity
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(3, 0, 74.5, h);
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(77.5, 0, 1, h);

    // Patch Panel Title
    ctx.fillStyle = '#f97316';
    ctx.font = '800 8.5px Segoe UI, sans-serif';
    ctx.fillText(isCat6A ? 'CAT6A UTP' : 'CAT6 PANEL', 8, 12);

    // Badge pill: Orange background with white text
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(8, 16, 38, 10);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 7px Segoe UI, sans-serif';
    ctx.fillText('PATCH', 11, 24);

    // Port count tag
    ctx.fillStyle = '#fb923c';
    ctx.font = '700 9px ui-monospace, monospace';
    ctx.fillText(`${portsCount}P`, 50, 24);
  }

  function drawPdu(ctx, w, h) {
    const isLight = ['light', 'high-contrast'].includes(document.documentElement.getAttribute('data-theme'));
    if (isLight) {
      paintMetal(ctx, w, h, '#f1f5f9', '#16a34a');
      ctx.fillStyle = '#f0fdf4';
      ctx.fillRect(0, 0, 77.5, h);
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(0, 0, 3.5, h);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(77.5, 0, 1, h);
      ctx.fillStyle = '#15803d';
      ctx.font = '700 9px Segoe UI, sans-serif';
      ctx.fillText('230V', 8, 13);
      ctx.fillStyle = '#166534';
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillText('PDU 16A', 8, 24);
      paintLeds(ctx, 58, 16);
      return;
    }
    paintMetal(ctx, w, h, '#17251d', '#22c55e');
    ctx.fillStyle = '#0d1a14';
    ctx.fillRect(0, 0, 77.5, h);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, 0, 3.5, h);
    ctx.fillStyle = '#166534';
    ctx.fillRect(77.5, 0, 1, h);
    ctx.fillStyle = '#22c55e';
    ctx.font = '700 9px Segoe UI, sans-serif';
    ctx.fillText('230V', 8, 13);
    ctx.fillStyle = '#86efac';
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText('PDU 16A', 8, 24);
    paintLeds(ctx, 58, 16);
  }

  function drawBlank(ctx, w, h) {
    const isLight = ['light', 'high-contrast'].includes(document.documentElement.getAttribute('data-theme'));
    if (isLight) {
      paintMetal(ctx, w, h, '#e2e8f0', '#94a3b8');
      ctx.fillStyle = '#64748b';
      ctx.font = '700 9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BLANK COVER PANEL', w / 2, h / 2 + 3);
      ctx.textAlign = 'left';
      return;
    }
    paintMetal(ctx, w, h, '#0b0d13', '#334155');
    ctx.fillStyle = '#475569';
    ctx.font = '700 9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BLANK COVER PANEL', w / 2, h / 2 + 3);
    ctx.textAlign = 'left';
  }

  function drawChassis(ctx, w, h, spec) {
    const isLight = ['light', 'high-contrast'].includes(document.documentElement.getAttribute('data-theme'));
    const cat = lookupCatalog(spec.catalogKey);
    const category = spec.category || cat?.category || '';
    if (category === 'blank') return drawBlank(ctx, w, h);
    if (category === 'pdu' || category === 'power') return drawPdu(ctx, w, h);
    if (category === 'patch' || category === 'fiber') return drawPatch(ctx, w, h, spec, cat);
    if (category === 'organizer') return paintMetal(ctx, w, h, isLight ? '#e2e8f0' : '#121820', isLight ? '#94a3b8' : '#475569');
    return drawCisco(ctx, w, h, spec, cat);
  }

  function chassisCacheKey(spec) {
    const cat = lookupCatalog(spec.catalogKey);
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    return [
      theme,
      spec.category || cat?.category || 'default',
      organizerKind(spec.catalogKey, spec.category),
      seriesKey(spec, cat),
      spec.catalogKey || '',
      spec.uHeight || 1
    ].join('|');
  }

  function getChassisTexture(spec) {
    if (!window.PIXI?.Texture) return null;
    const key = chassisCacheKey(spec || {});
    if (chassisCache.has(key)) return chassisCache.get(key);
    const texture = makeTexture(CHASSIS_W, CHASSIS_H, (ctx, w, h) => drawChassis(ctx, w, h, spec || {}), `faceplate-${key}`);
    chassisCache.set(key, texture);
    bump('deviceChassisAtlasBuilds');
    return texture;
  }

  function chassisSlice(spec) {
    const category = spec?.category || lookupCatalog(spec?.catalogKey)?.category || '';
    if (category === 'organizer' || category === 'blank') return { mode: 'graphics' };
    return { mode: 'nineslice', leftWidth: 78, rightWidth: 8, topHeight: 2, bottomHeight: 2 };
  }

  function paintChassisGraphics(graphics, spec, width, height, coverOpen) {
    const isLight = ['light', 'high-contrast'].includes(document.documentElement.getAttribute('data-theme'));
    const kind = organizerKind(spec.catalogKey, spec.category);
    const w = width;
    const h = height;
    if (spec.category === 'blank' || (!kind && spec.category !== 'organizer')) {
      graphics.rect(0, 0, w, h).fill(isLight ? 0xe2e8f0 : 0x0b0d13);
      graphics.rect(0, 0, 4, h).fill(isLight ? 0x94a3b8 : 0x334155);
      graphics.rect(0, 0, w, 1).fill(isLight ? 0xffffff : 0x1c212b);
      graphics.rect(0, h - 1, w, 1).fill(isLight ? 0xcbd5e1 : 0x030406);
      return;
    }
    if (kind === 'finger') {
      graphics.rect(0, 0, w, h).fill(isLight ? 0xf8fafc : 0x1a2330);
      const tineH = Math.max(3, h * 0.22);
      const tineW = 7;
      for (let x = 8; x < w - 10; x += 14) {
        graphics.roundRect(x, 2, tineW, tineH, 1).fill(isLight ? 0x94a3b8 : 0x64748b);
        graphics.roundRect(x, h - tineH - 2, tineW, tineH, 1).fill(isLight ? 0x94a3b8 : 0x64748b);
      }
      if (!coverOpen) {
        graphics.roundRect(8, h * 0.36, w - 16, Math.max(4, h * 0.28), 2).fill(isLight ? 0xe2e8f0 : 0x243044);
        graphics.rect(10, h * 0.36, w - 20, 1).fill({ color: 0xffffff, alpha: isLight ? 0.6 : 0.18 });
      }
      return;
    }
    if (kind === 'dring') {
      graphics.rect(0, 0, w, h).fill(isLight ? 0xf1f5f9 : 0x131822);
      graphics.rect(0, 0, w, 1.2).fill(isLight ? 0xffffff : 0x334155);
      graphics.rect(0, h - 1.2, w, 1.2).fill(isLight ? 0xcbd5e1 : 0x0a0d14);
      paintDringBackplate(graphics, 0, 0, w, h);
      return;
    }
    graphics.rect(0, 0, w, h).fill(isLight ? 0xf8fafc : 0x17191d);
    graphics.rect(0, 0, 3, h).fill(isLight ? 0x64748b : 0x94a3b8);
    for (let x = 12; x < w - 8; x += 3) {
      graphics.rect(x, h * 0.12, 1, h * 0.26).fill(isLight ? 0x94a3b8 : 0x64748b);
      graphics.rect(x, h * 0.62, 1, h * 0.26).fill(isLight ? 0x94a3b8 : 0x64748b);
    }
    graphics.rect(8, h * 0.4, w - 16, Math.max(2, h * 0.2)).fill(isLight ? 0x475569 : 0x0b0d13);
  }

  function paintDringBackplate(graphics, x, y, w, h) {
    const isLight = ['light', 'high-contrast'].includes(document.documentElement.getAttribute('data-theme'));
    const count = 5;
    const slot = w / count;
    for (let index = 0; index < count; index++) {
      const rw = Math.min(34, slot * 0.62);
      const rh = h * 0.7;
      const rx = x + slot * index + (slot - rw) / 2;
      const ry = y + (h - rh) / 2;
      graphics.roundRect(rx - 2, ry - 1, rw + 4, rh + 2, 3)
        .fill(isLight ? 0xe2e8f0 : 0x1c2432)
        .stroke({ width: 1, color: isLight ? 0x94a3b8 : 0x334155 });
      graphics.circle(rx - 0.5, ry + rh / 2, 1.2).fill(isLight ? 0x94a3b8 : 0x64748b);
      graphics.circle(rx + rw + 0.5, ry + rh / 2, 1.2).fill(isLight ? 0x94a3b8 : 0x64748b);
      graphics.roundRect(rx + 2.5, ry + 2.5, rw - 5, rh - 5, 2.5)
        .fill(isLight ? 0xf8fafc : 0x18202c)
        .stroke({ width: 0.8, color: isLight ? 0xcbd5e1 : 0x242d3d });
    }
  }

  function paintDringHoops(graphics, x, y, w, h) {
    const isLight = ['light', 'high-contrast'].includes(document.documentElement.getAttribute('data-theme'));
    const count = 5;
    const slot = w / count;
    const bar = 3.5;
    for (let index = 0; index < count; index++) {
      const rw = Math.min(34, slot * 0.62);
      const rh = h * 0.7;
      const rx = x + slot * index + (slot - rw) / 2;
      const ry = y + (h - rh) / 2;
      graphics.roundRect(rx, ry, rw, bar, 1.5).fill(isLight ? 0x64748b : 0x384556).stroke({ width: 0.8, color: isLight ? 0x475569 : 0x64748b });
      graphics.roundRect(rx, ry + rh - bar, rw, bar, 1.5).fill(isLight ? 0x475569 : 0x2a3442).stroke({ width: 0.8, color: isLight ? 0x334155 : 0x475569 });
      graphics.roundRect(rx, ry, bar, rh, 1.5).fill(isLight ? 0x64748b : 0x334154).stroke({ width: 0.8, color: isLight ? 0x475569 : 0x55657a });
      graphics.roundRect(rx + rw - bar, ry, bar, rh, 1.5).fill(isLight ? 0x64748b : 0x334154).stroke({ width: 0.8, color: isLight ? 0x475569 : 0x55657a });
      graphics.rect(rx + 1, ry + 0.5, rw - 2, 0.8).fill({ color: 0xffffff, alpha: isLight ? 0.5 : 0.28 });
    }
  }

  function paintOrganizerForeground(graphics, frames) {
    const isLight = ['light', 'high-contrast'].includes(document.documentElement.getAttribute('data-theme'));
    (frames || []).forEach(frame => {
      if (frame.category !== 'organizer') return;
      const kind = organizerKind(frame.catalogKey, 'organizer');
      if (kind === 'dring') {
        paintDringHoops(graphics, frame.x, frame.y, frame.width, frame.height);
        return;
      }
      if (kind === 'finger') {
        const tineH = Math.max(3, frame.height * 0.22);
        const tineW = 7;
        for (let x = frame.x + 8; x < frame.x + frame.width - 10; x += 14) {
          graphics.roundRect(x, frame.y + 2, tineW, tineH, 1).fill(isLight ? 0x64748b : 0x94a3b8);
          graphics.roundRect(x, frame.y + frame.height - tineH - 2, tineW, tineH, 1).fill(isLight ? 0x64748b : 0x94a3b8);
        }
        if (!frame.coverOpen) {
          graphics.roundRect(frame.x + 8, frame.y + frame.height * 0.36, frame.width - 16, Math.max(4, frame.height * 0.28), 2)
            .fill({ color: isLight ? 0xe2e8f0 : 0x243044, alpha: 0.95 });
        }
        return;
      }
      if (kind === 'brush') {
        for (let x = frame.x + 12; x < frame.x + frame.width - 8; x += 3) {
          graphics.rect(x, frame.y + frame.height * 0.2, 1, frame.height * 0.22).fill({ color: isLight ? 0x64748b : 0xcbd5e1, alpha: 0.85 });
          graphics.rect(x, frame.y + frame.height * 0.58, 1, frame.height * 0.22).fill({ color: isLight ? 0x64748b : 0xcbd5e1, alpha: 0.85 });
        }
      }
    });
  }

  function drawPort(ctx, style, x) {
    const isLight = ['light', 'high-contrast'].includes(document.documentElement.getAttribute('data-theme'));
    const isKeystone = !!style.keystone;
    const isOccupied = !!style.occupied;

    if (isLight) {
      let fill = isKeystone ? '#ffffff' : '#ffffff';
      let stroke = isKeystone ? (isOccupied ? '#ea580c' : '#64748b') : (isOccupied ? '#0284c7' : '#64748b');

      if (style.shape === 'optic') {
        fill = '#f8fafc';
        stroke = isOccupied ? '#0284c7' : '#64748b';
      } else if (style.shape === 'lc' || style.shape === 'sc') {
        fill = '#faf5ff';
        stroke = isOccupied ? (style.shape === 'lc' ? '#8b5cf6' : '#a855f7') : '#64748b';
      } else if (style.shape === 'power') {
        fill = '#f0fdf4';
        stroke = isOccupied ? '#16a34a' : '#64748b';
      }

      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.0;
      roundRect(ctx, x + 2, 2, 16, 16, 1.5);
      ctx.fill();
      ctx.stroke();

      // Top rim highlight & bottom bevel
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(x + 3, 2.5, 14, 1);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(x + 3, 17, 14, 1);

      if (style.shape === 'copper') {
        // Dark recessed socket cavity
        ctx.fillStyle = '#0f172a';
        roundRect(ctx, x + 4, 4.5, 12, 11, 1);
        ctx.fill();

        // 6 precision gold/brass contact wire pins
        const pinColor = isOccupied ? '#f59e0b' : '#94a3b8';
        ctx.fillStyle = pinColor;
        [5.0, 6.8, 8.6, 10.4, 12.2, 14.0].forEach(p => ctx.fillRect(x + p, 4.8, 1.0, 2.6));

        // RJ45 lower socket latch notch
        ctx.fillStyle = isOccupied ? '#334155' : '#1e293b';
        roundRect(ctx, x + 7, 11.5, 6, 3.5, 0.8);
        ctx.fill();
        ctx.fillStyle = isOccupied ? '#475569' : '#334155';
        ctx.fillRect(x + 8.5, 13, 3, 2);

        // Micro status LED
        ctx.fillStyle = isOccupied ? '#16a34a' : '#cbd5e1';
        ctx.beginPath();
        ctx.arc(x + 4.2, 3.5, 1.0, 0, Math.PI * 2);
        ctx.fill();

        if (isKeystone) {
          ctx.fillStyle = isOccupied ? '#ea580c' : '#94a3b8';
          ctx.fillRect(x + 3.5, 2.5, 13, 1.4);
        }
      } else if (style.shape === 'optic') {
        ctx.fillStyle = '#0f172a';
        roundRect(ctx, x + 3.8, 4.2, 12.4, 11.6, 1);
        ctx.fill();
        ctx.fillStyle = isOccupied ? '#475569' : '#94a3b8';
        ctx.fillRect(x + 5, 9.2, 10, 1.6);
        // Optical twin bores
        ctx.fillStyle = '#020617';
        roundRect(ctx, x + 5.2, 5.2, 3.8, 3.4, 0.8);
        ctx.fill();
        roundRect(ctx, x + 11.0, 5.2, 3.8, 3.4, 0.8);
        ctx.fill();
        if (isOccupied) {
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.arc(x + 7.1, 6.9, 1.1, 0, Math.PI * 2);
          ctx.arc(x + 12.9, 6.9, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = isOccupied ? '#0284c7' : '#cbd5e1';
        ctx.beginPath();
        ctx.arc(x + 15.8, 3.5, 1.0, 0, Math.PI * 2);
        ctx.fill();
      } else if (style.shape === 'lc') {
        ctx.fillStyle = '#0f172a';
        roundRect(ctx, x + 3, 5, 14, 10, 1.5);
        ctx.fill();
        ctx.fillStyle = isOccupied ? stroke : '#64748b';
        ctx.fillRect(x + 9.5, 5, 1, 10);
        ctx.fillStyle = '#334155';
        ctx.fillRect(x + 4.5, 7, 4, 6);
        ctx.fillRect(x + 11.5, 7, 4, 6);
        ctx.fillStyle = isOccupied ? '#38bdf8' : '#f8fafc';
        ctx.beginPath();
        ctx.arc(x + 6.5, 10, 1.1, 0, Math.PI * 2);
        ctx.arc(x + 13.5, 10, 1.1, 0, Math.PI * 2);
        ctx.fill();
      } else if (style.shape === 'sc') {
        ctx.fillStyle = '#0f172a';
        roundRect(ctx, x + 3, 5, 14, 10, 1.5);
        ctx.fill();
        ctx.fillStyle = isOccupied ? stroke : '#64748b';
        ctx.fillRect(x + 9.5, 5, 1, 10);
        ctx.fillStyle = '#334155';
        roundRect(ctx, x + 4.5, 7, 4, 6, 1);
        ctx.fill();
        roundRect(ctx, x + 11.5, 7, 4, 6, 1);
        ctx.fill();
        ctx.fillStyle = isOccupied ? '#38bdf8' : '#f8fafc';
        ctx.beginPath();
        ctx.arc(x + 6.5, 10, 1.1, 0, Math.PI * 2);
        ctx.arc(x + 13.5, 10, 1.1, 0, Math.PI * 2);
        ctx.fill();
      } else if (style.shape === 'power') {
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(x + 7, 10, 2.2, 0, Math.PI * 2);
        ctx.arc(x + 13, 10, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    // --- DARK THEME: Crisp High-Definition Hardware Sockets ---
    const fill = isKeystone ? (isOccupied ? '#141c2c' : '#0e141f') : style.shape === 'power' ? '#0e1814' : style.shape === 'optic' ? (isOccupied ? '#111929' : '#0c111c') : (isOccupied ? '#151d2c' : '#0f1622');
    const stroke = isKeystone ? (isOccupied ? '#f97316' : '#334155') : style.shape === 'copper' ? (isOccupied ? '#38bdf8' : '#334155') : style.shape === 'optic' ? (isOccupied ? '#38bdf8' : '#334155') : style.shape === 'power' ? '#22c55e' : style.shape === 'sc' ? '#a855f7' : (isOccupied ? '#a855f7' : '#475569');

    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.0;
    roundRect(ctx, x + 2, 2, 16, 16, 1.5);
    ctx.fill();
    ctx.stroke();

    // Stamped metal rim highlight & shadow
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(x + 3, 2.5, 14, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(x + 3, 17, 14, 1);

    if (style.shape === 'copper') {
      // Recessed dark socket cavity
      ctx.fillStyle = '#050811';
      roundRect(ctx, x + 4, 4.5, 12, 11, 1);
      ctx.fill();
      ctx.fillStyle = '#020409';
      ctx.fillRect(x + 4.5, 4.5, 11, 1);

      // 6 precision gold/brass contact wire pins
      const pinColor = isOccupied ? '#f59e0b' : '#94a3b8';
      ctx.fillStyle = pinColor;
      [5.0, 6.8, 8.6, 10.4, 12.2, 14.0].forEach(p => ctx.fillRect(x + p, 4.8, 1.0, 2.6));
      if (isOccupied) {
        ctx.fillStyle = '#fef08a';
        [5.0, 6.8, 8.6, 10.4, 12.2, 14.0].forEach(p => ctx.fillRect(x + p, 4.8, 1.0, 0.7));
      }

      // RJ45 lower socket latch notch
      ctx.fillStyle = isOccupied ? '#1e293b' : '#0a0f1d';
      roundRect(ctx, x + 7, 11.5, 6, 3.5, 0.8);
      ctx.fill();
      ctx.fillStyle = isOccupied ? '#27354a' : '#141d2e';
      ctx.fillRect(x + 8.5, 13, 3, 2);

      // Micro status link LED
      ctx.fillStyle = isOccupied ? '#22c55e' : '#1e293b';
      ctx.beginPath();
      ctx.arc(x + 4.2, 3.5, 1.0, 0, Math.PI * 2);
      ctx.fill();
      if (isOccupied) {
        ctx.fillStyle = '#86efac';
        ctx.beginPath();
        ctx.arc(x + 4.2, 3.5, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isKeystone) {
        ctx.fillStyle = isOccupied ? '#f97316' : '#475569';
        ctx.fillRect(x + 3.5, 2.5, 13, 1.4);
      }
    } else if (style.shape === 'optic') {
      ctx.fillStyle = '#050811';
      roundRect(ctx, x + 3.8, 4.2, 12.4, 11.6, 1);
      ctx.fill();
      ctx.fillStyle = isOccupied ? '#475569' : '#334155';
      ctx.fillRect(x + 5, 9.2, 10, 1.6);
      // Optical twin bores
      ctx.fillStyle = '#020617';
      roundRect(ctx, x + 5.2, 5.2, 3.8, 3.4, 0.8);
      ctx.fill();
      roundRect(ctx, x + 11.0, 5.2, 3.8, 3.4, 0.8);
      ctx.fill();
      if (isOccupied) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(x + 7.1, 6.9, 1.1, 0, Math.PI * 2);
        ctx.arc(x + 12.9, 6.9, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = isOccupied ? '#00d2ff' : '#1e293b';
      ctx.beginPath();
      ctx.arc(x + 15.8, 3.5, 1.0, 0, Math.PI * 2);
      ctx.fill();
    } else if (style.shape === 'lc') {
      ctx.fillStyle = '#04060a';
      roundRect(ctx, x + 3, 5, 14, 10, 1.5);
      ctx.fill();
      ctx.fillStyle = isOccupied ? stroke : '#334155';
      ctx.fillRect(x + 9.5, 5, 1, 10);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x + 4.5, 7, 4, 6);
      ctx.fillRect(x + 11.5, 7, 4, 6);
      ctx.fillStyle = isOccupied ? '#38bdf8' : '#94a3b8';
      ctx.beginPath();
      ctx.arc(x + 6.5, 10, 1.1, 0, Math.PI * 2);
      ctx.arc(x + 13.5, 10, 1.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (style.shape === 'sc') {
      ctx.fillStyle = '#04060a';
      roundRect(ctx, x + 3, 5, 14, 10, 1.5);
      ctx.fill();
      ctx.fillStyle = isOccupied ? stroke : '#334155';
      ctx.fillRect(x + 9.5, 5, 1, 10);
      ctx.fillStyle = '#1e293b';
      roundRect(ctx, x + 4.5, 7, 4, 6, 1);
      ctx.fill();
      roundRect(ctx, x + 11.5, 7, 4, 6, 1);
      ctx.fill();
      ctx.fillStyle = isOccupied ? '#38bdf8' : '#94a3b8';
      ctx.beginPath();
      ctx.arc(x + 6.5, 10, 1.1, 0, Math.PI * 2);
      ctx.arc(x + 13.5, 10, 1.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (style.shape === 'power') {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(x + 7, 10, 2.2, 0, Math.PI * 2);
      ctx.arc(x + 13, 10, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function ensurePortTextures() {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    if (!window.PIXI?.Texture) return null;
    if (portTexturesByTheme.has(theme)) return portTexturesByTheme.get(theme);
    const width = PORT_STYLES.length * PORT_CELL;
    const canvasTexture = makeTexture(width, PORT_CELL, (ctx) => {
      PORT_STYLES.forEach((style, index) => drawPort(ctx, style, index * PORT_CELL));
    }, `faceplate-ports-${theme}`);
    const Texture = window.PIXI.Texture;
    const Rectangle = window.PIXI.Rectangle;
    const textures = Object.fromEntries(PORT_STYLES.map((style, index) => [
      style.key,
      new Texture({
        source: canvasTexture.source,
        frame: new Rectangle(index * PORT_CELL, 0, PORT_CELL, PORT_CELL),
        label: `rack-device-port-${style.key}-${theme}`
      })
    ]));
    bump('devicePortAtlasBuilds');
    portTexturesByTheme.set(theme, textures);
    return textures;
  }

  function portTextureKey(port, occupied) {
    const type = String((port && port.type) || port || '').toLowerCase();
    const category = String((port && port.category) || '').toLowerCase();
    const isPatch = category === 'patch' || (port && /patch/i.test(port.catalogKey || ''));
    let variant = 'copper';
    if (isPatch && (type === 'copper' || type === 'rj45' || !type || type === 'keystone')) variant = 'keystone';
    else if (type === 'lc') variant = 'fiber-lc';
    else if (type === 'sc') variant = 'fiber-sc';
    else if (type === 'power' || type === 'c13' || type === 'c14') variant = 'power';
    else if (type === 'sfp' || type === 'sfp+' || type === 'qsfp28') variant = 'optic';
    if (!occupied) return variant;
    if (variant === 'copper') return 'occupied';
    if (variant === 'keystone') return 'occupied-keystone';
    if (variant === 'optic') return 'occupied-optic';
    return `occupied-${variant}`;
  }

  function getPortTexture(spec) {
    const textures = ensurePortTextures();
    if (!textures) return null;
    const key = portTextureKey(spec?.portType || spec, !!spec?.occupied);
    return textures[key] || textures.copper;
  }

  function clearChassisCache() {
    chassisCache.forEach(texture => texture.destroy?.(true));
    chassisCache.clear();
    portTexturesByTheme.forEach(textures => {
      Object.values(textures).forEach(tex => tex?.destroy?.(true));
    });
    portTexturesByTheme.clear();
  }

  RS.FaceplateTextures = Object.freeze({
    getChassisTexture,
    getPortTexture,
    chassisSlice,
    paintChassisGraphics,
    paintOrganizerForeground,
    portTextureKey,
    organizerKind,
    isFingerOrganizer,
    clearChassisCache
  });
})();
