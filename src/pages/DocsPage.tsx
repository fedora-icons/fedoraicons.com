import { UiIcon } from '../components/ui';
import { DEFAULT_LOCALE, useI18n } from '../i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { catalog, lock, palettes, STYLE_META } from '../lib/catalog';
import { copyText } from '../lib/export';
import { CodeBlock } from '../components/CodeBlock';
import { useToast } from '../components/ui';
import { CONTAINER } from '../lib/layout';

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
function useActiveSection() {
  const [active, setActive] = useState<string>(SECTIONS[0][0]);
  const pinned = useRef<{ id: string; timer: number } | null>(null);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (pinned.current) return;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let current: string = SECTIONS[0][0];
      for (const [id] of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= SPY_OFFSET) current = id;
      }
      setActive(atBottom ? SECTIONS[SECTIONS.length - 1][0] : current);
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
  }, []);

  const choose = (id: string) => {
    if (pinned.current) window.clearTimeout(pinned.current.timer);
    // If no scroll follows (already in place), release shortly after.
    pinned.current = { id, timer: window.setTimeout(() => { pinned.current = null; }, 600) };
    setActive(id);
  };
  return [active, choose] as const;
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
  const [active, setActive] = useActiveSection();
  // Other languages show this English page until a translation exists (see src/i18n/content.ts).
  const { t, config, path } = useI18n();
  const english = config.code !== DEFAULT_LOCALE;

  return (
    <div className={`docs-page ${CONTAINER} flex gap-12 pb-20 pt-8 sm:pt-12`}>
      <nav aria-label="Documentation" className="sticky top-8 hidden h-fit w-44 shrink-0 md:block">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted">On this page</p>
        <ul className="border-l border-line text-sm">
          {SECTIONS.map(([id, label]) => (
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

      <article lang={english ? 'en' : undefined} className="min-w-0 max-w-[720px] flex-1 space-y-10">
        {english && (
          <p lang={config.code} className="inline-flex items-center gap-2 rounded-lg bg-sunken px-3 py-1.5 text-sm text-muted">
            <UiIcon name="globe" className="size-4" /> {t('docs.englishOnly')}
          </p>
        )}
        <header>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Documentation</h1>
          <p className="mt-3 text-base text-muted">
            Use Fedora Icons as plain SVG, in React, or in Figma. {nf.format(catalog.icons.length)} icons,
            each in {catalog.styles.length} styles, on a {catalog.grid}px grid.
          </p>
        </header>

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
          <p>Download an icon from the inspector, or copy files from <code>icons/regular/</code>, <code>icons/filled/</code>, <code>icons/duocolor/</code>, or <code>icons/duotone/</code> in the <a href="https://github.com/fedora-icons/fedora-icons">library repository</a>. There is no runtime dependency or icon font.</p>
          <Code lang="html">{`<img src="./icons/regular/text-align-left.svg" width="24" height="24" alt="Align text left">`}</Code>
          <p>To theme with CSS, inline the markup instead: the library&apos;s <code>currentColor</code> follows the parent element&apos;s <code>color</code>. Don&apos;t globally override <code>fill</code> on paths — Solid icons rely on real transparent cutouts.</p>
          <p><strong>Website downloads are standalone.</strong> Files exported here have every color resolved to a concrete value, so they render the same in any viewer or design tool. Masks, clip paths, and the Duotone tint are kept intact. If you want live theming, use the library SVGs.</p>
        </Section>

        <Section id="react" title="React">
          <p><a href="https://www.npmjs.com/package/@fedora-icons/react"><code>@fedora-icons/react</code></a> is on npm. It supports React 18 and 19, ships TypeScript types, and tree-shakes to the icons you import. Source: <a href="https://github.com/fedora-icons/react-fedora">fedora-icons/react-fedora</a>.</p>
          <Code lang="sh">{`npm install @fedora-icons/react`}</Code>
          <p>Each style is a separate component: the canonical name in PascalCase plus a style suffix. <code>fuel-pump</code> becomes <code>FuelPumpRegular</code>, <code>FuelPumpFilled</code>, <code>FuelPumpDuocolor</code>, and <code>FuelPumpDuotone</code>. Solid icons use the <code>Filled</code> suffix. Names starting with a digit get an <code>Icon</code> prefix.</p>
          <Code lang="tsx">{`import { CameraRegular, CameraDuocolor } from '@fedora-icons/react';

<CameraRegular size={24} />
<CameraDuocolor size={32} primaryColor="#245B9E" secondaryColor="#60A5FA" />`}</Code>
          <ul className="list-disc space-y-1 pl-5">
            <li><code>size</code> defaults to 24 and sets width and height. It scales the artwork; it does not select a different optical size.</li>
            <li>Regular and Filled inherit <code>currentColor</code>. Duo styles default to blue; set <code>color</code> or <code>primaryColor</code>, and <code>secondaryColor</code> for accents.</li>
            <li>Named presets with an independent glyph color accept <code>modifierColor</code>.</li>
            <li>Icons are decorative by default (<code>aria-hidden</code>). Pass <code>title</code>, <code>aria-label</code>, or <code>aria-labelledby</code> for meaningful icons.</li>
            <li>Root imports are tree-shakeable; <code>@fedora-icons/react/filled</code> and <code>@fedora-icons/react/regular/camera</code> entry points also exist.</li>
          </ul>
          <p>The inspector&apos;s React example uses these exact props.</p>
        </Section>

        <Section id="figma" title="Figma">
          <p>The Fedora Icons Figma library holds every core icon as a component set with <code>Style=Regular/Filled/Duocolor/Duotone</code> and <code>Size=24</code>. Its <strong>Get Started</strong> page covers styles, instances, themes, modifiers, and exports.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Fedora / Theme</strong> switches Light and Dark, and holds the twelve duo palettes.</li>
            <li><strong>Fedora / Stroke</strong> offers 16px (1px), 24px (1.25px, default), and 32px (1.5px) stroke presets. These change stroke weight only, not icon dimensions.</li>
            <li>Named icon instances expose their nested <strong>Modifier</strong> controls in the properties panel.</li>
          </ul>
          <p>SVGs downloaded here can also be pasted or dropped into Figma; their colors are already resolved.</p>
        </Section>

        <Section id="colors" title="Colors">
          <p>Regular and Solid are single-color icons. Duocolor and Duotone use two CSS custom properties with blue defaults:</p>
          <Code lang="css">{`.toolbar svg {
  --fedora-primary: #245B9E;
  --fedora-secondary: #5B87B7;
}`}</Code>
          <p>Duocolor uses the secondary color for details; single-contour icons stay primary-only. Duotone tints closed shapes with 16% of the primary color. Named presets add <code>--fedora-modifier</code> for their solid glyph.</p>
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
          <p>Every icon is authored at <strong>24px</strong>. Other sizes are scaled from that master — Fedora does not yet have separately authored optical sizes. Check icons at their final size, especially below 20px.</p>
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
          <p>The core icons and tooling are available under the <a href="/licenses/fedora-icons-LICENSE.txt">MIT License</a>.</p>
          <p>Brand icons are <strong>not</strong> covered by the MIT license. All brand icons belong to their respective owners, and their use is governed by each owner&apos;s brand guidelines. No affiliation or endorsement is implied.</p>
        </Section>

        <Section id="privacy" title="Privacy">
          <p>This site sets no cookies and runs no analytics, ads, or tracking scripts. Fonts and icons are served from this site, not from third parties.</p>
          <p>Your browser&apos;s local storage keeps two preferences, and only on your device:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><code>fedora-theme</code>: light or dark, when you pick one instead of following your system.</li>
            <li><code>fedora-pane-collapsed</code>: whether the side pane is collapsed.</li>
          </ul>
          <p>Searches, customizations, and downloads happen in your browser and aren&apos;t sent anywhere. Links to GitHub, npm, and Figma take you to those services, which have their own privacy policies. Like any website, the server hosting this one may keep standard request logs.</p>
          <p>To clear the stored preferences, clear this site&apos;s data in your browser settings.</p>
        </Section>

        <Section id="source" title="Source data">
          <p>This site is generated from the <a href="https://github.com/fedora-icons/fedora-icons">fedora-icons</a> library. Counts, categories, names, and aliases come from its manifest.</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl border border-line p-4 font-mono text-xs text-muted">
            <dt>Revision</dt><dd className="break-all text-ink">{lock.revision ?? 'unknown'}{lock.dirty ? ' (with uncommitted changes)' : ''}</dd>
            <dt>Manifest</dt><dd className="break-all text-ink">sha256:{lock.manifestSha256}</dd>
          </dl>
        </Section>
      </article>
    </div>
  );
}
