import { randomUUID } from 'node:crypto';
import { activateG1 } from './g1-activate.mjs';

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
    const result = await activateG1({
      email: job.email,
      password: job.password,
      secret: job.secret,
      presetId,
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
