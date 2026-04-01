import 'dotenv/config';

import {
  getAllFollowingUsers,
  getUserByScreenName,
  normalizeXUser,
} from './xapiClient.js';

async function main() {
  console.log('=== Testing xapi profile lookup + following by user_id ===\n');

  const profile = await getUserByScreenName('sama');
  const normalizedProfile = normalizeXUser(profile);

  console.log('Profile:');
  console.log(JSON.stringify(normalizedProfile, null, 2));
  console.log('');

  const following = await getAllFollowingUsers(profile.rest_id, {
    pageSize: 10,
    maxPages: 1,
  });

  console.log(`Fetched ${following.length} accounts from twitter.following`);
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
