import { createTheme, type MantineColorsTuple } from '@mantine/core';

const dark: MantineColorsTuple = [
  '#F5F5F5', // 0 - primary text
  '#999999', // 1 - secondary text
  '#2D2D2D', // 2 - elevated/slate
  '#1C1C1C', // 3 - surface/graphite
  '#131313', // 4 - background/canvas
  '#0D0D0D', // 5
  '#080808', // 6
  '#131313', // 7 - dark variant
  '#1C1C1C', // 8
  '#2D2D2D', // 9
];

// The single hue in the HUD: it marks whose turn it is. A muted felt-green so
// it belongs to a pool table rather than fighting the monochrome chrome, and
// distinct from the amber used for fouls.
const active: MantineColorsTuple = [
  '#E8F8F0',
  '#C6EEDC',
  '#9DE2C3',
  '#71D5A7',
  '#4FCA92',
  '#35BE81',
  '#27A971',
  '#1B8B5C',
  '#106E47',
  '#045133',
];

// Mirrors native Theme.swift Dark (Monolithic Clarity) palette
export const tokens = {
  background: '#131313',
  surface: '#131313',
  surfaceContainerLow: '#1C1B1B',
  surfaceContainerHigh: '#2A2A2A',
  surfaceVariant: '#353534',
  elevated: '#2D2D2D',
  primary: '#FFFFFF',
  onPrimary: '#131313',
  onSurface: '#E5E2E1',
  onSurfaceVariant: '#C4C7C8',
  secondaryContainer: '#303030',
  outline: '#8E9192',
  outlineVariant: '#444748',
  error: '#FFAB0B',
  textPrimary: '#FFFFFF',
  textSecondary: '#C4C7C8',
  accent: '#FFFFFF',
  activeSeat: '#4FCA92',
  border: '#444748',
} as const;

export const theme = createTheme({
  primaryColor: 'dark',
  colors: { dark, active },
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  headings: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontWeight: '600',
  },
  radius: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  defaultRadius: 'sm',
  other: {
    tokens,
  },
});
