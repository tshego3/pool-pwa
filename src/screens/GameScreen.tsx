// The play screen. It mounts the canvas by ref and, in a single effect, creates
// the game session, renderer, fixed-timestep loop, and pointer input - then
// tears them all down on unmount. React never sets state per frame: the loop
// drives the renderer imperatively, and the HUD updates only from the session's
// shot-boundary snapshots (via useGameState). Aim state changes only on
// user-driven pointer/keyboard input, never inside the render loop.

import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Box, Group, Paper, Stack, Text } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
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
import { PowerMeter } from '../components/PowerMeter';
import { PocketedTray } from '../components/PocketedTray';
import { AimControls } from '../components/AimControls';
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
  const [session, setSession] = useState<GameSession | null>(null);
  const [aim, setAim] = useState<AimResult>(ZERO_AIM);
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
      onAim: (next) => {
        setAim(next);
        renderer.setGuide(s.computeGuide(next));
      },
      onShoot: (next) => {
        renderer.setGuide(null);
        setAim(ZERO_AIM);
        s.shoot(next);
      },
      onCancel: () => {
        renderer.setGuide(null);
        setAim(ZERO_AIM);
      },
      placement: {
        isActive: () => s.placementActive(),
        validate: (pos) => s.validatePlacement(pos),
        onMove: (pos, result) => {
          if (result.legal) s.previewPlacement(pos);
        },
        onCommit: (pos) => s.commitPlacement(pos),
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

  const previewAim = (next: AimResult): void => {
    setAim(next);
    rendererRef.current?.setGuide(session?.computeGuide(next) ?? null);
  };

  const fallbackShoot = (): void => {
    rendererRef.current?.setGuide(null);
    session?.shoot(aim);
    setAim(ZERO_AIM);
  };

  const game = view?.game ?? null;
  const busy = view?.thinking === true || view?.animating === true;
  const canAim = game !== null && !busy && game.winner === null && game.turn === 'player';

  return (
    <Box
      style={{
        position: 'relative',
        width: '100%',
        height: '100dvh',
        overflow: 'hidden',
        background: 'var(--mantine-color-dark-4)',
      }}
    >
      <canvas
        ref={canvasRef}
        aria-label="Pool table"
        style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
      />

      <Box
        component="section"
        aria-label="Game status"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 'var(--mantine-spacing-sm)' }}
      >
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <ActionIcon
            aria-label="Back to menu"
            variant="default"
            size={TARGET_PX}
            onClick={onExit}
          >
            <IconArrowLeft size={22} />
          </ActionIcon>
          <Stack gap={6} align="flex-end">
            {game !== null ? <TurnIndicator turn={game.turn} thinking={view?.thinking === true} /> : null}
            {game !== null ? <GroupIndicator groups={game.groups} /> : null}
          </Stack>
        </Group>
        {game !== null ? (
          <Box mt="sm">
            <FoulBanner reason={game.foul} />
          </Box>
        ) : null}
      </Box>

      <Paper
        component="section"
        aria-label="Shot controls"
        radius="lg"
        p="md"
        style={{
          position: 'absolute',
          left: 'var(--mantine-spacing-sm)',
          right: 'var(--mantine-spacing-sm)',
          bottom: 'var(--mantine-spacing-sm)',
          background: 'var(--mantine-color-dark-6)',
        }}
      >
        <Stack gap="sm">
          {game !== null ? <PocketedTray pocketed={game.pocketed} /> : null}
          <PowerMeter power={aim.power} />
          <AimControls
            aim={aim}
            onAngleChange={(angle) => previewAim({ ...aim, angle })}
            onPowerChange={(power) => previewAim({ ...aim, power })}
            onShoot={fallbackShoot}
            disabled={!canAim}
          />
          {busy ? (
            <Text size="xs" c="dimmed" ta="center">
              {view?.thinking === true ? 'Bot is planning its shot' : 'Balls in motion'}
            </Text>
          ) : null}
        </Stack>
      </Paper>

      <EndOverlay winner={game?.winner ?? null} onRematch={onRematch} onBackToMenu={onExit} />
    </Box>
  );
}
