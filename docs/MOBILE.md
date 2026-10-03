# Capy Tower on phones: PWA → Android app → iOS app

The game is static HTML/JS plus one WebSocket race server, so it can reach the stores without a rewrite.
The plan below goes cheapest and fastest first, and every step reuses the same `index.html` + `js/` that
the arcade serves.

## Where we are (phase 1: PWA, shipped)

- **Phone controls:**
  - In portrait the controls dock under the game; in landscape they sit in side panels.
  - The steering pad lets you slide between left and right; JUMP is a big pad.
  - Both are multi-touch.
  - A pause button appears on touch devices.
- **Zoom-proof:**
  - iOS ignores `user-scalable=no`, so `js/mobile.js` blocks pinch (`gesture*`, 2-finger touches),
    double-tap zoom (`touchend` pairs, `dblclick`) and ctrl+wheel.
  - If the page still ends up zoomed, it rewrites the viewport meta to snap back to scale 1.
- **Installable PWA:**
  - Files: `manifest.json` (fullscreen, maskable icons), `sw.js`, and `icons/` generated from the game's own art by `dev/icon.html`.
  - The service worker is network-first, so deploys show up on next launch, and solo climbs work offline.
  - Android and desktop Chrome get an "Install the app" button. iPhone gets Add to Home Screen instructions.
- **Phone niceties:**
  - Screen wake lock while playing.
  - A solo climb auto-pauses when you leave the app.
  - Haptics on Android (wall ricochet, praise, hurry-up, falling).
  - Lobby **Invite** uses the share sheet. Invite links `?room=CODE` drop a friend straight into the room.
- **Native-ready networking:** `js/net.js` sends a packaged app (`capacitor://`, `https://localhost`)
  to `wss://capy.apforge.net/tower/ws`.

### iOS limits a PWA cannot fix

- **Install:** there's no install prompt; Add to Home Screen is manual.
- **Silent switch:** with the ring/silent switch on silent, Web Audio is muted.
  - Safari 17+ has `navigator.audioSession.type = 'playback'` to override this, but it also stops the user's own music (Spotify, etc.).
  - **Decision needed:** keep iOS default behaviour (respect the switch, current) or force game audio.
- **Haptics:** there's no Vibration API on iOS. Haptics need the native wrapper (phase 3).

## Phase 2: Android app on Google Play (Trusted Web Activity) (about 1–2 days)

A TWA is a thin Android app that opens the PWA full screen in Chrome, without browser UI. The Play listing
updates by itself whenever we deploy.

1. Build the project:

   ```bash
   npx @bubblewrap/cli init --manifest https://capy.apforge.net/tower/manifest.json
   ```

   Use package id `net.apforge.capytower`.

2. **Digital Asset Links:** serve `https://capy.apforge.net/.well-known/assetlinks.json` with the app-signing
   SHA-256 fingerprint. Add the route to the arcade installer (`~/capyleap-arcade/install.sh`), because it owns nginx.
3. Run `bubblewrap build` to get the `.aab`, then upload it to Play Console. Use Play App Signing, then copy its
   fingerprint into `assetlinks.json`.
4. Store needs:
   - Google Play developer account ($25 one-time).
   - Privacy policy URL. Add `/tower/privacy.html`. It's short: we store only local records and a display name in the browser, and race names are relayed but not stored.
   - Content rating questionnaire.
   - Screenshots, which the `ct_*` Playwright scripts can produce at phone sizes.

**Pros:** zero extra code, and instant updates.
**Cons:** relies on Chrome being on the device (most are), and native plugins are limited.

## Phase 3: iOS app on the App Store (Capacitor) (about 1 week incl. review)

Apple rejects thin website wrappers (guideline 4.2), so the iOS app **bundles** the game files and adds
native touches.

1. Add a `capacitor/` folder:

   ```bash
   npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/haptics @capacitor/status-bar @capacitor/splash-screen @capacitor/app
   ```

   - Set `webDir` to a `www/` copy of `index.html style.css js music icons manifest.json`. Exclude `sw.js`, since service workers are not used inside the app.
   - The race server URL already switches automatically (`js/net.js`).
2. Native touches:
   - Swap `haptic()` in `js/mobile.js` for `@capacitor/haptics`, and hide the status bar.
   - Set `AVAudioSession` to `.ambient` or `.playback`; see the silent-switch decision above.
   - Pause on `App.addListener('pause')`.
3. Build:
   - Needs a Mac with Xcode, or a cloud build (Codemagic, or GitHub Actions `macos-latest` with fastlane).
   - Needs an Apple Developer Program membership ($99/yr). The organisation account needs a D-U-N-S number; an individual account does not.
4. **Updates:** ship new builds through App Store review. Alternatively, use a live-update service
   (Capgo / Appflow) for JS/asset-only changes. Apple allows those as long as the app's purpose doesn't change.
5. Optional: build Android from the same Capacitor project instead of the TWA, so both stores share one codebase and native plugins.

## Phase 4: make it feel native (after both stores)

- **Global leaderboards:**
  - Add a `/tower/ws` `score` message plus a small JSON store on the race server, which works on every platform.
  - Mirror it to Game Center / Play Games later if we want platform achievements.
- **Race invites:** push notifications ("Ann wants a rematch"). Universal Links / App Links so `capy.apforge.net/tower/?room=CODE` opens the app.
- **Controller support:** already in (Gamepad API). MFi/Backbone controllers on iOS work in WKWebView.

## Decisions for you

1. iOS silent switch: respect it (current) or always play the soundtrack?
2. Store accounts: whose Apple Developer / Google Play accounts (individual or company)?
3. App name and ids: "Capy Tower", `net.apforge.capytower`?
4. Android: TWA first (fastest), or go straight to Capacitor for both?
