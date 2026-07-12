// Keyboard- and touch-operable fallback for the drag-to-aim gesture: fine angle
// nudges plus a power slider, so a shot can be set up and taken without precise
// pointer control. Presentational only (props-driven) - the game screen owns the
// AimResult and wires these callbacks to the facade. All visuals come from
// Mantine theme tokens; no hardcoded colors.
 
import { ActionIcon, Button, Group, Slider, Stack, Text, Paper } from '@mantine/core';
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
 
const glassStyle = {
  background: 'rgba(28, 28, 28, 0.8)',
  backdropFilter: 'blur(20px)',
  border: '1px solid var(--mantine-color-dark-2)',
};
 
export function AngleControl({ 
  aim, 
  onAngleChange, 
  disabled = false, 
  fineStepDeg = 1 
}: Partial<AimControlsProps> & { aim: AimResult; onAngleChange: (a: number) => void }) {
  const step = fineStepDeg * DEG_TO_RAD;
  return (
    <Paper p="xs" radius="md" style={glassStyle}>
      <Group gap="xs" wrap="nowrap">
        <Text size="sm" c="dimmed">Angle</Text>
        <ActionIcon
          aria-label="Nudge aim counter-clockwise"
          variant="default"
          size={TARGET_PX}
          disabled={disabled}
          onClick={() => onAngleChange(aim.angle - step)}
        >
          <IconMinus size={20} />
        </ActionIcon>
        <Text size="sm" w={52} ta="center" fw={500}>
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
    </Paper>
  );
}
 
export function PowerControl({ 
  aim, 
  onPowerChange, 
  disabled = false 
}: Partial<AimControlsProps> & { aim: AimResult; onPowerChange: (p: number) => void }) {
  const powerPct = Math.round(aim.power * 100);
  return (
    <Paper p="xs" radius="md" style={glassStyle}>
      <Group gap="sm" wrap="nowrap">
        <Text size="sm" c="dimmed">Power</Text>
        <Slider
          value={powerPct}
          onChange={(v) => onPowerChange(v / 100)}
          min={0}
          max={100}
          disabled={disabled}
          label={(v) => `${v}%`}
          style={{ width: 120 }}
        />
        <Text size="sm" w={40} ta="right" fw={500}>
          {powerPct}%
        </Text>
      </Group>
    </Paper>
  );
}
 
export function ShootButton({ 
  aim, 
  onShoot, 
  disabled = false 
}: Partial<AimControlsProps> & { aim: AimResult; onShoot: () => void }) {
  return (
    <Button
      leftSection={<IconTargetArrow size={20} />}
      onClick={onShoot}
      disabled={disabled || aim.power <= 0}
      h={TARGET_PX}
      radius="md"
      style={{ 
        ...glassStyle, 
        background: disabled || aim.power <= 0 ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-blue-filled)',
        border: 'none'
      }}
    >
      Shoot
    </Button>
  );
}
 
export function AimControls({
  aim,
  onAngleChange,
  onPowerChange,
  onShoot,
  disabled = false,
  fineStepDeg = 1,
}: AimControlsProps) {
  return (
    <Stack gap="xs">
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <AngleControl aim={aim} onAngleChange={onAngleChange} disabled={disabled} fineStepDeg={fineStepDeg} />
        <ShootButton aim={aim} onShoot={onShoot} disabled={disabled} />
      </Group>
      <PowerControl aim={aim} onPowerChange={onPowerChange} disabled={disabled} />
    </Stack>
  );
}

