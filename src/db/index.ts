// IndexedDB persistence via the `idb` wrapper. This is the sole data layer for
// the PWA: the single in-progress game snapshot, per-difficulty stats, and user
// settings. It is pure I/O - all game logic lives in the pure core - and it is
// the only module that opens the database.
//
// Store layout (schema v1):
//  - gameSnapshot: one record under the fixed key 'current' (the resume slot).
//  - stats:        one DifficultyStats record per difficulty (key = difficulty).
//  - settings:     one GameSettings record under the fixed key 'user'.
//
// Version policy: on load, a snapshot whose `version` does not match the current
// SCHEMA_VERSION is discarded (deleted and treated as absent) rather than
// migrated. Documented in the pool-pwa-physics-rules skill.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Difficulty } from '../types/bot';
import type { DifficultyStats } from '../types/stats';
import type { GameSettings } from '../types/settings';
import type { GameResult, GameSnapshot } from '../types/persistence';
import { SCHEMA_VERSION } from '../types/persistence';

const DB_NAME = 'pool-pwa';
const DB_VERSION = 1;
const SNAPSHOT_KEY = 'current';
const SETTINGS_KEY = 'user';

interface PoolDB extends DBSchema {
  gameSnapshot: { key: string; value: GameSnapshot };
  stats: { key: Difficulty; value: DifficultyStats };
  settings: { key: string; value: GameSettings };
}

let dbPromise: Promise<IDBPDatabase<PoolDB>> | null = null;

const getDB = (): Promise<IDBPDatabase<PoolDB>> => {
  dbPromise ??= openDB<PoolDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('gameSnapshot')) db.createObjectStore('gameSnapshot');
      if (!db.objectStoreNames.contains('stats')) db.createObjectStore('stats');
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    },
  });
  return dbPromise;
};

// --- Pure helpers (unit-tested without a database) -------------------------

// A snapshot is usable only if its schema version matches the running app.
export const isSnapshotCompatible = (snapshot: GameSnapshot): boolean =>
  snapshot.version === SCHEMA_VERSION;

export const emptyStats = (difficulty: Difficulty): DifficultyStats => ({
  difficulty,
  played: 0,
  won: 0,
  potted: 0,
  fouls: 0,
  bestStreak: 0,
});

// Fold one finished game into the running per-difficulty totals.
export const mergeGameResult = (prev: DifficultyStats, result: GameResult): DifficultyStats => ({
  difficulty: prev.difficulty,
  played: prev.played + 1,
  won: prev.won + (result.won ? 1 : 0),
  potted: prev.potted + result.potted,
  fouls: prev.fouls + result.fouls,
  bestStreak: Math.max(prev.bestStreak, result.streak),
});

// --- Game snapshot (resume slot) -------------------------------------------

export const saveSnapshot = async (snapshot: GameSnapshot): Promise<void> => {
  const db = await getDB();
  await db.put('gameSnapshot', snapshot, SNAPSHOT_KEY);
};

// Loads the resume slot, or null when there is none. A snapshot from an
// incompatible schema version is discarded and reported as absent.
export const loadSnapshot = async (): Promise<GameSnapshot | null> => {
  const db = await getDB();
  const snapshot = await db.get('gameSnapshot', SNAPSHOT_KEY);
  if (snapshot === undefined) return null;
  if (!isSnapshotCompatible(snapshot)) {
    await db.delete('gameSnapshot', SNAPSHOT_KEY);
    return null;
  }
  return snapshot;
};

export const clearSnapshot = async (): Promise<void> => {
  const db = await getDB();
  await db.delete('gameSnapshot', SNAPSHOT_KEY);
};

// --- Stats ------------------------------------------------------------------

export const loadStats = async (): Promise<DifficultyStats[]> => {
  const db = await getDB();
  return db.getAll('stats');
};

// Merge a finished game into the stored stats for its difficulty, seeding an
// empty record the first time that difficulty is played.
export const recordGameResult = async (result: GameResult): Promise<void> => {
  const db = await getDB();
  const prev = (await db.get('stats', result.difficulty)) ?? emptyStats(result.difficulty);
  await db.put('stats', mergeGameResult(prev, result), result.difficulty);
};

// --- Settings ---------------------------------------------------------------

export const loadSettings = async (): Promise<GameSettings | null> => {
  const db = await getDB();
  return (await db.get('settings', SETTINGS_KEY)) ?? null;
};

export const saveSettings = async (settings: GameSettings): Promise<void> => {
  const db = await getDB();
  await db.put('settings', settings, SETTINGS_KEY);
};
