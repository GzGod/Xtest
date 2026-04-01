import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { readTop300Snapshot } from './top300Snapshot.js';
import { importTop300Snapshot } from './top300Repository.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const TOP300_REFRESH_SCRIPTS = [
  'scripts/fetchInfluencers.js',
  'scripts/fetchFullProfiles.js',
  'scripts/applyOverrides.js',
  'scripts/fetchAllLinks.js',
];

async function runNodeScript(scriptRelativePath, options = {}) {
  const scriptPath = path.join(projectRoot, scriptRelativePath);
  await execFileAsync(process.execPath, [scriptPath], {
    cwd: projectRoot,
    env: {
      ...process.env,
      ...(options.env || {}),
    },
    maxBuffer: 20 * 1024 * 1024,
  });
}

export async function runTop300Sync(options = {}) {
  const liveRefresh = options.liveRefresh ?? false;

  if (liveRefresh) {
    for (const scriptPath of TOP300_REFRESH_SCRIPTS) {
      await runNodeScript(scriptPath, options);
    }
  }

  const snapshot = readTop300Snapshot(options.constantsPath);
  const importedSnapshot = await importTop300Snapshot(snapshot);

  return {
    ...importedSnapshot,
    liveRefresh,
  };
}
