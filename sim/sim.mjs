// Loi mo phong Dao Den Long (Ticket-02, contract v1.1). Thuan JS, khong phu thuoc do hoa/DOM.
// Thu tu xu ly moi tick theo dac ta; xem cac so "// B<n>" ben duoi.
import { makeRng } from './prng.mjs';
import { NIGHTS } from './maps.mjs';

export const TICK_RATE = 60;
const DT = 1 / TICK_RATE;
export const ISLAND_RADIUS = 40; // Dem 1 (dung cho giao dien)
export class SimError extends Error {}

// Hang so cau truc (so chuan khac nam trong game.contract.json)
const STEP_UP = 0.5; // cao toi da buoc len khi di bo
const STEP_DOWN = 0.3;
const FALL_Y = -10;
const FALL_WAIT = 60;
const RESPAWN_INVULN = 90;
const HIT_INVULN = 90;
const DROP_TTL = 480;
const MOTE_CAP = 30;
const MOTE_SPAWN_EVERY = 240;
const INITIAL_MOTES = 20;
const SHADE_FIRST = 300;
const SHADE_SPAWN_MIN_DIST = 15;
const SHADE_DETECT = 12;
const SHADE_LOSE = 18;
const SHADE_WANDER_SPEED = 2.0;
const STUN_TICKS_PUSH = 15;
const RECOIL_TICKS = 60;
const RECOIL_M = 2;
const EVICT_TICKS = 30;
const HEIGHT_TOL = 1.5;
const DRIFTER_SPEED = 7;
const DRIFTER_IDLE_SPEED = 2;
const DRIFTER_HIT = 1.2;
const DRIFTER_STEAL = 3;
const DRIFTER_NEED = 5;
const DRIFTER_NEAR = 15;
const DRIFTER_FLEE_TICKS = 240;
const DRIFTER_DROP_FLEE = 120;
const DRIFTER_EVERY = 1200;
const DRIFTER_MAX = 2;
const DRIFTER_Y = 2;
const CHARM_TICKS = 600;
const CHARM_RESPAWN = 2700;
const CHARM_SPEED = 7.2;
const WIND_EVERY = 1800;
const WIND_LEN = 300;
const WIND_WARN = 120;
const WIND_SPEED = 2;
const PAD_RADIUS = 1;
const DASH_TICKS_DEFAULT = 12;
const FU = 60; // nhien lieu tinh theo don vi nguyen 1/60
const DRAIN_STAND = 2; // Bong Muc dung hut dau khi cach den <= 2 m
const CAP_PER_LIGHT = 2;

const r3 = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? 0 : r;
};
const rv = (p) => [r3(p[0]), r3(p[1]), r3(p[2])];
const hd = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const idKey = (id) => {
  const m = /^([A-Za-z]*)(\d+)$/.exec(id);
  return m ? [m[1], Number(m[2])] : [id, 0];
};
const idCmp = (a, b) => {
  const [pa, na] = idKey(a.id);
  const [pb, nb] = idKey(b.id);
  return pa < pb ? -1 : pa > pb ? 1 : na - nb;
};

function toPos3(p, what, surf) {
  if (!Array.isArray(p) || (p.length !== 2 && p.length !== 3) || !p.every(Number.isFinite)) {
    throw new SimError(`${what}: pos phai la [x,z] hoac [x,y,z]`);
  }
  if (p.length === 3) return [p[0], p[1], p[2]];
  const s = surf ? surf(p[0], p[1]) : 0;
  return [p[0], s ?? 0, p[1]];
}

export const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
export const DRIFTER_STATES = ['idle', 'chase', 'flee'];

// bench: canh benchmark (Ticket-04): tat hao dau, nhat, sat thuong va dieu kien ket thuc; Bong Muc van wander binh thuong.
export function createSim({ contract, seed, night = 1, scenario = {}, bench = false }) {
  const T = contract.tuning;
  const S = T.score;
  const map = NIGHTS[night];
  if (!map) throw new SimError(`khong co dem ${night}`);
  const rng = makeRng(seed);
  const surf = map.surface;
  const duration = [T.night1_duration_s, T.night2_duration_s, T.night3_duration_s][night - 1];
  const dashTicks = Math.round(T.dash_duration_s * TICK_RATE) || DASH_TICKS_DEFAULT;
  const dashCdTicks = Math.round(T.dash_cooldown_s * TICK_RATE);
  const pulseCdTicks = Math.round(T.pulse_cooldown_s * TICK_RATE);
  const stunTicks = Math.round(T.pulse_stun_s * TICK_RATE);
  const FMAX = T.fuel_max * FU;
  const LOW = T.low_fuel_threshold * FU;
  const fuelOut = (l) => Math.round((Math.max(0, l.fuel) / FU) * 10) / 10;
  const capacity = () => Math.min(T.capacity_max, T.carry_capacity + CAP_PER_LIGHT * p.successfulLights);
  const shadeSpeed = night === 3 ? T.shade_speed_night3 : T.shade_speed;

  const sim = {
    state: 'playing',
    night,
    tick: 0, // so buoc da chay (ke ca tam dung)
    steps: 0, // sim_tick: khong tinh luc tam dung
    score: 0,
    timeLeft0: scenario.time_left_s ?? duration,
    paused: false,
    player: {
      pos: [...map.start],
      vel: [0, 0, 0],
      grounded: true,
      carried: 0,
      flames: T.flames,
      invuln: 0,
      dashCd: 0,
      pulseCd: 0,
      charm: 0,
      dashLeft: 0,
      dashDir: [0, 1],
      launched: false,
      launchVel: [0, 0],
      facing: [0, 1],
      respawn: 0,
      successfulLights: 0,
    },
    lanterns: [],
    shades: [],
    motes: [],
    drifters: [],
    charms: [],
    wind: { active: false, dir_deg: 0, warning: false },
    input: { move: [0, 0], yaw: 0, jump: false, interact: false, pulse: false, dash: false, pause: false },
    events: [],
    counters: { mote: 0, shade: 0, drifter: 0 },
  };
  const randomMotes = scenario.random_motes !== false;
  const randomShades = scenario.random_shades !== false;
  const randomDrifters = scenario.random_drifters !== false && map.drifters;
  const windEnabled = scenario.wind_enabled ?? map.wind;
  const p = sim.player;
  p.pos[1] = surf(p.pos[0], p.pos[2]) ?? 0;

  // ---------- Setup (khong phat event, khong tinh diem)
  const pl = scenario.player;
  if (pl) {
    if (pl.pos !== undefined) {
      p.pos = toPos3(pl.pos, 'player', surf);
      const s = surf(p.pos[0], p.pos[2]);
      p.grounded = s !== null && p.pos[1] <= s + 1e-6;
    }
    if (pl.carried !== undefined) p.carried = pl.carried;
    if (pl.flames !== undefined) p.flames = pl.flames;
    if (pl.invuln_ticks !== undefined) p.invuln = pl.invuln_ticks;
    if (pl.dash_cd_ticks !== undefined) p.dashCd = pl.dash_cd_ticks;
    if (pl.pulse_cd_ticks !== undefined) p.pulseCd = pl.pulse_cd_ticks;
    if (pl.charm_ticks !== undefined) p.charm = pl.charm_ticks;
    if (pl.successful_lights !== undefined) p.successfulLights = pl.successful_lights;
  }
  for (const [id, pos] of map.lanterns) {
    sim.lanterns.push({ id, pos: [...pos], deposited: 0, lit: false, zone: false, ever: false, relit: 0, fuel: 0 });
  }
  for (const u of scenario.lanterns ?? []) {
    const l = sim.lanterns.find((x) => x.id === u.id);
    if (!l) throw new SimError(`scenario: khong co den ${u.id}`);
    if (u.pos !== undefined) l.pos = toPos3(u.pos, `lantern ${u.id}`, surf);
    if (u.lit !== undefined) {
      l.lit = !!u.lit;
      l.deposited = l.lit ? T.lantern_cost : 0;
      l.fuel = l.lit ? Math.round((u.fuel ?? T.fuel_max) * FU) : 0;
      if (l.lit) l.ever = true;
    }
    if (u.ever_lit !== undefined) l.ever = !!u.ever_lit || l.lit;
    if (u.relit_count !== undefined) l.relit = u.relit_count;
  }
  for (const l of sim.lanterns) l.zone = l.lit && l.fuel >= LOW;

  const used = { S: new Set(), D: new Set(), M: new Set() };
  const nextId = (prefix, key) => {
    let id;
    do id = `${prefix}${++sim.counters[key]}`;
    while (used[prefix].has(id));
    used[prefix].add(id);
    return id;
  };
  const addMote = (pos, kind, ttl, pt, id) => {
    const m = { id: id ?? nextId('M', 'mote'), pos, kind, ttl, pt };
    if (id) used.M.add(id);
    sim.motes.push(m);
    return m;
  };

  for (const m of scenario.motes ?? []) {
    const o = Array.isArray(m) ? { pos: m } : m;
    addMote(
      toPos3(o.pos, 'mote', surf),
      o.kind === 'dropped' ? 'dropped' : 'random',
      o.kind === 'dropped' ? Math.round((o.ttl_s ?? DROP_TTL / TICK_RATE) * TICK_RATE) : null,
      -1,
      o.id
    );
  }
  for (const s of scenario.shades ?? []) if (s.id !== undefined) used.S.add(s.id);
  for (const s of scenario.shades ?? []) {
    const state = s.state ?? 'chase';
    const pos = toPos3(s.pos, 'shade', surf);
    if (s.pos.length === 2) pos[1] += 0.5;
    const left = s.state_ticks_left ?? (state === 'stunned' ? stunTicks : state === 'recoil' ? RECOIL_TICKS : 0);
    const ns = newShade(s.id ?? nextId('S', 'shade'), pos, state, left);
    ns.target = s.target_lantern_id ?? null;
    sim.shades.push(ns);
  }
  if (scenario.drifters !== undefined) {
    for (const d of scenario.drifters) {
      if (d.id !== undefined) used.D.add(d.id);
    }
    for (const d of scenario.drifters) {
      const pos = toPos3(d.pos, 'drifter', () => DRIFTER_Y);
      sim.drifters.push({
        id: d.id ?? nextId('D', 'drifter'),
        pos,
        state: d.state ?? 'idle',
        stolen: d.stolen ?? 0,
        stoleOnce: (d.stolen ?? 0) > 0,
        fleeLeft: d.state === 'flee' ? (d.state_ticks_left ?? DRIFTER_FLEE_TICKS) : 0,
        dir: [1, 0],
        dirLeft: 0,
      });
    }
  }
  if (scenario.charms !== undefined) {
    for (const c of scenario.charms) {
      sim.charms.push({
        id: c.id,
        pos: toPos3(c.pos, 'charm', surf),
        available: c.available !== false,
        respawn: Math.round((c.respawn_s ?? 0) * TICK_RATE),
      });
    }
  } else {
    for (const [id, pos] of map.charms) sim.charms.push({ id, pos: [...pos], available: true, respawn: 0 });
  }

  // Ngau nhien (sau scenario, dung rng co seed)
  if (randomMotes) {
    const idx = map.motePoints.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    for (const i of idx.slice(0, INITIAL_MOTES)) addMote([...map.motePoints[i]], 'random', null, i);
  }

  function newShade(id, pos, state, left) {
    return {
      id,
      pos,
      state,
      left, // tick con lai cua spawning/stunned/recoil
      push: 0,
      pushDir: [1, 0],
      recoilDir: [1, 0],
      evict: 0,
      evictFrom: -1,
      target: null,
      drainTicks: 0,
      dir: [1, 0],
      dirLeft: 0,
    };
  }

  const emit = (name, data) => sim.events.push({ type: 'event', tick: sim.tick, name, data });
  const totalTicks = () => Math.round(sim.timeLeft0 * TICK_RATE);
  const timeLeft = () => (totalTicks() - sim.steps) / TICK_RATE;

  // ---------- Hinh hoc
  function blocked(nx, nz, y) {
    if (map.tower && Math.hypot(nx, nz) < map.tower.r && y < map.tower.h) return true;
    const s = surf(nx, nz);
    return s !== null && s > y + STEP_UP;
  }
  // Di chuyen ngang co truot theo truc. canFall: Mây duoc buoc ra ngoai dao.
  function slide(pos, dx, dz, y, canFall) {
    const ok = (nx, nz) => !blocked(nx, nz, y) && (canFall || surf(nx, nz) !== null);
    if (ok(pos[0] + dx, pos[2] + dz)) {
      pos[0] += dx;
      pos[2] += dz;
      return true;
    }
    if (dx !== 0 && ok(pos[0] + dx, pos[2])) {
      pos[0] += dx;
      return true;
    }
    if (dz !== 0 && ok(pos[0], pos[2] + dz)) {
      pos[2] += dz;
      return true;
    }
    return false;
  }
  function moveShade(s, dx, dz) {
    const gy = s.pos[1] - 0.5;
    const old = [s.pos[0], 0, s.pos[2]];
    const moved = slide(s.pos, dx, dz, gy, false);
    if (!moved) return false;
    if (s.evict === 0) {
      for (const l of sim.lanterns) {
        if (!l.zone) continue;
        const d = hd(s.pos, l.pos);
        if (d < T.safe_radius && hd(old, l.pos) >= T.safe_radius - 1e-9) {
          let ox = s.pos[0] - l.pos[0];
          let oz = s.pos[2] - l.pos[2];
          const od = Math.hypot(ox, oz) || 1;
          s.pos[0] = l.pos[0] + (ox / od) * T.safe_radius;
          s.pos[2] = l.pos[2] + (oz / od) * T.safe_radius;
        }
      }
    }
    s.pos[1] = (surf(s.pos[0], s.pos[2]) ?? gy) + 0.5;
    return true;
  }
  const norm2 = (x, z, fallback = [1, 0]) => {
    const d = Math.hypot(x, z);
    return d < 1e-9 ? fallback : [x / d, z / d];
  };

  function gameOver(result, reason) {
    sim.state = result;
    if (result === 'won') {
      for (const l of sim.lanterns) if (l.lit) sim.score += S.per_dawn_lantern + Math.floor(l.fuel / FU);
      sim.score += S.per_flame_left * p.flames;
    }
    emit('game_over', { result, reason });
  }

  function respawnPlayer() {
    p.pos = [...map.start];
    p.pos[1] = surf(p.pos[0], p.pos[2]) ?? 0;
    p.vel = [0, 0, 0];
    p.grounded = true;
    p.launched = false;
    p.dashLeft = 0;
    p.invuln = RESPAWN_INVULN;
    p.facing = [0, 1];
  }

  function spawnShade() {
    const valid = map.shadePoints.filter((pt) => hd(pt, p.pos) >= SHADE_SPAWN_MIN_DIST);
    if (!valid.length) return;
    const pt = valid[Math.floor(rng() * valid.length)];
    const pos = [pt[0], (surf(pt[0], pt[2]) ?? 0) + 0.5, pt[2]];
    const s = newShade(nextId('S', 'shade'), pos, 'spawning', 1);
    sim.shades.push(s);
    emit('shade_spawned', { id: s.id });
  }

  // ---------- Mot tick
  function step(frame = {}) {
    sim.events = [];
    if (sim.state === 'won' || sim.state === 'lost') return sim.events;
    const prev = sim.input;
    const inp = {
      move: frame.move ?? prev.move,
      yaw: frame.cam_yaw_deg ?? prev.yaw,
      jump: frame.jump ?? prev.jump,
      interact: frame.interact ?? prev.interact,
      pulse: frame.pulse ?? prev.pulse,
      dash: frame.dash ?? prev.dash,
      pause: frame.pause ?? prev.pause,
    };
    const edge = (k) => inp[k] && !prev[k];
    sim.input = inp;
    sim.tick += 1;
    if (sim.tick === 1) emit('night_start', { night });

    // B1: pause
    if (edge('pause')) {
      if (!sim.paused) {
        sim.paused = true;
        sim.state = 'paused';
        emit('paused', {});
        return sim.events;
      }
      sim.paused = false;
      sim.state = 'playing';
      emit('resumed', {});
    }
    if (sim.paused) return sim.events;

    // B2: dem nguoc cac bo dem
    sim.steps += 1;
    const dec = (v) => (v > 0 ? v - 1 : 0);
    p.dashCd = dec(p.dashCd);
    p.pulseCd = dec(p.pulseCd);
    p.invuln = dec(p.invuln);
    p.charm = dec(p.charm);
    for (const s of sim.shades) {
      s.left = dec(s.left);
      s.evict = dec(s.evict);
    }
    for (const m of sim.motes) if (m.ttl !== null) m.ttl -= 1;
    sim.motes = sim.motes.filter((m) => m.ttl === null || m.ttl > 0);
    for (const c of sim.charms) {
      if (!c.available) {
        c.respawn = dec(c.respawn);
        if (c.respawn === 0) c.available = true;
      }
    }

    // nhien lieu: hao 1/tick + bi hut (don vi 1/60); den het dau thi tat
    if (!bench) for (const l of sim.lanterns) if (l.lit) l.fuel -= T.fuel_decay_per_s;
    for (const s of bench ? [] : sim.shades) {
      if (s.state !== 'drain') continue;
      const l = sim.lanterns.find((x) => x.id === s.target);
      if (!l || !l.lit || l.fuel >= LOW || hd(s.pos, l.pos) > DRAIN_STAND) continue;
      l.fuel -= T.drain_per_s;
      s.drainTicks += 1;
      if (s.drainTicks % TICK_RATE === 0) emit('fuel_drain', { lantern_id: l.id, shade_id: s.id, fuel: fuelOut(l) });
    }
    for (const l of sim.lanterns) {
      if (l.lit && l.fuel <= 0) {
        l.lit = false;
        l.fuel = 0;
        l.deposited = 0;
        emit('lantern_out', { lantern_id: l.id });
      }
    }

    // gio
    if (windEnabled) {
      const c = sim.steps % WIND_EVERY;
      if (sim.steps >= WIND_EVERY && c < WIND_LEN) {
        if (c === 0) sim.wind.dir_deg = Math.floor(rng() * 360);
        sim.wind.active = true;
        sim.wind.warning = false;
      } else {
        sim.wind.active = false;
        sim.wind.warning = c >= WIND_EVERY - WIND_WARN;
      }
    }

    const waiting = p.respawn > 0;

    // B3: di chuyen Mây
    if (waiting) {
      p.respawn -= 1;
      if (p.respawn === 0) respawnPlayer();
    } else {
      const speed = p.charm > 0 ? CHARM_SPEED : T.player_speed;
      let [mx, mz] = inp.move;
      const len = Math.hypot(mx, mz);
      if (len > 1) {
        mx /= len;
        mz /= len;
      }
      const yaw = (inp.yaw * Math.PI) / 180;
      const wx = mx * Math.cos(yaw) + mz * Math.sin(yaw);
      const wz = -mx * Math.sin(yaw) + mz * Math.cos(yaw);
      const hasMove = Math.hypot(wx, wz) > 1e-9;
      if (hasMove) p.facing = norm2(wx, wz);

      if (edge('dash') && p.dashLeft === 0 && (p.dashCd === 0 || p.charm > 0)) {
        p.dashLeft = dashTicks;
        p.dashDir = hasMove ? norm2(wx, wz) : [...p.facing];
        p.dashCd = p.charm > 0 ? 0 : dashCdTicks;
        emit('dash', {});
      }
      if (edge('jump') && p.grounded && p.dashLeft === 0) {
        p.vel[1] = T.jump_velocity;
        p.grounded = false;
      }
      const dashing = p.dashLeft > 0;
      if (dashing) {
        p.vel[0] = p.dashDir[0] * T.dash_speed;
        p.vel[2] = p.dashDir[1] * T.dash_speed;
        p.vel[1] = 0;
        p.dashLeft -= 1;
      } else if (p.launched) {
        p.vel[0] = p.launchVel[0];
        p.vel[2] = p.launchVel[1];
      } else {
        const tx = wx * speed;
        const tz = wz * speed;
        const ddx = tx - p.vel[0];
        const ddz = tz - p.vel[2];
        const dl = Math.hypot(ddx, ddz);
        const maxd = speed / 6; // dat toc do muc tieu trong <= 0.1 s
        if (dl <= maxd) {
          p.vel[0] = tx;
          p.vel[2] = tz;
        } else {
          p.vel[0] += (ddx / dl) * maxd;
          p.vel[2] += (ddz / dl) * maxd;
        }
      }
      if (!dashing && !p.grounded) p.vel[1] -= T.gravity * DT;

      let dx = p.vel[0] * DT;
      let dz = p.vel[2] * DT;
      if (sim.wind.active) {
        const a = (sim.wind.dir_deg * Math.PI) / 180;
        dx += Math.cos(a) * WIND_SPEED * DT;
        dz += Math.sin(a) * WIND_SPEED * DT;
      }
      slide(p.pos, dx, dz, p.pos[1], true);

      const s = surf(p.pos[0], p.pos[2]);
      if (p.grounded && !dashing) {
        if (s !== null && p.pos[1] - s <= STEP_DOWN && s - p.pos[1] <= STEP_UP) p.pos[1] = s;
        else {
          p.grounded = false;
          p.vel[1] = 0;
        }
      } else if (p.grounded) {
        if (s !== null && Math.abs(p.pos[1] - s) <= STEP_UP) p.pos[1] = s;
        else p.grounded = false;
      } else {
        if (!dashing) p.pos[1] += p.vel[1] * DT;
        if (s !== null && p.vel[1] <= 0 && p.pos[1] <= s) {
          p.pos[1] = s;
          p.vel[1] = 0;
          p.grounded = true;
          p.launched = false;
        }
      }
      if (p.grounded) p.vel[1] = 0;

      // bục nhảy
      if (p.grounded) {
        for (const pad of map.pads) {
          if (hd(p.pos, pad.pos) <= PAD_RADIUS && Math.abs(p.pos[1] - pad.pos[1]) <= STEP_UP) {
            p.vel[1] = pad.vy;
            p.launchVel = [pad.dir[0] * pad.h, pad.dir[1] * pad.h];
            p.vel[0] = p.launchVel[0];
            p.vel[2] = p.launchVel[1];
            p.grounded = false;
            p.launched = true;
            break;
          }
        }
      }

      // roi khoi dao
      if (T.fall_enabled && p.pos[1] < FALL_Y) {
        p.flames -= 1;
        const lost = p.carried;
        p.carried = 0;
        p.vel = [0, 0, 0];
        p.dashLeft = 0;
        p.launched = false;
        p.respawn = FALL_WAIT;
        emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
      }
    }

    const active = p.respawn === 0 && p.flames > 0;

    // B4: nhat dom dom va bua
    if (active && !bench) {
      for (let i = 0; i < sim.motes.length; ) {
        const m = sim.motes[i];
        if (p.carried < capacity() && hd(p.pos, m.pos) <= T.pickup_radius && Math.abs(p.pos[1] - m.pos[1]) <= HEIGHT_TOL) {
          sim.motes.splice(i, 1);
          p.carried += 1;
          emit('mote_picked', { carried: p.carried });
        } else i++;
      }
      for (const c of sim.charms) {
        if (c.available && hd(p.pos, c.pos) <= T.pickup_radius && Math.abs(p.pos[1] - c.pos[1]) <= HEIGHT_TOL) {
          c.available = false;
          c.respawn = CHARM_RESPAWN;
          p.charm = CHARM_TICKS;
          emit('charm_picked', { charm_id: c.id, charm_ticks: CHARM_TICKS });
        }
      }
    }

    // B5: tuong tac - nap/thap den, hoac chau dau cho den dang sang
    if (active && edge('interact') && p.carried > 0) {
      let best = null;
      let bestD = Infinity;
      for (const l of sim.lanterns) {
        if (l.lit && l.fuel >= FMAX) continue; // den day dau khong duoc chon
        const d = hd(p.pos, l.pos);
        if (d <= T.interact_radius && d < bestD) {
          best = l;
          bestD = d;
        }
      }
      if (best && !best.lit) {
        const cost = best.ever ? T.relight_cost : T.lantern_cost;
        const amount = Math.min(p.carried, cost - best.deposited);
        if (amount > 0) {
          p.carried -= amount;
          best.deposited += amount;
          sim.score += S.per_mote * amount;
          emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= cost) {
            const relight = best.ever;
            best.lit = true;
            best.ever = true;
            best.fuel = FMAX;
            if (relight) best.relit += 1;
            sim.score += relight ? S.per_relight : S.per_lantern;
            p.successfulLights += 1;
            emit('lantern_lit', { lantern_id: best.id, relight });
          }
        }
      } else if (best) {
        const used = Math.min(p.carried, Math.ceil((FMAX - best.fuel) / (T.fuel_per_mote * FU)));
        if (used > 0) {
          p.carried -= used;
          best.fuel = Math.min(FMAX, best.fuel + T.fuel_per_mote * FU * used);
          sim.score += S.per_mote * used;
          emit('refuel', { lantern_id: best.id, amount: used, fuel: fuelOut(best) });
        }
      }
    }

    // B6: vung an toan - chi den sang va fuel >= 30; vua co vung (thap hoac chau dau) thi day Bong Muc ben trong ra
    sim.lanterns.forEach((l, li) => {
      const act = l.lit && l.fuel >= LOW;
      if (act && !l.zone) {
        for (const s of sim.shades) {
          if (hd(s.pos, l.pos) < T.safe_radius) {
            s.evict = EVICT_TICKS;
            s.evictFrom = li;
            if (s.state === 'drain') s.state = 'wander';
          }
        }
      }
      l.zone = act;
    });

    // B7: Toa Sang
    if (active && edge('pulse') && p.carried >= T.pulse_cost && p.pulseCd === 0) {
      p.carried -= T.pulse_cost;
      p.pulseCd = pulseCdTicks;
      const center = [p.pos[0], p.pos[1] + 0.8, p.pos[2]];
      const ids = [];
      for (const s of [...sim.shades].sort(idCmp)) {
        if (d3(center, s.pos) <= T.pulse_radius) {
          const wasDrain = s.state === 'drain';
          s.state = 'stunned';
          s.left = stunTicks;
          s.push = STUN_TICKS_PUSH;
          s.pushDir = norm2(s.pos[0] - center[0], s.pos[2] - center[2]);
          sim.score += wasDrain ? S.per_stun_drain : S.per_stun;
          ids.push(s.id);
        }
      }
      emit('pulse', { stunned_ids: ids });
      for (const d of [...sim.drifters].sort(idCmp)) {
        if (d3(center, d.pos) > T.pulse_radius) continue;
        if (d.state === 'chase') {
          d.state = 'flee';
          d.fleeLeft = DRIFTER_FLEE_TICKS;
          d.stoleOnce = true;
        } else if (d.state === 'flee' && d.stolen > 0) {
          const amount = d.stolen;
          d.stolen = 0;
          d.fleeLeft = DRIFTER_DROP_FLEE;
          const gy = surf(d.pos[0], d.pos[2]);
          if (gy !== null) for (let i = 0; i < amount; i++) addMote([d.pos[0], gy, d.pos[2]], 'dropped', DROP_TTL, -1);
          emit('drifter_drop', { drifter_id: d.id, amount });
        }
      }
    }

    // B8: di chuyen Bong Muc va Gio Lac
    const playerAlive = p.flames > 0;
    for (const s of sim.shades) {
      if (s.state === 'spawning') {
        if (s.left === 0) s.state = 'wander';
        continue;
      }
      if (s.evict > 0) {
        const l = sim.lanterns[s.evictFrom];
        const d = hd(s.pos, l.pos);
        const need = Math.max(0, T.safe_radius - d);
        if (need > 0) {
          const o = norm2(s.pos[0] - l.pos[0], s.pos[2] - l.pos[2]);
          const m = need / s.evict;
          moveShade(s, o[0] * m, o[1] * m);
        }
        continue;
      }
      const dp = hd(s.pos, p.pos);
      if (s.state === 'stunned') {
        if (s.push > 0) {
          const m = T.pulse_push_m / STUN_TICKS_PUSH;
          moveShade(s, s.pushDir[0] * m, s.pushDir[1] * m);
          s.push -= 1;
        }
      } else if (s.state === 'recoil') {
        const m = RECOIL_M / RECOIL_TICKS;
        moveShade(s, s.recoilDir[0] * m, s.recoilDir[1] * m);
      } else {
        if (s.state === 'drain') {
          const dl = sim.lanterns.find((x) => x.id === s.target);
          if (!dl || !dl.lit || dl.fuel >= LOW || hd(s.pos, dl.pos) > DRAIN_STAND) s.state = 'wander';
          else if (dp <= T.safe_radius) s.state = 'chase';
        }
        if (s.state === 'wander' && dp <= SHADE_DETECT) s.state = 'chase';
        else if (s.state === 'chase' && dp > SHADE_LOSE) s.state = 'wander';
        if (s.state === 'chase') {
          const o = norm2(p.pos[0] - s.pos[0], p.pos[2] - s.pos[2], [0, 0]);
          const m = Math.min(dp, shadeSpeed * DT);
          moveShade(s, o[0] * m, o[1] * m);
        } else if (s.state === 'wander') {
          // wander: toi den sang yeu nhat (fuel < 30, gan nhat, id nho hon khi bang nhau); khong co thi ve den tat gan nhat
          let tgt = null;
          let td = Infinity;
          for (const l of sim.lanterns) {
            if (!l.lit || l.fuel >= LOW) continue;
            const d = hd(s.pos, l.pos);
            if (d < td) (tgt = l), (td = d);
          }
          if (!tgt) {
            for (const l of sim.lanterns) {
              if (l.lit) continue;
              const d = hd(s.pos, l.pos);
              if (d < td) (tgt = l), (td = d);
            }
          }
          s.target = tgt ? tgt.id : null;
          if (tgt) {
            if (td <= DRAIN_STAND) {
              if (tgt.lit) {
                s.state = 'drain';
                s.drainTicks = 0;
              }
            } else {
              const o = norm2(tgt.pos[0] - s.pos[0], tgt.pos[2] - s.pos[2]);
              const m = Math.min(td - DRAIN_STAND + 0.001, shadeSpeed * DT);
              moveShade(s, o[0] * m, o[1] * m);
            }
          } else {
            if (s.dirLeft <= 0) {
              const a = rng() * Math.PI * 2;
              s.dir = [Math.cos(a), Math.sin(a)];
              s.dirLeft = 120;
            }
            s.dirLeft -= 1;
            if (!moveShade(s, s.dir[0] * SHADE_WANDER_SPEED * DT, s.dir[1] * SHADE_WANDER_SPEED * DT)) s.dirLeft = 0;
          }
        }
      }
      // het choang / het lui: hanh dong tick cuoi roi chuyen trang thai
      if (s.state === 'stunned' && s.left === 0) s.state = 'wander';
      else if (s.state === 'recoil' && s.left === 0) s.state = hd(s.pos, p.pos) <= SHADE_DETECT ? 'chase' : 'wander';
    }
    for (const d of sim.drifters) {
      const near = active && p.carried >= DRIFTER_NEED && hd(d.pos, p.pos) <= DRIFTER_NEAR;
      if (d.state === 'idle' && near) d.state = 'chase';
      else if (d.state === 'chase' && !near) d.state = 'idle';
      if (d.state === 'chase') {
        const o = norm2(p.pos[0] - d.pos[0], p.pos[2] - d.pos[2], [0, 0]);
        const m = Math.min(hd(d.pos, p.pos), DRIFTER_SPEED * DT);
        d.pos[0] += o[0] * m;
        d.pos[2] += o[1] * m;
      } else if (d.state === 'flee') {
        const o = norm2(d.pos[0] - p.pos[0], d.pos[2] - p.pos[2]);
        d.pos[0] += o[0] * DRIFTER_SPEED * DT;
        d.pos[2] += o[1] * DRIFTER_SPEED * DT;
        d.fleeLeft -= 1;
        if (d.fleeLeft <= 0) d.state = 'removed';
      } else {
        if (d.dirLeft <= 0) {
          const a = rng() * Math.PI * 2;
          d.dir = [Math.cos(a), Math.sin(a)];
          d.dirLeft = 120;
        }
        d.dirLeft -= 1;
        d.pos[0] += d.dir[0] * DRIFTER_IDLE_SPEED * DT;
        d.pos[2] += d.dir[1] * DRIFTER_IDLE_SPEED * DT;
      }
    }
    sim.drifters = sim.drifters.filter((d) => d.state !== 'removed');

    // B9: cham - Gio Lac cuop truoc, roi Bong Muc gay hit
    if (active && !bench) {
      for (const d of [...sim.drifters].sort(idCmp)) {
        if (d.state === 'chase' && !d.stoleOnce && p.carried > 0 && hd(d.pos, p.pos) <= DRIFTER_HIT) {
          const amount = Math.min(DRIFTER_STEAL, p.carried);
          p.carried -= amount;
          d.stolen = amount;
          d.stoleOnce = true;
          d.state = 'flee';
          d.fleeLeft = DRIFTER_FLEE_TICKS;
          emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
        }
      }
      for (const s of [...sim.shades].sort(idCmp)) {
        if (s.state !== 'chase' || s.evict > 0) continue;
        if (hd(s.pos, p.pos) > T.shade_hit_radius || Math.abs(p.pos[1] - (s.pos[1] - 0.5)) > HEIGHT_TOL) continue;
        if (p.invuln > 0) continue;
        p.flames -= 1;
        const dropped = Math.floor(p.carried * T.hit_drop_ratio);
        p.carried -= dropped;
        for (let i = 0; i < dropped; i++) {
          const a = (i / dropped) * Math.PI * 2;
          const rad = 1.5 + (i % 3) * 0.5;
          const x = p.pos[0] + rad * Math.cos(a);
          const z = p.pos[2] + rad * Math.sin(a);
          const gy = surf(x, z);
          addMote(gy === null ? [p.pos[0], p.pos[1], p.pos[2]] : [x, gy, z], 'dropped', DROP_TTL, -1);
        }
        p.invuln = HIT_INVULN;
        s.state = 'recoil';
        s.left = RECOIL_TICKS;
        s.recoilDir = norm2(s.pos[0] - p.pos[0], s.pos[2] - p.pos[2]);
        emit('player_hit', { by: 'shade', flames: p.flames, dropped });
        break;
      }
    }

    // B10: sinh theo lich (thuc the moi chi tuong tac tu tick sau)
    if (randomMotes && sim.steps % MOTE_SPAWN_EVERY === 0 && sim.motes.length < MOTE_CAP) {
      const taken = new Set(sim.motes.filter((m) => m.pt >= 0).map((m) => m.pt));
      const free = map.motePoints.map((_, i) => i).filter((i) => !taken.has(i));
      if (free.length) {
        const i = free[Math.floor(rng() * free.length)];
        addMote([...map.motePoints[i]], 'random', null, i);
      }
    }
    if (randomShades) {
      const k = sim.steps - SHADE_FIRST;
      if (k === 0) {
        for (let i = 0; i < 2; i++) if (sim.shades.length < map.shadeMax) spawnShade();
      } else if (k > 0 && k % map.shadeInterval === 0 && sim.shades.length < map.shadeMax) spawnShade();
    }
    if (randomDrifters && sim.steps % DRIFTER_EVERY === 0 && sim.drifters.length < DRIFTER_MAX) {
      const [cx, cz, R] = map.driftArea[Math.floor(rng() * map.driftArea.length)];
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * (R - 2);
      sim.drifters.push({
        id: nextId('D', 'drifter'),
        pos: [cx + r * Math.cos(a), DRIFTER_Y, cz + r * Math.sin(a)],
        state: 'idle',
        stolen: 0,
        stoleOnce: false,
        fleeLeft: 0,
        dir: [1, 0],
        dirLeft: 0,
      });
    }

    // B11: thang / thua
    if (bench) return sim.events;
    if (!playerAlive || p.flames <= 0) gameOver('lost', 'no_flames');
    else if (timeLeft() <= 1e-9) {
      const litN = sim.lanterns.filter((l) => l.lit).length;
      const need = Math.ceil(T.win_ratio * sim.lanterns.length - 1e-9);
      if (litN >= need) gameOver('won', 'dawn_survived');
      else gameOver('lost', 'dawn');
    }
    return sim.events;
  }

  // B12: snapshot
  function snapshot() {
    return {
      type: 'snapshot',
      tick: sim.tick,
      sim_tick: sim.steps,
      state: sim.state,
      night: sim.night,
      time_left_s: r3(Math.max(0, timeLeft())),
      score: sim.score,
      wind: { active: sim.wind.active, dir_deg: r3(sim.wind.dir_deg), warning: sim.wind.warning },
      player: {
        pos: rv(p.pos),
        vel: rv(p.vel),
        grounded: p.grounded,
        carried: p.carried,
        capacity: capacity(),
        flames: p.flames,
        invuln: r3(p.invuln / TICK_RATE),
        dash_cd_s: r3(p.dashCd / TICK_RATE),
        pulse_cd_s: r3(p.pulseCd / TICK_RATE),
        charm_s: r3(p.charm / TICK_RATE),
      },
      lanterns: sim.lanterns.map((l) => ({ id: l.id, pos: rv(l.pos), lit: l.lit, deposited: l.deposited, fuel: fuelOut(l), ever_lit: l.ever, relit_count: l.relit })),
      shades: sim.shades.map((s) => ({ id: s.id, pos: rv(s.pos), state: s.state, state_ticks_left: s.left, target_lantern_id: s.target })),
      motes_active: sim.motes.length,
      motes: sim.motes.map((m) => ({
        id: m.id,
        pos: rv(m.pos),
        kind: m.kind,
        ttl_s: m.ttl === null ? null : r3(m.ttl / TICK_RATE),
      })),
      drifters: sim.drifters.map((d) => ({ id: d.id, pos: rv(d.pos), state: d.state, stolen: d.stolen })),
      charms: sim.charms.map((c) => ({ id: c.id, pos: rv(c.pos), available: c.available, respawn_s: r3(c.respawn / TICK_RATE) })),
    };
  }

  return { step, snapshot, sim };
}
