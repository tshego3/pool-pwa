// Stats screen. Renders the 4-branch async pattern (loading / error / data /
// empty) over per-difficulty play stats loaded from IndexedDB via useStats.
// Derived views (labels, ordering) stay in the render, values in the hook.

import {
  Button,
  Container,
  Group,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useStats } from '../hooks/useStats';

export interface StatsScreenProps {
  readonly onBack: () => void;
}

export function StatsScreen({ onBack }: StatsScreenProps) {
  const { stats, isLoading, errorMessage, reload } = useStats();

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={1}>Stats</Title>
          <Button variant="subtle" leftSection={<IconArrowLeft size={20} />} onClick={onBack}>
            Menu
          </Button>
        </Group>

        {isLoading ? (
          <Stack gap="sm">
            <Skeleton height={40} radius="sm" />
            <Skeleton height={40} radius="sm" />
            <Skeleton height={40} radius="sm" />
          </Stack>
        ) : errorMessage ? (
          <Stack gap="sm" align="flex-start">
            <Text c="dimmed">{errorMessage}</Text>
            <Button onClick={reload}>Retry</Button>
          </Stack>
        ) : stats.length > 0 ? (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Difficulty</Table.Th>
                <Table.Th>Played</Table.Th>
                <Table.Th>Won</Table.Th>
                <Table.Th>Potted</Table.Th>
                <Table.Th>Fouls</Table.Th>
                <Table.Th>Best streak</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {stats.map((row) => (
                <Table.Tr key={row.difficulty}>
                  <Table.Td tt="capitalize">{row.difficulty}</Table.Td>
                  <Table.Td>{row.played}</Table.Td>
                  <Table.Td>{row.won}</Table.Td>
                  <Table.Td>{row.potted}</Table.Td>
                  <Table.Td>{row.fouls}</Table.Td>
                  <Table.Td>{row.bestStreak}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed">No games played yet. Win a match to start your record.</Text>
        )}
      </Stack>
    </Container>
  );
}
