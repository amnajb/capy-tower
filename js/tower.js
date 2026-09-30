// Seeded tower layout. A platform depends only on (seed, floor number), so
// every racer gets an identical tower and floors can be built lazily in any
// order as the camera climbs.
import { VIEW_W, WALL_W } from './world.js';

const PLAY_L = WALL_W, PLAY_R = VIEW_W - WALL_W, PLAY_W = PLAY_R - PLAY_L;

// integer hash -> [0,1)
function hash01(seed, n, salt) {
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
  constructor(seed) {
    this.seed = seed | 0;
    this.cache = new Map();
  }
  isFullWidth(n) { return n === 0 || n % 50 === 0; }
  platform(n) {
    let p = this.cache.get(n);
    if (p) return p;
    if (this.isFullWidth(n)) {
      p = { n, x0: PLAY_L, x1: PLAY_R };
    } else {
      const [min, max] = widthRange(n);
      const w = Math.round(min + hash01(this.seed, n, 1) * (max - min));
      // keep consecutive floors from stacking perfectly so there is always a
      // line to jump through, and let some platforms hug a wall
      const r = hash01(this.seed, n, 2);
      let x0 = PLAY_L + r * (PLAY_W - w);
      if (hash01(this.seed, n, 3) < 0.12) x0 = r < 0.5 ? PLAY_L : PLAY_R - w;
      p = { n, x0: Math.round(x0), x1: Math.round(x0 + w) };
    }
    this.cache.set(n, p);
    if (this.cache.size > 400) {
      // drop floors far below whatever was just asked for
      for (const k of this.cache.keys()) if (k < n - 60) this.cache.delete(k);
    }
    return p;
  }
}
