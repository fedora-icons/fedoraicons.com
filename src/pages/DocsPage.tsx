import { UiIcon } from '../components/ui';
import { DEFAULT_LOCALE, useI18n } from '../i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { catalog, ICONS_ROUNDED, lock, palettes, STYLE_META } from '../lib/catalog';
import { copyText } from '../lib/export';
import { CodeBlock } from '../components/CodeBlock';
import { useToast } from '../components/ui';
import { createPortal } from 'react-dom';
import { CONTAINER, useHeaderSlot } from '../lib/layout';
import { useMediaQuery } from '../lib/theme';
import { useSlashToFocus } from './IconsPage';

const nf = new Intl.NumberFormat('en-US');
const compositions = catalog.icons.filter((i) => i.composition);
const modifierNames = new Set(compositions.flatMap((i) => i.composition!.modifiers.map((m) => m.name)));

const SECTIONS = [
  ['styles', 'Styles'],
  ['svg', 'SVG'],
  ['react', 'React'],
  ['figma', 'Figma'],
  ['colors', 'Colors'],
  ['sizes', 'Sizes'],
  ['modifiers', 'Modifiers'],
  ['accessibility', 'Accessibility'],
  ['licensing', 'Licensing'],
  ['privacy', 'Privacy'],
  ['source', 'Source data'],
] as const;

function Code({ children, lang }: { children: string; lang: string }) {
  const toast = useToast();
  return (
    <CodeBlock
      code={children}
      lang={lang}
      className="my-4"
      action={(
        <button
          type="button"
          onClick={() => copyText(children).then(() => toast('success', 'Copied'), (e: Error) => toast('error', e.message))}
          className="rounded-md px-2 py-1 text-xs font-medium text-[#c9c9cf] transition hover:bg-white/10 hover:text-white"
        >
          Copy
        </button>
      )}
    />
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 border-t border-line pt-10 first:border-t-0 first:pt-0">
      <h2 id={`${id}-title`} className="text-2xl font-semibold">{title}</h2>
      <div className="prose-docs mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Line below the top of the viewport that decides the current section. */
const SPY_OFFSET = 120;

/**
 * The section being read: the last one whose top has passed SPY_OFFSET, or
 * the last section once the page bottom is reached. A clicked link wins until
 * its scroll settles, so short final sections can still be selected.
 */
function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>(SECTIONS[0][0]);
  const pinned = useRef<{ id: string; timer: number } | null>(null);
  const key = ids.join(' ');

  useEffect(() => {
    const shown = key ? key.split(' ') : [];
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (pinned.current || !shown.length) return;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let current = shown[0];
      for (const id of shown) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= SPY_OFFSET) current = id;
      }
      setActive(atBottom ? shown[shown.length - 1] : current);
    };
    const onScroll = () => {
      if (pinned.current) {
        // Release the clicked section once scrolling stops.
        window.clearTimeout(pinned.current.timer);
        pinned.current.timer = window.setTimeout(() => { pinned.current = null; }, 150);
      }
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [key]);

  const choose = (id: string) => {
    if (pinned.current) window.clearTimeout(pinned.current.timer);
    // If no scroll follows (already in place), release shortly after.
    pinned.current = { id, timer: window.setTimeout(() => { pinned.current = null; }, 600) };
    setActive(id);
  };
  return [active, choose] as const;
}

const ALL_IDS = SECTIONS.map(([id]) => id);
const HIGHLIGHT = 'docs-search';

/** Lowercased words of a query; a section matches when it contains all of them. */
const queryWords = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);

/** Text nodes a reader sees as content: skips button labels (Copy) and aria-hidden chrome. */
function contentTextNodes(root: Element): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.parentElement?.closest('button, [aria-hidden="true"]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

/**
 * Filters the docs sections by a query: hides sections that don't contain
 * every word and highlights the matches where the browser supports
 * CSS.highlights. Returns the ids still shown, in page order.
 */
function useSectionFilter(query: string) {
  const [shown, setShown] = useState<readonly string[]>(ALL_IDS);
  const words = queryWords(query).join(' ');

  useEffect(() => {
    const terms = words ? words.split(' ') : [];
    const ranges: Range[] = [];
    const matched: string[] = [];
    for (const id of ALL_IDS) {
      const section = document.getElementById(id);
      if (!section) continue;
      const nodes = contentTextNodes(section);
      const text = nodes.map((n) => n.data).join('').toLowerCase();
      const match = terms.every((w) => text.includes(w));
      section.hidden = !match;
      if (!match) continue;
      matched.push(id);
      for (const node of nodes) {
        const lower = node.data.toLowerCase();
        for (const w of terms) {
          for (let i = lower.indexOf(w); i !== -1; i = lower.indexOf(w, i + w.length)) {
            const range = document.createRange();
            range.setStart(node, i);
            range.setEnd(node, i + w.length);
            ranges.push(range);
          }
        }
      }
    }
    setShown(matched);
    const highlights = typeof CSS !== 'undefined' ? CSS.highlights : undefined;
    if (highlights && typeof Highlight !== 'undefined') {
      if (ranges.length) highlights.set(HIGHLIGHT, new Highlight(...ranges));
      else highlights.delete(HIGHLIGHT);
    }
  }, [words]);

  useEffect(() => () => {
    if (typeof CSS !== 'undefined') CSS.highlights?.delete(HIGHLIGHT);
  }, []);

  return shown;
}

function DocsSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useSlashToFocus(ref);
  return (
    <div className="relative">
      <UiIcon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <input
        ref={ref}
        type="search"
        aria-label="Search the docs"
        placeholder="Search docs"
        value={value}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape' && value) { e.preventDefault(); onChange(''); } }}
        className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-9 text-sm text-ink outline-none transition placeholder:text-faint focus:border-brand focus:ring-4 focus:ring-brand/15 [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
        {value ? (
          <button type="button" aria-label="Clear search" onClick={() => { onChange(''); ref.current?.focus(); }} className="inline-flex size-6 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-ink">
            <UiIcon name="x" className="size-4" />
          </button>
        ) : (
          <kbd aria-hidden="true" className="hidden rounded border border-line bg-sunken px-1.5 text-xs text-muted md:inline">/</kbd>
        )}
      </div>
    </div>
  );
}

export default function DocsPage() {
  const { hash } = useLocation();
  const arrived = useRef(false);
  useEffect(() => {
    // Arriving from another page jumps straight to the section; links within
    // the page glide there (CSS `scroll-behavior` on .docs-page, off for reduced motion).
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView(arrived.current ? undefined : { behavior: 'instant' });
    arrived.current = true;
  }, [hash]);
  const [query, setQuery] = useState('');
  const shown = useSectionFilter(query);
  const [active, setActive] = useActiveSection(shown);
  const searching = queryWords(query).length > 0;
  // Other languages show this English page until a translation exists (see src/i18n/content.ts).
  const { t, config, path } = useI18n();
  const english = config.code !== DEFAULT_LOCALE;
  // On desktop the search box sits in the site header; on phones (and without a header) in the page.
  const headerSlot = useHeaderSlot();
  const desktop = useMediaQuery('(min-width: 768px)');
  const search = <DocsSearch value={query} onChange={setQuery} />;
  const inHeader = headerSlot && desktop;

  return (
    <div className={`docs-page ${CONTAINER} flex gap-12 pb-20 pt-8 sm:pt-12`}>
      {inHeader && createPortal(<div className="w-full max-w-md">{search}</div>, headerSlot)}
      <p role="status" className="sr-only">
        {searching ? `${shown.length} ${shown.length === 1 ? 'section matches' : 'sections match'}` : ''}
      </p>
      <aside className="sticky top-8 hidden h-fit w-44 shrink-0 md:block">
        <nav aria-label="Documentation">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">On this page</p>
          {shown.length === 0 && <p className="text-sm text-muted">No matches</p>}
          <ul className="border-l border-line text-sm empty:hidden">
            {SECTIONS.filter(([id]) => shown.includes(id)).map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  aria-current={active === id ? 'location' : undefined}
                  onClick={() => setActive(id)}
                  className={`-ml-px block border-l-2 py-1.5 pl-3 pr-2 transition-colors ${
                    active === id ? 'border-brand font-medium text-ink' : 'border-transparent text-muted hover:border-line-strong hover:text-ink'
                  }`}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <article lang={english ? 'en' : undefined} className="min-w-0 max-w-[720px] flex-1 space-y-10">
        {!inHeader && search}
        {english && (
          <p lang={config.code} className="inline-flex items-center gap-2 rounded-lg bg-sunken px-3 py-1.5 text-sm text-muted">
            <UiIcon name="globe" className="size-4" /> {t('docs.englishOnly')}
          </p>
        )}
        <header>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Documentation</h1>
          <p className="mt-3 text-base text-muted">
            Use Fos Icons as plain SVG, in React, or in Figma. {nf.format(ICONS_ROUNDED)}+ icons,
            each in {catalog.styles.length} styles, on a {catalog.grid}px grid.
          </p>
        </header>

        {shown.length === 0 && (
          <div className="rounded-xl border border-line p-6 text-center">
            <p className="font-medium text-ink">Nothing in the docs matches “{query.trim()}”</p>
            <p className="mt-1 text-sm text-muted">Try a shorter or different word.</p>
            <button type="button" onClick={() => setQuery('')} className="mt-4 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-medium text-ink hover:bg-sunken">
              Clear search
            </button>
          </div>
        )}

        <Section id="styles" title="Styles">
          <ul className="list-disc space-y-1 pl-5">
            {catalog.styles.map((s) => (
              <li key={s}><strong>{STYLE_META[s].label}</strong>{s === 'filled' && <> (<code>filled</code> in files and code)</>} — {STYLE_META[s].description}.</li>
            ))}
          </ul>
          <p>
            Every icon ships in all four styles under the same canonical kebab-case name. Line styles
            use {catalog.strokeWidth}px strokes. Negative space and modifier clearances are genuinely
            transparent, not painted with a background color.
          </p>
        </Section>

        <Section id="svg" title="SVG">
          <p>Download an icon from the inspector, or copy files from <code>icons/regular/</code>, <code>icons/filled/</code>, <code>icons/duocolor/</code>, or <code>icons/duotone/</code> in the <a target="_blank" rel="noreferrer" href="https://github.com/fos-icons/fos-icons">library repository</a>. There is no runtime dependency or icon font.</p>
          <Code lang="html">{`<img src="./icons/regular/text-align-left.svg" width="24" height="24" alt="Align text left">`}</Code>
          <p>To theme with CSS, inline the markup instead: the library&apos;s <code>currentColor</code> follows the parent element&apos;s <code>color</code>. Don&apos;t globally override <code>fill</code> on paths — Solid icons rely on real transparent cutouts.</p>
          <p><strong>Website downloads are standalone.</strong> Files exported here have every color resolved to a concrete value, so they render the same in any viewer or design tool. Masks, clip paths, and the Duotone tint are kept intact. If you want live theming, use the library SVGs.</p>
        </Section>

        <Section id="react" title="React">
          <p><a target="_blank" rel="noreferrer" href="https://www.npmjs.com/package/@fos-icons/react"><code>@fos-icons/react</code></a> is on npm. It supports React 18 and 19, ships TypeScript types, and tree-shakes to the icons you import. Source: <a target="_blank" rel="noreferrer" href="https://github.com/fos-icons/react-fos">fos-icons/react-fos</a>.</p>
          <Code lang="sh">{`npm install @fos-icons/react\n# or\npnpm add @fos-icons/react`}</Code>
          <p>Each style is a separate component: the canonical name in PascalCase plus a style suffix. <code>fuel-pump</code> becomes <code>FuelPumpRegular</code>, <code>FuelPumpFilled</code>, <code>FuelPumpDuocolor</code>, and <code>FuelPumpDuotone</code>. Solid icons use the <code>Filled</code> suffix. Names starting with a digit get an <code>Icon</code> prefix.</p>
          <Code lang="tsx">{`import { CameraRegular, CameraDuocolor } from '@fos-icons/react';

<CameraRegular size={24} />
<CameraDuocolor size={32} primaryColor="#245B9E" secondaryColor="#60A5FA" />`}</Code>
          <ul className="list-disc space-y-1 pl-5">
            <li><code>size</code> defaults to 24 and sets width and height. It scales the artwork; it does not select a different optical size.</li>
            <li>Regular and Filled inherit <code>currentColor</code>. Duo styles default to blue; set <code>color</code> or <code>primaryColor</code>, and <code>secondaryColor</code> for accents.</li>
            <li>Named presets with an independent glyph color accept <code>modifierColor</code>.</li>
            <li>Icons are decorative by default (<code>aria-hidden</code>). Pass <code>title</code>, <code>aria-label</code>, or <code>aria-labelledby</code> for meaningful icons.</li>
            <li>Root imports are tree-shakeable; <code>@fos-icons/react/filled</code> and <code>@fos-icons/react/regular/camera</code> entry points also exist.</li>
          </ul>
          <p>The inspector&apos;s React example uses these exact props.</p>
        </Section>

        <Section id="figma" title="Figma">
          <p>The Fos Icons Figma library holds every core icon as a component set with <code>Style=Regular/Filled/Duocolor/Duotone</code> and <code>Size=24</code>. Its <strong>Get Started</strong> page covers styles, instances, themes, modifiers, and exports.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Fos / Theme</strong> switches Light and Dark, and holds the twelve duo palettes.</li>
            <li><strong>Fos / Stroke</strong> offers 16px (1px), 24px (1.25px, default), and 32px (1.5px) stroke presets. These change stroke weight only, not icon dimensions.</li>
            <li>Named icon instances expose their nested <strong>Modifier</strong> controls in the properties panel.</li>
          </ul>
          <p>SVGs downloaded here can also be pasted or dropped into Figma; their colors are already resolved.</p>
        </Section>

        <Section id="colors" title="Colors">
          <p>Regular and Solid are single-color icons. Duocolor and Duotone use two CSS custom properties with blue defaults:</p>
          <Code lang="css">{`.toolbar svg {
  --fos-primary: #245B9E;
  --fos-secondary: #5B87B7;
}`}</Code>
          <p>Duocolor uses the secondary color for details; single-contour icons stay primary-only. Duotone tints closed shapes with 16% of the primary color. Named presets add <code>--fos-modifier</code> for their solid glyph.</p>
          <p>The twelve library palettes, each with Light and Dark pairs:</p>
          <ul className="grid grid-cols-2 gap-2 !pl-0 sm:grid-cols-3" role="list">
            {palettes.palettes.map((p) => (
              <li key={p.name} className="flex list-none items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-sm">
                <span className="flex h-5 w-10 overflow-hidden rounded" aria-hidden="true">
                  <span className="flex-1" style={{ background: p.light.primary }} />
                  <span className="flex-1" style={{ background: p.light.secondary }} />
                  <span className="flex-1" style={{ background: p.dark.primary }} />
                  <span className="flex-1" style={{ background: p.dark.secondary }} />
                </span>
                <span className="text-ink">{p.name}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="sizes" title="Sizes">
          <p>Every icon is authored at <strong>24px</strong>. Other sizes are scaled from that master — Fos Icons does not yet have separately authored optical sizes. Check icons at their final size, especially below 20px.</p>
        </Section>

        <Section id="modifiers" title="Modifiers">
          <p>Modifiers combine a base icon with a small solid glyph — Add, Delete, Lock, file-type labels, and more — with a designed corner position and a transparent clearance gap so the glyph never touches the base.</p>
          <p>The library currently includes <strong>{compositions.length} authored compositions</strong> across {new Set(compositions.map((c) => c.composition!.base)).size} base icons, using {modifierNames.size} modifiers. In the inspector, open a base icon such as <a href={path('/?icon=user')}>user</a> or <a href={path('/?icon=file')}>file</a> and choose from the <strong>Modifier</strong> menu.</p>
          <p>The website offers only these authored compositions. It does not generate arbitrary base-and-glyph combinations, because automatic conflict handling has not been designed yet. For other combinations, the library&apos;s Python composer supports the four corners with real clearance:</p>
          <Code lang="sh">{`python3 scripts/compose_svg.py home-smile --modifier key --position bottom-right --output home-key.svg`}</Code>
        </Section>

        <Section id="accessibility" title="Accessibility">
          <ul className="list-disc space-y-1 pl-5">
            <li>Decorative inline icons: add <code>aria-hidden=&quot;true&quot;</code>.</li>
            <li>Icon-only buttons and links need an accessible name on the control, e.g. <code>aria-label=&quot;Delete&quot;</code>.</li>
            <li>Meaningful standalone icons: <code>role=&quot;img&quot;</code> with a label, or an <code>alt</code> on <code>&lt;img&gt;</code>.</li>
            <li>Check contrast against the background (3:1 for meaningful graphics) and keep interactive targets at least 24×24px.</li>
          </ul>
          <p>An icon library alone can&apos;t make an interface accessible — pair icons with clear labels.</p>
        </Section>

        <Section id="licensing" title="Licensing">
          <p>The core icons and tooling are available under the <a href="/licenses/fos-icons-LICENSE.txt">MIT License</a>.</p>
          <p>Brand icons are <strong>not</strong> covered by the MIT license. All brand icons belong to their respective owners, and their use is governed by each owner&apos;s brand guidelines. No affiliation or endorsement is implied.</p>
        </Section>

        <Section id="privacy" title="Privacy">
          <p>This site sets no cookies and runs no analytics, ads, or tracking scripts. Fonts and icons are served from this site, not from third parties.</p>
          <p>Your browser&apos;s local storage keeps three preferences, and only on your device:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><code>fos-theme</code>: light or dark, when you pick one instead of following your system.</li>
            <li><code>fos-pane-collapsed</code>: whether the side pane is collapsed.</li>
            <li><code>fos-pane-width</code>: the side pane&apos;s width, when you resize it.</li>
          </ul>
          <p>Searches, customizations, and downloads happen in your browser and aren&apos;t sent anywhere. Links to GitHub, npm, and Figma take you to those services, which have their own privacy policies. Like any website, the server hosting this one may keep standard request logs.</p>
          <p>To clear the stored preferences, clear this site&apos;s data in your browser settings.</p>
        </Section>

        <Section id="source" title="Source data">
          <p>This site is generated from the <a target="_blank" rel="noreferrer" href="https://github.com/fos-icons/fos-icons">fos-icons</a> library. Counts, categories, names, and aliases come from its manifest.</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl border border-line p-4 font-mono text-xs text-muted">
            <dt>Revision</dt><dd className="break-all text-ink">{lock.revision ?? 'unknown'}{lock.dirty ? ' (with uncommitted changes)' : ''}</dd>
            <dt>Manifest</dt><dd className="break-all text-ink">sha256:{lock.manifestSha256}</dd>
          </dl>
        </Section>
      </article>
    </div>
  );
}
