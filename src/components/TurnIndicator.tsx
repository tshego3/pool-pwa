// Whose turn it is AND which group each seat owns, in one place: the two seat
// chips are the turn indicator. The active seat is lit by the theme's single
// accent hue; the waiting seat keeps a neutral edge, so the difference is a
// colour change on a stable layout rather than a separate banner appearing.
// Presentational only; the game screen feeds it the published snapshot.

import { Group, Loader, Paper, Text } from '@mantine/core';
import type { BallGroup, Seat } from '../types/rules';
import { groupLabel, groupShortLabel, turnLabel } from './hudLabels';

export interface TurnIndicatorProps {
  readonly turn: Seat;
  readonly groups: Readonly<Record<Seat, BallGroup | null>>;
  readonly thinking: boolean;
}

const SWATCH = 14;

// A miniature ball: filled for solids, banded for stripes, empty while the table
// is open. Shape, not colour, carries the distinction, so the accent hue is free
// to mean one thing only: whose turn it is.
function GroupSwatch({ group, lit }: { readonly group: BallGroup | null; readonly lit: boolean }) {
  const ink = lit ? 'var(--mantine-color-active-4)' : 'var(--mantine-color-dark-1)';
  return (
    <div
      aria-hidden
      style={{
        width: SWATCH,
        height: SWATCH,
        borderRadius: '50%',
        border: `1px solid ${ink}`,
        background: group === 'solids' ? ink : 'transparent',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      {group === 'stripes' && <div style={{ width: '100%', height: '45%', background: ink }} />}
    </div>
  );
}

function SeatChip({
  seat,
  label,
  group,
  active,
  thinking,
}: {
  readonly seat: Seat;
  readonly label: string;
  readonly group: BallGroup | null;
  readonly active: boolean;
  readonly thinking: boolean;
}) {
  return (
    <Paper
      data-testid={`seat-${seat}`}
      data-active={active ? 'true' : 'false'}
      radius="sm"
      py={6}
      px="sm"
      aria-label={`${label}: ${groupLabel(group)}`}
      style={{
        // Tonal layering plus one accent edge: no shadow, no size change, so the
        // header never shifts as the turn passes back and forth.
        background: active ? 'var(--mantine-color-dark-8)' : 'transparent',
        borderLeft: `3px solid ${active ? 'var(--mantine-color-active-4)' : 'var(--mantine-color-dark-2)'}`,
      }}
    >
      <Group gap={8} wrap="nowrap">
        {thinking ? <Loader size={14} color="active.4" /> : <GroupSwatch group={group} lit={active} />}
        <Text size="sm" fw={active ? 700 : 500}>
          {label}
        </Text>
        <Text size="sm" fw={600} c={active ? 'active.4' : 'dimmed'}>
          {groupShortLabel(group)}
        </Text>
      </Group>
    </Paper>
  );
}

export function TurnIndicator({ turn, groups, thinking }: TurnIndicatorProps) {
  return (
    <Group
      gap="xs"
      wrap="nowrap"
      role="status"
      aria-live="polite"
      aria-label={turnLabel(turn, thinking)}
    >
      <SeatChip
        seat="player"
        label="You"
        group={groups.player}
        active={turn === 'player'}
        thinking={false}
      />
      <SeatChip
        seat="bot"
        label="Bot"
        group={groups.bot}
        active={turn === 'bot'}
        thinking={turn === 'bot' && thinking}
      />
    </Group>
  );
}
