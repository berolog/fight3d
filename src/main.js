import * as THREE from 'three';
import { Fighter } from './fighter.js?v=4';
import { Game } from './game.js?v=4';
import { AI } from './ai.js?v=4';
import { Sfx } from './audio.js?v=4';

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc3e6);
scene.fog = new THREE.Fog(0x9fc3e6, 18, 45);
const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 100);
camera.position.set(0, 2, 6);

scene.add(new THREE.HemisphereLight(0xdfefff, 0x6a5a48, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(4, 9, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
scene.add(sun, sun.target);

function floorTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c9c2b4'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#bdb5a6'; g.fillRect(0, 0, 128, 128); g.fillRect(128, 128, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 30);
  t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const ring = new THREE.Mesh(new THREE.RingGeometry(3.9, 4, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.004; scene.add(ring);

const fighters = [new Fighter(scene, 0xd63c3c, 'p1'), new Fighter(scene, 0x2f6ee0, 'p2')];
const game = new Game(fighters);
const sfx = new Sfx();

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------
const sparks = [];
const sparkGeo = new THREE.SphereGeometry(0.03, 6, 4);
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfff1a0 });
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide, depthWrite: false });
let shake = 0;
function burst(p, heavy, blocked) {
  const n = heavy ? 18 : 9;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(sparkGeo, sparkMat);
    m.position.set(p[0], p[1], p[2]);
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(2 + Math.random() * (heavy ? 5 : 3));
    scene.add(m); sparks.push({ m, v, life: 0.25 + Math.random() * 0.2 });
  }
  const r = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.1, 24), ringMat.clone());
  r.material.color.set(blocked ? 0x8fd0ff : 0xffe28a);
  r.position.set(p[0], p[1], p[2]); r.lookAt(camera.position);
  scene.add(r); sparks.push({ m: r, ring: true, life: 0.22, max: 0.22, s: heavy ? 9 : 5 });
}
function updateFx(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.life -= dt;
    if (s.ring) {
      const k = 1 - s.life / s.max;
      s.m.scale.setScalar(1 + k * s.s); s.m.material.opacity = Math.max(0, 1 - k);
    } else {
      s.v.y -= 9 * dt; s.m.position.addScaledVector(s.v, dt);
      s.m.scale.setScalar(Math.max(0.01, s.life * 4));
    }
    if (s.life <= 0) { scene.remove(s.m); if (s.ring) { s.m.geometry.dispose(); s.m.material.dispose(); } sparks.splice(i, 1); }
  }
}
function handleEvents(evs) {
  for (const e of evs) {
    if (e.t === 'hit') {
      burst(e.p, e.h, false); sfx.hit(e.h, e.c);
      if (mode !== 'menu' && e.i === localIdx) hurtFlash(e.h);
      shake = Math.max(shake, e.h ? 0.22 : 0.08);
      if (e.c) flashText('КОНТР-УДАР!', 600);
    } else if (e.t === 'blk') { burst(e.p, false, true); sfx.block(); shake = Math.max(shake, 0.03); }
    else if (e.t === 'sw') sfx.swoosh(e.k);
    else if (e.t === 'ko') { sfx.ko(); }
    else if (e.t === 'go') sfx.bell();
  }
}

// ---------------------------------------------------------------------------
// Input (layout independent: uses KeyboardEvent.code)
// ---------------------------------------------------------------------------
const held = new Set();
let pressed = {};
const PRESS = { KeyJ: 'lp', KeyK: 'rp', KeyU: 'lk', KeyI: 'rk', KeyQ: 'dl', KeyE: 'dr', Numpad4: 'lp', Numpad5: 'rp', Numpad7: 'lk', Numpad8: 'rk' };
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Escape') { toMenu(); return; }
  if (e.code === 'KeyV' && !e.repeat) { setView(view === 'fp' ? 'tp' : 'fp'); return; }
  if (!e.repeat && PRESS[e.code]) pressed[PRESS[e.code]] = 1;
  held.add(e.code);
  if (mode !== 'menu' && (e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault();
});
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => held.clear());
const H = (...c) => c.some(k => held.has(k));

// ---------------------------------------------------------------------------
// Touch controls: stick on the left, buttons on the right
// ---------------------------------------------------------------------------
const touch = { x: 0, y: 0, block: false, crouch: false };
(function setupTouch() {
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  let sid = null, cx = 0, cy = 0;
  const R = 55;
  const move = (e) => {
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touch.x = Math.abs(dx) > R * 0.35 ? Math.sign(dx) : 0;
    touch.y = Math.abs(dy) > R * 0.35 ? -Math.sign(dy) : 0;
  };
  stick.addEventListener('pointerdown', (e) => {
    e.preventDefault(); sid = e.pointerId; stick.setPointerCapture(sid);
    const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    move(e);
  });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) move(e); });
  const end = (e) => { if (e.pointerId !== sid) return; sid = null; touch.x = touch.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);

  document.querySelectorAll('#touch [data-p], #touch [data-h]').forEach((b) => {
    const down = (e) => {
      e.preventDefault(); b.classList.add('on');
      if (b.dataset.p) pressed[b.dataset.p] = 1; else touch[b.dataset.h] = true;
    };
    const up = () => { b.classList.remove('on'); if (b.dataset.h) touch[b.dataset.h] = false; };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  });
  document.getElementById('tmenu').addEventListener('click', () => toMenu());
  document.getElementById('touchChk').checked = matchMedia('(pointer: coarse)').matches;
})();
function localInput() {
  // x/y: screen-style axes (right / up) from keyboard or the touch stick
  const x = Math.max(-1, Math.min(1, (H('KeyD', 'ArrowRight') ? 1 : 0) - (H('KeyA', 'ArrowLeft') ? 1 : 0) + touch.x));
  const y = Math.max(-1, Math.min(1, (H('KeyW', 'ArrowUp') ? 1 : 0) - (H('KeyS', 'ArrowDown') ? 1 : 0) + touch.y));
  // First person: up = forward, right = strafe right.
  // Side view: the local player stands on the left facing right, up = step into the screen.
  const inp = {
    mf: view === 'fp' ? y : x,
    ms: view === 'fp' ? -x : y,
    block: H('Space', 'KeyL') || touch.block,
    crouch: H('KeyC', 'ControlLeft', 'ShiftLeft') || touch.crouch,
    press: pressed,
  };
  pressed = {};
  return inp;
}

// ---------------------------------------------------------------------------
// Modes: menu | ai | host | client
// ---------------------------------------------------------------------------
let mode = 'menu', ai = null, localIdx = 0;
let peer = null, conn = null, remoteInp = { press: {} }, lastSnap = null;
const $ = (id) => document.getElementById(id);

function show(id) {
  const t = id === 'hud' && $('touchChk').checked;
  $('touch').classList.toggle('hidden', !t);
  $('hud').classList.toggle('touchon', t);
  if (id === 'hud') setView(view);
  if (t && !document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  }
  $('hud').classList.toggle('swap', localIdx === 1);
  for (const s of ['menu', 'hud']) $(s).classList.toggle('hidden', s !== id);
}
function setNames(a, b) { $('n0').textContent = a; $('n1').textContent = b; }

function startAI(level) {
  closeNet();
  mode = 'ai'; localIdx = 0; ai = new AI(level);
  fighters.forEach(f => f.smooth = false);
  game.newMatch(); setNames('Ты', 'ИИ');
  show('hud'); sfx.resume();
}

function closeNet() {
  clearTimeout(joinTimer);
  try { conn && conn.close(); } catch (e) {}
  try { peer && peer.destroy(); } catch (e) {}
  conn = null; peer = null;
}
function toMenu(msg) {
  closeNet(); mode = 'menu'; show('menu');
  $('netStatus').textContent = msg || '';
  $('roomBox').classList.add('hidden');
}

const CODE_CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// ?ps=host:port points PeerJS at a self-hosted signaling server (used for local testing)
const ps = new URLSearchParams(location.search).get('ps');
// STUN finds the public address; TURN relays traffic when a direct link is impossible
// (mobile internet, strict routers).
const ICE = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};
const peerOpts = Object.assign({ config: ICE, debug: 1 },
  ps ? { host: ps.split(':')[0], port: +ps.split(':')[1], path: '/myapp', secure: false } : {});
let joinTimer = 0;
const peerId = (code) => 'fight3d-room-' + code.toLowerCase();
function newCode() { let s = ''; for (let i = 0; i < 5; i++) s += CODE_CH[Math.floor(Math.random() * CODE_CH.length)]; return s; }

function hostRoom() {
  closeNet(); sfx.resume();
  const code = newCode();
  $('netStatus').textContent = 'Создаю комнату…';
  peer = new Peer(peerId(code), peerOpts);
  peer.on('open', () => {
    const link = location.origin + location.pathname + '?room=' + code;
    $('roomCode').textContent = code;
    $('roomLink').value = link;
    $('roomBox').classList.remove('hidden');
    $('netStatus').textContent = 'Ждём соперника… Отправь другу код или ссылку.';
  });
  peer.on('connection', (c) => {
    if (conn && conn.open) { c.close(); return; }
    try { conn && conn.close(); } catch (e) {}
    conn = c;
    $('netStatus').textContent = 'Соперник подключается…';
    c.on('error', () => { if (conn === c && !c.open) { conn = null; $('netStatus').textContent = 'Соперник не смог подключиться. Ждём новую попытку…'; } });
    c.on('open', () => {
      mode = 'host'; localIdx = 0; remoteInp = { press: {} };
      fighters.forEach(f => f.smooth = false);
      game.newMatch(); setNames('Ты', 'Соперник'); show('hud');
    });
    c.on('data', (d) => {
      if (d.t === 'i') {
        const pr = Object.assign(remoteInp.press || {}, {});
        for (const k of d.p) pr[k] = 1;
        remoteInp = { mf: d.mf, ms: d.ms, block: d.b, crouch: d.c, press: pr };
      }
    });
    c.on('close', () => {
      if (conn !== c) return;
      if (mode === 'host') toMenu('Соперник отключился.');
      else { conn = null; $('netStatus').textContent = 'Соперник не смог подключиться. Ждём новую попытку…'; }
    });
  });
  // keep the room reachable if the link to the signaling server drops (sleep, flaky Wi-Fi)
  peer.on('disconnected', () => { try { peer && !peer.destroyed && peer.reconnect(); } catch (e) {} });
  peer.on('error', (e) => {
    if (e.type === 'unavailable-id') return hostRoom();
    $('netStatus').textContent = 'Ошибка сети: ' + e.type;
  });
}

function joinRoom(code) {
  code = (code || '').trim().toUpperCase();
  if (!code) return;
  closeNet(); sfx.resume();
  $('netStatus').textContent = 'Связываюсь с сервером…';
  clearTimeout(joinTimer);
  const fail = (msg) => { clearTimeout(joinTimer); closeNet(); $('netStatus').textContent = msg; };
  joinTimer = setTimeout(() => fail('Не удалось соединиться за 20 секунд. Проверь код, попроси друга не сворачивать вкладку с комнатой и попробуй ещё раз. Если не помогает, подключитесь оба к одной Wi-Fi сети.'), 20000);
  peer = new Peer(peerOpts);
  peer.on('open', () => {
    $('netStatus').textContent = 'Ищу комнату ' + code + ' и соединяюсь…';
    conn = peer.connect(peerId(code), { reliable: true });
    conn.on('error', (e) => fail('Ошибка соединения: ' + (e.type || e.message || e)));
    conn.on('open', () => {
      clearTimeout(joinTimer);
      mode = 'client'; localIdx = 1; lastSnap = null;
      fighters.forEach(f => f.smooth = true);
      setNames('Ты', 'Соперник'); show('hud');
    });
    conn.on('data', (d) => {
      if (d.t === 's') { lastSnap = d; if (d.e && d.e.length) handleEvents(d.e); }
    });
    conn.on('close', () => { if (mode === 'client') toMenu('Соединение закрыто.'); });
  });
  peer.on('error', (e) => {
    fail(e.type === 'peer-unavailable' ? 'Комната ' + code + ' не найдена. Проверь код и что вкладка с комнатой открыта.' : 'Ошибка сети: ' + e.type);
  });
}

// menu wiring
document.querySelectorAll('[data-ai]').forEach(b => b.onclick = () => startAI(b.dataset.ai));
$('hostBtn').onclick = hostRoom;
$('joinBtn').onclick = () => joinRoom($('joinCode').value);
$('joinCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(e.target.value); });
$('copyBtn').onclick = () => { navigator.clipboard?.writeText($('roomLink').value); $('copyBtn').textContent = 'Скопировано'; };
const urlRoom = new URLSearchParams(location.search).get('room');
if (urlRoom) { $('joinCode').value = urlRoom; joinRoom(urlRoom); }

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
const lag = [100, 100];
let flashUntil = 0, flashMsg = '';
function flashText(t, ms) { flashMsg = t; flashUntil = performance.now() + ms; }
function updateHud(dt) {
  // bar 0 (left) is always the local player
  for (let i = 0; i < 2; i++) {
    const fi = i === 0 ? localIdx : 1 - localIdx;
    const hp = fighters[fi].st.hp;
    lag[i] = hp < lag[i] ? Math.max(hp, lag[i] - dt * 35) : hp;
    $('hp' + i).style.width = hp + '%';
    $('lag' + i).style.width = lag[i] + '%';
    $('sc' + i).textContent = '●'.repeat(game.rs.sc[fi]);
  }
  const rs = game.rs;
  let msg = '';
  if (rs.ph === 'intro') msg = rs.t < 1.1 ? 'РАУНД ' + rs.n : 'БОЙ!';
  else if (rs.ph === 'ko') msg = 'K.O.<small>' + (rs.w === localIdx ? 'Ты победил!' : 'Ты проиграл') + '</small>';
  else if (performance.now() < flashUntil) msg = '<small>' + flashMsg + '</small>';
  if ($('big').innerHTML !== msg) $('big').innerHTML = msg;
}

// ---------------------------------------------------------------------------
// Camera: side view, local player always on the left
// ---------------------------------------------------------------------------
const camPos = new THREE.Vector3(0, 2, 6), camLook = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Vector3(), _d = new THREE.Vector3(), _f = new THREE.Vector3(), _t = new THREE.Vector3();
// First person: eyes of the local fighter, looking at the opponent's head.
// Hit reactions (head snap, body lean) shake the view; a knockdown takes the view down with the body.
const _eye = new THREE.Vector3(), _tg = new THREE.Vector3(), fpLook = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _mx = new THREE.Matrix4();
const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const UP = new THREE.Vector3(0, 1, 0);
let fpInit = false;
function updateFPCamera(dt) {
  const me = fighters[localIdx], op = fighters[1 - localIdx], s = me.st;
  me.head.localToWorld(_eye.set(0, 0.17, -0.06));
  op.head.localToWorld(_tg.set(0, 0.06, 0));
  if (!fpInit) { fpLook.copy(_tg); fpInit = true; }
  fpLook.lerp(_tg, 1 - Math.exp(-dt * 12));
  _mx.lookAt(_eye, fpLook, UP);
  _q1.setFromRotationMatrix(_mx);
  me.head.getWorldQuaternion(_q2).multiply(FLIP);
  const w = Math.min(1, Math.max(0, -(me.pose.tilt || 0) / 1.1));
  camera.position.copy(_eye);
  camera.quaternion.copy(_q1).slerp(_q2, w);
  camera.rotateX(-s.hd[0] * 0.7 - s.ln[0] * 0.4);
  camera.rotateY(s.hd[1] * 0.7);
  camera.rotateZ(-s.ln[1] * 0.8);
  if (shake > 0) {
    camera.rotateX((Math.random() - 0.5) * shake * 0.3);
    camera.rotateY((Math.random() - 0.5) * shake * 0.3);
    shake = Math.max(0, shake - dt * 1.2);
  }
  _m.set((me.rx + op.rx) / 2, 1, (me.rz + op.rz) / 2);
  sun.position.set(_m.x + 4, 9, _m.z + 5); sun.target.position.copy(_m);
}

let view = 'fp';
function setView(v) {
  view = v; fpInit = false;
  camera.fov = v === 'fp' ? 72 : 40; camera.updateProjectionMatrix();
  fighters.forEach((f, i) => f.setFirstPerson(v === 'fp' && i === localIdx && mode !== 'menu'));
  $('help').textContent = v === 'fp'
    ? 'W/S вперёд-назад · A/D в сторону · J/K руки · U/I ноги · Пробел блок · C присесть · Q/E уклон · V вид · Esc меню'
    : 'A/D назад-вперёд · W/S обход · J/K руки · U/I ноги · Пробел блок · C присесть · Q/E уклон · V вид · Esc меню';
}

let hurtT = 0;
function hurtFlash(heavy) { hurtT = heavy ? 1 : 0.6; }

function updateCamera(dt) {
  hurtT = Math.max(0, hurtT - dt * 2.5);
  $('hurt').style.opacity = hurtT;
  if (view === 'fp') return updateFPCamera(dt);
  const me = fighters[localIdx], op = fighters[1 - localIdx];
  _m.set((me.rx + op.rx) / 2, 0, (me.rz + op.rz) / 2);
  _d.set(op.rx - me.rx, 0, op.rz - me.rz);
  const sep = _d.length();
  if (sep > 0.01) _d.divideScalar(sep); else _d.set(1, 0, 0);
  _f.set(0, 1, 0).cross(_d); // camera forward
  const dist = 3.4 + sep * 1.1;
  _t.copy(_m).addScaledVector(_f, -dist); _t.y = 1.55 + sep * 0.15;
  const k = 1 - Math.exp(-dt * 5);
  camPos.lerp(_t, k);
  camLook.lerp(_m.setY(1.05), k);
  camera.position.copy(camPos);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 1.2);
  }
  camera.lookAt(camLook);
  sun.position.set(camLook.x + 4, 9, camLook.z + 5); sun.target.position.copy(camLook);
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const DT = 1 / 60;
let acc = 0, last = performance.now(), menuT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;

  if (mode === 'ai' || mode === 'host') {
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < 4) {
      const mine = localInput();
      const other = mode === 'ai' ? ai.think(DT, fighters[1], fighters[0]) : remoteInp;
      if (mode === 'host') remoteInp = Object.assign({}, remoteInp, { press: {} });
      game.step(DT, [mine, other]);
      acc -= DT; steps++;
    }
    if (steps === 4) acc = 0;
    const evs = game.events; game.events = [];
    handleEvents(evs);
    if (mode === 'host' && conn && conn.open) {
      const snap = game.snapshot(); snap.e = evs;
      conn.send(snap);
    }
  } else if (mode === 'client') {
    const inp = localInput();
    if (conn && conn.open) conn.send({ t: 'i', mf: inp.mf, ms: inp.ms, b: inp.block, c: inp.crouch, p: Object.keys(inp.press) });
    if (lastSnap) {
      game.rs = lastSnap.r;
      fighters[0].st = lastSnap.s[0]; fighters[1].st = lastSnap.s[1];
    }
    fighters[0].applyRig(dt); fighters[1].applyRig(dt);
  } else {
    // menu: idle demo, slowly orbiting
    menuT += dt;
    fighters[0].applyRig(dt); fighters[1].applyRig(dt);
  }

  updateFx(dt);
  if (mode === 'menu') {
    camera.position.set(Math.sin(menuT * 0.15) * 5.5, 2.2, Math.cos(menuT * 0.15) * 5.5);
    camera.lookAt(0, 1.1, 0);
  } else { updateCamera(dt); updateHud(dt); }
  if (mode === 'menu' && camera.fov !== 40) { camera.fov = 40; camera.updateProjectionMatrix(); fighters.forEach(f => f.setFirstPerson(false)); }
  renderer.render(scene, camera);
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
show('menu');
requestAnimationFrame(frame);

// debug hooks for automated testing
window.__fight = { game, fighters, startAI, get mode() { return mode; } };
