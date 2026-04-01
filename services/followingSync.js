import { classifyCandidateProfile } from '../scripts/generateSharedFollowingData.js';
import { getFollowingUsersByScreenName, normalizeXUser } from '../scripts/xapiClient.js';
import { markFollowingSyncFailure, replaceFollowingForSource } from './top300Repository.js';

function normalizeHandle(value) {
  return String(value || '').trim().toLowerCase();
}

function formatJoinedDate(createdAt) {
  if (!createdAt) {
    return null;
  }

  const parsedDate = new Date(createdAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function mapFollowingUserToStoredAccount(user = {}) {
  const normalizedUser = normalizeXUser(user);
  const handle = normalizeHandle(normalizedUser?.username);

  if (!handle) {
    return null;
  }

  const profile = classifyCandidateProfile({
    ...normalizedUser,
    role: user.role,
  });

  return {
    handle,
    xUserId: normalizedUser.id ? String(normalizedUser.id) : null,
    name: normalizedUser.name || normalizedUser.username || handle,
    group: profile.candidateType === 'company' ? 'company' : 'media',
    role: user.role || normalizedUser.description || '',
    associated: '',
    bio: normalizedUser.description || '',
    followers: normalizedUser.followers_count || 0,
    following: normalizedUser.following_count || 0,
    imageUrl: normalizedUser.profile_image || '',
    website: normalizedUser.website || '',
    location: normalizedUser.location || '',
    joinedDate: formatJoinedDate(normalizedUser.created_at),
    verified: normalizedUser.verified ? 'blue' : null,
    candidateType: profile.candidateType,
    isLikelyCommercialKOL: profile.isLikelyCommercialKOL,
    qualityWeight: profile.qualityWeight,
  };
}

export async function syncFollowingForAccount(account, options = {}) {
  const handle = normalizeHandle(account?.handle || account?.id);

  if (!handle) {
    throw new Error('Cannot sync following for an account without a handle');
  }

  try {
    const followingUsers = await getFollowingUsersByScreenName(handle, {
      apiKey: options.apiKey ?? process.env.XAPI_API_KEY,
      pageSize: options.pageSize ?? process.env.XAPI_FOLLOWING_PAGE_SIZE,
      maxPages: options.maxPages ?? process.env.XAPI_MAX_FOLLOWING_PAGES,
    });
    const followedAccounts = [];
    const seenHandles = new Set();

    for (const followingUser of followingUsers) {
      const mappedAccount = mapFollowingUserToStoredAccount(followingUser);

      if (!mappedAccount || seenHandles.has(mappedAccount.handle)) {
        continue;
      }

      seenHandles.add(mappedAccount.handle);
      followedAccounts.push(mappedAccount);
    }

    const syncedAt = options.syncedAt ?? new Date().toISOString();

    await replaceFollowingForSource({
      sourceAccount: {
        ...account,
        handle,
      },
      followedAccounts,
      syncedAt,
    });

    return {
      handle,
      syncedAt,
      followedCount: followedAccounts.length,
    };
  } catch (error) {
    if (account?.id) {
      await markFollowingSyncFailure({
        accountId: account.id,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    throw error;
  }
}
