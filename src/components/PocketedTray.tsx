// Tray of balls pocketed so far, as numbered chips. Solid vs stripe is conveyed
// by fill vs outline (not the canvas suit colors, which are a separate color
// system that must never leak into Mantine chrome); the printed number carries
// the identity, so the tray reads without relying on color alone.

import { Box, Group, Text } from '@mantine/core';
import { ballKind } from './hudLabels';

export interface PocketedTrayProps {
  // Pocketed object-ball ids in drop order (never the cue).
  readonly pocketed: readonly number[];
}

const CHIP = 28;

function BallChip({ id }: { readonly id: number }) {
  const kind = ballKind(id);
  const filled = kind === 'solid' || kind === 'eight';
  return (
    <Box
      style={{
        width: CHIP,
        height: CHIP,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--mantine-color-dark-4)',
        background: filled ? 'var(--mantine-color-dark-2)' : 'transparent',
      }}
    >
      <Text size="xs" fw={700}>
        {id}
      </Text>
    </Box>
  );
}

export function PocketedTray({ pocketed }: PocketedTrayProps) {
  return (
    <Group gap={6} wrap="nowrap" style={{ overflowX: 'auto', paddingBottom: 4 }} aria-label="Pocketed balls">
      {pocketed.length === 0 ? (
        <Text size="xs" c="dimmed">
          No balls pocketed
        </Text>
      ) : (
        pocketed.map((id, i) => <BallChip key={`${id}-${i}`} id={id} />)
      )}
    </Group>
  );
}
