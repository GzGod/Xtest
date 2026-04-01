# Database-Backed Shared Following Design

## Goal

Replace the current static shared-following dataset flow with a database-backed architecture that:

- updates the Top300 snapshot on a weekly schedule
- stores Top300 members and graph links in PostgreSQL
- caches following edges per source account in PostgreSQL
- refreshes following data only when the selected accounts are stale
- computes shared-following candidates from the database at query time

This keeps API usage under control while making the product more reliable than the current build-time static file workflow.

## Constraints

- Deployment target is Railway
- Database is Railway PostgreSQL
- Top300 refresh frequency is once per week
- Following cache refresh should happen on demand only when a selected source account is older than 7 days
- We should reuse as much of the existing X data pipeline as possible

## Chosen Approach

Use a single Railway web/API service plus a Railway PostgreSQL database.

The web service will handle:

- serving the Vite frontend
- read APIs for Top300 and shared-following queries
- admin and cron-triggered sync routes
- database schema initialization

The database becomes the source of truth for:

- current and historical Top300 snapshots
- Top300 graph links per snapshot
- account profiles
- cached following edges
- following sync timestamps and errors

## Data Model

### `accounts`

Stores canonical account records for both Top300 members and discovered candidate accounts.

Important fields:

- `id`
- `handle`
- `name`
- `group_name`
- `role`
- `associated`
- `bio`
- `followers`
- `following`
- `image_url`
- `website`
- `location`
- `joined_date`
- `verified`
- `candidate_type`
- `is_likely_commercial_kol`
- `quality_weight`
- `x_user_id`

### `top300_snapshots`

Represents each weekly Top300 publication.

Important fields:

- `id`
- `generated_at`
- `last_updated_label`
- `node_count`
- `link_count`
- `is_current`

### `top300_snapshot_members`

Stores membership and rank for each snapshot.

Important fields:

- `snapshot_id`
- `account_id`
- `rank`
- `score`

### `top300_snapshot_links`

Stores the graph edges for a snapshot.

Important fields:

- `snapshot_id`
- `source_account_id`
- `target_account_id`
- `value`

### `following_edges`

Stores source-to-target following relationships for cached source accounts.

Important fields:

- `source_account_id`
- `target_account_id`
- `first_seen_at`
- `last_seen_at`
- `is_active`

### `following_sync_state`

Tracks cache freshness and sync errors per source account.

Important fields:

- `account_id`
- `last_synced_at`
- `sync_status`
- `error_message`
- `updated_at`

## Sync Strategy

### Weekly Top300 Sync

Once per week:

1. run the existing Top300 generation pipeline
2. parse the resulting `constants.ts`
3. upsert member accounts
4. create a new `top300_snapshots` row
5. insert snapshot members and snapshot links
6. mark it as the current snapshot

This preserves weekly history while letting the frontend read the latest Top300 from the database.

### On-Demand Following Refresh

When the user queries shared-following:

1. resolve selected handles to accounts from the current snapshot
2. check `following_sync_state`
3. refresh only the selected source accounts older than 7 days
4. write refreshed followings into `following_edges`
5. update `following_sync_state`
6. compute candidates from the database

### Diffing Behavior

When refreshing a source account:

- newly seen targets are inserted as active edges
- existing edges are updated with fresh `last_seen_at`
- targets no longer followed are marked `is_active = false`

This lets us answer “current shared following” while also preserving first/last seen timestamps for future analytics.

## API Shape

### `GET /api/top300`

Returns the current Top300 snapshot:

- `lastUpdated`
- `generatedAt`
- `nodes`
- `links`

If the database has no snapshot yet, the API should fall back to the checked-in `constants.ts` data.

### `POST /api/shared-following/query`

Input:

- `selectedHandles`
- `mode`
- `minSharedCount`
- `limit`

Behavior:

- refresh stale selected sources older than 7 days
- compute shared-following from active database edges
- exclude current Top300 members from candidate output
- return coverage metadata so the UI can distinguish true empty results from missing source coverage

### `POST /api/admin/sync-top300`

Protected admin endpoint for Railway cron or manual maintenance.

Behavior:

- optionally run the live Top300 pipeline
- import the latest snapshot into PostgreSQL
- return snapshot metadata

## Frontend Changes

### Top300 Loading

The app should request `/api/top300` on load and use that as the primary source.

Fallback behavior:

- if the API fails, use the checked-in `INITIAL_DATA` and `LAST_UPDATED`

### Shared-Following Query

The shared-following panel should stop reading `sharedFollowingData.ts` as its main source.

Instead it should:

- send the selected handles and query options to `/api/shared-following/query`
- render returned candidates
- render coverage warnings when some selected accounts are stale, missing, or not synced yet

## Testing Strategy

Tests should focus on the orchestration layer rather than on a live database:

- stale source detection
- refreshing only stale selected accounts
- shared-following query behavior with partial source coverage
- snapshot parsing and fallback logic where useful

Verification should include:

- `npm test`
- `npm run build:railway`

