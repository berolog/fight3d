import { ACTS, ATTACKS, RING_R } from './fighter.js?v=7';

const LEVELS = {
  easy: { react: 0.28, defend: 0.25, aggr: 0.9, combo: 0.15 },
  normal: { react: 0.16, defend: 0.5, aggr: 1.6, combo: 0.4 },
  hard: { react: 0.09, defend: 0.75, aggr: 2.4, combo: 0.7 },
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class AI {
  constructor(level = 'normal') {
    this.cfg = LEVELS[level] || LEVELS.normal;
    this.plan = { mf: 0, ms: 0 };
    this.planT = 0;
    this.holdBlock = 0; this.holdCrouch = 0;
    this.seenAttack = null;
    this.cool = 0.6;
    this.lastHit = 0;
  }

  think(dt, me, opp) {
    const c = this.cfg, s = me.st, o = opp.st;
    const inp = { mf: 0, ms: 0, block: false, crouch: false, press: {} };
    const d = Math.hypot(o.x - s.x, o.z - s.z);
    this.planT -= dt; this.cool -= dt;
    this.holdBlock -= dt; this.holdCrouch -= dt;

    // defence: react to an incoming attack
    const oa = ACTS[o.act];
    if (oa && oa.limb && d < 1.6) {
      const key = o.act + ':' + Math.round(o.x * 100);
      if (this.seenAttack !== key && o.at >= Math.min(c.react, oa.on * 0.9)) {
        this.seenAttack = key;
        if (Math.random() < c.defend && !me.busy) {
          const r = Math.random();
          const punch = o.act === 'lp' || o.act === 'rp';
          if (oa.unblock) inp.press[o.act === 'hl' ? 'dr' : 'dl'] = 1; // hooks: dodge away from the swinging hand
          else if (punch && r < 0.3) this.holdCrouch = 0.45;
          else if (r < 0.75) this.holdBlock = 0.5 + Math.random() * 0.3;
          else inp.press[Math.random() < 0.5 ? 'dl' : 'dr'] = 1;
        }
      }
    } else if (!oa) this.seenAttack = null;

    // when hurt, sometimes retreat
    if (s.act === 'hit' && Math.random() < 0.02) { this.plan = { mf: -1, ms: 0 }; this.planT = 0.5; }

    if (this.holdBlock > 0) { inp.block = true; return inp; }
    if (this.holdCrouch > 0) {
      inp.crouch = true;
      // punish from crouch with an uppercut
      if (d < 1.05 && !oa && Math.random() < c.aggr * dt * 2) { inp.press.rp = 1; this.holdCrouch = 0; }
      return inp;
    }
    if (opp.downed) {
      if (d < 1.8) inp.mf = -1;
      return inp;
    }

    // offence
    const lowHp = s.hp < 30 && o.hp > s.hp;
    const myR = Math.hypot(s.x, s.z), opR = Math.hypot(o.x, o.z);
    if (me.superReady && d < 1.1 && !me.busy && (opp.isCounterable() || Math.random() < c.aggr * dt)) {
      inp.press.sp = 1; return inp;
    }
    // a turtle gets hooked through the guard
    if (d < 1.0 && !me.busy && o.blk > 0.5 && Math.random() < c.aggr * dt * 2.5) {
      inp.press[pick(['hl', 'hr'])] = 1; this.cool = 0.5; return inp;
    }
    if (d < 1.12 && !me.busy && this.cool <= 0 && Math.random() < c.aggr * dt * 3) {
      let a;
      if (o.cr > 0.5) a = pick(['lk', 'rk']);
      else if (opR > RING_R - 1.2) a = pick(['lk', 'lk', 'rk']); // push them off the edge
      else if (d > 1.0) a = pick(['lk', 'rk', 'rp']);
      else a = pick(['lp', 'lp', 'rp', 'rp', 'lk', 'rk', 'hl', 'hr']);
      inp.press[a] = 1;
      this.combo = Math.random() < c.combo ? pick(['lp', 'rp', 'rk']) : null;
      this.cool = 0.15 + Math.random() * (0.8 / c.aggr);
      return inp;
    }
    // follow-up while previous attack recovers (buffered)
    if (this.combo && me.busy && ATTACKS.includes(s.act) && s.hasHit && s.at > ACTS[s.act].off) {
      inp.press[this.combo] = 1; this.combo = null;
    }

    if (this.planT <= 0) {
      this.planT = 0.25 + Math.random() * 0.5;
      const r = Math.random();
      if (d > 1.25) this.plan = { mf: 1, ms: r < 0.2 ? pick([1, -1]) : 0 };
      else if (d < 0.8 || (lowHp && r < 0.4)) this.plan = { mf: -1, ms: 0 };
      else if (r < 0.25) this.plan = { mf: 0, ms: pick([1, -1]) };
      else if (r < 0.4) { this.plan = { mf: 0, ms: 0 }; this.holdBlock = 0.4; }
      else if (r < 0.55) this.plan = { mf: -1, ms: 0 };
      else this.plan = { mf: 1, ms: 0 };
    }
    // back to the edge: circle away from it instead of retreating
    if (myR > RING_R - 0.9 && this.plan.mf < 0) this.plan = { mf: 0.5, ms: this.plan.ms || pick([1, -1]) };
    inp.mf = this.plan.mf; inp.ms = this.plan.ms;
    return inp;
  }
}
