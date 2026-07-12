// Guards the purity boundary for the bot layer. The pure planning core
// (candidates, evaluate, index) must contain no DOM/React/clock/random/network
// references. worker.ts is the single allowed exception: it is the Worker
// messaging boundary, so it may use `self`/`postMessage` and the wall clock to
// time-box the search - but it still must not fetch, touch the document/window,
// or import React. Mirrors the engine and rules purity checks.

import { describe, it, expect } from 'vitest';

const sources = import.meta.glob('./**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const NETWORK_AND_DOM: readonly RegExp[] = [
  /Math\.random/,
  /Date\.now/,
  /\bfetch\s*\(/,
  /\bwindow\b/,
  /\bdocument\b/,
  /from ['"]react['"]/,
];

// The pure core additionally may not read a clock.
const CORE_ONLY: readonly RegExp[] = [/performance\.now/];

describe('bot purity', () => {
  const entries = Object.entries(sources).filter(([path]) => !path.endsWith('.test.ts'));

  it('has source files to check', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('the pure core contains no DOM/React/clock/random/network references', () => {
    const core = entries.filter(([path]) => !path.endsWith('/worker.ts'));
    const offenders: string[] = [];
    for (const [path, source] of core) {
      for (const pattern of [...NETWORK_AND_DOM, ...CORE_ONLY]) {
        if (pattern.test(source)) offenders.push(`${path}: ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the worker wrapper makes no network/DOM/React references (messaging only)', () => {
    const offenders: string[] = [];
    for (const [path, source] of entries) {
      if (!path.endsWith('/worker.ts')) continue;
      for (const pattern of NETWORK_AND_DOM) {
        if (pattern.test(source)) offenders.push(`${path}: ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
