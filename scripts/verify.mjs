// Kiem chung headless Phase 1. Chay: node scripts/verify.mjs  (hoac scripts/verify.sh)
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
const T = contract.tuning;
const out = mkdtempSync(join(tmpdir(), 'ddl-verify-'));
const sc = (n) => join(root, 'scenarios', n);

let pass = 0;
let fail = 0;
function check(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name} ${detail}`);
  }
}

let counter = 0;
function run({ seed = 1, ticks = 60, scenario, inputs, every, extra = [] }) {
  const file = join(out, `o${counter++}.jsonl`);
  const args = ['sim/cli.mjs', '--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', file];
  if (scenario) args.push('--scenario', sc(scenario));
  if (inputs) args.push('--inputs', sc(inputs));
  if (every) args.push('--snapshot-every', String(every));
  args.push(...extra);
  const r = spawnSync('node', args, { cwd: root, encoding: 'utf8' });
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const lines = text ? text.trim().split('\n').map((l) => JSON.parse(l)) : [];
  return {
    code: r.status,
    stderr: r.stderr,
    text,
    lines,
    events: lines.filter((l) => l.type === 'event'),
    snaps: lines.filter((l) => l.type === 'snapshot'),
    end: lines.at(-1),
  };
}
const ev = (r, name) => r.events.filter((e) => e.name === name);

// --- Dinh dang & tick model
{
  const r = run({ ticks: 100, scenario: 'pickup.scenario.json' });
  check('exit 0', r.code === 0, r.stderr);
  check('dong cuoi la end, ticks=100', r.end.type === 'end' && r.end.ticks === 100 && r.end.state === 'playing');
  check('snapshot 0 co tick 0, sau do moi 10 tick', r.snaps[0].tick === 0 && r.snaps[1].tick === 10 && r.snaps.length === 11);
  const s0 = r.snaps[0];
  check('snapshot 0 truoc input: player o (0,0,0)', JSON.stringify(s0.player.pos) === '[0,0,0]');
  check('time_left_s = duration - steps/60', s0.time_left_s === T.night1_duration_s && r.snaps[6].time_left_s === T.night1_duration_s - 1);
  check('tuning khop contract: flames, 5 den', s0.player.flames === T.flames && s0.lanterns.length === T.lantern_count_night1);
  const r0 = run({ ticks: 0 });
  check('--ticks 0: snapshot 0 + end', r0.snaps.length === 1 && r0.end.ticks === 0);
  const re = run({ ticks: 20, every: 7, scenario: 'pickup.scenario.json' });
  check('--snapshot-every 7', re.snaps.map((s) => s.tick).join() === '0,7,14');
}

// --- Nhat dom dom
{
  const r = run({ scenario: 'pickup.scenario.json' });
  const e = ev(r, 'mote_picked');
  check('nhat dom dom: event tick=1, carried=1', e.length === 1 && e[0].tick === 1 && e[0].data.carried === 1);
  check('nhat dom dom: +per_mote, motes_active=0', r.end.score === T.score.per_mote && r.snaps.at(-1).motes_active === 0);
  const c = run({ scenario: 'capacity.scenario.json' });
  check('day carry_capacity: khong nhat them', ev(c, 'mote_picked').length === 0 && c.snaps.at(-1).motes_active === 1);
}

// --- Nap den
{
  const r = run({ scenario: 'deposit.scenario.json', inputs: 'deposit.inputs.json' });
  const d = ev(r, 'deposit')[0];
  check('deposit: lantern_id L1, amount, deposited', d && d.data.lantern_id === 'L1' && d.data.amount === T.lantern_cost && d.data.deposited === T.lantern_cost && d.tick === 1);
  check('lantern_lit L1, +per_lantern', ev(r, 'lantern_lit')[0]?.data.lantern_id === 'L1' && r.end.score === T.score.per_lantern);
  check('1 den sang chua thang', r.end.state === 'playing');
  const p = run({ scenario: 'partial.scenario.json', inputs: 'partial.inputs.json' });
  check('nap mot phan: khong sang den', ev(p, 'deposit')[0]?.data.amount === 2 && ev(p, 'lantern_lit').length === 0 && p.snaps.at(-1).lanterns[0].lit === false);
  const f = run({ scenario: 'far.scenario.json', inputs: 'far.inputs.json' });
  check('interact ngoai interact_radius: khong nap', ev(f, 'deposit').length === 0);
}

// --- Thang
{
  const r = run({ scenario: 'win.scenario.json', inputs: 'win.inputs.json', ticks: 600 });
  const g = ev(r, 'game_over')[0];
  check('thang all_lit tai tick 1', g?.data.result === 'won' && g.data.reason === 'all_lit' && g.tick === 1);
  const expected = T.score.per_lantern + T.score.per_second_left * Math.floor(T.night1_duration_s - 1 / 60) + T.score.per_flame_left * T.flames;
  check('diem thang = den + giay con lai + flame con lai', r.end.score === expected, `${r.end.score} vs ${expected}`);
  check('dung o game over: end.ticks=1, state=won', r.end.ticks === 1 && r.end.state === 'won');
}

// --- Pulse
{
  const r = run({ scenario: 'pulse.scenario.json', inputs: 'pulse.inputs.json', ticks: 200 });
  const pe = ev(r, 'pulse');
  check('pulse: stunned_ids=[A], 1 lan (cooldown chan lan 2)', pe.length === 1 && pe[0].tick === 1 && JSON.stringify(pe[0].data.stunned_ids) === '["A"]');
  const s10 = r.snaps[1];
  check('pulse: shade stunned va bi day +pulse_push_m', s10.shades[0].state === 'stunned' && Math.abs(s10.shades[0].pos[0] - (3 + T.pulse_push_m)) < 1e-6, JSON.stringify(s10.shades));
  check('pulse: ton pulse_cost, +per_stun', s10.player.carried === 2 - T.pulse_cost && r.end.score === T.score.per_stun);
  const last = r.snaps.at(-1);
  check('het stun sau pulse_stun_s: ve chase', last.shades[0].state === 'chase');
  const np = run({ scenario: 'dawn.scenario.json', inputs: 'pulse.inputs.json', ticks: 5 });
  check('pulse khong du carried: khong phat', ev(np, 'pulse').length === 0);
}

// --- Bi trung & thua
{
  const r = run({ scenario: 'hit.scenario.json', ticks: 80 });
  const h = ev(r, 'player_hit');
  check('player_hit by shade, flames-1, dropped = floor(carried*ratio)', h.length === 1 && h[0].data.by === 'shade' && h[0].data.flames === T.flames - 1 && h[0].data.dropped === Math.floor(4 * T.hit_drop_ratio), JSON.stringify(h));
  check('bat tu invuln_s: chi 1 hit trong 80 tick', h.length === 1);
  const l = run({ scenario: 'lose.scenario.json', ticks: 600 });
  const g = ev(l, 'game_over')[0];
  check('thua no_flames', g?.data.result === 'lost' && g.data.reason === 'no_flames' && l.end.state === 'lost' && l.end.score === 0);
  const d = run({ scenario: 'dawn.scenario.json', ticks: 600 });
  const gd = ev(d, 'game_over')[0];
  check('thua dawn tai tick 60, time_left_s=0', gd?.data.reason === 'dawn' && gd.tick === 60 && d.end.ticks === 60 && d.snaps.at(-1).time_left_s === 0);
}

// --- Tat dinh
{
  const a = run({ seed: 7, ticks: 3000, inputs: 'random.inputs.json' });
  const b = run({ seed: 7, ticks: 3000, inputs: 'random.inputs.json' });
  check('tat dinh: cung seed => byte-identical', a.text.length > 0 && a.text === b.text);
  const c = run({ seed: 8, ticks: 3000, inputs: 'random.inputs.json' });
  check('khac seed => khac output', a.text !== c.text);
  const shadeIds = new Set(a.snaps.flatMap((s) => s.shades.map((x) => x.id)));
  const spawned = ev(a, 'shade_spawned');
  check('random_shades: >=3 shade ban dau, co shade_spawned khi chay qua 600 tick', shadeIds.size >= 3 && (a.end.ticks < 600 || spawned.length >= 1), `ticks=${a.end.ticks} spawned=${spawned.length}`);
}

// --- Loi dau vao => exit 2
for (const [name, args] of [
  ['inputs khong phai JSON', { inputs: 'bad.notjson.json' }],
  ['inputs tick khong tang chat', { inputs: 'bad.inputs-order.json' }],
  ['inputs move ngoai [-1,1]', { inputs: 'bad.inputs-move.json' }],
  ['scenario khong phai JSON', { scenario: 'bad.notjson.json' }],
  ['scenario den khong ton tai', { scenario: 'bad.scenario-lantern.json' }],
  ['scenario pos sai kieu', { scenario: 'bad.scenario-pos.json' }],
]) {
  const r = run(args);
  check(`exit 2: ${name}`, r.code === 2 && r.stderr.length > 0, `code=${r.code}`);
}
{
  const r = spawnSync('node', ['sim/cli.mjs', '--seed', '1', '--night', '1', '--out', join(out, 'x')], { cwd: root, encoding: 'utf8' });
  check('thieu --ticks: exit khac 0, co stderr', r.status !== 0 && r.stderr.length > 0);
}

console.log(`\n${pass} dat, ${fail} that bai`);
process.exit(fail ? 1 : 0);
