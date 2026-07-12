import type { AppScreen } from '../types';

export const VALID_SCREENS: readonly AppScreen[] = ['home', 'game', 'stats', 'settings'];

export const DEFAULT_SCREEN: AppScreen = 'home';

export function isValidScreen(value: string): value is AppScreen {
  return (VALID_SCREENS as readonly string[]).includes(value);
}
