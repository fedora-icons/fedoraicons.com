import type { IconEntry } from './catalog';

const normalize = (value: string) => value.toLowerCase().replace(/[_/]+/g, ' ').replace(/\s+/g, ' ').trim();

interface Indexed {
  icon: IconEntry;
  name: string;
  nameWords: string;
  aliases: string[];
  tags: string[];
  category: string;
}

export function createIndex(icons: IconEntry[]): Indexed[] {
  return icons.map((icon) => ({
    icon,
    name: icon.name,
    nameWords: icon.name.replace(/-/g, ' '),
    aliases: icon.aliases.map(normalize),
    tags: icon.tags.map(normalize),
    category: normalize(icon.category),
  }));
}

function scoreTerm(entry: Indexed, term: string): number {
  if (entry.name === term) return 100;
  if (entry.name.startsWith(term)) return 60;
  if (entry.nameWords.split(' ').includes(term)) return 50;
  if (entry.name.includes(term) || entry.nameWords.includes(term)) return 40;
  if (entry.aliases.some((a) => a === term || a.split(' ').includes(term))) return 30;
  if (entry.tags.some((t) => t === term)) return 25;
  if (entry.aliases.some((a) => a.includes(term))) return 20;
  if (entry.tags.some((t) => t.includes(term))) return 15;
  if (entry.category.includes(term)) return 10;
  return 0;
}

/**
 * Search canonical names, aliases, tags, and categories. Every term must
 * match somewhere; results are ranked by the strength of their matches,
 * then alphabetically.
 */
export function search(index: Indexed[], query: string, category?: string | null): IconEntry[] {
  const q = normalize(query);
  const pool = category ? index.filter((e) => e.icon.category === category) : index;
  if (!q) return pool.map((e) => e.icon);
  const whole = q.replace(/ /g, '-');
  const terms = q.split(' ');
  const scored: { icon: IconEntry; score: number }[] = [];
  for (const entry of pool) {
    let score = entry.name === whole ? 200 : 0;
    let matchedAll = true;
    for (const term of terms) {
      const s = scoreTerm(entry, term);
      if (!s) { matchedAll = false; break; }
      score += s;
    }
    if (matchedAll) scored.push({ icon: entry.icon, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.icon.name.localeCompare(b.icon.name))
    .map((s) => s.icon);
}
