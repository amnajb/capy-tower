// Capy Tower — cel-shaded capybara roster (the Capy Leap crew).
// Pure Canvas 2D vector art: thick dark outlines, one hard shadow tone and a
// small highlight per part, no shadowBlur, no offscreen canvases. Every part is
// a static Path2D built once at load and posed with transforms each frame.
//
// Local space: facing right, origin at the feet centre, canvas y down, so the
// character stands in y -56..0 (about 52 px of body, ears/hats on top).

const OL = '#1f1612';
const HEAD_K = 1.17;          // chibi head, as wide as the body like the Capy Leap art           // outline
const LW = 2.6;                 // outline width at scale 1
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ------------------------------------------------------------------ roster
export const CHARACTERS = [
  {
    id: 'capy', name: 'CAPY', tag: 'trail hopper',
    blurb: 'Steady all-rounder with a bedroll on his back and zero panic in his bones.',
    colors: { fur: '#e8c79a', shade: '#bb9a6f', light: '#f7e3c2', muzzle: '#c9a079', muzzleShade: '#a8825f',
              nose: '#6e4a33', ear: '#9e7556', accent: '#e4553f', trim: '#ffd166' },
    stats: { speed: 1.00, accel: 1.00, jump: 1.00 },
  },
  {
    id: 'yoru', name: 'YORU', tag: 'night courier',
    blurb: 'Light and floaty: the cape catches air, so she hangs a beat longer at the top.',
    colors: { fur: '#35313a', shade: '#1d1a20', light: '#57515e', muzzle: '#6d5b5a', muzzleShade: '#4f4141',
              nose: '#2a1f1f', ear: '#5b3a70', accent: '#8d3bd8', trim: '#ffd166' },
    stats: { speed: 0.98, accel: 1.03, jump: 1.04 },
  },
  {
    id: 'tico', name: 'TICO', tag: 'forest ranger',
    blurb: 'Springs highest of anyone, but takes a moment to get those legs going.',
    colors: { fur: '#d8dbe0', shade: '#a8adb5', light: '#f1f3f6', muzzle: '#b3b8c1', muzzleShade: '#959aa4',
              nose: '#62666f', ear: '#9ca1aa', accent: '#6f7a3f', trim: '#d9c07a' },
    stats: { speed: 0.97, accel: 0.96, jump: 1.06 },
  },
  {
    id: 'piko', name: 'PIKO', tag: 'signal wrangler',
    blurb: 'Fastest paws in the tower; jumps a touch lower, so keep the speed up.',
    colors: { fur: '#c9ced6', shade: '#99a1ab', light: '#e6e9ee', muzzle: '#a8aeb8', muzzleShade: '#8a909b',
              nose: '#555a63', ear: '#8f96a1', accent: '#3f9ec4', trim: '#8fe6ff' },
    stats: { speed: 1.05, accel: 1.04, jump: 0.95 },
  },
  {
    id: 'chang', name: 'CHANG', tag: 'bridge builder',
    blurb: 'Heavy boots, big momentum: slow to start, hard to stop, lands like a hammer.',
    colors: { fur: '#9c6b3c', shade: '#744d29', light: '#b8834f', muzzle: '#7f5533', muzzleShade: '#633f24',
              nose: '#3e2717', ear: '#5f3d20', accent: '#ffc32b', trim: '#ffe08a' },
    stats: { speed: 1.04, accel: 0.95, jump: 0.97 },
  },
];
const BY_ID = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

// ------------------------------------------------------------------ static parts
function P(fn) { const p = new Path2D(); fn(p); return p; }
function ell(cx, cy, rx, ry, rot = 0) { return P(p => p.ellipse(cx, cy, rx, ry, rot, 0, TAU)); }

// chunky pear body, neck at the top, belly at the front
const BODY = P(p => {
  p.moveTo(-15, -7);
  p.bezierCurveTo(-18.5, -19, -14, -32, -3, -34);
  p.bezierCurveTo(8, -35.5, 15.5, -27, 15.5, -16);
  p.bezierCurveTo(15.5, -6.5, 10, -2.5, 0.5, -2.5);
  p.bezierCurveTo(-8.5, -2.5, -14, -3.5, -15, -7);
  p.closePath();
});
const BODY_SHADE = P(p => { p.ellipse(-13, -9, 12, 24, 0.15, 0, TAU); p.ellipse(2, 1, 20, 6, 0, 0, TAU); });
const BODY_HI = ell(5, -29.5, 5, 2.2, -0.35);

// head in head space (neck pivot at 0,0 of the head group)
const HEAD = ell(0, -43, 11.5, 11);
const HEAD_SHADE = P(p => { p.ellipse(-6, -33, 13, 6.5, 0.2, 0, TAU); p.ellipse(-12, -43, 4, 12, 0, 0, TAU); });
const HEAD_HI = ell(-1, -51, 4.5, 1.8, -0.2);
const MUZZLE = P(p => {
  p.moveTo(4.5, -47.5);
  p.bezierCurveTo(11, -50.5, 19.5, -49.5, 21, -43);
  p.bezierCurveTo(22, -37, 17.5, -32.5, 11, -32.5);
  p.bezierCurveTo(6, -32.5, 2.8, -35.2, 3, -39.5);
  p.closePath();
});
const MUZZLE_SHADE = ell(9, -32, 13, 4.5, -0.1);
const NOSE = ell(18.3, -43.2, 3.1, 2.3, -0.25);
const EAR = ell(-5.5, -52.5, 3.8, 4.1, -0.3);
const EAR_IN = ell(-5.2, -53, 1.8, 2.1, -0.3);

// limbs, pivot at the hip / shoulder
const LEG = P(p => {
  p.moveTo(-4, -10);
  p.lineTo(-4, -3);
  p.quadraticCurveTo(-4, 0, -0.5, 0);
  p.lineTo(3.5, 0);
  p.quadraticCurveTo(6.5, 0, 6.5, -2.2);
  p.quadraticCurveTo(6.5, -4.3, 4, -4.4);
  p.lineTo(4, -10);
  p.closePath();
});
const ARM = P(p => {
  p.moveTo(-3.6, -1);
  p.lineTo(-3.8, 4);
  p.quadraticCurveTo(-4, 8.6, 0.4, 8.6);
  p.quadraticCurveTo(4.6, 8.6, 4, 4);
  p.lineTo(3.4, -1);
  p.closePath();
});
const ARM_SHADE = ell(-3.6, 4, 2.2, 6.5);
const PAW_TOES = P(p => { p.moveTo(-0.9, 6.4); p.lineTo(-0.9, 8.4); p.moveTo(1.7, 6.4); p.lineTo(1.7, 8.4); });

// ------------------------------------------------------------------ accessories
// capy: backpack with a rolled bedroll on top
const PACK = P(p => p.roundRect(-23, -33, 13, 22, 4));
const PACK_SHADE = ell(-23, -18, 5, 14);
const PACK_POCKET = P(p => p.roundRect(-24, -22, 8, 8, 2.5));
const ROLL = P(p => p.roundRect(-25, -41, 17, 9, 4.5));
const ROLL_END = ell(-9.5, -36.5, 3.2, 4.5);
const CARABINER = P(p => p.ellipse(-17, -8.5, 2.2, 3.6, 0.3, 0, TAU));
const STRAP = P(p => {
  p.moveTo(-2, -33.5); p.bezierCurveTo(4, -31, 9, -24, 10.5, -15);
  p.lineTo(7.5, -14.5); p.bezierCurveTo(6, -23, 2, -29, -3.5, -31);
  p.closePath();
});
const BUCKLE = P(p => p.roundRect(7, -21, 4.5, 3.5, 1));

// tico: campaign hat ("Montana peak") in head space
const HAT_BRIM = P(p => p.ellipse(1.5, -52.5, 17.5, 4.2, -0.08, 0, TAU));
const HAT_CROWN = P(p => {
  p.moveTo(-8.5, -53.5);
  p.bezierCurveTo(-8.5, -60, -5, -66.5, -1, -66);
  p.quadraticCurveTo(1.5, -63.5, 3.5, -66.2);
  p.bezierCurveTo(8, -66.5, 11, -60, 10.5, -54);
  p.closePath();
});
const HAT_BAND = P(p => {
  p.moveTo(-8.6, -54); p.lineTo(10.6, -55); p.lineTo(10.4, -58.2); p.lineTo(-8.3, -57.2); p.closePath();
});
const HAT_SHADE = ell(-9, -60, 5, 9);

// chang: hard hat + headlamp, tool belt
const HARD_DOME = P(p => {
  p.moveTo(-11, -51.5);
  p.bezierCurveTo(-11, -62, -4, -66, 1.5, -66);
  p.bezierCurveTo(8, -66, 13, -61, 13, -52);
  p.closePath();
});
const HARD_BRIM = P(p => p.roundRect(-13, -53.5, 32, 4.2, 2));
const HARD_RIDGE = P(p => { p.moveTo(-2, -65.5); p.bezierCurveTo(1, -63, 2.5, -58, 2.5, -53); });
const HARD_SHADE = ell(-11, -56, 6, 10);
const LAMP = P(p => p.roundRect(9.5, -61.5, 6.5, 6, 2));
const LAMP_LENS = ell(15.2, -58.5, 1.6, 2.2);
const BELT = P(p => {
  p.moveTo(-16.3, -14.5); p.bezierCurveTo(-6, -11.5, 6, -11.5, 15.8, -14);
  p.lineTo(15.4, -9); p.bezierCurveTo(6, -6.5, -6, -6.5, -16, -9.5);
  p.closePath();
});
const BELT_BUCKLE = P(p => p.roundRect(5, -13.2, 6, 5.5, 1.2));
const WRENCH = P(p => {
  p.moveTo(-7.5, -9); p.lineTo(-5.5, -9); p.lineTo(-5.7, -1.5);
  p.arc(-6.6, 0.8, 2.6, -1.2, 4.3); p.lineTo(-7.5, -1.5); p.closePath();
});
const HAMMER_HANDLE = P(p => p.roundRect(-0.8, -9.5, 2.4, 10.5, 1));
const HAMMER_HEAD = P(p => p.roundRect(-3.5, -1.5, 8, 3.8, 1));

// piko: goggles + headset, head space
const LENS = P(p => p.roundRect(-3, -52.5, 13.5, 11, 5));
const LENS_FRAME = P(p => { p.roundRect(-4.6, -54.1, 16.7, 14.2, 6.5); p.roundRect(-3, -52.5, 13.5, 11, 5); });
const GOG_STRAP = P(p => {
  p.moveTo(-4.4, -50.5); p.bezierCurveTo(-8, -51, -11, -49.5, -11.8, -46.5);
  p.lineTo(-11.5, -43); p.bezierCurveTo(-10, -45.5, -7.5, -46.5, -4.4, -45.5);
  p.closePath();
});
const PHONE_BAND = P(p => {
  p.moveTo(-9.5, -44); p.bezierCurveTo(-11.5, -56, -3, -58.5, 2, -55.5);
  p.lineTo(1.4, -53.2); p.bezierCurveTo(-3, -55.5, -8.5, -54, -7, -44); p.closePath();
});
const PHONE_CUP = ell(-8.2, -41.5, 4.4, 5.2);
const PHONE_CUP_IN = ell(-8, -41.5, 2.2, 3);
const MIC_BOOM = P(p => { p.moveTo(-6, -38); p.bezierCurveTo(-2, -31.5, 6, -30, 10.5, -31); });
const MIC = ell(11.5, -31, 2.3, 1.8);

// small helpers
const STAR = P(p => {
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 1.5 : 3.6, a = -Math.PI / 2 + i * Math.PI / 5;
    p[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  p.closePath();
});
const DROP = P(p => { p.moveTo(0, -3.5); p.quadraticCurveTo(2.8, 0.5, 0, 1.8); p.quadraticCurveTo(-2.8, 0.5, 0, -3.5); });

// ------------------------------------------------------------------ painting
function paint(ctx, path, fill, shadeCol, shadePath, hiCol, hiPath) {
  ctx.fillStyle = fill;
  ctx.fill(path);
  if (shadeCol || hiCol) {
    ctx.save();
    ctx.clip(path);
    if (shadeCol) { ctx.fillStyle = shadeCol; ctx.fill(shadePath); }
    if (hiCol) { ctx.fillStyle = hiCol; ctx.fill(hiPath); }
    ctx.restore();
  }
  ctx.stroke(path);
}

// pose -> rig numbers
function rig(pose) {
  const a = pose.anim || 'idle';
  const t = pose.t || 0;
  const vx = pose.vx || 0, vy = pose.vy || 0;
  const r = {
    y: 0, rot: 0, sx: 1, sy: 1, spin: 0, head: 0,
    legF: [0, 0], legB: [0, 0], armF: 0.35, armB: -0.2,
    eye: 'open', mouth: 'smile', stars: false, sweat: false, lines: false, air: false,
  };
  switch (a) {
    case 'run': {
      const sp = Math.min(1, Math.abs(vx) / 325);
      const ph = t * (11 + 7 * sp);
      const s = Math.sin(ph), c = Math.cos(ph);
      r.legF = [s * 4.5, -Math.max(0, c) * 3.2];
      r.legB = [-s * 4.5, -Math.max(0, -c) * 3.2];
      r.y = -Math.abs(c) * 1.8;
      r.rot = 0.05 + sp * 0.1;
      r.armF = 0.3 - s * 1.0; r.armB = -0.1 + s * 1.0;
      r.head = -0.03 * s;
      break;
    }
    case 'jump': {
      const st = clamp(Math.abs(vy) * 0.00008, 0, 0.08);
      r.sy = 1.06 + st; r.sx = 0.95 - st * 0.6;
      r.legF = [3, -4.5]; r.legB = [-2, -3.5];
      r.armF = 2.5; r.armB = 2.1;
      r.mouth = 'open'; r.head = -0.1; r.air = true;
      r.rot = clamp(vx / 325, -1, 1) * 0.08;
      break;
    }
    case 'fall': {
      const st = clamp(Math.abs(vy) * 0.00005, 0, 0.06);
      r.sy = 1 + st; r.sx = 1 - st * 0.5;
      const w = Math.sin(t * 18) * 0.35;
      r.legF = [2.5, 1.5]; r.legB = [-2.5, 1];
      r.armF = 1.55 + w; r.armB = 1.2 - w;
      r.eye = 'wide'; r.mouth = 'o'; r.air = true; r.head = 0.06;
      break;
    }
    case 'spin': {
      r.spin = pose.spin || t * 14;
      r.legF = [2.5, -5]; r.legB = [-2, -5];
      r.armF = 2.8; r.armB = 2.6;
      r.eye = 'happy'; r.mouth = 'open'; r.lines = true; r.air = true;
      break;
    }
    case 'edge': {
      r.rot = 0.24 + Math.sin(t * 8) * 0.1;
      r.armF = t * 15; r.armB = t * 15 + Math.PI;
      r.legB = [-1.5, -2.5 - Math.max(0, Math.sin(t * 8)) * 2];
      r.eye = 'wide'; r.mouth = 'o'; r.sweat = true; r.head = -0.1;
      break;
    }
    case 'land': {
      r.legF = [2, 0]; r.legB = [-2, 0];
      r.armF = 0.9; r.armB = 0.6;
      break;
    }
    case 'cheer': {
      const h = Math.abs(Math.sin(t * 5));
      r.y = -h * 9;
      r.armF = 2.7 + Math.sin(t * 14) * 0.35; r.armB = 2.5 - Math.sin(t * 14) * 0.35;
      r.legF = [2, -h * 3]; r.legB = [-2, -h * 3];
      r.eye = 'happy'; r.mouth = 'open'; r.head = -0.08;
      if (h < 0.25) { r.sy = 0.93; r.sx = 1.06; }
      break;
    }
    case 'dead': {
      r.spin = t * 5;
      r.armF = 2.0; r.armB = -1.6;
      r.legF = [3, -2]; r.legB = [-3, -1];
      r.eye = 'x'; r.mouth = 'o'; r.stars = true;
      break;
    }
    default: { // idle
      const b = Math.sin(t * 2.6);
      r.sy = 1 + b * 0.022; r.sx = 1 - b * 0.016;
      r.armF = 0.35 + b * 0.06; r.armB = -0.2;
      r.head = b * 0.02;
      if (t % 3.4 > 3.26) r.eye = 'closed';
    }
  }
  const q = clamp(pose.squash || 0, 0, 1);
  if (q > 0) { r.sx *= 1 + q * 0.22; r.sy *= 1 - q * 0.26; }
  if (pose.blink && r.eye === 'open') r.eye = 'closed';
  return r;
}

// ------------------------------------------------------------------ parts
function drawLeg(ctx, x, off, fill, shadeCol) {
  ctx.save();
  ctx.translate(x + off[0], off[1]);
  paint(ctx, LEG, fill, shadeCol, ARM_SHADE);
  ctx.restore();
}
function drawArm(ctx, x, y, ang, fill, shadeCol) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-ang);                  // positive angle swings the paw forward
  paint(ctx, ARM, fill, shadeCol, ARM_SHADE);
  ctx.lineWidth = LW * 0.45;
  ctx.stroke(PAW_TOES);
  ctx.restore();
}

function drawCape(ctx, c, pose, r) {
  // hangs from the shoulders and streams back with speed, billows up when falling
  const t = pose.t || 0, vx = Math.abs(pose.vx || 0), vy = pose.vy || 0;
  const stream = clamp(vx / 325, 0, 1);
  const lift = clamp(-vy / 900, 0, 1);
  const rise = clamp(vy / 900, 0, 1);
  let phi = 0.3 + stream * 0.85 + lift * 1.3 - rise * 0.2;
  if (r.spin) phi = 1.2;
  if (pose.anim === 'edge') phi = 0.5 + Math.sin(t * 8) * 0.2;
  const flut = Math.sin(t * 17) * 0.09 * (0.3 + stream + lift);
  phi = clamp(phi + flut, 0.1, 2.3);
  const ax = -4, ay = -33;
  const L = 31 - lift * 4;
  const dx = -Math.sin(phi), dy = Math.cos(phi);
  const hx = ax + dx * L, hy = ay + dy * L;          // hem centre
  const nx = -dy, ny = dx;                            // hem direction
  const w = 15 + stream * 2 + lift * 3;
  const bx = hx + nx * w, by = hy + ny * w;           // hem "inner" end (toward body)
  const ex = hx - nx * w, ey = hy - ny * w;           // hem outer end
  const wav = Math.sin(t * 13) * 2.2;
  ctx.beginPath();
  ctx.moveTo(ax + 7, ay - 1);
  ctx.quadraticCurveTo(ax + 9 + dx * 10, ay + L * 0.55, bx, by);
  // scalloped hem
  const m1x = bx + (hx - bx) * 0.5, m1y = by + (hy - by) * 0.5;
  ctx.quadraticCurveTo(m1x + dx * (4 + wav), m1y + dy * (4 + wav), hx, hy);
  const m2x = hx + (ex - hx) * 0.5, m2y = hy + (ey - hy) * 0.5;
  ctx.quadraticCurveTo(m2x + dx * (4 - wav), m2y + dy * (4 - wav), ex, ey);
  ctx.quadraticCurveTo(ax - 27 + dx * 4, ay + L * 0.25, ax - 7, ay - 3);
  ctx.closePath();
  ctx.fillStyle = c.accent;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#5f2596';
  ctx.beginPath();
  ctx.ellipse(hx - nx * w * 0.35, hy - ny * w * 0.35, w * 0.7, L * 0.9, Math.atan2(dy, dx) - Math.PI / 2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#b26cf0';
  ctx.beginPath();
  ctx.ellipse(ax + 6 + dx * 6, ay + dy * 6, 2, 6, -phi * 0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(ax + 7, ay - 1);
  ctx.quadraticCurveTo(ax + 9 + dx * 10, ay + L * 0.55, bx, by);
  ctx.quadraticCurveTo(m1x + dx * (4 + wav), m1y + dy * (4 + wav), hx, hy);
  ctx.quadraticCurveTo(m2x + dx * (4 - wav), m2y + dy * (4 - wav), ex, ey);
  ctx.quadraticCurveTo(ax - 27 + dx * 4, ay + L * 0.25, ax - 7, ay - 3);
  ctx.closePath();
  ctx.stroke();
}
const COLLAR = P(p => {
  p.moveTo(-6, -35); p.quadraticCurveTo(2, -30.5, 11, -34.5);
  p.lineTo(12, -30.5); p.quadraticCurveTo(2, -26, -6.5, -31); p.closePath();
});
const CLASP = ell(8.5, -31.2, 2.6, 2.6);

function drawEye(ctx, c, eye, x, y) {
  ctx.save();
  ctx.lineWidth = LW * 0.62;
  if (eye === 'closed' || eye === 'happy') {
    ctx.lineWidth = LW * 0.8;
    ctx.beginPath();
    if (eye === 'happy') { ctx.moveTo(x - 3.5, y + 1); ctx.quadraticCurveTo(x, y - 4, x + 3.5, y + 1); }
    else { ctx.moveTo(x - 3.5, y); ctx.quadraticCurveTo(x, y + 2.2, x + 3.5, y); }
    ctx.stroke();
  } else if (eye === 'x') {
    ctx.lineWidth = LW * 0.8;
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3);
    ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3);
    ctx.stroke();
  } else {
    const wide = eye === 'wide';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(x, y, wide ? 4.9 : 4.4, wide ? 5.4 : 4.9, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#16100d';
    ctx.beginPath(); ctx.ellipse(x + 0.9, y + 0.2, wide ? 2.6 : 3.4, wide ? 3.1 : 3.9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x + 2, y - 1.4, wide ? 1.1 : 1.35, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 0.3, y + 2, 0.55, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawHead(ctx, ch, r) {
  const c = ch.colors;
  // behind the head: piko's headset band, the ear
  if (ch.id === 'piko') paint(ctx, PHONE_BAND, '#4f5761', null);
  if (ch.id !== 'chang' && ch.id !== 'tico') {
    paint(ctx, EAR, c.fur, c.shade, ell(-7.5, -52, 2.5, 5));
    ctx.fillStyle = c.ear; ctx.fill(EAR_IN);
  } else {
    // ear peeks out below the hat brim at the back
    paint(ctx, ell(-9.5, -48.5, 3.4, 3.8, -0.6), c.fur, c.shade, ell(-11, -48, 2, 4));
  }
  paint(ctx, HEAD, c.fur, c.shade, HEAD_SHADE, c.light, HEAD_HI);
  paint(ctx, MUZZLE, c.muzzle, c.muzzleShade, MUZZLE_SHADE);
  // nose pad + nostril
  ctx.fillStyle = c.nose;
  ctx.fill(NOSE);
  ctx.save();
  ctx.lineWidth = LW * 0.55;
  ctx.beginPath(); ctx.moveTo(17.4, -39.6); ctx.lineTo(16.9, -37.2); ctx.stroke();
  // mouth
  if (r.mouth === 'open') {
    ctx.fillStyle = '#6b2a2a';
    ctx.beginPath(); ctx.moveTo(11.8, -36.8); ctx.quadraticCurveTo(15, -30.8, 18.2, -36.6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff8a8a';
    ctx.beginPath(); ctx.ellipse(15, -33.6, 2, 1.1, 0, 0, TAU); ctx.fill();
  } else if (r.mouth === 'o') {
    ctx.fillStyle = '#4a1e1e';
    ctx.beginPath(); ctx.ellipse(15.2, -35.3, 1.7, 2, 0, 0, TAU); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(12.2, -36.6); ctx.quadraticCurveTo(14.8, -34.1, 17.6, -36.6); ctx.stroke();
  }
  ctx.restore();
  // a little muzzle highlight
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.ellipse(12, -46, 4, 1.4, -0.15, 0, TAU); ctx.fill();

  drawEye(ctx, c, r.eye, 2.5, -46.5);

  if (ch.id === 'piko') {
    paint(ctx, GOG_STRAP, '#3a6f86', null);
    ctx.fillStyle = 'rgba(143,230,255,0.55)';
    ctx.fill(LENS);
    ctx.save();
    ctx.clip(LENS);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.moveTo(-1, -44); ctx.lineTo(5, -52.5); ctx.lineTo(7.5, -52.5); ctx.lineTo(1.5, -44); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(40,120,150,0.35)';
    ctx.beginPath(); ctx.ellipse(4, -41.5, 9, 3, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#3f9ec4';
    ctx.fill(LENS_FRAME, 'evenodd');
    ctx.stroke(P(p => p.roundRect(-4.6, -54.1, 16.7, 14.2, 6.5)));
    ctx.save(); ctx.lineWidth = LW * 0.55; ctx.stroke(LENS); ctx.restore();
    paint(ctx, PHONE_CUP, '#5b636d', '#434a53', ell(-10.5, -40, 3, 6));
    ctx.fillStyle = '#8fe6ff'; ctx.fill(PHONE_CUP_IN);
    ctx.save(); ctx.lineWidth = LW * 0.9; ctx.stroke(MIC_BOOM);
    ctx.strokeStyle = '#5b636d'; ctx.lineWidth = LW * 0.45; ctx.stroke(MIC_BOOM); ctx.restore();
    paint(ctx, MIC, '#2d3238', null);
  } else if (ch.id === 'tico') {
    paint(ctx, HAT_BRIM, '#7d8747', '#5d6634', ell(-4, -50, 16, 3));
    paint(ctx, HAT_CROWN, '#8a9551', '#66703a', HAT_SHADE, '#a7b36a', ell(4, -63, 3, 1.4, -0.3));
    paint(ctx, HAT_BAND, '#7a5a30', null);
    ctx.fillStyle = c.trim;
    ctx.beginPath(); ctx.ellipse(-6.5, -55.7, 1.6, 2.3, 0.3, 0, TAU); ctx.fill(); ctx.stroke();
  } else if (ch.id === 'chang') {
    paint(ctx, HARD_DOME, c.accent, '#d69a12', HARD_SHADE, '#fff0a8', ell(-3, -62.5, 4, 1.6, -0.4));
    ctx.save(); ctx.lineWidth = LW * 0.7; ctx.stroke(HARD_RIDGE); ctx.restore();
    paint(ctx, HARD_BRIM, '#f0b01e', '#c98d0c', ell(-6, -49.5, 12, 2));
    paint(ctx, LAMP, '#5b636d', null);
    ctx.fillStyle = '#fff6b0'; ctx.fill(LAMP_LENS); ctx.stroke(LAMP_LENS);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,238,140,0.9)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(19, -61.5); ctx.lineTo(22, -63.5);
    ctx.moveTo(19.5, -58.5); ctx.lineTo(23.2, -58.5);
    ctx.moveTo(19, -55.5); ctx.lineTo(22, -53.5);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBack(ctx, ch, pose, r) {
  const c = ch.colors;
  if (ch.id === 'yoru') drawCape(ctx, c, pose, r);
  if (ch.id === 'capy') {
    paint(ctx, PACK, '#d4763a', '#a4552a', PACK_SHADE, '#eb9a5f', ell(-15, -31, 3, 1.3));
    paint(ctx, PACK_POCKET, '#c0612c', null);
    ctx.save(); ctx.lineWidth = LW * 0.8; ctx.strokeStyle = '#6b6f76'; ctx.stroke(CARABINER);
    ctx.lineWidth = LW * 0.35; ctx.strokeStyle = OL; ctx.stroke(CARABINER); ctx.restore();
    paint(ctx, ROLL, '#c9683a', '#9f4c26', ell(-17, -32, 10, 3), '#e98b5c', ell(-18, -39.5, 5, 1));
    paint(ctx, ROLL_END, '#e8a06a', null);
    ctx.save(); ctx.lineWidth = LW * 0.5;
    ctx.beginPath(); ctx.ellipse(-9.5, -36.5, 1.6, 2.4, 0, 0.5, TAU - 0.3); ctx.stroke();
    ctx.strokeStyle = c.trim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-19, -41); ctx.lineTo(-19, -32); ctx.stroke();
    ctx.restore();
  }
}

function drawFront(ctx, ch) {
  const c = ch.colors;
  if (ch.id === 'capy') {
    paint(ctx, STRAP, '#8a4a26', null);
    paint(ctx, BUCKLE, c.trim, null);
  } else if (ch.id === 'chang') {
    paint(ctx, WRENCH, '#aeb5bf', '#7f8791', ell(-8, -4, 1.5, 8));
    ctx.save(); ctx.translate(2, 0);
    paint(ctx, HAMMER_HANDLE, '#a0703a', null);
    paint(ctx, HAMMER_HEAD, '#8e959f', null);
    ctx.restore();
    paint(ctx, BELT, '#6b4526', '#4d3019', ell(-16, -8, 8, 5));
    paint(ctx, BELT_BUCKLE, '#d8dde3', null);
    ctx.fillStyle = '#6b4526';
    ctx.fillRect(7, -11.6, 2, 2.5);
  } else if (ch.id === 'yoru') {
    paint(ctx, COLLAR, c.accent, '#5f2596', ell(0, -28, 10, 3));
    paint(ctx, CLASP, c.trim, '#c9982c', ell(9.5, -29.5, 2, 1.2));
  }
}

// ------------------------------------------------------------------ public
export function drawCharacter(ctx, id, pose = {}) {
  const ch = BY_ID[id] || CHARACTERS[0];
  const c = ch.colors;
  const r = rig(pose);
  const t = pose.t || 0;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = LW;
  ctx.strokeStyle = OL;

  // speed lines behind a spin, drawn unrotated
  if (r.lines) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2.2;
    const s = r.spin;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, -27, 30 + i * 5, s + i * 2.1, s + i * 2.1 + 1.1);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.translate(0, r.y);
  if (pose.facing === -1) ctx.scale(-1, 1);
  if (r.spin) { ctx.translate(0, -27); ctx.rotate(r.spin); ctx.translate(0, 27); }
  ctx.rotate(r.rot);
  ctx.scale(r.sx, r.sy);

  drawBack(ctx, ch, pose, r);
  drawLeg(ctx, -8, r.legB, c.shade, c.shade);
  drawArm(ctx, -3, -25, r.armB, c.shade, c.shade);
  drawLeg(ctx, 5, r.legF, c.fur, c.shade);
  paint(ctx, BODY, c.fur, c.shade, BODY_SHADE, c.light, BODY_HI);
  drawFront(ctx, ch);

  ctx.save();
  ctx.translate(2, 0);
  ctx.translate(0, -33); ctx.rotate(r.head); ctx.scale(HEAD_K, HEAD_K); ctx.translate(0, 33);
  drawHead(ctx, ch, r);
  if (r.sweat) {
    ctx.save();
    ctx.translate(-12, -52 + (t * 30) % 8);
    ctx.fillStyle = '#8fd8ff'; ctx.lineWidth = LW * 0.5;
    ctx.fill(DROP); ctx.stroke(DROP);
    ctx.restore();
  }
  ctx.restore();

  drawArm(ctx, 11.5, -23, r.armF, c.fur, c.shade);
  ctx.restore();

  // dizzy stars orbit above the head, in screen orientation
  if (r.stars) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = OL; ctx.lineWidth = 1.3;
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + i * TAU / 3;
      ctx.save();
      ctx.translate(Math.cos(a) * 14, -62 + Math.sin(a) * 4 + r.y);
      ctx.rotate(t * 3);
      ctx.fillStyle = '#ffd23f';
      ctx.fill(STAR); ctx.stroke(STAR);
      ctx.restore();
    }
    ctx.restore();
  }
}

// select-screen bust: badge with rays behind a big posed character
export function drawPortrait(ctx, id, w, h, t = 0) {
  const ch = BY_ID[id] || CHARACTERS[0];
  const c = ch.colors;
  const cx = w / 2, cy = h * 0.52;
  const R = Math.min(w, h) * 0.44;

  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
  // rays
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.25);
  ctx.fillStyle = c.accent;
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a0 = i * TAU / 12, a1 = a0 + TAU / 24;
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R * 1.5, a0, a1);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
  // badge
  ctx.fillStyle = c.accent;
  ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.82, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(2, R * 0.05);
  ctx.strokeStyle = OL;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  // ground shadow
  const k = (h * 0.78) / 68;
  const feetY = cy + R * 0.78;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(cx, feetY, 17 * k, 3.5 * k, 0, 0, TAU); ctx.fill();
  // the character: idle, with a little celebratory hop every few seconds
  const cyc = t % 4;
  const pose = cyc > 3.1
    ? { anim: 'cheer', t: cyc - 3.1, facing: 1 }
    : { anim: 'idle', t, facing: 1 };
  ctx.translate(cx - 2 * k, feetY);
  ctx.scale(k, k);
  drawCharacter(ctx, ch.id, pose);
  ctx.restore();
}

export function characterById(id) { return BY_ID[id] || CHARACTERS[0]; }
