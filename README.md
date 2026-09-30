# Capy Tower (APFORGE edition)

A fork of [kenkyung/capy-tower](https://github.com/kenkyung/capy-tower), rebuilt to play and look like
the original **Icy Tower** (Free Lunch Design, 2001). It stars the Capy Leap crew.
Vanilla JS ES modules and Canvas 2D, with no build step and no dependencies.

Live: https://capy.apforge.net/tower/

## What's different from the original fork

- **Icy Tower mechanics:** your run speed sets your jump height. A standing jump clears about 1 floor and a
  full sprint about 5, with the cartwheel spin at the top tier.
- **Wall ricochets:** hit a wall in mid-air and you keep about 98% of your speed and all of your vertical
  velocity. Jump just as you reach a wall and you kick off it.
- **Combos:** each jump must gain 2 or more floors, and the meter lasts 3 s. Praise words from GOOD! to NO WAY!
  follow Icy Tower's cut-offs.
- **Score:** 10 × floor + Σ combo².
- **The clock:** the tower starts scrolling at floor 5 and speeds up every 30 s, with the HURRY UP bell and
  7 speed steps.
- **Art:** the art is cel-shaded, drawn as outlined cartoons in the Capy Leap style. There are
  7 tower themes, each 50 floors tall: Riverbank Keep, Bamboo Dojo, Frost Spire, Lava Forge, Neon Night,
  Gingersnap Hall and Starlight Top. Arched windows look out on parallax scenery that runs from day to space.
- **Characters:** 5 playable capybaras (CAPY, YORU, TICO, PIKO, CHANG), each with small stat differences.
- **Soundtrack:** procedural boom-bap hip hop in Web Audio, 5 tracks, with a new beat for each theme.
  To add your own MP3s, see `music/README.md`.
- **Online race:** up to 4 players climb an identical seeded tower, each with their own camera and the
  others drawn live. Last capy standing wins.

## Run locally

```bash
python3 -m http.server 8777          # game at http://localhost:8777
PORT=8096 node server/tower-server.js   # race server (the game finds it on :8096 from localhost)
```

Preview pages: `dev/characters.html`, `dev/world.html`, `dev/audio.html`. The module layout is described in `CONTRACT.md`.

## Deploy (APFORGE arcade)

```bash
cp deploy/deploy.conf.example deploy/deploy.conf   # once; set HOST
git pull && deploy/install.sh
```

This copies the game to `/var/www/arcade/tower` and installs the race server as the `capy-tower` systemd
service on 127.0.0.1:8096. The arcade installer (capy-leap) routes `/tower/` and `/tower/ws`.

## Controls

← → / A D to run · Space / ↑ / W to jump · P to pause · M to mute · N for the next track · gamepad and touch are supported
