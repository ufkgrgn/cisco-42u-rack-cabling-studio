/**
 * Quiet canvas chrome: empty-rack start, first-use hint, field mode,
 * and the 2D connection list as the schedule surface.
 */
(function () {
  'use strict';

  const EMPTY_KEY = 'rack-studio-empty-start-dismissed';
  const HINT_KEY = 'rack_studio_viewport_hint_dismissed';

  function activeRack() {
    const RS = window.RackStudio;
    return RS?.getActiveRack ? RS.getActiveRack() : RS?.STATE?.racks?.[0];
  }

  function rackIsEmpty() {
    const rack = activeRack();
    return !rack || !(rack.devices || []).length;
  }

  function ensureEmptyState() {
    const canvas = document.getElementById('viewport-canvas');
    if (!canvas || document.getElementById('rack-empty-state')) return;
    const panel = document.createElement('div');
    panel.id = 'rack-empty-state';
    panel.className = 'rack-empty-state';
    panel.hidden = true;
    panel.innerHTML = `
      <h2>Boş kabin</h2>
      <p>Bir şablonla başlayın ya da kütüphaneden ilk cihazı yerleştirin.</p>
      <div class="rack-empty-actions">
        <button type="button" class="primary" data-start="mdf">MDF</button>
        <button type="button" data-start="idf">IDF</button>
        <button type="button" data-start="empty">Boş 42U</button>
      </div>`;
    canvas.appendChild(panel);
    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const kind = btn.dataset.start;
      if (kind === 'empty') {
        try { sessionStorage.setItem(EMPTY_KEY, '1'); } catch (_) {}
        syncEmptyState();
        return;
      }
      const id = kind === 'idf' ? 'btn-3d-preset-idf' : 'btn-3d-preset-mdf';
      document.getElementById(id)?.click();
    });
  }

  function syncEmptyState() {
    const panel = document.getElementById('rack-empty-state');
    if (!panel) return;
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(EMPTY_KEY) === '1'; } catch (_) {}
    const show = rackIsEmpty() && !dismissed && !window.is3DMode;
    panel.hidden = !show;
    if (!rackIsEmpty()) {
      try { sessionStorage.removeItem(EMPTY_KEY); } catch (_) {}
    }
  }

  function dismissHint() {
    const hint = document.getElementById('viewport-bottom-hint');
    if (!hint || hint.classList.contains('is-dismissed')) return;
    hint.classList.add('is-dismissed');
    try { localStorage.setItem(HINT_KEY, '1'); } catch (_) {}
  }

  function bindHintOnFirstUse() {
    const canvas = document.getElementById('viewport-canvas');
    if (!canvas || canvas.dataset.hintBound === '1') return;
    canvas.dataset.hintBound = '1';
    canvas.addEventListener('pointerdown', () => dismissHint(), { once: true });
  }

  function focusSchedule() {
    const side = document.getElementById('sidebar-right');
    side?.classList.remove('collapsed');
    document.getElementById('inspector-info')?.scrollIntoView({ block: 'nearest' });
  }

  function bindSchedule() {
    document.getElementById('btn-3d-schedule-modal')?.addEventListener('click', (e) => {
      if (window.is3DMode) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      focusSchedule();
    }, true);
  }

  function bindFieldMode() {
    const btn = document.getElementById('btn-field-mode');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const on = document.body.classList.toggle('field-mode');
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('active', on);
      if (on) focusSchedule();
    });
  }

  function bindCableTools() {
    const trigger = document.getElementById('btn-cable-tools');
    const panel = document.getElementById('viewport-cable-dock');
    if (!trigger || !panel) return;
    const close = () => {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    };
    trigger.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      trigger.setAttribute('aria-expanded', String(!panel.hidden));
    });
    document.addEventListener('pointerdown', event => {
      if (!panel.hidden && !panel.contains(event.target) && event.target !== trigger) close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) {
        close();
        trigger.focus();
      }
    });
  }

  function refresh() {
    syncEmptyState();
    if (typeof window.updateTelemetry === 'function') window.updateTelemetry();
  }

  function init() {
    const compactViewTrigger = document.getElementById('btn-compact-view');
    const compactViewPanel = document.getElementById('compact-view-panel');
    compactViewTrigger?.addEventListener('click', () => {
      if (!compactViewPanel) return;
      compactViewPanel.hidden = !compactViewPanel.hidden;
      compactViewTrigger.setAttribute('aria-expanded', String(!compactViewPanel.hidden));
      compactViewPanel.querySelectorAll('[data-shortcut-for]').forEach(button => {
        button.setAttribute('aria-pressed', String(document.getElementById(button.dataset.shortcutFor)?.classList.contains('active') || false));
      });
    });
    compactViewPanel?.addEventListener('click', event => {
      if (!event.target.closest('[data-shortcut-for]')) return;
      compactViewPanel.hidden = true;
      compactViewTrigger?.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('pointerdown', event => {
      if (compactViewPanel && !compactViewPanel.hidden && !event.target.closest('#compact-view-menu')) {
        compactViewPanel.hidden = true;
        compactViewTrigger?.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && compactViewPanel && !compactViewPanel.hidden) {
        compactViewPanel.hidden = true;
        compactViewTrigger?.setAttribute('aria-expanded', 'false');
        compactViewTrigger?.focus();
      }
    });
    ensureEmptyState();
    bindHintOnFirstUse();
    bindSchedule();
    bindFieldMode();
    bindCableTools();
    document.querySelectorAll('[data-shortcut-for]').forEach(button => {
      button.addEventListener('click', () => document.getElementById(button.dataset.shortcutFor)?.click());
    });
    document.addEventListener('rackstudio:change', refresh);
    document.addEventListener('rackstudio:rackswitched', refresh);
    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
