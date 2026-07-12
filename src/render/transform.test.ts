import { describe, it, expect } from 'vitest';
import {
  computeTransform,
  tableToPixel,
  pixelToTable,
  DEFAULT_RAIL_WIDTH,
  type TableDims,
  type Viewport,
} from './transform';

const TABLE: TableDims = { width: 1.98, height: 0.99 };

const vp = (cssWidth: number, cssHeight: number, dpr: number): Viewport => ({
  cssWidth,
  cssHeight,
  dpr,
});

describe('computeTransform round-trip table<->pixel', () => {
  it('recovers original table points through pixel space (landscape)', () => {
    const t = computeTransform(TABLE, vp(800, 500, 1));
    for (const pt of [
      { x: 0, y: 0 },
      { x: TABLE.width, y: TABLE.height },
      { x: 0.5, y: 0.7 },
      { x: 1.23, y: 0.11 },
    ]) {
      const px = tableToPixel(t, pt.x, pt.y);
      const back = pixelToTable(t, px.x, px.y);
      expect(back.x).toBeCloseTo(pt.x, 9);
      expect(back.y).toBeCloseTo(pt.y, 9);
    }
  });

  it('recovers original table points when rotated 90 degrees', () => {
    const t = computeTransform(TABLE, vp(500, 800, 1), { rotate: true });
    for (const pt of [
      { x: 0, y: 0 },
      { x: TABLE.width, y: TABLE.height },
      { x: 1.0, y: 0.4 },
    ]) {
      const px = tableToPixel(t, pt.x, pt.y);
      const back = pixelToTable(t, px.x, px.y);
      expect(back.x).toBeCloseTo(pt.x, 9);
      expect(back.y).toBeCloseTo(pt.y, 9);
    }
  });
});

describe('computeTransform DPR scaling', () => {
  it('doubles the backing store and scale at DPR 2', () => {
    const t1 = computeTransform(TABLE, vp(800, 500, 1));
    const t2 = computeTransform(TABLE, vp(800, 500, 2));
    expect(t2.deviceWidth).toBe(t1.deviceWidth * 2);
    expect(t2.deviceHeight).toBe(t1.deviceHeight * 2);
    expect(t2.scale).toBeCloseTo(t1.scale * 2, 6);
    // CSS-space geometry is unchanged.
    expect(t2.cssWidth).toBe(t1.cssWidth);
  });

  it('caps DPR at 2 by default', () => {
    const t = computeTransform(TABLE, vp(800, 500, 3));
    expect(t.dpr).toBe(2);
    expect(t.deviceWidth).toBe(800 * 2);
  });

  it('honors a custom DPR cap', () => {
    const t = computeTransform(TABLE, vp(800, 500, 3), { dprCap: 3 });
    expect(t.dpr).toBe(3);
  });

  it('never drops below DPR 1', () => {
    const t = computeTransform(TABLE, vp(800, 500, 0.5));
    expect(t.dpr).toBe(1);
  });
});

describe('computeTransform letterbox math', () => {
  it('centers the world with vertical letterbox in a tall viewport', () => {
    // World aspect is ~2:1; a square viewport must pad top and bottom.
    const t = computeTransform(TABLE, vp(600, 600, 1));
    const rail = DEFAULT_RAIL_WIDTH;
    const worldW = TABLE.width + 2 * rail;
    const worldH = TABLE.height + 2 * rail;
    // Fit is width-constrained here.
    expect(t.scale).toBeCloseTo(t.deviceWidth / worldW, 6);
    const usedH = worldH * t.scale;
    const padY = (t.deviceHeight - usedH) / 2;
    expect(padY).toBeGreaterThan(0);
    // World min corner maps to (padX, padY); the padding is symmetric.
    const min = tableToPixel(t, -rail, -rail);
    const max = tableToPixel(t, TABLE.width + rail, TABLE.height + rail);
    expect(min.x).toBeCloseTo(0, 3);
    expect(min.y).toBeCloseTo(padY, 3);
    expect(t.deviceWidth - max.x).toBeCloseTo(min.x, 3);
    expect(t.deviceHeight - max.y).toBeCloseTo(min.y, 3);
  });

  it('centers the world with horizontal letterbox in a wide viewport', () => {
    const t = computeTransform(TABLE, vp(2000, 500, 1));
    const rail = DEFAULT_RAIL_WIDTH;
    const worldH = TABLE.height + 2 * rail;
    // Fit is height-constrained here.
    expect(t.scale).toBeCloseTo(t.deviceHeight / worldH, 6);
    const min = tableToPixel(t, -rail, -rail);
    expect(min.x).toBeGreaterThan(0);
    expect(min.y).toBeCloseTo(0, 3);
  });

  it('keeps the whole world inside the backing store', () => {
    const t = computeTransform(TABLE, vp(1280, 720, 2));
    const rail = DEFAULT_RAIL_WIDTH;
    const min = tableToPixel(t, -rail, -rail);
    const max = tableToPixel(t, TABLE.width + rail, TABLE.height + rail);
    expect(min.x).toBeGreaterThanOrEqual(-0.001);
    expect(min.y).toBeGreaterThanOrEqual(-0.001);
    expect(max.x).toBeLessThanOrEqual(t.deviceWidth + 0.001);
    expect(max.y).toBeLessThanOrEqual(t.deviceHeight + 0.001);
  });
});

describe('computeTransform rotation', () => {
  it('swaps the fit so the long axis runs vertically', () => {
    const t = computeTransform(TABLE, vp(500, 800, 1), { rotate: true });
    // Table origin and its +x extent: +x should map downward when rotated.
    const origin = tableToPixel(t, 0, 0);
    const alongX = tableToPixel(t, TABLE.width, 0);
    expect(alongX.y).toBeGreaterThan(origin.y);
    expect(Math.abs(alongX.x - origin.x)).toBeLessThan(1e-6);
  });
});
