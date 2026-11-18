/**
 * G1 Activation — Playwright automation chạy trực tiếp trong g1-ultra-service
 * Dùng chromium headless + inject script thay extension
 */

import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';

// ─── TOTP ─────────────────────────────────────────────────────────────────────

function totpNow(secret) {
  if (!secret) return '';
  const key = secret.replace(/\s/g, '').toUpperCase();
  const base32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, val = 0;
  const bytes = [];
  for (const ch of key) {
    const idx = base32.indexOf(ch);
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

// ─── Inject script (rút gọn từ inject.js) ────────────────────────────────────

const INJECT_SCRIPT = `
(function(){
  if(window.__G1_PK_HOOKED)return;
  window.__G1_PK_HOOKED=true;
  const PRE="subs:com.google.android.apps.subscriptions.red:";
  const YT="g1.youtube_premium_individual_add_on";
  const TK={
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
  const SK={ultra20tb_12m:"g1.play.20tb",ultra20tb_6m:"g1.play.20tb",ultra20tb_3m:"g1.play.20tb",ultra20tb_1m:"g1.play.20tb",ultra30tb_12m:"g1.play.ai.pro",ultra30tb_6m:"g1.play.ai.pro",ultra30tb_3m:"g1.play.ai.pro",ultra30tb_1m:"g1.play.ai.pro"};
  let cur=null,sid=null;
  function mi(s,t){return[[PRE+s,21],null,null,null,1,[t]]}
  function mk(p,o){const s=SK[p],t=(o&&String(o).trim())||TK[p];if(!s||!t)return null;return{presetId:p,full_items:[mi(s,t),mi(YT,TK.yt)],ear8:null}}
  function patch(n){if(!Array.isArray(n)||!cur)return false;let p=false;if(n.length>12&&Array.isArray(n[12])){if(Array.isArray(n[7])&&Array.isArray(n[7][5])&&n[7][5].length>0)sid=n[7][5][0];n[12]=cur.full_items;const m=(cur.ear8&&cur.ear8[1])||5;if(cur.ear8)n[7]=cur.ear8;else if(Array.isArray(n[7])&&Array.isArray(n[7][5])&&n[7][5].length>0)n[7][1]=m;else if(sid)n[7]=[null,m,null,null,null,[sid]];p=true}if(n.length>10&&Array.isArray(n[10])&&Array.isArray(n[10][0])){n[10]=[cur.full_items];if(Array.isArray(n[2])&&Array.isArray(n[2][2])&&Array.isArray(n[2][2][8]))n[2][2][8]=[cur.full_items];if(cur.ear8)n[6]=cur.ear8;p=true}return p}
  function rw(b){if(typeof b!=="string"||!b.includes("f.req=")||!cur)return b;try{const ps=b.split("&");for(let i=0;i<ps.length;i++){if(ps[i].startsWith("f.req=")){const raw=decodeURIComponent(ps[i].slice(6).replace(/\\+/g," "));const o=JSON.parse(raw);let ch=false;if(Array.isArray(o)){for(const g of o){if(!Array.isArray(g))continue;for(const c of g){if(Array.isArray(c)&&c[0]==="Ngbm"&&typeof c[1]==="string"){const pl=JSON.parse(c[1]);if(Array.isArray(pl)){if(patch(pl[0]))ch=true;if(patch(pl[1]))ch=true}if(ch)c[1]=JSON.stringify(pl)}}}}if(ch){ps[i]="f.req="+encodeURIComponent(JSON.stringify(o));return ps.join("&")}}}}catch(e){}return b}
  const os=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.send=function(b){try{if(typeof b==="string"&&b.includes("Ngbm"))b=rw(b)}catch(e){}return os.call(this,b)};
  window.addEventListener("message",ev=>{const d=ev.data;if(!d||d.__g1pk!==1)return;if(d.type==="cfg"){cur=mk(d.presetId,d.token);window.__G1_PK_STATE={presetId:d.presetId||"",mounted:!!cur}}});
  cur=mk("ultra20tb_12m","");window.__G1_PK_STATE={presetId:"ultra20tb_12m",mounted:true};
})();
`;

// ─── Main activation function ─────────────────────────────────────────────────

export async function activateG1({ email, password, secret = '', presetId, timeoutMs = 180_000 }) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'vi-VN',
  });

  // Inject G1 hook vào mọi page trước khi load
  await ctx.addInitScript(INJECT_SCRIPT);

  const page = await ctx.newPage();

  try {
    // 1. Login Google
    await page.goto('https://accounts.google.com', { timeout: 30_000, waitUntil: 'domcontentloaded' });

    const emailInput = await page.$('input[type="email"]');
    if (emailInput) {
      await page.fill('input[type="email"]', email);
      await page.click('#identifierNext');
      await page.waitForSelector('input[type="password"]', { timeout: 15_000 });
      await page.fill('input[type="password"]', password);
      await page.click('#passwordNext');
      await page.waitForTimeout(3000);

      // 2FA nếu cần
      const totpInput = await page.$('input[name="totpPin"], input[id="totpPin"]').catch(() => null);
      if (totpInput && secret) {
        const code = totpNow(secret);
        if (code) {
          await page.fill('input[name="totpPin"], input[id="totpPin"]', code);
          await page.click('#totpNext').catch(() => page.keyboard.press('Enter'));
          await page.waitForTimeout(2000);
        }
      }
    }

    // 2. Navigate Google One plans
    await page.goto('https://one.google.com/about/plans', { timeout: 30_000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // 3. Set preset
    await page.evaluate((pid) => {
      window.postMessage({ __g1pk: 1, type: 'cfg', presetId: pid, includeYt: true }, '*');
    }, presetId);
    await page.waitForTimeout(500);

    // 4. Click plan button — tìm button phù hợp với plan
    const isTb30 = presetId.startsWith('ultra30tb');
    const planText = isTb30 ? ['5 TB', 'AI Premium', '30 TB', 'Pro'] : ['100 GB', '200 GB', '2 TB', '20 TB'];
    let clicked = false;
    for (const txt of planText) {
      const btn = await page.locator(`button:has-text("${txt}")`).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      // Fallback: click first subscribe button
      const sub = await page.locator('button:has-text("Subscribe"), button:has-text("Đăng ký")').first();
      if (await sub.isVisible().catch(() => false)) {
        await sub.click();
        clicked = true;
      }
    }

    await page.waitForTimeout(2000);

    // 5. Confirm checkout (extension đã inject → $0)
    const confirmBtns = [
      'button:has-text("Subscribe")',
      'button:has-text("Đăng ký")',
      'button:has-text("Confirm")',
      'button:has-text("Buy")',
      '[jsname="LgbsSe"]',
    ];

    let confirmed = false;
    for (let i = 0; i < 15; i++) {
      for (const sel of confirmBtns) {
        const btn = await page.locator(sel).first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click().catch(() => null);
          confirmed = true;
          break;
        }
      }
      if (confirmed) break;
      await page.waitForTimeout(1000);
    }

    await page.waitForTimeout(4000);

    // 6. Check kết quả
    const body = await page.innerText('body').catch(() => '');
    const success = /subscrib|đã đăng ký|activated|thank you|cảm ơn|welcome|successfully/i.test(body);

    return {
      ok: true,
      message: success
        ? `Google One Ultra ${presetId} activated successfully`
        : `Automation completed — please verify manually`,
    };
  } catch (err) {
    return { ok: false, message: err.message };
  } finally {
    await browser.close().catch(() => null);
  }
}
