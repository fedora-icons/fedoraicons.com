import { describe, expect, it } from 'vitest';
import { catalog, iconsByName } from '../src/lib/catalog';
import { parseState, serializeState, type UrlStateConfig } from '../src/lib/url-state';

const config: UrlStateConfig = {
  styles: catalog.styles,
  core: { categories: catalog.categories.map((c) => c.name), icons: new Set(iconsByName.keys()) },
  brands: { categories: ['Social'], icons: new Set(['acme']) },
};

describe('URL state', () => {
  it('round-trips search, category, style, and icon', () => {
    const state = { q: 'arrow up', category: 'Navigation', style: 'filled' as const, brandStyle: 'regular' as const, icon: 'arrow-up' };
    const url = serializeState(state, config);
    expect(url).toContain('style=solid');
    expect(parseState(url, config)).toEqual(state);
  });

  it('omits defaults', () => {
    expect(serializeState({ q: '', category: null, style: 'regular', brandStyle: 'regular', icon: null }, config)).toBe('');
  });

  it('discards values the catalog cannot honor', () => {
    expect(parseState('?style=neon&category=Nope&icon=not-real&q=x', config)).toEqual({
      q: 'x', category: null, style: 'regular', brandStyle: 'regular', icon: null,
    });
  });

  it('treats Brands as a view with its own Regular/Solid variant and catalog', () => {
    const state = { q: '', category: 'Social', style: 'brands' as const, brandStyle: 'filled' as const, icon: 'acme' };
    const url = serializeState(state, config);
    expect(url).toBe('?category=Social&style=brands&variant=solid&icon=acme');
    expect(parseState(url, config)).toEqual(state);
    // Core icons and categories are not valid inside Brands, and vice versa.
    expect(parseState('?style=brands&icon=user&category=Essentials', config)).toMatchObject({ icon: null, category: null });
    expect(parseState('?icon=acme', config).icon).toBeNull();
    // Duo variants never apply to brands.
    expect(parseState('?style=brands&variant=duotone', config).brandStyle).toBe('regular');
  });
});
