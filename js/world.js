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
];

export const THEMES = THEME_DEFS.map(t => ({ id: t.id, name: t.name, accent: t.accent }));

export function themeIndexForFloor(n) {
  return Math.floor(Math.max(0, n) / THEME_SPAN) % THEME_DEFS.length;
}
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
  }
  const dim = [.10, .06, .08, .22, .22, .12, .05][i];
  g.fillStyle = `rgba(22,16,40,${dim})`; g.fillRect(0, 0, W, H);
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
function themedFill(ctx, pick, x, w, camY) {
  const span = THEME_SPAN * FLOOR_GAP;
  const yLo = camY - 20, yHi = camY + VIEW_H + 20;
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
  const r0 = Math.floor((camY - 220) / ROW_H), r1 = Math.floor((camY + VIEW_H) / ROW_H);
  const wins = [], decor = [];
  for (let r = r0; r <= r1; r++) { const L = rowLayout(r); wins.push(...L.wins); decor.push(...L.decor); }

  // 1) outside through the windows
  const holes = new Path2D();
  for (const wn of wins) {
    const bottom = sy(wn.y, camY), top = bottom - wn.h;
    if (bottom < -10 || top > VIEW_H + 10) { wn.vis = false; continue; }
    wn.vis = true; wn.sb = bottom; wn.st = top;
    archPath(holes, wn.x - wn.w / 2, top, wn.w, bottom);
    drawOutside(ctx, wn, camY, time);
  }
  // 2) back wall with the windows cut out
  ctx.save();
  const clip = new Path2D(); clip.rect(0, 0, VIEW_W, VIEW_H); clip.addPath(holes);
  ctx.clip(clip, 'evenodd');
  themedFill(ctx, i => theme(i).back, 0, VIEW_W, camY);
  ctx.restore();
  // 3) window frames + sills
  for (const wn of wins) if (wn.vis) drawFrame(ctx, wn);
  // 4) wall decor
  for (const d of decor) drawDecor(ctx, d, camY, time);
}

function drawOutside(ctx, wn, camY, time) {
  const f = wn.y / FLOOR_GAP, S = skyAt(f), ti = themeAtY(wn.y + wn.h / 2), TH = theme(ti), sh = shared();
  const x0 = wn.x - wn.w / 2, w = wn.w, top = wn.st, bottom = wn.sb;
  ctx.save();
  const p = new Path2D(); archPath(p, x0, top, w, bottom); ctx.clip(p);
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
  const top = sy(plat.n * FLOOR_GAP, camY);
  if (top > VIEW_H + 24 || top < -PLAT_H - 60) return;
  const ti = themeIndexForFloor(plat.n), C = theme(ti), T = C.T, P = C.plat;
  const x0 = Math.max(plat.x0, WALL_W - 6), x1 = Math.min(plat.x1, VIEW_W - WALL_W + 6), w = x1 - x0;
  if (w <= 0) return;
  const full = plat.n % THEME_SPAN === 0;

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

  if (plat.n > 0 && full) drawBanner(ctx, T, plat.n, top);
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
  // hard shadows the walls throw onto the back wall
  ctx.fillStyle = 'rgba(15,10,25,.3)';
  ctx.fillRect(WALL_W, 0, 8, VIEW_H); ctx.fillRect(VIEW_W - WALL_W - 8, 0, 8, VIEW_H);
  themedFill(ctx, i => theme(i).side, 0, WALL_W, camY);
  ctx.save(); ctx.translate(VIEW_W, 0); ctx.scale(-1, 1);
  themedFill(ctx, i => theme(i).side, 0, WALL_W, camY);
  ctx.restore();
}
