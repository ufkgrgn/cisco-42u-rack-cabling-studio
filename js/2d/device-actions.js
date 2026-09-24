/**
 * Cisco Enterprise Rack & Cabling Studio - Device Actions Module
 * Handles mounting, removal, metadata update, bulk clearing of cables/devices,
 * and related confirmation dialogs/modals/toasts.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  const STATE = RS.STATE;
  const HARDWARE_CATALOG = RS.HARDWARE_CATALOG;

  const getActiveRack = () => (RS.getActiveRack ? RS.getActiveRack() : RS.STATE?.racks?.[0]);
  const escapeHtml = (val) => RS.escapeHtml ? RS.escapeHtml(val) : String(val ?? '');
  const showTemporaryTooltip = (...args) => RS.showTemporaryTooltip && RS.showTemporaryTooltip(...args);
  const cancelPendingConnection = () => RS.cancelPendingConnection && RS.cancelPendingConnection();
  const renderMountedDevices = () => RS.renderMountedDevices && RS.renderMountedDevices();
  const renderScheduleTable = () => RS.renderScheduleTable && RS.renderScheduleTable();
  const renderAllCables = () => RS.renderAllCables && RS.renderAllCables();
  const refreshCableScene = removedCableIds => {
    RS.setPixiCableHover?.(null, false);
    RS.invalidatePixiCableGeometry?.(removedCableIds);
    renderAllCables();
  };
  const renderRackTabs = () => RS.renderRackTabs && RS.renderRackTabs();
  const updateRackHeaderTelemetry = (...args) => RS.updateRackHeaderTelemetry && RS.updateRackHeaderTelemetry(...args);

  const resolveCatalogItem = (key) => {
    if (!key || typeof key !== 'string') return null;
    const cleanKey = key.trim();
    const lowerKey = cleanKey.toLowerCase();
    const noPrefix = lowerKey.replace(/^cisco-m-/, '').replace(/^cisco-/, '');
    const withPrefix = 'cisco-m-' + noPrefix;

    // 1. Direct key lookups across primary catalogs
    const direct = (HARDWARE_CATALOG && (HARDWARE_CATALOG[cleanKey] || HARDWARE_CATALOG[lowerKey] || HARDWARE_CATALOG[withPrefix])) ||
                   (RS.catalog && (RS.catalog[cleanKey] || RS.catalog[lowerKey] || RS.catalog[withPrefix])) ||
                   (STATE && STATE.customCatalog && (STATE.customCatalog[cleanKey] || STATE.customCatalog[lowerKey])) ||
                   null;
    if (direct) return direct;

    // 2. Lookup in CISCO_MASTER_CATALOG (array or object) by id or modelTag
    const masterList = Array.isArray(window.CISCO_MASTER_CATALOG)
      ? window.CISCO_MASTER_CATALOG
      : (Array.isArray(RS.CISCO_MASTER_CATALOG) ? RS.CISCO_MASTER_CATALOG : null);

    if (masterList) {
      const match = masterList.find(m => {
        if (!m) return false;
        if (m.id === cleanKey || m.id?.toLowerCase() === lowerKey || m.id === withPrefix) return true;
        if (m.modelTag && m.modelTag.toLowerCase() === lowerKey) return true;
        if (m.modelTag && m.modelTag.toLowerCase().replace(/[^a-z0-9]/g, '') === lowerKey.replace(/[^a-z0-9]/g, '')) return true;
        return false;
      });
      if (match) return match;
    } else {
      const masterDict = window.CISCO_MASTER_CATALOG || RS.CISCO_MASTER_CATALOG;
      if (masterDict && (masterDict[cleanKey] || masterDict[lowerKey] || masterDict[withPrefix])) {
        return masterDict[cleanKey] || masterDict[lowerKey] || masterDict[withPrefix];
      }
    }

    // 3. Fallback scan HARDWARE_CATALOG by modelTag
    if (HARDWARE_CATALOG) {
      for (const k in HARDWARE_CATALOG) {
        const item = HARDWARE_CATALOG[k];
        if (item && item.modelTag && (
          item.modelTag.toLowerCase() === lowerKey ||
          item.modelTag.toLowerCase().replace(/[^a-z0-9]/g, '') === lowerKey.replace(/[^a-z0-9]/g, '')
        )) {
          return item;
        }
      }
    }

    return null;
  };
  RS.resolveCatalogItem = resolveCatalogItem;

  function mountDeviceAt(arg1, arg2, arg3, silent = false) {
    let catalogKey = arg1;
    let topU = Number(arg2);
    let targetRackId = arg3;

    // Support swapped signature: mountDeviceAt(rackId, topU, catalogKey, silent)
    if (typeof arg1 === 'string' && STATE.racks?.some(r => r.id === arg1)) {
      if (typeof arg3 === 'string' && !STATE.racks?.some(r => r.id === arg3)) {
        targetRackId = arg1;
        catalogKey = arg3;
      }
    }

    const cat = resolveCatalogItem(catalogKey);
    if (!cat) return null;
    const targetRack = targetRackId ? (STATE.racks?.find(r => r.id === targetRackId) || getActiveRack()) : getActiveRack();
    if (!targetRack) return null;

    const endU = topU - cat.u + 1;
    if (!Number.isInteger(topU) || !Number.isInteger(cat.u) || cat.u < 1 || endU < 1 || topU > (targetRack.heightU || 42)) return null;
    if (targetRack.devices.some(d => topU >= d.topU - d.uHeight + 1 && endU <= d.topU)) return null;
    const instanceId = 'dev-' + Math.random().toString(36).substring(2, 9);
    for (let u = endU; u <= topU; u++) {
      targetRack.units[u] = instanceId;
    }
    const devObj = {
      instanceId,
      catalogKey: cat.id || catalogKey,
      topU,
      uHeight: cat.u
    };
    targetRack.devices.push(devObj);
    if (STATE.deviceById) STATE.deviceById.set(instanceId, devObj);
    if (window.SoundFX && !silent && !STATE.isBatchLoading && !window.SoundFX.isBatchMuted) {
      window.SoundFX.playDeviceMount();
    }
    return devObj;
  }

  function removeDevice(instanceId) {
    const targetRack = (STATE.racks && STATE.racks.find(r => r.devices && r.devices.some(d => d.instanceId === instanceId))) || getActiveRack();
    if (!targetRack) return;

    if (window.SoundFX) window.SoundFX.playCableCut();
    const removedCableIds = (STATE.cables || [])
      .filter(c => c.from?.instanceId === instanceId || c.to?.instanceId === instanceId)
      .map(c => c.id);
    STATE.cables = (STATE.cables || []).filter(c => c.from?.instanceId !== instanceId && c.to?.instanceId !== instanceId);

    if (STATE.deviceById) STATE.deviceById.delete(instanceId);
    if (targetRack.devices) {
      targetRack.devices = targetRack.devices.filter(d => d.instanceId !== instanceId);
      targetRack.units = Array((targetRack.heightU || 42) + 1).fill(null);
      targetRack.devices.forEach(d => {
        for (let u = d.topU - d.uHeight + 1; u <= d.topU; u++) {
          if (u > 0 && u <= (targetRack.heightU || 42)) {
            targetRack.units[u] = d.instanceId;
          }
        }
      });
    }

    if (STATE.pendingConnection && STATE.pendingConnection.instanceId === instanceId) {
      cancelPendingConnection();
    }

    RS.DeviceSceneRegistry?.pruneDevice?.(instanceId);

    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    refreshCableScene(removedCableIds);

    if (window.__STUDIO3D__ && window.is3DMode && typeof window.__STUDIO3D__.removeDevice === 'function') {
      try { window.__STUDIO3D__.removeDevice(instanceId); } catch (_) {}
    }

    // CRITICAL: Dispatch change & refresh events for persistence (editor.js, indexedDB, localStorage)
    document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
    document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
    window.dispatchEvent(new CustomEvent('rackstudio:change', { detail: { immediate: true } }));
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
  }

  function updateDeviceMetadata(instanceId, metadata) {
    const rack = STATE.racks.find(item => item.devices.some(dev => dev.instanceId === instanceId));
    const dev = rack && rack.devices.find(item => item.instanceId === instanceId);
    if (!dev) return false;
    dev.name = String(metadata.name || '').trim();
    dev.hostname = dev.name;
    dev.ipAddress = String(metadata.ipAddress || '').trim();
    dev.macAddress = String(metadata.macAddress || '').trim();
    dev.serialNumber = String(metadata.serialNumber || '').trim();
    dev.panelLabel = String(metadata.panelLabel || '').trim();
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
    return true;
  }

  function clearRackCables(rackId, targetBtn) {
    const rack = (STATE.racks && STATE.racks.find(r => r.id === rackId)) || getActiveRack();
    if (!rack) return;
    const devIds = new Set((rack.devices || []).map(d => d.instanceId));
    const rackCables = (STATE.cables || []).filter(c => devIds.has(c.from?.instanceId) || devIds.has(c.to?.instanceId));
    if (rackCables.length === 0) {
      if (targetBtn) {
        const rect = targetBtn.getBoundingClientRect();
        showTemporaryTooltip(rect.left, rect.bottom + 10, `[${rack.name}] kabininde bağlı kablo bulunmuyor.`);
      } else {
        alert(`[${rack.name}] kabininde bağlı kablo bulunmuyor.`);
      }
      return;
    }

    const doClear = () => {
      if (window.SoundFX) window.SoundFX.playCableCut();
      STATE.cables = (STATE.cables || []).filter(c => !devIds.has(c.from?.instanceId) && !devIds.has(c.to?.instanceId));
      if (STATE.pendingConnection && devIds.has(STATE.pendingConnection.instanceId)) {
        cancelPendingConnection();
      }
      renderMountedDevices();
      renderScheduleTable();
      refreshCableScene(rackCables.map(cable => cable.id));
      updateRackHeaderTelemetry(rack.id);
      document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
      document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
    };

    if (targetBtn) {
      showInlineDeleteConfirm(targetBtn, rack.name, {
        title: '🧹 KABLO TEMİZLE?',
        msg: `<strong>${escapeHtml(rack.name)}</strong> kabinine bağlı <strong>${rackCables.length} adet kablo</strong> sökülecektir.`,
        confirmText: '🧹 Kabloları Sil'
      }, doClear);
    } else {
      if (confirm(`[${rack.name}] kabinindeki ${rackCables.length} adet kablo silinsin mi?`)) {
        doClear();
      }
    }
  }

  function clearRackDevices(rackId, targetBtn) {
    const rack = (STATE.racks && STATE.racks.find(r => r.id === rackId)) || getActiveRack();
    if (!rack) return;
    const devCount = (rack.devices || []).length;
    if (devCount === 0) {
      if (targetBtn) {
        const rect = targetBtn.getBoundingClientRect();
        showTemporaryTooltip(rect.left, rect.bottom + 10, `[${rack.name}] kabininde takılı cihaz bulunmuyor.`);
      } else {
        alert(`[${rack.name}] kabininde takılı cihaz bulunmuyor.`);
      }
      return;
    }

    const doClear = () => {
      if (window.SoundFX) window.SoundFX.playCableCut();
      const devIds = new Set(rack.devices.map(d => d.instanceId));
      const removedCableIds = (STATE.cables || [])
        .filter(c => devIds.has(c.from?.instanceId) || devIds.has(c.to?.instanceId))
        .map(c => c.id);
      STATE.cables = (STATE.cables || []).filter(c => !devIds.has(c.from?.instanceId) && !devIds.has(c.to?.instanceId));
      if (STATE.pendingConnection && devIds.has(STATE.pendingConnection.instanceId)) {
        cancelPendingConnection();
      }
      if (window.__STUDIO3D__ && window.is3DMode && typeof window.__STUDIO3D__.removeDevice === 'function') {
        devIds.forEach(id => {
          try { window.__STUDIO3D__.removeDevice(id); } catch (_) {}
        });
      }
      rack.devices = [];
      rack.units = Array((rack.heightU || 42) + 1).fill(null);
      devIds.forEach(id => RS.DeviceSceneRegistry?.pruneDevice?.(id));
      if (RS.rebuildStateIndexes) RS.rebuildStateIndexes();
      renderRackTabs();
      renderMountedDevices();
      renderScheduleTable();
      refreshCableScene(removedCableIds);
      updateRackHeaderTelemetry(rack.id);
      document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
      document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
    };

    if (targetBtn) {
      showInlineDeleteConfirm(targetBtn, rack.name, {
        title: '🗑️ CİHAZLARI BOŞALT?',
        msg: `<strong>${escapeHtml(rack.name)}</strong> kabinindeki <strong>${devCount} adet cihaz</strong> ve tüm kablolar kaldırılacaktır.<br><small style="color:#94a3b8;">(Kabin boşaltılacak, kabin çerçevesi silinmeyecektir)</small>`,
        confirmText: '🗑️ Cihazları Boşalt'
      }, doClear);
    } else {
      if (confirm(`[${rack.name}] kabinindeki ${devCount} adet cihaz ve bunlara bağlı tüm kablolar kaldırılsın mı?\n(Kabin boşaltılacak, kabin silinmeyecektir)`)) {
        doClear();
      }
    }
  }

  function clearDeviceCables(instanceId, targetBtn) {
    const devCables = (STATE.cables || []).filter(c => c.from?.instanceId === instanceId || c.to?.instanceId === instanceId);
    if (devCables.length === 0) return;
    const rack = STATE.racks?.find(r => r.devices && r.devices.some(d => d.instanceId === instanceId));
    const dev = rack?.devices?.find(d => d.instanceId === instanceId);
    const cat = dev ? (HARDWARE_CATALOG[dev.catalogKey] || {}) : {};
    const isPanel = cat.category === 'patch' || cat.category === 'fiber';
    const devName = dev?.hostname || dev?.name || dev?.panelLabel || cat.name || (isPanel ? 'Patch Panel' : 'Cihaz');

    const doClear = () => {
      if (window.SoundFX) window.SoundFX.playCableCut();
      STATE.cables = (STATE.cables || []).filter(c => c.from?.instanceId !== instanceId && c.to?.instanceId !== instanceId);
      if (STATE.pendingConnection && STATE.pendingConnection.instanceId === instanceId) {
        cancelPendingConnection();
      }
      renderMountedDevices();
      renderScheduleTable();
      refreshCableScene(devCables.map(cable => cable.id));
      updateRackHeaderTelemetry(rack?.id);
      document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
      document.dispatchEvent(new CustomEvent('rackstudio:refresh', { bubbles: true }));
    };

    if (targetBtn) {
      showInlineDeleteConfirm(targetBtn, devName, {
        title: '✂️ KABLOLARI TEMİZLE?',
        msg: `<strong>${escapeHtml(devName)}</strong> üzerindeki <strong>${devCables.length} adet kablo</strong> sökülecektir.`,
        confirmText: '✂️ Kabloları Sök'
      }, doClear);
    } else {
      if (confirm(`[${devName}] üzerindeki ${devCables.length} adet kablo sökülsün mü?`)) {
        doClear();
      }
    }
  }

  function showInlineDeleteConfirm(targetBtn, deviceName, optionsOrConfirm, maybeConfirm) {
    const onConfirm = typeof optionsOrConfirm === 'function' ? optionsOrConfirm : maybeConfirm;
    const options = typeof optionsOrConfirm === 'object' && optionsOrConfirm !== null ? optionsOrConfirm : {};

    document.querySelectorAll('.inline-delete-popover').forEach(el => el.remove());

    const popover = document.createElement('div');
    popover.className = 'inline-delete-popover';

    let title = options.title || '⚠️ CİHAZI SİL?';
    let msg = options.msg || `<strong>${escapeHtml(deviceName)}</strong> ve bağlı tüm kablolar kaldırılacaktır.`;
    let confirmText = options.confirmText || '✕ Sil';

    if (!options.title && !options.msg) {
      if (options.category === 'organizer') {
        title = '🗑️ DÜZENLEYİCİYİ KALDIR?';
        msg = `<strong>${escapeHtml(deviceName)}</strong> kabin yuvasından kaldırılacaktır.`;
      } else if (options.category === 'blank') {
        title = '🗑️ KÖR PANELİ KALDIR?';
        msg = `<strong>${escapeHtml(deviceName)}</strong> kabin yuvasından kaldırılacaktır.`;
      } else if (typeof options.cableCount === 'number') {
        if (options.cableCount > 0) {
          title = '⚠️ CİHAZI SİL?';
          msg = `<strong>${escapeHtml(deviceName)}</strong> ve bu cihaza bağlı <strong>${options.cableCount} kablo</strong> sökülecektir.`;
        } else {
          title = '⚠️ CİHAZI SİL?';
          msg = `<strong>${escapeHtml(deviceName)}</strong> kabinden kaldırılacaktır (bağlı kablo yok).`;
        }
      }
    }

    popover.innerHTML = `
      <div class="inline-delete-title">${title}</div>
      <div class="inline-delete-msg">${msg}</div>
      <div class="inline-delete-actions">
        <button type="button" class="inline-del-btn-cancel">İptal</button>
        <button type="button" class="inline-del-btn-confirm">${escapeHtml(confirmText)}</button>
      </div>
    `;

    document.body.appendChild(popover);

    const rect = targetBtn.getBoundingClientRect();
    const popoverWidth = 240;
    const popoverHeight = 110;

    let left = rect.left - popoverWidth - 8;
    let top = rect.top + (rect.height / 2) - (popoverHeight / 2);
    if (left < 10 || top < 20) {
      left = Math.min(Math.max(10, rect.left - popoverWidth / 2 + rect.width / 2), window.innerWidth - popoverWidth - 10);
      top = rect.bottom + 6;
    }
    if (top + popoverHeight > window.innerHeight - 10) {
      top = Math.max(10, rect.top - popoverHeight - 6);
    }

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;

    const close = () => {
      popover.remove();
      document.removeEventListener('click', onOutsideClick);
      document.removeEventListener('keydown', onKeyDown);
    };

    const onOutsideClick = (e) => {
      if (!popover.contains(e.target) && e.target !== targetBtn) {
        close();
      }
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter') {
        close();
        onConfirm();
      }
    };

    popover.querySelector('.inline-del-btn-confirm').addEventListener('click', (e) => {
      e.stopPropagation();
      close();
      onConfirm();
    });

    popover.querySelector('.inline-del-btn-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      close();
    });

    setTimeout(() => {
      document.addEventListener('click', onOutsideClick);
      document.addEventListener('keydown', onKeyDown);
    }, 20);
  }

  function showConnectionErrorToast(x, y, msg) {
    document.querySelectorAll('.connection-error-toast').forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = 'connection-error-toast';
    toast.innerHTML = `
      <div class="error-toast-icon">⛔</div>
      <div class="error-toast-body">
        <div class="error-toast-title">BAĞLANTI ENGELLENDİ</div>
        <div class="error-toast-msg">${escapeHtml(msg)}</div>
      </div>
      <button type="button" class="error-toast-close" title="Kapat">✕</button>
    `;

    document.body.appendChild(toast);

    const toastWidth = 320;
    const toastHeight = 70;
    let left = x - (toastWidth / 2);
    let top = y - toastHeight - 12;

    if (left < 10) left = 10;
    if (left + toastWidth > window.innerWidth - 10) left = window.innerWidth - toastWidth - 10;
    if (top < 10) top = y + 25;

    toast.style.left = `${left}px`;
    toast.style.top = `${top}px`;

    const close = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-6px)';
      setTimeout(() => toast.remove(), 200);
    };

    toast.querySelector('.error-toast-close').addEventListener('click', close);

    setTimeout(() => {
      if (toast.isConnected) close();
    }, 4500);
  }

  function showUplinkVisualConfirmModal(options, onDecision) {
    document.querySelectorAll('.uplink-modal-backdrop').forEach(el => el.remove());

    const backdrop = document.createElement('div');
    backdrop.className = 'uplink-modal-backdrop';

    const isSwitchToSwitch = !!(options.isSwitchToSwitch || options.disallowStandard);
    const roleName = (options.role || (isSwitchToSwitch ? 'trunk' : 'uplink')).toUpperCase();
    const isUplink = options.role === 'uplink';
    const roleColor = options.color || (isSwitchToSwitch ? '#7c3aed' : (isUplink ? '#00d2ff' : '#7c3aed'));

    const headerBadgeHtml = isSwitchToSwitch
      ? `<span style="font-size:15px;">⚡</span> SWİTCHLER ARASI BAĞLANTI (802.1Q TRUNK / ACCESS)`
      : `<span style="font-size:14px;">⚡</span> OTOMATİK ${roleName} / TRUNK ALGILANDI`;

    const descriptionHtml = isSwitchToSwitch
      ? `İki switch arasında doğrudan bağlantı algılandı. Ağ omurga bütünlüğü ve STP performansı için <b>802.1Q TRUNK</b> önerilir. İsteğe bağlı olarak standart Access bağlantısı da kurulabilir.`
      : `${escapeHtml(options.reason || 'İki switch / omurga portu arasında doğrudan bağlantı algılandı.')} Bu bağlantının ağ rolünü otomatik olarak tanımlamak istiyor musunuz?`;

    const choiceCardsHtml = isSwitchToSwitch
      ? `
        <div class="uplink-choice-card recommended" id="opt-uplink-recommend" style="border-color: rgba(124, 58, 237, 0.65); background: linear-gradient(180deg, rgba(124, 58, 237, 0.16) 0%, rgba(15, 23, 42, 0.9) 100%);">
          <span class="choice-tag" style="background: rgba(124, 58, 237, 0.25); color: #c084fc; border: 1px solid rgba(124, 58, 237, 0.5);">ÖNERİLEN OMURGA STANDARDI</span>
          <div class="choice-title" style="color:#c084fc;">✨ 802.1Q TRUNK Olarak Yapılandır</div>
          <div class="choice-desc">
            Tüm VLAN trafiği güvenle taşınır, STP / Loop koruması aktif tutulur, omurga portu rozeti atanır ve mor/neon kablo rengi uygulanır.
          </div>
        </div>
        <div class="uplink-choice-card" id="opt-uplink-standard">
          <span class="choice-tag gray">MANUEL / ACCESS</span>
          <div class="choice-title">Standart Access Olarak Bağla</div>
          <div class="choice-desc">
            Özel omurga rolü atanmaz; mevcut seçili kablo rengi ve standart erişim portu ayarları korunur.
          </div>
        </div>
      `
      : `
        <div class="uplink-choice-card recommended" id="opt-uplink-recommend">
          <span class="choice-tag cyan">ÖNERİLEN STANDART</span>
          <div class="choice-title" style="color:${roleColor};">✨ Otomatik ${roleName} Ata</div>
          <div class="choice-desc">
            802.1Q omurga port rozeti atanır, kablo ${roleName === 'UPLINK' ? 'Neon Cyan' : 'Mor'} rengine bürünür ve port konfigürasyonu kaydedilir.
          </div>
        </div>
        <div class="uplink-choice-card" id="opt-uplink-standard">
          <span class="choice-tag gray">MANUEL / ACCESS</span>
          <div class="choice-title">Standart Kablo Olarak Bağla</div>
          <div class="choice-desc">
            Özel rol veya rozet atanmaz, mevcut seçili kablo rengi ve standart erişim portu ayarları korunur.
          </div>
        </div>
      `;

    const footerButtonsHtml = isSwitchToSwitch
      ? `
        <button type="button" class="btn-secondary" id="btn-uplink-cancel">İptal</button>
        <button type="button" class="btn-secondary" id="btn-uplink-standard">Standart Access Olarak Bağla</button>
        <button type="button" class="btn-primary" id="btn-uplink-approve" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); border-color: #a855f7; box-shadow: 0 2px 14px rgba(124, 58, 237, 0.5);">✨ 802.1Q TRUNK Olarak Yapılandır</button>
      `
      : `
        <button type="button" class="btn-secondary" id="btn-uplink-cancel">İptal</button>
        <button type="button" class="btn-secondary" id="btn-uplink-standard">Standart Kablo Olarak Bağla</button>
        <button type="button" class="btn-primary" id="btn-uplink-approve">✨ ${roleName} Olarak Yapılandır</button>
      `;

    backdrop.innerHTML = `
      <div class="uplink-modal-card" role="dialog" aria-modal="true">
        <div class="uplink-modal-header" style="${isSwitchToSwitch ? 'background: rgba(45, 20, 60, 0.6);' : ''}">
          <div class="header-badge" style="${isSwitchToSwitch ? 'color: #c084fc;' : ''}">
            ${headerBadgeHtml}
          </div>
          <button type="button" class="close-btn" title="Kapat (İptal)">✕</button>
        </div>
        <div class="uplink-modal-body">
          <div class="uplink-connection-strip">
            <span>${escapeHtml(options.srcDeviceName)} (${escapeHtml(options.srcPortName)})</span>
            <span class="arrow" style="${isSwitchToSwitch ? 'color: #c084fc;' : ''}">➔</span>
            <span>${escapeHtml(options.tgtDeviceName)} (${escapeHtml(options.tgtPortName)})</span>
          </div>
          <p class="uplink-modal-desc">
            ${descriptionHtml}
          </p>
          <div class="uplink-choices-grid">
            ${choiceCardsHtml}
          </div>
        </div>
        <div class="uplink-modal-footer">
          ${footerButtonsHtml}
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    let resolved = false;
    const close = (decision) => {
      if (resolved) return;
      resolved = true;
      backdrop.remove();
      document.removeEventListener('keydown', handleKey);
      onDecision(decision);
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') close('cancel');
      if (e.key === 'Enter') close('trunk');
    };

    document.addEventListener('keydown', handleKey);

    backdrop.querySelector('.close-btn').addEventListener('click', () => close('cancel'));
    const btnCancel = backdrop.querySelector('#btn-uplink-cancel');
    if (btnCancel) btnCancel.addEventListener('click', () => close('cancel'));
    const btnStandard = backdrop.querySelector('#btn-uplink-standard');
    if (btnStandard) btnStandard.addEventListener('click', () => close('standard'));
    backdrop.querySelector('#btn-uplink-approve').addEventListener('click', () => close('trunk'));

    backdrop.querySelector('#opt-uplink-recommend').addEventListener('click', () => close('trunk'));
    const optStandard = backdrop.querySelector('#opt-uplink-standard');
    if (optStandard) optStandard.addEventListener('click', () => close('standard'));

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close('cancel');
    });
  }

  RS.mountDeviceAt = mountDeviceAt;
  RS.removeDevice = removeDevice;
  RS.updateDeviceMetadata = updateDeviceMetadata;
  RS.clearRackCables = clearRackCables;
  RS.clearRackDevices = clearRackDevices;
  RS.clearDeviceCables = clearDeviceCables;
  RS.showInlineDeleteConfirm = showInlineDeleteConfirm;
  RS.showConnectionErrorToast = showConnectionErrorToast;
  RS.showUplinkVisualConfirmModal = showUplinkVisualConfirmModal;
})();
