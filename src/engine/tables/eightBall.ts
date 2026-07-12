// Data-driven 8-ball table geometry and rack layout. The engine algorithms are
// game-agnostic; a future snooker table is just another file like this one.
// All units are table-space meters (see src/types/physics.ts). Origin at the
// top-left corner of the playing surface.

import type { Ball, TableGeometry, CushionSegment, Pocket } from '../../types/physics';

// 7-foot playing surface, 2:1 aspect.
const WIDTH = 1.98;
const HEIGHT = 0.99;
const BALL_RADIUS = 0.028575;
const POCKET_RADIUS = 0.05;
// Half-width of the gap a pocket cuts into the adjoining cushions.
const MOUTH = 0.06;

const seg = (ax: number, ay: number, bx: number, by: number): CushionSegment => ({
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
});

const buildCushions = (): readonly CushionSegment[] => {
  const midX = WIDTH / 2;
  return [
    // Top rail, split by the side pocket.
    seg(MOUTH, 0, midX - MOUTH, 0),
    seg(midX + MOUTH, 0, WIDTH - MOUTH, 0),
    // Bottom rail, split by the side pocket.
    seg(MOUTH, HEIGHT, midX - MOUTH, HEIGHT),
    seg(midX + MOUTH, HEIGHT, WIDTH - MOUTH, HEIGHT),
    // Left and right short rails.
    seg(0, MOUTH, 0, HEIGHT - MOUTH),
    seg(WIDTH, MOUTH, WIDTH, HEIGHT - MOUTH),
  ];
};

const buildPockets = (): readonly Pocket[] => {
  const midX = WIDTH / 2;
  const corners = [
    { x: 0, y: 0 },
    { x: WIDTH, y: 0 },
    { x: 0, y: HEIGHT },
    { x: WIDTH, y: HEIGHT },
    { x: midX, y: 0 },
    { x: midX, y: HEIGHT },
  ];
  return corners.map((position) => ({ position, radius: POCKET_RADIUS }));
};

export const createEightBallTable = (): TableGeometry => ({
  width: WIDTH,
  height: HEIGHT,
  ballRadius: BALL_RADIUS,
  cushions: buildCushions(),
  pockets: buildPockets(),
});

const makeBall = (id: number, x: number, y: number): Ball => ({
  id,
  position: { x, y },
  velocity: { x: 0, y: 0 },
  spin: { x: 0, y: 0 },
  radius: BALL_RADIUS,
  pocketed: false,
});

// Cue ball on the head spot; 15 object balls racked apex-first toward the foot
// rail with the 8-ball in the centre. A hair of separation avoids a degenerate
// all-touching initial state. Object-ball order here is only geometric; the
// rules layer owns solids/stripes legality.
export const rackEightBall = (): Ball[] => {
  const diameter = BALL_RADIUS * 2 + 0.0005;
  const rowGap = diameter * (Math.sqrt(3) / 2);
  const apexX = WIDTH * 0.75;
  const centerY = HEIGHT / 2;
  const balls: Ball[] = [makeBall(0, WIDTH * 0.25, centerY)];
  const pool = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
  let poolIndex = 0;
  for (let row = 0; row < 5; row++) {
    for (let k = 0; k <= row; k++) {
      const x = apexX + row * rowGap;
      const y = centerY + (k - row / 2) * diameter;
      const isCenter = row === 2 && k === 1;
      const id = isCenter ? 8 : (pool[poolIndex++] ?? 0);
      balls.push(makeBall(id, x, y));
    }
  }
  return balls;
};
