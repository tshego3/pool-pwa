// Keyboard- and touch-operable fallback for the drag-to-aim gesture: fine angle
// nudges plus a power slider, so a shot can be set up and taken without precise
// pointer control. Presentational only (props-driven) - the game screen owns the
// AimResult and wires these callbacks to the facade. All visuals come from
// Mantine theme tokens; no hardcoded colors.

import { ActionIcon, Button, Group, Paper, Slider, Stack, Text } from '@mantine/core';
import { IconMinus, IconPlus, IconTargetArrow } from '@tabler/icons-react';
import type { AimResult } from '../types/aiming';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;
// >=44px touch targets (design system). ActionIcon/Button sizes are px.
const TARGET_PX = 44;

export interface AimControlsProps {
  readonly aim: AimResult;
  readonly onAngleChange: (angle: number) => void;
  readonly onPowerChange: (power: number) => void;
  readonly onShoot: () => void;
  readonly disabled?: boolean;
  // Degrees per angle nudge.
  readonly fineStepDeg?: number;
}

const normalizeDeg = (rad: number): number => Math.round(((rad * RAD_TO_DEG) % 360 + 360) % 360);

export function AimControls({
  aim,
  onAngleChange,
  onPowerChange,
  onShoot,
  disabled = false,
  fineStepDeg = 1,
}: AimControlsProps) {
  const step = fineStepDeg * DEG_TO_RAD;
  const powerPct = Math.round(aim.power * 100);

  return (
    <Paper component="section" aria-label="Aim controls" p="md" radius="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" c="dimmed">
            Angle
          </Text>
          <Group gap="xs" wrap="nowrap">
            <ActionIcon
              aria-label="Nudge aim counter-clockwise"
              variant="default"
              size={TARGET_PX}
              disabled={disabled}
              onClick={() => onAngleChange(aim.angle - step)}
            >
              <IconMinus size={20} />
            </ActionIcon>
            <Text size="sm" w={52} ta="center" aria-live="polite">
              {normalizeDeg(aim.angle)}&deg;
            </Text>
            <ActionIcon
              aria-label="Nudge aim clockwise"
              variant="default"
              size={TARGET_PX}
              disabled={disabled}
              onClick={() => onAngleChange(aim.angle + step)}
            >
              <IconPlus size={20} />
            </ActionIcon>
          </Group>
        </Group>

        <div>
          <Text size="sm" c="dimmed" id="aim-power-label">
            Power
          </Text>
          <Slider
            aria-labelledby="aim-power-label"
            value={powerPct}
            onChange={(v) => onPowerChange(v / 100)}
            min={0}
            max={100}
            disabled={disabled}
            label={(v) => `${v}%`}
          />
        </div>

        <Button
          leftSection={<IconTargetArrow size={20} />}
          onClick={onShoot}
          disabled={disabled || aim.power <= 0}
          size="md"
          fullWidth
        >
          Shoot
        </Button>
      </Stack>
    </Paper>
  );
}
