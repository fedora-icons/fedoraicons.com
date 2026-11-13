import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import catalog from '../src/data/catalog.json';
import { composeSvg, initialCorner, type Corner, type ModifierAsset } from '../src/lib/modifiers';

const pub = (file: string) => JSON.parse(readFileSync(join(__dirname, '../public', file), 'utf8'));
const modifiers: ModifierAsset[] = pub('modifiers.json').modifiers;
const byName = new Map(modifiers.map((m) => [m.name, m]));
const STYLES = ['regular', 'filled', 'duocolor', 'duotone'] as const;
const sources = Object.fromEntries(STYLES.map((s) => [s, pub(`icons/${s}.json`) as Record<string, string>]));

/** Structure and paint, with IDs and number formatting normalized. */
function canonical(svg: string): string[] {
  const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const num = (v: string) => v.replace(/-?\d*\.?\d+(e-?\d+)?/g, (n) => String(Math.round(Number(n) * 1000) / 1000));
  return [root, ...Array.from(root.querySelectorAll('*'))].map((node) => {
    const attrs = Array.from(node.attributes)
      .filter((a) => a.name !== 'id' && a.name !== 'xmlns')
      .map((a) => `${a.name}=${num(a.value.replace(/url\(#[^)]+\)/g, 'url(#)'))}`)
      .sort();
    return `${node.localName}[${attrs.join(' ')}]`;
  });
}

// Authored single-modifier compositions the library composed without refitting the base.
const authored = (catalog.icons as { name: string; composition?: { base: string; modifiers: { name: string; position: string }[] } }[])
  .filter((i) => i.composition?.modifiers.length === 1);

describe('modifier composition', () => {
  it('ships every library modifier with at least one corner', () => {
    expect(modifiers.length).toBe(Object.keys(catalog.modifiers).length);
    for (const m of modifiers) expect(m.positions[initialCorner(m)]).toBeTruthy();
  });

  it('reproduces the library’s authored compositions in every style', () => {
    let matched = 0;
    for (const icon of authored) {
      const { base, modifiers: [mod] } = icon.composition!;
      for (const style of STYLES) {
        const expected = canonical(sources[style][icon.name]);
        // Compare only output of the library's compose tool, without a refitted base.
        if (!expected[2]?.startsWith('clipPath[') || /^svg\[[^\]]*\bx=/.test(expected[5] ?? '')) continue;
        const composed = composeSvg(sources[style][base], byName.get(mod.name)!, mod.position as Corner, style);
        expect(canonical(composed), `${icon.name} ${style}`).toEqual(expected);
        matched += 1;
      }
    }
    expect(matched).toBeGreaterThan(200);
  });

  it('refuses a corner the modifier does not support', () => {
    const pdf = byName.get('pdf')!;
    expect(() => composeSvg(sources.regular.file, pdf, 'top-right', 'regular')).toThrow(/top right/);
  });
});
