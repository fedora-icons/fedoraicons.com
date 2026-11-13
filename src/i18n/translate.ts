import { Fragment, createElement, type ReactNode } from 'react';

/**
 * A message is plain text with {placeholders}, or a set of plural forms
 * chosen by the `count` variable using the language's own plural rules
 * (Intl.PluralRules: zero, one, two, few, many, other).
 *
 *   'grid.count': { one: '{count} icon', other: '{count} icons' }
 *
 * Rich messages wrap parts in tags the caller renders, so translators can
 * move links and emphasis within the sentence:
 *
 *   'docs.license': 'Icons are under the <link>MIT License</link>.'
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type MessageValue = string | PluralForms;
export type Messages = Record<string, MessageValue>;
export type Vars = Record<string, string | number>;
export type TagRenderers = Record<string, (children: ReactNode) => ReactNode>;

export interface Translator<K extends string = string> {
  locale: string;
  /** Translate a key, falling back to English, then to the key itself. */
  t: (key: K, vars?: Vars) => string;
  /** Translate a key whose text contains <tag>…</tag> parts rendered by `tags`. */
  rich: (key: K, tags: TagRenderers, vars?: Vars) => ReactNode;
  /** Whether this locale (not the fallback) has its own text for a key. */
  has: (key: K) => boolean;
  /** Format a number for this locale. */
  n: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Join items as a list for this locale ("a, b, and c"). */
  list: (items: string[], type?: Intl.ListFormatType) => string;
}

export function createTranslator<K extends string>(locale: string, messages: Partial<Record<K, MessageValue>>, fallback: Record<K, MessageValue>): Translator<K> {
  const plural = new Intl.PluralRules(locale);
  const numbers = new Intl.NumberFormat(locale);
  const lookup = (key: K): MessageValue | undefined => messages[key] ?? fallback[key];

  const fill = (template: string, vars?: Vars) => (vars
    ? template.replace(/\{(\w+)\}/g, (whole, name: string) => {
      const value = vars[name];
      if (value === undefined) return whole;
      return typeof value === 'number' ? numbers.format(value) : value;
    })
    : template);

  const t = (key: K, vars?: Vars): string => {
    const value = lookup(key);
    if (value === undefined) return key;
    if (typeof value === 'string') return fill(value, vars);
    const count = Number(vars?.count ?? 0);
    const form = count === 0 && value.zero !== undefined ? 'zero' : plural.select(count);
    return fill(value[form] ?? value.other, vars);
  };

  const rich = (key: K, tags: TagRenderers, vars?: Vars): ReactNode => {
    const text = t(key, vars);
    const parts: ReactNode[] = [];
    const pattern = /<(\w+)>(.*?)<\/\1>/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      if (match.index > last) parts.push(text.slice(last, match.index));
      const render = tags[match[1]];
      parts.push(createElement(Fragment, { key: parts.length }, render ? render(match[2]) : match[2]));
      last = pattern.lastIndex;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts.length === 1 ? parts[0] : createElement(Fragment, null, ...parts);
  };

  return {
    locale,
    t,
    rich,
    has: (key) => messages[key] !== undefined,
    n: (value, options) => (options ? new Intl.NumberFormat(locale, options) : numbers).format(value),
    list: (items, type = 'conjunction') => new Intl.ListFormat(locale, { type }).format(items),
  };
}
