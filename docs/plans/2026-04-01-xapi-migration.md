# XAPI Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace RapidAPI-based X/Twitter data access with `xapi.to` and Railway-provided `XAPI_API_KEY`.

**Architecture:** Add a shared `scripts/xapiClient.js` module that shells out to `xapi-to`, parses JSON responses, and exposes normalized helpers for profile lookup and following traversal. Then update the existing crawler scripts and test utilities to depend on that module without changing the ranking pipeline.

**Tech Stack:** Node.js, built-in `node:test`, child processes, Vite/React project scripts

---

### Task 1: Add the failing test coverage for the shared xapi client

**Files:**
- Create: `tests/scripts/xapiClient.test.js`
- Modify: `package.json`

**Step 1: Write the failing test**

Create tests that assert:
- `callXapi()` throws when `XAPI_API_KEY` is missing.
- `callXapi()` passes JSON input through the executor and parses JSON output.
- `getAllFollowingUsers()` follows pagination cursors and aggregates users across pages.

**Step 2: Run test to verify it fails**

Run: `npm test -- --test tests/scripts/xapiClient.test.js`
Expected: FAIL because `scripts/xapiClient.js` does not exist yet.

**Step 3: Write minimal implementation**

Create `scripts/xapiClient.js` with executor injection so tests can stub command execution.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test tests/scripts/xapiClient.test.js`
Expected: PASS

### Task 2: Migrate crawler scripts to the shared client

**Files:**
- Create: `scripts/xapiClient.js`
- Modify: `scripts/fetchInfluencers.js`
- Modify: `scripts/fetchFullProfiles.js`
- Modify: `scripts/fetchAllLinks.js`

**Step 1: Write the failing test**

Extend `tests/scripts/xapiClient.test.js` if needed for new normalization behavior.

**Step 2: Run test to verify it fails**

Run: `npm test -- --test tests/scripts/xapiClient.test.js`
Expected: FAIL on the new expectation.

**Step 3: Write minimal implementation**

Replace RapidAPI env/header usage with:
- `getUserByScreenName()`
- `getAllFollowingUsers()`
- response normalization helpers for profile and following user objects

**Step 4: Run test to verify it passes**

Run: `npm test -- --test tests/scripts/xapiClient.test.js`
Expected: PASS

### Task 3: Update local docs and utility scripts

**Files:**
- Modify: `README.md`
- Modify: `scripts/testApi.js`
- Modify: `scripts/testApi2.js`
- Modify: `scripts/testApi3.js`
- Modify: `scripts/testApi4.js`

**Step 1: Write the failing test**

No additional automated test required for documentation-only edits.

**Step 2: Write minimal implementation**

Update configuration references from `RAPIDAPI_KEY/RAPIDAPI_HOST` to `XAPI_API_KEY` and switch test utilities to shared client helpers or direct `xapi` usage.

**Step 3: Run verification**

Run: `npm test -- --test tests/scripts/xapiClient.test.js`
Run: `npm run build`
Expected: PASS for both commands
