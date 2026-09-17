(function () {
  'use strict';
  function init() {
    const api = window.RackStudio;
    const sidebar = document.querySelector('.sidebar-left');
    if (!api || !sidebar) return;
    const make = (tag, text, className) => {
      const node = document.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (className) node.className = className;
      return node;
    };
    const normalize = value => String(value || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]/g, '');
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

    toolbar.append(searchWrapper, viewModeSegmented, accessibleGroup);

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

    if (railToggleBtn) {
      railToggleBtn.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.contains('collapsed');
        if (typeof window.setLeftSidebarCollapsed === 'function') {
          window.setLeftSidebarCollapsed(!isCollapsed);
        } else {
          sidebar.classList.toggle('collapsed', !isCollapsed);
        }
      });
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
    const ciscoModal = document.getElementById('modal-cisco-catalog');
    const railCiscoBtn = document.getElementById('rail-btn-cisco-catalog');
    const btnOpenCisco = document.getElementById('btn-open-cisco-catalog');
    const btnCloseCisco = document.getElementById('btn-close-cisco-catalog');
    const btnCloseCiscoFooter = document.getElementById('btn-close-cisco-catalog-footer');
    const ciscoSearch = document.getElementById('cisco-catalog-search');
    const ciscoClearBtn = document.getElementById('cisco-search-clear');
    const ciscoCardsGrid = document.getElementById('cisco-cards-grid');
    const ciscoEmptyState = document.getElementById('cisco-empty-state');
    const btnResetFilters = document.getElementById('btn-cisco-reset-filters');
    const ciscoTotalBadge = document.getElementById('cisco-modal-total-badge');
    const pillCountAll = document.getElementById('pill-count-all');
    const ciscoPills = document.querySelectorAll('#cisco-filter-pills .cisco-pill');

    let activeCiscoFilter = 'all';

    function openCiscoModal() {
      if (!ciscoModal) return;
      ciscoModal.style.display = 'flex';
      if (ciscoSearch) {
        ciscoSearch.value = '';
        if (ciscoClearBtn) ciscoClearBtn.style.display = 'none';
      }
      activeCiscoFilter = 'all';
      ciscoPills.forEach(p => p.classList.toggle('active', p.dataset.filter === 'all'));
      renderCiscoCards();
      setTimeout(() => ciscoSearch?.focus(), 50);
    }

    function closeCiscoModal() {
      if (!ciscoModal) return;
      ciscoModal.style.display = 'none';
    }

    if (railCiscoBtn) {
      railCiscoBtn.addEventListener('click', () => {
        openCiscoModal();
      });
    }
    if (btnOpenCisco) {
      btnOpenCisco.addEventListener('click', () => {
        openCiscoModal();
      });
    }
    if (btnCloseCisco) btnCloseCisco.addEventListener('click', closeCiscoModal);
    if (btnCloseCiscoFooter) btnCloseCiscoFooter.addEventListener('click', closeCiscoModal);
    if (ciscoModal) {
      ciscoModal.addEventListener('click', (e) => {
        if (e.target === ciscoModal) closeCiscoModal();
      });
    }

    if (ciscoSearch) {
      ciscoSearch.addEventListener('input', () => {
        if (ciscoClearBtn) ciscoClearBtn.style.display = ciscoSearch.value ? 'block' : 'none';
        renderCiscoCards();
      });
    }
    if (ciscoClearBtn) {
      ciscoClearBtn.addEventListener('click', () => {
        ciscoSearch.value = '';
        ciscoClearBtn.style.display = 'none';
        ciscoSearch.focus();
        renderCiscoCards();
      });
    }

    ciscoPills.forEach(pill => {
      pill.addEventListener('click', () => {
        activeCiscoFilter = pill.dataset.filter || 'all';
        ciscoPills.forEach(p => p.classList.toggle('active', p === pill));
        renderCiscoCards();
      });
    });

    if (btnResetFilters) {
      btnResetFilters.addEventListener('click', () => {
        if (ciscoSearch) ciscoSearch.value = '';
        if (ciscoClearBtn) ciscoClearBtn.style.display = 'none';
        activeCiscoFilter = 'all';
        ciscoPills.forEach(p => p.classList.toggle('active', p.dataset.filter === 'all'));
        renderCiscoCards();
      });
    }

    function addModelToLibrary(model) {
      api.STATE.customCatalog = api.STATE.customCatalog || {};
      const clone = {
        name: model.name,
        u: model.u || 1,
        category: model.category || 'switch',
        logo: 'CISCO',
        series: model.series || 'cat9k',
        modelTag: model.modelTag,
        desc: model.desc,
        ports: JSON.parse(JSON.stringify(model.ports))
      };
      api.STATE.customCatalog[model.id] = clone;
      api.catalog[model.id] = clone;
      api.STATE.selectedLibraryItem = model.id;
      api.refresh();
      restore();

      const toast = document.getElementById('studio-toast');
      if (toast) {
        toast.textContent = `✓ ${model.name} kütüphanenize eklendi!`;
        toast.className = 'show';
        setTimeout(() => { toast.className = ''; }, 3000);
      }
    }

    function mountModelToActiveRack(model) {
      if (!api.catalog[model.id]) {
        addModelToLibrary(model);
      }
      const activeRack = (typeof api.getActiveRack === 'function') ? api.getActiveRack() : api.STATE.racks?.[0];
      if (!activeRack) return;
      const heightU = activeRack.heightU || 42;
      const uHeight = model.u || 1;
      let placedU = null;
      for (let topU = heightU; topU >= uHeight; topU--) {
        let free = true;
        for (let u = topU - uHeight + 1; u <= topU; u++) {
          if (activeRack.units[u]) { free = false; break; }
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

      if (typeof api.mountDeviceAt === 'function') {
        api.mountDeviceAt(model.id, placedU, activeRack.id);
      }
      closeCiscoModal();
      api.refresh();

      const toast = document.getElementById('studio-toast');
      if (toast) {
        toast.textContent = `✓ ${model.name} U${placedU} seviyesine monte edildi!`;
        toast.className = 'show';
        setTimeout(() => { toast.className = ''; }, 3000);
      }
    }

    function renderCiscoCards() {
      if (!ciscoCardsGrid) return;
      const master = window.CISCO_MASTER_CATALOG || [];
      if (ciscoTotalBadge) ciscoTotalBadge.textContent = `${master.length} Model`;
      if (pillCountAll) pillCountAll.textContent = String(master.length);

      const query = normalize(ciscoSearch?.value || '');

      const filtered = master.filter(model => {
        if (activeCiscoFilter === 'current' && model.generation !== 'current') return false;
        if (activeCiscoFilter === 'legacy' && model.generation !== 'legacy') return false;
        if (activeCiscoFilter === '24p') {
          const is24 = (model.ports.filter(p => p.type === 'rj45' || !p.type.includes('sfp')).length === 24) || model.modelTag.includes('-24') || model.name.includes('-24');
          if (!is24) return false;
        }
        if (activeCiscoFilter === '48p') {
          const is48 = (model.ports.filter(p => p.type === 'rj45' || !p.type.includes('sfp')).length === 48) || model.modelTag.includes('-48') || model.name.includes('-48');
          if (!is48) return false;
        }
        if (activeCiscoFilter === 'poe' && !/poe|upoe/i.test(model.poeBudget || '')) return false;
        if (activeCiscoFilter === 'fiber') {
          const isFiber = model.category === 'fiber-switch' || /fiber|sfp28|core/i.test(model.desc || '') || model.ports.every(p => p.type.includes('sfp') || p.type.includes('qsfp'));
          if (!isFiber) return false;
        }
        if (activeCiscoFilter === 'compact' && model.category !== 'compact' && model.series !== 'compact' && model.ports.length > 16) return false;

        if (query) {
          const hay = normalize([model.name, model.modelTag, model.desc, model.poeBudget, model.uplinkSummary, model.series].join(' '));
          if (!hay.includes(query)) return false;
        }
        return true;
      });

      if (ciscoEmptyState) ciscoEmptyState.style.display = filtered.length === 0 ? 'flex' : 'none';
      ciscoCardsGrid.style.display = filtered.length === 0 ? 'none' : 'grid';
      ciscoCardsGrid.replaceChildren();

      filtered.forEach(model => {
        const isAdded = Object.hasOwn(api.STATE.customCatalog || {}, model.id) || Object.hasOwn(api.catalog, model.id);
        const card = make('div', undefined, 'cisco-card');

        // Top: Title & Badges
        const top = make('div', undefined, 'cisco-card-top');
        const titleGroup = make('div', undefined, 'cisco-card-title-group');
        const nameEl = make('h4', model.name, 'cisco-card-name');
        nameEl.title = model.name;
        const tagEl = make('div', model.modelTag, 'cisco-card-tag');
        titleGroup.append(nameEl, tagEl);

        const badges = make('div', undefined, 'cisco-card-badges');
        const genBadge = make('span', model.generation === 'current' ? 'GÜNCEL' : 'LEGACY', `badge-gen ${model.generation}`);
        const uBadge = make('span', `${model.u || 1}U`, 'badge-u');
        badges.append(genBadge, uBadge);
        top.append(titleGroup, badges);

        // Mini Bezel Visual
        const bezel = make('div', undefined, 'cisco-card-bezel');
        const earL = make('div', undefined, 'mini-bezel-ear');
        const textEl = make('span', model.modelTag, 'mini-cisco-text');
        const portsPreview = make('div', undefined, 'mini-bezel-ports-preview');
        const dotCount = Math.min(8, Math.ceil(model.ports.length / 4));
        for (let k = 0; k < dotCount; k++) {
          const dot = make('span', undefined, 'dot-port');
          portsPreview.append(dot);
        }
        const earR = make('div', undefined, 'mini-bezel-ear');
        bezel.append(earL, textEl, portsPreview, earR);

        // Specs Chips
        const specs = make('div', undefined, 'cisco-card-specs');
        const portCountBadge = make('span', `${model.ports.length} Port`, 'spec-chip');
        specs.append(portCountBadge);
        if (model.poeBudget) {
          const poeChip = make('span', model.poeBudget, 'spec-chip poe');
          specs.append(poeChip);
        }
        if (model.uplinkSummary) {
          const upChip = make('span', model.uplinkSummary, 'spec-chip uplink');
          specs.append(upChip);
        }

        // Desc
        const descEl = make('p', model.desc, 'cisco-card-desc');
        descEl.title = model.desc;

        // Actions
        const actions = make('div', undefined, 'cisco-card-actions');
        const addBtn = make('button', isAdded ? '✓ Kütüphanede' : '➕ Kütüphaneye Ekle', `btn-card-add-lib ${isAdded ? 'added' : ''}`);
        addBtn.type = 'button';
        if (!isAdded) {
          addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addModelToLibrary(model);
            addBtn.textContent = '✓ Kütüphanede';
            addBtn.classList.add('added');
          });
        }

        const mountBtn = make('button', '🚀 Kabine Ekle', 'btn-card-mount-rack');
        mountBtn.type = 'button';
        mountBtn.title = 'Aktif kabindeki ilk boş U pozisyonuna monte et';
        mountBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          mountModelToActiveRack(model);
        });

        actions.append(addBtn, mountBtn);
        card.append(top, bezel, specs, descEl, actions);
        ciscoCardsGrid.append(card);
      });
    }

    const status = document.getElementById('status-selection-text');
    function selectCustom(key) {
      api.STATE.selectedLibraryItem = api.STATE.selectedLibraryItem === key ? null : key;
      sidebar.querySelectorAll('.device-card').forEach(card => card.classList.toggle('active', card.dataset.deviceId === api.STATE.selectedLibraryItem));
      if (status) status.textContent = api.STATE.selectedLibraryItem ? `Seçili: ${api.catalog[key].name}. Kabinde boş bir U seviyesine çift tıklayın veya sürükleyin.` : 'Kütüphaneden bir donanım seçin.';
    }
    function decorate(card) {
      if (card.dataset.catalogEnhanced) return;
      card.dataset.catalogEnhanced = 'true'; card.tabIndex = 0;
      card.setAttribute('draggable', 'true');
      card.addEventListener('dragstart', event => {
        const key = card.dataset.deviceId;
        if (!key) return;
        window.__RACK_DRAGGED_DEVICE__ = key;
        event.dataTransfer.setData('text/plain', key);
        event.dataTransfer.setData('application/x-rack-device', key);
        event.dataTransfer.effectAllowed = 'copy';
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        window.__RACK_DRAGGED_DEVICE__ = null;
      });
      card.addEventListener('keydown', event => { if (event.target === card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); card.click(); } });
      const favorite = make('button', '', 'catalog-star'); favorite.type = 'button';
      function update() { const chosen = favorites.has(card.dataset.deviceId); favorite.textContent = chosen ? '★' : '☆'; favorite.setAttribute('aria-label', chosen ? 'Favorilerden çıkar' : 'Favorilere ekle'); favorite.setAttribute('aria-pressed', String(chosen)); }
      update(); favorite.addEventListener('click', event => { event.stopPropagation(); const key = card.dataset.deviceId; favorites.has(key) ? favorites.delete(key) : favorites.add(key); try { localStorage.setItem('rackstudio.favorites', JSON.stringify([...favorites])); } catch (_) {} update(); filter(); }); card.append(favorite);
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
      if (cat === 'patch' || cat === 'fiber' || id.includes('patch') || id.includes('odf') || name.includes('patch')) {
        return { key: 'patch', title: 'Patch & ODF Paneller', badge: 'PATCH & ODF', order: 7 };
      }
      if (cat === 'organizer' || cat === 'blank' || id.includes('organizer') || id.includes('blank') || name.includes('düzenleyici') || name.includes('kör panel')) {
        return { key: 'management', title: 'Düzenleyici & Kör', badge: 'D-RING', order: 8 };
      }
      return { key: 'custom', title: 'Özel Donanımlar', badge: 'CUSTOM', order: 9 };
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
      if (cat === 'patch' || cat === 'fiber' || id.includes('patch') || id.includes('odf')) {
        return { key: 'grp-patch', title: 'Patch Paneller & Sonlandırma', badge: 'PATCH', order: 5 };
      }
      if (cat === 'organizer' || cat === 'blank') {
        return { key: 'grp-org', title: 'Kablo Düzenleme & Boş Paneller', badge: 'D-RING', order: 6 };
      }
      return { key: 'grp-custom', title: 'Özel Donanımlar', badge: 'CUSTOM', order: 7 };
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
        const key = card.dataset.deviceId;
        const item = api.catalog[key];
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

    function filter() {
      const query = normalize(search.value); let visible = 0; let total = 0;
      sidebar.querySelectorAll('.device-card').forEach(card => {
        decorate(card); const item = api.catalog[card.dataset.deviceId]; if (!item) { card.hidden = true; return; }
        total++;
        const matches = (!query || normalize([item.name, item.modelTag, item.desc, card.dataset.deviceId].join(' ')).includes(query)) && (!category.value || item.category === category.value) && (!units.value || item.u === Number(units.value)) && (!favoriteOnly.checked || favorites.has(card.dataset.deviceId));
        card.hidden = !matches; if (matches) visible++;
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

