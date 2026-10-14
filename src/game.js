import * as THREE from 'three';
import { ACTS, RING_R } from './fighter.js?v=7';

const START_X = 1.4;
export const ROUND_TIME = 60;

// Authoritative simulation: runs in single-player and on the online host.
export class Game {
  constructor(fighters) {
    this.f = fighters;
    this.events = [];
    this.hitstop = 0;
    this.rs = { ph: 'intro', t: 0, n: 1, sc: [0, 0], w: -1, tm: ROUND_TIME, why: '', dur: 4 };
    this.resetRound();
  }

  idx(f) { return this.f.indexOf(f); }
  event(e) { this.events.push(e); }

  resetRound() {
    this.f[0].reset(-START_X, 0, Math.PI / 2);
    this.f[1].reset(START_X, 0, -Math.PI / 2);
    Object.assign(this.rs, { ph: 'intro', t: 0, w: -1, tm: ROUND_TIME, why: '' });
  }

  newMatch() {
    this.rs.sc = [0, 0]; this.rs.n = 1;
    this.resetRound();
  }

  // w: winner index or -1 for a draw; why: 'ko' | 'out' | 'time'
  endRound(w, why) {
    const rs = this.rs;
    if (rs.ph !== 'fight') return;
    Object.assign(rs, { ph: 'ko', t: 0, w, why, dur: why === 'time' ? 3.5 : 6.4 });
    if (w >= 0) rs.sc[w]++;
    this.event({ t: 'ko', w, why });
  }

  step(dt, inputs) {
    const rs = this.rs;
    rs.t += dt;
    if (rs.ph === 'intro' && rs.t > 1.8) { rs.ph = 'fight'; rs.t = 0; this.event({ t: 'go' }); }
    if (rs.ph === 'ko' && rs.t > rs.dur) { rs.n++; this.resetRound(); }

    if (this.hitstop > 0) { this.hitstop -= dt; return; }

    const [a, b] = this.f;
    if (rs.ph === 'fight') {
      rs.tm = Math.max(0, rs.tm - dt);
      if (rs.tm <= 0) {
        const d = a.st.hp - b.st.hp;
        this.endRound(Math.abs(d) < 0.5 ? -1 : d > 0 ? 0 : 1, 'time');
      }
    }
    const idle = {};
    const ia = rs.ph === 'fight' ? inputs[0] : idle;
    const ib = rs.ph === 'fight' ? inputs[1] : idle;
    a.step(dt, ia, b, this);
    b.step(dt, ib, a, this);

    // body separation
    const dx = b.st.x - a.st.x, dz = b.st.z - a.st.z;
    const d = Math.hypot(dx, dz) || 0.001, MIN = 0.7;
    if (d < MIN && !a.downed && !b.downed && !a.st.out && !b.st.out) {
      const push = (MIN - d) / 2, nx = dx / d, nz = dz / d;
      a.st.x -= nx * push; a.st.z -= nz * push;
      b.st.x += nx * push; b.st.z += nz * push;
    }
    this.ring(a); this.ring(b);

    a.applyRig(dt); b.applyRig(dt);
    this.checkHit(a, b);
    this.checkHit(b, a);
  }

  // You can't walk off the ring, but a knockback can throw you out of it.
  ring(f) {
    const s = f.st;
    if (s.out) return;
    const r = Math.hypot(s.x, s.z);
    if (r <= RING_R) return;
    if (f.knocked && Math.hypot(s.kx, s.kz) > 0.6) {
      s.out = 1; s.vy = 1.2;
      if (s.act !== 'ko') f.startAct('ko');
      this.endRound(1 - this.idx(f), 'out');
      this.event({ t: 'out', i: this.idx(f) });
    } else {
      s.x *= RING_R / r; s.z *= RING_R / r;
    }
  }

  checkHit(att, def) {
    const atk = att.activeAttack();
    if (!atk || def.downed || def.st.out) return;
    for (const [p, sr] of att.strikePoints(atk.limb, atk.unblock)) {
      for (const z of def.hurtZones()) {
        if (p.distanceTo(z.p) < sr + z.r) { this.resolve(att, def, atk, z.z, p); return; }
      }
    }
  }

  damage(att, def, dmg, counter) {
    const as = att.st, ds = def.st;
    // a series continues while hits keep landing within a short window
    as.cmb = as.cmbT > 0 ? as.cmb + 1 : 1;
    as.cmbT = 0.9;
    ds.cmb = 0; ds.cmbT = 0;
    ds.hp = Math.max(0, ds.hp - dmg);
    ds.rg = Math.min(100, ds.rg + dmg * 1.6); // rage builds from damage taken
  }

  koBy(att, def) {
    def.startAct('ko');
    this.endRound(this.idx(att), 'ko');
  }

  resolve(att, def, a, zone, p) {
    const as = att.st, ds = def.st;
    as.hasHit = 1;
    const afx = Math.sin(as.yaw), afz = Math.cos(as.yaw), alx = afz, alz = -afx;
    const kx = afx * a.push[0] + alx * a.push[1], kz = afz * a.push[0] + alz * a.push[1];
    const tx = as.x - ds.x, tz = as.z - ds.z, tl = Math.hypot(tx, tz) || 1;
    const facing = (Math.sin(ds.yaw) * tx + Math.cos(ds.yaw) * tz) / tl;
    const pos = [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)];

    const guarding = (ds.blk > 0.5 && !ds.act) || ds.act === 'bs';
    if (guarding && facing > 0.3 && !a.super && !a.unblock) {
      ds.hp = Math.max(1, ds.hp - a.dmg * 0.12);
      ds.rg = Math.min(100, ds.rg + 2);
      ds.kx += kx * 0.45; ds.kz += kz * 0.45;
      ds.lv[0] -= 0.4 * a.push[0] / 2;
      as.kx -= afx * 1.0; as.kz -= afz * 1.0;
      // block stun: punches are about even on block, kicks leave the attacker slightly open
      const rest = a.dur - a.off;
      def.startAct('bs', Math.max(0.08, rest - (a.heavy ? 0.14 : 0.03)));
      this.hitstop = 0.05;
      this.event({ t: 'blk', p: pos, h: a.heavy ? 1 : 0 });
      return;
    }

    const counter = def.isCounterable();
    const dmg = a.dmg * (zone === 'head' ? 1.15 : 1) * (counter ? 1.35 : 1) * (guarding && a.super ? 0.6 : 1);
    this.damage(att, def, dmg, counter);
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
      ds.kx += kx * 0.5; ds.kz += kz * 0.5;
      this.koBy(att, def);
      heavy = true;
    } else if ((a.heavy && (ds.stag > 70 || counter)) || ds.stag > 100) {
      def.startAct('down'); ds.stag = 0;
      ds.kx += kx * 0.3; ds.kz += kz * 0.3;
    } else {
      def.startAct('hit', a.stun);
    }
    this.hitstop = a.super ? 0.25 : heavy ? 0.13 : 0.06;
    this.event({ t: 'hit', i: this.idx(def), p: pos, h: heavy ? 1 : 0, c: counter ? 1 : 0, z: zone, d: Math.round(dmg), cb: as.cmb, s: a.super ? 1 : 0, gb: guarding ? 1 : 0 });
  }

  snapshot() {
    return { t: 's', r: this.rs, s: [this.f[0].st, this.f[1].st] };
  }
}

export { ACTS };
