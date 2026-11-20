#!/usr/bin/env node
// Headless CLI theo Test Contract v1.0.
// node sim/cli.mjs --seed N --night 1 [--scenario f] [--inputs f] --ticks N --out f.jsonl [--snapshot-every N]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSim, SimError, SHADE_STATES, DRIFTER_STATES } from './sim.mjs';

class UsageError extends Error {}
class InputError extends Error {} // exit 2

function parseArgs(argv) {
  const known = new Set(['seed', 'night', 'scenario', 'inputs', 'ticks', 'out', 'snapshot-every']);
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) throw new UsageError(`tham so la: ${k}`);
    const name = k.slice(2);
    if (!known.has(name)) throw new UsageError(`khong biet tham so: ${k}`);
    if (i + 1 >= argv.length) throw new UsageError(`thieu gia tri cho ${k}`);
    a[name] = argv[++i];
  }
  const int = (name, min, required) => {
    if (a[name] === undefined) {
      if (required) throw new UsageError(`thieu --${name}`);
      return undefined;
    }
    if (!/^-?\d+$/.test(a[name])) throw new UsageError(`--${name} phai la so nguyen`);
    const v = Number(a[name]);
    if (v < min) throw new UsageError(`--${name} phai >= ${min}`);
    return v;
  };
  const seed = int('seed', -Infinity, true);
  const ticks = int('ticks', 0, true);
  const every = int('snapshot-every', 1, false) ?? 10;
  const night = int('night', 1, false) ?? 1;
  if (night > 3) throw new UsageError('--night phai la 1, 2 hoac 3');
  if (a.out === undefined) throw new UsageError('thieu --out');
  return { seed, ticks, every, night, out: a.out, scenario: a.scenario, inputs: a.inputs };
}

function readJson(file, what) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    throw new InputError(`${what}: khong doc duoc ${file}: ${e.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new InputError(`${what}: JSON hong (${file}): ${e.message}`);
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function validateInputs(raw) {
  const frames = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.frames) ? raw.frames : null;
  if (!frames) throw new InputError('inputs: phai la mang frame (hoac {"frames":[...]})');
  let last = -1;
  for (const [i, f] of frames.entries()) {
    const at = `inputs[${i}]`;
    if (!isObj(f)) throw new InputError(`${at}: phai la object`);
    if (!Number.isInteger(f.tick) || f.tick < 0) throw new InputError(`${at}: tick phai la so nguyen >= 0`);
    if (f.tick <= last) throw new InputError(`${at}: tick phai tang chat`);
    last = f.tick;
    if (f.move !== undefined) {
      if (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every(isNum) || f.move.some((v) => v < -1 || v > 1))
        throw new InputError(`${at}: move phai la [x,z] trong [-1,1]`);
    }
    if (f.cam_yaw_deg !== undefined && !isNum(f.cam_yaw_deg)) throw new InputError(`${at}: cam_yaw_deg phai la so`);
    for (const k of ['jump', 'interact', 'pulse', 'dash', 'pause']) {
      if (f[k] !== undefined && typeof f[k] !== 'boolean') throw new InputError(`${at}: ${k} phai la boolean`);
    }
  }
  return frames;
}

function validateScenario(s) {
  if (!isObj(s)) throw new InputError('scenario: phai la object');
  const bad = (m) => {
    throw new InputError(`scenario: ${m}`);
  };
  const pos = (p, w) => {
    if (!Array.isArray(p) || (p.length !== 2 && p.length !== 3) || !p.every(isNum)) bad(`${w}: pos khong hop le`);
  };
  if (s.player !== undefined) {
    if (!isObj(s.player)) bad('player phai la object');
    if (s.player.pos !== undefined) pos(s.player.pos, 'player');
    if (s.player.carried !== undefined && !(Number.isInteger(s.player.carried) && s.player.carried >= 0)) bad('player.carried');
    if (s.player.flames !== undefined && !(Number.isInteger(s.player.flames) && s.player.flames >= 0)) bad('player.flames');
    for (const k of ['invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks', 'successful_lights']) {
      if (s.player[k] !== undefined && !(Number.isInteger(s.player[k]) && s.player[k] >= 0)) bad(`player.${k}`);
    }
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) {
    if (s[k] !== undefined && typeof s[k] !== 'boolean') bad(`${k} phai la boolean`);
  }
  if (s.time_left_s !== undefined && !(isNum(s.time_left_s) && s.time_left_s >= 0)) bad('time_left_s');
  if (s.motes !== undefined) {
    if (!Array.isArray(s.motes)) bad('motes phai la mang');
    s.motes.forEach((m, i) => pos(Array.isArray(m) ? m : m?.pos, `motes[${i}]`));
  }
  if (s.shades !== undefined) {
    if (!Array.isArray(s.shades)) bad('shades phai la mang');
    const ids = new Set();
    s.shades.forEach((x, i) => {
      if (!isObj(x)) bad(`shades[${i}] phai la object`);
      pos(x.pos, `shades[${i}]`);
      if (x.state !== undefined && !SHADE_STATES.includes(x.state)) bad(`shades[${i}].state khong hop le`);
      if (x.state_ticks_left !== undefined && !(Number.isInteger(x.state_ticks_left) && x.state_ticks_left >= 0)) bad(`shades[${i}].state_ticks_left`);
      if (x.target_lantern_id !== undefined && typeof x.target_lantern_id !== 'string') bad(`shades[${i}].target_lantern_id`);
      if (x.id !== undefined) {
        if (typeof x.id !== 'string') bad(`shades[${i}].id`);
        if (ids.has(x.id)) bad(`shades: trung id ${x.id}`);
        ids.add(x.id);
      }
    });
  }
  if (s.drifters !== undefined) {
    if (!Array.isArray(s.drifters)) bad('drifters phai la mang');
    s.drifters.forEach((d, i) => {
      if (!isObj(d)) bad(`drifters[${i}] phai la object`);
      pos(d.pos, `drifters[${i}]`);
      if (d.state !== undefined && !DRIFTER_STATES.includes(d.state)) bad(`drifters[${i}].state khong hop le`);
      if (d.stolen !== undefined && !(Number.isInteger(d.stolen) && d.stolen >= 0)) bad(`drifters[${i}].stolen`);
      if (d.id !== undefined && typeof d.id !== 'string') bad(`drifters[${i}].id`);
    });
  }
  if (s.charms !== undefined) {
    if (!Array.isArray(s.charms)) bad('charms phai la mang');
    s.charms.forEach((c, i) => {
      if (!isObj(c) || typeof c.id !== 'string') bad(`charms[${i}] can id`);
      pos(c.pos, `charms[${i}]`);
      if (c.available !== undefined && typeof c.available !== 'boolean') bad(`charms[${i}].available`);
      if (c.respawn_s !== undefined && !(isNum(c.respawn_s) && c.respawn_s >= 0)) bad(`charms[${i}].respawn_s`);
    });
  }
  if (s.lanterns !== undefined) {
    if (!Array.isArray(s.lanterns)) bad('lanterns phai la mang');
    s.lanterns.forEach((l, i) => {
      if (!isObj(l) || typeof l.id !== 'string') bad(`lanterns[${i}] can id`);
      if (l.pos !== undefined) pos(l.pos, `lanterns[${i}]`);
      if (l.lit !== undefined && typeof l.lit !== 'boolean') bad(`lanterns[${i}].lit`);
      if (l.ever_lit !== undefined && typeof l.ever_lit !== 'boolean') bad(`lanterns[${i}].ever_lit`);
      if (l.fuel !== undefined && !(isNum(l.fuel) && l.fuel >= 0)) bad(`lanterns[${i}].fuel`);
      if (l.relit_count !== undefined && !(Number.isInteger(l.relit_count) && l.relit_count >= 0)) bad(`lanterns[${i}].relit_count`);
    });
  }
  return s;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));

  const frames = args.inputs ? validateInputs(readJson(args.inputs, 'inputs')) : [];
  const scenario = args.scenario ? validateScenario(readJson(args.scenario, 'scenario')) : {};

  let game;
  try {
    game = createSim({ contract, seed: args.seed, night: args.night, scenario });
  } catch (e) {
    if (e instanceof SimError) throw new InputError(e.message);
    throw e;
  }

  const lines = [];
  const push = (o) => lines.push(JSON.stringify(o));
  push(game.snapshot()); // tick 0
  let fi = 0;
  let steps = 0;
  while (steps < args.ticks && (game.sim.state === 'playing' || game.sim.state === 'paused')) {
    let frame = {};
    while (fi < frames.length && frames[fi].tick < steps) fi++;
    if (fi < frames.length && frames[fi].tick === steps) frame = frames[fi++];
    const events = game.step(frame);
    steps++;
    for (const ev of events) push(ev);
    if (steps % args.every === 0) push(game.snapshot());
  }
  push({ type: 'end', ticks: steps, state: game.sim.state, score: game.sim.score });
  writeFileSync(args.out, lines.join('\n') + '\n');
}

try {
  main();
} catch (e) {
  if (e instanceof InputError) {
    process.stderr.write(`Loi dau vao: ${e.message}\n`);
    process.exit(2);
  }
  if (e instanceof UsageError) {
    process.stderr.write(`Loi tham so: ${e.message}\n`);
    process.exit(1);
  }
  process.stderr.write(`Loi: ${e.stack ?? e}\n`);
  process.exit(1);
}
