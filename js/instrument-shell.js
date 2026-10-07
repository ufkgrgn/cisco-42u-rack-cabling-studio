/**
 * Quiet canvas chrome: first-use hint, field mode,
 * and the 2D connection list as the schedule surface.
 */
(function () {
  'use strict';

  const HINT_KEY = 'rack_studio_viewport_hint_dismissed';

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
    window.setLeftSidebarCollapsed?.(true);
    window.setRightSidebarCollapsed?.(false);
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
      if(window.RackStudio?.WorkflowViews){window.RackStudio.WorkflowViews.set(window.RackStudio.WorkflowViews.get()==='field'?'design':'field');return;}
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
      if (!compactViewPanel.hidden) compactViewPanel.querySelector('button:not([disabled])')?.focus();
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
    bindHintOnFirstUse();
    bindSchedule();
    bindFieldMode();
    bindCableTools();
    document.querySelectorAll('[data-shortcut-for]').forEach(button => {
      button.addEventListener('click', () => window.UIActions?.run(button.dataset.shortcutFor));
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
