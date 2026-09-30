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
- Combo: landing on consecutive floors within 1.4 s builds a combo multiplier.
- Score = height climbed (meters). Best is persisted in localStorage.
