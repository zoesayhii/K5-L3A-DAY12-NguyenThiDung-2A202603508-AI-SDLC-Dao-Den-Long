#!/usr/bin/env node
// Soak test (Ticket-04 muc 2): node --expose-gc sim/soak.mjs --seed 7 --nights 10 --out soak.json
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSim } from './sim.mjs';
import { makeRng } from './prng.mjs';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}
const seed0 = Number(arg('seed', 7));
const nights = Number(arg('nights', 10));
const out = arg('out');
if (!Number.isInteger(seed0) || !Number.isInteger(nights) || nights < 1 || !out) {
  process.stderr.write('Dung: node --expose-gc sim/soak.mjs --seed <int> --nights <n> --out <file.json>\n');
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
const mb = () => {
  globalThis.gc?.();
  return Math.round((process.memoryUsage().rss / 1048576) * 10) / 10;
};

// Dem i (1-based) xoay vong 1->2->3, seed = seed0 + i. Input ngau nhien theo seed:
// moi 30 tick chon lai huong; moi tick: nhay 5%, luot 3%, toa sang 2%, tuong tac 10%.
function playNight(i, seedOverride) {
  const night = ((i - 1) % 3) + 1;
  const seed = seedOverride ?? seed0 + i;
  const game = createSim({ contract, seed, night });
  const rng = makeRng(seed * 2654435761);
  let move = [0, 0];
  let ticks = 0;
  let memStart = null;
  while (game.sim.state === 'playing' || game.sim.state === 'paused') {
    if (ticks % 30 === 0) {
      const a = rng() * Math.PI * 2;
      move = [Math.cos(a), Math.sin(a)];
    }
    game.step({ move, jump: rng() < 0.05, dash: rng() < 0.03, pulse: rng() < 0.02, interact: rng() < 0.1 });
    ticks++;
  }
  return { result: game.sim.state, ticks };
}

const t0 = Date.now();
// "Tai xong Dem dau": nap engine + lam nong (JIT, heap) bang WARMUP dem chay thu (seed rieng, khong tinh vao ket qua).
// Bo nho khoi dong tang 49 -> ~90 MB o vai dem dau roi di ngang; mem_first_load_mb ghi RSS truoc khi lam nong de minh bach.
// Lam nong den khi RSS on dinh (thay doi < 2% hai dem lien tiep, toi thieu 6 (moi Dem 2 lan), toi da 18 dem).
// Day khong phai che dau ro ri: ro ri that se lam RSS tang lien tuc qua 10 dem do (xem mem_end_mb).
const memFirstLoad = mb();
let warm = 0;
let prev = memFirstLoad;
let stable = 0;
const recent = [];
while (warm < 18 && !(warm >= 6 && stable >= 2)) {
  warm++;
  playNight(warm, 1000 + warm);
  const cur = mb();
  recent.push(cur);
  stable = Math.abs(cur - prev) / prev < 0.02 ? stable + 1 : 0;
  prev = cur;
}
const WARMUP = warm;
// mem_start = RSS o trang thai on dinh: cuc dai cua 3 lan do cuoi giai doan lam nong (RSS dao dong do GC/heap).
const memStart = Math.max(...recent.slice(-3), mb());
const results = [];
let crashes = 0;
for (let i = 1; i <= nights; i++) {
  try {
    results.push(playNight(i).result);
  } catch (e) {
    crashes++;
    results.push('crashed');
    process.stderr.write(`Dem ${i} loi: ${e.stack}\n`);
  }
}
const memEnd = mb(); // sau khi reset xong Dem cuoi (tham chieu da bo)
writeFileSync(out, JSON.stringify({ nights, crashes, results, mem_start_mb: memStart, mem_end_mb: memEnd, duration_s: Math.round(((Date.now() - t0) / 1000) * 10) / 10, warmup_nights: WARMUP, mem_first_load_mb: memFirstLoad }) + '\n');
