// Foul banner: surfaces the reason the last shot was a foul. Renders nothing
// when the last shot was legal. Uses Mantine's error color token, never a
// hardcoded hex.

import { Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { FoulReason } from '../types/rules';
import { foulReasonLabel } from './hudLabels';

export interface FoulBannerProps {
  readonly reason: FoulReason | null;
}

export function FoulBanner({ reason }: FoulBannerProps) {
  if (reason === null) return null;
  return (
    <Alert
      variant="light"
      color="dark.4"
      icon={<IconAlertTriangle size={20} />}
      title="Foul"
      role="alert"
    >
      {foulReasonLabel(reason)}
    </Alert>
  );
}
