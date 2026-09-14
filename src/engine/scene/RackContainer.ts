// ============================================================================
// RackContainer: 42U EIA-310-D Cabinet Twin with RenderGroup Isolation
// ============================================================================

import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { RackModel, DeviceCatalogItem } from '../../core/types';
import { DeviceContainer } from './DeviceContainer';
import { LODTier } from './types';

export class RackContainer extends Container {
  public readonly rackId: string;
  public readonly totalU: number;
  public readonly rackWidth = 634; // EIA-310-D: 53 + 24 + 480 + 24 + 53
  public readonly rackHeight: number; // totalU * 32 + 64px

  // Sub-containers
  public frameGraphics: Graphics;
  public railsGraphics: Graphics;
  public uSlotsContainer: Container;
  public devicesContainer: Container;
  public badgeContainer: Container; // Overview LOD summary badge
  public highlightGraphics: Graphics;

  public deviceMap = new Map<string, DeviceContainer>();
  public currentLOD = LODTier.STANDARD;

  constructor(rack: RackModel) {
    super({
      isRenderGroup: true, // Crucial: isolates GPU batch & transforms!
      cullable: true,
      cullArea: new Rectangle(0, 0, 634, rack.totalU * 32 + 64),
    });

    this.rackId = rack.id;
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

    this.renderRackFrame(rack.name);
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
        this.deviceMap.set(d.instanceId, devContainer);
        this.devicesContainer.addChild(devContainer);
      }

      // Position device in EIA-310-D coordinates:
      // X = 53px (left cable channel offset)
      // Y = 32px (top header offset) + (totalU - (startU + uHeight - 1)) * 32px
      const localX = 53;
      const topUnit = d.startU + d.uHeight - 1;
      const localY = 32 + (this.totalU - topUnit) * 32;

      devContainer.position.set(localX, localY);
      devContainer.setLOD(this.currentLOD);
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
    const title = new Text({
      text: `${name.toUpperCase()} (${this.totalU}U EIA-310-D)`,
      style: { fill: 0x38bdf8, fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold' },
    });
    title.position.set(16, 9);
    this.addChild(title);
  }

  private renderEIAMountingRails(): void {
    const g = this.railsGraphics;
    g.clear();

    // Vertical Left & Right Rails
    g.rect(53, 32, 24, this.totalU * 32).fill({ color: 0x111722 });
    g.rect(557, 32, 24, this.totalU * 32).fill({ color: 0x111722 });

    // EIA 3-hole pattern per 1U
    for (let u = 0; u < this.totalU; u++) {
      const yBase = 32 + u * 32;
      // 3 holes per U at 7px, 16px, 25px
      [7, 16, 25].forEach((offset) => {
        g.rect(62, yBase + offset - 1.5, 4, 3).fill({ color: 0x1e293b });
        g.rect(566, yBase + offset - 1.5, 4, 3).fill({ color: 0x1e293b });
      });
    }
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

    for (let u = 1; u <= this.totalU; u++) {
      const slotY = 32 + (this.totalU - u) * 32;

      // Slot divider line
      g.rect(77, slotY, 480, 1).fill({ color: 0x161f2c });

      // U Number Label (on left rail)
      if (u === 1 || u === this.totalU || u % 5 === 0) {
        const uLabel = new Text({
          text: `U${u}`,
          style: { fill: 0x64748b, fontSize: 9, fontFamily: 'monospace' },
        });
        uLabel.position.set(56, slotY + 11);
        this.uSlotsContainer.addChild(uLabel);
      }
    }
    this.uSlotsContainer.addChildAt(g, 0);
  }

  private renderOverviewBadge(rack: RackModel): void {
    const g = new Graphics();
    g.roundRect(100, Math.max(0, this.rackHeight / 2 - 80), 434, 160, 8)
      .fill({ color: 0x0f172a, alpha: 0.95 })
      .stroke({ color: 0x38bdf8, width: 2 });

    this.badgeContainer.addChild(g);

    const text = new Text({
      text: `${rack.name}\n${this.totalU}U Cabinet\nDevices: ${rack.devices.length}\nMax Load: ${rack.maxLoadKg} kg`,
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
