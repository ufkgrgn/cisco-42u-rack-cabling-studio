/**
 * 3D Catalog Drawer & Installed Devices List
 */
export function initCatalogDrawer(studio) {
    // 6. Catalog Search & Filter with Smart Auto-Slot Allocation & Unified Cisco Catalog
    const catalogList = document.getElementById('catalog-items-list');
    const searchInput = document.getElementById('catalog-search-input');
    let activeCategory = 'all';

    function getUnifiedCatalog() {
      const catalog3D = window.CATALOG_3D || [];
      const RS = window.RackStudio;
      const catalog2D = (RS && RS.HARDWARE_CATALOG) || (RS && RS.catalog) || {};

      const unified = [...catalog3D];
      const existingIds = new Set(catalog3D.map(c => c.id));

      Object.entries(catalog2D).forEach(([key, item]) => {
        if (!existingIds.has(key)) {
          existingIds.add(key);
          unified.push({
            id: key,
            name: item.name || key,
            desc: item.desc || item.name || '',
            manufacturer: item.manufacturer || item.logo || (item.category === 'patch' || item.category === 'fiber' ? 'Panel' : 'Cisco'),
            category: item.category || 'switch',
            u: item.u || item.uHeight || 1,
            depthMm: item.depthMm || 450,
            color: item.color || 0x243248,
            portsCount: Array.isArray(item.ports) ? item.ports.length : (item.portsCount || 24),
            portType: item.portType || (item.ports && item.ports[0] && item.ports[0].type) || 'rj45',
            ports: item.ports || [],
            powerWatts: item.powerWatts,
            heatBtu: item.heatBtu
          });
        }
      });
      return unified;
    }

    function renderCatalog(filterText = '') {
      if (!catalogList) return;
      catalogList.innerHTML = '';

      const norm = (s) => (s || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const query = norm(filterText);
      const allCatalogItems = getUnifiedCatalog();

      const items = allCatalogItems.filter(item => {
        const matchesCat = activeCategory === 'all' || item.category === activeCategory;
        const matchesQuery = !query || norm(item.name).includes(query) || norm(item.desc).includes(query) || norm(item.manufacturer).includes(query);
        return matchesCat && matchesQuery;
      });

      if (items.length === 0) {
        catalogList.innerHTML = '<div style="padding:16px;text-align:center;color:#64748b;font-size:12px;">Eşleşen donanım bulunamadı.</div>';
        return;
      }

      const racks = (Array.isArray(studio.state.racks) && studio.state.racks.length > 0)
        ? studio.state.racks
        : [{ id: 'rack-1', name: 'MDF - Dağıtım Kabini', heightU: studio.state.rackHeightU || 42 }];
      const hasMultiRack = racks.length > 1;

      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'catalog-card';
        let currentTargetRackId = studio.state.activeRackId || racks[0].id;
        let suggestedSlot = studio.findNextAvailableSlot(item.u, currentTargetRackId) || 1;

        const rackSelectHtml = hasMultiRack ? `
          <div style="margin-bottom:6px;display:flex;align-items:center;gap:6px;">
            <span style="font-size:11px;color:#94a3b8;white-space:nowrap;">Kabin:</span>
            <select class="rack-select-input" style="flex:1;background:#0f172a;border:1px solid #334155;color:#38bdf8;font-size:11px;border-radius:4px;padding:3px 6px;">
              ${racks.map(r => `<option value="${r.id}" ${r.id === currentTargetRackId ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>
          </div>
        ` : '';

        const targetRack = studio.getRack ? studio.getRack(currentTargetRackId) : racks[0];
        const maxU = (targetRack && targetRack.heightU) || studio.state.rackHeightU || 42;

        card.innerHTML = `
          <div class="catalog-card-header">
            <span class="catalog-card-name">${item.name}</span>
            <span class="catalog-card-u">${item.u}U</span>
          </div>
          <div class="catalog-card-desc">${item.desc}</div>
          ${rackSelectHtml}
          <div class="catalog-card-mount">
            <span style="font-size:11px;color:#94a3b8;">U Slot:</span>
            <input type="number" class="slot-input" min="1" max="${maxU - item.u + 1}" value="${suggestedSlot}" title="Montaj yapılacak U slotu (Boş olan önerilmiştir)">
            <button class="hud-btn btn-primary btn-mount" style="flex:1;justify-content:center;padding:4px 8px;font-size:11px;">
              ⚡ 3D Montaj
            </button>
          </div>
        `;

        const slotInput = card.querySelector('.slot-input');
        const mountBtn = card.querySelector('.btn-mount');
        const rackSelect = card.querySelector('.rack-select-input');

        if (rackSelect) {
          rackSelect.addEventListener('change', () => {
            currentTargetRackId = rackSelect.value;
            const newSlot = studio.findNextAvailableSlot(item.u, currentTargetRackId) || 1;
            slotInput.value = newSlot;
          });
        }

        mountBtn.addEventListener('click', () => {
          const targetU = parseInt(slotInput.value) || suggestedSlot;
          const targetRackId = rackSelect ? rackSelect.value : currentTargetRackId;
          const res = studio.mountDevice(item.id, targetU, targetRackId);
          if (res) {
            const rName = (racks.find(r => r.id === targetRackId) || {}).name || 'Kabin';
            studio.showToast(`${item.name} [${rName}] U${res.startU} pozisyonuna başarıyla monte edildi.`);
            renderCatalog(searchInput ? searchInput.value : '');
          }
        });

        catalogList.appendChild(card);
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => renderCatalog(e.target.value));
    }

    document.querySelectorAll('.cat-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeCategory = pill.dataset.category || 'all';
        renderCatalog(searchInput ? searchInput.value : '');
      });
    });

    renderCatalog();

    // 6b. Left Drawer Tabs (Catalog vs Installed Devices)
    const tabBtnCatalog = document.getElementById('tab-btn-catalog');
    const tabBtnInstalled = document.getElementById('tab-btn-installed');
    const drawerViewCatalog = document.getElementById('drawer-view-catalog');
    const drawerViewInstalled = document.getElementById('drawer-view-installed');

    if (tabBtnCatalog && tabBtnInstalled) {
      tabBtnCatalog.addEventListener('click', () => {
        tabBtnCatalog.classList.add('active');
        tabBtnInstalled.classList.remove('active');
        if (drawerViewCatalog) drawerViewCatalog.style.display = 'block';
        if (drawerViewInstalled) drawerViewInstalled.style.display = 'none';
      });

      tabBtnInstalled.addEventListener('click', () => {
        tabBtnInstalled.classList.add('active');
        tabBtnCatalog.classList.remove('active');
        if (drawerViewCatalog) drawerViewCatalog.style.display = 'none';
        if (drawerViewInstalled) drawerViewInstalled.style.display = 'block';
        renderInstalledDevicesList();
      });
    }

    // 6c. Installed Devices List Manager (Innovative 1-Click Dismount & Camera Focus)
    const installedList = document.getElementById('installed-devices-list');
    const installedCountEl = document.getElementById('installed-count');

    function renderInstalledDevicesList() {
      const devs = [...(studio.state.devices || [])];
      if (installedCountEl) installedCountEl.textContent = String(devs.length);
      if (!installedList) return;

      installedList.innerHTML = '';
      if (devs.length === 0) {
        installedList.innerHTML = '<div style="padding:24px 16px;text-align:center;color:#64748b;font-size:12px;">Kabin şu an boş.<br><span style="color:#00e5ff;cursor:pointer;font-weight:700;display:inline-block;margin-top:6px;" id="link-go-catalog">Katalogdan cihaz ekleyin ➔</span></div>';
        document.getElementById('link-go-catalog')?.addEventListener('click', () => {
          tabBtnCatalog?.click();
        });
        return;
      }

      // Sort from top U down to bottom U (descending)
      devs.sort((a, b) => (b.startU + b.uHeight - 1) - (a.startU + a.uHeight - 1));

      devs.forEach(dev => {
        const topU = dev.startU + dev.uHeight - 1;
        const uLabel = dev.uHeight > 1 ? `U${topU}-${dev.startU}` : `U${dev.startU}`;
        const cableCount = studio.state.cables.filter(c => c.from.devId === dev.id || c.to.devId === dev.id).length;
        const rackObj = (studio.state.racks || []).find(r => r.id === dev.rackId) || { name: 'MDF' };

        const card = document.createElement('div');
        card.className = 'installed-device-card' + (studio.selectedDeviceId === dev.id ? ' active' : '');
        card.dataset.devId = dev.id;

        const metaParts = [];
        if (dev.ipAddress) metaParts.push(`IP: ${dev.ipAddress}`);
        if (dev.macAddress) metaParts.push(`MAC: ${dev.macAddress}`);
        const metaHtml = metaParts.length ? `<div class="installed-card-meta" style="font-size:11px;color:#38bdf8;margin-top:3px;font-family:Consolas,monospace;">${metaParts.join(' · ')}</div>` : '';

        card.innerHTML = `
          <div class="installed-card-top">
            <span class="installed-u-pill">${uLabel}</span>
            <span class="installed-dev-title" title="${dev.name}">${dev.name}</span>
            <span style="font-size:10px;padding:1px 5px;border-radius:4px;background:rgba(2,132,199,0.25);border:1px solid #0284c7;color:#38bdf8;font-weight:700;">${rackObj.name}</span>
            <span class="installed-cables-badge" title="Bağlı Kablo Sayısı">🔌 ${cableCount}</span>
          </div>
          <div class="installed-card-sub">${dev.manufacturer || 'Cisco'} · ${dev.uHeight}U · ${dev.powerWatts !== undefined ? dev.powerWatts : 150}W · ${dev.category || 'Donanım'}</div>
          ${metaHtml}
          <div class="installed-card-actions">
            <button class="btn-inst-action btn-inst-edit" title="Donanım bilgilerini yapılandır">✏️ Düzenle</button>
            <button class="btn-inst-action btn-inst-focus" title="Cihaza Odaklan">🔍 Odaklan</button>
            <button class="btn-inst-action btn-inst-up" title="1U Yukarı Taşı">▲</button>
            <button class="btn-inst-action btn-inst-down" title="1U Aşağı Taşı">▼</button>
            <button class="btn-inst-action btn-inst-dismount" title="Kabinden Sök (Hızlı)">🗑️ Sök</button>
          </div>
        `;

        card.querySelector('.btn-inst-edit')?.addEventListener('click', (e) => {
          e.stopPropagation();
          activeContextDevId = dev.id;
          window.DeviceMetadataEditor?.open3D(dev.id);
        });

        card.querySelector('.btn-inst-focus').addEventListener('click', (e) => {
          e.stopPropagation();
          studio.focusDevice(dev.id);
        });

        card.querySelector('.btn-inst-up').addEventListener('click', (e) => {
          e.stopPropagation();
          studio.moveDevice(dev.id, 1);
          renderInstalledDevicesList();
        });

        card.querySelector('.btn-inst-down').addEventListener('click', (e) => {
          e.stopPropagation();
          studio.moveDevice(dev.id, -1);
          renderInstalledDevicesList();
        });

        card.querySelector('.btn-inst-dismount').addEventListener('click', (e) => {
          e.stopPropagation();
          studio.removeDevice(dev.id);
          studio.showToast(`🗑️ "${dev.name}" kabinden söküldü.`);
          renderInstalledDevicesList();
          renderCatalog(searchInput ? searchInput.value : '');
        });

        card.addEventListener('click', () => {
          studio.selectDevice(dev.id);
        });

        installedList.appendChild(card);
      });
    }

    window.renderInstalledDevicesList = renderInstalledDevicesList;
    renderInstalledDevicesList();

    // 6d. Dismount All Button
    const btnDismountAll = document.getElementById('btn-dismount-all');
    if (btnDismountAll) {
      btnDismountAll.addEventListener('click', () => {
        if (studio.state.devices.length === 0) return;
        if (confirm('Kabindeki TÜM cihazları sökmek istediğinize emin misiniz?')) {
          studio.state.devices = [];
          studio.state.cables = [];
          studio.rebuildAllDevices();
          studio.rebuildAllCables();
          studio.state.pushSnapshot();
          studio.state.autoSave();
          studio.deselectDevice();
          renderInstalledDevicesList();
          renderCatalog(searchInput ? searchInput.value : '');
          studio.showToast('Kabindeki tüm cihazlar söküldü (Ctrl+Z ile geri alabilirsiniz).');
        }
      });
    }

}
