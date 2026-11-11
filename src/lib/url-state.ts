import { STYLE_META, styleFromSlug, type StyleId } from './catalog';

export interface CatalogState {
  q: string;
  category: string | null;
  style: StyleId;
  icon: string | null;
}

export interface UrlStateConfig {
  styles: readonly StyleId[];
  categories: readonly string[];
  icons: ReadonlySet<string>;
}

/** Parse shareable state, discarding values the catalog cannot honor. */
export function parseState(search: string, config: UrlStateConfig): CatalogState {
  const params = new URLSearchParams(search);
  const category = params.get('category');
  const icon = params.get('icon');
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    category: category && config.categories.includes(category) ? category : null,
    style: styleFromSlug(params.get('style'), config.styles) ?? config.styles[0],
    icon: icon && config.icons.has(icon) ? icon : null,
  };
}

/** Serialize state, omitting defaults so URLs stay short. */
export function serializeState(state: CatalogState, config: Pick<UrlStateConfig, 'styles'>): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set('q', state.q);
  if (state.category) params.set('category', state.category);
  if (state.style !== config.styles[0]) params.set('style', STYLE_META[state.style].slug);
  if (state.icon) params.set('icon', state.icon);
  const out = params.toString();
  return out ? `?${out}` : '';
}
