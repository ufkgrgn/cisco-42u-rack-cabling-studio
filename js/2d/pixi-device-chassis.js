/** Detail chassis factory; presentation switches retain these GPU objects. */
(function () {
  'use strict';
  const RS = window.RackStudio;
  function create(device, coverOpen) {
    const textures = RS.FaceplateTextures;
    const spec = {
      category: device.category || '', catalogKey: device.catalogKey || '',
      uHeight: Math.max(1, Math.round((device.height || 32) / 32)), series: device.series || ''
    };
    const slice = textures.chassisSlice(spec);
    if (slice.mode === 'graphics') {
      const overlays = new window.PIXI.Graphics();
      overlays.eventMode = 'none';
      textures.paintChassisGraphics(overlays, spec, device.width, device.height, coverOpen);
      if (spec.category === 'blank' && window.PIXI.Text) {
        const label = new window.PIXI.Text({ text: 'BLANK COVER PANEL', style: {
          fontFamily: 'ui-monospace, monospace', fontSize: 9, fill: 0x475569, letterSpacing: 1
        } });
        label.anchor?.set(0.5); label.position.set(device.width / 2, device.height / 2);
        label.eventMode = 'none'; overlays.addChild(label);
      }
      return { chassis: null, overlays };
    }
    const texture = textures.getChassisTexture(spec);
    if (!texture) return { chassis: null, overlays: null };
    const chassis = new window.PIXI.NineSliceSprite({ texture,
      leftWidth: slice.leftWidth, rightWidth: slice.rightWidth,
      topHeight: slice.topHeight, bottomHeight: slice.bottomHeight,
      width: device.width, height: device.height
    });
    chassis.eventMode = 'none';
    return { chassis, overlays: null };
  }
  let flatPortTexture;
  function getFlatPortTexture() {
    if (flatPortTexture) return flatPortTexture;
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#cbd5e1'; ctx.fillRect(2, 2, 28, 28);
    ctx.fillStyle = '#334155'; ctx.fillRect(5, 5, 22, 22);
    flatPortTexture = window.PIXI.Texture.from(canvas);
    return flatPortTexture;
  }
  function createFlat(device) {
    const info = RS.DeviceLayoutPresentation.describe(device);
    const color = hex => parseInt(hex.slice(1), 16);
    const layer = new window.PIXI.Container(); layer.eventMode = 'none';
    const background = new window.PIXI.Graphics();
    background.rect(0, 1, device.width, device.height - 2).fill(color(info.profile.surface));
    background.rect(0, 1, 4, device.height - 2).fill(color(info.profile.accent));
    const label = new window.PIXI.Text({ text: info.model, style: { fontFamily: 'Inter, Segoe UI, sans-serif', fontSize: 12, fontWeight: '600', fill: color(info.profile.text) } });
    label.anchor.set(0, 0.5); label.position.set(12, device.height / 2);
    layer.addChild(background, label); return layer;
  }
  RS.PixiDeviceChassis = Object.freeze({ create, createFlat, getFlatPortTexture });
})();
