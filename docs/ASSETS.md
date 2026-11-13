# Asset synchronization

The website consumes `fedora-icons/fedora-icons` as read-only input.
`scripts/sync-icons.mjs` produces every generated data file. Do not edit them by hand.

## Update the icons

```sh
git -C ../fedora-icons pull          # or check out the revision you want
pnpm run sync --source ../fedora-icons
pnpm test
git diff --stat src/data public/icons
```

Commit the regenerated files together with `src/data/source-lock.json`.

## What the sync does

1. Reads `manifest.json`, `metadata/modifiers.json`, `metadata/colors.json`, and `LICENSE`.
2. Checks that `iconCount` matches the entries, that names are unique, and
   that every icon has every style.
3. Verifies each SVG against the manifest's SHA-256 digest. A mismatch aborts
   the sync without writing anything.
4. Validates every composition's base icon and modifiers.
5. Writes deterministic output (sorted, stable JSON):

| File | Contents |
| --- | --- |
| `public/icons/<style>.json` | `{ name: svg }` per style, fetched on demand |
| `src/data/catalog.json` | names, categories + counts, tags, aliases, compositions, modifier labels |
| `src/data/palettes.json` | the twelve Light/Dark duo palettes |
| `src/data/ui-icons.json` | Regular glyphs the site chrome uses (`UI_ICONS` in the script) |
| `public/licenses/fedora-icons-LICENSE.txt` | the library's MIT license |
| `src/data/source-lock.json` | repository, git revision, whether the checkout had local changes, manifest and snapshot SHA-256 |

`pnpm run sync:check` regenerates in memory and fails if anything differs from
the committed files. CI runs it against the revision recorded in the lock.

Counts, categories, and names in the UI always come from these files. Nothing
is hard-coded.

## Brands

Brand marks come from the library's `brand-assets/`, not from this repo. The
library records each mark's owner, official source, SHA-256 digest, retrieval
date, and shared rights notes in `brand-assets/manifest.json`; see its
`BRANDS.md`. `pnpm run sync` verifies every digest, copies each SVG unmodified to
`public/brands/<name>-regular.svg`, and generates `src/data/brands.json`. Do not
edit either by hand.

To add or change a brand, update `brand-assets/` in the library (an approver
must first confirm the owner's official source and redistribution terms), then
re-sync. Names come from the file path (`social/x.svg` is `x`; product marks
are prefixed with their owner, e.g. `google-chrome`), with overrides and
search aliases in `BRAND_META` in `scripts/sync-icons.mjs`.

The website namespaces each mark's IDs when it loads them, so marks that share
gradient or clip-path IDs can sit on one page; the downloaded files are the
library files as provided. Figma reference drawings (for example `figma`,
`framer`, `youtube`) are **not** approved for distribution and must not be
added.

Brands never get Duocolor or Duotone styles, and they are not part of the MIT
core or the React and Vue packages. A Solid style appears only once a brand
ships a Solid source.
