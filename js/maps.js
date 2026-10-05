// The towers you can climb. Classic is the endless Icy Tower run through all
// seven worlds; the other four are single-world towers with a summit at floor
// 200 and their own twist. Mechanics live in game.js, art in world.js.
//
// mech: chance (0..1) a regular floor gets that special platform kind, plus
// map-wide physics tweaks. Floors below 4 and full-width floors stay normal.

export const SUMMIT = 200;

export const MAPS = [
  { id: 'classic', name: 'Capy Tower', tag: 'THE ORIGINAL', themes: [0, 1, 2, 3, 4, 5, 6], span: 50,
    summit: null, track: 0, color: '#ffb43d',
    twist: 'Seven worlds and no top. How high can you go?', mech: {} },
  { id: 'onsen', name: 'Sakura Springs', tag: 'STEAM GEYSERS', themes: [7], span: 50,
    summit: SUMMIT, track: 1, color: '#ff8fb8',
    twist: 'Stand on a vent when it blows and the steam shoots you up.', mech: { geyser: 0.22 } },
  { id: 'reef', name: 'Coral Reef Spire', tag: 'UNDERWATER', themes: [8], span: 50,
    summit: SUMMIT, track: 2, color: '#5fd6e8',
    twist: 'Floaty underwater jumps, and jellyfish you can bounce on.', mech: { grav: 0.6, jelly: 0.2 } },
  { id: 'sky', name: 'Cloud Carnival', tag: 'WIND + CLOUDS', themes: [9], span: 50,
    summit: SUMMIT, track: 4, color: '#9fd0ff',
    twist: 'Clouds drift under your feet and gusts push you sideways.', mech: { cloud: 0.3, wind: true } },
  { id: 'toys', name: 'Clockwork Toybox', tag: 'BELTS + SPRINGS', themes: [10], span: 50,
    summit: SUMMIT, track: 3, color: '#ffd166',
    twist: 'Ride the conveyor belts and boing off the springs.', mech: { conveyor: 0.22, spring: 0.14 } },
];

export const mapById = id => MAPS.find(m => m.id === id) || MAPS[0];
