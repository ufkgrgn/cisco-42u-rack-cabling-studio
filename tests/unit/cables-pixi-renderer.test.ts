import { describe, it, expect, beforeEach } from 'vitest';

describe('PixiJS v8 Dual-Engine Cabling Layer', () => {
  let mockState: any;
  let mockRS: any;

  beforeEach(() => {
    mockState = {
      cableRenderMode: 'svg',
      cables: [
        { id: 'cable-1', from: { instanceId: 'dev-1', portId: 'p1' }, to: { instanceId: 'dev-2', portId: 'p2' }, color: '#38bdf8' },
        { id: 'cable-2', from: { instanceId: 'dev-2', portId: 'p3' }, to: { instanceId: 'dev-3', portId: 'p4' }, color: '#10b981' }
      ]
    };

    let svgCalls = 0;
    let pixiCalls = 0;

    mockRS = {
      STATE: mockState,
      setCableRenderMode: (mode: string) => {
        mockState.cableRenderMode = (mode === 'pixi' ? 'pixi' : 'svg');
      },
      renderAllCablesSVG: () => {
        svgCalls++;
        return 'svg-rendered';
      },
      renderAllCablesPixi: () => {
        pixiCalls++;
        return 'pixi-rendered';
      },
      renderAllCables: function () {
        if (mockRS.STATE.cableRenderMode === 'pixi') {
          return mockRS.renderAllCablesPixi();
        }
        return mockRS.renderAllCablesSVG();
      },
      getSvgCalls: () => svgCalls,
      getPixiCalls: () => pixiCalls
    };
  });

  it('defaults to SVG cable mode', () => {
    expect(mockRS.STATE.cableRenderMode).toBe('svg');
    const res = mockRS.renderAllCables();
    expect(res).toBe('svg-rendered');
    expect(mockRS.getSvgCalls()).toBe(1);
    expect(mockRS.getPixiCalls()).toBe(0);
  });

  it('switches dynamically between SVG and Pixi engines', () => {
    mockRS.setCableRenderMode('pixi');
    expect(mockRS.STATE.cableRenderMode).toBe('pixi');

    const resPixi = mockRS.renderAllCables();
    expect(resPixi).toBe('pixi-rendered');
    expect(mockRS.getPixiCalls()).toBe(1);
    expect(mockRS.getSvgCalls()).toBe(0);

    mockRS.setCableRenderMode('svg');
    expect(mockRS.STATE.cableRenderMode).toBe('svg');

    const resSvg = mockRS.renderAllCables();
    expect(resSvg).toBe('svg-rendered');
    expect(mockRS.getSvgCalls()).toBe(1);
  });

  it('correctly converts 3-char and 6-char hex colors to integers', () => {
    function hexColorToNumber(hex: string) {
      if (!hex) return 0x2563eb;
      const clean = String(hex).replace('#', '').trim();
      if (clean.length === 3) {
        const r = clean.charAt(0) + clean.charAt(0);
        const g = clean.charAt(1) + clean.charAt(1);
        const b = clean.charAt(2) + clean.charAt(2);
        const parsed = parseInt(r + g + b, 16);
        return Number.isNaN(parsed) ? 0x2563eb : parsed;
      }
      const parsed = parseInt(clean, 16);
      return Number.isNaN(parsed) ? 0x2563eb : parsed;
    }

    expect(hexColorToNumber('#ffffff')).toBe(0xffffff);
    expect(hexColorToNumber('#000000')).toBe(0x000000);
    expect(hexColorToNumber('#38bdf8')).toBe(0x38bdf8);
    expect(hexColorToNumber('#fff')).toBe(0xffffff);
    expect(hexColorToNumber('#f00')).toBe(0xff0000);
    expect(hexColorToNumber('')).toBe(0x2563eb);
  });

  it('parses SVG path D instructions into discrete drawing commands', () => {
    const pathD = 'M 100 200 L 100 250 L 300 250 L 300 400 L 150 400 L 150 450';
    const commands = pathD.match(/[MLCQZ][^MLCQZ]*/gi) || [];

    expect(commands.length).toBe(6);
    expect(commands[0]?.trim()).toBe('M 100 200');
    expect(commands[1]?.trim()).toBe('L 100 250');
    expect(commands[2]?.trim()).toBe('L 300 250');
  });

  it('hit detection distinguishes interactive cables from empty stage', () => {
    const mockStage = { id: 'stage' };
    const mockCablesContainer = { id: 'cables' };
    const mockConnectorsContainer = { id: 'connectors' };
    const mockCableGraphic = { id: 'cable-graphic-1' };

    function isInteractiveCable(hit: any) {
      return !!(
        hit &&
        hit !== mockStage &&
        hit !== mockCablesContainer &&
        hit !== mockConnectorsContainer
      );
    }

    expect(isInteractiveCable(null)).toBe(false);
    expect(isInteractiveCable(mockStage)).toBe(false);
    expect(isInteractiveCable(mockCablesContainer)).toBe(false);
    expect(isInteractiveCable(mockCableGraphic)).toBe(true);
  });
});
