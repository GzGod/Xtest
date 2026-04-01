import 'dotenv/config';

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasDatabaseConfig } from './services/db.js';
import { syncFollowingForAccount } from './services/followingSync.js';
import { querySharedFollowingWithCache } from './services/sharedFollowingQuery.js';
import {
  getAccountsByHandles,
  getCurrentTop300Snapshot,
  getFollowingSyncStates,
  getSharedFollowingDatasetForSources,
  importTop300Snapshot,
} from './services/top300Repository.js';
import { readTop300Snapshot } from './services/top300Snapshot.js';
import { runTop300Sync } from './services/top300Sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const port = Number.parseInt(process.env.PORT || '3000', 10);
const host = '0.0.0.0';
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

let bootstrapPromise = null;

function getContentType(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function sendFile(response, filePath) {
  response.writeHead(200, {
    'Content-Type': getContentType(filePath),
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  });

  fs.createReadStream(filePath).pipe(response);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, code, message) {
  sendJson(response, statusCode, {
    error: {
      code,
      message,
    },
  });
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveRequestPath(request) {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  return url.pathname;
}

function resolveStaticFilePath(requestPath) {
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const resolvedPath = path.resolve(distDir, relativePath);

  if (!resolvedPath.startsWith(distDir)) {
    return null;
  }

  return resolvedPath;
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();

  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error('Request body must be valid JSON');
  }
}

function getAdminKeyFromRequest(request) {
  const authorizationHeader = request.headers.authorization || '';

  if (authorizationHeader.toLowerCase().startsWith('bearer ')) {
    return authorizationHeader.slice(7).trim();
  }

  const headerValue = request.headers['x-admin-key'];

  if (Array.isArray(headerValue)) {
    return headerValue[0];
  }

  return headerValue ? String(headerValue) : '';
}

function isAuthorizedAdminRequest(request) {
  const configuredKey = String(process.env.ADMIN_API_KEY || '').trim();

  if (!configuredKey) {
    return false;
  }

  return getAdminKeyFromRequest(request) === configuredKey;
}

async function ensureBootstrapSnapshot() {
  if (!hasDatabaseConfig()) {
    return null;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      let snapshot = await getCurrentTop300Snapshot();

      if (snapshot) {
        return snapshot;
      }

      await importTop300Snapshot(readTop300Snapshot());
      snapshot = await getCurrentTop300Snapshot();
      return snapshot;
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  return bootstrapPromise;
}

async function loadCurrentTop300Payload() {
  if (hasDatabaseConfig()) {
    const snapshot = await ensureBootstrapSnapshot();

    if (snapshot) {
      return {
        source: 'database',
        graphData: {
          nodes: snapshot.nodes,
          links: snapshot.links,
        },
        lastUpdated: snapshot.lastUpdated,
        generatedAt: snapshot.generatedAt,
      };
    }
  }

  const staticSnapshot = readTop300Snapshot();

  return {
    source: 'static',
    graphData: {
      nodes: staticSnapshot.nodes,
      links: staticSnapshot.links,
    },
    lastUpdated: staticSnapshot.lastUpdated,
    generatedAt: null,
  };
}

async function handleTop300Request(response) {
  const payload = await loadCurrentTop300Payload();
  sendJson(response, 200, payload);
}

async function handleSharedFollowingQuery(request, response) {
  if (!hasDatabaseConfig()) {
    sendError(
      response,
      503,
      'database_not_configured',
      'Database-backed shared following is not configured on this deployment.'
    );
    return;
  }

  await ensureBootstrapSnapshot();

  const body = await readJsonBody(request);
  const selectedHandles = Array.isArray(body.selectedHandles) ? body.selectedHandles : [];
  const mode = body.mode === 'strict' ? 'strict' : 'threshold';
  const minSharedCount = toPositiveInt(body.minSharedCount, 1);
  const limit = toPositiveInt(body.limit, 20);
  const refreshAccountFollowings = process.env.XAPI_API_KEY
    ? async (account) => syncFollowingForAccount(account)
    : undefined;

  const result = await querySharedFollowingWithCache({
    repository: {
      getAccountsByHandles,
      getFollowingSyncStates,
      getSharedFollowingDatasetForSources,
    },
    selectedHandles,
    mode,
    minSharedCount,
    limit,
    staleAfterMs: STALE_AFTER_MS,
    refreshAccountFollowings,
  });

  sendJson(response, 200, {
    source: 'database',
    staleAfterDays: 7,
    ...result,
  });
}

async function handleAdminSyncTop300(request, response) {
  if (!String(process.env.ADMIN_API_KEY || '').trim()) {
    sendError(response, 503, 'admin_key_missing', 'ADMIN_API_KEY is not configured on this deployment.');
    return;
  }

  if (!isAuthorizedAdminRequest(request)) {
    sendError(response, 403, 'forbidden', 'Invalid admin key.');
    return;
  }

  const body = await readJsonBody(request);
  const liveRefresh = body.liveRefresh === true || String(body.liveRefresh || '').toLowerCase() === 'true';
  const result = await runTop300Sync({ liveRefresh });

  bootstrapPromise = null;

  sendJson(response, 200, {
    ok: true,
    source: 'database',
    ...result,
  });
}

const server = http.createServer(async (request, response) => {
  const requestPath = resolveRequestPath(request);

  try {
    if (request.method === 'GET' && requestPath === '/api/top300') {
      await handleTop300Request(response);
      return;
    }

    if (request.method === 'POST' && requestPath === '/api/shared-following/query') {
      await handleSharedFollowingQuery(request, response);
      return;
    }

    if (request.method === 'POST' && requestPath === '/api/admin/sync-top300') {
      await handleAdminSyncTop300(request, response);
      return;
    }

    const staticFilePath = resolveStaticFilePath(requestPath);

    if (staticFilePath && fs.existsSync(staticFilePath) && fs.statSync(staticFilePath).isFile()) {
      sendFile(response, staticFilePath);
      return;
    }

    const indexPath = path.join(distDir, 'index.html');

    if (fs.existsSync(indexPath)) {
      sendFile(response, indexPath);
      return;
    }

    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('dist/index.html not found. Run npm run build first.');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error';

    console.error(error);

    if (requestPath.startsWith('/api/')) {
      sendError(response, 500, 'internal_error', errorMessage);
      return;
    }

    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(errorMessage);
  }
});

server.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});
