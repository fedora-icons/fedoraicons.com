import { palettes, type StyleId } from './catalog';
import { BASE_STROKE, hasModifierRole, hasSecondaryRole, isDuo, type SvgColorOptions } from './svg';

/**
 * How icons are drawn across the grid, the side pane previews, and exports.
 * `null` colors follow the site theme until the user picks one.
 */
export interface Look {
  size: number;
  /** Stroke in 24px grid units, or `null` to follow the size (see `autoStroke`). */
  strokeWidth: number | null;
  mono: string | null;
  paletteName: string;
  custom: { primary: string; secondary: string } | null;
}

export const DEFAULT_LOOK: Look = {
  size: 48,
  strokeWidth: null,
  mono: null,
  paletteName: palettes.defaultPalette,
  custom: null,
};

/**
 * Size slider range: what the grid can preview. The px field still accepts
 * MIN_SIZE..MAX_SIZE for exports.
 */
export const SIZE_SLIDER_MIN = 16;
export const SIZE_STEP = 4;
export const MIN_SIZE = 8;
export const MAX_SIZE = 512;
export const STROKE_MIN = 0.5;
export const STROKE_MAX = 2.5;
export const STROKE_STEP = 0.05;
/** The grid shows icons at the chosen size up to this, so cells stay legible. */
export const GRID_MAX_SIZE = 64;
export const SIZE_SLIDER_MAX = GRID_MAX_SIZE;

/**
 * Size-linked stroke, in 24px grid units: 1.25 at 24px (the library's
 * standard) easing to 0.85 at 64px, so larger icons don't read heavy.
 * Linear between the two anchors, held at 0.85 above 64px.
 */
const STROKE_ANCHORS = [{ size: 24, stroke: BASE_STROKE }, { size: 64, stroke: 0.85 }] as const;
export function autoStroke(size: number): number {
  const [a, b] = STROKE_ANCHORS;
  const t = (Math.min(size, b.size) - a.size) / (b.size - a.size);
  const value = a.stroke + t * (b.stroke - a.stroke);
  return Math.min(STROKE_MAX, Math.max(STROKE_MIN, Math.round(value * 100) / 100));
}

/** The stroke actually drawn and exported for this look. */
export const strokeOf = (look: Look) => look.strokeWidth ?? autoStroke(look.size);

export const INK = { light: '#212121', dark: '#F2F2F2' } as const;

/** Solid silhouettes and brand marks are drawn as authored: no stroke control. */
export const strokeAdjustable = (style: StyleId, kind: 'core' | 'brand' = 'core') =>
  kind === 'core' && style !== 'filled';

export function resolveLook(look: Look, theme: 'light' | 'dark') {
  // Duo palettes use the variant for the site theme being previewed.
  const mode = theme;
  const palette = palettes.palettes.find((p) => p.name === look.paletteName) ?? palettes.palettes[0];
  return {
    mono: look.mono ?? INK[theme],
    mode,
    palette,
    duo: look.custom ?? palette[mode],
  };
}

export const isCustomized = (look: Look) =>
  look.size !== DEFAULT_LOOK.size
  || look.strokeWidth !== DEFAULT_LOOK.strokeWidth
  || look.mono !== null
  || look.custom !== null
  || look.paletteName !== DEFAULT_LOOK.paletteName;

/** CSS variables that restyle inline grid SVGs without rebuilding them. */
export function gridVars(look: Look, style: StyleId, theme: 'light' | 'dark', kind: 'core' | 'brand' = 'core') {
  const r = resolveLook(look, theme);
  const vars: Record<string, string> = {
    '--glyph-size': `${Math.min(look.size, GRID_MAX_SIZE)}px`,
    // How far a glyph lifts on hover/selection so its name fits underneath.
    '--glyph-lift': `${Math.max(6, Math.round(Math.min(look.size, GRID_MAX_SIZE) / 2 - 18))}px`,
    // Tall enough for the glyph plus a two-line name (only matters on desktop).
    '--cell-min-h': `${Math.max(0, Math.min(look.size, GRID_MAX_SIZE) + 48)}px`,
    '--stroke-scale': String(strokeAdjustable(style, kind) ? Math.round((strokeOf(look) / BASE_STROKE) * 10000) / 10000 : 1),
  };
  if (isDuo(style)) {
    vars['--fedora-primary'] = r.duo.primary;
    vars['--fedora-secondary'] = r.duo.secondary;
  } else if (look.mono) {
    vars.color = look.mono;
  }
  return vars;
}

/**
 * Concrete export colors for one icon under this look. Secondary is only
 * applied where the artwork has that role; modifier glyphs keep the
 * library default unless an override is given.
 */
export function exportColors(
  source: string,
  style: StyleId,
  look: Look,
  theme: 'light' | 'dark',
  modifierOverride?: string | null,
): SvgColorOptions {
  const r = resolveLook(look, theme);
  const duo = isDuo(style);
  const modifierDefault = source.match(/var\(--fedora-modifier,\s*(#[0-9a-fA-F]{3,8})\)/)?.[1]?.toUpperCase();
  return {
    primary: duo ? r.duo.primary : r.mono,
    secondary: duo && hasSecondaryRole(source) ? r.duo.secondary : undefined,
    modifier: hasModifierRole(source) ? (modifierOverride ?? modifierDefault ?? undefined) : undefined,
  };
}
