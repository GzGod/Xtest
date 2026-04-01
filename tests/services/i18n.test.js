import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createTranslator,
  normalizeLocale,
  resolveInitialLocale,
} from '../../services/i18n.js';

test('resolveInitialLocale defaults to zh-CN when there is no saved locale', () => {
  assert.equal(resolveInitialLocale(null), 'zh-CN');
});

test('normalizeLocale maps loose english and chinese values to supported locales', () => {
  assert.equal(normalizeLocale('en'), 'en-US');
  assert.equal(normalizeLocale('en-GB'), 'en-US');
  assert.equal(normalizeLocale('zh'), 'zh-CN');
  assert.equal(normalizeLocale('zh-Hans'), 'zh-CN');
});

test('resolveInitialLocale prefers a saved locale over the browser locale', () => {
  assert.equal(resolveInitialLocale('en-US', 'zh-CN'), 'en-US');
});

test('translator returns chinese copy by default', () => {
  const t = createTranslator('zh-CN');
  assert.equal(t('app.title'), 'X 上 AI 影响力图谱');
});

test('translator falls back to english when a chinese key is missing', () => {
  const t = createTranslator('zh-CN');
  assert.equal(t('test.onlyEnglishKey'), 'English fallback works');
});
