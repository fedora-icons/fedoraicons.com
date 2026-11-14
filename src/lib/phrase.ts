import { CORNERS, type Corner } from './modifiers';

/**
 * Reads searches like "clock with sparkle", "chat + plus", "edit clock", or
 * "file with pdf bottom left" as an icon search plus a modifier (and an
 * optional corner), so the page can open that icon with the modifier on.
 *
 * With a connector ("with", "w/", "+") the modifier comes after it. Without
 * one ("edit clock", "clock edit"), the first or last words are tried as the
 * modifier, but only when the whole search finds no icon: real library icons
 * win, so "check user" still finds `user-check` and "clock plus" `clock-plus`.
 */

export interface ModifierPhrase {
  /** The icon part, for the ordinary search ("clock"). */
  iconQuery: string;
  /** The modifier's library name ("sparkle"). */
  modifier: string;
  /** A corner the user named, else null (the modifier's default applies). */
  corner: Corner | null;
}

/** The fields of a library modifier the parser reads. */
export interface NamedModifier {
  name: string;
  label: string;
}

/** Everyday words for modifiers, beyond their names and labels. */
const SYNONYMS: Record<string, string> = {
  plus: 'add', new: 'add', create: 'add',
  minus: 'remove', subtract: 'remove',
  x: 'delete', cross: 'delete', trash: 'delete', bin: 'delete', close: 'delete', cancel: 'delete',
  tick: 'check', checkmark: 'check', done: 'check', ok: 'check', success: 'check', approved: 'check',
  star: 'sparkle', sparkles: 'sparkle', magic: 'sparkle', shine: 'sparkle', spark: 'sparkle',
  pencil: 'edit', pen: 'edit', write: 'edit', rename: 'edit',
  padlock: 'lock', locked: 'lock', secure: 'lock', private: 'lock',
  alert: 'warning', exclamation: 'warning', error: 'warning', caution: 'warning',
  help: 'question', 'question mark': 'question', unknown: 'question',
  sync: 'refresh', reload: 'refresh', update: 'refresh', repeat: 'refresh',
  find: 'search', magnifier: 'search', 'magnifying glass': 'search', zoom: 'search',
  person: 'user', account: 'user', profile: 'user', people: 'user',
  security: 'shield', protect: 'shield', protected: 'shield',
  ban: 'block', blocked: 'block', forbidden: 'block', disabled: 'block',
  duplicate: 'copy', clone: 'copy',
  hashtag: 'hash', number: 'hash', pound: 'hash',
  attachment: 'clip', paperclip: 'clip', attach: 'clip',
  password: 'key',
  share: 'upload', export: 'upload', import: 'download', save: 'download',
  'up arrow': 'arrow-up', 'down arrow': 'arrow-down', 'left arrow': 'arrow-left', 'right arrow': 'arrow-right',
  up: 'arrow-up', down: 'arrow-down', left: 'arrow-left', right: 'arrow-right',
  javascript: 'js', typescript: 'ts', markdown: 'md', excel: 'xls', word: 'doc', powerpoint: 'ppt',
  photoshop: 'psd', figma: 'fig', jpeg: 'jpg', text: 'txt',
};

const CONNECTOR = /\s+(?:with|w\/)\s+|\s*\+\s*/;
const CORNER_WORDS = /(?:^|\s)(?:(?:at|in|on)\s+)?(?:the\s+)?(top|upper|bottom|lower)[\s-]?(left|right)(?:\s+corner)?(?=\s|$)/;
const FILLER = /^(?:an?|the|some)\s+|\s+(?:modifier|badge|icon|symbol|sign)$/g;

const clean = (value: string) => value.replace(FILLER, '').replace(FILLER, '').trim();

/** Look up a modifier by name, label, synonym, or a simple plural. */
export function resolveModifier(words: string, modifiers: NamedModifier[]): string | null {
  const w = clean(words.toLowerCase().replace(/\s+/g, ' ').trim());
  if (!w) return null;
  const byKey = new Map<string, string>();
  for (const m of modifiers) {
    byKey.set(m.name, m.name);
    byKey.set(m.name.replace(/-/g, ' '), m.name);
    byKey.set(m.label.toLowerCase(), m.name);
  }
  const known = (key: string) => byKey.get(key) ?? (SYNONYMS[key] && byKey.has(SYNONYMS[key]) ? SYNONYMS[key] : null);
  return known(w) ?? (w.endsWith('s') ? known(w.slice(0, -1)) : null);
}

/**
 * Parse an "icon with modifier" search, or null when it isn't one.
 * `countIcons` is the ordinary search's result count, used for phrases
 * without a connector; without it, only connector phrases are read.
 */
export function parseModifierPhrase(
  query: string,
  modifiers: NamedModifier[],
  countIcons?: (query: string) => number,
): ModifierPhrase | null {
  let q = query.toLowerCase().replace(/\s+/g, ' ').trim();
  const connected = CONNECTOR.test(q);
  if (!connected && (!countIcons || countIcons(q) > 0)) return null;

  let corner: Corner | null = null;
  const placed = q.match(CORNER_WORDS);
  if (placed) {
    const vertical = placed[1] === 'upper' ? 'top' : placed[1] === 'lower' ? 'bottom' : placed[1];
    const candidate = `${vertical}-${placed[2]}` as Corner;
    if (CORNERS.includes(candidate)) corner = candidate;
    q = (q.slice(0, placed.index) + q.slice(placed.index! + placed[0].length)).replace(/\s+/g, ' ').trim();
  }

  if (!connected) return bareOrder(q, modifiers, countIcons!, corner);

  const parts = q.split(CONNECTOR);
  if (parts.length !== 2) return null;
  const iconQuery = clean(parts[0]);
  const modifier = resolveModifier(parts[1], modifiers);
  if (!iconQuery || !modifier) return null;
  return { iconQuery, modifier, corner };
}

/** "edit clock" or "clock edit": the modifier's words first or last, longest first. */
function bareOrder(q: string, modifiers: NamedModifier[], countIcons: (query: string) => number, corner: Corner | null): ModifierPhrase | null {
  const words = q.split(' ');
  for (const n of [2, 1]) {
    if (words.length <= n) continue;
    for (const [mod, rest] of [[words.slice(0, n), words.slice(n)], [words.slice(-n), words.slice(0, -n)]]) {
      const modifier = resolveModifier(mod.join(' '), modifiers);
      const iconQuery = clean(rest.join(' '));
      if (modifier && iconQuery && countIcons(iconQuery) > 0) return { iconQuery, modifier, corner };
    }
  }
  return null;
}

/** Whether a search has a connector ("with", "w/", "+"), so it may be a modifier phrase. */
export const hasConnector = (query: string) => CONNECTOR.test(query.toLowerCase().trim());
