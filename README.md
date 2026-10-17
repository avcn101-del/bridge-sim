# Bridge Sim

A private, single-player Star Trek style **ship building and combat game**.
You build a starship block by block on a Trek-shaped hull, then fight it
EVE Online style: lock a target, tell the helm how to fly relative to it,
and run your weapons and systems on a capacitor budget. Your officers
report what happens.

Plain HTML/CSS/JavaScript. No install, no build, no server.

## Run it

1. Download the repository as ZIP (GitHub → Code → Download ZIP) or clone it.
2. Unzip.
3. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).

That's it. Works offline (the sci-fi font loads from Google Fonts when
online and falls back to a system font otherwise).

## How to play

Control is EVE Online style. You never steer directly: you pick a target and
tell the helm how to fly relative to it, and you switch modules on and off.

- Click **Enter the hangar**. Build your ship in the editor, apply the build,
  then click **Undock** to fight.
  (The block editor arrives in the next version; this version uses the
  class layout.)
- **Click the Klingon ship** on the display (or double-click its row in the
  Overview). That selects it and starts a lock; "Target locked" appears in
  the log after about 3 s.
- Give the helm a command: **Orbit 6 km** is a good default. **Keep at
  range** holds a distance, **Approach** closes, **Come about** holds your
  strongest shield toward the enemy at low speed.
- Switch on systems in the bar at the bottom of the display (click or
  F1–F5): F1 fires every phaser emitter that can bear, F2 every torpedo
  tube, then shield booster, shield hardener, afterburner. Every cycle costs **capacitor**: the dashed outer ring of the
  round gauge next to the module bar. The middle ring shows your four shield
  facings (top = front), the centre your hull. If the capacitor runs dry,
  modules shut down. Keep weapons and hardener on; pulse the booster and
  afterburner.
- Phasers hit best inside 8 km and against slow targets; orbiting fast and
  close makes enemy beams miss you (and yours miss them). Torpedoes always
  home in but do less damage to small fast ships.
- Damage hits the shield facing toward the enemy. **Reinforce** (top bar)
  or **Come about** when one facing collapses.
- Ships are made of blocks. Shots hit the outer blocks on the attacker's
  side first; beams dig two blocks deep, torpedoes blast the entry block and
  its neighbours. Blocks cut off from the bridge break away. Hover the
  locked enemy to see its blocks; click one to aim at that block type (−15%
  accuracy). Click your own block rows to set repair priority.
- **Space** pauses; commands still work while paused. Mouse wheel zooms.
  The **?** button lists all controls.
- Destroy the enemy to win. The result screen shows the credits you earned;
  **Return to hangar** to spend them.

## Hangar, build, skills, saving

- **Build**: pick a block type in the palette and click or drag on the hull
  to paint it; right-click erases. Faint cells are the hull you can fill,
  blue-tinted cells are nacelles (engines there count double), hatched grey
  cells are fixed structure. **Mirror** paints both sides at once. **Fill
  armor** fills every empty cell, **Clear** keeps only the bridge. Load a
  preset (class default, Brawler, Sniper) or one of your saved builds.
  The statistics update as you paint: block count, mass and value, damage
  per second, capacitor stability, shields per facing, speed from thrust
  over mass. Rules: exactly one bridge, every block connected to it, at
  least one weapon and one engine.
- **Paying for it**: **Apply build** charges the price of the blocks you
  added and refunds 60% for the ones you removed; the delta is shown before
  you pay. You cannot undock with unapplied changes. **Save build** keeps up
  to three named builds per hull.
- **Shipyard**: buy and board ships; each keeps its own layout.
- **Credits**: a win pays 500 minus 3 per percent of block hp lost, plus a
  streak bonus; a loss pays 120. The raider gets 6% stronger with every win.
- **Skills**: train one at a time; they take real time (30 minutes for level
  1, up to 40 hours for level 5) and keep training while the game is closed.
- **Saving**: automatic in this browser. **Export save** downloads a JSON
  file; **Import save** loads one. **Reset progress** starts over.

## Tweaking balance

All numbers live in `js/data.js`. Edit with any text editor and reload.

| Where | What it changes |
|---|---|
| `units.pxPerKm`, `grid.cellPx` | World scale and cell size |
| `blocks.*` | Every block: hp, mass, cost, colour, weapon stats (damage, cycle, cap, optimal / falloff / tracking, arc), effects |
| `grid.shieldBase / shieldAdd / regenBase / regenAdd` | Shield facings from emitters |
| `grid.capBase / capAdd / capRechargeTime` | Capacitor from reactors |
| `grid.thrustPerPoint / nacelleThrustMult / speedMultMin / speedMultMax` | Speed from engines and mass |
| `grid.penetration / torpedoSplash / aimRadius / deadFraction / structureHp` | How damage travels through the hull and when a ship is lost |
| `shipClasses.*.mask / layout` | Hull shapes and default builds |
| `modules.*` (booster, hardener, afterburner) | Built-in active systems |
| `shipClasses.*.presets` | Preset builds offered in the editor |
| `editor.refund / maxSavedBuilds` | Refund on removed blocks, saved builds per hull |
| `campaign.*`, `skills.*` | Economy, difficulty progression, training |
| `balance.capCurve / lockBase / orbitRangesKm / keepRangesKm / zoom` | Capacitor curve, lock time, range buttons, zoom |
| `enemyAI.default` | Enemy accuracy, damage and stat multipliers, orbit range, thresholds, aim weights |
| `crew.reports`, `crew.events`, `blockReports` | All officer dialogue |

Later features (campaign, shipyard upgrades, more ship classes, crew XP) have
their data shapes defined in the same file. See `DESIGN.md`.

## Project files

```
index.html      entry point
css/            LCARS interface styles
js/             data, grid, game loop, ships, modules, weapons, crew, enemy AI, campaign, hangar, UI, renderer, effects
assets/         optional sprites / sounds (empty in MVP)
DESIGN.md       full game design and data structures
CHANGELOG.md    version history
CLAUDE.md       rules for AI-assisted development sessions
```
