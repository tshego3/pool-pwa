// Shows which group (solids/stripes) each seat owns, or an open table before
// assignment. Presentational; fed the published rules groups map.

import { Group, Text } from '@mantine/core';
import type { BallGroup, Seat } from '../types/rules';
import { groupLabel } from './hudLabels';

export interface GroupIndicatorProps {
  readonly groups: Readonly<Record<Seat, BallGroup | null>>;
}

export function GroupIndicator({ groups }: GroupIndicatorProps) {
  if (groups.player === null && groups.bot === null) {
    return (
      <Text size="sm" c="dimmed">
        {groupLabel(null)}
      </Text>
    );
  }
  return (
    <Group gap="lg" wrap="nowrap">
      <Text size="sm">
        You: <Text span fw={600}>{groupLabel(groups.player)}</Text>
      </Text>
      <Text size="sm" c="dimmed">
        Bot: <Text span fw={600}>{groupLabel(groups.bot)}</Text>
      </Text>
    </Group>
  );
}
