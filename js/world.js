// ============================================================================
//  Capy Tower — world art: tower interior, windows to the outside, platforms.
//  Cel-shaded: flat fill + one hard shadow tone + highlight, dark ink outlines.
//
//  Everything static (wall tiles, side-wall tiles, platform strips, outside
//  landscapes, decor sprites) is painted once per theme into offscreen
//  canvases at RES x and blitted with drawImage; per frame only the cheap
//  animated bits (flames, neon, lava glow, embers) are drawn as paths.
//  All drawing is in logical pixels (480 x 720); see CONTRACT.md.
// ============================================================================

export const VIEW_W = 480, VIEW_H = 720;
export const WALL_W = 36, FLOOR_GAP = 84, PLAT_H = 18;
export const THEME_SPAN = 50;                 // floors per theme

const INK = '#1f1612';
const RES = 2;                                // offscreen canvases are painted at 2x
const TILE_H = 168;                           // wall tiles repeat every 2 floors
const ROW_H = 252;                            // window/decor rows: every 3 floors
const BAND = 2 * FLOOR_GAP;                   // crossfade half-width at a theme boundary
const LAND_H = 220;                           // outside landscape strip height
const FONT = "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif";

// ------------------------------------------------------------------ helpers
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
function hash(a, b = 0) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x3c6ef372, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgb(a) { return `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`; }
function mixC(a, b, t) { const A = hex(a), B = hex(b); return rgb([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]); }
function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * RES); c.height = Math.ceil(h * RES);
  const g = c.getContext('2d');
  g.scale(RES, RES); g.lineJoin = 'round'; g.lineCap = 'round';
  return { c, g, w, h };
}
function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function inked(g, fill, lw = 2, ink = INK) {
  g.fillStyle = fill; g.fill();
  g.lineWidth = lw; g.strokeStyle = ink; g.stroke();
}
// draw fn at y and wrapped copies so a feature crossing the tile seam tiles
function wrapY(H, y, reach, fn) {
  fn(y);
  if (y - reach < 0) fn(y + H);
  if (y + reach > H) fn(y - H);
}
const sy = (wy, camY) => VIEW_H - (wy - camY);

// ------------------------------------------------------------------ bricks
// staggered cel bricks: mortar, flat face, hard shadow on bottom/right, hi on top
function bricks(g, W, H, bw, bh, o, r) {
  g.fillStyle = o.mortar; g.fillRect(0, 0, W, H);
  const rows = Math.round(H / bh);
  for (let row = 0; row < rows; row++) {
    const y = row * bh, off = (row % 2) ? bw / 2 : 0;
    for (let x = -bw + off; x < W; x += bw) {
      const col = o.base[(r() * o.base.length) | 0];
      const m = o.gap || 1.5;
      g.fillStyle = col; g.fillRect(x + m, y + m, bw - 2 * m, bh - 2 * m);
      const s = o.sh || 3;
      g.fillStyle = o.shadow;
      g.fillRect(x + m, y + bh - m - s, bw - 2 * m, s);
      g.fillRect(x + bw - m - s, y + m, s, bh - 2 * m);
      if (o.hi) { g.fillStyle = o.hi; g.fillRect(x + m + 2, y + m + 1, bw - 2 * m - s - 5, 2); }
    }
  }
}

// ======================================================= theme definitions
// Each theme: palette + painters. Painters draw into offscreen canvases once.
const THEME_DEFS = [
  { id: 'riverbank', name: 'Riverbank Keep', accent: '#7cc04f', frame: '#9ea1a8', frameDk: '#6d7079',
    sign: '#b98a52', signDk: '#8a5f33', signText: '#fff3da', banner: '#4f8f3a', bannerTrim: '#ffd166',
    decor: ['torch', 'banner', 'portrait', 'vine', 'torch', 'vine'] },
  { id: 'dojo', name: 'Bamboo Dojo', accent: '#e4553f', frame: '#7a4424', frameDk: '#56301a',
    sign: '#d9b36a', signDk: '#a07c3c', signText: '#3a200f', banner: '#c83a2e', bannerTrim: '#ffd166',
    decor: ['lantern', 'banner', 'portrait', 'lantern', 'scroll'] },
  { id: 'frost', name: 'Frost Spire', accent: '#8fe6ff', frame: '#dff4fb', frameDk: '#9fd0e6',
    sign: '#cfe9f5', signDk: '#8ab8d0', signText: '#1f4a66', banner: '#3a86c8', bannerTrim: '#e8f7ff',
    decor: ['bluetorch', 'shield', 'portrait', 'banner', 'bluetorch'] },
  { id: 'lava', name: 'Lava Forge', accent: '#ff7a1f', frame: '#4a4250', frameDk: '#2c2631',
    sign: '#5a5260', signDk: '#39323f', signText: '#ffb03a', banner: '#8f2a22', bannerTrim: '#ff9a2e',
    decor: ['torch', 'chain', 'gear', 'banner', 'torch'] },
  { id: 'neon', name: 'Neon Night', accent: '#ff3fd0', frame: '#5b6475', frameDk: '#3b4150',
    sign: '#2a2f3d', signDk: '#161a24', signText: '#7ff3ff', banner: '#2a2f3d', bannerTrim: '#ff3fd0',
    decor: ['neon', 'graffiti', 'neon', 'vent', 'graffiti'] },
  { id: 'gingersnap', name: 'Gingersnap Hall', accent: '#ff7eb6', frame: '#f7efe6', frameDk: '#d9c8b8',
    sign: '#c07a3e', signDk: '#8f5427', signText: '#fff6ec', banner: '#ff7eb6', bannerTrim: '#fff6ec',
    decor: ['lollipop', 'wreath', 'portrait', 'banner', 'lollipop'] },
  { id: 'starlight', name: 'Starlight Top', accent: '#8fe6ff', frame: '#6f5ad6', frameDk: '#4a3aa0',
    sign: '#3b2f70', signDk: '#241c4a', signText: '#bff6ff', banner: '#5a3ec8', bannerTrim: '#8fe6ff',
    decor: ['crystal', 'orb', 'portrait', 'banner', 'crystal'] },
  // ---- map towers (v3): single-world towers with a summit; see CONTRACT.md
  { id: 'onsen', name: 'Sakura Springs', accent: '#ff8fb8', frame: '#6b4228', frameDk: '#46281a',
    sign: '#e9c58e', signDk: '#a97b42', signText: '#5a2e14', banner: '#d64a5a', bannerTrim: '#ffe2ec',
    decor: ['chochin', 'blossom', 'noren', 'tub', 'blossom', 'onsensign'], win: 'rect' },
  { id: 'reef', name: 'Coral Reef Spire', accent: '#5fd6e8', frame: '#d9a63a', frameDk: '#9a6e1e',
    sign: '#f6e2b8', signDk: '#c9a46a', signText: '#1f5f7a', banner: '#2f8fb5', bannerTrim: '#ffd6a0',
    decor: ['kelp', 'shell', 'starfish', 'chest', 'kelp', 'anchor'], win: 'round', water: true },
  { id: 'sky', name: 'Cloud Carnival', accent: '#9fd0ff', frame: '#e8384f', frameDk: '#a8202f',
    sign: '#fff1c8', signDk: '#d6b25a', signText: '#c8283c', banner: '#e8384f', bannerTrim: '#fff6ec',
    decor: ['balloons', 'pennant', 'bulbs', 'ticket', 'balloons'], win: 'none', open: true },
  { id: 'toys', name: 'Clockwork Toybox', accent: '#ffd166', frame: '#f2b63c', frameDk: '#b07e22',
    sign: '#fbe7b0', signDk: '#c99a3a', signText: '#2a4fb5', banner: '#3a6fd8', bannerTrim: '#ffd166',
    decor: ['shelf', 'soldier', 'biggear', 'windkey', 'crayons', 'biggear'], win: 'arch', indoor: true },
];

export const THEMES = THEME_DEFS.map(t => ({ id: t.id, name: t.name, accent: t.accent }));

// Which towers' themes are in play. Classic = all seven, cycling every 50
// floors; a map tower is one theme with a summit. game.js sets this per run.
const CLASSIC_THEMES = [0, 1, 2, 3, 4, 5, 6];
let MAP = { themes: CLASSIC_THEMES, span: THEME_SPAN, summit: null };
export function setWorldMap(m = {}) {
  MAP = {
    themes: m.themes && m.themes.length ? m.themes.slice() : CLASSIC_THEMES,
    span: m.span || THEME_SPAN,
    summit: m.summit == null ? null : m.summit,
  };
}
export function themeIndexForFloor(n) {
  const L = MAP.themes;
  return L[Math.floor(Math.max(0, n) / MAP.span) % L.length];
}
// the sky runs day -> sunset -> night -> stars over the summit height on a
// map tower (summit = starry night), over the classic floors otherwise
const skyFloor = f => MAP.summit ? f * 240 / MAP.summit : f;
const summitY = () => MAP.summit == null ? Infinity : MAP.summit * FLOOR_GAP;
function themeAtY(wy) { return themeIndexForFloor(Math.floor(wy / FLOOR_GAP)); }

// ------------------------------------------------------- back wall tiles
function paintBack(i) {
  const T = mk(VIEW_W, TILE_H), g = T.g, W = VIEW_W, H = TILE_H, r = rng(101 + i);
  switch (i) {
    case 0: {                                                     // grey stone, moss
      bricks(g, W, H, 56, 28, { mortar: '#5f626b', base: ['#8c8f97', '#878a92', '#92959c', '#80838b'],
        shadow: '#6e717a', hi: '#a6a9b0' }, r);
      for (let k = 0; k < 6; k++) {
        const x = r() * W, y = Math.round(r() * 6) * 28 - 3, n = 3 + (r() * 3 | 0);
        wrapY(H, y, 16, yy => {
          for (let j = 0; j < n; j++) {
            g.fillStyle = j % 2 ? '#5f8a3e' : '#71a04a';
            g.beginPath(); g.ellipse(x + (j - n / 2) * 5, yy + (j % 2) * 3, 5, 3.5, 0, 0, 7); g.fill();
          }
        });
      }
      break;
    }
    case 1: {                                                     // bamboo planks + beams
      const pw = 24;
      for (let x = 0; x < W; x += pw) {
        g.fillStyle = ['#c9955a', '#c08c52', '#cf9b60', '#c4905a'][(r() * 4) | 0];
        g.fillRect(x, 0, pw, H);
        g.fillStyle = '#a8743f'; g.fillRect(x + pw - 5, 0, 3, H);
        g.fillStyle = '#8a5a2e'; g.fillRect(x + pw - 2, 0, 2, H);
        g.fillStyle = '#dcae74'; g.fillRect(x + 2, 0, 2, H);
        g.strokeStyle = 'rgba(138,90,46,.45)'; g.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          const gx = x + 6 + r() * (pw - 12), y0 = r() * H;
          g.beginPath(); g.moveTo(gx, y0); g.quadraticCurveTo(gx + 3, y0 + 20, gx, y0 + 40); g.stroke();
        }
      }
      // shoji band + beam every tile
      g.fillStyle = '#f3ead2'; g.fillRect(0, 96, W, 44);
      g.strokeStyle = '#7a4424'; g.lineWidth = 3;
      for (let x = 0; x <= W; x += 30) { g.beginPath(); g.moveTo(x, 96); g.lineTo(x, 140); g.stroke(); }
      g.beginPath(); g.moveTo(0, 118); g.lineTo(W, 118); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 98, W, 4);
      for (const by of [0, 140]) {
        g.fillStyle = '#6b3a1d'; g.fillRect(0, by, W, 14);
        g.fillStyle = '#8a4f28'; g.fillRect(0, by + 2, W, 4);
        g.fillStyle = '#4a2512'; g.fillRect(0, by + 11, W, 3);
        g.fillStyle = INK; g.fillRect(0, by, W, 1.5); g.fillRect(0, by + 12.5, W, 1.5);
      }
      break;
    }
    case 2: {                                                     // ice bricks
      bricks(g, W, H, 60, 28, { mortar: '#86bcd6', base: ['#bfe6f5', '#b3dff2', '#c9ecf8', '#b8e2f3'],
        shadow: '#94c9e0', hi: '#effbff' }, r);
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.5;
      for (let k = 0; k < 26; k++) {
        const x = r() * W, y = 4 + r() * (H - 8);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 7, y - 7); g.stroke();
        if (r() > .5) { g.beginPath(); g.moveTo(x + 4, y + 1); g.lineTo(x + 8, y - 3); g.stroke(); }
      }
      break;
    }
    case 3: {                                                     // basalt + glowing cracks
      bricks(g, W, H, 48, 42, { mortar: '#1d1822', base: ['#453c4c', '#3f3746', '#4a4152', '#41394a'],
        shadow: '#2e2835', hi: '#5a5063', gap: 2, sh: 4 }, r);
      for (let k = 0; k < 4; k++) {
        const x = r() * W, y = r() * H;
        const pts = [[x, y]];
        for (let j = 0; j < 5; j++) { const p = pts[pts.length - 1]; pts.push([p[0] + (r() - .5) * 26, p[1] + 6 + r() * 10]); }
        wrapY(H, y, 70, yy => {
          const d = yy - y;
          for (const [lw, c] of [[4, 'rgba(255,106,26,.22)'], [1.8, '#d9661f'], [.8, '#ffb35a']]) {
            g.strokeStyle = c; g.lineWidth = lw; g.beginPath();
            pts.forEach((p, j) => j ? g.lineTo(p[0], p[1] + d) : g.moveTo(p[0], p[1] + d)); g.stroke();
          }
        });
      }
      break;
    }
    case 4: {                                                     // city bricks + pipe
      bricks(g, W, H, 32, 14, { mortar: '#2e1a24', base: ['#6f3539', '#7a3b3f', '#66303a', '#733a3c'],
        shadow: '#52262c', hi: '#8c4a4b', gap: 1, sh: 2 }, r);
      for (const px of [118, 356]) {
        g.fillStyle = '#4a5160'; g.fillRect(px, 0, 14, H);
        g.fillStyle = '#6b7385'; g.fillRect(px + 2, 0, 3, H);
        g.fillStyle = '#353a46'; g.fillRect(px + 10, 0, 4, H);
        g.fillStyle = INK; g.fillRect(px - 1, 0, 1.5, H); g.fillRect(px + 13.5, 0, 1.5, H);
        for (const by of [30, 114]) {
          g.fillStyle = '#7b8396'; g.fillRect(px - 3, by, 20, 7);
          g.lineWidth = 1.5; g.strokeStyle = INK; g.strokeRect(px - 3, by, 20, 7);
        }
      }
      break;
    }
    case 5: {                                                     // gingerbread + icing lattice
      g.fillStyle = '#b8743d'; g.fillRect(0, 0, W, H);
      for (let k = 0; k < 260; k++) {
        g.fillStyle = r() > .5 ? '#a4652f' : '#c98a4f';
        g.beginPath(); g.arc(r() * W, r() * H, 1 + r() * 1.6, 0, 7); g.fill();
      }
      const P = 56;
      for (const dir of [1, -1]) {
        for (let c = -H - P; c < W + H + P; c += P) {
          const line = (lw, col) => {
            g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
            for (let y = -4; y <= H + 4; y += 4) {
              const x = c + dir * y + Math.sin(y * 0.35) * 1.6;
              y === -4 ? g.moveTo(x, y) : g.lineTo(x, y);
            }
            g.stroke();
          };
          line(6, '#8f5427'); line(4, '#fff6ec');
        }
      }
      const cols = ['#ff7eb6', '#7be0c8', '#ffd166', '#8fc3ff'];
      for (let c = 0; c < W + P; c += P) {
        for (let y = 0; y <= H; y += P / 2) {
          const x = ((y / (P / 2)) % 2) ? c + P / 2 : c;
          g.beginPath(); g.arc(x, y, 5, 0, 7); inked(g, cols[((x + y) / 28 | 0) % 4], 1.5, '#8f5427');
          g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(x - 1.5, y - 1.5, 1.5, 0, 7); g.fill();
        }
      }
      break;
    }
    case 6: {                                                     // crystal facets
      g.fillStyle = '#221a45'; g.fillRect(0, 0, W, H);
      const cw = 48, ch = 42;
      for (let y = 0; y < H; y += ch) {
        for (let x = 0; x < W; x += cw) {
          const tris = [[[x, y], [x + cw, y], [x, y + ch]], [[x + cw, y], [x + cw, y + ch], [x, y + ch]]];
          for (const t of tris) {
            g.fillStyle = ['#2c2258', '#342a66', '#281f50', '#3b2f70', '#30265e'][(r() * 5) | 0];
            g.beginPath(); g.moveTo(...t[0]); g.lineTo(...t[1]); g.lineTo(...t[2]); g.closePath(); g.fill();
            g.strokeStyle = '#4d3f8a'; g.lineWidth = 1.2; g.stroke();
          }
        }
      }
      for (let k = 0; k < 22; k++) star4(g, r() * W, 4 + r() * (H - 8), 2 + r() * 3, r() > .6 ? '#8fe6ff' : '#ffffff');
      break;
    }
    default: paintBackV3(i, g, W, H, r);
  }
  const dim = [.10, .06, .08, .22, .22, .12, .05, .06, .12, 0, .04][i] || 0;
  if (dim) { g.fillStyle = `rgba(22,16,40,${dim})`; g.fillRect(0, 0, W, H); }
  return T;
}
function star4(g, x, y, s, c) {
  g.fillStyle = c; g.beginPath();
  g.moveTo(x, y - s * 2); g.quadraticCurveTo(x, y, x + s * 2, y); g.quadraticCurveTo(x, y, x, y + s * 2);
  g.quadraticCurveTo(x, y, x - s * 2, y); g.quadraticCurveTo(x, y, x, y - s * 2); g.fill();
}

// ------------------------------------------------------- side wall tiles
// painted as the LEFT wall; x = WALL_W is the inner (visible) edge
function paintSide(i) {
  const T = mk(WALL_W, TILE_H), g = T.g, W = WALL_W, H = TILE_H, r = rng(303 + i);
  const blocks = (h, base, shade, hi, ink = INK) => {
    for (let y = 0, k = 0; y < H; y += h, k++) {
      g.fillStyle = base[k % base.length]; g.fillRect(0, y, W, h);
      g.fillStyle = shade; g.fillRect(0, y + h - 5, W, 5); g.fillRect(W - 8, y, 5, h);
      g.fillStyle = hi; g.fillRect(2, y + 2, W - 12, 3);
      g.fillStyle = ink; g.fillRect(0, y + h - 1.5, W, 2); g.fillRect(0, y, W, 1);
      if (k % 2) { g.fillRect(W * 0.45, y, 2, h); }
    }
  };
  switch (i) {
    case 0:
      blocks(42, ['#9a9ca3', '#a3a5ac', '#94969d', '#a0a2a8'], '#73767e', '#c1c3c8');
      for (let k = 0; k < 4; k++) {
        const y = r() * H;
        wrapY(H, y, 14, yy => { g.fillStyle = '#6fa04a'; g.beginPath(); g.ellipse(W - 8, yy, 6, 9, 0, 0, 7); g.fill();
          g.fillStyle = '#86b95a'; g.beginPath(); g.ellipse(W - 9, yy - 3, 3, 4, 0, 0, 7); g.fill(); });
      }
      break;
    case 1: {                                                     // red lacquer pillar, gold bands
      g.fillStyle = '#b8322a'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#8a221c'; g.fillRect(W - 11, 0, 8, H);
      g.fillStyle = '#e0594a'; g.fillRect(6, 0, 5, H);
      g.fillStyle = '#f08070'; g.fillRect(8, 0, 2, H);
      for (const by of [0, 84]) {
        g.fillStyle = '#d9a63a'; g.fillRect(0, by, W, 12);
        g.fillStyle = '#ffd166'; g.fillRect(0, by + 2, W, 3);
        g.fillStyle = '#9a6e1e'; g.fillRect(0, by + 9, W, 3);
        g.fillStyle = INK; g.fillRect(0, by, W, 1.2); g.fillRect(0, by + 11, W, 1.2);
      }
      break;
    }
    case 2:
      blocks(56, ['#cdeefa', '#bfe6f5', '#d8f3fc'], '#8cc6de', '#ffffff', '#2d5d78');
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2;
      for (let y = 10; y < H; y += 56) { g.beginPath(); g.moveTo(8, y + 20); g.lineTo(18, y + 8); g.stroke(); }
      break;
    case 3:
      blocks(56, ['#3b3342', '#433a4b', '#372f3e'], '#241e2a', '#5a5063');
      for (let y = 20; y < H; y += 56) {
        for (const [lw, c] of [[5, 'rgba(255,106,26,.35)'], [2, '#ff8a2a'], [.8, '#ffe08a']]) {
          g.strokeStyle = c; g.lineWidth = lw; g.beginPath();
          g.moveTo(4, y); g.lineTo(12, y + 8); g.lineTo(9, y + 18); g.lineTo(18, y + 26); g.stroke();
        }
      }
      break;
    case 4: {                                                     // steel I-beam + hazard
      g.fillStyle = '#4a5160'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#5f687a'; g.fillRect(4, 0, 8, H);
      g.fillStyle = '#353a46'; g.fillRect(W - 10, 0, 7, H);
      g.fillStyle = '#7b8396'; g.fillRect(6, 0, 2, H);
      for (let y = 10; y < H; y += 28) {
        for (const x of [9, W - 14]) {
          g.beginPath(); g.arc(x, y, 2.6, 0, 7); inked(g, '#8c95a8', 1.2);
        }
      }
      for (const by of [70]) {
        for (let k = 0; k < 6; k++) {
          g.fillStyle = k % 2 ? '#1f1f1f' : '#ffc32b';
          g.beginPath(); g.moveTo(k * 8 - 8, by + 20); g.lineTo(k * 8, by + 20); g.lineTo(k * 8 + 8, by); g.lineTo(k * 8, by); g.fill();
        }
        g.fillStyle = INK; g.fillRect(0, by - 1, W, 1.5); g.fillRect(0, by + 19.5, W, 1.5);
      }
      break;
    }
    case 5: {                                                     // candy cane pillar
      g.fillStyle = '#fff6ec'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#e8384f';
      for (let y = -48; y < H + 48; y += 24) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y - 24); g.lineTo(W, y - 12); g.lineTo(0, y + 12); g.closePath(); g.fill();
      }
      g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(W - 10, 0, 8, H);
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(6, 0, 4, H);
      break;
    }
    case 6: {
      g.fillStyle = '#4a3aa0'; g.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += 42) {
        g.fillStyle = '#6f5ad6';
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 21); g.lineTo(0, y + 42); g.closePath(); g.fill();
        g.fillStyle = '#8f7cf0';
        g.beginPath(); g.moveTo(0, y + 4); g.lineTo(W * .55, y + 21); g.lineTo(0, y + 30); g.closePath(); g.fill();
        g.strokeStyle = '#2a1f66'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 21); g.lineTo(0, y + 42); g.stroke();
      }
      star4(g, 12, 30, 2.5, '#bff6ff'); star4(g, 20, 118, 2, '#ffffff');
      break;
    }
    default: paintSideV3(i, g, W, H, r);
  }
  // inner edge: ink + rim light, identical on every theme so walls read as foreground
  g.fillStyle = INK; g.fillRect(W - 3, 0, 3, H);
  g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(W - 6, 0, 2, H);
  return T;
}

// ------------------------------------------------------- platform strips
// body: 480 x PLAT_H texture (clipped to a rounded slab per draw)
// top:  480 x 12 above the surface (tufts, snow lumps), drawn unclipped
// under: 480 x 16 hanging below (icicles, drips, shards)
function paintPlat(i) {
  const B = mk(VIEW_W, PLAT_H), Tp = mk(VIEW_W, 12), U = mk(VIEW_W, 16);
  const g = B.g, W = VIEW_W, H = PLAT_H, r = rng(505 + i), t = Tp.g, u = U.g;
  const band = (y, h, c) => { g.fillStyle = c; g.fillRect(0, y, W, h); };
  switch (i) {
    case 0: {
      band(0, H, '#9ea1a8'); band(H - 5, 5, '#74777f'); band(5, 2, '#c3c6cc');
      for (let x = 20 + r() * 30; x < W; x += 36 + r() * 30) { g.fillStyle = '#6a6d75'; g.fillRect(x, 6, 2, H - 6); g.fillStyle = '#b6b9bf'; g.fillRect(x + 2, 7, 1.5, H - 12); }
      // grass cap
      g.fillStyle = '#5a9a3a'; g.beginPath(); g.moveTo(0, 0);
      for (let x = 0; x <= W; x += 6) g.lineTo(x, 6 + Math.sin(x * .7) * 1.5 + (hash(x) > .8 ? 2 : 0));
      g.lineTo(W, 0); g.fill();
      band(0, 4, '#7cc04f'); band(0, 1.5, '#a6e070');
      for (let x = 4; x < W; x += 5 + r() * 9) {
        const h = 4 + r() * 6, c = r() > .5 ? '#6fb445' : '#86c95a';
        t.fillStyle = c; t.strokeStyle = INK; t.lineWidth = 1.2;
        t.beginPath(); t.moveTo(x - 2.5, 12); t.lineTo(x + (r() - .5) * 3, 12 - h); t.lineTo(x + 2.5, 12); t.closePath(); t.fill(); t.stroke();
        if (r() > .93) { t.beginPath(); t.arc(x + 3, 4, 2.6, 0, 7); inked(t, r() > .5 ? '#ff7eb6' : '#ffd166', 1); }
      }
      for (let x = 30; x < W; x += 50 + r() * 70) { u.fillStyle = '#5f8a3e'; u.beginPath(); u.ellipse(x, 1, 4, 5 + r() * 5, 0, 0, 7); u.fill(); }
      break;
    }
    case 1: {                                                     // two lashed bamboo poles
      for (const [y0, h] of [[0, 9], [9, 9]]) {
        band(y0, h, '#b5c95a'); band(y0 + h - 3, 3, '#8ea03e'); band(y0 + 1.5, 2, '#e3ef9f');
        g.fillStyle = INK; g.fillRect(0, y0 + h - .8, W, 1.2);
        for (let x = 10 + r() * 30; x < W; x += 34 + r() * 16) {
          g.fillStyle = '#7d8f34'; g.fillRect(x, y0, 3, h);
          g.fillStyle = '#e3ef9f'; g.fillRect(x + 3, y0 + 1, 1.5, h - 2);
        }
      }
      for (let x = 30 + r() * 20; x < W; x += 70 + r() * 40) {
        g.fillStyle = '#c9a15a'; g.fillRect(x, 0, 8, H);
        g.strokeStyle = '#7a5a28'; g.lineWidth = 1.2;
        for (let y = 2; y < H; y += 4) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y + 2); g.stroke(); }
        g.fillStyle = INK; g.fillRect(x - .5, 0, 1.2, H); g.fillRect(x + 7.5, 0, 1.2, H);
      }
      break;
    }
    case 2: {
      band(0, H, '#aee3f7'); band(H - 5, 5, '#7cc3e3');
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2;
      for (let x = r() * 30; x < W; x += 24 + r() * 30) { g.beginPath(); g.moveTo(x, H - 4); g.lineTo(x + 7, 7); g.stroke(); }
      g.fillStyle = '#d9eef7'; g.beginPath(); g.moveTo(0, 0);
      for (let x = 0; x <= W; x += 5) g.lineTo(x, 6 + Math.sin(x * .45) * 1.8);
      g.lineTo(W, 0); g.fill();
      band(0, 4.5, '#f7fbff');
      for (let x = 6; x < W; x += 16 + r() * 22) {
        const w = 8 + r() * 10;
        t.beginPath(); t.ellipse(x, 12, w / 2, 3 + r() * 3, 0, Math.PI, 0); t.closePath(); inked(t, '#f7fbff', 1.3, '#2d5d78');
      }
      for (let x = 8; x < W; x += 9 + r() * 14) {
        const l = 4 + r() * 11;
        u.beginPath(); u.moveTo(x - 3, 0); u.lineTo(x, l); u.lineTo(x + 3, 0); u.closePath(); inked(u, '#c9ecf8', 1.2, '#2d5d78');
        u.strokeStyle = '#ffffff'; u.lineWidth = 1; u.beginPath(); u.moveTo(x - 1, 1); u.lineTo(x - .3, l * .6); u.stroke();
      }
      break;
    }
    case 3: {
      band(0, H, '#6a6370'); band(0, 3, '#958d9c'); band(3, 1.5, '#b8b0be'); band(H - 6, 6, '#48424e');
      for (let x = 40 + r() * 20; x < W; x += 60 + r() * 30) { g.fillStyle = '#2a252f'; g.fillRect(x, 0, 2, H); }
      for (let x = 10; x < W; x += 22) {
        g.beginPath(); g.arc(x, 7.5, 2.2, 0, 7); inked(g, '#7d7684', 1, '#1a161e');
        g.fillStyle = '#b3acb8'; g.fillRect(x - 1.2, 6.2, 1.2, 1.2);
      }
      band(H - 3, 3, '#ff7a1f'); band(H - 1.5, 1.5, '#ffd36a');
      for (let x = 20; x < W; x += 40 + r() * 60) {
        const l = 3 + r() * 7;
        u.fillStyle = '#ff7a1f'; u.beginPath(); u.moveTo(x - 2.5, 0); u.quadraticCurveTo(x - 2.5, l, x, l + 2); u.quadraticCurveTo(x + 2.5, l, x + 2.5, 0); u.fill();
        u.fillStyle = '#ffd36a'; u.beginPath(); u.arc(x, l, 1.2, 0, 7); u.fill();
      }
      break;
    }
    case 4: {                                                     // steel girder, truss
      band(0, H, '#76809a'); band(0, 5, '#9aa3b8'); band(H - 4, 4, '#4a5163');
      g.strokeStyle = '#3b4150'; g.lineWidth = 2.2;
      for (let x = 0; x < W; x += 20) { g.beginPath(); g.moveTo(x, 5); g.lineTo(x + 10, H - 5); g.lineTo(x + 20, 5); g.stroke(); }
      g.strokeStyle = '#8c95a8'; g.lineWidth = 1;
      for (let x = 0; x < W; x += 20) { g.beginPath(); g.moveTo(x + 1.5, 5); g.lineTo(x + 10.5, H - 6); g.stroke(); }
      band(4, 1.2, INK); band(H - 5, 1.2, INK);
      band(1, 3, '#2a2f3d');                                      // neon housing (lit per frame)
      break;
    }
    case 5: {
      band(0, H, '#c07a3e'); band(H - 5, 5, '#96582a');
      for (let k = 0; k < 120; k++) { g.fillStyle = '#9a5c2c'; g.beginPath(); g.arc(r() * W, 8 + r() * (H - 10), 1.1, 0, 7); g.fill(); }
      // icing cap with drips down the face
      g.fillStyle = '#fff6ec'; g.beginPath(); g.moveTo(0, 0);
      let x = 0;
      while (x <= W) {
        const w = 10 + r() * 16, d = 5 + r() * 6;
        g.lineTo(x, 5); g.quadraticCurveTo(x + w / 2, 5 + d * 2, x + w, 5); x += w;
      }
      g.lineTo(W, 0); g.closePath(); g.fill();
      g.strokeStyle = '#d9c8b8'; g.lineWidth = 1.2; g.stroke();
      band(0, 2, '#ffffff');
      const sp = ['#ff7eb6', '#7be0c8', '#ffd166', '#8fc3ff', '#e8384f'];
      for (let k = 0; k < 70; k++) {
        g.save(); g.translate(r() * W, 2 + r() * 3); g.rotate(r() * 3);
        g.fillStyle = sp[(r() * 5) | 0]; g.fillRect(-2, -.7, 4, 1.4); g.restore();
      }
      for (let xx = 30; xx < W; xx += 60 + r() * 80) {
        t.beginPath(); t.moveTo(xx - 5, 12); t.quadraticCurveTo(xx - 5, 4, xx, 4); t.quadraticCurveTo(xx + 5, 4, xx + 5, 12); t.closePath();
        inked(t, sp[(r() * 5) | 0], 1.2, '#7a3f1a');
        t.fillStyle = 'rgba(255,255,255,.6)'; t.fillRect(xx - 2.5, 6, 1.5, 3);
      }
      for (let xx = 14; xx < W; xx += 22 + r() * 30) {
        const l = 3 + r() * 8;
        u.beginPath(); u.moveTo(xx - 3, 0); u.lineTo(xx - 3, l); u.arc(xx, l, 3, Math.PI, 0, true); u.lineTo(xx + 3, 0);
        inked(u, '#fff6ec', 1.2, '#8f5427');
      }
      break;
    }
    case 6: {
      band(0, H, '#8f7cf0');
      for (let x = 0; x < W; x += 14) {
        g.fillStyle = (x / 14) % 2 ? '#b3a6ff' : '#7a64e0';
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 14, 0); g.lineTo(x + 7, H); g.closePath(); g.fill();
        g.fillStyle = (x / 14) % 2 ? '#6f5ad6' : '#9d8cff';
        g.beginPath(); g.moveTo(x + 7, H); g.lineTo(x + 21, H); g.lineTo(x + 14, 0); g.closePath(); g.fill();
      }
      band(0, 3, '#d8f8ff'); band(H - 3, 3, '#4a3aa0');
      for (let x = 12; x < W; x += 26 + r() * 30) {
        const l = 5 + r() * 9;
        u.beginPath(); u.moveTo(x - 3.5, 0); u.lineTo(x, l); u.lineTo(x + 3.5, 0); u.closePath(); inked(u, r() > .5 ? '#8fe6ff' : '#b3a6ff', 1.2, '#2a1f66');
      }
      break;
    }
    default: paintPlatV3(i, g, t, u, W, H, r, band);
  }
  return { body: B, top: Tp, under: U };
}

// ------------------------------------------------------- outside landscapes
function paintLand(i) {
  const L = mk(VIEW_W, LAND_H), g = L.g, W = VIEW_W, H = LAND_H, r = rng(707 + i);
  let lights = null;
  const hills = (base, amp, n, col, ink, seed) => {
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, base - Math.abs(Math.sin(x / W * Math.PI * n + seed)) * amp - Math.sin(x * .05 + seed) * 4);
    g.lineTo(W, H); g.closePath(); inked(g, col, 2, ink);
  };
  switch (i) {
    case 0: {
      hills(120, 50, 3, '#9fc7a8', '#6f9a82', 1);
      hills(150, 36, 4, '#7cbf5a', INK, 2.3);
      g.fillStyle = '#4aa3d8'; g.fillRect(0, 168, W, 30);
      g.fillStyle = '#2f7fb5'; g.fillRect(0, 192, W, 6);
      g.strokeStyle = '#bfe9ff'; g.lineWidth = 2;
      for (let k = 0; k < 24; k++) { const x = r() * W, y = 174 + r() * 16; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10, y); g.stroke(); }
      g.fillStyle = INK; g.fillRect(0, 167, W, 2);
      for (let k = 0; k < 10; k++) {
        const x = r() * W, y = 176 + r() * 14;
        g.beginPath(); g.ellipse(x, y, 7, 3, 0, .4, Math.PI * 2 - .1); g.lineTo(x, y); inked(g, '#5aa640', 1.2);
        if (r() > .6) { g.beginPath(); g.arc(x + 2, y - 2, 2, 0, 7); inked(g, '#ff9ec8', 1); }
      }
      g.fillStyle = '#5aa640'; g.fillRect(0, 198, W, 22); g.fillStyle = INK; g.fillRect(0, 197, W, 2);
      for (let x = 4; x < W; x += 7 + r() * 16) {
        const h = 16 + r() * 22;
        g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 204); g.lineTo(x + 2, 204 - h); g.stroke();
        g.strokeStyle = '#4f8f3a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, 204); g.lineTo(x + 2, 204 - h); g.stroke();
        if (r() > .55) { rr(g, x - 1, 204 - h - 7, 6, 11, 3); inked(g, '#8a5a2e', 1.2); }
      }
      break;
    }
    case 1: {
      hills(110, 70, 2, '#c3d1b8', '#9aae93', .6);
      // pagoda on the far ridge
      for (const px of [120, 390]) {
        const base = 88;
        for (let k = 0; k < 4; k++) {
          const w = 44 - k * 9, y = base - k * 16;
          g.fillStyle = '#6a7d66'; g.fillRect(px - w * .35, y - 10, w * .7, 10);
          g.beginPath(); g.moveTo(px - w / 2 - 6, y - 10); g.quadraticCurveTo(px, y - 18, px + w / 2 + 6, y - 10); g.lineTo(px + w / 2, y - 7); g.lineTo(px - w / 2, y - 7); g.closePath();
          g.fillStyle = '#4f5f4c'; g.fill();
        }
        g.fillRect(px - 1, base - 76, 2, 12);
      }
      hills(170, 30, 3, '#8bbf5a', INK, 1.2);
      for (let x = 6; x < W; x += 34 + r() * 40) {
        const w = 7 + r() * 4, c = r() > .5 ? '#6fa84a' : '#5d963c';
        g.fillStyle = c; g.fillRect(x, 0, w, H);
        g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x + 1.5, 0, 1.5, H);
        g.fillStyle = INK; g.fillRect(x - 1, 0, 1.5, H); g.fillRect(x + w - .5, 0, 1.5, H);
        for (let y = r() * 40; y < H; y += 34 + r() * 14) {
          g.fillStyle = INK; g.fillRect(x - 1, y, w + 1.5, 2.2);
          if (r() > .5) {
            const s = r() > .5 ? 1 : -1;
            g.beginPath(); g.moveTo(x + w / 2, y); g.quadraticCurveTo(x + w / 2 + s * 14, y - 10, x + w / 2 + s * 24, y - 2);
            g.quadraticCurveTo(x + w / 2 + s * 12, y - 2, x + w / 2, y); inked(g, '#7fc050', 1.2);
          }
        }
      }
      break;
    }
    case 2: {
      const peaks = (base, h, n, col, seed, ink) => {
        const pts = [];
        for (let k = 0; k <= n; k++) pts.push([k * W / n + (hash(k, seed) - .5) * 30, base - h * (.5 + hash(k + 9, seed) * .5)]);
        g.beginPath(); g.moveTo(0, H);
        for (let k = 0; k < n; k++) { g.lineTo(pts[k][0] - W / n / 2, base); g.lineTo(pts[k][0], pts[k][1]); }
        g.lineTo(W, base); g.lineTo(W, H); g.closePath(); inked(g, col, 2, ink);
        for (let k = 0; k < n; k++) {
          const [px, py] = pts[k], d = (base - py) * .32;
          g.beginPath(); g.moveTo(px, py); g.lineTo(px + d * .9, py + d); g.lineTo(px + d * .4, py + d * .8); g.lineTo(px, py + d * 1.05);
          g.lineTo(px - d * .4, py + d * .8); g.lineTo(px - d * .9, py + d); g.closePath(); inked(g, '#f7fbff', 1.5, ink);
        }
      };
      peaks(150, 120, 4, '#8aa0c8', 3, '#5b6f98');
      peaks(185, 90, 6, '#6d84b0', 7, INK);
      g.fillStyle = '#f2f8fc'; g.fillRect(0, 196, W, 24); g.fillStyle = INK; g.fillRect(0, 195, W, 2);
      for (let x = 10; x < W; x += 22 + r() * 30) {
        const h = 28 + r() * 22, y = 200;
        for (let k = 0; k < 3; k++) {
          const w = (3 - k) * 7, yy = y - k * h / 3.2;
          g.beginPath(); g.moveTo(x - w, yy); g.lineTo(x, yy - h / 2.2); g.lineTo(x + w, yy); g.closePath(); inked(g, '#2f5d4a', 1.4);
          g.beginPath(); g.moveTo(x - w * .5, yy - h / 4.4); g.lineTo(x, yy - h / 2.2); g.lineTo(x + w * .5, yy - h / 4.4); g.closePath(); g.fillStyle = '#f7fbff'; g.fill();
        }
      }
      break;
    }
    case 3: {
      hills(120, 40, 2, '#6a3a40', '#4a2530', 2);
      // volcano
      g.beginPath(); g.moveTo(140, 200); g.lineTo(215, 70); g.lineTo(265, 70); g.lineTo(340, 200); g.closePath(); inked(g, '#4a3b45', 2.2);
      g.beginPath(); g.moveTo(215, 70); g.quadraticCurveTo(240, 80, 265, 70); g.lineTo(262, 74); g.quadraticCurveTo(240, 84, 218, 74); g.closePath(); inked(g, '#ff7a1f', 1.5);
      g.beginPath(); g.moveTo(236, 76); g.quadraticCurveTo(228, 120, 246, 150); g.quadraticCurveTo(236, 175, 250, 200); g.lineTo(260, 200); g.quadraticCurveTo(246, 172, 256, 150); g.quadraticCurveTo(240, 118, 246, 78); g.closePath(); inked(g, '#ff7a1f', 1.5);
      // a second, smaller cone so more windows catch one
      g.beginPath(); g.moveTo(360, 200); g.lineTo(405, 112); g.lineTo(428, 112); g.lineTo(476, 200); g.closePath(); inked(g, '#55444f', 2);
      g.beginPath(); g.ellipse(416, 113, 12, 3.5, 0, 0, 7); inked(g, '#ff7a1f', 1.4);
      g.fillStyle = 'rgba(80,70,80,.85)';
      for (const [x, y, s] of [[232, 52, 14], [250, 38, 18], [238, 22, 20], [262, 12, 16]]) { g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); }
      hills(196, 16, 5, '#2e2632', INK, 4);
      g.fillStyle = '#ff7a1f'; g.fillRect(0, 206, W, 14); g.fillStyle = '#ffd36a'; g.fillRect(0, 208, W, 2);
      g.fillStyle = INK; g.fillRect(0, 205, W, 2);
      lights = mk(W, H); const lg = lights.g;
      lg.fillStyle = '#ffb03a'; lg.fillRect(0, 206, W, 14);
      lg.beginPath(); lg.moveTo(236, 76); lg.quadraticCurveTo(228, 120, 246, 150); lg.quadraticCurveTo(236, 175, 250, 200); lg.lineTo(260, 200); lg.quadraticCurveTo(246, 172, 256, 150); lg.quadraticCurveTo(240, 118, 246, 78); lg.closePath(); lg.fill();
      lg.fillStyle = '#ffd36a'; lg.beginPath(); lg.ellipse(240, 74, 20, 5, 0, 0, 7); lg.fill();
      break;
    }
    case 4: {
      lights = mk(W, H); const lg = lights.g;
      const layer = (base, hmin, hmax, cols, ink, lit) => {
        for (let x = -10; x < W;) {
          const w = 30 + r() * 50, h = hmin + r() * (hmax - hmin);
          g.beginPath(); g.rect(x, base - h, w, h + 40); inked(g, cols[(r() * cols.length) | 0], 2, ink);
          if (r() > .6) { g.fillStyle = cols[0]; g.fillRect(x + w / 2 - 2, base - h - 14, 4, 14); }
          for (let wy = base - h + 8; wy < base - 4; wy += 11) {
            for (let wx = x + 5; wx < x + w - 6; wx += 9) {
              g.fillStyle = '#1c1f38'; g.fillRect(wx, wy, 5, 6);
              if (lit && r() < .45) { lg.fillStyle = r() > .3 ? '#ffd86b' : '#7ff3ff'; lg.fillRect(wx, wy, 5, 6); }
            }
          }
          x += w + 2;
        }
      };
      layer(170, 60, 130, ['#3a3f6e', '#434a7c', '#353a66'], '#262a4a', true);
      layer(210, 40, 90, ['#2b2f55', '#262a4a', '#30345c'], INK, true);
      g.fillStyle = '#1a1c30'; g.fillRect(0, 206, W, 14); g.fillStyle = '#ffd166';
      for (let x = 0; x < W; x += 24) g.fillRect(x, 212, 12, 2);
      const sgn = [[60, 150, '#ff3fd0'], [300, 160, '#7ff3ff'], [420, 140, '#ffd166']];
      for (const [x, y, c] of sgn) { lg.strokeStyle = c; lg.lineWidth = 2.5; rr(lg, x, y, 26, 10, 4); lg.stroke(); rr(g, x, y, 26, 10, 4); g.strokeStyle = '#555'; g.lineWidth = 2; g.stroke(); }
      break;
    }
    case 5: {
      hills(130, 44, 3, '#ffc6dd', '#d98aac', .5);
      hills(165, 34, 4, '#a8f0d0', INK, 1.9);
      for (let k = 0; k < 7; k++) {
        const x = 30 + k * 68 + r() * 20, y = 190, h = 30 + r() * 30;
        g.fillStyle = INK; g.fillRect(x - 2, y - h, 4, h); g.fillStyle = '#fff6ec'; g.fillRect(x - 1, y - h, 2, h);
        g.beginPath(); g.arc(x, y - h, 12, 0, 7); inked(g, ['#ff7eb6', '#ffd166', '#7be0c8', '#8fc3ff'][k % 4], 2);
        g.strokeStyle = '#fff6ec'; g.lineWidth = 2.2; g.beginPath();
        for (let a = 0; a < 9; a += .3) { const rad = a * 1.25; g.lineTo(x + Math.cos(a) * rad, y - h + Math.sin(a) * rad); } g.stroke();
      }
      g.fillStyle = '#ffb3d1'; g.fillRect(0, 196, W, 24); g.fillStyle = INK; g.fillRect(0, 195, W, 2);
      for (let x = 10; x < W; x += 30 + r() * 30) { g.beginPath(); g.moveTo(x - 7, 204); g.quadraticCurveTo(x - 7, 194, x, 194); g.quadraticCurveTo(x + 7, 194, x + 7, 204); g.closePath(); inked(g, ['#e8384f', '#7be0c8', '#ffd166'][(r() * 3) | 0], 1.5); }
      break;
    }
    case 6: {
      hills(180, 26, 3, '#8d86b5', INK, .8);
      for (let k = 0; k < 16; k++) {
        const x = r() * W, y = 186 + r() * 24, w = 6 + r() * 10;
        g.beginPath(); g.ellipse(x, y, w, w * .35, 0, 0, 7); inked(g, '#6f6899', 1.2);
      }
      for (let k = 0; k < 9; k++) {
        const x = 20 + r() * (W - 40), h = 20 + r() * 34, w = 6 + r() * 6, y = 190;
        g.beginPath(); g.moveTo(x - w, y); g.lineTo(x - w * .6, y - h * .7); g.lineTo(x, y - h); g.lineTo(x + w * .6, y - h * .7); g.lineTo(x + w, y); g.closePath();
        inked(g, r() > .5 ? '#8fe6ff' : '#b3a6ff', 1.6);
        g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(x - w * .3, y - 2); g.lineTo(x - w * .1, y - h * .8); g.lineTo(x, y - 2); g.fill();
      }
      g.fillStyle = '#7a73a3'; g.fillRect(0, 206, W, 14); g.fillStyle = INK; g.fillRect(0, 205, W, 2);
      break;
    }
    default: lights = paintLandV3(i, g, W, H, r, hills, lights);
  }
  return { land: L, lights };
}

// ------------------------------------------------------- decor sprites
// every sprite: canvas + anchor (ax, ay) in sprite px = where it attaches to the wall point
function paintDecor(kind, T, variant = 0) {
  let S, ax, ay;
  switch (kind) {
    case 'torch': case 'bluetorch': {
      S = mk(22, 34); const g = S.g; ax = 11; ay = 14;
      g.beginPath(); g.moveTo(6, 12); g.lineTo(16, 12); g.lineTo(13, 22); g.lineTo(9, 22); g.closePath(); inked(g, kind === 'bluetorch' ? '#9fd0e6' : '#8a5a2e', 1.8);
      rr(g, 9, 21, 4, 12, 2); inked(g, '#5b3a1e', 1.6);
      rr(g, 4, 9, 14, 5, 2); inked(g, '#6b7385', 1.6);
      break;
    }
    case 'banner': {
      S = mk(40, 86); const g = S.g; ax = 20; ay = 4;
      g.beginPath(); g.moveTo(6, 6); g.lineTo(34, 6); g.lineTo(34, 78); g.lineTo(20, 68); g.lineTo(6, 78); g.closePath(); inked(g, T.banner, 2);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(28, 6); g.lineTo(34, 6); g.lineTo(34, 78); g.lineTo(28, 73.5); g.closePath(); g.fill();
      g.strokeStyle = T.bannerTrim; g.lineWidth = 2; g.beginPath(); g.moveTo(9, 10); g.lineTo(9, 72); g.moveTo(31, 10); g.lineTo(31, 72); g.stroke();
      capyHead(g, 20, 34, 8, T.bannerTrim);
      rr(g, 1, 2, 38, 6, 3); inked(g, '#8a5a2e', 1.8);
      g.beginPath(); g.arc(2, 5, 3, 0, 7); inked(g, T.bannerTrim, 1.4); g.beginPath(); g.arc(38, 5, 3, 0, 7); inked(g, T.bannerTrim, 1.4);
      break;
    }
    case 'scroll': {
      S = mk(34, 84); const g = S.g; ax = 17; ay = 4;
      rr(g, 5, 6, 24, 70, 2); inked(g, '#f3ead2', 2);
      g.fillStyle = '#e4553f'; g.beginPath(); g.arc(17, 26, 6, 0, 7); g.fill();
      g.strokeStyle = INK; g.lineWidth = 2.2;
      for (const y of [42, 52, 62]) { g.beginPath(); g.moveTo(11, y); g.lineTo(23, y + 2); g.stroke(); }
      rr(g, 2, 2, 30, 6, 3); inked(g, '#6b3a1d', 1.8); rr(g, 2, 74, 30, 6, 3); inked(g, '#6b3a1d', 1.8);
      break;
    }
    case 'portrait': {
      S = mk(50, 58); const g = S.g; ax = 25; ay = 29;
      const bgc = { riverbank: '#bfe4ff', dojo: '#f3ead2', frost: '#dff4fb', lava: '#ffcf9a', neon: '#ff9ee6', gingersnap: '#ffe0ef', starlight: '#2c2258' }[T.id] || '#bfe4ff';
      rr(g, 2, 2, 46, 54, 3); inked(g, '#d9a63a', 2);
      g.fillStyle = '#9a6e1e'; g.fillRect(40, 4, 6, 50); g.fillStyle = '#ffe08a'; g.fillRect(4, 4, 3, 50);
      g.beginPath(); g.rect(9, 9, 32, 40); inked(g, bgc, 1.6);
      g.save(); g.beginPath(); g.rect(9, 9, 32, 40); g.clip();
      g.beginPath(); g.ellipse(25, 52, 17, 12, 0, 0, 7); inked(g, '#a8743f', 1.8);
      capyHead(g, 25, 31, 11, null);
      if (T.id === 'starlight') { g.beginPath(); g.arc(25, 30, 15, 0, 7); g.strokeStyle = 'rgba(191,246,255,.85)'; g.lineWidth = 2; g.stroke(); }
      g.restore();
      break;
    }
    case 'vine': {
      S = mk(30, 120); const g = S.g; ax = 15; ay = 2; const r = rng(77);
      g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(15, 0);
      for (let y = 0; y < 116; y += 8) g.lineTo(15 + Math.sin(y * .09) * 6, y); g.stroke();
      g.strokeStyle = '#4f8f3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(15, 0);
      for (let y = 0; y < 116; y += 8) g.lineTo(15 + Math.sin(y * .09) * 6, y); g.stroke();
      for (let y = 8; y < 112; y += 11) {
        const x = 15 + Math.sin(y * .09) * 6, s = (y / 11) % 2 ? 1 : -1;
        g.beginPath(); g.ellipse(x + s * 6, y, 6, 3.2, s * .5, 0, 7); inked(g, r() > .5 ? '#6fb445' : '#86c95a', 1.3);
      }
      break;
    }
    case 'lantern': {
      S = mk(30, 50); const g = S.g; ax = 15; ay = 2;
      g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(15, 0); g.lineTo(15, 10); g.stroke();
      rr(g, 9, 8, 12, 4, 1.5); inked(g, '#3a2a1c', 1.4);
      g.beginPath(); g.ellipse(15, 26, 12, 15, 0, 0, 7); inked(g, '#e4553f', 2);
      g.fillStyle = '#b8322a'; g.beginPath(); g.ellipse(19, 26, 5, 14, 0, -1.4, 1.4); g.fill();
      g.strokeStyle = '#8a221c'; g.lineWidth = 1;
      for (const dx of [-6, 0, 6]) { g.beginPath(); g.ellipse(15 + dx * .6, 26, Math.abs(dx) + 1, 14.5, 0, 0, 7); g.stroke(); }
      g.fillStyle = 'rgba(255,220,150,.55)'; g.beginPath(); g.ellipse(11, 22, 3, 6, 0, 0, 7); g.fill();
      rr(g, 9, 40, 12, 4, 1.5); inked(g, '#3a2a1c', 1.4);
      g.strokeStyle = '#ffd166'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(15, 44); g.lineTo(15, 49); g.stroke();
      break;
    }
    case 'shield': {
      S = mk(44, 50); const g = S.g; ax = 22; ay = 25;
      for (const s of [-1, 1]) {
        g.save(); g.translate(22, 26); g.rotate(s * .7);
        rr(g, -2, -22, 4, 44, 2); inked(g, '#8a5a2e', 1.4);
        g.beginPath(); g.moveTo(-2, -22); g.lineTo(-9 * s, -18); g.lineTo(-2, -16); g.closePath(); inked(g, '#b8c2d0', 1.3);
        g.restore();
      }
      g.beginPath(); g.moveTo(10, 8); g.lineTo(34, 8); g.lineTo(34, 26); g.quadraticCurveTo(34, 40, 22, 46); g.quadraticCurveTo(10, 40, 10, 26); g.closePath(); inked(g, '#3a86c8', 2);
      g.beginPath(); g.moveTo(22, 12); g.lineTo(22, 40); g.moveTo(14, 24); g.lineTo(30, 24); g.strokeStyle = '#e8f7ff'; g.lineWidth = 2.5; g.stroke();
      g.fillStyle = '#ffffff'; for (const x of [13, 20, 27]) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 3, 14); g.lineTo(x + 6, 8); g.fill(); }
      break;
    }
    case 'chain': {
      S = mk(16, 110); const g = S.g; ax = 8; ay = 2;
      for (let y = 2, k = 0; y < 96; y += 9, k++) {
        g.beginPath(); if (k % 2) g.ellipse(8, y + 5, 2, 6, 0, 0, 7); else g.ellipse(8, y + 5, 5, 6, 0, 0, 7);
        g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke(); g.lineWidth = 1.8; g.strokeStyle = '#8c8594'; g.stroke();
      }
      g.beginPath(); g.moveTo(8, 98); g.quadraticCurveTo(15, 100, 13, 106); g.quadraticCurveTo(8, 110, 4, 104);
      g.lineWidth = 3.5; g.strokeStyle = INK; g.stroke(); g.lineWidth = 1.8; g.strokeStyle = '#8c8594'; g.stroke();
      break;
    }
    case 'gear': {
      S = mk(46, 46); const g = S.g; ax = 23; ay = 23;
      g.beginPath();
      for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2, rad = k % 2 ? 16 : 20; g.lineTo(23 + Math.cos(a) * rad, 23 + Math.sin(a) * rad); }
      g.closePath(); inked(g, '#6d6673', 2);
      g.beginPath(); g.arc(23, 23, 11, 0, 7); inked(g, '#4b4550', 1.6);
      g.beginPath(); g.arc(23, 23, 4, 0, 7); inked(g, '#2a252f', 1.4);
      g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(19, 19, 5, 0, 7); g.fill();
      break;
    }
    case 'neon': {
      S = mk(76, 34); const g = S.g; ax = 38; ay = 17;
      rr(g, 3, 3, 70, 28, 5); inked(g, '#1a1c2a', 2);
      break;                                                       // letters are drawn lit per frame
    }
    case 'graffiti': {
      S = mk(96, 44); const g = S.g; ax = 48; ay = 22; const r = rng(T.id.length + 17 + variant * 31);
      const words = ['CAPY', 'HOP!', 'UP!', 'APF', 'CHILL'];
      const w = words[variant % words.length];
      g.font = `900 26px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save(); g.translate(48, 22); g.rotate(-.08);
      g.lineWidth = 7; g.strokeStyle = INK; g.strokeText(w, 0, 0);
      g.fillStyle = ['#7be08a', '#ffd166', '#8fc3ff', '#ff7eb6'][(r() * 4) | 0]; g.fillText(w, 0, 0);
      g.lineWidth = 1.2; g.strokeStyle = '#ffffff'; g.strokeText(w, -1, -1);
      g.restore();
      g.fillStyle = 'rgba(255,255,255,.5)'; for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(r() * 96, r() * 44, .8 + r(), 0, 7); g.fill(); }
      break;
    }
    case 'vent': {
      S = mk(46, 36); const g = S.g; ax = 23; ay = 18;
      rr(g, 3, 3, 40, 30, 3); inked(g, '#5b6475', 2);
      g.fillStyle = '#2a2f3d'; for (let y = 8; y < 30; y += 5) g.fillRect(8, y, 30, 2.5);
      for (const [x, y] of [[7, 7], [39, 7], [7, 29], [39, 29]]) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fillStyle = '#8c95a8'; g.fill(); }
      break;
    }
    case 'lollipop': {
      S = mk(40, 70); const g = S.g; ax = 20; ay = 30;
      rr(g, 18, 30, 4, 38, 2); inked(g, '#fff6ec', 1.6);
      g.beginPath(); g.arc(20, 20, 17, 0, 7); inked(g, '#ff7eb6', 2.2);
      g.strokeStyle = '#fff6ec'; g.lineWidth = 3; g.beginPath();
      for (let a = 0; a < 12; a += .25) { const rad = a * 1.25; g.lineTo(20 + Math.cos(a) * rad, 20 + Math.sin(a) * rad); } g.stroke();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(13, 12, 4, 2.5, -.6, 0, 7); g.fill();
      break;
    }
    case 'wreath': {
      S = mk(52, 52); const g = S.g; ax = 26; ay = 26; const cols = ['#ff7eb6', '#7be0c8', '#ffd166', '#8fc3ff', '#e8384f'];
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2;
        g.beginPath(); g.arc(26 + Math.cos(a) * 17, 26 + Math.sin(a) * 17, 6.5, 0, 7); inked(g, cols[k % 5], 1.6);
        g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(24 + Math.cos(a) * 17, 24 + Math.sin(a) * 17, 1.8, 0, 7); g.fill();
      }
      g.beginPath(); g.moveTo(26, 42); g.lineTo(18, 50); g.lineTo(22, 42); g.moveTo(26, 42); g.lineTo(34, 50); g.lineTo(30, 42); inked(g, '#e8384f', 1.4);
      break;
    }
    case 'crystal': {
      S = mk(44, 50); const g = S.g; ax = 22; ay = 44;
      for (const [x, h, w, c] of [[12, 30, 6, '#b3a6ff'], [30, 26, 6, '#8fe6ff'], [21, 44, 8, '#8fe6ff']]) {
        g.beginPath(); g.moveTo(x - w, 46); g.lineTo(x - w, 46 - h * .7); g.lineTo(x, 46 - h); g.lineTo(x + w, 46 - h * .7); g.lineTo(x + w, 46); g.closePath(); inked(g, c, 1.8);
        g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x - w + 2, 46 - h * .66, 2.5, h * .6);
      }
      rr(g, 4, 43, 36, 6, 3); inked(g, '#4a3aa0', 1.6);
      break;
    }
    case 'orb': {
      S = mk(30, 44); const g = S.g; ax = 15; ay = 6;
      g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(15, 0); g.lineTo(15, 12); g.stroke();
      rr(g, 9, 10, 12, 5, 2); inked(g, '#6f5ad6', 1.4);
      break;                                                       // the glowing orb itself pulses per frame
    }
    default: ({ S, ax, ay } = paintDecorV3(kind, T, variant));
  }
  return { S, ax, ay };
}
function capyHead(g, x, y, s, flat) {
  // tiny capybara face for banners and paintings (flat = single colour emblem)
  const fur = flat || '#b9834c', dark = flat || '#8a5b2e';
  g.beginPath(); g.ellipse(x - s * .55, y - s * .8, s * .28, s * .24, 0, 0, 7); flat ? (g.fillStyle = fur, g.fill()) : inked(g, dark, 1.2);
  g.beginPath(); g.ellipse(x + s * .55, y - s * .8, s * .28, s * .24, 0, 0, 7); flat ? (g.fillStyle = fur, g.fill()) : inked(g, dark, 1.2);
  g.beginPath(); g.ellipse(x, y, s, s * .95, 0, 0, 7); flat ? (g.fillStyle = fur, g.fill()) : inked(g, fur, 1.6);
  g.beginPath(); g.ellipse(x, y + s * .35, s * .62, s * .48, 0, 0, 7);
  flat ? (g.fillStyle = 'rgba(0,0,0,.25)', g.fill()) : inked(g, '#8a5b2e', 1.2);
  g.fillStyle = flat ? 'rgba(0,0,0,.55)' : INK;
  g.beginPath(); g.arc(x - s * .42, y - s * .15, s * .13, 0, 7); g.arc(x + s * .42, y - s * .15, s * .13, 0, 7); g.fill();
  if (!flat) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x - s * .38, y - s * .2, s * .05, 0, 7); g.arc(x + s * .46, y - s * .2, s * .05, 0, 7); g.fill(); }
  g.fillStyle = flat ? 'rgba(0,0,0,.55)' : INK;
  g.beginPath(); g.ellipse(x - s * .2, y + s * .3, s * .07, s * .1, 0, 0, 7); g.ellipse(x + s * .2, y + s * .3, s * .07, s * .1, 0, 0, 7); g.fill();
}

// ------------------------------------------------------- shared sprites
let SHARED = null;
function shared() {
  if (SHARED) return SHARED;
  const cloud = mk(80, 34), c = cloud.g;
  c.beginPath(); c.moveTo(8, 30);
  c.arc(18, 22, 10, Math.PI * .9, Math.PI * 1.6); c.arc(34, 14, 13, Math.PI * 1.1, Math.PI * 1.9);
  c.arc(52, 16, 11, Math.PI * 1.2, Math.PI * 1.95); c.arc(66, 23, 9, Math.PI * 1.4, Math.PI * .3); c.closePath();
  inked(c, '#ffffff', 2, '#8fb0c6');
  c.fillStyle = '#dcebf5'; c.fillRect(10, 27, 62, 3);
  const stars = mk(256, 256), s = stars.g, r = rng(9);
  for (let k = 0; k < 70; k++) {
    const x = r() * 256, y = r() * 256, big = r() > .88;
    if (big) star4(s, x, y, 1.6, '#fff8d8');
    else { s.fillStyle = r() > .7 ? '#bfe4ff' : '#ffffff'; s.fillRect(x, y, 1.4, 1.4); }
  }
  const planet = mk(84, 56), p = planet.g;
  p.beginPath(); p.ellipse(42, 30, 40, 9, -.25, Math.PI * .98, Math.PI * 2.02); p.lineWidth = 5; p.strokeStyle = INK; p.stroke(); p.lineWidth = 3; p.strokeStyle = '#ffd166'; p.stroke();
  p.beginPath(); p.arc(42, 28, 18, 0, 7); inked(p, '#ff9e6b', 2);
  p.fillStyle = '#e4553f'; p.fillRect(26, 30, 32, 4); p.fillStyle = '#ffc49a'; p.beginPath(); p.arc(36, 22, 5, 0, 7); p.fill();
  p.beginPath(); p.ellipse(42, 30, 40, 9, -.25, -.02 * Math.PI, Math.PI * 1.02); p.lineWidth = 5; p.strokeStyle = INK; p.stroke(); p.lineWidth = 3; p.strokeStyle = '#ffd166'; p.stroke();
  const moon = mk(40, 40), m = moon.g;
  m.beginPath(); m.arc(20, 20, 15, 0, 7); inked(m, '#f2ead8', 2);
  m.fillStyle = '#d8ccb0'; m.beginPath(); m.arc(15, 16, 3.5, 0, 7); m.arc(24, 25, 2.5, 0, 7); m.arc(25, 13, 1.8, 0, 7); m.fill();
  SHARED = { cloud, stars, planet, moon };
  return SHARED;
}

// ------------------------------------------------------- theme cache
const CACHE = new Array(THEME_DEFS.length).fill(null);
let warmScheduled = false;
function theme(i) {
  if (!CACHE[i]) {
    const T = THEME_DEFS[i];
    const decor = {};
    for (const k of new Set(T.decor)) decor[k] = k === 'graffiti' ? [0, 1, 2, 3].map(v => paintDecor(k, T, v)) : paintDecor(k, T);
    CACHE[i] = { T, back: paintBack(i), side: paintSide(i), plat: paintPlat(i), land: paintLand(i), decor };
  }
  if (!warmScheduled) {                     // paint the rest in idle time, one per tick
    warmScheduled = true;
    let k = 0;
    const next = () => { while (k < CACHE.length && CACHE[k]) k++; if (k < CACHE.length) { theme(k); setTimeout(next, 30); } };
    setTimeout(next, 60);
  }
  return CACHE[i];
}
export function preloadWorld() { for (let i = 0; i < THEME_DEFS.length; i++) theme(i); shared(); }

// ------------------------------------------------------- sky by altitude
const SKY_KEYS = [
  [0, [95, 179, 232], [214, 240, 250]],
  [90, [88, 160, 225], [255, 236, 200]],
  [150, [84, 74, 156], [255, 150, 100]],
  [210, [20, 24, 64], [70, 58, 120]],
  [300, [6, 4, 18], [26, 16, 52]],
];
function skyAt(f) {
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let k = 0; k < SKY_KEYS.length - 1; k++) if (f >= SKY_KEYS[k][0] && f <= SKY_KEYS[k + 1][0]) { a = SKY_KEYS[k]; b = SKY_KEYS[k + 1]; break; }
  if (f > b[0]) a = b;
  const t = a === b ? 0 : (f - a[0]) / (b[0] - a[0]);
  const top = a[1].map((v, j) => lerp(v, b[1][j], t)), bot = a[2].map((v, j) => lerp(v, b[2][j], t));
  return { top: rgb(top), bot: rgb(bot), night: clamp((f - 140) / 70, 0, 1), stars: clamp((f - 170) / 60, 0, 1), space: clamp((f - 250) / 60, 0, 1) };
}

// ------------------------------------------------------- row layout
// deterministic per row: arched windows + decor slots that avoid them
const LAYOUT = new Map();
function rowLayout(r) {
  let L = LAYOUT.get(r);
  if (L) return L;
  const h = k => hash(r, k);
  const wins = [], decor = [];
  const baseY = r * ROW_H;
  if (r >= 0) {
    const type = h(1);
    const count = type < .28 ? 0 : type < .76 ? 1 : 2;
    const slots = count === 2 ? [[126, 354], [150, 330], [110, 300], [180, 370]][(h(2) * 4) | 0] : count === 1 ? [[[140, 240, 340, 190, 290][(h(2) * 5) | 0]]][0] : [];
    for (const x of slots) {
      const w = [84, 96, 108][(h(3 + x) * 3) | 0], hh = 140 + ((h(5 + x) * 3) | 0) * 12;
      wins.push({ x, w, h: hh, y: baseY + 40, seed: r * 7 + x });
    }
    const cand = [72, 132, 196, 240, 284, 348, 408];
    for (const x of cand) {
      if (wins.some(wn => Math.abs(wn.x - x) < wn.w / 2 + 26)) continue;
      if (h(20 + x) < .55) continue;
      if (decor.some(d => Math.abs(d.x - x) < 56)) continue;
      decor.push({ x, k: h(40 + x), y: baseY + 118 + (h(60 + x) - .5) * 30, seed: r * 13 + x });
    }
  }
  L = { wins, decor, baseY };
  LAYOUT.set(r, L);
  if (LAYOUT.size > 400) LAYOUT.delete(LAYOUT.keys().next().value);
  return L;
}
function winPath(p, wn, shape) {
  if (shape === 'round') { const rad = wn.w / 2, cy = wn.sb - wn.h / 2; p.moveTo(wn.x + rad, cy); p.arc(wn.x, cy, rad, 0, Math.PI * 2); p.closePath(); }
  else if (shape === 'rect') p.rect(wn.x - wn.w / 2, wn.sb - wn.h * .82, wn.w, wn.h * .82);
  else archPath(p, wn.x - wn.w / 2, wn.st, wn.w, wn.sb);
}
function archPath(p, x0, top, w, bottom) {
  const rad = w / 2, cy = top + rad;
  p.moveTo(x0, bottom); p.lineTo(x0, cy); p.arc(x0 + rad, cy, rad, Math.PI, 0); p.lineTo(x0 + w, bottom); p.closePath();
}

// ------------------------------------------------------- tiled wall fill
// fill world band [yA, yB) with a vertically tiling canvas (anchored in world y)
function tileBand(ctx, T, x, w, camY, yA, yB, alpha) {
  const sTop = sy(yB, camY), sBot = sy(yA, camY);
  if (sBot <= 0 || sTop >= VIEW_H || yB <= yA || alpha <= 0) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, Math.max(0, sTop), w, Math.min(VIEW_H, sBot) - Math.max(0, sTop)); ctx.clip();
  ctx.globalAlpha = alpha;
  const H = T.h, lo = Math.max(yA, camY - H), hi = Math.min(yB, camY + VIEW_H);
  for (let k = Math.floor(lo / H); k * H < hi; k++) {
    const top = sy((k + 1) * H, camY);
    ctx.drawImage(T.c, x, top, w, H);
  }
  ctx.restore();
}
// themed band fill with crossfade at 50-floor boundaries
function themedFill(ctx, pick, x, w, camY, yMax = Infinity) {
  const span = MAP.span * FLOOR_GAP;
  const yLo = camY - 20, yHi = Math.min(camY + VIEW_H + 20, yMax);
  for (let k = Math.floor(yLo / span); k * span < yHi; k++) {
    const a = k * span, b = a + span;
    tileBand(ctx, pick(themeAtY(Math.max(0, a) + 1)), x, w, camY, Math.max(a, yLo), Math.min(b, yHi), 1);
  }
  // crossfades: slices with a stepped alpha ramp around each boundary
  for (let k = Math.ceil(yLo / span - .1); k * span < yHi + BAND; k++) {
    const B = k * span; if (B <= 0) continue;
    if (B + BAND < yLo || B - BAND > yHi) continue;
    const below = pick(themeAtY(B - 1)), above = pick(themeAtY(B + 1));
    if (below === above) continue;
    const step = 12;
    for (let y = B - BAND; y < B; y += step) tileBand(ctx, above, x, w, camY, y, y + step, .5 * (y + step / 2 - (B - BAND)) / BAND);
    for (let y = B; y < B + BAND; y += step) tileBand(ctx, below, x, w, camY, y, y + step, .5 * (1 - (y + step / 2 - B) / BAND));
  }
}

// ======================================================= public drawing API
export function drawBackground(ctx, camY, time) {
  const ySum = summitY(), sTop = sy(ySum, camY);
  const midTi = themeAtY(Math.min(camY + VIEW_H / 2, ySum - 1));
  // 0) open-air towers: the sky is the backdrop, the "wall" is a see-through scaffold
  if (THEME_DEFS[midTi].open) drawOpenBackdrop(ctx, camY, time);
  const r0 = Math.floor((camY - 220) / ROW_H), r1 = Math.floor((camY + VIEW_H) / ROW_H);
  const wins = [], decor = [];
  for (let r = r0; r <= r1; r++) { const L = rowLayout(r); wins.push(...L.wins); decor.push(...L.decor); }

  // 1) outside through the windows
  const holes = new Path2D();
  for (const wn of wins) {
    const bottom = sy(wn.y, camY), top = bottom - wn.h;
    if (bottom < -10 || top > VIEW_H + 10) { wn.vis = false; continue; }
    const shape = THEME_DEFS[themeAtY(wn.y + wn.h / 2)].win || 'arch';
    if (shape === 'none' || wn.y + wn.h > ySum - 24) { wn.vis = false; continue; }
    wn.vis = true; wn.sb = bottom; wn.st = top; wn.shape = shape;
    winPath(holes, wn, shape);
    drawOutside(ctx, wn, camY, time);
  }
  // 2) back wall with the windows cut out
  ctx.save();
  const clip = new Path2D(); clip.rect(0, 0, VIEW_W, VIEW_H); clip.addPath(holes);
  ctx.clip(clip, 'evenodd');
  themedFill(ctx, i => theme(i).back, 0, VIEW_W, camY, ySum);
  ctx.restore();
  // 3) window frames + sills
  for (const wn of wins) if (wn.vis) drawFrame(ctx, wn);
  // 4) wall decor
  for (const d of decor) if (d.y < ySum - 60) drawDecor(ctx, d, camY, time);
  // 5) above a map tower's summit: its open top (roof, surface, sky, bedroom)
  if (MAP.summit != null && sTop > -10) drawCrown(ctx, themeIndexForFloor(MAP.summit), sTop, time);
  // 6) per-theme ambient motion (petals, bubbles)
  if (midTi > 6) themeOverlay(ctx, midTi, camY, time);
}

function drawOutside(ctx, wn, camY, time) {
  const ti = themeAtY(wn.y + wn.h / 2), TD = THEME_DEFS[ti];
  if (TD.water || TD.indoor) return drawOutsideV3(ctx, wn, camY, time, ti, TD);
  const f = wn.y / FLOOR_GAP, S = skyAt(skyFloor(f)), TH = theme(ti), sh = shared();
  const x0 = wn.x - wn.w / 2, w = wn.w, top = wn.st, bottom = wn.sb;
  ctx.save();
  const p = new Path2D(); winPath(p, wn, wn.shape || 'arch'); ctx.clip(p);
  const gr = ctx.createLinearGradient(0, top, 0, bottom);
  gr.addColorStop(0, S.top); gr.addColorStop(1, S.bot);
  ctx.fillStyle = gr; ctx.fillRect(x0, top, w, wn.h);
  if (S.stars > 0 || ti === 6) {
    ctx.globalAlpha = Math.max(S.stars, ti === 6 ? .8 : 0);
    const ox = (wn.seed * 37) % 200;
    ctx.drawImage(sh.stars.c, ox * RES, 0, w * RES, wn.h * RES, x0, top, w, wn.h);
    ctx.globalAlpha = 1;
  }
  const hs = hash(wn.seed, 3);
  if (S.night < .7 && ti !== 6) {                              // drifting clouds
    ctx.globalAlpha = 1 - S.night;
    for (let k = 0; k < 2; k++) {
      const cx = x0 - 60 + ((hash(wn.seed, k) * 400 + time * (5 + k * 3)) % (w + 100));
      const cy = top + 14 + k * 30 + hash(wn.seed, k + 5) * 20;
      ctx.drawImage(sh.cloud.c, cx, cy, 64 - k * 16, 27 - k * 7);
    }
    ctx.globalAlpha = 1;
  }
  if ((S.night > .4 && hs > .6) || (S.space > 0 && hs > .35) || (ti === 6 && hs > .45)) {
    const img = (S.space > .3 || ti === 6) ? sh.planet : sh.moon;
    ctx.drawImage(img.c, x0 + w * (.15 + hash(wn.seed, 4) * .4), top + 16, img.w * .8, img.h * .8);
  }
  if (ti === 2 && S.night > 0) {                               // aurora
    ctx.globalAlpha = .45 * S.night;
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = k ? '#8fe6ff' : '#7dffb0';
      ctx.beginPath();
      const yb = top + 30 + k * 18;
      ctx.moveTo(x0, yb);
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x0 + x, yb + Math.sin(x * .06 + time * .8 + k) * 8);
      for (let x = w; x >= 0; x -= 8) ctx.lineTo(x0 + x, yb + 14 + Math.sin(x * .05 + time * .6 + k) * 6);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // landscape: distant, so it slides against the frame as the window scrolls (parallax)
  const rel = -(bottom - VIEW_H * .5) * .22;
  const landBottom = bottom + 26 + rel;
  const srcX = clamp(wn.x - w / 2 + (hash(wn.seed, 6) - .5) * 120, 0, VIEW_W - w);
  ctx.drawImage(TH.land.land.c, srcX * RES, 0, w * RES, LAND_H * RES, x0, landBottom - LAND_H, w, LAND_H);
  if (S.night > 0) {
    ctx.fillStyle = `rgba(18,20,56,${(.55 * S.night).toFixed(3)})`;
    ctx.fillRect(x0, top, w, wn.h);
  }
  if (TH.land.lights) {
    ctx.globalAlpha = ti === 3 ? .5 + .5 * S.night + .1 * Math.sin(time * 3) : Math.max(.15, S.night);
    ctx.drawImage(TH.land.lights.c, srcX * RES, 0, w * RES, LAND_H * RES, x0, landBottom - LAND_H, w, LAND_H);
    ctx.globalAlpha = 1;
  }
  if (ti === 3) {                                              // embers
    ctx.fillStyle = '#ffb03a';
    for (let k = 0; k < 7; k++) {
      const ex = x0 + hash(wn.seed, 10 + k) * w + Math.sin(time * 2 + k) * 4;
      const ey = bottom - ((time * (18 + k * 3) + hash(wn.seed, 20 + k) * wn.h) % wn.h);
      ctx.fillRect(ex, ey, 2, 2);
    }
  }
  // glass glint
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x0 + 10, top + w * .55); ctx.lineTo(x0 + 22, top + w * .35); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x0 + 12, top + w * .72); ctx.lineTo(x0 + 18, top + w * .62); ctx.stroke();
  ctx.restore();
}

function drawFrame(ctx, wn) {
  const T = THEME_DEFS[themeAtY(wn.y + wn.h / 2)];
  if (wn.shape === 'round' || wn.shape === 'rect') return drawFrameV3(ctx, wn, T);
  const x0 = wn.x - wn.w / 2, p = new Path2D();
  archPath(p, x0, wn.st, wn.w, wn.sb);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.stroke(p);
  ctx.lineWidth = 9; ctx.strokeStyle = T.frame; ctx.stroke(p);
  ctx.lineWidth = 3; ctx.strokeStyle = T.frameDk;
  ctx.save(); ctx.translate(1.5, 1.5); ctx.stroke(p); ctx.restore();
  if (T.id === 'dojo' || T.id === 'frost') {                    // muntins
    ctx.lineWidth = 3; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(wn.x, wn.st + 2); ctx.lineTo(wn.x, wn.sb); ctx.moveTo(x0, wn.sb - wn.h * .45); ctx.lineTo(x0 + wn.w, wn.sb - wn.h * .45); ctx.stroke();
    ctx.lineWidth = 1.6; ctx.strokeStyle = T.frame; ctx.stroke();
  }
  // keystone
  ctx.beginPath(); ctx.moveTo(wn.x - 7, wn.st - 7); ctx.lineTo(wn.x + 7, wn.st - 7); ctx.lineTo(wn.x + 5, wn.st + 6); ctx.lineTo(wn.x - 5, wn.st + 6); ctx.closePath();
  ctx.fillStyle = T.frame; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  // sill
  rr(ctx, x0 - 12, wn.sb - 2, wn.w + 24, 9, 3);
  ctx.fillStyle = T.frame; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = T.frameDk; ctx.fillRect(x0 - 10, wn.sb + 3.5, wn.w + 20, 2.5);
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x0 - 8, wn.sb + 7, wn.w + 16, 5);
}

function drawDecor(ctx, d, camY, time) {
  const s = sy(d.y, camY);
  if (s < -130 || s > VIEW_H + 60) return;
  const ti = themeAtY(d.y), C = theme(ti), T = C.T;
  const kind = T.decor[(d.k * T.decor.length) | 0];
  let sp = C.decor[kind]; if (!sp) return;
  if (Array.isArray(sp)) sp = sp[(hash(d.seed, 7) * sp.length) | 0];
  const { S, ax, ay } = sp;
  if (ti > 6 && drawDecorV3(ctx, kind, S, ax, ay, d, s, time)) return;
  if (kind === 'lantern') {
    ctx.save(); ctx.translate(d.x, s - 30); ctx.rotate(Math.sin(time * 1.4 + d.seed) * .08);
    ctx.drawImage(S.c, -ax, -ay, S.w, S.h); ctx.restore();
    return;
  }
  const yy = (kind === 'banner' || kind === 'scroll' || kind === 'vine' || kind === 'chain') ? s - 70 : s;
  ctx.drawImage(S.c, d.x - ax, yy - ay, S.w, S.h);
  if (kind === 'torch' || kind === 'bluetorch') {
    const fl = Math.sin(time * 13 + d.seed) * .12 + Math.sin(time * 7.3 + d.seed * 2) * .08;
    const [o, m, c] = kind === 'bluetorch' ? ['#3a86c8', '#8fe6ff', '#ffffff'] : ['#e4553f', '#ffb43d', '#fff3b0'];
    const fx = d.x, fy = yy - ay + 9;
    ctx.globalAlpha = .18; ctx.fillStyle = m; ctx.beginPath(); ctx.arc(fx, fy - 8, 22 + fl * 20, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    flame(ctx, fx, fy, 9, 20 * (1 + fl), o, true);
    flame(ctx, fx, fy - 1, 5.5, 13 * (1 - fl * .6), m, false);
    flame(ctx, fx, fy - 1, 2.8, 6, c, false);
  } else if (kind === 'neon') {
    const words = ['CAPY', 'OPEN', 'HOP!', '24/7', 'UP UP'];
    const w = words[(hash(d.seed, 1) * words.length) | 0];
    const col = ['#ff3fd0', '#7ff3ff', '#ffd166', '#7be08a'][(hash(d.seed, 2) * 4) | 0];
    const on = (Math.sin(time * 23 + d.seed) > -.93) && !(hash(Math.floor(time * 3), d.seed) > .97);
    ctx.font = `900 17px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = on ? col : '#3a3a4a'; ctx.globalAlpha = on ? .35 : 1;
    ctx.strokeText(w, d.x, yy + 1); ctx.globalAlpha = 1;
    ctx.fillStyle = on ? '#ffffff' : '#555a6a'; ctx.fillText(w, d.x, yy + 1);
    ctx.lineWidth = 1.5; ctx.strokeStyle = on ? col : '#3a3a4a'; ctx.strokeText(w, d.x, yy + 1);
  } else if (kind === 'orb') {
    const pu = .5 + .5 * Math.sin(time * 2.4 + d.seed);
    const oy = yy - ay + 22;
    ctx.globalAlpha = .2 + .15 * pu; ctx.fillStyle = '#8fe6ff'; ctx.beginPath(); ctx.arc(d.x, oy, 18 + pu * 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(d.x, oy, 9, 0, 7); ctx.fillStyle = '#bff6ff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(d.x - 3, oy - 3, 2.5, 0, 7); ctx.fill();
  }
}
function flame(ctx, x, y, w, h, col, ink) {
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.bezierCurveTo(x + w * .3, y - h * .55, x + w, y - h * .35, x + w * .75, y - h * .05);
  ctx.quadraticCurveTo(x, y + w * .45, x - w * .75, y - h * .05);
  ctx.bezierCurveTo(x - w, y - h * .35, x - w * .3, y - h * .55, x, y - h);
  ctx.fillStyle = col; ctx.fill();
  if (ink) { ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
}

export function drawPlatform(ctx, plat, camY, time) {
  if (!plat) return;
  const top = sy(plat.n * FLOOR_GAP, camY);
  if (top > VIEW_H + 24 || top < -PLAT_H - 60) return;
  const ti = themeIndexForFloor(plat.n), C = theme(ti), T = C.T, P = C.plat;
  const x0 = Math.max(plat.x0, WALL_W - 6), x1 = Math.min(plat.x1, VIEW_W - WALL_W + 6), w = x1 - x0;
  if (w <= 0) return;
  const full = plat.n % MAP.span === 0;
  const kind = plat.kind || 'normal';
  if (kind === 'jelly') return drawJelly(ctx, plat, x0, x1, top, time);
  if (kind === 'cloud') return drawCloudPlat(ctx, plat, x0, x1, top, time);
  if (kind === 'conveyor') return drawConveyor(ctx, plat, x0, x1, top, time);
  if (kind === 'spring') return drawSpring(ctx, plat, x0, x1, top, time);

  if (plat.n === 0) {                                         // ground: solid foundation to the screen bottom
    const yb = top + PLAT_H;
    if (yb < VIEW_H) {
      ctx.fillStyle = '#5f626b'; ctx.fillRect(0, yb, VIEW_W, VIEW_H - yb);
      ctx.save(); ctx.beginPath(); ctx.rect(0, yb, VIEW_W, VIEW_H - yb); ctx.clip();
      ctx.globalAlpha = .55; ctx.drawImage(C.back.c, 0, yb, VIEW_W, TILE_H); ctx.drawImage(C.back.c, 0, yb + TILE_H, VIEW_W, TILE_H);
      ctx.restore(); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(20,16,30,.35)'; ctx.fillRect(0, yb, VIEW_W, VIEW_H - yb);
    }
  }
  // hard cel drop shadow on the back wall
  ctx.fillStyle = 'rgba(15,10,25,.28)';
  ctx.fillRect(x0 + 7, top + PLAT_H, w - 4, 7);

  // texture offset per floor, so neighbouring platforms don't repeat the same tufts
  const off = full ? 0 : Math.floor(hash(plat.n, 99) * Math.max(0, VIEW_W - w - 8)) - x0 + 4;
  // hanging bits
  const ux0 = x0 + 6, uw = w - 12;
  if (uw > 0) ctx.drawImage(P.under.c, (ux0 + off) * RES, 0, uw * RES, P.under.c.height, ux0, top + PLAT_H - 1, uw, 16);

  // slab
  ctx.save();
  rr(ctx, x0, top, w, PLAT_H, 5); ctx.clip();
  ctx.drawImage(P.body.c, (x0 + off) * RES, 0, w * RES, P.body.c.height, x0, top, w, PLAT_H);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x1 - 6, top, 6, PLAT_H);
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x0, top, 4, PLAT_H);
  if (ti === 4) {                                             // neon strip
    const col = plat.n % 2 ? '#7ff3ff' : '#ff3fd0';
    const on = !(hash(Math.floor(time * 4), plat.n) > .985);
    ctx.fillStyle = on ? col : '#3a3f52'; ctx.fillRect(x0, top, w, 5);
    if (on) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x0, top + 1.5, w, 1.5); }
  } else if (ti === 3) {
    ctx.globalAlpha = .35 + .3 * Math.sin(time * 3 + plat.n);
    ctx.fillStyle = '#ffd36a'; ctx.fillRect(x0, top + PLAT_H - 3, w, 3); ctx.globalAlpha = 1;
  } else if (ti === 6) {
    ctx.globalAlpha = .3 + .3 * Math.sin(time * 2 + plat.n * .7);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x0, top, w, 3); ctx.globalAlpha = 1;
  }
  ctx.restore();
  rr(ctx, x0, top, w, PLAT_H, 5);
  ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  if (ti === 4) {                                             // neon glow above the lip
    ctx.globalAlpha = .25; ctx.fillStyle = plat.n % 2 ? '#7ff3ff' : '#ff3fd0';
    ctx.fillRect(x0 + 2, top - 8, w - 4, 8); ctx.globalAlpha = .15; ctx.fillRect(x0 + 6, top - 14, w - 12, 6); ctx.globalAlpha = 1;
  }
  // top decoration (tufts, snow lumps, gumdrops)
  const tx0 = x0 + 4, tw = w - 8;
  if (tw > 0) ctx.drawImage(P.top.c, (tx0 + off) * RES, 0, tw * RES, P.top.c.height, tx0, top - 11, tw, 12);

  if (kind === 'geyser') drawGeyser(ctx, plat, x0, x1, top, time);
  if (kind === 'summit') drawSummit(ctx, T, top, time);
  else if (plat.n > 0 && full) drawBanner(ctx, T, plat.n, top);
  else if (plat.n > 0 && plat.n % 10 === 0) drawSign(ctx, T, plat.n, (x0 + x1) / 2, top);
}

function drawSign(ctx, T, n, cx, top) {
  const y = top + PLAT_H + 7, w = n >= 100 ? 50 : 42, h = 22;
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - w / 2 + 7, top + PLAT_H); ctx.lineTo(cx - w / 2 + 7, y + 2); ctx.moveTo(cx + w / 2 - 7, top + PLAT_H); ctx.lineTo(cx + w / 2 - 7, y + 2); ctx.stroke();
  rr(ctx, cx - w / 2, y, w, h, 4); ctx.fillStyle = T.sign; ctx.fill();
  ctx.fillStyle = T.signDk; ctx.fillRect(cx - w / 2 + 2, y + h - 5, w - 4, 3);
  rr(ctx, cx - w / 2, y, w, h, 4); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.font = `900 14px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3; ctx.strokeStyle = T.signDk; ctx.strokeText(String(n), cx, y + h / 2);
  ctx.fillStyle = T.signText; ctx.fillText(String(n), cx, y + h / 2);
}

function drawBanner(ctx, T, n, top) {
  const cx = VIEW_W / 2, w = 250, h = 44, y = top + PLAT_H + 8;
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(cx - w / 2 + 14, top + PLAT_H); ctx.lineTo(cx - w / 2 + 14, y + 3); ctx.moveTo(cx + w / 2 - 14, top + PLAT_H); ctx.lineTo(cx + w / 2 - 14, y + 3); ctx.stroke();
  // ribbon tails
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * (w / 2 - 6), y + 8); ctx.lineTo(cx + s * (w / 2 + 18), y + 10); ctx.lineTo(cx + s * (w / 2 + 10), y + 22);
    ctx.lineTo(cx + s * (w / 2 + 18), y + 34); ctx.lineTo(cx + s * (w / 2 - 6), y + 34); ctx.closePath();
    ctx.fillStyle = T.bannerTrim; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  }
  rr(ctx, cx - w / 2, y, w, h, 6); ctx.fillStyle = T.banner; ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(cx - w / 2 + 3, y + h - 7, w - 6, 4);
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(cx - w / 2 + 4, y + 3, w - 8, 3);
  rr(ctx, cx - w / 2, y, w, h, 6); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 19px ${FONT}`;
  ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText('FLOOR ' + n, cx, y + 16);
  ctx.fillStyle = '#ffffff'; ctx.fillText('FLOOR ' + n, cx, y + 16);
  ctx.font = `800 11px ${FONT}`;
  ctx.fillStyle = T.bannerTrim; ctx.fillText(T.name.toUpperCase(), cx, y + 34);
}

export function drawSideWalls(ctx, camY, time) {
  const sTop = sy(summitY(), camY), capped = sTop > -60;
  if (capped) { ctx.save(); ctx.beginPath(); ctx.rect(0, sTop, VIEW_W, VIEW_H - sTop + 2); ctx.clip(); }
  // hard shadows the walls throw onto the back wall
  ctx.fillStyle = 'rgba(15,10,25,.3)';
  ctx.fillRect(WALL_W, 0, 8, VIEW_H); ctx.fillRect(VIEW_W - WALL_W - 8, 0, 8, VIEW_H);
  themedFill(ctx, i => theme(i).side, 0, WALL_W, camY);
  ctx.save(); ctx.translate(VIEW_W, 0); ctx.scale(-1, 1);
  themedFill(ctx, i => theme(i).side, 0, WALL_W, camY);
  ctx.restore();
  if (capped) { ctx.restore(); drawWallCaps(ctx, themeIndexForFloor(MAP.summit), sTop, time); }
}

// ============================================================================
//  Map towers (v3): Sakura Springs (7), Coral Reef Spire (8), Cloud Carnival
//  (9), Clockwork Toybox (10). Same rules as the classic themes: everything
//  static is painted once into offscreen canvases; per frame only cheap paths.
// ============================================================================
const SAKURA = ['#ffb3cf', '#ffc6da', '#ff9ec2'];
const FLAGS = ['#e8384f', '#ffd166', '#5fd6e8', '#7be08a', '#ff8fb8', '#8f7cf0'];
const TOY = ['#e8384f', '#3a6fd8', '#ffd166', '#5fbf5a', '#ff8a3d', '#8f5ad6'];

function blossom(g, x, y, s, c = SAKURA[0]) {
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * Math.PI * 2 - Math.PI / 2;
    g.beginPath(); g.ellipse(x + Math.cos(a) * s * .62, y + Math.sin(a) * s * .62, s * .55, s * .42, a, 0, 7);
    g.fillStyle = c; g.fill(); g.lineWidth = 1; g.strokeStyle = '#b8507a'; g.stroke();
  }
  g.beginPath(); g.arc(x, y, s * .3, 0, 7); g.fillStyle = '#ff5f95'; g.fill();
  g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(x, y, s * .12, 0, 7); g.fill();
}
function onsenMark(g, x, y, s, col) {
  // the hot-spring symbol: a bowl with three wavy steam lines
  g.strokeStyle = col; g.lineWidth = s * .16; g.lineCap = 'round';
  g.beginPath(); g.ellipse(x, y + s * .35, s * .7, s * .32, 0, 0, Math.PI); g.stroke();
  for (const dx of [-.38, 0, .38]) {
    g.beginPath(); g.moveTo(x + dx * s, y + s * .2);
    g.bezierCurveTo(x + dx * s - s * .2, y - s * .1, x + dx * s + s * .2, y - s * .3, x + dx * s, y - s * .62); g.stroke();
  }
}
function capySoak(g, x, y, s) {
  // a capybara up to its chin in water, folded towel on its head
  capyHead(g, x, y, s, null);
  rr(g, x - s * .7, y - s * 1.15, s * 1.4, s * .42, s * .12); inked(g, '#ffffff', 1.2);
  g.fillStyle = '#d9e6ee'; g.fillRect(x - s * .62, y - s * .86, s * 1.24, s * .1);
}
function coil(g, x, yTop, yBot, w, ink = INK, col = '#c9ced6') {
  const h = Math.max(2, yBot - yTop), n = 4;
  for (const [lw, c] of [[4, ink], [2, col]]) {
    g.lineWidth = lw; g.strokeStyle = c; g.beginPath(); g.moveTo(x - w / 2, yBot);
    for (let k = 0; k < n; k++) {
      const y0 = yBot - (k + .5) * h / n, y1 = yBot - (k + 1) * h / n;
      g.lineTo(x + w / 2, y0); g.lineTo(x - w / 2, y1);
    }
    g.stroke();
  }
}

// ------------------------------------------------------------ back walls
function paintBackV3(i, g, W, H, r) {
  switch (i) {
    case 7: {                                                    // ryokan: plaster + timber + cedar wainscot
      for (const b of [0, 84]) {
        g.fillStyle = '#f2e6d0'; g.fillRect(0, b, W, 52);
        for (let k = 0; k < 60; k++) { g.fillStyle = r() > .5 ? '#e8d9bf' : '#f8efdf'; g.fillRect(r() * W, b + 10 + r() * 40, 2, 2); }
        for (let k = 0; k < 3; k++) { g.globalAlpha = .28; blossom(g, 40 + r() * (W - 80), b + 22 + r() * 22, 6, SAKURA[k % 3]); g.globalAlpha = 1; }
        for (let x = 0, k = 0; x < W; x += 12, k++) {
          g.fillStyle = k % 2 ? '#74462a' : '#7e4e2e'; g.fillRect(x, b + 52, 12, 32);
          g.fillStyle = '#4a2a16'; g.fillRect(x + 10, b + 52, 2, 32);
          g.fillStyle = '#946240'; g.fillRect(x + 1, b + 54, 1.5, 28);
        }
        g.fillStyle = '#5a3a24'; g.fillRect(0, b + 50, W, 6); g.fillStyle = INK; g.fillRect(0, b + 49.5, W, 1.3); g.fillRect(0, b + 55.5, W, 1.3);
        g.fillStyle = '#5a3a24'; g.fillRect(0, b, W, 9);
        g.fillStyle = '#7a5236'; g.fillRect(0, b + 1.5, W, 2);
        g.fillStyle = INK; g.fillRect(0, b, W, 1.3); g.fillRect(0, b + 8, W, 1.3);
      }
      for (const x of [0, 120, 240, 360]) {
        g.fillStyle = '#5a3a24'; g.fillRect(x, 0, 10, H);
        g.fillStyle = '#7a5236'; g.fillRect(x + 2, 0, 2, H);
        g.fillStyle = INK; g.fillRect(x - .5, 0, 1.3, H); g.fillRect(x + 9.5, 0, 1.3, H);
      }
      break;
    }
    case 8: {                                                    // porous coral rock
      g.fillStyle = '#2b6a83'; g.fillRect(0, 0, W, H);
      const cols = ['#2f7590', '#2a6680', '#357d98', '#285f78', '#31708a'];
      for (let k = 0; k < 60; k++) {
        const x = r() * W, y = r() * H, rad = 16 + r() * 22, c = cols[(r() * cols.length) | 0];
        wrapY(H, y, rad + 2, yy => {
          g.beginPath(); g.ellipse(x, yy, rad * 1.3, rad, 0, 0, 7); g.fillStyle = c; g.fill();
          g.lineWidth = 1.2; g.strokeStyle = 'rgba(12,38,52,.22)'; g.stroke();
          g.fillStyle = 'rgba(160,230,245,.07)'; g.beginPath(); g.ellipse(x - rad * .3, yy - rad * .4, rad * .6, rad * .3, 0, 0, 7); g.fill();
        });
      }
      for (let k = 0; k < 40; k++) { g.fillStyle = '#16404f'; g.beginPath(); g.ellipse(r() * W, r() * H, 2 + r() * 2.5, 1.5 + r() * 1.5, 0, 0, 7); g.fill(); }
      for (let k = 0; k < 10; k++) {                             // little polyp clusters
        const x = r() * W, y = 8 + r() * (H - 16), c = ['#ff8fb8', '#ffb06a', '#c9a0ff'][(r() * 3) | 0];
        for (let j = 0; j < 5; j++) { g.beginPath(); g.arc(x + (r() - .5) * 12, y + (r() - .5) * 8, 2.2, 0, 7); inked(g, c, .9, '#5a2a3a'); }
      }
      g.strokeStyle = 'rgba(180,240,255,.16)'; g.lineWidth = 1.5;
      for (let k = 0; k < 14; k++) {
        const x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y);
        g.bezierCurveTo(x + 10, y - 6, x + 20, y + 6, x + 32, y); g.stroke();
      }
      break;
    }
    case 9: {                                                    // open-air scaffold, transparent between
      const poles = [120, 360];
      const rope = (y, sag, pts, flags) => {
        const xs = [WALL_W - 6, ...poles, W - WALL_W + 6];
        for (let s2 = 0; s2 < xs.length - 1; s2++) {
          const a = xs[s2], b = xs[s2 + 1], mx = (a + b) / 2;
          g.strokeStyle = INK; g.lineWidth = 2.2; g.beginPath(); g.moveTo(a, y); g.quadraticCurveTo(mx, y + sag * 2, b, y); g.stroke();
          g.strokeStyle = '#fff6ec'; g.lineWidth = 1; g.stroke();
          for (let k = 1; k < pts; k++) {
            const t = k / pts, x = lerp(lerp(a, mx, t), lerp(mx, b, t), t), yy = lerp(lerp(y, y + sag * 2, t), lerp(y + sag * 2, y, t), t);
            if (flags) {
              g.beginPath(); g.moveTo(x - 6, yy); g.lineTo(x + 6, yy); g.lineTo(x, yy + 13); g.closePath(); inked(g, FLAGS[(k + s2) % FLAGS.length], 1.4);
            } else {
              g.beginPath(); g.arc(x, yy + 4, 3.6, 0, 7); inked(g, ['#ffe08a', '#ff8fb8', '#8fe6ff'][(k + s2) % 3], 1.2);
            }
          }
        }
      };
      rope(30, 14, 7, true);
      for (const px of poles) {                                  // barber-striped scaffold poles
        g.fillStyle = '#fff6ec'; g.fillRect(px - 6, 0, 12, H);
        g.save(); g.beginPath(); g.rect(px - 6, 0, 12, H); g.clip();
        g.fillStyle = '#e8384f';
        for (let y = -24; y < H + 24; y += 21) { g.beginPath(); g.moveTo(px - 6, y); g.lineTo(px + 6, y - 9); g.lineTo(px + 6, y - 2); g.lineTo(px - 6, y + 7); g.closePath(); g.fill(); }
        g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(px + 2, 0, 4, H);
        g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(px - 4, 0, 2, H);
        g.restore();
        g.fillStyle = INK; g.fillRect(px - 7, 0, 1.5, H); g.fillRect(px + 5.5, 0, 1.5, H);
      }
      break;
    }
    case 10: {                                                   // nursery wallpaper + dado rail
      g.fillStyle = '#bfe0f5'; g.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += 48) { g.fillStyle = '#b0d6ef'; g.fillRect(x, 0, 24, H); }
      for (let y = 10, row = 0; y < 116; y += 26, row++) {
        for (let x = (row % 2) * 24 + 12; x < W; x += 48) {
          if ((x + y) % 3 === 0) star4(g, x, y, 2.6, '#ffd166');
          else { g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fillStyle = row % 2 ? '#ff8fb8' : '#ffffff'; g.fill(); }
        }
      }
      g.fillStyle = '#f7d98e'; g.fillRect(0, 132, W, 36);
      for (let x = 10; x < W; x += 60) { rr(g, x, 138, 46, 24, 3); g.fillStyle = '#fbe6b0'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#c99a3a'; g.stroke(); }
      g.fillStyle = '#c98a52'; g.fillRect(0, 120, W, 12);
      g.fillStyle = '#e0a868'; g.fillRect(0, 121.5, W, 3);
      g.fillStyle = INK; g.fillRect(0, 119.5, W, 1.4); g.fillRect(0, 131.3, W, 1.4);
      break;
    }
  }
}

// ------------------------------------------------------------ side walls (left; mirrored for right)
function paintSideV3(i, g, W, H, r) {
  switch (i) {
    case 7: {
      g.fillStyle = '#5a3a24'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#6f4a2e'; g.lineWidth = 1.2;
      for (let k = 0; k < 7; k++) { const x = 4 + r() * (W - 14); g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 3, H * .3, x - 3, H * .6, x, H); g.stroke(); }
      g.fillStyle = '#8a5f3c'; g.fillRect(6, 0, 4, H);
      g.fillStyle = '#3e2616'; g.fillRect(W - 12, 0, 8, H);
      for (const by of [36, 120]) {
        g.fillStyle = '#c9a14a'; g.fillRect(0, by, W, 9);
        g.fillStyle = '#f0d27a'; g.fillRect(0, by + 1.5, W, 2);
        g.fillStyle = INK; g.fillRect(0, by - .5, W, 1.3); g.fillRect(0, by + 8.5, W, 1.3);
        for (const x of [8, 22]) { g.beginPath(); g.arc(x, by + 4.5, 1.6, 0, 7); g.fillStyle = '#7a5a1e'; g.fill(); }
      }
      break;
    }
    case 8: {
      g.fillStyle = '#e8846a'; g.fillRect(0, 0, W, H);
      for (let k = 0; k < 60; k++) {
        const x = r() * W, y = r() * H, rad = 3 + r() * 6;
        wrapY(H, y, rad + 1, yy => {
          g.beginPath(); g.arc(x, yy, rad, 0, 7); g.fillStyle = r() > .5 ? '#f5a08a' : '#d9705a'; g.fill();
          g.lineWidth = 1; g.strokeStyle = 'rgba(90,30,30,.4)'; g.stroke();
        });
      }
      for (let k = 0; k < 18; k++) { g.fillStyle = '#9a3f36'; g.beginPath(); g.arc(r() * W, r() * H, 1.6, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(W - 12, 0, 8, H);
      break;
    }
    case 9: {
      for (let y = 0, k = 0; y < H; y += 21, k++) {
        g.fillStyle = k % 2 ? '#ffd166' : '#3a8fd8'; g.fillRect(0, y, W, 21);
        g.fillStyle = INK; g.fillRect(0, y, W, 1.2);
      }
      g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(6, 0, 4, H);
      g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(W - 12, 0, 8, H);
      for (let y = 10; y < H; y += 42) { g.beginPath(); g.arc(W - 16, y, 2.2, 0, 7); inked(g, '#f2d27a', 1); }
      break;
    }
    case 10: {
      const shapes = ['star', 'circle', 'tri', 'heart'];
      for (let y = 0, k = 0; y < H; y += 42, k++) {
        const c = TOY[k % 4];
        g.fillStyle = c; g.fillRect(0, y, W, 42);
        g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, y + 36, W, 6); g.fillRect(W - 10, y, 6, 42);
        g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(2, y + 2, W - 14, 3);
        const cx = W / 2 - 3, cy = y + 19, sh = shapes[k % 4];
        g.beginPath();
        if (sh === 'circle') g.arc(cx, cy, 8, 0, 7);
        else if (sh === 'tri') { g.moveTo(cx, cy - 9); g.lineTo(cx + 9, cy + 7); g.lineTo(cx - 9, cy + 7); g.closePath(); }
        else if (sh === 'heart') { g.moveTo(cx, cy + 8); g.bezierCurveTo(cx - 13, cy - 2, cx - 6, cy - 12, cx, cy - 4); g.bezierCurveTo(cx + 6, cy - 12, cx + 13, cy - 2, cx, cy + 8); }
        else { for (let a = 0; a < 10; a++) { const rad = a % 2 ? 4 : 9, an = -Math.PI / 2 + a * Math.PI / 5; g.lineTo(cx + Math.cos(an) * rad, cy + Math.sin(an) * rad); } g.closePath(); }
        g.fillStyle = 'rgba(255,255,255,.75)'; g.fill(); g.lineWidth = 1.3; g.strokeStyle = INK; g.stroke();
        g.fillStyle = INK; g.fillRect(0, y + 40.5, W, 1.6); g.fillRect(0, y, W, 1);
      }
      break;
    }
  }
}

// ------------------------------------------------------------ platform strips
function paintPlatV3(i, g, t, u, W, H, r, band) {
  switch (i) {
    case 7: {                                                    // polished cedar planks
      band(0, H, '#f0bd80'); band(H - 5, 5, '#b8803f'); band(4, 2, '#ffdcaa'); band(0, 3, '#ffe6c2');
      g.strokeStyle = 'rgba(138,90,46,.45)'; g.lineWidth = 1;
      for (let k = 0; k < 40; k++) { const x = r() * W, y = 6 + r() * 6; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 8, y - 2, x + 16, y + 2, x + 26, y); g.stroke(); }
      for (let x = 30 + r() * 30; x < W; x += 44 + r() * 30) {
        g.fillStyle = '#8a5a2e'; g.fillRect(x, 0, 2, H);
        g.fillStyle = '#6b6f78'; g.beginPath(); g.arc(x - 4, 9, 1.3, 0, 7); g.arc(x + 6, 9, 1.3, 0, 7); g.fill();
      }
      for (let x = 6; x < W; x += 8 + r() * 26) {
        t.save(); t.translate(x, 10 + r() * 1.5); t.rotate(r() * 3);
        t.beginPath(); t.ellipse(0, 0, 3, 1.8, 0, 0, 7); t.fillStyle = SAKURA[(r() * 3) | 0]; t.fill();
        t.lineWidth = .8; t.strokeStyle = '#b8507a'; t.stroke(); t.restore();
      }
      for (let x = 24; x < W; x += 46) {                         // rafter ends under the boards
        rr(u, x - 4, 0, 8, 8, 2); inked(u, '#5a3a24', 1.2);
        u.fillStyle = '#e9c58e'; u.fillRect(x - 2, 5, 4, 1.4);
      }
      break;
    }
    case 8: {                                                    // coral shelf
      band(0, H, '#ff8a6a'); band(H - 5, 5, '#d9604a');
      for (let k = 0; k < 90; k++) { g.beginPath(); g.arc(r() * W, 3 + r() * (H - 6), 1.5 + r() * 2.5, 0, 7); g.fillStyle = r() > .5 ? '#ffa58a' : '#e8725a'; g.fill(); }
      for (let k = 0; k < 50; k++) { g.fillStyle = '#b84a3a'; g.beginPath(); g.arc(r() * W, 3 + r() * (H - 6), 1, 0, 7); g.fill(); }
      band(0, 2.5, '#ffc2ae');
      for (let x = 6; x < W; x += 7 + r() * 14) {
        if (r() > .82) {                                         // anemone
          for (let a = -1; a <= 1; a += .5) { t.strokeStyle = INK; t.lineWidth = 3; t.beginPath(); t.moveTo(x, 12); t.lineTo(x + a * 5, 4); t.stroke(); t.strokeStyle = '#ff8fd0'; t.lineWidth = 1.6; t.stroke(); }
          t.beginPath(); t.arc(x, 11, 3, Math.PI, 0); inked(t, '#c95aa0', 1);
        } else {
          const h = 5 + r() * 6; t.strokeStyle = INK; t.lineWidth = 3; t.beginPath(); t.moveTo(x, 12); t.quadraticCurveTo(x + 3, 12 - h / 2, x + (r() - .5) * 4, 12 - h); t.stroke();
          t.strokeStyle = r() > .5 ? '#3fb3a0' : '#5fd6b0'; t.lineWidth = 1.6; t.stroke();
        }
      }
      for (let x = 14; x < W; x += 20 + r() * 34) {
        const l = 4 + r() * 9;
        rr(u, x - 2.5, -2, 5, l + 2, 2.5); inked(u, r() > .5 ? '#ff9a6a' : '#c9a0ff', 1.1);
        if (r() > .6) { u.beginPath(); u.arc(x + 5, l + 1, 1.8, 0, 7); u.lineWidth = 1; u.strokeStyle = 'rgba(255,255,255,.8)'; u.stroke(); }
      }
      break;
    }
    case 9: {                                                    // fairground boards with bunting
      band(0, H, '#d9975a'); band(H - 4, 4, '#9a6232'); band(0, 4, '#e8384f'); band(4, 1.5, '#fff6ec');
      for (let x = 20 + r() * 10; x < W; x += 30) { g.fillStyle = '#a86a36'; g.fillRect(x, 5.5, 1.6, H - 9); g.fillStyle = '#6b4220'; g.beginPath(); g.arc(x - 5, 11, 1.2, 0, 7); g.fill(); }
      for (let x = 0; x < W; x += 16) { g.fillStyle = (x / 16) % 2 ? '#ffd166' : '#5fd6e8'; g.fillRect(x, 1, 8, 2); }
      u.strokeStyle = INK; u.lineWidth = 1.4; u.beginPath(); u.moveTo(0, 1.5); u.lineTo(W, 1.5); u.stroke();
      for (let x = 4, k = 0; x < W; x += 14, k++) {
        u.beginPath(); u.moveTo(x, 1); u.lineTo(x + 11, 1); u.lineTo(x + 5.5, 12); u.closePath(); inked(u, FLAGS[k % FLAGS.length], 1.1);
      }
      break;
    }
    case 10: {                                                   // a row of letter blocks
      const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (let x = 0, k = 0; x < W; x += 18, k++) {
        const c = TOY[(r() * TOY.length) | 0];
        g.fillStyle = c; g.fillRect(x, 0, 18, H);
        g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + 3, 3, 12, 12);
        g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, H - 3, 18, 3); g.fillRect(x + 15, 0, 3, H);
        g.font = `900 10px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = c; g.fillText(L[(r() * 26) | 0], x + 9, 9.5);
        g.fillStyle = INK; g.fillRect(x, 0, 1.2, H);
      }
      band(0, 1.5, 'rgba(255,255,255,.6)');
      for (let x = 40 + r() * 60; x < W; x += 90 + r() * 90) {   // a marble or two on top
        t.beginPath(); t.arc(x, 8.5, 3.2, 0, 7); inked(t, ['#5fd6e8', '#ff8fb8', '#7be08a'][(r() * 3) | 0], 1.1);
        t.fillStyle = '#ffffff'; t.beginPath(); t.arc(x - 1, 7.5, 1, 0, 7); t.fill();
      }
      break;
    }
  }
}

// ------------------------------------------------------------ outside landscapes
function paintLandV3(i, g, W, H, r, hills, lights) {
  switch (i) {
    case 7: {                                                    // snowy peak, sakura hills, onsen pools
      const peak = (px, py, bw, col) => {
        g.beginPath(); g.moveTo(px - bw, 175); g.lineTo(px, py); g.lineTo(px + bw, 175); g.closePath(); inked(g, col, 2, '#5b6f98');
        g.beginPath(); g.moveTo(px, py);
        const d = (175 - py) * .3;
        g.lineTo(px + bw * d / (175 - py), py + d);
        for (let k = 3; k >= -3; k--) g.lineTo(px + k * bw * d / (175 - py) / 3, py + d + (k % 2 ? 7 : 0));
        g.closePath(); inked(g, '#f7fbff', 1.5, '#5b6f98');
      };
      peak(300, 30, 150, '#8aa0c8'); peak(90, 80, 110, '#7d93bd');
      hills(160, 30, 3, '#8bc070', INK, .9);
      for (let x = 10; x < W; x += 34 + r() * 30) {
        const y = 150 + r() * 14;
        g.strokeStyle = INK; g.lineWidth = 3.5; g.beginPath(); g.moveTo(x, y + 20); g.lineTo(x, y); g.stroke();
        g.strokeStyle = '#6b4228'; g.lineWidth = 1.8; g.stroke();
        for (const [dx, dy, rad] of [[-8, -4, 9], [8, -5, 9], [0, -12, 10]]) { g.beginPath(); g.arc(x + dx, y + dy, rad, 0, 7); inked(g, SAKURA[(r() * 3) | 0], 1.6); }
      }
      g.fillStyle = '#7c8a72'; g.fillRect(0, 186, W, 34); g.fillStyle = INK; g.fillRect(0, 185, W, 2);
      for (const px of [60, 180, 300, 420]) {
        for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; g.beginPath(); g.ellipse(px + Math.cos(a) * 46, 200 + Math.sin(a) * 13, 9, 6, 0, 0, 7); inked(g, ['#9aa0a8', '#8c9199', '#a7acb3'][k % 3], 1.3); }
        g.beginPath(); g.ellipse(px, 200, 40, 10, 0, 0, 7); inked(g, '#7fd6d0', 1.6);
        g.fillStyle = '#b8f0ea'; g.beginPath(); g.ellipse(px - 10, 197, 16, 3, 0, 0, 7); g.fill();
        for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(px - 26 + k * 16 + r() * 6, 202 + r() * 3, 3.2, 0, 7); inked(g, '#ffd23f', 1); }
        capySoak(g, px + (r() - .5) * 20, 196, 8);
        g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3;
        for (let k = 0; k < 3; k++) { const sx = px - 20 + k * 20; g.beginPath(); g.moveTo(sx, 186); g.bezierCurveTo(sx - 8, 176, sx + 8, 168, sx, 156); g.stroke(); }
      }
      break;
    }
    case 8: {                                                    // seabed: coral garden, turtle, chest
      hills(150, 40, 3, '#2f7fa8', '#215f80', 1.4);
      hills(178, 26, 4, '#2a6f95', '#1b4f6a', .3);
      g.fillStyle = '#f2d9a0'; g.fillRect(0, 196, W, 24); g.fillStyle = INK; g.fillRect(0, 195, W, 2);
      g.strokeStyle = '#d9b876'; g.lineWidth = 1.5;
      for (let k = 0; k < 20; k++) { const x = r() * W, y = 202 + r() * 14; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 3, x + 12, y); g.stroke(); }
      for (let x = 16; x < W; x += 30 + r() * 26) {
        const kind = r(), c = ['#ff8fb8', '#ffb06a', '#c9a0ff', '#ff6a6a'][(r() * 4) | 0];
        if (kind < .4) {                                         // branching coral
          const br = (x0, y0, a, l, d) => {
            const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l;
            g.strokeStyle = INK; g.lineWidth = 7 - d * 1.5; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
            g.strokeStyle = c; g.lineWidth = 4.6 - d * 1.5; g.stroke();
            if (d < 2) { br(x1, y1, a - .5, l * .7, d + 1); br(x1, y1, a + .45, l * .7, d + 1); }
          };
          br(x, 200, -Math.PI / 2, 20 + r() * 10, 0);
        } else if (kind < .65) {                                 // brain coral
          g.beginPath(); g.arc(x, 198, 12, Math.PI, 0); g.closePath(); inked(g, '#9fd06a', 1.6);
          g.strokeStyle = '#6fa04a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 8, 194); g.quadraticCurveTo(x, 186, x + 8, 194); g.stroke();
        } else {                                                 // sea grass
          for (let k = -2; k <= 2; k++) { g.strokeStyle = INK; g.lineWidth = 3.4; g.beginPath(); g.moveTo(x + k * 3, 200); g.quadraticCurveTo(x + k * 6, 180, x + k * 3 + 4, 166 + r() * 10); g.stroke(); g.strokeStyle = '#3fb37a'; g.lineWidth = 1.8; g.stroke(); }
        }
      }
      // sea turtle (left) and a half-buried chest (right)
      g.beginPath(); g.ellipse(120, 86, 26, 16, -.15, 0, 7); inked(g, '#6fae5a', 2);
      g.strokeStyle = '#4a7f3a'; g.lineWidth = 1.5; for (const [x, y] of [[112, 80], [126, 82], [118, 92]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.stroke(); }
      g.beginPath(); g.ellipse(150, 80, 10, 8, 0, 0, 7); inked(g, '#9fd07a', 1.8);
      g.fillStyle = INK; g.beginPath(); g.arc(154, 78, 1.8, 0, 7); g.fill();
      for (const [x, y, a] of [[104, 100, .8], [134, 100, -.6], [100, 74, -.9]]) { g.beginPath(); g.ellipse(x, y, 10, 4, a, 0, 7); inked(g, '#9fd07a', 1.5); }
      rr(g, 368, 184, 40, 16, 3); inked(g, '#a8743f', 1.8);
      g.beginPath(); g.moveTo(368, 186); g.quadraticCurveTo(388, 168, 408, 186); g.closePath(); inked(g, '#8a5a2e', 1.8);
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(376 + k * 6, 183, 3, 0, 7); inked(g, '#ffd23f', 1); }
      break;
    }
    case 9: {                                                    // fairground skyline
      hills(150, 22, 2, '#bfe3b0', '#8fbf80', .4);
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 120);
      for (let x = 0; x <= W; x += 6) g.lineTo(x, 120 + Math.sin(x * .03) * 26 - Math.max(0, Math.sin(x * .011)) * 30); g.stroke();
      g.strokeStyle = '#e8384f'; g.lineWidth = 1.6; g.stroke();
      for (let x = 10; x < W; x += 24) { g.strokeStyle = '#8a5a2e'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, 200); g.lineTo(x, 122 + Math.sin(x * .03) * 26 - Math.max(0, Math.sin(x * .011)) * 30); g.stroke(); }
      for (let k = 0; k < 6; k++) {                              // striped tents
        const x = 20 + k * 80 + r() * 20, w = 50 + r() * 20, h = 40 + r() * 20, y = 200;
        const ca = FLAGS[k % FLAGS.length];
        rr(g, x - w / 2, y - h * .55, w, h * .55, 2); inked(g, '#fff6ec', 1.8);
        for (let s2 = 0; s2 < 4; s2++) { g.fillStyle = ca; g.fillRect(x - w / 2 + s2 * w / 4 + 1, y - h * .55 + 1, w / 8, h * .55 - 2); }
        g.beginPath(); g.moveTo(x - w / 2 - 4, y - h * .55); g.lineTo(x, y - h); g.lineTo(x + w / 2 + 4, y - h * .55); g.closePath(); inked(g, ca, 1.8);
        g.fillStyle = INK; g.fillRect(x - 1, y - h - 12, 2, 12);
        g.beginPath(); g.moveTo(x + 1, y - h - 12); g.lineTo(x + 11, y - h - 8); g.lineTo(x + 1, y - h - 4); inked(g, '#ffd166', 1);
      }
      g.fillStyle = '#7cc05a'; g.fillRect(0, 200, W, 20); g.fillStyle = INK; g.fillRect(0, 199, W, 2);
      break;
    }
    case 10: {                                                   // the giant bedroom outside the box
      g.fillStyle = '#c98a52'; g.fillRect(0, 178, W, 42);
      for (let x = 0; x < W; x += 40) { g.fillStyle = '#b07840'; g.fillRect(x, 178, 2, 42); }
      g.fillStyle = INK; g.fillRect(0, 177, W, 2);
      g.beginPath(); g.ellipse(250, 202, 120, 14, 0, 0, 7); inked(g, '#ff8fb8', 1.8);
      g.beginPath(); g.ellipse(250, 202, 90, 9, 0, 0, 7); g.lineWidth = 2; g.strokeStyle = '#ffd1e2'; g.stroke();
      rr(g, -20, 96, 170, 90, 10); inked(g, '#5f86d8', 2);                // the bed
      for (let k = 0; k < 8; k++) star4(g, 10 + k * 18, 120 + (k % 2) * 22, 2.4, '#ffe08a');
      rr(g, -20, 84, 70, 26, 10); inked(g, '#ffffff', 2);
      rr(g, 140, 70, 14, 120, 4); inked(g, '#c98a52', 2);
      // teddy bear
      g.beginPath(); g.ellipse(320, 160, 30, 26, 0, 0, 7); inked(g, '#b9834c', 2);
      g.beginPath(); g.arc(320, 116, 22, 0, 7); inked(g, '#b9834c', 2);
      for (const s2 of [-1, 1]) { g.beginPath(); g.arc(320 + s2 * 18, 98, 8, 0, 7); inked(g, '#b9834c', 1.8); g.beginPath(); g.arc(320 + s2 * 18, 98, 4, 0, 7); g.fillStyle = '#e8b48a'; g.fill(); }
      g.beginPath(); g.ellipse(320, 124, 9, 7, 0, 0, 7); inked(g, '#e8c49a', 1.4);
      g.fillStyle = INK; g.beginPath(); g.arc(312, 112, 2.4, 0, 7); g.arc(328, 112, 2.4, 0, 7); g.arc(320, 121, 2.4, 0, 7); g.fill();
      g.beginPath(); g.moveTo(306, 136); g.lineTo(334, 136); g.lineTo(326, 144); g.lineTo(314, 144); g.closePath(); inked(g, '#e8384f', 1.4);
      // lamp + poster
      rr(g, 425, 90, 6, 90, 2); inked(g, '#8a8f99', 1.6);
      g.beginPath(); g.moveTo(404, 92); g.lineTo(452, 92); g.lineTo(442, 62); g.lineTo(414, 62); g.closePath(); inked(g, '#ffd166', 2);
      rr(g, 200, 20, 60, 70, 4); inked(g, '#fff6ec', 2);
      g.beginPath(); g.moveTo(230, 30); g.quadraticCurveTo(244, 50, 238, 74); g.lineTo(222, 74); g.quadraticCurveTo(216, 50, 230, 30); inked(g, '#e8384f', 1.5);
      g.beginPath(); g.arc(230, 52, 4, 0, 7); inked(g, '#8fe6ff', 1.2);
      lights = mk(W, H); const lg = lights.g;
      lg.fillStyle = 'rgba(255,220,120,.85)'; lg.beginPath(); lg.moveTo(404, 92); lg.lineTo(452, 92); lg.lineTo(442, 62); lg.lineTo(414, 62); lg.closePath(); lg.fill();
      lg.fillStyle = 'rgba(255,220,120,.25)'; lg.beginPath(); lg.moveTo(404, 92); lg.lineTo(452, 92); lg.lineTo(480, 180); lg.lineTo(376, 180); lg.closePath(); lg.fill();
      break;
    }
  }
  return lights;
}

// ------------------------------------------------------------ decor sprites
function paintDecorV3(kind, T, variant) {
  let S, ax, ay;
  switch (kind) {
    case 'chochin': {
      S = mk(30, 54); const g = S.g; ax = 15; ay = 2;
      g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(15, 0); g.lineTo(15, 9); g.stroke();
      rr(g, 8, 7, 14, 5, 1.5); inked(g, '#2a2420', 1.3);
      g.beginPath(); g.ellipse(15, 28, 12, 16, 0, 0, 7); inked(g, '#fff6ea', 2);
      g.strokeStyle = 'rgba(160,120,90,.5)'; g.lineWidth = 1; for (let y = 16; y < 42; y += 4) { const hw = 12 * Math.sqrt(Math.max(0, 1 - ((y - 28) / 16) ** 2)); g.beginPath(); g.moveTo(15 - hw, y); g.lineTo(15 + hw, y); g.stroke(); }
      g.fillStyle = '#e04a4a'; g.fillRect(4, 25, 22, 6);
      g.beginPath(); g.arc(15, 28, 5, 0, 7); inked(g, '#e04a4a', 1.2); g.fillStyle = '#fff6ea'; g.beginPath(); g.arc(15, 28, 2, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,200,120,.35)'; g.beginPath(); g.ellipse(11, 22, 3, 6, 0, 0, 7); g.fill();
      rr(g, 8, 43, 14, 5, 1.5); inked(g, '#2a2420', 1.3);
      g.strokeStyle = '#e04a4a'; g.lineWidth = 2; g.beginPath(); g.moveTo(15, 48); g.lineTo(15, 54); g.stroke();
      break;
    }
    case 'blossom': {
      S = mk(110, 64); const g = S.g; ax = 55; ay = 4; const r = rng(31 + variant);
      for (const [lw, c] of [[6, INK], [3.6, '#5a3a24']]) {
        g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(2, 6); g.bezierCurveTo(30, 4, 60, 30, 104, 24); g.stroke();
        g.lineWidth = lw * .65; g.beginPath(); g.moveTo(40, 12); g.quadraticCurveTo(46, 34, 38, 52); g.moveTo(72, 24); g.quadraticCurveTo(80, 40, 86, 54); g.stroke();
      }
      for (const [x, y] of [[14, 8], [28, 4], [44, 18], [40, 34], [36, 50], [58, 22], [72, 28], [82, 44], [88, 54], [98, 22], [106, 26], [24, 14]]) blossom(g, x, y, 5 + r() * 1.5, SAKURA[(r() * 3) | 0]);
      break;
    }
    case 'noren': {
      S = mk(70, 64); const g = S.g; ax = 35; ay = 4;
      for (let k = 0; k < 3; k++) {
        const x = 5 + k * 20.5;
        g.beginPath(); g.moveTo(x, 6); g.lineTo(x + 19, 6); g.lineTo(x + 19, 58 + (k % 2) * 2); g.lineTo(x, 58 + (k % 2) * 2); g.closePath(); inked(g, '#2f4f8f', 1.8);
        g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 14, 7, 4, 50);
      }
      onsenMark(g, 35, 32, 15, '#ffffff');
      rr(g, 0, 2, 70, 6, 3); inked(g, '#8a5a2e', 1.6);
      break;
    }
    case 'tub': {
      S = mk(64, 50); const g = S.g; ax = 32; ay = 30;
      g.beginPath(); g.moveTo(6, 22); g.lineTo(10, 46); g.lineTo(54, 46); g.lineTo(58, 22); g.closePath(); inked(g, '#c4824a', 2);
      g.strokeStyle = '#8a5a2e'; g.lineWidth = 1.4; for (let x = 14; x < 54; x += 8) { g.beginPath(); g.moveTo(x, 24); g.lineTo(x + 1, 45); g.stroke(); }
      for (const y of [30, 40]) { g.fillStyle = '#5a5f6a'; g.fillRect(8, y, 48, 3); }
      g.beginPath(); g.ellipse(32, 22, 26, 7, 0, 0, 7); inked(g, '#7fd6d0', 2);
      capySoak(g, 30, 18, 9);
      for (const [x, y] of [[48, 22], [14, 23]]) { g.beginPath(); g.arc(x, y, 3.4, 0, 7); inked(g, '#ffd23f', 1); }
      break;
    }
    case 'onsensign': {
      S = mk(56, 46); const g = S.g; ax = 28; ay = 23;
      g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.moveTo(14, 0); g.lineTo(10, 8); g.moveTo(42, 0); g.lineTo(46, 8); g.stroke();
      rr(g, 3, 6, 50, 36, 5); inked(g, '#e9c58e', 2);
      g.fillStyle = '#a97b42'; g.fillRect(6, 36, 44, 3);
      onsenMark(g, 28, 22, 13, '#d64a5a');
      break;
    }
    case 'kelp': {
      S = mk(44, 124); const g = S.g; ax = 22; ay = 122;
      for (const [x0, ph, col] of [[16, 0, '#3f9a5a'], [28, 1.6, '#57b46a']]) {
        const path = () => { g.beginPath(); g.moveTo(x0, 122); for (let y = 122; y > 6; y -= 6) g.lineTo(x0 + Math.sin(y * .09 + ph) * 5, y); };
        path(); g.lineWidth = 5; g.strokeStyle = INK; g.stroke(); path(); g.lineWidth = 3; g.strokeStyle = col; g.stroke();
        for (let y = 112; y > 14; y -= 16) {
          const x = x0 + Math.sin(y * .09 + ph) * 5, s2 = ((y / 16) | 0) % 2 ? 1 : -1;
          g.beginPath(); g.ellipse(x + s2 * 7, y, 8, 3.4, s2 * .5, 0, 7); inked(g, col, 1.2);
        }
      }
      break;
    }
    case 'shell': {
      S = mk(46, 42); const g = S.g; ax = 23; ay = 21;
      g.beginPath(); g.moveTo(23, 38); g.lineTo(4, 16); g.quadraticCurveTo(23, -6, 42, 16); g.closePath(); inked(g, '#ffb3a0', 2);
      g.strokeStyle = '#d97a6a'; g.lineWidth = 1.4; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(23, 36); g.lineTo(23 + k * 6, 8 + Math.abs(k) * 2); g.stroke(); }
      rr(g, 16, 34, 14, 7, 2); inked(g, '#ffb3a0', 1.5);
      break;
    }
    case 'starfish': {
      S = mk(46, 46); const g = S.g; ax = 23; ay = 23;
      g.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rad = k % 2 ? 8 : 20; g.lineTo(23 + Math.cos(a) * rad, 24 + Math.sin(a) * rad); }
      g.closePath(); inked(g, '#ff9a4a', 2);
      g.fillStyle = '#ffc48a'; for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * Math.PI * .4; g.beginPath(); g.arc(23 + Math.cos(a) * 12, 24 + Math.sin(a) * 12, 1.8, 0, 7); g.fill(); }
      g.fillStyle = INK; g.beginPath(); g.arc(19.5, 22, 1.8, 0, 7); g.arc(26.5, 22, 1.8, 0, 7); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.3; g.beginPath(); g.arc(23, 25, 3, .2, Math.PI - .2); g.stroke();
      break;
    }
    case 'chest': {
      S = mk(58, 46); const g = S.g; ax = 29; ay = 23;
      for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(12 + k * 7, 14 + (k % 2) * 2, 4, 0, 7); inked(g, '#ffd23f', 1.1); }
      g.beginPath(); g.moveTo(6, 16); g.quadraticCurveTo(29, -2, 52, 16); g.lineTo(52, 20); g.lineTo(6, 20); g.closePath(); inked(g, '#8a5a2e', 1.8);
      rr(g, 6, 20, 46, 22, 3); inked(g, '#a8743f', 2);
      g.fillStyle = '#d9a63a'; g.fillRect(6, 26, 46, 4); g.fillRect(26, 20, 6, 22);
      rr(g, 25, 26, 8, 8, 2); inked(g, '#ffd23f', 1.2);
      break;
    }
    case 'anchor': {
      S = mk(48, 74); const g = S.g; ax = 24; ay = 4;
      for (const [lw, c] of [[7, INK], [4, '#7d8796']]) {
        g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(24, 14); g.lineTo(24, 64); g.moveTo(12, 22); g.lineTo(36, 22);
        g.moveTo(6, 50); g.quadraticCurveTo(10, 68, 24, 66); g.quadraticCurveTo(38, 68, 42, 50); g.stroke();
      }
      g.beginPath(); g.arc(24, 9, 6, 0, 7); g.lineWidth = 6; g.strokeStyle = INK; g.stroke(); g.lineWidth = 3; g.strokeStyle = '#7d8796'; g.stroke();
      g.strokeStyle = '#c9a46a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(24, 0); g.lineTo(24, 4); g.moveTo(18, 30); g.quadraticCurveTo(34, 34, 18, 40); g.quadraticCurveTo(34, 44, 22, 50); g.stroke();
      break;
    }
    case 'balloons': {
      S = mk(56, 96); const g = S.g; ax = 28; ay = 94;
      const bl = [[16, 26, '#e8384f'], [38, 20, '#ffd166'], [28, 40, '#5fd6e8']];
      g.strokeStyle = INK; g.lineWidth = 1.2;
      for (const [x, y] of bl) { g.beginPath(); g.moveTo(x, y + 14); g.quadraticCurveTo(x + 4, y + 50, 28, 92); g.stroke(); }
      for (const [x, y, c] of bl) {
        g.beginPath(); g.ellipse(x, y, 12, 14, 0, 0, 7); inked(g, c, 2);
        g.beginPath(); g.moveTo(x - 3, y + 16); g.lineTo(x + 3, y + 16); g.lineTo(x, y + 13); g.closePath(); inked(g, c, 1);
        g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(x - 5, y - 6, 3, 5, -.4, 0, 7); g.fill();
      }
      break;
    }
    case 'pennant': {
      S = mk(76, 44); const g = S.g; ax = 38; ay = 22;
      rr(g, 2, 6, 6, 36, 3); inked(g, '#c98a52', 1.5);
      g.beginPath(); g.moveTo(8, 8); g.lineTo(72, 18); g.lineTo(8, 30); g.closePath(); inked(g, '#e8384f', 2);
      g.font = `900 11px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff6ec'; g.fillText('CAPY', 32, 19);
      g.beginPath(); g.arc(5, 5, 4, 0, 7); inked(g, '#ffd166', 1.3);
      break;
    }
    case 'bulbs': {
      S = mk(116, 40); const g = S.g; ax = 58; ay = 4;
      g.strokeStyle = INK; g.lineWidth = 1.8; g.beginPath(); g.moveTo(2, 4); g.quadraticCurveTo(58, 34, 114, 4); g.stroke();
      for (let k = 0; k < 7; k++) {
        const [x, y] = bulbPos(k);
        rr(g, x - 2.5, y - 3, 5, 4, 1); g.fillStyle = '#5a5f6a'; g.fill();
        g.beginPath(); g.ellipse(x, y + 4, 4, 5, 0, 0, 7); inked(g, ['#ffe08a', '#ff8fb8', '#8fe6ff', '#7be08a'][k % 4], 1.2);
      }
      break;
    }
    case 'ticket': {
      S = mk(80, 50); const g = S.g; ax = 40; ay = 25;
      rr(g, 3, 4, 74, 42, 6); inked(g, '#e8384f', 2.2);
      rr(g, 9, 10, 62, 30, 4); inked(g, '#fff1c8', 1.6);
      g.font = `900 13px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#c8283c'; g.fillText('RIDES', 34, 25);
      g.beginPath(); g.moveTo(58, 32); g.lineTo(58, 19); g.lineTo(54, 23); g.moveTo(58, 19); g.lineTo(62, 23); g.lineWidth = 2.2; g.strokeStyle = '#c8283c'; g.stroke();
      for (let k = 0; k < 10; k++) { const x = 8 + k * 7.1; g.beginPath(); g.arc(x, 5, 1.8, 0, 7); g.arc(x, 45, 1.8, 0, 7); g.fillStyle = '#ffe08a'; g.fill(); }
      break;
    }
    case 'shelf': {
      S = mk(116, 62); const g = S.g; ax = 58; ay = 50;
      for (const x of [16, 100]) { g.beginPath(); g.moveTo(x - 6, 52); g.lineTo(x + 6, 52); g.lineTo(x, 60); g.closePath(); inked(g, '#a8703c', 1.5); }
      rr(g, 2, 46, 112, 8, 2); inked(g, '#c98a52', 1.8);
      rr(g, 10, 24, 22, 22, 2); inked(g, '#3a6fd8', 1.8); g.font = `900 14px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff6ec'; g.fillText('A', 21, 36);
      rr(g, 14, 6, 16, 18, 2); inked(g, '#ffd166', 1.6); g.fillStyle = '#b07e22'; g.font = `900 11px ${FONT}`; g.fillText('B', 22, 16);
      g.beginPath(); g.arc(48, 36, 10, 0, 7); inked(g, '#e8384f', 1.8); g.strokeStyle = '#fff6ec'; g.lineWidth = 2; g.beginPath(); g.arc(48, 36, 10, -.6, .6); g.stroke();
      rr(g, 68, 22, 22, 24, 3); inked(g, '#b8c2d0', 1.8);                // robot
      rr(g, 70, 8, 18, 15, 3); inked(g, '#b8c2d0', 1.6);
      g.fillStyle = '#5fd6e8'; g.fillRect(73, 13, 4, 4); g.fillRect(81, 13, 4, 4);
      g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.moveTo(79, 8); g.lineTo(79, 3); g.stroke(); g.beginPath(); g.arc(79, 3, 2, 0, 7); g.fillStyle = '#e8384f'; g.fill();
      g.fillStyle = '#e8384f'; g.fillRect(73, 30, 12, 4);
      rr(g, 94, 34, 18, 10, 3); inked(g, '#7be08a', 1.5);
      for (const x of [98, 108]) { g.beginPath(); g.arc(x, 44, 3, 0, 7); inked(g, '#2a2f3d', 1); }
      break;
    }
    case 'soldier': {
      S = mk(32, 80); const g = S.g; ax = 16; ay = 40;
      rr(g, 9, 2, 14, 18, 3); inked(g, '#1f2430', 1.6);
      g.fillStyle = '#ffd166'; g.fillRect(9, 16, 14, 2);
      g.beginPath(); g.arc(16, 24, 7, 0, 7); inked(g, '#f2c6a0', 1.5);
      g.fillStyle = '#e88a8a'; g.beginPath(); g.arc(12, 26, 1.6, 0, 7); g.arc(20, 26, 1.6, 0, 7); g.fill();
      g.fillStyle = INK; g.beginPath(); g.arc(13.5, 23, 1.1, 0, 7); g.arc(18.5, 23, 1.1, 0, 7); g.fill();
      rr(g, 8, 30, 16, 22, 3); inked(g, '#e8384f', 1.6);
      g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.beginPath(); g.moveTo(9, 31); g.lineTo(23, 49); g.moveTo(23, 31); g.lineTo(9, 49); g.stroke();
      g.fillStyle = '#ffd166'; for (const y of [36, 42, 48]) { g.beginPath(); g.arc(16, y, 1.2, 0, 7); g.fill(); }
      rr(g, 9, 52, 6, 24, 2); inked(g, '#3a6fd8', 1.4); rr(g, 17, 52, 6, 24, 2); inked(g, '#3a6fd8', 1.4);
      rr(g, 3, 32, 5, 18, 2); inked(g, '#e8384f', 1.3); rr(g, 24, 32, 5, 18, 2); inked(g, '#e8384f', 1.3);
      break;
    }
    case 'biggear': {
      S = mk(72, 72); const g = S.g; ax = 36; ay = 36;
      g.beginPath();
      for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2, rad = (k % 2) ? 27 : 33; g.lineTo(36 + Math.cos(a) * rad, 36 + Math.sin(a) * rad); }
      g.closePath(); inked(g, '#e0b040', 2);
      g.beginPath(); g.arc(36, 36, 20, 0, 7); inked(g, '#c9962a', 1.6);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + .4; g.beginPath(); g.arc(36 + Math.cos(a) * 12, 36 + Math.sin(a) * 12, 4.5, 0, 7); inked(g, '#8a6a1e', 1.2); }
      g.beginPath(); g.arc(36, 36, 6, 0, 7); inked(g, '#6b5418', 1.4);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(30, 28, 7, 0, 7); g.fill();
      break;
    }
    case 'windkey': {
      S = mk(60, 40); const g = S.g; ax = 30; ay = 20;
      for (const s2 of [-1, 1]) { g.beginPath(); g.ellipse(30 + s2 * 15, 16, 13, 10, 0, 0, 7); inked(g, '#e0b040', 2); g.beginPath(); g.ellipse(30 + s2 * 15, 16, 6, 4, 0, 0, 7); g.fillStyle = '#bfe0f5'; g.fill(); g.lineWidth = 1.4; g.strokeStyle = INK; g.stroke(); }
      rr(g, 26, 14, 8, 24, 2); inked(g, '#c9962a', 1.8);
      g.beginPath(); g.arc(30, 16, 5, 0, 7); inked(g, '#e0b040', 1.6);
      break;
    }
    case 'crayons': {
      S = mk(62, 54); const g = S.g; ax = 31; ay = 27;
      for (let k = 0; k < 6; k++) {
        const x = 10 + k * 8, h = 18 + (k % 3) * 5;
        rr(g, x, 26 - h, 7, h + 4, 1.5); inked(g, TOY[k], 1.2);
        g.beginPath(); g.moveTo(x, 26 - h); g.lineTo(x + 3.5, 20 - h); g.lineTo(x + 7, 26 - h); g.closePath(); inked(g, TOY[k], 1.1);
      }
      rr(g, 4, 24, 54, 28, 3); inked(g, '#7be08a', 2);
      rr(g, 4, 24, 54, 8, 3); inked(g, '#ffd166', 1.6);
      g.font = `900 10px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2a4f2a'; g.fillText('COLORS', 31, 42);
      break;
    }
    default: S = mk(4, 4); ax = 2; ay = 2;
  }
  return { S, ax, ay };
}
function bulbPos(k) { const t = (k + .5) / 7, x = 2 + t * 112; return [x, lerp(lerp(4, 34, t), lerp(34, 4, t), t)]; }

// ------------------------------------------------------------ v3 shared sprites
let V3 = null;
function v3() {
  if (V3) return V3;
  const balloon = c => {
    const B = mk(64, 92), g = B.g;
    g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(62, 4, 62, 44, 40, 60); g.lineTo(24, 60); g.bezierCurveTo(2, 44, 2, 4, 32, 4); g.closePath(); inked(g, c, 2.2);
    g.save(); g.clip();
    for (let k = -2; k <= 2; k++) { g.fillStyle = k % 2 ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.08)'; g.beginPath(); g.ellipse(32 + k * 11, 32, 4, 30, 0, 0, 7); g.fill(); }
    g.restore();
    g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.moveTo(25, 60); g.lineTo(26, 72); g.moveTo(39, 60); g.lineTo(38, 72); g.stroke();
    rr(g, 22, 71, 20, 14, 3); inked(g, '#a8743f', 1.8);
    g.fillStyle = '#7a4a24'; g.fillRect(23, 75, 18, 2);
    capyHead(g, 32, 68, 5, null);
    return B;
  };
  const balloons = ['#e8384f', '#ffd166', '#5fd6e8', '#8f7cf0'].map(balloon);
  const blimp = mk(130, 50), b = blimp.g;
  b.beginPath(); b.ellipse(62, 22, 56, 18, 0, 0, 7); inked(b, '#c9ced6', 2.2);
  b.fillStyle = '#e8384f'; b.fillRect(30, 18, 64, 8);
  b.font = `900 10px ${FONT}`; b.textAlign = 'center'; b.textBaseline = 'middle'; b.fillStyle = '#fff6ec'; b.fillText('CAPY', 62, 22.5);
  b.beginPath(); b.moveTo(112, 22); b.lineTo(126, 8); b.lineTo(126, 36); b.closePath(); inked(b, '#e8384f', 1.8);
  rr(b, 50, 38, 26, 9, 3); inked(b, '#ffd166', 1.6);
  const wheel = mk(300, 300), w = wheel.g, R = 138;
  for (const [lw, c] of [[9, INK], [5, '#f2f2f6']]) { w.lineWidth = lw; w.strokeStyle = c; w.beginPath(); w.arc(150, 150, R, 0, 7); w.stroke(); w.beginPath(); w.arc(150, 150, R - 22, 0, 7); w.stroke(); }
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2;
    w.strokeStyle = INK; w.lineWidth = 3.4; w.beginPath(); w.moveTo(150, 150); w.lineTo(150 + Math.cos(a) * R, 150 + Math.sin(a) * R); w.stroke();
    w.strokeStyle = '#e8384f'; w.lineWidth = 1.6; w.stroke();
  }
  for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2; w.beginPath(); w.arc(150 + Math.cos(a) * (R - 11), 150 + Math.sin(a) * (R - 11), 3, 0, 7); inked(w, ['#ffe08a', '#ff8fb8', '#8fe6ff'][k % 3], 1); }
  w.beginPath(); w.arc(150, 150, 14, 0, 7); inked(w, '#ffd166', 2.2);
  V3 = { balloons, blimp, wheel };
  return V3;
}
function drawWheel(ctx, cx, cy, s, time, legs = true) {
  const W3 = v3().wheel;
  if (legs) {
    for (const d of [-1, 1]) {
      ctx.strokeStyle = INK; ctx.lineWidth = 7 * s; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + d * 70 * s, cy + 200 * s); ctx.stroke();
      ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 4 * s; ctx.stroke();
    }
  }
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(time * .12);
  ctx.drawImage(W3.c, -150 * s, -150 * s, 300 * s, 300 * s);
  ctx.restore();
  for (let k = 0; k < 8; k++) {                                  // gondolas stay upright
    const a = time * .12 + k / 8 * Math.PI * 2, gx = cx + Math.cos(a) * 138 * s, gy = cy + Math.sin(a) * 138 * s;
    rr(ctx, gx - 10 * s, gy + 2 * s, 20 * s, 16 * s, 4 * s);
    ctx.fillStyle = FLAGS[k % FLAGS.length]; ctx.fill(); ctx.lineWidth = 2 * s; ctx.strokeStyle = INK; ctx.stroke();
  }
}

// open-air sky backdrop for Cloud Carnival: sky by altitude, far balloons,
// a blimp, the ferris wheel near the ground, parallax clouds
function drawOpenBackdrop(ctx, camY, time) {
  const f = (camY + VIEW_H / 2) / FLOOR_GAP, S = skyAt(skyFloor(f)), sh = shared(), V = v3();
  const gr = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  gr.addColorStop(0, S.top); gr.addColorStop(1, S.bot);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (S.stars > 0) {
    ctx.globalAlpha = S.stars;
    const oy = (camY * .05) % 256;
    for (let x = 0; x < VIEW_W; x += 256) for (let y = -256 + oy; y < VIEW_H; y += 256) ctx.drawImage(sh.stars.c, x, y, 256, 256);
    ctx.globalAlpha = 1;
  }
  if (S.night > .3) ctx.drawImage(sh.moon.c, 380, 70 + (camY * .02) % 40, 52, 52);
  // far layer: parallax .12
  const P = .12, base = camY * P;
  if (base < 420) { ctx.save(); drawWheel(ctx, 330, VIEW_H - 120 + base, .9, time); ctx.restore(); }
  const L = theme(9).land.land;                                  // fairground on the ground
  const gy = VIEW_H + camY * .45 - 40;
  if (gy - LAND_H < VIEW_H) ctx.drawImage(L.c, 0, gy - LAND_H, VIEW_W, LAND_H);
  for (let k = Math.max(0, Math.floor((base - 200) / 170)); k * 170 < base + VIEW_H + 100; k++) {
    const y = VIEW_H - (k * 170 + 120 - base), hk = hash(k, 51);
    if (hk < .25) {
      const x = ((hash(k, 52) * 520 + time * 6) % 600) - 70;
      ctx.drawImage(V.blimp.c, x, y, 104, 40);
    } else {
      const B = V.balloons[(hk * 4) | 0], s = .55 + hash(k, 53) * .45;
      const x = 40 + hash(k, 54) * 380 + Math.sin(time * .3 + k) * 14;
      ctx.drawImage(B.c, x - 32 * s, y + Math.sin(time * .7 + k) * 5, 64 * s, 92 * s);
    }
  }
  // near clouds: parallax .3
  if (S.night < .85) {
    ctx.globalAlpha = .38 * (1 - S.night * .8);
    const cb = camY * .2;
    for (let k = Math.floor((cb - 100) / 150); k * 150 < cb + VIEW_H + 150; k++) {
      const y = VIEW_H - (k * 150 - cb), x = ((hash(k, 61) * 560 + time * (4 + hash(k, 62) * 6)) % 620) - 70, s = 1.2 + hash(k, 63) * 1.2;
      ctx.drawImage(sh.cloud.c, x, y, 80 * s, 34 * s);
    }
    ctx.globalAlpha = 1;
  }
}

// ------------------------------------------------------------ summit crowns
// painted once: everything above the summit floor (open roof / surface / sky)
const CROWN_H = 820;
const CROWN = {};
function crown(ti) {
  if (CROWN[ti]) return CROWN[ti];
  const C = mk(VIEW_W, CROWN_H), g = C.g, W = VIEW_W, H = CROWN_H, r = rng(900 + ti), sh = shared();
  const nightSky = (top, bot) => {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bot);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 256) for (let x = 0; x < W; x += 256) g.drawImage(sh.stars.c, x, y, 256, 256);
  };
  const meta = {};
  switch (ti) {
    case 7: {                                                    // rooftop onsen under the moon
      nightSky('#10163e', '#6a4a86');
      g.drawImage(sh.moon.c, 330, 90, 90, 90);
      const pk = (px, py, bw, col) => {
        g.beginPath(); g.moveTo(px - bw, H - 60); g.lineTo(px, py); g.lineTo(px + bw, H - 60); g.closePath(); inked(g, col, 2.4, '#3a4a70');
        g.beginPath(); g.moveTo(px, py); const d = (H - 60 - py) * .28, k2 = bw / (H - 60 - py);
        g.lineTo(px + k2 * d, py + d); for (let k = 3; k >= -3; k--) g.lineTo(px + k * k2 * d / 3, py + d + (k % 2 ? 9 : 0)); g.closePath(); inked(g, '#f2f6ff', 2, '#3a4a70');
      };
      pk(150, H - 420, 260, '#4a5a8a'); pk(390, H - 330, 180, '#56679a');
      // torii on a hill
      g.beginPath(); g.ellipse(390, H - 70, 150, 50, 0, Math.PI, 0); inked(g, '#3f5a4a', 2);
      for (const x of [370, 410]) { rr(g, x - 4, H - 170, 8, 70, 2); inked(g, '#d64a3a', 1.8); }
      g.beginPath(); g.moveTo(352, H - 176); g.quadraticCurveTo(390, H - 184, 428, H - 176); g.lineTo(428, H - 168); g.lineTo(352, H - 168); g.closePath(); inked(g, '#d64a3a', 1.8);
      rr(g, 360, H - 158, 60, 6, 2); inked(g, '#d64a3a', 1.5);
      // rooftop pool behind the summit floor
      for (let k = 0; k < 16; k++) { const a = Math.PI + k / 15 * Math.PI; g.beginPath(); g.ellipse(240 + Math.cos(a) * 170, H - 16 + Math.sin(a) * 26, 14, 9, 0, 0, 7); inked(g, ['#8c9199', '#9aa0a8', '#a7acb3'][k % 3], 1.5); }
      g.beginPath(); g.ellipse(240, H - 10, 160, 22, 0, Math.PI, 0); g.closePath(); inked(g, '#6fd0cc', 2);
      g.fillStyle = '#b8f0ea'; g.beginPath(); g.ellipse(200, H - 20, 60, 4, 0, 0, 7); g.fill();
      capySoak(g, 170, H - 20, 13); capySoak(g, 300, H - 18, 11);
      for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(110 + k * 40 + r() * 10, H - 12 - r() * 6, 5, 0, 7); inked(g, '#ffd23f', 1.2); }
      // lantern string + framing sakura branches
      g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(0, H - 300); g.quadraticCurveTo(240, H - 220, W, H - 300); g.stroke();
      meta.lanterns = [];
      for (let k = 1; k < 8; k++) {
        const t = k / 8, x = t * W, y = lerp(lerp(H - 300, H - 220, t), lerp(H - 220, H - 300, t), t);
        g.beginPath(); g.ellipse(x, y + 14, 10, 13, 0, 0, 7); inked(g, k % 2 ? '#fff6ea' : '#e04a4a', 1.8);
        g.fillStyle = k % 2 ? '#e04a4a' : '#ffd166'; g.fillRect(x - 10, y + 12, 20, 4);
        meta.lanterns.push([x, y + 14]);
      }
      for (const s2 of [1, -1]) {
        g.save(); if (s2 < 0) { g.translate(W, 0); g.scale(-1, 1); }
        for (const [lw, c] of [[10, INK], [7, '#4a2e1c']]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(-10, H - 470); g.bezierCurveTo(60, H - 460, 110, H - 420, 170, H - 400); g.stroke(); g.lineWidth = lw * .6; g.beginPath(); g.moveTo(70, H - 455); g.quadraticCurveTo(90, H - 400, 80, H - 360); g.stroke(); }
        for (let k = 0; k < 26; k++) blossom(g, 10 + r() * 160, H - 480 + r() * 120, 6 + r() * 2, SAKURA[(r() * 3) | 0]);
        g.restore();
      }
      meta.steam = [[150, H - 30], [240, H - 34], [330, H - 30]];
      break;
    }
    case 8: {                                                    // up through the surface into daylight
      const SURF = H - 360; meta.surf = SURF;
      const sky = g.createLinearGradient(0, 0, 0, SURF); sky.addColorStop(0, '#5fb6ee'); sky.addColorStop(1, '#d6f0fa');
      g.fillStyle = sky; g.fillRect(0, 0, W, SURF);
      g.globalAlpha = .35; g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(120, 140, 70, 0, 7); g.fill(); g.globalAlpha = 1;
      g.beginPath(); g.arc(120, 140, 40, 0, 7); inked(g, '#ffe28a', 2.4);
      for (const [x, y, s] of [[300, 90, 1.2], [400, 180, .9], [40, 260, .8]]) g.drawImage(sh.cloud.c, x, y, 80 * s, 34 * s);
      g.strokeStyle = INK; g.lineWidth = 2; for (const [x, y] of [[250, 220], [276, 236]]) { g.beginPath(); g.moveTo(x - 8, y); g.quadraticCurveTo(x - 4, y - 5, x, y); g.quadraticCurveTo(x + 4, y - 5, x + 8, y); g.stroke(); }
      // sailboat on the surface
      g.beginPath(); g.moveTo(330, SURF - 6); g.lineTo(410, SURF - 6); g.lineTo(398, SURF + 8); g.lineTo(342, SURF + 8); g.closePath(); inked(g, '#a8743f', 2);
      rr(g, 368, SURF - 92, 4, 88, 2); inked(g, '#8a5a2e', 1.4);
      g.beginPath(); g.moveTo(374, SURF - 90); g.lineTo(408, SURF - 14); g.lineTo(374, SURF - 14); g.closePath(); inked(g, '#fff6ec', 1.8);
      g.beginPath(); g.moveTo(366, SURF - 80); g.lineTo(338, SURF - 14); g.lineTo(366, SURF - 14); g.closePath(); inked(g, '#ff8a6a', 1.8);
      g.beginPath(); g.moveTo(372, SURF - 92); g.lineTo(390, SURF - 86); g.lineTo(372, SURF - 80); inked(g, '#5fd6e8', 1);
      // water from the summit up to the surface
      const wg = g.createLinearGradient(0, SURF, 0, H); wg.addColorStop(0, '#9be8f6'); wg.addColorStop(1, '#3fb0dc');
      g.fillStyle = wg; g.fillRect(0, SURF, W, H - SURF);
      g.fillStyle = INK; g.fillRect(0, SURF - 1, W, 2.5);
      // coral towers on both sides + a turtle + fish
      for (const s2 of [1, -1]) {
        g.save(); if (s2 < 0) { g.translate(W, 0); g.scale(-1, 1); }
        for (let k = 0; k < 5; k++) {
          const x = 10 + k * 22, h = 120 + r() * 140, c = ['#ff8fb8', '#ffb06a', '#c9a0ff', '#ff6a6a'][k % 4];
          rr(g, x, H - h, 20, h + 10, 10); inked(g, c, 2);
          for (let y = H - h + 14; y < H; y += 16) { g.beginPath(); g.arc(x + 10 + (r() - .5) * 8, y, 2.4, 0, 7); g.fillStyle = 'rgba(0,0,0,.18)'; g.fill(); }
        }
        g.restore();
      }
      g.beginPath(); g.ellipse(250, H - 250, 40, 24, .15, 0, 7); inked(g, '#6fae5a', 2.4);
      g.strokeStyle = '#4a7f3a'; g.lineWidth = 2; for (const [x, y] of [[240, H - 256], [258, H - 252], [248, H - 238]]) { g.beginPath(); g.arc(x, y, 7, 0, 7); g.stroke(); }
      g.beginPath(); g.ellipse(296, H - 240, 15, 11, .15, 0, 7); inked(g, '#9fd07a', 2);
      g.fillStyle = INK; g.beginPath(); g.arc(301, H - 243, 2.4, 0, 7); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.arc(300, H - 237, 4, .3, 2); g.stroke();
      for (const [x, y, a] of [[226, H - 226, .9], [270, H - 222, -.7], [218, H - 266, -.9], [266, H - 276, .6]]) { g.beginPath(); g.ellipse(x, y, 15, 6, a, 0, 7); inked(g, '#9fd07a', 1.8); }
      for (let k = 0; k < 9; k++) {
        const x = 150 + (k % 3) * 22 + r() * 8, y = H - 420 + ((k / 3) | 0) * 16 + r() * 6;
        g.beginPath(); g.ellipse(x, y, 8, 4.5, 0, 0, 7); inked(g, '#ffd166', 1.3);
        g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x - 13, y - 4); g.lineTo(x - 13, y + 4); g.closePath(); inked(g, '#ffd166', 1.1);
        g.fillStyle = INK; g.beginPath(); g.arc(x + 4, y - 1, 1, 0, 7); g.fill();
      }
      break;
    }
    case 9: {                                                    // night fair at the top of the sky
      nightSky('#0d1440', '#4a3a8a');
      g.drawImage(sh.moon.c, 60, 80, 80, 80);
      const V = v3();
      g.drawImage(V.balloons[0].c, 20, H - 520, 80, 115); g.drawImage(V.balloons[2].c, 380, H - 600, 70, 100); g.drawImage(V.balloons[3].c, 400, H - 380, 56, 80);
      for (const [y, sag] of [[H - 200, 50], [H - 120, 30]]) {
        g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(240, y + sag * 2, W, y); g.stroke();
        for (let k = 1; k < 16; k++) {
          const t = k / 16, x = t * W, yy = lerp(lerp(y, y + sag * 2, t), lerp(y + sag * 2, y, t), t);
          g.beginPath(); g.moveTo(x - 9, yy); g.lineTo(x + 9, yy); g.lineTo(x, yy + 18); g.closePath(); inked(g, FLAGS[k % FLAGS.length], 1.5);
        }
      }
      meta.wheel = [240, H + 60];
      break;
    }
    case 10: {                                                   // the lid is open: a child's bedroom at night
      const wall = g.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, '#1f2560'); wall.addColorStop(1, '#3b4196');
      g.fillStyle = wall; g.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += 48) { g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x, 0, 24, H); }
      meta.glow = [];
      for (let k = 0; k < 26; k++) { const x = 20 + r() * (W - 40), y = H - 760 + r() * 520; star4(g, x, y, 3 + r() * 2, '#d8ff9a'); meta.glow.push([x, y]); }
      // window with the real night outside
      const wx = 46, wy = H - 500, ww = 132, wh = 140;
      rr(g, wx, wy, ww, wh, 6); inked(g, '#0b1030', 3);
      g.drawImage(sh.stars.c, 0, 0, ww * RES, wh * RES, wx, wy, ww, wh);
      g.drawImage(sh.moon.c, wx + 70, wy + 18, 44, 44);
      g.lineWidth = 8; g.strokeStyle = INK; g.strokeRect(wx, wy, ww, wh); g.lineWidth = 5; g.strokeStyle = '#f2e6d0'; g.strokeRect(wx, wy, ww, wh);
      g.lineWidth = 4; g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2); g.stroke();
      for (const s2 of [0, 1]) { g.beginPath(); g.moveTo(wx - 10 + s2 * (ww + 20), wy - 12); g.quadraticCurveTo(wx + (s2 ? ww - 30 : 30), wy + 50, wx - 6 + s2 * (ww + 12), wy + wh + 10); g.lineTo(wx - 14 + s2 * (ww + 28), wy + wh + 10); g.lineTo(wx - 14 + s2 * (ww + 28), wy - 12); g.closePath(); inked(g, '#ff8fb8', 2); }
      // crescent night-light
      g.beginPath(); g.arc(388, H - 430, 32, .9, Math.PI * 2 - .9, false); g.arc(402, H - 438, 27, Math.PI * 2 - .75, .75, true); g.closePath(); inked(g, '#ffe08a', 2.4);
      meta.nightlight = [388, H - 430];
      // the open lid stands up behind the summit
      const LT = H - 230;
      g.beginPath(); g.moveTo(30, H - 4); g.lineTo(50, LT); g.lineTo(W - 50, LT); g.lineTo(W - 30, H - 4); g.closePath(); inked(g, '#c98a52', 3);
      g.fillStyle = '#b07840'; for (let x = 70; x < W - 70; x += 42) g.fillRect(x, LT + 4, 3, H - LT - 8);
      rr(g, 26, LT - 12, W - 52, 16, 4); inked(g, '#a8703c', 2.4);
      for (const x of [42, W - 42]) { rr(g, x - 12, LT - 14, 24, 22, 3); inked(g, '#f2b63c', 2); }
      g.font = `900 56px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const letters = 'TOYS';
      for (let k = 0; k < 4; k++) {
        const x = 132 + k * 72;
        rr(g, x - 29, LT + 34, 58, 58, 8); inked(g, TOY[k], 2.6);
        g.lineWidth = 7; g.strokeStyle = INK; g.strokeText(letters[k], x, LT + 64); g.fillStyle = '#fff6ec'; g.fillText(letters[k], x, LT + 64);
      }
      for (let k = 0; k < 6; k++) star4(g, 80 + r() * (W - 160), H - 100 + r() * 60, 4, '#ffd166');
      meta.mobile = [300, H - 640];
      break;
    }
  }
  CROWN[ti] = { C, meta };
  return CROWN[ti];
}

function drawCrown(ctx, ti, sTop, time) {
  const K = crown(ti), M = K.meta, oy = sTop - CROWN_H;
  ctx.drawImage(K.C.c, 0, oy, VIEW_W, CROWN_H);
  if (ti === 7) {
    for (const [x, y] of M.lanterns) { ctx.globalAlpha = .18 + .08 * Math.sin(time * 2 + x); ctx.fillStyle = '#ffb35a'; ctx.beginPath(); ctx.arc(x, oy + y, 22, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    steamPuffs(ctx, M.steam, oy, time, 90);
  } else if (ti === 8) {
    const sy0 = oy + M.surf;
    ctx.save(); ctx.beginPath(); ctx.rect(0, sy0, VIEW_W, sTop - sy0); ctx.clip();
    for (let k = 0; k < 4; k++) {                                // god rays
      const x = 60 + k * 120 + Math.sin(time * .5 + k) * 30;
      ctx.globalAlpha = .1 + .05 * Math.sin(time + k * 2);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x - 20, sy0); ctx.lineTo(x + 20, sy0); ctx.lineTo(x + 90, sTop); ctx.lineTo(x + 20, sTop); ctx.closePath(); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.moveTo(0, sy0);
    for (let x = 0; x <= VIEW_W; x += 12) ctx.lineTo(x, sy0 + Math.sin(x * .05 + time * 2) * 3);
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 8; k++) { const x = (k * 67 + time * 20) % VIEW_W; if (Math.sin(time * 3 + k) > .3) star4(ctx, x, sy0 + 6, 2, '#ffffff'); }
  } else if (ti === 9) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VIEW_W, sTop); ctx.clip();
    drawWheel(ctx, M.wheel[0], oy + M.wheel[1], 1.4, time, false);
    ctx.restore();
    for (let k = 0; k < 3; k++) {                                // fireworks
      const per = 2.6, tt = (time + k * .9) % per, ph = tt / per;
      const fx = 90 + k * 150 + hash(Math.floor((time + k * .9) / per), k) * 60, fy = oy + 120 + k * 60;
      if (ph < .7) {
        const rad = 10 + ph * 70, a = 1 - ph / .7;
        ctx.globalAlpha = a; ctx.strokeStyle = FLAGS[(k * 2 + Math.floor(time / per)) % FLAGS.length]; ctx.lineWidth = 3;
        for (let j = 0; j < 12; j++) { const an = j / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(fx + Math.cos(an) * rad * .6, fy + Math.sin(an) * rad * .6); ctx.lineTo(fx + Math.cos(an) * rad, fy + Math.sin(an) * rad); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
    }
  } else if (ti === 10) {
    const p = .5 + .5 * Math.sin(time * 1.5);
    ctx.globalAlpha = .12 + .1 * p; ctx.fillStyle = '#ffe08a';
    ctx.beginPath(); ctx.arc(M.nightlight[0], oy + M.nightlight[1], 60, 0, 7); ctx.fill();
    ctx.fillStyle = '#d8ff9a';
    for (let k = 0; k < M.glow.length; k += 2) { const [x, y] = M.glow[k]; ctx.globalAlpha = .15 + .15 * Math.sin(time * 2 + k); ctx.beginPath(); ctx.arc(x, oy + y, 9, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    // a planet mobile swaying from the ceiling
    const mx = M.mobile[0], my = oy + M.mobile[1], sw = Math.sin(time * .9) * .12;
    ctx.save(); ctx.translate(mx, my); ctx.rotate(sw);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 60); ctx.moveTo(-70, 60); ctx.lineTo(70, 60); ctx.stroke();
    for (const [x, l, c, rad] of [[-70, 50, '#ff9e6b', 14], [0, 80, '#5fd6e8', 18], [70, 40, '#c9a0ff', 12]]) {
      ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x, 60 + l); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, 60 + l + rad, rad, 0, 7); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, 60 + l + rad, rad * 1.6, rad * .35, -.3, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = '#ffd166'; ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
    }
    ctx.restore();
  }
}

function steamPuffs(ctx, pts, oy, time, rise) {
  for (const [x, y] of pts) {
    for (let k = 0; k < 3; k++) {
      const ph = (time * .35 + k / 3 + x * .01) % 1;
      ctx.globalAlpha = .32 * Math.sin(ph * Math.PI);
      ctx.fillStyle = '#f4f8ff';
      const px = x + Math.sin(time + k + x) * 8, py = oy + y - ph * rise, rad = 5 + ph * 9;
      ctx.beginPath(); ctx.arc(px, py, rad, 0, 7); ctx.arc(px + rad * .8, py + rad * .3, rad * .7, 0, 7); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------ wall caps at the summit
function drawWallCaps(ctx, ti, sTop, time) {
  for (const side of [0, 1]) {
    const x = side ? VIEW_W - WALL_W : 0, cx = x + WALL_W / 2;
    if (ti === 7) {
      rr(ctx, x - 4, sTop - 16, WALL_W + 8, 18, 3); ctx.fillStyle = '#5a3a24'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 30, sTop - 14); ctx.quadraticCurveTo(cx, sTop - 26, cx, sTop - 40); ctx.quadraticCurveTo(cx, sTop - 26, cx + 30, sTop - 14); ctx.closePath();
      ctx.fillStyle = '#3a3f55'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, sTop - 42, 4, 0, 7); ctx.fillStyle = '#d9a63a'; ctx.fill(); ctx.stroke();
    } else if (ti === 8) {
      for (const [dx, dy, rad, c] of [[-8, -8, 12, '#f5a08a'], [8, -14, 10, '#ff8fb8'], [0, -26, 9, '#ffb06a'], [12, -2, 8, '#c9a0ff']]) {
        ctx.beginPath(); ctx.arc(cx + dx, sTop + dy, rad, 0, 7); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      }
    } else if (ti === 9) {
      ctx.beginPath(); ctx.arc(cx, sTop - 10, 11, 0, 7); ctx.fillStyle = '#ffd166'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
      rr(ctx, cx - 2, sTop - 60, 4, 50, 2); ctx.fillStyle = '#c9ced6'; ctx.fill(); ctx.stroke();
      const fl = side ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(cx, sTop - 60);
      for (let k = 0; k <= 4; k++) ctx.lineTo(cx + fl * k * 7, sTop - 60 + k * 1.5 + Math.sin(time * 6 + k) * 2);
      ctx.lineTo(cx, sTop - 44); ctx.closePath(); ctx.fillStyle = side ? '#5fd6e8' : '#e8384f'; ctx.fill(); ctx.stroke();
    } else if (ti === 10) {
      rr(ctx, x - 6, sTop - 12, WALL_W + 12, 16, 3); ctx.fillStyle = '#c98a52'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
      rr(ctx, (side ? x + WALL_W - 6 : x - 6), sTop - 14, 18, 20, 3); ctx.fillStyle = '#f2b63c'; ctx.fill(); ctx.stroke();
    }
  }
}

// ------------------------------------------------------------ per-frame theme overlays
function themeOverlay(ctx, ti, camY, time) {
  if (ti === 7) {                                                // drifting sakura petals
    for (let k = 0; k < 14; k++) {
      const x = ((hash(k, 71) * 520 + time * (16 + k * 2) + Math.sin(time * 1.3 + k) * 20) % 540) - 30;
      const y = ((hash(k, 72) * 760 + time * (26 + k * 3)) % 780) - 30;
      ctx.save(); ctx.translate(x, y); ctx.rotate(time * (1 + k * .1) + k);
      ctx.beginPath(); ctx.ellipse(0, 0, 4.2, 2.4, 0, 0, 7); ctx.fillStyle = SAKURA[k % 3]; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = '#b8507a'; ctx.stroke(); ctx.restore();
    }
  } else if (ti === 8) {                                         // light rays + rising bubbles
    for (let k = 0; k < 3; k++) {
      const x = 80 + k * 150 + Math.sin(time * .4 + k) * 40;
      ctx.globalAlpha = .05 + .03 * Math.sin(time * .8 + k);
      ctx.fillStyle = '#e0fbff'; ctx.beginPath(); ctx.moveTo(x - 24, 0); ctx.lineTo(x + 24, 0); ctx.lineTo(x + 110, VIEW_H); ctx.lineTo(x + 30, VIEW_H); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(230,252,255,.85)';
    for (let k = 0; k < 16; k++) {
      const y = VIEW_H + 20 - ((hash(k, 81) * 780 + time * (30 + k * 4)) % 800);
      const x = 50 + hash(k, 82) * 380 + Math.sin(time * 2 + k) * 6, rad = 2 + (k % 4);
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(x - rad * .4, y - rad * .5, 1.5, 1.5);
    }
  }
}

// ------------------------------------------------------------ special platform kinds
function drawGeyser(ctx, plat, x0, x1, top, time) {
  const fx = plat.fx || {}, warn = fx.warn || 0, erupt = fx.erupt || 0, cx = (x0 + x1) / 2;
  if (erupt > 0) {                                               // steam column, ~3 floors
    const Hc = FLOOR_GAP * 3 * Math.min(1, erupt * 1.6), n = Math.max(3, (Hc / 16) | 0);
    for (let k = n; k >= 0; k--) {
      const t = k / n, y = top - t * Hc, rad = 13 + t * 9 + Math.sin(time * 9 + k) * 2.5, x = cx + Math.sin(time * 6 + k * 1.7) * 4 * t;
      ctx.globalAlpha = .95 - t * .45;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#8fb0c6'; ctx.stroke();
      ctx.fillStyle = '#e4f2fa'; ctx.beginPath(); ctx.arc(x + rad * .3, y + rad * .3, rad * .45, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const jit = warn > 0 ? Math.sin(time * 40) * 1.2 * warn : 0;
  ctx.beginPath(); ctx.ellipse(cx + jit, top + 1, 17, 5.5, 0, 0, 7); ctx.fillStyle = '#8c8f97'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx + jit, top + .5, 10, 3, 0, 0, 7); ctx.fillStyle = erupt > 0 ? '#e4f2fa' : '#2a2530'; ctx.fill();
  for (const dx of [-12, 0, 12]) { ctx.fillStyle = '#a7acb3'; ctx.fillRect(cx + dx - 2 + jit, top - 3, 4, 2); }
  if (warn > 0 && erupt <= 0) {                                  // bubbling warning
    for (let k = 0; k < 4; k++) {
      const ph = (time * 2.2 + k / 4) % 1, x = cx - 9 + k * 6 + Math.sin(time * 5 + k) * 2, y = top - 4 - ph * 22 * warn;
      ctx.globalAlpha = (1 - ph) * warn; ctx.beginPath(); ctx.arc(x, y, 2.5 + ph * 4, 0, 7);
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#8fb0c6'; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawJelly(ctx, plat, x0, x1, top, time) {
  const fx = plat.fx || {}, sq = fx.squish || 0, w = x1 - x0, cx = (x0 + x1) / 2;
  const hh = 26 * (1 - sq * .4), rx = w / 2 * (1 + sq * .12), base = top - 3 + hh * .9;
  ctx.lineCap = 'round';
  for (let k = 0; k < 6; k++) {                                  // tentacles
    const tx = cx - rx * .75 + k * rx * .3, len = 22 + (k % 3) * 8;
    ctx.beginPath(); ctx.moveTo(tx, base);
    for (let y = 4; y <= len; y += 4) ctx.lineTo(tx + Math.sin(time * 3 + k + y * .2) * 4, base + y);
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.6; ctx.strokeStyle = k % 2 ? '#ffc6ea' : '#e48ad8'; ctx.stroke();
  }
  ctx.beginPath(); ctx.ellipse(cx, base, rx, hh, 0, Math.PI, 0);
  for (let k = 0; k <= 8; k++) { const xx = cx + rx - k * rx / 4; ctx.quadraticCurveTo(xx + rx / 8, base + 7, xx, base); }
  ctx.closePath();
  ctx.fillStyle = '#ff9ad5'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#e276c0'; ctx.beginPath(); ctx.ellipse(cx + rx * .25, base + 4, rx * .9, hh * .55, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(cx - rx * .4, base - hh * .65, rx * .22, hh * .16, -.2, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffc6ea'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(cx - rx * .55 + k * rx * .38, base - hh * .35 + (k % 2) * 6, 3, 0, 7); ctx.fill(); }
  ctx.restore();
  ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = INK;                                           // friendly face
  const ey = base - hh * .32;
  ctx.beginPath(); ctx.arc(cx - 9, ey, 2.6, 0, 7); ctx.arc(cx + 9, ey, 2.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx - 8.2, ey - .9, .9, 0, 7); ctx.arc(cx + 9.8, ey - .9, .9, 0, 7); ctx.fill();
  ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.beginPath(); ctx.arc(cx, ey + 3, 4.5, .25, Math.PI - .25); ctx.stroke();
  ctx.fillStyle = 'rgba(255,90,140,.5)'; ctx.beginPath(); ctx.ellipse(cx - 16, ey + 4, 3.5, 2, 0, 0, 7); ctx.ellipse(cx + 16, ey + 4, 3.5, 2, 0, 0, 7); ctx.fill();
}

function drawCloudPlat(ctx, plat, x0, x1, top, time) {
  const w = x1 - x0, cx = (x0 + x1) / 2, bob = Math.sin(time * 2 + plat.n) * 1.2, y = top + bob;
  ctx.fillStyle = 'rgba(40,60,90,.18)'; ctx.beginPath(); ctx.ellipse(cx + 6, y + PLAT_H + 8, w / 2, 5, 0, 0, 7); ctx.fill();
  const n = Math.max(3, Math.round(w / 30));
  ctx.beginPath(); ctx.moveTo(x0 + 6, y + PLAT_H);
  ctx.quadraticCurveTo(x0 - 6, y + PLAT_H * .5, x0 + 8, y + 2);
  for (let k = 0; k < n; k++) {
    const a = x0 + 8 + k * (w - 16) / n, b = a + (w - 16) / n;
    ctx.quadraticCurveTo((a + b) / 2, y - 10 - (k % 2) * 4, b, y + 2);
  }
  ctx.quadraticCurveTo(x1 + 6, y + PLAT_H * .5, x1 - 6, y + PLAT_H);
  ctx.closePath();
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = '#d6e8f5'; ctx.fillRect(x0 - 8, y + PLAT_H - 6, w + 16, 8); ctx.restore();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#3a5a7a'; ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.8;                    // sleepy happy face
  for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s2 * 10, y + 7, 3, Math.PI + .3, -.3); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(cx, y + 10, 3, .3, Math.PI - .3); ctx.stroke();
  ctx.fillStyle = 'rgba(255,140,170,.5)'; ctx.beginPath(); ctx.ellipse(cx - 17, y + 11, 3.5, 2, 0, 0, 7); ctx.ellipse(cx + 17, y + 11, 3.5, 2, 0, 0, 7); ctx.fill();
}

function drawConveyor(ctx, plat, x0, x1, top, time) {
  const w = x1 - x0, dir = plat.dir || 1;
  ctx.fillStyle = 'rgba(15,10,25,.28)'; ctx.fillRect(x0 + 7, top + PLAT_H, w - 4, 7);
  rr(ctx, x0, top, w, PLAT_H, 9); ctx.fillStyle = '#3b3f4a'; ctx.fill();
  ctx.save(); rr(ctx, x0, top, w, PLAT_H, 9); ctx.clip();
  ctx.fillStyle = '#4c5260'; ctx.fillRect(x0, top, w, 6);
  const per = 22, off = ((time * 70 * dir) % per + per) % per;
  ctx.fillStyle = '#ffd166';
  for (let x = x0 - per + off; x < x1 + per; x += per) {
    const d = dir;
    ctx.beginPath(); ctx.moveTo(x - 4 * d, top + 1); ctx.lineTo(x + 3 * d, top + 3.2); ctx.lineTo(x - 4 * d, top + 5.4); ctx.lineTo(x - 1 * d, top + 3.2); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#2a2d36'; ctx.fillRect(x0, top + PLAT_H - 4, w, 4);
  ctx.restore();
  rr(ctx, x0, top, w, PLAT_H, 9); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  for (const rx of [x0 + 9, x1 - 9]) {                           // end rollers
    ctx.beginPath(); ctx.arc(rx, top + 9, 7, 0, 7); ctx.fillStyle = '#c9ced6'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    const a = time * 8 * dir;
    ctx.beginPath(); ctx.moveTo(rx + Math.cos(a) * 6, top + 9 + Math.sin(a) * 6); ctx.lineTo(rx - Math.cos(a) * 6, top + 9 - Math.sin(a) * 6);
    ctx.moveTo(rx + Math.cos(a + 1.57) * 6, top + 9 + Math.sin(a + 1.57) * 6); ctx.lineTo(rx - Math.cos(a + 1.57) * 6, top + 9 - Math.sin(a + 1.57) * 6); ctx.lineWidth = 1.6; ctx.stroke();
  }
}

function drawSpring(ctx, plat, x0, x1, top, time) {
  const fx = plat.fx || {}, w = x1 - x0, cx = (x0 + x1) / 2;
  const padY = top - (fx.spring || 0) * 12 + (fx.squish || 0) * 7, baseY = top + PLAT_H - 6;
  ctx.fillStyle = 'rgba(15,10,25,.28)'; ctx.fillRect(x0 + 7, top + PLAT_H + 1, w - 4, 7);
  rr(ctx, x0 + 4, baseY, w - 8, 7, 3); ctx.fillStyle = '#3a6fd8'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
  for (const sx of [x0 + 18, cx, x1 - 18]) coil(ctx, sx, padY + 7, baseY, 12);
  rr(ctx, x0, padY, w, 8, 4); ctx.fillStyle = '#e8384f'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(x0 + 4, padY + 1.5, w - 8, 2);
  star4(ctx, cx, padY + 4, 2.4, '#ffd166');
}

// ------------------------------------------------------------ the summit floor
function drawSummit(ctx, T, top, time) {
  const cx = VIEW_W / 2, w = 300, h = 58, y = top + PLAT_H + 8;
  ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(cx - w / 2 + 18, top + PLAT_H); ctx.lineTo(cx - w / 2 + 18, y + 3); ctx.moveTo(cx + w / 2 - 18, top + PLAT_H); ctx.lineTo(cx + w / 2 - 18, y + 3); ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * (w / 2 - 6), y + 10); ctx.lineTo(cx + s * (w / 2 + 22), y + 12); ctx.lineTo(cx + s * (w / 2 + 12), y + 28);
    ctx.lineTo(cx + s * (w / 2 + 22), y + 44); ctx.lineTo(cx + s * (w / 2 - 6), y + 44); ctx.closePath();
    ctx.fillStyle = T.banner; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
  }
  rr(ctx, cx - w / 2, y, w, h, 8); ctx.fillStyle = '#ffcf3a'; ctx.fill();
  ctx.fillStyle = '#e0a420'; ctx.fillRect(cx - w / 2 + 3, y + h - 8, w - 6, 5);
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(cx - w / 2 + 5, y + 4, w - 10, 3);
  rr(ctx, cx - w / 2, y, w, h, 8); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 28px ${FONT}`; ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText('SUMMIT!', cx, y + 22);
  ctx.fillStyle = '#ffffff'; ctx.fillText('SUMMIT!', cx, y + 22);
  ctx.font = `900 12px ${FONT}`; ctx.fillStyle = '#7a4a10'; ctx.fillText(T.name.toUpperCase() + ' · FLOOR ' + (MAP.summit || ''), cx, y + 44);
  // flag on the left
  const fx = 74;
  rr(ctx, fx - 2.5, top - 118, 5, 118, 2); ctx.fillStyle = '#c9ced6'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.arc(fx, top - 120, 5, 0, 7); ctx.fillStyle = '#ffcf3a'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(fx + 2, top - 114);
  for (let k = 0; k <= 6; k++) ctx.lineTo(fx + 2 + k * 9, top - 114 + Math.sin(time * 5 - k * .8) * 3);
  for (let k = 6; k >= 0; k--) ctx.lineTo(fx + 2 + k * 9, top - 80 + Math.sin(time * 5 - k * .8) * 3);
  ctx.closePath(); ctx.fillStyle = T.banner; ctx.fill(); ctx.lineWidth = 2.2; ctx.stroke();
  ctx.save(); ctx.translate(fx + 28, top - 97 + Math.sin(time * 5 - 3) * 3); capyHead(ctx, 0, 0, 8, '#fff6ec'); ctx.restore();
  // trophy on the right
  const tx = VIEW_W - 82;
  rr(ctx, tx - 16, top - 14, 32, 14, 3); ctx.fillStyle = '#8a5a2e'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
  rr(ctx, tx - 5, top - 26, 10, 13, 2); ctx.fillStyle = '#ffcf3a'; ctx.fill(); ctx.stroke();
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(tx + s * 15, top - 47, 7, 9, 0, 0, 7); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2.6; ctx.strokeStyle = '#ffcf3a'; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(tx - 16, top - 60); ctx.lineTo(tx + 16, top - 60); ctx.quadraticCurveTo(tx + 15, top - 30, tx, top - 26); ctx.quadraticCurveTo(tx - 15, top - 30, tx - 16, top - 60); ctx.closePath();
  ctx.fillStyle = '#ffcf3a'; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(tx - 10, top - 56, 4, 18);
  star4(ctx, tx + 1, top - 45, 3, '#fff6ec');
  if (Math.sin(time * 3) > .6) star4(ctx, tx + 12, top - 62, 2.5, '#ffffff');
}

// ------------------------------------------------------------ map-select thumbnail
export function drawMapPreview(ctx, mapThemes, w, h, t = 0) {
  const saved = MAP;
  MAP = { themes: mapThemes && mapThemes.length ? mapThemes : CLASSIC_THEMES, span: THEME_SPAN, summit: null };
  try {
    const k = w / VIEW_W, viewH = h / k, camY = 18 * FLOOR_GAP;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.scale(k, k); ctx.translate(0, viewH - VIEW_H);
    drawBackground(ctx, camY, t);
    const ti = MAP.themes[0];
    const special = { 7: 'geyser', 8: 'jelly', 9: 'cloud', 10: 'conveyor' }[ti];
    const n0 = Math.floor(camY / FLOOR_GAP), n1 = Math.ceil((camY + viewH) / FLOOR_GAP) + 1;
    for (let n = n0; n <= n1; n++) {
      const pw = 120 + hash(n, 3) * 90, x0 = WALL_W + hash(n, 4) * (VIEW_W - 2 * WALL_W - pw);
      const p = { n, x0, x1: x0 + pw, kind: (special && n % 2 === 1) ? special : 'normal', dir: 1,
                  fx: { warn: 0, erupt: special === 'geyser' ? .8 : 0, squish: 0, spring: 0 } };
      drawPlatform(ctx, p, camY, t);
    }
    drawSideWalls(ctx, camY, t);
    ctx.restore();
  } finally { MAP = saved; }
}

// ------------------------------------------------------------ v3 windows + decor motion
// underwater portholes and the toybox's peek at the giant bedroom
function drawOutsideV3(ctx, wn, camY, time, ti, TD) {
  const TH = theme(ti), x0 = wn.x - wn.w / 2, w = wn.w, top = wn.st, bottom = wn.sb;
  const f = wn.y / FLOOR_GAP, k = clamp(f / (MAP.summit || 200), 0, 1);
  ctx.save();
  const p = new Path2D(); winPath(p, wn, wn.shape); ctx.clip(p);
  const gr = ctx.createLinearGradient(0, top, 0, bottom);
  if (TD.water) { gr.addColorStop(0, mixC('#1d5f92', '#8fe0f5', k)); gr.addColorStop(1, mixC('#0b3360', '#3fb0dc', k)); }
  else { gr.addColorStop(0, '#d9cff5'); gr.addColorStop(1, '#efe8ff'); }
  ctx.fillStyle = gr; ctx.fillRect(x0, top, w, wn.h);
  const eb = wn.shape === 'round' ? wn.sb - wn.h / 2 + wn.w / 2 : bottom;
  const rel = -(eb - VIEW_H * .5) * .22, landBottom = eb + 26 + rel;
  const srcX = clamp(wn.x - w / 2 + (hash(wn.seed, 6) - .5) * 120, 0, VIEW_W - w);
  ctx.drawImage(TH.land.land.c, srcX * RES, 0, w * RES, LAND_H * RES, x0, landBottom - LAND_H, w, LAND_H);
  if (TD.water) {
    for (let j = 0; j < 3; j++) {                                // fish swimming past
      const per = 7 + j * 2, ph = ((time + hash(wn.seed, 30 + j) * per) % per) / per;
      const fx = x0 - 20 + ph * (w + 40), fy = top + 24 + j * 22 + Math.sin(time * 2 + j) * 3;
      ctx.beginPath(); ctx.ellipse(fx, fy, 7, 4, 0, 0, 7); ctx.fillStyle = ['#ffd166', '#ff8a6a', '#8fe6ff'][j]; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx - 6, fy); ctx.lineTo(fx - 12, fy - 4); ctx.lineTo(fx - 12, fy + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = .12; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(x0 + w * .2, top); ctx.lineTo(x0 + w * .45, top); ctx.lineTo(x0 + w * .9, bottom); ctx.lineTo(x0 + w * .6, bottom); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    const S = skyAt(skyFloor(f));
    if (S.night > 0) { ctx.fillStyle = `rgba(18,20,56,${(.6 * S.night).toFixed(3)})`; ctx.fillRect(x0, top, w, wn.h); }
    if (TH.land.lights && S.night > 0) {
      ctx.globalAlpha = S.night;
      ctx.drawImage(TH.land.lights.c, srcX * RES, 0, w * RES, LAND_H * RES, x0, landBottom - LAND_H, w, LAND_H);
      ctx.globalAlpha = 1;
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 3;
  const gy = wn.shape === 'round' ? wn.sb - wn.h / 2 - w * .2 : top + w * .4;
  ctx.beginPath(); ctx.moveTo(x0 + 14, gy + 14); ctx.lineTo(x0 + 26, gy); ctx.stroke();
  ctx.restore();
}

function drawFrameV3(ctx, wn, T) {
  const x0 = wn.x - wn.w / 2;
  ctx.lineJoin = 'round';
  if (wn.shape === 'round') {
    const rad = wn.w / 2, cy = wn.sb - wn.h / 2;
    ctx.beginPath(); ctx.arc(wn.x, cy, rad, 0, Math.PI * 2);
    ctx.lineWidth = 17; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 12; ctx.strokeStyle = T.frame; ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = T.frameDk; ctx.beginPath(); ctx.arc(wn.x + 1.5, cy + 1.5, rad, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(wn.x - 1, cy - 1, rad + 2, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2 + Math.PI / 8;
      ctx.beginPath(); ctx.arc(wn.x + Math.cos(a) * (rad + 1), cy + Math.sin(a) * (rad + 1), 2.2, 0, 7);
      ctx.fillStyle = T.frameDk; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke();
    }
    return;
  }
  // rect: a ryokan window with kumiko lattice and a little tiled eave
  const h = wn.h * .82, top = wn.sb - h;
  ctx.lineWidth = 14; ctx.strokeStyle = INK; ctx.strokeRect(x0, top, wn.w, h);
  ctx.lineWidth = 9; ctx.strokeStyle = T.frame; ctx.strokeRect(x0, top, wn.w, h);
  ctx.lineWidth = 3; ctx.strokeStyle = T.frameDk; ctx.strokeRect(x0 + 1.5, top + 1.5, wn.w, h);
  ctx.beginPath();
  for (const t of [1 / 3, 2 / 3]) { ctx.moveTo(x0 + wn.w * t, top); ctx.lineTo(x0 + wn.w * t, wn.sb); }
  ctx.moveTo(x0, top + h * .5); ctx.lineTo(x0 + wn.w, top + h * .5);
  ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = T.frame; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x0 - 18, top - 4); ctx.quadraticCurveTo(wn.x, top - 14, x0 + wn.w + 18, top - 4); ctx.lineTo(x0 + wn.w + 10, top - 16); ctx.quadraticCurveTo(wn.x, top - 26, x0 - 10, top - 16); ctx.closePath();
  ctx.fillStyle = '#3a3f55'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = '#525a78'; ctx.fillRect(x0 - 4, top - 13, wn.w + 8, 2);
  rr(ctx, x0 - 10, wn.sb - 2, wn.w + 20, 8, 3);
  ctx.fillStyle = T.frame; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x0 - 8, wn.sb + 6, wn.w + 16, 5);
}

// returns true when it handled the decor item
function drawDecorV3(ctx, kind, S, ax, ay, d, s, time) {
  const swing = (px, py, amp, sp) => {
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.sin(time * sp + d.seed) * amp);
    ctx.drawImage(S.c, -ax, -ay, S.w, S.h); ctx.restore();
  };
  switch (kind) {
    case 'chochin': swing(d.x, s - 30, .08, 1.4);
      ctx.globalAlpha = .14 + .05 * Math.sin(time * 2 + d.seed); ctx.fillStyle = '#ffb35a';
      ctx.beginPath(); ctx.arc(d.x, s - 2, 22, 0, 7); ctx.fill(); ctx.globalAlpha = 1; return true;
    case 'blossom': case 'noren': case 'anchor': case 'bulbs':
      ctx.drawImage(S.c, d.x - ax, s - 70 - ay, S.w, S.h);
      if (kind === 'bulbs') {
        for (let k = 0; k < 7; k++) {
          const [bx, by] = bulbPos(k), on = Math.sin(time * 3 + k * 1.7 + d.seed) > -.2;
          if (!on) continue;
          ctx.globalAlpha = .3; ctx.fillStyle = ['#ffe08a', '#ff8fb8', '#8fe6ff', '#7be08a'][k % 4];
          ctx.beginPath(); ctx.arc(d.x - ax + bx, s - 70 - ay + by + 4, 8, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        }
      }
      return true;
    case 'kelp': swing(d.x, s + 50, .07, 1.1); return true;
    case 'balloons': swing(d.x, s + 40, .06, .9); return true;
    case 'biggear': {
      ctx.save(); ctx.translate(d.x, s); ctx.rotate(time * .5 * (hash(d.seed, 2) > .5 ? 1 : -1));
      ctx.drawImage(S.c, -ax, -ay, S.w, S.h); ctx.restore(); return true;
    }
    case 'windkey': {
      ctx.save(); ctx.translate(d.x, s); ctx.scale(Math.cos(time * 1.6 + d.seed) || .01, 1);
      ctx.drawImage(S.c, -ax, -ay, S.w, S.h); ctx.restore(); return true;
    }
    case 'tub':
      ctx.drawImage(S.c, d.x - ax, s - ay, S.w, S.h);
      steamPuffs(ctx, [[d.x - 8, s - 14], [d.x + 10, s - 12]], 0, time, 40);
      return true;
  }
  return false;
}
