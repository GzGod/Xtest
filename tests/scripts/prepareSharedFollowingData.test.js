import test from 'node:test';
import assert from 'node:assert/strict';

import { prepareRailwayBuildData } from '../../scripts/prepareSharedFollowingData.js';

test('prepareRailwayBuildData refreshes Top300 before generating shared-following when both flags are enabled', async () => {
  const calls = [];

  await prepareRailwayBuildData({
    env: {
      REFRESH_TOP300_ON_BUILD: 'true',
      GENERATE_SHARED_FOLLOWING: 'true',
      XAPI_API_KEY: 'test-key',
    },
    runTop300Sync: async (options) => {
      calls.push({ type: 'top300', options });
    },
    generateSharedFollowingData: async (options) => {
      calls.push({ type: 'shared', options });
    },
    logger: {
      log() {},
    },
  });

  assert.deepEqual(calls, [
    { type: 'top300', options: { liveRefresh: true } },
    { type: 'shared', options: { continueOnSourceError: true } },
  ]);
});

test('prepareRailwayBuildData skips optional steps when build flags are disabled', async () => {
  const calls = [];

  await prepareRailwayBuildData({
    env: {},
    runTop300Sync: async () => {
      calls.push('top300');
    },
    generateSharedFollowingData: async () => {
      calls.push('shared');
    },
    logger: {
      log() {},
    },
  });

  assert.deepEqual(calls, []);
});

test('prepareRailwayBuildData requires XAPI_API_KEY when Top300 refresh is requested', async () => {
  await assert.rejects(
    () => prepareRailwayBuildData({
      env: {
        REFRESH_TOP300_ON_BUILD: 'true',
      },
      runTop300Sync: async () => {},
      generateSharedFollowingData: async () => {},
      logger: {
        log() {},
      },
    }),
    /XAPI_API_KEY/
  );
});
