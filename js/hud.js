// In-canvas HUD, cel-shaded to match the art: Icy Tower's clock (top left),
// the draining combo meter down the left wall, score and floor, the race
// ladder down the right wall, HURRY UP and the 3-2-1-GO countdown.
import { VIEW_W, VIEW_H, WALL_W } from './world.js';
import { TUNING } from './game.js';
import { drawCharacter } from './characters.js';

const INK = '#1f1612';
const FONT = '"Lilita One", "Trebuchet MS", system-ui, sans-serif';

function outlinedText(ctx, text, x, y, size, fill, align = 'center', stroke = INK) {
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.2); ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

function panel(ctx, x, y, w, h, r, fill) {
  ctx.fillStyle = 'rgba(31,22,18,.35)';
  ctx.beginPath(); ctx.roundRect(x + 2, y + 3, w, h, r); ctx.fill();
  ctx.fillStyle = fill; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.stroke();
}

export function drawHud(ctx, g, opts = {}) {
  drawClock(ctx, g);
  drawScore(ctx, g);
  drawComboMeter(ctx, g);
  drawWind(ctx, g);
  if (g.race) drawLadder(ctx, g, opts.players || []);
  if (g.hurryFlash > 0) {
    const k = g.hurryFlash;
    if (Math.floor(k * 6) % 2 === 0 || k < 0.6) {
      const s = 1 + Math.max(0, k - 1.8) * 1.5;
      ctx.save(); ctx.translate(VIEW_W / 2, VIEW_H * 0.2); ctx.scale(s, s); ctx.rotate(-0.06);
      outlinedText(ctx, 'HURRY UP!', 0, 0, 40, '#ff5a4a');
      ctx.restore();
    }
  }
  if (g.countdown > 0) {
    const n = Math.ceil(g.countdown);
    const f = g.countdown - Math.floor(g.countdown);
    ctx.save(); ctx.translate(VIEW_W / 2, VIEW_H * 0.42); const s = 0.8 + f * 0.8; ctx.scale(s, s);
    outlinedText(ctx, String(n), 0, 0, 96, '#ffe45c');
    ctx.restore();
  } else if (g.race && g.time < 0.8) {
    ctx.save(); ctx.globalAlpha = 1 - g.time / 0.8;
    outlinedText(ctx, 'GO!', VIEW_W / 2, VIEW_H * 0.42, 96, '#7be08a');
    ctx.restore();
  }
  if (g.over && g.race && g.spectate && opts.spectateName) {
    outlinedText(ctx, `SPECTATING ${opts.spectateName}`, VIEW_W / 2, VIEW_H - 40, 18, '#fff3da');
  }
}

function drawClock(ctx, g) {
  const cx = WALL_W + 30, cy = 38, r = 24;
  // bell ears
  ctx.fillStyle = '#ffd166'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.arc(cx + s * 17, cy - 19, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  const shakeX = g.hurryFlash > 0 || g.level >= TUNING.SCROLL_LEVELS.length - 1 ? Math.sin(performance.now() / 20) * 2 : 0;
  ctx.fillStyle = '#fff6e4';
  ctx.beginPath(); ctx.arc(cx + shakeX, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f1d9b0';
  ctx.beginPath(); ctx.arc(cx + shakeX, cy, r, Math.PI * 0.1, Math.PI * 0.9); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + shakeX, cy, r, 0, Math.PI * 2); ctx.stroke();
  // ticks
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    ctx.lineWidth = i % 3 ? 1.5 : 2.5;
    ctx.beginPath();
    ctx.moveTo(cx + shakeX + Math.sin(a) * (r - 5), cy - Math.cos(a) * (r - 5));
    ctx.lineTo(cx + shakeX + Math.sin(a) * (r - 2), cy - Math.cos(a) * (r - 2));
    ctx.stroke();
  }
  // hand: one lap per speed-up interval
  // on the last speed step the hand runs backwards, like the original
  const maxed = g.level >= TUNING.SCROLL_LEVELS.length - 1;
  const lap = (g.clockT % TUNING.HURRY_EVERY) / TUNING.HURRY_EVERY;
  const a = g.clockOn ? (maxed ? -lap : lap) * Math.PI * 2 : 0;
  ctx.strokeStyle = '#e4553f'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx + shakeX, cy);
  ctx.lineTo(cx + shakeX + Math.sin(a) * (r - 7), cy - Math.cos(a) * (r - 7)); ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx + shakeX, cy, 3, 0, Math.PI * 2); ctx.fill();
  ctx.lineCap = 'butt';
  // speed level pips
  const lvl = g.clockOn ? g.level : 0;
  outlinedText(ctx, lvl ? `SPEED ${lvl}` : 'READY', cx, cy + r + 13, 11, lvl ? '#ffe45c' : '#fff3da');
}

function drawScore(ctx, g) {
  const x = VIEW_W - WALL_W - 10;
  outlinedText(ctx, String(g.score), x, 24, 26, '#fff3da', 'right');
  const summit = g.tower.summit;
  outlinedText(ctx, summit ? `FLOOR ${g.maxFloor} / ${summit}` : `FLOOR ${g.maxFloor}`, x, 50, 15, '#ffe45c', 'right');
  if (summit) {
    // summit progress bar under the floor count
    const w = 110, k = Math.min(1, g.maxFloor / summit);
    ctx.fillStyle = 'rgba(255,246,228,.85)'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x - w, 62, w, 9, 5); ctx.fill(); ctx.stroke();
    if (k > 0) { ctx.fillStyle = g.map.color || '#7be08a'; ctx.beginPath(); ctx.roundRect(x - w + 1.5, 63.5, (w - 3) * k, 6, 3); ctx.fill(); }
  }
}

function drawWind(ctx, g) {
  if (!g.windWarn && !g.wind) return;
  const dir = g.windDir || 1;
  const blink = g.windWarn && Math.floor(performance.now() / 150) % 2;
  if (blink) return;
  ctx.save(); ctx.translate(VIEW_W / 2, 118);
  outlinedText(ctx, dir > 0 ? 'WIND  ➜' : '⬅  WIND', 0, 0, g.wind ? 26 : 20, g.wind ? '#9fd0ff' : '#fff3da');
  ctx.restore();
}

function drawComboMeter(ctx, g) {
  const c = g.combo;
  const x = WALL_W + 8, y = 120, w = 16, h = 230;
  panel(ctx, x, y, w, h, 7, 'rgba(255,246,228,.9)');
  const k = c.active ? Math.max(0, c.timer / TUNING.COMBO_TIME) : 0;
  if (k > 0) {
    const fh = (h - 6) * k;
    const grad = ctx.createLinearGradient(0, y + h, 0, y);
    grad.addColorStop(0, '#ff5a4a'); grad.addColorStop(0.5, '#ffb43d'); grad.addColorStop(1, '#ffe45c');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(x + 3, y + h - 3 - fh, w - 6, fh, 4); ctx.fill();
  }
  outlinedText(ctx, 'COMBO', x + w / 2, y - 12, 10, '#fff3da');
  if (c.active && c.jumps >= 1) {
    const pulse = 1 + Math.sin(performance.now() / 90) * 0.06;
    ctx.save(); ctx.translate(x + w / 2 + 2, y + h + 22); ctx.scale(pulse, pulse);
    outlinedText(ctx, String(c.floors), 0, 0, 24, c.jumps >= 2 ? '#ffe45c' : '#fff3da');
    ctx.restore();
  }
}

// Race ladder down the right wall: everyone's height relative to the leader.
function drawLadder(ctx, g, players) {
  const x = VIEW_W - WALL_W - 22, top = 92, h = 300;
  panel(ctx, x - 6, top - 8, 20, h + 16, 8, 'rgba(255,246,228,.85)');
  const maxF = Math.max(10, ...players.map(p => p.floor || 0));
  const sorted = players.slice().sort((a, b) => (a.floor || 0) - (b.floor || 0));
  sorted.forEach((p, i) => {
    const yy = top + h - (Math.min(p.floor || 0, maxF) / maxF) * h;
    ctx.save();
    ctx.translate(x + 4 - (i % 2) * 20, yy);
    ctx.globalAlpha = p.out ? 0.45 : 1;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fillStyle = p.color; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.clip();
    ctx.translate(0, 18); ctx.scale(0.42, 0.42);
    drawCharacter(ctx, p.char, { anim: 'idle', t: 0, facing: -1, spin: 0, squash: 0, vx: 0, vy: 0 });
    ctx.restore();
    if (p.me) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  });
}
