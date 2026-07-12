// Pure presentation helpers shared by the HUD components. Kept DOM-free so the
// mapping from rules state to user-facing copy is unit-testable without a
// renderer. These are the single source of HUD wording; components format only.

import type { BallGroup, FoulReason, Seat } from '../types/rules';

// The kind of an object/cue ball id, used by the pocketed tray to style chips
// without importing the canvas ball palette (a separate color system).
export type BallKind = 'cue' | 'solid' | 'eight' | 'stripe';

export const ballKind = (id: number): BallKind => {
  if (id === 0) return 'cue';
  if (id === 8) return 'eight';
  return id < 8 ? 'solid' : 'stripe';
};

export const seatLabel = (seat: Seat): string => (seat === 'player' ? 'You' : 'Bot');

export const turnLabel = (turn: Seat, thinking: boolean): string => {
  if (thinking) return 'Bot thinking...';
  return turn === 'player' ? 'Your turn' : "Bot's turn";
};

export const groupLabel = (group: BallGroup | null): string => {
  if (group === 'solids') return 'Solids';
  if (group === 'stripes') return 'Stripes';
  return 'Open table';
};

export const winnerLabel = (winner: Seat): string =>
  winner === 'player' ? 'You win' : 'Bot wins';

const FOUL_MESSAGES: Record<FoulReason, string> = {
  'cue-scratch': 'Scratch - cue ball pocketed',
  'no-contact': 'No ball contacted',
  'wrong-ball-first': 'Wrong ball hit first',
  'no-rail': 'No ball reached a rail',
  'illegal-break': 'Illegal break',
};

export const foulReasonLabel = (reason: FoulReason): string => FOUL_MESSAGES[reason];
