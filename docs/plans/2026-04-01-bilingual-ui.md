# Bilingual UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Chinese-default bilingual UI with an English toggle and persistent locale selection.

**Architecture:** A lightweight in-repo localization layer will provide translations from dedicated locale files, with `localStorage` persistence and a small translator helper. `App.tsx` and `Graph3D.tsx` will consume translated labels, while dynamic X account content remains unchanged.

**Tech Stack:** React 18, TypeScript/JS mix, Vite, built-in `node:test`

---

### Task 1: Add locale helper tests

**Files:**
- Create: `tests/services/i18n.test.js`
- Create: `services/i18n.js`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator, resolveInitialLocale } from '../../services/i18n.js';

test('resolveInitialLocale defaults to zh-CN', () => {
  assert.equal(resolveInitialLocale(null), 'zh-CN');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test tests/services/i18n.test.js`
Expected: FAIL because `services/i18n.js` does not exist yet.

**Step 3: Write minimal implementation**

Implement locale normalization, persistence resolution, and translation lookup with fallback.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test tests/services/i18n.test.js`
Expected: PASS

### Task 2: Add locale dictionaries

**Files:**
- Create: `locales/zh-CN.js`
- Create: `locales/en-US.js`
- Modify: `services/i18n.js`

**Step 1: Write the failing test**

Add an assertion that `createTranslator('zh-CN')('app.title')` returns Chinese and that missing zh keys fall back to English.

**Step 2: Run test to verify it fails**

Run: `npm test -- --test tests/services/i18n.test.js`
Expected: FAIL on missing dictionary keys.

**Step 3: Write minimal implementation**

Create locale maps covering the current UI copy.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test tests/services/i18n.test.js`
Expected: PASS

### Task 3: Wire App UI text to locale service

**Files:**
- Modify: `App.tsx`
- Modify: `README.md`

**Step 1: Write the failing test**

Add a helper-level test if needed for interpolation or locale persistence logic.

**Step 2: Run test to verify it fails**

Run: `npm test -- --test tests/services/i18n.test.js`
Expected: FAIL on the new behavior expectation if added.

**Step 3: Write minimal implementation**

In `App.tsx`:

- add locale state
- restore saved locale from `localStorage`
- persist locale on change
- replace hardcoded UI labels with `t(...)`
- add the language toggle with Chinese default

**Step 4: Run test to verify it passes**

Run: `npm test -- --test tests/services/i18n.test.js`
Expected: PASS

### Task 4: Wire Graph3D controls to locale service

**Files:**
- Modify: `components/Graph3D.tsx`
- Modify: `App.tsx`

**Step 1: Write the failing test**

If needed, add a small helper assertion for translated graph-control labels.

**Step 2: Run test to verify it fails**

Run: `npm test -- --test tests/services/i18n.test.js`
Expected: FAIL if the helper contract changes.

**Step 3: Write minimal implementation**

Pass translated control labels into `Graph3D` and remove remaining hardcoded English UI copy from the graph controls.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test tests/services/i18n.test.js`
Expected: PASS

### Task 5: Final verification

**Files:**
- Verify: `App.tsx`
- Verify: `components/Graph3D.tsx`
- Verify: `services/i18n.js`
- Verify: `locales/zh-CN.js`
- Verify: `locales/en-US.js`

**Step 1: Run automated tests**

Run: `npm test`
Expected: PASS

**Step 2: Run production build**

Run: `npm run build:railway`
Expected: PASS

**Step 3: Manual verification**

Check:

- default locale is Chinese
- toggle switches to English
- refresh preserves chosen locale
- sidebar, modal, shared-following panel, and graph tooltips all switch language

**Step 4: Commit**

```bash
git add App.tsx components/Graph3D.tsx services/i18n.js locales tests README.md docs/plans
git commit -m "feat: add bilingual chinese english ui"
```
