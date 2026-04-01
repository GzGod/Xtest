import 'dotenv/config';

import { runTop300Sync } from '../services/top300Sync.js';

async function main() {
  const liveRefresh = String(process.env.TOP300_LIVE_REFRESH || '').toLowerCase() === 'true';
  const result = await runTop300Sync({ liveRefresh });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
