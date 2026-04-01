import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 10;

function parseJsonMaybe(value) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getErrorMessage(errorValue) {
  if (!errorValue) return null;
  if (typeof errorValue === 'string') return errorValue;
  if (typeof errorValue.message === 'string') return errorValue.message;

  try {
    return JSON.stringify(errorValue);
  } catch {
    return String(errorValue);
  }
}

function resolvePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveInvocation() {
  const nodeBinDir = path.dirname(process.execPath);
  const npxCliPath = path.join(nodeBinDir, 'node_modules', 'npm', 'bin', 'npx-cli.js');

  if (fs.existsSync(npxCliPath)) {
    return {
      command: process.execPath,
      args: [npxCliPath, '--yes', 'xapi-to'],
    };
  }

  return {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['--yes', 'xapi-to'],
  };
}

async function defaultExecutor(command, args, options) {
  return execFileAsync(command, args, options);
}

function parseXapiResponse(actionId, stdout, stderr) {
  const parsed = parseJsonMaybe(stdout);

  if (!parsed) {
    const details = stderr?.trim() || stdout?.trim() || 'Empty response';
    throw new Error(`xapi ${actionId} returned non-JSON output: ${details}`);
  }

  if (parsed.success === false || parsed.error) {
    throw new Error(`xapi ${actionId} failed: ${getErrorMessage(parsed.error) || 'Unknown error'}`);
  }

  return parsed;
}

export async function callXapi(actionId, input = {}, options = {}) {
  const apiKey = options.apiKey ?? process.env.XAPI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing XAPI_API_KEY environment variable');
  }

  const invocation = options.invocation ?? resolveInvocation();
  const executor = options.executor ?? defaultExecutor;
  const env = {
    ...process.env,
    ...(options.env ?? {}),
    XAPI_API_KEY: apiKey,
  };

  const args = [
    ...invocation.args,
    'call',
    actionId,
    '--input',
    JSON.stringify(input),
  ];

  try {
    const { stdout, stderr } = await executor(invocation.command, args, {
      cwd: options.cwd ?? process.cwd(),
      env,
      maxBuffer: options.maxBuffer ?? DEFAULT_MAX_BUFFER,
    });

    return parseXapiResponse(actionId, stdout, stderr);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`xapi ${actionId}`)) {
      throw error;
    }

    const stdout = error?.stdout ?? '';
    const stderr = error?.stderr ?? error?.message ?? '';
    const parsedStdout = parseJsonMaybe(stdout);
    const parsedStderr = parseJsonMaybe(stderr);
    const errorMessage =
      getErrorMessage(parsedStdout?.error) ||
      getErrorMessage(parsedStderr?.error) ||
      stderr.trim() ||
      stdout.trim() ||
      'Unknown error';

    throw new Error(`xapi ${actionId} failed: ${errorMessage}`);
  }
}

export async function getUserByScreenName(screenName, options = {}) {
  const response = await callXapi(
    'twitter.user_by_screen_name',
    { screen_name: screenName },
    options
  );

  return response.data ?? null;
}

export async function getFollowingUsersByScreenName(screenName, options = {}) {
  const profile = await getUserByScreenName(screenName, options);
  const userId = profile?.rest_id ?? profile?.id;

  if (!userId) {
    return [];
  }

  return getAllFollowingUsers(userId, options);
}

export async function getAllFollowingUsers(userId, options = {}) {
  const users = [];
  const seenUsers = new Set();
  const pageSize = resolvePositiveInt(
    options.pageSize ?? process.env.XAPI_FOLLOWING_PAGE_SIZE,
    DEFAULT_PAGE_SIZE
  );
  const maxPages = resolvePositiveInt(
    options.maxPages ?? process.env.XAPI_MAX_FOLLOWING_PAGES,
    DEFAULT_MAX_PAGES
  );

  let cursor = options.cursor;

  for (let page = 0; page < maxPages; page++) {
    const input = {
      user_id: userId,
      count: pageSize,
    };

    if (cursor) {
      input.cursor = cursor;
    }

    const response = await callXapi('twitter.following', input, options);
    const pageUsers = response.data?.users ?? [];

    for (const user of pageUsers) {
      const key = (user?.id || user?.screen_name || '').toLowerCase();

      if (!key || seenUsers.has(key)) {
        continue;
      }

      seenUsers.add(key);
      users.push(user);
    }

    cursor = response.data?.cursor_bottom;

    if (!cursor || pageUsers.length === 0) {
      break;
    }
  }

  return users;
}

export function normalizeXUser(user) {
  if (!user) {
    return null;
  }

  const username = user.screen_name || user.profile || user.username;

  if (!username) {
    return null;
  }

  return {
    id: user.rest_id || user.id || user.user_id,
    username,
    name: user.name || username,
    description: user.description || user.desc || '',
    followers_count: user.followers_count || user.sub_count || 0,
    following_count: user.friends_count || user.friends || 0,
    created_at: user.created_at,
    location: user.location || '',
    verified: Boolean(user.is_blue_verified || user.blue_verified),
    website: user.expanded_url || user.url || user.website || '',
    profile_image: user.avatar || user.profile_image_url || user.profile_image || '',
  };
}
