// DB round-trip tests. `fake-indexeddb/auto` registers an in-memory IndexedDB on
// the global so the real idb code path runs in the node test environment. Each
// test resets the databases so state never leaks between cases.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSnapshot, GameResult } from '../types/persistence';
import { SCHEMA_VERSION } from '../types/persistence';
import type { Ball } from '../types/physics';
import type { GameState } from '../types/rules';
import type { GameSettings } from '../types/settings';

// Reset requires a fresh module instance so the cached connection is dropped.
async function freshDB() {
  vi.resetModules();
  globalThis.indexedDB = new IDBFactory();
  return import('./index');
}

const ball = (id: number, x: number, y: number): Ball => ({
  id,
  position: { x, y },
  velocity: { x: 0, y: 0 },
  spin: { x: 0, y: 0 },
  radius: 0.028575,
  pocketed: false,
});

const game: GameState = {
  phase: 'assigned',
  turn: 'player',
  groups: { player: 'solids', bot: 'stripes' },
  pocketed: [1, 9],
  ballInHand: 'none',
  foul: null,
  winner: null,
};

const snapshot: GameSnapshot = {
  version: SCHEMA_VERSION,
  game,
  balls: [ball(0, 0.5, 0.5), ball(8, 1.4, 0.5)],
  difficulty: 'hard',
  seed: 12345,
};

describe('game snapshot round-trip', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    vi.resetModules();
  });

  it('save then load restores an identical snapshot', async () => {
    const db = await freshDB();
    await db.saveSnapshot(snapshot);
    const loaded = await db.loadSnapshot();
    expect(loaded).toEqual(snapshot);
  });

  it('returns null when there is no saved snapshot', async () => {
    const db = await freshDB();
    expect(await db.loadSnapshot()).toBeNull();
  });

  it('discards and deletes a snapshot from an incompatible version', async () => {
    const db = await freshDB();
    await db.saveSnapshot({ ...snapshot, version: SCHEMA_VERSION + 1 });
    expect(await db.loadSnapshot()).toBeNull();
    // The stale record is removed, so a subsequent load is still null.
    expect(await db.loadSnapshot()).toBeNull();
  });

  it('clears the resume slot', async () => {
    const db = await freshDB();
    await db.saveSnapshot(snapshot);
    await db.clearSnapshot();
    expect(await db.loadSnapshot()).toBeNull();
  });
});

describe('stats accumulation', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    vi.resetModules();
  });

  const win: GameResult = { difficulty: 'medium', won: true, potted: 5, fouls: 1, streak: 3 };
  const loss: GameResult = { difficulty: 'medium', won: false, potted: 2, fouls: 2, streak: 1 };

  it('starts empty', async () => {
    const db = await freshDB();
    expect(await db.loadStats()).toEqual([]);
  });

  it('increments totals per game result and keeps the best streak', async () => {
    const db = await freshDB();
    await db.recordGameResult(win);
    await db.recordGameResult(loss);
    const [row] = await db.loadStats();
    expect(row).toEqual({
      difficulty: 'medium',
      played: 2,
      won: 1,
      potted: 7,
      fouls: 3,
      bestStreak: 3,
    });
  });

  it('keeps stats separate per difficulty', async () => {
    const db = await freshDB();
    await db.recordGameResult(win);
    await db.recordGameResult({ ...win, difficulty: 'easy', won: false });
    const stats = await db.loadStats();
    expect(stats).toHaveLength(2);
  });
});

describe('settings round-trip', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    vi.resetModules();
  });

  const settings: GameSettings = {
    soundEnabled: false,
    guideBounces: 2,
    tableColor: 'midnight-blue',
    handedness: 'left',
    defaultDifficulty: 'hard',
    showAngleControls: true,
  };

  it('returns null before anything is saved', async () => {
    const db = await freshDB();
    expect(await db.loadSettings()).toBeNull();
  });

  it('save then load restores identical settings', async () => {
    const db = await freshDB();
    await db.saveSettings(settings);
    expect(await db.loadSettings()).toEqual(settings);
  });
});
