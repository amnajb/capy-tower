# Capy Tower (APFORGE fork) — module contract

Vanilla JS ES modules, no build step, no dependencies. Served as static files
under `/tower/` (so every URL is relative). Multiplayer server lives in
`server/` (Node 18, zero deps).

## Coordinates (every art module uses these; no dpr math in art code)

- Logical canvas **480 x 720** (`VIEW_W`, `VIEW_H`). `main.js` sets
  `ctx.setTransform(k,0,0,k,0,0)` for the device scale before calling any
  drawing function, so art code draws in logical pixels.
- World: x 0..480 left to right, **y up**, 0 = top of the ground floor.
  Screen y = `VIEW_H - (worldY - camY)` (`camY` = world y at bottom of screen).
- Tower: side walls cover `x < WALL_W` and `x > VIEW_W - WALL_W`,
  **`WALL_W = 36`**. Play area is x 36..444.
- Floors: floor `n` top surface at world y = `n * FLOOR_GAP`, **`FLOOR_GAP = 84`**.
  A platform is `{ n, x0, x1 }` (world x, x0 < x1), slab thickness
  **`PLAT_H = 18`** drawn downward from the top surface.
  Floor 0 and every 50th floor span the full play area (36..444).
  Every 10th floor shows its number on a sign.
- Themes change every **50 floors**: `themeIndex = Math.floor(n / 50)`, cycling
  after the last theme.

## js/characters.js  (cel-shaded capybara roster)

```js
export const CHARACTERS = [
  { id:'capy',  name:'CAPY',  tag:'trail hopper',    blurb:'...', colors:{...},
    stats:{ speed:1.00, accel:1.00, jump:1.00 } },   // multipliers, keep within ±6%
  // yoru, tico, piko, chang  (Capy Leap roster, same accessories)
];
export function drawCharacter(ctx, id, pose);   // origin = feet centre, ~52 px tall
export function drawPortrait(ctx, id, w, h, t); // select-screen bust, fills w x h box at origin (0,0 = top-left)
```

`pose = { anim, t, facing, spin, squash, vx, vy, blink }`

- `anim`: `'idle' | 'run' | 'jump' | 'fall' | 'spin' | 'edge' | 'land' | 'cheer' | 'dead'`
- `t`: seconds since that anim started (drives cycles), `facing`: 1 right / -1 left
- `spin`: radians (only for `'spin'`, whole-body rotation about the body centre)
- `squash`: 0..1 landing squash, `vx`/`vy` in px/s for lean/stretch

## js/world.js  (tower + backgrounds)

```js
export const THEMES = [ { id, name, ... } ];
export function themeIndexForFloor(n);
export function drawBackground(ctx, camY, time);   // full 480x720: interior back wall + windows to outside parallax scene
export function drawPlatform(ctx, plat, camY, time); // one platform (+ floor-number sign on every 10th)
export function drawSideWalls(ctx, camY, time);    // foreground walls over everything but the HUD
```

## js/audio.js  (hip hop soundtrack + sfx)

```js
export function createAudio();  // call from a user gesture
// -> { ctx, music, sfx, setMuted(b), muted }
music.start(); music.stop(); music.next(); music.setIntensity(0..1); music.trackName
sfx.jump(power0to1); sfx.land(); sfx.wallBounce(); sfx.combo(floors);
sfx.praise(level0to9); sfx.comboEnd(); sfx.hurry(); sfx.select(); sfx.confirm();
sfx.countdown(n); sfx.gameOver(); sfx.join();
```

MP3s listed in `music/tracks.json` (`{ "tracks": [{ "file": "x.mp3", "name": "X" }] }`)
take priority; the procedural boom-bap engine plays when none load.

## Maps (v3): js/maps.js + world.js additions

`js/maps.js` (game side) defines `MAPS`. Map 0 is the classic endless tower; maps 1-4 are
single-theme towers with a **summit** at floor 200 and a gameplay twist.

| id | name | theme index | twist (game.js) | platform kinds |
|---|---|---|---|---|
| classic | Capy Tower | 0..6 cycle every 50 | none | normal |
| onsen | Sakura Springs | 7 | steam geysers launch you up | normal, geyser |
| reef | Coral Reef Spire | 8 | underwater: floaty low gravity | normal, jelly (bouncy jellyfish) |
| sky | Cloud Carnival | 9 | drifting cloud platforms + wind gusts | normal, cloud (moves sideways) |
| toys | Clockwork Toybox | 10 | conveyor belts + spring pads | normal, conveyor, spring |

### world.js additions

```js
export function setWorldMap({ themes: [7], span: 50, summit: 200 | null });
// themeIndexForFloor(n) -> themes[floor(n / span) % themes.length]
// the sky (day -> sunset -> night -> space) runs over the summit height when
// summit is set (summit = starry night at the top), else the classic floors.
```

`drawPlatform(ctx, plat, camY, time)`: `plat` may now carry

- `kind`: `'normal' | 'geyser' | 'jelly' | 'cloud' | 'conveyor' | 'spring' | 'summit'`
- `dir`: conveyor direction (+1 right / -1 left), belt animates in that direction
- `fx`: animation inputs set by game.js each frame, all 0..1:
  `fx.warn` (geyser bubbling before an eruption), `fx.erupt` (steam column, ~3 floors tall),
  `fx.squish` (jelly/spring compressed by a landing), `fx.spring` (spring launch extension)
- cloud platforms move: game.js changes `x0`/`x1` every frame (width fixed)
- `summit`: full-width goal floor with a finish banner + trophy/flag in the map's style

Floors above a summit don't exist (`tower.platform(n)` returns null for n > summit); draw open sky/
roof there.
