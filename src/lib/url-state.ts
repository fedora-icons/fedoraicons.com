import { STYLE_META, styleFromSlug, type StyleId } from './catalog';

/** The style switcher's options: the four core styles, then Brands. */
export type View = StyleId | 'brands';
/** Brands offer Regular and Solid only — never the duo styles. */
export type BrandStyle = 'regular' | 'filled';
export const BRAND_STYLES: BrandStyle[] = ['regular', 'filled'];

export interface CatalogState {
  q: string;
  category: string | null;
  style: View;
  /** Regular or Solid within Brands; ignored for core styles. */
  brandStyle: BrandStyle;
  icon: string | null;
}

export interface CollectionConfig {
  categories: readonly string[];
  icons: ReadonlySet<string>;
}

export interface UrlStateConfig {
  styles: readonly StyleId[];
  core: CollectionConfig;
  brands: CollectionConfig;
}

/** Parse shareable state, discarding values the catalog cannot honor. */
export function parseState(search: string, config: UrlStateConfig): CatalogState {
  const params = new URLSearchParams(search);
  const slug = params.get('style');
  const style: View = slug === 'brands' ? 'brands' : styleFromSlug(slug, config.styles) ?? config.styles[0];
  const collection = style === 'brands' ? config.brands : config.core;
  const category = params.get('category');
  const icon = params.get('icon');
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    category: category && collection.categories.includes(category) ? category : null,
    style,
    brandStyle: style === 'brands' ? styleFromSlug(params.get('variant'), BRAND_STYLES) as BrandStyle ?? 'regular' : 'regular',
    icon: icon && collection.icons.has(icon) ? icon : null,
  };
}

/** Serialize state, omitting defaults so URLs stay short. */
export function serializeState(state: CatalogState, config: Pick<UrlStateConfig, 'styles'>): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set('q', state.q);
  if (state.category) params.set('category', state.category);
  if (state.style === 'brands') {
    params.set('style', 'brands');
    if (state.brandStyle !== 'regular') params.set('variant', STYLE_META[state.brandStyle].slug);
  } else if (state.style !== config.styles[0]) {
    params.set('style', STYLE_META[state.style].slug);
  }
  if (state.icon) params.set('icon', state.icon);
  const out = params.toString();
  return out ? `?${out}` : '';
}
