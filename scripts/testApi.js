import 'dotenv/config';

import { getUserByScreenName, normalizeXUser } from './xapiClient.js';

async function main() {
  console.log('=== Testing xapi user lookups ===\n');

  for (const screenName of ['elonmusk', 'sama', 'OpenAI']) {
    const profile = await getUserByScreenName(screenName);
    const normalized = normalizeXUser(profile);

    console.log(`@${screenName}`);
    console.log(JSON.stringify(normalized, null, 2));
    console.log('---\n');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
