import brandData from '../data/brands.json';
import type { IconEntry } from './catalog';
import { scopeSvg } from './svg';
import { BRAND_STYLES, type BrandStyle } from './url-state';

export interface BrandEntry {
  name: string;
  owner: string;
  category: string;
  aliases?: string[];
  officialSource: string;
  retrieved: string;
  terms: string;
  /** Paths under public/, per style. Solid (`filled`) is optional. */
  files: Partial<Record<BrandStyle, string>>;
}

export const brands = brandData as { disclaimer: string; approved: BrandEntry[] };

/** Approved brands as searchable entries. */
export const brandEntries: IconEntry[] = brands.approved.map((b) => ({
  name: b.name, category: b.category, tags: [b.owner.toLowerCase()], aliases: b.aliases ?? [],
}));

export const brandCategories = [...new Set(brandEntries.map((e) => e.category))].sort()
  .map((name) => ({ name, count: brandEntries.filter((e) => e.category === name).length }));

/** Brand styles at least one approved brand ships (Solid only once a Solid source exists). */
export const availableBrandStyles: BrandStyle[] = BRAND_STYLES.filter((s) => brands.approved.some((b) => b.files[s]));

export const hasBrandStyle = (name: string, style: BrandStyle) =>
  !!brands.approved.find((b) => b.name === name)?.files[style];

const cache = new Map<BrandStyle, Promise<Record<string, string>>>();

/** Fetch the approved brand SVGs for one style. */
export function loadBrands(style: BrandStyle): Promise<Record<string, string>> {
  if (!cache.has(style)) {
    cache.set(style, Promise.all(brands.approved.map(async (b) => {
      const file = b.files[style];
      if (!file) return null;
      const res = await fetch(`${import.meta.env.BASE_URL}${file}`);
      if (!res.ok) throw new Error(`Could not load ${b.name} (${res.status})`);
      // Marks are shown unmodified, but their IDs (gradients, clip paths) are
      // namespaced so marks sharing an ID don't repaint each other on one page.
      return [b.name, scopeSvg(await res.text(), `brand-${b.name}-${style}`)] as const;
    })).then((rows) => Object.fromEntries(rows.filter((r) => r !== null))).catch((error: unknown) => {
      cache.delete(style);
      throw error;
    }));
  }
  return cache.get(style)!;
}
