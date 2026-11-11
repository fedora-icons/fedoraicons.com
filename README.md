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

- **Catalog**: searches canonical names, aliases, tags, and categories; filters
  by category; switches Regular, Solid (`filled`), Duocolor, and Duotone. Search,
  category, style, and selected icon are kept in the URL. `/` focuses search;
  the grid is one tab stop with arrow-key navigation.
- **Inspector**: side panel on desktop, modal bottom sheet (native `<dialog>`)
  on mobile. Large and native 24px previews, size, color, duo palettes, and
  the modifier menu.
- **Exports**: Download SVG, Download PNG (1×/2×/4×, transparent), Copy SVG,
  Copy image, Copy name, and a React example. Exports resolve every CSS variable
  and `currentColor` to concrete colors and preserve masks, clip paths, IDs,
  and the Duotone 16% tint. No XAML export exists: its target dialect is undefined.
- **Modifiers**: only the library's authored compositions (manifest
  `composition` entries) are offered. No arbitrary combinations are generated.
- **Brands**: Regular/Solid only, gated by `src/data/brands.json`. It is empty
  until assets are approved, so the page shows a deliberate empty state.
- **Docs**: SVG, React, Figma, colors, sizes, modifiers, accessibility,
  licensing, and source revision.

## Layout

```
scripts/sync-icons.mjs    verified library -> data snapshot
scripts/postbuild.mjs     static route entry points + 404.html
public/icons/<style>.json one lazily fetched SVG map per style (generated)
src/data/*.json           catalog, palettes, UI glyphs, source lock (generated), brands (hand-edited)
src/brand/                Fedora Icons mark (from Figma; see its README)
src/lib/                  svg export, search, URL state, React snippet, theme
src/components/           layout, grid, inspector, UI primitives
src/pages/                Icons, Brands, Docs
tests/                    Vitest suites
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Nothing has been deployed.
