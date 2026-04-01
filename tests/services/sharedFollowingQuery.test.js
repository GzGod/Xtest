import test from 'node:test';
import assert from 'node:assert/strict';

import { querySharedFollowingWithCache } from '../../services/sharedFollowingQuery.js';

test('shared-following query refreshes only stale selected accounts before computing results', async () => {
  const refreshedHandles = [];
  const repository = {
    async getAccountsByHandles(handles) {
      return handles.map((handle, index) => ({
        id: String(index + 1),
        handle,
        name: handle,
      }));
    },
    async getFollowingSyncStates(accountIds) {
      return new Map([
        [accountIds[0], { lastSyncedAt: '2026-03-20T00:00:00.000Z', syncStatus: 'success' }],
        [accountIds[1], { lastSyncedAt: '2026-04-01T00:00:00.000Z', syncStatus: 'success' }],
      ]);
    },
    async getSharedFollowingDatasetForSources(sourceHandles) {
      assert.deepEqual(sourceHandles.sort(), ['fresh-source', 'stale-source']);

      return {
        externalFollowingBySource: {
          'stale-source': ['candidate-a'],
          'fresh-source': ['candidate-a'],
        },
        candidateNodesById: {
          'candidate-a': {
            id: 'candidate-a',
            handle: 'candidate-a',
            name: 'Candidate A',
            group: 'media',
            bio: 'AI creator',
            followers: 12000,
            candidateType: 'creator',
            isLikelyCommercialKOL: true,
            qualityWeight: 1.3,
          },
        },
      };
    },
  };

  const result = await querySharedFollowingWithCache({
    repository,
    selectedHandles: ['stale-source', 'fresh-source'],
    mode: 'strict',
    minSharedCount: 1,
    limit: 20,
    staleAfterMs: 7 * 24 * 60 * 60 * 1000,
    now: new Date('2026-04-02T00:00:00.000Z'),
    refreshAccountFollowings: async (account) => {
      refreshedHandles.push(account.handle);
    },
  });

  assert.deepEqual(refreshedHandles, ['stale-source']);
  assert.deepEqual(result.candidates.map((item) => item.id), ['candidate-a']);
  assert.deepEqual(result.coverage.coveredHandles.sort(), ['fresh-source', 'stale-source']);
});

test('shared-following query returns partial coverage when some selected handles are unresolved', async () => {
  const repository = {
    async getAccountsByHandles(handles) {
      return handles
        .filter((handle) => handle !== 'missing-source')
        .map((handle, index) => ({
          id: String(index + 1),
          handle,
          name: handle,
        }));
    },
    async getFollowingSyncStates(accountIds) {
      return new Map(accountIds.map((accountId) => [accountId, {
        lastSyncedAt: '2026-04-01T00:00:00.000Z',
        syncStatus: 'success',
      }]));
    },
    async getSharedFollowingDatasetForSources(sourceHandles) {
      assert.deepEqual(sourceHandles, ['known-source']);

      return {
        externalFollowingBySource: {
          'known-source': ['candidate-a'],
        },
        candidateNodesById: {
          'candidate-a': {
            id: 'candidate-a',
            handle: 'candidate-a',
            name: 'Candidate A',
            group: 'media',
            bio: 'AI creator',
            followers: 12000,
            candidateType: 'creator',
            isLikelyCommercialKOL: true,
            qualityWeight: 1.3,
          },
        },
      };
    },
  };

  const result = await querySharedFollowingWithCache({
    repository,
    selectedHandles: ['known-source', 'missing-source'],
    mode: 'threshold',
    minSharedCount: 1,
    limit: 20,
    staleAfterMs: 7 * 24 * 60 * 60 * 1000,
    now: new Date('2026-04-02T00:00:00.000Z'),
    refreshAccountFollowings: async () => {},
  });

  assert.deepEqual(result.coverage.missingHandles, ['missing-source']);
  assert.deepEqual(result.coverage.coveredHandles, ['known-source']);
  assert.deepEqual(result.candidates.map((item) => item.id), ['candidate-a']);
});

test('shared-following query keeps unsynced accounts missing when refresh is unavailable', async () => {
  const repository = {
    async getAccountsByHandles(handles) {
      return handles.map((handle, index) => ({
        id: String(index + 1),
        handle,
        name: handle,
      }));
    },
    async getFollowingSyncStates() {
      return new Map();
    },
    async getSharedFollowingDatasetForSources(sourceHandles) {
      assert.deepEqual(sourceHandles, []);

      return {
        externalFollowingBySource: {},
        candidateNodesById: {},
      };
    },
  };

  const result = await querySharedFollowingWithCache({
    repository,
    selectedHandles: ['needs-sync'],
    mode: 'threshold',
    minSharedCount: 1,
    limit: 20,
    staleAfterMs: 7 * 24 * 60 * 60 * 1000,
    now: new Date('2026-04-02T00:00:00.000Z'),
  });

  assert.deepEqual(result.coverage.coveredHandles, []);
  assert.deepEqual(result.coverage.missingHandles, ['needs-sync']);
  assert.deepEqual(result.candidates, []);
});
