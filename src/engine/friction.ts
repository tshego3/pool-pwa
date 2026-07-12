// Friction model: a fast ball slides (higher deceleration), then settles into a
// roll (lower rolling resistance), and is snapped to rest below a stop velocity
// so every ball reaches rest in finite time. Spin is a placeholder and does not
// yet feed back into linear motion.

import type { Ball, PhysicsConfig } from '../types/physics';

// Advance one ball's velocity over `dt` under friction (mutating). Returns true
// if the ball is still moving afterward.
export const applyFriction = (ball: Ball, dt: number, cfg: PhysicsConfig): boolean => {
  const vx = ball.velocity.x;
  const vy = ball.velocity.y;
  const speed = Math.hypot(vx, vy);
  if (speed <= cfg.stopVelocity) {
    ball.velocity.x = 0;
    ball.velocity.y = 0;
    return false;
  }
  const decel = speed > cfg.slidingThreshold ? cfg.slidingDecel : cfg.rollingDecel;
  const newSpeed = speed - decel * dt;
  if (newSpeed <= cfg.stopVelocity) {
    ball.velocity.x = 0;
    ball.velocity.y = 0;
    return false;
  }
  const factor = newSpeed / speed;
  ball.velocity.x = vx * factor;
  ball.velocity.y = vy * factor;
  return true;
};

// True when a ball's speed is above the rest threshold.
export const isMoving = (ball: Ball, cfg: PhysicsConfig): boolean =>
  !ball.pocketed && ball.velocity.x * ball.velocity.x + ball.velocity.y * ball.velocity.y >
    cfg.stopVelocity * cfg.stopVelocity;
