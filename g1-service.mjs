/**
 * G1 Ultra Service — HTTP API server
 * Được gọi bởi bot-ai, không phải bot độc lập
 */
import { createServer } from 'node:http';
import { submitJob, createJob, getJob, getActiveJobByUser, queuePosition, setNotify } from './job-queue.mjs';

const PORT = process.env.PORT || 3000;
const API_SECRET = process.env.G1_SERVICE_API_SECRET || '';

console.log('[g1-service] starting on port', PORT);

// ─── Notify callback → gọi webhook về bot-ai ─────────────────────────────────

const BOT_AI_URL = process.env.RAILWAY_SERVICE_BOT_AI_URL || process.env.BOT_AI_URL || '';

setNotify(async (job) => {
  if (!BOT_AI_URL) return;
  try {
    const { default: fetch } = await import('node-fetch');
    await fetch(`${BOT_AI_URL}/internal/g1-job-result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': API_SECRET,
      },
      body: JSON.stringify({
        jobId: job.jobId,
        userId: job.userId,
        status: job.status,
        resultMsg: job.resultMsg,
        sku: job.sku,
        months: job.months,
        email: job.email,
        rdpName: job.rdpName,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.error('[g1-service] notify bot-ai failed:', err.message);
  }
});

// ─── HTTP Server ──────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function auth(req) {
  if (!API_SECRET) return true;
  return req.headers['x-internal-secret'] === API_SECRET;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);

  // Health check — no auth needed
  if (req.method === 'GET' && url.pathname === '/healthz') {
    return json(res, 200, { ok: true, mode: 'direct-playwright' });
  }

  if (!auth(req)) return json(res, 401, { error: 'unauthorized' });

  // POST /job — submit job mới
  if (req.method === 'POST' && url.pathname === '/job') {
    const body = await readBody(req);
    const { userId, email, password, secret = '', sku, months, proxy } = body;

    if (!userId || !email || !password || !sku || !months) {
      return json(res, 400, { error: 'missing required fields' });
    }

    const active = getActiveJobByUser(userId);
    if (active) {
      return json(res, 409, { error: 'user has active job', jobId: active.jobId, status: active.status });
    }

    const job = createJob({ userId, email, password, secret, sku, months, proxy });
    submitJob(job);
    const pos = queuePosition(job.jobId);

    return json(res, 202, { ok: true, jobId: job.jobId, position: pos });
  }

  // GET /job/:id — status
  if (req.method === 'GET' && url.pathname.startsWith('/job/')) {
    const jobId = url.pathname.split('/')[2];
    const job = getJob(jobId);
    if (!job) return json(res, 404, { error: 'job not found' });
    return json(res, 200, {
      jobId: job.jobId,
      status: job.status,
      resultMsg: job.resultMsg,
      rdpName: job.rdpName,
      sku: job.sku,
      months: job.months,
    });
  }

  // GET /pool — no longer using RDP pool
  if (req.method === 'GET' && url.pathname === '/pool') {
    return json(res, 200, { available: 1, mode: 'direct-playwright' });
  }

  json(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`[g1-service] listening on :${PORT}`);
});
