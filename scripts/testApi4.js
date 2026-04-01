import 'dotenv/config';

import { callXapi } from './xapiClient.js';

async function main() {
  console.log('=== Testing raw xapi responses ===\n');

  const profile = await callXapi('twitter.user_by_screen_name', {
    screen_name: 'OpenAI',
  });
  console.log('Profile response:');
  console.log(JSON.stringify(profile, null, 2).slice(0, 2000));
  console.log('\n---\n');

  const following = await callXapi('twitter.following', {
    user_id: profile.data.rest_id,
    count: 5,
  });
  console.log('Following response:');
  console.log(JSON.stringify(following, null, 2).slice(0, 2000));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
