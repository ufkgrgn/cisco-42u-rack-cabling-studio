/**
 * 3D Studio Helper & Device Analysis Functions
 */
const escapeTooltipHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  function getDeviceVisualKind(dev) {
    const catalogId = dev.catalogId || '';
    const isFiber = dev.portType === 'fiber-adapter' || dev.portType === 'lc' || dev.portType === 'sc' ||
      catalogId.includes('fiber') || catalogId.includes('odf');
    if (isFiber && (dev.category === 'patch-panel' || dev.category === 'fiber')) return 'fiber-panel';
    if (dev.category === 'patch-panel' || dev.category === 'patch') return 'patch-panel';
    if (dev.category === 'switch') return 'switch';
    if (dev.category === 'router') return 'router';
    if (dev.category === 'server') return 'server';
    return 'other';
  }

  function getDevicePortLayout(dev) {
    const count = Math.max(0, Number(dev.portsCount) || 0);
    const uplinks = dev.category === 'switch' ? Math.min(count, Math.max(0, Number(dev.uplinks) || 0)) : 0;
    const primary = count - uplinks;
    const stackedSwitch = dev.category === 'switch' && primary >= 16 && dev.portType !== 'qsfp28';
    const stackedPatch = dev.category === 'patch-panel' && primary > 24;
    const primaryColumns = stackedSwitch ? Math.ceil(primary / 2) : stackedPatch ? 24 : Math.max(1, primary);
    const uplinkColumns = uplinks ? Math.ceil(uplinks / 2) : 0;
    return { count, uplinks, primary, stackedSwitch, stackedPatch, primaryColumns, uplinkColumns };
  }

  function inferSwitchUplinks(cat) {
    if (!cat || cat.category !== 'switch') return 0;
    if (Number.isFinite(Number(cat.uplinks))) return Math.max(0, Number(cat.uplinks));
    const ports = Array.isArray(cat.ports) ? cat.ports : [];
    const explicit = ports.filter(port => /^up/i.test(port.id || '') || /uplink/i.test(`${port.name || ''} ${port.speed || ''}`)).length;
    if (explicit) return explicit;
    if (ports.length > 48) return ports.length - 48;
    if (ports.length > 24 && ports.length <= 32) return ports.length - 24;
    return 0;
  }

function disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse(child => {
    if (child.geometry) {
      child.geometry.dispose();
    }
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => {
        if (!m) return;
        ['map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap', 'envMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach(texKey => {
          if (m[texKey] && typeof m[texKey].dispose === 'function') {
            m[texKey].dispose();
          }
        });
        if (typeof m.dispose === 'function') {
          m.dispose();
        }
      });
    }
  });
}

export {
  escapeTooltipHtml,
  getDeviceVisualKind,
  getDevicePortLayout,
  inferSwitchUplinks,
  disposeObject3D
};
