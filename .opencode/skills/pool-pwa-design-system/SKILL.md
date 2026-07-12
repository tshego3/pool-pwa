---
name: pool-pwa-design-system
description: Monolithic Clarity dark theme, canvas/HUD split, and UI rules for pool-pwa. Use when creating or editing ANY component, screen, HUD element, style, layout, color, font, icon, animation, canvas rendering, felt/ball palette, or accessibility concern - covers Mantine theming, the color palette, the src/render/palette.ts canvas colors, typography, spacing, interaction, and asset rules.
---

# Design System and UI Rules (Monolithic Clarity, extended for canvas)

`src/theme/` is the single source of Mantine visual truth, consumed by `MantineProvider` at app init. `src/render/palette.ts` is the single source of canvas (felt/ball) colors. The two are separate surfaces - keep them cleanly split.

## Canvas vs HUD Split (the core extension)

1. **The canvas is the only non-Mantine surface.** All game rendering (table, felt, cushions, pockets, balls, numbers, stripes, guide line) is Canvas 2D drawn in `src/render/`. Everything else is Mantine.
2. **The HUD is Mantine chrome:** turn indicator (player/bot), "bot thinking" state, group indicator, foul banner, power meter, pocketed-ball tray, pause, difficulty picker - all Mantine components layered over/around the canvas, following the theme tokens below.
3. **Felt and ball colors live ONLY in `src/render/palette.ts`.** Never hardcode canvas colors in the renderer or transform; never pull Mantine CSS variables into canvas drawing code (they are a different color system). Conversely, never use `src/render/palette.ts` values in Mantine components. If the table color is user-configurable (a setting), the renderer reads the chosen palette entry - the setting maps to a `palette.ts` key, not a raw hex in a component.

## Theming Rules (Mantine chrome)

1. **No hardcoded colors, font families, or spacing values in components** - use Mantine theme tokens, component props (`color`, `variant`, `size`), or CSS variables (`var(--mantine-color-*)`) exclusively.
2. If a component needs a design token in TypeScript, import from `src/theme/` - never inline the value.
3. Never override `MantineProvider` in child components.
4. **Consult the Mantine component API first** (https://mantine.dev/core/) before building custom UI - use `Paper`, `Card`, `AppShell`, `ActionIcon`, `Modal`, `Badge`, `Progress`, etc.
5. Use Mantine hooks (`useMediaQuery`, `useDisclosure`) for responsive behavior and UI state.

## Color Palette (HUD / app chrome)

| Token | Value | Usage |
|-------|-------|-------|
| Background/Canvas (Charcoal) | `#131313` | Main app background (letterbox around the table) |
| Surface (Graphite) | `#1C1C1C` | HUD containers, trays, panels |
| Elevated (Slate Gray) | `#2D2D2D` | Hover/active states, inputs |
| Primary Text (Off-White) | `#F5F5F5` | Main text |
| Secondary Text (Muted) | `#999999` | Metadata, labels |
| Accent (White) | `#FFFFFF` | Active indicators, primary buttons |

- Depth through **tonal layering only** - no shadows. Background lightness tiers convey elevation.
- Glassmorphism for overlays: 80% opacity + 20px backdrop blur + 1px Slate Gray border.
- Soft 1px dividers using Slate Gray - no heavy borders.
- The felt/ball palette (green felt, rail wood, ball colors/stripes) is a separate table defined in `src/render/palette.ts`, not here.

## Typography

1. **Inter** is the sole font family (self-hosted in `public/fonts/` and precached - no Google Fonts runtime fetch). No secondary fonts. Any numbers drawn on balls use the same self-hosted font via the canvas.
2. Headlines: tight letter-spacing (`-0.02em`), semi-bold. Body: 1.6 line-height. Labels: increased tracking.
3. Use Mantine `Title` and `Text` for HUD; scale comes exclusively from the theme.

## Shape and Spacing

1. Rounded corners: 8px standard, 16px cards, 24px outer wrappers.
2. 4px baseline grid. Container padding: 24px desktop, 16px mobile.

## Styling Rules

1. **No `.module.css` files.** Centralize style objects if needed and import them.
2. Mobile-first responsive design: base styles target phone viewport; min-width media queries scale up. Test at 360px, 768px, 1280px+.
3. No `!important` unless overriding third-party styles with no alternative.
4. Animations must respect `prefers-reduced-motion`.

## Screen Specifications

1. **Routes** (hash router `#/`): `#/` menu, `#/game`, `#/stats`, `#/settings`.
2. **Menu**: play, difficulty picker (easy/medium/hard), resume-game affordance when a saved snapshot exists, links to stats/settings.
3. **Game**: canvas fills the play area (responsive letterboxing, optional portrait rotation); Mantine HUD overlays - turn indicator, "bot thinking" state, group (solids/stripes) indicator, foul banner, power meter, pocketed-ball tray, pause. All interactive controls are >=44px targets.
4. **Stats**: games/wins vs bot per difficulty, potted/fouls/streaks - 4-branch loading pattern.
5. **Settings**: sound toggle, guide-line length, table color, handedness, default difficulty.

## Interaction Patterns

1. Aim-from-anywhere drag-to-aim with pull-back power; a cancel gesture; ball-in-hand placement with legality feedback. Provide HUD fine-tune (angle nudge) and power fallback controls for accessibility and small-screen precision.
2. `touch-action: none` on the canvas to prevent scroll/gesture conflicts.
3. Cards/buttons: subtle scale transform on press. Smooth screen transitions.
4. Desktop hover: Slate Gray background transition; active nav: 2px left white accent border.
5. The bot's turn animates its cue/aim before executing; show the "bot thinking" HUD state while planning (planning runs in a Web Worker, off the render loop).

## Accessibility

1. Semantic HTML (`<nav>`, `<main>`, `<section>`, `<button>`) - no `<div>` for interactive elements. The canvas has an accessible label describing game state.
2. All inputs have `<label>`s. Keyboard navigation works everywhere; do not disable Mantine's `focusRing`. Provide keyboard/HUD equivalents for aiming and power so play does not require precise pointer control.
3. ARIA only when semantic HTML is insufficient. Single `<h1>`, logical heading order, skip-to-content link.
4. Touch targets minimum 44px. Text contrast minimum 4.5:1 (WCAG AA). Felt/ball palette in `src/render/palette.ts` must also meet contrast for ball numbers and the guide line against the felt.

## Asset Rules

1. **All visual assets are real and self-hosted** - no AI-generated images. Fonts, icons, and sounds live in `public/` and are precached; nothing is fetched at runtime.
2. Missing asset: themed placeholder with a `<!-- TODO: replace with real asset -->` comment.
3. `@tabler/icons-react` for all HUD icons. PWA icons in `public/` (any + maskable). Ball/table visuals are drawn on canvas, not image assets.

## Performance

1. **Two-layer canvas rendering:** pre-render the static table (felt, cushions, pockets) to an offscreen canvas once; redraw only the dynamic ball/guide layer per frame. No per-frame gradients or allocations in the draw loop.
2. Cap DPR at 2 if needed to avoid mobile blurriness/cost; use `ResizeObserver` for responsive sizing via `src/render/transform.ts`.
3. Dynamic `import()` for heavy screens/modules (Vite code splitting); import only needed Mantine components.
4. Frame-time logging during a full break to catch regressions. Audit bundle with `npx vite-bundle-visualizer` before major deploys.
