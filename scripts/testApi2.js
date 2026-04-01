import 'dotenv/config';

import { getFollowingUsersByScreenName, normalizeXUser } from './xapiClient.js';

async function main() {
  console.log('=== Testing xapi following lookup ===\n');

  const following = await getFollowingUsersByScreenName('sama', {
    pageSize: 10,
    maxPages: 1,
  });

  console.log(`Fetched ${following.length} following accounts for @sama\n`);
  console.log(
    JSON.stringify(
      following.slice(0, 5).map((user) => normalizeXUser(user)),
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
