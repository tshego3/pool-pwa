// Main menu: start a new game at a chosen difficulty, a resume-game slot backed
// by the saved IndexedDB snapshot, and links to stats/settings. Presentational;
// difficulty selection is local, and starting/navigating are delegated up.

import { Button, Container, SegmentedControl, Stack, Text, Title } from '@mantine/core';
import { IconChartBar, IconPlayerPlay, IconSettings } from '@tabler/icons-react';
import type { Difficulty } from '../types/bot';
import type { AppScreen } from '../types';

const DIFFICULTIES: readonly { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export interface MenuScreenProps {
  readonly difficulty: Difficulty;
  readonly onDifficultyChange: (difficulty: Difficulty) => void;
  readonly onPlay: () => void;
  readonly onNavigate: (screen: AppScreen) => void;
  // True once a saved game exists; enables the resume slot.
  readonly canResume?: boolean;
  readonly onResume?: () => void;
}

export function MenuScreen({
  difficulty,
  onDifficultyChange,
  onPlay,
  onNavigate,
  canResume = false,
  onResume,
}: MenuScreenProps) {
  return (
    <Container size="xs" py="xl">
      <Stack gap="xl">
        <Title order={1} ta="center">
          8-Ball Pool
        </Title>

        <Stack gap="xs">
          <Text component="label" id="difficulty-label" size="sm" c="dimmed">
            Difficulty
          </Text>
          <SegmentedControl
            aria-labelledby="difficulty-label"
            fullWidth
            size="md"
            value={difficulty}
            onChange={(v) => onDifficultyChange(v as Difficulty)}
            data={DIFFICULTIES.map((d) => ({ value: d.value, label: d.label }))}
          />
        </Stack>

        <Stack gap="sm">
          <Button
            size="lg"
            leftSection={<IconPlayerPlay size={22} />}
            onClick={onPlay}
            fullWidth
          >
            New game
          </Button>
          <Button
            size="lg"
            variant="default"
            onClick={onResume}
            disabled={!canResume}
            fullWidth
          >
            Resume game
          </Button>
        </Stack>

        <Stack gap="sm">
          <Button
            size="md"
            variant="subtle"
            leftSection={<IconChartBar size={20} />}
            onClick={() => onNavigate('stats')}
            fullWidth
          >
            Stats
          </Button>
          <Button
            size="md"
            variant="subtle"
            leftSection={<IconSettings size={20} />}
            onClick={() => onNavigate('settings')}
            fullWidth
          >
            Settings
          </Button>
        </Stack>
      </Stack>
    </Container>
  );
}
