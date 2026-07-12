// Loads per-difficulty play stats from IndexedDB using the 4-branch async
// pattern (loading / error / data / empty). Derived views (labels, ordering)
// stay in the screen; the hook exposes only the raw records and load state.

import { useCallback, useEffect, useState } from 'react';
import type { DifficultyStats } from '../types/stats';
import { loadStats } from '../db';

export interface StatsState {
  readonly stats: readonly DifficultyStats[];
  readonly isLoading: boolean;
  readonly errorMessage: string | null;
  readonly hasStats: boolean;
  readonly reload: () => void;
}

export function useStats(): StatsState {
  const [stats, setStats] = useState<readonly DifficultyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);
    loadStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setErrorMessage('Could not load your stats. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { stats, isLoading, errorMessage, hasStats: stats.length > 0, reload };
}
