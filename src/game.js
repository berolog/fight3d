import * as THREE from 'three';
import { ACTS } from './fighter.js';

const START_X = 1.4;

// Authoritative simulation: runs in single-player and on the online host.
export class Game {
  constructor(fighters) {
    this.f = fighters;
    this.events = [];
    this.hitstop = 0;
    this.rs = { ph: 'intro', t: 0, n: 1, sc: [0, 0], w: -1 };
    this.resetRound();
  }

  idx(f) { return this.f.indexOf(f); }
  event(e) { this.events.push(e); }

  resetRound() {
    this.f[0].reset(-START_X, 0, Math.PI / 2);
    this.f[1].reset(START_X, 0, -Math.PI / 2);
    this.rs.ph = 'intro'; this.rs.t = 0; this.rs.w = -1;
  }

  newMatch() {
    this.rs.sc = [0, 0]; this.rs.n = 1;
    this.resetRound();
  }

  step(dt, inputs) {
    const rs = this.rs;
    rs.t += dt;
    if (rs.ph === 'intro' && rs.t > 1.8) { rs.ph = 'fight'; rs.t = 0; this.event({ t: 'go' }); }
    if (rs.ph === 'ko' && rs.t > 3.8) { rs.n++; this.resetRound(); }

    if (this.hitstop > 0) { this.hitstop -= dt; return; }

    const [a, b] = this.f;
    const idle = {};
    const ia = rs.ph === 'fight' ? inputs[0] : idle;
    const ib = rs.ph === 'fight' ? inputs[1] : idle;
    a.step(dt, ia, b, this);
    b.step(dt, ib, a, this);

    // body separation
    const dx = b.st.x - a.st.x, dz = b.st.z - a.st.z;
    const d = Math.hypot(dx, dz) || 0.001, MIN = 0.7;
    if (d < MIN && !a.downed && !b.downed) {
      const push = (MIN - d) / 2, nx = dx / d, nz = dz / d;
      a.st.x -= nx * push; a.st.z -= nz * push;
      b.st.x += nx * push; b.st.z += nz * push;
    }

    a.applyRig(dt); b.applyRig(dt);
    this.checkHit(a, b);
    this.checkHit(b, a);
  }

  checkHit(att, def) {
    const atk = att.activeAttack();
    if (!atk || def.downed) return;
    for (const [p, sr] of att.strikePoints(atk.limb)) {
      for (const z of def.hurtZones()) {
        if (p.distanceTo(z.p) < sr + z.r) { this.resolve(att, def, atk, z.z, p); return; }
      }
    }
  }

  resolve(att, def, a, zone, p) {
    const as = att.st, ds = def.st;
    as.hasHit = 1;
    const afx = Math.sin(as.yaw), afz = Math.cos(as.yaw), alx = afz, alz = -afx;
    const kx = afx * a.push[0] + alx * a.push[1], kz = afz * a.push[0] + alz * a.push[1];
    const tx = as.x - ds.x, tz = as.z - ds.z, tl = Math.hypot(tx, tz) || 1;
    const facing = (Math.sin(ds.yaw) * tx + Math.cos(ds.yaw) * tz) / tl;
    const pos = [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)];

    if (ds.blk > 0.5 && !ds.act && facing > 0.3) {
      ds.hp = Math.max(1, ds.hp - a.dmg * 0.12);
      ds.kx += kx * 0.45; ds.kz += kz * 0.45;
      ds.lv[0] -= 0.4 * a.push[0] / 2;
      as.kx -= afx * 1.0; as.kz -= afz * 1.0;
      this.hitstop = 0.05;
      this.event({ t: 'blk', p: pos, h: a.heavy ? 1 : 0 });
      return;
    }

    const counter = def.isCounterable();
    let dmg = a.dmg * (zone === 'head' ? 1.15 : 1) * (counter ? 1.35 : 1);
    ds.hp = Math.max(0, ds.hp - dmg);
    ds.kx += kx; ds.kz += kz;
    const dfx = Math.sin(ds.yaw), dfz = Math.cos(ds.yaw), dlx = dfz, dlz = -dfx;
    const kf = kx * dfx + kz * dfz, kl = kx * dlx + kz * dlz;
    const hz = zone === 'head' ? 1.5 : 0.6;
    ds.lv[0] += kf * 1.5;
    ds.lv[1] += -kl * 1.1;
    ds.lv[2] += kl * 0.8;
    ds.hv[0] += kf * 2.4 * hz;
    ds.hv[1] += kl * 2.2 * hz + (Math.random() - 0.5) * 2;
    ds.stag += a.stag * (counter ? 1.5 : 1);
    ds.flash = 1; ds.blk = 0; ds.cr = 0; ds.buf = '';

    let heavy = !!a.heavy;
    if (ds.hp <= 0) {
      def.startAct('ko');
      ds.kx += kx * 0.5; ds.kz += kz * 0.5;
      this.rs.ph = 'ko'; this.rs.t = 0; this.rs.w = this.idx(att);
      this.rs.sc[this.rs.w]++;
      heavy = true;
      this.event({ t: 'ko', w: this.rs.w });
    } else if ((a.heavy && (ds.stag > 70 || counter)) || ds.stag > 100) {
      def.startAct('down'); ds.stag = 0;
      ds.kx += kx * 0.3; ds.kz += kz * 0.3;
    } else {
      def.startAct('hit', a.stun);
    }
    this.hitstop = heavy ? 0.13 : 0.06;
    this.event({ t: 'hit', p: pos, h: heavy ? 1 : 0, c: counter ? 1 : 0, z: zone, d: Math.round(dmg) });
  }

  snapshot() {
    return { t: 's', r: this.rs, s: [this.f[0].st, this.f[1].st] };
  }
}

export { ACTS };
