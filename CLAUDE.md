# CLAUDE.md — Project rules for Bridge Sim

Private single-player Star Trek style bridge combat simulator. The player is the
captain: they give orders by clicking buttons, AI crew officers execute them.

These rules apply to every session working in this repository.

## Tech constraints (hard rules)

- Plain HTML, CSS and JavaScript only. No frameworks, no TypeScript, no npm,
  no bundler, no build step.
- The game must run by opening `index.html` directly from disk (`file://`).
  Therefore: no ES modules with `import`/`export` (they fail on `file://` in
  Chrome). Use classic `<script>` tags in `index.html` and one global
  namespace object `window.BS` (`BS.Data`, `BS.Ships`, `BS.Renderer`, ...).
- No external dependencies except Google Fonts (with system font fallback so
  the game still works offline).
- Target 60 fps: `requestAnimationFrame` loop with fixed-timestep simulation
  and interpolated rendering.

## Architecture rules

- **Data-driven stats.** Every number that affects balance (hull, shields,
  weapon damage, cooldowns, speeds, power presets, AI thresholds, crew delays)
  lives in `js/data.js`. Game logic must read from data, never hard-code.
- **Modular code.** One responsibility per file:
  - `js/data.js` — all tunable stats, ship classes, weapons, upgrades, enemies
  - `js/util.js` — math helpers (angles, lerp, seeded random, templates)
  - `js/events.js` — publish/subscribe bus
  - `js/game.js` — game loop, state, pause, win/lose
  - `js/modules.js` — fitted modules: passive bonuses, active cycling, capacitor use
  - `js/ships.js` — ship model: hull, shields, subsystems, capacitor, lock, movement commands
  - `js/weapons.js` — turrets (tracking/falloff) and launchers (signature/velocity), hit resolution
  - `js/crew.js` — crew voices: instant commands with reports, warnings
  - `js/enemyai.js` — enemy behaviour
  - `js/ui.js` — DOM panels, order buttons, comms log, alert states
  - `js/renderer.js` — canvas drawing (space, ships, weapons, shields)
  - `js/effects.js` — particles, explosions, sparks, screen shake
  - `js/main.js` — bootstrap
- **Modular renderer.** Ship drawing goes through `BS.Renderer.drawShip(ctx,
  ship)` which delegates to a drawer looked up by `ship.visual.kind`
  (`"vector"` or `"sprite"`). Game logic never touches the canvas. Swapping
  vector silhouettes for image sprites in `assets/` must not require changes
  outside `renderer.js` and `data.js`.
- **Controls are EVE-style commands.** The player never steers directly:
  `BS.Game.command(id, args)` → `BS.Crew.command` executes instantly on the
  player ship (select, lock, approach, orbit, keep, flyTo, comeAbout, module,
  targetSubsystem, repair, reinforce, redAlert, hail) and the officer reports.
  The enemy AI uses the same `BS.Ships.setCommand` / `BS.Modules.setActive`.
- **Interface shows km and km/s**; the world is pixels (`units.pxPerKm`).
- **Events, not direct calls, for presentation.** Game logic emits events
  (`BS.Events.emit("shieldHit", {...})`); renderer/effects/UI/audio subscribe.
  This is how sound will be added later without touching logic.
- Save-game structures (campaign, upgrades, crew XP) are defined in
  `DESIGN.md` and `data.js` even before the features exist. Do not invent
  parallel structures.

## Visual quality (priority)

- Polished visuals are a priority, not an afterthought. Ships are detailed
  vector silhouettes with gradients, hull lines, glowing nacelles and running
  lights, never plain rectangles. Weapons glow, shields ripple, hits spark.
- UI is LCARS style: rounded colored bars, orange/purple/blue palette, clean
  sci-fi font (Google Fonts "Antonio", fallback "Arial Narrow", sans-serif).
  Red alert changes the whole interface lighting (CSS class on `<body>`).

## Workflow rules

- When a feature changes, update `DESIGN.md` (mechanics/screens/data) and
  `CHANGELOG.md` (version entry) in the same commit.
- Before finishing any task: open `index.html` in a headless browser (the
  cloud environment has Chromium + Playwright, `NODE_PATH=/opt/node-tools/node_modules`)
  or a real one, play for at least 30 simulated seconds, and confirm **zero
  console errors** (a blocked Google Fonts request in the sandbox is not a
  game error). Report the result honestly.
- Balance changes must be checked with an accelerated simulation: start a
  battle, set `BS.Game.state.paused = true`, then call `BS.Game.step(1/60)`
  in a loop with a scripted captain that uses `BS.Game.command` and
  `BS.Modules.setActive`. Targets: attentive captain wins in 3–5 min with
  60–80% hull, running everything at once should drain the capacitor, a
  stationary ship and a ship with no orders lose in about 2 min.
- Keep `README.md` "tweakable values" section in sync with `data.js`.
- Commit messages: short imperative subject, body explains why.
- Do not add build tooling, package.json, linters or test frameworks unless
  the user asks.
