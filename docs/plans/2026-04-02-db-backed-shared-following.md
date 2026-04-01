# Database-Backed Shared Following Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move Top300 and shared-following queries to a PostgreSQL-backed API with weekly Top300 sync and on-demand following refresh for stale selected accounts.

**Architecture:** A new repository layer will manage PostgreSQL schema and queries for snapshots, accounts, sync state, and following edges. The frontend will load Top300 data from `/api/top300` and query shared-following via `/api/shared-following/query`, while a sync module imports weekly Top300 snapshots and refreshes stale selected sources when needed.

**Tech Stack:** Node.js HTTP server, React 18, Vite, PostgreSQL (`pg`), built-in `node:test`, existing xapi-based fetch scripts

---

### Task 1: Add failing orchestration tests for database-backed shared-following queries

**Files:**
- Create: `tests/services/sharedFollowingQuery.test.js`
- Create: `services/sharedFollowingQuery.js`

**Step 1: Write the failing test**

Add tests that verify:

- stale selected accounts are refreshed before querying
- fresh accounts are not refreshed
- query coverage is based on synced source accounts only

**Step 2: Run test to verify it fails**

Run: `npm test -- --test tests/services/sharedFollowingQuery.test.js`
Expected: FAIL because `services/sharedFollowingQuery.js` does not exist yet.

**Step 3: Write minimal implementation**

Create a service that:

- resolves selected handles
- checks sync freshness
- calls a refresh callback only for stale sources
- computes results from repository-provided dataset rows

**Step 4: Run test to verify it passes**

Run: `npm test -- --test tests/services/sharedFollowingQuery.test.js`
Expected: PASS

### Task 2: Add PostgreSQL repository and schema initialization

**Files:**
- Create: `services/db.js`
- Create: `services/top300Repository.js`
- Modify: `package.json`

**Step 1: Write the failing test**

If a repository helper can be unit-tested without a live database, add the failing test first. Otherwise rely on the orchestration red-green cycle from Task 1 and verify by build plus runtime import checks.

**Step 2: Write minimal implementation**

Add:

- PostgreSQL pool creation from `DATABASE_URL`
- schema initialization with `CREATE TABLE IF NOT EXISTS`
- repository methods for accounts, snapshots, links, following edges, and sync state

**Step 3: Verify**

Run: `npm test -- --test tests/services/sharedFollowingQuery.test.js`
Expected: PASS

### Task 3: Add snapshot parsing and weekly Top300 import pipeline

**Files:**
- Create: `services/top300Snapshot.js`
- Create: `services/top300Sync.js`
- Create: `scripts/syncTop300ToDatabase.js`

**Step 1: Write the failing test**

Add a focused failing test for snapshot parsing or sync orchestration if feasible.

**Step 2: Run test to verify it fails**

Run: `npm test -- --test tests/services/sharedFollowingQuery.test.js`
Expected: FAIL only if the helper contract changed; otherwise proceed.

**Step 3: Write minimal implementation**

Implement:

- parsing `constants.ts`
- optional live refresh by running the existing Top300 scripts
- importing the parsed snapshot into PostgreSQL

**Step 4: Verify**

Run: `npm test`
Expected: PASS

### Task 4: Add API endpoints to the Node server

**Files:**
- Modify: `server.js`
- Modify: `services/sharedFollowingQuery.js`
- Modify: `services/top300Repository.js`

**Step 1: Write the failing test**

Add a service-layer failing test if the request orchestration contract changes.

**Step 2: Write minimal implementation**

Add:

- `GET /api/top300`
- `POST /api/shared-following/query`
- `POST /api/admin/sync-top300`

Include:

- JSON parsing
- admin token validation
- DB fallback behavior
- stale-source refresh orchestration

**Step 3: Verify**

Run: `npm test`
Expected: PASS

### Task 5: Wire the frontend to the API

**Files:**
- Modify: `App.tsx`
- Modify: `locales/en-US.js`
- Modify: `locales/zh-CN.js`

**Step 1: Write the failing test**

Add a small service/helper test first if new frontend orchestration helpers are introduced.

**Step 2: Write minimal implementation**

Update the app to:

- fetch `/api/top300` on load with fallback to the checked-in constants
- send shared-following queries to the backend
- render loading, error, and coverage states from API responses

**Step 3: Verify**

Run: `npm test`
Expected: PASS

### Task 6: Final verification

**Files:**
- Verify: `server.js`
- Verify: `services/db.js`
- Verify: `services/top300Repository.js`
- Verify: `services/sharedFollowingQuery.js`
- Verify: `services/top300Sync.js`
- Verify: `App.tsx`

**Step 1: Run automated tests**

Run: `npm test`
Expected: PASS

**Step 2: Run production build**

Run: `npm run build:railway`
Expected: PASS

**Step 3: Smoke-check runtime behavior**

Check:

- `/api/top300` returns current snapshot data or fallback constants
- shared-following query returns DB-backed candidates
- stale accounts are refreshed only when older than 7 days
- admin sync path can import a snapshot

**Step 4: Commit**

```bash
git add App.tsx server.js services scripts tests package.json package-lock.json docs/plans
git commit -m "feat: move shared-following to postgres-backed api"
```
