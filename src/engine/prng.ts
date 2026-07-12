// Single seeded PRNG for the whole deterministic core. No calls to the global
// JS RNG anywhere in engine/rules/bot; all jitter flows from a seed part of the
// persisted game snapshot. mulberry32: fast, well-distributed, 32-bit state.

export interface Prng {
  // Next float in [0, 1).
  next(): number;
  // Next float in [min, max).
  range(min: number, max: number): number;
  // Current 32-bit state, for snapshotting/resuming.
  state(): number;
}

export const createPrng = (seed: number): Prng => {
  // Coerce to an unsigned 32-bit integer so a float seed still works.
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    state: () => s >>> 0,
  };
};
