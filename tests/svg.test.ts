import { describe, expect, it } from 'vitest';
import { catalog } from '../src/lib/catalog';
import { BASE_STROKE, buildSvg, hasFilledDetails, hasModifierRole, hasSecondaryRole, prepareGridSvg } from '../src/lib/svg';
import { danglingRefs, styleSvgs } from './helpers';

const parse = (svg: string) => new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;

describe('buildSvg', () => {
  it('resolves a Regular icon to one explicit color at the chosen size', () => {
    const out = buildSvg(styleSvgs('regular').search, { primary: '#AA0000', size: 48 });
    const root = parse(out);
    expect(root.getAttribute('width')).toBe('48');
    expect(root.getAttribute('height')).toBe('48');
    expect(root.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(out).not.toContain('currentColor');
    expect(out).toContain('stroke="#AA0000"');
  });

  it('applies primary and secondary roles to Duocolor', () => {
    const source = styleSvgs('duocolor')['user-add'];
    expect(hasSecondaryRole(source)).toBe(true);
    const out = buildSvg(source, { primary: '#111111', secondary: '#222222', size: 24 });
    expect(out).not.toContain('var(');
    expect(out).toContain('#111111');
    expect(out).toContain('#222222');
  });

  it('preserves the Duotone 16% interior tint', () => {
    const source = styleSvgs('duotone').camera ?? styleSvgs('duotone').accordion;
    const before = (source.match(/opacity="0\.16"/g) ?? []).length;
    expect(before).toBeGreaterThan(0);
    const out = buildSvg(source, { primary: '#123456', size: 24 });
    expect((out.match(/opacity="0\.16"/g) ?? []).length).toBe(before);
    expect(out).not.toContain('currentColor');
  });

  it('keeps masks, clip paths, and the transparent stencil of modifier presets', () => {
    const source = styleSvgs('filled')['user-add'];
    const out = buildSvg(source, { primary: '#000000', size: 24, idPrefix: 'x1' });
    expect(out).toContain('<mask');
    expect(out).toContain('<clipPath');
    expect(out).toMatch(/mask-type="luminance"/);
    // Mask paint stays black/white: the cutout must stay transparent.
    expect(out).toContain('fill="white"');
    expect(out).toContain('stroke="black"');
    expect(danglingRefs(out)).toEqual([]);
    expect(out).toMatch(/id="x1-\d+"/);
  });

  it('honors a modifier color and otherwise the library default', () => {
    const source = styleSvgs('duocolor')['user-add'];
    expect(hasModifierRole(source)).toBe(true);
    expect(buildSvg(source, { primary: '#000000', size: 24 })).toContain('#0F7B0F');
    const custom = buildSvg(source, { primary: '#000000', modifier: '#FF00FF', size: 24 });
    expect(custom).toContain('#FF00FF');
    expect(custom).not.toContain('#0F7B0F');
  });

  it.each(['regular', 'filled', 'duocolor', 'duotone'] as const)(
    'exports every %s icon standalone with intact references',
    (style) => {
      const svgs = styleSvgs(style);
      expect(Object.keys(svgs)).toHaveLength(catalog.icons.length);
      for (const [name, source] of Object.entries(svgs)) {
        const out = buildSvg(source, { primary: '#101010', secondary: '#202020', modifier: '#303030', size: 32, idPrefix: 'p' });
        if (out.includes('var(') || out.includes('currentColor') || danglingRefs(out).length) {
          throw new Error(`${style}/${name} did not export cleanly`);
        }
      }
    },
    30_000,
  );

  it('scales every authored stroke proportionally and leaves geometry alone', () => {
    const source = styleSvgs('regular').search;
    const widths = (svg: string) => [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));
    const paths = (svg: string) => [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
    const out = buildSvg(source, { primary: '#000000', size: 24, strokeWidth: 2 });
    expect(widths(out).every((w) => w === 2)).toBe(true);
    expect(paths(out)).toEqual(paths(source));
    // Default weight leaves the artwork's strokes untouched.
    expect(widths(buildSvg(source, { primary: '#000000', size: 24, strokeWidth: BASE_STROKE }))).toEqual(widths(source));
    // Heavier authored strokes keep their ratio to the standard weight.
    const heavy = Object.values(styleSvgs('regular')).find((svg) => svg.includes('stroke-width="1.5"'))!;
    expect(widths(buildSvg(heavy, { primary: '#000000', size: 24, strokeWidth: 2.5 }))).toContain(3);
  });

  it('lets the grid reweight strokes through a CSS variable', () => {
    const out = prepareGridSvg(styleSvgs('regular').search);
    expect(out).toContain('stroke-width="1.25" style="stroke-width:calc(1.25px * var(--stroke-scale, 1))"');
    expect(parse(out).nodeName).toBe('svg');
  });
});

describe('autoStroke', () => {
  it('is 1.25 at 24px, 0.85 at 64px, linear in 0.05 steps between, and held above 64px', async () => {
    const { autoStroke } = await import('../src/lib/look');
    expect(autoStroke(24)).toBe(1.25);
    expect(autoStroke(64)).toBe(0.85);
    expect(autoStroke(44)).toBe(1.05);
    expect(autoStroke(48)).toBe(1);
    expect(autoStroke(40)).toBe(1.1);
    expect(autoStroke(512)).toBe(0.85);
    expect(autoStroke(16)).toBeGreaterThan(1.25);
  });
});

describe('hasFilledDetails', () => {
  it('flags filled parts that do not follow the stroke, ignoring the Duotone tint', () => {
    expect(hasFilledDetails(styleSvgs('regular')['cloud-moon'])).toBe(true);
    expect(hasFilledDetails(styleSvgs('duotone')['cloud-moon'])).toBe(true);
    expect(hasFilledDetails(styleSvgs('regular').search)).toBe(false);
    // Duotone search only adds a translucent tint, which is not a filled detail.
    expect(hasFilledDetails(styleSvgs('duotone').search)).toBe(false);
  });
});
