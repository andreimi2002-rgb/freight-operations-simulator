// Locale entry point used by the pages. Adding a language means adding a
// JSON file next to en.json and registering it here; components do not change.
import en from './en.json';
import { makeT } from './translate.mjs';

const dictionaries = { en };

export const DEFAULT_LOCALE = 'en';

export function getI18n(locale = DEFAULT_LOCALE) {
  const dict = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
  return { t: makeT(dict), meta: dict._meta };
}
