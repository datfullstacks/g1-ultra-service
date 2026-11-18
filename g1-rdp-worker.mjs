/**
 * G1 RDP Worker — chạy trên mỗi RDP node
 * Nhận POST /job từ g1-ultra-service, dùng Multilogin launch browser + Playwright automation
 *
 * Deploy: copy file này lên RDP, chạy: node g1-rdp-worker.mjs
 * Env: PORT (default 8787), MLX_LAUNCHER_URL, MLX_API_URL, MLX_TOKEN, MLX_FOLDER_ID
 */

import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { chromium } from 'playwright';

// Inline inject script — copy của extension inject.js, inject vào MAIN world trước page load
// Playwright addInitScript chạy trong MAIN world, tương đương extension world: MAIN
const G1_INJECT_INLINE = `(${function() {
  if (window.__G1_PK_HOOKED) return;
  window.__G1_PK_HOOKED = true;
  const PREFIX = "subs:com.google.android.apps.subscriptions.red:";
  const YT_SKU = "g1.youtube_premium_individual_add_on";
  const TOKENS = {
    ultra20tb_12m:"AYrTWi65Jbm3KRubLXLLA3Re29zKibSnRbvAJEPfxEIVs/d57w8vEhsU7hSkSAfGyjZH8B7/5aj5UTlidbsEwUH8aPN2RTA6pKiltA==",
    ultra20tb_6m:"AYrTWi6lMoHTB2cVb1VC+i3DHvfp1Q9VGblBeF9b1+O8e5+kNws87YdcgNEUJOuHJDp/mitKx1KmBCYurbXIubpM50o4AqgcBB3gMGk85mQ=",
    ultra20tb_3m:"AYrTWi6sldhCH+REVXA3inXWB+LuAvtnSPYHMvhbqKmv3TRdQPhoynS4ZTLxPEiaNGnaAmDTqliYzrLwJ3Aq49Vi9ktjNP+xcTF5R9Yn1MQ=",
    ultra20tb_1m:"AYrTWi5QWD5gc0ZxMJHAAUvXbYRFJgI6w5vnF9PKIFg1DFQML36iijrmN5Vum7u9ty2JnHvt9JFLgsfGKwScJcfZaKttqn0hSX4Fnpdn9No=",
    ultra30tb_12m:"AYrTWi51Eo3HG0tq1J6SYr4u3FDCCxb6xSEEWHskaFwSA7Vn4y+Lfqlfy+Lbkx2T/xPi4uCRB71ZIn+weD0kHZsMgS6ogUiZ8hG9SA==",
    ultra30tb_6m:"AYrTWi5hXUkLGa1e7nBstxl4Z3cUcYWzHF38Xks304ClJj8yVxeFCwDg/pJg82w8w9xHsk8Wl5WNhYKk26LB9besC0kYJ6AvlXapJA==",
    ultra30tb_3m:"AYrTWi4iJ8AzqZkDL53g/dcS7g93mZgiEBJANI0lOucBiUITWEYqCiwLsIXY7P62rmMWb+wFR4WW9tQlFrskR67oCzzwVHghPSs29w==",
    ultra30tb_1m:"AYrTWi7nBQ2Zn0z4s+QJOwg9kQRwH3+z+HXpzRqw9IIU4/C48vPvjH32Bub8SHrWq3YX+yI4g1wJgviYiLCobJNqc9DqRd9WZnDdaQ==",
    yt:"AVbCH/eW4Nfp8KBl0zlm7x9PhaiCvpnqwUuL2D8NFPBQgmM9+HuYS1h2xH5lLWU/BsBj775LK5GqK8UHKqoSzhDDz+PqP3paNesqLU0r9i6XCrYa"
  };
  const SKUS={ultra20tb_12m:"g1.play.20tb",ultra20tb_6m:"g1.play.20tb",ultra20tb_3m:"g1.play.20tb",ultra20tb_1m:"g1.play.20tb",ultra30tb_12m:"g1.play.ai.pro",ultra30tb_6m:"g1.play.ai.pro",ultra30tb_3m:"g1.play.ai.pro",ultra30tb_1m:"g1.play.ai.pro"};
  let currentTest=null,subId=null;
  function makeItem(s,t){return[[PREFIX+s,21],null,null,null,1,[t]]}
  function makeCfg(p,_,o){const s=SKUS[p],t=(o&&String(o).trim())||TOKENS[p];if(!s||!t)return null;return{name:"g1pk_"+p,presetId:p,full_items:[makeItem(s,t),makeItem(YT_SKU,TOKENS.yt)],ear8:null}}
  function patchNode(node){if(!Array.isArray(node)||!currentTest||!Array.isArray(currentTest.full_items))return false;let p=false;if(node.length>12&&Array.isArray(node[12])){if(Array.isArray(node[7])&&Array.isArray(node[7][5])&&node[7][5].length>0)subId=node[7][5][0];node[12]=currentTest.full_items;const mode=(currentTest.ear8&&currentTest.ear8[1])||5;if(currentTest.ear8)node[7]=currentTest.ear8;else if(Array.isArray(node[7])&&Array.isArray(node[7][5])&&node[7][5].length>0)node[7][1]=mode;else if(subId)node[7]=[null,mode,null,null,null,[subId]];p=true}if(node.length>10&&Array.isArray(node[10])&&Array.isArray(node[10][0])){node[10]=[currentTest.full_items];if(Array.isArray(node[2])&&Array.isArray(node[2][2])&&Array.isArray(node[2][2][8]))node[2][2][8]=[currentTest.full_items];if(currentTest.ear8)node[6]=currentTest.ear8;p=true}return p}
  function rewriteFreq(b){if(typeof b!=="string"||!b.includes("f.req=")||!currentTest)return b;try{const parts=b.split("&");for(let i=0;i<parts.length;i++){if(parts[i].startsWith("f.req=")){const raw=decodeURIComponent(parts[i].slice(6).replace(/\\+/g," "));const outer=JSON.parse(raw);let changed=false;if(Array.isArray(outer)){for(const g of outer){if(!Array.isArray(g))continue;for(const c of g){if(Array.isArray(c)&&c[0]==="Ngbm"&&typeof c[1]==="string"){const pl=JSON.parse(c[1]);if(Array.isArray(pl)){if(patchNode(pl[0]))changed=true;if(patchNode(pl[1]))changed=true}if(changed)c[1]=JSON.stringify(pl)}}}}if(changed){parts[i]="f.req="+encodeURIComponent(JSON.stringify(outer));return parts.join("&")}}}}catch(e){}return b}
  const origSend=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.send=function(b){try{if(typeof b==="string"&&b.includes("Ngbm"))b=rewriteFreq(b)}catch(e){}return origSend.call(this,b)};
  window.addEventListener("message",(ev)=>{const d=ev.data;if(!d||d.__g1pk!==1)return;if(d.type==="cfg"){currentTest=makeCfg(d.presetId,d.includeYt,d.token);window.__G1_PK_STATE={presetId:d.presetId||"",mounted:!!currentTest}}});
  currentTest=makeCfg("ultra20tb_12m",true,"");window.__G1_PK_STATE={presetId:"ultra20tb_12m",mounted:true};
}.toString()})()`;

const PORT = process.env.PORT || '8787';
const MLX_LAUNCHER = (process.env.MLX_LAUNCHER_URL || 'http://127.0.0.1:35000').replace(/\/$/, '');
const MLX_API = (process.env.MLX_API_URL || 'https://api.multilogin.com').replace(/\/$/, '');
const MLX_TOKEN = process.env.MLX_TOKEN || process.env.MULTILOGIN_AGENT_TOKEN || '';
const MLX_FOLDER_ID = process.env.MLX_FOLDER_ID || '';
const JOB_TIMEOUT_MS = Number(process.env.G1_JOB_TIMEOUT_MS || 180_000);

// ─── Multilogin helpers ────────────────────────────────────────────────────────

async function mlxHeaders() {
  if (!MLX_TOKEN) return { 'Content-Type': 'application/json' };
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MLX_TOKEN}` };
}

async function mlxCreateQuickProfile() {
  const res = await fetch(`${MLX_API}/api/v2/profile`, {
    method: 'POST',
    headers: await mlxHeaders(),
    body: JSON.stringify({
      browser_type: 'mimic',
      os_type: 'windows',
      name: `g1-auto-${Date.now()}`,
      folder_id: MLX_FOLDER_ID || undefined,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`MLX create profile ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return String(data?.data?.profile_id || data?.profile_id || '');
}

async function mlxStartProfile(profileId) {
  const res = await fetch(`${MLX_LAUNCHER}/api/v2/profile/start?profile_id=${profileId}`, {
    method: 'GET',
    headers: await mlxHeaders(),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`MLX start ${res.status}: ${await res.text()}`);
  const data = await res.json();
  // Returns CDP ws endpoint
  const ws = data?.data?.ws || data?.ws || '';
  if (!ws) throw new Error(`MLX start returned no ws endpoint: ${JSON.stringify(data)}`);
  return ws;
}

async function mlxStopProfile(profileId) {
  try {
    await fetch(`${MLX_LAUNCHER}/api/v2/profile/stop?profile_id=${profileId}`, {
      method: 'GET', headers: await mlxHeaders(), signal: AbortSignal.timeout(10_000),
    });
  } catch { /* best effort */ }
}

async function mlxDeleteProfile(profileId) {
  try {
    await fetch(`${MLX_API}/api/v2/profile/${profileId}`, {
      method: 'DELETE', headers: await mlxHeaders(), signal: AbortSignal.timeout(10_000),
    });
  } catch { /* best effort */ }
}

// ─── TOTP helper ──────────────────────────────────────────────────────────────

function totpCode(secret) {
  if (!secret) return '';
  // RFC 6238 TOTP — no external dep
  const key = secret.replace(/\s/g, '').toUpperCase();
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, val = 0;
  const bytes = [];
  for (const ch of key) {
    const idx = base32Chars.indexOf(ch);
    if (idx === -1) continue;
    val = (val << 5) | idx;
    bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((val >> bits) & 0xff); }
  }
  const keyBuf = Buffer.from(bytes);
  const counter = BigInt(Math.floor(Date.now() / 30_000));
  const counterBuf = Buffer.allocUnsafe(8);
  counterBuf.writeBigInt64BE(counter);
  const hmac = createHmac('sha1', keyBuf).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset+1] << 16 | hmac[offset+2] << 8 | hmac[offset+3]) % 1_000_000;
  return String(code).padStart(6, '0');
}

// ─── Playwright automation ────────────────────────────────────────────────────

async function runG1Automation({ wsEndpoint, email, password, secret, presetId }) {
  const browser = await chromium.connectOverCDP(wsEndpoint);
  const ctx = browser.contexts()[0] || await browser.newContext();
  const page = ctx.pages()[0] || await ctx.newPage();

  try {
    // 1. Navigate to Google login
    await page.goto('https://accounts.google.com', { timeout: 30_000, waitUntil: 'domcontentloaded' });

    // 2. Login if needed
    const needsLogin = await page.$('input[type="email"]').then(Boolean).catch(() => false);
    if (needsLogin) {
      await page.fill('input[type="email"]', email);
      await page.click('#identifierNext button, [id="identifierNext"]');
      await page.waitForSelector('input[type="password"]', { timeout: 15_000 });
      await page.fill('input[type="password"]', password);
      await page.click('#passwordNext button, [id="passwordNext"]');
      await page.waitForTimeout(2500);

      // 2FA
      const totp = await page.$('input[name="totpPin"], input[id="totpPin"]').catch(() => null);
      if (totp && secret) {
        const code = await totpCode(secret);
        if (code) {
          await page.fill('input[name="totpPin"], input[id="totpPin"]', code);
          await page.click('#totpNext button').catch(() => page.keyboard.press('Enter'));
        }
      }
      await page.waitForTimeout(2000);
    }

    // 3. Navigate to Google One store với inject script
    const storeUrl = 'https://one.google.com/about/plans';
    const newPage = await ctx.newPage();

    // Inject G1 hook script vào MAIN world trước khi page load
    await newPage.addInitScript(G1_INJECT_INLINE);

    await newPage.goto(storeUrl, { timeout: 30_000, waitUntil: 'domcontentloaded' });

    // 4. Set preset
    await newPage.evaluate((pid) => {
      window.postMessage({ __g1pk: 1, type: 'cfg', presetId: pid, includeYt: true }, '*');
    }, presetId);

    // 5. Click plan button
    const planSelectors = [
      `[data-sku*="20tb"], [data-sku*="30tb"]`,
      'button:has-text("Mua"), button:has-text("Buy"), button:has-text("Get")',
      '[aria-label*="subscribe"], [aria-label*="buy"]',
    ];
    let clicked = false;
    for (const sel of planSelectors) {
      const btn = await newPage.$(sel).catch(() => null);
      if (btn) { await btn.click(); clicked = true; break; }
    }
    if (!clicked) {
      await newPage.click('text="100 GB"').catch(() => null);
    }

    await newPage.waitForTimeout(2000);

    // 6. Wait for checkout / confirmation
    // Extension rewrite XHR → Google One checkout $0
    // Confirm purchase button
    const confirmSelectors = [
      'button:has-text("Subscribe"), button:has-text("Đăng ký")',
      'button:has-text("Confirm"), button:has-text("Xác nhận")',
      'button:has-text("Buy"), button:has-text("Purchase")',
      '[jsname="LgbsSe"]:has-text("Subscribe")',
    ];
    let confirmed = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      for (const sel of confirmSelectors) {
        const btn = await newPage.$(sel).catch(() => null);
        if (btn && await btn.isVisible().catch(() => false)) {
          await btn.click();
          confirmed = true;
          break;
        }
      }
      if (confirmed) break;
      await newPage.waitForTimeout(1000);
    }

    // 7. Wait for success indicator
    await newPage.waitForTimeout(3000);
    const bodyText = await newPage.innerText('body').catch(() => '');
    const success = /subscrib|đăng ký thành công|activated|thank you|cảm ơn/i.test(bodyText);

    return { ok: success, message: success ? `Google One Ultra ${presetId} activated` : `Checkout completed (verify manually)` };
  } finally {
    await page.close().catch(() => null);
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

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    return json(res, 200, { ok: true, service: 'g1-rdp-worker' });
  }

  // Healthcheck compat với rdp-pool.mjs (check /api/v1/version)
  if (req.method === 'GET' && req.url === '/api/v1/version') {
    return json(res, 200, { version: 'g1-rdp-worker/1.0' });
  }

  if (req.method !== 'POST' || req.url !== '/job') {
    return json(res, 404, { error: 'not found' });
  }

  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: 'bad body' }); }

  const { email, password, secret = '', presetId, proxy } = body;
  if (!email || !password || !presetId) {
    return json(res, 400, { error: 'missing: email, password, presetId' });
  }

  let profileId = '';
  let wsEndpoint = '';

  try {
    // Create + launch Multilogin profile
    profileId = await mlxCreateQuickProfile();
    wsEndpoint = await mlxStartProfile(profileId);

    // Run automation with timeout
    const result = await Promise.race([
      runG1Automation({ wsEndpoint, email, password, secret, presetId }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Job timeout')), JOB_TIMEOUT_MS)),
    ]);

    json(res, 200, result);
  } catch (err) {
    console.error('[g1-worker] job failed:', err.message);
    json(res, 200, { ok: false, message: err.message });
  } finally {
    if (profileId) {
      await mlxStopProfile(profileId);
      await mlxDeleteProfile(profileId);
    }
  }
});

server.listen(PORT, () => {
  console.log(`[g1-rdp-worker] listening :${PORT}`);
});
