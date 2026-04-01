import { enUS } from '../locales/en-US.js';
import { zhCN } from '../locales/zh-CN.js';

export const DEFAULT_LOCALE = 'zh-CN';
export const ENGLISH_LOCALE = 'en-US';
export const LOCALE_STORAGE_KEY = 'ai-influencers-locale';
export const SUPPORTED_LOCALES = [DEFAULT_LOCALE, ENGLISH_LOCALE];

const dictionaries = {
  [DEFAULT_LOCALE]: zhCN,
  [ENGLISH_LOCALE]: enUS,
};

export function normalizeLocale(locale) {
  const value = String(locale || '').trim().toLowerCase();

  if (value.startsWith('en')) {
    return ENGLISH_LOCALE;
  }

  if (value.startsWith('zh')) {
    return DEFAULT_LOCALE;
  }

  return DEFAULT_LOCALE;
}

export function resolveInitialLocale(savedLocale, browserLocale) {
  if (savedLocale) {
    return normalizeLocale(savedLocale);
  }

  if (browserLocale && normalizeLocale(browserLocale) === ENGLISH_LOCALE) {
    return DEFAULT_LOCALE;
  }

  return DEFAULT_LOCALE;
}

function interpolate(template, params = {}) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return params[key] === undefined || params[key] === null ? '' : String(params[key]);
  });
}

export function createTranslator(locale = DEFAULT_LOCALE) {
  const normalizedLocale = normalizeLocale(locale);
  const activeDictionary = dictionaries[normalizedLocale] || dictionaries[DEFAULT_LOCALE];
  const fallbackDictionary = dictionaries[ENGLISH_LOCALE];

  return (key, params = {}) => {
    const value = activeDictionary[key] ?? fallbackDictionary[key] ?? key;

    if (typeof value === 'function') {
      return value(params);
    }

    return interpolate(value, params);
  };
}
