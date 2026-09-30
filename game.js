(() => {
  'use strict';

  // ================= Config =================
  const VIEW_W = 480;
  const VIEW_H = 720;

  // physics
  const GRAVITY      = 2200;   // px/s^2 downward
  const MAX_FALL     = 1400;   // terminal velocity px/s
  const MOVE_SPEED   = 325;    // max horizontal speed px/s
  const ACCEL_GROUND = 3400;
  const ACCEL_AIR    = 2400;
  const FRICTION     = 3800;   // ground decel when no input
  const JUMP_SPEED   = 880;
  const HOLD_GRAV    = 0.5;    // gravity scale while holding jump & rising
  const COYOTE_S     = 0.10;   // jump grace after leaving a floor
  const BUFFER_S     = 0.12;   // jump pressed slightly early still fires on landing

  // floors
  const FLOOR_H    = 16;
  const SPACING    = 118;
  const SPACING_VAR = 20;
  const ALT_SPACING = 0.30, ALT_SPACING_CAP = 30;  // floors spread out with altitude
  const GAP_MIN    = 76;
  const GAP_MAX    = 170;
  const ALT_GAP    = 0.25, ALT_GAP_CAP = 40;       // holes widen with altitude

  // camera
  const MIN_SCROLL   = 42;     // base auto-rise px/s
  const SCROLL_PER_M = 1.7;    // +px/s per meter climbed

  const COMBO_WINDOW = 1.4;
  const METER_PX     = 100;
  const NIGHT_M      = 140;    // meters to full night sky

  const PLAYER_W = 34;
  const PLAYER_H = 44;
  const WALL = 16;             // tower wall visual width

  // ================= Helpers =================
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpC = (c1, c2, t) => [lerp(c1[0], c2[0], t) | 0, lerp(c1[1], c2[1], t) | 0, lerp(c1[2], c2[2], t) | 0];
  const css = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  const fract = v => v - Math.floor(v);
  const prand = seed => fract(Math.sin(seed * 12.9898) * 43758.5453); // deterministic 0..1

  // ================= DOM =================
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hudHeight = document.getElementById('hud-height');
  const hudBest   = document.getElementById('hud-best');
  const hudCombo  = document.getElementById('hud-combo');
  const overlay   = document.getElementById('overlay');
  const startBtn  = document.getElementById('start-btn');
  const overlayHint = document.getElementById('overlay-hint');

  let dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = VIEW_W * dpr;
    canvas.height = VIEW_H * dpr;
    const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    canvas.style.width = (VIEW_W * scale) + 'px';
    canvas.style.height = (VIEW_H * scale) + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  // ================= State =================
  const state = {
    playing: false, over: false, paused: false, muted: false,
    time: 0,
    px: VIEW_W / 2, py: 0, vx: 0, vy: 0,
    onGround: true, facing: 1,
    lastGroundY: 0, coyoteUntil: 0, jumpBufferedUntil: 0,
    squash: 0,
  };

  let camY = 0;
  let floors = [];       // {top, gapX, gapW, i}
  let floorSeq = 0;
  let particles = [];
  let trail = [];
  let popups = [];
  let clouds = [];
  let stars = [];
  let shake = { t: 0, mag: 0 };
  let best = parseFloat(localStorage.getItem('capy-tower-best') || '0') || 0;
  let newBest = false;
  let heightM = 0;
  let nightT = 0;
  let combo = 0;
  let lastFloorTop = 0;
  let lastLandTime = -1e9;

  let frames = 0;
  let lastTs = performance.now();
  const input = { left: false, right: false, jump: false, jumpHeld: false };

  // ================= Audio =================
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  function blip(freq, dur, type, gain) {
    if (state.muted || !audioCtx) return;
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain || 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
    o.connect(g).connect(audioCtx.destination);
    o.start(t); o.stop(t + (dur || 0.12) + 0.02);
  }

  // ================= Floors =================
  function spacingFor(topPx) {
    const alt = topPx / METER_PX;
    return SPACING + Math.random() * SPACING_VAR + Math.min(ALT_SPACING_CAP, alt * ALT_SPACING);
  }
  function gapFor(topPx) {
    const alt = topPx / METER_PX;
    const gmax = GAP_MAX + Math.min(ALT_GAP_CAP, alt * ALT_GAP);
    const gapW = GAP_MIN + Math.random() * (gmax - GAP_MIN);
    const gapX = 20 + Math.random() * (VIEW_W - 40 - gapW);
    return { gapX, gapW };
  }
  function pushFloor(top, gapX, gapW) {
    floors.push({ top, gapX, gapW, i: floorSeq++ });
  }
  function generateFloors() {
    floors = [];
    floorSeq = 0;
    pushFloor(0, -1, 0); // solid ground
    let top = 0;
    while (top < camY + VIEW_H * 2 + 200) {
      const gap = gapFor(top);
      top += spacingFor(top);
      pushFloor(top, gap.gapX, gap.gapW);
    }
  }
  function ensureFloors() {
    let top = floors.length ? floors[floors.length - 1].top : 0;
    while (top < camY + VIEW_H * 2 + 200) {
      const gap = gapFor(top);
      top += spacingFor(top);
      pushFloor(top, gap.gapX, gap.gapW);
    }
    floors = floors.filter(f => f.top > camY - 60 || f.top === 0);
  }

  // ================= Scenery data =================
  function genClouds() {
    clouds = [];
    for (let i = 0; i < 24; i++) {
      clouds.push({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H * 2, s: 0.4 + Math.random() * 0.9 });
    }
  }
  function genStars() {
    stars = [];
    for (let i = 0; i < 90; i++) {
      stars.push({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.6, tw: Math.random() * Math.PI * 2 });
    }
  }
  // two mountain ridges (deterministic vertex heights)
  const RIDGE_A = [], RIDGE_B = [];
  for (let i = 0; i <= 12; i++) {
    RIDGE_A.push(60 + prand(i * 3 + 1) * 150);
    RIDGE_B.push(40 + prand(i * 7 + 2) * 100);
  }
  genClouds(); genStars();

  // ================= Game flow =================
  function reset() {
    state.px = VIEW_W / 2; state.py = 0;
    state.vx = 0; state.vy = 0;
    state.onGround = true; state.facing = 1;
    state.squash = 0; state.coyoteUntil = 0; state.jumpBufferedUntil = 0;
    camY = 0; heightM = 0; nightT = 0;
    combo = 0; lastFloorTop = 0; lastLandTime = -1e9;
    particles = []; trail = []; popups = [];
    shake = { t: 0, mag: 0 };
    newBest = false;
    generateFloors();
    state.playing = true; state.over = false; state.paused = false;
    overlay.classList.add('hidden');
  }
  function gameOver() {
    state.playing = false; state.over = true;
    newBest = heightM > best;
    if (newBest) {
      best = heightM;
      localStorage.setItem('capy-tower-best', String(best));
    }
    overlayHint.innerHTML = newBest
      ? `<span class="newbest">NEW BEST!</span> ${heightM.toFixed(1)} m`
      : `You climbed ${heightM.toFixed(1)} m — best ${best.toFixed(1)} m`;
    overlay.classList.remove('hidden');
  }
  function startGame() { ensureAudio(); reset(); }

  // ================= Input =================
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', Space: 'jump', KeyW: 'jump',
  };
  function onKeyDown(e) {
    const a = KEYMAP[e.code];
    if (a === 'jump') e.preventDefault();
    if (!a) {
      if (e.code === 'KeyR' && (state.over || state.playing)) startGame();
      if (e.code === 'KeyP' && state.playing) state.paused = !state.paused;
      if (e.code === 'KeyM') state.muted = !state.muted;
      return;
    }
    if (a === 'jump') {
      input.jumpHeld = true;
      if (e.repeat) return;
      if (!state.playing) startGame();
      else if (!state.over) doJump();
      input.jump = true;
    } else {
      input[a] = true;
      ensureAudio();
    }
  }
  function onKeyUp(e) {
    const a = KEYMAP[e.code];
    if (!a) return;
    if (a === 'jump') { input.jump = false; input.jumpHeld = false; }
    else input[a] = false;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  startBtn.addEventListener('click', startGame);

  function performJump() {
    state.vy = JUMP_SPEED;
    state.onGround = false;
    state.coyoteUntil = 0;
    state.jumpBufferedUntil = 0;
    burst(state.px, state.py, 7, '#e6ddd0', 120, 30);
    blip(520, 0.1, 'square', 0.04);
  }
  function doJump() {
    if (!state.playing || state.over) return;
    if (state.onGround || state.time < state.coyoteUntil) performJump();
    else state.jumpBufferedUntil = state.time + BUFFER_S;
  }

  // ================= Particles / juice =================
  function burst(x, y, n, color, spd, vyBias) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = spd * (0.35 + Math.random() * 0.75);
      const L = 0.45 + Math.random() * 0.3;
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.abs(Math.sin(a)) * s * 0.6 + vyBias,
        life: L, max: L,
        r: 1.5 + Math.random() * 2.5,
        color, grav: 900,
      });
    }
  }
  function addShake(mag, t) {
    shake.mag = Math.max(shake.mag, mag);
    shake.t = Math.max(shake.t, t);
  }

  // ================= Physics =================
  function update(dt) {
    if (!state.playing || state.paused || state.over) return;
    state.time += dt;

    // --- horizontal ---
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) state.facing = dir;
    const accel = (state.onGround ? ACCEL_GROUND : ACCEL_AIR) * dt;
    const targetVx = dir * MOVE_SPEED;
    if (dir !== 0) {
      if (state.vx < targetVx) state.vx = Math.min(targetVx, state.vx + accel);
      else if (state.vx > targetVx) state.vx = Math.max(targetVx, state.vx - accel);
    } else if (state.onGround) {
      const f = FRICTION * dt;
      if (Math.abs(state.vx) <= f) state.vx = 0;
      else state.vx -= Math.sign(state.vx) * f;
    }

    // --- buffered jump (pressed just before landing) ---
    if (state.onGround && state.time < state.jumpBufferedUntil) performJump();

    // --- gravity ---
    const rising = state.vy > 0;
    const g = GRAVITY * (rising && input.jumpHeld ? HOLD_GRAV : 1);
    state.vy -= g * dt;
    if (state.vy < -MAX_FALL) state.vy = -MAX_FALL;

    const prevY = state.py;
    state.px += state.vx * dt;
    state.py += state.vy * dt;

    // --- walls ---
    const halfW = PLAYER_W / 2;
    if (state.px < halfW) { state.px = halfW; state.vx = Math.max(0, state.vx); }
    if (state.px > VIEW_W - halfW) { state.px = VIEW_W - halfW; state.vx = Math.min(0, state.vx); }

    // --- one-way floor collision (only when falling) ---
    let landedFloor = null;
    let fallSpeed = 0;
    if (state.vy <= 0) {
      for (const f of floors) {
        if (state.py <= f.top && prevY >= f.top) {
          const left = state.px - halfW, right = state.px + halfW;
          const inGap = f.gapW > 0 && right > f.gapX && left < f.gapX + f.gapW;
          if (!inGap) {
            state.py = f.top;
            fallSpeed = -state.vy;
            state.vy = 0;
            landedFloor = f;
            break;
          }
        }
      }
    }
    if (landedFloor) {
      if (!state.onGround) {
        landOnFloor(landedFloor);
        const n = 6 + Math.min(10, fallSpeed / 120);
        burst(state.px, state.py, n, '#ddd2c2', 140 + fallSpeed * 0.08, 40);
        if (fallSpeed > 650) {
          addShake(Math.min(7, 2 + (fallSpeed - 650) / 130), 0.22);
          blip(180, 0.12, 'sine', 0.06);
        }
      }
      state.onGround = true;
      state.lastGroundY = state.py;
      state.coyoteUntil = 0;
      // fire a jump that was buffered mid-air
      if (state.time < state.jumpBufferedUntil) performJump();
    } else {
      if (state.onGround) state.coyoteUntil = state.time + COYOTE_S;
      state.onGround = false;
    }

    // --- juice decay ---
    state.squash = Math.max(0, state.squash - dt * 5);
    shake.t = Math.max(0, shake.t - dt);
    if (shake.t === 0) shake.mag = 0;

    // trail at high speed
    if (!state.onGround && Math.abs(state.vy) > 620) {
      trail.push({ x: state.px, y: state.py + PLAYER_H / 2, life: 0.3 });
      if (trail.length > 14) trail.shift();
    }
    for (const t of trail) t.life -= dt;
    trail = trail.filter(t => t.life > 0);

    // particles
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= p.grav * dt; p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);

    // --- camera: follow with look-ahead, never scroll down ---
    const minScroll = MIN_SCROLL + heightM * SCROLL_PER_M;
    const look = clamp(state.vy * 0.18, -140, 240);
    const targetCam = state.py + look - VIEW_H * 0.38;
    let move = (targetCam - camY) * (1 - Math.exp(-6 * dt));
    if (move < minScroll * dt) move = minScroll * dt;
    camY += move;

    ensureFloors();

    // --- height / combo / night ---
    if (state.py / METER_PX > heightM) heightM = state.py / METER_PX;
    nightT = clamp(heightM / NIGHT_M, 0, 1);
    if (combo > 0 && state.time - lastLandTime > COMBO_WINDOW) combo = 0;

    for (const p of popups) { p.life -= dt; p.y += 50 * dt; }
    popups = popups.filter(p => p.life > 0);

    // --- death ---
    if (state.py + PLAYER_H < camY - 6) gameOver();
  }

  function landOnFloor(f) {
    if (f.top > lastFloorTop + 1) {
      const now = state.time;
      combo = (now - lastLandTime <= COMBO_WINDOW) ? combo + 1 : 1;
      lastLandTime = now;
      lastFloorTop = f.top;
      state.squash = 1;
      if (combo > 1) {
        popups.push({ x: state.px, y: state.py + 46, text: 'COMBO x' + combo, life: 1, max: 1 });
        burst(state.px, state.py + PLAYER_H, 12, '#ffd23f', 200, 120);
        blip(660 + combo * 40, 0.1, 'triangle', 0.05);
      }
    }
  }

  // ================= Render =================
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function worldToScreenY(wy) { return canvas.height - (wy - camY) * dpr; }

  const SKY_DAY_TOP = [95, 179, 232], SKY_DAY_BOT = [217, 241, 250];
  const SKY_NGT_TOP = [14, 18, 48],   SKY_NGT_BOT = [74, 63, 122];

  function drawSky() {
    const top = lerpC(SKY_DAY_TOP, SKY_NGT_TOP, nightT);
    const bot = lerpC(SKY_DAY_BOT, SKY_NGT_BOT, nightT);
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, css(top));
    g.addColorStop(1, css(bot));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  function drawStars() {
    if (nightT <= 0.01) return;
    for (const s of stars) {
      const tw = 0.6 + 0.4 * Math.sin(state.time * 2 + s.tw);
      ctx.fillStyle = `rgba(255,255,240,${(nightT * tw * 0.9).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function drawCelestial() {
    // sun around 550px altitude, moon around 16000px — both slow parallax
    const p = 0.12;
    const sunY = canvas.height - (550 - camY * p) * dpr;
    if (sunY > -120 * dpr && sunY < canvas.height + 120 * dpr) {
      const a = 1 - nightT * 0.85;
      const x = canvas.width * 0.78, r = 34 * dpr;
      const g = ctx.createRadialGradient(x, sunY, r * 0.2, x, sunY, r * 2.2);
      g.addColorStop(0, `rgba(255,215,106,${0.9 * a})`);
      g.addColorStop(1, 'rgba(255,215,106,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r * 2.2, sunY - r * 2.2, r * 4.4, r * 4.4);
      ctx.fillStyle = `rgba(255,224,130,${a})`;
      ctx.beginPath(); ctx.arc(x, sunY, r, 0, Math.PI * 2); ctx.fill();
    }
    const moonY = canvas.height - (16000 - camY * p) * dpr;
    if (nightT > 0.3 && moonY > -120 * dpr && moonY < canvas.height + 120 * dpr) {
      const x = canvas.width * 0.22, r = 28 * dpr;
      ctx.fillStyle = 'rgba(242,234,216,0.95)';
      ctx.beginPath(); ctx.arc(x, moonY, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(200,190,170,0.8)';
      ctx.beginPath();
      ctx.arc(x - r * 0.3, moonY - r * 0.2, r * 0.18, 0, Math.PI * 2);
      ctx.arc(x + r * 0.25, moonY + r * 0.3, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function drawRidge(ridge, par, baseAlt, dayC, ngtC) {
    const baseY = canvas.height - (baseAlt - camY * par) * dpr;
    if (baseY < -50 || baseY > canvas.height + 400 * dpr) return;
    const c = lerpC(dayC, ngtC, nightT);
    ctx.fillStyle = css(c);
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    const step = canvas.width / (ridge.length - 1);
    for (let i = 0; i < ridge.length; i++) {
      ctx.lineTo(i * step, baseY - ridge[i] * dpr);
    }
    ctx.lineTo(canvas.width, baseY);
    ctx.closePath();
    ctx.fill();
  }
  function drawMountains() {
    drawRidge(RIDGE_A, 0.20, 60, [157, 184, 217], [30, 34, 66]);
    drawRidge(RIDGE_B, 0.32, 30, [111, 143, 184], [22, 26, 52]);
  }
  function drawClouds() {
    const a = lerp(0.85, 0.35, nightT);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    for (const c of clouds) {
      let cy = c.y - camY * 0.3;
      cy = ((cy % (VIEW_H * 2)) + VIEW_H * 2) % (VIEW_H * 2);
      const sy = canvas.height - cy * dpr;
      const cx = c.x * dpr;
      const s = c.s * dpr;
      ctx.beginPath();
      ctx.ellipse(cx, sy, 34 * s, 14 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 20 * s, sy - 6 * s, 22 * s, 12 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function drawPlatformSegment(x0, x1, yTop, altT, seed) {
    if (x1 <= x0) return;
    const h = FLOOR_H * dpr;
    const w = x1 - x0;
    // body (wood, darkens at altitude)
    const woodTop = lerpC([138, 111, 77], [90, 84, 110], altT);
    const woodBot = lerpC([104, 82, 56], [62, 58, 82], altT);
    const g = ctx.createLinearGradient(0, yTop, 0, yTop + h);
    g.addColorStop(0, css(woodTop));
    g.addColorStop(1, css(woodBot));
    ctx.fillStyle = g;
    roundRect(ctx, x0, yTop, w, h, 4 * dpr);
    ctx.fill();
    // top surface: grass -> snow
    const topC = lerpC([121, 199, 79], [238, 246, 251], altT);
    ctx.fillStyle = css(topC);
    roundRect(ctx, x0, yTop, w, 5 * dpr, 3 * dpr);
    ctx.fill();
    // deco: flower (low) / rock (high), deterministic per floor
    const r = prand(seed * 3 + 5);
    if (r > 0.55 && w > 60 * dpr) {
      const dx = x0 + w * (0.2 + prand(seed * 7 + 1) * 0.6);
      if (altT < 0.5) {
        ctx.fillStyle = '#3f8f3a';
        ctx.fillRect(dx - dpr, yTop - 7 * dpr, 2 * dpr, 7 * dpr);
        ctx.fillStyle = prand(seed) > 0.5 ? '#ff7eb6' : '#ffd23f';
        ctx.beginPath(); ctx.arc(dx, yTop - 9 * dpr, 3.4 * dpr, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(120,128,150,0.9)';
        ctx.beginPath(); ctx.arc(dx, yTop - 4 * dpr, 4.5 * dpr, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  function drawFloor(f) {
    const yTop = worldToScreenY(f.top);
    const altT = clamp((f.top / METER_PX) / 90, 0, 1);
    if (f.gapW > 0) {
      drawPlatformSegment(0, f.gapX * dpr, yTop, altT, f.i);
      drawPlatformSegment((f.gapX + f.gapW) * dpr, canvas.width, yTop, altT, f.i + 1000);
    } else {
      drawPlatformSegment(0, canvas.width, yTop, altT, f.i);
    }
  }
  function drawWalls() {
    const bw = WALL * dpr;
    const brickH = 26 * dpr;
    const off = (camY * dpr) % (brickH * 2);
    for (let side = 0; side < 2; side++) {
      const x0 = side === 0 ? 0 : canvas.width - bw;
      for (let row = -1; row * brickH - off < canvas.height + brickH; row++) {
        const y = row * brickH - off;
        const shade = (row % 2 === 0) ? 0 : 1;
        const c = lerpC(shade ? [94, 76, 60] : [104, 84, 66], [40, 38, 58], nightT);
        ctx.fillStyle = css(c);
        ctx.fillRect(x0, y, bw, brickH - dpr);
      }
      // inner shadow edge
      const shadowX = side === 0 ? x0 + bw : x0 - bw * 0.8;
      const eg = ctx.createLinearGradient(shadowX, 0, shadowX + (side === 0 ? 1 : -1) * bw * 0.8, 0);
      eg.addColorStop(0, 'rgba(0,0,0,0.35)');
      eg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = eg;
      ctx.fillRect(shadowX, 0, bw * 0.8, canvas.height);
    }
  }
  function drawParticles() {
    for (const p of particles) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * dpr, worldToScreenY(p.y), p.r * dpr * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawTrail() {
    for (const t of trail) {
      const a = (t.life / 0.3) * 0.22;
      ctx.fillStyle = `rgba(155,107,67,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(t.x * dpr, worldToScreenY(t.y), 11 * dpr * (t.life / 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function drawPlayer() {
    const px = state.px * dpr;
    const feet = worldToScreenY(state.py);
    const f = state.facing;

    // squash & stretch from velocity + landing squash
    let sy = 1;
    if (!state.onGround) sy = clamp(1 + state.vy * 0.00012, 0.86, 1.22);
    sy *= (1 - state.squash * 0.22);
    const sx = clamp(2 - sy, 0.85, 1.2);

    // tilt when airborne, slight lean when running
    const tilt = state.onGround
      ? clamp(state.vx * 0.00012, -0.06, 0.06)
      : clamp(state.vx * 0.00035, -0.18, 0.18);

    ctx.save();
    ctx.translate(px, feet);
    ctx.rotate(tilt * f);
    ctx.scale(sx, sy);

    const bw = PLAYER_W * dpr, bh = PLAYER_H * dpr * 0.62;
    const bodyY = -bh;

    // legs (run cycle on ground)
    const running = state.onGround && Math.abs(state.vx) > 20;
    const lp = running ? Math.sin(state.time * 16) * 3 * dpr : 0;
    ctx.fillStyle = '#6d4526';
    roundRect(ctx, -bw * 0.32 + lp, -6 * dpr, 7 * dpr, 6 * dpr, 2 * dpr); ctx.fill();
    roundRect(ctx, bw * 0.32 - 7 * dpr - lp, -6 * dpr, 7 * dpr, 6 * dpr, 2 * dpr); ctx.fill();

    // body
    ctx.fillStyle = '#9b6b43';
    roundRect(ctx, -bw / 2, bodyY, bw, bh, 10 * dpr);
    ctx.fill();
    // belly
    ctx.fillStyle = '#c19a6b';
    roundRect(ctx, -bw * 0.3, bodyY + bh * 0.45, bw * 0.6, bh * 0.5, 8 * dpr);
    ctx.fill();

    // head (front = facing side)
    const headW = bw * 0.6, headH = bh * 0.78;
    const hx = f * bw * 0.22 - headW / 2;
    const hy = bodyY - headH * 0.72;
    ctx.fillStyle = '#8a5a34';
    roundRect(ctx, hx, hy, headW, headH, 8 * dpr);
    ctx.fill();
    // ear (back side of head)
    ctx.fillStyle = '#6d4526';
    ctx.beginPath();
    ctx.ellipse(hx + (f > 0 ? headW * 0.18 : headW * 0.82), hy + headH * 0.08, 4 * dpr, 5 * dpr, 0, 0, Math.PI * 2);
    ctx.fill();
    // eye (blinks)
    const blink = (state.time % 3.7) > 3.55;
    const ex = hx + (f > 0 ? headW * 0.68 : headW * 0.32);
    const ey = hy + headH * 0.42;
    ctx.fillStyle = '#1c1c1c';
    if (blink) {
      ctx.fillRect(ex - 3 * dpr, ey, 6 * dpr, 1.4 * dpr);
    } else {
      ctx.beginPath(); ctx.arc(ex, ey, 2.6 * dpr, 0, Math.PI * 2); ctx.fill();
    }
    // nose at snout front
    ctx.fillStyle = '#3a2a1c';
    ctx.beginPath();
    ctx.arc(hx + (f > 0 ? headW * 0.94 : headW * 0.06), hy + headH * 0.6, 2.8 * dpr, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
  function drawPopups() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of popups) {
      const t = clamp(p.life / p.max, 0, 1);
      const size = (16 + 10 * (1 - t)) * dpr;
      ctx.fillStyle = `rgba(255,210,63,${t.toFixed(3)})`;
      ctx.font = `900 ${size}px system-ui, sans-serif`;
      ctx.fillText(p.text, p.x * dpr, worldToScreenY(p.y));
    }
  }

  function render() {
    ctx.save();
    if (shake.t > 0) {
      const k = (shake.t / 0.22) * shake.mag * dpr;
      ctx.translate((Math.random() * 2 - 1) * k, (Math.random() * 2 - 1) * k);
    }
    drawSky();
    drawStars();
    drawCelestial();
    drawMountains();
    drawClouds();
    for (const f of floors) {
      if (f.top >= camY - FLOOR_H && f.top <= camY + VIEW_H + FLOOR_H) drawFloor(f);
    }
    drawParticles();
    drawTrail();
    drawPlayer();
    drawPopups();
    drawWalls();
    ctx.restore();

    if (state.paused && state.playing) {
      ctx.fillStyle = 'rgba(10,14,24,0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${34 * dpr}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    }

    hudHeight.textContent = heightM.toFixed(1) + ' m';
    hudBest.textContent = best.toFixed(1) + ' m';
    hudCombo.textContent = combo > 1 ? 'x' + combo : '';
    hudCombo.style.opacity = combo > 1 ? '1' : '0';
  }

  // ================= Loop =================
  function loop(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    frames++;
    if (!state.paused) update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ================= Debug handle =================
  window.__dbg = {
    get state() { return state; },
    get camY() { return camY; },
    get floors() { return floors; },
    get frames() { return frames; },
    get heightM() { return heightM; },
    get nightT() { return nightT; },
    get best() { return best; },
    get combo() { return combo; },
    get particles() { return particles.length; },
    get shake() { return shake; },
    start: startGame,
    jump: doJump,
    input,
    reset,
  };
})();
