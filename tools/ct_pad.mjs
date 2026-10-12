// Controller test: a fake Onikuma Iruka (Switch-printed face buttons, seen by
// Chrome as an XInput pad) drives the menus into a solo climb with the d-pad and
// printed A/B/+ only, then checks printed A jumps, + pauses, B quits, and the
// game-over and online screens.
//   (cd ~/capy-tower-fork && python3 -m http.server 8811 &)   . ~/tools/pw/env.sh
//   node tools/ct_pad.mjs [baseUrl]
import { chromium } from '/home/amnaj/tools/pw/node_modules/playwright-core/index.mjs';
import { installFakePad, RAW, press, hold, release } from '/home/amnaj/arcade/pad/test/fakepad.mjs';
const BASE = process.argv[2] || 'http://127.0.0.1:8811';
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 480, height: 720 } });
await installFakePad(ctx);
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const P = (i) => press(p, i, 320, 450);
const scr = () => p.evaluate(() => window.__ct.screen);
const foc = () => p.evaluate(() => { const f = document.querySelector('.cp-focus'); return f ? (f.id || f.dataset.go || f.className) : null; });
const until = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await p.waitForTimeout(150); } return false; };
// press `dir` until `want()` holds (a loaded box can miss or repeat a press)
async function navUntil(dir, want, max = 8) { for (let i = 0; i < max && !(await want()); i++) await P(dir); return want(); }

await p.goto(BASE + '/index.html');
await p.waitForTimeout(1200);
await hold(p, RAW.A);
const map = await p.evaluate(() => { const g = navigator.getGamepads()[0]; return { a: g.buttons[0].pressed, b: g.buttons[1].pressed, lay: g.capyLayout }; });
await release(p, RAW.A); await p.waitForTimeout(300);
ok(map.a && !map.b && map.lay === 'nintendo', 'Iruka printed A -> buttons[0] ' + JSON.stringify(map));
ok(await until(async () => await scr() === 'select'), 'that A press chose Solo Climb (title focuses it)');
await P(RAW.B);
ok(await scr() === 'title', 'B -> title');

ok(await until(async () => await foc() === 'solo'), 'title focuses Solo Climb: ' + await foc());
await P(RAW.A);
ok(await scr() === 'select', 'A -> character select');
ok(await p.evaluate(() => /A to go · B back/.test(document.querySelector('#s-select .hint').textContent)), 'select hint shows printed buttons: ' + await p.evaluate(() => document.querySelector('#s-select .hint').textContent));
const c0 = await p.evaluate(() => document.querySelector('#roster .card.sel span').textContent);
await P(RAW.RIGHT);
const c1 = await p.evaluate(() => document.querySelector('#roster .card.sel span').textContent);
ok(c0 !== c1, `d-pad right picks the next capy ${c0} -> ${c1}`);
await P(RAW.B);
ok(await scr() === 'title', 'B -> title');
await P(RAW.PLUS);
ok(await scr() === 'select', '+ on title -> Solo Climb');
await P(RAW.A);
ok(await scr() === 'maps', 'A on the capy -> tower select');
const m0 = await p.evaluate(() => document.querySelector('#maplist .mapcard.sel b').textContent);
await P(RAW.DOWN);
const m1 = await p.evaluate(() => document.querySelector('#maplist .mapcard.sel b').textContent);
ok(m0 !== m1, `d-pad down picks the next tower ${m0} -> ${m1}`);
await P(RAW.UP);
await P(RAW.A);
ok(await scr() === 'play', 'A on a tower -> climbing');

// printed B (raw 0) does nothing in play; printed A (raw 1) jumps
await p.waitForTimeout(600);
const y0 = await p.evaluate(() => window.__ct.game.p.y);
await P(RAW.B);
const yB = await p.evaluate(() => window.__ct.game.p.y);
await hold(p, RAW.A);
const jumped = await until(() => p.evaluate(y => window.__ct.game.p.y > y + 20, y0), 3000);
await release(p, RAW.A);
ok(Math.abs(yB - y0) < 5 && jumped, `printed A jumps, printed B doesn't (y ${y0.toFixed(0)} / B ${yB.toFixed(0)})`);
await p.waitForTimeout(800);
await P(RAW.PLUS);
ok(await p.evaluate(() => window.__ct.game && !window.__ct.game.over) , 'still climbing');
const paused1 = await p.evaluate(() => document.querySelector('#game') && window.__ct.game.p.y);
await p.waitForTimeout(600);
ok(paused1 === await p.evaluate(() => window.__ct.game.p.y), '+ pauses (capy frozen)');
await P(RAW.PLUS);
await p.waitForTimeout(400);
await P(RAW.PLUS);
await P(RAW.B);
ok(await scr() === 'title', 'paused: B -> title');

// game over: held A as the scorecard appears must not restart; B -> menu
await P(RAW.A); await P(RAW.A); await P(RAW.A);
ok(await scr() === 'play', 'A x3 from title -> climbing again');
await p.waitForTimeout(500);
await hold(p, RAW.A);
await p.evaluate(() => { const g = window.__ct.game; g.camY += 5000; });
ok(await until(async () => await scr() === 'over', 8000), 'fell -> game over screen');
await p.waitForTimeout(700);
ok(await scr() === 'over', 'held A did not click Climb Again');
await release(p, RAW.A); await p.waitForTimeout(400);
ok(await until(async () => await foc() === 'again'), 'game over focuses Climb Again: ' + await foc());
ok(await p.evaluate(() => /A to climb again · B menu/.test(document.querySelector('#s-over .hint').textContent)), 'game-over hint shows printed buttons');
await P(RAW.B);
ok(await scr() === 'title', 'B on game over -> title');

// online: title -> Online Race -> capy -> online screen, B backs out
ok(await navUntil(RAW.DOWN, async () => await foc() === 'online'), 'd-pad down to Online Race');
await P(RAW.A); await P(RAW.A);
ok(await scr() === 'online', 'A, A -> online screen');
ok(await until(async () => await foc() !== null), 'online screen has a focused control: ' + await foc());
await P(RAW.B);
ok(await scr() === 'select', 'B on online -> back to capy select: ' + await scr());
await P(RAW.B);
// how to play: lists the controller with printed names
ok(await navUntil(RAW.DOWN, async () => await foc() === 'howto'), 'd-pad to How to Play');
await P(RAW.A);
ok(await p.evaluate(() => /A or ▲ jump · \+ pause · B back/.test(document.querySelector('.pad-help').textContent)), 'how-to controller line: ' + await p.evaluate(() => document.querySelector('.pad-help').textContent));
await P(RAW.B);
ok(await scr() === 'title', 'B -> title');
// lobby (needs the race server: PORT=8096 node server/tower-server.js; skipped if it is down)
const up = await fetch('http://127.0.0.1:8096/').then(() => true, () => false);
if (up) {
  ok(await navUntil(RAW.UP, async () => await foc() === 'online'), 'd-pad to Online Race');
  await P(RAW.A); await P(RAW.A);
  ok(await until(async () => await foc() === 'quick'), 'online screen starts on Quick Race: ' + await foc());
  await P(RAW.A);
  ok(await until(async () => await scr() === 'lobby'), 'A on Quick Race -> lobby');
  ok(await until(async () => await foc() !== null), 'lobby has a focused control: ' + await foc());
  await P(RAW.PLUS);                                  // + = Start (host)
  ok(await until(async () => await scr() === 'play'), '+ in the lobby starts the race');
  await hold(p, RAW.A); await p.waitForTimeout(400); await release(p, RAW.A);
  await p.evaluate(() => { window.__ct.game.camY += 5000; });
  ok(await until(async () => await scr() === 'results', 15000), 'fell -> race results');
  await p.waitForTimeout(500);
  await P(RAW.B);
  ok(await until(async () => await scr() === 'lobby'), 'B on results -> back to lobby (not out of the room)');
  await P(RAW.B);
  ok(await until(async () => await scr() === 'online'), 'B in the lobby -> leave');
} else console.log('SKIP lobby: no race server on :8096');
ok(!errs.length, 'no page errors ' + errs.join(' | '));
await b.close();
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
