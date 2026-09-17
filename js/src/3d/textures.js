/**
 * Procedural Canvas 2D Texture Generators for Three.js Materials
 */
import { getDeviceVisualKind, getDevicePortLayout } from './helpers.js';

// --- PROCEDURAL TEXTURE GENERATORS ---
  function createFloorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 504, 504);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let i = 0; i < 2500; i++) {
      const rx = Math.random() * 512;
      const ry = Math.random() * 512;
      ctx.fillRect(rx, ry, 2, 2);
    }

    ctx.fillStyle = '#475569';
    [ [20, 20], [492, 20], [20, 492], [492, 492] ].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(20, 20);
    return tex;
  }

  function createRailTexture(uCount) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = Math.max(1024, uCount * 128);
    const ctx = canvas.getContext('2d');

    // Deep textured rack rail post with dark brushed finish
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Inner rail flange guide line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

    const stepY = canvas.height / uCount;
    for (let u = 1; u <= uCount; u++) {
      const actualU = uCount - u + 1;
      const yTop = (u - 1) * stepY;
      const isFifth = actualU % 5 === 0;

      // EIA-310-D standard 3 square cage-nut holes on left flange
      ctx.fillStyle = '#020617';
      for (let h = 0; h < 3; h++) {
        const hy = yTop + (h + 0.5) * (stepY / 3) - 14;
        ctx.fillRect(36, hy, 44, 28);
        ctx.strokeStyle = isFifth ? '#0ea5e9' : '#475569';
        ctx.lineWidth = 3;
        ctx.strokeRect(36, hy, 44, 28);
      }

      // HIGH-CONTRAST U NUMBER SILKSCREEN BADGE
      const badgeX = 120;
      const badgeY = yTop + stepY / 2 - 36;
      const badgeW = 340;
      const badgeH = 72;

      // Silkscreen Badge Background & Border
      ctx.fillStyle = isFifth ? 'rgba(14, 165, 233, 0.35)' : 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = isFifth ? '#00e5ff' : '#64748b';
      ctx.lineWidth = isFifth ? 4 : 2;
      
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 10);
      } else {
        ctx.rect(badgeX, badgeY, badgeW, badgeH);
      }
      ctx.fill();
      ctx.stroke();

      // Sharp U Silkscreen Text
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      // "U" prefix in subtle cyan/muted
      ctx.fillStyle = isFifth ? '#38bdf8' : '#94a3b8';
      ctx.font = '800 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Consolas, monospace';
      ctx.fillText('U', badgeX + 24, badgeY + badgeH / 2);

      // Large bold number
      ctx.fillStyle = isFifth ? '#00e5ff' : '#ffffff';
      ctx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Consolas, monospace';
      ctx.fillText(String(actualU), badgeX + 64, badgeY + badgeH / 2);

      // Multiples of 5 have an extra neon dot
      if (isFifth) {
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(badgeX + badgeW - 32, badgeY + badgeH / 2, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // High-visibility horizontal U division line
      ctx.strokeStyle = isFifth ? 'rgba(0, 229, 255, 0.6)' : '#334155';
      ctx.lineWidth = isFifth ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(12, yTop);
      ctx.lineTo(canvas.width - 12, yTop);
      ctx.stroke();

      // Intermediate 1/3 and 2/3 U EIA tick marks
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      [1/3, 2/3].forEach(fraction => {
        const ty = yTop + stepY * fraction;
        ctx.beginPath();
        ctx.moveTo(canvas.width - 40, ty);
        ctx.lineTo(canvas.width - 12, ty);
        ctx.stroke();
      });
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 16;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    return tex;
  }

  // Clear Silkscreen Faceplate Texture - ZERO OVERLAP WITH PORTS/LEDS
  function createFaceplateTexture(dev) {
    const canvas = document.createElement('canvas');
    const faceW = RAIL_WIDTH - 0.14;
    const faceH = dev.uHeight * U_HEIGHT - 0.05;
    const physicalAspect = faceW / faceH;
    const h = 160 * Math.max(1, dev.uHeight || 1);
    const w = Math.round(h * physicalAspect);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const visualKind = getDeviceVisualKind(dev);

    const isPassive = ['blank', 'accessory', 'organizer'].includes(dev.category) || 
                      (dev.id && (dev.id.includes('blank') || dev.id.includes('organizer') || dev.id.includes('cable-manager')));

    // Vendor specific brushed metal gradient
    const bg = ctx.createLinearGradient(0, 0, w, h);
    if (isPassive) {
      // Matte dark industrial powder-coated metal for blanking & organizers
      bg.addColorStop(0, '#131822');
      bg.addColorStop(0.5, '#1b2230');
      bg.addColorStop(1, '#0f131a');
    } else if (visualKind === 'switch') {
      bg.addColorStop(0, '#243248');
      bg.addColorStop(0.5, '#32445e');
      bg.addColorStop(1, '#1e293b');
    } else if (visualKind === 'patch-panel') {
      bg.addColorStop(0, '#17120a');
      bg.addColorStop(0.5, '#292011');
      bg.addColorStop(1, '#0f0c08');
    } else if (dev.category === 'server') {
      bg.addColorStop(0, '#283142');
      bg.addColorStop(0.5, '#3b4759');
      bg.addColorStop(1, '#1f2937');
    } else if (dev.category === 'router') {
      bg.addColorStop(0, '#334155');
      bg.addColorStop(0.5, '#475569');
      bg.addColorStop(1, '#273444');
    } else {
      bg.addColorStop(0, '#1a2230');
      bg.addColorStop(0.5, '#242f40');
      bg.addColorStop(1, '#151c27');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Fine brushed steel texture lines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }

    // Outer metal bevel border
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(0, 0, w, 3);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, h - 3, w, 3);

    if (visualKind === 'fiber-panel') {
      // Sleek dark brushed aluminum finish
      ctx.fillStyle = '#1e2430';
      ctx.fillRect(0, 0, w, h);

      // Left Brand & Model Silkscreen
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.fillText(dev.name || 'HCS DataLight 24', 24, 38);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.fillText('19” FIBER OPTIC PATCH PANEL (24x LC/SC)', 24, 58);

      // Selective Label Strip (Hostname / IP / MAC)
      const hostname = dev.panelLabel || dev.hostname || dev.name || '';
      const ip = dev.ipAddress || dev.ip || '';
      const mac = dev.macAddress || dev.mac || '';
      const labelMode = window.deviceLabelMode || localStorage.getItem('rack-studio-device-label-mode') || 'name';
      const labelVals = labelMode === 'all' ? [hostname, ip, mac]
        : labelMode === 'ip' ? [ip]
        : labelMode === 'mac' ? [mac]
        : labelMode === 'none' ? [] : [hostname];
      const activeLabel = labelVals.filter(Boolean).join(' | ');

      if (activeLabel) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(22, h - 36, Math.min(320, w * 0.25), 22);
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(22, h - 36, Math.min(320, w * 0.25), 22);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12px Consolas, monospace';
        ctx.fillText(activeLabel.slice(0, 32), 28, h - 21);
      }

      // Horizontal Port Bank Area (Aligned with 3D port meshes!)
      const bankX = Math.round(w * 0.31);
      const bankW = Math.round(w * 0.66);
      const step = bankW / 24;

      // Recessed adapter channel
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.fillRect(bankX - 8, 16, bankW + 16, h - 32);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bankX - 8, 16, bankW + 16, h - 32);

      // Clean, straight, professional duplex fiber couplers
      for (let i = 0; i < 24; i++) {
        const cx = bankX + i * step + step / 2;
        const cy = h / 2;
        const couplerW = Math.max(16, step * 0.72);
        const couplerH = h - 46;

        // Aqua duplex adapter housing
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(cx - couplerW / 2, cy - couplerH / 2, couplerW, couplerH);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - couplerW / 2, cy - couplerH / 2, couplerW, couplerH);

        // Dark internal fiber ferrule cavity
        ctx.fillStyle = '#082f49';
        ctx.fillRect(cx - couplerW * 0.35, cy - couplerH * 0.32, couplerW * 0.7, couplerH * 0.64);

        // Stainless steel latch tab
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(cx - 3, cy - couplerH / 2 - 2, 6, 3);
        ctx.fillRect(cx - 3, cy + couplerH / 2 - 1, 6, 3);

        // Port number under each port
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 10px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1).padStart(2, '0'), cx, h - 6);
      }
      ctx.textAlign = 'left';

      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 16;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      return tex;
    }

    // --- PASSIVE ACCESSORIES: REALISTIC MATTE METAL FINISH (NO LEDS, NO STATUS TEXT) ---
    if (isPassive) {
      if (dev.id && dev.id.includes('blank')) {
        // Blanking Panel: Stamped ventilation slots or stiffening ribs
        ctx.strokeStyle = '#273346';
        ctx.lineWidth = 2;
        ctx.strokeRect(30, 16, w - 60, h - 32);

        // Center embossed label
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('1U BLANKING PANEL (EIA-310-D)', w / 2, h / 2 + 5);
      } else {
        // Cable Organizer / D-Ring: Professional matte black with loop guides
        ctx.strokeStyle = '#273346';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(20, 12, w - 40, h - 24);

        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 12px system-ui, -apple-system, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('1U HORIZONTAL CABLE MANAGEMENT PANEL', 36, h / 2 + 4);
      }



      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 8;
      return tex;
    }

    // --- ACTIVE HARDWARE (Switches, Routers, Servers): BRAND & LABELS ---
    ctx.textAlign = 'left';
    const badgeW = Math.min(520, Math.round(w * 0.28));
    // Badge background box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(16, 12, badgeW, h - 24);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(16, 12, badgeW, h - 24);

    const brand = (dev.manufacturer || 'CISCO').toUpperCase();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(brand, 28, 40);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
    const modelText = dev.name.replace(new RegExp(brand, 'i'), '').trim();
    ctx.fillText(modelText || dev.name, 28, 64);

    const kindLabels = {
      switch: ['NETWORK SWITCH', '#22d3ee'],
      'patch-panel': ['COPPER PATCH PANEL', '#f59e0b'],
      router: ['NETWORK ROUTER', '#a78bfa'],
      server: ['RACK SERVER', '#34d399']
    };
    const kindBadge = kindLabels[visualKind];
    if (kindBadge) {
      const badgeText = kindBadge[0];
      const badgeColor = kindBadge[1];
      ctx.font = 'bold 11px Consolas, monospace';
      const typeW = Math.ceil(ctx.measureText(badgeText).width) + 18;
      ctx.fillStyle = badgeColor;
      ctx.fillRect(28, 72, typeW, 20);
      ctx.fillStyle = '#071018';
      ctx.fillText(badgeText, 37, 86);
    }

    // SWITCH HOSTNAME & IP ADDRESS LABEL STRIP (P-Touch Style Bezel Label)
    const hostname = ['patch-panel', 'fiber-panel'].includes(visualKind)
      ? (dev.panelLabel || dev.name || '')
      : (dev.hostname || dev.name || '');
    const ip = dev.ipAddress || dev.ip || '';
    const mac = dev.macAddress || dev.mac || '';
    const labelMode = window.deviceLabelMode || localStorage.getItem('rack-studio-device-label-mode') || 'name';
    const labelValues = labelMode === 'all' ? [hostname, ip, mac]
      : labelMode === 'ip' ? [ip]
      : labelMode === 'mac' ? [mac]
      : labelMode === 'none' ? [] : [hostname];
    const labelText = labelValues.filter(Boolean).join(' | ');
    if (labelText) {
      // White label tape background
      const labelW = Math.min(badgeW - 24, 460);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(24, h - 40, labelW, 24);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(24, h - 40, labelW, 24);

      // Black monospace crisp label
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px Consolas, monospace';
      ctx.fillText(labelText.slice(0, 36), 30, h - 24);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px monospace';
      ctx.fillText('STATUS / ACT / PWR', 28, 90);
    }

    // --- RIGHT ZONE: PORT BANK FRAME (Aligned with 3D port meshes) ---
    if (dev.portsCount > 0) {
      const portStartX = Math.round(w * 0.31);
      const portBoxW = w - portStartX - 24;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(portStartX, 12, portBoxW, h - 24);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('PORT 1', portStartX + 12, h - 8);
      ctx.fillText('PORT ' + dev.portsCount, portStartX + portBoxW - 72, h - 8);

      const layout = getDevicePortLayout(dev);
      const numBlocks = visualKind === 'switch' ? Math.ceil(layout.primaryColumns / 12) : Math.ceil(dev.portsCount / 12);
      if (numBlocks > 1) {
        const blockW = portBoxW / numBlocks;
        for (let b = 1; b < numBlocks; b++) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.beginPath();
          ctx.moveTo(portStartX + b * blockW, 12);
          ctx.lineTo(portStartX + b * blockW, h - 12);
          ctx.stroke();
        }
      }
      if (layout.uplinks) {
        ctx.fillStyle = '#22d3ee';
        ctx.font = 'bold 10px Consolas, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`UPLINK x${layout.uplinks}`, portStartX + portBoxW - 10, 28);
        ctx.textAlign = 'left';
      }
    }

    // Drive bays for server models (in the right zone)
    if (dev.category === 'server') {
      const bayStartX = Math.round(w * 0.32);
      const bayEndX = w - 30;
      for (let x = bayStartX; x < bayEndX; x += 40) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x, 14, 34, h - 28);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, 14, 34, h - 28);

        ctx.fillStyle = '#0284c7';
        ctx.fillRect(x + 2, h - 22, 30, 4);

        ctx.fillStyle = '#22c55e';
        ctx.fillRect(x + 4, 18, 4, 4);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 16;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    return tex;
  }

export {
  createFloorTexture,
  createRailTexture,
  createFaceplateTexture
};
