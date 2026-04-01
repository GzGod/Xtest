# Shared Following Discovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a multi-select “Find Shared Following” workflow that dynamically expands external candidate accounts commonly followed by selected Top300 nodes.

**Architecture:** Keep `constants.ts` as the permanent Top300 core graph and add a second offline-generated dataset for external candidate nodes plus per-source external follow mappings. The frontend will maintain a separate shared-following selection pool, compute strict or threshold matches locally, and temporarily merge top candidate nodes into the rendered graph with distinct styling.

**Tech Stack:** React 18, TypeScript, Vite, Node.js scripts, xapi CLI, built-in `node:test`

---

### Task 1: Define the shared-following types and selector tests

**Files:**
- Modify: `types.ts`
- Create: `services/sharedFollowing.ts`
- Test: `tests/services/sharedFollowing.test.ts`

**Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSharedCandidates } from '../../services/sharedFollowing.js';

test('strict mode returns only candidates followed by every selected source', () => {
  const result = computeSharedCandidates({
    selectedSourceIds: ['a', 'b'],
    externalFollowingBySource: {
      a: ['c1', 'c2'],
      b: ['c2', 'c3']
    },
    candidateNodesById: {
      c1: { id: 'c1', name: 'One', group: 'media' },
      c2: { id: 'c2', name: 'Two', group: 'media' },
      c3: { id: 'c3', name: 'Three', group: 'media' }
    },
    mode: 'strict'
  });

  assert.deepEqual(result.map((item) => item.id), ['c2']);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test tests/services/sharedFollowing.test.ts`
Expected: FAIL because `services/sharedFollowing.ts` does not exist yet.

**Step 3: Write minimal implementation**

Create `services/sharedFollowing.ts` with:

- shared-following config types
- candidate result types
- `computeSharedCandidates()`
- stable sorting by score, shared count, then followers

**Step 4: Run test to verify it passes**

Run: `npm test -- --test tests/services/sharedFollowing.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add types.ts services/sharedFollowing.ts tests/services/sharedFollowing.test.ts
git commit -m "feat: add shared following selector logic"
```

### Task 2: Add offline data generation for external candidate pools

**Files:**
- Create: `scripts/generateSharedFollowingData.js`
- Modify: `scripts/xapiClient.js`
- Create: `sharedFollowingData.ts`
- Test: `tests/scripts/generateSharedFollowingData.test.js`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSharedFollowingDataset } from '../../scripts/generateSharedFollowingData.js';

test('buildSharedFollowingDataset excludes top300 ids from external candidates', () => {
  const result = buildSharedFollowingDataset({
    topNodeIds: new Set(['a']),
    followingsBySource: {
      a: [
        { screen_name: 'a', id: '1', name: 'Top Node' },
        { screen_name: 'c', id: '2', name: 'Candidate' }
      ]
    }
  });

  assert.deepEqual(result.externalFollowingBySource.a, ['c']);
  assert.equal(result.candidateNodesById.a, undefined);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test tests/scripts/generateSharedFollowingData.test.js`
Expected: FAIL because the generator does not exist yet.

**Step 3: Write minimal implementation**

Implement:

- `buildSharedFollowingDataset()`
- candidate normalization from xapi user objects
- Top300 exclusion
- deduplication across sources
- serialization to `sharedFollowingData.ts`

**Step 4: Run test to verify it passes**

Run: `npm test -- --test tests/scripts/generateSharedFollowingData.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/generateSharedFollowingData.js scripts/xapiClient.js sharedFollowingData.ts tests/scripts/generateSharedFollowingData.test.js
git commit -m "feat: generate shared following candidate dataset"
```

### Task 3: Add selection-pool UI state and lower-right action controls

**Files:**
- Modify: `App.tsx`
- Modify: `types.ts`
- Test: `tests/app/sharedFollowingUI.test.tsx`

**Step 1: Write the failing test**

```tsx
it('shows the find shared following control after adding a node to the selection pool', async () => {
  render(<App />);
  await user.click(screen.getByRole('button', { name: /add to shared following/i }));
  expect(screen.getByRole('button', { name: /find shared following/i })).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test tests/app/sharedFollowingUI.test.tsx`
Expected: FAIL because the selection-pool UI does not exist yet.

**Step 3: Write minimal implementation**

Add:

- `selectedSharedSourceIds`
- `sharedFollowingMode`
- `minSharedCount`
- `expandedCandidateLimit`
- lower-right floating controls
- add/remove shared-following buttons in node detail and list rows

**Step 4: Run test to verify it passes**

Run: `npm test -- --test tests/app/sharedFollowingUI.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add App.tsx types.ts tests/app/sharedFollowingUI.test.tsx
git commit -m "feat: add shared following selection controls"
```

### Task 4: Merge shared-following candidates into the rendered graph

**Files:**
- Modify: `App.tsx`
- Modify: `components/Graph3D.tsx`
- Modify: `types.ts`
- Test: `tests/app/sharedFollowingGraph.test.tsx`

**Step 1: Write the failing test**

```tsx
it('renders external candidate nodes separately from the top300 list after find shared following', async () => {
  render(<App />);
  // seed selection and trigger calculation
  expect(screen.getByText(/candidate/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test tests/app/sharedFollowingGraph.test.tsx`
Expected: FAIL because candidate graph merging and candidate styling do not exist yet.

**Step 3: Write minimal implementation**

Implement:

- runtime merge of temporary candidate nodes and links into displayed graph data
- candidate-only styling in `Graph3D`
- detail panel treatment for candidate nodes
- `Collapse Candidates` behavior
- exclusion of candidate nodes from the permanent Top300 sidebar ranking

**Step 4: Run test to verify it passes**

Run: `npm test -- --test tests/app/sharedFollowingGraph.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add App.tsx components/Graph3D.tsx types.ts tests/app/sharedFollowingGraph.test.tsx
git commit -m "feat: render shared following candidates in graph"
```

### Task 5: Add empty states, strict/threshold controls, and final verification

**Files:**
- Modify: `App.tsx`
- Modify: `README.md`
- Test: `tests/services/sharedFollowing.test.ts`
- Test: `tests/app/sharedFollowingUI.test.tsx`

**Step 1: Write the failing test**

```ts
test('threshold mode returns candidates followed by at least the configured minimum', () => {
  // expect ids followed by >= 2 selected sources
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test tests/services/sharedFollowing.test.ts`
Expected: FAIL on the new threshold assertion.

**Step 3: Write minimal implementation**

Finish:

- strict/threshold toggle wiring
- minimum shared count behavior
- empty-result messaging
- README notes for generating and shipping `sharedFollowingData.ts`

**Step 4: Run test to verify it passes**

Run: `npm test -- --test tests/services/sharedFollowing.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add App.tsx README.md tests/services/sharedFollowing.test.ts tests/app/sharedFollowingUI.test.tsx
git commit -m "feat: finalize shared following discovery flow"
```

### Task 6: End-to-end verification before feature completion

**Files:**
- Verify: `App.tsx`
- Verify: `components/Graph3D.tsx`
- Verify: `services/sharedFollowing.ts`
- Verify: `scripts/generateSharedFollowingData.js`
- Verify: `sharedFollowingData.ts`

**Step 1: Run the focused automated tests**

Run: `npm test -- --test tests/services/sharedFollowing.test.ts`
Run: `npm test -- --test tests/scripts/generateSharedFollowingData.test.js`
Run: `npm test -- --test tests/app/sharedFollowingUI.test.tsx`
Run: `npm test -- --test tests/app/sharedFollowingGraph.test.tsx`
Expected: PASS

**Step 2: Run the production build**

Run: `npm run build`
Expected: PASS

**Step 3: Manually verify the feature**

Check:

- add one Top300 node to the selection pool
- add multiple Top300 nodes to the selection pool
- run strict mode and threshold mode
- expand candidates
- collapse candidates
- confirm the Top300 sidebar list is unchanged

**Step 4: Commit**

```bash
git add README.md App.tsx components/Graph3D.tsx services/sharedFollowing.ts scripts/generateSharedFollowingData.js sharedFollowingData.ts tests
git commit -m "chore: verify shared following discovery feature"
```
