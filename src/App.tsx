// Top-level screen router. The hash router (useRouter) selects the active screen;
// App owns the cross-screen state that outlives a single screen: the chosen
// difficulty and a game-session key that is bumped to start a fresh game (new
// game or rematch), remounting GameScreen so its whole session/renderer/loop is
// torn down and rebuilt cleanly.

import { useCallback, useEffect, useState } from 'react';
import type { Difficulty } from './types/bot';
import type { GameSnapshot } from './types/persistence';
import { loadSnapshot } from './db';
import { useRouter } from './hooks/useRouter';
import { MenuScreen } from './screens/MenuScreen';
import { GameScreen } from './screens/GameScreen';
import { StatsScreen } from './screens/StatsScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export function App() {
  const { screen, navigate } = useRouter();
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gameKey, setGameKey] = useState(0);
  // The saved game offered by the menu's Resume slot, and the one currently
  // being resumed (null for a fresh game).
  const [saved, setSaved] = useState<GameSnapshot | null>(null);
  const [resume, setResume] = useState<GameSnapshot | null>(null);

  // Refresh the resume slot whenever the menu is shown, so it reflects the game
  // just finished (cleared) or quit mid-game (still resumable).
  const refreshSaved = useCallback((): void => {
    loadSnapshot()
      .then(setSaved)
      .catch(() => setSaved(null));
  }, []);

  useEffect(() => {
    if (screen === 'home') refreshSaved();
  }, [screen, refreshSaved]);

  const startGame = (): void => {
    setResume(null);
    setGameKey((k) => k + 1);
    navigate('game');
  };

  const resumeGame = (): void => {
    if (saved === null) return;
    setResume(saved);
    setGameKey((k) => k + 1);
    navigate('game');
  };

  if (screen === 'game') {
    return (
      <GameScreen
        key={gameKey}
        difficulty={difficulty}
        resume={resume}
        onExit={() => navigate('home')}
        onRematch={() => {
          setResume(null);
          setGameKey((k) => k + 1);
        }}
      />
    );
  }

  if (screen === 'stats') return <StatsScreen onBack={() => navigate('home')} />;
  if (screen === 'settings') return <SettingsScreen onBack={() => navigate('home')} />;

  return (
    <MenuScreen
      difficulty={difficulty}
      onDifficultyChange={setDifficulty}
      onPlay={startGame}
      onNavigate={navigate}
      canResume={saved !== null}
      onResume={resumeGame}
    />
  );
}
