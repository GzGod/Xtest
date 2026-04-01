import pg from 'pg';

const { Pool } = pg;

let poolInstance = null;
let schemaPromise = null;

function getSslConfig() {
  const explicitMode = String(process.env.PGSSLMODE || '').toLowerCase();

  if (explicitMode === 'disable') {
    return false;
  }

  if (process.env.DATABASE_URL || process.env.RAILWAY_ENVIRONMENT) {
    return { rejectUnauthorized: false };
  }

  return false;
}

export function hasDatabaseConfig() {
  return Boolean(
    process.env.DATABASE_URL ||
    process.env.PGHOST ||
    process.env.POSTGRES_HOST ||
    process.env.PGHOSTADDR
  );
}

export function getPool() {
  if (poolInstance) {
    return poolInstance;
  }

  if (!hasDatabaseConfig()) {
    throw new Error('Database is not configured. Set DATABASE_URL or PostgreSQL connection variables.');
  }

  const connectionString = process.env.DATABASE_URL;

  poolInstance = connectionString
    ? new Pool({
        connectionString,
        ssl: getSslConfig(),
      })
    : new Pool({
        host: process.env.PGHOST || process.env.POSTGRES_HOST,
        port: Number.parseInt(process.env.PGPORT || process.env.POSTGRES_PORT || '5432', 10),
        user: process.env.PGUSER || process.env.POSTGRES_USER,
        password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD,
        database: process.env.PGDATABASE || process.env.POSTGRES_DB,
        ssl: getSslConfig(),
      });

  return poolInstance;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  x_user_id TEXT,
  name TEXT NOT NULL,
  group_name TEXT,
  role TEXT,
  associated TEXT,
  bio TEXT,
  followers INTEGER NOT NULL DEFAULT 0,
  following INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  website TEXT,
  location TEXT,
  joined_date TEXT,
  verified TEXT,
  candidate_type TEXT,
  is_likely_commercial_kol BOOLEAN NOT NULL DEFAULT FALSE,
  quality_weight DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS top300_snapshots (
  id BIGSERIAL PRIMARY KEY,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_label TEXT NOT NULL,
  node_count INTEGER NOT NULL DEFAULT 0,
  link_count INTEGER NOT NULL DEFAULT 0,
  is_current BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS top300_snapshot_members (
  snapshot_id BIGINT NOT NULL REFERENCES top300_snapshots(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  score DOUBLE PRECISION,
  PRIMARY KEY (snapshot_id, account_id),
  UNIQUE (snapshot_id, rank)
);

CREATE TABLE IF NOT EXISTS top300_snapshot_links (
  snapshot_id BIGINT NOT NULL REFERENCES top300_snapshots(id) ON DELETE CASCADE,
  source_account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  value DOUBLE PRECISION,
  PRIMARY KEY (snapshot_id, source_account_id, target_account_id)
);

CREATE TABLE IF NOT EXISTS following_edges (
  source_account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (source_account_id, target_account_id)
);

CREATE TABLE IF NOT EXISTS following_sync_state (
  account_id BIGINT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_top300_snapshots_current ON top300_snapshots(is_current);
CREATE INDEX IF NOT EXISTS idx_snapshot_members_rank ON top300_snapshot_members(snapshot_id, rank);
CREATE INDEX IF NOT EXISTS idx_snapshot_links_source ON top300_snapshot_links(snapshot_id, source_account_id);
CREATE INDEX IF NOT EXISTS idx_following_edges_source_active ON following_edges(source_account_id, is_active);
CREATE INDEX IF NOT EXISTS idx_following_edges_target_active ON following_edges(target_account_id, is_active);
`;

export async function ensureDatabaseSchema() {
  if (schemaPromise) {
    return schemaPromise;
  }

  schemaPromise = (async () => {
    const pool = getPool();
    await pool.query(SCHEMA_SQL);
  })();

  return schemaPromise;
}

export async function withTransaction(work) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
