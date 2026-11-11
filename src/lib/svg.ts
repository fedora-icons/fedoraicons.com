import type { StyleId } from './catalog';

export const DUO_STYLES: readonly StyleId[] = ['duocolor', 'duotone'];
export const isDuo = (style: StyleId) => DUO_STYLES.includes(style);

export interface SvgColorOptions {
  /** Foreground for Regular/Solid; primary for the duo styles. */
  primary: string;
  /** Duocolor accents. Ignored by styles that have no secondary role. */
  secondary?: string;
  /** Solid glyph color for named presets that expose `--fedora-modifier`. */
  modifier?: string;
}

export interface SvgBuildOptions extends SvgColorOptions {
  /** Output width and height in px. The artwork is scaled, never redrawn. */
  size: number;
  /** Prefix for every internal ID, so several copies can share one document. */
  idPrefix?: string;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const PAINT_ATTRS = ['fill', 'stroke', 'color', 'stop-color', 'flood-color', 'lighting-color'];
const VAR_RE = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+?)\s*)?\)$/;
const COLOR_RE = /^(#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8})$/i;

export const isHexColor = (value: string) => COLOR_RE.test(value.trim());

/** Does this artwork expose an independent modifier color role? */
export const hasModifierRole = (svg: string) => svg.includes('--fedora-modifier');
/** Does this artwork use a secondary color role? */
export const hasSecondaryRole = (svg: string) => svg.includes('--fedora-secondary');

function resolveVar(value: string, options: SvgColorOptions): string {
  const match = VAR_RE.exec(value.trim());
  if (!match) return value;
  const [, name, fallback] = match;
  switch (name) {
    case '--fedora-primary':
      return options.primary;
    case '--fedora-secondary':
      return options.secondary ?? fallback ?? options.primary;
    case '--fedora-modifier':
      return options.modifier ?? fallback ?? options.primary;
    default:
      // e.g. --fedora-glyph-color: use the library's own fallback.
      return fallback ? resolveVar(fallback, options) : options.primary;
  }
}

function parse(svg: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.nodeName !== 'svg' || doc.getElementsByTagName('parsererror').length) {
    throw new Error('Invalid SVG source');
  }
  return root as unknown as SVGSVGElement;
}

function namespaceIds(root: Element, prefix: string) {
  const ids = new Map<string, string>();
  root.querySelectorAll('[id]').forEach((node, index) => {
    const next = `${prefix}-${index}`;
    ids.set(node.getAttribute('id')!, next);
    node.setAttribute('id', next);
  });
  if (!ids.size) return;
  const swap = (value: string) =>
    value.replace(/url\(#([^)]+)\)/g, (whole, id: string) => (ids.has(id) ? `url(#${ids.get(id)})` : whole));
  const all = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const node of all) {
    for (const attr of Array.from(node.attributes)) {
      if (attr.value.includes('url(#')) node.setAttribute(attr.name, swap(attr.value));
      if ((attr.name === 'href' || attr.name === 'xlink:href') && attr.value.startsWith('#')) {
        const id = attr.value.slice(1);
        if (ids.has(id)) node.setAttribute(attr.name, `#${ids.get(id)}`);
      }
    }
  }
}

/**
 * Produce a standalone SVG: CSS custom properties and every `currentColor`
 * are resolved to concrete colors, so the file renders identically in any
 * viewer or design tool. Geometry, masks, clip paths, opacity groups (the
 * Duotone 16% tint), and definition references are preserved untouched.
 */
export function buildSvg(source: string, options: SvgBuildOptions): string {
  const root = parse(source);
  const all = [root, ...Array.from(root.querySelectorAll('*'))];

  for (const node of all) {
    for (const attr of PAINT_ATTRS) {
      const value = node.getAttribute(attr);
      if (value?.includes('var(')) node.setAttribute(attr, resolveVar(value, options));
    }
  }
  // The root color is the user's choice; nested `color` attributes are roles.
  root.setAttribute('color', options.primary);

  const walk = (node: Element, inherited: string) => {
    const own = node.getAttribute('color');
    const color = own && own !== 'currentColor' && own !== 'inherit' ? own : inherited;
    if (own) node.setAttribute('color', color);
    for (const attr of PAINT_ATTRS) {
      if (attr !== 'color' && node.getAttribute(attr) === 'currentColor') node.setAttribute(attr, color);
    }
    for (const child of Array.from(node.children)) walk(child, color);
  };
  walk(root, options.primary);

  const size = String(Math.round(options.size * 100) / 100);
  root.setAttribute('width', size);
  root.setAttribute('height', size);
  if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', SVG_NS);
  if (options.idPrefix) namespaceIds(root, options.idPrefix);
  return new XMLSerializer().serializeToString(root);
}

/** Inline-only variant: keeps the CSS roles live, only namespacing IDs. */
export function scopeSvg(source: string, idPrefix: string): string {
  const root = parse(source);
  namespaceIds(root, idPrefix);
  return new XMLSerializer().serializeToString(root);
}
