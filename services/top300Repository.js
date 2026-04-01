import { ensureDatabaseSchema, getPool, withTransaction } from './db.js';

function normalizeHandle(value) {
  return String(value || '').trim().toLowerCase();
}

function toNullableString(value) {
  const stringValue = value === undefined || value === null ? null : String(value).trim();
  return stringValue ? stringValue : null;
}

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toFloat(value) {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAccountRecord(account = {}) {
  const handle = normalizeHandle(account.handle || account.id);

  if (!handle) {
    return null;
  }

  return {
    handle,
    xUserId: toNullableString(account.xUserId || account.x_user_id),
    name: toNullableString(account.name) || handle,
    groupName: toNullableString(account.group || account.groupName || account.group_name),
    role: toNullableString(account.role),
    associated: toNullableString(account.associated),
    bio: toNullableString(account.bio),
    followers: toInteger(account.followers, 0),
    following: toInteger(account.following, 0),
    imageUrl: toNullableString(account.imageUrl || account.image_url),
    website: toNullableString(account.website),
    location: toNullableString(account.location),
    joinedDate: toNullableString(account.joinedDate || account.joined_date),
    verified: toNullableString(account.verified),
    candidateType: toNullableString(account.candidateType || account.candidate_type),
    isLikelyCommercialKOL: Boolean(account.isLikelyCommercialKOL || account.is_likely_commercial_kol),
    qualityWeight: toFloat(account.qualityWeight || account.quality_weight),
  };
}

function mapAccountRow(row) {
  return {
    id: String(row.id),
    handle: row.handle,
    xUserId: row.x_user_id,
    name: row.name,
    group: row.group_name,
    role: row.role,
    associated: row.associated,
    bio: row.bio,
    followers: row.followers,
    following: row.following,
    imageUrl: row.image_url,
    website: row.website,
    location: row.location,
    joinedDate: row.joined_date,
    verified: row.verified,
    candidateType: row.candidate_type,
    isLikelyCommercialKOL: row.is_likely_commercial_kol,
    qualityWeight: row.quality_weight,
  };
}

async function upsertAccountsInternal(client, accounts) {
  const normalizedRecords = accounts
    .map(normalizeAccountRecord)
    .filter(Boolean);

  if (normalizedRecords.length === 0) {
    return new Map();
  }

  const handles = [];

  for (const record of normalizedRecords) {
    await client.query(
      `
      INSERT INTO accounts (
        handle, x_user_id, name, group_name, role, associated, bio,
        followers, following, image_url, website, location, joined_date,
        verified, candidate_type, is_likely_commercial_kol, quality_weight, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, NOW()
      )
      ON CONFLICT (handle) DO UPDATE SET
        x_user_id = COALESCE(EXCLUDED.x_user_id, accounts.x_user_id),
        name = EXCLUDED.name,
        group_name = COALESCE(EXCLUDED.group_name, accounts.group_name),
        role = COALESCE(EXCLUDED.role, accounts.role),
        associated = COALESCE(EXCLUDED.associated, accounts.associated),
        bio = COALESCE(EXCLUDED.bio, accounts.bio),
        followers = EXCLUDED.followers,
        following = EXCLUDED.following,
        image_url = COALESCE(EXCLUDED.image_url, accounts.image_url),
        website = COALESCE(EXCLUDED.website, accounts.website),
        location = COALESCE(EXCLUDED.location, accounts.location),
        joined_date = COALESCE(EXCLUDED.joined_date, accounts.joined_date),
        verified = COALESCE(EXCLUDED.verified, accounts.verified),
        candidate_type = COALESCE(EXCLUDED.candidate_type, accounts.candidate_type),
        is_likely_commercial_kol = EXCLUDED.is_likely_commercial_kol,
        quality_weight = COALESCE(EXCLUDED.quality_weight, accounts.quality_weight),
        updated_at = NOW()
      `,
      [
        record.handle,
        record.xUserId,
        record.name,
        record.groupName,
        record.role,
        record.associated,
        record.bio,
        record.followers,
        record.following,
        record.imageUrl,
        record.website,
        record.location,
        record.joinedDate,
        record.verified,
        record.candidateType,
        record.isLikelyCommercialKOL,
        record.qualityWeight,
      ]
    );
    handles.push(record.handle);
  }

  const result = await client.query(
    `SELECT * FROM accounts WHERE handle = ANY($1::text[])`,
    [handles]
  );

  return new Map(result.rows.map((row) => [row.handle, mapAccountRow(row)]));
}

export async function upsertAccounts(accounts) {
  await ensureDatabaseSchema();
  return withTransaction((client) => upsertAccountsInternal(client, accounts));
}

export async function importTop300Snapshot(snapshot) {
  await ensureDatabaseSchema();

  return withTransaction(async (client) => {
    const accountsByHandle = await upsertAccountsInternal(client, snapshot.nodes || []);

    await client.query('UPDATE top300_snapshots SET is_current = FALSE WHERE is_current = TRUE');
    const snapshotResult = await client.query(
      `
      INSERT INTO top300_snapshots (
        generated_at, last_updated_label, node_count, link_count, is_current
      ) VALUES (
        NOW(), $1, $2, $3, TRUE
      )
      RETURNING id, generated_at, last_updated_label
      `,
      [
        snapshot.lastUpdated,
        (snapshot.nodes || []).length,
        (snapshot.links || []).length,
      ]
    );

    const snapshotRow = snapshotResult.rows[0];

    for (let index = 0; index < (snapshot.nodes || []).length; index++) {
      const node = snapshot.nodes[index];
      const account = accountsByHandle.get(normalizeHandle(node.handle || node.id));

      if (!account) {
        continue;
      }

      await client.query(
        `
        INSERT INTO top300_snapshot_members (snapshot_id, account_id, rank, score)
        VALUES ($1, $2, $3, $4)
        `,
        [snapshotRow.id, account.id, index + 1, toFloat(node.score)]
      );
    }

    for (const link of snapshot.links || []) {
      const sourceHandle = normalizeHandle(typeof link.source === 'object' ? link.source?.handle || link.source?.id : link.source);
      const targetHandle = normalizeHandle(typeof link.target === 'object' ? link.target?.handle || link.target?.id : link.target);
      const sourceAccount = accountsByHandle.get(sourceHandle);
      const targetAccount = accountsByHandle.get(targetHandle);

      if (!sourceAccount || !targetAccount) {
        continue;
      }

      await client.query(
        `
        INSERT INTO top300_snapshot_links (snapshot_id, source_account_id, target_account_id, value)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (snapshot_id, source_account_id, target_account_id) DO NOTHING
        `,
        [snapshotRow.id, sourceAccount.id, targetAccount.id, link.value ?? 1]
      );
    }

    return {
      id: snapshotRow.id,
      generatedAt: snapshotRow.generated_at,
      lastUpdated: snapshotRow.last_updated_label,
      nodeCount: (snapshot.nodes || []).length,
      linkCount: (snapshot.links || []).length,
    };
  });
}

export async function getCurrentTop300Snapshot() {
  await ensureDatabaseSchema();
  const pool = getPool();
  const snapshotResult = await pool.query(
    `
    SELECT id, generated_at, last_updated_label, node_count, link_count
    FROM top300_snapshots
    WHERE is_current = TRUE
    ORDER BY generated_at DESC
    LIMIT 1
    `
  );

  if (snapshotResult.rows.length === 0) {
    return null;
  }

  const snapshot = snapshotResult.rows[0];
  const membersResult = await pool.query(
    `
    SELECT m.rank, a.*
    FROM top300_snapshot_members m
    JOIN accounts a ON a.id = m.account_id
    WHERE m.snapshot_id = $1
    ORDER BY m.rank ASC
    `,
    [snapshot.id]
  );
  const linksResult = await pool.query(
    `
    SELECT sl.value, source.handle AS source_handle, target.handle AS target_handle
    FROM top300_snapshot_links sl
    JOIN accounts source ON source.id = sl.source_account_id
    JOIN accounts target ON target.id = sl.target_account_id
    WHERE sl.snapshot_id = $1
    `,
    [snapshot.id]
  );

  return {
    id: snapshot.id,
    generatedAt: snapshot.generated_at,
    lastUpdated: snapshot.last_updated_label,
    nodes: membersResult.rows.map((row) => ({
      id: row.handle,
      name: row.name,
      group: row.group_name,
      role: row.role,
      handle: row.handle,
      associated: row.associated || '',
      bio: row.bio || '',
      followers: row.followers || 0,
      following: row.following || 0,
      imageUrl: row.image_url || '',
      website: row.website || '',
      location: row.location || '',
      joinedDate: row.joined_date || '',
      verified: row.verified || undefined,
      rank: row.rank,
    })),
    links: linksResult.rows.map((row) => ({
      source: row.source_handle,
      target: row.target_handle,
      value: row.value || 1,
    })),
  };
}

export async function getAccountsByHandles(handles) {
  await ensureDatabaseSchema();
  const normalizedHandles = Array.from(new Set((handles || []).map(normalizeHandle).filter(Boolean)));

  if (normalizedHandles.length === 0) {
    return [];
  }

  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM accounts WHERE handle = ANY($1::text[])`,
    [normalizedHandles]
  );

  return result.rows.map(mapAccountRow);
}

export async function getFollowingSyncStates(accountIds) {
  await ensureDatabaseSchema();

  if (!accountIds || accountIds.length === 0) {
    return new Map();
  }

  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM following_sync_state WHERE account_id = ANY($1::bigint[])`,
    [accountIds]
  );

  return new Map(
    result.rows.map((row) => [String(row.account_id), {
      lastSyncedAt: row.last_synced_at,
      syncStatus: row.sync_status,
      errorMessage: row.error_message,
      updatedAt: row.updated_at,
    }])
  );
}

export async function replaceFollowingForSource({
  sourceAccount,
  followedAccounts,
  syncedAt = new Date().toISOString(),
}) {
  await ensureDatabaseSchema();

  return withTransaction(async (client) => {
    const sourceHandle = normalizeHandle(sourceAccount.handle || sourceAccount.id);
    const sourceMap = await upsertAccountsInternal(client, [{ ...sourceAccount, handle: sourceHandle }]);
    const source = sourceMap.get(sourceHandle);

    if (!source) {
      throw new Error(`Could not resolve source account for ${sourceHandle}`);
    }

    const targetsByHandle = await upsertAccountsInternal(client, followedAccounts || []);
    const targetIds = Array.from(targetsByHandle.values()).map((account) => Number(account.id));

    if (targetIds.length > 0) {
      await client.query(
        `
        UPDATE following_edges
        SET is_active = FALSE, last_seen_at = $2
        WHERE source_account_id = $1
          AND target_account_id <> ALL($3::bigint[])
        `,
        [source.id, syncedAt, targetIds]
      );
    } else {
      await client.query(
        `
        UPDATE following_edges
        SET is_active = FALSE, last_seen_at = $2
        WHERE source_account_id = $1
        `,
        [source.id, syncedAt]
      );
    }

    for (const target of targetsByHandle.values()) {
      await client.query(
        `
        INSERT INTO following_edges (
          source_account_id, target_account_id, first_seen_at, last_seen_at, is_active
        ) VALUES (
          $1, $2, $3, $3, TRUE
        )
        ON CONFLICT (source_account_id, target_account_id) DO UPDATE SET
          last_seen_at = EXCLUDED.last_seen_at,
          is_active = TRUE
        `,
        [source.id, target.id, syncedAt]
      );
    }

    await client.query(
      `
      INSERT INTO following_sync_state (account_id, last_synced_at, sync_status, error_message, updated_at)
      VALUES ($1, $2, 'success', NULL, NOW())
      ON CONFLICT (account_id) DO UPDATE SET
        last_synced_at = EXCLUDED.last_synced_at,
        sync_status = EXCLUDED.sync_status,
        error_message = NULL,
        updated_at = NOW()
      `,
      [source.id, syncedAt]
    );
  });
}

export async function markFollowingSyncFailure({ accountId, errorMessage }) {
  await ensureDatabaseSchema();
  const pool = getPool();
  await pool.query(
    `
    INSERT INTO following_sync_state (account_id, sync_status, error_message, updated_at)
    VALUES ($1, 'error', $2, NOW())
    ON CONFLICT (account_id) DO UPDATE SET
      sync_status = 'error',
      error_message = $2,
      updated_at = NOW()
    `,
    [accountId, String(errorMessage || 'Unknown sync error')]
  );
}

export async function getSharedFollowingDatasetForSources(sourceHandles) {
  await ensureDatabaseSchema();
  const normalizedSourceHandles = Array.from(new Set((sourceHandles || []).map(normalizeHandle).filter(Boolean)));

  if (normalizedSourceHandles.length === 0) {
    return {
      externalFollowingBySource: {},
      candidateNodesById: {},
    };
  }

  const pool = getPool();
  const currentSnapshot = await getCurrentTop300Snapshot();
  const top300HandleSet = new Set((currentSnapshot?.nodes || []).map((node) => normalizeHandle(node.handle || node.id)));
  const result = await pool.query(
    `
    SELECT
      source.handle AS source_handle,
      target.handle AS target_handle,
      target.name,
      target.group_name,
      target.role,
      target.bio,
      target.followers,
      target.image_url,
      target.candidate_type,
      target.is_likely_commercial_kol,
      target.quality_weight
    FROM following_edges edge
    JOIN accounts source ON source.id = edge.source_account_id
    JOIN accounts target ON target.id = edge.target_account_id
    WHERE edge.is_active = TRUE
      AND source.handle = ANY($1::text[])
    `,
    [normalizedSourceHandles]
  );

  const externalFollowingBySource = {};
  const candidateNodesById = {};

  for (const sourceHandle of normalizedSourceHandles) {
    externalFollowingBySource[sourceHandle] = [];
  }

  for (const row of result.rows) {
    const sourceHandle = normalizeHandle(row.source_handle);
    const targetHandle = normalizeHandle(row.target_handle);

    if (!sourceHandle || !targetHandle || top300HandleSet.has(targetHandle)) {
      continue;
    }

    if (!candidateNodesById[targetHandle]) {
      candidateNodesById[targetHandle] = {
        id: targetHandle,
        handle: row.target_handle,
        name: row.name || row.target_handle,
        group: row.group_name || 'media',
        role: row.role || '',
        bio: row.bio || '',
        followers: row.followers || 0,
        imageUrl: row.image_url || '',
        candidateType: row.candidate_type || 'personality',
        isLikelyCommercialKOL: row.is_likely_commercial_kol,
        qualityWeight: row.quality_weight,
      };
    }

    externalFollowingBySource[sourceHandle].push(targetHandle);
  }

  return {
    externalFollowingBySource,
    candidateNodesById,
  };
}
