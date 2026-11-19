import { createHmac } from 'node:crypto';
import { chromium } from 'playwright-core';

// ─── Config ───────────────────────────────────────────────────────────────────

const MLX_API     = (process.env.MLX_API_URL     || 'https://api.multilogin.com').replace(/\/$/, '');
const MLX_TOKEN   = process.env.MLX_TOKEN || process.env.MULTILOGIN_AGENT_TOKEN || '';
const MLX_FOLDER  = process.env.MLX_FOLDER_ID || '';

// RDP-10 launcher accessible via Railway private network
const RDP_URLS = [
  process.env.RAILWAY_SERVICE_RAILWAY_LINUX_RDP_10_URL,
  process.env.RAILWAY_SERVICE_RAILWAY_LINUX_RDP_11_URL,
  process.env.RAILWAY_SERVICE_RAILWAY_LINUX_RDP_12_URL,
  process.env.RAILWAY_SERVICE_RAILWAY_LINUX_RDP_13_URL,
  process.env.RAILWAY_SERVICE_RAILWAY_LINUX_RDP_14_URL,
  process.env.RAILWAY_SERVICE_RAILWAY_LINUX_RDP_15_URL,
].filter(Boolean);

// Multilogin launcher port trên mỗi RDP
const MLX_PORT = process.env.MULTILOGIN_AGENT_PORT || '35000';

function rdpLauncherUrl(rdpServiceUrl) {
  // RAILWAY_SERVICE_*_URL = https://host:port — đổi sang http private port 35000
  const name = rdpServiceUrl.replace(/^https?:\/\//, '').split('.')[0];
  return `http://${name}.railway.internal:${MLX_PORT}`;
}

// ─── G1 inject script ─────────────────────────────────────────────────────────

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
  const code = ((hmac[off] & 0x7f) << 24 | hmac[off + 1] << 16 | hmac[off + 2] << 8 | hmac[off + 3]) % 1_000_000;
  return String(code).padStart(6, '0');
}

// ─── Multilogin API ───────────────────────────────────────────────────────────

const MLX_HEADERS = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MLX_TOKEN}` };

async function mlxCreateProfile() {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(`${MLX_API}/api/v1/profile`, {
    method: 'POST',
    headers: MLX_HEADERS,
    body: JSON.stringify({
      browser_type: 'mimic',
      os_type: 'windows',
      name: `g1-auto-${Date.now()}`,
      ...(MLX_FOLDER ? { folder_id: MLX_FOLDER } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`MLX create profile ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const profileId = data?.data?.id || data?.data?.profile_id || data?.profile_id || data?.id;
  if (!profileId) throw new Error(`MLX create: no profile_id in ${JSON.stringify(data)}`);
  return String(profileId);
}

async function mlxStartProfile(profileId, launcherUrl) {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(`${launcherUrl}/api/v1/profile/start?profile_id=${profileId}`, {
    headers: MLX_HEADERS,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`MLX start ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const ws = data?.data?.ws || data?.ws;
  if (!ws) throw new Error(`MLX start: no ws endpoint in ${JSON.stringify(data)}`);
  return String(ws);
}

async function mlxStop(profileId, launcherUrl) {
  try {
    const { default: fetch } = await import('node-fetch');
    await fetch(`${launcherUrl}/api/v1/profile/stop?profile_id=${profileId}`, { headers: MLX_HEADERS, signal: AbortSignal.timeout(10_000) });
  } catch { }
}

async function mlxDelete(profileId) {
  try {
    const { default: fetch } = await import('node-fetch');
    await fetch(`${MLX_API}/api/v1/profile/${profileId}`, { method: 'DELETE', headers: MLX_HEADERS, signal: AbortSignal.timeout(10_000) });
  } catch { }
}

// Pick RDP launcher — round robin simple
let _rdpIdx = 0;
function pickLauncher() {
  if (!RDP_URLS.length) throw new Error('Không có RDP URL nào — set RAILWAY_SERVICE_RAILWAY_LINUX_RDP_*_URL');
  const url = RDP_URLS[_rdpIdx % RDP_URLS.length];
  _rdpIdx++;
  return rdpLauncherUrl(url);
}

// ─── Automation ───────────────────────────────────────────────────────────────

async function runAutomation(wsEndpoint, { email, password, secret, presetId }) {
  const browser = await chromium.connectOverCDP(wsEndpoint);
  const ctx = browser.contexts()[0] || await browser.newContext();

  try {
    // Login Google
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

      // 2FA
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

    // Google One store — new page với inject script
    const storePage = await ctx.newPage();
    await storePage.addInitScript(G1_INJECT);
    await storePage.goto('https://one.google.com/about/plans', { timeout: 30_000, waitUntil: 'domcontentloaded' });

    // Set preset
    await storePage.evaluate((pid) => {
      window.postMessage({ __g1pk: 1, type: 'cfg', presetId: pid, includeYt: true }, '*');
    }, presetId);
    await storePage.waitForTimeout(1000);

    // Click plan button
    const planSelectors = [
      `[data-sku*="20tb"], [data-sku*="30tb"]`,
      'button:has-text("Mua"), button:has-text("Buy"), button:has-text("Get")',
      '[aria-label*="subscribe"], [aria-label*="buy"]',
    ];
    for (const sel of planSelectors) {
      const btn = await storePage.$(sel).catch(() => null);
      if (btn) { await btn.click(); break; }
    }
    await storePage.waitForTimeout(2000);

    // Confirm checkout
    const confirmSelectors = [
      'button:has-text("Subscribe"), button:has-text("Đăng ký")',
      'button:has-text("Confirm"), button:has-text("Xác nhận")',
      '[jsname="LgbsSe"]',
    ];
    for (let i = 0; i < 15; i++) {
      for (const sel of confirmSelectors) {
        const btn = await storePage.$(sel).catch(() => null);
        if (btn && await btn.isVisible().catch(() => false)) {
          await btn.click();
          break;
        }
      }
      await storePage.waitForTimeout(1000);
    }

    await storePage.waitForTimeout(3000);
    const bodyText = await storePage.innerText('body').catch(() => '');
    const ok = /subscrib|đăng ký thành công|activated|thank you|cảm ơn/i.test(bodyText);
    return { ok, message: ok ? `Google One Ultra ${presetId} activated` : 'Checkout completed — verify manually' };

  } finally {
    await browser.close().catch(() => {});
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function activateG1({ email, password, secret = '', presetId, timeoutMs = 180_000 }) {
  const launcherUrl = pickLauncher();
  let profileId = '';
  try {
    profileId = await mlxCreateProfile();
    const wsEndpoint = await mlxStartProfile(profileId, launcherUrl);
    return await Promise.race([
      runAutomation(wsEndpoint, { email, password, secret, presetId }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Job timeout')), timeoutMs)),
    ]);
  } finally {
    if (profileId) {
      await mlxStop(profileId, launcherUrl);
      await mlxDelete(profileId);
    }
  }
}
