// Tiny pub/sub bridge from a GameSession to React. The session publishes
// shot-boundary snapshots (rules state, scores, turn, plus the discrete
// thinking/animating flags); this hook exposes the latest one to the HUD via
// useSyncExternalStore, so React re-renders only when a snapshot is published -
// never per animation frame. Accepts a null session (before the game screen has
// mounted it) and returns null until the first view exists.

import { useSyncExternalStore } from 'react';
import type { GameSession, GameView } from '../game/session';

const EMPTY_UNSUBSCRIBE = (): void => {};

export function useGameState(session: GameSession | null): GameView | null {
  return useSyncExternalStore(
    (onChange) => (session === null ? EMPTY_UNSUBSCRIBE : session.subscribe(onChange)),
    () => (session === null ? null : session.getView()),
  );
}
