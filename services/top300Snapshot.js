import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_CONSTANTS_PATH = path.join(__dirname, '..', 'constants.ts');

function parseJsonBlock(source, pattern, label) {
  const match = source.match(pattern);

  if (!match) {
    throw new Error(`Could not parse ${label} from constants.ts`);
  }

  return JSON.parse(match[1]);
}

export function parseTop300SnapshotFromConstants(constantsContent) {
  const lastUpdatedMatch = constantsContent.match(/export const LAST_UPDATED = "([^"]+)";/);

  if (!lastUpdatedMatch) {
    throw new Error('Could not parse LAST_UPDATED from constants.ts');
  }

  return {
    lastUpdated: lastUpdatedMatch[1],
    nodes: parseJsonBlock(constantsContent, /nodes:\s*(\[[\s\S]*?\])\s*,\s*links:/, 'nodes'),
    links: parseJsonBlock(constantsContent, /links:\s*(\[[\s\S]*?\])\s*\n\};?/, 'links'),
  };
}

export function readTop300Snapshot(constantsPath = DEFAULT_CONSTANTS_PATH) {
  const content = fs.readFileSync(constantsPath, 'utf8');
  return parseTop300SnapshotFromConstants(content);
}
