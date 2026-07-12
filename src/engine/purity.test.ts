// Guards the purity boundary: no DOM/React/clock/random/network references may
// appear anywhere under src/engine. This is a grep-style regression test that
// backs the lint rules with an explicit acceptance check. Sources are pulled in
// as raw strings via Vite's glob import so the check needs no Node typings.

import { describe, it, expect } from 'vitest';

const sources = import.meta.glob('./**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const FORBIDDEN: readonly RegExp[] = [
  /Math\.random/,
  /Date\.now/,
  /performance\.now/,
  /\bfetch\s*\(/,
  /\bwindow\b/,
  /\bdocument\b/,
  /from ['"]react['"]/,
];

describe('engine purity', () => {
  it('contains no DOM/React/clock/random/network references', () => {
    const files = Object.entries(sources).filter(([path]) => !path.endsWith('.test.ts'));
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const [path, source] of files) {
      for (const pattern of FORBIDDEN) {
        if (pattern.test(source)) offenders.push(`${path}: ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
