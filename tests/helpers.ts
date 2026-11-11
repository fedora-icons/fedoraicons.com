import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StyleId } from '../src/lib/catalog';

const cache: Partial<Record<StyleId, Record<string, string>>> = {};
export function styleSvgs(style: StyleId): Record<string, string> {
  return (cache[style] ??= JSON.parse(readFileSync(join(__dirname, '../public/icons', `${style}.json`), 'utf8')));
}

/** Every url(#id) reference resolves to an element in the same document. */
export function danglingRefs(svg: string): string[] {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const ids = new Set(Array.from(doc.querySelectorAll('[id]')).map((n) => n.id));
  const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
  return refs.filter((r) => !ids.has(r));
}
