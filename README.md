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
  then click **Undock** to fight. The hangar header says which enemy is
  waiting ("Next: …").
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
- Ships are made of blocks. Shots land anywhere on the side facing the
  attacker and hit the outer blocks first; beams dig two blocks deep,
  torpedoes blast the entry block and its neighbours. Blocks cut off from
  the bridge break away as a drifting section. Hover the locked enemy to
  see its blocks; click one to aim at that block type (−15% accuracy; the
  shot still has to get through whatever armor is in front). Click your own
  block rows to set repair priority.
- Enemies: Bird-of-Prey raiders in several layouts (and random variants
  from the third battle), then the heavier K't'inga battlecruiser from the
  fifth battle onward. Every win makes them 4% stronger; bigger enemies pay
  more credits.
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
- **Shipyard**: buy and board ships; each keeps its own layout and comes
  with a default build. Miranda (fast light cruiser, 800 cr), Defiant
  (escort: orbit close with the afterburner, 2 400 cr), Excelsior (3 200 cr),
  Galaxy (5 600 cr) and Sovereign (8 000 cr) besides the free Constitution.
  Bigger hulls hold more blocks but are slower and easier to hit.
- **Credits**: a win pays 500 (× up to 1.9 for a bigger enemy) minus 3 per
  percent of block hp lost, plus a streak bonus; a loss pays 120. Enemies
  get 4% stronger with every win, up to +40%.
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
| `grid.hitScatter / penetration / torpedoSplash / aimRadius / aimScatter / deadFraction / structureHp` | Where shots land, how damage travels through the hull, when a ship is lost |
| `grid.variant` | How much a random enemy variant differs from its base layout |
| `shipClasses.*.mask / layout / variants` | Hull shapes, default builds, enemy layouts |
| `modules.*` (booster, hardener, afterburner) | Built-in active systems |
| `shipClasses.*.presets` | Preset builds offered in the editor |
| `editor.refund / maxSavedBuilds` | Refund on removed blocks, saved builds per hull |
| `campaign.encounters / enemyScaling / klingonNames` | Which enemy shows up when, how it scales, what it pays |
| `campaign.*`, `skills.*` | Economy, training |
| `balance.capCurve / lockBase / orbitRangesKm / keepRangesKm / zoom` | Capacitor curve, lock time, range buttons, zoom |
| `enemyAI.default / ktinga` | Enemy accuracy, damage and stat multipliers, orbit range, thresholds, aim weights (`none` = spray) |
| `visuals.fragments` | Section break-off and ship shatter: piece count, speed, spin, lifetime |
| `crew.reports`, `crew.events`, `blockReports` | All officer dialogue |

Later features (audio, sector map, science scans, sprites) have their data
shapes defined in the same file where they exist. See `DESIGN.md`.

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
