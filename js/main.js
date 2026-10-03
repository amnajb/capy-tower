// Screens, the fixed-step loop, input (keyboard / touch / gamepad), records,
// music and the online race glue.
import { VIEW_W, VIEW_H, THEMES, themeIndexForFloor } from './world.js';
import { CHARACTERS, drawCharacter, drawPortrait } from './characters.js';
import { Game } from './game.js';
import { drawHud } from './hud.js';
import { createAudio } from './audio.js';
import { Net } from './net.js';
import { installZoomGuards, haptic, keepAwake, registerPWA, onInstallAvailable, canInstall,
         promptInstall, isStandalone } from './mobile.js';

installZoomGuards();
registerPWA();

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const store = {
  get(k, d) { try { const v = localStorage.getItem('capytower.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('capytower.' + k, JSON.stringify(v)); } catch (e) {} },
};
const PLAYER_COLORS = ['#ffb43d', '#8fe6ff', '#7be08a', '#ff7eb6'];
const DT = 1 / 120;                          // fixed physics step: same jumps at any frame rate

// ---------------------------------------------------------------- canvas
const canvas = $('#game');
const ctx = canvas.getContext('2d');
let scale = 1;
// touch devices: any coarse pointer, or the first real touch (iPad + keyboard)
let isTouch = matchMedia('(any-pointer: coarse)').matches;
window.addEventListener('touchstart', () => { if (!isTouch) { isTouch = true; resize(); } }, { once: true, passive: true });

// Layout. On a phone in play the controls get their own space instead of
// covering the tower: docked in the band under the game in portrait, or in
// the side panels in landscape.
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  const touchPlay = isTouch && screen === 'play';
  const side = touchPlay && W > H * 1.05;
  const dock = touchPlay && !side;
  const probe = getComputedStyle($('#safe-probe'));
  const safeTop = dock ? parseFloat(probe.paddingTop) || 0 : 0;
  const safeBot = dock ? parseFloat(probe.paddingBottom) || 0 : 0;
  const ctrlH = dock ? Math.round(Math.min(220, Math.max(140, H * 0.22)) + safeBot) : 0;
  // landscape: the side panels take all the width the portrait game leaves
  const sideW = side ? Math.round(Math.min(340, Math.max(120, (W - VIEW_W * H / VIEW_H) / 2 - 8))) : 0;
  const fit = Math.min((W - sideW * 2) / VIEW_W, (H - ctrlH - safeTop) / VIEW_H);
  document.body.classList.toggle('dock', dock);
  document.body.classList.toggle('side', side);
  // controls grow into whatever is left under the game (tall phones)
  const ctrlFill = dock ? Math.round(Math.min(300, Math.max(ctrlH, H - safeTop - VIEW_H * fit))) : 0;
  document.documentElement.style.setProperty('--ctrl-h', ctrlFill + 'px');
  document.documentElement.style.setProperty('--side-w', sideW + 'px');
  canvas.style.width = VIEW_W * fit + 'px';
  canvas.style.height = VIEW_H * fit + 'px';
  scale = fit * dpr;
  canvas.width = Math.round(VIEW_W * scale);
  canvas.height = Math.round(VIEW_H * scale);
  document.documentElement.style.setProperty('--fit', fit);
  $('#stage').style.width = VIEW_W * fit + 'px';
  $('#stage').style.height = VIEW_H * fit + 'px';
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 150));

// ---------------------------------------------------------------- state
let audio = null;
function ensureAudio() {
  if (!audio) {
    try { audio = createAudio(); audio.setMuted(store.get('muted', false)); audio.music.start(); }
    catch (e) { console.warn('audio unavailable', e); }
  }
  if (audio && audio.ctx.state === 'suspended') audio.ctx.resume();
  return audio;
}

let screen = 'title';
let history = [];
let game = null;
let mode = 'solo';                           // solo | race
let paused = false;
let charIdx = Math.max(0, CHARACTERS.findIndex(c => c.id === store.get('char', 'capy')));
let records = store.get('records', { score: 0, floor: 0, combo: 0 });
let lastTheme = -1;
const net = new Net();
let race = null;                             // { players: Map, countdown, meIdx }

function show(name, push = true) {
  if (push && screen !== name) history.push(screen);
  screen = name;
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === 's-' + name));
  if (name === 'title') renderRecords();
  if (name === 'select') renderRoster();
  if (name === 'online') { $('#name').value = playerName(); $('#online-status').textContent = net.error || ''; }
  const first = $(`#s-${name} .btn.big`) || $(`#s-${name} .btn`);
  if (first && name !== 'online') setTimeout(() => first.focus({ preventScroll: true }), 0);
  $('#touch').classList.toggle('on', name === 'play' && isTouch);
  keepAwake(name === 'play' || name === 'lobby');
  resize();
}
function back() { show(history.pop() || 'title', false); }

function playerName() {
  let n = store.get('name', '');
  if (!n) { n = 'Capy' + Math.floor(100 + Math.random() * 900); store.set('name', n); }
  return n;
}

function toast(msg, ms = 1800) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), ms);
}

// ---------------------------------------------------------------- menus
$$('[data-go]').forEach(b => b.addEventListener('click', () => {
  ensureAudio(); audio && audio.sfx.confirm();
  const go = b.dataset.go;
  if (go === 'solo') { mode = 'solo'; show('select'); }
  else if (go === 'online') { mode = 'race'; show('select'); }
  else show(go);
}));
$$('[data-back]').forEach(b => b.addEventListener('click', () => { audio && audio.sfx.select(); back(); }));

function renderRecords() {
  $('#records').innerHTML = records.score
    ? `<span>BEST <b>${records.score}</b></span><span>FLOOR <b>${records.floor}</b></span><span>COMBO <b>${records.combo}</b></span>`
    : '<span>climb the tower. don\'t fall.</span>';
}

// character select: live-animated portraits
const portraitCanvases = [];
function renderRoster() {
  const box = $('#roster');
  if (!box.children.length) {
    CHARACTERS.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'card';
      b.innerHTML = `<canvas width="176" height="220"></canvas><span>${c.name}</span>`;
      b.addEventListener('click', () => { if (charIdx === i) confirmChar(); else pickChar(i); });
      b.addEventListener('focus', () => pickChar(i, true));
      box.appendChild(b);
      portraitCanvases.push(b.querySelector('canvas'));
    });
  }
  pickChar(charIdx, true);
}
function pickChar(i, quiet) {
  charIdx = (i + CHARACTERS.length) % CHARACTERS.length;
  const c = CHARACTERS[charIdx];
  $$('#roster .card').forEach((b, j) => b.classList.toggle('sel', j === charIdx));
  const bar = (label, v) => `<div class="stat"><i>${label}</i><u style="--v:${Math.round((v - 0.9) / 0.2 * 100)}%"></u></div>`;
  $('#char-info').innerHTML = `<h3>${c.name} <em>${c.tag}</em></h3><p>${c.blurb}</p>` +
    bar('SPEED', c.stats.speed) + bar('RUN-UP', c.stats.accel) + bar('JUMP', c.stats.jump);
  if (!quiet) audio && audio.sfx.select();
}
function confirmChar() {
  ensureAudio(); audio && audio.sfx.confirm();
  store.set('char', CHARACTERS[charIdx].id);
  if (mode === 'solo') startSolo();
  else if (net.room) { net.hello(playerName(), CHARACTERS[charIdx].id); show('lobby'); renderLobby(); }
  else {
    show('online');
    const code = $('#code').value.trim();
    if (inviteCode.length === 4 && code === inviteCode && !confirmChar.joined) {
      confirmChar.joined = true;
      $('#join').click();
    }
  }
}
$('#select-go').addEventListener('click', confirmChar);

// ---------------------------------------------------------------- solo
function startSolo() {
  mode = 'solo';
  game = new Game({ seed: (Math.random() * 2147483647) | 0, char: CHARACTERS[charIdx].id, audio });
  paused = false; lastTheme = -1;
  show('play');
}
$('#again').addEventListener('click', () => { ensureAudio(); startSolo(); });

function soloOver() {
  const g = game;
  const nb = { score: g.score > records.score, floor: g.maxFloor > records.floor, combo: g.bestCombo > records.combo };
  records = { score: Math.max(records.score, g.score), floor: Math.max(records.floor, g.maxFloor),
              combo: Math.max(records.combo, g.bestCombo) };
  store.set('records', records);
  const row = (k, v, best, isNew) => `<div class="sc"><i>${k}</i><b>${v}</b>${isNew ? '<em>NEW BEST!</em>' : `<small>best ${best}</small>`}</div>`;
  $('#scorecard').innerHTML = row('SCORE', g.score, records.score, nb.score) +
    row('FLOOR', g.maxFloor, records.floor, nb.floor) + row('BEST COMBO', g.bestCombo, records.combo, nb.combo);
  show('over');
}

// ---------------------------------------------------------------- online
async function goOnline(action) {
  ensureAudio();
  const name = ($('#name').value || '').trim() || playerName();
  store.set('name', name);
  $('#online-status').textContent = 'Connecting…';
  try { await net.connect(name, CHARACTERS[charIdx].id); }
  catch (e) { $('#online-status').textContent = net.error || 'Could not reach the race server.'; return; }
  $('#online-status').textContent = '';
  action();
}
$('#quick').addEventListener('click', () => goOnline(() => net.quick()));
$('#create').addEventListener('click', () => goOnline(() => net.create(false)));
$('#join').addEventListener('click', () => {
  const code = $('#code').value.trim().toUpperCase();
  if (code.length !== 4) { $('#online-status').textContent = 'Room codes are 4 letters.'; return; }
  goOnline(() => net.join(code));
});
$('#code').addEventListener('keydown', e => { if (e.key === 'Enter') $('#join').click(); });
$('#leave').addEventListener('click', () => { net.leave(); show('online', false); });
$('#results-leave').addEventListener('click', () => { net.leave(); show('online', false); });
$('#rematch').addEventListener('click', () => { show('lobby', false); renderLobby(); });
$('#change-char').addEventListener('click', () => { mode = 'race'; show('select'); });
// invite: native share sheet on phones, clipboard elsewhere
$('#invite').addEventListener('click', async () => {
  if (!net.room) return;
  const url = `${location.origin}${location.pathname}?room=${net.room.code}`;
  const text = `Race me up Capy Tower! Room ${net.room.code}`;
  try {
    if (navigator.share) { await navigator.share({ title: 'Capy Tower race', text, url }); return; }
    await navigator.clipboard.writeText(url); toast('Invite link copied');
  } catch (e) { if (e && e.name !== 'AbortError') toast(`Room code: ${net.room.code}`, 2600); }
});
$('#ready').addEventListener('click', () => {
  if (!net.room) return;
  audio && audio.sfx.confirm();
  if (net.isHost) net.start();
  else { const me = net.room.players.find(p => p.id === net.id); net.ready(!(me && me.ready)); }
});

net.on('joined', () => { audio && audio.sfx.join(); $('#toast').classList.remove('on'); show('lobby'); });
net.on('lobby', () => { if (screen === 'lobby') renderLobby(); });
net.on('err', m => { $('#online-status').textContent = m.msg; $('#lobby-status').textContent = m.msg; toast(m.msg); });
net.on('ev', m => {
  if (m.k === 'join') { audio && audio.sfx.join(); toast(`${m.d && m.d.name || 'A capy'} joined`); return; }
  if (!race) return;
  const r = race.players.get(m.id);
  if (r && m.k === 'praise' && m.d) toast(`${r.name}: ${m.d.word} (${m.d.floors})`, 1400);
});
net.on('close', () => {
  if (screen === 'lobby' || screen === 'results' || (screen === 'play' && mode === 'race')) {
    toast('Disconnected from the race server', 2600);
    if (screen !== 'play') show('online', false);
  }
});
net.on('go', m => startRace(m));
net.on('sync', m => {
  if (!race) return;
  for (const { id, d } of m.p) {
    const r = race.players.get(id);
    if (r && d) { r.target = d; r.floor = d.fl; r.score = d.sc; }
  }
});
net.on('out', m => {
  if (!race) return;
  const r = race.players.get(m.id);
  if (r) { r.out = true; r.floor = m.result.floor; toast(`${r.name} fell off on floor ${m.result.floor}!`, 1600); }
});
net.on('results', m => {
  race && (race.results = m.order);
  if (screen === 'play' && game && game.over) setTimeout(() => showResults(m.order), 900);
  else if (race) race.pendingResults = m.order;
});

function renderLobby() {
  const r = net.room;
  if (!r) return;
  $('#room-code').textContent = r.code;
  $('#lobby-sub').textContent = r.pub ? 'Public room · friends can join with the code' : 'Private room · share the code';
  const slots = $('#slots');
  slots.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const p = r.players[i];
    const d = document.createElement('div');
    d.className = 'slot' + (p ? '' : ' empty') + (p && p.id === net.id ? ' me' : '');
    d.style.setProperty('--pc', PLAYER_COLORS[i]);
    if (p) {
      d.innerHTML = `<canvas width="120" height="120"></canvas><b>${esc(p.name)}</b>` +
        `<span class="badge ${p.host ? 'host' : p.ready ? 'ready' : ''}">${p.host ? 'HOST' : p.ready ? 'READY' : 'waiting'}</span>`;
      d.dataset.char = p.char;
    } else d.innerHTML = '<b>open slot</b>';
    slots.appendChild(d);
  }
  const me = r.players.find(p => p.id === net.id);
  const ready = $('#ready');
  if (net.isHost) {
    const others = r.players.filter(p => !p.host);
    const allReady = others.every(p => p.ready);
    ready.textContent = r.players.length < 2 ? 'Start solo race' : allReady ? 'Start race!' : 'Start anyway';
  } else ready.textContent = me && me.ready ? 'Not ready' : 'Ready';
  $('#lobby-status').textContent = net.isHost ? 'You are the host: start when everyone is ready.' : 'Waiting for the host to start…';
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function startRace(m) {
  ensureAudio();
  const players = new Map();
  m.players.forEach((p, i) => {
    if (p.id === net.id) return;
    players.set(p.id, { id: p.id, name: p.name, char: p.char, color: PLAYER_COLORS[i % 4],
                        target: { x: VIEW_W / 2, y: 0, a: 'idle', f: 1, sp: 0, fl: 0, sc: 0, cam: 0 },
                        floor: 0, out: false });
  });
  race = { players, countdown: m.countdown / 1000, meIdx: m.players.findIndex(p => p.id === net.id) };
  mode = 'race';
  game = new Game({ seed: m.seed, char: CHARACTERS[charIdx].id, audio, name: playerName(),
                    race: { net, players, countdown: race.countdown } });
  paused = false; lastTheme = -1;
  show('play');
}

function showResults(order) {
  race = null;
  const pod = $('#podium');
  pod.innerHTML = '';
  order.forEach((p, i) => {
    const d = document.createElement('div');
    d.className = 'place p' + (i + 1) + (p.id === net.id ? ' me' : '');
    d.innerHTML = `<i>${['1ST', '2ND', '3RD', '4TH'][i]}</i><canvas width="120" height="130"></canvas>` +
      `<b>${esc(p.name)}</b><span>floor ${p.floor} · ${p.score} pts</span>`;
    d.dataset.char = p.char; d.dataset.win = i === 0 ? '1' : '';
    pod.appendChild(d);
  });
  show('results');
}

// ---------------------------------------------------------------- input
const input = { left: false, right: false, jump: false };
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
               ArrowUp: 'jump', KeyW: 'jump', Space: 'jump' };

window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  const k = KEYS[e.code];
  if (screen === 'play') {
    if (k) {
      e.preventDefault();
      if (k === 'jump' && !e.repeat) {
        if (game && game.over && mode === 'solo' && game.overT > 0.6) { startSolo(); return; }
        game && !paused && game.jumpPressed();
      }
      input[k] = true;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') { if (mode === 'solo') paused = !paused; e.preventDefault(); }
    if (e.code === 'KeyR' && mode === 'solo') startSolo();
  } else if (screen === 'select') {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { pickChar(charIdx - 1); focusCard(); e.preventDefault(); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { pickChar(charIdx + 1); focusCard(); e.preventDefault(); }
    if (e.code === 'Enter' && document.activeElement && document.activeElement.classList.contains('card')) { confirmChar(); e.preventDefault(); }
    if (e.code === 'Escape') back();
  } else if (screen === 'over') {
    if (e.code === 'Space' || e.code === 'KeyR') { e.preventDefault(); startSolo(); }
  } else if (e.code === 'Escape' && screen !== 'title' && screen !== 'lobby') back();
  if (e.code === 'KeyM') { ensureAudio(); if (audio) { audio.setMuted(!audio.muted); store.set('muted', audio.muted); toast(audio.muted ? 'Muted' : 'Sound on', 900); } }
  if (e.code === 'KeyN' && audio) { audio.music.next(); }
});
window.addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) input[k] = false; });
window.addEventListener('blur', () => { input.left = input.right = input.jump = false; });
function focusCard() { const c = $$('#roster .card')[charIdx]; c && c.focus({ preventScroll: true }); }
document.addEventListener('pointerdown', () => ensureAudio(), { once: true });
// iOS only unlocks Web Audio inside touchend on older versions
document.addEventListener('touchend', () => { if (audio && audio.ctx.state !== 'running' && !document.hidden) audio.ctx.resume(); }, { passive: true });

// touch controls: a steering pad (slide your thumb between left and right
// without lifting) and a big JUMP pad. Each tracks its own pointer, so
// steering and jumping are true multi-touch.
const steer = $('#steer'), jumpPad = $('#jump-pad');
let steerId = null, jumpId = null;
function steerAt(e) {
  const r = steer.getBoundingClientRect();
  const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
  const dead = 0.12;
  input.left = dx < -dead; input.right = dx > dead;
  steer.dataset.dir = input.left ? 'l' : input.right ? 'r' : '';
  steer.style.setProperty('--kx', Math.max(-1, Math.min(1, dx)).toFixed(3));
}
function steerEnd(e) {
  if (e.pointerId !== steerId) return;
  steerId = null; input.left = input.right = false;
  steer.dataset.dir = ''; steer.style.setProperty('--kx', 0);
}
steer.addEventListener('pointerdown', e => {
  e.preventDefault(); ensureAudio();
  steerId = e.pointerId; steer.setPointerCapture(e.pointerId); steerAt(e);
});
steer.addEventListener('pointermove', e => { if (e.pointerId === steerId) { e.preventDefault(); steerAt(e); } });
steer.addEventListener('pointerup', steerEnd);
steer.addEventListener('pointercancel', steerEnd);
steer.addEventListener('lostpointercapture', steerEnd);

function jumpDown(e) {
  e.preventDefault(); ensureAudio();
  jumpId = e.pointerId; jumpPad.setPointerCapture(e.pointerId);
  jumpPad.classList.add('down'); input.jump = true;
  if (game && game.over && mode === 'solo' && game.overT > 0.6) { startSolo(); return; }
  if (paused) { paused = false; return; }
  game && game.jumpPressed();
  haptic(8);
}
function jumpUp(e) {
  if (e.pointerId !== jumpId) return;
  jumpId = null; input.jump = false; jumpPad.classList.remove('down');
}
jumpPad.addEventListener('pointerdown', jumpDown);
jumpPad.addEventListener('pointerup', jumpUp);
jumpPad.addEventListener('pointercancel', jumpUp);
jumpPad.addEventListener('lostpointercapture', jumpUp);
$('#pause-btn').addEventListener('click', () => {
  if (mode === 'solo' && game && !game.over) { paused = !paused; audio && audio.sfx.select(); }
});

// phones: leaving the app (call, home button, lock) pauses a solo climb and
// quiets the music; the race keeps going (the tower doesn't wait for anyone)
document.addEventListener('visibilitychange', () => {
  const hidden = document.visibilityState === 'hidden';
  if (hidden) {
    if (screen === 'play' && mode === 'solo' && game && !game.over) paused = true;
    input.left = input.right = input.jump = false;
    if (audio && audio.ctx.state === 'running') audio.ctx.suspend();
  } else {
    if (audio && !audio.muted) audio.ctx.resume();
    keepAwake(screen === 'play' || screen === 'lobby');
  }
});

// install as an app (Android/desktop prompt, iOS instructions)
const installBtn = $('#install');
onInstallAvailable(() => { installBtn.hidden = !canInstall(); });
installBtn.addEventListener('click', async () => {
  const r = await promptInstall();
  if (r === 'ios') show('install');
});
document.documentElement.classList.toggle('standalone', isStandalone());

// gamepad: d-pad / left stick + A
let padJump = false;
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads && Array.from(pads).find(Boolean);
  if (!gp) return null;
  const ax = gp.axes[0] || 0;
  const j = !!(gp.buttons[0] && gp.buttons[0].pressed) || !!(gp.buttons[12] && gp.buttons[12].pressed);
  const st = { left: ax < -0.35 || !!(gp.buttons[14] && gp.buttons[14].pressed),
               right: ax > 0.35 || !!(gp.buttons[15] && gp.buttons[15].pressed), jump: j };
  if (j && !padJump && screen === 'play' && game) {
    if (game.over && mode === 'solo' && game.overT > 0.6) startSolo(); else game.jumpPressed();
  }
  padJump = j;
  return st;
}

// ---------------------------------------------------------------- loop
let acc = 0, last = performance.now();
const titleCanvas = $('#title-capy');
const tctx = titleCanvas.getContext('2d');

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const pad = pollPad();
  const inp = pad ? { left: input.left || pad.left, right: input.right || pad.right } : input;

  if (screen === 'play' && game && !paused) {
    acc += dt;
    while (acc >= DT) { game.update(DT, inp); acc -= DT; }
    afterStep();
  } else acc = 0;

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (game && (screen === 'play' || screen === 'over' || screen === 'results')) {
    game.draw(ctx);
    drawHud(ctx, game, hudOpts());
    if (paused) {
      ctx.fillStyle = 'rgba(15,20,30,.55)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.font = '900 44px "Lilita One", system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 8;
      ctx.strokeStyle = '#1f1612'; ctx.strokeText('PAUSED', VIEW_W / 2, VIEW_H / 2);
      ctx.fillStyle = '#fff3da'; ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2);
    }
  } else drawAttract(now / 1000);
  drawMenuArt(now / 1000);
}

// title/menu background: a slow tower pan
let attract = null;
function drawAttract(t) {
  if (!attract) attract = new Game({ seed: 1234, char: 'capy', audio: null });
  attract.camY = t * 40 % 20000;
  attract.p.y = -9999;                       // keep the demo capy out of shot
  attract.draw(ctx);
  ctx.fillStyle = 'rgba(8,30,38,.35)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawMenuArt(t) {
  if (screen === 'title') {
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.clearRect(0, 0, titleCanvas.width, titleCanvas.height);
    CHARACTERS.forEach((c, i) => {
      const x = 40 + i * 70, hop = Math.max(0, Math.sin(t * 3 + i * 1.3));
      tctx.save(); tctx.translate(x, 180 - hop * 34); tctx.scale(1.25, 1.25);
      drawCharacter(tctx, c.id, { anim: hop > 0.05 ? 'jump' : 'idle', t: t + i, facing: 1, spin: 0, squash: 0, vx: 0, vy: hop * 400 });
      tctx.restore();
    });
  } else if (screen === 'select') {
    portraitCanvases.forEach((cv, i) => {
      const c2 = cv.getContext('2d');
      c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, cv.width, cv.height);
      drawPortrait(c2, CHARACTERS[i].id, cv.width, cv.height, i === charIdx ? t : 0);
    });
  } else if (screen === 'lobby' || screen === 'results') {
    $$(`#s-${screen} [data-char] canvas`).forEach(cv => {
      const c2 = cv.getContext('2d');
      const win = cv.parentElement.dataset.win === '1';
      c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, cv.width, cv.height);
      c2.save(); c2.translate(cv.width / 2, cv.height - 12); c2.scale(1.5, 1.5);
      drawCharacter(c2, cv.parentElement.dataset.char, { anim: screen === 'results' ? (win ? 'cheer' : 'idle') : 'idle',
        t, facing: 1, spin: 0, squash: 0, vx: 0, vy: 0 });
      c2.restore();
    });
  }
}

function hudOpts() {
  if (!race) return {};
  const players = [{ char: game.char, floor: game.maxFloor, color: PLAYER_COLORS[race.meIdx % 4], me: true, out: game.over }];
  for (const r of race.players.values()) players.push({ char: r.char, floor: r.floor || 0, color: r.color, out: r.out });
  const sp = game.spectate && race.players.get(game.spectate);
  return { players, spectateName: sp && sp.name };
}

function afterStep() {
  const g = game;
  for (const ev of g.events.splice(0)) {
    if (ev.k === 'wall') haptic(12);
    if (ev.k === 'praise') haptic([20, 40, 30]);
    if (ev.k === 'hurry') haptic([40, 60, 40]);
    if (ev.k === 'praise' && mode === 'race') net.event('praise', { word: ev.word, floors: ev.floors });
    if (ev.k === 'hurry' && audio) audio.music.setIntensity(Math.min(1, ev.level / 6));
    if (ev.k === 'dead') {
      haptic(120);
      if (mode === 'solo') setTimeout(() => { if (game === g) soloOver(); }, 1300);
      else net.dead({ floor: g.maxFloor, score: g.score, combo: g.bestCombo });
    }
  }
  if (mode === 'race' && !g.over && g.countdown <= 0) net.state(performance.now(), g.netState());
  if (mode === 'race' && g.over && race && race.pendingResults && g.overT > 1) {
    const o = race.pendingResults; race.pendingResults = null; showResults(o);
  }
  // soundtrack follows the tower: new theme, new beat
  const th = themeIndexForFloor(g.maxFloor) % THEMES.length;
  if (th !== lastTheme) {
    if (lastTheme >= 0 && audio) { audio.music.next(); showTrack(); }
    lastTheme = th;
  }
  if (audio && g.combo.active) audio.music.setIntensity(Math.min(1, 0.3 + g.combo.floors / 60 + g.level / 10));
}

function showTrack() {
  if (!audio || !audio.music.trackName) return;
  const el = $('#track');
  el.textContent = '♪ ' + audio.music.trackName; el.classList.add('on');
  clearTimeout(showTrack.h); showTrack.h = setTimeout(() => el.classList.remove('on'), 2600);
}

// debug handle for headless tests
window.__ct = { get game() { return game; }, get screen() { return screen; }, input, show, startSolo, net,
                pick: i => pickChar(i, true) };

show('title', false);
resize();
requestAnimationFrame(frame);
const params = new URLSearchParams(location.search);
if (params.has('solo')) { mode = 'solo'; startSolo(); }
// invite links: ?room=CODE -> pick a capy, then the online screen with the code filled in
const inviteCode = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
if (inviteCode.length === 4) {
  $('#code').value = inviteCode;
  mode = 'race'; show('select');
  toast(`Pick your capy to join room ${inviteCode}`, 2600);
}
