// Loi mo phong Dao Den Long - Night 1. Thuan JS, khong phu thuoc do hoa/DOM.
import { makeRng } from './prng.mjs';

export const TICK_RATE = 60;
const DT = 1 / TICK_RATE;
export const ISLAND_RADIUS = 20;
const LANTERN_RING = 12;
const RANDOM_MOTES = 20;
const RANDOM_SHADES = 3;
const MAX_SHADES = 5;
const SHADE_SPAWN_EVERY_TICKS = 600;
const SHADE_Y = 0.5;
const GRAVITY = 20;
const JUMP_V = 7;

export class SimError extends Error {}

const r3 = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? 0 : r;
};
const rv = (p) => [r3(p[0]), r3(p[1]), r3(p[2])];
const hdist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

function clampIsland(p) {
  const d = Math.hypot(p[0], p[2]);
  if (d > ISLAND_RADIUS) {
    p[0] = (p[0] / d) * ISLAND_RADIUS;
    p[2] = (p[2] / d) * ISLAND_RADIUS;
  }
}

function toPos3(p, what) {
  if (!Array.isArray(p) || (p.length !== 2 && p.length !== 3) || !p.every(Number.isFinite)) {
    throw new SimError(`${what}: pos phai la [x,z] hoac [x,y,z]`);
  }
  return p.length === 2 ? [p[0], 0, p[1]] : [p[0], p[1], p[2]];
}

export function createSim({ contract, seed, scenario = {} }) {
  const T = contract.tuning;
  const S = T.score;
  const rng = makeRng(seed);

  const sim = {
    state: 'playing',
    steps: 0,
    score: 0,
    timeLeft0: scenario.time_left_s ?? T.night1_duration_s,
    player: {
      pos: [0, 0, 0],
      vy: 0,
      carried: 0,
      flames: T.flames,
      invuln: 0,
      pulseCd: 0,
    },
    lanterns: [],
    shades: [],
    motes: [],
    shadeCounter: 0,
    randomShades: scenario.random_shades !== false,
    input: { move: [0, 0], yaw: 0, jump: false, interact: false, pulse: false },
    events: [],
  };

  // Den: L1..L5 tren vong tron
  for (let i = 0; i < T.lantern_count_night1; i++) {
    const ang = (i / T.lantern_count_night1) * Math.PI * 2;
    sim.lanterns.push({
      id: `L${i + 1}`,
      pos: [LANTERN_RING * Math.cos(ang), 0, LANTERN_RING * Math.sin(ang)],
      deposited: 0,
      lit: false,
    });
  }

  // Scenario
  const pl = scenario.player;
  if (pl) {
    if (pl.pos !== undefined) sim.player.pos = toPos3(pl.pos, 'player');
    if (pl.carried !== undefined) sim.player.carried = pl.carried;
    if (pl.flames !== undefined) sim.player.flames = pl.flames;
  }
  for (const u of scenario.lanterns ?? []) {
    const l = sim.lanterns.find((x) => x.id === u.id);
    if (!l) throw new SimError(`scenario: khong co den ${u.id}`);
    if (u.pos !== undefined) l.pos = toPos3(u.pos, `lantern ${u.id}`);
    if (u.lit !== undefined) {
      l.lit = !!u.lit;
      l.deposited = l.lit ? T.lantern_cost : 0;
    }
  }
  for (const m of scenario.motes ?? []) {
    sim.motes.push(toPos3(Array.isArray(m) ? m : m.pos, 'mote'));
  }
  const usedIds = new Set();
  for (const s of scenario.shades ?? []) {
    if (s.id !== undefined) usedIds.add(s.id);
  }
  const nextShadeId = () => {
    let id;
    do {
      id = `S${++sim.shadeCounter}`;
    } while (usedIds.has(id));
    usedIds.add(id);
    return id;
  };
  for (const s of scenario.shades ?? []) {
    const pos = toPos3(s.pos, 'shade');
    pos[1] = s.pos.length === 3 ? pos[1] : SHADE_Y;
    sim.shades.push({ id: s.id ?? nextShadeId(), pos, state: 'chase', stun: 0 });
  }

  // Ngau nhien (sau scenario, dung rng co seed)
  if (scenario.random_motes !== false) {
    for (let i = 0; i < RANDOM_MOTES; i++) {
      const ang = rng() * Math.PI * 2;
      const rad = 3 + Math.sqrt(rng()) * 15;
      sim.motes.push([rad * Math.cos(ang), 0, rad * Math.sin(ang)]);
    }
  }
  if (sim.randomShades) {
    for (let i = 0; i < RANDOM_SHADES; i++) sim.shades.push(spawnShade());
  }

  function spawnShade() {
    const ang = rng() * Math.PI * 2;
    const rad = 14 + rng() * 4;
    return {
      id: nextShadeId(),
      pos: [rad * Math.cos(ang), SHADE_Y, rad * Math.sin(ang)],
      state: 'chase',
      stun: 0,
    };
  }

  const emit = (name, data) => sim.events.push({ type: 'event', tick: sim.steps, name, data });

  function gameOver(result, reason) {
    sim.state = result;
    if (result === 'won') {
      const left = Math.max(0, sim.timeLeft0 - sim.steps / TICK_RATE);
      sim.score += S.per_second_left * Math.floor(left) + S.per_flame_left * sim.player.flames;
    }
    emit('game_over', { result, reason });
  }

  function step(frame = {}) {
    sim.events = [];
    if (sim.state !== 'playing') return sim.events;
    const prev = sim.input;
    const inp = {
      move: frame.move ?? prev.move,
      yaw: frame.cam_yaw_deg ?? prev.yaw,
      jump: frame.jump ?? prev.jump,
      interact: frame.interact ?? prev.interact,
      pulse: frame.pulse ?? prev.pulse,
    };
    const jumpEdge = inp.jump && !prev.jump;
    const interactEdge = inp.interact && !prev.interact;
    const pulseEdge = inp.pulse && !prev.pulse;
    sim.input = inp;
    sim.steps += 1;
    const p = sim.player;

    // 1. Di chuyen (yaw 0: move [x,z] = huong the gioi)
    let [mx, mz] = inp.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const yaw = (inp.yaw * Math.PI) / 180;
    const wx = mx * Math.cos(yaw) + mz * Math.sin(yaw);
    const wz = -mx * Math.sin(yaw) + mz * Math.cos(yaw);
    p.pos[0] += wx * T.player_speed * DT;
    p.pos[2] += wz * T.player_speed * DT;
    clampIsland(p.pos);
    if (jumpEdge && p.pos[1] === 0) p.vy = JUMP_V;
    if (p.pos[1] > 0 || p.vy > 0) {
      p.vy -= GRAVITY * DT;
      p.pos[1] = Math.max(0, p.pos[1] + p.vy * DT);
      if (p.pos[1] === 0) p.vy = 0;
    }
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - DT);
    if (p.pulseCd > 0) p.pulseCd = Math.max(0, p.pulseCd - DT);

    // 2. Nhat dom dom
    for (let i = 0; i < sim.motes.length; ) {
      if (p.carried < T.carry_capacity && hdist(p.pos, sim.motes[i]) <= T.pickup_radius) {
        sim.motes.splice(i, 1);
        p.carried += 1;
        sim.score += S.per_mote;
        emit('mote_picked', { carried: p.carried });
      } else i++;
    }

    // 3. Interact: nap den gan nhat chua sang
    if (interactEdge && p.carried > 0) {
      let best = null;
      let bestD = Infinity;
      for (const l of sim.lanterns) {
        if (l.lit) continue;
        const d = hdist(p.pos, l.pos);
        if (d <= T.interact_radius && d < bestD) {
          best = l;
          bestD = d;
        }
      }
      if (best) {
        const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
        if (amount > 0) {
          p.carried -= amount;
          best.deposited += amount;
          emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= T.lantern_cost) {
            best.lit = true;
            sim.score += S.per_lantern;
            emit('lantern_lit', { lantern_id: best.id });
          }
        }
      }
    }
    if (sim.lanterns.every((l) => l.lit)) {
      gameOver('won', 'all_lit');
      return sim.events;
    }

    // 4. Pulse
    if (pulseEdge && p.carried >= T.pulse_cost && p.pulseCd <= 0) {
      p.carried -= T.pulse_cost;
      p.pulseCd = T.pulse_cooldown_s;
      const ids = [];
      for (const s of sim.shades) {
        if (hdist(p.pos, s.pos) <= T.pulse_radius) {
          let dx = s.pos[0] - p.pos[0];
          let dz = s.pos[2] - p.pos[2];
          const d = Math.hypot(dx, dz);
          if (d === 0) {
            dx = 1;
            dz = 0;
          } else {
            dx /= d;
            dz /= d;
          }
          s.pos[0] += dx * T.pulse_push_m;
          s.pos[2] += dz * T.pulse_push_m;
          clampIsland(s.pos);
          s.state = 'stunned';
          s.stun = T.pulse_stun_s;
          sim.score += S.per_stun;
          ids.push(s.id);
        }
      }
      emit('pulse', { stunned_ids: ids });
    }

    // 5. Shade: dem nguoc choang, duoi theo Mây, tranh vung an toan
    for (const s of sim.shades) {
      if (s.state === 'stunned') {
        s.stun -= DT;
        if (s.stun <= 1e-9) {
          s.stun = 0;
          s.state = 'chase';
        }
        continue;
      }
      const dx = p.pos[0] - s.pos[0];
      const dz = p.pos[2] - s.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 0) {
        const m = Math.min(d, T.shade_speed * DT);
        s.pos[0] += (dx / d) * m;
        s.pos[2] += (dz / d) * m;
      }
      for (const l of sim.lanterns) {
        if (!l.lit) continue;
        let ox = s.pos[0] - l.pos[0];
        let oz = s.pos[2] - l.pos[2];
        const od = Math.hypot(ox, oz);
        if (od < T.safe_radius) {
          if (od === 0) {
            ox = 1;
            oz = 0;
          } else {
            ox /= od;
            oz /= od;
          }
          s.pos[0] = l.pos[0] + ox * T.safe_radius;
          s.pos[2] = l.pos[2] + oz * T.safe_radius;
        }
      }
    }

    // 6. Sinh them shade
    if (sim.randomShades && sim.steps % SHADE_SPAWN_EVERY_TICKS === 0 && sim.shades.length < MAX_SHADES) {
      const s = spawnShade();
      sim.shades.push(s);
      emit('shade_spawned', { id: s.id });
    }

    // 7. Va cham
    if (p.invuln <= 0) {
      for (const s of sim.shades) {
        if (s.state === 'chase' && hdist(p.pos, s.pos) <= T.shade_hit_radius) {
          p.flames -= 1;
          const dropped = Math.floor(p.carried * T.hit_drop_ratio);
          p.carried -= dropped;
          for (let i = 0; i < dropped; i++) {
            const a = (i / dropped) * Math.PI * 2;
            const m = [p.pos[0] + 2 * Math.cos(a), 0, p.pos[2] + 2 * Math.sin(a)];
            clampIsland(m);
            sim.motes.push(m);
          }
          p.invuln = T.invuln_s;
          emit('player_hit', { by: 'shade', flames: p.flames, dropped });
          break;
        }
      }
    }
    if (p.flames <= 0) {
      gameOver('lost', 'no_flames');
      return sim.events;
    }

    // 8. Het gio
    if (sim.timeLeft0 - sim.steps / TICK_RATE <= 1e-9) gameOver('lost', 'dawn');
    return sim.events;
  }

  function snapshot() {
    return {
      type: 'snapshot',
      tick: sim.steps,
      sim_tick: sim.steps,
      state: sim.state,
      time_left_s: r3(Math.max(0, sim.timeLeft0 - sim.steps / TICK_RATE)),
      score: sim.score,
      player: {
        pos: rv(sim.player.pos),
        carried: sim.player.carried,
        flames: sim.player.flames,
        invuln_s: r3(sim.player.invuln),
      },
      lanterns: sim.lanterns.map((l) => ({
        id: l.id,
        pos: rv(l.pos),
        lit: l.lit,
        deposited: l.deposited,
      })),
      shades: sim.shades.map((s) => ({ id: s.id, pos: rv(s.pos), state: s.state })),
      motes_active: sim.motes.length,
      motes: sim.motes.map(rv),
    };
  }

  return { step, snapshot, sim };
}
