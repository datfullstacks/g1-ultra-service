/**
 * Telegram bot — interface cho khách gửi credential, chọn gói, nhận kết quả
 * Pattern: ESM, polling, giống farm-telegram-bot.mjs
 */
import { setNotify, createJob, submitJob, getJob, getActiveJobByUser, queuePosition, poolStatus } from './job-queue.mjs';
import { pool } from './rdp-pool.mjs';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_IDS = new Set(
  (process.env.ALLOWED_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean).map(Number)
);

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;
let _offset = 0;

// ─── Telegram API helpers ────────────────────────────────────────────────────

async function tgCall(method, body) {
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(`${TG}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sendMsg(chatId, text, extra = {}) {
  return tgCall('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}

async function editMsg(chatId, msgId, text, extra = {}) {
  return tgCall('editMessageText', { chat_id: chatId, message_id: msgId, text, parse_mode: 'HTML', ...extra });
}

function inlineKb(rows) {
  return { inline_keyboard: rows };
}

// ─── Conversation state per user ─────────────────────────────────────────────

const state = new Map(); // userId → { step, data }

function setState(userId, step, data = {}) {
  state.set(userId, { step, ...data });
}
function getState(userId) { return state.get(userId) || { step: 'idle' }; }
function clearState(userId) { state.delete(userId); }

// ─── Auth ────────────────────────────────────────────────────────────────────

function allowed(userId) {
  return ALLOWED_IDS.size === 0 || ALLOWED_IDS.has(userId);
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = (msg.text || '').trim();

  if (!allowed(userId)) {
    return sendMsg(chatId, '⛔ Không có quyền truy cập.');
  }

  const { step } = getState(userId);

  if (text === '/start' || text === '/cancel') {
    clearState(userId);
    if (text === '/cancel') return sendMsg(chatId, '❌ Đã hủy.');
    return sendMsg(chatId, '👋 Chọn gói Google One Ultra:', {
      reply_markup: inlineKb([
        [{ text: '📦 Ultra 20TB', callback_data: 'sku:20tb' },
         { text: '📦 Ultra 30TB', callback_data: 'sku:30tb' }],
      ]),
    });
  }

  if (text === '/status') return handleStatus(chatId, userId);
  if (text === '/pool') return handlePool(chatId, userId);

  // Conversation steps
  if (step === 'email') {
    if (!text.includes('@')) return sendMsg(chatId, '❌ Email không hợp lệ. Nhập lại:');
    setState(userId, 'password', { ...getState(userId), email: text });
    return sendMsg(chatId, '🔑 Nhập password:');
  }

  if (step === 'password') {
    setState(userId, 'secret', { ...getState(userId), password: text });
    return sendMsg(chatId, '🔐 Nhập 2FA secret key (nếu không có, gửi dấu <code>-</code>):', { parse_mode: 'HTML' });
  }

  if (step === 'secret') {
    const s = getState(userId);
    const secret = text === '-' ? '' : text;

    // Check active job
    const active = getActiveJobByUser(userId);
    if (active) {
      clearState(userId);
      return sendMsg(chatId,
        `⚠️ Bạn đang có job <code>${active.jobId.slice(0, 8)}</code> (${active.status}). Chờ xong mới submit được.`
      );
    }

    const job = createJob({
      userId,
      email: s.email,
      password: s.password,
      secret,
      sku: s.sku,
      months: s.months,
    });

    clearState(userId);
    submitJob(job);

    const pos = queuePosition(job.jobId);
    return sendMsg(chatId,
      `✅ Job đã nhận!\n` +
      `🆔 <code>${job.jobId.slice(0, 8)}</code>\n` +
      `📦 ${job.sku.toUpperCase()} · ${job.months} tháng\n` +
      `📧 ${job.email}\n` +
      (pos > 0 ? `⏳ Vị trí hàng chờ: #${pos}` : `⚙️ Đang xử lý...`)
    );
  }
}

async function handleCallback(cbq) {
  const chatId = cbq.message.chat.id;
  const userId = cbq.from.id;
  const msgId = cbq.message.message_id;
  const data = cbq.data;

  await tgCall('answerCallbackQuery', { callback_query_id: cbq.id });

  if (!allowed(userId)) return;

  if (data.startsWith('sku:')) {
    const sku = data.split(':')[1];
    setState(userId, 'months', { sku });
    return editMsg(chatId, msgId,
      `✅ Gói: <b>${sku.toUpperCase()}</b>\n📅 Chọn kỳ hạn:`, {
      reply_markup: inlineKb([[
        { text: '1 tháng', callback_data: 'months:1' },
        { text: '3 tháng', callback_data: 'months:3' },
        { text: '6 tháng', callback_data: 'months:6' },
        { text: '12 tháng', callback_data: 'months:12' },
      ]]),
    });
  }

  if (data.startsWith('months:')) {
    const months = Number(data.split(':')[1]);
    const s = getState(userId);
    setState(userId, 'email', { sku: s.sku, months });
    return editMsg(chatId, msgId,
      `✅ Gói: <b>${s.sku.toUpperCase()}</b> · ${months} tháng\n\n📧 Nhập email Google:`
    );
  }
}

async function handleStatus(chatId, userId) {
  const job = getActiveJobByUser(userId);
  if (!job) return sendMsg(chatId, 'Không có job nào đang chạy.');
  const pos = queuePosition(job.jobId);
  const statusTxt = {
    queued: `⏳ Đang chờ · #${pos}`,
    processing: '⚙️ Đang xử lý...',
    done: '✅ Thành công',
    failed: '❌ Thất bại',
  }[job.status] ?? job.status;

  return sendMsg(chatId,
    `🆔 <code>${job.jobId.slice(0, 8)}</code>\n` +
    `📦 ${job.sku.toUpperCase()} · ${job.months}m\n` +
    `📧 ${job.email}\n` +
    `Status: ${statusTxt}` +
    (job.resultMsg ? `\n💬 ${job.resultMsg}` : '')
  );
}

async function handlePool(chatId, userId) {
  await pool.healthCheckAll();
  const nodes = poolStatus();
  const lines = nodes.map(n => {
    const icon = !n.healthy ? '🔴' : n.busy ? '🟡' : '🟢';
    return `${icon} <code>${n.name}</code> · jobs: ${n.jobsDone}`;
  });
  const avail = pool.availableCount();
  return sendMsg(chatId, `<b>RDP Pool</b> — ${avail}/6 available\n\n${lines.join('\n')}`);
}

// ─── Notify callback ─────────────────────────────────────────────────────────

setNotify(async (job) => {
  const emoji = job.status === 'done' ? '✅' : '❌';
  const rdpInfo = job.rdpName ? `\n🖥 RDP: <code>${job.rdpName}</code>` : '';
  await sendMsg(job.userId,
    `${emoji} Job <code>${job.jobId.slice(0, 8)}</code> ${job.status === 'done' ? 'hoàn thành' : 'thất bại'}!\n` +
    `📦 ${job.sku.toUpperCase()} · ${job.months} tháng\n` +
    `📧 ${job.email}${rdpInfo}\n` +
    `💬 ${job.resultMsg}`
  );
});

// ─── Polling loop ─────────────────────────────────────────────────────────────

export async function startPolling() {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN chưa set');
  console.log('[telegram-bot] polling started');

  while (true) {
    try {
      const { default: fetch } = await import('node-fetch');
      const res = await fetch(`${TG}/getUpdates?offset=${_offset}&timeout=30&allowed_updates=["message","callback_query"]`);
      const data = await res.json();

      if (!data.ok) {
        console.error('[telegram-bot] polling error:', data);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      for (const update of data.result || []) {
        _offset = update.update_id + 1;
        try {
          if (update.message) await handleMessage(update.message);
          if (update.callback_query) await handleCallback(update.callback_query);
        } catch (err) {
          console.error('[telegram-bot] handler error:', err);
        }
      }
    } catch (err) {
      console.error('[telegram-bot] polling failed:', err.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}
