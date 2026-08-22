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

// The aiming aid: the cue's approach (cue -> target), an optional ghost ball at
// impact, and the predicted travel of both balls after that impact.
export interface GuideOverlay {
  // Cue-ball approach: the launch point, a vertex at each cushion bounce, then
  // the terminal point. A straight run between vertices is implied.
  readonly path: readonly Vec2[];
  readonly impact?: Vec2;
  // Cue-ball deflection path, starting at the ghost ball.
  readonly cueAfter?: readonly Vec2[];
  // Struck object ball's path, starting at its center.
  readonly objectAfter?: readonly Vec2[];
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
  // Swap the table finish (a user setting). Redraws the static layer; the game
  // in progress is untouched.
  setPalette(next: TablePalette): void;
  // Current table<->pixel transform (null before the first measure). Exposed so
  // the input controller can convert pointer pixels to table units.
  getTransform(): Transform | null;
  dispose(): void;
}

// Stroke a predicted path. Under two points means the ball does not travel
// (a full hit stuns the cue ball dead), so nothing is drawn.
const strokePath = (
  ctx: CanvasRenderingContext2D,
  points: readonly Vec2[],
  color: string,
  width: number,
): void => {
  const first = points[0];
  if (points.length < 2 || first === undefined) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p !== undefined) ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
};

const drawGuide = (
  ctx: CanvasRenderingContext2D,
  guide: GuideOverlay,
  radius: number,
  palette: TablePalette,
): void => {
  ctx.setLineDash(GUIDE_DASH as number[]);
  strokePath(ctx, guide.path, palette.guide, radius * 0.18);
  ctx.setLineDash([]);
  if (guide.impact === undefined) return;
  ctx.strokeStyle = palette.guideImpact;
  ctx.lineWidth = radius * 0.08;
  ctx.beginPath();
  ctx.arc(guide.impact.x, guide.impact.y, radius, 0, TAU);
  ctx.stroke();
  // Where each ball goes after the hit. Round caps so the lines read as cues
  // leaving the ghost ball rather than as table markings.
  ctx.lineCap = 'round';
  if (guide.cueAfter !== undefined) {
    strokePath(ctx, guide.cueAfter, palette.guideCue, radius * 0.14);
  }
  if (guide.objectAfter !== undefined) {
    strokePath(ctx, guide.objectAfter, palette.guideObject, radius * 0.2);
  }
  ctx.lineCap = 'butt';
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

  let palette = options.palette ?? DEFAULT_TABLE_PALETTE;
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
    setPalette: (next) => {
      if (next === palette) return;
      palette = next;
      const t = transform;
      if (t !== null) redrawStatic(t);
    },
    getTransform: managed.current,
    dispose: managed.dispose,
  };
};
