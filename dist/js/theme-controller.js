/**
 * Light / dark theme controller for Rack Studio chrome.
 * Persists preference under rack-studio-theme (dark | light).
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'rack-studio-theme';
  const DEFAULT_THEME = 'dark';

  function normalizeTheme(value) {
    return value === 'light' ? 'light' : 'dark';
  }

  function getStoredTheme() {
    try {
      return normalizeTheme(localStorage.getItem(STORAGE_KEY));
    } catch (_) {
      return DEFAULT_THEME;
    }
  }

  function applyTheme(theme) {
    const next = normalizeTheme(theme);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_) { /* storage may be blocked */ }
    syncToggleUi(next);
    return next;
  }

  function syncToggleUi(theme) {
    const btn = document.getElementById('btn-theme-toggle');
    if (!btn) return;
    const isLight = theme === 'light';
    btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
    btn.title = isLight ? 'Koyu temaya geç' : 'Açık temaya geç';
    btn.textContent = isLight ? '🌙' : '☀️';
    btn.setAttribute('aria-label', btn.title);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || getStoredTheme();
    return applyTheme(current === 'light' ? 'dark' : 'light');
  }

  // Apply early to avoid flash when script loads after first paint of chrome
  applyTheme(getStoredTheme());

  function initThemeToggle() {
    applyTheme(getStoredTheme());
    document.getElementById('btn-theme-toggle')?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleTheme();
    });
  }

  window.RackStudioTheme = {
    apply: applyTheme,
    toggle: toggleTheme,
    get: () => document.documentElement.getAttribute('data-theme') || getStoredTheme()
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeToggle);
  } else {
    initThemeToggle();
  }
})();
