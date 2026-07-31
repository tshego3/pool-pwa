// End-of-game overlay: announces the winner and offers rematch or back-to-menu.
// A Mantine Modal so it traps focus and is keyboard-dismissable; opened only
// when the rules snapshot reports a winner.

import { Button, Modal, Stack, Text } from '@mantine/core';
import { IconArrowBackUp, IconRefresh } from '@tabler/icons-react';
import type { Seat } from '../types/rules';
import { winnerLabel } from './hudLabels';

export interface EndOverlayProps {
  // The winning seat, or null while the game is still in play (overlay closed).
  readonly winner: Seat | null;
  readonly onRematch: () => void;
  readonly onBackToMenu: () => void;
}

export function EndOverlay({ winner, onRematch, onBackToMenu }: EndOverlayProps) {
  return (
    <Modal
      opened={winner !== null}
      onClose={onBackToMenu}
      centered
      withCloseButton={false}
      // Modal.Title is already an h2, so the heading is styled here rather than
      // nested in a Title component (which would put an h2 inside an h2).
      title="Game over"
      styles={{
        title: {
          fontSize: 'var(--mantine-h2-font-size)',
          fontWeight: 'var(--mantine-heading-font-weight)',
          lineHeight: 'var(--mantine-h2-line-height)',
        },
      }}
    >
      <Stack gap="lg">
        <Text size="lg" fw={600}>
          {winner !== null ? winnerLabel(winner) : ''}
        </Text>
        <Button leftSection={<IconRefresh size={20} />} size="md" onClick={onRematch} fullWidth>
          Rematch
        </Button>
        <Button
          leftSection={<IconArrowBackUp size={20} />}
          size="md"
          variant="default"
          onClick={onBackToMenu}
          fullWidth
        >
          Back to menu
        </Button>
      </Stack>
    </Modal>
  );
}
