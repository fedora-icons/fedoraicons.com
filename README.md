# fedoraicons.com

The Fedora Icons website: search the library, customize an icon, and export it.
Production domain: **fedoraicons.com**.

| Repository | Owns |
| --- | --- |
| `fedora-icons/fedoraicons.com` (this repo) | Website code, synchronized data snapshot |
| [`fedora-icons/fedora-icons`](https://github.com/fedora-icons/fedora-icons) | Canonical SVG artwork, manifest, metadata |
| [`fedora-icons/react-fedora`](https://github.com/fedora-icons/react-fedora) | `@fedora-icons/react` package |

This repo never edits artwork. It consumes a verified, revision-pinned snapshot
of the library (see [docs/ASSETS.md](docs/ASSETS.md)).

## Stack

React 19, TypeScript, Vite 6, Tailwind CSS 4, React Router 7. Fonts are
self-hosted through Fontsource: **Funnel Display** (titles) and **Asta Sans**
(body). Interface glyphs are Fedora's own Regular icons, taken from the
synchronized library. The site builds to static files.

## Development

Node.js 20 or later.

```sh
npm ci
npm run dev          # http://localhost:5173
```

| Script | Purpose |
| --- | --- |
| `npm run sync -- --source ../fedora-icons` | Re-synchronize data from a library checkout |
| `npm run sync:check` | Fail if committed data differs from the library checkout |
| `npm run typecheck` | TypeScript project build (no emit) |
| `npm run lint` | ESLint |
| `npm test` | Vitest: search, URL state, export fidelity, sync integrity, page behavior |
| `npm run build` | Type check, production build to `dist/`, route entry points |
| `npm run check` | All of the above, in order |

`sync:check` and `npm run check` look for the library at `../fedora-icons`
by default. Override with `--source <path>` or `FEDORA_ICONS_SOURCE`.

## What the site does

- **Catalog**: searches icon names, library paths, tags, and categories; filters
  by category; switches Regular, Solid (`filled`), Duocolor, Duotone, and
  Brands. Search, category, style, and selected icon are kept in the URL. The
  search field stays pinned while scrolling; `/` focuses it. The grid is one
  tab stop with arrow-key navigation.
- **Side pane**: always present on desktop and collapsible (the choice is
  remembered per browser). With no icon selected it is **Customize**: size,
  stroke width, and color (duo palettes for Duocolor/Duotone) applied to the
  whole grid and carried into exports. Selecting an icon shows its inspector:
  previews, style, modifiers, the same controls, exports, and React usage. On
  mobile both open as a modal bottom sheet (native `<dialog>`).
- **Size and stroke**: icons default to 48px (Auto stroke 1px). Size is a
  slider over what the grid previews (16–64px, 4px steps) plus a px field for
  any export size from 8 to 512. Stroke is **Auto** by default and
  follows size, in 24px grid units: 1.25px at 24px, 0.85px at 64px, linear
  between in 0.05px steps (so 48px is 1px) and held at 0.85px above 64px. Moving the slider (0.5–2.5px) fixes a
  value until "Use auto". Every authored stroke is scaled by the same factor,
  so intentionally heavier strokes keep their proportions.
  Solid and brand artwork have no stroke control. `@fedora-icons/react` cannot
  change stroke weight, and the React panel says so.
- **Icon sets**: Shift-click (or ⌘/Ctrl-click, or Shift+Enter) adds or removes
  icons from a set. The pane then applies one size, stroke, and color to the
  whole set and downloads it as a ZIP of SVGs or transparent PNGs (fflate,
  loaded only when a ZIP is built). Esc or ✕ clears the set.
- **Search tips**: the search field's ghost text rotates through these tricks
  while it is empty and unfocused.
- **Exports**: Figma-style export settings in the inspector. Each row is a
  scale (0.5x–4x; fixed at 1x for SVG, which is vector) and a format (PNG or
  SVG), with an optional file-name suffix under "…". "+" adds a row, "−"
  removes one, and the rows carry over between icons. Export downloads one
  file, or a ZIP when there are several. Copy works the same way: copy SVG
  code, a PNG image at a chosen scale, or the name. A React example is below.
  Exports resolve every CSS variable and `currentColor` to concrete colors
  and preserve masks, clip paths, IDs, and the Duotone 16% tint. PNGs are
  transparent. No XAML export exists: its target dialect is undefined.
- **Modifiers**: the inspector's Modifier section previews any of the
  library's modifiers on the selected core icon, in tabs by category, at any
  corner the modifier supports (`public/modifiers.json`, synced from
  `metadata/modifiers.json`, loaded on demand). File-type labels are offered
  only on file and folder icons, image-quality marks only on images. Previews
  are composed exactly as the library's `scripts/compose_svg.py` composes its
  presets (transparent clearance, cutout glyph, `--fedora-modifier` in duo
  styles), but the base is not refitted, so the badge may cover detail. They
  are labeled as previews, and downloads and copies include them. When a
  designed library version exists, the pane links to it.
- **Side pane sections** collapse and expand; the choice holds while you
  switch icons.
- **Brands**: the last option in the style switcher (`/?style=brands`; the old
  `/brands` URL redirects). The 32 approved third-party marks (social, Google,
  Microsoft) synced from the library's `brand-assets/`, shown unmodified in
  Regular; the Solid switch appears once a brand ships a Solid source.
- **Header**: Get started (the library on GitHub, new tab), Download (one ZIP
  of every core icon in every style, untouched library SVGs in `regular/`,
  `solid/`, `duocolor/`, `duotone/`, plus LICENSE and README, built in the
  browser from the pinned snapshot), Figma (the Figma file,
  new tab; `FIGMA_URL` in `src/lib/links.ts`), and Pricing. Phones get a menu.
- **Pricing** (`/pricing`): a placeholder. It names no plans or prices; it says
  pricing is coming and that the current set is free under the library license.
- **Code samples**: dark in both themes, with syntax colors (highlight.js
  core with TSX, HTML, CSS, and shell, loaded on demand). Shell samples are
  shown as a terminal.
- **Docs** (linked from the footer, with GitHub): SVG, React, Figma, colors, sizes, modifiers, accessibility,
  licensing, privacy (no cookies or tracking; the two local-storage
  preferences, named), and source revision. The footer links to Privacy. The side nav marks the section being read,
  and in-page links scroll smoothly (instantly with reduced motion).

## Layout

```
scripts/sync-icons.mjs    verified library -> data snapshot
scripts/postbuild.mjs     static route entry points + 404.html
public/icons/<style>.json one lazily fetched SVG map per style (generated)
src/data/*.json           catalog, palettes, UI glyphs, source lock (generated), brands (generated)
src/brand/                Fedora Icons mark (from Figma; see its README)
src/lib/                  svg export, search, URL state, look (customization), brands, React snippet, theme
src/components/           layout, grid, side pane + inspector, customize controls, UI primitives
src/pages/                Icons (core styles and Brands), Docs
tests/                    Vitest suites
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Nothing has been deployed.
