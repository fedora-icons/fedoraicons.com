import en from './messages/en';
import { createTranslator, type Vars } from './translate';
import type { I18n, MessageKey } from './index';

const english = createTranslator<MessageKey>('en', {}, en);

/**
 * An error whose text is a message key, so shared code (export, ZIP, loaders)
 * can fail without knowing the language. `message` is English for logs;
 * show it with errorText(), which translates.
 */
export class LocalizedError extends Error {
  constructor(public key: MessageKey, public vars?: Vars) {
    super(english.t(key, vars));
    this.name = 'LocalizedError';
  }
}

/** User-facing text for a caught error, in the current language. */
export function errorText(error: unknown, i18n: Pick<I18n, 't'>, fallback: MessageKey = 'error.generic'): string {
  if (error instanceof LocalizedError) return i18n.t(error.key, error.vars);
  if (error instanceof Error && error.message) return error.message;
  return i18n.t(fallback);
}
