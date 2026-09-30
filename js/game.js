// One match: the local capybara's simulation, camera, combo/score rules,
// remote racers and all in-world drawing. Screens and networking live in
// main.js; art lives in characters.js and world.js.
import { VIEW_W, VIEW_H, WALL_W, FLOOR_GAP, PLAT_H,
         drawBackground, drawPlatform, drawSideWalls } from './world.js';
import { drawCharacter, CHARACTERS } from './characters.js';
import { Tower } from './tower.js';

// ---------------------------------------------------------------- tuning
// Icy Tower's core: horizontal speed turns into jump height. Build a run-up,
// jump at full tilt and you clear several floors; bounce off a wall mid-air
// and you keep your speed.
export const TUNING = {
  RUN_MAX: 430,          // px/s top horizontal speed
  ACCEL: 1050,           // px/s^2 on the ground (a run-up matters)
  AIR_ACCEL: 820,
  TURN_BOOST: 2.2,       // reversing direction brakes faster than it accelerates
  FRICTION: 1500,        // ground decel with no input
  AIR_DRAG: 120,
  GRAVITY: 2350,
  MAX_FALL: 1500,
  JUMP_BASE: 700,        // standing jump: a little over one floor (Icy Tower ~1.2)
  JUMP_PER_SPEED: 1.64,  // extra jump velocity per px/s of |vx| (full sprint ~5 floors)
  SPIN_AT: 1300,         // top-speed tier: the cartwheel spin
  // Ricochet: an airborne capy that hits a wall flies straight back out at
  // (almost) full speed with its vertical velocity untouched, so a sprint
  // jump off one wall carries across the tower and keeps the combo alive.
  WALL_KEEP: 0.98,       // horizontal speed kept on a ricochet
  RICOCHET_MIN: 90,      // slower than this and you just stop against the wall
  RICOCHET_GRACE: 0.14,  // s after a ricochet where still holding toward the wall doesn't brake
  WALL_KICK: 0.12,       // s window: jump as you reach a wall on the ground to kick off it
  COYOTE: 0.08,
  BUFFER: 0.12,
  COMBO_TIME: 3.0,       // seconds the combo meter lasts after a multi-floor landing
  SCROLL_START_FLOOR: 5, // the tower starts moving once you reach this floor
  HURRY_EVERY: 30,       // seconds between speed-ups
  // Icy Tower's 7 steps (0,1,2,4,6,9,11 px/frame at 80 px floors), scaled
  SCROLL_LEVELS: [0, 63, 126, 252, 378, 567, 693],
  PUSH_ZONE: 0.30,       // player above this fraction of screen from top pushes camera
};

export const PRAISE = [
  // [combo floors needed, word]
  [4, 'GOOD!'], [7, 'SWEET!'], [15, 'GREAT!'], [25, 'SUPER!'], [35, 'WOW!'],
  [50, 'AMAZING!'], [70, 'EXTREME!'], [100, 'FANTASTIC!'], [140, 'SPLENDID!'],
  [200, 'NO WAY!'],
];
export function praiseFor(floors) {
  let lvl = -1;
  for (let i = 0; i < PRAISE.length; i++) if (floors >= PRAISE[i][0]) lvl = i;
  return lvl;
}

const PW = 26;                   // collision half-width is PW/2
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const PLAY_L = WALL_W, PLAY_R = VIEW_W - WALL_W;

export class Game {
  constructor({ seed, char, audio, race = null, name = 'you' }) {
    this.tower = new Tower(seed);
    this.char = char;
    this.stats = (CHARACTERS.find(c => c.id === char) || CHARACTERS[0]).stats;
    this.audio = audio;
    this.race = race;                // { net, players: Map(id -> remote) } or null
    this.name = name;

    this.p = {
      x: VIEW_W / 2, y: 0, vx: 0, vy: 0, ground: true, facing: 1,
      anim: 'idle', animT: 0, spin: 0, spinning: false, squash: 0,
      coyote: 0, buffer: 0, floor: 0, standFloor: 0, dead: false,
      ricochet: 0, bounces: 0, kick: null,      // wall ricochet state
    };
    this.camY = 0;
    this.time = 0;               // seconds since GO
    this.countdown = race ? race.countdown : 0;
    this.clockOn = false;        // tower scrolling
    this.clockT = 0;             // seconds since the tower started moving
    this.level = 0;
    this.hurryFlash = 0;
    this.maxFloor = 0;
    this.combo = { active: false, floors: 0, jumps: 0, timer: 0 };
    this.bestCombo = 0;
    this.comboPoints = 0;
    this.lastLandFloor = 0;
    this.popups = [];            // floating praise / combo words
    this.particles = [];
    this.shake = 0;
    this.over = false;
    this.overT = 0;
    this.spectate = null;        // remote id the camera follows after we fall
    this.events = [];            // for main.js: {k, ...}
  }

  get score() { return this.maxFloor * 10 + this.comboPoints; }

  // ------------------------------------------------------------ input
  jumpPressed() {
    if (this.over || this.countdown > 0) return;
    const p = this.p;
    if (p.ground || p.coyote > 0) this.doJump();
    else p.buffer = TUNING.BUFFER;
  }

  doJump() {
    const p = this.p, T = TUNING;
    // wall kick: ran into a wall at speed and jumped right then -> launch
    // away from it with the speed you had, like a ricochet off the floor
    if (p.kick && p.kick.t > 0) {
      p.vx = p.kick.away * p.kick.speed * T.WALL_KEEP;
      p.facing = p.kick.away;
      p.ricochet = T.RICOCHET_GRACE;
      p.kick = null;
      this.ricochetFx(p.x - p.facing * PW / 2, p.y + 20, -p.facing);
    }
    const speed = Math.abs(p.vx);
    const v = (T.JUMP_BASE + speed * T.JUMP_PER_SPEED) * this.stats.jump;
    p.vy = v;
    p.ground = false; p.coyote = 0; p.buffer = 0;
    p.spinning = v >= T.SPIN_AT * this.stats.jump;
    p.spin = 0;
    this.setAnim(p.spinning ? 'spin' : 'jump');
    const power = clamp((v - T.JUMP_BASE) / (T.RUN_MAX * T.JUMP_PER_SPEED), 0, 1);
    this.audio && this.audio.sfx.jump(power);
    this.dust(p.x, p.y, 6 + power * 8, power);
  }

  setAnim(a) { if (this.p.anim !== a) { this.p.anim = a; this.p.animT = 0; } }

  // ------------------------------------------------------------ update
  update(dt, input) {
    this.hurryFlash = Math.max(0, this.hurryFlash - dt);
    this.shake = Math.max(0, this.shake - dt * 18);
    this.updateParticles(dt);
    for (const pp of this.popups) { pp.t += dt; }
    this.popups = this.popups.filter(pp => pp.t < pp.life);
    if (this.race) this.updateRemotes(dt);

    if (this.countdown > 0) {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (after !== before) this.audio && this.audio.sfx.countdown(Math.max(0, after));
      this.p.animT += dt;
      return;
    }

    if (this.over) {
      this.overT += dt;
      this.p.animT += dt;
      this.p.vy = Math.max(-TUNING.MAX_FALL, this.p.vy - TUNING.GRAVITY * dt);
      this.p.y += this.p.vy * dt;
      this.p.spin += dt * 6;
      if (this.race) this.followLeader(dt);
      return;
    }

    this.time += dt;
    this.step(dt, input);
    this.updateCamera(dt);
    this.updateCombo(dt);

    if (this.p.y < this.camY - 60) this.fall();
  }

  step(dt, input) {
    const p = this.p, T = TUNING, st = this.stats;
    p.animT += dt;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const runMax = T.RUN_MAX * st.speed;
    if (dir && p.ricochet > 0 && dir === -Math.sign(p.vx)) {
      // still holding toward the wall we just left: coast, don't brake
    } else if (dir) {
      p.facing = dir;
      let a = (p.ground ? T.ACCEL : T.AIR_ACCEL) * st.accel;
      if (Math.sign(p.vx) === -dir && p.vx !== 0) a *= T.TURN_BOOST;
      p.vx = clamp(p.vx + dir * a * dt, -runMax, runMax);
    } else {
      const f = (p.ground ? T.FRICTION : T.AIR_DRAG) * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    }

    if (p.ground && p.buffer > 0) this.doJump();
    p.buffer = Math.max(0, p.buffer - dt);
    p.coyote = Math.max(0, p.coyote - dt);

    const prevY = p.y;
    p.vy = Math.max(-T.MAX_FALL, p.vy - T.GRAVITY * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // walls: ricochet in the air, stop (or wall-kick) on the ground
    p.ricochet = Math.max(0, p.ricochet - dt);
    if (p.kick) { p.kick.t -= dt; if (p.kick.t <= 0) p.kick = null; }
    const L = PLAY_L + PW / 2, R = PLAY_R - PW / 2;
    if (p.x < L || p.x > R) {
      const over = p.x < L ? L - p.x : p.x - R;
      const hit = p.x < L ? -1 : 1;
      p.x = clamp(p.x, L, R);
      if (Math.sign(p.vx) === hit) {
        const speed = Math.abs(p.vx);
        if (!p.ground && speed > T.RICOCHET_MIN) {
          p.vx = -p.vx * T.WALL_KEEP;          // vy untouched: pure ricochet
          p.x -= hit * over;                   // reflect the overshoot too
          p.facing = -hit;
          p.ricochet = T.RICOCHET_GRACE;
          p.bounces++;
          if (p.spinning) p.spin = -p.spin;
          this.ricochetFx(p.x + hit * PW / 2, p.y + 24, hit, speed);
          if (p.bounces >= 2) this.popup(`RICOCHET x${p.bounces}`, p.x - hit * 40, p.y + 60, '#8fe6ff', 15, 0.7);
        } else {
          if (p.ground && speed > 200) {
            p.kick = { t: T.WALL_KICK, speed, away: -hit };
            if (p.buffer > 0) this.doJump();   // jump was pressed just before the wall
          }
          p.vx = 0;
        }
      }
    }

    if (p.spinning) p.spin += dt * 13 * (p.facing || 1);

    // one-way platforms: land only when falling through the top surface
    let landed = null;
    if (p.vy <= 0) {
      const nFrom = Math.floor(prevY / FLOOR_GAP + 1e-6);
      const nTo = Math.floor(p.y / FLOOR_GAP);
      for (let n = nFrom; n >= Math.max(0, nTo); n--) {
        const top = n * FLOOR_GAP;
        if (prevY >= top - 0.01 && p.y <= top) {
          const pl = this.tower.platform(n);
          if (p.x + PW / 2 > pl.x0 && p.x - PW / 2 < pl.x1) { landed = pl; break; }
        }
      }
    }
    if (landed) {
      const impact = -p.vy;
      p.y = landed.n * FLOOR_GAP;
      p.vy = 0;
      if (!p.ground) this.land(landed, impact);
      p.ground = true;
      p.standFloor = landed.n;
      if (p.buffer > 0) this.doJump();
    } else if (p.ground) {
      // walked off an edge?
      const pl = this.tower.platform(p.standFloor);
      if (p.x + PW / 2 <= pl.x0 || p.x - PW / 2 >= pl.x1 || p.y > pl.n * FLOOR_GAP + 1) {
        p.ground = false; p.coyote = T.COYOTE;
        this.setAnim('fall');
      }
    }

    // animation state
    if (p.ground) {
      const pl = this.tower.platform(p.standFloor);
      const nearEdge = Math.abs(p.vx) < 30 &&
        (p.x - pl.x0 < 4 || pl.x1 - p.x < 4) && !this.tower.isFullWidth(pl.n);
      if (p.anim === 'land' && p.animT < 0.14) { /* hold the squash */ }
      else if (nearEdge) this.setAnim('edge');
      else if (Math.abs(p.vx) > 25) this.setAnim('run');
      else this.setAnim('idle');
    } else if (!p.spinning && p.vy < -80) this.setAnim('fall');
    p.squash = Math.max(0, p.squash - dt * 5);

    const f = Math.floor((p.y + 1) / FLOOR_GAP);
    if (p.ground && p.standFloor > this.maxFloor) {
      this.maxFloor = p.standFloor;
      if (this.maxFloor % 10 === 0) this.events.push({ k: 'milestone', floor: this.maxFloor });
    }
    p.floor = Math.max(0, f);
    if (!this.clockOn && this.maxFloor >= T.SCROLL_START_FLOOR) this.startClock();
  }

  land(pl, impact) {
    const p = this.p;
    p.spinning = false; p.spin = 0; p.bounces = 0;
    p.squash = clamp(impact / 1400, 0.25, 1);
    this.setAnim('land');
    this.audio && this.audio.sfx.land();
    this.dust(p.x, p.y, 4 + impact / 160, 0);
    if (impact > 1100) this.shake = Math.min(6, (impact - 1100) / 80);

    const gained = pl.n - this.lastLandFloor;
    const c = this.combo;
    if (gained >= 2) {
      if (!c.active) { c.active = true; c.floors = 0; c.jumps = 0; }
      c.floors += gained; c.jumps++;
      c.timer = TUNING.COMBO_TIME;
      if (c.jumps >= 2) {
        this.audio && this.audio.sfx.combo(c.floors);
        this.popup(`${c.floors} FLOORS`, p.x, p.y + 70, '#ffe45c', 18, 0.8);
      }
    } else if (gained !== 0 || pl.n < this.lastLandFloor) {
      this.endCombo();
    }
    this.lastLandFloor = pl.n;
  }

  updateCombo(dt) {
    const c = this.combo;
    if (!c.active) return;
    c.timer -= dt;
    if (c.timer <= 0) this.endCombo();
  }

  endCombo() {
    const c = this.combo;
    if (c.active && c.jumps >= 2) {
      const pts = c.floors * c.floors;
      this.comboPoints += pts;
      this.bestCombo = Math.max(this.bestCombo, c.floors);
      const lvl = praiseFor(c.floors);
      if (lvl >= 0) {
        const word = PRAISE[lvl][1];
        this.popup(word, VIEW_W / 2, null, '#fff', 34 + lvl * 3, 1.6, lvl);
        this.audio && this.audio.sfx.praise(lvl);
        this.events.push({ k: 'praise', lvl, word, floors: c.floors });
      } else {
        this.audio && this.audio.sfx.comboEnd();
      }
      this.popup(`+${pts}`, this.p.x, this.p.y + 90, '#ffe45c', 22, 1.1);
    }
    c.active = false; c.floors = 0; c.jumps = 0; c.timer = 0;
  }

  startClock() {
    this.clockOn = true; this.clockT = 0; this.level = 1;
    this.events.push({ k: 'clock' });
  }

  updateCamera(dt) {
    const T = TUNING, p = this.p;
    if (this.clockOn) {
      this.clockT += dt;
      const lvl = Math.min(T.SCROLL_LEVELS.length - 1, 1 + Math.floor(this.clockT / T.HURRY_EVERY));
      if (lvl !== this.level) {
        this.level = lvl;
        this.hurryFlash = 2.2;
        this.audio && this.audio.sfx.hurry();
        this.events.push({ k: 'hurry', level: lvl });
      }
      this.camY += T.SCROLL_LEVELS[this.level] * dt;
    }
    // climb above the push line and the camera races to keep you on screen
    const pushLine = this.camY + VIEW_H * (1 - T.PUSH_ZONE);
    if (p.y > pushLine) this.camY += (p.y - pushLine) * Math.min(1, dt * 8);
  }

  fall() {
    const p = this.p;
    this.endCombo();
    this.over = true; p.dead = true;
    p.vy = 900; p.spin = 0;
    this.setAnim('dead');
    this.audio && this.audio.sfx.gameOver();
    this.events.push({ k: 'dead' });
  }

  // ------------------------------------------------------------ race
  updateRemotes(dt) {
    for (const r of this.race.players.values()) {
      const s = r.target;
      if (!s) continue;
      if (!r.pos) r.pos = { ...s };
      const k = 1 - Math.exp(-dt * 14);
      r.pos.x += (s.x - r.pos.x) * k;
      r.pos.y += (s.y - r.pos.y) * k;
      r.pos.a = s.a; r.pos.f = s.f; r.pos.sp = s.sp;
      r.animT = r.lastAnim === s.a ? (r.animT || 0) + dt : 0;
      r.lastAnim = s.a;
      if (r.out) r.pos.y -= 0;           // frozen where they fell
    }
  }

  followLeader(dt) {
    let lead = null;
    for (const [id, r] of this.race.players) {
      if (r.out || !r.pos) continue;
      if (!lead || r.pos.y > lead.r.pos.y) lead = { id, r };
    }
    this.spectate = lead ? lead.id : null;
    if (lead) {
      const target = Math.max(lead.r.target && lead.r.target.cam || 0, lead.r.pos.y - VIEW_H * 0.45);
      this.camY += (target - this.camY) * Math.min(1, dt * 3);
    }
  }

  netState() {
    const p = this.p;
    return { x: Math.round(p.x), y: Math.round(p.y), a: p.anim, f: p.facing,
             sp: +p.spin.toFixed(2), fl: this.maxFloor, sc: this.score,
             cb: this.combo.active ? this.combo.floors : 0, cam: Math.round(this.camY) };
  }

  // ------------------------------------------------------------ juice
  ricochetFx(x, y, side, speed = 300) {
    this.audio && this.audio.sfx.wallBounce();
    this.shake = Math.max(this.shake, Math.min(3, speed / 180));
    for (let i = 0; i < 7; i++) {
      const a = (Math.random() - 0.5) * 1.6;
      const s = 120 + Math.random() * 160;
      this.particles.push({ x, y: y + (Math.random() - .5) * 20,
        vx: -side * Math.cos(a) * s, vy: Math.sin(a) * s + 60,
        life: 0.3 + Math.random() * 0.2, t: 0, r: 3 + Math.random() * 3, star: i < 3 });
    }
    this.events.push({ k: 'wall' });
  }
  popup(text, x, y, color, size, life, lvl = -1) {
    this.popups.push({ text, x, y, color, size, life, t: 0, lvl });
  }
  dust(x, y, n, power) {
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.1 + Math.random() * 0.8);
      const s = 60 + Math.random() * 140 + power * 120;
      this.particles.push({ x, y: y + 2, vx: Math.cos(a) * s * (Math.random() < .5 ? -1 : 1),
        vy: Math.sin(a) * s * 0.5, life: 0.35 + Math.random() * 0.3, t: 0,
        r: 3 + Math.random() * 4, star: power > 0.7 && Math.random() < 0.4 });
    }
  }
  updateParticles(dt) {
    for (const q of this.particles) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy -= 500 * dt; q.vx *= 0.96; }
    this.particles = this.particles.filter(q => q.t < q.life);
  }

  // ------------------------------------------------------------ draw
  draw(ctx) {
    const cam = this.camY;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - .5) * this.shake * 2, (Math.random() - .5) * this.shake * 2);
    const t = performance.now() / 1000;
    drawBackground(ctx, cam, t);

    const n0 = Math.max(0, Math.floor(cam / FLOOR_GAP) - 1);
    const n1 = Math.ceil((cam + VIEW_H + PLAT_H) / FLOOR_GAP) + 1;
    for (let n = n0; n <= n1; n++) drawPlatform(ctx, this.tower.platform(n), cam, t);

    if (this.race) this.drawRemotes(ctx, cam);
    this.drawParticles(ctx, cam);
    this.drawPlayer(ctx, cam);
    drawSideWalls(ctx, cam, t);
    this.drawPopups(ctx, cam);
    ctx.restore();
  }

  sy(y, cam) { return VIEW_H - (y - cam); }

  drawPlayer(ctx, cam) {
    const p = this.p;
    const y = this.sy(p.y, cam);
    if (y < -80 || y > VIEW_H + 120) return;
    ctx.save();
    ctx.translate(p.x, y);
    drawCharacter(ctx, this.char, {
      anim: p.anim, t: p.animT, facing: p.facing, spin: p.spin,
      squash: p.squash, vx: p.vx, vy: p.vy,
    });
    ctx.restore();
  }

  drawRemotes(ctx, cam) {
    for (const r of this.race.players.values()) {
      if (!r.pos) continue;
      const y = this.sy(r.pos.y, cam);
      const onScreen = y > 20 && y < VIEW_H + 40;
      ctx.save();
      if (onScreen) {
        ctx.globalAlpha = r.out ? 0.35 : 0.72;
        ctx.translate(r.pos.x, y);
        drawCharacter(ctx, r.char, { anim: r.out ? 'dead' : (r.pos.a || 'idle'), t: r.animT || 0,
          facing: r.pos.f || 1, spin: r.pos.sp || 0, squash: 0, vx: 0, vy: 0 });
        ctx.globalAlpha = 1;
        tag(ctx, r.name, 0, -66, r.color);
      } else {
        // off-screen arrow on the edge they are beyond
        const up = y <= 20;
        const ay = up ? 58 : VIEW_H - 18;
        ctx.translate(clamp(r.pos.x, WALL_W + 20, VIEW_W - WALL_W - 20), ay);
        ctx.fillStyle = r.color; ctx.strokeStyle = '#1f1612'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        if (up) { ctx.moveTo(0, -12); ctx.lineTo(9, 2); ctx.lineTo(-9, 2); }
        else { ctx.moveTo(0, 12); ctx.lineTo(9, -2); ctx.lineTo(-9, -2); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        tag(ctx, `${r.name} ${r.floor || 0}`, 0, up ? 16 : -16, r.color, 11);
      }
      ctx.restore();
    }
  }

  drawParticles(ctx, cam) {
    for (const q of this.particles) {
      const a = 1 - q.t / q.life;
      const y = this.sy(q.y, cam);
      ctx.globalAlpha = a;
      if (q.star) {
        ctx.fillStyle = '#ffe45c'; ctx.strokeStyle = '#1f1612'; ctx.lineWidth = 1.5;
        star(ctx, q.x, y, q.r * 1.3); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = '#fff6e4'; ctx.strokeStyle = 'rgba(31,22,18,.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(q.x, y, q.r * (0.6 + a * 0.4), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawPopups(ctx, cam) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const pp of this.popups) {
      const k = pp.t / pp.life;
      let x = pp.x, y, size = pp.size, rot = 0;
      if (pp.y === null) {
        // praise: slams in centre screen, wobbles, floats off
        const s = k < 0.15 ? 0.4 + (k / 0.15) * 0.8 : k < 0.25 ? 1.2 - (k - 0.15) * 2 : 1;
        size *= s; y = VIEW_H * 0.36 - Math.max(0, k - 0.7) * 160;
        rot = Math.sin(pp.t * 9) * 0.05 * (1 - k);
      } else {
        y = this.sy(pp.y, cam) - k * 40;
      }
      ctx.save();
      ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      ctx.translate(x, y); ctx.rotate(rot);
      ctx.font = `900 ${size | 0}px "Lilita One", "Trebuchet MS", system-ui, sans-serif`;
      ctx.lineJoin = 'round';
      if (pp.lvl >= 0) {
        const hue = (pp.lvl * 36 + pp.t * 240) % 360;
        const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
        g.addColorStop(0, '#fffbe8'); g.addColorStop(1, `hsl(${hue},95%,60%)`);
        ctx.lineWidth = size * 0.22; ctx.strokeStyle = '#1f1612'; ctx.strokeText(pp.text, 0, 0);
        ctx.fillStyle = g; ctx.fillText(pp.text, 0, 0);
      } else {
        ctx.lineWidth = size * 0.2; ctx.strokeStyle = '#1f1612'; ctx.strokeText(pp.text, 0, 0);
        ctx.fillStyle = pp.color; ctx.fillText(pp.text, 0, 0);
      }
      ctx.restore();
    }
  }
}

function tag(ctx, text, x, y, color, size = 12) {
  ctx.font = `900 ${size}px "Lilita One", "Trebuchet MS", system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = color || '#fff'; ctx.strokeStyle = '#1f1612'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - size / 2 - 4, w, size + 8, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1f1612'; ctx.fillText(text, x, y + 1);
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
