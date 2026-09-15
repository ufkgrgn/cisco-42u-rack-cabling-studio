// ============================================================================
// DeviceContainer: 3-Tier Multi-LOD Device Twin
// ============================================================================

import { Container, Graphics, Text } from 'pixi.js';
import { DeviceInstance, DeviceCatalogItem } from '../../core/types';
import { LODTier } from './types';

export class DeviceContainer extends Container {
  public readonly instance: DeviceInstance;
  public readonly catalogItem: DeviceCatalogItem;
  public readonly uHeight: number;
  public readonly heightPx: number;
  public readonly widthPx = 528; // 480px chassis + 2 * 24px rack ears

  // Sub-containers for zero-GC LOD switching
  public overviewView: Container;
  public standardView: Container;
  public detailedView: Container;

  public activeFace: 'front' | 'rear' = 'front';
  private _isSelected = false;
  private _selectionBorder: Graphics;

  constructor(instance: DeviceInstance, catalogItem: DeviceCatalogItem) {
    super();
    this.instance = instance;
    this.catalogItem = catalogItem;
    this.uHeight = instance.uHeight || catalogItem.u || 1;
    this.heightPx = this.uHeight * 32;

    this.overviewView = new Container();
    this.standardView = new Container();
    this.detailedView = new Container();
    this._selectionBorder = new Graphics();

    this.addChild(this.overviewView);
    this.addChild(this.standardView);
    this.addChild(this.detailedView);
    this.addChild(this._selectionBorder);

    this.buildOverview();
    this.buildStandard();
    this.buildDetailed();

    // Default to standard view
    this.setLOD(LODTier.STANDARD);
  }

  public setActiveFace(face: 'front' | 'rear'): void {
    if (this.activeFace === face) return;
    this.activeFace = face;
    this.rebuildAllViews();
  }

  public setViewFace(face: 'front' | 'rear'): void {
    this.setActiveFace(face);
  }

  private rebuildAllViews(): void {
    for (let i = this.overviewView.children.length - 1; i >= 0; i--) {
      const c = this.overviewView.children[i];
      if (c) {
        this.overviewView.removeChild(c);
        c.destroy({ children: true });
      }
    }
    for (let i = this.standardView.children.length - 1; i >= 0; i--) {
      const c = this.standardView.children[i];
      if (c) {
        this.standardView.removeChild(c);
        c.destroy({ children: true });
      }
    }
    for (let i = this.detailedView.children.length - 1; i >= 0; i--) {
      const c = this.detailedView.children[i];
      if (c) {
        this.detailedView.removeChild(c);
        c.destroy({ children: true });
      }
    }
    this.buildOverview();
    this.buildStandard();
    this.buildDetailed();
  }

  public setLOD(tier: LODTier): void {
    switch (tier) {
      case LODTier.OVERVIEW:
        this.overviewView.visible = true;
        this.standardView.visible = false;
        this.detailedView.visible = false;
        break;
      case LODTier.STANDARD:
        this.overviewView.visible = false;
        this.standardView.visible = true;
        this.detailedView.visible = false;
        break;
      case LODTier.DETAILED:
        this.overviewView.visible = false;
        this.standardView.visible = true;
        this.detailedView.visible = true;
        break;
    }
  }

  public setSelected(selected: boolean): void {
    this._isSelected = selected;
    this._selectionBorder.clear();
    if (selected) {
      this._selectionBorder
        .rect(0, 0, this.widthPx, this.heightPx)
        .stroke({ color: 0x38bdf8, width: 2 });
    }
  }

  public get isSelected(): boolean {
    return this._isSelected;
  }

  private buildOverview(): void {
    const g = new Graphics();
    // Solid category-colored silhouette bar
    const catColor = this.getCategoryColor(this.catalogItem.category);
    g.rect(24, 0, 480, this.heightPx)
      .fill({ color: catColor, alpha: 0.85 })
      .stroke({ color: 0x334155, width: 1 });
    this.overviewView.addChild(g);
  }

  private buildStandard(): void {
    const g = new Graphics();
    const isViewingRearOfFrontDevice = this.activeFace === 'rear' && this.instance.face === 'front';

    if (isViewingRearOfFrontDevice) {
      // Rear metallic chassis facia with fan exhaust and PSU outlines
      g.roundRect(24, 0, 480, this.heightPx, 2)
        .fill({ color: 0x111622 })
        .stroke({ color: 0x2b394f, width: 1 });

      // Left and right mounting ears
      g.rect(0, 0, 24, this.heightPx).fill({ color: 0x1f293d });
      g.rect(504, 0, 24, this.heightPx).fill({ color: 0x1f293d });

      // Screw holes in ears
      for (let u = 0; u < this.uHeight; u++) {
        const cy = u * 32 + 16;
        g.circle(12, cy, 3).fill({ color: 0x475569 });
        g.circle(516, cy, 3).fill({ color: 0x475569 });
      }

      // PSU bay outline
      g.rect(380, 4, 100, Math.max(16, this.heightPx - 8))
        .fill({ color: 0x090d14 })
        .stroke({ color: 0x1e293b, width: 1 });

      // Fan exhaust grilles
      const fanRadius = Math.min(11, Math.max(6, (this.heightPx - 8) / 2));
      g.circle(280, this.heightPx / 2, fanRadius)
        .fill({ color: 0x090d14 })
        .stroke({ color: 0x334155, width: 1 });
      if (this.heightPx >= 64) {
        g.circle(320, this.heightPx / 2, fanRadius)
          .fill({ color: 0x090d14 })
          .stroke({ color: 0x334155, width: 1 });
      }

      this.standardView.addChild(g);

      // Rear label
      const label = new Text({
        text: `${this.catalogItem.id} [REAR]`,
        style: { fill: 0x94a3b8, fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' },
      });
      label.position.set(34, Math.max(0, (this.heightPx - 12) / 2));
      this.standardView.addChild(label);
      return;
    }

    // Chassis body
    g.roundRect(24, 0, 480, this.heightPx, 2)
      .fill({ color: 0x151c28 })
      .stroke({ color: 0x2b394f, width: 1 });

    // Left and right mounting ears
    g.rect(0, 0, 24, this.heightPx).fill({ color: 0x1f293d });
    g.rect(504, 0, 24, this.heightPx).fill({ color: 0x1f293d });

    // Screw holes in ears
    for (let u = 0; u < this.uHeight; u++) {
      const cy = u * 32 + 16;
      g.circle(12, cy, 3).fill({ color: 0x475569 });
      g.circle(516, cy, 3).fill({ color: 0x475569 });
    }

    // Category accent stripe
    const catColor = this.getCategoryColor(this.catalogItem.category);
    g.rect(26, 0, 4, this.heightPx).fill({ color: catColor });

    // Major port outlines / blocks
    const portCount = this.catalogItem.ports?.length || 0;
    if (portCount > 0) {
      const blockWidth = Math.min(300, portCount * 6);
      g.rect(150, 4, blockWidth, this.heightPx - 8)
        .fill({ color: 0x090d14 })
        .stroke({ color: 0x1e293b, width: 1 });
    }

    this.standardView.addChild(g);

    // Label: Model Name & U Badge
    const label = new Text({
      text: `${this.catalogItem.id} [${this.uHeight}U]`,
      style: { fill: 0xe2e8f0, fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' },
    });
    label.position.set(34, Math.max(0, (this.heightPx - 12) / 2));
    this.standardView.addChild(label);
  }

  private buildDetailed(): void {
    const g = new Graphics();
    let ports = this.catalogItem.ports || [];

    if (this.activeFace === 'rear') {
      if (this.instance.face === 'front') {
        ports = this.catalogItem.rearPorts || [];
      } else {
        ports = this.catalogItem.ports || [];
      }
    } else {
      if (this.instance.face === 'rear') {
        ports = [];
      }
    }

    // Detailed connector pins and status LEDs with normalized coordinate support
    ports.forEach((port, idx) => {
      let px: number;
      let py: number;

      if (port.xPct !== undefined && port.yPct !== undefined) {
        px = 24 + port.xPct * 480;
        py = port.yPct * this.heightPx;
      } else {
        px = 160 + (idx % 24) * 12;
        py = 6 + Math.floor(idx / 24) * 14;
      }

      if (port.type === 'rj45') {
        // RJ45 port with gold pins
        g.rect(px, py, 10, 10).fill({ color: 0x0f172a }).stroke({ color: 0x38bdf8, width: 0.5 });
        g.circle(px + 5, py + 2, 1).fill({ color: 0x22c55e }); // Link LED
      } else if (port.type === 'sfp' || port.type === 'sfp+' || port.type === 'qsfp28') {
        // SFP cage with metal latch
        g.rect(px, py, 10, 12).fill({ color: 0x334155 }).stroke({ color: 0x94a3b8, width: 0.5 });
        g.circle(px + 5, py + 1, 1).fill({ color: 0x38bdf8 }); // Optical LED
      } else if (port.type === 'c13' || port.type === 'c14') {
        g.rect(px, py, 12, 10).fill({ color: 0x1e293b }).stroke({ color: 0xf59e0b, width: 0.5 });
      } else {
        g.rect(px, py, 10, 10).fill({ color: 0x1e293b }).stroke({ color: 0x64748b, width: 0.5 });
      }
    });

    this.detailedView.addChild(g);
  }

  private getCategoryColor(category?: string): number {
    switch (category) {
      case 'router':
        return 0x3b82f6; // Blue
      case 'switch':
        return 0x06b6d4; // Cyan
      case 'server':
        return 0x10b981; // Emerald
      case 'patch-panel':
        return 0x8b5cf6; // Purple
      case 'pdu':
        return 0xf59e0b; // Amber
      case 'organizer':
        return 0x64748b; // Slate
      default:
        return 0x475569;
    }
  }
}
