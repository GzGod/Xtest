import 'dotenv/config';

import { generateSharedFollowingData } from './generateSharedFollowingData.js';

async function main() {
  const shouldGenerate = String(process.env.GENERATE_SHARED_FOLLOWING || '').toLowerCase() === 'true';

  if (!shouldGenerate) {
    console.log('Skipping shared-following generation because GENERATE_SHARED_FOLLOWING is not true.');
    return;
  }

  if (!process.env.XAPI_API_KEY) {
    throw new Error('GENERATE_SHARED_FOLLOWING=true requires XAPI_API_KEY to be set.');
  }

  await generateSharedFollowingData();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
