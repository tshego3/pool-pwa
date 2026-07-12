// Loads user settings using the 4-branch async pattern for a single record (the
// record is a typed null until loaded). Reads from and writes to IndexedDB; the
// first run has no saved record, so the defaults are returned and persisted on
// the first save.

import { useCallback, useEffect, useState } from 'react';
import type { GameSettings } from '../types/settings';
import { loadSettings as readSettings, saveSettings } from '../db';

export const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  guideBounces: 0,
  tableColor: 'classic-green',
  handedness: 'right',
  defaultDifficulty: 'medium',
};

export interface SettingsState {
  readonly settings: GameSettings | null;
  readonly isLoading: boolean;
  readonly errorMessage: string | null;
  readonly reload: () => void;
  readonly save: (next: GameSettings) => void;
}

// The defaults stand in until the user saves their own record for the first time.
async function loadSettings(): Promise<GameSettings> {
  return (await readSettings()) ?? DEFAULT_SETTINGS;
}

export function useSettings(): SettingsState {
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);
    loadSettings()
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch(() => {
        if (!cancelled) setErrorMessage('Could not load your settings. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const save = useCallback((next: GameSettings) => {
    // Optimistic in-memory update; persist in the background. A failed write
    // surfaces as a user-safe message rather than throwing.
    setSettings(next);
    setErrorMessage(null);
    saveSettings(next).catch(() => setErrorMessage('Could not save your settings. Please try again.'));
  }, []);

  return { settings, isLoading, errorMessage, reload, save };
}
