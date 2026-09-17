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
    const search = make('input'); search.type = 'search'; search.placeholder = 'Model, üretici veya port ara…'; search.setAttribute('aria-label', 'Donanım kataloğunda ara');
    const category = make('select'); category.setAttribute('aria-label', 'Donanım kategorisi');
    [['', 'Tüm kategoriler'], ['switch', 'Switch'], ['router', 'Router'], ['fiber-switch', 'Fiber switch'], ['compact', 'Kompakt'], ['patch', 'Patch panel'], ['fiber', 'Fiber panel'], ['organizer', 'Organizatör'], ['blank', 'Boş panel'], ['custom', 'Özel donanım']].forEach(([value, label]) => { const option = make('option', label); option.value = value; category.append(option); });
    const units = make('input'); units.type = 'number'; units.min = '1'; units.max = '60'; units.placeholder = 'U yüksekliği'; units.setAttribute('aria-label', 'U yüksekliğine göre filtrele');
    const favoriteLabel = make('label', undefined, 'catalog-favorite-filter'); const favoriteOnly = make('input'); favoriteOnly.type = 'checkbox'; favoriteLabel.append(favoriteOnly, document.createTextNode(' Yalnızca favoriler'));
    const count = make('div', '', 'catalog-count'); count.setAttribute('aria-live', 'polite');
    toolbar.append(search, category, units, favoriteLabel, count);
    sidebar.insertBefore(toolbar, sidebar.children[1] || null);
    const customSection = make('section', undefined, 'panel-section catalog-custom');
    const details = make('details'); details.append(make('summary', '+ Özel donanım oluştur'));
    const form = make('form', undefined, 'catalog-custom-form');
    function field(label, type, value) { const wrapper = make('label', label); const input = make('input'); input.type = type; if (value !== undefined) input.value = value; wrapper.append(input); form.append(wrapper); return input; }
    const name = field('Model adı', 'text'); name.required = true; name.maxLength = 100;
    const height = field('Yükseklik (U)', 'number', '1'); height.min = '1'; height.max = '60'; height.required = true;
    const ports = field('Port sayısı', 'number', '24'); ports.min = '0'; ports.max = '96'; ports.required = true;
    const typeLabel = make('label', 'Port tipi'); const type = make('select'); type.setAttribute('aria-label', 'Port tipi'); ['rj45', 'sfp', 'lc'].forEach(value => { const option = make('option', value.toUpperCase()); option.value = value; type.append(option); }); typeLabel.append(type); form.append(typeLabel);
    const submit = make('button', 'Kaydet ve seç'); submit.type = 'submit'; form.append(submit);
    const message = make('div', '', 'catalog-count'); message.setAttribute('role', 'status'); form.append(message); details.append(form);
    const customCards = make('div'); customSection.append(details, customCards); toolbar.after(customSection);
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
    function filter() {
      const query = normalize(search.value); let visible = 0; let total = 0;
      sidebar.querySelectorAll('.device-card').forEach(card => {
        decorate(card); const item = api.catalog[card.dataset.deviceId]; if (!item) { card.hidden = true; return; }
        total++;
        const matches = (!query || normalize([item.name, item.modelTag, item.desc, card.dataset.deviceId].join(' ')).includes(query)) && (!category.value || item.category === category.value) && (!units.value || item.u === Number(units.value)) && (!favoriteOnly.checked || favorites.has(card.dataset.deviceId));
        card.hidden = !matches; if (matches) visible++;
      });
      sidebar.querySelectorAll('.panel-section').forEach(section => { if (section === toolbar || section === customSection) return; const cards = [...section.querySelectorAll('.device-card')]; if (cards.length) section.hidden = cards.every(card => card.hidden); });
      count.textContent = `${visible} / ${total} donanım${visible ? '' : ' — filtreleri değiştirin'}`;
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
          card.title = `${item.name} (${item.u}U) - ${item.ports.length} Port Özel Donanım`;
          const bezel = make('div', undefined, 'hw-mini-bezel bezel-custom');
          bezel.innerHTML = '<div class="mini-bezel-ear"><div class="mini-screw-hole"></div></div><div class="mini-bezel-face"><span class="mini-cisco-text" style="color:#10b981;">CUSTOM</span><span class="mini-led-dot mini-led-green"></span></div><div class="mini-bezel-ear"><div class="mini-screw-hole"></div></div>';
          const info = make('div', undefined, 'hw-info');
          info.append(make('span', item.name, 'device-name'));
          const badge = make('span', `${item.u}U`, 'device-u-badge');
          const desc = make('div', `${item.ports.length} port · Özel donanım`, 'device-desc');
          desc.style.display = 'none';
          card.append(bezel, info, badge, desc);
          card.addEventListener('click', () => selectCustom(key)); customCards.append(card);
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

