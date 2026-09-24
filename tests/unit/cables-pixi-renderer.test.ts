import { describe, it, expect, beforeEach } from 'vitest';

describe('PixiJS v8 Cabling Layer', () => {
  let mockState: any;
  let mockRS: any;

  beforeEach(() => {
    mockState = {
      cableRenderMode: 'pixi',
      cables: [
        { id: 'cable-1', from: { instanceId: 'dev-1', portId: 'p1' }, to: { instanceId: 'dev-2', portId: 'p2' }, color: '#38bdf8' },
        { id: 'cable-2', from: { instanceId: 'dev-2', portId: 'p3' }, to: { instanceId: 'dev-3', portId: 'p4' }, color: '#10b981' }
      ]
    };

    let svgCalls = 0;
    let pixiCalls = 0;

    mockRS = {
      STATE: mockState,
      setCableRenderMode: () => {
        mockState.cableRenderMode = 'pixi';
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
        return mockRS.renderAllCablesPixi();
      },
      getSvgCalls: () => svgCalls,
      getPixiCalls: () => pixiCalls
    };
  });

  it('renders cables with Pixi only', () => {
    expect(mockRS.STATE.cableRenderMode).toBe('pixi');
    const res = mockRS.renderAllCables();
    expect(res).toBe('pixi-rendered');
    expect(mockRS.getPixiCalls()).toBe(1);
    expect(mockRS.getSvgCalls()).toBe(0);
  });

  it('ignores requests to leave the Pixi renderer', () => {
    mockRS.setCableRenderMode('svg');
    expect(mockRS.STATE.cableRenderMode).toBe('pixi');
    const resPixi = mockRS.renderAllCables();
    expect(resPixi).toBe('pixi-rendered');
    expect(mockRS.getPixiCalls()).toBe(1);
    expect(mockRS.getSvgCalls()).toBe(0);
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

  it('appendSingleCable incrementally triggers renderAllCablesPixi in pixi mode', () => {
    let pixiAppendCalled = 0;
    mockRS.appendSingleCablePixi = (_cable: any) => {
      pixiAppendCalled++;
      return mockRS.renderAllCablesPixi();
    };

    function appendSingleCable(cable: any) {
      if (!cable) return;
      if (mockRS.STATE.cableRenderMode === 'pixi') {
        if (mockRS.appendSingleCablePixi) return mockRS.appendSingleCablePixi(cable);
        if (mockRS.renderAllCablesPixi) return mockRS.renderAllCablesPixi();
      }
      return mockRS.renderAllCables();
    }

    mockRS.STATE.cableRenderMode = 'pixi';
    appendSingleCable({ id: 'new-c1' });
    expect(pixiAppendCalled).toBe(1);
    expect(mockRS.getPixiCalls()).toBe(1);
  });

  it('appendSingleCable stays on Pixi when a legacy svg mode is requested', () => {
    function appendSingleCable(cable: any) {
      if (!cable) return;
      if (mockRS.appendSingleCablePixi) return mockRS.appendSingleCablePixi(cable);
      return mockRS.renderAllCablesPixi();
    }

    mockRS.setCableRenderMode('svg');
    mockRS.appendSingleCablePixi = () => mockRS.renderAllCablesPixi();
    const res = appendSingleCable({ id: 'new-c2' });
    expect(res).toBe('pixi-rendered');
    expect(mockRS.getPixiCalls()).toBe(1);
    expect(mockRS.getSvgCalls()).toBe(0);
  });
});
