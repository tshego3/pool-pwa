import { describe, it, expect } from 'vitest';
import {
  ballKind,
  turnLabel,
  groupLabel,
  groupShortLabel,
  winnerLabel,
  foulReasonLabel,
} from './hudLabels';

describe('hudLabels', () => {
  it('classifies ball ids by kind', () => {
    expect(ballKind(0)).toBe('cue');
    expect(ballKind(1)).toBe('solid');
    expect(ballKind(7)).toBe('solid');
    expect(ballKind(8)).toBe('eight');
    expect(ballKind(9)).toBe('stripe');
    expect(ballKind(15)).toBe('stripe');
  });

  it('flips the turn indicator between seats and thinking', () => {
    expect(turnLabel('player', false)).toBe('Your turn');
    expect(turnLabel('bot', false)).toBe("Bot's turn");
    expect(turnLabel('bot', true)).toBe('Bot thinking...');
    // Thinking wins regardless of whose turn the reducer reports.
    expect(turnLabel('player', true)).toBe('Bot thinking...');
  });

  it('labels groups and the open table', () => {
    expect(groupLabel('solids')).toBe('Solids');
    expect(groupLabel('stripes')).toBe('Stripes');
    expect(groupLabel(null)).toBe('Open table');
  });

  it('names the winner from each seat', () => {
    expect(winnerLabel('player')).toBe('You win');
    expect(winnerLabel('bot')).toBe('Bot wins');
  });

  it('gives a distinct user-safe message for every foul reason', () => {
    const reasons = [
      'cue-scratch',
      'no-contact',
      'wrong-ball-first',
      'no-rail',
      'illegal-break',
    ] as const;
    const messages = reasons.map(foulReasonLabel);
    for (const m of messages) expect(m.length).toBeGreaterThan(0);
    expect(new Set(messages).size).toBe(reasons.length);
  });

  it('shortens group names for the seat chips, keeping the long form separate', () => {
    expect(groupShortLabel('solids')).toBe('Solids');
    expect(groupShortLabel('stripes')).toBe('Stripes');
    // The long form spells out the open table; the chip form must stay compact.
    expect(groupLabel(null)).toBe('Open table');
    expect(groupShortLabel(null)).toBe('Open');
  });
});
