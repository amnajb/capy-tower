// Seeded tower layout. A platform depends only on (seed, map, floor number),
// so every racer gets an identical tower and floors can be built lazily in
// any order as the camera climbs.
import { VIEW_W, WALL_W } from './world.js';
import { MAPS } from './maps.js';

const PLAY_L = WALL_W, PLAY_R = VIEW_W - WALL_W, PLAY_W = PLAY_R - PLAY_L;

// integer hash -> [0,1)
export function hash01(seed, n, salt) {
  let h = (seed ^ Math.imul(n + 0x9e3779b9 | 0, 0x85ebca6b) ^ Math.imul(salt, 0xc2b2ae35)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Floors narrow as the tower climbs, in steps like Icy Tower: every 50 floors
// the widest a platform can be shrinks, down to a floor of 70 px.
export function widthRange(n) {
  const step = Math.floor(n / 50);
  const max = Math.max(110, 250 - step * 28);
  const min = Math.max(70, 150 - step * 16);
  return [min, max];
}

export class Tower {
  constructor(seed, map = MAPS[0]) {
    this.seed = seed | 0;
    this.map = map;
    this.summit = map.summit;
    this.cache = new Map();
  }
  isFullWidth(n) { return n === 0 || n % 50 === 0 || n === this.summit; }
  platform(n) {
    if (this.summit !== null && n > this.summit) return null;
    let p = this.cache.get(n);
    if (p) return p;
    if (this.isFullWidth(n)) {
      p = { n, x0: PLAY_L, x1: PLAY_R, kind: n === this.summit ? 'summit' : 'normal' };
    } else {
      const [min, max] = widthRange(n);
      let w = Math.round(min + hash01(this.seed, n, 1) * (max - min));
      const r = hash01(this.seed, n, 2);
      let x0 = PLAY_L + r * (PLAY_W - w);
      if (hash01(this.seed, n, 3) < 0.12) x0 = r < 0.5 ? PLAY_L : PLAY_R - w;
      p = { n, x0: Math.round(x0), x1: Math.round(x0 + w), kind: 'normal' };
      if (n >= 4) this.decorate(p, n);
    }
    this.cache.set(n, p);
    if (this.cache.size > 400) {
      for (const k of this.cache.keys()) if (k < n - 60) this.cache.delete(k);
    }
    return p;
  }

  // pick a special platform kind for this map (deterministic per floor)
  decorate(p, n) {
    const m = this.map.mech, roll = hash01(this.seed, n, 4), sub = hash01(this.seed, n, 5);
    let acc = 0;
    const pick = k => { acc += m[k] || 0; return roll < acc; };
    if (pick('geyser')) {
      p.kind = 'geyser';
      p.period = 3.2 + sub * 1.2;          // seconds per eruption cycle
      p.phase = hash01(this.seed, n, 6) * p.period;
    } else if (pick('jelly')) {
      p.kind = 'jelly';
    } else if (pick('cloud')) {
      p.kind = 'cloud';
      const w = p.x1 - p.x0;
      p.bx = (PLAY_L + PLAY_R) / 2 - w / 2;   // drift around the middle
      p.amp = Math.min(110, (PLAY_W - w) / 2 - 4);
      p.period = 3.5 + sub * 2.5;
      p.phase = hash01(this.seed, n, 6) * Math.PI * 2;
      p.dx = 0;
    } else if (pick('conveyor')) {
      p.kind = 'conveyor';
      p.dir = sub < 0.5 ? -1 : 1;
    } else if (pick('spring')) {
      p.kind = 'spring';
      p.x1 = Math.min(p.x1, p.x0 + 120);   // springs are compact pads
    }
    if (p.kind !== 'normal') p.fx = { warn: 0, erupt: 0, squish: 0, spring: 0 };
  }
}
