// Kiem chung headless (contract v1.2). Phase 1-2 hoi quy; test bi luat Phase 3 lam sai duoc cap nhat, moi cho ghi "[P3]" + ly do (xem docs/CHANGELOG.md).
// Chay: node scripts/verify.mjs (hoac scripts/verify.sh). Scenario duoc ghi ra scenarios/ lam bang chung.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
const T = contract.tuning;
const SC = T.score;
const out = mkdtempSync(join(tmpdir(), 'ddl-verify-'));
const scDir = join(root, 'scenarios');
mkdirSync(scDir, { recursive: true });

let pass = 0;
let fail = 0;
function check(name, cond, detail = '') {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : ' ' + detail}`);
}
const near = (a, b, eps = 0.02) => Math.abs(a - b) <= eps;

let counter = 0;
function run({ name, seed = 1, night = 1, ticks = 60, scenario, inputs, every = 1, raw }) {
  const file = join(out, `o${counter++}.jsonl`);
  const args = ['sim/cli.mjs', '--seed', String(seed), '--night', String(night), '--ticks', String(ticks), '--out', file, '--snapshot-every', String(every)];
  if (scenario) {
    const f = join(scDir, `${name}.scenario.json`);
    writeFileSync(f, JSON.stringify(scenario) + '\n');
    args.push('--scenario', f);
  }
  if (inputs) {
    const f = join(scDir, `${name}.inputs.json`);
    writeFileSync(f, JSON.stringify(inputs) + '\n');
    args.push('--inputs', f);
  }
  if (raw) args.push(...raw);
  const t0 = Date.now();
  const r = spawnSync('node', args, { cwd: root, encoding: 'utf8' });
  const ms = Date.now() - t0;
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const lines = text ? text.trim().split('\n').map((l) => JSON.parse(l)) : [];
  const snaps = lines.filter((l) => l.type === 'snapshot');
  const byTick = new Map(snaps.map((s) => [s.tick, s]));
  return { code: r.status, stderr: r.stderr, text, lines, snaps, ms, end: lines.at(-1),
    events: lines.filter((l) => l.type === 'event'), at: (t) => byTick.get(t) };
}
const ev = (r, n) => r.events.filter((e) => e.name === n);
const OFF = { random_motes: false, random_shades: false, random_drifters: false };
const sc = (o = {}) => ({ ...OFF, ...o });
const L = (n, id) => ({ 1: { L1: [0, 25], L5: [-23.8, 7.7] }, 2: {}, 3: {} })[n][id];
const four = [{ id: 'L1', lit: true }, { id: 'L2', lit: true }, { id: 'L3', lit: true }, { id: 'L4', lit: true }];

// ===== Dinh dang, tick model, contract
{
  const r = run({ name: 'format', ticks: 100, every: 10, scenario: sc() });
  check('exit 0', r.code === 0, r.stderr);
  check('dong cuoi la end (ticks=100)', r.end.type === 'end' && r.end.ticks === 100 && r.end.state === 'playing');
  check('snapshot moi 10 tick tu 0', r.snaps.map((s) => s.tick).join() === '0,10,20,30,40,50,60,70,80,90,100');
  const s0 = r.snaps[0];
  check('snapshot 0: Mây o (0,0,0), grounded, dem 1', JSON.stringify(s0.player.pos) === '[0,0,0]' && s0.player.grounded && s0.night === 1);
  // [P3] contract 1.1 -> 1.2, thoi gian Dem 300/330/360 -> 240/270/300 (Ticket-03 muc 3, 7)
  check('contract v1.2 + tuning chuan', contract.contract_version === '1.2' && T.player_speed === 6 && T.carry_capacity === 10 && T.lantern_cost === 10 && T.dash_speed === 14 && T.night1_duration_s === 240 && T.night2_duration_s === 270 && T.night3_duration_s === 300 && T.fuel_max === 100 && T.relight_cost === 5 && T.win_ratio === 0.6 && T.capacity_max === 20);
  check('time_left_s = 240 - sim_tick/60 [P3: 300 -> 240]', s0.time_left_s === T.night1_duration_s && near(r.snaps[6].time_left_s, T.night1_duration_s - 1, 0.001));
  const keys = ['night', 'wind', 'motes', 'drifters', 'charms'];
  const pk = ['vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s'];
  check('snapshot v1.1 co night, wind, motes, drifters, charms', keys.every((k) => k in s0) && 'active' in s0.wind && 'dir_deg' in s0.wind);
  check('player co vel, grounded, invuln, dash_cd_s, pulse_cd_s, charm_s', pk.every((k) => k in s0.player));
  check('event night_start o tick 1', ev(r, 'night_start')[0]?.tick === 1 && ev(r, 'night_start')[0].data.night === 1);
  const r0 = run({ name: 'zero', ticks: 0, scenario: sc() });
  check('--ticks 0: snapshot 0 + end', r0.snaps.length === 1 && r0.end.ticks === 0);
  for (const [n, lanterns] of [[1, 5], [2, 6], [3, 7]]) {
    const rn = run({ name: `night${n}-start`, night: n, ticks: 1, scenario: sc() });
    check(`dem ${n}: ${lanterns} den, time_left ${[240, 270, 300][n - 1]}s [P3: 300/330/360 -> 240/270/300]`, rn.snaps[0].lanterns.length === lanterns && rn.snaps[0].time_left_s === [T.night1_duration_s, T.night2_duration_s, T.night3_duration_s][n - 1] && rn.snaps[0].night === n);
  }
  const l1 = run({ name: 'maps', ticks: 0, scenario: sc() }).snaps[0].lanterns.map((l) => l.pos.join());
  check('dem 1: toa do den chuan', l1.join('|') === '0,0,25|23.8,0,7.7|14.7,0,-20.2|-14.7,0,-20.2|-23.8,0,7.7');
  const r3s = run({ name: 'night3-start', night: 3, ticks: 0, scenario: sc() }).snaps[0];
  check('dem 3: den L1 o (0,6,6), L2 o (18,3,10)', r3s.lanterns[0].pos.join() === '0,6,6' && r3s.lanterns[1].pos.join() === '18,3,10');
}

// ===== Di chuyen, nhay
{
  const r = run({ name: 'accel', ticks: 12, scenario: sc(), inputs: [{ tick: 0, move: [1, 0] }, { tick: 8, move: [0, 0] }] });
  check('tang toc: vx=3 sau 3 tick, =6 sau 6 tick', near(r.at(3).player.vel[0], 3, 0.01) && near(r.at(6).player.vel[0], 6, 0.01));
  check('dung trong <= 0.1 s (6 tick)', r.at(14 > 12 ? 12 : 12).player.vel[0] < 6);
  const r2 = run({ name: 'stop', ticks: 20, scenario: sc(), inputs: [{ tick: 0, move: [1, 0] }, { tick: 8, move: [0, 0] }] });
  check('dung han sau 6 tick tu luc nha phim', r2.at(14).player.vel[0] === 0 && r2.at(13).player.vel[0] > 0);
  const d = run({ name: 'diag', ticks: 20, scenario: sc(), inputs: [{ tick: 0, move: [1, 1] }] });
  check('cheo duoc chuan hoa: |v| = 6', near(Math.hypot(d.at(20).player.vel[0], d.at(20).player.vel[2]), 6, 0.01));
  const j = run({ name: 'jump', ticks: 70, scenario: sc(), inputs: [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 10, jump: true }, { tick: 11, jump: false }] });
  const maxY = Math.max(...j.snaps.map((s) => s.player.pos[1]));
  check('nhay: vy 7, trong luc 20 => dinh ~1.225 m, nhay giua khong khong lap lai', near(maxY, 1.225, 0.06) && j.at(1).player.grounded === false, `maxY=${maxY}`);
  const land = j.snaps.find((s) => s.tick > 2 && s.player.grounded);
  check('tiep dat sau ~0.7 s', land && land.tick >= 40 && land.tick <= 46, JSON.stringify(land?.tick));
  const jf = run({ name: 'jump-air-control', ticks: 20, scenario: sc(), inputs: [{ tick: 0, jump: true }, { tick: 1, move: [1, 0], jump: false }] });
  check('dieu khien tren khong day du', near(jf.at(10).player.vel[0], 6, 0.01) && jf.at(10).player.grounded === false);
}

// ===== Luot
{
  const inputs = [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 30, dash: true }, { tick: 31, dash: false }, { tick: 90, dash: true }, { tick: 91, dash: false }];
  const r = run({ name: 'dash', ticks: 120, scenario: sc(), inputs });
  const de = ev(r, 'dash');
  check('luot: event dash tick 1 va 91 (hoi chieu 1.5 s tu luc bat dau)', de.map((e) => e.tick).join() === '1,91', de.map((e) => e.tick).join());
  check('luot dung huong dang quay (+Z): 14 m/s trong 12 tick', near(r.at(1).player.vel[2], 14, 0.01) && near(r.at(12).player.pos[2], 2.8 + 0, 0.05) && r.at(13).player.vel[2] < 14);
  check('dash_cd_s = 1.5 luc bat dau', near(r.at(1).player.dash_cd_s, 1.5, 0.001));
  const m = run({ name: 'dash-move', ticks: 14, scenario: sc(), inputs: [{ tick: 0, move: [-1, 0], dash: true }] });
  check('luot theo huong dang di chuyen (-X)', near(m.at(12).player.pos[0], -2.8, 0.1) && m.at(1).player.vel[0] === -14);
  const air = run({ name: 'dash-air', ticks: 14, scenario: sc(), inputs: [{ tick: 0, jump: true }, { tick: 1, jump: false, dash: true }] });
  const ys = air.snaps.filter((s) => s.tick >= 3 && s.tick <= 12).map((s) => s.player.pos[1]);
  check('luot tren khong giu nguyen do cao', ys.length > 0 && Math.max(...ys) - Math.min(...ys) < 1e-6);
  const hurt = run({ name: 'dash-no-invuln', ticks: 2, scenario: sc({ shades: [{ id: 'A', pos: [0.5, 0] }] }), inputs: [{ tick: 0, dash: true, move: [0, -1] }] });
  check('khong bat tu khi luot: van bi trung o tick dau cua cu luot', ev(hurt, 'player_hit').length === 1 && hurt.at(1).player.vel[2] === -14);
}

// ===== Nhat dom dom (ban kinh 1.0, chenh cao 1.5, suc chua 10)
{
  const pick = (name, pos, extra = {}) => run({ name, ticks: 2, scenario: sc({ motes: [pos], ...extra }) });
  check('nhat: XZ 0.9 -> nhat, event tick 1 carried 1', ev(pick('pick-in', [0.9, 0]), 'mote_picked')[0]?.data.carried === 1 && ev(pick('pick-in', [0.9, 0]), 'mote_picked')[0].tick === 1);
  check('nhat: XZ 1.1 -> khong', ev(pick('pick-out', [1.1, 0]), 'mote_picked').length === 0);
  check('nhat: chenh cao 1.4 -> nhat', ev(pick('pick-h-in', [0.5, 1.4, 0]), 'mote_picked').length === 1);
  check('nhat: chenh cao 1.6 -> khong', ev(pick('pick-h-out', [0.5, 1.6, 0]), 'mote_picked').length === 0);
  const cap = run({ name: 'capacity', ticks: 2, scenario: sc({ player: { carried: 10 }, motes: [[0.5, 0]] }) });
  check('day 10: khong nhat them', ev(cap, 'mote_picked').length === 0 && cap.at(2).motes_active === 1);
  const sc9 = run({ name: 'capacity9', ticks: 2, scenario: sc({ player: { carried: 9 }, motes: [[0.5, 0], [0, 0.5]] }) });
  check('mang 9: chi nhat them 1', ev(sc9, 'mote_picked').length === 1 && sc9.at(2).player.carried === 10);
  check('nhat khong cong diem (diem chi tinh khi nap)', pick('pick-score', [0.5, 0]).end.score === 0);
}

// ===== Dom dom sinh them, TTL
{
  const r = run({ name: 'mote-spawn', ticks: 500, every: 1, scenario: { random_shades: false, random_drifters: false } });
  const pts = new Set(r.at(0).motes.map((m) => m.pos.join()));
  check('luc dau 20 dom dom tai 20 diem khac nhau', r.at(0).motes_active === 20 && pts.size === 20);
  check('sinh them 1 tai tick 240, 480; khong som hon', r.at(239).motes_active === 20 && r.at(240).motes_active === 21 && r.at(479).motes_active === 21 && r.at(480).motes_active === 22);
  const full = [];
  for (let i = 0; i < 10; i++) full.push([30 + i, 0]);
  const cap = run({ name: 'mote-cap30', ticks: 500, scenario: { random_shades: false, random_drifters: false, motes: full } });
  check('tran 30: khong sinh them', cap.at(0).motes_active === 30 && cap.at(480).motes_active === 30);
  const ttl = run({ name: 'mote-ttl', ticks: 485, scenario: sc({ motes: [{ pos: [20, 0], kind: 'dropped' }] }) });
  check('dom dom roi ton tai 480 tick (ttl_s 8 -> bien mat tai tick 480)', ttl.at(0).motes[0].kind === 'dropped' && near(ttl.at(0).motes[0].ttl_s, 8, 0.001) && ttl.at(479).motes_active === 1 && ttl.at(480).motes_active === 0);
}

// ===== Nap den
{
  const full = run({ name: 'deposit-full', ticks: 3, scenario: sc({ player: { pos: L(1, 'L1'), carried: 10 } }), inputs: [{ tick: 0, interact: true }] });
  const d = ev(full, 'deposit')[0];
  check('nap du 10: deposit amount 10, lantern_lit L1, tick 1', d?.data.lantern_id === 'L1' && d.data.amount === 10 && d.data.deposited === 10 && d.tick === 1 && ev(full, 'lantern_lit')[0]?.data.lantern_id === 'L1');
  check('diem [P3: 10/mote -> 5/mote]: 5 x 10 nap + 100 thap lan dau = 150', full.end.score === SC.per_mote * 10 + SC.per_lantern && full.end.score === 150, String(full.end.score));
  const cum = run({ name: 'deposit-cumulative', ticks: 40, scenario: sc({ player: { pos: L(1, 'L1'), carried: 4 }, motes: [[0, 26.5]] }),
    inputs: [{ tick: 0, interact: true }, { tick: 1, interact: false, move: [0, 1] }, { tick: 9, move: [0, 0] }, { tick: 30, interact: true }] });
  const ds = ev(cum, 'deposit');
  check('nap nhieu lan, den nho tien do (4 roi +1 = 5)', ds.length === 2 && ds[0].data.amount === 4 && ds[1].data.amount === 1 && ds[1].data.deposited === 5 && ev(cum, 'lantern_lit').length === 0, JSON.stringify(ds.map((x) => x.data)));
  const edge = run({ name: 'interact-r2', ticks: 2, scenario: sc({ player: { pos: [0, 23], carried: 3 } }), inputs: [{ tick: 0, interact: true }] });
  check('interact ngoai 2.0 m: khong nap; trong 2.0: nap', ev(edge, 'deposit').length === 1);
  const far = run({ name: 'interact-far', ticks: 2, scenario: sc({ player: { pos: [0, 22.9], carried: 3 } }), inputs: [{ tick: 0, interact: true }] });
  check('cach 2.1 m: khong nap', ev(far, 'deposit').length === 0);
  const tie = run({ name: 'interact-tie', ticks: 2, scenario: sc({ player: { pos: [0, 0], carried: 4 }, lanterns: [{ id: 'L2', pos: [1, 0] }, { id: 'L1', pos: [-1, 0] }] }), inputs: [{ tick: 0, interact: true }] });
  check('hai den cung khoang cach: chon id nho hon (L1)', ev(tie, 'deposit')[0]?.data.lantern_id === 'L1');
  const nearest = run({ name: 'interact-nearest', ticks: 2, scenario: sc({ player: { pos: [0, 0], carried: 4 }, lanterns: [{ id: 'L1', pos: [1.5, 0] }, { id: 'L3', pos: [0.5, 0] }] }), inputs: [{ tick: 0, interact: true }] });
  check('chon den gan nhat (L3)', ev(nearest, 'deposit')[0]?.data.lantern_id === 'L3');
  // [P3] truoc day den da sang bi bo qua; nay den sang chua day dau cung nhan duoc (chau dau), chon gan nhat
  const lit = run({ name: 'interact-lit-nearest', ticks: 2, scenario: sc({ player: { pos: [0, 0], carried: 4 }, lanterns: [{ id: 'L1', pos: [0.5, 0], lit: true }, { id: 'L2', pos: [1.5, 0] }] }), inputs: [{ tick: 0, interact: true }] });
  check('[P3] den sang chua day dau nhan duoc va la den gan nhat (chau dau L1, khong nap L2)', ev(lit, 'refuel')[0]?.data.lantern_id === 'L1' && ev(lit, 'deposit').length === 0);
}

// ===== Thang / thua
{
  // [P3] het thang som (all_lit). Thang = song sot toi binh minh va so den sang >= ceil(0.6 x tong)
  const three = [{ id: 'L1', lit: true }, { id: 'L2', lit: true }, { id: 'L3', lit: true }];
  const win = run({ name: 'win-dawn', ticks: 600, scenario: sc({ time_left_s: 1 / 60, lanterns: three }) });
  const g = ev(win, 'game_over')[0];
  check('[P3] thang dawn_survived tai tick binh minh (3/5 den sang)', g?.data.result === 'won' && g.data.reason === 'dawn_survived' && g.tick === 1 && win.end.ticks === 1 && win.end.state === 'won');
  const expected = 3 * (SC.per_dawn_lantern + 99) + SC.per_flame_left * T.flames;
  check('[P3] diem binh minh: moi den sang +50+floor(fuel), moi Ngon Lua +50, khong thuong thoi gian', win.end.score === expected, `${win.end.score} vs ${expected}`);
  const early = run({ name: 'no-early-win', ticks: 600, scenario: sc({ lanterns: [1, 2, 3, 4, 5].map((i) => ({ id: `L${i}`, lit: true })) }) });
  check('[P3] thap du 5/5 den khong ket thuc Dem', early.end.state === 'playing' && ev(early, 'game_over').length === 0);
  for (const [n, total, need] of [[1, 5, 3], [2, 6, 4], [3, 7, 5]]) {
    const mk = (k) => run({ name: `threshold-${n}-${k}`, night: n, ticks: 3, scenario: sc({ time_left_s: 1 / 60, lanterns: Array.from({ length: k }, (_, i) => ({ id: `L${i + 1}`, lit: true })) }) });
    const ok = mk(need);
    const no = mk(need - 1);
    check(`[P3] dem ${n}: ${need}/${total} den thang, ${need - 1}/${total} thua dawn`, ev(ok, 'game_over')[0]?.data.reason === 'dawn_survived' && ev(no, 'game_over')[0]?.data.reason === 'dawn' && no.end.state === 'lost');
  }
  const tick = run({ name: 'win-at-timeout', ticks: 5, scenario: sc({ time_left_s: 1 / 60, lanterns: three }) });
  check('thang dung tick het gio (khong xet them tick sau)', tick.end.ticks === 1 && tick.end.state === 'won');
  const lastFlame = run({ name: 'lose-last-tick', ticks: 5, scenario: sc({ time_left_s: 1 / 60, player: { flames: 1 }, lanterns: three, shades: [{ id: 'A', pos: [0.5, 0] }] }) });
  check('[P3] het Ngon Lua o tick binh minh: thua no_flames truoc, du du den', ev(lastFlame, 'game_over')[0]?.data.reason === 'no_flames' && lastFlame.end.state === 'lost');
  const dawn = run({ name: 'dawn', ticks: 600, scenario: sc({ time_left_s: 1 }) });
  const gd = ev(dawn, 'game_over')[0];
  check('thua dawn tai tick 60, time_left_s 0', gd?.data.reason === 'dawn' && gd.tick === 60 && dawn.end.ticks === 60 && dawn.at(60).time_left_s === 0 && dawn.end.score === 0);
  const nf = run({ name: 'lose-no-flames', ticks: 100, scenario: sc({ player: { flames: 1 }, shades: [{ id: 'A', pos: [0.5, 0] }] }) });
  const gn = ev(nf, 'game_over')[0];
  check('thua no_flames; player_hit flames 0 truoc game_over', gn?.data.reason === 'no_flames' && nf.end.state === 'lost' && nf.events.findIndex((e) => e.name === 'player_hit') < nf.events.findIndex((e) => e.name === 'game_over'));
}

// ===== Toa Sang
{
  const inputs = [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 30, pulse: true }, { tick: 31, pulse: false }, { tick: 180, pulse: true }, { tick: 181, pulse: false }];
  const r = run({ name: 'pulse', ticks: 200, scenario: sc({ player: { carried: 6 }, shades: [{ id: 'A', pos: [3, 0] }] }), inputs });
  const pe = ev(r, 'pulse');
  check('toa sang: stunned_ids [A]; hoi chieu 3 s (tick 1 va 181)', pe.length === 2 && pe[0].tick === 1 && pe[1].tick === 181 && JSON.stringify(pe[0].data.stunned_ids) === '["A"]', JSON.stringify(pe.map((e) => e.tick)));
  check('ton 3 dom dom moi lan, +5 diem moi lan trung', r.at(1).player.carried === 3 && r.at(181).player.carried === 0 && r.end.score >= 5);
  check('choang 120 tick (state_ticks_left 120 tai tick 1)', r.at(1).shades[0].state === 'stunned' && r.at(1).shades[0].state_ticks_left === 120);
  check('day lui tong 4 m trong 15 tick (3 -> 7), dung sau do', near(r.at(15).shades[0].pos[0], 7, 0.01) && near(r.at(30).shades[0].pos[0], 7, 0.01) && r.at(10).shades[0].pos[0] < 7);
  // [P3] Ticket-03 muc 2: het choang thi ve wander (truoc day ve chase neu ca 12 m)
  check('[P3] het choang sau 120 tick -> wander', r.at(120).shades[0].state === 'stunned' && r.at(121).shades[0].state === 'wander');
  check('pulse_cd_s = 3.0 luc kich hoat', near(r.at(1).player.pulse_cd_s, 3, 0.001));
  const few = run({ name: 'pulse-poor', ticks: 3, scenario: sc({ player: { carried: 2 }, shades: [{ id: 'A', pos: [3, 0] }] }), inputs: [{ tick: 0, pulse: true }] });
  check('khong du 3 dom dom: khong kich hoat', ev(few, 'pulse').length === 0 && few.at(3).player.carried === 2);
  const rng = run({ name: 'pulse-range', ticks: 1, scenario: sc({ player: { carried: 3 }, shades: [{ id: 'A', pos: [4.9, 0] }, { id: 'B', pos: [5.0, 0] }] }), inputs: [{ tick: 0, pulse: true }] });
  check('khoang cach 3D toi tam (chan + 0.8): 4.9 trung, 5.0 khong (3D 5.009)', JSON.stringify(ev(rng, 'pulse')[0]?.data.stunned_ids) === '["A"]');
  const re = run({ name: 'pulse-refresh', ticks: 20, scenario: sc({ player: { carried: 3 }, shades: [{ id: 'A', pos: [3, 0], state: 'stunned', state_ticks_left: 50 }] }), inputs: [{ tick: 0, pulse: true }] });
  check('pulse lam moi choang + diem (ke ca con dang choang)', re.at(1).shades[0].state_ticks_left === 120 && re.end.score === 5);
  const same = run({ name: 'pulse-same-pos', ticks: 15, scenario: sc({ player: { carried: 3 }, shades: [{ id: 'A', pos: [0, 0] }] }), inputs: [{ tick: 0, pulse: true }] });
  check('trung vi tri: day theo +X (4 m)', near(same.at(15).shades[0].pos[0], 4, 0.01) && near(same.at(15).shades[0].pos[2], 0, 0.01));
  const hit = run({ name: 'pulse-stunned-no-hit', ticks: 5, scenario: sc({ player: { carried: 3 }, shades: [{ id: 'A', pos: [0.5, 0] }] }), inputs: [{ tick: 0, pulse: true }] });
  check('Bong Muc choang khong gay sat thuong', ev(hit, 'player_hit').length === 0);
}

// ===== Bi trung
{
  const r = run({ name: 'hit', ticks: 100, scenario: sc({ player: { carried: 5 }, shades: [{ id: 'A', pos: [0.5, 0] }] }) });
  const h = ev(r, 'player_hit');
  check('player_hit by shade, flames 2, dropped floor(5/2)=2, 1 lan trong 89 tick bat tu', h[0]?.data.by === 'shade' && h[0].data.flames === 2 && h[0].data.dropped === 2 && h[0].tick === 1 && h.filter((e) => e.tick < 91).length === 1);
  check('bat tu 90 tick (invuln 1.5 s)', near(r.at(1).player.invuln, 1.5, 0.001) && near(r.at(90).player.invuln, 1 / 60, 0.001));
  const dm = r.at(1).motes.filter((m) => m.kind === 'dropped');
  check('2 dom dom roi tren vanh 1.5-2.5 m quanh Mây, ttl 8 s', dm.length === 2 && dm.every((m) => { const d = Math.hypot(m.pos[0], m.pos[2]); return d >= 1.49 && d <= 2.51 && near(m.ttl_s, 8, 0.001); }));
  check('mang con 3 (5 - 2)', r.at(1).player.carried === 3);
  check('Bong Muc lui 2 m trong 60 tick (recoil)', r.at(1).shades[0].state === 'recoil' && near(r.at(61).shades[0].pos[0] - r.at(1).shades[0].pos[0], 2, 0.01));
  const two = run({ name: 'hit-one-per-tick', ticks: 1, scenario: sc({ shades: [{ id: 'A', pos: [0.5, 0] }, { id: 'B', pos: [-0.5, 0] }] }) });
  check('toi da 1 lan mat ngon lua moi tick', ev(two, 'player_hit').length === 1 && two.at(1).player.flames === T.flames - 1);
  const inv = run({ name: 'hit-invuln', ticks: 30, scenario: sc({ player: { invuln_ticks: 100 }, shades: [{ id: 'A', pos: [0.5, 0] }] }) });
  check('Mây bat tu: bong cham khong lam gi (bong van chase)', ev(inv, 'player_hit').length === 0 && inv.at(30).shades[0].state === 'chase');
  const up = run({ name: 'hit-height', ticks: 1, scenario: sc({ player: { pos: [0, 2, 0] }, shades: [{ id: 'A', pos: [0.5, 0] }] }) });
  check('chenh cao > 1.5: khong cham', ev(up, 'player_hit').length === 0);
  const edge = run({ name: 'hit-radius', ticks: 1, scenario: sc({ shades: [{ id: 'A', pos: [1.06, 0] }] }) });
  const edge2 = run({ name: 'hit-radius-out', ticks: 1, scenario: sc({ shades: [{ id: 'A', pos: [1.2, 0] }] }) });
  check('ban kinh cham 1.0 (XZ): 1.06 -> 0.993 trung, 1.2 -> 1.133 khong', ev(edge, 'player_hit').length === 1 && ev(edge2, 'player_hit').length === 0);
}

// ===== Roi khoi dao
{
  const r = run({ name: 'fall', ticks: 400, scenario: sc({ player: { pos: [39.5, 0], carried: 5, invuln_ticks: 600 } }), inputs: [{ tick: 0, move: [1, 0] }, { tick: 40, move: [0, 0] }] });
  const f = ev(r, 'player_hit').filter((e) => e.data.by === 'fall');
  check('roi: dung 1 lan, bo qua bat tu, -1 ngon lua, mat het dom dom', f.length === 1 && f[0].data.flames === T.flames - 1 && f[0].data.lost === 5 && f[0].data.dropped === 0, JSON.stringify(f));
  const ft = f[0]?.tick ?? 0;
  check('cho 60 tick roi hoi sinh o (0,0,0) van toc 0, bat tu 90', r.at(ft + 59).player.pos[1] < -10 && r.at(ft + 60).player.pos.join() === '0,0,0' && r.at(ft + 60).player.vel.join() === '0,0,0' && near(r.at(ft + 60).player.invuln, 1.5, 0.001), JSON.stringify(r.at(ft + 60)?.player));
  check('sau roi: carried 0', r.at(ft).player.carried === 0);
  const last = run({ name: 'fall-last-flame', ticks: 400, scenario: sc({ player: { pos: [39.5, 0], flames: 1 } }), inputs: [{ tick: 0, move: [1, 0] }] });
  check('roi o ngon lua cuoi: thua no_flames ngay, khong hoi sinh', last.end.state === 'lost' && ev(last, 'game_over')[0]?.data.reason === 'no_flames' && last.end.ticks === ev(last, 'player_hit')[0].tick);
}

// ===== Vung an toan
{
  const blocked = run({ name: 'safe-block', ticks: 400, scenario: sc({ player: { pos: [0, 15] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ id: 'A', pos: [0, 33] }] }) });
  const minD = Math.min(...blocked.snaps.map((s) => Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2] - 25)));
  check('Bong Muc o ngoai bi chan o mep 6 m', minD >= 5.99 && minD <= 6.05, `min=${minD}`);
  const ev1 = run({ name: 'safe-evict', ticks: 150, scenario: sc({ player: { pos: [0, 25], carried: 10 }, shades: [{ id: 'A', pos: [0, 26] }] }), inputs: [{ tick: 0, interact: true }] });
  const d30 = Math.hypot(ev1.at(30).shades[0].pos[0], ev1.at(30).shades[0].pos[2] - 25);
  check('den vua thap: Bong Muc ben trong bi day ra mep trong <= 30 tick', d30 >= 5.99 && Math.hypot(ev1.at(15).shades[0].pos[0], ev1.at(15).shades[0].pos[2] - 25) < 6);
  check('... va khong gay sat thuong trong luc do (va sau do khong vao lai)', ev(ev1, 'player_hit').length === 0);
}

// ===== Lich sinh Bong Muc
{
  const r = run({ name: 'shade-schedule', ticks: 1500, scenario: { random_motes: false, random_drifters: false, player: { flames: 9999, pos: [36, 0] } } });
  const sp = ev(r, 'shade_spawned');
  check('dem 1: 2 con tai tick 300 roi 1 con moi 480 tick (780, 1260)', sp.map((e) => e.tick).join() === '300,300,780,1260', sp.map((e) => e.tick).join());
  check('id S1, S2, ... theo thu tu sinh', sp.map((e) => e.data.id).join() === 'S1,S2,S3,S4');
  const s300 = r.at(300).shades;
  check('trang thai spawning o tick sinh, wander tick sau', s300.every((s) => s.state === 'spawning') && r.at(301).shades.every((s) => s.state === 'wander' || s.state === 'chase'));
  const pts = s300.every((s) => { const rr = Math.hypot(s.pos[0], s.pos[2]); const a = (Math.atan2(s.pos[2], s.pos[0]) * 180) / Math.PI; const m = ((a % 30) + 30) % 30; return near(rr, 37, 0.01) && near(m, 15, 0.01) && Math.hypot(s.pos[0] - 36, s.pos[2]) >= 15; });
  check('diem sinh: ban kinh 37 m, goc 15+30k, cach nguoi choi >= 15 m', pts, JSON.stringify(s300));
  const cap1 = run({ name: 'shade-cap-1', ticks: 3000, every: 3000, scenario: { random_motes: false, random_drifters: false, player: { flames: 9999 } } });
  check('dem 1: toi da 6 Bong Muc', cap1.at(3000).shades.length === 6);
  const n3 = run({ name: 'shade-cap-3', night: 3, ticks: 4000, every: 4000, scenario: { random_motes: false, random_drifters: false, wind_enabled: false, player: { flames: 9999 } } });
  check('dem 3: toi da 10, sinh moi 6 s (tick 300, 660, ...)', n3.at(4000).shades.length === 10 && ev(n3, 'shade_spawned').slice(0, 3).map((e) => e.tick).join() === '300,300,660');
  const n2 = run({ name: 'shade-cap-2', night: 2, ticks: 4500, every: 4500, scenario: { random_motes: false, random_drifters: false, player: { flames: 9999 } } });
  check('dem 2: toi da 8, sinh moi 7 s (tick 300, 300, 720)', n2.at(4500).shades.length === 8 && ev(n2, 'shade_spawned').slice(0, 3).map((e) => e.tick).join() === '300,300,720');
  const long = run({ name: 'shade-states', ticks: 5000, every: 5, scenario: { random_motes: false, random_drifters: false, player: { flames: 9999, pos: [30, 0] } }, seed: 5 });
  const seen = new Set(long.snaps.flatMap((s) => s.shades.map((x) => x.state)));
  const allowed = ['spawning', 'wander', 'chase', 'recoil', 'stunned'];
  check('ten trang thai Bong Muc chi thuoc {spawning, wander, chase, recoil, stunned}', [...seen].every((s) => allowed.includes(s)) && seen.has('spawning') && seen.has('wander'), [...seen].join());
  const tr = run({ name: 'shade-detect', ticks: 2, scenario: sc({ shades: [{ id: 'A', pos: [12, 0], state: 'wander' }, { id: 'B', pos: [12.2, 0], state: 'wander' }, { id: 'C', pos: [18.1, 0], state: 'chase' }, { id: 'D', pos: [17.9, 0], state: 'chase' }] }) });
  const st = Object.fromEntries(tr.at(1).shades.map((x) => [x.id, x.state]));
  check('phat hien 12 m (wander -> chase), bo duoi 18 m (chase -> wander)', st.A === 'chase' && st.B === 'wander' && st.C === 'wander' && st.D === 'chase', JSON.stringify(st));
}

// ===== Bua Gio
{
  const r = run({ name: 'charm', night: 2, ticks: 2705, scenario: sc({ player: { pos: [35, 0] } }), inputs: [{ tick: 5, move: [1, 0] }, { tick: 25, move: [0, 0] }] });
  const ce = ev(r, 'charm_picked');
  check('nhat bua: event charm_picked {C1, 600}', ce[0]?.data.charm_id === 'C1' && ce[0].data.charm_ticks === 600 && ce[0].tick === 1);
  check('hieu luc 600 tick (charm_s 10 -> het o tick 601)', near(r.at(1).player.charm_s, 10, 0.001) && r.at(600).player.charm_s > 0 && r.at(601).player.charm_s === 0);
  check('bua tai xuat hien sau 2700 tick; nhat lai lam moi', r.at(1).charms[0].available === false && near(r.at(1).charms[0].respawn_s, 45, 0.001));
  const speed = run({ name: 'charm-speed', night: 2, ticks: 20, scenario: sc({ player: { charm_ticks: 600 } }), inputs: [{ tick: 0, move: [1, 0] }] });
  check('co bua: toc do 7.2 m/s', near(speed.at(20).player.vel[0], 7.2, 0.01));
  const dd = run({ name: 'charm-dash', ticks: 40, scenario: sc({ player: { charm_ticks: 600 } }), inputs: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 5, dash: true }, { tick: 6, dash: false }, { tick: 20, dash: true }] });
  check('co bua: luot khong hoi chieu; bam khi dang luot bi bo qua', ev(dd, 'dash').map((e) => e.tick).join() === '1,21' && dd.at(1).player.dash_cd_s === 0 && near(dd.at(1).player.vel[2], 14, 0.01));
  const repick = run({ name: 'charm-repick', night: 2, ticks: 2710, every: 1, scenario: sc({ player: { pos: [35, 0] } }) });
  check('bua xuat hien lai tick 2701 va duoc nhat lai (lam moi 600)', ev(repick, 'charm_picked').map((e) => e.tick).join() === '1,2701', ev(repick, 'charm_picked').map((e) => e.tick).join());
  const n1 = run({ name: 'charm-night1', ticks: 1, scenario: sc() });
  const n3 = run({ name: 'charm-night3', night: 3, ticks: 1, scenario: sc() });
  check('bua: dem 1 khong co; dem 3 co C1 (30,0,25) va C2 (-30,0,25)', n1.at(1).charms.length === 0 && n3.at(1).charms.map((c) => c.pos.join()).join('|') === '30,0,25|-30,0,25');
  const replace = run({ name: 'charm-replace', night: 2, ticks: 1, scenario: sc({ charms: [{ id: 'X', pos: [5, 5] }] }) });
  check('scenario.charms thay the danh sach mac dinh', replace.at(1).charms.length === 1 && replace.at(1).charms[0].id === 'X');
}

// ===== Gio Lac
{
  const base = { random_motes: false, random_shades: false, random_drifters: false };
  const steal = run({ name: 'drifter-steal', night: 2, ticks: 400, scenario: { ...base, player: { carried: 6 }, drifters: [{ id: 'D1', pos: [10, 0] }] } });
  const se = ev(steal, 'drifter_steal')[0];
  check('Gio Lac: idle -> chase khi mang >= 5 va <= 15 m', steal.at(1).drifters[0].state === 'chase');
  check('cham (<= 1.2 m): cuop 3, event {drifter_id, amount, carried}', se?.data.drifter_id === 'D1' && se.data.amount === 3 && se.data.carried === 3, JSON.stringify(se));
  const st = se?.tick ?? 0;
  check('sau cuop: flee mang 3, bien mat sau 240 tick', steal.at(st).drifters[0].state === 'flee' && steal.at(st).drifters[0].stolen === 3 && steal.at(st + 239).drifters.length === 1 && steal.at(st + 240).drifters.length === 0);
  check('moi con chi cuop 1 lan; khong mat ngon lua', ev(steal, 'drifter_steal').length === 1 && steal.at(400).player.flames === T.flames);
  const few = run({ name: 'drifter-few', night: 2, ticks: 10, scenario: { ...base, player: { carried: 4 }, drifters: [{ id: 'D1', pos: [5, 0] }] } });
  check('mang < 5: van idle', few.at(10).drifters[0].state === 'idle');
  const far = run({ name: 'drifter-far', night: 2, ticks: 2, scenario: { ...base, player: { carried: 6 }, drifters: [{ id: 'D1', pos: [16, 0] }] } });
  check('xa > 15 m: van idle', far.at(2).drifters[0].state === 'idle');
  const lose = run({ name: 'drifter-lose-cond', night: 2, ticks: 6, scenario: { ...base, player: { carried: 6 }, drifters: [{ id: 'D1', pos: [10, 0], state: 'chase' }] }, inputs: [{ tick: 2, pulse: false }] });
  check('chase giu nguyen khi con dieu kien', lose.at(2).drifters[0].state === 'chase');
  const inv = run({ name: 'drifter-invuln', night: 2, ticks: 2, scenario: { ...base, player: { carried: 6, invuln_ticks: 100 }, drifters: [{ id: 'D1', pos: [1, 0], state: 'chase' }] } });
  check('bat tu khong ngan bi cuop', ev(inv, 'drifter_steal').length === 1);
  const safe = run({ name: 'drifter-pulse-chase', night: 2, ticks: 100, scenario: { ...base, player: { carried: 8 }, drifters: [{ id: 'D1', pos: [4, 0], state: 'chase' }] }, inputs: [{ tick: 0, pulse: true }] });
  check('Toa Sang trung Gio Lac dang chase: chuyen flee, khong cuop', safe.at(1).drifters[0].state === 'flee' && ev(safe, 'drifter_steal').length === 0 && safe.at(1).drifters[0].stolen === 0);
  check('... va khong tinh vao stunned_ids/diem', ev(safe, 'pulse')[0].data.stunned_ids.length === 0 && safe.end.score === 0);
  const drop = run({ name: 'drifter-pulse-drop', night: 2, ticks: 130, scenario: { ...base, player: { carried: 3 }, drifters: [{ id: 'D1', pos: [3, 0], state: 'flee', stolen: 3 }] }, inputs: [{ tick: 0, pulse: true }] });
  const dr = ev(drop, 'drifter_drop')[0];
  check('Toa Sang trung Gio Lac dang flee mang do: drifter_drop, tha 3 dom dom roi tai cho', dr?.data.drifter_id === 'D1' && dr.data.amount === 3 && drop.at(1).motes.filter((m) => m.kind === 'dropped').length === 3);
  check('... roi bien mat sau 120 tick', drop.at(119).drifters.length === 1 && drop.at(120).drifters.length === 0 && drop.at(1).drifters[0].stolen === 0);
  const sched = run({ name: 'drifter-schedule', night: 2, ticks: 3700, every: 1, scenario: { random_motes: false, random_shades: false, player: { pos: [0, 0] } } });
  check('Gio Lac sinh tai tick 1200, 2400 (id D1, D2), toi da 2', sched.at(1199).drifters.length === 0 && sched.at(1200).drifters.map((d) => d.id).join() === 'D1' && sched.at(2400).drifters.map((d) => d.id).join() === 'D1,D2' && sched.at(3600).drifters.length <= 2);
  const n1 = run({ name: 'drifter-night1', ticks: 1300, every: 1300, scenario: { random_motes: false, random_shades: false } });
  check('dem 1 khong co Gio Lac', n1.at(1300).drifters.length === 0);
}

// ===== Gio manh (Dem 3)
{
  const w = run({ name: 'wind', night: 3, ticks: 2200, every: 1, scenario: sc({ player: { pos: [0, -30] } }) });
  check('gio: bao truoc 2 s (tick 1680), bat dau tick 1800, keo dai 300 tick', w.at(1679).wind.warning === false && w.at(1680).wind.warning === true && w.at(1799).wind.active === false && w.at(1800).wind.active === true && w.at(2099).wind.active === true && w.at(2100).wind.active === false);
  const dir = (w.at(1900).wind.dir_deg * Math.PI) / 180;
  const dx = w.at(2099).player.pos[0] - w.at(1799).player.pos[0];
  const dz = w.at(2099).player.pos[2] - w.at(1799).player.pos[2];
  check('gio day 2 m/s theo dir_deg (300 tick => 10 m)', near(Math.hypot(dx, dz), 10, 0.1) && near(Math.cos(dir) * 10, dx, 0.1) && near(Math.sin(dir) * 10, dz, 0.1), `d=(${dx},${dz}) dir=${w.at(1900).wind.dir_deg}`);
  const off = run({ name: 'wind-night1', ticks: 1900, every: 1900, scenario: sc() });
  check('dem 1 khong co gio', off.at(1900).wind.active === false);
  const dis = run({ name: 'wind-disabled', night: 3, ticks: 1900, every: 1900, scenario: sc({ wind_enabled: false }) });
  check('wind_enabled false tat gio', dis.at(1900).wind.active === false);
}

// ===== Bục nhảy, tang, doc, thap (Dem 2 & 3)
{
  const a = run({ name: 'pad-night2-a', night: 2, ticks: 120, scenario: sc({ player: { pos: [20, 18] } }), inputs: [{ tick: 0, move: [-1, 0] }] });
  const land = a.snaps.find((s) => s.tick > 10 && s.player.grounded);
  check('bục (20,0,18): phong len vy 14, ngang 24 m/s ve dao B; phim di chuyen khong ghi de', near(a.at(1).player.vel[1], 14, 0.01) && a.at(1).player.grounded === false && near(Math.hypot(a.at(2).player.vel[0], a.at(2).player.vel[2]), 24, 0.01) && a.at(30).player.vel[0] > 0);
  check('dap trong dao B (~1.4 s sau)', land && land.tick >= 80 && land.tick <= 92 && Math.hypot(land.player.pos[0] - 70, land.player.pos[2]) <= 28, JSON.stringify(land?.player.pos));
  const b = run({ name: 'pad-night2-b', night: 2, ticks: 120, scenario: sc({ player: { pos: [50, -18] } }) });
  const landB = b.snaps.find((s) => s.tick > 10 && s.player.grounded);
  check('bục (50,0,-18): dap trong dao A', landB && Math.hypot(landB.player.pos[0], landB.player.pos[2]) <= 28, JSON.stringify(landB?.player.pos));
  const dashAir = run({ name: 'pad-dash', night: 2, ticks: 30, scenario: sc({ player: { pos: [20, 18] } }), inputs: [{ tick: 5, dash: true }] });
  check('van luot duoc khi dang bay', ev(dashAir, 'dash').length === 1);
  const bridge = run({ name: 'bridge', night: 2, ticks: 200, scenario: sc({ player: { pos: [26, 0] } }), inputs: [{ tick: 0, move: [1, 0] }] });
  check('cau tre x 26..44 di duoc, den dao B', bridge.at(200).player.pos[0] > 44 && bridge.at(200).player.pos[1] === 0);
  const off = run({ name: 'bridge-edge', night: 2, ticks: 120, scenario: sc({ player: { pos: [35, 0] } }), inputs: [{ tick: 0, move: [0, 1] }] });
  check('cau khong lan can: buoc ra ngoai thi roi', off.at(120).player.pos[1] < -5 || off.at(120).player.grounded === false);
  const p3 = run({ name: 'pad-night3', night: 3, ticks: 120, scenario: sc({ player: { pos: [0, 3, 13] } }) });
  const l3 = p3.snaps.find((s) => s.tick > 5 && s.player.grounded);
  check('bục (0,3,13) Dem 3: vy 12, ngang 8 huong -Z, dap len tang 2 (y=6)', near(p3.at(1).player.vel[1], 12, 0.01) && l3 && near(l3.player.pos[1], 6, 1e-6) && Math.hypot(l3.player.pos[0], l3.player.pos[2]) < 8, JSON.stringify(l3?.player));
  const cliff = run({ name: 'cliff', night: 3, ticks: 80, scenario: sc({ player: { pos: [0, 10] } }), inputs: [{ tick: 0, move: [0, 1] }] });
  check('vach tang 1 dung dung, khong di len duoc', cliff.at(80).player.pos[2] <= 12 && cliff.at(80).player.pos[1] === 0);
  const ramp = run({ name: 'ramp', night: 3, ticks: 100, scenario: sc({ player: { pos: [25.98, 15] } }), inputs: [{ tick: 0, move: [-0.866, -0.5] }] });
  check('doc 30 do: di len tang 1 (y=3)', near(ramp.at(100).player.pos[1], 3, 1e-6) && ramp.at(100).player.grounded && ramp.snaps.some((s) => s.player.pos[1] > 0.5 && s.player.pos[1] < 2.5));
  const fallT = run({ name: 'tier-edge', night: 3, ticks: 80, scenario: sc({ player: { pos: [10, 10] } }), inputs: [{ tick: 0, move: [0, -1] }] });
  check('buoc ra khoi mep tang 1 thi roi xuong tang 0', fallT.at(80).player.pos[1] === 0 && fallT.at(80).player.grounded);
  const tower = run({ name: 'tower', night: 3, ticks: 80, scenario: sc({ player: { pos: [5, 0] } }), inputs: [{ tick: 0, move: [-1, 0] }] });
  check('thap chuong (tru r=2) khong leo duoc, tang 2 y=6', tower.at(80).player.pos[0] >= 1.99 && near(tower.at(80).player.pos[1], 6, 1e-6));
  const n3start = run({ name: 'night3-lantern', night: 3, ticks: 3, scenario: sc({ player: { pos: [0, 6], carried: 10 } }), inputs: [{ tick: 0, interact: true }] });
  check('nap den L1 (0,6,6) tren tang 2', ev(n3start, 'lantern_lit')[0]?.data.lantern_id === 'L1');
}

// ===== Tam dung
{
  const r = run({ name: 'pause', ticks: 40, scenario: sc(), inputs: [{ tick: 0, move: [1, 0] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 20, pause: true }, { tick: 21, pause: false }] });
  const pe = ev(r, 'paused');
  const re = ev(r, 'resumed');
  check('paused tai tick 11, resumed tai tick 21', pe.map((e) => e.tick).join() === '11' && re.map((e) => e.tick).join() === '21');
  check('dang tam dung: state paused, tick tang, sim_tick/thoi gian/vi tri dung yen', r.at(15).state === 'paused' && r.at(15).tick === 15 && r.at(15).sim_tick === 10 && r.at(15).time_left_s === r.at(10).time_left_s && r.at(15).player.pos.join() === r.at(10).player.pos.join());
  check('tiep tuc: sim_tick tiep tuc (tick 21 -> 11); end.ticks = 40', r.at(21).sim_tick === 11 && r.at(21).state === 'playing' && r.end.ticks === 40);
  const frozen = run({ name: 'pause-freeze', ticks: 310, scenario: { random_motes: false, random_drifters: false, player: { flames: 99 } }, inputs: [{ tick: 0, pause: true }, { tick: 1, pause: false }] });
  check('lich sinh va hoi chieu dung yen khi tam dung (khong sinh Bong Muc o tick 300)', ev(frozen, 'shade_spawned').length === 0 && frozen.at(310).sim_tick === 0);
}

// ===== [P3] Nhien lieu den, chau dau, thap lai, Bong Muc hut dau, suc chua
{
  const lit = (id, fuel, extra = {}) => ({ id, lit: true, fuel, ...extra });
  const decay = run({ name: 'fuel-decay', ticks: 120, scenario: sc({ lanterns: [lit('L1', 50)] }) });
  check('hao 1 don vi/giay (50 -> 49.0 sau 60 tick, 48.0 sau 120)', decay.at(60).lanterns[0].fuel === 49 && decay.at(120).lanterns[0].fuel === 48);
  const first = run({ name: 'fuel-on-light', ticks: 61, scenario: sc({ player: { pos: [0, 25], carried: 10 } }), inputs: [{ tick: 0, interact: true }] });
  const ll = ev(first, 'lantern_lit')[0];
  check('thap lan dau: fuel 100, lantern_lit {relight:false}, ever_lit true, relit_count 0', ll?.data.relight === false && first.at(1).lanterns[0].fuel === 100 && first.at(1).lanterns[0].ever_lit === true && first.at(1).lanterns[0].relit_count === 0);
  const ref = run({ name: 'refuel', ticks: 2, scenario: sc({ player: { pos: [0, 25], carried: 3 }, lanterns: [lit('L1', 55)] }), inputs: [{ tick: 0, interact: true }] });
  const re = ev(ref, 'refuel')[0];
  check('chau dau: used = min(mang, ceil((100-fuel)/10)); fuel += 10 x used; event {lantern_id, amount, fuel}', re?.data.lantern_id === 'L1' && re.data.amount === 3 && re.data.fuel === 85 && ref.at(1).player.carried === 0);
  check('chau dau: +5 diem moi dom dom', ref.end.score === 3 * SC.per_mote);
  const cap = run({ name: 'refuel-capped', ticks: 2, scenario: sc({ player: { pos: [0, 25], carried: 10 }, lanterns: [lit('L1', 95)] }), inputs: [{ tick: 0, interact: true }] });
  check('chau dau toi da 100: chi dung ceil(5/10)=1 dom dom', ev(cap, 'refuel')[0]?.data.amount === 1 && ev(cap, 'refuel')[0].data.fuel === 100 && cap.at(1).player.carried === 9);
  const out = run({ name: 'lantern-out', ticks: 5, scenario: sc({ lanterns: [lit('L1', 1 / 60)] }) });
  const oe = ev(out, 'lantern_out')[0];
  check('het dau (fuel <= 0): lantern_out, tat, deposited 0, fuel 0, ever_lit true', oe?.data.lantern_id === 'L1' && oe.tick === 1 && out.at(1).lanterns[0].lit === false && out.at(1).lanterns[0].deposited === 0 && out.at(1).lanterns[0].fuel === 0 && out.at(1).lanterns[0].ever_lit === true);
  const relight = run({ name: 'relight', ticks: 3, scenario: sc({ player: { pos: [0, 25], carried: 5 }, lanterns: [{ id: 'L1', lit: false, ever_lit: true }] }), inputs: [{ tick: 0, interact: true }] });
  const rl = ev(relight, 'lantern_lit')[0];
  check('thap lai chi can 5 dom dom: lantern_lit {relight:true}, relit_count 1, fuel 100, +5/mote +40', rl?.data.relight === true && relight.at(1).lanterns[0].relit_count === 1 && relight.at(1).lanterns[0].fuel === 100 && relight.end.score === 5 * SC.per_mote + SC.per_relight);
  const first5 = run({ name: 'first-light-needs-10', ticks: 3, scenario: sc({ player: { pos: [0, 25], carried: 5 } }), inputs: [{ tick: 0, interact: true }] });
  check('den chua tung sang van can 10: 5 dom dom chi nap mot phan', ev(first5, 'lantern_lit').length === 0 && ev(first5, 'deposit')[0]?.data.deposited === 5);
  const prio = run({ name: 'interact-lit-vs-unlit', ticks: 2, scenario: sc({ player: { pos: [0, 0], carried: 4 }, lanterns: [{ id: 'L2', pos: [0.5, 0] }, { id: 'L1', pos: [1.5, 0], lit: true, fuel: 40 }] }), inputs: [{ tick: 0, interact: true }] });
  check('chon den nhan duoc gan nhat, den tat gan hon (L2) duoc nap truoc den sang xa hon', ev(prio, 'deposit')[0]?.data.lantern_id === 'L2' && ev(prio, 'refuel').length === 0);

  // suc chua
  const c0 = run({ name: 'capacity-0', ticks: 1, scenario: sc() });
  const c3 = run({ name: 'capacity-3', ticks: 2, scenario: sc({ player: { carried: 15, successful_lights: 3 }, motes: [[0.5, 0], [0, 0.5]] }) });
  check('suc chua = 10 + 2 x successful_lights: 10; 3 lan thap -> 16 (nhat toi 16)', c0.at(0).player.capacity === 10 && c3.at(0).player.capacity === 16 && c3.at(2).player.carried === 16);
  const c20 = run({ name: 'capacity-max', ticks: 1, scenario: sc({ player: { successful_lights: 20 } }) });
  check('suc chua toi da 20', c20.at(0).player.capacity === 20);
  const cl = run({ name: 'capacity-grows', ticks: 2, scenario: sc({ player: { pos: [0, 25], carried: 10 } }), inputs: [{ tick: 0, interact: true }] });
  check('moi lan thap thanh cong +2 suc chua (thap lai cung tinh); den dat san bang scenario khong tinh', cl.at(2).player.capacity === 12 && run({ name: 'capacity-preset', ticks: 1, scenario: sc({ lanterns: [lit('L1', 100)] }) }).at(0).player.capacity === 10);

  // vung an toan theo nhien lieu
  const weak = run({ name: 'zone-lost-below-30', ticks: 400, scenario: sc({ player: { pos: [0, 15] }, lanterns: [lit('L1', 29)], shades: [{ id: 'A', pos: [0, 33] }] }) });
  const minW = Math.min(...weak.snaps.map((x) => Math.hypot(x.shades[0].pos[0], x.shades[0].pos[2] - 25)));
  check('fuel < 30: mat vung an toan (Bong Muc vao duoc ben trong 6 m)', minW < 5, `min=${minW}`);
  const exact = run({ name: 'zone-kept-at-30', ticks: 40, scenario: sc({ player: { pos: [0, 25], carried: 1 }, lanterns: [lit('L1', 20 + 1 / 60)], shades: [{ id: 'A', pos: [0, 27] }] }), inputs: [{ tick: 0, interact: true }] });
  check('chau dau len dung 30.0 van con vung an toan: Bong Muc trong 6 m bi day ra, khong gay sat thuong', ev(exact, 'refuel')[0]?.data.fuel === 30 && Math.hypot(exact.at(30).shades[0].pos[0], exact.at(30).shades[0].pos[2] - 25) >= 5.99 && ev(exact, 'player_hit').length === 0);

  // Bong Muc hut dau
  const drain = run({ name: 'drain', ticks: 130, scenario: sc({ player: { pos: [0, -20] }, lanterns: [lit('L1', 20)], shades: [{ id: 'A', pos: [0, 26], state: 'wander' }] }) });
  check('wander toi den yeu (fuel<30) trong 2 m -> drain, dung yen, target L1', drain.at(2).shades[0].state === 'drain' && drain.at(2).shades[0].target_lantern_id === 'L1' && drain.at(30).shades[0].pos.join() === drain.at(2).shades[0].pos.join());
  const f61 = drain.at(61).lanterns[0].fuel;
  check('hut 5 fuel/giay + hao 1/giay (fuel ~13.98 sau 61 tick)', near(f61, 20 - 61 / 60 - (60 * 5) / 60, 0.1), String(f61));
  const fd = ev(drain, 'fuel_drain');
  check('fuel_drain {lantern_id, shade_id, fuel} moi 60 tick khi dang hut', fd.length === 2 && fd[0].tick === 61 && fd[1].tick === 121 && fd[0].data.shade_id === 'A' && fd[0].data.lantern_id === 'L1', JSON.stringify(fd.map((e) => e.tick)));
  const two = run({ name: 'drain-stack', ticks: 62, scenario: sc({ player: { pos: [0, -20] }, lanterns: [lit('L1', 28)], shades: [{ id: 'A', pos: [0, 26], state: 'wander' }, { id: 'B', pos: [1, 26], state: 'wander' }] }) });
  check('nhieu Bong Muc hut cong don (2 con: 11 don vi/giay)', near(two.at(62).lanterns[0].fuel, 28 - 62 / 60 - (60 * 10) / 60, 0.2), String(two.at(62).lanterns[0].fuel));
  const dout = run({ name: 'drain-out', ticks: 200, scenario: sc({ player: { pos: [0, -20] }, lanterns: [lit('L1', 4)], shades: [{ id: 'A', pos: [0, 26], state: 'wander' }] }) });
  const dl = ev(dout, 'lantern_out')[0];
  check('bi hut het dau: lantern_out, Bong Muc ve wander', !!dl && dout.at(dl.tick + 1).shades[0].state !== 'drain');
  const dc = run({ name: 'drain-to-chase', ticks: 1, scenario: sc({ player: { pos: [0, 21] }, lanterns: [lit('L1', 20)], shades: [{ id: 'A', pos: [0, 26], state: 'drain', target_lantern_id: 'L1' }] }) });
  check('drain -> chase khi Mây vao trong 6 m', dc.at(1).shades[0].state === 'chase');
  const dp = run({ name: 'drain-pulse', ticks: 1, scenario: sc({ player: { pos: [0, 23], carried: 3 }, lanterns: [lit('L1', 20)], shades: [{ id: 'A', pos: [0, 26], state: 'drain', target_lantern_id: 'L1' }] }), inputs: [{ tick: 0, pulse: true }] });
  check('drain -> stunned khi trung Toa Sang; diem +15 (khong phai 5+15)', dp.at(1).shades[0].state === 'stunned' && dp.end.score === SC.per_stun_drain && SC.per_stun_drain === 15);
  const plain = run({ name: 'pulse-score-plain', ticks: 1, scenario: sc({ player: { carried: 3 }, shades: [{ id: 'A', pos: [3, 0] }] }), inputs: [{ tick: 0, pulse: true }] });
  check('trung Toa Sang khi khong drain: +5', plain.end.score === SC.per_stun);
  const far = run({ name: 'drain-too-far', ticks: 1, scenario: sc({ player: { pos: [0, -20] }, lanterns: [lit('L1', 20)], shades: [{ id: 'A', pos: [0, 28], state: 'drain', target_lantern_id: 'L1' }] }) });
  check('drain -> wander khi cach den > 2 m', far.at(1).shades[0].state === 'wander');
  const unlitT = run({ name: 'drain-unlit', ticks: 1, scenario: sc({ player: { pos: [0, -20] }, shades: [{ id: 'A', pos: [0, 26], state: 'drain', target_lantern_id: 'L1' }] }) });
  check('drain -> wander khi den tat', unlitT.at(1).shades[0].state === 'wander');
  const refd = run({ name: 'drain-refuel-evict', ticks: 3, scenario: sc({ player: { pos: [0, 23.5], carried: 2 }, lanterns: [lit('L1', 20)], shades: [{ id: 'A', pos: [0, 26], state: 'drain', target_lantern_id: 'L1' }] }), inputs: [{ tick: 0, interact: true }] });
  check('chau dau len >= 30: drain -> wander, Bong Muc bi day ra', ev(refd, 'refuel')[0]?.data.fuel >= 30 && refd.at(1).shades[0].state === 'wander' && ev(refd, 'fuel_drain').length === 0);
  // chon muc tieu wander
  const tgt = run({ name: 'wander-target-weakest', ticks: 2, scenario: sc({ player: { pos: [0, 38] }, lanterns: [lit('L1', 10, { pos: [10, 0] }), lit('L2', 10, { pos: [-10, 0] }), lit('L3', 100, { pos: [0, 5] })], shades: [{ id: 'A', pos: [0, 0], state: 'wander' }] }) });
  check('wander toi den yeu gan nhat; bang nhau thi id nho hon (L1, bo qua L3 day dau)', tgt.at(1).shades[0].target_lantern_id === 'L1');
  const tgt2 = run({ name: 'wander-target-unlit', ticks: 61, scenario: sc({ player: { pos: [0, 38] }, lanterns: [lit('L1', 100, { pos: [0, 20] })], shades: [{ id: 'A', pos: [30, 0], state: 'wander' }] }) });
  const dist = (t) => Math.hypot(tgt2.at(t).shades[0].pos[0] - 23.8, tgt2.at(t).shades[0].pos[2] - 7.7);
  check('khong co den yeu: di ve den tat gan nhat (L2), toc do 4 m/s', tgt2.at(1).shades[0].target_lantern_id === 'L2' && near(dist(1) - dist(61), 4, 0.3), `${dist(1)} -> ${dist(61)}`);
}

// ===== Tat dinh, hieu nang
{
  const inputs = [{ tick: 0, move: [1, 0.3] }, { tick: 120, move: [-0.5, 1], jump: true }, { tick: 121, jump: false }, { tick: 300, move: [0, 0], pulse: true }, { tick: 301, pulse: false }, { tick: 400, dash: true }];
  for (const n of [1, 2, 3]) {
    const a = run({ name: `determinism-${n}`, night: n, seed: 7, ticks: 3000, every: 10, inputs });
    const b = run({ name: `determinism-${n}`, night: n, seed: 7, ticks: 3000, every: 10, inputs });
    const c = run({ name: `determinism-${n}`, night: n, seed: 8, ticks: 3000, every: 10, inputs });
    check(`tat dinh dem ${n}: cung seed byte-identical, khac seed khac`, a.text.length > 0 && a.text === b.text && a.text !== c.text);
  }
  const full = run({ name: 'perf-night3', night: 3, seed: 3, ticks: 18000, every: 10, scenario: { player: { flames: 9999 } } });
  check(`hieu nang: 1 dem day du (18000 tick, Dem 3 = 300 s) <= 30 s (do duoc ${full.ms} ms)`, full.code === 0 && full.ms <= 30000 && full.end.ticks === 18000 && full.end.state === 'lost');
}

// ===== Loi dau vao
{
  writeFileSync(join(scDir, 'bad.notjson.json'), 'this is not json\n');
  writeFileSync(join(scDir, 'bad.inputs-order.json'), '[{"tick":3},{"tick":3}]\n');
  writeFileSync(join(scDir, 'bad.inputs-move.json'), '[{"tick":0,"move":[2,0]}]\n');
  writeFileSync(join(scDir, 'bad.inputs-pause.json'), '[{"tick":0,"pause":"yes"}]\n');
  writeFileSync(join(scDir, 'bad.scenario-lantern.json'), '{"lanterns":[{"id":"L9"}]}\n');
  writeFileSync(join(scDir, 'bad.scenario-pos.json'), '{"motes":[["a",1]]}\n');
  writeFileSync(join(scDir, 'bad.scenario-shade-state.json'), '{"shades":[{"pos":[1,1],"state":"dancing"}]}\n');
  writeFileSync(join(scDir, 'bad.scenario-drifter.json'), '{"drifters":[{"pos":[1,1],"state":"idle","stolen":-1}]}\n');
  const bad = (f) => join(scDir, f);
  for (const [name, flag, file] of [
    ['inputs khong phai JSON', '--inputs', 'bad.notjson.json'], ['inputs tick khong tang chat', '--inputs', 'bad.inputs-order.json'],
    ['inputs move ngoai [-1,1]', '--inputs', 'bad.inputs-move.json'], ['inputs pause sai kieu', '--inputs', 'bad.inputs-pause.json'],
    ['scenario khong phai JSON', '--scenario', 'bad.notjson.json'], ['scenario den khong ton tai', '--scenario', 'bad.scenario-lantern.json'],
    ['scenario pos sai kieu', '--scenario', 'bad.scenario-pos.json'], ['scenario state Bong Muc sai ten', '--scenario', 'bad.scenario-shade-state.json'],
    ['scenario Gio Lac stolen am', '--scenario', 'bad.scenario-drifter.json'],
  ]) {
    const r = run({ ticks: 5, raw: [flag, bad(file)] });
    check(`exit 2: ${name}`, r.code === 2 && r.stderr.length > 0, `code=${r.code}`);
  }
  const r = spawnSync('node', ['sim/cli.mjs', '--seed', '1', '--night', '1', '--out', join(out, 'x')], { cwd: root, encoding: 'utf8' });
  check('thieu --ticks: exit khac 0, co stderr', r.status !== 0 && r.stderr.length > 0);
  const n4 = spawnSync('node', ['sim/cli.mjs', '--seed', '1', '--night', '4', '--ticks', '1', '--out', join(out, 'y')], { cwd: root, encoding: 'utf8' });
  check('--night 4: loi', n4.status !== 0 && n4.stderr.length > 0);
}

console.log(`\n${pass} dat, ${fail} that bai`);
process.exit(fail ? 1 : 0);
