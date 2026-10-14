import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Pose system. A pose is a flat object of numbers; animations are additive
// deltas on top of the fighting stance. Hands are IK targets in chest space,
// feet are IK targets in body space.
// ---------------------------------------------------------------------------
export const PK = ['py', 'pp', 'pr', 'pw', 'cx', 'cy', 'cz', 'hx', 'hy', 'hz', 'ox', 'oz', 'tilt', 'lift',
  'lhx', 'lhy', 'lhz', 'rhx', 'rhy', 'rhz', 'lfx', 'lfy', 'lfz', 'rfx', 'rfy', 'rfz'];

function expand(o) {
  const r = {};
  for (const k in o) {
    const v = o[k];
    if (Array.isArray(v)) { r[k + 'x'] = v[0]; r[k + 'y'] = v[1]; r[k + 'z'] = v[2]; } else r[k] = v;
  }
  return r;
}

const STANCE = Object.assign(Object.fromEntries(PK.map(k => [k, 0])), expand({
  py: 0.93, pp: 0.04, cx: 0.12, hx: -0.12,
  lh: [0.14, 0.36, 0.27], rh: [-0.13, 0.33, 0.2],
  lf: [0.14, 0.08, 0.15], rf: [-0.14, 0.08, -0.15],
}));

function delta(over) {
  const e = expand(over), d = {};
  for (const k of PK) d[k] = (k in e ? e[k] : STANCE[k]) - STANCE[k];
  return d;
}

const D_CROUCH = delta({ py: 0.52, pp: 0.25, cx: 0.35, hx: -0.4, lf: [0.18, 0.08, 0.2], rf: [-0.18, 0.08, -0.2], lh: [0.13, 0.3, 0.28], rh: [-0.13, 0.28, 0.24] });
const D_BLOCK = delta({ cx: 0.22, hx: 0.15, lh: [0.11, 0.44, 0.3], rh: [-0.11, 0.44, 0.3], py: 0.9 });

function mkKeys(list) { return list.map(([t, o]) => ({ t, d: delta(o) })); }

const JAB = { lh: [0.05, 0.5, 0.95], cy: -0.38, pw: -0.12, oz: 0.06 };
const CROSS = { rh: [0.02, 0.5, 1.0], cy: 0.5, pw: 0.32, oz: 0.12, lh: [0.12, 0.38, 0.18] };
const FKICK = { lf: [0.06, 1.02, 1.15], pp: -0.38, py: 0.9, rf: [-0.12, 0.08, -0.25], oz: 0.04, lh: [0.16, 0.42, 0.22], rh: [-0.16, 0.4, 0.18] };
const RKICK = { rf: [0.22, 1.12, 0.95], pw: 1.0, pp: -0.22, pr: -0.3, cy: -0.55, py: 0.9, lf: [0.12, 0.08, 0.05] };
const DODGE_L = { pr: -0.5, ox: 0.18, cx: 0.25, py: 0.84, hz: 0.2 };
const DODGE_R = { pr: 0.5, ox: -0.18, cx: 0.25, py: 0.84, hz: -0.2 };
const UPPER = { rh: [0.0, 0.62, 0.8], py: 1.0, cy: 0.45, pw: 0.25, pp: -0.15, oz: 0.25, hx: -0.2 };
const GRAB = { lh: [0.14, 0.42, 0.85], rh: [-0.14, 0.42, 0.85], oz: 0.18, cx: 0.3, py: 0.86 };
const SUPER = { rh: [0.02, 0.48, 1.1], cy: 0.6, pw: 0.4, oz: 0.35, lh: [0.14, 0.38, 0.12], pp: 0.12 };
const WHIFF = { pp: 0.22, oz: 0.12, cx: 0.2, lh: [0.2, 0.2, 0.3], rh: [-0.2, 0.2, 0.3] };
const FALL = { tilt: -1.47, lift: 0.13, lh: [0.3, 0.1, 0.1], rh: [-0.3, 0.1, 0.1], hx: 0.3 };

// push: [forward, left] in attacker space (m/s). dmg in HP.
export const ACTS = {
  lp: { dur: 0.34, on: 0.07, off: 0.15, limb: 'lh', dmg: 6, push: [1.6, 0], stun: 0.3, stag: 10, snd: 0,
    keys: mkKeys([[0, {}], [0.08, JAB], [0.15, JAB], [0.34, {}]]) },
  rp: { dur: 0.48, on: 0.13, off: 0.23, limb: 'rh', dmg: 10, push: [2.6, 1.8], stun: 0.42, stag: 18, snd: 1,
    keys: mkKeys([[0, {}], [0.06, { rh: [-0.15, 0.3, 0.05], cy: -0.18 }], [0.15, CROSS], [0.23, CROSS], [0.48, {}]]) },
  lk: { dur: 0.66, on: 0.18, off: 0.3, limb: 'lf', dmg: 14, push: [7.5, 0], stun: 0.6, stag: 40, heavy: true, snd: 2,
    keys: mkKeys([[0, {}], [0.09, { lf: [0.12, 0.6, 0.4], py: 0.9, pp: -0.1 }], [0.2, FKICK], [0.3, FKICK], [0.46, { lf: [0.12, 0.5, 0.3], pp: -0.1 }], [0.66, {}]]) },
  rk: { dur: 0.74, on: 0.21, off: 0.33, limb: 'rf', dmg: 16, push: [2.6, 6.5], stun: 0.6, stag: 40, heavy: true, snd: 2,
    keys: mkKeys([[0, {}], [0.1, { rf: [-0.5, 0.6, 0.0], pw: 0.45, py: 0.9, pr: -0.1 }], [0.23, RKICK], [0.33, RKICK], [0.52, { rf: [-0.25, 0.45, -0.05], pw: 0.4 }], [0.74, {}]]) },
  // uppercut: crouch + punch
  up: { dur: 0.56, on: 0.12, off: 0.22, limb: 'rh', dmg: 13, push: [2.6, 0], stun: 0.55, stag: 45, heavy: true, snd: 1,
    keys: mkKeys([[0, {}], [0.06, { rh: [-0.05, 0.12, 0.3], py: 0.68, cy: 0.3, pp: 0.25 }], [0.15, UPPER], [0.22, UPPER], [0.56, {}]]) },
  // throw: beats block, misses a crouching opponent, long recovery on a miss
  th: { dur: 0.7, on: 0.14, off: 0.24, dmg: 12, push: [5.5, 0], snd: 0,
    keys: mkKeys([[0, {}], [0.12, GRAB], [0.24, GRAB], [0.4, { lh: [0.2, 0.35, 0.3], rh: [-0.2, 0.35, 0.3], cy: 0.8, pw: 0.5 }], [0.7, {}]]) },
  // super: once per round when the rage bar is full, goes through block
  sp: { dur: 0.85, on: 0.3, off: 0.42, limb: 'rh', dmg: 24, push: [11, 0], stun: 0.8, stag: 300, heavy: true, super: true, snd: 2,
    keys: mkKeys([[0, {}], [0.25, { rh: [-0.25, 0.4, -0.15], cy: -0.6, pw: -0.4, py: 0.85 }], [0.34, SUPER], [0.45, SUPER], [0.85, {}]]) },
  // dodges: moving out of the way is free, coming back is not (counter-hit window)
  dl: { dur: 0.52, keys: mkKeys([[0, {}], [0.12, DODGE_L], [0.26, DODGE_L], [0.52, {}]]), side: 1 },
  dr: { dur: 0.52, keys: mkKeys([[0, {}], [0.12, DODGE_R], [0.26, DODGE_R], [0.52, {}]]), side: -1 },
  wf: { dur: 0.28, keys: mkKeys([[0, {}], [0.1, WHIFF], [0.28, {}]]) }, // stumble after a missed heavy attack
  bs: { dur: 0.2, keys: mkKeys([[0, {}], [1, {}]]) }, // block stun
  hit: { dur: 0.3, keys: mkKeys([[0, {}], [1, {}]]) },
  down: { dur: 2.1, keys: mkKeys([[0, {}], [0.38, FALL], [1.4, FALL], [2.1, {}]]) },
  ko: { dur: 1e9, keys: mkKeys([[0, {}], [0.5, FALL], [2, FALL]]) },
};
export const ATTACKS = ['lp', 'rp', 'lk', 'rk', 'up', 'th', 'sp'];

function sampleKeys(keys, t, out, w) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1] || a;
  let u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
  u = Math.min(1, Math.max(0, u));
  u = u * u * (3 - 2 * u);
  for (const k of PK) out[k] += w * (a.d[k] + (b.d[k] - a.d[k]) * u);
}

// ---------------------------------------------------------------------------
// Fighter state (plain object so it can be sent over the network)
// ---------------------------------------------------------------------------
export function newState(x, z) {
  return {
    x, z, yaw: 0, kx: 0, kz: 0, wx: 0, wz: 0,
    hp: 100, act: '', at: 0, ad: 0, hasHit: 0, buf: '', bufT: 0,
    blk: 0, cr: 0, ph: 0, sp: 0, mvx: 0, mvz: 0,
    ln: [0, 0, 0], lv: [0, 0, 0], hd: [0, 0], hv: [0, 0], stag: 0, flash: 0,
    y: 0, vy: 0, out: 0, dcd: 0, rg: 0, su: 0, cmb: 0, cmbT: 0,
  };
}

const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpV3 = new THREE.Vector3();
const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion();
const DOWN = new THREE.Vector3(0, -1, 0);
export const RING_R = 4.8, RING_H = 0.35;
const _C = new THREE.Vector3();

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Fighter {
  constructor(scene, color, name) {
    this.name = name;
    this.st = newState(0, 0);
    this.pose = {};
    this.smooth = false; // client-side position smoothing
    this.rx = 0; this.rz = 0;
    this.build(scene, color);
  }

  build(scene, color) {
    const skin = new THREE.MeshStandardMaterial({ color: 0xe0b48f, roughness: 0.7 });
    const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.8 });
    const glove = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1 });
    this.mats = [skin, cloth, dark, glove];
    const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
      parent.add(m); return m;
    };
    const G = () => new THREE.Group();
    const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);

    this.root = G(); scene.add(this.root);
    this.body = G(); this.root.add(this.body);
    this.pelvis = G(); this.body.add(this.pelvis);
    mesh(new THREE.BoxGeometry(0.34, 0.2, 0.22), dark, this.pelvis, 0, 0, 0);
    this.spine = G(); this.spine.position.set(0, 0.06, 0); this.pelvis.add(this.spine);
    mesh(cap(0.13, 0.12), skin, this.spine, 0, 0.12, 0);
    this.chest = G(); this.chest.position.set(0, 0.22, 0); this.spine.add(this.chest);
    mesh(new THREE.BoxGeometry(0.44, 0.32, 0.24), skin, this.chest, 0, 0.16, 0);
    mesh(new THREE.BoxGeometry(0.46, 0.08, 0.26), cloth, this.chest, 0, 0.0, 0); // belt-ish band
    this.head = G(); this.head.position.set(0, 0.36, 0); this.chest.add(this.head);
    mesh(cap(0.045, 0.06), skin, this.head, 0, 0.02, 0);
    mesh(new THREE.SphereGeometry(0.13, 16, 12), skin, this.head, 0, 0.14, 0);
    mesh(new THREE.BoxGeometry(0.2, 0.06, 0.18), cloth, this.head, 0, 0.23, -0.01); // headband
    const eyeG = new THREE.SphereGeometry(0.022, 8, 6);
    mesh(eyeG, dark, this.head, 0.045, 0.16, 0.115); mesh(eyeG, dark, this.head, -0.045, 0.16, 0.115);

    this.arms = {};
    for (const [k, s] of [['l', 1], ['r', -1]]) {
      const up = G(); up.position.set(0.25 * s, 0.28, 0); this.chest.add(up);
      const sh = [mesh(new THREE.SphereGeometry(0.075, 10, 8), skin, up), mesh(cap(0.055, 0.22), skin, up, 0, -0.15, 0)];
      const lo = G(); lo.position.set(0, -0.3, 0); up.add(lo);
      mesh(cap(0.048, 0.2), skin, lo, 0, -0.13, 0);
      const fist = mesh(new THREE.SphereGeometry(0.085, 12, 10), glove, lo, 0, -0.32, 0);
      this.arms[k] = { up, lo, fist, s, sh };
    }
    this.legs = {};
    for (const [k, s] of [['l', 1], ['r', -1]]) {
      const up = G(); up.position.set(0.11 * s, -0.05, 0); this.pelvis.add(up);
      mesh(cap(0.08, 0.3), dark, up, 0, -0.23, 0);
      const lo = G(); lo.position.set(0, -0.46, 0); up.add(lo);
      mesh(cap(0.06, 0.32), skin, lo, 0, -0.23, 0);
      const foot = G(); foot.position.set(0, -0.46, 0); lo.add(foot);
      mesh(new THREE.BoxGeometry(0.11, 0.08, 0.25), dark, foot, 0, -0.04, 0.06);
      this.legs[k] = { up, lo, foot, s };
    }
    // blob shadow for readability
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.005; this.root.add(sh); this.blob = sh;
  }

  reset(x, z, yaw) {
    const keep = this.st;
    this.st = newState(x, z);
    this.st.yaw = yaw;
    this.rx = x; this.rz = z;
    return keep;
  }

  get busy() { return !!this.st.act; }
  get downed() { return this.st.act === 'down' || this.st.act === 'ko'; }
  forward() { return tmpV3.set(Math.sin(this.st.yaw), 0, Math.cos(this.st.yaw)); }

  startAct(name, dur) {
    const s = this.st;
    s.act = name; s.at = 0; s.ad = dur || ACTS[name].dur; s.hasHit = 0;
  }

  // ---- simulation (host / single-player only) ----
  step(dt, inp, opp, game) {
    const s = this.st;
    // facing
    if (!this.downed) {
      const ty = Math.atan2(opp.st.x - s.x, opp.st.z - s.z);
      s.yaw = angleLerp(s.yaw, ty, Math.min(1, dt * (s.act && ATTACKS.includes(s.act) ? 4 : 12)));
    }
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw); // forward
    const lx = fz, lz = -fx; // left

    // buffered input
    if (inp.press) {
      for (const p of ['lp', 'rp', 'lk', 'rk', 'dl', 'dr', 'th', 'sp']) if (inp.press[p]) { s.buf = p; s.bufT = 0.18; }
    }
    s.bufT -= dt;
    if (s.bufT <= 0) s.buf = '';

    // action timeline
    if (s.act) {
      s.at += dt;
      if (s.at >= s.ad) {
        const name = s.act, a = ACTS[name], missed = !s.hasHit && (a.heavy || name === 'th');
        s.act = ''; s.at = 0;
        if (missed) this.startAct('wf', name === 'sp' ? 0.45 : undefined);
      }
    }
    s.dcd = Math.max(0, s.dcd - dt);
    s.cmbT = Math.max(0, s.cmbT - dt);
    const free = !s.act;
    let wantBlk = 0, wantCr = 0, mvF = 0, mvL = 0;
    if (free) {
      if (s.buf) {
        let a = s.buf; s.buf = ''; s.bufT = 0;
        if ((a === 'lp' || a === 'rp') && (s.cr > 0.4 || inp.crouch)) a = 'up';
        if (a === 'sp' && !this.superReady) a = '';
        if ((a === 'dl' || a === 'dr') && s.dcd > 0) a = '';
        if (a) this.startAct(a);
        if (a === 'sp') { s.rg = 0; s.su = 1; game.event({ t: 'sup', i: game.idx(this) }); }
        if (!a) { /* dropped input */ } else if (a === 'dl' || a === 'dr') {
          s.dcd = 0.9;
          const side = ACTS[a].side * 3.6;
          s.kx += lx * side; s.kz += lz * side;
          game.event({ t: 'sw', i: game.idx(this), k: 3 });
        } else game.event({ t: 'sw', i: game.idx(this), k: ACTS[a].snd });
      } else {
        wantBlk = inp.block ? 1 : 0;
        wantCr = inp.crouch ? 1 : 0;
        if (!wantCr) {
          mvF = inp.mf || 0; mvL = inp.ms || 0;
        }
      }
    }
    if (s.act === 'bs') wantBlk = 1;
    s.blk += (wantBlk - s.blk) * Math.min(1, dt * 18);
    s.cr += ((s.act && ATTACKS.includes(s.act) ? 0 : wantCr) - s.cr) * Math.min(1, dt * 14);

    // walking
    let spd = mvF > 0 ? 2.1 : 1.7;
    if (mvL) spd = 1.8;
    if (wantBlk) spd *= 0.4;
    const len = Math.hypot(mvF, mvL) || 1;
    const twx = (fx * mvF + lx * mvL) / len * spd * (mvF || mvL ? 1 : 0);
    const twz = (fz * mvF + lz * mvL) / len * spd * (mvF || mvL ? 1 : 0);
    s.wx += (twx - s.wx) * Math.min(1, dt * 12);
    s.wz += (twz - s.wz) * Math.min(1, dt * 12);
    // knockback decays (friction)
    const fr = Math.exp(-(this.downed ? 3 : 5.5) * dt);
    s.kx *= fr; s.kz *= fr;
    const vx = s.wx + s.kx, vz = s.wz + s.kz;
    s.x += vx * dt; s.z += vz * dt;
    // falling off the ring
    if (s.out) { s.vy -= 12 * dt; s.y = Math.max(-RING_H, s.y + s.vy * dt); }

    // local move for walk cycle
    s.mvz = vx * fx + vz * fz; s.mvx = vx * lx + vz * lz;
    s.sp = Math.hypot(vx, vz);
    s.ph += dt * Math.min(s.sp, 4) * 5.5;

    // springs (hit reactions)
    const k = 110, c = 11;
    for (let i = 0; i < 3; i++) {
      s.lv[i] += (-k * s.ln[i] - c * s.lv[i]) * dt;
      s.ln[i] = Math.max(-1, Math.min(1, s.ln[i] + s.lv[i] * dt));
    }
    for (let i = 0; i < 2; i++) {
      s.hv[i] += (-160 * s.hd[i] - 12 * s.hv[i]) * dt;
      s.hd[i] = Math.max(-0.9, Math.min(0.9, s.hd[i] + s.hv[i] * dt));
    }
    s.stag = Math.max(0, s.stag - dt * 18);
    s.flash = Math.max(0, s.flash - dt * 5);
  }

  activeAttack() {
    const s = this.st, a = ACTS[s.act];
    if (!a || !a.limb || s.hasHit) return null;
    return s.at >= a.on && s.at <= a.off ? a : null;
  }

  get superReady() { return this.st.rg >= 100 && !this.st.su; }
  get knocked() { const a = this.st.act; return a === 'hit' || a === 'down' || a === 'ko'; }

  // caught in startup, in the recovery of a miss, or coming back from a dodge
  isCounterable() {
    const s = this.st, a = ACTS[s.act];
    if (!a) return false;
    if (a.limb) return s.at < a.on;
    if (s.act === 'th') return s.at < a.on || s.at > a.off;
    if (s.act === 'dl' || s.act === 'dr') return s.at > 0.3;
    return s.act === 'wf';
  }

  // ---- rendering / rig ----
  computePose(dt) {
    const s = this.st, P = this.pose;
    for (const k of PK) P[k] = STANCE[k];
    for (const k of PK) P[k] += D_CROUCH[k] * s.cr + D_BLOCK[k] * s.blk;
    if (s.act && ACTS[s.act]) {
      const a = ACTS[s.act];
      const t = s.act === 'hit' ? 0 : s.at;
      sampleKeys(a.keys, Math.min(t, a.keys[a.keys.length - 1].t), P, 1);
    }
    // walk cycle
    if (!this.downed) {
      const amp = Math.min(1, s.sp / 2.0);
      if (amp > 0.02) {
        const sn = Math.sin(s.ph), cs = Math.cos(s.ph);
        const dl = Math.hypot(s.mvx, s.mvz) || 1;
        const dx = s.mvx / dl, dz = s.mvz / dl;
        const st = 0.17 * amp;
        P.lfx += dx * sn * st; P.lfz += dz * sn * st; P.lfy += Math.max(0, cs) * 0.1 * amp;
        P.rfx -= dx * sn * st; P.rfz -= dz * sn * st; P.rfy += Math.max(0, -cs) * 0.1 * amp;
        P.py -= Math.abs(Math.sin(s.ph)) * 0.025 * amp;
      }
      // idle bounce
      P.py += Math.sin(performance.now() / 260 + (this.name === 'p2' ? 1 : 0)) * 0.012 * (1 - s.cr);
    }
    // hit reaction springs
    P.pp += s.ln[0]; P.pr += s.ln[1]; P.pw += s.ln[2];
    P.cx += s.ln[0] * 0.6;
    P.hx += s.hd[0]; P.hy += s.hd[1];
    return P;
  }

  applyRig(dt) {
    const s = this.st, P = this.computePose(dt);
    if (this.smooth) {
      const k = Math.min(1, dt * 20);
      this.rx += (s.x - this.rx) * k; this.rz += (s.z - this.rz) * k;
      if (Math.hypot(s.x - this.rx, s.z - this.rz) > 1.5) { this.rx = s.x; this.rz = s.z; }
    } else { this.rx = s.x; this.rz = s.z; }
    this.root.position.set(this.rx, s.y || 0, this.rz);
    this.root.rotation.y = s.yaw;
    this.body.position.set(P.ox, P.lift, P.oz);
    this.body.rotation.set(P.tilt, 0, 0);
    this.pelvis.position.set(0, P.py, 0);
    this.pelvis.rotation.set(P.pp, P.pw, P.pr, 'YXZ');
    this.spine.rotation.set(P.cx * 0.4, P.cy * 0.4, P.cz * 0.4);
    this.chest.rotation.set(P.cx * 0.6, P.cy * 0.6, P.cz * 0.6);
    this.head.rotation.set(P.hx, P.hy, P.hz);
    this.root.updateMatrixWorld(true);

    // legs: targets in body space
    for (const k of ['l', 'r']) {
      const L = this.legs[k];
      const T = tmpV.set(P[k + 'fx'], P[k + 'fy'], P[k + 'fz']);
      this.body.localToWorld(T);
      const pole = tmpV2.set(L.s * 0.18, P.py - 0.3, 1.2);
      this.body.localToWorld(pole);
      solveLimb(L.up, L.lo, T, pole, 0.46, 0.46);
      // keep foot flat in body space
      L.lo.updateMatrixWorld(true);
      this.body.getWorldQuaternion(tmpQ);
      L.lo.getWorldQuaternion(tmpQ2).invert();
      L.foot.quaternion.copy(tmpQ2.multiply(tmpQ));
    }
    // arms: targets relative to the chest position, but in body orientation,
    // so punches fly straight at the opponent whatever the torso twist is
    this.chest.getWorldPosition(_C); this.body.worldToLocal(_C);
    for (const k of ['l', 'r']) {
      const A = this.arms[k];
      const T = tmpV.set(P[k + 'hx'], P[k + 'hy'], P[k + 'hz']).add(_C);
      this.body.localToWorld(T);
      const pole = tmpV2.set(A.s * 0.55, -0.15, -0.25);
      this.chest.localToWorld(pole);
      solveLimb(A.up, A.lo, T, pole, 0.3, 0.32);
    }
    this.root.updateMatrixWorld(true);

    const f = s.flash;
    const g = this.superReady ? 0.25 + 0.2 * Math.sin(performance.now() / 120) : 0;
    const sp = s.act === 'sp' && s.at < 0.45 ? 0.8 : 0;
    for (const m of this.mats) m.emissive.setRGB(f * 0.9 + g + sp, f * 0.25 + g * 0.7 + sp * 0.6, f * 0.15);
    this.blob.position.set(P.ox, 0.005, P.oz);
  }

  // world points of the striking limb: [point, radius]
  strikePoints(limb) {
    if (!this._sp) this._sp = [new THREE.Vector3(), new THREE.Vector3()];
    if (limb[1] === 'h') {
      this.arms[limb[0]].fist.getWorldPosition(this._sp[0]);
      return [[this._sp[0], 0.09]];
    }
    const L = this.legs[limb[0]];
    L.foot.localToWorld(this._sp[0].set(0, -0.04, 0.1));
    L.lo.getWorldPosition(this._sp[1]); // knee: close-range kicks still land
    return [[this._sp[0], 0.12], [this._sp[1], 0.1]];
  }

  hurtZones() {
    if (!this._hz) this._hz = [{ p: new THREE.Vector3(), r: 0.17, z: 'head' }, { p: new THREE.Vector3(), r: 0.24, z: 'chest' }, { p: new THREE.Vector3(), r: 0.21, z: 'belly' }];
    this.head.localToWorld(this._hz[0].p.set(0, 0.14, 0));
    this.chest.localToWorld(this._hz[1].p.set(0, 0.16, 0));
    this.spine.localToWorld(this._hz[2].p.set(0, 0.08, 0));
    return this._hz;
  }

  // hide what would clip into the camera when viewed from this fighter's eyes
  setColor(hex) {
    this.color = hex;
    this.mats[1].color.setHex(hex); this.mats[3].color.setHex(hex);
  }

  setFirstPerson(on) {
    this.head.visible = !on;
    for (const k of ['l', 'r']) for (const m of this.arms[k].sh) m.visible = !on;
  }
}

// Two-bone IK in world space. upper/lower are groups whose rest direction is -Y.
const _S = new THREE.Vector3(), _D = new THREE.Vector3(), _N = new THREE.Vector3(), _E = new THREE.Vector3(), _U = new THREE.Vector3(), _W = new THREE.Vector3();
const _pq = new THREE.Quaternion(), _uq = new THREE.Quaternion();
function solveLimb(upper, lower, target, pole, l1, l2) {
  upper.parent.updateMatrixWorld(true);
  upper.getWorldPosition(_S);
  _D.subVectors(target, _S);
  let d = _D.length();
  if (d < 1e-4) return;
  _D.divideScalar(d);
  d = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.002);
  const a = (l1 * l1 + d * d - l2 * l2) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _N.subVectors(pole, _S);
  _N.addScaledVector(_D, -_N.dot(_D));
  if (_N.lengthSq() < 1e-8) _N.set(0, -1, 0);
  _N.normalize();
  _E.copy(_S).addScaledVector(_D, a).addScaledVector(_N, h);
  _U.subVectors(_E, _S).normalize();
  _W.copy(_S).addScaledVector(_D, d).sub(_E).normalize();
  upper.parent.getWorldQuaternion(_pq);
  _pq.invert();
  upper.quaternion.setFromUnitVectors(DOWN, _U.clone().applyQuaternion(_pq));
  _uq.copy(_pq).invert().multiply(upper.quaternion).invert();
  lower.quaternion.setFromUnitVectors(DOWN, _W.applyQuaternion(_uq));
}
