// Composites the frame: static table layer (offscreen, redrawn only on resize)
// + interpolated dynamic balls + optional guide-line overlay. createRenderer
// owns the transform lifecycle and the offscreen canvas; draw() runs every
// frame and allocates nothing.

import type { PhysicsState, TableGeometry, Vec2 } from '../types/physics';
import type { RotatePolicy, Transform } from './transform';
import {
  DEFAULT_RAIL_WIDTH,
  applyTableMatrix,
  createTransform,
} from './transform';
import { DEFAULT_TABLE_PALETTE, type TablePalette } from './palette';
import { drawTable } from './table';
import { ballNumberOffset, drawBalls } from './balls';

const TAU = Math.PI * 2;
// Dash pattern (table units) for the aiming guide. Module-level so setLineDash
// gets a stable array, never a per-frame allocation.
const GUIDE_DASH: readonly number[] = [0.02, 0.02];

// A straight aiming aid: cue -> target, with an optional ghost ball at impact.
export interface GuideOverlay {
  readonly from: Vec2;
  readonly to: Vec2;
  readonly impact?: Vec2;
}

export interface RendererOptions {
  readonly palette?: TablePalette;
  readonly railWidth?: number;
  readonly dprCap?: number;
  readonly rotate?: RotatePolicy;
}

export interface Renderer {
  // Draw one frame, interpolating ball positions between two shot snapshots.
  draw(prev: PhysicsState, curr: PhysicsState, alpha: number): void;
  // Remeasure the canvas and redraw the static layer.
  resize(): void;
  // Set or clear the aiming guide overlay.
  setGuide(guide: GuideOverlay | null): void;
  // Current table<->pixel transform (null before the first measure). Exposed so
  // the input controller can convert pointer pixels to table units.
  getTransform(): Transform | null;
  dispose(): void;
}

const drawGuide = (
  ctx: CanvasRenderingContext2D,
  guide: GuideOverlay,
  radius: number,
  palette: TablePalette,
): void => {
  ctx.strokeStyle = palette.guide;
  ctx.lineWidth = radius * 0.18;
  ctx.setLineDash(GUIDE_DASH as number[]);
  ctx.beginPath();
  ctx.moveTo(guide.from.x, guide.from.y);
  ctx.lineTo(guide.to.x, guide.to.y);
  ctx.stroke();
  ctx.setLineDash([]);
  if (guide.impact === undefined) return;
  ctx.strokeStyle = palette.guideImpact;
  ctx.lineWidth = radius * 0.08;
  ctx.beginPath();
  ctx.arc(guide.impact.x, guide.impact.y, radius, 0, TAU);
  ctx.stroke();
};

export const createRenderer = (
  canvas: HTMLCanvasElement,
  geo: TableGeometry,
  options: RendererOptions = {},
): Renderer => {
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('renderer: 2D canvas context is unavailable');
  }
  const staticCanvas = document.createElement('canvas');
  const staticCtx = staticCanvas.getContext('2d');
  if (staticCtx === null) {
    throw new Error('renderer: offscreen 2D context is unavailable');
  }

  const palette = options.palette ?? DEFAULT_TABLE_PALETTE;
  const rail = options.railWidth ?? DEFAULT_RAIL_WIDTH;
  const numberOffset = ballNumberOffset(geo.ballRadius);
  let transform: Transform | null = null;
  let guide: GuideOverlay | null = null;

  const redrawStatic = (t: Transform): void => {
    if (staticCanvas.width !== t.deviceWidth) staticCanvas.width = t.deviceWidth;
    if (staticCanvas.height !== t.deviceHeight) staticCanvas.height = t.deviceHeight;
    staticCtx.setTransform(1, 0, 0, 1, 0, 0);
    staticCtx.clearRect(0, 0, t.deviceWidth, t.deviceHeight);
    applyTableMatrix(staticCtx, t);
    drawTable(staticCtx, geo, palette, rail);
  };

  const managed = createTransform(canvas, geo, {
    railWidth: rail,
    dprCap: options.dprCap,
    rotate: options.rotate,
    onResize: (t) => {
      transform = t;
      redrawStatic(t);
    },
  });

  const draw = (prev: PhysicsState, curr: PhysicsState, alpha: number): void => {
    const t = transform;
    if (t === null) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, t.deviceWidth, t.deviceHeight);
    ctx.drawImage(staticCanvas, 0, 0);
    applyTableMatrix(ctx, t);
    drawBalls(ctx, prev.balls, curr.balls, alpha, geo.ballRadius, numberOffset, palette, t);
    if (guide !== null) drawGuide(ctx, guide, geo.ballRadius, palette);
  };

  return {
    draw,
    resize: managed.measure,
    setGuide: (next) => {
      guide = next;
    },
    getTransform: managed.current,
    dispose: managed.dispose,
  };
};
