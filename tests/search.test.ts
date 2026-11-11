import { describe, expect, it } from 'vitest';
import { catalog } from '../src/lib/catalog';
import { createIndex, search } from '../src/lib/search';

const index = createIndex(catalog.icons);
const names = (q: string, category?: string) => search(index, q, category).map((i) => i.name);

describe('search', () => {
  it('returns every icon for an empty query', () => {
    expect(names('')).toHaveLength(catalog.icons.length);
  });

  it('ranks an exact canonical name first', () => {
    expect(names('search')[0]).toBe('search');
    expect(names('user add')[0]).toBe('user-add');
  });

  it('matches aliases', () => {
    const withAlias = catalog.icons.find((i) => i.aliases.length && !i.aliases[0].includes(i.name))!;
    const term = withAlias.aliases[0].split('/').pop()!;
    expect(names(term)).toContain(withAlias.name);
  });

  it('matches tags and categories', () => {
    const tagged = catalog.icons.find((i) => i.tags.some((t) => t.length > 4 && !i.name.includes(t)))!;
    expect(names(tagged.tags.find((t) => t.length > 4 && !tagged.name.includes(t))!)).toContain(tagged.name);
    expect(names('weather').length).toBeGreaterThan(0);
  });

  it('requires every term and filters by category', () => {
    const files = names('', 'Files');
    expect(files.length).toBe(catalog.categories.find((c) => c.name === 'Files')!.count);
    expect(names('arrow', 'Files').every((n) => files.includes(n))).toBe(true);
    expect(names('zzzz-not-an-icon')).toEqual([]);
  });
});
