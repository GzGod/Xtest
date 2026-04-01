# Sidebar UI Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the mobile left sidebar into a more polished dark ranked-list surface while keeping the current product structure and interactions.

**Architecture:** Add a small sidebar appearance helper for the shared-following toggle states so the visual system is testable, then refactor the left sidebar markup in `App.tsx` to use richer card styling, improved hierarchy, and consistent spacing. Keep graph behavior and right-side surfaces unchanged.

**Tech Stack:** React 18, TypeScript/JS mix, Vite, Tailwind CDN utility classes, built-in `node:test`

---

### Task 1: Add a failing test for shared toggle appearance

**Files:**
- Create: `tests/services/sidebarAppearance.test.js`
- Create: `services/sidebarAppearance.js`

**Step 1: Write the failing test**

Add assertions that:

- default and selected states share the same size classes
- default state uses `plus`
- selected state uses `check`
- selected state includes the gold-accented button styling

**Step 2: Run test to verify it fails**

Run: `npm test -- --test tests/services/sidebarAppearance.test.js`
Expected: FAIL because `services/sidebarAppearance.js` does not exist yet.

**Step 3: Write minimal implementation**

Create a small helper returning appearance tokens for the shared-following toggle state.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test tests/services/sidebarAppearance.test.js`
Expected: PASS

### Task 2: Refactor sidebar visual states into appearance helpers

**Files:**
- Modify: `services/sidebarAppearance.js`
- Modify: `App.tsx`

**Step 1: Extend tests if needed**

Add one more assertion for neutral state classes if the helper contract changes.

**Step 2: Run test to verify it fails**

Run: `npm test -- --test tests/services/sidebarAppearance.test.js`
Expected: FAIL on the new expectation.

**Step 3: Write minimal implementation**

Return helper data for:

- shared toggle geometry and icon
- shared toggle button class strings
- sidebar row selected/default class strings

Use those helpers in `App.tsx`.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test tests/services/sidebarAppearance.test.js`
Expected: PASS

### Task 3: Restyle the left sidebar shell, header, search, and list rows

**Files:**
- Modify: `App.tsx`

**Step 1: Write the failing test**

If a helper contract changes, add the assertion first. Otherwise proceed using the already-failing helper cycle from Task 1 and Task 2.

**Step 2: Run test to verify it still passes before refactor**

Run: `npm test -- --test tests/services/sidebarAppearance.test.js`
Expected: PASS

**Step 3: Write minimal implementation**

Update the left sidebar only:

- add layered background treatment
- upgrade the header hierarchy
- refine the search field
- turn list rows into compact card entries
- move follower count into a cleaner metric presentation
- ensure row spacing feels balanced on mobile

**Step 4: Run test to verify helper-backed behavior still passes**

Run: `npm test -- --test tests/services/sidebarAppearance.test.js`
Expected: PASS

### Task 4: Polish the collapse button and footer row

**Files:**
- Modify: `App.tsx`

**Step 1: Write the failing test**

No extra automated test required if helper behavior is unchanged.

**Step 2: Write minimal implementation**

Style the sidebar collapse button and creator footer so they match the new sidebar visual language.

**Step 3: Verify**

Run: `npm test -- --test tests/services/sidebarAppearance.test.js`
Expected: PASS

### Task 5: Final verification

**Files:**
- Verify: `App.tsx`
- Verify: `services/sidebarAppearance.js`
- Verify: `tests/services/sidebarAppearance.test.js`

**Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS

**Step 2: Run the production build**

Run: `npm run build:railway`
Expected: PASS

**Step 3: Manual verification**

Check:

- sidebar feels visually richer on mobile
- list rows have better spacing and hierarchy
- plus and check controls are identical in size and alignment
- selected state uses the dark-gold treatment
- the sidebar toggle visually matches the refreshed shell

**Step 4: Commit**

```bash
git add App.tsx services/sidebarAppearance.js tests/services/sidebarAppearance.test.js docs/plans
git commit -m "feat: polish mobile sidebar ui"
```
