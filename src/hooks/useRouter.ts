import { useState, useEffect, useCallback } from 'react';
import type { AppScreen } from '../types';
import { DEFAULT_SCREEN, isValidScreen } from '../lib/screens';

function getScreenFromHash(): AppScreen {
  const hash = window.location.hash.replace('#', '');
  return isValidScreen(hash) ? hash : DEFAULT_SCREEN;
}

export function useRouter() {
  const [screen, setScreenState] = useState<AppScreen>(getScreenFromHash);

  useEffect(() => {
    function onHashChange() {
      setScreenState(getScreenFromHash());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((target: AppScreen) => {
    window.location.hash = target;
  }, []);

  return { screen, navigate };
}
