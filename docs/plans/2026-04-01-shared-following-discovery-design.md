# Shared Following Discovery Design

## Goal

Extend the current Top300 AI graph so users can select one or more core nodes and dynamically discover external accounts that those selected nodes commonly follow. The feature is optimized for surfacing hidden KOL candidates outside the main Top300, not for promoting more founder, company, or lab accounts.

## Problem

The current product is good at showing the core AI network, but it is biased toward already-prominent insiders:

- ranking is driven by `log10(followers) x seed_connections`
- graph data only preserves Top300 nodes plus Top300-to-Top300 links
- the UI supports only single-node inspection

That means users can see who is central, but not who sits just outside the core network and is repeatedly followed by those insiders. Those outside nodes are exactly where content creators, educators, niche operators, and commercially useful KOLs are more likely to appear.

## Chosen Approach

Use a hybrid offline candidate-pool design:

- keep the existing Top300 graph as the default core layer
- precompute, offline, a second-layer dataset of accounts followed by Top300 nodes but not included in Top300
- let the frontend compute strict intersections or threshold-based shared-following results locally
- dynamically add only the requested candidates to the graph when the user asks for them

This avoids slow runtime API calls, keeps `XAPI_API_KEY` on the data-generation side only, and preserves a fast frontend interaction model.

## Architecture

### 1. Core Graph Remains Unchanged

The current `constants.ts` remains the source of truth for:

- Top300 nodes
- Top300 internal links
- rank ordering and default graph rendering

This keeps the current product stable and ensures the new feature is additive, not a rewrite.

### 2. Add A Shared-Following Candidate Dataset

Generate a new offline data artifact with two parts:

- `candidateNodesById`
  Stores metadata for external candidate accounts:
  - `id`
  - `handle`
  - `name`
  - `bio`
  - `role`
  - `followers`
  - `imageUrl`
  - candidate classification fields such as `candidateType` and `isLikelyCommercialKOL`

- `externalFollowingBySource`
  Maps each Top300 node id to the list of candidate ids it follows outside the Top300 set.

This allows the browser to compute:

- one-to-many expansion for a single selected source
- strict intersections for multiple selected sources
- threshold intersections such as “followed by at least 2 of the 5 selected nodes”

### 3. Local Candidate Resolution In The Frontend

The frontend will:

- maintain a multi-select pool of Top300 node ids
- compute candidate intersections from `externalFollowingBySource`
- score and sort resulting candidates
- render the top N candidate nodes into the existing graph as a temporary outer layer

No server round-trip is required after the static data loads.

## Data Model

## New Node Flavor

Add a new node subtype for expanded candidates, for example:

- `isExternalCandidate: true`
- `sharedFollowerCount`
- `followedBySelectedIds`
- `candidateScore`

These nodes should be excluded from the permanent Top300 sidebar ranking and clearly marked in the detail panel.

## Candidate Filtering

External candidates must satisfy all of the following:

- not already in Top300
- followed by at least one selected core node
- pass the selected mode:
  - strict mode: followed by all selected nodes
  - threshold mode: followed by at least `minSharedCount` selected nodes

Optional offline filtering should down-rank or hide obvious non-target accounts:

- official company accounts
- product brand accounts
- lab or institution accounts
- strong founder / CEO / VC signals

Optional offline boosts should favor likely KOL traits:

- creator / educator / newsletter / media / operator language in bio
- personal account signals instead of institution signals
- moderate but meaningful follower counts

## Scoring

The runtime candidate score should be simple and explainable. Recommended formula:

`candidateScore = sharedFollowerCount * qualityWeight`

Where `qualityWeight` is derived offline from:

- bio classification
- likely personal-vs-brand heuristics
- follower banding
- possible future engagement metrics

The product should expose shared-following count directly so users understand why a candidate appears.

## UX Design

### Selection Model

Current single-click behavior already opens node detail. Keep that behavior.

Add a separate shared-following selection pool:

- in the left list item actions
- or in the node detail panel

Controls:

- `Add to Shared Following`
- `Remove from Shared Following`

This avoids overloading simple node click behavior.

### Action Trigger

When one or more Top300 nodes are in the selection pool:

- show a floating control block in the lower-right corner

Controls in that block:

- `Find Shared Following`
- strict mode toggle
- minimum shared count control
- expand top 10 / 20 / 50
- `Clear Selection`
- `Collapse Candidates`

### Result Presentation

After clicking `Find Shared Following`:

- compute candidates locally
- show them in a result panel or side panel section
- render the top N candidates into the graph

Each candidate row should show:

- handle and name
- followers
- short bio / role
- shared-following count
- exactly which selected nodes follow this candidate

### Visual Treatment

External candidates should look distinct from Top300 core nodes:

- separate color family
- outer ring / glow treatment
- optional “candidate” badge in the detail panel

Links from selected Top300 nodes to candidate nodes should be rendered, but candidate-to-candidate links should not be generated in this first version.

This keeps the graph readable and preserves the semantic difference between the permanent core graph and temporary discovery results.

## Data Flow

### Offline

1. Load Top300 node ids from `constants.ts`
2. For each Top300 node, fetch full following lists through xapi
3. Remove any followed account already in Top300
4. Normalize remaining accounts into candidate nodes
5. Save:
   - unique candidate metadata
   - per-source external following ids
6. Optionally add offline candidate classification and quality scoring

### Frontend Runtime

1. User adds one or more Top300 nodes to the selection pool
2. User clicks `Find Shared Following`
3. Frontend gathers the selected nodes’ external-following arrays
4. Frontend computes strict or threshold matches
5. Frontend sorts candidates by `candidateScore`, then by shared-following count, then followers
6. Frontend merges top candidates into temporary graph state
7. UI renders candidate list and candidate graph nodes

## Error Handling

- if shared-following data is missing, hide the feature and show a soft message instead of crashing
- if a selected source has no external-following data, treat it as an empty set
- if no candidate meets current rules, show a clear empty state with guidance to relax filters
- if candidate metadata is missing for an id, skip that candidate instead of failing the whole calculation

## Performance Notes

- keep default graph limited to Top300 plus internal links
- compute candidate matches only on user action, not on every render
- store external following ids as arrays or sets that are easy to intersect
- only add top N expanded candidates to the rendered graph
- memoize derived candidate results from selection state and filters

## Testing Strategy

### Data tests

- Top300 members never appear in the external candidate pool
- candidate metadata deduplicates correctly across multiple sources
- per-source external following maps preserve stable candidate ids

### Selector tests

- one selected node returns its external candidates
- strict mode returns only candidates followed by all selected nodes
- threshold mode returns candidates followed by at least the configured count
- changing the selection replaces results instead of accumulating stale nodes

### UI tests

- adding and removing nodes from the shared-following pool updates the lower-right action block
- `Find Shared Following` adds only candidate nodes and candidate links
- `Collapse Candidates` removes temporary candidate nodes from the graph
- candidate nodes render with distinct visual treatment and do not enter the Top300 ranking list

## Out Of Scope For V1

- real-time API lookups at click time
- candidate-to-candidate relationship graphing
- engagement-based scoring from recent tweets
- CRM/export workflows
- automated sponsorship-price estimation

## Summary

The new feature keeps the existing Top300 graph as the stable core and adds a dynamic discovery layer for “commonly followed outsiders.” This creates a practical way to surface commercially useful KOL candidates without bloating the main graph or exposing API credentials at runtime.
