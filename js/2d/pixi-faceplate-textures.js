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
  let portTextures = null;

  const PORT_STYLES = Object.freeze([
    { key: 'copper', shape: 'copper' },
    { key: 'optic', shape: 'optic' },
    { key: 'fiber-lc', shape: 'lc' },
    { key: 'fiber-sc', shape: 'sc' },
    { key: 'power', shape: 'power' },
    { key: 'occupied', shape: 'copper', occupied: true },
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
    if (/9300|9200|9500|cat9k/i.test(tag)) return 'cat9k';
    if (/3850|3750|3560/i.test(tag)) return 'cat3k';
    if (/2960/i.test(tag)) return 'cat2960';
    if (/nexus|n9k/i.test(tag)) return 'nexus';
    if (/isr|asr/i.test(tag)) return 'isr';
    return '';
  }

  function bump(counter) {
    if (PixiContext.performanceTelemetry) PixiContext.performanceTelemetry[counter]++;
  }

  function makeTexture(width, height, draw, label) {
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    draw(ctx, width, height);
    const PIXI = window.PIXI;
    if (PIXI.ImageSource) {
      const source = new PIXI.ImageSource({ resource: canvas, resolution: 2 });
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
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(0, 0, w, 1);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, h - 1, w, 1);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, 3, h);
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
    const series = seriesKey(spec, cat);
    const accent = series === 'nexus' ? '#34d399' : series === 'isr' ? '#0284c7' : '#38bdf8';
    paintMetal(ctx, w, h, '#131a2a', accent);
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, 78, h);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(78, 2, 1, h - 4);
    ctx.fillStyle = accent;
    ctx.font = '700 8px Segoe UI, sans-serif';
    ctx.fillText('CISCO', 8, 12);
    const model = RS.getShortModelName ? RS.getShortModelName(cat?.modelTag, cat?.name) : (cat?.modelTag || 'SW');
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(String(model).slice(0, 8), 8, 24);
    if (series === 'cat9k') {
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(62, 9, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    paintLeds(ctx, 58, 22);
    ctx.strokeStyle = '#64748b';
    ctx.strokeRect(46.5, 5.5, 6, 6);
  }

  function drawPatch(ctx, w, h, spec, cat) {
    const fiber = spec.category === 'fiber' || cat?.category === 'fiber';
    const name = `${cat?.name || ''} ${cat?.modelTag || ''} ${spec.catalogKey || ''}`;
    const accent = fiber ? '#a855f7' : (/cat6a/i.test(name) || /patch-cat6/i.test(spec.catalogKey || '') ? '#f97316' : '#fb923c');
    paintMetal(ctx, w, h, fiber ? '#111827' : '#17191d', accent);
    ctx.fillStyle = '#0c1016';
    ctx.fillRect(0, 0, 78, h);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 8px Segoe UI, sans-serif';
    const title = fiber ? 'ODF' : (/cat6a/i.test(name) || /patch-cat6/i.test(spec.catalogKey || '') ? 'Cat6A' : 'CAT6');
    ctx.fillText(title, 8, 13);
    ctx.fillStyle = accent;
    ctx.font = '9px ui-monospace, monospace';
    const badge = fiber ? (/sc/i.test(name) ? 'SC' : 'LC') : `${cat?.ports?.length || 24}P`;
    ctx.fillText(badge, 8, 24);
  }

  function drawPdu(ctx, w, h) {
    paintMetal(ctx, w, h, '#17251d', '#22c55e');
    ctx.fillStyle = '#0d1a14';
    ctx.fillRect(0, 0, 78, h);
    ctx.fillStyle = '#22c55e';
    ctx.font = '700 9px Segoe UI, sans-serif';
    ctx.fillText('230V', 8, 13);
    ctx.fillStyle = '#86efac';
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText('PDU 16A', 8, 24);
    paintLeds(ctx, 58, 16);
  }

  function drawBlank(ctx, w, h) {
    paintMetal(ctx, w, h, '#0b0d13', '#334155');
    ctx.fillStyle = '#475569';
    ctx.font = '700 9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BLANK COVER PANEL', w / 2, h / 2 + 3);
    ctx.textAlign = 'left';
  }

  function drawChassis(ctx, w, h, spec) {
    const cat = lookupCatalog(spec.catalogKey);
    const category = spec.category || cat?.category || '';
    if (category === 'blank') return drawBlank(ctx, w, h);
    if (category === 'pdu' || category === 'power') return drawPdu(ctx, w, h);
    if (category === 'patch' || category === 'fiber') return drawPatch(ctx, w, h, spec, cat);
    if (category === 'organizer') return paintMetal(ctx, w, h, '#121820', '#475569');
    return drawCisco(ctx, w, h, spec, cat);
  }

  function chassisCacheKey(spec) {
    const cat = lookupCatalog(spec.catalogKey);
    return [
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
    const kind = organizerKind(spec.catalogKey, spec.category);
    const w = width;
    const h = height;
    if (spec.category === 'blank' || (!kind && spec.category !== 'organizer')) {
      graphics.rect(0, 0, w, h).fill(0x0b0d13);
      graphics.rect(0, 0, 4, h).fill(0x334155);
      graphics.rect(0, 0, w, 1).fill(0x1c212b);
      graphics.rect(0, h - 1, w, 1).fill(0x030406);
      return;
    }
    if (kind === 'finger') {
      graphics.rect(0, 0, w, h).fill(0x1a2330);
      const tineH = Math.max(3, h * 0.22);
      const tineW = 7;
      for (let x = 8; x < w - 10; x += 14) {
        graphics.roundRect(x, 2, tineW, tineH, 1).fill(0x64748b);
        graphics.roundRect(x, h - tineH - 2, tineW, tineH, 1).fill(0x64748b);
      }
      if (!coverOpen) {
        graphics.roundRect(8, h * 0.36, w - 16, Math.max(4, h * 0.28), 2).fill(0x243044);
        graphics.rect(10, h * 0.36, w - 20, 1).fill({ color: 0xffffff, alpha: 0.18 });
      }
      return;
    }
    if (kind === 'dring') {
      graphics.rect(0, 0, w, h).fill(0x121820);
      paintRings(graphics, 0, 0, w, h);
      return;
    }
    graphics.rect(0, 0, w, h).fill(0x17191d);
    graphics.rect(0, 0, 3, h).fill(0x94a3b8);
    for (let x = 12; x < w - 8; x += 3) {
      graphics.rect(x, h * 0.12, 1, h * 0.26).fill(0x64748b);
      graphics.rect(x, h * 0.62, 1, h * 0.26).fill(0x64748b);
    }
    graphics.rect(8, h * 0.4, w - 16, Math.max(2, h * 0.2)).fill(0x0b0d13);
  }

  function paintRings(graphics, x, y, w, h) {
    const count = 5;
    const slot = w / count;
    for (let index = 0; index < count; index++) {
      const rw = Math.min(34, slot * 0.62);
      const rh = h * 0.7;
      const rx = x + slot * index + (slot - rw) / 2;
      const ry = y + (h - rh) / 2;
      graphics.roundRect(rx, ry, rw, rh, 4).stroke({ width: Math.max(1.6, rw * 0.08), color: 0x56687e });
      graphics.roundRect(rx + rw * 0.18, ry + rh * 0.22, rw * 0.64, rh * 0.56, 2)
        .stroke({ width: 1, color: 0x1a2332 });
    }
  }

  function paintOrganizerForeground(graphics, frames) {
    (frames || []).forEach(frame => {
      if (frame.category !== 'organizer') return;
      const kind = organizerKind(frame.catalogKey, 'organizer');
      if (kind === 'dring') {
        paintRings(graphics, frame.x, frame.y, frame.width, frame.height);
        return;
      }
      if (kind === 'finger') {
        const tineH = Math.max(3, frame.height * 0.22);
        const tineW = 7;
        for (let x = frame.x + 8; x < frame.x + frame.width - 10; x += 14) {
          graphics.roundRect(x, frame.y + 2, tineW, tineH, 1).fill(0x94a3b8);
          graphics.roundRect(x, frame.y + frame.height - tineH - 2, tineW, tineH, 1).fill(0x94a3b8);
        }
        if (!frame.coverOpen) {
          graphics.roundRect(frame.x + 8, frame.y + frame.height * 0.36, frame.width - 16, Math.max(4, frame.height * 0.28), 2)
            .fill({ color: 0x243044, alpha: 0.92 });
        }
        return;
      }
      if (kind === 'brush') {
        for (let x = frame.x + 12; x < frame.x + frame.width - 8; x += 3) {
          graphics.rect(x, frame.y + frame.height * 0.2, 1, frame.height * 0.22).fill({ color: 0xcbd5e1, alpha: 0.85 });
          graphics.rect(x, frame.y + frame.height * 0.58, 1, frame.height * 0.22).fill({ color: 0xcbd5e1, alpha: 0.85 });
        }
      }
    });
  }

  function drawPort(ctx, style, x) {
    const occupied = !!style.occupied;
    const fill = occupied ? '#08212a' : (style.shape === 'power' ? '#101b17' : style.shape === 'optic' ? '#0b1324' : '#100f26');
    const stroke = occupied ? '#22d3ee' : (style.shape === 'copper' ? '#64748b' : style.shape === 'optic' ? '#60a5fa' : style.shape === 'power' ? '#4ade80' : style.shape === 'sc' ? '#c084fc' : '#a78bfa');
    const detail = occupied ? '#67e8f9' : (style.shape === 'copper' ? '#334155' : style.shape === 'power' ? '#166534' : '#818cf8');
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    roundRect(ctx, x + 1, 2, PORT_CELL - 2, PORT_CELL - 4, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = detail;
    if (style.shape === 'copper') {
      [4, 7, 10, 13].forEach(pin => ctx.fillRect(x + pin, 6, 2, 3));
      ctx.fillRect(x + 5, 12, 10, 2);
    } else if (style.shape === 'optic') {
      roundRect(ctx, x + 4, 5, 12, 10, 2);
      ctx.fill();
      ctx.fillStyle = stroke;
      ctx.fillRect(x + 6, 7, 8, 2);
    } else if (style.shape === 'lc') {
      roundRect(ctx, x + 3, 5, 14, 10, 2);
      ctx.fill();
      ctx.fillStyle = stroke;
      ctx.fillRect(x + 9, 5, 1, 10);
      ctx.fillStyle = fill;
      ctx.fillRect(x + 5, 8, 3, 4);
      ctx.fillRect(x + 12, 8, 3, 4);
    } else if (style.shape === 'sc') {
      roundRect(ctx, x + 3, 5, 14, 10, 2);
      ctx.fill();
      ctx.fillStyle = fill;
      roundRect(ctx, x + 5, 7, 4, 6, 1);
      ctx.fill();
      roundRect(ctx, x + 11, 7, 4, 6, 1);
      ctx.fill();
    } else if (style.shape === 'power') {
      ctx.beginPath();
      ctx.arc(x + 7, 10, 2.4, 0, Math.PI * 2);
      ctx.arc(x + 13, 10, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function ensurePortTextures() {
    if (portTextures || !window.PIXI?.Texture) return portTextures;
    const width = PORT_STYLES.length * PORT_CELL;
    const canvasTexture = makeTexture(width, PORT_CELL, (ctx) => {
      PORT_STYLES.forEach((style, index) => drawPort(ctx, style, index * PORT_CELL));
    }, 'faceplate-ports');
    const Texture = window.PIXI.Texture;
    const Rectangle = window.PIXI.Rectangle;
    portTextures = Object.fromEntries(PORT_STYLES.map((style, index) => [
      style.key,
      new Texture({
        source: canvasTexture.source,
        frame: new Rectangle(index * PORT_CELL, 0, PORT_CELL, PORT_CELL),
        label: `rack-device-port-${style.key}`
      })
    ]));
    bump('devicePortAtlasBuilds');
    return portTextures;
  }

  function portTextureKey(port, occupied) {
    const type = String((port && port.type) || port || '').toLowerCase();
    let variant = 'copper';
    if (type === 'lc') variant = 'fiber-lc';
    else if (type === 'sc') variant = 'fiber-sc';
    else if (type === 'power' || type === 'c13' || type === 'c14') variant = 'power';
    else if (type === 'sfp' || type === 'sfp+' || type === 'qsfp28') variant = 'optic';
    if (!occupied) return variant;
    if (variant === 'copper') return 'occupied';
    if (variant === 'optic') return 'occupied-optic';
    return `occupied-${variant}`;
  }

  function getPortTexture(spec) {
    const textures = ensurePortTextures();
    if (!textures) return null;
    const key = portTextureKey(spec?.portType || spec, !!spec?.occupied);
    return textures[key] || textures.copper;
  }

  RS.FaceplateTextures = Object.freeze({
    getChassisTexture,
    getPortTexture,
    chassisSlice,
    paintChassisGraphics,
    paintOrganizerForeground,
    portTextureKey,
    organizerKind,
    isFingerOrganizer
  });
})();
