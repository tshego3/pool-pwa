import { describe, it, expect } from 'vitest';
import { isValidScreen, VALID_SCREENS, DEFAULT_SCREEN } from './lib/screens';

describe('screens', () => {
  it('accepts every valid screen name', () => {
    for (const screen of VALID_SCREENS) {
      expect(isValidScreen(screen)).toBe(true);
    }
  });

  it('rejects unknown screen names', () => {
    expect(isValidScreen('bogus')).toBe(false);
    expect(isValidScreen('')).toBe(false);
  });

  it('exposes home as the default screen', () => {
    expect(DEFAULT_SCREEN).toBe('home');
    expect(isValidScreen(DEFAULT_SCREEN)).toBe(true);
  });
});
