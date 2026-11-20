#!/usr/bin/env node
// Benchmark (Ticket-04 muc 1): node bench/run.mjs --seed 42 --duration 30 --out bench.json [--headless] [--chrome <path>]
// Mo cua so 1280x720 (khong toan man hinh), tai canh chuan (sim/bench.mjs), 3 s khoi dong roi do --duration giay.
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir, platform, release, arch, cpus, totalmem } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : d;
};
const seed = Number(arg('seed', 42));
const duration = Number(arg('duration', 30));
const out = arg('out');
if (!Number.isInteger(seed) || !(duration > 0) || !out) {
  process.stderr.write('Dung: node bench/run.mjs --seed 42 --duration 30 --out bench.json [--headless] [--chrome <path>]\n');
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));

function findChrome() {
  if (arg('chrome')) return arg('chrome');
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const cands = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'];
  for (const c of cands) {
    if (c.startsWith('/')) {
      if (existsSync(c)) return c;
    } else if (spawnSync('which', [c]).status === 0) return c;
  }
  return null;
}
const chrome = findChrome();
if (!chrome) {
  process.stderr.write('Khong tim thay Chrome/Chromium. Cai Chrome hoac dat CHROME_BIN / --chrome <duong dan>.\n');
  process.exit(1);
}
const hasDisplay = platform() !== 'linux' || !!process.env.DISPLAY || !!process.env.WAYLAND_DISPLAY;
const headless = argv.includes('--headless') || !hasDisplay;
if (headless && !argv.includes('--headless')) process.stderr.write('Khong co man hinh: chay Chrome headless (render phan mem, so do chi de tham khao).\n');

// RSS cua cay tien trinh Chrome (tong cac tien trinh con), MB. Tra ve null neu khong do duoc.
function treeRssMb(rootPid) {
  const r = spawnSync('ps', ['-eo', 'pid=,ppid=,rss='], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const rows = r.stdout.trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number));
  const kids = new Map();
  for (const [pid, ppid, rss] of rows) {
    if (!kids.has(ppid)) kids.set(ppid, []);
    kids.get(ppid).push([pid, rss]);
  }
  const rssOf = new Map(rows.map(([pid, , rss]) => [pid, rss]));
  let total = 0;
  const stack = [rootPid];
  while (stack.length) {
    const pid = stack.pop();
    total += rssOf.get(pid) ?? 0;
    for (const [k] of kids.get(pid) ?? []) stack.push(k);
  }
  return total / 1024;
}

let loadMs = null;
let peakMem = null;
let sampler = null;
let chromeProc = null;
let finished = false;
const profile = mkdtempSync(join(tmpdir(), 'ddl-bench-'));
function finish(code, msg) {
  if (finished) return;
  finished = true;
  clearInterval(sampler);
  try {
    chromeProc?.kill('SIGKILL');
  } catch {}
  server.close();
  rmSync(profile, { recursive: true, force: true });
  if (msg) process.stderr.write(msg + '\n');
  process.exit(code);
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
function stats(dts) {
  const n = dts.length;
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = sorted.slice(-k);
  return {
    frames: n,
    avg_fps: (1000 * n) / sum,
    p1_low_fps: 1000 / (worst.reduce((a, b) => a + b, 0) / k),
    frame_ms_p95: percentile(sorted, 0.95),
  };
}
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

const server = createApp({
  onBench(type, body) {
    if (type === 'start') loadMs = Math.round(process.uptime() * 1000); // tu luc tien trinh bat dau toi khung hinh dau cua canh bench
    else if (type === 'measure') {
      sampler = setInterval(() => {
        const m = treeRssMb(chromeProc.pid);
        if (m !== null && (peakMem === null || m > peakMem)) peakMem = m;
      }, 250);
    } else if (type === 'result') {
      const st = stats(body.dts);
      const result = {
        contract_version: contract.contract_version,
        avg_fps: round(st.avg_fps),
        p1_low_fps: round(st.p1_low_fps),
        frame_ms_p95: round(st.frame_ms_p95),
        frames: st.frames,
        load_ms: loadMs,
        peak_mem_mb: peakMem === null ? null : Math.round(peakMem),
        vsync_off: !argv.includes('--vsync'),
        renderer: `${body.renderer}; ${headless ? 'headless' : 'windowed'} ${chromeVersion}`,
        os: `${platform()} ${release()} ${arch()}; ${cpus()[0]?.model ?? 'cpu?'} x${cpus().length}; ${Math.round(totalmem() / 2 ** 30)} GB RAM`,
      };
      writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
      process.stdout.write(`bench: avg ${result.avg_fps} fps, p1 low ${result.p1_low_fps}, p95 ${result.frame_ms_p95} ms, ${result.frames} khung -> ${out}\n`);
      finish(0);
    }
  },
});

const chromeVersion = (spawnSync(chrome, ['--version'], { encoding: 'utf8' }).stdout ?? '').trim() || 'chrome';
server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/?bench=1&seed=${seed}&duration=${duration}`;
  const flags = [
    `--user-data-dir=${profile}`, '--window-size=1280,720', '--window-position=0,0', '--no-first-run', '--no-default-browser-check',
    '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required',
  ];
  if (headless) {
    flags.push('--headless=new', '--no-sandbox');
    if (platform() === 'linux' && !hasDisplay) flags.push('--use-gl=angle', '--use-angle=swiftshader');
  }
  flags.push(url);
  chromeProc = spawn(chrome, flags, { stdio: 'ignore' });
  chromeProc.on('error', (e) => finish(1, `Khong chay duoc Chrome: ${e.message}`));
  setTimeout(() => finish(1, 'Qua thoi gian cho benchmark (khong nhan duoc ket qua).'), (duration + 120) * 1000);
});
