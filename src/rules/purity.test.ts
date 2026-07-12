// Guards the purity boundary for the rules layer: no DOM/React/clock/random/
// network references may appear anywhere under src/rules. Mirrors the engine
// purity check; sources are pulled in as raw strings via Vite's glob import.

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

describe('rules purity', () => {
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
