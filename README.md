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
- Pick a **stance** (Helm panel, keys 1–4) and the helm flies it:
  **Engage** (default) orbits inside phaser range and reverses on its own
  when the other side has more guns or a fresher shield, **Skirmish** orbits
  tight on the afterburner so their guns cannot track you, **Standoff**
  holds torpedo range and kites, **Disengage** runs. Ranges come from the
  weapons you fitted. **Stop** puts the helm on manual.
- Or run a **play** (keys 5–0): a whole strategy in phases. **Alpha
  strike** closes with weapons cold, dumps everything with the governor off
  and breaks off to cool; **Siege** fires tubes only from range; **Turtle**
  holds a broadside with hardener and reinforce; **Hunter** goes for
  reactors, then bare hull; **Ambush** cloaks in, strikes and slips away
  cloaked (needs a cloaking device); **Hit & fade** engages until a shield
  runs low and goes to full burn until it recovers. The Helm row shows the
  phase; any stance or Stop cancels the play.
- The camera keeps both ships in view; wheel or +/− zooms on top of that.
  A Constitution measures about 1 km on the game's scale (three times its
  real size, so you can see the blocks).
- Switch on systems in the bar at the bottom of the display (click or
  F1–F8): F1 fires every phaser emitter that can bear, F2 every torpedo
  tube, then shield booster, shield hardener, afterburner. Every cycle costs **capacitor**: the dashed outer ring of the
  round gauge next to the module bar. The middle ring shows your four shield
  facings (top = front), the centre your hull. If the capacitor runs dry,
  modules shut down. Keep weapons and hardener on; pulse the booster and
  afterburner.
- Phasers hit best inside 8 km and against slow targets; orbiting fast and
  close makes enemy beams miss you (and yours miss them). Torpedoes always
  home in but do less damage to small fast ships.
- Each shield emitter projects a bubble five cells wide; the rings around a
  ship are that cover, coloured by the facing they feed. Hull outside every
  bubble takes hits unshielded: the **EXP** chip aims at the enemy's bare
  hull, the hangar paints yours red. **Reinforce** (top bar) when one
  facing collapses.
- Ships are made of blocks. Shots land anywhere on the side facing the
  attacker and hit the outer blocks first; a beam stops in the first armor
  plate it meets but digs two blocks deep through exposed systems;
  torpedoes blast the entry block and its neighbours. Blocks cut off from
  the bridge break away as a drifting section. Hover the locked enemy to
  see its blocks; click one to aim at that block type (−15% accuracy; the
  shot still has to get through whatever armor is in front). Click your own
  block rows to set repair priority.
- **Reactors explode** when destroyed and take their neighbours with them;
  reactors that touch chain. Aim at the enemy's reactors; keep your own
  apart and armored.
- **Power**: every system draws power from the hull's grid plus 15 per
  reactor; the editor shows "Power 118 / 140" and refuses a build that
  draws more. Lose reactors in battle and your weapons and shields slow
  down. **Heat**: every shot heats the ship (thin outer ring of the
  gauge and the HEAT bar under the module bar, with a marker for the next
  salvo); at the cap weapons stop, and a salvo that crosses it overloads
  everything for six seconds. The **GOV** heat governor (key H, on by
  default) holds fire at 85% heat; switch it off for a big alpha strike.
- **Electronic warfare**: an **ECM jammer** block (F6) rolls against the
  enemy's sensors every five seconds and breaks their lock; a **cloaking
  device** (F7, one per ship, 400 cr) makes you unlockable and unseen
  beyond ten kilometres, at the price of shields, weapons and capacitor.
  Klingon Shadows do the same to you: when Tactical says they cloaked,
  watch for the ghost inside ten kilometres and keep your strong shield
  toward it.
- A ship with no weapons and no engines left is **disabled** and the battle
  ends. Disabling the enemy instead of destroying it pays 25% of its
  remaining block value as **salvage** (10% for a wreck).
- Enemies: Bird-of-Prey raiders in several layouts (and random variants
  from the third battle), then the heavier K't'inga battlecruiser from the
  fifth battle onward. Every win makes them 4% stronger; bigger enemies pay
  more credits.
- Each enemy fights its own way, and the Overview status column tells you
  which: a **strafing** raider runs in, makes a close firing pass and breaks
  off to come around again; a **brawler** orbits close and reverses
  direction; a **standoff** torpedo boat sits at 14 km and runs when you
  close (Engage chases it); the **broadside** cruiser turns slowly to keep
  a fresh shield toward you. Your helm answers with the stance you pick.
- Weapons only fire where your own hull does not block them, so a saucer
  fights with the guns on the side facing the enemy; the helm reverses the
  orbit when the other side has more to bring to bear. Paint weapons on
  the rim; a weapon buried inside the hull shows a red cross in the editor
  and never fires.
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
  least one weapon and one engine. Warnings (you can still undock): a
  weapon the hull masks completely is marked with a red cross and does not
  count toward dps (hover a weapon to see its clear arc); reactors touching
  each other or the bridge will chain when one is breached.
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
| `blocks.*` | Every block: hp, mass, cost, colour, glyph, weapon stats (damage, cycle, cap, optimal / falloff / tracking, arc), effects |
| `grid.lineOfFire / lineOfFireMuzzle / lineOfFireRangeCells` | Whether and how the own hull masks weapons |
| `grid.shieldBase / shieldAdd / regenBase / regenAdd / shieldRadius` | Shield facings from emitters; bubble radius in cells |
| `helm` | Stances (doctrine, ranges from fitted weapons, keys), auto-flip interval and shield thresholds, plays (phases, module policies, exit conditions) |
| `balance.zoom` | Auto-fit camera limits and margin, manual zoom bias range |
| `grid.capBase / capAdd / capRechargeTime` | Capacitor from reactors |
| `grid.thrustPerPoint / nacelleThrustMult / speedMultMin / speedMultMax` | Speed from engines and mass |
| `grid.hitScatter / penetration / torpedoSplash / aimRadius / aimScatter / deadFraction / structureHp` | Where shots land, how damage travels through the hull, when a ship is lost |
| `blocks.*.pierceCost`, `grid.structurePierceCost` | How much of a beam's penetration each block type eats (armor 2, structure 3) |
| `blocks.reactor.explosion`, `grid.lineOfFire` | Reactor breach damage and radius; whether the own hull masks weapons |
| `blocks.*.power`, `shipClasses.*.powerBase`, `grid.powerPerReactor / brownoutMin` | Power grid: what each system draws, what a hull and its reactors supply, how a brownout bites |
| `grid.heat`, `blocks.*.weapon.heat` | Heat capacity and dissipation, overload time, heat per shot |
| `ew.*`, `science.cloakDetectRangeKm` | Jam strength and duration, cloak timings and drain, detection range |
| `campaign.salvage` | Share of the enemy's surviving block value paid after a win (destroyed / disabled) |
| `grid.variant` | How much a random enemy variant differs from its base layout |
| `shipClasses.*.mask / layout / variants` | Hull shapes, default builds, enemy layouts |
| `modules.*` (booster, hardener, afterburner) | Built-in active systems |
| `shipClasses.*.presets` | Preset builds offered in the editor |
| `editor.refund / maxSavedBuilds` | Refund on removed blocks, saved builds per hull |
| `campaign.encounters / enemyScaling / klingonNames` | Which enemy shows up when, how it scales, what it pays |
| `campaign.*`, `skills.*` | Economy, training |
| `balance.capCurve / lockBase / zoom` | Capacitor curve, lock time, zoom |
| `enemyAI.doctrines` | How each doctrine flies (enemy encounters and player stances): strafe pass range and timing, brawl orbit and flip timer, standoff hold and kite ranges, broadside band and roll timer, evade range |
| `enemyAI.default / ktinga` | Enemy accuracy, damage and stat multipliers, retreat thresholds, aim weights (`none` = spray) |
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
