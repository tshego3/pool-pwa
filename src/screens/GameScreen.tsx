// The play screen. It mounts the canvas by ref and, in a single effect, creates
// the game session, renderer, fixed-timestep loop, and pointer input - then
// tears them all down on unmount. React never sets state per frame: the loop
// drives the renderer imperatively, and the HUD updates only from the session's
// shot-boundary snapshots (via useGameState). Aim state changes only on
// user-driven pointer/keyboard input, never inside the render loop.

import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Box, Group, Paper, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconArrowLeft } from '@tabler/icons-react';
import { useSettings } from '../hooks/useSettings';
import type { AimResult } from '../types/aiming';
import type { Difficulty } from '../types/bot';
import type { GameSnapshot } from '../types/persistence';
import { SCHEMA_VERSION } from '../types/persistence';
import { clearSnapshot, recordGameResult, saveSnapshot } from '../db';
import { createGameSession, type GameSession } from '../game/session';
import { createLoop } from '../game/loop';
import { createInput } from '../game/input';
import { createRenderer, type Renderer } from '../render/renderer';
import { useGameState } from '../hooks/useGameState';
import { TurnIndicator } from '../components/TurnIndicator';
import { GroupIndicator } from '../components/GroupIndicator';
import { FoulBanner } from '../components/FoulBanner';
import { AlertWrapper } from '../components/AlertWrapper';
import { PocketedTray } from '../components/PocketedTray';
import { AngleControl, PowerControl, ShootButton } from '../components/AimControls';
import { EndOverlay } from '../components/EndOverlay';

export interface GameScreenProps {
  readonly difficulty: Difficulty;
  // A saved game to resume, or null/undefined to start a fresh rack. When
  // present its own difficulty and seed take precedence over the menu selection.
  readonly resume?: GameSnapshot | null;
  readonly onExit: () => void;
  readonly onRematch: () => void;
}

const ZERO_AIM: AimResult = { angle: 0, power: 0 };
const TARGET_PX = 44;

export function GameScreen({ difficulty, resume, onExit, onRematch }: GameScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const { settings } = useSettings();
  const [session, setSession] = useState<GameSession | null>(null);
  const [aim, setAim] = useState<AimResult>(ZERO_AIM);
  // Latest aim for imperative callbacks created once at mount (input handlers),
  // kept in sync by the guide effect below.
  const aimRef = useRef<AimResult>(ZERO_AIM);
  const view = useGameState(session);
  // Seed is fixed for this mount so bot planning stays deterministic across a
  // save/resume cycle. GameScreen is remounted (via key) for every new game.
  const seedRef = useRef(resume?.seed ?? Date.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const seed = seedRef.current;
    const effectiveDifficulty = resume?.difficulty ?? difficulty;
    const s = createGameSession({
      difficulty: effectiveDifficulty,
      seed,
      restore: resume != null ? { game: resume.game, balls: resume.balls } : undefined,
      onPersist: ({ game, balls }) => {
        const snapshot: GameSnapshot = {
          version: SCHEMA_VERSION,
          game,
          balls,
          difficulty: effectiveDifficulty,
          seed,
        };
        saveSnapshot(snapshot).catch(() => {
          // A failed save just means resume is unavailable; play continues.
        });
      },
      onGameEnd: (result) => {
        recordGameResult(result).catch(() => {});
        clearSnapshot().catch(() => {});
      },
    });
    const renderer = createRenderer(canvas, s.geometry, { rotate: 'auto' });
    rendererRef.current = renderer;
    renderer.resize();

    const input = createInput({
      canvas,
      getTransform: () => renderer.getTransform(),
      getCuePosition: () => s.cuePosition(),
      onAim: (next) => setAim({ ...next, power: 0 }),
      onShoot: (next) => {
        setAim(ZERO_AIM);
        s.shoot(next);
      },
      onCancel: () => setAim(ZERO_AIM),
      placement: {
        isActive: () => s.placementActive(),
        validate: (pos) => s.validatePlacement(pos),
        onMove: (pos, result) => {
          if (!result.legal) return;
          s.previewPlacement(pos);
          // The cue moved without an aim change; recompute the guide from it.
          renderer.setGuide(s.computeGuide(aimRef.current));
        },
        onCommit: (pos) => {
          s.commitPlacement(pos);
          renderer.setGuide(s.computeGuide(aimRef.current));
        },
        ballRadius: s.geometry.ballRadius,
      },
    });

    const loop = createLoop({
      onStep: () => s.step(),
      onRender: (alpha) => renderer.draw(s.prevState(), s.currState(), alpha),
    });

    setSession(s);
    loop.start();
    s.start();

    return () => {
      loop.stop();
      input.dispose();
      renderer.dispose();
      s.dispose();
      rendererRef.current = null;
      setSession(null);
    };
  }, [difficulty, resume]);

  // Keep the aim guide on the table the whole time the player is up (the
  // session returns null when aiming is not possible, e.g. balls in motion or
  // the bot's turn), and re-aim it on every aim or shot-boundary change.
  useEffect(() => {
    aimRef.current = aim;
    rendererRef.current?.setGuide(session?.computeGuide(aim) ?? null);
  }, [session, aim, view]);

  const fallbackShoot = (): void => {
    session?.shoot(aim);
    setAim(ZERO_AIM);
  };

  const game = view?.game ?? null;
  const busy = view?.thinking === true || view?.animating === true;
  const canAim = game !== null && !busy && game.winner === null && game.turn === 'player';
  const gameActive = game !== null && game.winner === null;
  const isWide = useMediaQuery('(min-width: 48em)') === true;

  return (
    <Box
      // Long-press (text selection / iOS callout / context menu) fights the
      // aim and power drag gestures, so the whole play screen opts out.
      onContextMenu={(e) => e.preventDefault()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100dvh',
        overflow: 'hidden',
        background: 'var(--mantine-color-dark-4)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      <Box component="section" aria-label="Game status" p="xs" style={{ background: 'transparent', position: 'relative' }}>
        <Group justify="space-between" align="center" wrap="nowrap">
          <ActionIcon
            aria-label="Back to menu"
            variant="subtle"
            size={TARGET_PX}
            onClick={onExit}
          >
            <IconArrowLeft size={22} />
          </ActionIcon>
          <Stack gap={4} align="flex-end">
            {game !== null ? <TurnIndicator turn={game.turn} thinking={view?.thinking === true} /> : null}
            {game !== null ? <GroupIndicator groups={game.groups} /> : null}
          </Stack>
        </Group>
        {game !== null && game.foul !== null && (
          <Box style={{ position: 'absolute', top: '100%', left: 0, right: 0, padding: 'var(--mantine-spacing-xs)', zIndex: 10 }}>
            <AlertWrapper visible={game.foul !== null}>
              <FoulBanner reason={game.foul} />
            </AlertWrapper>
          </Box>
        )}
      </Box>

      {/* The main play area: side controls and canvas */}
      <Box style={{ display: 'flex', flexDirection: 'row', flex: 1, minHeight: 0 }}>
        {gameActive && (
          <Paper
            component="section"
            aria-label="Aim controls"
            radius={0}
            p={4}
            style={{
              background: 'var(--mantine-color-dark-8)',
              // Just wide enough for the 44px touch targets on phones.
              width: isWide ? 88 : 64,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              borderRight: '1px solid var(--mantine-color-dark-4)',
            }}
          >
            <Stack gap="xs">
              {settings?.showAngleControls && (
                <AngleControl 
                  aim={aim} 
                  onAngleChange={(angle) => setAim({ ...aim, angle })} 
                  disabled={!canAim} 
                />
              )}
              <PowerControl 
                aim={aim} 
                onPowerChange={(power) => setAim({ ...aim, power })} 
                disabled={!canAim} 
              />
              <Box style={{ display: 'flex', justifyContent: 'center' }}>
                <ShootButton 
                  aim={aim} 
                  onShoot={fallbackShoot} 
                  disabled={!canAim} 
                />
              </Box>
            </Stack>
          </Paper>
        )}
        <Box style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <canvas
            ref={canvasRef}
            aria-label="Pool table"
            style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', outline: 'none' }}
          />
        </Box>
      </Box>
      <Paper
        component="section"
        aria-label="Game status"
        radius={0}
        p="xs"
        style={{
          background: 'var(--mantine-color-dark-8)',
          minHeight: 60,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Stack gap="md" justify="center">
          <Group justify="space-between" wrap="nowrap" gap="sm">
            {game !== null ? <PocketedTray pocketed={game.pocketed} /> : <span />}
            {busy ? (
              <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                {view?.thinking === true ? 'Bot is planning its shot' : 'Balls in motion'}
              </Text>
            ) : null}
          </Group>
        </Stack>
      </Paper>

      <EndOverlay winner={game?.winner ?? null} onRematch={onRematch} onBackToMenu={onExit} />
    </Box>
  );
}
