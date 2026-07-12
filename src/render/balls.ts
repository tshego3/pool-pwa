// Draws the dynamic ball layer each frame in table units (the table matrix is
// already installed). Hot-path rules: no per-frame gradients, no allocations.
// Ball identity, number labels, and the number font are precomputed once so the
// inner loop only reads primitives and calls canvas draw methods.

import type { Ball } from '../types/physics';
import type { TablePalette } from './palette';

const TAU = Math.PI * 2;

type BallKind = 'cue' | 'solid' | 'stripe' | 'eight';

interface BallStyle {
  readonly kind: BallKind;
  // Index into palette.ball.byGroup for solids/stripes; -1 otherwise.
  readonly groupIndex: number;
  // Printed number, or '' for the cue ball (no badge).
  readonly label: string;
}

// Standard 8-ball identities, indexed by ball id 0..15. Solids 1-7 and stripes
// 9-15 share a suit color via (id - 1) % 7.
const BALL_STYLES: readonly BallStyle[] = Array.from({ length: 16 }, (_, id) => {
  if (id === 0) return { kind: 'cue', groupIndex: -1, label: '' } as const;
  if (id === 8) return { kind: 'eight', groupIndex: -1, label: '8' } as const;
  const groupIndex = (id - 1) % 7;
  const kind: BallKind = id < 8 ? 'solid' : 'stripe';
  return { kind, groupIndex, label: String(id) };
});

const baseColor = (style: BallStyle, palette: TablePalette): string => {
  if (style.kind === 'cue') return palette.ball.cue;
  if (style.kind === 'eight') return palette.ball.eight;
  if (style.kind === 'stripe') return palette.ball.stripeBase;
  return palette.ball.byGroup[style.groupIndex] ?? palette.ball.cue;
};

const NUMBER_FONT_SIZE = 0.6; // of ball radius
const NUMBER_FONT_FAMILY = "'Inter', sans-serif";
// Reference size for measuring digit ink bounds; the ratio is scaled down to
// the (sub-pixel, table-unit) real font size where metrics would degenerate.

// Precompute the number font for a given ball radius (constant per game). Kept
// out of the draw loop so no string is built per frame.
export const ballNumberFont = (radius: number): string =>
  `${(radius * NUMBER_FONT_SIZE).toFixed(4)}px ${NUMBER_FONT_FAMILY}`;

// Vertical nudge (table units) that visually centers a digit on the ball.
// We use 'middle' baseline for better centering across most fonts.
export const ballNumberOffset = (): number => 0;


const drawBall = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  id: number,
  radius: number,
  numberFont: string,
  numberOffset: number,
  palette: TablePalette,
): void => {
  const style = BALL_STYLES[id];
  if (style === undefined) return;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fillStyle = baseColor(style, palette);
  ctx.fill();

  if (style.kind === 'stripe') {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = palette.ball.byGroup[style.groupIndex] ?? palette.ball.cue;
    ctx.fillRect(x - radius, y - radius * 0.5, radius * 2, radius);
    ctx.restore();
  }

  ctx.lineWidth = radius * 0.06;
  ctx.strokeStyle = palette.ball.outline;
  ctx.stroke();

  if (style.label === '') return;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.42, 0, TAU);
  ctx.fillStyle = palette.ball.numberBg;
  ctx.fill();
  ctx.fillStyle = palette.ball.numberText;
  ctx.font = numberFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.label, x, y + numberOffset);
};

// Draw every ball interpolated between the previous and current snapshot by
// `alpha`. Snapshots are index-aligned (same ball order); pocketed balls are
// skipped.
export const drawBalls = (
  ctx: CanvasRenderingContext2D,
  prev: readonly Ball[],
  curr: readonly Ball[],
  alpha: number,
  radius: number,
  numberFont: string,
  numberOffset: number,
  palette: TablePalette,
): void => {
  for (let i = 0; i < curr.length; i++) {
    const c = curr[i];
    if (c === undefined || c.pocketed) continue;
    const p = prev[i] ?? c;
    const x = p.position.x + (c.position.x - p.position.x) * alpha;
    const y = p.position.y + (c.position.y - p.position.y) * alpha;
    drawBall(ctx, x, y, c.id, radius, numberFont, numberOffset, palette);
  }
};
