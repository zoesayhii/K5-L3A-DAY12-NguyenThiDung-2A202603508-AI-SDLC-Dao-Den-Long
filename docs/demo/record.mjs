import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createApp } from '/home/dungmsi/prj/ai20k/K5-L3A-LAB-DAY12-NguyenThiDung-2A202603508-AI-SDLC/server/app.mjs';
const SP = '/tmp/claude-1000/-home-dungmsi-prj-ai20k-K5-L3A-LAB-DAY12-NguyenThiDung-2A202603508-AI-SDLC/789936f9-a389-40cb-a6ae-f5636ef5e2d4/scratchpad';
const FR = SP + '/frames'; rmSync(FR, { recursive: true, force: true }); mkdirSync(FR);
const PORT = 8123, DBG = 9333;
const srv = createApp().listen(PORT);
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${DBG}`, '--window-size=1280,720', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${SP}/prof`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let list;
for (let i = 0; i < 50; i++) { try { list = await (await fetch(`http://127.0.0.1:${DBG}/json`)).json(); if (list.find((t) => t.type === 'page')) break; } catch {} await sleep(200); }
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); const frames = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d.result); pend.delete(d.id); }
  else if (d.method === 'Page.screencastFrame') {
    const n = frames.length; writeFileSync(`${FR}/f${String(n).padStart(6, '0')}.jpg`, Buffer.from(d.params.data, 'base64'));
    frames.push(Date.now()); send('Page.screencastFrameAck', { sessionId: d.params.sessionId });
  }
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` }); await sleep(3000);
await send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });
const KEYS = { W: 'KeyW', A: 'KeyA', S: 'KeyS', D: 'KeyD', E: 'KeyE', F: 'KeyF', Shift: 'ShiftLeft', Space: 'Space' };
const down = new Set();
async function key(name, on) { const code = KEYS[name]; if (on === down.has(name)) return; on ? down.add(name) : down.delete(name);
  await send('Input.dispatchKeyEvent', { type: on ? 'rawKeyDown' : 'keyUp', code, key: name.length === 1 ? name.toLowerCase() : name, windowsVirtualKeyCode: name.length === 1 ? name.charCodeAt(0) : 0 }); }
const click = (sel) => ev(`(()=>{const b=document.querySelector('${sel}');if(b){b.click();return true}return false})()`);
const clickAct = (a) => click(`[data-act="${a}"]`);
const snap = () => ev(`(()=>{const g=window.__ddl&&window.__ddl.game;if(!g)return null;const s=g.snapshot();return {state:s.state,t:s.time_left_s,p:s.player.pos,c:s.player.carried,cap:s.player.capacity,pulse:s.player.pulse_cd_s,dash:s.player.dash_cd_s,L:s.lanterns.map(l=>({pos:l.pos,lit:l.lit,fuel:l.fuel})),S:s.shades.map(x=>x.pos),M:s.motes.map(m=>m.pos)}})()`);
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
async function steer(t) { // t: [x,z] or null. yaw=0: W = -z, D = +x
  const want = { W: false, A: false, S: false, D: false };
  if (t) { const s = await snap(); const dx = t[0] - s.p[0], dz = t[2] - s.p[2]; if (dx > .4) want.D = true; if (dx < -.4) want.A = true; if (dz > .4) want.S = true; if (dz < -.4) want.W = true; }
  for (const k of ['W', 'A', 'S', 'D']) await key(k, want[k]);
}
async function playSeconds(sec, opts = {}) {
  const end = Date.now() + sec * 1000; let lastF = 0, lastE = 0;
  while (Date.now() < end) {
    const s = await snap(); if (!s || s.state !== 'playing' && s.state !== 'running' && s.state !== 'play') { if (s && /won|lost|win|lose|ended|dawn/i.test(s.state)) break; }
    if (!s) break;
    let tgt = null;
    const need = s.L.filter((l) => !l.lit || l.fuel < 70);
    const near = (arr) => arr.slice().sort((a, b) => d2(a, s.p) - d2(b, s.p))[0];
    if (s.c >= 3 && need.length) tgt = near(need.map((l) => l.pos)); else if (s.M.length && s.c < s.cap) tgt = near(s.M); else if (need.length) tgt = near(need.map((l) => l.pos));
    const thr = s.S.filter((x) => d2(x, s.p) < 9).sort((a, b) => d2(a, s.p) - d2(b, s.p))[0];
    if (thr) { const dx = s.p[0] - thr[0], dz = s.p[2] - thr[2], n = Math.hypot(dx, dz) || 1; tgt = [s.p[0] + dx / n * 10, 0, s.p[2] + dz / n * 10]; }
    await steer(tgt);
    const sh = s.S.filter((x) => d2(x, s.p) < 6).length;
    if (sh && s.pulse <= 0 && Date.now() - lastF > 1500) { lastF = Date.now(); await key('F', true); await sleep(120); await key('F', false); }
    if (sh && s.dash <= 0 && opts.dash !== false) { await key('Shift', true); await sleep(100); await key('Shift', false); }
    if (!thr && tgt && d2(tgt, s.p) < 4 && Date.now() - lastE > 400) { lastE = Date.now(); await key('E', true); await sleep(100); await key('E', false); }
    await sleep(120);
  }
  for (const k of ['W', 'A', 'S', 'D']) await key(k, false);
}
const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const t0 = Date.now();
log('menu'); await sleep(4000);
log('night1'); await clickAct('start'); await sleep(2500); await clickAct('go'); await sleep(500);
await playSeconds(100); log('night1 phase done');
await clickAct('pause'); 
// Night 2 / 3 quick visit
await ev(`location.href='/'`); await sleep(3000);
await clickAct('night2'); await sleep(2000); await clickAct('go'); await playSeconds(14);
await ev(`location.href='/'`); await sleep(3000);
await clickAct('night3'); await sleep(2000); await clickAct('go'); await playSeconds(14);
await ev(`location.href='/'`); await sleep(3000);
log('settings'); await clickAct('settings'); await sleep(1500);
await click('#cb'); await sleep(1200); await click('#big'); await sleep(1200); await click('#cb'); await click('#big'); await sleep(800);
await clickAct('keys'); await sleep(2500); 
await ev(`location.href='/'`); await sleep(3000);
log('leaderboard'); await clickAct('lb'); await sleep(4000);
await send('Page.stopScreencast');
// timestamps -> concat
let txt = ''; for (let i = 0; i < frames.length; i++) { const dur = i < frames.length - 1 ? (frames[i + 1] - frames[i]) / 1000 : 0.1; txt += `file 'frames/f${String(i).padStart(6, '0')}.jpg'\nduration ${dur.toFixed(3)}\n`; }
txt += `file 'frames/f${String(frames.length - 1).padStart(6, '0')}.jpg'\n`;
writeFileSync(SP + '/list.txt', txt);
log(`frames=${frames.length} elapsed=${((Date.now() - t0) / 1000) | 0}s`);
chrome.kill('SIGKILL'); srv.close(); process.exit(0);
