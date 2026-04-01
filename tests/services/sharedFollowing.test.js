import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeSharedCandidates,
  mergeSharedCandidatesIntoGraph,
} from '../../services/sharedFollowing.js';

const candidateNodesById = {
  c1: {
    id: 'c1',
    handle: 'creator_one',
    name: 'Creator One',
    group: 'media',
    bio: 'AI creator and newsletter writer',
    followers: 18000,
    candidateType: 'creator',
    isLikelyCommercialKOL: true,
    qualityWeight: 1.4,
  },
  c2: {
    id: 'c2',
    handle: 'lab_account',
    name: 'Lab Account',
    group: 'company',
    bio: 'Official research lab account',
    followers: 120000,
    candidateType: 'company',
    isLikelyCommercialKOL: false,
    qualityWeight: 0.4,
  },
  c3: {
    id: 'c3',
    handle: 'ops_person',
    name: 'Ops Person',
    group: 'founder',
    bio: 'Operator sharing AI growth experiments',
    followers: 42000,
    candidateType: 'operator',
    isLikelyCommercialKOL: true,
    qualityWeight: 1.2,
  },
};

test('strict mode returns only candidates followed by every selected source', () => {
  const result = computeSharedCandidates({
    selectedSourceIds: ['a', 'b'],
    externalFollowingBySource: {
      a: ['c1', 'c2'],
      b: ['c2', 'c3'],
    },
    candidateNodesById,
    mode: 'strict',
  });

  assert.deepEqual(result.map((item) => item.id), ['c2']);
  assert.equal(result[0].sharedFollowerCount, 2);
  assert.deepEqual(result[0].followedBySelectedIds, ['a', 'b']);
});

test('threshold mode returns candidates followed by at least the configured minimum', () => {
  const result = computeSharedCandidates({
    selectedSourceIds: ['a', 'b', 'c'],
    externalFollowingBySource: {
      a: ['c1', 'c2'],
      b: ['c1', 'c3'],
      c: ['c1', 'c3'],
    },
    candidateNodesById,
    mode: 'threshold',
    minSharedCount: 2,
  });

  assert.deepEqual(result.map((item) => item.id), ['c1', 'c3']);
  assert.equal(result[0].sharedFollowerCount, 3);
  assert.equal(result[1].sharedFollowerCount, 2);
});

test('candidate ranking prefers stronger commercial candidates over weak institutional matches', () => {
  const result = computeSharedCandidates({
    selectedSourceIds: ['a', 'b'],
    externalFollowingBySource: {
      a: ['c1', 'c2'],
      b: ['c1', 'c2'],
    },
    candidateNodesById,
    mode: 'threshold',
    minSharedCount: 1,
  });

  assert.deepEqual(result.map((item) => item.id), ['c1', 'c2']);
  assert.ok(result[0].candidateScore > result[1].candidateScore);
});

test('mergeSharedCandidatesIntoGraph adds candidate nodes and links without polluting the core list', () => {
  const merged = mergeSharedCandidatesIntoGraph({
    baseData: {
      nodes: [
        { id: 'a', name: 'Alpha', group: 'founder', handle: 'alpha' },
        { id: 'b', name: 'Beta', group: 'researcher', handle: 'beta' },
      ],
      links: [{ source: 'a', target: 'b' }],
    },
    candidates: [
      {
        ...candidateNodesById.c1,
        followedBySelectedIds: ['a', 'b'],
        sharedFollowerCount: 2,
        candidateScore: 4.2,
      },
    ],
  });

  assert.equal(merged.nodes.length, 3);
  assert.equal(merged.links.length, 3);

  const candidateNode = merged.nodes.find((node) => node.id === 'c1');
  assert.equal(candidateNode.isExternalCandidate, true);
  assert.deepEqual(candidateNode.followedBySelectedIds, ['a', 'b']);

  const candidateLinks = merged.links.filter((link) => link.target === 'c1');
  assert.deepEqual(
    candidateLinks.map((link) => link.source).sort(),
    ['a', 'b']
  );
});
