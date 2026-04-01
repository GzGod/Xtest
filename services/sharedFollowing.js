const DEFAULT_MODE = 'threshold';
const DEFAULT_MIN_SHARED_COUNT = 1;

function clampPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getFollowerBandWeight(followers = 0) {
  if (followers >= 5000 && followers <= 250000) return 1.2;
  if (followers >= 1000 && followers < 5000) return 1.05;
  if (followers > 250000 && followers <= 1000000) return 0.95;
  if (followers > 1000000) return 0.8;
  return 0.9;
}

function getCandidateQualityWeight(candidate = {}) {
  const explicitWeight = Number(candidate.qualityWeight);

  if (Number.isFinite(explicitWeight) && explicitWeight > 0) {
    return explicitWeight;
  }

  let weight = 1;
  const text = `${candidate.bio || ''} ${candidate.role || ''}`.toLowerCase();
  const type = `${candidate.candidateType || ''}`.toLowerCase();

  if (candidate.isLikelyCommercialKOL) {
    weight += 0.25;
  }

  if (['creator', 'media', 'newsletter', 'educator', 'operator'].includes(type)) {
    weight += 0.2;
  }

  if (['company', 'brand', 'institution', 'lab'].includes(type)) {
    weight -= 0.45;
  }

  if (text.includes('official') || text.includes('company') || text.includes('research lab')) {
    weight -= 0.25;
  }

  return Math.max(0.2, weight * getFollowerBandWeight(candidate.followers || 0));
}

function getRequiredSharedCount({ selectedCount, mode, minSharedCount }) {
  if (selectedCount <= 0) return 0;
  if (mode === 'strict') return selectedCount;
  return Math.min(selectedCount, clampPositiveInt(minSharedCount, DEFAULT_MIN_SHARED_COUNT));
}

export function computeSharedCandidates({
  selectedSourceIds,
  externalFollowingBySource,
  candidateNodesById,
  mode = DEFAULT_MODE,
  minSharedCount = DEFAULT_MIN_SHARED_COUNT,
}) {
  const normalizedSelectedIds = Array.from(new Set((selectedSourceIds || []).filter(Boolean)));

  if (normalizedSelectedIds.length === 0) {
    return [];
  }

  const countsByCandidateId = new Map();

  for (const sourceId of normalizedSelectedIds) {
    const candidateIds = Array.from(new Set(externalFollowingBySource?.[sourceId] || []));

    for (const candidateId of candidateIds) {
      const candidate = candidateNodesById?.[candidateId];

      if (!candidate) {
        continue;
      }

      if (!countsByCandidateId.has(candidateId)) {
        countsByCandidateId.set(candidateId, []);
      }

      countsByCandidateId.get(candidateId).push(sourceId);
    }
  }

  const requiredSharedCount = getRequiredSharedCount({
    selectedCount: normalizedSelectedIds.length,
    mode,
    minSharedCount,
  });

  return Array.from(countsByCandidateId.entries())
    .map(([candidateId, followedBySelectedIds]) => {
      const candidate = candidateNodesById[candidateId];
      const sharedFollowerCount = followedBySelectedIds.length;
      const qualityWeight = getCandidateQualityWeight(candidate);
      const candidateScore = Number((sharedFollowerCount * qualityWeight).toFixed(4));

      return {
        ...candidate,
        followedBySelectedIds,
        sharedFollowerCount,
        qualityWeight,
        candidateScore,
      };
    })
    .filter((candidate) => candidate.sharedFollowerCount >= requiredSharedCount)
    .sort((left, right) => {
      if (right.candidateScore !== left.candidateScore) {
        return right.candidateScore - left.candidateScore;
      }

      if (right.sharedFollowerCount !== left.sharedFollowerCount) {
        return right.sharedFollowerCount - left.sharedFollowerCount;
      }

      if ((right.followers || 0) !== (left.followers || 0)) {
        return (right.followers || 0) - (left.followers || 0);
      }

      return String(left.handle || left.id).localeCompare(String(right.handle || right.id));
    });
}

export function mergeSharedCandidatesIntoGraph({ baseData, candidates }) {
  const baseNodes = [...(baseData?.nodes || [])];
  const baseLinks = [...(baseData?.links || [])];
  const existingNodeIds = new Set(baseNodes.map((node) => node.id));
  const dedupedCandidates = [];

  for (const candidate of candidates || []) {
    if (!candidate?.id || existingNodeIds.has(candidate.id)) {
      continue;
    }

    existingNodeIds.add(candidate.id);
    dedupedCandidates.push({
      ...candidate,
      isExternalCandidate: true,
    });
  }

  const candidateLinks = [];

  for (const candidate of dedupedCandidates) {
    for (const sourceId of candidate.followedBySelectedIds || []) {
      candidateLinks.push({
        source: sourceId,
        target: candidate.id,
        value: candidate.sharedFollowerCount || 1,
      });
    }
  }

  return {
    nodes: [...baseNodes, ...dedupedCandidates],
    links: [...baseLinks, ...candidateLinks],
  };
}
