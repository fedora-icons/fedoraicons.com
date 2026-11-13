import { describe, expect, it } from 'vitest';
import catalog from '../src/data/catalog.json';
import { createIndex, suggest } from '../src/lib/search';
import { headTags, PAGES, pageFor, structuredData } from '../src/lib/seo';

describe('page metadata', () => {
  it('maps every route to its page, with Brands and unknown paths handled', () => {
    expect(pageFor('/').id).toBe('home');
    expect(pageFor('/', '?style=brands').id).toBe('brands');
    expect(pageFor('/docs/').id).toBe('docs');
    expect(pageFor('/pricing').id).toBe('not-found');
    expect(pageFor('/brands').id).toBe('brands');
    expect(pageFor('/nope').id).toBe('not-found');
  });

  it('derives counts from the catalog and keeps titles and descriptions search-friendly', () => {
    expect(PAGES.home.description).toContain(new Intl.NumberFormat('en-US').format(catalog.icons.length));
    for (const page of Object.values(PAGES)) {
      expect(page.title.length).toBeLessThanOrEqual(60);
      expect(page.description.length).toBeGreaterThan(50);
      expect(page.description.length).toBeLessThanOrEqual(200);
    }
  });

  it('writes canonical, Open Graph, Twitter, and JSON-LD tags', () => {
    const tags = headTags(PAGES.docs);
    expect(tags).toContain('<link rel="canonical" href="https://fedoraicons.com/docs" />');
    expect(tags).toContain('<meta property="og:image" content="https://fedoraicons.com/og-image.png" />');
    expect(tags).toContain('<meta name="twitter:card" content="summary_large_image" />');
    const json = JSON.parse(tags.match(/<script type="application\/ld\+json">(.*)<\/script>/)![1]);
    expect(json['@graph'].map((n: { '@type': string }) => n['@type'])).toEqual(['WebSite', 'Organization', 'TechArticle', 'BreadcrumbList']);
  });

  it('keeps the 404 page out of search results', () => {
    const tags = headTags(PAGES['not-found']);
    expect(tags).toContain('content="noindex, follow"');
    expect(tags).not.toContain('rel="canonical"');
    expect(JSON.stringify(structuredData(PAGES['not-found']))).not.toContain('BreadcrumbList');
  });
});

describe('suggestions', () => {
  const index = createIndex(catalog.icons as Parameters<typeof createIndex>[0]);
  it('finds icons despite a typo', () => {
    expect(suggest(index, 'calender')[0].name).toBe('calendar');
  });
  it('falls back to icons matching some of the words', () => {
    expect(suggest(index, 'rocket zzzz').map((i) => i.name)).toContain('rocket');
  });
});
