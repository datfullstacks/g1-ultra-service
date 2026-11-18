/**
 * RDP Pool — dispatch job đến RDP 10-15 qua Railway private network
 * Multilogin agent chạy sẵn trên port 8787 mỗi RDP
 */

const RDP_NAMES = [
  'railway-linux-rdp-10',
  'railway-linux-rdp-11',
  'railway-linux-rdp-12',
  'railway-linux-rdp-13',
  'railway-linux-rdp-14',
  'railway-linux-rdp-15',
];

const ML_AGENT_PORT = process.env.MULTILOGIN_AGENT_PORT || '8787';
const AGENT_TIMEOUT_MS = Number(process.env.MULTILOGIN_AGENT_CLI_TIMEOUT_MS || 120_000);

function rdpBaseUrl(name) {
  // Railway inject RAILWAY_SERVICE_<NAME>_URL — dùng nếu có
  const envKey = 'RAILWAY_SERVICE_' + name.toUpperCase().replaceAll('-', '_') + '_URL';
  if (process.env[envKey]) return process.env[envKey].replace(/\/$/, '');
  // Fallback: Railway private DNS
  return `http://${name}.railway.internal:${ML_AGENT_PORT}`;
}

class RDPNode {
  constructor(name) {
    this.name = name;
    this.baseUrl = rdpBaseUrl(name);
    this.busy = false;
    this.healthy = true;
    this.jobsDone = 0;
  }

  async healthCheck() {
    try {
      const { default: fetch } = await import('node-fetch');
      // g1-rdp-worker expose /healthz; Multilogin expose /api/v1/version — thử cả hai
      const res = await fetch(`${this.baseUrl}/healthz`, { signal: AbortSignal.timeout(5000) })
        .catch(() => fetch(`${this.baseUrl}/api/v1/version`, { signal: AbortSignal.timeout(5000) }));
      this.healthy = res.ok;
    } catch {
      this.healthy = false;
    }
    return this.healthy;
  }

  async runJob(payload) {
    const { default: fetch } = await import('node-fetch');
    const res = await fetch(`${this.baseUrl}/job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`RDP HTTP ${res.status}`);
    return res.json();
  }
}

class RDPPool {
  constructor() {
    this._nodes = RDP_NAMES.map(n => new RDPNode(n));
    this._waiters = [];
  }

  _tryAcquire() {
    return this._nodes.find(n => !n.busy && n.healthy) ?? null;
  }

  acquire(timeoutMs = 600_000) {
    const node = this._tryAcquire();
    if (node) { node.busy = true; return Promise.resolve(node); }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._waiters = this._waiters.filter(w => w !== entry);
        reject(new Error('RDP pool timeout — tất cả RDP bận'));
      }, timeoutMs);

      const entry = { resolve, timer };
      this._waiters.push(entry);
    });
  }

  release(node) {
    node.busy = false;
    node.jobsDone++;
    // Wake up first waiter
    const waiter = this._waiters.shift();
    if (waiter) {
      clearTimeout(waiter.timer);
      node.busy = true;
      waiter.resolve(node);
    }
  }

  async healthCheckAll() {
    await Promise.all(this._nodes.map(n => n.healthCheck()));
  }

  status() {
    return this._nodes.map(n => ({
      name: n.name,
      url: n.baseUrl,
      busy: n.busy,
      healthy: n.healthy,
      jobsDone: n.jobsDone,
    }));
  }

  availableCount() {
    return this._nodes.filter(n => !n.busy && n.healthy).length;
  }
}

export const pool = new RDPPool();
