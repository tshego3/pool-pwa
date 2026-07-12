// Whose turn it is, with a spinner while the bot plans off-thread. Presentational
// only; the game screen feeds it the published turn/thinking snapshot.

import { Badge, Group, Loader, Text } from '@mantine/core';
import type { Seat } from '../types/rules';
import { turnLabel } from './hudLabels';

export interface TurnIndicatorProps {
  readonly turn: Seat;
  readonly thinking: boolean;
}

export function TurnIndicator({ turn, thinking }: TurnIndicatorProps) {
  return (
    <Group gap="xs" wrap="nowrap" aria-live="polite">
      {thinking ? <Loader size="xs" /> : null}
      <Badge variant={turn === 'player' ? 'filled' : 'outline'} size="lg">
        <Text span size="sm" fw={600}>
          {turnLabel(turn, thinking)}
        </Text>
      </Badge>
    </Group>
  );
}
