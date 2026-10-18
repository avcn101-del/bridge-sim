# DESIGN.md — Bridge Sim

Version: 0.7.0 (power grid, heat, electronic warfare). Keep this file in sync with the game.

## 1. Concept

Building the ship is the heart of the game. A starship is a grid of blocks
inside a Trek-shaped hull mask; every block adds hull, a weapon, shields,
capacitor, thrust, sensors or repair, and where it sits decides what it
protects and where it can fire. Combat is EVE Online style: select a
target, lock it, give the helm a relative movement command (approach, orbit
at a range, keep at range), and run weapon groups and built-in systems on
a capacitor budget. Four Trek shield facings decide where damage lands;
after that, damage lands on blocks. Officers report and warn.

Decided parameters:

| Topic | Decision |
|---|---|
| Control | EVE-style commands relative to the target; no direct steering keys |
| Units | km and km/s in the interface (`units.pxPerKm` = 50); ships drawn at about half size so orbits read correctly |
| Shields | Four facings kept (fore / starboard / aft / port) |
| Enemies | One ship per battle, picked from `campaign.encounters` by battles won: Bird-of-Prey layouts and random variants, then the K't'inga battlecruiser; small groups later |
| Crew | Voices and warnings only; orders execute instantly |
| Battle length | 3–5 minutes for an attentive captain |
| Sound | None yet; events exist for an audio module |
| Camera | Follows the player ship; mouse-wheel zoom 0.5–1.6× |

## 2. Gameplay loop

1. **Start screen** → Enter the hangar.
2. **Hangar** (Starbase 11): see your ship and its fit, buy modules and
   ships with credits, fit modules into high/mid/low slots within power grid
   and CPU, read the fit statistics (dps, capacitor stability, defence,
   mobility), train one skill at a time in real time, export/import the save,
   then **Undock**.
3. **Battle**: the Klingon closes from 38 km. Click it to select and
   lock (3 s lock). Give an orbit or keep-at-range. Switch on phasers,
   torpedoes, hardener; pulse the shield booster and afterburner as the
   capacitor allows. Aim at a part once its facing shield is down.
4. **Result screen**: Victory/Defeat, time, damage, hit counts, credits
   earned, Return to hangar. Enemies get 4% stronger per victory (up to
   +40%) and tougher encounters unlock with wins, so credits must go into
   better builds, bigger hulls and skills.

Decision pressure: capacitor budget (what runs now), range band (optimal vs
falloff, torpedo reach), angular velocity (orbit close and fast to dodge
beams, but your own beams miss too), shield facing management, part targeting.

## 3. Screens and layout

```
+-------------+--------------------------------+----------------+
| SHIP        | TACTICAL DISPLAY               | TACTICAL       |
| speed/helm  | top-down, zoomable, km rings   | Overview table |
| subsystems  | lock brackets, orbit ring,     | Selected item: |
| target info | velocity vectors, hardpoints   |  lock/approach |
|             |                                |  orbit N km    |
|             | (gauge) [F1][F2][F3][F4][F5]   |  keep N km     |
|             |  hull/shields/cap  module bar  |  come about    |
+-------------+--------------------------------+----------------+
| COMMS log (newest on top)                                      |
+----------------------------------------------------------------+
```

The ship gauge sits on the display next to the module bar, EVE style: hull
percentage in the centre, the four shield facings as arcs on the middle
ring (top = fore, right = starboard), capacitor as the dashed outer ring.
Top bar: ship name, clock, alert state, **Reinforce**, **Hail**, **Red
alert** (also set automatically the first time a weapon module is switched
on), **?** help overlay, zoom, pause.

### Input

- Click enemy: select and start lock. Click a part of a locked enemy: aim
  at that part (again: hull). Hover shows part health and "SHIELDED n%".
- Right-click enemy: orbit at its preferred range. Right-click / double-click
  empty space: fly there. Wheel: zoom.
- Keys: F1–F8 toggle modules (F6 jammer, F7 cloak when fitted), L lock,
  A approach, O orbit 6 km, V reverse orbit, K keep 10 km, C come about,
  S stop, R red alert, H heat governor, Space pause.
- **Reverse** (orbit row, V) flips the orbit direction so the other side of
  the ship faces the enemy: with line of fire, a saucer fights with the
  guns on the engaged side, and once they are gone you turn the other
  cheek.
- Overview rows: click selects, double-click locks.
- Left panel: click a subsystem row to make it repair priority (again: auto).
  Enemy part chips in the Target block set the aim.

## 4. Mechanics

### Movement commands (`ship.cmd`)
- `approach(target)`, `orbit(target, range)` (with `flipOrbit` to reverse
  direction), `keep(target, range)`, `flyTo(point)`, `comeAbout(target)`
  (hold strongest facing toward target at 25% speed), `idle`. Ships turn at `turnRate` and accelerate toward max
  speed; the same code drives the enemy.

### Lock
- `lockTime = lockBase × (lockRefSignature / targetSignature) ×
  (lockRefSensor / sensorStrength) × sensorsDamageMult × boosterMult`.
  Constitution locks the Bird-of-Prey in about 3 s. Lock drops beyond
  `lockRangeKm × 1.1`. Weapons need a lock.

### Capacitor
- Recharge per second = `capMax / rechargeTime × capCurve × (√f − f)` where
  f is the fraction full (EVE curve, fastest around 25%). Every active module
  spends `cap` at the start of each cycle; if there is not enough, the module
  shuts off and Engineering says so. Torpedo tubes get first call on the
  capacitor each step (a volley is cheap per second), then phasers, then the
  active systems.

### Hull grid and blocks (`BS.Data.grid`, `BS.Data.blocks`, `shipClasses.*.mask / layout`)
- A hull mask is rows of `.` (space), `#` (fillable), `n` (nacelle cell:
  engines count double), `p` (fixed structure, 700 hp, not editable: necks
  and pylons are tough, so losing a whole section is a rare disaster).
  Cells are 6 px; the grid centre is the ship centre; x is forward, y is
  starboard. Every mask is symmetric about its long axis (Mirror in the editor).

  | Class | Grid | Fillable cells | Cost | Base speed / turn / signature | Default build |
  |---|---|---|---|---|---|
  | Constitution | 26×16 | 200 | free | 95 / 90 / 400 | 8 phasers, 2 tubes, 6 reactors, 20 engines |
  | Miranda | 22×14 | 184 | 800 | 100 / 100 / 340 | 8 phasers, 2 tubes, 6 reactors, 24 engines (fast) |
  | Defiant | 18×12 | 126 | 2 400 | 130 / 140 / 220 | 8 phasers, 2 tubes, 6 reactors, 12 engines (speed tank) |
  | Excelsior | 30×18 | 262 | 3 200 | 95 / 80 / 450 | 8 phasers, 4 tubes, 6 reactors, 24 engines |
  | Galaxy | 36×20 | 406 | 5 600 | 85 / 60 / 600 | 10 phasers, 2 tubes, 8 reactors, 32 engines |
  | Sovereign | 38×18 | 310 | 8 000 | 100 / 75 / 520 | 14 phasers, 4 tubes, 7 reactors, 32 engines |
  | B'rel Bird-of-Prey (enemy) | 24×22 | 140 | — | 105 / 110 / 250 | Raider 8P 1T; Gunboat 11P; Torpedo boat 4P 3T |
  | K't'inga (enemy) | 32×20 | 210 | — | 85 / 70 / 480 | Battlecruiser 8P 2T; Siege 4P 4T 8R |

  Each Starfleet class has one preset besides the class default (Constitution
  has two). A ship's price includes its default build. Every default keeps
  its weapons on the rim with a clear line of fire and its reactors at least
  one cell apart from each other and from the bridge (see below).
- Block types (hp / mass / cost / power draw): armor 60/2/20/0, phaser
  emitter 50/2/120/5, torpedo tube 50/3/180/8, shield emitter 40/2/90/4,
  reactor 40/3/100/0 (+15 power), impulse engine 45/2/80/1, sensor array
  35/1/110/3, bridge 200/2/0 (exactly one), crew quarters 35/1/40/1, ECM
  jammer 35/2/110/6, cloaking device 40/3/400/12 (one per ship). Jammed
  ships cannot lock for 4 s. System
  blocks survive one enemy beam hit, so damage control can save them.
- **Power grid** (`shipClasses.*.powerBase`, `grid.powerPerReactor`): a
  hull supplies its base (Constitution 50, Miranda 30, Defiant 30,
  Excelsior 55, Galaxy 80, Sovereign 90, B'rel 35, K't'inga 50) plus 15 per
  reactor; every system draws its `power`. A build that draws more than it
  has cannot undock. In battle, losing reactors browns the ship out:
  weapons cycle and shields regenerate at supply / draw (never below 40%).
  This is the only cap on weapons: more guns need more reactors, and
  reactors explode.
- **Heat** (`grid.heat`, `weapon.heat`): every shot adds its weapon's heat
  (phaser 6, torpedo 30). Capacity = 80 + 2 per block, dissipation = 6/s
  + 0.25 per rim cell (hull surface). A weapon cannot fire at capacity; the
  shot that crosses it **overloads** the ship for 6 s: nothing fires or
  cycles. A Constitution (cap 480) can alpha-strike 16 tubes, not 100. The
  gauge shows heat as the thin outer ring, and the **heat bar** under the
  module bar shows heat / capacity with a marker for what the next full
  salvo would add (green, amber above 60%, red above 85%). The **heat
  governor** (GOV button, key H, on by default; `heat.governorHigh/Low`)
  holds fire above 85% heat and releases it below 60%, so the player ship
  never overloads unless the governor is switched off. The editor shows
  the full-salvo heat and whether sustained fire is heat-neutral. The AI
  stops firing at 85% heat.
- **Reactor breach** (`blocks.reactor.explosion`, after Cosmoteer): a
  destroyed reactor deals 80 damage to each of its eight neighbours; a
  reactor among them explodes in turn, so touching reactors chain. Armor
  (60) and most systems die, the bridge (200) survives one. The editor
  warns when reactors touch each other or the bridge.
- **Line of fire** (`grid.lineOfFire`): a weapon cannot fire through the
  ship's own alive blocks near it. The muzzle protrudes
  `lineOfFireMuzzle` (1) cell and only hull within `lineOfFireRangeCells`
  (3) cells can mask a direction, so a bow phaser still fires past the
  saucer rim. The clear directions around a weapon are sampled every 10°;
  the weapon's arc is centred on their mean (`b.facing`) and `b.coverage`
  is the clear fraction of that arc. A weapon with nothing clear is masked:
  red cross in the editor, counted in the warnings, left out of dps;
  hovering a weapon shows its clear arc as a wedge. Buried weapons are
  useless, the rim is where weapons compete with armor and shield emitters,
  and a ship fights with the guns on the side facing the enemy.
- Derived stats: hull hp = Σ block hp; shield per facing = 80 + 70 per
  emitter whose outward angle falls in that facing, regen 0.6 + 0.4 each;
  capacitor = 80 + 80 per reactor, recharge time 40 s; speed multiplier =
  clamp(thrust × 12 / mass, 0.35, 1.25) where thrust = engines (×2 in
  nacelles); sensors = 8 + 2 each (lock time, tracking); repair = 0.6 + 0.5
  per crew quarters hp/s to damaged blocks.
- Weapons: phaser emitter 28 dmg / 2.6 s, 2.5 cap, optimal 8 km, falloff
  7 km, tracking 0.9 rad/s, 180° arc. Torpedo tube 170 dmg / 11 s, 14 cap,
  30 km, explosion radius 280 m, velocity 1.5 km/s, 220° arc. A weapon's
  arc is centred on the open side of the hull around it (line of fire,
  below), so a rim weapon faces outward and a buried one faces nothing. F1
  fires all emitters that bear, F2 all tubes.
- Built-in active systems on every ship: shield booster (+70 to the weakest
  facing per 4 s, 32 cap), shield hardener (−30% shield damage), afterburner
  (+50% speed). F3–F5.
- Layout rules (`BS.Grid.validateLayout`): blocks only on fillable cells,
  exactly one bridge, everything connected to the bridge (eight
  neighbours, corners count), at least one weapon and one engine. An
  invalid layout never undocks.
- **Random variants** (`BS.Grid.randomVariant`, `grid.variant`): re-roll
  12% of a base layout's editable cells (armor becomes a weighted random
  system block, a system block becomes armor), keep the bridge, accept the
  first of up to 12 rolls that validates. Seeded by the battle record.

### Hit resolution
- **Turrets**: hit chance = `accuracy × 0.5 ^ ((angular / tracking)² +
  (max(0, d − optimal) / falloff)²)`, times sensor health and the −15% aim
  penalty. Angular velocity is the target's transversal speed over distance.
- **Torpedoes**: always home in; damage × `min(1, sig/expRadius,
  ((sig/expRadius) × (expVelocity / targetSpeed))^0.6)`. Big slow targets
  take full damage, an afterburning Bird-of-Prey about 65%.
- Damage hits the facing toward the attacker. Hardener resist applies to the
  shield only. 15% of absorbed damage bleeds to hull. Hull damage lands on
  the outermost alive block along a line parallel to attacker→centre,
  offset sideways by up to `grid.hitScatter` (1.0) × the hull half-extent,
  so a volley strafes the whole facing instead of drilling one column.
  Beams carry `grid.penetration` (2) penetration points and enter each
  block on their line while points remain; a block costs its `pierceCost`:
  armor 2, structure 3, everything else 1. So a beam stops in the first
  armor plate it meets, but chews two blocks deep through exposed systems
  (overflow damage carries on within the chain). Torpedoes put 50% on the
  entry block and 20% on each of its four neighbours.
- **Aiming** (−15% accuracy): the shot line is steered through the nearest
  block of the aimed type within `grid.aimRadius` (2) cells of the natural
  entry block, wandering ±`grid.aimScatter` (2) cells. The outermost block
  on that line still takes the hit first, so armor in front of a system
  protects it; a focused volley has to clear a strip of armor to reach the
  bridge.
- Destroyed blocks leave the grid (debris); blocks no longer connected to
  the bridge through any of their eight neighbours break off as a section
  (fragment). A ship is lost when its bridge dies or alive block hp drops
  below 30% of the total. A ship with **no weapons and no engines left is
  disabled** (`shipDisabled`): it stops, its modules shut down and the
  battle ends; for the enemy that is a victory by capture.

### Repair
Damage control restores hp to damaged (not destroyed) blocks at the ship's
repair rate, the repair-priority type first, then the most damaged.
Destroyed blocks stay gone for the battle.

### Electronic warfare (`BS.Data.ew`, blocks jammer and cloak)
- **ECM jammer** (block `J`, module F6, 5 s cycle, 10 cap): each cycle
  rolls jam strength (3 per alive jammer block) against the target's
  sensor strength: `chance = jam / (jam + sensors)`. On a hit the target
  loses its lock, cannot lock for 4 s (`jammed`), and torpedoes it has in
  flight go blind. Sensor arrays are the counter.
- **Cloaking device** (block `C`, one per ship, module F7): 3 s to cloak.
  Cloaked, a ship cannot be locked (locks on it drop), its shields are
  zero, its weapons are cold and its capacitor drains 8/s (it decloaks by
  itself below 5). It is invisible beyond the viewer's detection range
  (`science.cloakDetectRangeKm` 10 km + 1 km per sensor array) and a faint
  ghost inside it, still unlockable. Decloaking takes 2 s and shields stay
  down for 8 s more (surge). The helm loses an invisible target and holds
  course. `BS.Ships.visibility(ship, viewer)` is the one rule the renderer,
  the overview, hover targeting and the helm all use.

### Shields
Passive regen is low (0.6/s per facing plus 0.4 per emitter); the booster
(+50 to the weakest facing per 4 s) is the real tank, but no longer out-heals
a focused attack.
Reinforce moves 45% of the strongest facing to the weakest over 3 s with a
20 s cooldown. Weapons must be armed (red alert) for full regen.

### Enemy AI (`enemyAI.doctrines`, `enemyAI.default`, `enemyAI.ktinga`)
Every enemy approaches (afterburner on) until its doctrine's `engageKm`,
fights by that doctrine, retreats once at hull < 28% (keep at 22 km,
shields repair priority) and then returns to fight to the end. Shared
module rules: weapons on whenever cap > 12%, hardener while engaged,
booster when the facing toward you < 45% and cap > 35%. Every 20 s the AI
re-rolls what it aims at from `targetWeights`: 40% of the time it sprays
the hull (no aim penalty), otherwise phasers, reactors, engines, shields or
(5%) the bridge. The encounter names the doctrine (`campaign.encounters[].doctrine`,
a list means a seeded pick); the Overview status column shows the state
through `enemyAI.stateLabels` and Tactical calls the changes.

Enemy damage is ×1.35 (`damageMult`) and strength 108% + 4% per win.

| Doctrine | Used by | Behaviour |
|---|---|---|
| **strafe** | Raider, some variants | `run_in` at the player with the afterburner (cap > 50%) → `pass`: a 12 s orbit at 3 km with everything firing, afterburner off so it can hit → `break_off` to 8 km → `turn_in` 2 s on a new bearing → run in again. Each pass arrives on a different facing. |
| **brawl** | Gunboat, some variants | Orbit at 3.5 km, afterburner only above 70% cap, flips orbit direction every 20 s or after 4 s of tail chase (angular velocity < 0.15 rad/s); comes about when the facing < 22% and a stronger one exists. |
| **standoff** / **siege** | Torpedo boat / K't'inga Siege | Keeps at 14 km (17 km for siege) firing torpedoes; when the player closes inside 9 km (11) it kites with the afterburner to 17 km (20) for up to 15 s. |
| **broadside** | K't'inga, some warlords | Holds a 5.5–8.5 km band on a slow course with Come about, presenting the strongest shield; rolls to a fresh shield every 30 s or when the facing drops below 22%. |
| **ambush** | Shadow (Bird-of-Prey with a cloak) | `stalk` cloaked toward the player, `uncloak` at 4.5 km, a 12 s firing pass at 3 km, break off to 10 km and cloak again. |

Enemies with jammer blocks run them whenever engaged and above 30% cap.

The K't'inga profile reacts slower, retreats later and keeps its own
`statMult` (0.9 before scaling). Nothing orbits the player at 6 km any
more, so a player orbit no longer turns into a two-ship tail chase; the
fitting answer differs per doctrine (turn into a strafer with Approach,
close on a standoff ship, flip your own orbit against a brawler).

### Win / lose
Enemy hull 0 → Victory; player hull 0 → Defeat. Result overlay with stats.

### Campaign (`BS.Campaign`)
- **Credits**: win 500 × encounter `rewardMult` − 3 per % hull lost + 50 per
  consecutive win (max 5), loss 120, never below 50. Start with 600.
- **Salvage** (`campaign.salvage`): a win also pays a share of the block
  value still alive on the enemy: 10% of a destroyed ship's remains, 25% of
  a disabled ship (captured intact). Aiming at weapons and engines to
  disable a ship pays better than blowing it up.
- **Encounters** (`campaign.encounters`): each entry names an enemy class, a
  layout (`default`, a named variant, or `random`), the wins needed to
  unlock it, a weight and a reward multiplier. `BS.Campaign.encounter()`
  draws one with a PRNG seeded by battles won and lost, so the hangar's
  "Next:" line and the battle agree and a reload does not re-roll. Bird-of-Prey
  raider from the start; Gunboat and Torpedo boat from win 1; random
  variants from win 2; the Jammer boat (two ECM blocks, ×1.2) from win 3;
  the Shadow (cloak, ambush doctrine, ×1.3) from win 3; K't'inga from win 4
  (×1.8), Siege from 6, random K't'inga from 8 (×1.9). Klingon ship names
  come from `campaign.klingonNames`.
- **Enemy scaling**: `statMult = profile.statMult + 0.04 × wins` (max +0.4)
  multiplies every enemy block's hp and the shields; `damageMult` 1.6
  multiplies enemy weapon damage.
- **Shipyard**: ships at `shipClasses.*.cost` with their default build
  included. Boarding a ship uses that hull's own saved layout.
- **Build statistics**: dps assumes 80% beam hits and 85% torpedo damage;
  capacitor is simulated for 10 minutes with every active module running
  ("stable at n%" or "runs dry in n s").
- **Skills** (`BS.Data.skills`): six skills, five levels each, trained one at
  a time in real time (0.5 / 2 / 6 / 16 / 40 hours per level) using
  timestamps, so training continues while the game is closed. Levels apply
  as ship mods at battle start (+3% beam damage, +3% torpedo damage, +3%
  speed, +4% shield regen, +4% cap recharge, −5% lock time per level).
- **Save**: localStorage key `bridgesim.save`, `saveDefaults` shape
  (version 2). Export downloads `bridge-sim-save.json`; Import validates and
  migrates. Reset asks for confirmation.

## 5. Visual style
LCARS panels (orange / peach / purple / blue, Antonio font, red-alert
lighting). Tactical display: multi-layer parallax starfield, nebula, vector
ships drawn as plated block hulls with glowing systems, km range rings for
optimal / falloff / torpedo range, orbit ring, velocity vectors,
lock-in-progress dashed ring and locked brackets, phaser beams with
flicker, torpedo orbs with trails, shield facing arcs with ripples, sparks,
smoke, shockwave, screen shake. Module bar with conic cooldown rings.
Renderer dispatches on `ship.visual.kind` (grid / sprite).

**Block glyphs** (`blocks.*.glyph`, `BS.Renderer.drawBlockGlyph`): every
system block carries one shape in its own colour (lens, warhead, shield,
core, thrust, dish, star, windows, wave, eye) on a darker plate; armor is
the bare plate. The same drawing makes the palette icons and the chips
(`BS.Renderer.blockIcon`), so a block looks the same everywhere.

**Destruction** (`visuals.fragments`, `effects.js`): a destroyed block
throws sparks, smoke and debris in its own colour plus a tumbling plate. A
section cut off from the bridge leaves as one **fragment**: the blocks keep
their relative positions and colours, drift away from the hull, spin slowly
and scorch dark before fading (3.2 s). When a ship dies the renderer stops
drawing it and the remaining hull shatters into 3–6 connected pieces
(multi-source flood fill) that fly apart with secondary explosions, a white
core flash and a double shockwave; the result screen follows 3.6 s later.
Game logic is untouched: everything is driven by `blockDestroyed`,
`sectionLost` and `shipDestroyed`.

## 6. Data structures (`js/data.js`)

```js
units: { pxPerKm }
balance: { ..., capCurve, lockBase, lockRefSignature, lockRefSensor, orbitRangesKm, keepRangesKm, zoom }
subsystems: { weapons, torpedoes, engines, shields, sensors, bridge: { label, short, effect, targetReport, damaged, repaired } }
subsystemEffects: { sensorsAccuracyFloor, sensorsLockMaxMult, bridgeCapMinMult, targetAccuracyMult }
modules: { id: { slot, kind: turret|launcher|active|passive, name, short, cycle, cap, pg, cpu, cost, desc, ...stats, effect } }
grid: { cellPx, structureHp, structurePierceCost, shield*/regen*/cap*/thrust*/sensor*/repair*, powerPerReactor, brownoutMin, heat: { base, perBlock, dissipationBase, dissipationPerRimCell, overloadTime, aiFireBelow, governorHigh, governorLow },
        hitScatter, penetration, lineOfFire, lineOfFireStep, lineOfFireMuzzle, lineOfFireRangeCells, torpedoSplash, aimRadius, aimScatter, deadFraction,
        variant: { fraction, attempts, systemWeights }, maskLegend, layoutLegend }
blocks: { type: { letter, name, short, hp, mass, cost, power, color, desc, unique?, pierceCost?, explosion?: { damage, radius }, weapon?: { ..., heat } } }
modules: { phaser_group, torpedo_group, shield_booster, shield_hardener, afterburner, jammer (block-bound active, effect.jam), cloak (kind "cloak", block-bound) }
ew: { jamPerBlock, jamDuration, cloakTime, decloakTime, surgeTime, cloakDrain, cloakMinCap, detectPerSensor, ghostAlpha, ownCloakAlpha }
shipClasses: { id: { name, className, role, faction, cost, purchasable, speed, turnRate, signature, lockRangeKm, preferredRangeKm,
                     mask: [rows], layout: [rows], presets: { id: { name, desc, rows } }, variants: { id: { name, desc, rows } } (enemies),
                     aiProfile?, visual: { kind, sprite, nacelleColor, hullTint } } }
crew: { officers, reports, events (battleStart is templated with {className}, {name}, {range}), hailReplies }
enemyAI: { doctrines: { id: { kind: strafe|brawl|standoff|broadside, engageKm, ...per-kind ranges and timers, tailChaseAngular, tailChaseTime } }, stateLabels,
           default | ktinga: { doctrine, accuracyMult, reactionDelay, statMult, damageMult, retreat*, reposition*, retreatRangeKm, booster*, afterburnerMinCap, targetWeights (none = spray) } }
campaign: { startingCredits, credits, salvage: { destroyed, disabled }, enemyScaling, encounters: [{ id, enemyClass, layout, doctrine, minWins, weight, rewardMult }], klingonNames }
visuals: { starLayers, nebulae, shieldColors, shake*, fragments: { sectionLife, deathLife, deathPieces, driftSpeed, deathSpeed, spin, fadeFrom } }
skills (real-time training), science, saveDefaults (version 2: layouts, builds, skills)
```

Runtime ship: `pos, vel, heading, speed, hull, shields{4}, capacitor, capMax,
subsystems{6}, lock{target, progress, locked, time}, selected, targetSubsystem,
cmd{type, target, range, point, orbitDir, facing}, modules[{id, def, slot,
active, running, cycleLeft, cycleTime, state}], fitEffects, activeEffects,
repairPriority, reinforce, stats, mods, aiProfile, ai`.

## 7. Events
`lockStarted, lockAcquired, lockLost, moduleToggled, moduleCycle,
moduleOffline, shieldBoosted, phaserFired, torpedoLaunched, torpedoHit,
torpedoExpired, shieldHit, hullHit, blockDestroyed, sectionLost,
blockExploded, shipDisabled, shipDestroyed, overload, jammed, cloakChanged,
alertChanged, enemyStateChanged, enemyFlipped, enemyRolled, commandGiven,
log, battleStarted, battleEnded, skillTrained`.

## 8. Measured balance (v0.5.3, accelerated simulation, scripted captains, default builds, no skills)

Harness: `BS.Game.state.paused = true`, `BS.Game.step(1/60)` in a loop, the
captain script runs once per simulated second. Enemy strength as at the
given number of wins. Hit rolls and the enemy's aim choice are random, so
single runs vary a lot; ranges below are over 4–6 runs.

v0.6.0 results. "Straightforward" here is: lock, phasers + torpedoes +
hardener, booster pulsed below 50% facing, Reinforce below 20%, **orbit at
the enemy's range** (3 km when it comes inside 4.5 km, 6 km when it is
beyond 7 km) and **Reverse orbit** whenever no weapon on the engaged side
can bear. With line of fire, a ship fights with the guns on the side
facing the enemy; a captain who orbits at 6 km and never reverses loses
every fight once that side's phasers are gone.

| Matchup | Captain | Outcome |
|---|---|---|
| Constitution vs Raider **strafe** (0 wins) | straightforward | 5 of 5 wins, 1:59–9:32 (typically 3:30–4:00) keeping 59–86% block hp |
| Constitution vs Raider strafe | orbit 6 km, never reverse | 0 of 5 |
| Constitution vs Raider strafe | no orders | lost in 2:52–3:42, usually disabled (weapons and engines shot off) |
| Constitution vs Gunboat **brawl** (1 win) | straightforward | 4 of 5 wins in 2:55–3:42 keeping 84–94%, one stalemate |
| Constitution vs Torpedo boat **standoff** (1 win) | straightforward | 4 of 4 wins in 1:33–2:38 keeping 92–96% |
| Constitution vs K't'inga **broadside** (4 wins) | straightforward | 1 of 4 (one by disabling it); the cruiser holds its broadside and out-guns a stock Constitution |
| Excelsior vs K't'inga broadside | straightforward | 3 of 4 wins in 6:21–8:21 keeping 61–99% |
| Galaxy vs K't'inga **siege** (6 wins) | straightforward | 4 of 4 wins in 4:17–4:58 keeping 97–99% |
| Miranda / Defiant vs Raider strafe | speed tank (orbit 3 km + afterburner, no reverse) | mostly stalemates: the script never reverses, so the stripped side stays toward the enemy |

v0.7.0 (power grid, heat, electronic warfare; same straightforward captain, 4 runs each):

| Matchup | Outcome |
|---|---|
| Constitution vs Raider strafe (0 wins) | 4 of 4 wins in 2:09–6:30 keeping 59–95% |
| Constitution vs Raider strafe, no orders | disabled in 3:08–4:28 |
| Constitution vs Gunboat brawl (1 win) | 3 of 4 wins in 5:08–5:27, one stalemate |
| Constitution vs Shadow **ambush** (3 wins) | 3 of 4 wins in 3:00–4:19 keeping 80–99%, one stalemate while it stayed cloaked |
| Constitution vs Jammer boat (3 wins) | 1 of 4: with its lock broken every few seconds a stock Constitution loses its weapons; sensor arrays or a jammer of your own are the answer |

Earlier (v0.5.3, before line of fire and armor):

| Matchup | Captain (approach inside 4.5 km) | Outcome |
|---|---|---|
| Constitution vs Raider **strafe** (0 wins) | straightforward | 6 of 6 wins in 1:52–4:34 keeping 59–84% block hp |
| Constitution vs Raider strafe | speed tank (orbit 3 km + afterburner) | 2 of 6: co-orbiting a strafer at speed is a tail chase where both miss; not the answer to this doctrine |
| Constitution vs Raider strafe | no orders | lost in 3:32–4:18 |
| Constitution vs Gunboat **brawl** (1 win) | straightforward | 4 of 4 wins in 1:54–3:40 keeping 81–89% |
| Constitution vs Torpedo boat **standoff** (1 win) | straightforward | 4 of 4 wins in 1:44–3:12 keeping 87–90% (the easy encounter) |
| Constitution vs K't'inga **broadside** (4 wins) | straightforward | 3 of 4 wins in 2:36–3:09, one 10-minute stalemate |
| Excelsior vs K't'inga broadside | straightforward | 3 of 4 wins in 2:05–3:33 |
| Galaxy vs K't'inga **siege** (6 wins) | straightforward | 4 of 4 wins in 1:46–2:11 keeping 95–97% |
| Miranda / Defiant vs Raider strafe | speed tank | 1 of 6 / 2 of 6: small hulls lose their rim phasers to the passes; fly them with Approach instead |

Earlier (v0.5.2, enemy orbiting at 6 km), kept for comparison:

| Matchup | Captain behaviour | Outcome |
|---|---|---|
| Constitution vs raider (0 wins, strength 108%) | Straightforward: lock, orbit 6 km, phasers + torpedoes + hardener, booster pulsed below 50% facing when cap > 40%, Reinforce when a facing < 20% | 12 wins, 1 loss, 1 stalemate of 14; wins in 2:16–5:57 (median ≈ 3:30) keeping 62–84% of block hp (median loss ≈ 27%) |
| Constitution vs raider | Speed tank: orbit 3 km, afterburner when cap > 55%, booster pulsed, no hardener | Wins in 1:45–4:09 keeping 73–95% (occasional long stalemate when phasers on the engaged side are lost) |
| Constitution vs raider | No orders | Lost in 3:06–4:15 |
| Constitution vs Gunboat / variants (2 wins, 116%) | Straightforward | About half the fights lost: by the second win the default build needs upgrading |
| Miranda vs raider | Straightforward / speed tank | 5 of 6 wins in 3:12–6:44 / 6 of 6 in 2:49–4:28 keeping 78–89% |
| Defiant vs raider | Straightforward / speed tank | 2 of 5 / 5 of 5 wins in 1:43–4:07 keeping 57–99%: an escort, fly it fast and close |
| Excelsior vs raider | Straightforward | 6 of 6 wins in 1:54–2:50 keeping 80–97% |
| Galaxy vs K't'inga family (6 wins, 114%) | Straightforward | 6 of 6 wins in 1:43–5:04 keeping 76–99% |
| Sovereign vs K't'inga family (6 wins) | Straightforward | 4 of 5 wins in 2:16–3:40 keeping 80–95% |

Not met exactly: the straightforward Constitution fight loses a little less
than the 30–50% target on most runs, and the speed tank wins faster rather
than slower (it is nearly untouched, as intended).

## 9. Roadmap

| PR | Feature |
|---|---|
| A (done, v0.3) | EVE-style controls, HUD, capacitor, modules, lock, tracking, fixed fit |
| B (done, v0.4) | Hangar with slot fitting, market, credits, real-time skills, save |
| v0.5 PR 1 (done) | Block grid hulls, nine block types, per-block damage with penetration, splash and section loss, grid renderer, build preview and statistics |
| v0.5 PR 2 (done) | Hangar block editor (paint, erase, mirror, presets), block costs and refunds, saved builds |
| v0.5 PR 3 (done) | Masks for Miranda, Defiant, Excelsior, Galaxy, Sovereign; K't'inga; enemy layouts, random variants and encounters; fragments and shatter; balance pass |
| v0.5.3 (done) | Enemy doctrines: strafe, brawl, standoff, broadside; tail-chase detection; status labels and callouts |
| v0.6.0 (done) | Cosmoteer ideas: reactor breaches that chain, line of fire blocked by the own hull, armor pierce cost, disabled ships and salvage |
| v0.7.0 (done) | Power grid from reactors, heat and overload, ECM jammer, cloaking device, ambush doctrine, Jammer boat and Shadow encounters |
| later | Fire spreading put out by crew quarters; reactor power range; audio; sector map; sprites |
| later | Audio via events, sector map and missions, science scans and cloaked ships, optional image sprites |
