import { computeSharedCandidates } from './sharedFollowing.js';

const DEFAULT_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeHandle(value) {
  return String(value || '').trim().toLowerCase();
}

export function isFollowingSyncStale(syncState, options = {}) {
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const now = options.now instanceof Date ? options.now : new Date();

  if (!syncState?.lastSyncedAt || syncState.syncStatus !== 'success') {
    return true;
  }

  const lastSyncedAt = new Date(syncState.lastSyncedAt);

  if (Number.isNaN(lastSyncedAt.getTime())) {
    return true;
  }

  return now.getTime() - lastSyncedAt.getTime() > staleAfterMs;
}

export async function querySharedFollowingWithCache({
  repository,
  selectedHandles,
  mode,
  minSharedCount,
  limit,
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
  now = new Date(),
  refreshAccountFollowings,
}) {
  const normalizedSelectedHandles = Array.from(
    new Set((selectedHandles || []).map(normalizeHandle).filter(Boolean))
  );

  if (normalizedSelectedHandles.length === 0) {
    return {
      selectedHandles: [],
      coverage: {
        coveredHandles: [],
        missingHandles: [],
      },
      candidates: [],
      refreshedHandles: [],
    };
  }

  const resolvedAccounts = await repository.getAccountsByHandles(normalizedSelectedHandles);
  const resolvedByHandle = new Map(
    (resolvedAccounts || []).map((account) => [normalizeHandle(account.handle), account])
  );
  const missingHandles = normalizedSelectedHandles.filter((handle) => !resolvedByHandle.has(handle));
  const resolvedSelectedAccounts = normalizedSelectedHandles
    .map((handle) => resolvedByHandle.get(handle))
    .filter(Boolean);

  const syncStates = await repository.getFollowingSyncStates(
    resolvedSelectedAccounts.map((account) => account.id)
  );
  const refreshedHandles = [];
  const refreshErrors = [];
  const coveredHandles = [];
  const missingResolvedHandles = [];

  for (const account of resolvedSelectedAccounts) {
    const syncState = syncStates?.get(account.id);
    const hadSuccessfulSync = Boolean(syncState?.lastSyncedAt) && syncState?.syncStatus === 'success';
    let hasCoveredData = hadSuccessfulSync;

    if (typeof refreshAccountFollowings === 'function') {
      if (!isFollowingSyncStale(syncState, { staleAfterMs, now })) {
        coveredHandles.push(normalizeHandle(account.handle));
        continue;
      }

      try {
        await refreshAccountFollowings(account);
        refreshedHandles.push(account.handle);
        hasCoveredData = true;
      } catch (error) {
        refreshErrors.push({
          handle: normalizeHandle(account.handle),
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (hasCoveredData) {
      coveredHandles.push(normalizeHandle(account.handle));
      continue;
    }

    missingResolvedHandles.push(normalizeHandle(account.handle));
  }

  const dataset = await repository.getSharedFollowingDatasetForSources(
    coveredHandles
  );
  const candidates = computeSharedCandidates({
    selectedSourceIds: coveredHandles,
    externalFollowingBySource: dataset?.externalFollowingBySource || {},
    candidateNodesById: dataset?.candidateNodesById || {},
    mode,
    minSharedCount,
  }).slice(0, Math.max(Number(limit) || 0, 0) || undefined);

  return {
    selectedHandles: normalizedSelectedHandles,
    coverage: {
      coveredHandles,
      missingHandles: [...missingHandles, ...missingResolvedHandles],
    },
    candidates,
    refreshedHandles,
    refreshErrors,
  };
}
