import { describe, expect, it } from 'vitest';
import { catalog, iconsByName } from '../src/lib/catalog';
import { parseState, serializeState } from '../src/lib/url-state';

const config = { styles: catalog.styles, categories: catalog.categories.map((c) => c.name), icons: new Set(iconsByName.keys()) };

describe('URL state', () => {
  it('round-trips search, category, style, and icon', () => {
    const state = { q: 'arrow up', category: 'Navigation', style: 'filled' as const, icon: 'arrow-up' };
    const url = serializeState(state, config);
    expect(url).toContain('style=solid');
    expect(parseState(url, config)).toEqual(state);
  });

  it('omits defaults', () => {
    expect(serializeState({ q: '', category: null, style: 'regular', icon: null }, config)).toBe('');
  });

  it('discards values the catalog cannot honor', () => {
    expect(parseState('?style=neon&category=Nope&icon=not-real&q=x', config)).toEqual({
      q: 'x', category: null, style: 'regular', icon: null,
    });
  });
});
