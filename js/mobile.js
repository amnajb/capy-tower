// Phone / tablet / installed-app plumbing:
//  - zoom guards: iOS Safari ignores user-scalable=no (since iOS 10), so rapid
//    taps on the JUMP button were read as double-tap-to-zoom and pinches could
//    leave the page stuck zoomed in. Block every zoom path, and if the page
//    does end up zoomed, snap it back.
//  - screen wake lock while playing, haptics, service worker + install prompt.

const isInput = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');

export function installZoomGuards() {
  const opts = { passive: false };
  // iOS pinch gestures (Safari-only events)
  for (const t of ['gesturestart', 'gesturechange', 'gestureend'])
    document.addEventListener(t, e => e.preventDefault(), opts);
  // two+ fingers = pinch on every other browser
  document.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, opts);
  document.addEventListener('touchmove', e => {
    if (e.touches.length > 1 || (e.scale !== undefined && e.scale !== 1)) e.preventDefault();
  }, opts);
  // double-tap zoom: swallow the second tap of any quick pair (inputs excepted
  // so the on-screen keyboard still works)
  let lastEnd = 0, lastX = 0, lastY = 0;
  document.addEventListener('touchend', e => {
    const now = e.timeStamp || performance.now();
    const t = e.changedTouches && e.changedTouches[0];
    const x = t ? t.clientX : 0, y = t ? t.clientY : 0;
    const near = Math.abs(x - lastX) < 60 && Math.abs(y - lastY) < 60;
    // game controls never need the synthetic click, so always swallow theirs
    if ((now - lastEnd < 400 && near) || e.target.closest('#touch')) {
      if (!isInput(e.target)) e.preventDefault();
    }
    lastEnd = now; lastX = x; lastY = y;
  }, opts);
  document.addEventListener('dblclick', e => e.preventDefault(), opts);
  // ctrl+wheel / trackpad pinch on desktop
  document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, opts);
  // long-press callout / context menu on the game
  document.addEventListener('contextmenu', e => { if (!isInput(e.target)) e.preventDefault(); });

  // Belt and braces: if anything still zooms the page, rewrite the viewport
  // meta, which makes iOS and Android drop back to scale 1.
  const vv = window.visualViewport;
  if (vv) {
    const meta = document.querySelector('meta[name=viewport]');
    const base = meta.getAttribute('content');
    let pending = false;
    const check = () => {
      if (vv.scale > 1.01 && !pending && !isInput(document.activeElement)) {
        pending = true;
        meta.setAttribute('content', base + ', minimum-scale=1');
        requestAnimationFrame(() => {
          meta.setAttribute('content', base);
          window.scrollTo(0, 0);
          pending = false;
        });
      }
    };
    vv.addEventListener('resize', check);
    vv.addEventListener('scroll', () => { if (vv.scale <= 1.01 && (vv.offsetTop || vv.offsetLeft)) window.scrollTo(0, 0); });
    // the keyboard closing can leave iOS scrolled/zoomed: restore on blur
    document.addEventListener('focusout', e => { if (isInput(e.target)) setTimeout(() => { window.scrollTo(0, 0); check(); }, 60); });
  }
}

// ---------------------------------------------------------------- haptics
const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;
let hapticsOn = true;
export function setHaptics(on) { hapticsOn = on; }
export function haptic(ms) {
  if (hapticsOn && canVibrate) { try { navigator.vibrate(ms); } catch (e) {} }
}

// ---------------------------------------------------------------- wake lock
let lock = null;
export async function keepAwake(on) {
  try {
    if (on && !lock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!on && lock) { await lock.release(); lock = null; }
  } catch (e) { lock = null; }
}

// ---------------------------------------------------------------- PWA
export const isStandalone = () =>
  matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let deferredPrompt = null;
const installListeners = [];
export function onInstallAvailable(fn) { installListeners.push(fn); if (canInstall()) fn(); }
export function canInstall() { return !isStandalone() && (!!deferredPrompt || isIOS()); }

export function registerPWA() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    installListeners.forEach(fn => fn());
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; installListeners.forEach(fn => fn()); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('service worker failed', e));
  }
}

// Returns 'prompted' | 'ios' | 'none'
export async function promptInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (e) {}
    deferredPrompt = null;
    installListeners.forEach(fn => fn());
    return 'prompted';
  }
  return isIOS() && !isStandalone() ? 'ios' : 'none';
}
