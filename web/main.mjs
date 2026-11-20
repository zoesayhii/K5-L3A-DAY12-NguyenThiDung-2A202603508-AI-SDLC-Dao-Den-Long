// Ban co giao dien Three.js (Phase 2). Moi luat choi nam trong sim/ (cung loi voi headless).
import * as THREE from 'three';
import { createSim, TICK_RATE } from '../sim/sim.mjs';
import { NIGHTS } from '../sim/maps.mjs';

const contract = await (await fetch('/game.contract.json')).json();
const T = contract.tuning;
const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);

// ---------- Bang mau chuan ----------
const C = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lampOn: 0xffb347, lampCore: 0xffe9b0, lampOff: 0x5b5f6e, moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shade: 0x120a1a, shadeEdge: 0x7a3cff, shadeStun: 0x3a3450, shirt: 0xe8e2d0, scarf: 0xc8102e,
  gold: 0xf2c14e, drifter: 0x8fa3b8,
};

// ---------- Cai dat (luu giua cac lan mo) ----------
const settings = { volume: 0.6, sens: 1.0 };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') ?? '{}'));
} catch {}
const saveSettings = () => {
  try {
    localStorage.setItem('ddl-settings', JSON.stringify(settings));
  } catch {}
};

// ---------- Am thanh (WebAudio tong hop, khong dung file ngoai) ----------
let actx = null;
let master = null;
function audioInit() {
  if (actx) return actx.state === 'suspended' && actx.resume();
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain();
    master.gain.value = settings.volume;
    master.connect(actx.destination);
    startMusic();
  } catch {
    actx = null;
  }
}
function tone(freq, dur, { type = 'sine', gain = 0.25, to = null, delay = 0 } = {}) {
  if (!actx) return;
  const t = actx.currentTime + delay;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function noise(dur, gain = 0.2, f0 = 800, f1 = 200) {
  if (!actx) return;
  const t = actx.currentTime;
  const buf = actx.createBuffer(1, Math.floor(actx.sampleRate * dur), actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = actx.createBufferSource();
  s.buffer = buf;
  const f = actx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = actx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
}
const SFX = {
  pick: () => tone(880, 0.12, { gain: 0.15, to: 1320 }),
  deposit: () => tone(520, 0.1, { gain: 0.15, to: 700 }),
  lit: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, { gain: 0.18, delay: i * 0.09 })),
  pulse: () => (tone(300, 0.5, { type: 'triangle', gain: 0.25, to: 1100 }), noise(0.4, 0.12, 2000, 400)),
  hit: () => (tone(140, 0.35, { type: 'sawtooth', gain: 0.3, to: 50 }), noise(0.25, 0.25, 600, 100)),
  jump: () => tone(300, 0.15, { type: 'square', gain: 0.08, to: 520 }),
  dash: () => noise(0.2, 0.18, 3000, 500),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.5, { gain: 0.2, delay: i * 0.12 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.5, { type: 'triangle', gain: 0.22, delay: i * 0.18 })),
  spawn: () => tone(110, 0.6, { type: 'sawtooth', gain: 0.12, to: 70 }),
  tick: () => tone(1000, 0.08, { type: 'square', gain: 0.1 }),
  charm: () => (tone(660, 0.2, { gain: 0.18, to: 990 }), tone(990, 0.3, { gain: 0.15, delay: 0.12 })),
  warn: () => tone(190, 0.14, { type: 'square', gain: 0.07 }),
  steal: () => tone(700, 0.3, { type: 'triangle', gain: 0.18, to: 250 }),
};
function startMusic() {
  // nhac nen dem: drone + giai dieu ngu cung ngau nhien thua
  const drone = (f, g) => {
    const o = actx.createOscillator();
    const v = actx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    v.gain.value = g;
    const lfo = actx.createOscillator();
    const lg = actx.createGain();
    lfo.frequency.value = 0.15;
    lg.gain.value = g * 0.5;
    lfo.connect(lg).connect(v.gain);
    o.connect(v).connect(master);
    o.start();
    lfo.start();
  };
  drone(110, 0.05);
  drone(165, 0.035);
  const scale = [392, 440, 523, 587, 659, 784];
  setInterval(() => {
    if (actx && Math.random() < 0.7) tone(scale[Math.floor(Math.random() * scale.length)], 1.6, { gain: 0.05, type: 'triangle' });
  }, 2200);
}

// ---------- Scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.sky);
scene.fog = new THREE.FogExp2(C.fog, 0.013);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
const ambient = new THREE.AmbientLight(0xffffff, 0.15 * Math.PI);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0xb4c4ff, 0.8);
moon.position.set(-20, 40, 15);
scene.add(moon);

const mat = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const glowMat = (c, op = 0.55) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });

const pulsePreview = new THREE.Mesh(new THREE.RingGeometry(T.pulse_radius - 0.08, T.pulse_radius, 64), glowMat(C.gold, 0.35));
pulsePreview.rotation.x = -Math.PI / 2;
pulsePreview.visible = false;
scene.add(pulsePreview);

// Mây
const maya = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 4, 10), mat(C.shirt));
  body.position.y = 0.7;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.1, 8, 14), mat(C.scarf));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.2;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 12), mat(C.wood));
  hat.position.y = 1.75;
  const lampM = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: C.lampCore }));
  lampM.position.set(0.38, 1.4, 0);
  const light = new THREE.PointLight(C.lampOn, 10, 12);
  light.position.set(0.38, 1.4, 0);
  maya.add(body, scarf, hat, lampM, light);
}
scene.add(maya);

// ---------- The gioi theo Dem ----------
let world = null;
const dyn = { motes: new Map(), shades: new Map(), drifters: new Map(), charms: new Map(), lanterns: [], leaves: [] };
const seaPlane = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), mat(C.sea));
seaPlane.rotation.x = -Math.PI / 2;
seaPlane.position.y = -14;
scene.add(seaPlane);

function disk(r, h, cx, cz, color, topY = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, h, 48), mat(color));
  m.position.set(cx, topY - h / 2, cz);
  return m;
}
function beach(r, cx, cz) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.5, 6, 64), mat(C.sand));
  m.rotation.x = Math.PI / 2;
  m.position.set(cx, -0.1, cz);
  return m;
}
function padMesh(pad) {
  const g = new THREE.Group();
  const d = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.15, 24), mat(C.gold));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 6, 24), glowMat(C.gold, 0.8));
  ring.rotation.x = Math.PI / 2;
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 4), glowMat(C.gold, 0.8));
  arrow.position.y = 1.2;
  g.add(d, ring, arrow);
  g.position.set(pad.pos[0], pad.pos[1] + 0.08, pad.pos[2]);
  g.userData.arrow = arrow;
  return g;
}
function buildWorld(map, night) {
  const g = new THREE.Group();
  if (night === 1) {
    g.add(disk(40, 6, 0, 0, C.grass), beach(40, 0, 0));
  } else if (night === 2) {
    for (const cx of [0, 70]) g.add(disk(28, 6, cx, 0, C.grass), beach(28, cx, 0));
    const br = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), mat(C.wood));
    br.position.set(35, -0.15, 0);
    g.add(br);
    for (let x = 27; x <= 43; x += 2) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 4.1), mat(0x4a3220));
      plank.position.set(x, 0.01, 0);
      g.add(plank);
    }
  } else {
    g.add(disk(45, 6, 0, 0, C.grass), beach(45, 0, 0));
    // tang 1: nua vanh khan z>0, r 12..24, cao 3
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 24, 0, Math.PI, false);
    shape.absarc(0, 0, 12, Math.PI, 0, true);
    const t1 = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 32 }), mat(0x3a7060));
    t1.rotation.x = Math.PI / 2;
    t1.position.y = 3;
    g.add(t1);
    g.add(disk(8, 6, 0, 0, 0x45806c, 6));
    // doc 30 va 150 do
    for (const a of [30, 150]) {
      const grp = new THREE.Group();
      grp.rotation.y = (-a * Math.PI) / 180;
      const r = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.3, 3), mat(C.sand));
      r.position.set(27, 1.5 - 0.15, 0);
      r.rotation.z = -Math.atan(0.5);
      grp.add(r);
      g.add(grp);
    }
    // thap chuong
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 8, 20), mat(C.wood));
    tw.position.y = 6 + 4;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.4, 20), mat(C.scarf));
    roof.position.y = 14 + 1.2;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), mat(C.gold));
    bell.position.y = 12.5;
    g.add(tw, roof, bell);
  }
  for (const pad of map.pads) g.add(padMesh(pad));
  // den
  dyn.lanterns = [];
  for (const [id, pos] of map.lanterns) {
    const lg = new THREE.Group();
    lg.position.set(pos[0], pos[1], pos[2]);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2.2, 8), mat(C.wood));
    post.position.y = 1.1;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), new THREE.MeshBasicMaterial({ color: C.lampOff }));
    bulb.position.y = 2.7;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), glowMat(C.lampOn, 0));
    halo.position.y = 2.7;
    const zone = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.12, T.safe_radius, 64), glowMat(C.lampOn, 0));
    zone.rotation.x = -Math.PI / 2;
    zone.position.y = 0.06;
    lg.add(post, bulb, halo, zone);
    g.add(lg);
    dyn.lanterns.push({ id, bulb, halo, zone, group: lg });
  }
  return g;
}

function clearDyn() {
  for (const k of ['motes', 'shades', 'drifters', 'charms']) {
    for (const m of dyn[k].values()) scene.remove(m);
    dyn[k].clear();
  }
}

// la bay khi gio
const leafGeo = new THREE.PlaneGeometry(0.35, 0.2);
const leafMat = new THREE.MeshBasicMaterial({ color: 0x7fae6a, side: THREE.DoubleSide, fog: false });
for (let i = 0; i < 40; i++) {
  const m = new THREE.Mesh(leafGeo, leafMat);
  m.visible = false;
  m.userData.o = [Math.random() * 40 - 20, Math.random() * 8, Math.random() * 40 - 20];
  scene.add(m);
  dyn.leaves.push(m);
}

// ---------- Mo hinh thuc the ----------
function makeMote() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: C.moteCore, fog: false })));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), glowMat(C.moteHalo, 0.35)));
  return g;
}
function makeShade() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), mat(C.shade));
  const edge = new THREE.Mesh(new THREE.IcosahedronGeometry(0.82, 1), new THREE.MeshBasicMaterial({ color: C.shadeEdge, side: THREE.BackSide }));
  const eyes = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), new THREE.MeshBasicMaterial({ color: C.shadeEdge }));
  const e2 = eyes.clone();
  eyes.position.set(-0.22, 0.15, 0.6);
  e2.position.set(0.22, 0.15, 0.6);
  g.add(body, edge, eyes, e2);
  g.userData = { body, edge, eyeMat: eyes.material };
  return g;
}
function makeDrifter() {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: C.drifter, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), m);
    s.position.z = -i * 0.8;
    g.add(s);
  }
  return g;
}
function makeCharm() {
  const g = new THREE.Group();
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.06), mat(C.gold));
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.16, 0.1), new THREE.MeshBasicMaterial({ color: C.scarf }));
  g.add(edge, body);
  return g;
}

// ---------- Tro choi ----------
const NIGHT_INFO = {
  1: { name: 'Đảo Bến', quote: 'Con gái, ngọn đèn đầu tiên bao giờ cũng khó thắp nhất. Cứ gom đom đóm rồi nạp vào, đừng để Bóng Mực tới gần.' },
  2: { name: 'Đảo Cau', quote: 'Hai hòn đảo, một cây cầu tre không lan can. Nghe nói bục vàng sẽ đưa con bay qua, và coi chừng Gió Lạc cướp đom đóm.' },
  3: { name: 'Đảo Chuông', quote: 'Đêm cuối: ba tầng đảo, gió mạnh, và tiếng chuông chưa ai nghe suốt trăm năm. Thắp hết đèn, trời sẽ sáng.' },
};
let game = null;
let night = 1;
let mode = 'menu'; // menu | intro | play | pause | result
let runScore = 0;
let seed = Number(q.get('seed')) || (Date.now() & 0x7fffffff);
let yaw = 0;
let lastTimeInt = 999;
let lastWarn = 0;
let prevGrounded = true;
const keys = new Set();

function startNight(n) {
  night = n;
  clearDyn();
  if (world) scene.remove(world);
  world = buildWorld(NIGHTS[n], n);
  scene.add(world);
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  game = createSim({ contract, seed, night: n, scenario: {} });
  yaw = 0;
  lastTimeInt = 999;
  camera.position.set(0, 9, 12);
  window.__ddl = { game, seed, night: n };
  mode = 'play';
  showScreen(null);
}

function showScreen(html) {
  const s = $('screen');
  if (!html) {
    s.style.display = 'none';
    return;
  }
  s.innerHTML = html;
  s.style.display = 'flex';
}
const btn = (act, label, cls = '') => `<button class="${cls}" data-act="${act}">${label}</button>`;
function toMenu() {
  clearDyn();
  if (world) scene.remove(world);
  world = buildWorld(NIGHTS[1], 1);
  scene.add(world);
  game = null;
  window.__ddl = null;
  menuScreen();
}
function menuScreen() {
  mode = 'menu';
  showScreen(`<h1>Đảo Đèn Lồng</h1><p>Mây, người giữ đèn nhỏ tuổi, thắp lại những Đèn Lồng Lớn giữa biển mây và sương đen.</p>
    ${btn('start', 'Bắt đầu (Đêm 1)')}
    <div class="row">${btn('night1', 'Đêm 1', 'sec')}${btn('night2', 'Đêm 2', 'sec')}${btn('night3', 'Đêm 3', 'sec')}</div>
    ${btn('settings', 'Cài đặt', 'sec')}`);
}
function introScreen(n) {
  mode = 'intro';
  const i = NIGHT_INFO[n];
  showScreen(`<h2>Đêm ${n}</h2><h1>${i.name}</h1><p><i>“${i.quote}”</i></p><p>— Ông Đăng</p>${btn('go', 'Bắt đầu đêm')}`);
}
function settingsScreen(back) {
  showScreen(`<h2>Cài đặt</h2>
    <div class="row">Âm lượng <input id="vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"></div>
    <div class="row">Độ nhạy chuột <input id="sens" type="range" min="0.3" max="2.5" step="0.1" value="${settings.sens}"></div>
    ${btn(back, 'Quay lại', 'sec')}`);
  $('vol').oninput = (e) => {
    settings.volume = Number(e.target.value);
    if (master) master.gain.value = settings.volume;
    saveSettings();
  };
  $('sens').oninput = (e) => {
    settings.sens = Number(e.target.value);
    saveSettings();
  };
}
function pauseScreen() {
  showScreen(`<h2>Tạm dừng</h2>${btn('resume', 'Tiếp tục')}${btn('retry', 'Chơi lại Đêm', 'sec')}${btn('settingsP', 'Cài đặt', 'sec')}${btn('menu', 'Về menu', 'sec')}`);
}
function resultScreen(won, reason) {
  mode = 'result';
  const s = game.sim.score;
  if (won && night === 3) {
    showScreen(`<h1>Bình Minh</h1><p>Mặt trời mọc, cả ba đảo đã sáng đèn.</p><h2>Tổng điểm: ${runScore}</h2>${btn('menu', 'Về menu')}`);
  } else if (won) {
    showScreen(`<h2>Đêm ${night} hoàn thành!</h2><p>Điểm đêm này: <b>${s}</b> · Tổng: <b>${runScore}</b></p>${btn('next', 'Đêm kế tiếp')}${btn('menu', 'Về menu', 'sec')}`);
  } else {
    const why = reason === 'dawn' ? 'Trời sáng rồi mà đèn chưa thắp đủ.' : 'Mây đã hết Ngọn Lửa.';
    showScreen(`<h2>Đêm ${night} thất bại</h2><p>${why}</p>${btn('retry', 'Chơi lại Đêm')}${btn('menu', 'Về menu', 'sec')}`);
  }
}
function togglePause() {
  if (mode === 'play') {
    game.step({ pause: true });
    game.step({ pause: false });
    mode = 'pause';
    pauseScreen();
  } else if (mode === 'pause') resume();
}
function resume() {
  game.step({ pause: true });
  game.step({ pause: false });
  mode = 'play';
  showScreen(null);
}

$('screen').addEventListener('click', (e) => {
  const act = e.target?.dataset?.act;
  if (!act) return;
  audioInit();
  if (act === 'start' || act === 'night1') (runScore = 0, introScreen(1));
  else if (act === 'night2') (runScore = 0, introScreen(2));
  else if (act === 'night3') (runScore = 0, introScreen(3));
  else if (act === 'go') startNight(pendingNight());
  else if (act === 'settings') settingsScreen('menu');
  else if (act === 'settingsP') settingsScreen('pauseBack');
  else if (act === 'pauseBack') pauseScreen();
  else if (act === 'resume') resume();
  else if (act === 'retry') startNight(night);
  else if (act === 'next') introScreen(night + 1);
  else if (act === 'menu') toMenu();
});
const pendingNight = () => Number(document.querySelector('#screen h2')?.textContent.replace(/\D/g, '')) || 1;

addEventListener('keydown', (e) => {
  audioInit();
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
let drag = false;
addEventListener('mousedown', () => (drag = true));
addEventListener('mouseup', () => (drag = false));
addEventListener('mousemove', (e) => {
  if (drag && mode === 'play') yaw -= e.movementX * 0.3 * settings.sens;
});

function readInput() {
  const k = (c) => keys.has(c);
  const mx = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
  const mz = (k('KeyS') ? 1 : 0) - (k('KeyW') ? 1 : 0);
  if (k('ArrowLeft')) yaw += 1.6 * settings.sens;
  if (k('ArrowRight')) yaw -= 1.6 * settings.sens;
  return { move: [mx, mz], cam_yaw_deg: yaw, jump: k('Space'), interact: k('KeyE'), pulse: k('KeyF'), dash: k('ShiftLeft') || k('ShiftRight'), pause: false };
}

let toastT = 0;
function toast(msg) {
  $('toast').textContent = msg;
  $('toast').style.opacity = 1;
  toastT = 1.6;
}
const rings = [];
function onEvent(ev) {
  const p = game.sim.player;
  switch (ev.name) {
    case 'mote_picked': SFX.pick(); break;
    case 'deposit': SFX.deposit(); break;
    case 'lantern_lit': SFX.lit(); toast(`Đèn ${ev.data.lantern_id} đã sáng!`); break;
    case 'pulse': {
      SFX.pulse();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.8, 48), glowMat(C.gold, 0.9));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.pos[0], p.pos[1] + 0.1, p.pos[2]);
      ring.userData.age = 0;
      scene.add(ring);
      rings.push(ring);
      break;
    }
    case 'player_hit': SFX.hit(); toast(ev.data.by === 'fall' ? 'Mây rơi khỏi đảo!' : 'Bóng Mực chạm vào Mây!'); break;
    case 'shade_spawned': SFX.spawn(); break;
    case 'dash': SFX.dash(); break;
    case 'charm_picked': SFX.charm(); toast('Bùa Gió! Chạy nhanh, lướt không hồi chiêu'); break;
    case 'drifter_steal': SFX.steal(); toast(`Gió Lạc cướp ${ev.data.amount} đom đóm!`); break;
    case 'drifter_drop': toast('Gió Lạc thả đom đóm lại'); break;
    case 'game_over': {
      const won = ev.data.result === 'won';
      (won ? SFX.win : SFX.lose)();
      if (won) runScore += game.sim.score;
      setTimeout(() => game && resultScreen(won, ev.data.reason), 700);
      break;
    }
  }
}

// ---------- HUD ----------
const cells = $('cells');
for (let i = 0; i < T.carry_capacity; i++) cells.appendChild(document.createElement('i'));
const projV = new THREE.Vector3();
function updateHud() {
  const s = game.sim;
  const p = s.player;
  const lit = s.lanterns.filter((l) => l.lit).length;
  const left = Math.max(0, s.timeLeft0 - s.steps / TICK_RATE);
  const secs = Math.ceil(left);
  $('flames').textContent = '🔥'.repeat(Math.max(0, p.flames)) || '💨';
  $('clock').textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  $('clock').classList.toggle('low', left <= 30);
  $('right').innerHTML = `Đèn <b>${lit}/${s.lanterns.length}</b><br>Điểm <b>${s.score}</b>`;
  [...cells.children].forEach((c, i) => c.classList.toggle('on', i < p.carried));
  const setCd = (el, cd, total, ready) => {
    el.querySelector('.fill').style.height = `${cd > 0 ? (cd / total) * 100 : 0}%`;
    el.classList.toggle('off', !ready);
  };
  setCd($('cdDash'), p.charm > 0 ? 0 : p.dashCd, Math.round(T.dash_cooldown_s * 60), p.dashCd === 0 || p.charm > 0);
  setCd($('cdPulse'), p.pulseCd, Math.round(T.pulse_cooldown_s * 60), p.pulseCd === 0 && p.carried >= T.pulse_cost);
  $('charmbar').style.display = p.charm > 0 ? 'block' : 'none';
  $('charmbar').textContent = `🌬 Bùa Gió ${(p.charm / 60).toFixed(0)}s`;
  $('windwarn').style.display = s.wind.warning && !s.wind.active ? 'block' : 'none';
  if (s.wind.active) ($('windwarn').style.display = 'block'), ($('windwarn').textContent = '🍃 Gió mạnh!');
  else $('windwarn').textContent = '🍃 Gió mạnh sắp tới…';
  // goi y nap den
  let near = null;
  let nd = Infinity;
  for (const l of s.lanterns) {
    if (l.lit) continue;
    const d = Math.hypot(p.pos[0] - l.pos[0], p.pos[2] - l.pos[2]);
    if (d <= T.interact_radius && d < nd) (near = l), (nd = d);
  }
  const pr = $('prompt');
  pr.style.display = near ? 'block' : 'none';
  if (near) pr.textContent = `E — Nạp ánh sáng (${near.deposited}/${T.lantern_cost})`;
  // mui ten toi den chua sang gan nhat khi ngoai man hinh
  let tgt = null;
  let td = Infinity;
  for (const l of s.lanterns) {
    if (l.lit) continue;
    const d = Math.hypot(p.pos[0] - l.pos[0], p.pos[2] - l.pos[2]);
    if (d < td) (tgt = l), (td = d);
  }
  const arrow = $('arrow');
  if (tgt) {
    projV.set(tgt.pos[0], tgt.pos[1] + 2.5, tgt.pos[2]).project(camera);
    const behind = projV.z > 1;
    const on = !behind && Math.abs(projV.x) < 0.95 && Math.abs(projV.y) < 0.92;
    if (on) arrow.style.display = 'none';
    else {
      let x = behind ? -projV.x : projV.x;
      let y = behind ? -projV.y : projV.y;
      const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
      x /= m;
      y /= m;
      arrow.style.display = 'block';
      arrow.style.left = `${((x * 0.9 + 1) / 2) * innerWidth - 14}px`;
      arrow.style.top = `${((1 - y * 0.85) / 2) * innerHeight - 14}px`;
      arrow.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
    }
  } else arrow.style.display = 'none';
  // goi y nguy hiem (chi hien thi, khong doi luat): mui ten do toi Bong Muc dang duoi o ngoai man hinh,
  // vien do khi co bong < 10 m, am canh bao, va vong ban kinh Toa Sang khi dung duoc
  const chasers = [];
  for (const sh of s.shades) {
    if (sh.state !== 'chase') continue;
    chasers.push({ sh, d: Math.hypot(p.pos[0] - sh.pos[0], p.pos[2] - sh.pos[2]) });
  }
  chasers.sort((a, b) => a.d - b.d);
  const nearestD = chasers.length ? chasers[0].d : Infinity;
  const danger = s.state === 'playing' && nearestD < 10 ? Math.min(1, (10 - nearestD) / 7) : 0;
  $('vignette').style.opacity = (danger * 0.85).toFixed(2);
  if (danger > 0 && nearestD < 7 && performance.now() - lastWarn > 700) {
    lastWarn = performance.now();
    SFX.warn();
  }
  const pool = $('threats');
  while (pool.children.length < 4) {
    const a = document.createElement('div');
    a.className = 'tarrow';
    pool.appendChild(a);
  }
  [...pool.children].forEach((el, i) => {
    const c = chasers[i];
    if (!c || c.d > 18 || s.state !== 'playing') return void (el.style.display = 'none');
    projV.set(c.sh.pos[0], c.sh.pos[1], c.sh.pos[2]).project(camera);
    const behind = projV.z > 1;
    if (!behind && Math.abs(projV.x) < 0.95 && Math.abs(projV.y) < 0.92) return void (el.style.display = 'none');
    let x = behind ? -projV.x : projV.x;
    let y = behind ? -projV.y : projV.y;
    const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
    x /= m;
    y /= m;
    el.style.display = 'block';
    el.style.left = `${((x * 0.8 + 1) / 2) * innerWidth - 10}px`;
    el.style.top = `${((1 - y * 0.75) / 2) * innerHeight - 10}px`;
    el.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
  });
  const pulseReady = p.pulseCd === 0 && p.carried >= T.pulse_cost;
  // trung F neu khoang cach 3D toi tam (chan Mây + 0.8 m) <= pulse_radius: dung dung cong thuc cua loi
  const inRange = s.shades.some((sh) => Math.hypot(p.pos[0] - sh.pos[0], p.pos[1] + 0.8 - sh.pos[1], p.pos[2] - sh.pos[2]) <= T.pulse_radius);
  pulsePreview.visible = s.state === 'playing' && pulseReady && (inRange || nearestD < T.pulse_radius + 4);
  pulsePreview.material.opacity = inRange ? 0.85 : 0.25;
  pulsePreview.material.color.setHex(inRange ? C.lampCore : C.gold);
  pulsePreview.position.set(p.pos[0], p.pos[1] + 0.08, p.pos[2]);
  // dem nguoc 10 giay cuoi
  if (secs <= 10 && secs !== lastTimeInt && s.state === 'playing') SFX.tick();
  lastTimeInt = secs;
}

// ---------- Dong bo mesh ----------
function syncMeshes(now, dt) {
  const s = game.sim;
  const p = s.player;
  maya.position.set(p.pos[0], p.pos[1], p.pos[2]);
  maya.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  maya.visible = p.invuln <= 0 || Math.floor(now / 80) % 2 === 0;
  if (p.vel[1] > 6 && prevGrounded) SFX.jump();
  prevGrounded = p.grounded;

  const lit = s.lanterns.filter((l) => l.lit).length;
  ambient.intensity = (0.15 + 0.55 * (lit / s.lanterns.length)) * Math.PI;
  s.lanterns.forEach((l, i) => {
    const d = dyn.lanterns[i];
    const f = l.lit ? 1 : l.deposited / T.lantern_cost;
    d.bulb.material.color.setHex(l.lit ? C.lampCore : f > 0 ? C.lampOn : C.lampOff);
    d.halo.material.opacity = l.lit ? 0.35 + Math.sin(now / 250 + i) * 0.06 : f * 0.2;
    d.zone.material.opacity = l.lit ? 0.45 : 0;
  });

  // dom dom
  const seen = new Set();
  for (const m of s.motes) {
    seen.add(m.id);
    let o = dyn.motes.get(m.id);
    if (!o) (o = makeMote()), scene.add(o), dyn.motes.set(m.id, o);
    o.position.set(m.pos[0], m.pos[1] + 0.8 + Math.sin(now / 300 + m.pos[0]) * 0.15, m.pos[2]);
    o.visible = m.ttl === null || m.ttl > 120 || Math.floor(now / 120) % 2 === 0;
  }
  for (const [id, o] of dyn.motes) if (!seen.has(id)) (scene.remove(o), dyn.motes.delete(id));

  seen.clear();
  for (const sh of s.shades) {
    seen.add(sh.id);
    let o = dyn.shades.get(sh.id);
    if (!o) (o = makeShade()), scene.add(o), dyn.shades.set(sh.id, o);
    o.position.set(sh.pos[0], sh.pos[1] + 0.2 + Math.sin(now / 250) * 0.1, sh.pos[2]);
    o.rotation.y = Math.atan2(p.pos[0] - sh.pos[0], p.pos[2] - sh.pos[2]);
    const stun = sh.state === 'stunned';
    o.userData.body.material.color.setHex(stun ? C.shadeStun : C.shade);
    o.scale.setScalar(sh.state === 'spawning' ? 0.5 : 1);
    o.userData.eyeMat.color.setHex(sh.state === 'chase' ? 0xff5a5f : C.shadeEdge);
  }
  for (const [id, o] of dyn.shades) if (!seen.has(id)) (scene.remove(o), dyn.shades.delete(id));

  seen.clear();
  for (const d of s.drifters) {
    seen.add(d.id);
    let o = dyn.drifters.get(d.id);
    if (!o) (o = makeDrifter()), scene.add(o), dyn.drifters.set(d.id, o);
    o.position.set(d.pos[0], d.pos[1] + Math.sin(now / 200) * 0.2, d.pos[2]);
    const dx = d.state === 'flee' ? d.pos[0] - p.pos[0] : p.pos[0] - d.pos[0];
    const dz = d.state === 'flee' ? d.pos[2] - p.pos[2] : p.pos[2] - d.pos[2];
    o.rotation.y = Math.atan2(dx, dz);
    o.children.forEach((c, i) => (c.position.x = Math.sin(now / 150 + i) * 0.3));
  }
  for (const [id, o] of dyn.drifters) if (!seen.has(id)) (scene.remove(o), dyn.drifters.delete(id));

  seen.clear();
  for (const c of s.charms) {
    seen.add(c.id);
    let o = dyn.charms.get(c.id);
    if (!o) (o = makeCharm()), scene.add(o), dyn.charms.set(c.id, o);
    o.position.set(c.pos[0], c.pos[1] + 1.2 + Math.sin(now / 400) * 0.15, c.pos[2]);
    o.rotation.y = now / 600;
    o.visible = c.available;
  }
  for (const [id, o] of dyn.charms) if (!seen.has(id)) (scene.remove(o), dyn.charms.delete(id));

  // la bay (bao gio)
  const windy = s.wind.warning || s.wind.active;
  const a = (s.wind.dir_deg * Math.PI) / 180;
  for (const l of dyn.leaves) {
    l.visible = windy;
    if (!windy) continue;
    const o = l.userData.o;
    o[0] += Math.cos(a) * 9 * dt;
    o[2] += Math.sin(a) * 9 * dt;
    o[1] += Math.sin(now / 300 + o[0]) * 0.02;
    for (const i of [0, 2]) {
      if (o[i] > 22) o[i] -= 44;
      if (o[i] < -22) o[i] += 44;
    }
    l.position.set(p.pos[0] + o[0], p.pos[1] + 1 + o[1], p.pos[2] + o[2]);
    l.rotation.set(now / 200, now / 260, 0);
  }

  const yc = (s.input.yaw * Math.PI) / 180;
  const target = new THREE.Vector3(p.pos[0] + Math.sin(yc) * 12, p.pos[1] + 9, p.pos[2] + Math.cos(yc) * 12);
  camera.position.lerp(target, 0.12);
  camera.lookAt(p.pos[0], p.pos[1] + 0.8, p.pos[2]);
}

// ---------- Vong lap ----------
let acc = 0;
let last = performance.now();
let fpsAcc = 0;
let fpsN = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  fpsAcc += dt;
  fpsN++;
  if (game && mode === 'play') {
    acc += dt;
    while (acc >= 1 / TICK_RATE) {
      acc -= 1 / TICK_RATE;
      if (game.sim.state !== 'playing') continue;
      for (const ev of game.step(readInput())) onEvent(ev);
    }
  }
  for (const r of [...rings]) {
    r.userData.age += dt;
    const k = r.userData.age / 0.45;
    r.scale.setScalar(1 + k * T.pulse_radius * 1.6);
    r.material.opacity = Math.max(0, 0.9 * (1 - k));
    if (k >= 1) (scene.remove(r), rings.splice(rings.indexOf(r), 1));
  }
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').style.opacity = 0;
  const hudOn = !!game;
  for (const id of ['flames', 'clock', 'right', 'cells', 'cds']) $(id).style.display = hudOn ? '' : 'none';
  $('cells').style.display = hudOn ? 'flex' : 'none';
  $('cds').style.display = hudOn ? 'flex' : 'none';
  if (game) {
    syncMeshes(now, dt);
    updateHud();
  } else {
    camera.position.set(Math.cos(now / 8000) * 30, 14, Math.sin(now / 8000) * 30);
    camera.lookAt(0, 2, 0);
    $('prompt').style.display = 'none';
    $('arrow').style.display = 'none';
    $('vignette').style.opacity = 0;
    pulsePreview.visible = false;
    for (const el of $('threats').children) el.style.display = 'none';
  }
  if (q.has('debug') && fpsAcc > 1) {
    $('debug').textContent = `${(fpsN / fpsAcc).toFixed(0)} FPS`;
    fpsAcc = 0;
    fpsN = 0;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

const startParam = Number(q.get('start'));
if (startParam >= 1 && startParam <= 3) startNight(startParam);
else toMenu();
requestAnimationFrame(frame);
