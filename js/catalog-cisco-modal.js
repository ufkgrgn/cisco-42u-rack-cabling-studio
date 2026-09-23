/**
 * Cisco Enterprise Rack & Cabling Studio - Cisco Master Switch Catalog Modal
 * Provides visual browser modal for Cisco Catalyst / Nexus models, filtering by
 * series, port count (24p/48p), PoE, fiber uplinks, and mounting to active rack.
 */
(function () {
  'use strict';

  function initCiscoCatalogModal(api, onRestore) {
    if (!api) api = window.RackStudio;
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

    const escapeHtml = api?.escapeHtml || (value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
    const normalize = window.CatalogStencil?.normalize || (value => String(value || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]/g, ''));

    const make = (tag, text, className) => {
      const node = document.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (className) node.className = className;
      return node;
    };

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

    if (railCiscoBtn) railCiscoBtn.addEventListener('click', openCiscoModal);
    if (btnOpenCisco) btnOpenCisco.addEventListener('click', openCiscoModal);
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
      if (!api) api = window.RackStudio;
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
      api.refresh?.();
      if (typeof onRestore === 'function') onRestore();

      const toast = document.getElementById('studio-toast');
      if (toast) {
        toast.textContent = `✓ ${model.name} kütüphanenize eklendi!`;
        toast.className = 'show';
        setTimeout(() => { toast.className = ''; }, 3000);
      }
    }

    function mountModelToActiveRack(model) {
      if (!api) api = window.RackStudio;
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
      api.refresh?.();

      const toast = document.getElementById('studio-toast');
      if (toast) {
        toast.textContent = `✓ ${model.name} U${placedU} seviyesine monte edildi!`;
        toast.className = 'show';
        setTimeout(() => { toast.className = ''; }, 3000);
      }
    }

    function renderCiscoCards() {
      if (!ciscoCardsGrid) return;
      if (!api) api = window.RackStudio;
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

    return {
      openCiscoModal,
      closeCiscoModal,
      renderCiscoCards,
      addModelToLibrary,
      mountModelToActiveRack
    };
  }

  window.CiscoCatalogModal = {
    init: initCiscoCatalogModal
  };
})();
