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
  - `js/grid.js` — hull grids: masks, block layouts, derived stats, entry/penetration/splash hit lookup, per-block damage, connectivity, layout validation
  - `js/modules.js` — weapon groups built from blocks plus the built-in active systems (booster, hardener, afterburner); capacitor use
  - `js/ships.js` — ship model: block grid, hull from blocks, shield facings from emitters, capacitor, lock, movement commands
  - `js/weapons.js` — turret blocks (tracking/falloff) and launcher blocks (signature/velocity), hit resolution, decoys
  - `js/boarding.js` — boarding parties: transporter window, party vs defenders, capture
  - `js/crew.js` — crew voices: instant commands with reports, warnings
  - `js/enemyai.js` — doctrine machine for both ships (enemy doctrines, player stances, auto-flip)
  - `js/plays.js` — plays: scripted phase sequences (stance/doctrine, module policy, governor, aim, exit conditions) from `helm.plays`
  - `js/script.js` — bridge scripts: ordered when → do rules with policies and call-outs, run by both bridges; sentences from `script.conditions/actions`
  - `js/campaign.js` — progress between battles: save/load/export/import, credits, ownership, fitting rules, fit stats, real-time skills, enemy scaling
  - `js/hangar.js` — hangar screen DOM: ship, fitting, market, skills, save buttons
  - `js/ui.js` — DOM panels, order buttons, comms log, alert states
  - `js/renderer.js` — canvas drawing (space, ships, weapons, shields)
  - `js/effects.js` — particles, explosions, sparks, screen shake
  - `js/main.js` — bootstrap
- **Modular renderer.** Ship drawing goes through `BS.Renderer.drawShip(ctx,
  ship)` which delegates to a drawer looked up by `ship.visual.kind`
  (`"vector"` or `"sprite"`). Game logic never touches the canvas. Swapping
  vector silhouettes for image sprites in `assets/` must not require changes
  outside `renderer.js` and `data.js`.
- **The script has the conn.** Since 0.21 the contest is decided before
  the fight: build, intel, plan and a bridge script (`BS.Script`, when → do
  rules written in the hangar). In battle both bridges run their scripts;
  the player watches and has `script.bridgeCall.tokens` (2) **bridge
  calls** (`BS.Game.bridgeCall`: play, side, disengage, reinforce, focus
  block), overrides that stand for a while and hand back. The hand-flown
  controls (`BS.Game.command(id, args)` → `BS.Crew.command`: stance, play,
  side, aim, modules, keys) still exist behind `settings.manualBridge` for
  debugging and the harness; a manual order pauses the script. Movement is
  always the helm's: a stance or doctrine is flown by `BS.EnemyAI` with the
  same doctrine machine and the same `BS.Ships.setCommand` /
  `BS.Modules.setActive` the enemy uses.
- **Ships are block grids.** A class gives a hull `mask` (`.` empty, `#`
  fillable, `n` nacelle, `p` fixed structure) and a default `layout`
  (letters from `grid.layoutLegend`). `BS.Grid.build` turns them into
  blocks; `BS.Grid.derive` sums stats (hull hp, shield facings from emitter
  positions, capacitor from reactors, thrust/mass → speed, sensors, repair).
  Damage enters at the outermost block on the attacker's side: beams
  penetrate `grid.penetration` blocks, torpedoes splash into neighbours.
  Blocks cut off from the bridge break away. Never hard-code block effects
  outside `grid.js`; every number is in `BS.Data.grid` and `BS.Data.blocks`.
- **Interface shows km and km/s**; the world is pixels (`units.pxPerKm`,
  150; `grid.cellPx` 6, so a Constitution is 156 px ≈ 1 km long, three
  times its real size so blocks stay readable). The camera auto-fits both
  ships; manual zoom is a bias on top. Keep
  `visual.length/width` equal to the grid size because shields, hit radius
  and effects use them.
- **Progress lives in `BS.Campaign`** (localStorage key `bridgesim.save`,
  shape in `BS.Data.saveDefaults`). Battle code never reads localStorage;
  `BS.Game.startBattle` asks Campaign for the layout, skill mods and enemy
  scaling, and `settleBattle` awards credits. A layout that fails
  `BS.Grid.validateLayout` never undocks; the class default is used.
- **Events, not direct calls, for presentation.** Game logic emits events
  (`BS.Events.emit("shieldHit", {...})`); renderer/effects/UI/audio subscribe.
  This is how sound will be added later without touching logic.
- Save-game structures (campaign, upgrades, crew XP) are defined in
  `DESIGN.md` and `data.js` even before the features exist. Do not invent
  parallel structures.

## Visual quality (priority)

- Polished visuals are a priority, not an afterthought. Block ships are
  drawn as plated hulls with a smooth outline, shading, glowing engines and
  systems, and running lights, never as bare coloured squares (the hangar
  preview may show the cells). Weapons glow, shields ripple, hits spark,
  destroyed blocks tumble off as debris.
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
  `BS.Modules.setActive`. Targets: a straightforward fight (weapons and
  hardener, orbit 6 km) wins in 3–5 min losing 30–50% of block hp; a
  speed-tanking captain (booster pulsed, afterburner) wins slower but
  nearly untouched; a ship with no orders is lost in about 3 min.
- Keep `README.md` "tweakable values" section in sync with `data.js`.
- Commit messages: short imperative subject, body explains why.
- Do not add build tooling, package.json, linters or test frameworks unless
  the user asks.
