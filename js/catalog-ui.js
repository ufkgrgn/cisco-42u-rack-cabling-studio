(function () {
  'use strict';
  function init() {
    const api = window.RackStudio;
    const sidebar = document.querySelector('.sidebar-left');
    if (!api || !sidebar) return;
    const escapeHtml = api.escapeHtml || (value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]));
    const make = (tag, text, className) => {
      const node = document.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (className) node.className = className;
      return node;
    };
    // Stencil hover preview and procedural SVG generators extracted to js/catalog-stencil-resolver.js
    const hideStencilHoverPreview = () => window.CatalogStencil?.hideStencilHoverPreview?.();
    const showStencilHoverPreview = (...args) => window.CatalogStencil?.showStencilHoverPreview?.(...args);
    const toggleStencilHover = (...args) => window.CatalogStencil?.toggleStencilHover?.(...args);
    const createGeneratedStencil = (...args) => window.CatalogStencil?.createGeneratedStencil?.(...args);
    const normalize = (value) => window.CatalogStencil?.normalize ? window.CatalogStencil.normalize(value) : String(value || "").toLocaleLowerCase("tr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]/g, "");
    let favorites = new Set();
    try { const saved = JSON.parse(localStorage.getItem('rackstudio.favorites') || '[]'); if (Array.isArray(saved)) favorites = new Set(saved.filter(v => typeof v === 'string')); } catch (_) { /* Optional preference storage. */ }
    const toolbar = make('section', undefined, 'panel-section catalog-tools');
    const searchWrapper = make('div', undefined, 'catalog-search-bar');
    const search = make('input'); search.type = 'search'; search.placeholder = 'Model veya port ara…'; search.setAttribute('aria-label', 'Donanım kataloğunda ara');
    const clearBtn = make('button', '✕', 'catalog-search-clear'); clearBtn.type = 'button'; clearBtn.title = 'Aramayı Temizle';
    clearBtn.style.display = 'none';
    search.addEventListener('input', () => {
      clearBtn.style.display = search.value ? 'block' : 'none';
    });
    clearBtn.addEventListener('click', () => {
      search.value = '';
      clearBtn.style.display = 'none';
      search.focus();
      search.dispatchEvent(new Event('input'));
    });
    searchWrapper.append(search, clearBtn);

    // Quick Filter Chips: [Tümü], [48 Port], [24 Port], [PoE+], [Fiber/SFP]
    let activeQuickFilter = 'all';
    const quickChipsWrapper = make('div', undefined, 'catalog-quick-chips');
    const quickChips = [
      { id: 'all', label: 'Tümü' },
      { id: '48p', label: '48 Port' },
      { id: '24p', label: '24 Port' },
      { id: 'poe', label: 'PoE+' },
      { id: 'fiber', label: 'Fiber/SFP' }
    ];
    const quickChipButtons = [];
    quickChips.forEach(chipDef => {
      const btn = make('button', chipDef.label, `quick-filter-chip ${chipDef.id === 'all' ? 'active' : ''}`);
      btn.type = 'button';
      btn.dataset.filter = chipDef.id;
      btn.addEventListener('click', () => {
        if (activeQuickFilter === chipDef.id) return;
        activeQuickFilter = chipDef.id;
        quickChipButtons.forEach(b => b.classList.toggle('active', b.dataset.filter === activeQuickFilter));
        filter();
      });
      quickChipButtons.push(btn);
      quickChipsWrapper.append(btn);
    });

    // Accessible hidden controls (category, units, favoriteLabel, count)
    // Preserved for test compatibility and accessibility while keeping UI clean & compact
    const accessibleGroup = make('div', undefined, 'catalog-hidden-accessible');
    const category = make('select'); category.setAttribute('aria-label', 'Donanım kategorisi');
    [['', 'Tüm kategoriler'], ['switch', 'Switch'], ['router', 'Router'], ['fiber-switch', 'Fiber switch'], ['compact', 'Kompakt'], ['patch', 'Patch panel'], ['fiber', 'Fiber panel'], ['organizer', 'Organizatör'], ['blank', 'Boş panel'], ['pdu', 'PDU'], ['custom', 'Özel donanım']].forEach(([value, label]) => { const option = make('option', label); option.value = value; category.append(option); });
    const units = make('input'); units.type = 'number'; units.min = '1'; units.max = '60'; units.placeholder = 'U yüksekliği'; units.setAttribute('aria-label', 'U yüksekliğine göre filtrele');
    const favoriteLabel = make('label', undefined, 'catalog-favorite-filter'); const favoriteOnly = make('input'); favoriteOnly.type = 'checkbox'; favoriteLabel.append(favoriteOnly, document.createTextNode(' Yalnızca favoriler'));
    const count = make('div', '', 'catalog-count'); count.setAttribute('aria-live', 'polite');
    accessibleGroup.append(category, units, favoriteLabel, count);

    // View Mode Segmented Controls (Series Tree vs Category Tree)
    let catalogViewMode = 'series';
    const viewModeSegmented = make('div', undefined, 'catalog-view-segmented');
    const btnModeSeries = make('button', '🌳 Model Serileri', 'catalog-mode-btn active');
    btnModeSeries.type = 'button';
    btnModeSeries.dataset.mode = 'series';
    btnModeSeries.title = 'Cisco model serilerine göre Switch Tree yapısı';
    const btnModeCategory = make('button', '📁 Kategoriler', 'catalog-mode-btn');
    btnModeCategory.type = 'button';
    btnModeCategory.dataset.mode = 'category';
    btnModeCategory.title = 'Fonksiyonel kategorilere göre Switch Tree yapısı';
    viewModeSegmented.append(btnModeSeries, btnModeCategory);

    toolbar.append(searchWrapper, quickChipsWrapper, viewModeSegmented, accessibleGroup);

    const drawer = sidebar.querySelector('.sidebar-drawer') || sidebar;
    const stream = sidebar.querySelector('.sidebar-device-stream');
    if (stream) {
      drawer.insertBefore(toolbar, stream);
    } else {
      drawer.insertBefore(toolbar, drawer.children[1] || null);
    }

    const customSection = make('section', undefined, 'panel-section catalog-custom');
    const details = make('details');
    const summary = make('summary', '+ Özel donanım oluştur');
    const formHeader = make('div', undefined, 'catalog-custom-header');
    const formTitle = make('span', '✨ Yeni Özel Donanım', 'catalog-custom-title');
    const closeBtn = make('button', '✕', 'catalog-custom-close'); closeBtn.type = 'button'; closeBtn.title = 'Kapat';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      details.open = false;
    });
    formHeader.append(formTitle, closeBtn);

    const form = make('form', undefined, 'catalog-custom-form');
    function field(label, type, value) { const wrapper = make('label', label); const input = make('input'); input.type = type; if (value !== undefined) input.value = value; wrapper.append(input); form.append(wrapper); return input; }
    const name = field('Model adı', 'text'); name.required = true; name.maxLength = 100;
    const height = field('Yükseklik (U)', 'number', '1'); height.min = '1'; height.max = '60'; height.required = true;
    const ports = field('Port sayısı', 'number', '24'); ports.min = '0'; ports.max = '96'; ports.required = true;
    const typeLabel = make('label', 'Port tipi'); const type = make('select'); type.setAttribute('aria-label', 'Port tipi'); ['rj45', 'sfp', 'lc'].forEach(value => { const option = make('option', value.toUpperCase()); option.value = value; type.append(option); }); typeLabel.append(type); form.append(typeLabel);
    const submit = make('button', 'Kaydet ve seç'); submit.type = 'submit'; form.append(submit);
    const message = make('div', '', 'catalog-count'); message.setAttribute('role', 'status'); form.append(message);
    details.append(summary, formHeader, form);
    const customCards = make('div', undefined, 'catalog-custom-cards'); customSection.append(details, customCards);
    if (stream) {
      stream.append(customSection);
    } else {
      drawer.append(customSection);
    }

    // Wire up Activity Rail (VS Code / CAD Icon Strip)
    const railButtons = sidebar.querySelectorAll('.sidebar-activity-rail .rail-btn[data-category]');
    const railFavBtn = document.getElementById('rail-btn-fav');
    const railCustomBtn = document.getElementById('rail-btn-custom');
    const railToggleBtn = document.getElementById('rail-btn-toggle');
    const drawerTitle = document.getElementById('drawer-category-title');
    const drawerCount = document.getElementById('drawer-category-count');

    function expandSidebarIfNeeded() {
      if (sidebar.classList.contains('collapsed')) {
        if (typeof window.setLeftSidebarCollapsed === 'function') {
          window.setLeftSidebarCollapsed(false);
        } else {
          sidebar.classList.remove('collapsed');
        }
      }
    }

    railButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetCategory = btn.dataset.category || '';
        const wasActive = btn.classList.contains('active') && !sidebar.classList.contains('collapsed');
        if (wasActive) {
          if (typeof window.setLeftSidebarCollapsed === 'function') {
            window.setLeftSidebarCollapsed(true);
          }
          return;
        }
        expandSidebarIfNeeded();
        category.value = targetCategory;
        favoriteOnly.checked = false;
        category.dispatchEvent(new Event('change'));
      });
    });

    if (railFavBtn) {
      railFavBtn.addEventListener('click', () => {
        const wasActive = railFavBtn.classList.contains('active') && !sidebar.classList.contains('collapsed');
        if (wasActive) {
          if (typeof window.setLeftSidebarCollapsed === 'function') {
            window.setLeftSidebarCollapsed(true);
          }
          return;
        }
        expandSidebarIfNeeded();
        favoriteOnly.checked = !favoriteOnly.checked;
        favoriteOnly.dispatchEvent(new Event('change'));
      });
    }

    if (railCustomBtn) {
      railCustomBtn.addEventListener('click', () => {
        expandSidebarIfNeeded();
        details.open = !details.open;
        if (details.open) {
          name.focus();
        }
      });
    }

    // --- Cisco Master Switch Catalog Modal Logic ---
    // Extracted to js/catalog-cisco-modal.js
    const ciscoModalController = window.CiscoCatalogModal?.init(api, () => restore());
    const openCiscoModal = () => ciscoModalController?.openCiscoModal();
    const closeCiscoModal = () => ciscoModalController?.closeCiscoModal();
    const renderCiscoCards = () => ciscoModalController?.renderCiscoCards();
    const addModelToLibrary = (model) => ciscoModalController?.addModelToLibrary(model);
    const mountModelToActiveRack = (model) => ciscoModalController?.mountModelToActiveRack(model);

    const status = document.getElementById('status-selection-text');
    const detailPanel = make('section', undefined, 'catalog-selection-detail');
    detailPanel.hidden = true;
    detailPanel.setAttribute('aria-live', 'polite');
    if (stream) drawer.insertBefore(detailPanel, stream);

    function renderSelectionDetail(key) {
      const item = key && ((api.resolveCatalogItem ? api.resolveCatalogItem(key) : null) || api.catalog?.[key] || window.RackStudio.HARDWARE_CATALOG?.[key]);
      detailPanel.replaceChildren();
      detailPanel.hidden = !item;
      sidebar.classList.toggle('placement-mode', !!item);
      document.body.classList.toggle('catalog-placement-mode', !!item);
      if (!item) return;

      const close = make('button', '×', 'catalog-detail-close');
      close.type = 'button';
      close.setAttribute('aria-label', 'Donanım seçimini kapat');
      close.addEventListener('click', () => selectCustom(key));
      const visual = make('div', undefined, 'catalog-detail-visual');
      const stencilUrl = resolveStencil(item, key);
      const generated = createGeneratedStencil(item, item.modelTag || key);
      generated.alt = `${item.modelTag || item.name} · ${generated.dataset.previewKind} önizlemesi`;
      visual.append(generated);
      const copy = make('div', undefined, 'catalog-detail-copy');
      copy.append(
        make('strong', item.modelTag || item.name, 'catalog-detail-model'),
        make('span', item.name, 'catalog-detail-name'),
        make('span', `${item.u || 1}U · ${getDeviceSpecChips(item).join(' · ') || 'Donanım'}`, 'catalog-detail-spec')
      );
      const mount = make('button', 'İlk boş U’ya ekle', 'catalog-detail-mount');
      mount.type = 'button';
      mount.addEventListener('click', () => mountCardDeviceToRack(key));
      const actions = make('div', undefined, 'catalog-detail-actions');
      actions.append(mount);
      if (stencilUrl) {
        const actualPreview = make('button', 'Gerçek stencil’i göster', 'catalog-detail-stencil');
        actualPreview.type = 'button';
        actualPreview.addEventListener('click', () => {
          toggleStencilHover(generated, actualPreview, stencilUrl);
        });
        actions.append(actualPreview);
      }
      detailPanel.append(close, visual, copy, actions);
    }

    function selectCustom(key) {
      api.STATE.selectedLibraryItem = api.STATE.selectedLibraryItem === key ? null : key;
      sidebar.querySelectorAll('.device-card').forEach(card => card.classList.toggle('active', card.dataset.deviceId === api.STATE.selectedLibraryItem));
      renderSelectionDetail(api.STATE.selectedLibraryItem);
      if (status) status.textContent = api.STATE.selectedLibraryItem ? `Seçili: ${api.catalog[key].name}. Masaüstünde sürükleyin; tablette boş bir U seviyesine dokunun.` : 'Kütüphaneden bir donanım seçin.';
      if (api.STATE.selectedLibraryItem && window.matchMedia('(max-width: 1199px)').matches && typeof window.setLeftSidebarCollapsed === 'function') {
        window.setLeftSidebarCollapsed(true);
      }
    }
    // Stencil resolution and coverage tracking extracted to js/catalog-stencil-resolver.js
    const resolveStencil = (item, deviceId) => window.CatalogStencil?.resolveStencil ? window.CatalogStencil.resolveStencil(item, deviceId) : null;
    const recordStencilCoverage = (deviceId, stencilUrl) => window.CatalogStencil?.recordStencilCoverage && window.CatalogStencil.recordStencilCoverage(deviceId, stencilUrl);

    function getDeviceSpecChips(item) {
      const chips = [];
      if (!item) return chips;

      if (item.poeBudget) {
        chips.push(item.poeBudget);
      }
      if (item.uplinkSummary) {
        chips.push(item.uplinkSummary.split('(')[0].trim());
      }

      if (chips.length === 0 && Array.isArray(item.ports) && item.ports.length > 0) {
        const rj45Ports = item.ports.filter(p => p.type === 'rj45');
        const sfpPorts = item.ports.filter(p => p.type && (p.type.includes('sfp') || p.type.includes('qsfp') || p.type.includes('fiber') || p.type === 'lc' || p.type === 'sc'));

        const hasPoe = item.ports.some(p => /poe|upoe/i.test(p.speed || '')) || /poe|upoe/i.test(item.name || '') || /poe|upoe/i.test(item.desc || '');
        const poeWattMatch = ((item.desc || '') + ' ' + (item.name || '')).match(/(\d+W)\b/i);
        const poeWatt = poeWattMatch ? ' (' + poeWattMatch[1] + ')' : '';

        if (item.category === 'patch') {
          const category = /cat6a/i.test(`${item.name || ''} ${item.desc || ''}`) ? 'Cat6A' : 'Cat6';
          chips.push(`${rj45Ports.length || item.ports.length}× RJ45 ${category}`);
        } else if (item.category === 'fiber') {
          const connector = item.ports.some(p => p.type === 'sc') ? 'SC' : (item.ports.some(p => p.type === 'lc') ? 'LC' : 'Fiber');
          chips.push(`${item.ports.length}× ${connector} fiber`);
        } else if (rj45Ports.length > 0) {
          const is10G = rj45Ports.some(p => /10g|mgig/i.test(p.speed || ''));
          const speedStr = is10G ? 'mGig' : '1G';
          const poeStr = hasPoe ? ' PoE+' + poeWatt : '';
          chips.push(rj45Ports.length + 'x ' + speedStr + poeStr);
        }

        if (item.category !== 'fiber' && item.category !== 'patch' && sfpPorts.length > 0) {
          const is100G = sfpPorts.some(p => /100g|qsfp28/i.test(p.speed || ''));
          const is25G = sfpPorts.some(p => /25g|sfp28/i.test(p.speed || ''));
          const is10G = sfpPorts.some(p => /10g|sfp\+/i.test(p.speed || ''));
          const speed = is100G ? '100G QSFP28' : (is25G ? '25G SFP28' : (is10G ? '10G SFP+' : '1G SFP'));
          chips.push(sfpPorts.length + 'x ' + speed);
        }
      }

      if (chips.length === 0) {
        if (item.category === 'pdu') chips.push('8x Schuko', '16A 250V');
        else if (item.category === 'organizer') chips.push('Kablo Düzenleme', (item.u || 1) + 'U');
        else if (item.category === 'blank') chips.push('Kör Panel', (item.u || 1) + 'U');
        else if (item.ports && item.ports.length) chips.push(item.ports.length + ' Port');
      }

      return chips;
    }

    function mountCardDeviceToRack(deviceId) {
      const activeRack = (typeof api.getActiveRack === 'function') ? api.getActiveRack() : api.STATE?.racks?.[0];
      if (!activeRack) return;
      const item = (api.resolveCatalogItem ? api.resolveCatalogItem(deviceId) : null) || api.catalog?.[deviceId] || (window.RackStudio.HARDWARE_CATALOG && window.RackStudio.HARDWARE_CATALOG[deviceId]);
      if (!item) return;
      const uHeight = item.u || 1;
      const heightU = activeRack.heightU || 42;
      let placedU = null;
      for (let topU = heightU; topU >= uHeight; topU--) {
        let free = true;
        for (let u = topU - uHeight + 1; u <= topU; u++) {
          if (activeRack.units && activeRack.units[u] !== null) {
            free = false;
            break;
          }
        }
        if (free) {
          placedU = topU;
          break;
        }
      }

      if (placedU === null) {
        alert(`Kabinde (${activeRack.name}) ${uHeight}U yüksekliğinde boş yer bulunamadı.`);
        return;
      }

      if (typeof window.mountDeviceFromAction === 'function') {
        window.mountDeviceFromAction(deviceId, placedU, null, activeRack.id);
      } else if (typeof api.mountDeviceAt === 'function') {
        api.mountDeviceAt(deviceId, placedU, activeRack.id);
        if (api.renderRackTabs) api.renderRackTabs();
        if (api.renderMountedDevices) api.renderMountedDevices();
        if (api.renderAllCables) api.renderAllCables();
        document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
      }
      const toast = document.getElementById('studio-toast');
      if (toast) {
        toast.textContent = `✓ ${item.name || deviceId} U${placedU} seviyesine monte edildi!`;
        toast.className = 'show';
        setTimeout(() => { toast.className = ''; }, 3000);
      }
    }

    function decorate(card) {
      if (card.dataset.catalogDecorated) return;
      card.dataset.catalogDecorated = 'true';
      card.dataset.catalogEnhanced = 'true';
      card.tabIndex = 0;
      card.setAttribute('draggable', 'true');

      const key = card.dataset.deviceId;
      if (!key) return;

      const item = (api.resolveCatalogItem ? api.resolveCatalogItem(key) : null) || api.catalog?.[key] || (window.RackStudio.HARDWARE_CATALOG && window.RackStudio.HARDWARE_CATALOG[key]);
      if (!item) return;

      card.addEventListener('dragstart', event => {
        window.__RACK_DRAGGED_DEVICE__ = key;
        if (event.dataTransfer) {
          event.dataTransfer.setData('text/plain', key);
          event.dataTransfer.setData('application/x-rack-device', key);
          event.dataTransfer.effectAllowed = 'copy';
        }
        card.classList.add('dragging');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        window.__RACK_DRAGGED_DEVICE__ = null;
        if (api.highlightDropSlots) api.highlightDropSlots(null, null, false);
      });

      card.addEventListener('keydown', event => {
        if (event.target === card && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          selectCustom(key);
        }
      });

      card.addEventListener('click', (e) => {
        if (e.target.closest('.catalog-star') || e.target.closest('.btn-card-quick-mount')) return;
        selectCustom(key);
      });

      // Build upgraded card DOM
      const sku = item.modelTag || item.name || key;
      card.title = `${sku} - ${item.name} (${item.u || 1}U)`;

      // 1. Header
      const header = make('div', undefined, 'hw-card-header');
      const skuWrap = make('div', undefined, 'hw-sku-wrap');
      const skuTag = make('span', sku, 'hw-sku-tag');
      skuTag.title = sku;
      const devName = make('span', item.name, 'device-name');
      devName.title = item.name;
      skuWrap.append(skuTag, devName);

      const topBadges = make('div', undefined, 'hw-card-top-badges');
      const uBadge = make('span', `${item.u || 1}U`, 'device-u-badge');
      const favorite = make('button', '', 'catalog-star');
      favorite.type = 'button';
      favorite.setAttribute('draggable', 'false');
      function updateFav() {
        const chosen = favorites.has(key);
        favorite.textContent = chosen ? '★' : '☆';
        favorite.setAttribute('aria-label', chosen ? 'Favorilerden çıkar' : 'Favorilere ekle');
        favorite.setAttribute('aria-pressed', String(chosen));
      }
      updateFav();
      favorite.addEventListener('click', event => {
        event.stopPropagation();
        event.preventDefault();
        favorites.has(key) ? favorites.delete(key) : favorites.add(key);
        try { localStorage.setItem('rackstudio.favorites', JSON.stringify([...favorites])); } catch (_) {}
        updateFav();
        filter();
      });
      topBadges.append(uBadge, favorite);
      header.append(skuWrap, topBadges);

      // 2. Visual Stencil or Fallback Mini-Bezel
      const visualContainer = make('div', undefined, 'hw-visual-container');
      const stencilUrl = resolveStencil(item, key);
      recordStencilCoverage(key, stencilUrl);

      let fallbackBezel = card.querySelector('.hw-mini-bezel');
      if (!fallbackBezel) {
        const isCisco = item.logo === 'CISCO' || (item.series && item.series !== 'custom');
        const bezelClass = isCisco ? (item.series ? `bezel-${item.series}` : 'bezel-switch') : 'bezel-custom';
        const bezelTag = isCisco ? (item.modelTag || 'CISCO') : 'CUSTOM';
        fallbackBezel = make('div', undefined, 'hw-mini-bezel ' + bezelClass);
        fallbackBezel.innerHTML = `<div class="mini-bezel-ear"><div class="mini-screw-hole"></div></div><div class="mini-bezel-face"><span class="mini-cisco-text">${escapeHtml(bezelTag)}</span><span class="mini-led-dot mini-led-cyan"></span></div><div class="mini-bezel-ear"><div class="mini-screw-hole"></div></div>`;
      }

      const generated = createGeneratedStencil(item, sku);
      generated.alt = `${sku} · ${generated.dataset.previewKind} önizlemesi`;
      generated.setAttribute('draggable', 'false');
      fallbackBezel.style.display = 'none';
      visualContainer.append(generated, fallbackBezel);
      visualContainer.tabIndex = 0;
      visualContainer.addEventListener('pointerenter', () => showStencilHoverPreview(generated, visualContainer));
      visualContainer.addEventListener('pointerleave', hideStencilHoverPreview);
      visualContainer.addEventListener('focusin', () => showStencilHoverPreview(generated, visualContainer));
      visualContainer.addEventListener('focusout', hideStencilHoverPreview);

      // 3. Spec Chips
      const specChipsWrap = make('div', undefined, 'hw-spec-chips');
      const chips = getDeviceSpecChips(item);
      chips.forEach(chipText => {
        const chip = make('span', chipText, 'hw-spec-chip' + (/poe|upoe/i.test(chipText) ? ' poe' : (/sfp|qsfp|uplink/i.test(chipText) ? ' uplink' : '')));
        specChipsWrap.append(chip);
      });

      // 4. Action Button "+ Kabine Ekle"
      const footer = make('div', undefined, 'hw-card-footer');
      const mountBtn = make('button', '+', 'btn-card-quick-mount');
      mountBtn.type = 'button';
      mountBtn.setAttribute('draggable', 'false');
      mountBtn.setAttribute('aria-label', `${item.name} cihazını ilk boş U seviyesine ekle`);
      mountBtn.title = 'Aktif kabindeki ilk boş U pozisyonuna monte et';
      mountBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        mountCardDeviceToRack(key);
      });
      footer.append(mountBtn);

      // 5. Hidden description for search / tests
      const descEl = make('div', item.desc || '', 'device-desc');
      descEl.style.display = 'none';

      // Two-row card: transparent stencil above, concise metadata below.
      const infoRow = make('div', undefined, 'hw-card-info-row');
      infoRow.append(header, specChipsWrap, footer);
      card.replaceChildren(visualContainer, infoRow, descEl);
    }
    // --- Switch-Tree Style Catalog Series & Category Architecture ---
    function getDeviceSeriesGroup(deviceId, item) {
      const id = String(deviceId || '').toLowerCase();
      const name = String(item?.name || '').toLowerCase();
      const seriesKey = String(item?.series || '').toLowerCase();
      const cat = String(item?.category || '').toLowerCase();

      if (seriesKey === 'cat9k' || id.includes('9300') || id.includes('9200') || id.includes('9500') || name.includes('9300') || name.includes('9200') || name.includes('9500')) {
        return { key: 'cat9k', title: 'Catalyst 9000 Serisi', badge: 'CAT 9000', order: 1 };
      }
      if (seriesKey === 'cat3k' || id.includes('3850') || id.includes('3650') || name.includes('3850') || name.includes('3650')) {
        return { key: 'cat3k', title: 'Catalyst 3850 Serisi', badge: 'CAT 3850', order: 2 };
      }
      if (seriesKey === 'cat2k' || id.includes('2960') || name.includes('2960')) {
        return { key: 'cat2k', title: 'Catalyst 2960 Serisi', badge: 'CAT 2960', order: 3 };
      }
      if (seriesKey === 'nexus' || id.includes('nexus') || name.includes('nexus')) {
        return { key: 'nexus', title: 'Nexus Veri Merkezi', badge: 'NEXUS', order: 4 };
      }
      if (seriesKey === 'isr' || cat === 'router' || id.includes('isr') || name.includes('router') || name.includes('isr')) {
        return { key: 'isr', title: 'ISR Router Serisi', badge: 'ISR WAN', order: 5 };
      }
      if (cat === 'compact' || id.includes('3560') || name.includes('3560-cx')) {
        return { key: 'compact', title: 'Kompakt & Duvar', badge: 'COMPACT', order: 6 };
      }
      if (cat === 'fiber' || id.includes('odf') || name.includes('odf')) {
        return { key: 'fiber-odf', title: 'Fiber Sonlandırma & ODF', badge: 'FIBER / ODF', order: 7 };
      }
      if (cat === 'patch' || id.includes('patch') || name.includes('patch')) {
        return { key: 'copper-patch', title: 'Bakır Patch Paneller', badge: 'COPPER PATCH', order: 8 };
      }
      if (cat === 'organizer' || cat === 'blank' || id.includes('organizer') || id.includes('blank') || name.includes('düzenleyici') || name.includes('kör panel')) {
        return { key: 'management', title: 'Düzenleyici & Kör', badge: 'D-RING', order: 9 };
      }
      return { key: 'custom', title: 'Özel Donanımlar', badge: 'CUSTOM', order: 10 };
    }

    function getDeviceCategoryGroup(deviceId, item) {
      const cat = String(item?.category || '').toLowerCase();
      const id = String(deviceId || '').toLowerCase();

      if (cat === 'router' || id.includes('isr')) {
        return { key: 'grp-router', title: 'WAN & Yönlendirici (Router)', badge: 'ROUTER', order: 1 };
      }
      if (cat === 'fiber-switch' || id.includes('3850-24s') || id.includes('nexus') || id.includes('9500')) {
        return { key: 'grp-fiber', title: 'Fiber Dağıtım & Omurga', badge: 'CORE', order: 2 };
      }
      if (cat === 'switch' || id.includes('2960') || id.includes('9300') || id.includes('9200')) {
        return { key: 'grp-switch', title: 'Gigabit PoE+ Kenar Switchler', badge: 'ACCESS', order: 3 };
      }
      if (cat === 'compact' || id.includes('3560')) {
        return { key: 'grp-compact', title: 'Kompakt & Duvar Tipi Switchler', badge: 'COMPACT', order: 4 };
      }
      if (cat === 'fiber' || id.includes('odf')) {
        return { key: 'grp-odf', title: 'Fiber Sonlandırma & ODF', badge: 'FIBER', order: 5 };
      }
      if (cat === 'patch' || id.includes('patch')) {
        return { key: 'grp-patch', title: 'Bakır Patch Paneller', badge: 'PATCH', order: 6 };
      }
      if (cat === 'organizer' || cat === 'blank') {
        return { key: 'grp-org', title: 'Kablo Düzenleme & Boş Paneller', badge: 'D-RING', order: 7 };
      }
      return { key: 'grp-custom', title: 'Özel Donanımlar', badge: 'CUSTOM', order: 8 };
    }

    const collapsedTreeGroups = new Set();
    const treeContainer = make('div', undefined, 'catalog-tree-container');

    // Collect all initial device cards from sidebar
    const allDeviceCards = [];
    sidebar.querySelectorAll('.sidebar-device-stream .device-card').forEach(card => {
      allDeviceCards.push(card);
    });

    function renderTreeGroups() {
      treeContainer.replaceChildren();
      const groupsMap = new Map();

      allDeviceCards.forEach(card => {
        decorate(card);
        const key = card.dataset.deviceId;
        const item = (api.resolveCatalogItem ? api.resolveCatalogItem(key) : null) || api.catalog[key] || (window.RackStudio.HARDWARE_CATALOG && window.RackStudio.HARDWARE_CATALOG[key]);
        const groupInfo = (catalogViewMode === 'series')
          ? getDeviceSeriesGroup(key, item)
          : getDeviceCategoryGroup(key, item);

        if (!groupsMap.has(groupInfo.key)) {
          groupsMap.set(groupInfo.key, { info: groupInfo, cards: [] });
        }
        groupsMap.get(groupInfo.key).cards.push(card);
      });

      // Sort groups by order
      const sortedGroups = [...groupsMap.values()].sort((a, b) => a.info.order - b.info.order);

      sortedGroups.forEach(grp => {
        const isCollapsed = collapsedTreeGroups.has(grp.info.key);
        const cardEl = make('div', undefined, `catalog-tree-card panel-section collapsible-section ${isCollapsed ? 'collapsed' : ''}`);
        cardEl.dataset.groupKey = grp.info.key;

        const header = make('div', undefined, 'catalog-tree-header');
        const info = make('div', undefined, 'catalog-tree-info');
        const icon = make('span', isCollapsed ? '▶' : '▼', 'catalog-tree-icon');
        const badge = make('span', grp.info.badge, 'catalog-tree-badge');
        const title = make('span', grp.info.title, 'catalog-tree-title');
        info.append(icon, badge, title);

        const countBadge = make('span', `${grp.cards.length} Model`, 'catalog-tree-count');
        header.append(info, countBadge);

        const body = make('div', undefined, 'catalog-tree-body');
        grp.cards.forEach(c => body.append(c));

        header.addEventListener('click', () => {
          const coll = collapsedTreeGroups.has(grp.info.key);
          if (coll) {
            collapsedTreeGroups.delete(grp.info.key);
          } else {
            collapsedTreeGroups.add(grp.info.key);
          }
          cardEl.classList.toggle('collapsed', !coll);
          icon.textContent = !coll ? '▶' : '▼';
        });

        cardEl.append(header, body);
        treeContainer.append(cardEl);
      });
    }

    if (stream) {
      stream.replaceChildren(treeContainer, customSection);
      renderTreeGroups();
    }

    btnModeSeries.addEventListener('click', () => {
      if (catalogViewMode === 'series') return;
      catalogViewMode = 'series';
      btnModeSeries.classList.add('active');
      btnModeCategory.classList.remove('active');
      renderTreeGroups();
      filter();
    });

    btnModeCategory.addEventListener('click', () => {
      if (catalogViewMode === 'category') return;
      catalogViewMode = 'category';
      btnModeCategory.classList.add('active');
      btnModeSeries.classList.remove('active');
      renderTreeGroups();
      filter();
    });

    function getAccessPortCount(item) {
      const ports = Array.isArray(item?.ports) ? item.ports : [];
      const accessPorts = ports.filter(port => !/^(up|qsfp|mgmt|console)/i.test(String(port.id || '')) && !/uplink|management|console/i.test(String(port.speed || '')));
      return accessPorts.length || ports.length;
    }

    function matchesCategory(item, selectedCategory) {
      if (!selectedCategory) return true;
      if (selectedCategory === 'switch') return ['switch', 'fiber-switch', 'compact'].includes(item.category);
      if (selectedCategory === 'fiber') return item.category === 'fiber' || item.category === 'fiber-switch';
      return item.category === selectedCategory;
    }

    function filter() {
      const query = normalize(search.value); let visible = 0; let total = 0;
      sidebar.querySelectorAll('.device-card').forEach(card => {
        decorate(card);
        const item = (api.resolveCatalogItem ? api.resolveCatalogItem(card.dataset.deviceId) : null) || api.catalog[card.dataset.deviceId] || (window.RackStudio.HARDWARE_CATALOG && window.RackStudio.HARDWARE_CATALOG[card.dataset.deviceId]);
        if (!item) { card.hidden = true; return; }
        total++;

        let quickMatch = true;
        if (activeQuickFilter === '48p') {
          const is48 = getAccessPortCount(item) === 48 || /(?:^|-)48(?:P|T|S|U|X|Y|\b)/i.test(`${item.modelTag || ''} ${item.name || ''}`);
          if (!is48) quickMatch = false;
        } else if (activeQuickFilter === '24p') {
          const is24 = getAccessPortCount(item) === 24 || /(?:^|-)24(?:P|T|S|U|X|Y|\b)/i.test(`${item.modelTag || ''} ${item.name || ''}`);
          if (!is24) quickMatch = false;
        } else if (activeQuickFilter === 'poe') {
          const isPoe = /poe|upoe/i.test(item.poeBudget || '') ||
                        (item.ports && item.ports.some(p => /poe|upoe/i.test(p.speed || ''))) ||
                        /poe|upoe/i.test(item.name || '') ||
                        /poe|upoe/i.test(item.desc || '');
          if (!isPoe) quickMatch = false;
        } else if (activeQuickFilter === 'fiber') {
          const isFiber = item.category === 'fiber' ||
                          item.category === 'fiber-switch' ||
                          (item.ports && item.ports.every(p => p.type && (p.type.includes('sfp') || p.type.includes('qsfp') || p.type === 'lc' || p.type === 'sc'))) ||
                          (item.ports && item.ports.some(p => p.type && (p.type.includes('sfp') || p.type.includes('qsfp') || p.type === 'lc' || p.type === 'sc'))) ||
                          /fiber|sfp|odf/i.test(item.desc || '');
          if (!isFiber) quickMatch = false;
        }

        const matches = quickMatch &&
                        (!query || normalize([item.name, item.modelTag, item.desc, card.dataset.deviceId].join(' ')).includes(query)) &&
                        matchesCategory(item, category.value) &&
                        (!units.value || item.u === Number(units.value)) &&
                        (!favoriteOnly.checked || favorites.has(card.dataset.deviceId));
        card.hidden = !matches;
        if (matches) visible++;
      });

      // Update tree group cards visibility and model counts
      treeContainer.querySelectorAll('.catalog-tree-card').forEach(cardEl => {
        const cardsInGroup = [...cardEl.querySelectorAll('.device-card')];
        const visibleInGroup = cardsInGroup.filter(c => !c.hidden).length;
        cardEl.hidden = (visibleInGroup === 0);
        cardEl.style.display = (visibleInGroup === 0) ? 'none' : '';
        const countBadge = cardEl.querySelector('.catalog-tree-count');
        if (countBadge) {
          countBadge.textContent = `${visibleInGroup} Model`;
        }
      });

      sidebar.querySelectorAll('.panel-section').forEach(section => {
        if (section === toolbar || section === customSection) return;
        const cards = [...section.querySelectorAll('.device-card')];
        if (cards.length) section.hidden = cards.every(card => card.hidden);
      });

      count.textContent = `${visible} / ${total} donanım${visible ? '' : ' — filtreleri değiştirin'}`;

      // Update Activity Rail and Drawer UI state
      const currentCat = category.value || '';
      railButtons.forEach(btn => {
        const cat = btn.dataset.category || '';
        btn.classList.toggle('active', cat === currentCat && !favoriteOnly.checked);
      });

      if (railFavBtn) {
        railFavBtn.classList.toggle('active', !!favoriteOnly.checked);
      }

      if (drawerTitle) {
        if (favoriteOnly.checked) {
          drawerTitle.textContent = 'FAVORİ DONANIMLAR';
        } else if (currentCat === 'switch' || currentCat === 'fiber-switch') {
          drawerTitle.textContent = 'SWITCHLER';
        } else if (currentCat === 'router') {
          drawerTitle.textContent = 'ROUTER & WAN';
        } else if (currentCat === 'patch') {
          drawerTitle.textContent = 'PATCH PANELLER';
        } else if (currentCat === 'organizer') {
          drawerTitle.textContent = 'KABLO DÜZENLEME';
        } else if (currentCat === 'fiber') {
          drawerTitle.textContent = 'FİBER DAĞITIM';
        } else if (currentCat === 'custom') {
          drawerTitle.textContent = 'ÖZEL DONANIMLAR';
        } else {
          drawerTitle.textContent = (catalogViewMode === 'series') ? 'MODEL SERİLERİ' : 'TÜM DONANIMLAR';
        }
      }

      if (drawerCount) {
        drawerCount.textContent = String(visible);
      }
    }
    let signature = '';
    function restore() {
      const custom = api.STATE.customCatalog || {};
      Object.assign(api.catalog, custom);
      const next = JSON.stringify(custom);
      if (next !== signature) {
        signature = next; customCards.replaceChildren();
        Object.entries(custom).forEach(([key, item]) => {
          const card = make('div', undefined, 'device-card ' + (item.u >= 2 ? 'hw-item-2u' : 'hw-item-1u')); card.dataset.deviceId = key;
          const isCisco = item.logo === 'CISCO';
          const bezelClass = isCisco ? (item.series ? `bezel-${item.series}` : 'bezel-switch') : 'bezel-custom';
          const bezelTag = isCisco ? (item.modelTag || 'CISCO') : 'CUSTOM';
          const bezelColor = isCisco ? '#38bdf8' : '#10b981';
          const bezelDot = isCisco ? 'mini-led-cyan' : 'mini-led-green';
          card.title = `${item.name} (${item.u}U) - ${item.ports.length} Port ${isCisco ? 'Cisco Switch' : 'Özel Donanım'}`;
          const bezel = make('div', undefined, 'hw-mini-bezel ' + bezelClass);
          bezel.innerHTML = `<div class="mini-bezel-ear"><div class="mini-screw-hole"></div></div><div class="mini-bezel-face"><span class="mini-cisco-text" style="color:${bezelColor};">${bezelTag}</span><span class="mini-led-dot ${bezelDot}"></span></div><div class="mini-bezel-ear"><div class="mini-screw-hole"></div></div>`;
          const info = make('div', undefined, 'hw-info');
          info.append(make('span', item.name, 'device-name'));
          const badge = make('span', `${item.u}U`, 'device-u-badge');
          const desc = make('div', `${item.ports.length} port · ${isCisco ? 'Cisco Switch' : 'Özel donanım'}`, 'device-desc');
          desc.style.display = 'none';
          card.append(bezel, info, badge, desc);
          card.addEventListener('click', () => selectCustom(key));
          customCards.append(card);
        });
      }
      sidebar.querySelectorAll('.device-card').forEach(card => card.classList.toggle('active', card.dataset.deviceId === api.STATE.selectedLibraryItem));
      renderSelectionDetail(api.STATE.selectedLibraryItem);
      filter();
    }
    form.addEventListener('submit', event => {
      event.preventDefault(); if (!form.reportValidity()) return;
      const modelName = name.value.trim(); if (!modelName) { message.textContent = 'Bir model adı girin.'; return; }
      const u = Number(height.value); const portCount = Number(ports.value);
      if (!Number.isInteger(u) || u < 1 || u > 60 || !Number.isInteger(portCount) || portCount < 0 || portCount > 96) return;
      const key = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const item = { name: modelName, u, category: 'custom', logo: 'CUSTOM', modelTag: modelName, desc: 'Kullanıcı tanımlı donanım; teknik özellikler doğrulanmamıştır.', ports: Array.from({ length: portCount }, (_, i) => ({ id: `port-${i + 1}`, name: `Port ${i + 1}`, type: type.value, group: Math.floor(i / 24), row: Math.floor((i % 24) / 12), speed: 'Belirtilmedi' })) };
      api.STATE.customCatalog = api.STATE.customCatalog || {}; api.STATE.customCatalog[key] = item; api.catalog[key] = item;
      api.STATE.selectedLibraryItem = key;
      search.value = ''; category.value = ''; units.value = ''; favoriteOnly.checked = false;
      api.refresh(); restore(); message.textContent = `${modelName} kaydedildi. Yerleştirmek için boş bir U seçin.`;
      if (status) status.textContent = message.textContent;
    });
    search.addEventListener('input', filter); category.addEventListener('change', filter); units.addEventListener('input', filter); favoriteOnly.addEventListener('change', filter);
    window.addEventListener('rackstudio:refresh', restore); restore();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

