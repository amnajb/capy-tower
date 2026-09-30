# Capy Tower

A browser clone of the old-school "Icy Tower", starring a capybara.
Vanilla JS + Canvas, no build step, no dependencies.

## Run

Open `index.html` directly in a browser, or serve it:

```bash
cd capy-tower
python3 -m http.server 8777
# then open http://localhost:8777
```

## Controls

- ← → / A D — move
- SPACE / ↑ / W — jump (hold to jump higher)
- R — restart · P — pause · M — mute

## Design notes

- One-way platforms: you jump *through* floors from below and land on top
  when falling. The tower has holes (gaps); land only on the solid parts.
- Icy Tower's signature tension: the camera auto-scrolls upward, faster the
  higher you climb. Fall below the bottom of the screen and it's game over.
- Variable jump: holding jump applies reduced gravity while rising, giving a
  much higher jump than a tap.
- Jump feel: coyote time (0.1 s), jump buffering (0.12 s), terminal velocity,
  snappier ground friction, softer air control, camera look-ahead.
- Difficulty ramps with altitude: floor spacing and hole width grow, and the
  camera's auto-scroll speeds up.
- Combo: landing on consecutive floors within 1.4 s builds a combo multiplier.
- Score = height climbed (meters). Best is persisted in localStorage.
- Juice: jump/land dust, combo sparkles, motion trail at high speed, landing
  squash & stretch, screen shake on hard landings.
- World: day-to-night sky as you climb (stars, sun and moon), parallax
  mountains and clouds, brick tower walls, grass-to-snow platforms.

## Deploy (APFORGE arcade)

```bash
cp deploy/deploy.conf.example deploy/deploy.conf   # once; set HOST
git pull && deploy/install.sh
```

Copies the game files to `/var/www/arcade/tower` on the VPS. The arcade
installer (capy-leap) routes `/tower/` there and adds the picker card.
