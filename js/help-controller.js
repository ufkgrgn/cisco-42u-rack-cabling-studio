(function () {
  'use strict';
  const RS = window.RackStudio, catalog = RS.HelpCatalog;
  const node = (tag, text, className) => { const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; };
  const button = (text, fn) => { const el = node('button', text); el.type = 'button'; el.addEventListener('click', fn); return el; };
  let tooltip, target, timer;
  function hideTip() {
    clearTimeout(timer);
    if (target && tooltip) {
      const ids = (target.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== tooltip.id);
      if (ids.length) target.setAttribute('aria-describedby', ids.join(' ')); else target.removeAttribute('aria-describedby');
    }
    tooltip?.remove(); tooltip = null; target = null;
  }
  function showTip(el) {
    hideTip();
    const activeDialog = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (activeDialog && !activeDialog.contains(el)) return;
    const topic = catalog.topics[el.dataset.helpId];
    if (!topic || el.disabled) return;
    target = el;
    tooltip = node('div', topic.summary, 'help-tooltip'); tooltip.id = 'studio-help-tooltip'; tooltip.setAttribute('role', 'tooltip');
    (el.closest('dialog[open]') || document.body).append(tooltip);
    el.setAttribute('aria-describedby', ((el.getAttribute('aria-describedby') || '') + ' ' + tooltip.id).trim());
    const rect = el.getBoundingClientRect(), bounds = tooltip.getBoundingClientRect();
    tooltip.style.left = Math.max(8, Math.min(rect.left, innerWidth - bounds.width - 8)) + 'px';
    tooltip.style.top = Math.max(8, Math.min(rect.bottom + 8, innerHeight - bounds.height - 8)) + 'px';
  }
  function bind(root) {
    if (!(root instanceof Element) && root !== document) return;
    const contexts = { '#modal-port-edit': 'ports', '#modal-dev-edit': 'devices', '.project-manager': 'projects', '.revision-manager': 'projects', '.field-workflow-dialog': 'field', '.field-observations-dialog': 'field', '.delivery-dialog': 'delivery' };
    const selector = Object.keys(contexts).join(',');
    const surfaces = [...root.querySelectorAll(selector)];
    const parent = root.closest?.(selector); if (parent) surfaces.push(parent);
    for (const surface of surfaces) {
      const header = surface.querySelector('header, .modal-header');
      if (!header || header.querySelector('[data-help-open]')) continue;
      const id = Object.entries(contexts).find(([key]) => surface.matches(key))[1];
      const help = button('Bu bölümün yardımı', () => {}); help.className = 'section-help-button'; help.dataset.helpOpen = id; header.append(help);
    }
    const elements = [...root.querySelectorAll('[id], [data-shortcut-for], [data-help-id]')];
    if (root instanceof Element) elements.unshift(root);
    for (const el of elements) {
      const id = el.dataset.helpId || catalog.controls[el.id] || catalog.controls[el.dataset.shortcutFor];
      if (!id || !catalog.topics[id]) continue;
      el.dataset.helpId = id;
      // Rich accessible descriptions replace duplicate native title bubbles.
      if (el.title) { el.dataset.originalTitle = el.title; el.removeAttribute('title'); }
      if (el.dataset.helpBound) continue;
      el.dataset.helpBound = 'true';
      el.addEventListener('mouseenter', () => { clearTimeout(timer); timer = setTimeout(() => showTip(el), 400); });
      el.addEventListener('mouseleave', hideTip);
      el.addEventListener('focus', () => showTip(el));
      el.addEventListener('blur', hideTip);
      el.addEventListener('click', hideTip);
    }
  }
  function open(topicId) {
    hideTip();
    const existing = document.getElementById('help-dialog');
    if (existing) { existing.close(); }
    const opener = document.activeElement, dialog = node('dialog', '', 'help-dialog'); dialog.id = 'help-dialog';
    const title = node('h2', 'Yardım'); title.id = 'help-dialog-title'; dialog.setAttribute('aria-labelledby', title.id);
    const header = node('header', '', 'help-header');
    const heading = node('div'); heading.append(node('span', 'RACK STUDIO · KULLANIM REHBERİ', 'help-eyebrow'), title, node('p', 'İhtiyacınız olan bilgi, çalıştığınız yerde.'));
    header.append(heading, button('Kapat', () => dialog.close()));
    const nav = node('nav', '', 'help-tabs'); nav.setAttribute('aria-label', 'Yardım bölümleri');
    const content = node('section', '', 'help-content');
    let active = topicId && catalog.topics[topicId] ? 'functions' : 'start';
    const tabs = [['start', 'Başlangıç rehberi'], ['functions', 'İşlevler'], ['terms', 'Terimler'], ['shortcuts', 'Kısayollar']];
    function render(section, selected) {
      active = section; content.replaceChildren();
      [...nav.children].forEach((btn, i) => btn.setAttribute('aria-pressed', String(tabs[i][0] === active)));
      if (active === 'start') {
        const steps = node('ol', '', 'help-start-steps');
        for (const text of ['Cihazı kabine yerleştirin', 'Kablolama görünümüne geçin', 'Kaynak ve hedef portu seçin', 'Bağlantı listesinde kontrol edin']) steps.append(node('li', text));
        content.append(node('h3', 'İlk bağlantınızı oluşturun'), node('p', 'Ayrı bir örnek projede cihaz yerleştirme ve port bağlamayı öğrenin. Mevcut projeniz korunur.'), steps, button('Başlangıç rehberini aç', () => { dialog.close(); RS.Onboarding.open().catch(error => window.UIActions?.notify(error.message)); }));
      } else if (active === 'functions') {
        const select = node('select'); select.setAttribute('aria-label', 'İşlev seçin');
        for (const [id, topic] of Object.entries(catalog.topics)) { const option = node('option', topic.title); option.value = id; select.append(option); }
        select.value = selected && catalog.topics[selected] ? selected : 'devices';
        const article = node('article', '', 'help-article');
        function detail() {
          const topic = catalog.topics[select.value]; article.replaceChildren(node('h3', topic.title));
          for (const [label, value] of [['Ne işe yarar', topic.summary], ['Ne zaman kullanılır', topic.when], ['Nasıl kullanılır', topic.how], ['Örnek', topic.example]]) {
            const block = node('section', '', 'help-explanation'); block.append(node('h4', label), node('p', value)); article.append(block);
          }
        }
        select.addEventListener('change', detail); content.append(select, article); detail();
      } else if (active === 'terms') {
        const list = node('dl'); for (const [term, text] of Object.entries(catalog.terms)) list.append(node('dt', term), node('dd', text)); content.append(list);
      } else {
        content.append(node('p', 'Metin alanlarında yazarken çizim kısayolları kullanılmaz. Kontrollerin güncel kısayolları yanlarındaki açıklamalarda da gösterilir.'));
        const list = node('dl');
        for (const [key, text] of [['Ctrl+Z', 'Son işlemi geri al'], ['Ctrl+Y', 'Geri alınan işlemi yinele'], ['Ctrl+K', 'Komut aramasını aç'], ['Escape', 'Açık açıklamayı veya geçerli port seçimini kapat'], ['Shift + port tıklaması', 'Port ayarlarını aç'], ['C', 'Kablolama görünümünde kabloları göster / gizle'], ['N', 'Port numaralarını göster / gizle']]) list.append(node('dt', key), node('dd', text));
        content.append(list);
      }
    }
    tabs.forEach(([id, text]) => nav.append(button(text, () => render(id))));
    const body = node('div', '', 'help-body'); body.append(nav, content);
    dialog.append(header, body); document.body.append(dialog);
    dialog.addEventListener('close', () => { hideTip(); dialog.remove(); if (opener?.isConnected) opener.focus(); });
    dialog.addEventListener('keydown', event => { if (event.key === 'Escape' && tooltip) { event.preventDefault(); event.stopPropagation(); hideTip(); } });
    render(active, topicId); dialog.showModal();
  }
  function clampTooltip(el) {
    if (!el || el.style.display === 'none') return;
    const rect = el.getBoundingClientRect();
    el.style.left = Math.max(8, Math.min(rect.left, innerWidth - rect.width - 8)) + 'px';
    el.style.top = Math.max(8, Math.min(rect.top, innerHeight - rect.height - 8)) + 'px';
  }
  RS.Help = Object.freeze({ open, clampTooltip });
  document.getElementById('btn-help')?.addEventListener('click', () => open());
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-help-open]');
    if (trigger) { event.preventDefault(); open(trigger.dataset.helpOpen); }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !tooltip) return;
    const activeDialog = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (activeDialog && !activeDialog.contains(tooltip)) { hideTip(); return; }
    hideTip(); event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  window.addEventListener('resize', hideTip);
  document.addEventListener('scroll', hideTip, true);
  bind(document);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') { bind(record.target); continue; }
      for (const added of record.addedNodes) if (added instanceof Element) bind(added);
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['title'] });
})();
