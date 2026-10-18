# DESIGN.md — Bridge Sim

Version: 0.14.0 (enemy scan panel). Keep this file in sync with the game.

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
| Units | km and km/s in the interface (`units.pxPerKm` = 150); a Constitution measures about 1 km, three times its real size, so blocks stay readable at combat ranges. The camera auto-fits both ships (`balance.zoom.autoMin/autoMax/fitMargin`); wheel and +/− scale a bias on top |
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
   lock (3 s lock). Pick a stance (Engage by default); the helm flies it.
   Switch on phasers, torpedoes, hardener; pulse the shield booster as the
   capacitor allows. Aim at a part once its shield is down, or at hull
   outside their shield cover.
4. **Result screen**: Victory/Defeat, time, damage, hit counts, credits
   earned, Return to hangar. Enemies get 4% stronger per victory (up to
   +40%) and tougher encounters unlock with wins, so credits must go into
   better builds, bigger hulls and skills.

Decision pressure: the build (what the ship can do at all), the stance
(which fight the helm flies), capacitor budget (what runs now), heat,
shield facing management, part targeting. Movement is the helm's job.

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
| SCAN: locked enemy's blocks, shields, fields, crew, threat     |
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
- Right-click enemy: Engage stance. Right-click / double-click empty
  space: fly there (helm on manual until a stance is picked). Wheel: zoom.
- Keys: F1–F8 toggle modules (F6 jammer, F7 cloak when fitted), L lock,
  1–4 stances (Engage, Skirmish, Standoff, Disengage), 5–0 plays (Alpha
  strike, Siege, Turtle, Hunter, Ambush, Hit & fade), S stop (manual),
  R red alert, H heat governor, Space pause.
- Wheel and +/− scale a zoom bias; the camera itself follows the player,
  leans a third of the way toward the enemy and zooms so both ships fit.
- **Stances** (Helm panel, `helm.stances`): the captain picks how to
  fight; the helm flies it and reverses the orbit on its own when the
  other side has more guns to bear or a fresher shield. No orbit, keep,
  approach, come-about or reverse buttons any more.
- Overview rows: click selects, double-click locks.
- Left panel: click a subsystem row to make it repair priority (again: auto).
  Enemy part chips in the Target block set the aim.

## 4. Mechanics

### Movement commands (`ship.cmd`) and the helm
- Low level, used by the doctrine machine on both sides: `approach(target)`,
  `orbit(target, range)` (with `flipOrbit` to reverse direction),
  `keep(target, range)`, `flyTo(point)`, `comeAbout(target)` (hold strongest
  facing toward target at 25% speed), `idle`. Ships turn at `turnRate` and
  accelerate toward max speed.
- **Keep geometry** (`helm.bearingStep / keepBand / keepRunBelow / holdSpeed /
  keepFireFraction / kiteMinBearing`, both sides): `BS.Grid.bearingProfile`
  samples, every 10°, how much fire (damage per second of the alive weapons
  in active groups, arc and line of fire included) bears at each relative
  bearing; `BS.Ships.firingBearings` picks the **hold** bearing (most fire,
  ties nearest abeam) and the **kite** bearing (most fire at or beyond 120°,
  tail-on when less than half the best fire bears aft). Keeping range: beyond
  1.08 × range close; inside the 0.92–1.08 band hold the target on the hold
  bearing at a speed falling from 35% to a stop; down to 0.75 × range hold
  station (stopped, guns on them); closer, open the range on the kite bearing
  at full speed. Before 0.10.0 `keep` flew abeam at 35% and ran tail-on
  below the band, so bow tubes fired at a third of their rate on both sides.
- **Player helm** (`helm`, `BS.EnemyAI.setStance`): the captain picks a
  stance and the helm runs the matching doctrine (same machine as the
  enemy, below) with ranges derived from the fitted weapons
  (`stances[].ranges`: `[ref, fraction, ..., fallbackKm]`, ref `phaser` =
  phaser optimal range, `torpedo` = torpedo range):
  - **Engage** (1, default at battle start): brawl doctrine, orbit at
    phaser optimal × 0.5 (4 km), afterburner only above 70% cap.
  - **Skirmish** (2): brawl at phaser optimal × 0.35 (2.8 km) with the
    afterburner on above 30% cap: too fast to track, costs capacitor.
  - **Standoff** (3): standoff doctrine, hold at torpedo range × 0.5
    (15 km; phaser optimal × 1.0 without tubes), kite below × 0.32 to × 0.6.
  - **Disengage** (4): evade doctrine, keep at torpedo range × 0.8 (24 km)
    on the afterburner until another stance is picked.
  The helm owns the afterburner; everything else stays the captain's.
  Stop (S) or fly-to puts the helm on manual (`ai.suspended`) until a
  stance is picked again; the Helm row reads "Manual · …" meanwhile. The
  tactical officer re-locks a target the captain locked before whenever
  the lock drops and the target is in range (`ai.relock`).
- **Auto-flip** (`helm.flipMinInterval/flipShieldLow/flipShieldHigh`, both
  sides): an orbiting ship reverses its orbit when mirroring the geometry
  would bring more weapons to bear (`bearingCount`), or when the engaged
  facing is below 30% while the opposite one is above 60%; at most once
  per 8 s. Helm calls it ("Coming about, bringing the other battery to
  bear" / "showing them a fresh shield").
- **Plays** (`helm.plays`, `js/plays.js`, keys 5–0): a play is a sequence
  of phases the bridge runs on its own. Each phase sets a stance or a
  doctrine for the helm, a module policy (`weapons` or a module id → on /
  off), the heat governor, the aim and the repair priority, and names its
  exit: any condition in `until`, or every condition in `untilAll`
  (`dKmBelow/Above`, `heatAbove/Below`, `facingBelow/Above` for the engaged
  facing, `weakestBelow/Above` for the weakest, `capBelow/Above`, `time`,
  `cloakOff`, `cloaked`, `overloaded`, `noTubes`, `noPhasers`,
  `noCloak`, `enemyReactorsGone`, `enemyShieldsDown`), never before the phase's
  `minTime` (default 3 s). `next` names the following phase (default: the
  next one, wrapping). Standing policies: `booster: "auto"` (booster when
  the weakest facing < 50% and cap > 40%), `reinforce: true` (Reinforce when
  the weakest facing < 30%). `requires` names a module the ship must carry
  (Ambush: cloak); the button greys out without it. Picking a stance, Stop or
  fly-to ends the play; module toggles by hand are allowed and the play
  re-applies its policy only on the next phase. The Helm row reads
  "Play · phase · state"; the helm narrates phase changes (`say`).

  | Play | Phases |
  |---|---|
  | **Alpha strike** | close in (`closein` doctrine, weapons cold, hardener) until 4.5 km → strike (Engage, governor off, everything on, booster auto, Reinforce) until heat > 90% or an overload → venting (Engage, weapons off, governor on) until heat < 30% → strike again. Only differs from Engage on builds whose salvo beats the heat cap |
  | **Siege** | Standoff holding station with every weapon that reaches, hardener, booster auto → when the tubes are gone or they come inside 5 km, Engage with everything → back to bombarding after 30 s or once they are beyond 9 km. For torpedo builds against slow or standoff ships |
  | **Turtle** | `broadside` doctrine (4.5–7 km band, come about, roll a fresh shield every 30 s or below 30%), hardener, booster auto, Reinforce, shield repair priority |
  | **Hunter** | Engage aiming at reactors → when none are left, aim at exposed hull |
  | **Ambush** (needs a cloak) | cloak and close (`closein`) until 3.5 km or cap < 15% → decloak → strike (Engage, governor off, aim reactors, booster auto, Reinforce) for the decloak strike window: 8–12 s, or heat > 85% or the weakest facing < 25% → slip away cloaked (Disengage, booster auto) until cloaked with the weakest facing back above 60%, 40 s or cap < 20% → repeat |
  | **Hit & fade** | Engage (hardener, booster auto) until the weakest facing < 25% → Skirmish (tight afterburner orbit, booster auto, Reinforce) until the weakest facing > 60%, at most 45 s → repeat |

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
  | B'rel Bird-of-Prey (enemy) | 24×22 | 140 | — | 105 / 110 / 250 | Raider 8 cannons 1T; Gunboat 7 pulse guns 4 cannons; Torpedo boat 4 cannons 3T; Shadow 6 cannons 5 cloaks |
  | K't'inga (enemy) | 32×20 | 210 | — | 85 / 70 / 480 | Battlecruiser 8 cannons 2T; Siege 4 cannons 4T 8R |

  Each Starfleet class has one preset besides the class default (Constitution
  has two). A ship's price includes its default build. Every default keeps
  its weapons on the rim with a clear line of fire and its reactors at least
  one cell apart from each other and from the bridge (see below).
- Block types (hp / mass / cost / power draw): armor 60/2/20/0, phaser
  emitter 50/2/120/5, torpedo tube 50/3/180/8, shield emitter 40/2/90/4,
  reactor 40/3/100/0 (+15 power), impulse engine 45/2/80/1, sensor array
  35/1/110/3, bridge 200/2/0 (exactly one), crew quarters 35/1/40/0 (8 crew), ECM
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
  7 km, tracking 0.9 rad/s, 180° arc. **Disruptor cannon** (block `D`, 130
  cr, 5 power) 32 dmg / 2.5 s, 2.6 cap, 7 heat, optimal 5 km, falloff 6 km,
  tracking 0.75, 160° arc, `pierceBonus` 1 (three penetration points: through
  one plate of armor into the block behind), drawn as a travelling bolt.
  **Pulse phaser** (block `U`, 110 cr, 4 power) 9.5 dmg / 1 s, 1 cap, 2.2
  heat, optimal 4 km, falloff 3 km, tracking 1.6, 180° arc. The three beams
  deliver about the same dps on paper (10.8 / 12.8 / 9.5) and trade range,
  tracking and penetration: phasers for reach, cannons to crack armor from a
  slow orbit, pulses to hit a Bird-of-Prey on the afterburner. Each beam type
  is its own weapon group (F-keys, module bar). Klingon ships mount
  disruptor cannons (every former `P` in their layouts); the Constitution
  **Brawler** preset carries six pulse phasers on the saucer rim and four
  cannons at the bow. Torpedo tube 170 dmg / 11 s, 14 cap,
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
Destroyed blocks stay gone for the battle. A block more than
`grid.crew.radius` (6) cells from the nearest alive crew quarters or the
bridge (`b.farCrew`) takes the same repair time for half the hp
(`farRepairMult`); the hangar marks such blocks with an amber dot.

### Crew (`grid.crew`, `blocks.*.crew`)
Every system block needs hands: phaser and cannon 2, pulse 1, torpedo tube
3, reactor 2, shield emitter 1, engine 1, sensor 1, jammer 1, cloaking
device 2. The bridge supplies 10 and each crew quarters 8
(`stats.crew = { need, supply, manning, far }`). **Manning** = supply /
need, clamped to `minManning` (0.4): weapons cycle and shields regenerate
at that fraction, exactly like a brownout, so quarters lost in battle
(casualties) slow the whole ship down. A build short of crew cannot undock;
the hangar shows "Crew x / y posts · manning n%" and the Ship panel the same
in battle. Every default build, preset and enemy layout was re-fitted with
6–13 quarters placed where they cover the most systems (Constitution 8,
Galaxy 11, Bird-of-Prey 6, K't'inga 8); quarters draw no power.

### Electronic warfare (`BS.Data.ew`, blocks jammer and cloak)
- **Fields** (`ew.cloakRadius` 10, `ew.jamRadius` 7, `BS.Grid.fieldCover`):
  like shield cover, a jammer and a cloaking device each project a field
  over the blocks within their radius (`b.jamCovered`, `b.cloakCovered`,
  `stats.jamCover / cloakCover` = covered, exposed, frac). The hangar frames
  cells outside the cloak field in purple and outside the ECM field in
  green, and the validator warns about both.
- **ECM jammer** (block `J`, module F6, 5 s cycle, 10 cap): each cycle
  rolls jam strength (3 per alive jammer block) against the target's
  sensor strength: `chance = jam / (jam + sensors)`. On a hit, if every
  block sits inside an ECM field the target loses its lock, cannot lock for
  4 s (`jammed`), and torpedoes it has in flight go blind. With a **partial
  field** the target keeps its lock but its sensors can only fix the blocks
  outside the field: for 4 s (`partialJam`) its fire is steered at the
  nearest uncovered block (aim type `unjammed`, `BS.Ships.effectiveAim`,
  with the aim accuracy penalty). A half-covered field is therefore a
  liability that focuses the enemy on whatever sticks out, nacelles
  included; the Jammer boat covers only its core, so a jam from it pushes
  your fire onto its wings. Sensor arrays are the counter to the roll.
- **Cloaking device** (block `C`, several per ship, module F7, 5 power,
  250 cr): a ship can cloak only while every alive block is inside a cloak
  field; otherwise the module reads "no field" and Engineering says how
  many blocks are outside (`cloakRefused`). Losing a device or a section
  while cloaked collapses the cloak (`cloakChanged` reason `field`, forced
  decloak with the surge). A Constitution needs three (saucer plus two in
  the engineering hull, `Shadow hunter`), the Shadow Bird-of-Prey five.
  The Ambush play falls back to fighting (`noCloak` condition) when the
  field is broken. 3 s to cloak. Cloaked, a ship cannot be locked (locks
  on it drop), its shields are down, its weapons are cold and its
  capacitor drains 8/s (it decloaks by itself below 5). It is invisible beyond the viewer's detection range
  (`science.cloakDetectRangeKm` 10 km + 1 km per sensor array) and a faint
  ghost inside it, still unlockable. Decloaking takes 2 s and shields stay
  down for 5 s more (surge). The helm loses an invisible target and holds
  course. `BS.Ships.visibility(ship, viewer)` is the one rule the renderer,
  the overview, hover targeting and the helm all use.
- **Shields through the cloak** (`BS.Ships.shieldsUp`): down means not
  projected. The facing pools are kept while cloaked or surging (they used
  to be zeroed, so an ambusher fought every strike from zero), absorb
  nothing, are not drawn, and recharge at the condition-green rate; the
  booster still fills them. A ship comes out of cloak with the shields it
  went in with.
- **Decloak strike** (`ew.strike`, both sides): for 10 s after decloaking
  (`cloak.strike`), every hit the ship lands deals ×2 and 60% of it skips
  the target's shield straight into the hull (`result.strike`); Tactical
  calls the window open, Engineering warns when it is done to you. The
  strike is what a cloak is for: with aim at reactors it breaches them
  through a full shield. Shadow enemies carry it too, at ×1.2 base damage
  instead of the Bird-of-Prey's ×1.6.

### Shields
Four facing pools (80 base + 70 per emitter on that facing, `grid.shieldBase /
shieldAdd`). Passive regen is low (0.6/s per facing plus 0.4 per emitter);
the booster (+50 to the weakest facing per 4 s) is the real tank, but no
longer out-heals a focused attack. Reinforce moves 45% of the strongest
facing to the weakest over 3 s with a 20 s cooldown. Weapons must be armed
(red alert) for full regen.

**Shield cover** (`grid.shieldRadius`, 5 cells): each alive emitter projects
a bubble; a block is covered while it lies within the radius of at least
one emitter (`b.covered`, `b.coverBy` = nearest emitter, recomputed in
`derive`). A shot that lands on a covered block draws from the pool of the
**covering emitter's facing**; a shot that lands on an exposed block skips
the shield entirely (`result.exposed`), and the ripple sits on the
covering bubble, not the hull. Losing an emitter bares real hull. The
renderer draws the union outline of the bubbles per ship, each arc in the
colour of the facing it feeds; the hangar paints exposed cells red and
shows "cover n% (m exposed)"; the layout validator warns below 90% cover.
Aim type **exposed** (EXP chip, hover highlight) steers shots at the
nearest uncovered block; enemy profiles aim at it 10% of the time
(`targetWeights.exposed`). Default layouts were re-placed for 93–100%
cover (nacelle tips stay bare on some hulls).

Fixed in 0.8.0: since 0.6.0 the emitter bonus was added under an angle key
instead of a facing, so every facing had been 80 whatever the build. Enemy
multipliers were re-tuned for the real pools (see §8).

### Doctrine machine (`BS.EnemyAI`, `enemyAI.doctrines`, `enemyAI.default`, `enemyAI.ktinga`)
One state machine drives both ships: the enemy with the doctrine its
encounter names, the player with the doctrine of the chosen stance (above).
`BS.EnemyAI.update(ship, target, dt)` runs for each; module management,
target re-rolls and the retreat below apply to enemies only. State changes
emit `stateChanged` (the enemy's are called by Tactical, the player's by
Helm: "coming around for another pass", "kiting"), orbit reversals
`orbitFlipped`.

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

Enemy damage is ×1.5 for a Bird-of-Prey (`damageMult`; an encounter may
override it: Torpedo boat ×1.25, Shadow ×1.2) and strength 140% + 4% per win.

**Enemy plays** (`campaign.encounters[].play`): an encounter may name a play
from `helm.plays`; the enemy bridge then runs the same phase machine as the
player's (`BS.Plays.update` for both ships, `BS.Plays.available` falls back
to the doctrine when the required module is missing). While an enemy runs a
play its weapons, hardener and booster follow the phase policies; jammer,
aim re-rolls and the once-per-battle retreat stay with the profile, and a
new phase keeps the retreat flag and pass count (`carryAI`). The Overview
status reads "Play · state". The Torpedo boat runs **Siege** (it holds
station and fires every tube, hence its ×1.25). The Shadow keeps its ambush
doctrine and the K't'inga Siege its siege doctrine: both were measured on
the Ambush / Siege plays and turned unkillable (12 s decloaked windows) or
trivial (ran from a closing Galaxy without firing). The Gunboat ran Hit &
fade in 0.10.0–0.11.0 and went back to the brawl doctrine in 0.12.0: with
cannons its fade phase produced 8–10 minute stalemates.

| Doctrine | Used by | Behaviour |
|---|---|---|
| **strafe** | Raider, some variants | `run_in` at the player with the afterburner (cap > 50%) → `pass`: a 12 s orbit at 3 km with everything firing, afterburner off so it can hit → `break_off` to 8 km → `turn_in` 2 s on a new bearing → run in again. Each pass arrives on a different facing. |
| **brawl** | Gunboat, some variants; player Engage / Skirmish | Orbit at 3.5 km, afterburner only above 70% cap, flips orbit direction every 20 s (enemy), after 4 s of tail chase (angular velocity < 0.15 rad/s) or by auto-flip; the enemy comes about when the facing < 22% and a stronger one exists. |
| **evade** | player Disengage | Keep at 24 km with the afterburner; never re-engages by itself. |
| **standoff** / **siege** | Torpedo boat / K't'inga Siege | Keeps at 14 km (17 km for siege) firing torpedoes; when the player closes inside 9 km (11) it kites with the afterburner to 17 km (20) for up to 15 s. |
| **broadside** | K't'inga, some warlords | Holds a 4.5–7 km band (inside disruptor optimal) on a slow course with Come about, presenting the strongest shield; rolls to a fresh shield every 30 s or when the facing drops below 22%. |
| **ambush** | Shadow (Bird-of-Prey with a cloak) | `stalk` cloaked toward the player, `uncloak` at 4.5 km, a 12 s firing pass at 3 km, break off to 10 km and cloak again. |

Enemies with jammer blocks run them whenever engaged and above 30% cap.

The K't'inga profile reacts slower, retreats later and keeps its own
`statMult` (0.9 before scaling). Nothing orbits the player at 6 km any
more, so a player orbit no longer turns into a two-ship tail chase; the
fitting answer differs per doctrine and is picked as a stance (Engage
closes on a standoff ship, Skirmish out-tracks a brawler) while the helm
handles the flips.

### Enemy scan panel (`#scan`, `BS.UI.updateScan`)
The bottom row shows the locked enemy (no lock: a prompt; cloaked: "sensors
show nothing"). Left, a top-down drawing of its block grid through
`BS.Renderer.drawGridShip` with damage tint, the shield bubbles, bare hull
in red, cloak-field gaps in purple, ECM-field gaps in green and the aimed
block type framed in yellow. Right, three columns: hull and the four
facings with cover and fields; systems alive / total per block type with
crew manning, power factor and heat; tactical: how many of its alive
weapons bear on us (`BS.EnemyAI.bearingCount`), its orders (doctrine or
play phase and state), range, speed and angular velocity, the threat (its
beam hit chance on us, its torpedo damage multiplier on us) and its cloak
state including the decloak strike countdown. The bridge log moved into a
two-line ticker at the top-left of the tactical view; LOG (key G) expands
it to the full scrollable log. `science.scanDuration` stays reserved for a
later science scan that gates this detail.

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
balance: { ..., capCurve, lockBase, lockRefSignature, lockRefSensor, zoom: { min, max, step, start, autoMin, autoMax, fitMargin, lerp, biasMin, biasMax } }
helm: { defaultStance, reactionDelay, stances: { id: { label, key, doctrine, desc, ranges: { field: [ref, fraction, ..., fallbackKm] } } }, flipMinInterval, flipShieldLow, flipShieldHigh,
        playPolicy: { boosterBelow, boosterMinCap, reinforceBelow, minPhaseTime },
        plays: { id: { label, key, desc, say, requires?, phases: [{ label, stance | doctrine, modules, governor, aim, repair, booster, reinforce, minTime, until, untilAll, next, say }] } } }
subsystems: { weapons, torpedoes, engines, shields, sensors, bridge: { label, short, effect, targetReport, damaged, repaired } }
subsystemEffects: { sensorsAccuracyFloor, sensorsLockMaxMult, bridgeCapMinMult, targetAccuracyMult }
modules: { id: { slot, kind: turret|launcher|active|passive, name, short, cycle, cap, pg, cpu, cost, desc, ...stats, effect } }
grid: { cellPx, structureHp, structurePierceCost, shield*/regen*/cap*/thrust*/sensor*/repair*, shieldRadius, powerPerReactor, brownoutMin, heat: { base, perBlock, dissipationBase, dissipationPerRimCell, overloadTime, aiFireBelow, governorHigh, governorLow },
        hitScatter, penetration, lineOfFire, lineOfFireStep, lineOfFireMuzzle, lineOfFireRangeCells, torpedoSplash, aimRadius, aimScatter, deadFraction,
        variant: { fraction, attempts, systemWeights }, maskLegend, layoutLegend }
blocks: { type: { letter, name, short, hp, mass, cost, power, color, desc, unique?, pierceCost?, explosion?: { damage, radius }, weapon?: { ..., heat } } }
modules: { phaser_group, torpedo_group, shield_booster, shield_hardener, afterburner, jammer (block-bound active, effect.jam), cloak (kind "cloak", block-bound) }
ew: { jamPerBlock, jamDuration, cloakTime, decloakTime, surgeTime, cloakDrain, cloakMinCap, detectPerSensor, ghostAlpha, ownCloakAlpha }
shipClasses: { id: { name, className, role, faction, cost, purchasable, speed, turnRate, signature, lockRangeKm, powerBase,
                     mask: [rows], layout: [rows], presets: { id: { name, desc, rows } }, variants: { id: { name, desc, rows } } (enemies),
                     aiProfile?, visual: { kind, sprite, nacelleColor, hullTint } } }
crew: { officers, reports, events (battleStart is templated with {className}, {name}, {range}), hailReplies }
enemyAI: { doctrines: { id: { kind: strafe|brawl|standoff|broadside|ambush|evade|approach, engageKm, ...per-kind ranges and timers, tailChaseAngular, tailChaseTime } }, stateLabels,
           default | ktinga: { doctrine, accuracyMult, reactionDelay, statMult, damageMult, retreat*, reposition*, retreatRangeKm, booster*, afterburnerMinCap, targetWeights (none = spray) } }
campaign: { startingCredits, credits, salvage: { destroyed, disabled }, enemyScaling, encounters: [{ id, enemyClass, layout, doctrine, minWins, weight, rewardMult }], klingonNames }
visuals: { starLayers, nebulae, shieldColors, shake*, fragments: { sectionLife, deathLife, deathPieces, driftSpeed, deathSpeed, spin, fadeFrom } }
skills (real-time training), science, saveDefaults (version 2: layouts, builds, skills)
```

Runtime ship: `pos, vel, heading, speed, hull, shields{4}, capacitor, capMax,
subsystems{6}, lock{target, progress, locked, time}, selected, targetSubsystem,
cmd{type, target, range, point, orbitDir, facing}, modules[{id, def, slot,
active, running, cycleLeft, cycleTime, state}], fitEffects, activeEffects,
repairPriority, reinforce, stats, mods, aiProfile, ai{state, timer, suspended, relock, ...}, stance, doctrine, play{id, def, phase, t, target}`;
block: `covered, coverBy` from derive.

## 7. Events
`lockStarted, lockAcquired, lockLost, moduleToggled, moduleCycle,
moduleOffline, shieldBoosted, phaserFired, torpedoLaunched, torpedoHit,
torpedoExpired, shieldHit, hullHit, blockDestroyed, sectionLost,
blockExploded, shipDisabled, shipDestroyed, overload, jammed, cloakChanged,
alertChanged, stateChanged, orbitFlipped, stanceChanged, playChanged, playPhase, enemyRolled, commandGiven,
log, battleStarted, battleEnded, skillTrained`.

## 8. Measured balance (accelerated simulation, scripted captains, default builds, no skills)

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

v0.13.0 (crew manning, quarters added to every layout in interior cells,
cannon 32 / 2.5 s; 1–3 runs):

| Matchup | Captain | Outcome |
|---|---|---|
| Constitution vs Raider | Engage / Skirmish / no orders | 3 of 3 in 2:36–3:48 keeping 78–88% / 3:05 keeping 99% / lost in 4:30 |
| Constitution vs Raider | Siege / Ambush (Shadow hunter) / Brawler Engage | 2 of 3 in 2:59–3:05 keeping 70–78% / 3 of 3 in 3:42–5:59 keeping 80–95% / 2:33 keeping 91% |
| Constitution vs Gunboat / Torpedo boat / K't'inga broadside | Engage | 2 of 2 in 3:40–4:16 keeping 75–84% / 1 of 2 (one stalemate at 15 km) / 4:42 keeping 79% |
| Galaxy vs K't'inga Siege | Engage | 3:21 keeping 100% |

With the 42-damage cannon (first 0.13.0 batch) Siege was 1 of 3 and Ambush 1 of 3: ×1.5 bolts
one-shot a 50-hp rim system before damage control could touch it, which the
block rules promise never happens, hence the retune. Manning stayed at 100%
in every traced fight: quarters sit inside the hull now and the systems die
before the crew runs short, so the mechanic bites mostly in the editor and
when crew decks are targeted.

v0.12.0 (disruptor cannons on every Klingon; measured at 42 / 3.2 s, re-tuned to 32 / 2.5 s in 0.13.0 because ×1.5 bolts one-shot rim systems,
pulse phasers 9.5 / 1 s / tracking 1.6; broadside band 4.5–7 km; 2–4 runs):

| Matchup | Captain | Outcome |
|---|---|---|
| Constitution vs Raider (cannons) | Engage / Skirmish / no orders | 2 of 3 in 3:13–3:19 keeping 77–78%, one disabled loss / 2 of 2 in 2:12–3:59 keeping 98–99% (cannons cannot track the burn) / lost in 2:26–3:52 |
| Constitution **Brawler** (6 pulse, 4 cannons) vs Raider | Engage / Skirmish | 4 of 4 in 1:32–2:17 keeping 89–96% / 2:57 keeping 100%: pulses hit a Bird-of-Prey every time inside 4 km |
| Constitution vs Raider | Siege / Turtle / Ambush (Shadow hunter) | 2 of 2 in 3:32–5:17 / 1 of 2 / 2 of 2 in 7:11–7:20 keeping 69–90% |
| Constitution vs Gunboat (11 cannons, brawl doctrine) | Engage / Skirmish | 3 of 4 in 4:12–7:01 keeping 78–88%, one stalemate / 4:04 keeping 99%. With 11 pulse guns on Hit & fade it won 2 of 3 against the player; with 7 pulse + 4 cannons 1 of 4 |
| Constitution vs Torpedo boat / vs K't'inga broadside (cannons, 4.5–7 km band) | Engage | 2 of 2 in 4:30–4:44 keeping 77% / 2 of 2 in 3:31–4:56 keeping 97–100% |
| Excelsior vs K't'inga broadside / Galaxy vs K't'inga Siege | Engage | 3:47 keeping 98% / 3:20 keeping 99% |

Honest reading: cannons make Klingons hit harder but miss a fast orbit, so
Skirmish and the pulse-armed Brawler get easier while Engage trades about
the same hull as before; the K't'inga is now soft at 4+ wins and could use
the ×1.33 going up next pass.

v0.11.0 (cloak and ECM fields; Shadow hunter re-fitted with three cloaking
devices and no jammers; 6 runs): Shadow hunter Ambush vs Raider **5 of 6 in 2:41–9:06 keeping 63–97%**, one loss (it no longer breaks the raider's lock, so it trades more hull than in 0.10.0).
Engage vs Shadow (five devices) 2 of 2 in 2:42–2:47 keeping 83–88%; Engage
vs Jammer boat (partial field, pushes fire onto its wings) 3 of 3 in
3:26–6:05 keeping 76–85% (in 0.7.0 its lock-breaking won 3 of 4).

v0.10.0 (firing-bearing keep, shields kept through the cloak, decloak
strike, enemy plays; Bird-of-Prey ×1.4 / ×1.5, Torpedo boat ×1.25, Shadow
×1.2; 2–3 runs each, some matchups re-measured across several tuning rounds,
so counts above 3 are totals). Play captains lock, start the play and do
nothing else; stance captains run weapons, hardener, a pulsed booster and
Reinforce.

| Matchup | Captain | Outcome |
|---|---|---|
| Constitution vs Raider strafe (0 wins) | Engage | 3 of 3 in 1:41–5:02 keeping 70–94% |
| Constitution vs Raider strafe | no orders | lost in 2:43–3:41 |
| Constitution vs Raider strafe | Skirmish | 2 of 2 in 3:09–3:22 keeping 87–92% |
| Constitution vs Raider strafe | **Siege** | **3 of 3 in 2:32–4:43 keeping 70–79%** (was 1 of 3): holding station the tubes fire on the run-in, and "repelling" now comes back to bombarding |
| Constitution **Sniper** vs Raider / vs Torpedo boat | Siege | 0 of 1 / 0 of 4: four bow tubes and four phasers lose the duel to a ×1.25 Torpedo boat that now fires all three tubes, and cannot hold off a strafer. Engage wins both instead |
| Excelsior **Lancer** vs K't'inga broadside (4 wins) | Siege | **3 wins, 2 ten-minute stalemates, 0 losses** (was 0 of 3): 3:16–8:37 keeping 89–97% when it wins; holding station keeps the six tubes on the cruiser while it closes |
| Excelsior Lancer vs K't'inga Siege (6 wins) | Siege | 0 of 3 (one stalemate): the cruiser also holds station now and its four ×1.33 tubes plus disruptors out-duel six tubes. Galaxy Engage still wins it untouched in 3:54 |
| Constitution **Shadow hunter** vs Raider | **Ambush** | **6 of 7 in 2:08–8:44 keeping 73–92%**, one stalemate (was 0 of 3): shields come out of cloak intact, the 10 s decloak strike at the reactors breaches them |
| Constitution vs Raider strafe | Alpha strike / Turtle / Hunter / Hit & fade | 1 of 2 / 2 of 3 / 2 of 3 / 2 of 2; wins in 2:34–4:36 keeping 75–87%. Same spread as 0.9.0 |
| Defiant vs Raider strafe | Hit & fade | 4:26 keeping 98% |
| Constitution vs Gunboat on **Hit & fade** (1 win) | Engage / Hit & fade | 3 of 3 in 4:17–8:24 keeping 84–91% / 2 of 2 in 4:18–4:25 keeping 72–92%: its fade phase stretches the fight |
| Constitution vs Torpedo boat on **Siege** (1 win, ×1.25) | Engage | 2 of 2 in 4:11–4:21 keeping 75–86%; it holds station and lands every torpedo, so Engage now costs hull |
| Constitution vs Shadow ambush doctrine (3 wins, ×1.2) | Engage | 2 of 2 in 2:31–3:01 keeping 85–89%; on the Ambush play it was 0 of 6 (unkillable 12 s windows), so it keeps the doctrine |
| Galaxy vs K't'inga Siege (6 wins) / Constitution vs K't'inga broadside (4 wins) | Engage | 3:54 keeping 99% / 4:09 keeping 91% |

Honest reading: Siege and Ambush now win with the builds they were made
for (default Constitution vs the raider, Lancer vs the cruiser, Shadow
hunter vs the raider); pure torpedo duels against the enemy's multipliers
(Sniper vs Torpedo boat, Lancer vs K't'inga Siege) are still lost and the
answer there is to close in. Engage still loses 10–30% rather than 30–50%:
Bird-of-Prey damage ×1.6, ×1.7 and ×1.8 were measured and turned Engage,
Turtle and Hunter into coin flips (wins keeping ~80% or a disabled loss)
because a stripped phaser rim snowballs, so ×1.5 stays. The biggest
balance shift is the keep geometry itself: standoff enemies fire every
tube now.

v0.9.0 (150 px/km, plays; 3 runs each, same enemy multipliers as 0.8.0). The
world rescale changed nothing in km, and Engage vs the raider re-measured at
2:24–2:38 keeping 83%. Play captains lock, start the play and do nothing else.

| Matchup | Play | Outcome |
|---|---|---|
| Constitution vs Raider strafe (0 wins) | Alpha strike | 3 of 3 in 2:36–3:04 keeping 81–85% |
| Constitution vs Raider strafe | Hit & fade | 3 of 3 in 3:11–3:41 keeping 84–95% |
| Constitution vs Raider strafe | Turtle / Hunter (earlier run) | 2 of 3 / 2 of 3; Turtle 2:42–3:37 keeping 80–85% when it wins |
| Constitution vs Raider strafe | Siege | 1 of 3: two tubes from 15 km do not kill a strafer |
| Constitution **Sniper** (4 tubes) vs Raider | Siege / Alpha strike | 0 of 3 / 3 of 3 in 3:29–4:31 keeping 75–82% |
| Constitution Sniper vs Torpedo boat | Siege | 0 of 3: a torpedo duel at range goes to the ×1.5 damage side |
| Excelsior **Lancer** (7 tubes) vs K't'inga | Siege | 0 of 3 (one 10-minute stalemate at 81%) |
| Constitution **Shadow hunter** vs Raider | Ambush | 0 of 3: six phasers in 35 s bursts cannot out-damage a strafer between cloaks |
| Constitution vs Gunboat brawl (1 win) | Alpha strike / Hit & fade / Turtle / Hunter | 3 of 3 each, 2:39–4:59, keeping 63–97% |
| Constitution vs K't'inga broadside (4 wins) | Alpha strike / Hit & fade / Turtle | 3 of 3 in 2:48–6:07 / 2 of 3 / 3 of 3 in 3:40–5:22 keeping 85–100% |
| Defiant vs Raider strafe | Hit & fade | 3 of 3 in 4:00–4:23 keeping 82–99% |

Honest reading: the brawling plays (Alpha strike, Hit & fade, Turtle,
Hunter) all work and differ in how much hull they trade; the standoff
plays do not. **Siege** and **Ambush** lose with every stock build tried,
because torpedoes do little to small fast hulls and a cloaked ship cannot
fire. They stay in as data for torpedo-heavy and cloak builds the player
may invent, and are the first thing to re-tune.

v0.8.0 (shield bubbles, stance helm, shield-facing fix, Bird-of-Prey ×1.4 strength /
×1.5 damage; 3 runs each). The captain picks a stance at t = 0, locks, keeps
weapons on, pulses the booster below 50% facing, hardener above 20% cap and
Reinforce below 20%; the helm does the rest. "No orders" is the default
Engage stance with nothing locked or armed.

| Matchup | Stance | Outcome |
|---|---|---|
| Constitution vs Raider **strafe** (0 wins) | Engage | 3 of 3 wins in 2:05–3:14 keeping 85–91% block hp |
| Constitution vs Raider strafe | Skirmish | 3 of 3 wins in 3:18–5:04 keeping 72–90% (slower, as intended) |
| Constitution vs Raider strafe | Standoff | 0 of 3: two tubes cannot kill a strafer from 15 km; a stance for torpedo builds |
| Constitution vs Raider strafe | no orders | lost in 2:52–3:39 (disabled or hull fraction) |
| Constitution vs Gunboat **brawl** (1 win) | Engage / Skirmish | 3 of 3 in 2:52–4:47 keeping 81–89% / 3 of 3 in 3:47–4:37 keeping 97–98% |
| Constitution vs Torpedo boat **standoff** (1 win) | Engage | 3 of 3 in 3:37–3:56 untouched (Engage chases it down) |
| Constitution vs K't'inga **broadside** (4 wins) | Engage | 3 of 3 in 4:43–5:35 keeping 88–100% |
| Excelsior vs K't'inga broadside | Engage | 3 of 3 in 4:44–5:16 keeping 94–99% |
| Galaxy vs K't'inga **siege** (6 wins) | Engage | 3 of 3 in 2:50–4:20 keeping 98–99% |
| Constitution vs Shadow **ambush** (3 wins) | Engage | 3 of 3 in 2:29–3:28 keeping 90–99% |
| Constitution vs Jammer boat (2 wins, seeded) | Engage | 3 of 3 in 2:53–4:41 keeping 81–87%: the tactical officer now re-locks on its own |
| Miranda vs Raider strafe | Skirmish | 1 of 3 (8:53), two 10-minute stalemates: the fast orbit out-tracks the raider both ways |
| Defiant vs Raider strafe | Skirmish | 3 of 3 in 3:31–7:21 keeping 89–94% |

Against the stated targets: the straightforward (Engage) fight lands at
2–5 min but loses 10–20% rather than 30–50%; the speed tank (Skirmish)
wins slower and nearly untouched as intended on the Constitution and
Defiant, and stalls on the Miranda; no orders loses in about 3 min. The
bigger hulls are comfortably ahead of the cruiser at their unlock wins.
Headless only; no hand play this session.

v0.7.0 (power grid, heat, electronic warfare; straightforward captain with
orbit and reverse commands, 4 runs each; measured while the shield-facing
bug kept every facing at 80):

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
| v0.8.0 (done) | Shield bubbles (cover radius, exposed hull), stance helm (Engage / Skirmish / Standoff / Disengage, auto-flip), shield-facing bug fix and re-tune |
| v0.9.0 (done) | World scale 150 px/km with an auto-fitting camera; plays (Alpha strike, Siege, Turtle, Hunter, Ambush, Hit & fade) as scripted phase sequences |
| v0.10.0 (done) | Firing-bearing keep geometry (hold station, kite with guns bearing), shields kept through the cloak, decloak strike, Siege and Ambush re-tuned, enemy plays (Gunboat Hit & fade, Torpedo boat Siege) |
| v0.11.0 (done) | Cloak and ECM fields: a ship cloaks only with every block inside a cloak field (several devices per hull), a partial ECM field steers the jammed enemy's fire onto the uncovered blocks |
| v0.12.0 (done) | Disruptor cannons (punch, penetration, poor tracking) and pulse phasers (tracking, knife range) as blocks and weapon groups; Klingons mount cannons |
| v0.13.0 (done) | Crew: systems need hands, the bridge and crew quarters supply them, manning slows weapons and shields, blocks far from quarters repair slowly; every layout re-fitted |
| v0.14.0 (done) | Enemy scan panel in place of the full-width log (block grid with damage, shield bubbles and bare hull, cloak / ECM field gaps, systems, crew, power, heat, weapons bearing on us, threat); the bridge log is a two-line ticker over the display, LOG / G expands it |
| later | Science scan (`science.scanDuration`) gating the panel's detail; weakness bonus |
| later | Fire spreading put out by crew quarters; reactor power range; audio; sector map; sprites |
| later | Audio via events, sector map and missions, science scans and cloaked ships, optional image sprites |
