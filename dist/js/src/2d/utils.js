/**
 * Common formatting, HTML and tooltip utilities
 */
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export const portKey = (instanceId, portId) => JSON.stringify([instanceId, portId]);

export function showTemporaryTooltip(x, y, msg, domTooltip) {
  const el = domTooltip || document.getElementById('tooltip');
  if (!el) return;
  el.style.display = 'block';
  el.style.left = `${x + 10}px`;
  el.style.top = `${y + 10}px`;
  el.innerHTML = `<span style="color:#f59e0b;">&#9888; ${msg}</span>`;
  setTimeout(() => { if (el) el.style.display = 'none'; }, 2500);
}
