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
  RS.PixiDeviceChassis = Object.freeze({ create });
})();
