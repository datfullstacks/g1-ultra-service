/**
 * G1 Ultra Service — entrypoint
 * Telegram bot + RDP pool dispatcher
 */
import { startPolling } from './telegram-bot.mjs';
import { pool } from './rdp-pool.mjs';

console.log('[g1-service] starting...');
console.log('[g1-service] extension path:', process.env.EXTENSION_PATH || '../extracted/extension_g130tb_ultra');

// Health check RDP pool on startup
pool.healthCheckAll().then(() => {
  const avail = pool.availableCount();
  console.log(`[g1-service] RDP pool: ${avail}/6 available`);
});

// Periodic health check every 2 minutes
setInterval(() => pool.healthCheckAll(), 2 * 60 * 1000);

// Start Telegram polling
startPolling().catch(err => {
  console.error('[g1-service] fatal:', err);
  process.exit(1);
});
