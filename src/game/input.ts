// Pointer-driven aiming and ball-in-hand input. This is the facade's I/O edge:
// it owns the DOM Pointer Events (unifying mouse, touch, and pen), converts
// screen pixels to table units via src/render/transform.ts, and calls back with
// pure angle / placement data. All aiming math lives in ./aiming; this file
// only sequences gestures. Nothing here is imported by the engine/rules/bot.
//
// Aiming is relative: a drag corrects the current angle left or right by how far
// it swings around the cue ball. Tapping the table does not aim at the tap.

import type { Transform } from '../render/transform';
import { pixelToTable, tableToPixel } from '../render/transform';
import type { Vec2 } from '../types/physics';
import type { AimConfig, PlacementResult } from '../types/aiming';
import { steerAngle, DEFAULT_AIM } from './aiming';

// Minimum grab radius in CSS pixels for picking up the cue ball, so the target
// stays >=44px across even when the ball is drawn tiny.
const DEFAULT_GRAB_RADIUS_PX = 22;

export interface PlacementHandlers {
  // Ball-in-hand is offered only while this returns true.
  readonly isActive: () => boolean;
  // Legality of a candidate placement, computed by the caller from game state.
  readonly validate: (pos: Vec2) => PlacementResult;
  readonly onMove?: (pos: Vec2, result: PlacementResult) => void;
  readonly onCommit?: (pos: Vec2) => void;
  // Cue-ball radius in table units, used so the grab target grows with a
  // large ball while never dropping below the 44px minimum.
  readonly ballRadius?: number;
  readonly grabRadiusPx?: number;
}

export interface InputOptions {
  readonly canvas: HTMLCanvasElement;
  // Current table<->pixel transform, read fresh each event (it changes on resize).
  readonly getTransform: () => Transform | null;
  // Current cue-ball table position, or null when the shot is not aimable (e.g.
  // balls still moving, or it is the bot's turn).
  readonly getCuePosition: () => Vec2 | null;
  // Current aim angle in radians: every drag corrects this, it never replaces it.
  readonly getAimAngle: () => number;
  readonly aimConfig?: AimConfig;
  readonly onAim?: (angle: number) => void;
  readonly onCancel?: () => void;
  readonly placement?: PlacementHandlers;
}

export interface InputController {
  dispose(): void;
}

// An aim gesture remembers where it grabbed and the angle it started from, so
// every move reports one correction measured from the press, not from the last
// frame (which would let rounding accumulate).
type Gesture =
  | { readonly kind: 'place'; readonly pointerId: number }
  | {
      readonly kind: 'aim';
      readonly pointerId: number;
      readonly anchor: Vec2;
      readonly startAngle: number;
    }
  | null;

// Device-pixel position of a pointer event within the canvas backing store.
const clientToDevice = (
  canvas: HTMLCanvasElement,
  t: Transform,
  clientX: number,
  clientY: number,
): Vec2 => {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || 1;
  const h = rect.height || 1;
  return {
    x: (clientX - rect.left) * (t.deviceWidth / w),
    y: (clientY - rect.top) * (t.deviceHeight / h),
  };
};

export const createInput = (options: InputOptions): InputController => {
  const { canvas } = options;
  const aimCfg = options.aimConfig ?? DEFAULT_AIM;
  // Prevent the browser from scrolling/zooming the page during a drag.
  canvas.style.touchAction = 'none';
  let gesture: Gesture = null;

  const tableAt = (clientX: number, clientY: number): { table: Vec2; t: Transform } | null => {
    const t = options.getTransform();
    if (t === null) return null;
    const dev = clientToDevice(canvas, t, clientX, clientY);
    return { table: pixelToTable(t, dev.x, dev.y), t };
  };

  // True when a pointerdown lands on the cue ball within the >=44px grab target.
  const onCueBall = (cue: Vec2, dev: Vec2, t: Transform): boolean => {
    const grabPx = options.placement?.grabRadiusPx ?? DEFAULT_GRAB_RADIUS_PX;
    const ballRadius = options.placement?.ballRadius ?? 0;
    const grab = Math.max(ballRadius * t.scale, grabPx * t.dpr);
    const cuePx = tableToPixel(t, cue.x, cue.y);
    return Math.hypot(dev.x - cuePx.x, dev.y - cuePx.y) <= grab;
  };

  const beginPlace = (clientX: number, clientY: number, cue: Vec2): boolean => {
    const p = options.placement;
    const t = options.getTransform();
    if (p === undefined || t === null || !p.isActive()) return false;
    const dev = clientToDevice(canvas, t, clientX, clientY);
    if (!onCueBall(cue, dev, t)) return false;
    p.onMove?.(cue, p.validate(cue));
    return true;
  };

  const onDown = (e: PointerEvent): void => {
    if (gesture !== null) return;
    const cue = options.getCuePosition();
    if (cue === null) return;
    if (beginPlace(e.clientX, e.clientY, cue)) {
      gesture = { kind: 'place', pointerId: e.pointerId };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    const hit = tableAt(e.clientX, e.clientY);
    if (hit === null) return;
    gesture = {
      kind: 'aim',
      pointerId: e.pointerId,
      anchor: hit.table,
      startAngle: options.getAimAngle(),
    };
    canvas.setPointerCapture(e.pointerId);
    // Pressing only anchors the drag; the aim moves on the first pointermove.
  };

  const onMove = (e: PointerEvent): void => {
    if (gesture === null || e.pointerId !== gesture.pointerId) return;
    const hit = tableAt(e.clientX, e.clientY);
    if (hit === null) return;
    if (gesture.kind === 'place') {
      options.placement?.onMove?.(hit.table, options.placement.validate(hit.table));
      return;
    }
    const cue = options.getCuePosition();
    if (cue === null) return;
    options.onAim?.(steerAngle(cue, gesture.anchor, hit.table, gesture.startAngle, aimCfg));
  };

  const endGesture = (pointerId: number): void => {
    gesture = null;
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  };

  // Abandon the in-flight gesture: an aim drag rewinds to the angle it started
  // from, ball-in-hand falls back to the caller's cancel handling.
  const abortGesture = (): void => {
    if (gesture === null) return;
    const aborted = gesture;
    endGesture(aborted.pointerId);
    if (aborted.kind === 'aim') options.onAim?.(aborted.startAngle);
    else options.onCancel?.();
  };

  const onUp = (e: PointerEvent): void => {
    if (gesture === null || e.pointerId !== gesture.pointerId) return;
    const kind = gesture.kind;
    const hit = tableAt(e.clientX, e.clientY);
    if (hit === null) {
      abortGesture();
      return;
    }
    endGesture(e.pointerId);
    // No auto-shoot, and no aim update on release: the drag already applied
    // every correction it was going to.
    if (kind !== 'place') return;
    const result = options.placement?.validate(hit.table);
    if (result?.legal) options.placement?.onCommit?.(hit.table);
    else options.onCancel?.();
  };

  const onCancelEvent = (e: PointerEvent): void => {
    if (gesture === null || e.pointerId !== gesture.pointerId) return;
    abortGesture();
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (gesture === null || e.key !== 'Escape') return;
    abortGesture();
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancelEvent);
  window.addEventListener('keydown', onKeyDown);

  return {
    dispose: (): void => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancelEvent);
      window.removeEventListener('keydown', onKeyDown);
    },
  };
};
