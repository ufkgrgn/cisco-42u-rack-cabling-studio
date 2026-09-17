/**
 * Cisco Enterprise Rack & Cabling Studio - 2D Utilities
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));

  const portKey = (instanceId, portId) => JSON.stringify([instanceId, portId]);

  function showTemporaryTooltip(x, y, msg, domTooltip) {
    const el = domTooltip || (RS.dom && RS.dom.tooltip) || document.getElementById('tooltip');
    if (!el) return;
    el.style.display = 'block';
    el.style.left = `${x + 10}px`;
    el.style.top = `${y + 10}px`;
    el.innerHTML = `<span style="color:#f59e0b;">&#9888; ${msg}</span>`;
    clearTimeout(el._tipTimer);
    el._tipTimer = setTimeout(() => {
      if (el) el.style.display = 'none';
    }, 2500);
  }

  RS.escapeHtml = escapeHtml;
  RS.portKey = portKey;
  RS.showTemporaryTooltip = showTemporaryTooltip;
})();
