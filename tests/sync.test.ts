import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without types
import { buildOutputs, UI_ICONS } from '../scripts/sync-icons.mjs';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const STYLES = ['regular', 'filled', 'duocolor', 'duotone'];

function fakeLibrary(tamper = false) {
  const dir = mkdtempSync(join(tmpdir(), 'fedora-lib-'));
  const names = [...UI_ICONS, 'widget'];
  const icons = names.map((name: string) => {
    const files: Record<string, string> = {};
    const digests: Record<string, string> = {};
    for (const style of STYLES) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0" stroke="currentColor"/><title>${name}</title></svg>`;
      mkdirSync(join(dir, 'icons', style), { recursive: true });
      writeFileSync(join(dir, 'icons', style, `${name}.svg`), svg);
      files[style] = `icons/${style}/${name}.svg`;
      digests[style] = sha(svg);
    }
    return { name, category: 'Essentials', tags: [], aliases: [], files, sha256: digests };
  });
  if (tamper) writeFileSync(join(dir, 'icons/regular/widget.svg'), '<svg/>');
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ license: 'MIT', grid: 24, regularStrokeWidth: 1.25, styles: STYLES, iconCount: icons.length, icons }));
  mkdirSync(join(dir, 'metadata'));
  writeFileSync(join(dir, 'metadata/modifiers.json'), JSON.stringify({ modifiers: [] }));
  writeFileSync(join(dir, 'metadata/colors.json'), JSON.stringify({ defaultPalette: 'Blue', palettes: [] }));
  writeFileSync(join(dir, 'LICENSE'), 'MIT');
  return dir;
}

describe('asset synchronization', () => {
  it('produces deterministic output with counts taken from the manifest', () => {
    const dir = fakeLibrary();
    const a = buildOutputs(dir);
    const b = buildOutputs(dir);
    expect(a).toEqual(b);
    const catalog = JSON.parse(a['src/data/catalog.json']);
    expect(catalog.icons).toHaveLength(UI_ICONS.length + 1);
    expect(catalog.categories).toEqual([{ name: 'Essentials', count: UI_ICONS.length + 1 }]);
    expect(Object.keys(JSON.parse(a['public/icons/duotone.json']))).toContain('widget');
  });

  it('rejects an asset whose digest does not match the manifest', () => {
    expect(() => buildOutputs(fakeLibrary(true))).toThrow(/SHA-256 mismatch/);
  });

  it('matches the committed snapshot lock', () => {
    const lock = JSON.parse(readFileSync(join(__dirname, '../src/data/source-lock.json'), 'utf8'));
    for (const style of STYLES) {
      const body = readFileSync(join(__dirname, '../public/icons', `${style}.json`), 'utf8');
      expect(sha(body)).toBe(lock.snapshotSha256[style]);
    }
  });
});
