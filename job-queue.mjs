import { randomUUID } from 'node:crypto';

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

// RDP worker URLs — g1-rdp-worker chạy trên RDP, accessible qua private network
const WORKER_PORT = process.env.G1_WORKER_PORT || '8788';
const WORKER_TIMEOUT = Number(process.env.G1_JOB_TIMEOUT_MS || 180_000);

function buildWorkerUrls() {
  return [10,11,12,13,14,15]
    .map(n => process.env[`RAILWAY_SERVICE_RAILWAY_LINUX_RDP_${n}_URL`])
    .filter(Boolean)
    .map(u => {
      const name = u.replace(/^https?:\/\//, '').split('.')[0];
      return `http://${name}.railway.internal:${WORKER_PORT}`;
    });
}

const WORKER_URLS = buildWorkerUrls();
let _workerIdx = 0;

async function callWorker(payload) {
  if (!WORKER_URLS.length) throw new Error('Không có RDP worker URL — cần RAILWAY_SERVICE_RAILWAY_LINUX_RDP_*_URL');
  const url = WORKER_URLS[_workerIdx % WORKER_URLS.length];
  _workerIdx++;
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(`${url}/job`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(WORKER_TIMEOUT + 5_000),
  });
  if (!res.ok) throw new Error(`Worker HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

const jobs = new Map();
const queue = [];
let _notifyFn = null;

export function setNotify(fn) { _notifyFn = fn; }

export function createJob({ userId, email, password, secret, sku, months, proxy = null }) {
  return {
    jobId: randomUUID(),
    userId, email, password, secret, sku, months, proxy,
    status: 'queued',
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

async function _dispatch() {
  const job = queue.find(j => j.status === 'queued');
  if (!job) return;

  const presetId = PRESET_MAP[`${job.sku.toLowerCase()}:${job.months}`];
  if (!presetId) {
    _finish(job, false, `Preset không tồn tại: ${job.sku} ${job.months}m`);
    return;
  }

  queue.splice(queue.indexOf(job), 1);
  job.status = 'processing';

  try {
    const result = await callWorker({
      email: job.email,
      password: job.password,
      secret: job.secret,
      presetId,
      proxy: job.proxy,
    });
    _finish(job, result?.ok, result?.message ?? (result?.ok ? 'Activated' : 'Activation thất bại'));
  } catch (err) {
    _finish(job, false, `Error: ${err.message}`);
  } finally {
    setImmediate(_dispatch);
  }
}

function _finish(job, ok, msg) {
  job.status = ok ? 'done' : 'failed';
  job.resultMsg = msg;
  _notifyFn?.(job);
}
