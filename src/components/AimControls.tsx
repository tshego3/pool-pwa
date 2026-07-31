// Keyboard- and touch-operable fallback for the drag-to-aim gesture: fine angle
// nudges plus a power slider, so a shot can be set up and taken without precise
// pointer control. Presentational only (props-driven) - the game screen owns the
// AimResult and wires these callbacks to the facade. All visuals come from
// Mantine theme tokens; no hardcoded colors.
 
import { ActionIcon, Box, Stack, Text, Paper } from '@mantine/core';
import { IconMinus, IconPlus, IconTargetArrow } from '@tabler/icons-react';
import { useState, useRef, useEffect } from 'react';
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
  // Stacked vertically so it fits the narrow side panel on phones.
  return (
    <Paper p={4} radius="md" style={{ ...glassStyle, width: 'fit-content', margin: '0 auto' }}>
      <Stack gap={4} align="center">
        <Text size="xs" c="dimmed">Angle</Text>
        <ActionIcon
          aria-label="Nudge aim clockwise"
          variant="default"
          size={TARGET_PX}
          disabled={disabled}
          onClick={() => onAngleChange(aim.angle + step)}
        >
          <IconPlus size={20} />
        </ActionIcon>
        <Text size="xs" ta="center" fw={500}>
          {normalizeDeg(aim.angle)}&deg;
        </Text>
        <ActionIcon
          aria-label="Nudge aim counter-clockwise"
          variant="default"
          size={TARGET_PX}
          disabled={disabled}
          onClick={() => onAngleChange(aim.angle - step)}
        >
          <IconMinus size={20} />
        </ActionIcon>
      </Stack>
    </Paper>
  );
}

export function PowerControl({ 
  aim, 
  onPowerChange, 
  disabled = false 
}: Partial<AimControlsProps> & { aim: AimResult; onPowerChange: (p: number) => void }) {
  const powerPct = Math.round(aim.power * 100);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const val = 1 - (y / rect.height);
      onPowerChange(Math.max(0, Math.min(1, val)));
    };

    const handlePointerUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, onPowerChange]);

  return (
    <Paper p={4} radius="md" style={{ ...glassStyle, width: 'fit-content', margin: '0 auto' }}>
      <Stack gap={4} align="center">
        <Text size="xs" c="dimmed">Power</Text>
        <Box 
          ref={containerRef}
          onPointerDown={(e) => {
            if (disabled) return;
            setIsDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          style={{
            height: 160,
            width: 25,
            backgroundColor: 'var(--mantine-color-dark-6)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            position: 'relative',
            cursor: disabled ? 'not-allowed' : 'ns-resize',
            overflow: 'hidden',
            // The drag must never pan the page or trigger long-press gestures.
            touchAction: 'none',
          }}
        >
          <Box 
            style={{ 
              height: `${powerPct}%`, 
              width: '100%', 
              background: 'var(--mantine-color-blue-filled)',
              transition: isDragging ? 'none' : 'height 0.1s ease-out',
            }} 
          />
        </Box>
        <Text size="xs" fw={500}>
          {powerPct}%
        </Text>
      </Stack>
    </Paper>
  );
}
 
export function ShootButton({ 
  aim, 
  onShoot, 
  disabled = false 
}: Partial<AimControlsProps> & { aim: AimResult; onShoot: () => void }) {
  return (
    <ActionIcon
      aria-label="Shoot"
      onClick={onShoot}
      disabled={disabled || aim.power <= 0}
      size={TARGET_PX}
      radius="md"
      style={{ 
        ...glassStyle, 
        background: disabled || aim.power <= 0 ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-blue-filled)',
        border: 'none'
      }}
    >
      <IconTargetArrow size={20} />
    </ActionIcon>
  );
}

