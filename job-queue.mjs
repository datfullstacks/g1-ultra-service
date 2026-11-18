/**
 * Job queue — nhận job từ bot, dispatch đến RDP pool
 */
import { randomUUID } from 'node:crypto';
import { pool } from './rdp-pool.mjs';

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = join(__dirname, '..', 'extracted', 'extension_g130tb_ultra');

const PRESET_MAP = {
  '20tb:12': 'ultra20tb_12m',
  '20tb:6':  'ultra20tb_6m',
  '20tb:3':  'ultra20tb_3m',
  '20tb:1':  'ultra20tb_1m',
  '30tb:12': 'ultra30tb_12m',
  '30tb:6':  'ultra30tb_6m',
  '30tb:3':  'ultra30tb_3m',
  '30tb:1':  'ultra30tb_1m',
};

/** @type {Map<string, Job>} */
const jobs = new Map();
/** @type {Array<Job>} */
const queue = [];
let _notifyFn = null;

export function setNotify(fn) { _notifyFn = fn; }

export function createJob({ userId, email, password, secret, sku, months, proxy = null }) {
  return {
    jobId: randomUUID(),
    userId,
    email,
    password,
    secret,
    sku,
    months,
    proxy,
    status: 'queued', // queued | processing | done | failed
    resultMsg: '',
    rdpName: '',
    createdAt: Date.now(),
  };
}

export function submitJob(job) {
  jobs.set(job.jobId, job);
  queue.push(job);
  _dispatch();
  return job.jobId;
}

export function getJob(jobId) { return jobs.get(jobId); }

export function getActiveJobByUser(userId) {
  return [...jobs.values()].find(j => j.userId === userId && (j.status === 'queued' || j.status === 'processing'));
}

export function queuePosition(jobId) {
  return queue.findIndex(j => j.jobId === jobId) + 1;
}

export function poolStatus() {
  return pool.status();
}

// ─── Internal dispatcher ─────────────────────────────────────────────────────

async function _dispatch() {
  const job = queue.find(j => j.status === 'queued');
  if (!job) return;

  const presetId = PRESET_MAP[`${job.sku.toLowerCase()}:${job.months}`];
  if (!presetId) {
    _finish(job, false, `Preset không tồn tại: ${job.sku} ${job.months}m`);
    return;
  }

  let node;
  try {
    node = await pool.acquire(600_000);
  } catch (err) {
    _finish(job, false, err.message);
    return;
  }

  // Remove from pending queue
  queue.splice(queue.indexOf(job), 1);
  job.status = 'processing';
  job.rdpName = node.name;

  try {
    const result = await node.runJob({
      email: job.email,
      password: job.password,
      secret: job.secret,
      presetId,
      extensionPath: EXTENSION_PATH,
      proxy: job.proxy ?? null,
    });

    if (result?.ok) {
      _finish(job, true, result.message ?? `Google One Ultra ${job.sku.toUpperCase()} ${job.months}m activated`);
    } else {
      _finish(job, false, result?.message ?? 'RDP trả về lỗi không rõ');
    }
  } catch (err) {
    _finish(job, false, `Lỗi kết nối RDP (${node.name}): ${err.message}`);
  } finally {
    pool.release(node);
    // Try next job
    setImmediate(_dispatch);
  }
}

function _finish(job, ok, msg) {
  job.status = ok ? 'done' : 'failed';
  job.resultMsg = msg;
  _notifyFn?.(job);
}
