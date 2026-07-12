// Draws the static table layer (wood, felt, cushions, pockets, markings) once
// per resize into an offscreen canvas. The caller installs the table matrix
// (see transform.applyTableMatrix) first, so everything here is expressed in
// table units; line widths are meters and scale with the table.

import type { TableGeometry } from '../types/physics';
import type { TablePalette } from './palette';

const TAU = Math.PI * 2;

// Cushion nose thickness and marking line weights, in table units.
const CUSHION_WIDTH = 0.02;
const POCKET_RIM_WIDTH = 0.006;
const MARKING_WIDTH = 0.004;
const SPOT_RADIUS = 0.008;

const drawWood = (
  ctx: CanvasRenderingContext2D,
  geo: TableGeometry,
  palette: TablePalette,
  rail: number,
): void => {
  ctx.fillStyle = palette.railWood;
  ctx.beginPath();
  ctx.roundRect(-rail, -rail, geo.width + 2 * rail, geo.height + 2 * rail, rail * 0.6);
  ctx.fill();
};

const drawFelt = (
  ctx: CanvasRenderingContext2D,
  geo: TableGeometry,
  palette: TablePalette,
): void => {
  ctx.fillStyle = palette.feltBase;
  ctx.fillRect(0, 0, geo.width, geo.height);
};

const drawCushions = (
  ctx: CanvasRenderingContext2D,
  geo: TableGeometry,
  palette: TablePalette,
): void => {
  ctx.strokeStyle = palette.cushion;
  ctx.lineWidth = CUSHION_WIDTH;
  ctx.lineCap = 'butt';
  for (const seg of geo.cushions) {
    ctx.beginPath();
    ctx.moveTo(seg.a.x, seg.a.y);
    ctx.lineTo(seg.b.x, seg.b.y);
    ctx.stroke();
  }
};

const drawPockets = (
  ctx: CanvasRenderingContext2D,
  geo: TableGeometry,
  palette: TablePalette,
): void => {
  for (const pocket of geo.pockets) {
    ctx.beginPath();
    ctx.arc(pocket.position.x, pocket.position.y, pocket.radius, 0, TAU);
    ctx.fillStyle = palette.pocket;
    ctx.fill();
    ctx.lineWidth = POCKET_RIM_WIDTH;
    ctx.strokeStyle = palette.pocketRim;
    ctx.stroke();
  }
};

const drawMarkings = (
  ctx: CanvasRenderingContext2D,
  geo: TableGeometry,
  palette: TablePalette,
): void => {
  const headX = geo.width * 0.25;
  const centerY = geo.height / 2;
  ctx.strokeStyle = palette.marking;
  ctx.lineWidth = MARKING_WIDTH;
  // Head string (baulk line) across the table at the head spot.
  ctx.beginPath();
  ctx.moveTo(headX, 0);
  ctx.lineTo(headX, geo.height);
  ctx.stroke();
  // Head spot and foot spot (rack apex).
  ctx.fillStyle = palette.marking;
  for (const spotX of [headX, geo.width * 0.75]) {
    ctx.beginPath();
    ctx.arc(spotX, centerY, SPOT_RADIUS, 0, TAU);
    ctx.fill();
  }
};

// Paint the full static table into the current (table-matrix) context.
export const drawTable = (
  ctx: CanvasRenderingContext2D,
  geo: TableGeometry,
  palette: TablePalette,
  rail: number,
): void => {
  drawWood(ctx, geo, palette, rail);
  drawFelt(ctx, geo, palette);
  drawMarkings(ctx, geo, palette);
  drawCushions(ctx, geo, palette);
  drawPockets(ctx, geo, palette);
};
