// Read-only power meter reflecting the current aim strength. The interactive
// power control is in AimControls; this only visualizes the live drag/aim power.

import { Group, Progress, Text } from '@mantine/core';

export interface PowerMeterProps {
  // Normalized power in [0, 1].
  readonly power: number;
}

export function PowerMeter({ power }: PowerMeterProps) {
  const pct = Math.round(Math.max(0, Math.min(1, power)) * 100);
  return (
    <Group gap="xs" wrap="nowrap" aria-label={`Power ${pct} percent`}>
      <Text size="xs" c="dimmed" w={44}>
        Power
      </Text>
      <Progress value={pct} size="lg" radius="sm" style={{ flex: 1 }} />
      <Text size="xs" w={36} ta="right">
        {pct}%
      </Text>
    </Group>
  );
}
