// Ban co giao dien Three.js. Moi luat choi nam trong sim/ (cung loi voi headless).
import * as THREE from 'three';
import { createSim, ISLAND_RADIUS, TICK_RATE } from '../sim/sim.mjs';

const contract = await (await fetch('/game.contract.json')).json();
const T = contract.tuning;
const $ = (id) => document.getElementById(id);

// ---------- Scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x241a44);
scene.fog = new THREE.FogExp2(0x241a44, 0.022);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

scene.add(new THREE.HemisphereLight(0x9a8ad8, 0x3a2f5a, 1.6));
const moon = new THREE.DirectionalLight(0xb4c4ff, 1.1);
moon.position.set(-10, 20, 8);
scene.add(moon);

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, ...o });
const island = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 2, 3, 48), mat(0x5a7050));
island.position.y = -1.5;
scene.add(island);
const rim = new THREE.Mesh(new THREE.TorusGeometry(ISLAND_RADIUS, 0.25, 8, 64), mat(0x6b5a3a));
rim.rotation.x = Math.PI / 2;
scene.add(rim);
const clouds = new THREE.Group();
for (let i = 0; i < 14; i++) {
  const c = new THREE.Mesh(new THREE.SphereGeometry(4 + (i % 3), 10, 8), mat(0x2b2347, { flatShading: true }));
  const a = (i / 14) * Math.PI * 2;
  c.position.set(Math.cos(a) * (ISLAND_RADIUS + 6), -5, Math.sin(a) * (ISLAND_RADIUS + 6));
  clouds.add(c);
}
scene.add(clouds);

// Mây: than + non + den treo
const maya = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 4, 10), mat(0xf2d7b0));
body.position.y = 0.7;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 12), mat(0xd9602b));
hat.position.y = 1.7;
const hatLamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
hatLamp.position.set(0.35, 1.35, 0);
const mayaLight = new THREE.PointLight(0xffc36b, 8, 9);
mayaLight.position.set(0.35, 1.4, 0);
maya.add(body, hat, hatLamp, mayaLight);
scene.add(maya);

const lanternLights = [];
const lanternGroups = [];
const motesGroup = new THREE.Group();
scene.add(motesGroup);
const shadeMeshes = new Map();
const rings = [];

function buildLanterns(sim) {
  for (const g of lanternGroups) scene.remove(g);
  lanternGroups.length = 0;
  lanternLights.length = 0;
  for (const l of sim.lanterns) {
    const g = new THREE.Group();
    g.position.set(l.pos[0], 0, l.pos[2]);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2.2, 8), mat(0x4a3a2a));
    post.position.y = 1.1;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), mat(0x3a2f20, { emissive: 0x000000 }));
    bulb.position.y = 2.6;
    const light = new THREE.PointLight(0xffa640, 0, 14);
    light.position.y = 2.6;
    g.add(post, bulb, light);
    g.userData = { bulb, light };
    scene.add(g);
    lanternGroups.push(g);
    lanternLights.push(light);
  }
}

// ---------- Game ----------
let game;
let seed = Number(new URLSearchParams(location.search).get('seed')) || (Date.now() & 0x7fffffff);
function reset() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  game = createSim({ contract, seed, scenario: {} });
  buildLanterns(game.sim);
  for (const m of shadeMeshes.values()) scene.remove(m);
  shadeMeshes.clear();
  $('overlay').style.display = 'none';
  yaw = 0;
  camera.position.set(0, 9, 12);
  window.__ddl = { game, seed };
}
let yaw = 0;
const keys = new Set();
addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') reset();
  if (e.code === 'Space') e.preventDefault();
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
let drag = false;
addEventListener('mousedown', () => (drag = true));
addEventListener('mouseup', () => (drag = false));
addEventListener('mousemove', (e) => {
  if (drag) yaw -= e.movementX * 0.4;
});
$('again').onclick = reset;

let toastT = 0;
function toast(msg) {
  $('toast').textContent = msg;
  $('toast').style.opacity = 1;
  toastT = 1.6;
}

function readInput() {
  const k = (c) => keys.has(c);
  const mx = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
  const mz = (k('KeyS') ? 1 : 0) - (k('KeyW') ? 1 : 0);
  if (k('ArrowLeft')) yaw += 1.6;
  if (k('ArrowRight')) yaw -= 1.6;
  return { move: [mx, mz], cam_yaw_deg: yaw, jump: k('Space'), interact: k('KeyE'), pulse: k('KeyF') };
}

function onEvent(ev) {
  const p = game.sim.player;
  if (ev.name === 'pulse') {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.8, 48), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.pos[0], 0.1, p.pos[2]);
    ring.userData.age = 0;
    scene.add(ring);
    rings.push(ring);
  } else if (ev.name === 'lantern_lit') toast(`Đèn ${ev.data.lantern_id} đã sáng!`);
  else if (ev.name === 'player_hit') toast('Bóng Mực chạm vào Mây!');
  else if (ev.name === 'shade_spawned') toast('Một Bóng Mực mới xuất hiện');
  else if (ev.name === 'game_over') {
    const won = ev.data.result === 'won';
    $('otitle').textContent = won ? 'Đảo đã sáng trở lại!' : ev.data.reason === 'dawn' ? 'Trời sáng rồi, đèn chưa thắp đủ' : 'Mây hết ngọn lửa';
    $('osub').textContent = `Điểm: ${game.sim.score}`;
    $('overlay').style.display = 'flex';
  }
}

function syncMeshes(now) {
  const s = game.sim;
  const p = s.player;
  maya.position.set(p.pos[0], p.pos[1], p.pos[2]);
  const inp = s.input;
  const yr = (inp.yaw * Math.PI) / 180;
  const wx = inp.move[0] * Math.cos(yr) + inp.move[1] * Math.sin(yr);
  const wz = -inp.move[0] * Math.sin(yr) + inp.move[1] * Math.cos(yr);
  if (wx || wz) maya.rotation.y = Math.atan2(wx, wz);
  maya.visible = p.invuln <= 0 || Math.floor(now / 80) % 2 === 0;

  let litCount = 0;
  s.lanterns.forEach((l, i) => {
    const { bulb, light } = lanternGroups[i].userData;
    if (l.lit) litCount++;
    const f = l.lit ? 1 : l.deposited / T.lantern_cost;
    bulb.material.emissive.setRGB(1 * f, 0.62 * f, 0.2 * f);
    bulb.material.color.setRGB(0.23 + 0.77 * f, 0.18 + 0.5 * f, 0.12);
    light.intensity = l.lit ? 60 + Math.sin(now / 200 + i) * 5 : f * 12;
  });
  scene.fog.density = 0.022 - 0.012 * (litCount / s.lanterns.length);

  while (motesGroup.children.length < s.motes.length) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff08a, fog: false }));
    motesGroup.add(m);
  }
  while (motesGroup.children.length > s.motes.length) motesGroup.remove(motesGroup.children.at(-1));
  s.motes.forEach((m, i) => motesGroup.children[i].position.set(m.pos[0], m.pos[1] + 0.7 + Math.sin(now / 300 + i) * 0.2, m.pos[2]));

  const live = new Set();
  for (const sh of s.shades) {
    live.add(sh.id);
    let mesh = shadeMeshes.get(sh.id);
    if (!mesh) {
      mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), mat(0x1a0f2e, { emissive: 0x3a1060, roughness: 0.9, transparent: true }));
      scene.add(mesh);
      shadeMeshes.set(sh.id, mesh);
    }
    mesh.position.set(sh.pos[0], sh.pos[1] + 0.2 + Math.sin(now / 250) * 0.1, sh.pos[2]);
    mesh.material.opacity = sh.state === 'stunned' ? 0.45 : 1;
    mesh.material.emissive.setHex(sh.state === 'stunned' ? 0x808080 : 0x3a1060);
  }
  for (const [id, mesh] of shadeMeshes) if (!live.has(id)) (scene.remove(mesh), shadeMeshes.delete(id));

  // camera theo sau
  const yc = (inp.yaw * Math.PI) / 180;
  const target = new THREE.Vector3(p.pos[0] + Math.sin(yc) * 12, 9 + p.pos[1], p.pos[2] + Math.cos(yc) * 12);
  camera.position.lerp(target, 0.12);
  camera.lookAt(p.pos[0], 0.8, p.pos[2]);

  $('flames').textContent = '🔥'.repeat(p.flames) || '0';
  $('carried').textContent = `${p.carried}/${T.carry_capacity}`;
  $('lit').textContent = `${litCount}/${s.lanterns.length}`;
  $('time').textContent = Math.max(0, s.timeLeft0 - s.steps / TICK_RATE).toFixed(0) + 's';
  $('score').textContent = s.score;
}

reset();
let acc = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= 1 / TICK_RATE) {
    acc -= 1 / TICK_RATE;
    if (game.sim.state !== 'playing') continue;
    for (const ev of game.step(readInput())) onEvent(ev);
  }
  for (const r of [...rings]) {
    r.userData.age += dt;
    const k = r.userData.age / 0.45;
    r.scale.setScalar(1 + k * T.pulse_radius * 1.6);
    r.material.opacity = Math.max(0, 1 - k);
    if (k >= 1) (scene.remove(r), rings.splice(rings.indexOf(r), 1));
  }
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').style.opacity = 0;
  clouds.rotation.y += dt * 0.02;
  syncMeshes(now);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
