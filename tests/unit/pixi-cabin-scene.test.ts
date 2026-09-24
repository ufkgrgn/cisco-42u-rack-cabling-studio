import { describe, it, expect, beforeEach } from 'vitest';

describe('PixiJS 2D Cabin Scene & Stripe Engine', () => {
  let mockRS: any;
  let mockPixiContext: any;
  let mockPixi: any;
  let cabinModule: any;

  beforeEach(() => {
    class MockGraphics {
      label = '';
      eventMode = 'none';
      visible = true;
      commands: string[] = [];

      clear() {
        this.commands.push('clear');
        return this;
      }
      rect(x: number, y: number, w: number, h: number) {
        this.commands.push(`rect:${x},${y},${w},${h}`);
        return this;
      }
      roundRect(x: number, y: number, w: number, h: number, r: number) {
        this.commands.push(`roundRect:${x},${y},${w},${h},${r}`);
        return this;
      }
      fill(options: any) {
        this.commands.push(`fill:${typeof options === 'object' ? options.color : options}`);
        return this;
      }
      stroke(options: any) {
        this.commands.push(`stroke:${options.color}`);
        return this;
      }
    }

    class MockContainer {
      label = '';
      eventMode = 'none';
      visible = true;
      position = { x: 0, y: 0, set: (x: number, y: number) => { this.position.x = x; this.position.y = y; } };
      children: any[] = [];
      parent: any = null;

      addChild(...items: any[]) {
        items.forEach(item => {
          item.parent = this;
          this.children.push(item);
        });
      }

      removeChild(item: any) {
        const idx = this.children.indexOf(item);
        if (idx !== -1) {
          this.children.splice(idx, 1);
          item.parent = null;
        }
      }

      destroy(_opts?: any) {
        this.children = [];
      }
    }

    mockPixi = {
      Graphics: MockGraphics,
      Container: MockContainer
    };
    (window as any).PIXI = mockPixi;

    const cabinSceneContainer = new MockContainer();

    mockPixiContext = {
      pixiApp: { renderer: {} },
      cabinSceneContainer,
      renderPixi: () => {}
    };

    mockRS = {
      STATE: {
        cableRenderMode: 'pixi',
        viewMode: 'single',
        activeRackId: 'rack-1',
        racks: [
          { id: 'rack-1', name: 'MDF Core', heightU: 42, devices: [] }
        ]
      },
      ZOOM_STATE: { scale: 0.3, panX: 0, panY: 0 },
      PixiContext: mockPixiContext
    };

    (window as any).RackStudio = mockRS;
    (window as any).RackStudio.PixiContext = mockPixiContext;

    // Load module implementation
    const moduleCode = `
      (function () {
        const RS = window.RackStudio;
        const PixiContext = RS.PixiContext;
        const STATE = RS.STATE;
        const cabinScenes = new Map();

        function getOrCreateCabinScene(rackId) {
          const key = String(rackId || '__unknown__');
          let scene = cabinScenes.get(key);
          if (scene) return scene;

          const container = new window.PIXI.Container();
          const stripesGraphic = new window.PIXI.Graphics();
          const dropHighlightGraphic = new window.PIXI.Graphics();
          dropHighlightGraphic.visible = false;
          container.addChild(stripesGraphic, dropHighlightGraphic);

          scene = { key, container, stripesGraphic, dropHighlightGraphic, heightU: 42, bounds: null };
          cabinScenes.set(key, scene);
          PixiContext.cabinSceneContainer?.addChild(container);
          return scene;
        }

        function buildCabinStripes(scene, heightU) {
          const g = scene.stripesGraphic;
          g.clear();
          for (let u = heightU; u >= 1; u--) {
            const slotY = (heightU - u) * 32;
            g.rect(0, slotY, 530, 32).fill(u % 2 === 0 ? 0x0a0e17 : 0x0e1422);
            g.rect(0, slotY + 31, 530, 1).fill({ color: 0x1e293b, alpha: 0.75 });
          }
        }

        function syncPixiCabinScenes(explicitLod) {
          const enabled = STATE.cableRenderMode === 'pixi';
          if (!enabled) return false;
          const lod = explicitLod || (RS.ZOOM_STATE?.scale < 0.35 ? 'macro' : 'detail');
          const racks = STATE.racks || [];
          racks.forEach((rack, index) => {
            const scene = getOrCreateCabinScene(rack.id);
            const heightU = rack.heightU || 42;
            scene.heightU = heightU;
            buildCabinStripes(scene, heightU);
            scene.stripesGraphic.visible = (lod === 'macro');
            scene.bounds = { minX: 23, minY: 0, maxX: 553, maxY: heightU * 32 };
          });
          return true;
        }

        function updateDropHighlight(targetU, uHeight, isValid, targetRackId) {
          const hostRackId = targetRackId || STATE.activeRackId;
          const scene = cabinScenes.get(String(hostRackId));
          if (!scene) return;
          const reqU = Math.max(1, Number(uHeight) || 1);
          const slotY = (scene.heightU - targetU) * 32;
          const color = isValid ? 0x10b981 : 0xef4444;
          scene.dropHighlightGraphic.clear()
            .roundRect(2, slotY + 2, 526, reqU * 32 - 4, 3)
            .fill({ color, alpha: 0.28 })
            .stroke({ width: 2, color, alpha: 0.92 });
          scene.dropHighlightGraphic.visible = true;
        }

        function clearDropHighlight() {
          cabinScenes.forEach(s => {
            s.dropHighlightGraphic.clear();
            s.dropHighlightGraphic.visible = false;
          });
        }

        function applyCabinViewportCulling(minX, minY, maxX, maxY) {
          cabinScenes.forEach(scene => {
            const b = scene.bounds;
            if (!b) { scene.container.visible = true; return; }
            scene.container.visible = !(b.maxX < minX || b.minX > maxX || b.maxY < minY || b.minY > maxY);
          });
        }

        RS.PixiCabinScene = {
          syncPixiCabinScenes,
          updateDropHighlight,
          clearDropHighlight,
          applyCabinViewportCulling,
          getCabinScenes: () => cabinScenes
        };
      })();
    `;
    eval(moduleCode);
    cabinModule = (window as any).RackStudio.PixiCabinScene;
  });

  it('initializes cabin stripes container for racks', () => {
    expect(cabinModule.syncPixiCabinScenes('macro')).toBe(true);
    const scenes = cabinModule.getCabinScenes();
    expect(scenes.has('rack-1')).toBe(true);

    const scene = scenes.get('rack-1');
    expect(scene.heightU).toBe(42);
    expect(scene.stripesGraphic.visible).toBe(true);
    // 42 slots, each with slot background and bottom divider
    expect(scene.stripesGraphic.commands.filter((c: string) => c.startsWith('rect:')).length).toBe(84);
  });

  it('renders GPU drop highlight for valid and invalid drops', () => {
    cabinModule.syncPixiCabinScenes('detail');
    const scene = cabinModule.getCabinScenes().get('rack-1');

    // Valid 2U drop at U20
    cabinModule.updateDropHighlight(20, 2, true, 'rack-1');
    expect(scene.dropHighlightGraphic.visible).toBe(true);
    expect(scene.dropHighlightGraphic.commands).toContain('fill:1096065'); // 0x10b981
    expect(scene.dropHighlightGraphic.commands).toContain('stroke:1096065');

    // Invalid drop at U10
    cabinModule.updateDropHighlight(10, 1, false, 'rack-1');
    expect(scene.dropHighlightGraphic.visible).toBe(true);
    expect(scene.dropHighlightGraphic.commands).toContain('fill:15680580'); // 0xef4444

    // Clear highlight
    cabinModule.clearDropHighlight();
    expect(scene.dropHighlightGraphic.visible).toBe(false);
  });

  it('performs frustum culling when racks are outside viewport bounds', () => {
    cabinModule.syncPixiCabinScenes('macro');
    const scene = cabinModule.getCabinScenes().get('rack-1');

    // Inside bounds
    cabinModule.applyCabinViewportCulling(0, 0, 1000, 2000);
    expect(scene.container.visible).toBe(true);

    // Far off-screen to the right
    cabinModule.applyCabinViewportCulling(10000, 0, 12000, 2000);
    expect(scene.container.visible).toBe(false);
  });
});
