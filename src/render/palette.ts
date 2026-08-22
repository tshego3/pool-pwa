// Single source of truth for every canvas color: felt, rail wood, cushions,
// pockets, table markings, balls, and the guide line. HUD/app-chrome colors
// live in src/theme (a separate Mantine color system); never mix the two.
// A user-selectable table color maps to a key in TABLE_PALETTES, not a raw hex
// in a component.

export interface BallColors {
  // Ivory cue ball.
  readonly cue: string;
  // Near-black 8-ball body.
  readonly eight: string;
  // White base a stripe ball is painted before its colored band.
  readonly stripeBase: string;
  // The seven suit colors, indexed by (number - 1) % 7. Shared by the matching
  // solid (1-7) and stripe (9-15).
  readonly byGroup: readonly string[];
  // White disc that carries the printed number.
  readonly numberBg: string;
  readonly numberText: string;
  // Thin contact outline around every ball.
  readonly outline: string;
}

// Colors that differ between table finishes; the rest of a palette is shared.
export interface FeltColors {
  readonly feltBase: string;
  readonly railWood: string;
  readonly cushion: string;
  readonly pocket: string;
  readonly pocketRim: string;
  // Head string, spots, and other surface markings.
  readonly marking: string;
}

export interface TablePalette extends FeltColors {
  readonly ball: BallColors;
  // Aiming guide line drawn over the felt.
  readonly guide: string;
  // Ghost-ball / impact marker on the guide.
  readonly guideImpact: string;
  // Predicted object-ball path after contact: the line that answers "where does
  // the ball go", so it is the strongest of the three.
  readonly guideObject: string;
  // Predicted cue-ball deflection after contact.
  readonly guideCue: string;
  // Approach line when the cue would first strike a ball the shooter may not
  // hit. Faint on purpose: the aim visibly stops working, which is how the
  // player learns which balls are theirs.
  readonly guideBlocked: string;
}

// Ball suit colors are constant across every felt finish; only the felt/wood
// differs, so a stripe/solid keeps its identity on any table.
const BALL: BallColors = {
  cue: '#F7F3E7',
  eight: '#17110F',
  stripeBase: '#F4EFE0',
  byGroup: [
    '#F2C230', // 1 / 9  yellow
    '#1F5FB0', // 2 / 10 blue
    '#C42B2B', // 3 / 11 red
    '#6E2C91', // 4 / 12 purple
    '#E67821', // 5 / 13 orange
    '#23994F', // 6 / 14 green
    '#7C2233', // 7 / 15 maroon
  ],
  numberBg: '#FBF7EC',
  numberText: '#161311',
  outline: 'rgba(0, 0, 0, 0.35)',
};

// White reads with strong contrast on every felt below (WCAG AA against the
// darkest supported felt), so guide colors are shared too.
const makePalette = (felt: FeltColors): TablePalette => ({
  ...felt,
  ball: BALL,
  guide: 'rgba(245, 245, 245, 0.85)',
  guideImpact: 'rgba(245, 245, 245, 0.5)',
  guideObject: 'rgba(245, 245, 245, 0.95)',
  guideCue: 'rgba(245, 245, 245, 0.55)',
  guideBlocked: 'rgba(245, 245, 245, 0.28)',
});

export const TABLE_PALETTES = {
  'classic-green': makePalette({
    feltBase: '#17643B',
    railWood: '#3A2417',
    cushion: '#135231',
    pocket: '#0A0A0A',
    pocketRim: '#000000',
    marking: 'rgba(245, 245, 245, 0.18)',
  }),
  'tournament-blue': makePalette({
    feltBase: '#1C4E80',
    railWood: '#23303A',
    cushion: '#163C63',
    pocket: '#0A0A0A',
    pocketRim: '#000000',
    marking: 'rgba(245, 245, 245, 0.18)',
  }),
  'burgundy': makePalette({
    feltBase: '#6E2233',
    railWood: '#2E1A12',
    cushion: '#54182A',
    pocket: '#0A0A0A',
    pocketRim: '#000000',
    marking: 'rgba(245, 245, 245, 0.2)',
  }),
} as const;

export type TablePaletteKey = keyof typeof TABLE_PALETTES;

export const DEFAULT_TABLE_PALETTE_KEY: TablePaletteKey = 'classic-green';
export const DEFAULT_TABLE_PALETTE: TablePalette =
  TABLE_PALETTES[DEFAULT_TABLE_PALETTE_KEY];

const isTablePaletteKey = (key: string): key is TablePaletteKey =>
  Object.prototype.hasOwnProperty.call(TABLE_PALETTES, key);

// Resolve a saved tableColor setting to a palette. The setting is stored as a
// plain string (the types layer takes no render dependency), so an unknown or
// stale key falls back to the default finish rather than breaking the table.
export const tablePalette = (key: string): TablePalette =>
  isTablePaletteKey(key) ? TABLE_PALETTES[key] : DEFAULT_TABLE_PALETTE;
