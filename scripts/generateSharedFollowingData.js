import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getFollowingUsersByScreenName, normalizeXUser } from './xapiClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

export function classifyCandidateProfile(user = {}) {
  const text = `${user.description || user.bio || ''} ${user.role || ''}`.toLowerCase();
  const name = `${user.name || ''}`.toLowerCase();

  let candidateType = 'personality';
  let isLikelyCommercialKOL = false;
  let qualityWeight = 1;

  if (
    text.includes('official') ||
    text.includes('company') ||
    text.includes('research lab') ||
    text.includes('organization') ||
    text.includes('platform') ||
    name.endsWith(' ai')
  ) {
    candidateType = 'company';
    qualityWeight = 0.45;
  } else if (
    text.includes('newsletter') ||
    text.includes('creator') ||
    text.includes('tutorial') ||
    text.includes('youtuber') ||
    text.includes('content creator')
  ) {
    candidateType = 'creator';
    isLikelyCommercialKOL = true;
    qualityWeight = 1.35;
  } else if (
    text.includes('journalist') ||
    text.includes('editor') ||
    text.includes('podcast') ||
    text.includes('media')
  ) {
    candidateType = 'media';
    isLikelyCommercialKOL = true;
    qualityWeight = 1.15;
  } else if (
    text.includes('educator') ||
    text.includes('teacher') ||
    text.includes('course') ||
    text.includes('explainer')
  ) {
    candidateType = 'educator';
    isLikelyCommercialKOL = true;
    qualityWeight = 1.2;
  } else if (
    text.includes('operator') ||
    text.includes('growth') ||
    text.includes('marketing') ||
    text.includes('consultant')
  ) {
    candidateType = 'operator';
    isLikelyCommercialKOL = true;
    qualityWeight = 1.2;
  } else if (
    text.includes('founder') ||
    text.includes('ceo') ||
    text.includes('investor') ||
    text.includes('vc')
  ) {
    candidateType = 'founder';
    qualityWeight = 0.8;
  }

  return {
    candidateType,
    isLikelyCommercialKOL,
    qualityWeight,
  };
}

function toCandidateNode(user) {
  const normalizedUser = normalizeXUser(user);

  if (!normalizedUser?.username) {
    return null;
  }

  const profile = classifyCandidateProfile({
    ...normalizedUser,
    role: user.role,
  });

  return {
    id: normalizeId(normalizedUser.username),
    handle: normalizedUser.username,
    name: normalizedUser.name || normalizedUser.username,
    group: profile.candidateType === 'company' ? 'company' : 'media',
    role: user.role || normalizedUser.description || '',
    bio: normalizedUser.description || '',
    followers: normalizedUser.followers_count || 0,
    imageUrl: normalizedUser.profile_image || '',
    candidateType: profile.candidateType,
    isLikelyCommercialKOL: profile.isLikelyCommercialKOL,
    qualityWeight: profile.qualityWeight,
  };
}

export function buildSharedFollowingDataset({ topNodes, followingsBySource }) {
  const topNodeIds = new Set((topNodes || []).flatMap((node) => {
    const ids = [node.id, node.handle];
    return ids.map(normalizeId).filter(Boolean);
  }));

  const candidateNodesById = {};
  const externalFollowingBySource = {};

  for (const source of topNodes || []) {
    const sourceId = normalizeId(source.id);
    const sourceFollowings = followingsBySource?.[sourceId] || followingsBySource?.[source.handle] || [];
    const candidateIds = [];
    const seenCandidateIds = new Set();

    for (const followedUser of sourceFollowings) {
      const candidateNode = toCandidateNode(followedUser);

      if (!candidateNode) {
        continue;
      }

      if (topNodeIds.has(candidateNode.id) || seenCandidateIds.has(candidateNode.id)) {
        continue;
      }

      seenCandidateIds.add(candidateNode.id);
      candidateIds.push(candidateNode.id);

      if (!candidateNodesById[candidateNode.id]) {
        candidateNodesById[candidateNode.id] = candidateNode;
      }
    }

    externalFollowingBySource[sourceId] = candidateIds;
  }

  return {
    candidateNodesById,
    externalFollowingBySource,
  };
}

function readTopNodesFromConstants(constantsPath) {
  const constantsContent = fs.readFileSync(constantsPath, 'utf-8');
  const nodesMatch = constantsContent.match(/nodes:\s*(\[[\s\S]*?\])\s*,\s*links:/);

  if (!nodesMatch) {
    throw new Error('Could not parse nodes from constants.ts');
  }

  return JSON.parse(nodesMatch[1]);
}

function writeSharedFollowingData(outputPath, data) {
  const fileContent = `import { SharedFollowingData } from "./types";

export const SHARED_FOLLOWING_DATA: SharedFollowingData = ${JSON.stringify(data, null, 2)};
`;

  fs.writeFileSync(outputPath, fileContent);
}

export async function generateSharedFollowingData(options = {}) {
  const apiKey = options.apiKey ?? process.env.XAPI_API_KEY;
  const pageSize = options.pageSize ?? process.env.XAPI_FOLLOWING_PAGE_SIZE;
  const maxPages = options.maxPages ?? process.env.XAPI_MAX_FOLLOWING_PAGES;
  const constantsPath = options.constantsPath ?? path.join(__dirname, '..', 'constants.ts');
  const outputPath = options.outputPath ?? path.join(__dirname, '..', 'sharedFollowingData.ts');

  if (!apiKey) {
    throw new Error('Missing XAPI_API_KEY in environment');
  }

  const topNodes = readTopNodesFromConstants(constantsPath);
  const followingsBySource = {};

  console.log(`Generating shared-following candidate pool from ${topNodes.length} core nodes...`);

  for (const node of topNodes) {
    const sourceId = normalizeId(node.id);
    console.log(`Fetching external followings for @${node.handle || node.id}...`);
    followingsBySource[sourceId] = await getFollowingUsersByScreenName(node.handle || node.id, {
      apiKey,
      pageSize,
      maxPages,
    });
  }

  const dataset = buildSharedFollowingDataset({ topNodes, followingsBySource });
  writeSharedFollowingData(outputPath, dataset);
  console.log(`Wrote shared-following data to ${outputPath}`);

  return dataset;
}

async function main() {
  if (!process.env.XAPI_API_KEY) {
    throw new Error('Missing XAPI_API_KEY in environment');
  }
  await generateSharedFollowingData();
}

if (process.argv[1] === __filename) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
