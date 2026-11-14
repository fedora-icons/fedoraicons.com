import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasConnector, parseModifierPhrase, resolveModifier } from '../src/lib/phrase';

const modifiers = (JSON.parse(readFileSync(join(__dirname, '../public/modifiers.json'), 'utf8')) as { modifiers: { name: string; label: string }[] }).modifiers;
const parse = (q: string) => parseModifierPhrase(q, modifiers);

describe('modifier phrases', () => {
  it('reads "icon with modifier"', () => {
    expect(parse('clock with sparkle')).toEqual({ iconQuery: 'clock', modifier: 'sparkle', corner: null });
    expect(parse('Chat with plus')).toEqual({ iconQuery: 'chat', modifier: 'add', corner: null });
    expect(parse('a folder with a lock icon')).toEqual({ iconQuery: 'folder', modifier: 'lock', corner: null });
  });

  it('accepts "+" and "w/" as connectors', () => {
    expect(parse('user + check')?.modifier).toBe('check');
    expect(parse('user+check')?.modifier).toBe('check');
    expect(parse('calendar w/ x')?.modifier).toBe('delete');
  });

  it('reads a corner anywhere in the phrase', () => {
    expect(parse('file with pdf bottom left')).toEqual({ iconQuery: 'file', modifier: 'pdf', corner: 'bottom-left' });
    expect(parse('home with add in the upper right corner')?.corner).toBe('top-right');
    expect(parse('top-left home with add')).toEqual({ iconQuery: 'home', modifier: 'add', corner: 'top-left' });
  });

  it('resolves names, labels, synonyms, multi-word names and plurals', () => {
    expect(resolveModifier('arrow up', modifiers)).toBe('arrow-up');
    expect(resolveModifier('up arrow', modifiers)).toBe('arrow-up');
    expect(resolveModifier('PDF', modifiers)).toBe('pdf');
    expect(resolveModifier('trash', modifiers)).toBe('delete');
    expect(resolveModifier('sparkles', modifiers)).toBe('sparkle');
    expect(resolveModifier('locks', modifiers)).toBe('lock');
    expect(resolveModifier('banana', modifiers)).toBeNull();
  });

  it('reads "edit clock" and "clock edit" when no icon matches the whole search', () => {
    const icons = ['clock', 'user-check', 'folder-lock', 'book-open'];
    const count = (q: string) => icons.filter((n) => q.split(' ').every((w) => n.includes(w))).length;
    const bare = (q: string) => parseModifierPhrase(q, modifiers, count);
    expect(bare('edit clock')).toEqual({ iconQuery: 'clock', modifier: 'edit', corner: null });
    expect(bare('clock edit')).toEqual({ iconQuery: 'clock', modifier: 'edit', corner: null });
    expect(bare('up arrow clock')).toEqual({ iconQuery: 'clock', modifier: 'arrow-up', corner: null });
    expect(bare('sparkle clock top right')).toEqual({ iconQuery: 'clock', modifier: 'sparkle', corner: 'top-right' });
    // A real icon wins.
    expect(bare('check user')).toBeNull();
    expect(bare('lock folder')).toBeNull();
    // Nothing left to search, or nothing found for the rest.
    expect(bare('edit')).toBeNull();
    expect(bare('edit banana')).toBeNull();
    // Without a count, only connector phrases are read.
    expect(parse('edit clock')).toBeNull();
  });

  it('leaves ordinary searches alone', () => {
    expect(parse('clock plus')).toBeNull();
    expect(parse('clock with')).toBeNull();
    expect(parse('clock with banana')).toBeNull();
    expect(parse('with sparkle')).toBeNull();
    expect(hasConnector('edit clock')).toBe(false);
    expect(hasConnector('clock with s')).toBe(true);
  });
});
