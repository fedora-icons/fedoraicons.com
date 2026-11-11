# Asset synchronization

The website consumes `fedora-icons/fedora-icons` as read-only input.
`scripts/sync-icons.mjs` produces every generated data file. Do not edit them by hand.

## Update the icons

```sh
git -C ../fedora-icons pull          # or check out the revision you want
npm run sync -- --source ../fedora-icons
npm test
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

`npm run sync:check` regenerates in memory and fails if anything differs from
the committed files. CI runs it against the revision recorded in the lock.

Counts, categories, and names in the UI always come from these files. Nothing
is hard-coded.

## Brands

`src/data/brands.json` is hand-maintained and starts empty. Figma reference
drawings (for example `figma`, `framer`, `youtube`) are **not** approved for
distribution and must not be added.

To publish a brand icon, an approver must first confirm the owner's official
source and redistribution terms. Then:

1. Add the unmodified Regular (and Solid, if one exists) SVG under `public/brands/`.
2. Add an entry to `approved`:

```json
{
  "name": "example",
  "owner": "Example Inc.",
  "category": "Social",
  "officialSource": "https://example.com/brand",
  "retrieved": "2026-11-11",
  "terms": "https://example.com/brand/terms",
  "files": { "regular": "brands/example-regular.svg", "filled": "brands/example-filled.svg" }
}
```

Brands never get Duocolor or Duotone styles, and they are not part of the MIT core.
