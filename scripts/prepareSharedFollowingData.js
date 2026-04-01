import 'dotenv/config';

import { generateSharedFollowingData } from './generateSharedFollowingData.js';
import { fileURLToPath } from 'node:url';
import { runTop300Sync } from '../services/top300Sync.js';

function isEnabled(value) {
  return String(value || '').toLowerCase() === 'true';
}

function ensureXapiKey(env, purpose) {
  if (!env.XAPI_API_KEY) {
    throw new Error(`${purpose} requires XAPI_API_KEY to be set.`);
  }
}

export async function prepareRailwayBuildData(options = {}) {
  const env = options.env || process.env;
  const logger = options.logger || console;
  const refreshTop300OnBuild = isEnabled(env.REFRESH_TOP300_ON_BUILD) || isEnabled(env.TOP300_LIVE_REFRESH);
  const generateSharedFollowingOnBuild = isEnabled(env.GENERATE_SHARED_FOLLOWING);
  const syncTop300 = options.runTop300Sync || runTop300Sync;
  const generateSharedFollowing = options.generateSharedFollowingData || generateSharedFollowingData;

  if (!refreshTop300OnBuild && !generateSharedFollowingOnBuild) {
    logger.log('Skipping Railway prebuild data preparation because no prebuild flags are enabled.');
    return;
  }

  if (refreshTop300OnBuild) {
    ensureXapiKey(env, 'REFRESH_TOP300_ON_BUILD=true');
    logger.log('Refreshing Top300 snapshot before build...');
    await syncTop300({ liveRefresh: true });
  }

  if (generateSharedFollowingOnBuild) {
    ensureXapiKey(env, 'GENERATE_SHARED_FOLLOWING=true');
    await generateSharedFollowing({
      continueOnSourceError: true,
    });
    return;
  }

  logger.log('Skipping shared-following generation because GENERATE_SHARED_FOLLOWING is not true.');
}

async function main() {
  await prepareRailwayBuildData();
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
