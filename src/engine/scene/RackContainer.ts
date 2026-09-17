// ============================================================================
// RackContainer: 42U EIA-310-D Cabinet Twin with RenderGroup Isolation
// ============================================================================

import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { RackModel, DeviceCatalogItem } from '../../core/types';
import { DeviceContainer } from './DeviceContainer';
import { LODTier } from './types';

export class RackContainer extends Container {
  public readonly rackId: string;
  public totalU: number;
  public readonly rackWidth = 634; // EIA-310-D: 53 + 24 + 480 + 24 + 53
  public rackHeight: number; // totalU * 32 + 64px
  public activeFace: 'front' | 'rear' = 'front';

  // Sub-containers
  public frameGraphics: Graphics;
  public railsGraphics: Graphics;
  public uSlotsContainer: Container;
  public devicesContainer: Container;
  public badgeContainer: Container; // Overview LOD summary badge
  public highlightGraphics: Graphics;

  public deviceMap = new Map<string, DeviceContainer>();
  public currentLOD = LODTier.STANDARD;

  private _rackName: string;
  private _headerTitle: Text | null = null;

  constructor(rack: RackModel) {
    super({
      isRenderGroup: true, // Crucial: isolates GPU batch & transforms!
      cullable: true,
      cullArea: new Rectangle(0, 0, 634, rack.totalU * 32 + 64),
    });

    this.rackId = rack.id;
    this._rackName = rack.name;
    this.totalU = rack.totalU;
    this.rackHeight = this.totalU * 32 + 64;
    this.position.set(rack.positionX ?? 0, 0);

    this.frameGraphics = new Graphics();
    this.railsGraphics = new Graphics();
    this.uSlotsContainer = new Container();
    this.devicesContainer = new Container();
    this.badgeContainer = new Container();
    this.highlightGraphics = new Graphics();

    this.addChild(this.frameGraphics);
    this.addChild(this.railsGraphics);
    this.addChild(this.uSlotsContainer);
    this.addChild(this.devicesContainer);
    this.addChild(this.badgeContainer);
    this.addChild(this.highlightGraphics);

    this.renderRackFrame(this._rackName);
    this.renderEIAMountingRails();
    this.renderUSlots();
    this.renderOverviewBadge(rack);
    this.setLOD(LODTier.STANDARD);
  }

  public setLOD(tier: LODTier): void {
    this.currentLOD = tier;
    switch (tier) {
      case LODTier.OVERVIEW:
        this.railsGraphics.visible = false;
        this.uSlotsContainer.visible = false;
        this.badgeContainer.visible = true;
        break;
      case LODTier.STANDARD:
      case LODTier.DETAILED:
        this.railsGraphics.visible = true;
        this.uSlotsContainer.visible = true;
        this.badgeContainer.visible = false;
        break;
    }

    for (const dev of this.deviceMap.values()) {
      dev.setLOD(tier);
    }
  }

  public setTotalU(newTotalU: number, name?: string): void {
    if (name) this._rackName = name;
    this.totalU = newTotalU;
    this.rackHeight = newTotalU * 32 + 64;
    this.cullArea = new Rectangle(0, 0, this.rackWidth, this.rackHeight);

    this.renderRackFrame(this._rackName);
    this.renderEIAMountingRails();
    this.renderUSlots();
    this.renderOverviewBadge({
      id: this.rackId,
      name: this._rackName,
      totalU: this.totalU,
      widthMm: 600,
      depthMm: 1000,
      maxLoadKg: 1000,
      positionX: this.x,
      devices: [],
    });

    // Re-align mounted device containers according to the new totalU
    for (const dev of this.deviceMap.values()) {
      const topUnit = dev.instance.startU + dev.instance.uHeight - 1;
      const localY = 32 + (this.totalU - topUnit) * 32;
      dev.position.set(53, localY);
    }
  }

  public setActiveFace(face: 'front' | 'rear'): void {
    this.activeFace = face;
    if (this._headerTitle) {
      this._headerTitle.text = `${this._rackName.toUpperCase()} (${this.totalU}U EIA-310-D) [${face.toUpperCase()}]`;
    }
    for (const dev of this.deviceMap.values()) {
      dev.setActiveFace(face);
    }
  }

  public setViewFace(face: 'front' | 'rear'): void {
    this.setActiveFace(face);
  }

  public syncDevices(
    devices: RackModel['devices'],
    catalog: Map<string, DeviceCatalogItem>
  ): void {
    const activeInstanceIds = new Set(devices.map((d) => d.instanceId));

    // Remove deleted devices
    for (const [id, container] of this.deviceMap.entries()) {
      if (!activeInstanceIds.has(id)) {
        this.devicesContainer.removeChild(container);
        container.destroy({ children: true });
        this.deviceMap.delete(id);
      }
    }

    // Add or update devices
    for (const d of devices) {
      const catalogItem = catalog.get(d.catalogId) || {
        id: d.catalogId,
        name: d.catalogId,
        category: 'switch',
        u: d.uHeight,
        manufacturer: 'Cisco',
        ports: [],
      };

      let devContainer = this.deviceMap.get(d.instanceId);
      if (!devContainer) {
        devContainer = new DeviceContainer(d, catalogItem);
        devContainer.setActiveFace(this.activeFace);
        this.deviceMap.set(d.instanceId, devContainer);
        this.devicesContainer.addChild(devContainer);
      }

      // Position device in EIA-310-D coordinates:
      // X = 53px (left cable channel offset)
      // Y = 32px (top header offset) + (totalU - (startU + uHeight - 1)) * 32px
      const localX = 53;
      const topUnit = d.startU + d.uHeight - 1;
      const localY = 32 + (this.totalU - topUnit) * 32;

      if (devContainer.x !== localX || devContainer.y !== localY) {
        devContainer.position.set(localX, localY);
      }
      if (devContainer.currentLOD !== this.currentLOD) {
        devContainer.setLOD(this.currentLOD);
      }
    }
  }

  public getSlotBounds(startU: number, uHeight: number): { x: number; y: number; width: number; height: number } {
    const topUnit = startU + uHeight - 1;
    return {
      x: this.x + 53,
      y: this.y + 32 + (this.totalU - topUnit) * 32,
      width: 528,
      height: uHeight * 32,
    };
  }

  private renderRackFrame(name: string): void {
    const g = this.frameGraphics;
    g.clear();

    // Outer Cabinet Silhouette
    g.roundRect(0, 0, this.rackWidth, this.rackHeight, 4)
      .fill({ color: 0x0c1017 })
      .stroke({ color: 0x2b394f, width: 2 });

    // Top Header
    g.rect(0, 0, this.rackWidth, 32).fill({ color: 0x1a2333 });
    // Bottom Plinth
    g.rect(0, this.rackHeight - 32, this.rackWidth, 32).fill({ color: 0x161f2f });

    // Header Title
    const titleText = `${name.toUpperCase()} (${this.totalU}U EIA-310-D) [${this.activeFace.toUpperCase()}]`;
    if (!this._headerTitle) {
      this._headerTitle = new Text({
        text: titleText,
        style: { fill: 0x38bdf8, fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold' },
      });
      this._headerTitle.position.set(16, 9);
      this.addChild(this._headerTitle);
    } else {
      this._headerTitle.text = titleText;
    }
  }

  private renderEIAMountingRails(): void {
    const g = this.railsGraphics;
    g.clear();

    // Vertical Left & Right Rails
    g.rect(53, 32, 24, this.totalU * 32);
    g.rect(557, 32, 24, this.totalU * 32);
    g.fill({ color: 0x111722 });

    // EIA-310-D standard 3-hole pattern per 1U (Batched into a single fill)
    // Centers at 0.25", 0.875", 1.50" relative to U top (offsets: [4.57, 16.0, 27.43] px)
    const holeOffsets = [4.57, 16.0, 27.43];
    for (let u = 0; u < this.totalU; u++) {
      const yBase = 32 + u * 32;
      holeOffsets.forEach((offset) => {
        g.rect(62, yBase + offset - 1.5, 4, 3);
        g.rect(566, yBase + offset - 1.5, 4, 3);
      });
    }
    g.fill({ color: 0x1e293b });
  }

  private renderUSlots(): void {
    for (let i = this.uSlotsContainer.children.length - 1; i >= 0; i--) {
      const child = this.uSlotsContainer.children[i];
      if (child) {
        this.uSlotsContainer.removeChild(child);
        child.destroy({ children: true });
      }
    }
    const g = new Graphics();

    // Batched slot divider lines (Single fill call for all U slots)
    for (let u = 1; u <= this.totalU; u++) {
      const slotY = 32 + (this.totalU - u) * 32;
      g.rect(77, slotY, 480, 1);

      // U Number Label (on left rail)
      if (u === 1 || u === this.totalU || u % 5 === 0) {
        const uLabel = new Text({
          text: `U${u}`,
          style: { fill: 0x64748b, fontSize: 9, fontFamily: 'monospace' },
          resolution: 1,
        });
        uLabel.position.set(56, slotY + 11);
        this.uSlotsContainer.addChild(uLabel);
      }
    }
    g.fill({ color: 0x161f2c });
    this.uSlotsContainer.addChildAt(g, 0);
  }

  private renderOverviewBadge(rack: RackModel): void {
    for (let i = this.badgeContainer.children.length - 1; i >= 0; i--) {
      const child = this.badgeContainer.children[i];
      if (child) {
        this.badgeContainer.removeChild(child);
        child.destroy({ children: true });
      }
    }

    const g = new Graphics();
    g.roundRect(100, Math.max(0, this.rackHeight / 2 - 80), 434, 160, 8)
      .fill({ color: 0x0f172a, alpha: 0.95 })
      .stroke({ color: 0x38bdf8, width: 2 });

    this.badgeContainer.addChild(g);

    const text = new Text({
      text: `${rack.name}\n${this.totalU}U Cabinet [${this.activeFace.toUpperCase()}]\nDevices: ${rack.devices?.length || 0}\nMax Load: ${rack.maxLoadKg || 1000} kg`,
      style: {
        fill: 0xffffff,
        fontSize: 16,
        fontFamily: 'monospace',
        fontWeight: 'bold',
        align: 'center',
        lineHeight: 28,
      },
    });
    text.position.set(200, Math.max(0, this.rackHeight / 2 - 60));
    this.badgeContainer.addChild(text);
  }
}
