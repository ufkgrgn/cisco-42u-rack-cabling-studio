/* Workspace composition. Existing controls and renderers retain their identities. */
(() => {
  'use strict';
  const RS = window.RackStudio;
  const controls = new Map([...document.querySelectorAll('[id]')].map(el => [el.id, el]));
  const get = id => document.getElementById(id) || controls.get(id);
  const element = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  };
  const button = (id, text, action, icon) => {
    const el = element('button', 'workspace-button', text);
    el.type = 'button'; el.id = id;
    if (icon) el.dataset.icon = icon;
    if (action) el.addEventListener('click', action);
    return el;
  };
  const append = (host, ...ids) => ids.forEach(id => { const el = get(id); if (el) host.append(el); });
  function compose() {
    const header = get('unified-header');
    header.className = 'workspace-header';
    const brand = element('div', 'workspace-brand', 'Rack Studio');
    brand.insertAdjacentHTML('afterbegin', window.getLucideIconSvg?.('Server', 18) || '');
    const project = button('workspace-project', '', () => RS.ProjectManager?.open?.(), 'FolderOpen');
    project.setAttribute('aria-label', 'Proje kayıtlarını aç');
    project.append(element('span', 'workspace-project-name'), element('small', 'workspace-storage-status'));
    get('hud-tools-menu').className = 'workspace-menu';
    get('hud-tools-panel').className = 'workspace-menu-panel';
    const actions = element('div', 'workspace-header-actions');
    append(actions, 'btn-3d-undo', 'btn-3d-redo', 'btn-command-palette', 'btn-help', 'hud-tools-menu');
    get('btn-command-palette').textContent = 'Komut ara';
    get('btn-tools-menu-toggle').textContent = 'Menü';
    get('btn-tools-menu-toggle').dataset.icon = 'Menu';
    const editing = element('div', 'hud-tools-section');
    editing.append(element('span', 'hud-tools-label', 'Düzenleme'));
    for (const [id, label, icon] of [['btn-3d-undo', 'Geri al', 'Undo2'], ['btn-3d-redo', 'Yeniden yap', 'Redo2'], ['btn-command-palette', 'Komut ara', 'Search']]) {
      const shortcut = button('workspace-menu-' + id, label, null, icon);
      shortcut.dataset.shortcutFor = id; editing.append(shortcut);
    }
    get('hud-tools-panel').querySelector('.tools-panel-heading').after(editing);
    const toolbar = element('nav', 'workspace-toolbar');
    toolbar.id = 'workspace-toolbar'; toolbar.setAttribute('aria-label', 'Görünüm araçları');
    const library = button('workspace-library-toggle', 'Donanım', () => RS.WorkspaceUI.openPanel('hardware'), 'PanelLeft');
    library.setAttribute('aria-controls', 'sidebar-left'); library.dataset.helpId = 'devices';
    toolbar.append(library);
    append(toolbar, 'rack-selector-wrapper');
    const modeGroup = get('controls-2d-group'); modeGroup.className = 'workspace-mode-group';
    get('studio-work-mode-switch').className = 'workspace-segments';
    get('studio-work-mode-switch').style.position = '';
    get('btn-mode-layout').textContent = 'Yerleşim';
    get('btn-mode-cabling').textContent = 'Kablolama';
    const views = document.querySelector('.view-switch-segmented'); views.className = 'workspace-segments workspace-render-mode';
    const options = get('compact-view-menu'); options.className = 'workspace-options';
    const optionsButton = get('btn-compact-view'); optionsButton.className = 'workspace-button';
    optionsButton.innerHTML = 'Görünüm <svg class="workspace-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    optionsButton.dataset.icon = 'none';
    const panel = get('compact-view-panel'); panel.className = 'workspace-view-panel';
    const viewHead = element('header', 'workspace-view-heading');
    viewHead.append(element('strong', '', 'Görünüm'), button('workspace-view-close', 'Kapat', () => RS.WorkspaceUI.closePanel(), 'X')); panel.prepend(viewHead);
    const sub = get('cabling-sub-popover'); sub.className = 'workspace-cable-options'; sub.style.display = ''; sub.hidden = false;
    const twoD = get('compact-view-2d');
    twoD.querySelectorAll('[data-shortcut-for="btn-toggle-cables"], [data-shortcut-for="btn-toggle-port-numbers"], [data-shortcut-for="btn-view-mode-single"], [data-shortcut-for="btn-view-mode-multi"]').forEach(el => el.remove());
    twoD.append(sub, get('rack-view-mode-switch'));
    append(panel, 'device-label-control');
    const performance = document.querySelector('label[for="performance-mode"]'); panel.append(performance);
    const threeD = get('controls-3d-group'); threeD.className = 'workspace-camera-group';
    toolbar.append(modeGroup, views, threeD, options);
    const selection = button('workspace-inspector-toggle', 'Özellikler', () => RS.WorkspaceUI.openPanel('selection'), 'PanelRight');
    selection.setAttribute('aria-controls', 'sidebar-right'); toolbar.append(selection);
    header.replaceChildren(brand, project, actions);
    header.after(toolbar);

    const frame = element('div', 'workspace-frame'); frame.id = 'workspace-frame';
    toolbar.after(frame);
    const scene = element('div', 'workspace-scene'); scene.id = 'workspace-scene';
    const left = get('sidebar-left'), right = get('sidebar-right');
    left.className = 'workspace-library'; right.className = 'workspace-inspector';
    frame.append(left, scene, right);
    const canvasArea = element('div', 'workspace-canvas-area');
    canvasArea.id = 'workspace-canvas-area'; scene.append(canvasArea);
    append(canvasArea, 'legacy-wrapper', 'studio3d-wrapper');
    const status = document.querySelector('.status-bar'); status.className = 'workspace-status';
    frame.after(status);
    const nav = element('nav', 'workspace-mobile-nav'); nav.setAttribute('aria-label', 'Düzenleme panelleri');
    nav.append(button('btn-mobile-catalog', 'Donanım', () => RS.WorkspaceUI.openPanel('hardware'), 'Server'),
      button('btn-mobile-view', 'Görünüm', () => RS.WorkspaceUI.openPanel('view'), 'Eye'),
      button('btn-mobile-selection', 'Seçim', () => RS.WorkspaceUI.openPanel('selection'), 'PanelRight'));
    status.before(nav);
    // The previous mobile controls were detached with the old header.
    const caption = element('div', 'workspace-canvas-caption');
    caption.append(element('span', 'studio-view-note')); caption.firstChild.id = 'studio-view-note';
    const types = element('details', 'workspace-device-types'); types.id = 'workspace-device-types';
    types.append(element('summary', '', 'Cihaz türleri')); caption.append(types);
    const viewport = get('rack-viewport'); viewport.prepend(caption);
    const footer = element('div', 'workspace-canvas-footer');
    footer.append(get('viewport-zoom-dock')); viewport.append(footer);
    get('viewport-zoom-dock').className = 'workspace-zoom';
    const cableTools = get('btn-cable-tools');
    cableTools.className = 'workspace-button'; panel.append(cableTools);
    const cableDock = get('viewport-cable-dock'); cableDock.className = 'workspace-cable-dock'; panel.append(cableDock);
    get('viewport-bottom-hint').hidden = true;
    const asideHead = element('div', 'workspace-panel-heading');
    asideHead.append(element('h2', '', 'Özellikler'), button('workspace-panel-close', 'Kapat', () => RS.WorkspaceUI.closePanel(), 'X'));
    const tabs = element('div', 'workspace-inspector-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Özellik paneli');
    for (const [id, label] of [['selection', 'Seçim'], ['devices', 'Cihazlar'], ['connections', 'Bağlantılar']]) {
      const tab = button('workspace-tab-' + id, label, () => RS.WorkspaceUI.openPanel(id));
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', 'workspace-content-' + id); tabs.append(tab);
    }
    const contents = element('div', 'workspace-inspector-body');
    for (const id of ['selection', 'devices', 'connections']) {
      const content = element('section', 'workspace-tab-content'); content.id = 'workspace-content-' + id;
      content.setAttribute('role', 'tabpanel'); content.setAttribute('aria-labelledby', 'workspace-tab-' + id); contents.append(content);
    }
    const connections = contents.lastChild;
    [...right.children].filter(el => !el.matches('.sidebar-right-resizer')).forEach(el => connections.append(el));
    right.replaceChildren(asideHead, tabs, contents);
    const help = button('workspace-panel-help', 'Bu bölüm ne işe yarar?', () => RS.Help?.open(activeTab === 'connections' ? 'cabling' : 'devices'), 'CircleHelp');
    right.append(help);
    get('btn-toggle-right-sidebar')?.remove();
    document.querySelector('.mobile-schedule-tabs')?.remove(); get('btn-mobile-schedule-close')?.remove();
    // Keep a single catalog header and use its close action on overlay screens.
    get('btn-toggle-left-sidebar')?.addEventListener('click', () => RS.WorkspaceUI.closePanel());
  }

  let activeTab = 'selection', activePanel = null, opener, desktopView = null, wasPhone = false, screenClass = '';
  try { const saved = JSON.parse(localStorage.getItem('rackstudio-workspace-ui') || '{}'); if (['selection', 'devices', 'connections'].includes(saved.activeTab)) activeTab = saved.activeTab; } catch (_) {}
  const phone = () => matchMedia('(max-width: 767px)').matches;
  const overlay = () => matchMedia('(max-width: 1199px)').matches;
  function sync() {
    const left = get('sidebar-left'), right = get('sidebar-right');
    const compact = overlay();
    const hardware = activePanel === 'hardware', view = activePanel === 'view';
    left.hidden = compact && !hardware; right.hidden = compact && !activePanel || hardware || view;
    // Desktop tabs remain visible independently of the selected studio mode.
    if (!compact) { left.hidden = document.body.dataset.workflow === 'presentation'; right.hidden = false; }
    left.inert = left.hidden; right.inert = right.hidden;
    left.classList.toggle('workspace-overlay', compact && hardware);
    right.classList.toggle('workspace-overlay', compact && !right.hidden);
    const panel = get('compact-view-panel');
    panel.classList.toggle('workspace-overlay', phone() && view);
    if (phone()) { panel.hidden = !view; get('btn-compact-view').setAttribute('aria-expanded', String(view)); }
    get('workspace-scene').inert = compact && !!activePanel;
    get('workspace-scrim').hidden = !compact || !activePanel;
    document.body.dataset.workspacePanel = activePanel || '';
    for (const id of ['selection', 'devices', 'connections']) {
      const selected = activeTab === id;
      get('workspace-tab-' + id).setAttribute('aria-selected', String(selected));
      get('workspace-tab-' + id).tabIndex = selected ? 0 : -1;
      get('workspace-content-' + id).hidden = !selected;
    }
    for (const [id, value] of [['btn-mobile-catalog', hardware], ['btn-mobile-view', view], ['btn-mobile-selection', !!activePanel && !hardware && !view], ['workspace-library-toggle', hardware], ['workspace-inspector-toggle', !!activePanel && !hardware && !view]]) get(id)?.setAttribute('aria-expanded', String(value));
    get('workspace-panel-close').hidden = !compact;
  }
  function openPanel(id, trigger) {
    if (!['hardware', 'view', 'selection', 'devices', 'connections'].includes(id)) return;
    if (overlay() && activePanel === id) { closePanel(); return; }
    opener = trigger || document.activeElement;
    if (['selection', 'devices', 'connections'].includes(id)) {
      activeTab = id;
      try { localStorage.setItem('rackstudio-workspace-ui', JSON.stringify({ version: 1, activeTab })); } catch (_) {}
    }
    activePanel = overlay() ? id : null;
    if (id === 'view') { get('compact-view-panel').hidden = false; get('btn-compact-view').setAttribute('aria-expanded', 'true'); }
    sync();
    if (overlay()) (id === 'hardware' ? get('sidebar-left') : id === 'view' ? get('compact-view-panel') : get('sidebar-right')).querySelector('button:not([hidden]), input, select')?.focus({ preventScroll: true });
  }
  function closePanel() {
    activePanel = null;
    get('compact-view-panel').hidden = true; get('btn-compact-view').setAttribute('aria-expanded', 'false');
    sync(); opener?.focus({ preventScroll: true });
  }
  function resize() {
    const mobile = phone();
    const views = document.querySelector('.workspace-render-mode');
    if (mobile) {
      document.body.append(get('compact-view-panel'));
      get('compact-view-panel').insertBefore(views, get('compact-view-2d'));
    } else {
      get('compact-view-menu').append(get('compact-view-panel'));
      get('controls-2d-group').after(views);
    }
    if (mobile && !wasPhone) { desktopView = RS.STATE.viewMode; RS.setViewMode?.('single', true); }
    if (!mobile && wasPhone && desktopView) RS.setViewMode?.(desktopView, true);
    const nextScreen = mobile ? 'phone' : overlay() ? 'overlay' : 'desktop';
    if (nextScreen !== screenClass) { activePanel = null; get('compact-view-panel').hidden = true; }
    screenClass = nextScreen; wasPhone = mobile; sync();
  }
  function refresh() {
    const doc = RS.STATE.projectDocument;
    if (!doc) return;
    sync();
    document.querySelector('.workspace-project-name').textContent = doc?.metadata?.name || 'Kabin projesi';
    document.querySelector('.workspace-storage-status').textContent = document.getElementById('studio-save')?.textContent || 'Yerel proje';

    for (const proxy of document.querySelectorAll('[data-shortcut-for]')) {
      const state = window.UIActions?.getState(proxy.dataset.shortcutFor);
      if (!state) continue;
      proxy.disabled = !state.enabled;
      if (state.pressed !== null) proxy.setAttribute('aria-pressed', String(state.pressed));
      proxy.title = state.reason || state.label;
    }
    // Desktop keeps selected-device shortcuts; touch uses the inspector.
    const deviceActions = document.getElementById('device-floating-controls');
    if (deviceActions) deviceActions.hidden = overlay() || matchMedia('(pointer: coarse)').matches || !!window.is3DMode || document.body.dataset.workflow === 'presentation';

  }
  function syncStudioMode() {
    const wrapper = get('studio3d-wrapper');
    if (!wrapper || wrapper.dataset.workspaceBound) return;
    wrapper.dataset.workspaceBound = 'true';
    get('compact-view-3d').append(get('btn-3d-catalog'));
    const palette = get('cable-palette-bar');
    palette.className = 'workspace-3d-palette'; get('compact-view-3d').append(palette);
    const footer = element('div', 'workspace-canvas-footer workspace-3d-footer');
    const zoom = document.querySelector('.mobile-3d-controls');
    zoom.className = 'workspace-3d-zoom'; footer.append(zoom);
    const fit = button('workspace-3d-fit', 'Sığdır', () => window.__STUDIO3D__?.fitCameraToRacks('front'), 'Scan'); footer.append(fit);
    wrapper.append(footer);
  }
  compose();
  const scrim = button('workspace-scrim', '', closePanel); scrim.className = 'workspace-scrim'; scrim.setAttribute('aria-label', 'Paneli kapat'); document.body.append(scrim);
  RS.WorkspaceUI = Object.freeze({ openPanel, closePanel, refresh, syncStudioMode, resetLayout: () => { activeTab = 'selection'; closePanel(); }, getState: () => ({ activeTab, activePanel, phone: phone(), overlay: overlay() }) });
  window.setLeftSidebarCollapsed = collapsed => collapsed ? closePanel() : openPanel('hardware');
  window.setRightSidebarCollapsed = collapsed => collapsed ? closePanel() : openPanel('connections');
  document.querySelector('.workspace-inspector-tabs').addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault(); const ids = ['selection', 'devices', 'connections'];
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (ids.indexOf(activeTab) + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
    activeTab = ids[next]; sync(); get('workspace-tab-' + activeTab).focus();
  });
  window.addEventListener('resize', resize, { passive: true });
  for (const type of ['rackstudio:change', 'rackstudio:refresh', 'rackstudio:selection', 'rackstudio:viewchange', 'rackstudio:studio-work-mode', 'rackstudio:persistence']) document.addEventListener(type, refresh);
  document.addEventListener('keydown', e => { if (e.ctrlKey && e.key.toLowerCase() === 'b') { e.preventDefault(); activePanel === 'hardware' ? closePanel() : openPanel('hardware'); } });
  document.addEventListener('DOMContentLoaded', () => {
    resize(); refresh(); RS.WorkflowSelection?.refresh();
    const save = get('studio-save');
    if (save) new MutationObserver(refresh).observe(save, {childList: true, characterData: true, subtree: true});
  });
  sync();
})();
