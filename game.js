(() => {
  'use strict';

  // ================= Config =================
  const VIEW_W = 480;
  const VIEW_H = 720;

  const GRAVITY     = 2100;   // px/s^2, downward
  const MOVE_SPEED  = 320;    // max horizontal speed px/s
  const ACCEL       = 3200;   // horizontal accel toward target vx
  const JUMP_SPEED  = 860;    // upward launch px/s
  const HOLD_GRAV   = 0.55;   // gravity scale while holding jump & rising
  const COYOTE_S    = 0.09;   // grace time to jump after leaving a floor

  const FLOOR_H     = 16;     // visual thickness of a floor (px)
  const SPACING     = 128;    // base vertical gap between floors
  const SPACING_VAR = 30;
  const GAP_MIN     = 72;     // hole width
  const GAP_MAX     = 170;

  const MIN_SCROLL  = 40;     // base camera auto-rise px/s
  const SCROLL_RAMP = 0.015;  // extra px/s per px of height climbed

  const COMBO_WINDOW = 1.4;   // s between landings to keep the combo
  const METER_PX     = 100;   // px per displayed "meter"

  const PLAYER_W = 34;
  const PLAYER_H = 44;

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
    playing: false,
    over: false,
    paused: false,
    muted: false,
    time: 0,
    px: VIEW_W / 2,
    py: 0,          // feet y, world coords, up = positive
    vx: 0,
    vy: 0,
    onGround: true,
    facing: 1,
    lastGroundY: 0,
    coyoteUntil: 0,
    squash: 0,
  };

  let camY = 0;               // world y of screen bottom
  let floors = [];            // {top, gapX, gapW}
  let popups = [];            // {x,y,text,life,max}
  let clouds = [];
  let best = parseFloat(localStorage.getItem('capy-tower-best') || '0') || 0;
  let heightM = 0;            // max height reached, meters
  let combo = 0;
  let lastFloorTop = 0;
  let lastLandTime = -1e9;

  let frames = 0;
  let lastTs = performance.now();
  const input = { left: false, right: false, jump: false, jumpHeld: false };

  // ================= Audio (tiny synth) =================
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
  function makeGap() {
    const gapW = GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN);
    const gapX = 10 + Math.random() * (VIEW_W - 20 - gapW);
    return { gapX, gapW };
  }
  function generateFloors() {
    floors = [];
    floors.push({ top: 0, gapX: -1, gapW: 0 }); // solid ground
    let top = 0;
    while (top < camY + VIEW_H * 2 + 200) {
      const gap = makeGap();
      top += SPACING + (Math.random() * 2 - 1) * SPACING_VAR;
      floors.push({ top, gapX: gap.gapX, gapW: gap.gapW });
    }
  }
  function ensureFloors() {
    let top = floors.length ? floors[floors.length - 1].top : 0;
    while (top < camY + VIEW_H * 2 + 200) {
      const gap = makeGap();
      top += SPACING + (Math.random() * 2 - 1) * SPACING_VAR;
      floors.push({ top, gapX: gap.gapX, gapW: gap.gapW });
    }
    floors = floors.filter(f => f.top > camY - 60 || f.top === 0);
  }

  // ================= Clouds =================
  function genClouds() {
    clouds = [];
    for (let i = 0; i < 24; i++) {
      clouds.push({
        x: Math.random() * VIEW_W,
        y: Math.random() * VIEW_H * 2,
        s: 0.4 + Math.random() * 0.9,
      });
    }
  }
  genClouds();

  // ================= Game flow =================
  function reset() {
    state.px = VIEW_W / 2;
    state.py = 0;
    state.vx = 0; state.vy = 0;
    state.onGround = true;
    state.facing = 1;
    state.squash = 0;
    state.coyoteUntil = 0;
    camY = 0;
    heightM = 0;
    combo = 0;
    lastFloorTop = 0;
    lastLandTime = -1e9;
    popups = [];
    generateFloors();
    state.playing = true;
    state.over = false;
    state.paused = false;
    overlay.classList.add('hidden');
  }
  function gameOver() {
    state.playing = false;
    state.over = true;
    if (heightM > best) {
      best = heightM;
      localStorage.setItem('capy-tower-best', String(best));
    }
    overlayHint.textContent =
      `You climbed ${heightM.toFixed(1)} m — best ${best.toFixed(1)} m`;
    overlay.classList.remove('hidden');
  }
  function startGame() {
    ensureAudio();
    reset();
  }

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
      if (!state.playing) startGame();
      else if (!state.over && !input.jump) doJump();
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

  function doJump() {
    if (!state.playing || state.over) return;
    const canJump = state.onGround || state.time < state.coyoteUntil;
    if (!canJump) return;
    state.vy = JUMP_SPEED;
    state.onGround = false;
    state.coyoteUntil = 0;
    blip(520, 0.1, 'square', 0.04);
  }

  // ================= Physics =================
  function update(dt) {
    if (!state.playing || state.paused || state.over) return;
    state.time += dt;

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) state.facing = dir;
    const targetVx = dir * MOVE_SPEED;
    const accel = ACCEL * dt;
    if (state.vx < targetVx) state.vx = Math.min(targetVx, state.vx + accel);
    else if (state.vx > targetVx) state.vx = Math.max(targetVx, state.vx - accel);

    // gravity (reduced while holding jump and rising)
    const rising = state.vy > 0;
    const g = GRAVITY * (rising && input.jumpHeld ? HOLD_GRAV : 1);
    state.vy -= g * dt;

    const prevY = state.py;
    state.px += state.vx * dt;
    state.py += state.vy * dt;

    // walls
    const halfW = PLAYER_W / 2;
    if (state.px < halfW) { state.px = halfW; state.vx = Math.max(0, state.vx); }
    if (state.px > VIEW_W - halfW) { state.px = VIEW_W - halfW; state.vx = Math.min(0, state.vx); }

    // one-way floor collision (only when falling)
    let landedFloor = null;
    if (state.vy <= 0) {
      for (const f of floors) {
        if (state.py <= f.top && prevY >= f.top) {
          const left = state.px - halfW, right = state.px + halfW;
          const inGap = f.gapW > 0 && right > f.gapX && left < f.gapX + f.gapW;
          if (!inGap) {
            state.py = f.top;
            state.vy = 0;
            landedFloor = f;
            break;
          }
        }
      }
    }
    if (landedFloor) {
      if (!state.onGround) landOnFloor(landedFloor);
      state.onGround = true;
      state.lastGroundY = state.py;
      state.coyoteUntil = 0;
    } else {
      if (state.onGround) state.coyoteUntil = state.time + COYOTE_S;
      state.onGround = false;
    }

    // landing squash decay
    state.squash = Math.max(0, state.squash - dt * 5);

    // camera auto-scroll (Icy Tower core tension)
    const minScroll = MIN_SCROLL + Math.max(0, state.py) * SCROLL_RAMP;
    const targetCam = state.py - VIEW_H * 0.38;
    let move = (targetCam - camY) * Math.min(1, 10 * dt);
    if (move < minScroll * dt) move = minScroll * dt;
    camY += move;

    ensureFloors();

    // height / combo
    if (state.py / METER_PX > heightM) heightM = state.py / METER_PX;
    if (combo > 0 && state.time - lastLandTime > COMBO_WINDOW) combo = 0;

    // popups
    for (const p of popups) { p.life -= dt; p.y += 50 * dt; }
    popups = popups.filter(p => p.life > 0);

    // death: fell below the screen
    if (state.py + PLAYER_H < camY - 6) {
      gameOver();
    }
  }

  function landOnFloor(f) {
    if (f.top > lastFloorTop + 1) {
      const now = state.time;
      combo = (now - lastLandTime <= COMBO_WINDOW) ? combo + 1 : 1;
      lastLandTime = now;
      lastFloorTop = f.top;
      state.squash = 1;
      if (combo > 1) {
        popups.push({ x: state.px, y: state.py + 40, text: 'COMBO x' + combo, life: 1, max: 1 });
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
  function worldToScreenY(wy) {
    return canvas.height - (wy - camY) * dpr;
  }
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#7ec8e3');
    g.addColorStop(1, '#cdeef5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  function drawClouds() {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
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
  function drawFloor(f) {
    const yTop = worldToScreenY(f.top);
    const h = FLOOR_H * dpr;
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(0, yTop, canvas.width, h);
    ctx.fillStyle = '#c9a06a';
    ctx.fillRect(0, yTop, canvas.width, Math.max(1, 3 * dpr));
    if (f.gapW > 0) {
      const gx = f.gapX * dpr, gw = f.gapW * dpr;
      ctx.fillStyle = '#5d4a33';
      ctx.fillRect(gx - 2 * dpr, yTop, 2 * dpr, h);
      ctx.fillRect(gx + gw, yTop, 2 * dpr, h);
    }
  }
  function drawPlayer() {
    const px = state.px * dpr;
    const feet = worldToScreenY(state.py);
    const w = PLAYER_W * dpr, h = PLAYER_H * dpr;
    const squash = 1 - state.squash * 0.18;
    const sw = w * (2 - squash), sh = h * squash;
    const top = feet - sh;
    const f = state.facing;

    ctx.save();
    ctx.translate(px, feet);
    ctx.scale(1, squash);
    ctx.translate(-px, -feet);

    // body
    ctx.fillStyle = '#8b5e3c';
    roundRect(ctx, px - sw / 2, top, sw, sh * 0.72, 8 * dpr);
    ctx.fill();
    // head
    const headW = sw * 0.62, headH = sh * 0.5;
    const headX = px - headW / 2 + f * (sw * 0.06);
    const headY = top - headH * 0.35;
    ctx.fillStyle = '#7a4f2f';
    roundRect(ctx, headX, headY, headW, headH, 7 * dpr);
    ctx.fill();
    // ears
    ctx.fillStyle = '#7a4f2f';
    ctx.beginPath();
    ctx.ellipse(px - f * headW * 0.28, headY, 6 * dpr, 7 * dpr, 0, 0, Math.PI * 2);
    ctx.ellipse(px + f * headW * 0.28, headY, 6 * dpr, 7 * dpr, 0, 0, Math.PI * 2);
    ctx.fill();
    // eyes
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.arc(px + f * headW * 0.18, headY + headH * 0.42, 2.4 * dpr, 0, Math.PI * 2);
    ctx.arc(px + f * headW * 0.4, headY + headH * 0.42, 2.4 * dpr, 0, Math.PI * 2);
    ctx.fill();
    // nose
    ctx.fillStyle = '#3d2a1a';
    ctx.beginPath();
    ctx.arc(px + f * headW * 0.3, headY + headH * 0.6, 2.6 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function drawPopups() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of popups) {
      const a = Math.min(1, p.life / p.max);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.font = `bold ${18 * dpr}px system-ui, sans-serif`;
      ctx.fillText(p.text, p.x * dpr, worldToScreenY(p.y));
    }
  }
  function drawWalls() {
    ctx.fillStyle = '#3b2f23';
    ctx.fillRect(0, 0, 6 * dpr, canvas.height);
    ctx.fillRect(canvas.width - 6 * dpr, 0, 6 * dpr, canvas.height);
  }

  function render() {
    drawBackground();
    drawClouds();
    for (const f of floors) {
      if (f.top >= camY - FLOOR_H && f.top <= camY + VIEW_H + FLOOR_H) drawFloor(f);
    }
    drawPlayer();
    drawPopups();
    drawWalls();

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
    get best() { return best; },
    get combo() { return combo; },
    start: startGame,
    jump: doJump,
    input,
    reset,
  };
})();
