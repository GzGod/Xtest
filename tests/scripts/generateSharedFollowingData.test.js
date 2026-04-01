import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSharedFollowingDataset,
  classifyCandidateProfile,
} from '../../scripts/generateSharedFollowingData.js';

test('buildSharedFollowingDataset excludes top300 ids and deduplicates candidates across sources', () => {
  const result = buildSharedFollowingDataset({
    topNodes: [
      { id: 'alpha', handle: 'alpha', name: 'Alpha' },
      { id: 'beta', handle: 'beta', name: 'Beta' },
    ],
    followingsBySource: {
      alpha: [
        {
          id: 'alpha',
          screen_name: 'alpha',
          name: 'Alpha',
          description: 'Top node itself',
          followers_count: 10000,
        },
        {
          id: 'c1',
          screen_name: 'creator1',
          name: 'Creator 1',
          description: 'AI creator with a newsletter',
          followers_count: 12000,
        },
      ],
      beta: [
        {
          id: 'c1',
          screen_name: 'creator1',
          name: 'Creator 1',
          description: 'AI creator with a newsletter',
          followers_count: 12000,
        },
        {
          id: 'c2',
          screen_name: 'brand2',
          name: 'Brand 2',
          description: 'Official AI company account',
          followers_count: 90000,
        },
      ],
    },
  });

  assert.deepEqual(result.externalFollowingBySource.alpha, ['creator1']);
  assert.deepEqual(result.externalFollowingBySource.beta, ['creator1', 'brand2']);
  assert.equal(result.candidateNodesById.alpha, undefined);
  assert.equal(Object.keys(result.candidateNodesById).length, 2);
});

test('classifyCandidateProfile identifies likely commercial creators over official brands', () => {
  const creator = classifyCandidateProfile({
    name: 'Creator',
    description: 'AI creator writing a weekly newsletter and tutorials',
    followers_count: 18000,
  });
  const brand = classifyCandidateProfile({
    name: 'Brand',
    description: 'Official company account for our AI platform',
    followers_count: 180000,
  });

  assert.equal(creator.candidateType, 'creator');
  assert.equal(creator.isLikelyCommercialKOL, true);
  assert.equal(brand.candidateType, 'company');
  assert.equal(brand.isLikelyCommercialKOL, false);
});
