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
    const stencilHoverPreview = make('div', undefined, 'catalog-stencil-hover-preview');
    const stencilHoverImage = document.createElement('img');
    stencilHoverImage.alt = '';
    stencilHoverPreview.setAttribute('aria-hidden', 'true');
    stencilHoverPreview.append(stencilHoverImage);
    document.body.append(stencilHoverPreview);
    let stencilHoverGeneration = 0;
    let stencilHoverTimer = 0;
    let stencilHoverClearTimer = 0;

    function hideStencilHoverPreview() {
      stencilHoverGeneration++;
      clearTimeout(stencilHoverTimer);
      stencilHoverPreview.classList.remove('visible');
      clearTimeout(stencilHoverClearTimer);
      stencilHoverClearTimer = setTimeout(() => { stencilHoverImage.removeAttribute('src'); }, 1800);
    }

    function showStencilHoverPreview(sourceImage, anchor, originalStencilUrl = '') {
      if (!sourceImage?.src) return;
      const generation = ++stencilHoverGeneration;
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
      // Only decode the authentic (sometimes multi-megabyte) stencil after a
      // deliberate hover pause; the card itself always uses a tiny generated SVG.
      if (originalStencilUrl) {
        stencilHoverTimer = setTimeout(() => {
          if (generation === stencilHoverGeneration) stencilHoverImage.src = originalStencilUrl;
        }, 120);
      }
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
        actualPreview.addEventListener('click', () => showStencilHoverPreview(generated, actualPreview, stencilUrl));
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

