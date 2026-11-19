/**
 * g1-rdp-worker.mjs — chạy trên RDP, nhận job từ g1-ultra-service
 * Env: MULTILOGIN_AGENT_TOKEN, PORT=8788
 */
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { chromium } from 'playwright-core';

const PORT = process.env.PORT || '8788';
const AGENT_TOKEN = process.env.MULTILOGIN_AGENT_TOKEN || '';
const AGENT_URL = `http://127.0.0.1:${process.env.MULTILOGIN_AGENT_PORT || '8787'}`;
const JOB_TIMEOUT = Number(process.env.G1_JOB_TIMEOUT_MS || 180_000);

const AGENT_HEADERS = { 'Content-Type': 'application/json', 'x-agent-token': AGENT_TOKEN };

// ─── G1 inject ────────────────────────────────────────────────────────────────

const G1_INJECT = `(${function () {
  if (window.__G1_PK_HOOKED) return;
  window.__G1_PK_HOOKED = true;
  const PREFIX = 'subs:com.google.android.apps.subscriptions.red:';
  const YT_SKU = 'g1.youtube_premium_individual_add_on';
  const TOKENS = {
    ultra20tb_12m: 'AYrTWi65Jbm3KRubLXLLA3Re29zKibSnRbvAJEPfxEIVs/d57w8vEhsU7hSkSAfGyjZH8B7/5aj5UTlidbsEwUH8aPN2RTA6pKiltA==',
    ultra20tb_6m:  'AYrTWi6lMoHTB2cVb1VC+i3DHvfp1Q9VGblBeF9b1+O8e5+kNws87YdcgNEUJOuHJDp/mitKx1KmBCYurbXIubpM50o4AqgcBB3gMGk85mQ=',
    ultra20tb_3m:  'AYrTWi6sldhCH+REVXA3inXWB+LuAvtnSPYHMvhbqKmv3TRdQPhoynS4ZTLxPEiaNGnaAmDTqliYzrLwJ3Aq49Vi9ktjNP+xcTF5R9Yn1MQ=',
    ultra20tb_1m:  'AYrTWi5QWD5gc0ZxMJHAAUvXbYRFJgI6w5vnF9PKIFg1DFQML36iijrmN5Vum7u9ty2JnHvt9JFLgsfGKwScJcfZaKttqn0hSX4Fnpdn9No=',
    ultra30tb_12m: 'AYrTWi51Eo3HG0tq1J6SYr4u3FDCCxb6xSEEWHskaFwSA7Vn4y+Lfqlfy+Lbkx2T/xPi4uCRB71ZIn+weD0kHZsMgS6ogUiZ8hG9SA==',
    ultra30tb_6m:  'AYrTWi5hXUkLGa1e7nBstxl4Z3cUcYWzHF38Xks304ClJj8yVxeFCwDg/pJg82w8w9xHsk8Wl5WNhYKk26LB9besC0kYJ6AvlXapJA==',
    ultra30tb_3m:  'AYrTWi4iJ8AzqZkDL53g/dcS7g93mZgiEBJANI0lOucBiUITWEYqCiwLsIXY7P62rmMWb+wFR4WW9tQlFrskR67oCzzwVHghPSs29w==',
    ultra30tb_1m:  'AYrTWi7nBQ2Zn0z4s+QJOwg9kQRwH3+z+HXpzRqw9IIU4/C48vPvjH32Bub8SHrWq3YX+yI4g1wJgviYiLCobJNqc9DqRd9WZnDdaQ==',
    yt: 'AVbCH/eW4Nfp8KBl0zlm7x9PhaiCvpnqwUuL2D8NFPBQgmM9+HuYS1h2xH5lLWU/BsBj775LK5GqK8UHKqoSzhDDz+PqP3paNesqLU0r9i6XCrYa',
  };
  const SKUS = { ultra20tb_12m: 'g1.play.20tb', ultra20tb_6m: 'g1.play.20tb', ultra20tb_3m: 'g1.play.20tb', ultra20tb_1m: 'g1.play.20tb', ultra30tb_12m: 'g1.play.ai.pro', ultra30tb_6m: 'g1.play.ai.pro', ultra30tb_3m: 'g1.play.ai.pro', ultra30tb_1m: 'g1.play.ai.pro' };
  let currentTest = null, subId = null;
  function makeItem(s, t) { return [[PREFIX + s, 21], null, null, null, 1, [t]]; }
  function makeCfg(p, _, o) { const s = SKUS[p], t = (o && String(o).trim()) || TOKENS[p]; if (!s || !t) return null; return { name: 'g1pk_' + p, presetId: p, full_items: [makeItem(s, t), makeItem(YT_SKU, TOKENS.yt)], ear8: null }; }
  function patchNode(node) { if (!Array.isArray(node) || !currentTest || !Array.isArray(currentTest.full_items)) return false; let p = false; if (node.length > 12 && Array.isArray(node[12])) { if (Array.isArray(node[7]) && Array.isArray(node[7][5]) && node[7][5].length > 0) subId = node[7][5][0]; node[12] = currentTest.full_items; const mode = (currentTest.ear8 && currentTest.ear8[1]) || 5; if (currentTest.ear8) node[7] = currentTest.ear8; else if (Array.isArray(node[7]) && Array.isArray(node[7][5]) && node[7][5].length > 0) node[7][1] = mode; else if (subId) node[7] = [null, mode, null, null, null, [subId]]; p = true; } if (node.length > 10 && Array.isArray(node[10]) && Array.isArray(node[10][0])) { node[10] = [currentTest.full_items]; if (Array.isArray(node[2]) && Array.isArray(node[2][2]) && Array.isArray(node[2][2][8])) node[2][2][8] = [currentTest.full_items]; if (currentTest.ear8) node[6] = currentTest.ear8; p = true; } return p; }
  function rewriteFreq(b) { if (typeof b !== 'string' || !b.includes('f.req=') || !currentTest) return b; try { const parts = b.split('&'); for (let i = 0; i < parts.length; i++) { if (parts[i].startsWith('f.req=')) { const raw = decodeURIComponent(parts[i].slice(6).replace(/\+/g, ' ')); const outer = JSON.parse(raw); let changed = false; if (Array.isArray(outer)) { for (const g of outer) { if (!Array.isArray(g)) continue; for (const c of g) { if (Array.isArray(c) && c[0] === 'Ngbm' && typeof c[1] === 'string') { const pl = JSON.parse(c[1]); if (Array.isArray(pl)) { if (patchNode(pl[0])) changed = true; if (patchNode(pl[1])) changed = true; } if (changed) c[1] = JSON.stringify(pl); } } } } if (changed) { parts[i] = 'f.req=' + encodeURIComponent(JSON.stringify(outer)); return parts.join('&'); } } } } catch (e) { } return b; }
  const origSend = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function (b) { try { if (typeof b === 'string' && b.includes('Ngbm')) b = rewriteFreq(b); } catch (e) { } return origSend.call(this, b); };
  window.addEventListener('message', (ev) => { const d = ev.data; if (!d || d.__g1pk !== 1) return; if (d.type === 'cfg') { currentTest = makeCfg(d.presetId, d.includeYt, d.token); window.__G1_PK_STATE = { presetId: d.presetId || '', mounted: !!currentTest }; } });
  currentTest = makeCfg('ultra20tb_12m', true, ''); window.__G1_PK_STATE = { presetId: 'ultra20tb_12m', mounted: true };
}.toString()})()`;

// ─── TOTP ─────────────────────────────────────────────────────────────────────

function totpNow(secret) {
  if (!secret) return '';
  const key = secret.replace(/\s/g, '').toUpperCase();
  const b32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, val = 0;
  const bytes = [];
  for (const ch of key) {
    const idx = b32.indexOf(ch);
    if (idx === -1) continue;
    val = (val << 5) | idx;
    bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((val >> bits) & 0xff); }
  }
  const keyBuf = Buffer.from(bytes);
  const counter = BigInt(Math.floor(Date.now() / 30_000));
  const cb = Buffer.allocUnsafe(8);
  cb.writeBigInt64BE(counter);
  const hmac = createHmac('sha1', keyBuf).update(cb).digest();
  const off = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[off] & 0x7f) << 24 | hmac[off+1] << 16 | hmac[off+2] << 8 | hmac[off+3]) % 1_000_000;
  return String(code).padStart(6, '0');
}

// ─── Multilogin agent job API ─────────────────────────────────────────────────

async function agentPost(path, body) {
  const res = await fetch(`${AGENT_URL}${path}`, {
    method: 'POST',
    headers: AGENT_HEADERS,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Agent ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function agentGet(path) {
  const res = await fetch(`${AGENT_URL}${path}`, {
    headers: AGENT_HEADERS,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Agent GET ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function startSession() {
  // Submit quick profile job
  const { job } = await agentPost('/v1/jobs', {
    type: 'profile.quick.start',
    payload: { browserType: 'mimic', osType: 'windows', automation: 'playwright', headless: false },
  });

  // Poll job đến completed
  for (let i = 0; i < 30; i++) {
    const { job: j } = await agentGet(`/v1/jobs/${job.id}`);
    if (j.status === 'succeeded' || j.status === 'completed') {
      const session = j.result;
      return { sessionId: session.sessionId, cdpUrl: `${AGENT_URL}${session.connectionPath}` };
    }
    if (j.status === 'failed' || j.status === 'cancelled') throw new Error(`Quick profile failed: ${JSON.stringify(j.error)}`);
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Quick profile job timed out');
}

async function stopSession(sessionId) {
  try {
    await agentPost('/v1/jobs', { type: 'profile.stop', payload: { sessionId } });
  } catch { }
}

// ─── Automation ───────────────────────────────────────────────────────────────

async function runAutomation(cdpUrl, { email, password, secret, presetId }) {
  const browser = await chromium.connectOverCDP(cdpUrl);
  const ctx = browser.contexts()[0] || await browser.newContext();
  try {
    const loginPage = ctx.pages()[0] || await ctx.newPage();
    await loginPage.goto('https://accounts.google.com', { timeout: 30_000, waitUntil: 'domcontentloaded' });

    const needLogin = await loginPage.$('input[type="email"]').then(Boolean).catch(() => false);
    if (needLogin) {
      await loginPage.fill('input[type="email"]', email);
      await loginPage.click('#identifierNext button, [id="identifierNext"]');
      await loginPage.waitForSelector('input[type="password"]', { timeout: 15_000 });
      await loginPage.fill('input[type="password"]', password);
      await loginPage.click('#passwordNext button, [id="passwordNext"]');
      await loginPage.waitForTimeout(2500);
      const totpInput = await loginPage.$('input[name="totpPin"], input[id="totpPin"]').catch(() => null);
      if (totpInput && secret) {
        const code = totpNow(secret);
        if (code) {
          await loginPage.fill('input[name="totpPin"], input[id="totpPin"]', code);
          await loginPage.click('#totpNext button').catch(() => loginPage.keyboard.press('Enter'));
          await loginPage.waitForTimeout(2000);
        }
      }
    }

    // Dùng cùng page sau login để giữ cookie session
    const storePage = loginPage;
    await ctx.addInitScript(G1_INJECT); // inject vào toàn context
    await storePage.goto('https://one.google.com/about/plans', { timeout: 30_000, waitUntil: 'domcontentloaded' });
    await storePage.evaluate((pid) => {
      window.postMessage({ __g1pk: 1, type: 'cfg', presetId: pid, includeYt: true }, '*');
    }, presetId);
    await storePage.waitForTimeout(1000);

    for (const sel of [`[data-sku*="20tb"],[data-sku*="30tb"]`, 'button:has-text("Mua"),button:has-text("Buy"),button:has-text("Get")', '[aria-label*="subscribe"],[aria-label*="buy"]']) {
      const btn = await storePage.$(sel).catch(() => null);
      if (btn) { await btn.click(); break; }
    }
    await storePage.waitForTimeout(2000);

    for (let i = 0; i < 15; i++) {
      for (const sel of ['button:has-text("Subscribe"),button:has-text("Đăng ký")', 'button:has-text("Confirm"),button:has-text("Xác nhận")', '[jsname="LgbsSe"]']) {
        const btn = await storePage.$(sel).catch(() => null);
        if (btn && await btn.isVisible().catch(() => false)) { await btn.click(); break; }
      }
      await storePage.waitForTimeout(1000);
    }

    await storePage.waitForTimeout(3000);
    const bodyText = await storePage.innerText('body').catch(() => '');
    const url = storePage.url();
    console.log(`[g1-worker] page url: ${url}`);
    console.log(`[g1-worker] body snippet: ${bodyText.slice(0, 300).replace(/\n/g, ' ')}`);
    const ok = /subscrib|đăng ký thành công|activated|thank you|cảm ơn/i.test(bodyText);
    return { ok, message: ok ? `Google One Ultra ${presetId} activated` : `Checkout completed — url: ${url}` };
  } finally {
    await browser.close().catch(() => {});
  }
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    return json(res, 200, { ok: true, service: 'g1-rdp-worker' });
  }
  if (req.method !== 'POST' || req.url !== '/job') {
    return json(res, 404, { error: 'not found' });
  }

  const body = await readBody(req).catch(() => ({}));
  const { email, password, secret = '', presetId } = body;
  if (!email || !password || !presetId) {
    return json(res, 400, { error: 'missing: email, password, presetId' });
  }

  let sessionId = '';
  try {
    const { sessionId: sid, cdpUrl } = await startSession();
    sessionId = sid;
    const result = await Promise.race([
      runAutomation(cdpUrl, { email, password, secret, presetId }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Job timeout')), JOB_TIMEOUT)),
    ]);
    json(res, 200, result);
  } catch (err) {
    console.error('[g1-worker] job failed:', err.message);
    json(res, 200, { ok: false, message: err.message });
  } finally {
    await stopSession(sessionId);
  }
}).listen(PORT, () => console.log(`[g1-rdp-worker] listening :${PORT}`));
