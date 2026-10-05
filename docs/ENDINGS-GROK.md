# Capy Tower: character ending videos with Grok Imagine

You reach the **summit (floor 200)** of any of the four new towers (Sakura Springs, Coral Reef Spire,
Cloud Carnival, Clockwork Toybox), and the game plays **that character's** ending video. There are 5 videos,
one per capy. The game draws its own title ("CAPY REACHED THE TOP!") and plays its own victory sting over
the video, so the video needs **no text and no audio**.

| file | character |
|---|---|
| `endings/capy.mp4` + `endings/capy.jpg` | CAPY |
| `endings/yoru.mp4` + `endings/yoru.jpg` | YORU |
| `endings/tico.mp4` + `endings/tico.jpg` | TICO |
| `endings/piko.mp4` + `endings/piko.jpg` | PIKO |
| `endings/chang.mp4` + `endings/chang.jpg` | CHANG |
| `endings/group.mp4` + `endings/group.jpg` (optional) | all five; online race win |

If a file is missing, the game falls back to its in-engine cheer scene. You can add the videos one at a time.

---

## 1. What Grok Imagine can do (researched Oct 2026)

| | |
|---|---|
| Modes | Text-to-image, image editing (up to 5 source images), **image-to-video** (your image becomes the first frame), text-to-video, and **reference-to-video** (several reference images composited into one scene). The video model is `grok-imagine-video-1.5`. |
| Clip length | 1–15 s per clip, default 6 s. "Extend" continues a clip, up to about 30 s in total. |
| Aspect ratios | 16:9, 9:16, 1:1, 4:3, 3:4, 3:2, **2:3**. Image-to-video usually follows the input image's ratio. |
| Resolution | 480p or 720p, with 720p the default. Some image-to-video setups go up to 1080p on higher tiers. |
| Audio | **Generated natively**: music, SFX, ambience and even lip-synced dialogue. One host (PixVerse) says it can't be switched off. We **strip it in ffmpeg** (step 5). |
| Output | MP4 download. |
| Plans | Video isn't on the free tier. SuperGrok Lite (~$10/mo) reportedly allows about 3 videos a day, and SuperGrok (~$30/mo) about 10–15 a day, resetting at midnight UTC. *(Unverified: these figures come from third-party sites and change often.)* |
| Content | Use the **normal mode only**. Never use "Spicy". Every prompt below is written for ages 5 and up. |
| Consistency tips | Generate **every clip from the same clean key-frame image**, vary only the motion prompt, and start with a locked camera. Avoid in the source image: hands covering the face, cropped feet, crowds, reflections, painted-on speed lines. Reference mode accepts up to 7 images. |

Sources:
- [xAI docs: video generation](https://docs.x.ai/docs/guides/video-generations)
- [PixVerse: Grok Imagine 1.5 image-to-video guide](https://pixverse.ai/en/blog/grok-imagine-now-available-on-pixverse)
- [Replicate: grok-imagine-video](https://replicate.com/xai/grok-imagine-video)
- [WaveSpeedAI: reference-to-video](https://wavespeed.ai/blog/posts/introducing-x-ai-grok-imagine-video-reference-to-video-on-wavespeedai/)
- [Grok Imagine 1.5 reference images guide](https://grokimagine15.ai/blog/grok-imagine-1-5-reference-images-guide)
- [Neolemon: character consistency tips](https://www.neolemon.com/blog/kling-ai-grok-ai-character-consistency-tips/)
- [Zeely: features and limits](https://zeely.ai/blog/grok-imagine-video/)
- [ximagineai: video limits per tier](https://ximagineai.com/grok-video-limit)

---

## 2. Reference images (`docs/endings-ref/`)

| file | use |
|---|---|
| `<id>-portrait.jpg` | Original **Capy Leap** cartoon portrait. This is the richest likeness. **Always upload it.** These stay local only and are gitignored, because they come from the private capyleap repo. To regenerate them, extract the base64 `art` from `const SKINS` in capyleap `site/index.html`. |
| `<id>-sheet.png` | In-game cel-shaded render, idle and cheer side by side, on a cream backdrop |
| `<id>-idle.png`, `<id>-cheer.png` | The same poses on a transparent background (1024²) |

These are made by `dev/refsheet.html?char=<id>&pose=idle|cheer|both&bg=flat|clear`, with a Playwright
screenshot from `~/tools/pw/ct_refs.mjs`.

---

## 3. Paste-in blocks (used by every prompt)

### Style block

```text
STYLE: 2D cel-shaded cartoon animation for a kids' mobile game. Chibi capybara character with a big round head (as wide as the body), small rounded ears, a short rounded muzzle with a darker nose pad and a tiny smile, one big glossy black eye with two white highlight dots, a chunky pear-shaped body and short stubby legs and paws. Thick dark brown-black outlines (#1f1612) on every shape, flat colour fills with exactly one hard-edged shadow tone and a small soft highlight. Bright, warm, friendly colours. Smooth, bouncy, squash-and-stretch cartoon motion. Same character design in every frame, exactly matching the reference image.
```

### Avoid block

```text
AVOID: realistic animals, realistic fur, photorealism, 3D render look, anime fan-service, extra limbs, extra characters, changing outfit or colours, scary or sad moments, falling injuries, weapons, fire hazards, text, letters, numbers, logos, watermarks, speech bubbles, subtitles, talking, lip-sync, dialogue, camera shake, flicker, morphing faces.
```

### Character anchors (paste the one you're animating)

```text
CAPY: tan capybara, fur #e8c79a with shadow #bb9a6f, muzzle #c9a079, nose #6e4a33. Wears an orange-red hiking backpack (#e4553f) with a rolled bedroll on top, a yellow strap (#ffd166) and a small grey carabiner. Calm, steady, cheerful.
```

```text
YORU: near-black capybara, fur #35313a with shadow #1d1a20, muzzle #6d5b5a, purple inner ears. Wears a flowing purple cape (#8d3bd8) fastened at the neck with a round gold clasp (#ffd166). Light, floaty, mysterious but friendly.
```

```text
TICO: pale silver-grey capybara, fur #d8dbe0 with shadow #a8adb5, grey nose #62666f. Wears an olive-green ranger campaign hat (#6f7a3f) with a pinched "Montana peak" crown and a tan band (#d9c07a). Springy, outdoorsy, proud.
```

```text
PIKO: light grey capybara, fur #c9ced6 with shadow #99a1ab. Wears cyan swim-style goggles (#8fe6ff lenses, dark frame) on the forehead or eyes, plus a headset with a cyan ear cup and a thin microphone boom. Quick, techy, excitable.
```

```text
CHANG: brown capybara, fur #9c6b3c with shadow #744d29, dark nose #3e2717. Wears a yellow hard hat (#ffc32b) with a small headlamp on the front, and a brown tool belt with a silver buckle holding a wrench and a hammer. Big, sturdy, warm-hearted, lands heavily.
```

### Shared setting: "the summit"

All five endings share one summit, so they work for any tower:

```text
SETTING: the round flat rooftop at the very top of a tall cartoon tower, high above a sea of fluffy clouds. Golden-hour sky turning to soft twilight, first stars appearing, gentle sun glow on the horizon. A small celebratory pennant on a pole at the roof's edge (plain coloured triangle, no writing).
```

**Per-tower variant (optional):** swap the setting line for the tower you want the ending to show:
- **Sakura Springs:** a steaming hot-spring pool on the summit, cherry blossoms drifting, floating yuzu fruits.
- **Coral Reef Spire:** a coral summit under shimmering water, bubbles and friendly fish.
- **Cloud Carnival:** a cloud-top fairground, hot-air balloons and bunting.
- **Clockwork Toybox:** the lid of a giant toy box, brass gears and wind-up toys.

---

## 4. Per-character prompts

Frame everything in **2:3 portrait** (matches the game's 480x720 screen exactly). If 2:3 isn't offered,
use 9:16 and keep the action in the middle 75% of the height, because the game crops the top and bottom.
Make each clip **8–10 s** (6 s works too). End every clip on a **held pose** for the last ~1.5 s, because the
game freezes on the final frame (the poster image) under its title card.

Each ending has these parts:
- **(a) Key frame:** Grok Imagine *image* mode. Upload `<id>-portrait.jpg` and `<id>-sheet.png`, and paste the prompt with the Style, the anchor and the Setting blocks.
- **(b) Motion:** image-to-video from the key frame you pick. Paste the motion prompt plus the Avoid block.
- **(c) Long cut (optional):** a second clip for a longer version.

### CAPY: "Camp at the Top"

Story: steady, no-fuss CAPY reaches the top and does what a trail hopper does. He rolls out the bedroll,
plants the pennant, and settles in to watch the sun go down.

**(a) Key frame**

```text
[STYLE] [CAPY anchor] [SETTING]
Key frame, 2:3 portrait, full body, centred, 3/4 view facing right. CAPY has just arrived on the summit rooftop, standing tall with both paws raised in a happy cheer, backpack on, eyes bright, small open-mouth smile. Clouds and golden sunset behind. Clean composition, character fills the middle third of the frame, feet fully visible.
```

**(b) Motion (8–10 s)**

```text
Animate this image. Locked camera for the first half, then a slow gentle push-in.
0–2s: CAPY does a little victory hop with both paws up, squash-and-stretch landing.
2–5s: he swings the backpack down, unrolls the striped bedroll onto the roof with a happy flick, and pushes the small pennant pole into place; the pennant flutters in the breeze.
5–8s: he flops down to sit on the bedroll, sighs happily and waves at the viewer as the sun sinks and the first stars twinkle.
8–10s: hold the final pose: seated, one paw waving, content smile, pennant waving softly. Keep the character design identical to the image throughout.
[AVOID]
```

**(c) Long cut (optional)**

```text
Continue from the last frame. The camera slowly rises and pulls back to reveal the whole tower below CAPY, glowing windows on every floor, clouds drifting past. CAPY stays seated and waves. End held on the wide shot with the tiny waving capybara at the top.
[AVOID]
```

### YORU: "Night Delivery"

Story: the night courier finishes the climb and makes the last delivery. YORU glides off the tower with a
glowing parcel and drops it into a tiny star-shaped mailbox floating in the night sky.

**(a) Key frame**

```text
[STYLE] [YORU anchor] [SETTING, but later: deep blue night sky full of stars and a big round glowing moon]
Key frame, 2:3 portrait. YORU stands at the edge of the summit rooftop facing right, holding a small softly glowing parcel tied with a gold ribbon, purple cape lifting in the breeze, moon behind. Full body, centred, feet visible.
```

**(b) Motion (8–10 s)**

```text
Animate this image. Smooth, floaty motion.
0–2s: YORU tucks the glowing parcel under one arm and gives a little confident nod.
2–5s: YORU hops off the rooftop and spreads the purple cape like wings, gliding gracefully across the starry sky in a gentle arc; the camera follows sideways.
5–8s: YORU drops the glowing parcel into a tiny floating star-shaped mailbox; the mailbox sparkles and the stars around it twinkle brighter.
8–10s: hold the final pose: YORU floating in front of the big moon, cape billowing, one paw raised in a cool wave, gold clasp glinting. Same character design throughout.
[AVOID]
```

**(c) Long cut (optional)**

```text
Continue from the last frame. YORU drifts slowly back down to land softly on the summit rooftop, cape settling, and curls up for a happy nap under the stars. End held on the sleeping YORU with a gentle cape flutter.
[AVOID]
```

### TICO: "Highest Spring"

Story: TICO springs higher than anyone, so even the summit isn't high enough. TICO does one giant bonus
jump, comes back down and plants a sapling that bursts into blossom.

**(a) Key frame**

```text
[STYLE] [TICO anchor] [SETTING]
Key frame, 2:3 portrait. TICO stands on the summit rooftop facing right, crouched low and ready to spring, ranger hat firmly on, determined happy face, a small flower pot with a tiny green sprout beside the feet. Full body, centred, feet visible.
```

**(b) Motion (8–10 s)**

```text
Animate this image.
0–2s: TICO crouches and launches straight up in a huge cartoon spring jump; the camera tilts up to follow, clouds whoosh past.
2–4s: at the peak TICO does a joyful mid-air somersault, holding the ranger hat on with one paw.
4–7s: TICO lands back on the rooftop with a springy bounce and pats the little sprout; it grows instantly into a small cherry-blossom sapling, pink petals bursting out and drifting.
7–10s: hold the final pose: TICO standing proudly next to the blossoming sapling, giving a ranger salute with one paw at the hat brim, petals floating. Same character design throughout.
[AVOID]
```

**(c) Long cut (optional)**

```text
Continue from the last frame. A breeze carries the pink petals off the tower and across the clouds; TICO watches them go, then tips the hat to the viewer. End held on the hat tip.
[AVOID]
```

### PIKO: "Signal Boost"

Story: the fastest capy zips to the top and plugs in. PIKO sets up a tiny antenna and taps the headset,
and the whole sky lights up with ribbons of coloured light.

**(a) Key frame**

```text
[STYLE] [PIKO anchor] [SETTING, at dusk]
Key frame, 2:3 portrait. PIKO stands on the summit rooftop facing right next to a small cartoon antenna dish on a tripod, goggles pushed up on the forehead, one paw touching the headset ear cup, excited open-mouth smile. Full body, centred, feet visible.
```

**(b) Motion (8–10 s)**

```text
Animate this image. Snappy, energetic timing.
0–2s: PIKO zips in a quick little circle around the antenna (motion trail), stops and pulls the cyan goggles down over the eyes with a snap.
2–4s: PIKO taps the headset; the antenna dish spins and beams a soft cyan pulse into the sky.
4–8s: the sky answers with ribbons of colourful light (cyan, pink, gold) swirling like an aurora, little sparkles raining down; PIKO bounces on the spot with excitement.
8–10s: hold the final pose: PIKO with one paw raised high, goggles glinting, the light ribbons glowing behind. Same character design throughout.
[AVOID]
```

**(c) Long cut (optional)**

```text
Continue from the last frame. The light ribbons form a big glowing spiral that slowly orbits the tower top; PIKO pushes the goggles back up and gives a cheeky wink to the viewer. End held on the wink.
[AVOID]
```

### CHANG: "Built to Last"

Story: heavy CHANG lands hard enough to make the summit wobble, in a funny way, then gets to work. A few
hammer taps build a little wooden bridge out to a floating island, and CHANG crosses it proudly.

**(a) Key frame**

```text
[STYLE] [CHANG anchor] [SETTING, plus a small floating grassy island hovering a short gap away from the rooftop]
Key frame, 2:3 portrait. CHANG stands on the summit rooftop facing right, hard hat on, headlamp glowing, holding an oversized cartoon wrench over one shoulder, proud grin. A small floating island waits across a gap. Full body, centred, feet visible.
```

**(b) Motion (8–10 s)**

```text
Animate this image.
0–2s: CHANG hops and lands heavily with a big comedic squash; a puff of dust and a funny wobble ripple through the rooftop, and the pennant boings.
2–6s: CHANG pulls a hammer from the tool belt and taps rapidly; wooden planks pop into place one after another, building a small cartoon rope-and-plank bridge across to the floating island.
6–8s: CHANG strolls across the bridge with a proud waddle; the headlamp beam sweeps across the twilight.
8–10s: hold the final pose: CHANG on the island, leaning on the big wrench, other paw giving a thumbs-up, hard hat glinting. Same character design throughout.
[AVOID]
```

**(c) Long cut (optional)**

```text
Continue from the last frame. More floating islands drift into view; CHANG grins, and a long cartoon bridge builds itself plank by plank toward them into the sunset. End held on CHANG pointing ahead.
[AVOID]
```

### Bonus: all five celebrate (online race win, `endings/group.mp4`)

**(a) Key frame**

Upload all 5 `*-portrait.jpg` files. In reference mode you can use up to 7.

```text
[STYLE] [all five anchors] [SETTING]
Key frame, 2:3 portrait. All five capybaras stand together in a line on the summit rooftop, facing the viewer at a slight angle, left to right: TICO, PIKO, CAPY (centre, slightly forward), YORU, CHANG. Everyone smiling with paws raised. Full bodies visible, nobody overlapping faces.
```

**(b) Motion (8–10 s)**

```text
Animate this image. Locked camera.
0–3s: all five jump up together in a happy cheer, landing in sync with a bouncy squash.
3–7s: colourful confetti and soft fireworks bloom in the twilight sky behind them; each capy does a little signature move: TICO tips the ranger hat, PIKO snaps the goggles down, CAPY waves, YORU swirls the purple cape, CHANG lifts the wrench.
7–10s: hold the final group pose: all paws up, confetti drifting. Keep all five designs identical to the image.
[AVOID]
```

---

## 5. Workflow: generate, convert, ship

1. **Key frame:** in Grok Imagine, choose *Image*, upload the reference images, and paste the (a) prompt with
   the blocks filled in. Generate 4–8 versions and keep the one that best matches the portrait: same
   colours and accessory, one eye visible, feet in frame. Download it.
2. **Video:** choose *Video*, then image-to-video with that key frame. Set 2:3 (or 9:16), 720p, 10 s, and paste
   the (b) prompt. Generate at least 3 takes. Reject any take where the face morphs, the accessory changes,
   text appears, or there's dialogue.
3. **Long cut (optional):** use *Extend* on the chosen take with the (c) prompt. Or generate (c) separately
   from the last frame of (b) and join the two clips (step 5).
4. **Download** the MP4 and name it `<id>-raw.mp4`.
5. **Convert:** use H.264, 720x1080 (2:3), 30 fps, no audio, under 8 MB, with faststart so it streams:

   ```bash
   # 2:3 source (or 9:16, which gets centre-cropped to 2:3)
   ffmpeg -y -i capy-raw.mp4 \
     -vf "scale=720:1080:force_original_aspect_ratio=increase,crop=720:1080,fps=30,format=yuv420p" \
     -c:v libx264 -profile:v high -preset slow -crf 23 -movflags +faststart -an \
     endings/capy.mp4

   # poster = the held final frame (shown under the title card, and while loading)
   ffmpeg -y -sseof -0.2 -i endings/capy.mp4 -frames:v 1 -q:v 3 endings/capy.jpg

   # over 8 MB? re-run step 5 with -crf 26
   ls -lh endings/capy.mp4

   # joining a main clip + long cut first (same size/fps), then convert the result:
   printf "file 'capy-raw.mp4'\nfile 'capy-ext.mp4'\n" > list.txt
   ffmpeg -y -f concat -safe 0 -i list.txt -c copy capy-raw-long.mp4
   ```

   `-an` drops Grok's generated audio. Keep it that way: the game plays the video muted and keeps its own
   hip hop soundtrack going underneath, with a victory sting on top.
6. **Ship:** copy the files to `endings/` in `~/capy-tower-fork`, commit, then deploy:

   ```bash
   git add endings && git commit -m "Endings: capy video" && git push
   deploy/install.sh
   ```

   The deploy copies `endings/` along with the game. Test by climbing to floor 200 with that character, or
   open the game, start that tower, and run `__ct.nearSummit()` in the browser console. It drops you 3 floors below the summit.

## 6. Checklist per video

- [ ] Same colours and accessory as `<id>-portrait.jpg` in every frame
- [ ] No text, letters, logos or speech; no realistic animal look
- [ ] Ends on a held pose for at least 1 s (it becomes the poster `.jpg`)
- [ ] Main action inside the middle 75% of the frame height (safe for 9:16 → 2:3 crop)
- [ ] 720x1080, H.264, no audio track, ≤ 8 MB
- [ ] Watched once start to finish at phone size: fun, cute, ages 5+
