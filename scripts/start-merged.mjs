/**
 * Chạy API + Worker trong 1 container (Render free-tier 750h).
 * Dùng 1 Web Service duy nhất để tiết kiệm giờ, vẫn xử lý BullMQ.
 * API bind $PORT (Render yêu cầu), Worker bind $WORKER_PORT (mặc định 3001) để tránh conflict port.
 */
import { spawn } from 'child_process';

const api = spawn('node', ['dist/apps/api/main'], {
  stdio: 'inherit',
  env: process.env,
});

const workerEnv = { ...process.env, WORKER_PORT: process.env.WORKER_PORT ?? '3001' };
const worker = spawn('node', ['dist/apps/worker/worker.main'], {
  stdio: 'inherit',
  env: workerEnv,
});

function shutdown(signal) {
  console.log(`[merged] received ${signal}, shutting down...`);
  api.kill(signal);
  worker.kill(signal);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

let exited = false;
function onExit(name, code) {
  if (exited) return;
  exited = true;
  console.error(`[merged] ${name} exited with code ${code}, shutting down peer...`);
  const other = name === 'api' ? worker : api;
  try {
    other.kill('SIGTERM');
  } catch {}
  setTimeout(() => process.exit(code ?? 1), 2000);
}

api.on('exit', (code) => onExit('api', code));
worker.on('exit', (code) => onExit('worker', code));

api.on('error', (err) => {
  console.error('[merged] api spawn error', err);
  process.exit(1);
});
worker.on('error', (err) => {
  console.error('[merged] worker spawn error', err);
  process.exit(1);
});
