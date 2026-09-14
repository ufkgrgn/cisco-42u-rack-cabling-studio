// ============================================================================
// DragGhost: Interactive Hardware Drag Ghost with Unit Snapping & Collision
// ============================================================================

import { Container, Graphics, Text } from 'pixi.js';

export class DragGhost extends Container {
  private _bg: Graphics;
  private _label: Text;
  private _width = 528;
  private _height = 32;

  public isValid = false;
  public reason = '';

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 1000;

    this._bg = new Graphics();
    this._label = new Text({
      text: '',
      style: { fill: 0xffffff, fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold' },
    });
    this._label.position.set(16, 8);

    this.addChild(this._bg);
    this.addChild(this._label);
  }

  public updateVisuals(params: {
    catalogId: string;
    uHeight: number;
    isValid: boolean;
    snappedU?: number;
    reason?: string;
  }): void {
    this.isValid = params.isValid;
    this.reason = params.reason ?? '';
    this._width = 528;
    this._height = params.uHeight * 32;
    this._bg.clear();

    if (params.isValid && params.snappedU !== undefined) {
      // Cyan glow highlight for valid slot snap
      this._bg
        .roundRect(0, 0, this._width, this._height, 3)
        .fill({ color: 0x0284c7, alpha: 0.45 })
        .stroke({ color: 0x38bdf8, width: 2 });

      const uRange =
        params.uHeight > 1
          ? `U${params.snappedU}-U${params.snappedU + params.uHeight - 1}`
          : `U${params.snappedU}`;

      this._label.text = `✓ SNAP ${uRange} | ${params.catalogId}`;
      this._label.style.fill = 0x38bdf8;
    } else {
      // Crimson red tint for collision / invalid bounds
      this._bg
        .roundRect(0, 0, this._width, this._height, 3)
        .fill({ color: 0xef4444, alpha: 0.45 })
        .stroke({ color: 0xf87171, width: 2 });

      this._label.text = `✗ ${params.reason || 'CONFLICT'} | ${params.catalogId}`;
      this._label.style.fill = 0xf87171;
    }

    this._label.position.set(16, Math.max(0, (this._height - 14) / 2));
  }

  public show(): void {
    this.visible = true;
  }

  public hide(): void {
    this.visible = false;
    this.isValid = false;
    this.reason = '';
  }
}
