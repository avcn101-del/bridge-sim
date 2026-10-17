# DESIGN.md — Bridge Sim

Version: 0.5 (block construction, PR 1 of 3). Keep this file in sync with the game.

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
| Enemies | One ship per battle in v0.3; small groups later |
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
3. **Battle**: the Bird-of-Prey closes from 38 km. Click it to select and
   lock (3 s lock). Give an orbit or keep-at-range. Switch on phasers,
   torpedoes, hardener; pulse the shield booster and afterburner as the
   capacitor allows. Aim at a part once its facing shield is down.
4. **Result screen**: Victory/Defeat, time, damage, hit counts, credits
   earned, Return to hangar. The raider gets 6% stronger per victory (up to
   +60%), so credits must go into better fits and skills.

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
- Keys: F1–F8 toggle modules, L lock, A approach, O orbit 6 km, K keep
  10 km, C come about, S stop, R red alert, Space pause.
- Overview rows: click selects, double-click locks.
- Left panel: click a subsystem row to make it repair priority (again: auto).
  Enemy part chips in the Target block set the aim.

## 4. Mechanics

### Movement commands (`ship.cmd`)
- `approach(target)`, `orbit(target, range)`, `keep(target, range)`,
  `flyTo(point)`, `comeAbout(target)` (hold strongest facing toward target
  at 25% speed), `idle`. Ships turn at `turnRate` and accelerate toward max
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
  shuts off and Engineering says so. Bridge damage lowers recharge.

### Hull grid and blocks (`BS.Data.grid`, `BS.Data.blocks`, `shipClasses.*.mask / layout`)
- A hull mask is rows of `.` (space), `#` (fillable), `n` (nacelle cell:
  engines count double), `p` (fixed structure, 220 hp, not editable).
  Constitution 26×16 (206 fillable), Bird-of-Prey 24×22 (140). Cells are
  6 px; the grid centre is the ship centre; x is forward, y is starboard.
- Block types (hp / mass / cost): armor 60/2/20, phaser emitter 30/2/120,
  torpedo tube 30/3/180, shield emitter 25/2/90, reactor 25/3/100, impulse
  engine 30/2/80, sensor array 20/1/110, bridge 140/2 (exactly one), crew
  quarters 25/1/40.
- Derived stats: hull hp = Σ block hp; shield per facing = 80 + 70 per
  emitter whose outward angle falls in that facing, regen 0.6 + 0.4 each;
  capacitor = 80 + 80 per reactor, recharge time 40 s; speed multiplier =
  clamp(thrust × 12 / mass, 0.35, 1.25) where thrust = engines (×2 in
  nacelles); sensors = 8 + 2 each (lock time, tracking); repair = 0.6 + 0.5
  per crew quarters hp/s to damaged blocks.
- Weapons: phaser emitter 24 dmg / 2.6 s, 2.5 cap, optimal 8 km, falloff
  7 km, tracking 0.9 rad/s, fires into the 180° arc facing away from the
  ship centre. Torpedo tube 150 dmg / 11 s, 14 cap, 30 km, explosion radius
  280 m, velocity 1.5 km/s, 220° outward arc. F1 fires all emitters that
  bear, F2 all tubes.
- Built-in active systems on every ship: shield booster (+70 to the weakest
  facing per 4 s, 32 cap), shield hardener (−30% shield damage), afterburner
  (+50% speed). F3–F5.
- Layout rules (`BS.Grid.validateLayout`): blocks only on fillable cells,
  exactly one bridge, everything connected to the bridge, at least one
  weapon and one engine. An invalid layout never undocks.

### Hit resolution
- **Turrets**: hit chance = `accuracy × 0.5 ^ ((angular / tracking)² +
  (max(0, d − optimal) / falloff)²)`, times sensor health and the −15% aim
  penalty. Angular velocity is the target's transversal speed over distance.
- **Torpedoes**: always home in; damage × `min(1, sig/expRadius,
  ((sig/expRadius) × (expVelocity / targetSpeed))^0.6)`. Big slow targets
  take full damage, an afterburning Bird-of-Prey about 65%.
- Damage hits the facing toward the attacker. Hardener resist applies to the
  shield only. 15% of absorbed damage bleeds to hull. Hull damage lands on
  the outermost alive block along the line from the attacker to the ship
  centre: beams penetrate up to 2 blocks (overflow carries on), torpedoes
  put 50% on the entry block and 20% on each of its four neighbours. If an
  aim type is set, the nearest block of that type within 3 cells of the
  entry block takes the hit instead (−15% accuracy on the shot).
- Destroyed blocks leave the grid (debris); blocks no longer connected to
  the bridge break off as a section. A ship is lost when its bridge dies or
  alive block hp drops below 35% of the total.

### Repair
Damage control restores hp to damaged (not destroyed) blocks at the ship's
repair rate, the repair-priority type first, then the most damaged.
Destroyed blocks stay gone for the battle.

### Shields
Passive regen is low (3/s per facing); the booster is the real tank.
Reinforce moves 45% of the strongest facing to the weakest over 3 s with a
20 s cooldown. Weapons must be armed (red alert) for full regen.

### Enemy AI
approach (afterburner on) → attack (orbit 6 km, hardener on, booster when
the facing toward you < 55% and cap > 30%, afterburner when cap > 45%) →
reposition (come about when the facing < 22%) → retreat once at hull < 28%
(keep at 22 km, shields power) → return and fight to the end. Weapons stay on
whenever cap > 12%.

### Win / lose
Enemy hull 0 → Victory; player hull 0 → Defeat. Result overlay with stats.

### Campaign (`BS.Campaign`, PR B)
- **Credits**: win 500 − 3 per % hull lost + 50 per consecutive win (max 5),
  loss 120, never below 50. Start with 600.
- **Market**: all Starfleet modules at `modules.*.cost`; selling refunds 60%.
  Ships at `shipClasses.*.cost` (Miranda, Defiant, Excelsior, Galaxy,
  Sovereign; silhouettes are placeholders until PR C). Boarding a ship uses
  that ship's own saved fit; a new ship comes with its class default fit.
- **Fitting rules**: a module only fits its slot type; total `pg` ≤
  `powergrid` and total `cpu` ≤ `cpu`. Unfitted modules go to storage.
  The default Constitution fit is near both limits on purpose.
- **Fit statistics**: dps assumes 80% beam hits and 85% torpedo damage;
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
ships with gradients and glowing nacelles, km range rings for optimal /
falloff / torpedo range, orbit ring, velocity vectors, lock-in-progress
dashed ring and locked brackets, hardpoint rings and reticle, phaser beams
with flicker, torpedo orbs with trails, shield facing arcs with ripples,
sparks, smoke, debris, shockwave, screen shake. Module bar with conic
cooldown rings. Renderer dispatches on `ship.visual.kind` (vector / sprite).

## 6. Data structures (`js/data.js`)

```js
units: { pxPerKm }
balance: { ..., capCurve, lockBase, lockRefSignature, lockRefSensor, orbitRangesKm, keepRangesKm, zoom }
subsystems: { weapons, torpedoes, engines, shields, sensors, bridge: { label, short, effect, targetReport, damaged, repaired } }
subsystemEffects: { sensorsAccuracyFloor, sensorsLockMaxMult, bridgeCapMinMult, targetAccuracyMult }
modules: { id: { slot, kind: turret|launcher|active|passive, name, short, cycle, cap, pg, cpu, cost, desc, ...stats, effect } }
shipClasses: { id: { hull, shields: {max, regen}, speed, turnRate, signature, sensorStrength, lockRangeKm,
                     capacitor: {max, rechargeTime}, slots: {high, mid, low}, powergrid, cpu, fit: {high:[], mid:[], low:[]},
                     subsystems, phaserMounts, torpedoTubes, repairRate, preferredRangeKm, visual: { ..., hardpoints } } }
crew: { officers, reports, events, hailReplies }
enemyAI: { default: { accuracyMult, reactionDelay, statMult, retreat*, reposition*, orbitRangeKm, retreatRangeKm, booster*, afterburnerMinCap, targetWeights } }
upgrades, skills (real-time training), campaign, science, saveDefaults (version 2: fits, inventory, skills)
```

Runtime ship: `pos, vel, heading, speed, hull, shields{4}, capacitor, capMax,
subsystems{6}, lock{target, progress, locked, time}, selected, targetSubsystem,
cmd{type, target, range, point, orbitDir, facing}, modules[{id, def, slot,
active, running, cycleLeft, cycleTime, state}], fitEffects, activeEffects,
repairPriority, reinforce, stats, mods, aiProfile, ai`.

## 7. Events
`lockStarted, lockAcquired, lockLost, moduleToggled, moduleCycle,
moduleOffline, shieldBoosted, phaserFired, torpedoLaunched, torpedoHit,
torpedoExpired, shieldHit, hullHit, subsystemDamaged, subsystemRepaired,
shipDestroyed, alertChanged, enemyStateChanged, commandGiven, log,
battleStarted, battleEnded`.

## 8. Measured balance (v0.4.0, accelerated simulation, 3 runs each, default fit, no skills)

| Captain behaviour | Outcome |
|---|---|
| Attentive (lock, orbit 6 km, weapons + hardener, booster pulsed below 50% facing, AB when cap > 60%, aim phasers, repair sensors) | Wins in 4:40–5:00 with 69–75% hull |
| Everything on at once | Mixed; capacitor runs dry repeatedly |
| Stationary, weapons on | Loses in 2:15–2:40 |
| No orders | Loses in about 1:40 |

## 9. Roadmap

| PR | Feature |
|---|---|
| A (done, v0.3) | EVE-style controls, HUD, capacitor, modules, lock, tracking, fixed fit |
| B (done, v0.4) | Hangar with slot fitting, market, credits, real-time skills, save |
| v0.5 PR 1 (done) | Block grid hulls, nine block types, per-block damage with penetration, splash and section loss, grid renderer, build preview and statistics |
| v0.5 PR 2 | Hangar block editor (paint, erase, mirror, presets), block market and costs, layouts in the save |
| v0.5 PR 3 | Masks for Miranda, Defiant, Excelsior, Galaxy, Sovereign; enemy layouts and random variants; destruction polish; balance pass |
| later | Audio via events, sector map and missions, science scans and cloaked ships, optional image sprites |
