import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { DEFAULT_LOCALE, localeConfig, localizePath, type LocaleConfig } from './config';
import en from './messages/en';
import { createTranslator, type Messages, type Translator } from './translate';

export { DEFAULT_LOCALE, LOCALES, localeConfig, localizePath, splitLocale } from './config';

/** Every message key, from the English source. */
export type MessageKey = keyof typeof en;
/** A translation: any subset of the English keys (the rest fall back to English). */
export type Translation = Partial<Record<MessageKey, Messages[string]>>;

export interface I18n extends Translator<MessageKey> {
  config: LocaleConfig;
  dir: 'ltr' | 'rtl';
  /** A site path in the current language ("/docs" -> "/fr/docs"). */
  path: (to: string) => string;
  /** Text from outside the app (category names, style labels) with an optional translation. */
  label: (kind: 'category' | 'style' | 'modifier', id: string, fallback: string) => string;
}

export function createI18n(locale: string, messages: Translation = {}): I18n {
  const config = localeConfig(locale);
  const translator = createTranslator<MessageKey>(config.code, locale === DEFAULT_LOCALE ? {} : messages, en);
  const dynamic = messages as Record<string, Messages[string] | undefined>;
  return {
    ...translator,
    config,
    dir: config.dir,
    path: (to) => localizePath(to, config.code),
    label: (kind, id, fallback) => {
      const value = dynamic[`${kind}.${id}`];
      return typeof value === 'string' ? value : fallback;
    },
  };
}

const ENGLISH = createI18n(DEFAULT_LOCALE);
const I18nContext = createContext<I18n>(ENGLISH);

export function I18nProvider({ locale, messages, children }: { locale: string; messages?: Translation; children: ReactNode }) {
  const value = useMemo(() => createI18n(locale, messages), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** The current language's translator, formatters, and path helper. English outside a provider. */
export function useI18n(): I18n {
  return useContext(I18nContext);
}

/** react-router Link that stays in the current language. */
export function LocalLink({ to, ...props }: Omit<LinkProps, 'to'> & { to: string }) {
  const { path } = useI18n();
  return <Link to={path(to)} {...props} />;
}

const loaders = import.meta.glob<{ default: Translation }>(['./messages/*.ts', '!./messages/en.ts']);

/** Load a language's messages (English is built in). Unknown languages get English. */
export async function loadMessages(locale: string): Promise<Translation> {
  if (locale === DEFAULT_LOCALE) return {};
  const load = loaders[`./messages/${locale}.ts`];
  return load ? (await load()).default : {};
}
