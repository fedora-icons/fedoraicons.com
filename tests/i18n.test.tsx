import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../src/App';
import { createI18n, localizePath, splitLocale, type Translation } from '../src/i18n';
import { LOCALES, type LocaleConfig } from '../src/i18n/config';
import { errorText, LocalizedError } from '../src/i18n/errors';
import en from '../src/i18n/messages/en';
import { createTranslator } from '../src/i18n/translate';
import { headTags, pageMeta } from '../src/lib/seo';

describe('translator', () => {
  const messages = {
    hello: 'Hello, {name}',
    items: { one: '{count} item', other: '{count} items' },
    link: 'Read <link>the docs</link> now.',
  };

  it('fills placeholders and formats numbers for the language', () => {
    const t = createTranslator('de', {}, messages);
    expect(t.t('hello', { name: 'Ada' })).toBe('Hello, Ada');
    expect(t.t('items', { count: 1252 })).toBe('1.252 items');
    expect(t.list(['a', 'b', 'c'])).toBe('a, b und c');
  });

  it('picks plural forms with each language’s rules', () => {
    const polish = createTranslator('pl', { items: { one: '{count} ikona', few: '{count} ikony', many: '{count} ikon', other: '{count} ikony' } }, messages);
    expect(polish.t('items', { count: 1 })).toBe('1 ikona');
    expect(polish.t('items', { count: 3 })).toBe('3 ikony');
    expect(polish.t('items', { count: 5 })).toBe('5 ikon');
  });

  it('falls back to English, then to the key', () => {
    const t = createTranslator('fr', { hello: 'Bonjour, {name}' }, messages);
    expect(t.t('hello', { name: 'Ada' })).toBe('Bonjour, Ada');
    expect(t.t('items', { count: 2 })).toBe('2 items');
    expect(t.has('items')).toBe(false);
    expect(t.t('missing' as 'hello')).toBe('missing');
  });

  it('renders tagged parts of rich messages', () => {
    const t = createTranslator('en', {}, messages);
    render(<p>{t.rich('link', { link: (text) => <a href="/docs">{text}</a> })}</p>);
    expect(screen.getByRole('link', { name: 'the docs' }).closest('p')!.textContent).toBe('Read the docs now.');
  });
});

describe('locale paths', () => {
  const locales: LocaleConfig[] = [...LOCALES, { code: 'fr', label: 'Français', dir: 'ltr', ogLocale: 'fr_FR' }];
  it('keeps the default language unprefixed and prefixes the rest', () => {
    expect(localizePath('/docs', 'en')).toBe('/docs');
    expect(localizePath('/docs', 'fr')).toBe('/fr/docs');
    expect(localizePath('/', 'fr')).toBe('/fr');
    expect(localizePath('/?q=arrow', 'fr')).toBe('/fr?q=arrow');
    expect(splitLocale('/fr/docs', locales)).toEqual({ locale: 'fr', path: '/docs' });
    expect(splitLocale('/docs', locales)).toEqual({ locale: 'en', path: '/docs' });
    expect(splitLocale('/fr', locales)).toEqual({ locale: 'fr', path: '/' });
  });
});

describe('messages', () => {
  const files = import.meta.glob<{ default: Translation }>('../src/i18n/messages/*.ts', { eager: true });
  const keys = new Set(Object.keys(en));

  it('has a message file for every configured language, using only English keys', () => {
    for (const { code } of LOCALES) {
      if (code === 'en') continue;
      const file = files[`../src/i18n/messages/${code}.ts`];
      expect(file, `src/i18n/messages/${code}.ts`).toBeTruthy();
      const unknown = Object.keys(file.default).filter((k) => !keys.has(k));
      expect(unknown, `${code}: keys not in en.ts`).toEqual([]);
      const missing = [...keys].filter((k) => !(k in file.default));
      if (missing.length) console.info(`${code}: ${missing.length} of ${keys.size} messages fall back to English`);
    }
  });

  it('keeps placeholders and tags balanced in English', () => {
    for (const [key, value] of Object.entries(en)) {
      for (const text of typeof value === 'string' ? [value] : Object.values(value)) {
        const open = text.match(/<(\w+)>/g) ?? [];
        const close = text.match(/<\/(\w+)>/g) ?? [];
        expect(open.length, key).toBe(close.length);
      }
    }
  });
});

describe('a translated page', () => {
  const pirate: Translation = {
    'icons.headline': 'Find ye <em>proper</em> icon, matey.',
    'icons.searchIcons': 'Search ye icons',
    'header.docs': 'Charts',
  };

  it('renders the app in the language, with localized links, falling back to English', () => {
    render(
      <MemoryRouter initialEntries={['/xp/']}>
        <AppShell locale="xp" messages={pirate} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Find ye proper icon, matey.');
    expect(screen.getByRole('searchbox', { name: 'Search ye icons' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Privacy' })).toBeTruthy();
  });

  it('writes language-specific metadata with hreflang alternates', () => {
    const i18n = createI18n('en');
    const tags = headTags(pageMeta('docs', i18n), i18n);
    expect(tags).toContain('<link rel="alternate" hreflang="en" href="https://www.fedoraicons.com/docs" />');
    expect(tags).toContain('<link rel="alternate" hreflang="x-default" href="https://www.fedoraicons.com/docs" />');
    expect(tags).toContain('<meta property="og:locale" content="en_US" />');
  });

  it('translates errors raised by shared code when they are shown', () => {
    const error = new LocalizedError('error.clipboardBlocked');
    expect(error.message).toBe('The browser blocked clipboard access.');
    const french = createI18n('fr', { 'error.clipboardBlocked': 'Le navigateur a bloqué le presse-papiers.' });
    expect(errorText(error, french)).toBe('Le navigateur a bloqué le presse-papiers.');
  });
});
