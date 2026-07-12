import { describe, it, expect, vi } from 'vitest';
import { createController } from './controller';
import type { ShotPlanner } from './controller';
import { createEightBallTable } from '../engine/tables/eightBall';
import { DEFAULT_PHYSICS } from '../engine/config';
import type { ShotInput } from '../types/physics';

const geometry = createEightBallTable();
const config = DEFAULT_PHYSICS;

// A firm break straight down the long rail into the apex of the rack.
const breakShot: ShotInput = { angle: 0, power: 0.85 };

describe('createController', () => {
  it('runs a shot through simulate -> deriveOutcome -> reduce and advances state', () => {
    const controller = createController({ geometry, config });
    expect(controller.game().phase).toBe('break');

    const result = controller.applyShot(breakShot);

    // The cue actually reached the rack, so first contact is a real object ball.
    expect(result.outcome.firstContact).toBeGreaterThan(0);
    // The break resolves to an open table, or to a re-rack if the 8 dropped.
    expect(['open', 'break']).toContain(result.game.phase);
    // The returned state is the controller's authoritative state.
    expect(result.game).toBe(controller.game());
    expect(result.balls).toBe(controller.balls());
  });

  it('notifies onChange with the new snapshot after each shot', () => {
    const onChange = vi.fn();
    const controller = createController({ geometry, config, onChange });

    controller.applyShot(breakShot);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ game: controller.game(), balls: controller.balls() });
  });

  it('reports the bot turn and delegates it to the injected planner', () => {
    const plan: ShotPlanner = vi.fn(() => breakShot);
    const controller = createController({ geometry, config, breaker: 'bot', plan });

    expect(controller.isBotTurn()).toBe(true);
    const result = controller.playBotTurn();

    expect(plan).toHaveBeenCalledTimes(1);
    expect(result.game).toBe(controller.game());
  });

  it('throws when asked to play a bot turn on the player turn', () => {
    const controller = createController({ geometry, config, breaker: 'player', plan: () => breakShot });
    expect(controller.isBotTurn()).toBe(false);
    expect(() => controller.playBotTurn()).toThrow();
  });

  it('throws when a bot turn is due but no planner was provided', () => {
    const controller = createController({ geometry, config, breaker: 'bot' });
    expect(() => controller.playBotTurn()).toThrow();
  });
});
