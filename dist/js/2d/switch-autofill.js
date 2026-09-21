/**
 * Cisco Enterprise Rack & Cabling Studio - Switch AutoFill & Bulk Colorization Module
 * Handles automated smart patch cord provisioning between switches and patch panels
 * with sequential domino animations, sound effects, and bulk cable color customization.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  const STATE = RS.STATE;
  const dom = RS.dom;
  const HARDWARE_CATALOG = RS.HARDWARE_CATALOG;

  const getActiveRack = () => (RS.getActiveRack ? RS.getActiveRack() : RS.STATE?.racks?.[0]);
  const escapeHtml = (val) => RS.escapeHtml ? RS.escapeHtml(val) : String(val ?? '');
  const showTemporaryTooltip = (...args) => RS.showTemporaryTooltip && RS.showTemporaryTooltip(...args);
  const renderMountedDevices = () => RS.renderMountedDevices && RS.renderMountedDevices();
  const renderScheduleTable = () => RS.renderScheduleTable && RS.renderScheduleTable();
  const renderAllCables = () => RS.renderAllCables && RS.renderAllCables();
  const getNextCableId = () => (RS.getNextCableId ? RS.getNextCableId() : 'cable-' + Date.now());

  function bulkColorizeSwitchCables(instanceId, newColor) {
    if (!instanceId || !newColor) return 0;
    const targetCables = (STATE.cables || []).filter(c =>
      (c.from && c.from.instanceId === instanceId) || (c.to && c.to.instanceId === instanceId)
    );
    if (!targetCables.length) return 0;

    targetCables.forEach(c => {
      c.color = newColor;
    });

    renderAllCables();
    renderScheduleTable();

    if (dom.connectionStatusHint) {
      dom.connectionStatusHint.innerHTML = `<span style="color:${escapeHtml(newColor)}; font-weight:700;">🎨 ${targetCables.length} kablo rengi güncellendi (${escapeHtml(newColor)}).</span>`;
      setTimeout(() => {
        if (dom.connectionStatusHint && !STATE.pendingConnection) {
          dom.connectionStatusHint.innerHTML = 'Bağlamak için <b>Kaynak Porta</b> tıklayın';
        }
      }, 3000);
    }

    if (window.__STUDIO3D__ && window.is3DMode && typeof window.__STUDIO3D__.syncCables === 'function') {
      window.__STUDIO3D__.syncCables(STATE.cables);
    }

    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
    return targetCables.length;
  }

  function openSwitchBulkColorPopover(triggerBtn, instanceId) {
    document.querySelectorAll('.switch-bulk-color-popover, .role-picker-popover').forEach(p => p.remove());

    const allDevices = STATE.racks ? STATE.racks.flatMap(r => r.devices || []) : [];
    const dev = allDevices.find(d => d.instanceId === instanceId);
    const cat = dev ? HARDWARE_CATALOG[dev.catalogKey] : null;
    const devName = dev?.panelLabel ? `Panel ${dev.panelLabel}` : (dev?.hostname || cat?.modelTag || cat?.name || 'Cihaz');

    const swCables = (STATE.cables || []).filter(c =>
      (c.from && c.from.instanceId === instanceId) || (c.to && c.to.instanceId === instanceId)
    );

    const popover = document.createElement('div');
    popover.className = 'switch-bulk-color-popover';

    const colors = [
      { hex: '#0070d2', label: 'Cisco Mavi', role: 'Cat6 Data' },
      { hex: '#00d2ff', label: 'Neon Cyan', role: 'Uplink' },
      { hex: '#10b981', label: 'Zümrüt Yeşil', role: 'MGMT / Güvenlik' },
      { hex: '#f59e0b', label: 'Kehribar Turuncu', role: 'PoE / AP' },
      { hex: '#ef4444', label: 'Sinyal Kırmızı', role: 'Kritik / DMZ' },
      { hex: '#7c3aed', label: 'Elektrik Mor', role: '802.1Q Trunk' },
      { hex: '#ec4899', label: 'Canlı Pembe', role: 'Wi-Fi Trunk' },
      { hex: '#facc15', label: 'Fiber Sarı', role: 'Single-Mode LC' },
      { hex: '#06b6d4', label: 'Aqua Camgöbeği', role: 'OM4 Multi-Mode' },
      { hex: '#64748b', label: 'Çelik Gri', role: 'Standart Hat' },
      { hex: '#f8fafc', label: 'Temiz Beyaz', role: 'Yedek Hat' },
      { hex: '#1e293b', label: 'Koyu Grafit', role: 'Konsol / L2' },
    ];

    const swatchesHtml = colors.map(c => `
      <button type="button" class="bulk-color-swatch" data-color="${c.hex}" title="${escapeHtml(c.label)} (${escapeHtml(c.role)})" style="--swatch-color: ${c.hex};">
        <span class="swatch-circle" style="background: ${c.hex};"></span>
        <span class="swatch-name">${escapeHtml(c.label)}</span>
      </button>
    `).join('');

    popover.innerHTML = `
      <div class="bulk-color-header">
        <div class="bulk-color-title-group">
          <span class="bulk-color-icon">🎨</span>
          <div class="bulk-color-text">
            <div class="bulk-color-title">${escapeHtml(devName)}</div>
            <div class="bulk-color-subtitle">Tüm Kabloları Renklendir (${swCables.length} Bağlantı)</div>
          </div>
        </div>
        <button type="button" class="bulk-color-close" title="Kapat">✕</button>
      </div>
      <div class="bulk-color-grid">
        ${swatchesHtml}
      </div>
      <div class="bulk-color-custom-row">
        <label for="switch-custom-color-input" class="bulk-color-custom-label">Özel Renk:</label>
        <div class="bulk-color-custom-input-wrap">
          <input type="color" id="switch-custom-color-input" class="bulk-color-native-picker" value="#00d2ff">
          <span class="bulk-color-hex-display">#00D2FF</span>
          <button type="button" class="bulk-color-apply-btn">Uygula</button>
        </div>
      </div>
    `;

    document.body.appendChild(popover);

    // Positioning
    const rect = triggerBtn.getBoundingClientRect();
    let top = rect.bottom + 6;
    let left = rect.left;

    if (left + 270 > window.innerWidth) {
      left = window.innerWidth - 280;
    }
    if (top + 280 > window.innerHeight && rect.top > 290) {
      top = rect.top - 280;
    }
    top = Math.max(10, Math.min(top, window.innerHeight - 290));
    left = Math.max(10, Math.min(left, window.innerWidth - 280));

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;

    // Events
    popover.querySelector('.bulk-color-close').addEventListener('click', (e) => {
      e.stopPropagation();
      popover.remove();
    });

    popover.querySelectorAll('.bulk-color-swatch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = btn.dataset.color;
        bulkColorizeSwitchCables(instanceId, color);
        popover.remove();
      });
    });

    const customInput = popover.querySelector('.bulk-color-native-picker');
    const hexDisplay = popover.querySelector('.bulk-color-hex-display');
    const applyBtn = popover.querySelector('.bulk-color-apply-btn');

    if (customInput && hexDisplay) {
      customInput.addEventListener('input', () => {
        hexDisplay.textContent = customInput.value.toUpperCase();
      });
    }

    if (applyBtn && customInput) {
      applyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        bulkColorizeSwitchCables(instanceId, customInput.value);
        popover.remove();
      });
    }

    const outsideClick = (e) => {
      if (!popover.contains(e.target) && e.target !== triggerBtn) {
        popover.remove();
        document.removeEventListener('click', outsideClick);
      }
    };
    setTimeout(() => document.addEventListener('click', outsideClick), 0);
  }

  // --- SWITCH-BASED SMART AUTO-FILL (SEQUENTIAL DOMINO PATCHING) ---
  let activeAutoPatchTimer = null;
  let activeAutoPatchUsesPixiTransaction = false;

  function undoAutoPatch(batchId) {
    if (!batchId) return;
    const initialCount = (STATE.cables || []).length;
    STATE.cables = (STATE.cables || []).filter(c => c.batchId !== batchId);
    const removedCount = initialCount - STATE.cables.length;

    if (removedCount > 0) {
      if (window.SoundFX && typeof window.SoundFX.playCableCut === 'function') {
        window.SoundFX.playCableCut();
      }
      renderMountedDevices();
      renderScheduleTable();
      renderAllCables();
      if (RS.updateRackHeaderTelemetry) {
        RS.updateRackHeaderTelemetry();
      }
      document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
      document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
      window.dispatchEvent(new CustomEvent('rackstudio:change', { detail: { immediate: true } }));
      window.dispatchEvent(new CustomEvent('rackstudio:refresh'));

      showTemporaryTooltip(window.innerWidth / 2, 80, `↩ ${removedCount} adet otomatik bağlantı söküldü / geri alındı.`);
    }
  }

  function showAutoPatchSuccessToast(options) {
    document.querySelectorAll('.autofill-toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'autofill-toast';
    toast.innerHTML = `
      <div class="autofill-toast-icon">⚡</div>
      <div class="autofill-toast-body">
        <div class="autofill-toast-title">OTOMATİK KABLOLAMA TAMAMLANDI</div>
        <div class="autofill-toast-msg"><strong>${escapeHtml(options.srcName)}</strong> &rarr; <strong>${escapeHtml(options.tgtName)}</strong> (${options.count} Port Bağlandı)</div>
      </div>
      <button type="button" class="autofill-toast-undo" title="Bu bağlantı kümesini geri al / sök">↩ Geri Al</button>
      <button type="button" class="autofill-toast-close" title="Kapat">✕</button>
    `;

    document.body.appendChild(toast);

    const closeToast = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px)';
      setTimeout(() => toast.remove(), 200);
    };

    toast.querySelector('.autofill-toast-close').addEventListener('click', closeToast);
    toast.querySelector('.autofill-toast-undo').addEventListener('click', () => {
      closeToast();
      undoAutoPatch(options.batchId);
    });

    setTimeout(() => {
      if (toast.isConnected) closeToast();
    }, 7000);
  }

  function openSwitchAutoFillPopover(triggerBtn, instanceId) {
    document.querySelectorAll('.switch-autofill-popover, .switch-bulk-color-popover, .role-picker-popover').forEach(p => p.remove());

    const allDevices = STATE.racks ? STATE.racks.flatMap(r => r.devices || []) : [];
    const dev = allDevices.find(d => d.instanceId === instanceId);
    if (!dev) return;

    const rack = (STATE.racks || []).find(r => (r.devices || []).some(d => d.instanceId === instanceId)) || getActiveRack();
    if (!rack) return;

    const cat = HARDWARE_CATALOG[dev.catalogKey];
    if (!cat || !Array.isArray(cat.ports)) return;

    const swName = dev.hostname || dev.name || cat.modelTag || cat.name || 'Switch';
    const swU = Number(dev.uSlot || dev.topU || 1);

    // Compute occupied port keys
    const occupiedSet = new Set();
    (STATE.cables || []).forEach(c => {
      if (c.from) occupiedSet.add(`${c.from.instanceId}::${c.from.portId}`);
      if (c.to) occupiedSet.add(`${c.to.instanceId}::${c.to.portId}`);
    });

    const isUplinkPort = (p) => {
      if (!p) return false;
      if (p.type === 'sfp' || p.type === 'sfp+' || p.type === 'qsfp28') return true;
      const name = String(p.name || p.id || '').toLowerCase();
      return name.includes('up') || name.includes('te') || name.includes('twe') || name.includes('fo') || name.includes('uplink');
    };

    const hasCopperPorts = cat.ports.some(p => p.type === 'rj45');
    const hasUplinkPorts = cat.ports.some(isUplinkPort);

    // Filter available patch panel candidates in the same rack
    const candidates = [];
    (rack.devices || []).forEach(pDev => {
      if (pDev.instanceId === dev.instanceId) return;
      const pCat = HARDWARE_CATALOG[pDev.catalogKey];
      if (!pCat || !Array.isArray(pCat.ports)) return;

      const isCopperPanel = pCat.category === 'patch';
      const isFiberPanel = pCat.category === 'fiber';

      // Match media category
      if (hasCopperPorts) {
        if (!isCopperPanel && !isFiberPanel) return;
      } else {
        if (!isFiberPanel) return;
      }

      const pU = Number(pDev.uSlot || pDev.topU || 1);
      const distanceU = Math.abs(swU - pU);
      const freePorts = pCat.ports.filter(p => !occupiedSet.has(`${pDev.instanceId}::${p.id}`));
      const panelName = pDev.panelLabel ? `Panel ${pDev.panelLabel}` : (pDev.name || pCat.modelTag || pCat.name || 'Patch Panel');

      candidates.push({
        device: pDev,
        catalog: pCat,
        distanceU,
        freePorts,
        totalPorts: pCat.ports.length,
        name: panelName,
        uSlot: pU,
        isFiber: isFiberPanel
      });
    });

    // Sort: panels with free ports first, then closest U distance, then higher capacity
    candidates.sort((a, b) => {
      const aHas = a.freePorts.length > 0 ? 1 : 0;
      const bHas = b.freePorts.length > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      if (a.distanceU !== b.distanceU) return a.distanceU - b.distanceU;
      return b.freePorts.length - a.freePorts.length;
    });

    const popover = document.createElement('div');
    popover.className = 'switch-autofill-popover';

    const positionPopover = (pop) => {
      const rect = triggerBtn.getBoundingClientRect();
      let top = rect.bottom + 6;
      let left = rect.left - 120;

      if (left + 330 > window.innerWidth) {
        left = window.innerWidth - 340;
      }
      if (left < 10) left = 10;
      if (top + 280 > window.innerHeight && rect.top > 290) {
        top = rect.top - 280;
      }
      top = Math.max(10, Math.min(top, window.innerHeight - 290));

      pop.style.top = `${Math.round(top)}px`;
      pop.style.left = `${Math.round(left)}px`;
    };

    const setupOutsideClick = (pop) => {
      const outsideClick = (e) => {
        if (!pop.contains(e.target) && e.target !== triggerBtn) {
          pop.remove();
          document.removeEventListener('click', outsideClick);
        }
      };
      setTimeout(() => document.addEventListener('click', outsideClick), 0);
    };

    if (candidates.length === 0) {
      popover.innerHTML = `
        <div class="autofill-pop-header">
          <div class="autofill-pop-title-group">
            <span class="autofill-pop-icon">⚡</span>
            <div class="autofill-pop-title">OTOMATİK KABLOLAMA</div>
          </div>
          <button type="button" class="autofill-pop-close" title="Kapat">✕</button>
        </div>
        <div style="font-size:11.5px; color:#cbd5e1; line-height:1.5; margin-bottom:12px;">
          Bu kabinde (<strong>${escapeHtml(rack.name)}</strong>) uygun bir <strong>Patch Panel</strong> bulunamadı.
          <br><br>
          Lütfen kütüphaneden bir Cat6 Patch Panel veya ODF Fiber Panel ekleyin.
        </div>
        <div class="autofill-pop-actions">
          <button type="button" class="autofill-pop-btn-cancel">Tamam</button>
        </div>
      `;
      document.body.appendChild(popover);
      positionPopover(popover);
      popover.querySelector('.autofill-pop-close').addEventListener('click', () => popover.remove());
      popover.querySelector('.autofill-pop-btn-cancel').addEventListener('click', () => popover.remove());
      setupOutsideClick(popover);
      return;
    }

    const optionsHtml = candidates.map((c, i) => {
      const isRec = i === 0 && c.freePorts.length > 0;
      const badge = isRec ? ' ✨ Önerilen' : '';
      const status = c.freePorts.length === 0 ? ' (DOLU)' : ` (${c.freePorts.length} Boş Port)`;
      return `<option value="${c.device.instanceId}" ${c.freePorts.length === 0 ? 'disabled' : ''}>U${c.uSlot} - ${escapeHtml(c.name)}${status}, Δ${c.distanceU}U${badge}</option>`;
    }).join('');

    popover.innerHTML = `
      <div class="autofill-pop-header">
        <div class="autofill-pop-title-group">
          <span class="autofill-pop-icon">⚡</span>
          <div>
            <div class="autofill-pop-title">OTOMATİK KABLOLAMA</div>
            <div class="autofill-pop-subtitle">${escapeHtml(swName)} (U${swU})</div>
          </div>
        </div>
        <button type="button" class="autofill-pop-close" title="Kapat">✕</button>
      </div>

      <div class="autofill-pop-field">
        <label for="autofill-target-select" class="autofill-pop-label">Hedef Patch Panel:</label>
        <select id="autofill-target-select" class="autofill-pop-select">
          ${optionsHtml}
        </select>
      </div>

      <div class="autofill-pop-field">
        ${(hasCopperPorts && hasUplinkPorts) ? `
          <label class="autofill-pop-checkbox-row">
            <input type="checkbox" id="autofill-exclude-uplinks" checked>
            <span>SFP Uplink portlarını hariç tut (Yalnızca RJ45)</span>
          </label>
        ` : ''}
        <label class="autofill-pop-checkbox-row">
          <input type="checkbox" id="autofill-inherit-roles" checked>
          <span>Port rol ve konfigürasyon renklerini koru</span>
        </label>
      </div>

      <div class="autofill-pop-summary">
        <span>⚡</span>
        <span id="autofill-summary-text">Hesaplanıyor...</span>
      </div>

      <div class="autofill-pop-actions">
        <button type="button" class="autofill-pop-btn-cancel">İptal</button>
        <button type="button" id="autofill-submit-btn" class="autofill-pop-btn-submit">
          <span>⚡</span> <span id="autofill-btn-label">Sırayla Bağla</span>
        </button>
      </div>
    `;

    document.body.appendChild(popover);
    positionPopover(popover);

    const targetSelect = popover.querySelector('#autofill-target-select');
    const excludeUplinksCb = popover.querySelector('#autofill-exclude-uplinks');
    const inheritRolesCb = popover.querySelector('#autofill-inherit-roles');
    const summaryText = popover.querySelector('#autofill-summary-text');
    const submitBtn = popover.querySelector('#autofill-submit-btn');
    const btnLabel = popover.querySelector('#autofill-btn-label');

    function calculatePairs() {
      const selectedTgtId = targetSelect.value;
      const targetCandidate = candidates.find(c => c.device.instanceId === selectedTgtId);
      if (!targetCandidate || targetCandidate.freePorts.length === 0) {
        summaryText.innerHTML = '<span style="color:#ef4444;">Seçili panelde boş port bulunmuyor.</span>';
        submitBtn.disabled = true;
        btnLabel.textContent = 'Bağlantı Yok';
        return { targetDevice: null, pairs: [] };
      }

      const excludeUplinks = excludeUplinksCb ? excludeUplinksCb.checked : false;
      const inheritRoles = inheritRolesCb ? inheritRolesCb.checked : true;

      // Filter switch free ports
      const swFreePorts = cat.ports.filter(p => {
        if (p.type === 'power') return false;
        if (occupiedSet.has(`${dev.instanceId}::${p.id}`)) return false;
        if (excludeUplinks && isUplinkPort(p)) return false;
        // If target is copper patch panel, require copper port
        if (!targetCandidate.isFiber && p.type !== 'rj45') return false;
        // If target is fiber panel, require optic port
        if (targetCandidate.isFiber && p.type === 'rj45') return false;
        return true;
      });

      if (swFreePorts.length === 0) {
        summaryText.innerHTML = '<span style="color:#f59e0b;">Switch üzerinde bağlanacak uygun boş port kalmadı.</span>';
        submitBtn.disabled = true;
        btnLabel.textContent = 'Port Yok';
        return { targetDevice: null, pairs: [] };
      }

      const count = Math.min(swFreePorts.length, targetCandidate.freePorts.length);
      const ROLE_DEFAULT_COLORS = {
        trunk: '#7c3aed',
        uplink: '#00d2ff',
        'trunk-ap': '#ec4899',
        routed: '#b91c1c',
        mgmt: '#059669',
        management: '#059669',
        access: '#38bdf8',
        poe: '#f59e0b',
        fiber: '#facc15'
      };

      const pairs = [];
      for (let i = 0; i < count; i++) {
        const srcP = swFreePorts[i];
        const tgtP = targetCandidate.freePorts[i];

        const cfg = dev.portsConfig ? (dev.portsConfig[srcP.id] || dev.portsConfig[String(srcP.id).replace(/\D+/g, '')]) : null;
        let color = STATE.selectedCableColor || '#0070d2';
        let role = 'access';
        let isTrunk = false;

        if (inheritRoles && cfg) {
          role = cfg.role || (cfg.isTrunk ? 'trunk' : 'access');
          isTrunk = role === 'trunk' || role === 'uplink' || !!cfg.isTrunk;
          color = cfg.color || ROLE_DEFAULT_COLORS[role] || (targetCandidate.isFiber ? '#facc15' : color);
        } else if (targetCandidate.isFiber) {
          color = '#facc15';
          role = 'fiber';
        }

        pairs.push({
          srcPort: srcP,
          tgtPort: tgtP,
          color,
          role,
          isTrunk
        });
      }

      const mediaName = targetCandidate.isFiber ? 'Fiber Optik' : 'Cat6';
      summaryText.innerHTML = `<strong>${count} adet ${mediaName} kablo</strong> sırayla bağlanacaktır.`;
      submitBtn.disabled = count === 0;
      btnLabel.textContent = `${count} Kabloyu Sırayla Bağla`;

      return {
        targetDevice: targetCandidate.device,
        pairs
      };
    }

    calculatePairs();

    targetSelect.addEventListener('change', calculatePairs);
    if (excludeUplinksCb) excludeUplinksCb.addEventListener('change', calculatePairs);
    if (inheritRolesCb) inheritRolesCb.addEventListener('change', calculatePairs);

    submitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const res = calculatePairs();
      if (!res || !res.pairs || res.pairs.length === 0) return;

      popover.remove();
      runSequentialAutoPatch({
        rackId: rack.id,
        srcDev: dev,
        tgtDev: res.targetDevice,
        portPairs: res.pairs,
        batchId: 'autofill-' + Date.now()
      });
    });

    popover.querySelector('.autofill-pop-close').addEventListener('click', () => popover.remove());
    popover.querySelector('.autofill-pop-btn-cancel').addEventListener('click', () => popover.remove());
    setupOutsideClick(popover);
  }

  function runSequentialAutoPatch(options) {
    const { rackId, srcDev, tgtDev, portPairs, batchId } = options;
    if (!portPairs || portPairs.length === 0) return;

    if (activeAutoPatchTimer) {
      clearInterval(activeAutoPatchTimer);
      activeAutoPatchTimer = null;
      if (activeAutoPatchUsesPixiTransaction) RS.endPixiCableTransaction?.();
      activeAutoPatchUsesPixiTransaction = false;
    }

    activeAutoPatchUsesPixiTransaction = STATE.cableRenderMode === 'pixi'
      && typeof RS.beginPixiCableTransaction === 'function'
      && typeof RS.endPixiCableTransaction === 'function';
    if (activeAutoPatchUsesPixiTransaction) RS.beginPixiCableTransaction();

    if (dom.connectionStatusHint) {
      dom.connectionStatusHint.innerHTML = `<span style="color:#38bdf8; font-weight:600;">⚡ Otomatik kablolama: 0/${portPairs.length} port...</span>`;
    }

    let idx = 0;
    const stepDelay = 45; // ~45ms per cable: fast, rhythmic, domino effect

    activeAutoPatchTimer = setInterval(() => {
      if (idx >= portPairs.length) {
        clearInterval(activeAutoPatchTimer);
        activeAutoPatchTimer = null;

        const completedPixiTransaction = activeAutoPatchUsesPixiTransaction;
        if (completedPixiTransaction) {
          RS.endPixiCableTransaction();
          activeAutoPatchUsesPixiTransaction = false;
        }

        renderMountedDevices();
        renderScheduleTable();
        if (!completedPixiTransaction) renderAllCables();

        if (RS.updateRackHeaderTelemetry) {
          RS.updateRackHeaderTelemetry(rackId);
        }
        if (dom.connectionStatusHint) {
          dom.connectionStatusHint.innerHTML = 'Bağlamak için <b>Kaynak Porta</b> tıklayın';
        }

        // Persist change
        document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
        document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
        window.dispatchEvent(new CustomEvent('rackstudio:change', { detail: { immediate: true } }));
        window.dispatchEvent(new CustomEvent('rackstudio:refresh'));

        showAutoPatchSuccessToast({
          count: portPairs.length,
          srcName: srcDev.hostname || srcDev.name || 'Switch',
          tgtName: tgtDev.panelLabel ? `Panel ${tgtDev.panelLabel}` : (tgtDev.name || 'Patch Panel'),
          batchId
        });
        return;
      }

      const pair = portPairs[idx];
      const cableId = getNextCableId();
      const cable = {
        id: cableId,
        batchId: batchId,
        from: {
          rackId: rackId,
          instanceId: srcDev.instanceId,
          portId: pair.srcPort.id
        },
        to: {
          rackId: rackId,
          instanceId: tgtDev.instanceId,
          portId: pair.tgtPort.id
        },
        color: pair.color,
        role: pair.role,
        isTrunk: pair.isTrunk,
        name: `${srcDev.name || srcDev.hostname || 'SW'} ${pair.srcPort.name || pair.srcPort.id} ➔ ${tgtDev.name || tgtDev.panelLabel || 'Panel'} ${pair.tgtPort.name || pair.tgtPort.id}`
      };

      STATE.cables.push(cable);

      // Play authentic port click sound
      if (window.SoundFX && typeof window.SoundFX.playPortClick === 'function') {
        window.SoundFX.playPortClick(pair.srcPort.type || 'copper');
      }

      // Mark ports as occupied in DOM
      const srcEl = document.querySelector(`.port[data-instance-id="${srcDev.instanceId}"][data-port-id="${pair.srcPort.id}"]`);
      const tgtEl = document.querySelector(`.port[data-instance-id="${tgtDev.instanceId}"][data-port-id="${pair.tgtPort.id}"]`);
      if (srcEl) srcEl.classList.add('occupied');
      if (tgtEl) tgtEl.classList.add('occupied');

      if (RS.appendSingleCable) {
        RS.appendSingleCable(cable);
      } else {
        renderAllCables();
      }

      idx++;
      if (activeAutoPatchUsesPixiTransaction && idx % 3 === 0) {
        RS.flushPixiCableTransaction?.();
      }
      if (dom.connectionStatusHint) {
        dom.connectionStatusHint.innerHTML = `<span style="color:#38bdf8; font-weight:600;">⚡ Otomatik kablolama: <b>${idx}/${portPairs.length}</b> port bağlandı...</span>`;
      }
    }, stepDelay);
  }

  RS.bulkColorizeSwitchCables = bulkColorizeSwitchCables;
  RS.openSwitchBulkColorPopover = openSwitchBulkColorPopover;
  RS.openSwitchAutoFillPopover = openSwitchAutoFillPopover;
  RS.undoAutoPatch = undoAutoPatch;
  RS.runSequentialAutoPatch = runSequentialAutoPatch;
  RS.showAutoPatchSuccessToast = showAutoPatchSuccessToast;
})();
