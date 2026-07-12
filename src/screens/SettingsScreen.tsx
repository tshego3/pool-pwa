// Settings screen. 4-branch async pattern over the single settings record
// (typed null until loaded); useSettings reads from and writes to IndexedDB.
// The data branch renders the editable form seeded from the loaded record.

import { useState } from 'react';
import {
  Button,
  Container,
  Group,
  SegmentedControl,
  Select,
  Skeleton,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import type { GameSettings } from '../types/settings';
import type { Difficulty } from '../types/bot';
import { useSettings } from '../hooks/useSettings';
import { TABLE_PALETTES } from '../render/palette';

const TABLE_COLOR_OPTIONS = Object.keys(TABLE_PALETTES).map((key) => ({
  value: key,
  label: key.replace(/-/g, ' '),
}));

function SettingsForm({
  initial,
  onSave,
}: {
  readonly initial: GameSettings;
  readonly onSave: (next: GameSettings) => void;
}) {
  const [draft, setDraft] = useState<GameSettings>(initial);
  const update = (patch: Partial<GameSettings>): void =>
    setDraft((prev) => ({ ...prev, ...patch }));

  return (
    <Stack gap="lg">
      <Switch
        label="Sound effects"
        checked={draft.soundEnabled}
        onChange={(e) => update({ soundEnabled: e.currentTarget.checked })}
      />

      <Stack gap="xs">
        <Text component="label" size="sm">
          Guide line bounces: {draft.guideBounces}
        </Text>
        <Slider
          min={0}
          max={3}
          step={1}
          value={draft.guideBounces}
          onChange={(v) => update({ guideBounces: v })}
          marks={[
            { value: 0, label: '0' },
            { value: 3, label: '3' },
          ]}
        />
      </Stack>

      <Select
        label="Table color"
        data={TABLE_COLOR_OPTIONS}
        value={draft.tableColor}
        onChange={(v) => update({ tableColor: v ?? draft.tableColor })}
        allowDeselect={false}
      />

      <Stack gap="xs">
        <Text component="label" size="sm">
          Handedness
        </Text>
        <SegmentedControl
          value={draft.handedness}
          onChange={(v) => update({ handedness: v as GameSettings['handedness'] })}
          data={[
            { value: 'left', label: 'Left' },
            { value: 'right', label: 'Right' },
          ]}
        />
      </Stack>

      <Stack gap="xs">
        <Text component="label" size="sm">
          Default difficulty
        </Text>
        <SegmentedControl
          value={draft.defaultDifficulty}
          onChange={(v) => update({ defaultDifficulty: v as Difficulty })}
          data={[
            { value: 'easy', label: 'Easy' },
            { value: 'medium', label: 'Medium' },
            { value: 'hard', label: 'Hard' },
          ]}
        />
      </Stack>

      <Button size="md" onClick={() => onSave(draft)}>
        Save
      </Button>
      <Text size="xs" c="dimmed">
        Settings are saved to this device and used the next time you play.
      </Text>
    </Stack>
  );
}

export interface SettingsScreenProps {
  readonly onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { settings, isLoading, errorMessage, reload, save } = useSettings();

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={1}>Settings</Title>
          <Button variant="subtle" leftSection={<IconArrowLeft size={20} />} onClick={onBack}>
            Menu
          </Button>
        </Group>

        {isLoading ? (
          <Stack gap="sm">
            <Skeleton height={40} radius="sm" />
            <Skeleton height={40} radius="sm" />
            <Skeleton height={40} radius="sm" />
          </Stack>
        ) : errorMessage ? (
          <Stack gap="sm" align="flex-start">
            <Text c="dimmed">{errorMessage}</Text>
            <Button onClick={reload}>Retry</Button>
          </Stack>
        ) : settings !== null ? (
          <SettingsForm initial={settings} onSave={save} />
        ) : (
          <Text c="dimmed">No settings found. Default settings will be used.</Text>
        )}
      </Stack>
    </Container>
  );
}
