/** Shared visual language for placement cards and their legend. */
(function () {
  'use strict';
  const RS = window.RackStudio;
  // label, accent, light surface, dark surface, light text
  const profiles = {
    switch: ['Switch', '#3577bb', '#dceafb', '#193451', '#17416d'],
    patch: ['Patch panel', '#158775', '#d8eee8', '#173e38', '#165c50'],
    fiber: ['Fiber panel', '#9270c5', '#eae2f5', '#382c50', '#60458a'],
    organizer: ['Organizatör', '#c88b2c', '#f4e7cd', '#46391e', '#75511b'],
    router: ['Router', '#c36e55', '#f4e1da', '#4b2e29', '#844732'],
    power: ['Güç / PDU', '#b65d87', '#f3dfeb', '#472a3d', '#84415f'],
    blank: ['Kapak panel', '#87929e', '#e2e6ea', '#303942', '#49545f'],
    other: ['Diğer cihaz', '#5b8c9a', '#deebef', '#263d46', '#355b67']
  };
  function profileKey(category) {
    if (['switch', 'fiber-switch', 'compact'].includes(category)) return 'switch';
    if (['pdu', 'ups', 'power'].includes(category)) return 'power';
    return profiles[category] ? category : 'other';
  }
  function profile(category) {
    const key = profileKey(category), p = profiles[key];
    const theme = document.documentElement.dataset.theme;
    const dark = theme !== 'light';
    return { key, label: p[0], accent: p[1], surface: dark ? p[3] : p[2], text: dark ? '#f1f5f9' : p[4], highContrast: theme === 'high-contrast' };
  }
  function describe(device, rack) {
    const cat = RS.resolveCatalogItem?.(device.catalogKey) || RS.HARDWARE_CATALOG?.[device.catalogKey] || {};
    const source = rack?.devices?.find(d => d.instanceId === device.instanceId) || device;
    const category = cat.category || device.category || 'other';
    const uHeight = source.uHeight || Math.max(1, Math.round((device.height || 32) / 32));
    const top = source.topU;
    const position = top ? (uHeight > 1 ? `U${top - uHeight + 1}–${top}` : `U${top}`) : `${uHeight}U`;
    let model = String(cat.modelTag || cat.name || device.catalogKey || 'Cihaz');
    const brand = cat.brand || cat.vendor || (/^cisco-/i.test(device.catalogKey) ? 'Cisco' : '');
    if (brand && !model.toLowerCase().includes(String(brand).toLowerCase())) model = `${brand} ${model}`;
    const hostname = String(source.hostname || source.name || '').trim();
    return { model, hostname, position, uHeight, category, profile: profile(category) };
  }
  const numericColor = hex => parseInt(hex.slice(1), 16);
  const metadataSignature = device => JSON.stringify([device?.name, device?.hostname, device?.topU, device?.uHeight]);
  function text(textValue, size, fill, weight = '600') {
    const t = new window.PIXI.Text({ text: textValue, style: {
      fontFamily: 'Inter, Segoe UI, sans-serif', fontSize: size, fontWeight: weight, fill: numericColor(fill)
    } });
    t.eventMode = 'none';
    t.anchor.set(0, 0.5);
    return t;
  }
  function fitText(label, maxWidth) {
    if (label.width > maxWidth) label.style.fontSize = Math.max(16, label.style.fontSize * maxWidth / label.width);
    const value = label.text;
    let length = value.length;
    while (label.width > maxWidth && length > 1) label.text = value.slice(0, --length) + '…';
  }
  function createPixiLayer(device) {
    const rack = RS.STATE.racks.find(r => r.id === device.rackId) || RS.getActiveRack();
    const info = describe(device, rack), p = info.profile;
    const layer = new window.PIXI.Container();
    layer.label = `device-layout-${device.instanceId}`;
    layer.layoutMetadata = metadataSignature(rack?.devices.find(d => d.instanceId === device.instanceId));
    layer.eventMode = 'none';
    const w = device.width, h = device.height, inset = 2;
    const g = new window.PIXI.Graphics();
    g.roundRect(inset, inset, w - 4, h - 4, 3).fill({ color: numericColor(p.surface) });
    g.roundRect(inset, inset, w - 4, h - 4, 3).stroke({ color: numericColor(p.highContrast ? '#ffffff' : p.accent), width: p.highContrast ? 2 : 1, alpha: 0.8 });
    g.rect(3, 4, 5, h - 8).fill({ color: numericColor(p.accent) });
    const multiLine = h >= 56;
    const type = text(p.label.toLocaleUpperCase('tr-TR'), 11, p.text);
    type.position.set(18, multiLine ? h / 2 + 13 : h / 2);
    // A fixed type column makes neighboring devices easy to compare.
    const model = text(info.model, multiLine ? 25 : 22, p.text, '700');
    model.position.set(124, multiLine ? h / 2 - 10 : h / 2);
    const u = text(info.position, 15, p.text, '700');
    u.anchor.set(1, 0.5);
    u.position.set(w - 14, h / 2);
    fitText(model, Math.max(40, w - 124 - u.width - 28));
    layer.addChild(g, type, model, u);
    if (multiLine && info.hostname && info.hostname !== info.model) {
      const host = text(info.hostname, 14, p.text, '500');
      host.position.set(124, h / 2 + 15);
      fitText(host, Math.max(40, w - 124 - u.width - 28));
      layer.addChild(host);
    }
    const el = document.getElementById(device.instanceId);
    el?.setAttribute('aria-label', `${p.label} · ${info.model} · ${info.hostname ? info.hostname + ' · ' : ''}${info.position}`);
    if (el) el.title = `${info.model}${info.hostname ? ' · ' + info.hostname : ''} · ${info.position}`;
    return layer;
  }
  function refreshLabels(entries) {
    if (!entries) return;
    const owners = new Map(RS.STATE.racks.flatMap(rack => rack.devices.map(device => [device.instanceId, device])));
    entries.forEach(entry => {
      if (entry.macroLabel.layoutMetadata === metadataSignature(owners.get(entry.device.instanceId))) return;
      const previous = entry.macroLabel, next = createPixiLayer(entry.device);
      next.visible = previous.visible;
      entry.container.addChildAt(next, entry.container.getChildIndex(previous));
      entry.container.removeChild(previous); previous.destroy({ children: true });
      entry.macroLabel = next;
    });
  }
  RS.DeviceLayoutPresentation = Object.freeze({ profiles, profile, profileKey, describe, createPixiLayer, refreshLabels });
})();
