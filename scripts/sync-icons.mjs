#!/usr/bin/env node
/**
 * Synchronize website data from a checkout of fedora-icons/fedora-icons.
 *
 *   node scripts/sync-icons.mjs --source ../fedora-icons   # write
 *   node scripts/sync-icons.mjs --check                    # verify committed output
 *
 * The library is read-only. Every SVG is verified against the SHA-256 digest
 * recorded in its manifest before it is copied. Output is deterministic, so a
 * re-run with the same source revision produces byte-identical files.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK_PATH = join(ROOT, 'src/data/source-lock.json');

/** Regular icons the website chrome uses. They must exist in the library. */
export const UI_ICONS = [
  'search', 'x', 'download', 'copy', 'image', 'code', 'sun', 'moon', 'monitor',
  'check', 'info-circle', 'chevron-down', 'link', 'link-external', 'menu',
  'book-open', 'palette', 'arrow-left', 'filter', 'x-circle',
];

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const json = (value) => JSON.stringify(value, null, 2) + '\n';

function parseArgs(argv) {
  const args = { check: false, source: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--check') args.check = true;
    else if (argv[i] === '--source') args.source = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function git(source, ...args) {
  try {
    return execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readVerified(source, file, digest) {
  const path = resolve(source, file);
  if (!path.startsWith(resolve(source) + sep)) throw new Error(`Path escapes library: ${file}`);
  const data = readFileSync(path);
  if (sha256(data) !== digest) throw new Error(`SHA-256 mismatch: ${file}`);
  return data.toString('utf8').trim();
}

/** Build every output file in memory. Returns { path: contents }. */
export function buildOutputs(source) {
  source = resolve(source);
  const manifestRaw = readFileSync(join(source, 'manifest.json'));
  const manifest = JSON.parse(manifestRaw);
  const modifiers = readJson(join(source, 'metadata/modifiers.json'));
  const colors = readJson(join(source, 'metadata/colors.json'));
  const { styles, icons } = manifest;

  if (!Array.isArray(styles) || styles.length === 0) throw new Error('Manifest has no styles');
  if (manifest.iconCount !== icons.length) {
    throw new Error(`Manifest iconCount ${manifest.iconCount} != ${icons.length} entries`);
  }
  const names = new Set();
  for (const icon of icons) {
    if (names.has(icon.name)) throw new Error(`Duplicate icon: ${icon.name}`);
    names.add(icon.name);
    for (const style of styles) {
      if (!icon.files?.[style]) throw new Error(`${icon.name} is missing ${style}`);
    }
  }

  const sorted = [...icons].sort((a, b) => a.name.localeCompare(b.name));
  const outputs = {};
  const snapshotDigests = {};

  for (const style of styles) {
    const map = {};
    for (const icon of sorted) {
      map[icon.name] = readVerified(source, icon.files[style], icon.sha256[style]);
    }
    const body = JSON.stringify(map);
    snapshotDigests[style] = sha256(body);
    outputs[`public/icons/${style}.json`] = body;
  }

  // Normalize the two composition shapes found in the manifest into a list.
  const compositionOf = (icon) => {
    const c = icon.composition;
    if (!c) return undefined;
    const mods = Array.isArray(c.modifiers)
      ? c.modifiers.map((m) => ({ name: m.name, position: m.position }))
      : [{ name: c.modifier, position: c.position }];
    return { base: c.base, modifiers: mods };
  };

  const categoryCounts = new Map();
  const catalogIcons = sorted.map((icon) => {
    categoryCounts.set(icon.category, (categoryCounts.get(icon.category) ?? 0) + 1);
    const entry = {
      name: icon.name,
      category: icon.category,
      tags: [...new Set(icon.tags.map((t) => t.toLowerCase()))].filter((t) => t !== icon.name),
      aliases: icon.aliases,
    };
    const composition = compositionOf(icon);
    if (composition) {
      if (!names.has(composition.base)) throw new Error(`${icon.name}: unknown base ${composition.base}`);
      entry.composition = composition;
    }
    return entry;
  });

  const modifierLabels = Object.fromEntries(
    modifiers.modifiers.map((m) => [m.name, { label: m.label, group: m.group }]),
  );
  for (const icon of catalogIcons) {
    for (const m of icon.composition?.modifiers ?? []) {
      if (!modifierLabels[m.name]) throw new Error(`${icon.name}: unknown modifier ${m.name}`);
    }
  }

  const revision = git(source, 'rev-parse', 'HEAD');
  const dirty = revision ? git(source, 'status', '--porcelain', '--', 'icons', 'manifest.json', 'metadata') !== '' : null;
  const lock = {
    repository: 'fedora-icons/fedora-icons',
    revision,
    dirty,
    manifestSha256: sha256(manifestRaw),
    snapshotSha256: snapshotDigests,
  };

  outputs['src/data/catalog.json'] = json({
    license: manifest.license,
    grid: manifest.grid,
    strokeWidth: manifest.regularStrokeWidth,
    styles,
    categories: [...categoryCounts].map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    modifiers: modifierLabels,
    icons: catalogIcons,
  });
  outputs['src/data/palettes.json'] = json({
    defaultPalette: colors.defaultPalette,
    palettes: colors.palettes.map(({ name, light, dark }) => ({ name, light, dark })),
  });
  outputs['src/data/ui-icons.json'] = json(Object.fromEntries(UI_ICONS.map((name) => {
    const icon = icons.find((i) => i.name === name);
    if (!icon) throw new Error(`UI icon missing from library: ${name}`);
    return [name, readVerified(source, icon.files.regular, icon.sha256.regular)];
  })));
  outputs['public/licenses/fedora-icons-LICENSE.txt'] = readFileSync(join(source, 'LICENSE'), 'utf8');
  outputs['src/data/source-lock.json'] = json(lock);
  return outputs;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = args.source ?? process.env.FEDORA_ICONS_SOURCE ?? join(ROOT, '../fedora-icons');
  if (!existsSync(join(source, 'manifest.json'))) {
    throw new Error(`No fedora-icons checkout at ${source}. Pass --source <path>.`);
  }
  const outputs = buildOutputs(source);
  if (args.check) {
    const stale = Object.entries(outputs).filter(([path, body]) => {
      const full = join(ROOT, path);
      return !existsSync(full) || readFileSync(full, 'utf8') !== body;
    });
    if (stale.length) {
      console.error('Synchronized data is out of date:\n  ' + stale.map(([p]) => p).join('\n  '));
      console.error('Run: npm run sync -- --source <path-to-fedora-icons>');
      process.exit(1);
    }
    console.log(`Synchronized data matches ${relative(ROOT, resolve(source)) || source}.`);
    return;
  }
  for (const [path, body] of Object.entries(outputs)) {
    const full = join(ROOT, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  const lock = readJson(LOCK_PATH);
  const catalog = readJson(join(ROOT, 'src/data/catalog.json'));
  console.log(`Synced ${catalog.icons.length} icons x ${catalog.styles.length} styles from ` +
    `${lock.repository}@${lock.revision?.slice(0, 7) ?? 'unknown'}${lock.dirty ? ' (with local changes)' : ''}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
