// The one place table-space (meters, engine coordinates) meets screen-space
// (device pixels, DPR, letterboxing, portrait rotation). No pixel value exists
// outside this module and its consumers in src/render; the engine never sees a
// pixel. All exported math is pure and DOM-free so it can be unit tested; the
// createTransform() wrapper at the bottom is the only DOM-aware piece.

import type { Vec2 } from '../types/physics';

// Wood border, in table units, drawn around the playing surface. Shared by the
// transform (so the wood stays on screen) and table.ts (so it draws it).
export const DEFAULT_RAIL_WIDTH = 0.06;

// Cap device-pixel-ratio to keep mobile fill cost and blur in check. A DPR-3
// phone still renders at 2x.
export const DEFAULT_DPR_CAP = 2;

export interface TableDims {
  readonly width: number;
  readonly height: number;
}

export interface Viewport {
  // CSS pixels of the canvas box.
  readonly cssWidth: number;
  readonly cssHeight: number;
  // Raw window.devicePixelRatio (pre-cap).
  readonly dpr: number;
}

export interface TransformOptions {
  readonly railWidth?: number;
  readonly dprCap?: number;
  // Rotate the table 90 degrees clockwise (long axis vertical) for portrait.
  readonly rotate?: boolean;
}

// A frozen snapshot of the table<->pixel mapping for one canvas size. Rotation
// is encoded as a (cos, sin) unit pair so the same affine math covers both
// orientations.
export interface Transform {
  // Device pixels per table unit.
  readonly scale: number;
  // Device-pixel position of table-space origin (0, 0), after rotation.
  readonly originX: number;
  readonly originY: number;
  readonly cos: number;
  readonly sin: number;
  readonly rotate: boolean;
  // Effective (capped) device-pixel ratio actually used.
  readonly dpr: number;
  readonly deviceWidth: number;
  readonly deviceHeight: number;
  readonly cssWidth: number;
  readonly cssHeight: number;
}

const rotatedComponents = (rotate: boolean): { cos: number; sin: number } =>
  // 90 degrees clockwise: table +x maps to screen +y, table +y maps to -x.
  rotate ? { cos: 0, sin: 1 } : { cos: 1, sin: 0 };

// Compute the letterboxed, DPR-scaled mapping that fits the playing surface
// plus its wood border into the viewport, centered.
export const computeTransform = (
  table: TableDims,
  viewport: Viewport,
  opts: TransformOptions = {},
): Transform => {
  const rail = opts.railWidth ?? DEFAULT_RAIL_WIDTH;
  const cap = opts.dprCap ?? DEFAULT_DPR_CAP;
  const rotate = opts.rotate ?? false;
  const dpr = Math.min(Math.max(viewport.dpr, 1), cap);
  const deviceWidth = Math.max(1, Math.round(viewport.cssWidth * dpr));
  const deviceHeight = Math.max(1, Math.round(viewport.cssHeight * dpr));
  const { cos, sin } = rotatedComponents(rotate);

  // World rectangle in table units (playing surface expanded by the rail).
  const minX = -rail;
  const minY = -rail;
  const maxX = table.width + rail;
  const maxY = table.height + rail;
  // Rotated-frame extents: with cos in {0,1} and sin in {0,1} the world is
  // axis-aligned either way, so the bounds are just the rotated corners.
  const rMinX = Math.min(minX * cos - minY * sin, maxX * cos - maxY * sin);
  const rMaxX = Math.max(minX * cos - minY * sin, maxX * cos - maxY * sin);
  const rMinY = Math.min(minX * sin + minY * cos, maxX * sin + maxY * cos);
  const rMaxY = Math.max(minX * sin + minY * cos, maxX * sin + maxY * cos);

  const worldW = rMaxX - rMinX;
  const worldH = rMaxY - rMinY;
  const scale = Math.min(deviceWidth / worldW, deviceHeight / worldH);
  const padX = (deviceWidth - worldW * scale) / 2;
  const padY = (deviceHeight - worldH * scale) / 2;
  // Anchor the rotated world's min corner at the letterbox padding.
  const originX = padX - rMinX * scale;
  const originY = padY - rMinY * scale;

  return {
    scale,
    originX,
    originY,
    cos,
    sin,
    rotate,
    dpr,
    deviceWidth,
    deviceHeight,
    cssWidth: viewport.cssWidth,
    cssHeight: viewport.cssHeight,
  };
};

// Table units -> device pixels. `out` is reused to avoid hot-path allocation.
export const tableToPixel = (
  t: Transform,
  tx: number,
  ty: number,
  out: Vec2 = { x: 0, y: 0 },
): Vec2 => {
  const rx = tx * t.cos - ty * t.sin;
  const ry = tx * t.sin + ty * t.cos;
  out.x = t.originX + rx * t.scale;
  out.y = t.originY + ry * t.scale;
  return out;
};

// Device pixels -> table units (inverse of tableToPixel). The rotation inverse
// is its transpose.
export const pixelToTable = (
  t: Transform,
  px: number,
  py: number,
  out: Vec2 = { x: 0, y: 0 },
): Vec2 => {
  const rx = (px - t.originX) / t.scale;
  const ry = (py - t.originY) / t.scale;
  out.x = rx * t.cos + ry * t.sin;
  out.y = -rx * t.sin + ry * t.cos;
  return out;
};

// Install the transform as the active canvas matrix so drawing code can work in
// table units directly (positions and line widths in meters).
export const applyTableMatrix = (
  ctx: CanvasRenderingContext2D,
  t: Transform,
): void => {
  ctx.setTransform(
    t.scale * t.cos,
    t.scale * t.sin,
    -t.scale * t.sin,
    t.scale * t.cos,
    t.originX,
    t.originY,
  );
};

// rotate may be a fixed boolean or 'auto': portrait viewport + landscape table.
export type RotatePolicy = boolean | 'auto';

const resolveRotate = (
  policy: RotatePolicy,
  cssWidth: number,
  cssHeight: number,
  table: TableDims,
): boolean => {
  if (policy !== 'auto') return policy;
  const portraitViewport = cssHeight > cssWidth;
  const landscapeTable = table.width >= table.height;
  return portraitViewport && landscapeTable;
};

export interface ManagedTransformOptions {
  readonly railWidth?: number;
  readonly dprCap?: number;
  readonly rotate?: RotatePolicy;
  // Called after every resize with the freshly computed transform (the canvas
  // backing store has already been sized). Used to redraw the static layer.
  readonly onResize?: (t: Transform) => void;
}

export interface ManagedTransform {
  current(): Transform | null;
  // Force a remeasure now (also runs onResize).
  measure(): void;
  dispose(): void;
}

// DOM-aware wrapper: watches the canvas with a ResizeObserver, keeps the canvas
// backing store sized to the capped device resolution, and republishes a fresh
// Transform on every change.
export const createTransform = (
  canvas: HTMLCanvasElement,
  table: TableDims,
  opts: ManagedTransformOptions = {},
): ManagedTransform => {
  let transform: Transform | null = null;
  const rotatePolicy: RotatePolicy = opts.rotate ?? false;

  const measure = (): void => {
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width || canvas.clientWidth || 1;
    const cssHeight = rect.height || canvas.clientHeight || 1;
    const dpr = window.devicePixelRatio || 1;
    const rotate = resolveRotate(rotatePolicy, cssWidth, cssHeight, table);
    const next = computeTransform(
      table,
      { cssWidth, cssHeight, dpr },
      { railWidth: opts.railWidth, dprCap: opts.dprCap, rotate },
    );
    transform = next;
    if (canvas.width !== next.deviceWidth) canvas.width = next.deviceWidth;
    if (canvas.height !== next.deviceHeight) canvas.height = next.deviceHeight;
    opts.onResize?.(next);
  };

  const observer = new ResizeObserver(() => measure());
  observer.observe(canvas);

  return {
    current: () => transform,
    measure,
    dispose: () => observer.disconnect(),
  };
};
