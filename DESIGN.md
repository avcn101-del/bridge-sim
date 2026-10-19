# DESIGN.md — Bridge Sim

Version: 0.40.0 (the campaign harness; heat measured and removed); direction in §10. Keep this file in sync with the game.

## 1. Concept: WoW raids, in Trek ships, in an arena

**You are the admiral of a fleet of up to four starships. You win a boss
by preparing right, never by flying.** Decided 2026-10-19 (§10): the
game is a raid game. Three pillars, each borrowed on purpose:

| Pillar | Borrowed from | In this game |
|---|---|---|
| **Roles and bosses** | World of Warcraft raids | A party of four with tank, healer and damage roles that come from the blocks on a hull; bosses with public rules, tells, adds and an enrage; composition is a choice the boss forces |
| **Ships, bridges, crews** | Star Trek | Hulls are block grids in Trek masks with four shield facings; a bridge runs each ship on a script and the crew calls the fight out; Klingon raiders, a Borg cube |
| **The arena** | Arena games | A fight is 3–7 minutes in open space, N against M, no map, no travel; everything that matters is on screen |

The player's craft is **preparation**: build the hulls, write one bridge
script per hull (ordered when → do rules), read what is known about the
next enemy, dry-run, undock. In the fight the player watches and has two
bridge calls. The report says which rule fired, which never could, and
who died of what. Then back to the hangar.

Every system in this file must answer one question: **which step of the
loop in §2 does it serve?** A system that serves none is cut (§10,
"Streamline"). Decided parameters that stand:

| Topic | Decision |
|---|---|
| Control | The script has the conn (§4 "Bridge scripts"); movement is the helm's doctrine machine; the player's live input is two bridge calls a fight |
| Fleet | Up to four hulls a side; roles from blocks on role cells; one script per hull |
| Encounters | Runs of skirmishes (1v1, 4v4) leading to a boss (`campaign.run`); enemy fleets are built from the same templates the player has; bosses are hand-built hulls with their own script |
| Losing | A lost hull is a repair bill, never permanent |
| Units | km and km/s in the interface (`units.pxPerKm` 150); a Constitution is about 1 km, three times its real size, so blocks stay readable; the camera fits every ship |
| Shields | Four facings (fore / starboard / aft / port) |
| Crew | Voices and warnings only; orders execute instantly |
| Battle length | 3–7 minutes; every boss has an enrage |
| Difficulty | Comes from boss mechanics and composition, not from stat scaling; the harness proves the intended answer wins and the naive one loses (§8) |
| Sound | None yet; events exist for an audio module |

## 2. Gameplay loop

1. **Hangar** = raid preparation. Build each hull from blocks (role blocks
   only on role cells); write or pick a script per hull; set the roster
   (up to four); read the Intel box (the next enemy's hull, weapons,
   doctrine, the boss's public rules); dry-run against it; **Undock**.
2. **Run** = the dungeon. Skirmishes (solo or fleet) lead to a boss slot
   every sixth battle once the fleet has two hulls. Skirmishes teach a
   mechanic; the boss tests it.
3. **Battle** = watch. Every bridge runs its script; the crew calls out
   the boss's tells; the player has two bridge calls (doctrine, side,
   disengage, reinforce, focus a block, remodulate). 3–7 minutes.
4. **Report** = the combat log. Victory or defeat, time, damage, which
   rule stood when the damage landed, which rules never fired and why,
   each hull's fate, credits, salvage, the repair bill. Return to the
   hangar and fix the script.
5. **Progress**: credits buy hulls and blocks (gear); understanding the
   boss buys a better script (skill). Enemies scale +4% a win up to +40%
   (`enemyScaling`; a fleet encounter takes `fleetFactor` of it, 1 since
   it was measured, §8 v0.45, and its ships' hull and damage multipliers
   are scaled back by `fleetStatMult` / `fleetDamageMult` 0.8, since the
   1v1 profiles compound four times in a 4v4, §8 v0.46);
   the real difficulty is the next boss's mechanic.

Decision pressure: the build (what each hull can do at all), the roster
(who comes), the script (what each bridge does when), the two calls.
Movement is the helm's job; the player never steers.

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

### Battle report since 0.24: timeline, never fired, refit & retry
The result overlay adds a **Clean bridge** row (a win with no bridge call
spent pays `script.bridgeCall.noCallBonus` ×1.2 on the win credits before
salvage, and counts `save.campaign.cleanWins`, shown in the hangar record
as "n clean"), the script's **timeline** (every trace entry: time, rule or
CALL, sentence, then the end: enemy destroyed / disabled / captured, ship
lost, stalemate) and **Never fired**: every standing rule and call-out
that never fired, with the reason from `BS.Script.explain(ship)`. The
engine records per tick the extremes of what the conditions measure
(`script.extremes`: closest and farthest range, lowest weakest and engaged
facing, lowest capacitor and hull on both sides, the first time each flag
condition held) and, per rule, the
first time its conditions all held and what stood above it then. The
reason is the first condition that never held, with how close it came
("they never came inside 5 km (closest 6.2 km)", "our weakest shield never
fell under 25% (lowest 41%)", "we never scanned them"), or "it held at
01:41 but rule 2 stood above it". The dry run shows the same reasons.
**Refit & retry** pins the enemy just fought (`save.campaign.retry = {
encounterId, seed, battlesWon }`): `BS.Campaign.encounter()` re-rolls from
that seed and unlock pool, so the hangar's "Retry:" line, the intel on
file, the dry run and the next undock all meet the same ship, layout and
name. A lost fight
still counts (loss credits, streak reset). The pin clears when that fight
is settled, or with *Let it go* in the Intel box.

**Why you lost / What carried it** (0.26): before *Never fired*, the pair
of standing rules (theirs | ours) under which the largest share of the
damage landed ("61% of the damage we took landed while their r4 stood:
'The cruiser is opening the range under our strike' … and our r2 stood:
'When our weakest shield is under 25%: fly Disengage'"). Every shield or hull hit is
booked to the rules standing at that moment (`state.attrib`, events
`shieldHit` / `hullHit`), so the sentence names what actually hurt, not
a guess. (0.36: the style tags and the doctrine table's sentence are
gone with the learning line, §10 "Streamline".)

**Tuning** (0.29): the *Why you lost* block opens with "Our Graviton
ammo vs their shields Polaron ×1.00 · armor Polaron ×1.00" and the same
from their side (`BS.Grid.tuningSummary`, dead blocks counted).

**Their bridge** (0.25): under *Never fired*, every rule of the enemy's
script that fired, with the time and, for a reaction, the callout Tactical
read out ("The cruiser is coming about to bring its batteries round").
The enemy's script itself stays hidden; what it did is on record.

### Battle screen since 0.23: watch, trace, bridge calls
The tactical view is the screen; the captain does not fly. Left panel as
before (ship, blocks, target). The right panel opens with **Bridge calls**:
`script.bridgeCall.tokens` (2) per battle, shown as ● ● → ○ ○, never
refilled. Buttons: *Fly* (a labelled doctrine for `holdSeconds` 45 s),
*Change side* (45 s), *Disengage* (until the weakest shield is back over
`disengageUntil` 60%, at most 45 s), *Reinforce* (at once), *Focus block*
(tap a block on the scan drawing, a weak-point line or the enemy on the
display, then confirm: every weapon on it for `focusSeconds` 30 s). A
button pressed once arms ("Confirm · 1 call") for `confirmSeconds` 3 s and
fires on the second press. A call is an override rule on the running
script (`BS.Script.bridgeCall`, `script.override`): it stands above every
rule until its until / holdMax, then the trace says "bridge call over: the
script has the conn" and the script re-picks. Events `bridgeCall` (with
`state.callLog`) and `bridgeCallRefused`; the Helm officer acknowledges.
The **trace band** under the log ticker shows the last three rule firings
("00:41 CALL BRIDGE CALL: keep to their blind (at most 45 s)"); the full
log keeps them all. The scan panel adds *Standing* (the rule in force, or
the call) and *Aiming* (what the weapons are on, and a focus candidate
waiting for confirmation). **Speed** 1× / 2× / 4× (`balance.speeds`,
`balance.maxStepsPerFrame`) in the top bar; Space pauses. Since 0.37 there
is no hand-flown bridge at all: a click or tap on an enemy block only
nominates it for the Focus call, the module bar, subsystem rows and part
chips are displays, and the keys are Space, G (log) and Escape. The top
bar keeps Hail, Red alert and the heat governor. On a phone the ORDERS
drawer is BRIDGE.

### Hangar: plan and script editor (0.22, `js/hangar.js`)
The left column of the hangar carries the pre-battle thinking:
- **Plan** under Intel: up to `script.planTargets` (3) targets on the next
  enemy, in order. With intel on file, tap a block on the intel drawing
  (numbered orange markers; tap again to remove); without, three dropdowns
  by block type. Saved per encounter (`save.plans[encounterId]`, with the
  layout rows it was made on). Rules with `aim: plan target n` read it.
- **Script**: a dropdown of the seven templates (read-only) and the player's
  own scripts; *Copy as new* makes an editable copy, *Rename*, *Save*,
  *Delete*, and three assign buttons, one per encounter kind (0.43 /
  0.44): *Boss: assign* (`save.scriptByBuild[classId]`, "✓ Flies it
  against a boss", also the default for the other kinds), *Fleet skirmish:
  assign* (`save.fleetScriptByBuild[classId]`, "✓ Flies it in a
  skirmish") and *Alone: assign* (`save.soloScriptByBuild[classId]`, "✓
  Flies it alone"), so a boss script with no 1v1 or pack rules never has
  to fight a solo encounter or the pack. Each rule is a card: number, kind (Standing orders /
  Once / Every N s), ▲ ▼ ✕, a WHEN line of terms, a DO line of terms, and
  for standing rules an UNTIL line and "At most N s" (`holdMax`). Terms
  are built from dropdowns whose labels are the sentences in
  `script.conditions / actions` (`{v}` becomes a number box for km, s and
  counts, a 0–100% slider in steps of 5 for fractions, on / off, or a
  dropdown of doctrines, sides, block types, weak-point kinds and plan
  targets; modules appear as "<module> on / off"). Under each card the rule
  reads back as a sentence from `BS.Script.describe`; warnings under it
  say when an aim needs a scan rule, when an Otherwise rule sits above
  other standing rules, or when a rule does nothing. At most
  `script.maxRules` (12) rules. Policies are checkboxes.
- **Doctrine** (0.29, `#hg-doctrine`): the tuning ring as chips
  (Graviton → Nadion → Tetryon → Polaron → Antiproton → Graviton), the one
  rule, the factions and the surcharge, "Your Graviton ammo vs their
  Polaron shields: ×1.00 · their Polaron ammo vs your Nadion shields:
  ×1.00" (from intel, else the faction default), and each modulation's
  sentence with its measured numbers, and (0.39) three dropdowns, one
  modulation each for weapons, shields and armor. The Intel box adds
  "Tuning: theirs … · yours …"; the Build stats carry a Tuning line.
- **Dry run vs next enemy**: `BS.Game.dryRun(script, onProgress, onDone)`
  sets up the battle exactly as Undock would (same build, same seeded
  enemy, this script) with `dry: true`, so no interface changes, and steps
  it in chunks of `script.dryRun.stepsPerChunk` between frames up to
  `maxSeconds` (600); nothing is settled or saved. The result line reads
  "Victory (disabled) in 02:58 · our blocks 85% · their hull 41% · scanned"
  followed by the first eight trace lines. Hit rolls are random: it is one
  possible fight. Closing the hangar cancels a running dry run.

### Compact mode (phone landscape, `css/lcars.css` `@media (max-height: 540px)`)
Under 540 CSS px of height the tactical view fills the screen under a 36 px
top strip. The Ship / Target panel, the Orders panel and the Scan panel
become drawers (`body.drawer-status / drawer-orders / drawer-scan`) opened
by the SHIP / SCAN / ORDERS tabs in the top strip (`#drawer-tabs`, hidden on
desktop); on a screen under 700 px wide opening one side drawer closes the
other; starting a battle closes all three. The HUD shrinks (84 px gauge,
46 px modules), buttons grow to 34 px, overlays and the hangar scroll, the
hangar shows the Build column first with a 4-column palette. ⛶ requests
fullscreen and, where the browser allows, locks landscape; a phone held
upright shows a "turn your phone" screen (`#rotate-hint`). The auto-fit
camera may zoom out to `zoom.autoMinShort` (0.12) when the view is under
`zoom.shortPx` (500) tall; at battle start the enemy at 38 km is still off a
phone screen for about ten seconds (LOCK TARGET in Orders works meanwhile).
Measured in headless Chromium with touch emulation at 844×390, 740×360 and
1180×820: zero console errors over 30+ simulated seconds.

### Touch (`BS.UI.bindTouch`, Pointer Events, mouse untouched)
Tap the enemy = select and lock; tap one of its blocks while locked = aim at
that type; long-press (500 ms) the enemy = Engage; long-press or double-tap
(350 ms, 30 px) empty space = fly there; two fingers = pinch zoom on the
zoom bias. A finger's hit radius grows as the camera zooms out (26 screen
px). The compatibility `click` a tap also fires is ignored for 700 ms. The
hangar editor paints under a finger (pointer events, `touch-action: none`);
Erase is the palette entry. Every keyboard shortcut has a button.

### Input

- The script has the conn; the live inputs are the two bridge calls
  (right panel), Hail, Red alert and the heat governor (top bar), the
  speed buttons and pause (Space), the log toggle (G), zoom (wheel, +/−,
  pinch) and the Focus candidate (click or tap a block of the enemy on
  the display or the scan panel, or a weak-point line).
- The camera follows the viewer, leans toward the centre of everything
  in view and zooms so every ship fits; wheel and +/− scale a bias.
- Overview rows show every ship's range, speed, angular velocity and
  state. (0.37: the hand-flown bridge of 0.3–0.36, with its stances, plays,
  sides, aim chips, module clicks, fly-to and keys, is gone: it was a
  second game under the script.)

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
- **One doctrine list** (`enemyAI.doctrines`, `BS.EnemyAI.setDoctrine`,
  0.37): every ship, player or enemy, flies a doctrine from the same list
  with the same machine. A doctrine may carry `ranges`
  (`[ref, fraction, ..., fallbackKm]`, ref `phaser` = the longest turret
  optimal, `torpedo` = the longest launcher range): its range fields are
  then taken from the ship's own fitted weapons when it is set
  (`doctrineFor`). The four labelled ones are the player's set, the old
  stances of 0.8–0.36 with the same ids, so templates and saved scripts
  read the same (`do: { doctrine: "engage" }`; a save's `stance` action is
  migrated):
  - **Engage** (default at undock): brawl, orbit at phaser optimal × 0.5
    (4 km), afterburner only above 70% cap.
  - **Skirmish**: brawl at phaser optimal × 0.35 (2.8 km) with the
    afterburner on above 30% cap: too fast to track, costs capacitor.
  - **Standoff**: hold at torpedo range × 0.5 (15 km; phaser optimal × 1.0
    without tubes), kite below × 0.32 to × 0.6.
  - **Disengage**: evade, keep at torpedo range × 0.8 (24 km) on the
    afterburner until the script says otherwise.
  The fixed-range doctrines the enemy encounters name (strafe, brawl,
  `dogfight` for the Interceptor and `bombard` for the Torpedo boat, the
  former fixed `skirmish` and `standoff`, broadside, ambush, siege, kite,
  watch, closein, evade) have no `ranges` and fly the same numbers for any
  hull, so the 0.3–0.36 enemy behaviour is unchanged. The helm owns the
  afterburner. The tactical officer re-locks a target whenever the lock
  drops and the target is in range (`ai.relock`).
- **Attack side** (`helm.sides`, `helm.shadow`, script action `side`,
  `BS.EnemyAI.setAttackSide`): in Engage or Skirmish the helm can shadow
  one side of the target instead of circling. The `shadow` movement command
  holds a station point at the orbit range on a bearing measured from the
  **target's** heading (port −90°, starboard 90°, aft 180°), chasing it with
  a little lead and matching its speed on station. **Blind** picks the
  bearing where the least of the target's fire bears (its
  `bearingProfile`, all alive weapons) and keeps it until another sector has
  under 70% of its fire. The Helm row reads "shadowing blind sector"; the
  scan panel shows their fire per sector (bow / stbd / aft / port, dps).
  Enemies answer it: since 0.25 by a script rule (condition `blindFor` 3 s,
  K't'inga 2.5, action `roll`: `BS.EnemyAI.roll` comes about with the side
  that carries the most fire, `reposition` state, Tactical reads the
  rule's callout), so a slow hull turns while a fast one re-shadows. The
  blind time only counts in the states that mean to fire (brawl, pass,
  broadside, standoff): a ship breaking off shows its tail on purpose.
- **Auto-flip** (`helm.flipMinInterval/flipShieldLow/flipShieldHigh`, both
  sides): an orbiting ship reverses its orbit when mirroring the geometry
  would bring more weapons to bear (`bearingCount`), or when the engaged
  facing is below 30% while the opposite one is above 60%; at most once
  per 8 s. Helm calls it ("Coming about, bringing the other battery to
  bear" / "showing them a fresh shield").
- **Plays** (0.9–0.36, `js/plays.js`): removed in 0.37. A play was a
  phase sequence under the script, a second scripting layer; every play
  was already a template of rules (Siege, Hunter, Ambush) or retired.
  The Torpedo boat's Siege play is three rules in `enemyScripts.torpedoBoat`
  (brawl when the tubes are gone or inside 5 km, else the encounter's
  `bombard` doctrine), measured in §8 v0.37.

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
  and pylons are tough, so losing a whole section is a rare disaster), and
  since 0.34 `r` (a role cell: fillable by anything, the only place a role
  block fits).
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
- **Heat** (0.7–0.39): removed in 0.40. Measured first (§8 v0.40): with
  the heat cap set to infinity every reference fight was identical to the
  second, so the cap, the overload, the governor, the heat bar and the
  heat conditions never bound a scripted fight. The capacitor is the one
  cap on weapons.
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

### Reactor power range (`grid.powerRadius` 15, `grid.unpoweredFactor` 0.5)
A system block within 15 cells of an alive reactor runs at full power;
outside every reactor's range it runs at half (`b.powered`, `b.powerMult`):
weapon cycle, shield emitter strength and regen, engine thrust, sensor
strength. Losing a reactor browns out its neighbourhood (the saucer goes
dim when the engineering-hull reactors die), so big hulls need reactors
spread out: every default, preset and enemy layout had its reactors
re-placed by a solver (mirrored, interior, never adjacent to another reactor
or the bridge) for 100% coverage. The hangar dims unpowered cells and shows
"Reactors n · range 15 · powered n%"; the scan panel dims them on the enemy
and counts "n dark".

### Warp core breach (`grid.breach`)
When a ship's last reactor dies (`coreBreach`) the core goes critical: 8 s
later the ship is destroyed (`coreBlast`, `shipDestroyed` with `breach`)
and everything within 2 km takes up to 900 damage with linear falloff.
Engineering counts down ("Core breach in 8 seconds, get us clear!"),
Tactical warns of the enemy's; both AIs enter the `clear` state and keep
3.2 km away on the afterburner until it blows (the player's helm does it
too under any stance; manual helm must run by itself). A reactor-hunting
captain who stays at 3 km is safe; one who brawls at 2 km is not.

### Section physics (`visuals.fragments`)
A severed section keeps the ship's full momentum, burns its engines for
1.2 s (pushing it on), cooks off its reactors after 0.8–1.8 s (80 damage
per reactor to a ship it touches) and is solid while whole: a ship it
drifts into takes 6 damage per cell as plain hull damage from its
direction (`debrisHit`, Engineering reports the impact). A nacelle torn off
a cruiser can tumble into the ship that cut it.

### Critical hits (`grid.crits`)
A hit that leaves a system block (anything with a crew need) under 50% of
its hp rolls 25% for a critical effect by type, applied in `Grid.hit`
(reactors and crew quarters are destroyed outright, a reactor therefore
breaching) and `BS.Ships.applyCrit`: an **engine** crit sends the ship
tumbling for 3 s (no helm, 70°/s spin, speed bleeding), a **sensor** crit
drops its lock and blinds it 2 s, a **shield emitter** crit bleeds 30% of
its facing, a **weapon** crit jams the mount for two cycles, a **cloak**
crit drops the cloak. Event `criticalHit` (crew callouts both ways, flash
and sparks). Aimed fire at a wounded system is how a small ship cripples a
big one; the Overview and Helm rows read "tumbling".

### Repair
Damage control restores hp to damaged (not destroyed) blocks at the ship's
repair rate, the repair-priority type first, then the most damaged.
Destroyed blocks stay gone for the battle. Crew quarters add
`grid.repairAdd` each (damage control teams); since 0.38 that is all a
quarters block does.

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
  (`ew.cloakDetectRangeKm` 10 km + 1 km per sensor array) and a faint
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
shieldAdd`). A facing that was hit does not regenerate for
`grid.shieldRechargeDelay` (4 s; the booster still fills it), so sustained
fire keeps a facing down while hit-and-run lets it come back: measured, this
sped Engage up (2:31–2:54) without changing its hull loss and took Hit & fade
to 93–97% and the Defiant to 100%. Passive regen is low (0.6/s per facing plus 0.4 per emitter);
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

**Enemy plays** are gone with the plays (0.37): an enemy bridge is its
doctrine plus its script. The Torpedo boat holds station and fires every
tube (hence its ×1.25), brawls when its tubes are gone or the enemy is
inside 5 km. The Shadow keeps its ambush doctrine and the K't'inga Siege
its siege doctrine; the Gunboat brawls (its Hit & fade of 0.10–0.11
produced 8–10 minute stalemates with cannons).

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

### Weak points and focus fire (`BS.Grid.weakPoints`, `grid.weakPoints`, aim type `block`)
`weakPoints(ship)` reads a layout for what to shoot, best first, each with
the block to aim at: the **emitter** covering the most blocks (kill it,
bare them), **chain** (a reactor touching another: one breach chains),
**blackout** (a reactor that alone keeps n systems in power range),
**neck** (the block whose loss severs the most hull from the bridge, scored
per hp so a 60-hp plate beats a 700-hp pylon), **crew** (one quarters short
of the posts) and **wounded** (systems under half hp, open to a critical).
The scan panel lists up to five as clickable lines; clicking one, or any
block on the drawing, sets `ship.aimType = "block"` with
`ship.aimBlock = { ship, block }` (`BS.Ships.setAimBlock`, command
`aimBlock`): every weapon's shot line is steered through that block
(`entryBlockThrough`), with the same −15% as aiming at a type, and the
armor in front of it still takes the hit first. The aimed block is framed
in yellow on the scan drawing; the Target panel reads "Shield emitter at
6,15 (−15%)". Clicking the same point again returns to spraying the hull.

**Enemies do it too**: each 20 s aim re-roll, an enemy takes its target's
top weak point with `enemyAI.*.weakPointChance` (Bird-of-Prey 25%,
K't'inga 60%) among the kinds its profile allows (`weakPointKinds`: a
raider neither cuts necks nor finishes wounded systems, both measured to
turn Engage into a coin flip; the cruiser does everything) instead of a
random type; Tactical calls it ("They're going
for our aft shield emitter, Captain!", event `enemyFocus`). Fixing an
obvious weak point in the hangar is now worth doing.

### Cutting the neck (aim type `structure`, `grid.structureHp` 700, `grid.torpedoStructureMult` 3)
The **STRUCT** chip (or a "Cut:" weak point) aims at structural members;
torpedoes do triple to them (two warheads cut a 700-hp pylon) and beams
still stop in them. Measured: structure at 400 hp let stray cannon fire
sever a Constitution's nacelles in ordinary fights (Engage 2 of 5), so the
hp stays at 700 and the cutting is torpedo work. The weak-point
analysis also finds **two-block necks** (`weakPoints.neckPairs`): a
structural or rim block plus one neighbour whose joint loss severs a
section, scored by blocks severed per hp, so the Bird-of-Prey's 2-wide wing
roots ("Cut: the armor plating at 12,10 and its neighbour (168 hp) severs
42 blocks") show up next to the Constitution's neck. A severed section
takes every block on it: engines, weapons, reactors, and with the section
physics it keeps flying.

### Intel (`save.intel`, `campaign.intelMinLockSeconds` 10, `campaign.intelCost` 150)
Hold a lock on the enemy for 10 s in a battle and its layout is recorded
for that encounter id (`BS.Campaign.recordIntel`, random variants by their
exact rows, so a different roll is stale); or buy the next encounter's
layout in the hangar for 150 cr. The hangar's **Intel** section draws the
known layout top-down (`BS.Renderer.drawTopDown`: plates with damage tint,
shield bubbles, bare hull) with its weapons, shields, hull, reactors,
quarters, cover and its top three weak points, next to the doctrine, so
you fit against what you will actually meet. Unknown:
"No layout on file" and the buy button.

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
it to the full scrollable log.

### Decoys (block `Y`, module `decoy`, `ew.decoy`)
A decoy launcher is a one-cell block (90 cr, power 2, crew 1); its module
(20 s cycle, 15 cap) drops one flare per alive launcher block astern of the
ship (`speedKmS` 1 at ±35°) that burns for `life` 8 s. Every torpedo
hunting the launching ship that comes within `lureKm` 3 of a flare turns on
the nearest flare (`torpedo.lured`, event `torpedoLured`) and dies on it
inside `hitKm` (`torpedoDecoyed`, no damage); a flare that burns out hands
its torpedoes back to the ship. So the decoy is a timing call: fired when
the volley is 2–4 km out it eats the volley, fired early it burns out before
they arrive, fired late they are already inside the lure radius of the ship
itself. `BS.Weapons.decoys` holds the flares; `BS.Weapons.incoming(ship,
km)` counts the torpedoes still hunting a ship. The enemy drops one whenever
torpedoes hunting it are inside `aiIncomingKm` 4.5 (the Siege K't'inga
carries two launchers). Tactical calls the launch and the turn; the renderer
draws a flickering flare with a trail.

### Energy neutraliser (block `X`, module `neut`, `ew.neut`)
A neutraliser is a one-cell block (110 cr, power 4, crew 1); its module
(6 s cycle, 20 cap) needs a lock inside `rangeKm` 4 (it waits in state
`nolock` / `range` without spending) and then drains `perBlock` 30
capacitor per alive neutraliser block from the target (`neutralised` event
with the amount actually drained). Nothing else is modelled: a ship with no
capacitor simply cannot start its booster, hardener, afterburner or cloak
and its weapons wait for cap, which the existing module code already does.
It drains the user too (the hangar warns under `warnCapBelow` 240
capacitor). The drained ship remembers it for `drainMemory` 8 s
(`ship.neuted`); an **enemy** under `enemyAI.*.drainedBelow` (8%, K't'inga
6%) capacitor while drained goes to state `drained` and opens the range to
`ew.neut.fleeKm` 8 until its capacitor is back above `drainedUntil` (35%) or
`drainedTime` (20 s) has passed, then re-enters its doctrine: the neut is a
geometry fight, not a lock (before this rule a drained Gunboat sat at 3 km
for ten minutes firing nothing, and the Miranda could not kill it either).
The enemy runs its own neutralisers whenever the target is inside reach and
its capacitor is above `aiMinCap` 35%. The scan panel shows the enemy's
capacitor.

### Leech encounter and the neutraliser counter
The **Leech** (Bird-of-Prey, two neutralisers in the hull where the Jammer
boat carries its ECM, six disruptors, brawl, from win 3, ×1.2) drains you
every six seconds inside 4 km: reactors and range are the answer, as for
the ECM boat sensors were.

### Bridge scripts (`js/script.js`, `BS.Data.script`, `save.scripts / scriptByBuild / plans`)
The direction since 0.21: the contest is decided before the fight (build,
intel, script); in the fight the bridge runs the script. A script is
`{ name, policies, rules }`, and both bridges run the same engine every
`script.tickSeconds` (0.5 s):
- **Standing rules** are read top to bottom; the first whose conditions all
  hold gives the standing orders, and its actions are applied once, when
  it takes over (an order the helm already flies is not re-issued). A rule
  with `until` holds its orders until that condition holds, or `holdMax`
  seconds pass, unless a rule above it takes over: that is how phases are
  written ("when our weakest shield is under 25%: fly Disengage, until it is
  over 60%").
  A rule with no conditions is the default and stands when nothing above
  it does.
- **Call-outs** (`once: true` or `every: N`) fire their actions whenever
  their conditions hold, once ever or at most every N seconds, without
  changing the standing orders: scan, reinforce, remodulate. A
  once rule that could not act yet (a scan still running) tries again.
- **Policies** run every tick: `lock` (keep a lock), `booster` / `reinforce`
  (`helm.policy`), `hardener`, `decoy` (drop one
  when torpedoes are inside `ew.decoy.aiIncomingKm`), `neut` (run it in
  range).
- **Conditions** (`script.conditions`, each with a sentence): the ship's
  own state (`dKm`, `weakest`, `cap`, `time`, cloak and
  weapon states, `enemyReactorsGone`, `enemyShieldsDown`) plus `scanned`,
  `hullBelow`, `incomingTorpedoes`, `boardable`, `enemyFacingBelow`,
  `enemyCapBelow`, `enemyHullBelow`, `enemyCharging` (running in and
  closing faster than `chargingKmS` 1 km/s), `enemyCloaking`,
  `enemyCloaked`, `enemyRolling` (reposition / come about), `enemyBreaching`,
  `enemyKiting`, `enemyFocusing: type` (their fire is steered at that block
  type of ours), `enemyState`. Since 0.25: `enemyStance` (one word read off
  their doctrine state and helm command, `enemyAI.stanceLabels`: orbiting,
  holding station, shadowing us, kiting, closing, rolling a fresh side),
  `enemyAimingAt` (`enemyAI.aimLabels`: spraying our hull, a system type, a
  weak point, cutting our structure), `rangeBand` (`script.rangeBands`,
  measured off **our** fitted weapons: inside our beam optimal, inside our
  torpedo range, beyond our reach, so a template reads the same on any
  build), `enemyAfterburner`, `enemyHeatAbove / Below`, `blindFor` (seconds
  none of our weapons have borne on them, `ship.ai.blindTimer`). All
  conditions in a rule must hold.
- **Actions** (`script.actions`): `doctrine` (any doctrine; the labelled
  ones take their ranges from the build), `side`, `aim` (block
  type, `exposed`, `structure`, `{ weak: kind }`, `{ plan: n }`), `weapons`,
  `modules`, `governor`, `repair`, `reinforce`, `scan`, `board`, `roll`
  (0.25: come about to the side with the most fire, `BS.EnemyAI.roll`, a
  reposition the doctrine resumes from after `repositionDuration` or once
  guns bear).
- **Callouts** (0.25): a rule may carry `callout: "…"`; when it fires or
  takes over the engine emits `scriptCallout` and, for the enemy's rules,
  Tactical reads it out. The player's own callouts are silent (the trace
  already reads every rule).
- **Scan** (`script.scanSeconds` 4 s): the beam turrets hold fire
  (module state `scan`), then `ship.scanned` is set; aiming at a weak point
  or a plan target needs it (the rule still stands, the trace says
  "waiting for a scan"). The enemy reads weak points off a scan as well:
  `pickTarget` rolls `weakPointChance` only when the enemy ship has
  scanned, so its scripts carry a scan rule (Raider inside 12 km, K't'inga
  inside 14 km, Siege inside 20 km). A scan also records intel.
- **Sentences**: `BS.Script.describe(rule)` turns a rule into "When they
  are closer than 5 km: fly Engage (at most 30 s)";
  `describeScript` lists a script. The trace (`ship.scriptTrace`, event
  `scriptRule`, read into the log by the computer) records every takeover
  and call-out with the reason an action could not be done.
- **Templates** (`script.templates`): Brawler (the default fight: Engage,
  weapons, hardener), Siege, Hunter, Ambush (the plays of 0.9 rewritten as
  rules, the plays themselves gone since 0.37); Alpha strike, Turtle and
  Hit & fade were retired in 0.31 and deleted in 0.40 with the heat they
  were written around. A hull undocks with
  `save.scriptByBuild[classId]` (an own script by id, PR B's editor, or a
  template), else `script.defaultTemplate`; alone (encounter kind `solo`)
  with `save.soloScriptByBuild[classId]` first and in a fleet skirmish
  (kind `fleet`) with `save.fleetScriptByBuild[classId]` first, if set
  (0.43 / 0.44, `BS.Campaign.scriptFor(classId, kind)`).
- **Enemy scripts** (`script.enemyScripts`, `campaign.encounters[].script`):
  `doctrine: "encounter"` flies the doctrine the encounter rolled; the
  Torpedo boat's rules replace its Siege play; the Raider, K't'inga and
  Siege cruiser scan first. The enemy AI keeps its own module policies in
  `enemyai.js`; a script that sets an aim keeps it (`ship.scriptAim`).
- **Plans** (`save.plans[encounterId].targets`, up to `script.planTargets`
  3, `{ x, y }` on the intel layout or `{ type }`): read by `aim: { plan: n }`;
  the hangar side arrives with PR B.

### Tuning: shield frequencies, alloys and ammo (0.29, `BS.Data.tuning`, `save.tuning`)
Pillar 2 in its final form, the Trek "remodulate" made a rule. Five
modulations, all canon particles, in a ring where each beats the next:
**Graviton → Nadion → Tetryon → Polaron → Antiproton → Graviton** (each
with a one-line science, `list[].how`). The ring is a public convention,
like a type chart, not a claim about physics.

- **Every block carries a modulation.** A shield emitter has a
  *frequency*, an armor plate an *alloy*, every weapon block (phaser,
  pulse, disruptor, torpedo tube) an *ammo* modulation (`tuning.tunable`).
  `save.tuning[classId]` holds rows of digits in the layout's shape: `0`
  = the faction's default (`factionDefault`: Federation Nadion, Klingon
  Polaron), `1–5` = `list[].digit`. `BS.Grid.build` resolves each block's
  `tune`; saved builds and presets may carry `tuning` rows.
- **One rule** (`BS.Grid.tuneMult`, in `applyDamage` and `Grid.hit`): a
  hit whose ammo beats the frequency of the emitter covering the struck
  block is ×`bonus` 1.5 for the whole shot while that shield is up, one
  the frequency beats ×`malus` 0.5; on bare hull the alloy of the plate it
  lands on does the same for that plate; system blocks take ×1. Because
  it is per emitter and per plate, a hull can be Graviton at the bow and
  Nadion astern, and a battery can mix ammo: hybrids hedge, specialists
  gamble. Tuning a block off its faction's default costs `offFactionCost`
  15% of its price (`layoutDelta`: retuning pays or refunds only the
  surcharge).
- **Hangar: one modulation per kind, per ship** (0.39). The Tuning box
  shows the ring, the rule, "Your Graviton ammo vs their Polaron shields:
  ×1.00" from intel or the faction default, and three dropdowns: weapons,
  shields, armor. A choice is written to every block of that kind
  (`BS.Grid.tuningRowsFor`), painted blocks included, and the surcharge
  is paid on *Apply build*. The per-cell paint mode of 0.29–0.38 is gone:
  a raid leader sets a ship's modulation, not a plate's. The rows in
  `save.tuning` are unchanged, so old saves, presets and enemy variants
  (which may still mix per cell) load as they were; a mixed hull reads as
  its dominant modulation in the dropdowns and becomes uniform on the
  next change. Every tuned block still shows a dot in its colour.
- **Hidden until seen.** The enemy's tuning shows on the scan panel
  (dots on the drawing and a Tuning line) only once scanned; intel stores
  the tuning it saw (`save.intel[].tuning`). The
  report's *Why you lost* opens with "Our Graviton ammo vs their shields
  Polaron ×1.00 · armor Polaron ×1.00" and the same from their side.
- **Remodulating** (0.30, `tuning.remodulate`, `BS.Ships.remodulate`):
  either bridge may retune in the fight, as an answer to something seen.
  *Shields*: every emitter takes the frequency that beats the other ship's
  dominant ammo, with the deflector down for `shieldsSeconds` 10
  (`shieldsUp` false: the pools keep, nothing is projected). *Ammo*: every
  weapon block takes the ammo that beats their dominant frequency, with
  the weapons cold for `ammoSeconds` 5 (module reason `remodulate`). It
  needs a scan ("scan them first"), refuses when already on that
  modulation, and rewrites the ship's `tuningRows` so intel and the Book
  see the new tuning. Script vocabulary: conditions
  `enemyAmmoBeatsOurShields`, `ourAmmoBeaten` (both false until scanned),
  `remodulating`; action `remodulate: "shields" | "ammo"`. A flag
  condition written `flag: false` now holds when the flag does not (the
  engine compared only `true` flags before). The Raider, Cruiser and Siege
  cruiser scripts carry both reactions (every 45 s, with callouts: "They're
  remodulating their shields, Captain. Ten seconds with the deflector
  down."); Tactical reports the enemy's remodulation finishing ("Their
  shields are back, retuned to Antiproton"). Two more **bridge calls**,
  *Remodulate shields* and *Remodulate ammo* (`remodShields` /
  `remodAmmo`, once rules); a call with nothing to do (no scan, already on
  that modulation) spends no token and Engineering says why
  (`bridgeCallNothing`).
- **Weak point `frequency`** (`BS.Grid.weakPoints(ship, attacker)`): the
  facing whose emitters' frequency the attacker's dominant ammo beats
  ("Their aft emitters are Tetryon: our Nadion ammo hits ×1.5 there"),
  scored above the emitter point; the scan panel, the intel box (against
  the build in the editor), the enemy's `pickTarget` and `aim: { weak }`
  all pass the attacker, and both AI profiles list the kind first.

### Honest loss (0.26)
A loss is meant to be accepted and answered with a new build or script,
so the enemy may never win by information the player cannot have:
- The enemy's conditions are the player's conditions (`script.conditions`,
  one engine). Its strength is the shown percentage (`enemyStatMult`).
- **Contact, not position**: `BS.Ships.contact(viewer, target)` gives the
  target itself while it is visible (not cloaked, or cloaked inside the
  viewer's detect range `ew.cloakDetectRangeKm` + `ew.detectPerSensor`
  per sensor) and otherwise a ghost standing at the last contact. The
  doctrine machine (`BS.EnemyAI.update`: range, facing, blind time), the
  helm (`updateCommand`: approach / orbit / keep / shadow fly against the
  ghost instead of holding course as before) and the script conditions
  (`dKm*`, `rangeBand`, `enemyCharging`) all read ranges and bearings from
  it, for both ships. A cloaked ship beyond sensors is hunted at its last
  known point, not followed.
- Every reaction carries a callout, read out when the rule takes over,
  before its effect lands; the report shows which rule hurt.

### Enemy reactions (0.25, `script.enemyScripts`)
Pillar 3 of the "build & fight" direction: the enemy answers in the fight
with rules on the same engine, not with code in `enemyai.js`. The Raider
script (also flown by the Gunboat, the random variant, the Jammer boat and
the Leech) and the Cruiser / Siege cruiser scripts carry four reactions,
each with a callout Tactical reads out, and the plain `doctrine` script
(Shadow) keeps the blind roll:

| They see | They do | Raider / cruiser numbers |
|---|---|---|
| `blindFor` n s: nothing of theirs bears on us (we shadow a blind sector) | `roll` (call-out every 8–10 s) | 3 s / 2.5 s |
| `enemyFocusing: shield`: our fire is steered at their emitters | `reinforce` + `roll` (every 20 / 25 s) | |
| `enemyCloaked`: we are cloaked | `doctrine: watch` (`doctrines.watch`: hold 5 km, afterburner cold) until we show, at most 60 s, then a scan inside 8 km | |

Enemy scripts never set modules: `enemyai.js` keeps weapons, hardener,
booster, jammer, neutraliser and decoy on its own policy every decision
tick, so a script rule and the profile never fight over a module. The
Torpedo boat does not react beyond its three rules: measured in 0.21, any change
to it breaks the fight. The blind-sector roll moved out of `enemyai.js`
(`blindTolerance` is gone; `blindTimer` stays, counted only in the firing
states) into the scripts, so the harness's `--noreact` enemy (scan, blind
roll, doctrine) is exactly the 0.24 bridge.

### Fleet engine (0.31, `js/fleet.js`, `ship.team`, `state.teams`, `save.fleet`, `campaign.encounters[].ships`)
A battle holds N ships on the player's side and M on the enemy's.
- **Sides.** `BS.Campaign.fleet()` is the hangar's ship followed by
  `save.fleet` (owned class ids, one hull per class since a class has one
  layout, one tuning and one script in the save), at most `campaign.fleetMax`
  4. `BS.Campaign.encounter()` returns `ships`: the encounter's ship as
  before, then one spec per entry of `campaign.encounters[].ships`
  (`{ enemyClass, layout, doctrine, script, damageMult }`, rolled from the
  same seeded stream). Both sides
  spawn line abreast, `balance.fleetSpacingKm` 1.6 km between centres, the
  enemy across its bearing at `arenaStartDistanceKm`.
- **Targets.** Every ship has `ship.target`. `BS.Fleet.update` runs each
  step: a ship without a live target takes the nearest hostile by contact
  range (ships still able to fight before disabled ones). `BS.Fleet.retarget`
  rebinds the script (`script.target`), the helm (it re-enters
  the doctrine it was flying against the new ship, which
  re-issues the movement command), clears a lock on another ship (the lock
  policy and the AI re-lock on their tick) and an aim block on another ship,
  and emits `targetChanged`. `BS.EnemyAI.update(ship, BS.Fleet.targetOf(ship))`
  for every ship. Contacts (`ship.contacts`, honest loss) are kept per ship
  seen, so switching targets keeps the last positions of the others.
- **End.** A side loses when none of its ships can fight
  (`BS.Fleet.teamFighting`: not destroyed, disabled or captured);
  `resultHow` is what happened to the last of them. Salvage counts every
  enemy hull by how it ended (`campaign.salvage`), hull lost is read over
  the whole side, the dry run reports `ships` and `enemies` per hull.
- **Viewer and primary enemy.** `state.player` is the hull the panels, the
  module bar and the crew voices follow: the flagship, then the next
  fighting hull when it is lost (`viewerChanged`, the module bar is rebuilt);
  `state.enemy` is the viewer's current target (`primaryEnemyChanged`): the
  scan panel, the overlays and the report's "their bridge"
  (`state.enemyFlag`, the encounter's first ship) read it. They are
  presentation, never logic. The camera leans two thirds of the way from the
  viewer toward the centre of everything in view (a third toward the enemy
  with two ships, as before) and fits every ship; only the viewer's hits
  shake the screen. Attribution (§4 "why you lost") is booked between the
  viewer and the primary enemy.
- **What 0.31 leaves to 0.32+:** the scan panel, the enemy chips, click and
  tap hit-testing and the crew voices follow the viewer and the primary
  enemy only (allied hulls fight silently); `ship.scanned` is per ship, not
  per target; script conditions have no subject (`enemy…` reads the ship's
  current target) and no target action; the encounters `pair` and `pack`
  stay out of the pool (`minWins` 999) until the fleet hangar of 0.35.

### Fleet scripts: subjects, the target action, ally conditions (0.32, `script.subjects`, `BS.Fleet.subject`)
The script engine learns to speak about more than one enemy.
- **Subjects** (`script.subjects`): `target` (the ship we are fighting, the
  default), `nearest`, `weakest` (least hull fraction), `biggest` (largest
  hull, the boss proxy), `hunter` (the nearest enemy whose target is us;
  null when nobody shoots at us), `focus` (the enemy most of our side is
  fighting, the nearest among equals). `BS.Fleet.subject(ship, id)` prefers
  ships still able to fight.
- **`about`**: a rule may carry `about: <subject>`; its conditions (`when`
  and `until`) then read that enemy instead of the current target: "About
  the enemy with the least hull, when their hull is under 40%: …". Without
  `about` nothing changes. The report's "never fired" reasons use the same
  subject.
- **Action `target: <subject>`** switches our fire: `BS.Fleet.retarget`
  rebinds the helm, the lock and the aim, and the subject becomes the
  target the rest of the rule's actions act on. "no <subject>" is the
  trace note when none exists (no hunter, no enemy left).
- **Ally and count conditions**: `allyShieldBelow`, `allyHullBelow` (any
  fighting ally), `allyUnderFire` (an enemy's target is an ally),
  `outnumbered` (more fighting enemies than our fighting hulls),
  `enemiesAtMost: n`, `unfocused` (we are not firing at the `focus` enemy).
  Alone, the ally conditions never hold.
- **Scans are per ship**: `ship.scannedOf[id]`; `ship.scanned` is kept in
  step with the current target on every retarget and scan, so a weak-point
  aim on a fresh target waits for its own scan. The scan panel's "scanned"
  and the tuning lines read the current target.
- **Template "Wolf pack"** (`templates.wolfpack`): about the weakest enemy,
  when its hull is under 40%: switch to it and engage; every 8 s when
  unfocused: switch to the focus; otherwise engage. Alone it is the
  Brawler. The Raider and Cruiser enemy scripts carry the same `unfocused`
  rule (every 10 s, with a callout), so a pack concentrates its fire too;
  in a 1v1 the condition never holds and nothing changes.
- **Report per hull**: the battle report lists every other hull of ours
  (script, how it ended, which rules fired, last target) and the enemy
  fleet; the hangar's dry run prints both sides per hull.
- Not yet: the transfer actions (shield transfer, remote repair) wait for
  the role blocks of 0.34; the editor's "about" dropdown appears once a
  rule has a condition.

### Bosses: the Borg cube (0.33, `shipClasses.borg_cube`, `enemyAI.boss`, `script.enemyScripts.borg`, encounter `cube`)
The first boss of §10. An encounter with `kind: "boss"` brings one large hull
whose mechanics are rules of its script, each with a callout the fleet can
script against, plus `reinforcements` its script summons.
- **The hull**: a 24×24 cube (576 cells, 33k hull hp before the boss
  profile's `statMult` 1.8), cutting beams at the centre of the fore, port
  and starboard faces, disruptor cannons on all four faces, 12 shield
  emitters on the fore, port and starboard sides only, 11 reactors
  clustered toward the aft, the bridge at the centre. Shields: 360 per
  covered facing × the profile's `shieldMult` 4 (`mods.shieldMaxMult`),
  80 aft. Speed multiplier at the floor (0.35: slow), turn rate 24°/s,
  signature 1400 (torpedoes hit it for full damage; it locks slowly on
  nothing). Faction `borg`, default modulation Antiproton.
- **Cutting beam** (block `lance`, `enemyOnly`): a turret with
  `weapon.charge` 6 s. When it would fire it charges instead (event
  `weaponCharging`, the tell: Tactical calls "Cutting beam charging on us",
  a glow grows on the block, the scan panel lists the charge), then fires
  at the ship it charged on whatever the arc, 520 damage × the profile's
  1.6, 8 blocks deep. Tracking 0.35 rad/s: an orbit on the afterburner is
  nearly immune, a ship holding station or closing is cut open. Conditions
  `lanceCharging` (on us) and `allyLanced` (on an ally).
- **The script** (`enemyScripts.borg`): scan inside 20 km; every 30 s turn
  on the nearest ship (`notTargeting: nearest` → `target: nearest`,
  callout); remodulate shields when our ammo beats them (`every: 45`); at
  60% hull **summon** the reinforcements once (two assimilated
  Birds-of-Prey drop in astern of the cube: `BS.Game.summon`, encounter
  `reinforcements`, event `reinforcements`); at 420 s **overdrive** once
  (`BS.Ships.overdrive`, `enemyAI.overdrive`: damage ×1.5, speed ×1.25 for
  the rest of the fight, the enrage); roll a fresh face when blind 4 s;
  otherwise the broadside doctrine (band 4.5–7 km, the strongest facing
  toward the target, so the bare aft stays away from whoever it fights).
- **Profile `boss`**: never retreats (`retreatHull` 0), no weak-point
  hunting, sprays (`targetWeights` none 0.6), `statMult` 1.8, `damageMult`
  1.6, `shieldMult` 4, `shieldRegenMult` 2.
- **The intended answer**, template **Cube breaker**: skirmish on the
  afterburner while a beam charges on us; with two or more enemies left,
  target the smallest (the escorts first); scan, retune the ammo when
  beaten; otherwise target the biggest, keep to their aft and shoot the
  reactors. Measured in §8: it wins where the Brawler and the Wolf pack
  lose. The aft halves the fight; the dodge rule changed nothing for a
  fleet already astern (no beam faces aft); killing the escorts first and
  concentrating on the cube is what turns the loss.
- **New vocabulary**: subject `smallest`; conditions `notTargeting:
  <subject>`, `enemiesAtLeast`, `lanceCharging`, `allyLanced`; actions
  `summon` and `overdrive` (`enemyOnly`: not in the editor). Blocks marked
  `enemyOnly` are not in the palette and fail `validateLayout` on a
  Federation hull. Callouts from any enemy hull reach Tactical (0.32 read
  only the primary enemy's).
- The `cube` encounter is out of the campaign pool (`minWins` 999) until
  the runs of 0.35; the harness reaches it with `--enemy cube`, and the
  smoke test's fleet pass fights it.

### Roles from blocks (0.34, mask `r`, `blocks.*.roleOnly`, `BS.Data.support`, `script.allySubjects`)
The role layer of §10: roles are what a hull carries on its **role cells**.
- **Role cells**: mask letter `r`, fillable by any block and the only place
  for a block marked `roleOnly` (`validateLayout` refuses them elsewhere;
  the editor says so and draws role cells with an orange outline). Hulls
  differ: Constitution 2, Miranda 1, Defiant 1, Excelsior 3, Galaxy 5,
  Sovereign 3. The default layouts keep whatever stood there.
- **Role blocks** (`roleOnly`, letters W / H / K):
  - *Shield transfer emitter* (`transfer`) and module `shield_transfer`
    (5 s, 24 cap): moves `support.transferPerBlock` 100 shield per emitter
    from the healer's strongest facing to the supported ally's weakest,
    within `support.rangeKm` 4. A transfer, not creation: the healer's own
    pool pays, and it cannot support itself.
  - *Remote repair projector* (`repairbeam`) and module `remote_repair`
    (6 s, 18 cap): `support.repairPerBlock` 300 hp per projector (45 until
    0.41: a healer moving 7 hp/s never held a tank under a boss, §8 v0.41)
    to the supported ally's damaged blocks (`BS.Grid.repair`, destroyed
    blocks stay gone).
  - *Signature beacon* (`beacon`) and module `beacon` (4 s, 6 cap): while
    it runs the ship's signature is ×2.5 (`effect.sigMult`, written to
    `ship.signature` every module tick): the loudest contact, locked faster,
    hit by torpedoes for full damage.
  A support module with no supported ally alive in range spends nothing
  (`nosupport` / `range`).
- **Ally subjects** (`script.allySubjects`): `weakestAlly`, `hurtAlly`,
  `huntedAlly` (the ally the most enemies are firing at), `flagship`
  (`BS.Fleet.ally`). Actions **`support: <ally>`** (sets `ship.support`,
  what the transfer and repair modules work on) and **`escort: <ally>`**
  (`BS.EnemyAI.escort`: the doctrine machine stands down and the helm
  keeps station `support.escortKm` 2.5 km from that ally until a doctrine
  or doctrine is set; a lost ally re-picks the subject each tick). Policy
  `support: "auto"` re-picks the weakest ally every tick.
- **Subject `loudest`** (largest signature). The Borg cube now turns on the
  loudest ship, so a lit beacon draws it: measured, every one of its 15
  beam charges in a fight landed on the beacon ship.
- **Templates**: *Anchor* (tank: beacon lit, hardener, engage the biggest,
  reinforce under 30%, damage control to the emitters) and *Lifeline*
  (healer: escort the hunted ally, support the weakest, transfer and
  repair on, skirmish away from a charging beam). Presets *Anchor* (Galaxy,
  a beacon on a role cell) and *Lifeline* (Excelsior: two transfer
  emitters and a projector on its role cells, two tubes given up for the
  power).
- **The cube** gained a pair of cutting beams on its aft face (no face is
  safe from the beam any more; the aft stays bare of shields), the beam is
  600 damage every 22 s (was 520 / 28).
- **Honest measurement (§8)**: the machinery does what it says, and the
  tank plus healer pair does **not** pay off yet against the cube: four
  Cube breakers beat the cube faster and keep more hull than two breakers
  with an Anchor and a Lifeline, at 0 and at 6 wins, with a dodgeable beam
  and with an undodgeable one. Spreading the damage over four ships that
  skirmish away from the beam beats concentrating it on one ship that
  the healer cannot keep up with (a fight's 15 beams on the tank are
  about 14k damage; the healer moved 3.8k shield and 1.4k hull). The
  lever for 0.35+ is numbers, not rules: tank durability and healer
  throughput against the beam, or a boss whose damage cannot be spread.

### Bosses: the warbird (0.41, `shipClasses.dderidex`, `enemyAI.warbird`, `script.enemyScripts.warbird`, encounter `warbird`)
The second boss of §10: damage one afterburner burst cannot dodge. A
Romulan D'deridex, `kind: "boss"`, the second boss slot of a run once the
cube is beaten (`save.campaign.bossesBeaten`: a boss slot takes the first
boss encounter not in it, in list order; all beaten, the slot rolls among
them by weight).
- **The hull**: 44×26 cells, a ring of a hull around a frame of structure
  cells (`p`: not hull, beams never pass, torpedoes cut; it is what keeps
  the ring in one piece, the first measured hull without it lost 269
  blocks to two holes in a wing), a neck of structure to the head.
  436 blocks: 18 plasma cannons and 6 disruptors along the outside of
  both wings, 4 torpedo tubes in the beak, 4 tractor emitters at the
  centre of the head, 21 shield emitters over the ring and the head, 17
  reactors inside the wings, 33 engines in the nacelles, the bridge at
  the tail. Faction `romulan` (default modulation Tetryon), signature
  1100, speed 220 (1.3 km/s), turn 30°/s.
- **Tractor beam** (block `tractor`, `enemyOnly`; module `tractor`,
  `ew.tractor { rangeKm 9, hold 20, aiMinCap 0.2 }`): with a lock inside
  9 km the AI runs the module (enemyai.js, like the neutraliser); each
  30 s cycle holds the target for 20 s (`BS.Ships.tractor`: `ship.tractored`
  seconds left, `tractoredBy`, `tractorBlock`; the helm's speed is zero
  while held, so every turret on it hits at angular velocity 0, and the
  afterburner moves nothing). The hold ends with its time, or at once when
  the holder is gone or its last emitter dies (event `tractorReleased`).
  Event `tractored` is the tell: Helm calls "Tractor beam has us",
  Tactical "The {name} is caught in their tractor beam", the scan panel
  lists who it holds, the renderer draws the beam (`drawTractors`).
  Conditions `tractored` (us) and `allyTractored`; ally subject
  `heldAlly`.
- **Plasma cannons** (block `plasma`, `enemyOnly`): 30-damage bolts every
  2 s, one extra penetration point, optimal 7 km, tracking 0.6 rad/s:
  chip damage that a held ship takes in full.
- **The script** (`enemyScripts.warbird`): scan inside 20 km; every 30 s
  turn on the **loudest** ship (the beacon's rule, as the cube); remodulate
  shields when our ammo beats them; at 480 s **overdrive**; roll when blind.
  No escorts: measured with a raider and a gunboat at half hull, the role
  fleet (a minute slower than four breakers) was eaten by them in every
  run and the fight was about the escorts, not the hold (§8 v0.41).
- **Profile `warbird`**: never retreats, `statMult` 1.6, `damageMult`
  2.4, `shieldMult` 3, `shieldRegenMult` 2, and it **hunts reactors**
  (`targetWeights` reactor 0.45): a rim reactor under a plasma bolt goes
  up with its neighbours, the Anchor's inboard reactors do not.
- **The intended answer**: the Anchor (beacon lit: it is held and shot),
  the Lifeline (`allyTractored` → escort and support `heldAlly`: the
  transfer and the repair projector on the held ship), two **Warbird
  breakers** (`allyTractored` → target the biggest, aim at the plasma
  cannons: disarm it while the tank is held; escorts first otherwise;
  retune the ammo; then the reactors). Measured in §8 v0.41.

### Runs, roster and repair bills (0.35, `campaign.run`, `campaign.repair`, `enc.kind / roster`)
The skirmish-then-boss run of §10 and the fleet hangar's roster.
- **Encounter kinds** (`campaign.encounters[].kind`): `solo` (the default:
  the hangar's ship alone), `fleet` (`pair` from 2 wins, `pack` from 5:
  the whole roster undocks) and `boss` (`cube` from 4 wins). `enc.roster`
  lists who undocks, `[save.shipClass]` for a solo fight and `save.fleet`
  (flagship first) otherwise; `BS.Game.startBattle` spawns that list.
- **Boss slots** (`campaign.run`): counting wins and losses, every
  `bossEvery`-th battle (6: battles 6, 12, …) is a boss fight once the
  roster has `fleetMinHulls` (2) hulls and `bossFromWins` (4) wins are in;
  the pool is then the boss encounters only. Otherwise bosses stay out of
  the pool, and fleet encounters need the roster too. A retry keeps its
  slot (`retry.battles`). The hangar's threat line reads "Next: Solo /
  Fleet / BOSS · … · n hulls undock" and counts down "boss in n"; with one
  hull it says a second hull is needed.
- **Roster** (`save.fleet`, at most `campaign.fleetMax` 4 with the
  flagship): owned hulls in the shipyard get "Add to fleet" / "In fleet ✓"
  buttons and the ship line reads "Fleet n of 4: …". Each hull undocks
  with its own layout, tuning and script (`scriptByBuild`; alone,
  `soloScriptByBuild` first, in a skirmish `fleetScriptByBuild` first,
  0.43 / 0.44).
- **Repair bills** (`campaign.repair`): after a fight every destroyed
  block of ours costs `destroyedBlock` 20% of its price and a hull that was
  lost costs `lostHull` 30% of its block value; the bill is capped at the
  credits in hand (never below zero) and the report's "Repairs" row lists
  it per hull. Losing a hull is a bill, never permanent (§10).
- **Role numbers pass**: the cutting beam's extra penetration 8 → 4 (two
  plates of armor instead of a core-deep cut: the tank is built to take it
  on its armor) and the Anchor preset's saucer-rim reactors moved inboard
  (v2). Measured in §8.

### Win / lose
Enemy side beaten → Victory; player side beaten → Defeat. Result overlay
with stats.

### Campaign (`BS.Campaign`)
- **Credits**: win 500 × encounter `rewardMult` − 3 per % of the side's
  block hp lost × `rewardMult` (0.42, `credits.hullLostScalesWithReward`: a
  boss that pays ×8 docks ×8 for the hulls it cost, so the fleet that keeps
  its biggest hull out-earns the one that wins by losing it; before 0.42
  the penalty was flat and a lost Galaxy cost 123 cr of a 5,600 cr payout)
  + 50 per consecutive win (max 5), loss 120, never below 50. Start with
  600.
- **Salvage** (`campaign.salvage`): a win also pays a share of the block
  value still alive on the enemy: 10% of a destroyed ship's remains, 25% of
  a disabled ship (captured intact). Aiming at weapons and engines to
  disable a ship pays better than blowing it up.
- **Encounters** (`campaign.encounters`): each entry names an enemy class, a
  layout (`default`, a named variant, or `random`), the wins needed to
  unlock it, a weight and a reward multiplier. `BS.Campaign.encounter()`
  draws one with a PRNG seeded by battles won and lost, so the hangar's
  "Next:" line and the battle agree and a reload does not re-roll. The solo
  tier is a tutorial (0.39: eight entries, down from fourteen): the
  Bird-of-Prey raider from the start; Gunboat and Torpedo boat from win 1;
  the Jammer boat (ECM), the Shadow (cloak, ambush) and the Leech
  (neutralisers) from win 3; the K't'inga cruiser from win 4 and the Siege
  cruiser from 6. Fleet encounters need `minHulls` (the pair 3, the pack
  4) so a two-hull roster never meets a fight it cannot win. Klingon ship
  names come from `campaign.klingonNames`.
- **Kinds and runs** (0.35): each encounter has a `kind` (solo / fleet /
  boss); `encounter()` applies `campaign.run` (a boss slot every 6th battle
  from 4 wins with two hulls, fleet encounters only with two hulls) and
  names who undocks in `enc.roster` (§4 "Runs, roster and repair bills").
- **Repair bills** (`campaign.repair`, 0.35): settled with the credits,
  20% of each destroyed block's price and 30% of a lost hull's block value,
  capped at the credits in hand.
- **Enemy scaling**: `statMult = profile.statMult + 0.04 × wins` (max +0.4)
  multiplies every enemy block's hp and the shields; `damageMult` 1.6
  multiplies enemy weapon damage.
- **Shipyard**: ships at `shipClasses.*.cost` with their default build
  included. Boarding a ship uses that hull's own saved layout.
- **Build statistics**: dps assumes 80% beam hits and 85% torpedo damage;
  capacitor is simulated for 10 minutes with every active module running
  ("stable at n%" or "runs dry in n s").
- **Save**: localStorage key `bridgesim.save`, `saveDefaults` shape
  (version 2). Export downloads `bridge-sim-save.json`; Import validates and
  migrates. Reset asks for confirmation.
- **Dev mode** (0.45, `save.settings.devMode`, the *Dev mode* button by
  the save buttons): while on, hulls, blocks, tuning and intel cost
  nothing (`BS.Campaign.canAfford / spend`), the credit line reads "∞ cr ·
  DEV MODE (n banked)" and the balance is kept; battles still pay and bill
  as usual. For trying builds.

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
helm: { defaultDoctrine, reactionDelay, repositionDuration, flipMinInterval, flipShieldLow, flipShieldHigh, bearingStep, keepBand, keepRunBelow, holdSpeed, keepFireFraction, kiteMinBearing, sides, shadow,
        policy: { boosterBelow, boosterMinCap, reinforceBelow } }
enemyAI.doctrines: { id: { kind, ...ranges and timers, label?, desc?, ranges?: { field: [ref, fraction, ..., fallbackKm] } } }   // labelled = the player's set (0.37)
subsystems: { weapons, torpedoes, engines, shields, sensors, bridge: { label, short, effect, targetReport, damaged, repaired } }
subsystemEffects: { sensorsAccuracyFloor, sensorsLockMaxMult, bridgeCapMinMult, targetAccuracyMult }
modules: { id: { slot, kind: turret|launcher|active|passive, name, short, cycle, cap, pg, cpu, cost, desc, ...stats, effect } }
grid: { cellPx, structureHp, structurePierceCost, shield*/regen*/cap*/thrust*/sensor*/repair*, shieldRadius, powerPerReactor, brownoutMin,
        hitScatter, penetration, lineOfFire, lineOfFireStep, lineOfFireMuzzle, lineOfFireRangeCells, torpedoSplash, aimRadius, aimScatter, deadFraction,
        variant: { fraction, attempts, systemWeights }, maskLegend, layoutLegend }
blocks: { type: { letter, name, short, hp, mass, cost, power, color, desc, unique?, pierceCost?, explosion?: { damage, radius }, weapon?: { ... } } }
modules: { phaser_group, torpedo_group, shield_booster, shield_hardener, afterburner, jammer (block-bound active, effect.jam), cloak (kind "cloak", block-bound),
           decoy (block-bound active, effect.decoy), neut (block-bound active, effect.neut) }
ew: { jamPerBlock, jamDuration, cloakTime, decloakTime, surgeTime, cloakDrain, cloakMinCap, detectPerSensor, ghostAlpha, ownCloakAlpha, cloakRadius, jamRadius, strike,
      decoy: { life, lureKm, speedKmS, hitKm, spreadDeg, aiIncomingKm }, neut: { rangeKm, perBlock, aiMinCap, warnCapBelow, drainMemory, fleeKm } }
script: { tickSeconds, chargingKmS, traceMax, planTargets, defaultTemplate, maxRules, dryRun: { maxSeconds, stepsPerChunk }, bridgeCall: { tokens, holdSeconds, focusSeconds, confirmSeconds, disengageUntil, noCallBonus }, conditions: { id: { label, kind, def, negLabel? } }, actions: { id: { label, kind } }, policies: { id: { label } }, weakKinds,
          templates: { id: { name, desc, requires?, policies, rules: [{ when, do, until?, holdMax?, once?, every? }] } }, enemyScripts: { id: { name, rules } } }
campaign.firstFight: { weakPointChance }; campaign.encounters[].script; tuning (order, list, factionDefault, offFactionCost, tunable, measured, bonus / malus); save.tuning{}, builds[].tuning, intel[].tuning; shipClasses.*.variants / presets[].element; save: scripts[], scriptByBuild{}, plans{}, settings.manualBridge, campaign.cleanWins, campaign.retry
campaign.salvage: { destroyed, disabled, captured }; enemyAI.*: drainedBelow, drainedUntil, drainedTime
0.31: balance.fleetSpacingKm; campaign.fleetMax; campaign.encounters[].ships: [{ enemyClass, layout, doctrine, script, damageMult }]; save.fleet: [classId]; ship: team, target, contacts{}, flags.captured; state: teams { player: [], enemy: [] }, enemyFlag
0.32: script.subjects; rule.about; action target; conditions allyShieldBelow / allyHullBelow / allyUnderFire / outnumbered / enemiesAtMost / unfocused; templates.wolfpack; ship: scannedOf{}, scanTarget
0.46: campaign.enemyScaling.fleetStatMult / fleetDamageMult (BS.Campaign.enemyDamageMult(spec, kind))
0.45: campaign.enemyScaling.fleetFactor (BS.Campaign.enemyStatMult(profileId, kind)); save.settings.devMode (BS.Campaign.devMode / setDevMode / canAfford); state.encounter is set before the enemies spawn
0.44: save.fleetScriptByBuild (scriptFor / scriptIdFor / setScriptFor take kind "fleet"); tools/campaign.js --fleetscripts
0.43: save.soloScriptByBuild (BS.Campaign.scriptFor(classId, kind), scriptIdFor, setScriptFor(classId, id, kind)); tools/campaign.js --soloscript; templates.warbreaker answers the cube too (the beam rule, the aft side)
0.42: campaign.credits.hullLostScalesWithReward; tools/campaign.js --eval; the tools exit on a page error instead of waiting for a dry run that never ends
0.41: blocks plasma / tractor (enemyOnly); modules plasma_group / tractor (effect.tractor); ew.tractor { rangeKm, hold, aiMinCap }; shipClasses.dderidex; enemyAI.warbird; tuning.factionDefault.romulan; campaign.encounters[].name, encounter warbird; save.campaign.bossesBeaten; ship.tractored / tractoredBy / tractorBlock, BS.Ships.tractor / heldBy; conditions tractored / allyTractored; allySubjects.heldAlly; templates.warbreaker; enemyScripts.warbird; support.repairPerBlock 45 → 300; the Anchor preset's armoured nacelle rows
0.40: grid.heat, blocks.*.weapon.heat, ship.heat / overload / heatGovernor / governorHold, stats.heatCap / heatDissipation, conditions heatAbove / enemyHeatAbove / enemyHeatBelow, action governor, doctrine kite, the retired templates, event overload: all gone; tools/campaign.js
0.39: script.conditions 53 → 33 (the 1v1 micro conditions gone; a save's rule naming one is dropped and save.notice says so); enemyAI.stanceLabels / aimLabels, script.rangeBands / chargingKmS gone; campaign.encounters[].minHulls; encounters variant, interceptor, bombard, bulwark, pulser, warlord and the Bird-of-Prey variants interceptor, bulwark, pulser, bombard gone; the hangar's tuning dropdowns (rows unchanged)
0.38: grid.crew, blocks.*.crew, stats.crew, grid.boarding, ship.boarding, skills, save.skills / training, science (scanSeconds → script, cloakDetectRangeKm → ew), salvage.captured, flags.captured, condition boardable, action board, weak point kind crew, crit on quarters: all gone; BS.Grid.isSystem
0.37: helm.defaultDoctrine, helm.policy; enemyAI.doctrines[].label / desc / ranges (engage, skirmish, standoff, disengage; dogfight and bombard are the fixed former skirmish / standoff); script action doctrine (stance and play gone; saves migrated); settings.manualBridge gone; enemyScripts.torpedoBoat rules
0.35: campaign.run { bossEvery, bossFromWins, fleetMinHulls }; campaign.repair { destroyedBlock, lostHull }; campaign.encounters[].kind: solo | fleet | boss; encounter(): kind, roster, battles, bossSlot, nextBoss; retry.battles; settleBattle(): repairs, repairLines[]
0.34: mask letter r (block.roleCell); blocks transfer / repairbeam / beacon (roleOnly); modules shield_transfer / remote_repair / beacon (effect.sigMult); support { rangeKm, transferPerBlock, repairPerBlock, escortKm }; script.allySubjects; actions support / escort; policy support; subject loudest; templates anchor / lifeline; presets galaxy.anchor / excelsior.lifeline; ship: support, escorting, escortSubject
0.33: blocks.lance (enemyOnly, weapon.charge); modules.lance_group; shipClasses.borg_cube; enemyAI.boss (shieldMult, shieldRegenMult), enemyAI.overdrive; campaign.encounters[].kind / reinforcements; script.enemyScripts.borg; templates.cubebreaker; conditions notTargeting / enemiesAtLeast / lanceCharging / allyLanced; actions summon / overdrive; tuning.factionDefault.borg; block: charging, chargeTarget; ship: overdriven; state: summoned
shipClasses: { id: { name, className, role, faction, cost, purchasable, speed, turnRate, signature, lockRangeKm, powerBase,
                     mask: [rows], layout: [rows], presets: { id: { name, desc, rows } }, variants: { id: { name, desc, rows } } (enemies),
                     aiProfile?, visual: { kind, sprite, nacelleColor, hullTint } } }
crew: { officers, reports, events (battleStart is templated with {className}, {name}, {range}), hailReplies }
enemyAI: { doctrines: { id: { kind: strafe|brawl|standoff|broadside|ambush|evade|approach, engageKm, ...per-kind ranges and timers, tailChaseAngular, tailChaseTime } }, stateLabels,
           default | ktinga: { doctrine, accuracyMult, reactionDelay, statMult, damageMult, retreat*, reposition*, retreatRangeKm, booster*, afterburnerMinCap, targetWeights (none = spray) } }
campaign: { startingCredits, credits, salvage: { destroyed, disabled }, enemyScaling, encounters: [{ id, enemyClass, layout, doctrine, minWins, weight, rewardMult }], klingonNames }
visuals: { starLayers, nebulae, shieldColors, shake*, fragments: { sectionLife, deathLife, deathPieces, driftSpeed, deathSpeed, spin, fadeFrom } }
saveDefaults (version 2: layouts, builds, scripts, tuning, fleet)
```

Runtime ship: `pos, vel, heading, speed, hull, shields{4}, capacitor, capMax,
subsystems{6}, lock{target, progress, locked, time}, selected, targetSubsystem,
cmd{type, target, range, point, orbitDir, facing}, modules[{id, def, slot,
active, running, cycleLeft, cycleTime, state}], fitEffects, activeEffects,
repairPriority, reinforce, stats, mods, aiProfile, ai{state, timer, suspended, relock, ...}, doctrine, doctrineId,
neuted, script{def, target, active, activeSince, t, fired, lastFire, suspended},
scriptTrace[], scanned, scanning, scriptAim`; torpedo: `lured`; `BS.Weapons.decoys[]`;
block: `covered, coverBy` from derive.

## 7. Events
`lockStarted, lockAcquired, lockLost, moduleToggled, moduleCycle,
moduleOffline, shieldBoosted, phaserFired, torpedoLaunched, torpedoHit,
torpedoExpired, shieldHit, hullHit, blockDestroyed, sectionLost,
blockExploded, shipDisabled, shipDestroyed, jammed, cloakChanged,
alertChanged, stateChanged, orbitFlipped, stanceChanged (a doctrine set), enemyRolled, commandGiven,
decoyLaunched, decoyExpired, torpedoLured, torpedoDecoyed, neutralised, scriptRule, scriptSuspended, scriptAim, scanStarted, scanned, bridgeCall, bridgeCallRefused, speedChanged,
log, battleStarted, battleEnded, skillTrained, tractored, tractorReleased (0.41)`.

## 8. Measured balance (accelerated simulation, scripted captains, default builds)

Harness: `BS.Game.state.paused = true`, `BS.Game.step(1/60)` in a loop, the
captain script runs once per simulated second. Enemy strength as at the
given number of wins. Hit rolls and the enemy's aim choice are random, so
single runs vary a lot; ranges below are over 4–6 runs. Since 0.25 the
harness is in the repository: `tools/harness.js` (Playwright, one
`BS.Game.dryRun` per fight, the encounter forced by replacing
`campaign.encounters`, seeded `Math.random`, `--noreact` for the 0.24 enemy
bridge, `--eval` for a data tweak, `--debug` for what each bridge saw) and
`tools/smoke.js` (the headless interface check).

v0.46.0 (the pack as a farm fight. `--enemy pack`, the Galaxy fleet on the
Wolf pack, seeds 1–4, `--max 660`; `enemyScaling.fleetStatMult /
fleetDamageMult` scale a fleet encounter's hull and damage multipliers,
which come from the 1v1 profiles: default stat ×1.4, damage ×1.5, sized to
challenge one scripted hull):

Who dies to what (per-ship trace, the pack at 8 wins, both at ×1): the
Defiant (7k of block hp) died in the first 35–47 s in three fights of four,
dealing 600–900; the Constitution at 1:30–3:00 in two of four, taking 14k;
the gunboat alone dealt 10–12.5k a fight. Four enemies of 13.5k each against
our 56k, focusing whoever closed first: an even brawl, and even brawls cost
hulls. A disengage rule for the hunted ship (weakest shield under 30% →
disengage on the afterburner until 70%, 40 s at most) made it worse: 1 of
4 at 8 wins, 3 of 4 at 0 wins; the Defiant was dead before the rule could
fire. Not kept.

| fleetStatMult / fleetDamageMult | Pack at 0 wins | Pack at 8 wins |
|---|---|---|
| 1 / 1 (0.45) | 4 of 4 in 2:31–3:59 keeping 71–85% | 4 of 4 in 4:02–5:07 keeping 66–81%, 1–2 hulls lost a fight |
| 0.9 / 0.8 | 4 of 4 in 2:27–2:52 keeping 83–90%, 2 hulls lost over four | 4 of 4 in 2:58–4:22 keeping 77–87%, a hull lost in every fight |
| **0.8 / 0.8** | 4 of 4 in 2:02–2:31 keeping 85–91%, the Defiant lost in three of four | 4 of 4 in 2:08–3:22 keeping 81–89%, **no hull lost** |

The pair (`--enemy pair --wins 2`, Constitution + Galaxy + Excelsior): 4
of 4 in 1:36–1:55 keeping 89–96% at ×1, 0:55–1:21 keeping 95–97% at 0.8.

Runs (`tools/campaign.js --battles 12`, seed 1, as v0.44):

| Run | The pack at 9 | Bosses | Credits |
|---|---|---|---|
| Four Cube breakers | won 2:42 keeping 89%, one hull lost (v0.44: a stalemate, two lost) | cube 5:00; warbird 6:32 keeping 54%, the Galaxy lost | 600 → 8,665 (12 of 12; v0.44: 3,486) |
| Mixed | won 2:34 keeping 91%, no hull lost (v0.44: two lost) | cube 7:33; warbird 3:37 keeping 78% | 600 → 16,185 (12 of 12, **no hull lost**; v0.44: 9,873) |

Honest reading: the pack is a farm fight again, two to three minutes as
§10 asks, and the run's cost moved back to where the design puts it, the
boss (the breaker fleet still pays 5,896 for the Galaxy it loses to the
warbird). The Defiant remains the pack's first kill at full strength
(three of four at 0 wins): 7k of block hp against four focusing hulls is a
composition question, not a scaling one, and it is in §10 "next".

v0.45.0 (the fleet-tier scaling knob. `--enemy pack --wins 8`, the Galaxy
fleet on the Wolf pack, seeds 1–4, `--max 660`; `enemyScaling.fleetFactor`
scales the win bonus of a fleet encounter):

| fleetFactor | Pack at 8 wins |
|---|---|
| 1 (enemies +32%) | 4 of 4 in 4:02–5:07 keeping 66–81% |
| 0.5 (enemies +16%) | 3 of 4 in 3:28–5:07 keeping 63–79%, a stalemate at 11:00 (seed 2) keeping 46% |

Honest reading: a weaker pack was not a cheaper pack. Four seeds are few,
but nothing in them says the win bonus is what makes the pack fight cost
two hulls in a run (§8 v0.44), so the knob ships at 1 and the pack itself
(its composition, its payout against a two-hull repair bill) is the next
question. The first measurement of this row was wrong and is not shown:
the enemies' strength read the previous fight's encounter kind because
`state.encounter` was set after they spawned (fixed; the harness's run 1
of both columns came out identical, which is how it showed). The 12-battle
runs of v0.44 are unchanged by this version. Dev mode checked headless:
with 600 cr a Galaxy, a Sovereign, the Fortress layout and intel cost
nothing and the balance stays 600; off again, a Defiant is "Not enough
credits" and the flag persists. Smoke test: zero console errors in four
passes.

v0.44.0 (the third script kind. `tools/campaign.js --battles 12`, seed 1,
`--soloscript brawler`, `--fleetscripts` the Wolf pack on every hull of
the breaker fleet and on the two DPS hulls of the mixed one, bosses as in
v0.43):

| Run | The pack at battle 9 (8 wins: enemies +32%) | Bosses | Credits |
|---|---|---|---|
| Four Cube breakers | **stalemate** 11:00 keeping 44%, two hulls lost, −6,922 (v0.43 with the Cube breaker: lost, three hulls) | cube at 6 won 5:00; warbird at 12 won 3:11 keeping 68%, the Galaxy lost | 600 → 3,486 (11 of 12; 3 hulls lost) |
| Mixed | won 7:52 keeping 60%, two hulls lost, −5,314 (v0.43 with the Warbird breaker: won 5:15, one hull) | cube at 6 won 7:33; warbird at 12 won 2:28 keeping 84% | 600 → 9,873 (11 of 12: the Siege cruiser at 11 stalemated the Brawler alone; 2 hulls lost) |

Honest reading: the script kinds work as built (every hull flew the Wolf
pack in the pack fight and the Brawler alone), and the measurement says
the pack at 8 wins is not a template problem: both fleets lose two hulls
to it with the fleet template, where the §8 reference for the pack is at
0 wins (4 of 4 in 2:31–3:59). Enemy scaling (+4% a win, up to +40%)
lands four times on a fleet encounter and once on a solo one, so the
fleet tier gets harder faster than the solo tier; that, not the script,
is the next balance lever (§10 "next"). The warbird at 10 wins (stat
2.0) fell in 2:28–3:11 to both fleets with the aft side, the mixed one
keeping 84%.

v0.43.0 (a script per fight kind. `tools/campaign.js --battles 12`, seed 1,
`--soloscript brawler` on both fleets, the fleets as in v0.41; the Warbird
breaker now carries the cube's two answers, the beam rule and the aft side):

| Run | Solo | Fleet | Bosses | Credits |
|---|---|---|---|---|
| Four Cube breakers, Brawler alone | 9 of 9 won (the Shadow in 5:50, the K't'inga in 9:30) | the pack at 9: **lost** 5:30, three hulls lost, −8,525 → 0 cr | cube at 6 won 5:00 keeping 93%; warbird at 12 won 3:21 keeping 61%, the Galaxy lost, −5,090 | 600 → **631** (earned 21,034, repairs 17,583; 4 hulls lost) |
| Mixed, Brawler alone | 9 of 9 | the pack at 9: won 5:15 keeping 61%, one hull lost | cube at 6 won 7:33 keeping 79%; warbird at 12 won 3:17 keeping 82% | 600 → **11,503** (earned 25,313, repairs 10,520; 1 hull lost) |
| Mixed, Brawler alone, the Warbird breaker without the beam rule and the aft side | 9 of 9 | — | cube at 6: **stalemate** 11:00 keeping 53%; the cube again at 12, won 7:59 | 600 → 7,196 |
| v0.42 for comparison: the same fleets flying their boss script alone too | breakers 8 of 9; mixed 6 of 9 (a boss script has no 1v1 rules) | | | breakers 9,648, mixed 9,050 |

Harness rows for the template change (seeds 1–2): the mixed fleet with the
new Warbird breaker vs the warbird 2 of 2 in **2:38–2:56** keeping 73–76%
(4:18–4:42 with the old one: the aft side is where the warbird's bridge
and engines are; the Galaxy ended disabled once and at 42% once), vs the
cube 2 of 2 in 5:29–6:22 keeping 83–84% (the Cube breaker's numbers to the
second). Brawler alone vs the Shadow (3 wins, seeds 1–4) 4 of 4 in
3:46–6:22 keeping 100%; the Warbird breaker alone vs the Shadow 4 of 4 in
6:26–8:25.

Honest reading: with the solo fights on the Brawler and one boss script
for the run, the role fleet finishes the run with eighteen times the
credits of the breaker fleet, which is the economic differential 0.42
set out to make and 0.42 alone did not (both fleets flew a boss script
alone and both ran about even). The breaker fleet's run is decided by two
fights, the pack and the warbird, and in both it loses hulls; neither
fleet has a pack template that is not a boss script (§10 "next"). The
warbird fight is now short for both fleets (2:21 against 2:38–2:56): the
tank's margin is the hull kept, not the time. Smoke test: zero console
errors in four passes.

v0.42.0 (the frozen fight, the warbird at a bigger hull, the hull-lost
penalty. Same fleets and commands as v0.41, `--max 660`; the warbird at
×2.4 damage, repair 300, no escorts; "stat" is `enemyAI.warbird.statMult`):

The v0.41 row that "never finished" was a crash, not a cost: when the
Lifeline's escorted ally (the Galaxy) died with no other ally left, the
script's escort fallback called `BS.EnemyAI.setStance`, removed in 0.37,
and the dry run threw every step while the harness waited for an end that
never came. In the game the same fight would have frozen at the end of a
losing boss battle. Found with a CDP profile of the stepped fight (the
first 130 s cost 110–190 ms per 10 simulated seconds, then the exception);
fixed (the default doctrine), and both tools now print the page error and
exit instead of hanging.

| Warbird | Four breakers | Mixed |
|---|---|---|
| stat 1.6 (shipped, from v0.41) | 2 of 2 in 2:21–2:23 keeping 71%, the Galaxy lost both times | 2 of 2 in 4:18–4:42 keeping 77–86% |
| stat 1.8 | 2 of 2 in 2:05–3:19 keeping 64–72%, the Galaxy at 32% and disabled | 2 of 2 in 3:56–5:03 keeping 54–74%, the Galaxy and the Excelsior lost once |
| stat 2.0 | 1 of 2 (4:22 keeping 68%, two hulls disabled; a loss at 4:59, two lost) | 1 of 2 (5:36 keeping 68%, the Galaxy lost; a loss at 6:46 with the warbird at 58%, it dealt 51k) |

Honest reading: a bigger hull makes the fight longer, and a longer fight
kills the tank too. Against 23k of block hp the healer's 50 hp/s buys
about two more minutes, not a fight of any length, so stat 2.0 turns the
pair's win into the same coin flip the breakers get. The warbird stays at
stat 1.6: the fleet that is built to be held wins in four and a half
minutes and keeps its hulls, the one that is not wins in two and loses its
Galaxy. The §10 target ("the naive fleet loses") is not reachable with
this boss by numbers; a third boss needs damage the healer can race
(phases) rather than more hull (§10 "next").

Economy (`tools/campaign.js --battles 12`, seed 1, both fleets; the
Warbird breaker and the Cube breaker have no 1v1 rules, so the solo
battles of these runs are flown with a boss template):

| Run | Boss fights | Credits |
|---|---|---|
| Four Cube breakers, penalty flat (0.41) | cube at 6: won 5:30 keeping 90%, +4,171 +307 −990; warbird at 12 (10 wins, so stat 2.0): won 6:57 keeping 48%, the Galaxy lost, +5,510 +679 **−5,624** | 600 → 11,342 (11 of 12 won) |
| Four Cube breakers, penalty × reward (0.42) | the same fights; the warbird paid +4,049 +679 −5,624: **a boss win that lost credits** | 600 → 9,648 |
| Mixed, penalty × reward (0.42) | cube at 6: won 7:43 keeping 89%, +4,356 +874 −956; warbird at 12: won 4:36 keeping 77%, +5,025 +707 −1,562 | 600 → 9,050 (9 of 12: three solo fights lost or stalemated with the boss template) |

Honest reading: per boss the differential is now real (the mixed fleet
nets +4,170 on the warbird, the breakers −896), and the run totals still
favour the breakers because the Warbird breaker loses solo fights the
Brawler wins; a per-fight script choice (solo and fleet templates for one
hull) is a hangar question for later. References unchanged (the fix is
reached only when every ally of an escorting ship is gone).

v0.41.0 (the second boss. `--enemy warbird --wins 4`, the fleet Constitution +
Galaxy + Excelsior + Defiant, "four breakers" = the Cube breaker on every
hull with default layouts, "mixed" = the Galaxy on the Anchor preset and
template, the Excelsior on the Lifeline preset and template, Constitution
and Defiant on the Warbird breaker; seeds 1–2, `--max 660`; the warbird's
`damageMult` (×) and `statMult`, the healer's `support.repairPerBlock`
(repair) and the escorts as in the row, the rest as shipped. "disabled" =
every weapon and engine gone, the hull still there):

| Warbird | Four breakers | Mixed |
|---|---|---|
| First hull (a hollow ring, 442 blocks), 40-damage bolts every 3 s, ×1.0 | 2 of 2 in 1:28–1:33: two holes in a wing cut 269 blocks off the ring | — |
| Ring braced with structure cells; ×1.0, repair 45, two escorts at half hull | 2 of 2 in 3:48–3:59 keeping 77–80%, the Galaxy at 51–59% | 2 of 2 in 5:11–10:40 keeping 58–93%, the Galaxy disabled once |
| ×2.0, stat 2.0, repair 45, escorts | 2 of 2 in 5:55–6:32 keeping 56–59%, the Galaxy lost both times | 0 of 2 (7:51, 9:13): the Galaxy disabled, both breakers lost, the warbird at 51% |
| 30-damage bolts every 2 s (chip damage) from here. ×1.6, repair 300, escorts | 2 of 2 in 4:32–4:34 keeping 72–77% | 2 of 2 in 5:48–8:10 keeping 78–88%, the Galaxy at 75–82% |
| ×1.8, repair 300, escorts (Warbird breaker flipping between the boss and the escorts every hold) | 1 of 2 (3:47 keeping 79%; a loss at 5:26 with every hull disabled or lost) | 2 of 2 in 7:32–8:59 keeping 69–75%; the two breakers dealt a third of a Cube breaker's damage |
| ×1.8, repair 300, raider + gunboat escorts, escorts-first rule, plated nacelles | 2 of 2 in 4:28–5:21 keeping 61–74%, the Galaxy disabled both times | 0 of 2 (7:25, 10:32): every hull disabled, the gunboat untouched |
| the same with Cube breakers on the mixed fleet's two DPS hulls | — | 0 of 2 (4:54, 6:56): the escorts, not the template |
| **×2.4, stat 1.6, repair 300, no escorts** | 2 of 2 in 2:21–2:23 keeping 71%, **the Galaxy lost both times** (hull 6.9k of 23k) | 2 of 2 in 4:18–4:42 keeping 77–86%, the Galaxy at 65% once and disabled once |
| ×2.4, stat 2.0, repair 300, no escorts | 1 of 2 (4:22 keeping 68%, the Galaxy and the Excelsior disabled; a loss at 4:59 with two hulls lost) | not measured: two attempts (two seeds, then one) did not finish in 31 and 9 minutes of wall-clock time, where every other row took under 6; a long mixed fight against the 54k-hull warbird runs far slower than the rest, a performance question noted for 0.42 |

Per-ship damage in the ×1.8 rows (one fight each): four breakers dealt
15.7k + 2.1k (the held Galaxy) + 18.4k + 8.5k in 4:28; the mixed fleet
12.2k + 3.6k + 21.1k (the Lifeline, next to the boss the whole fight) +
4.5k in 10:32. The warbird's bolts hit 70–78% of the time in every row;
with the beacon lit every hold of a mixed fight landed on the Galaxy (10–13
holds a fight).

Honest reading. The lever of 0.35 ("damage one afterburner burst cannot
dodge") is in and does what it says: the hold lands on the loudest ship and
every bolt hits it. It did **not** make the tank and healer pair the
better fleet on its own, for three measured reasons. (1) In a breaker fleet
the loudest ship is already the biggest hull (the Galaxy, 23k of block hp,
twice a Constitution), so the "wrong" fleet carries a tank by accident.
(2) Healing was a rounding error: the repair projector moved 7 hp/s against
a boss that deals 60–130; at 300 per cycle (50 hp/s) the Anchor absorbs
15–31k over a fight and keeps 60–80% of its hull, which is what the rows
from "repair 300" onward show. (3) Escorts decide a long fight: a role
fleet is a minute or two slower than four breakers, and in that time two
Birds-of-Prey disabled every hull of ours in six of six runs, with the
breaker templates as much as with the Warbird breaker. So the warbird has
no escorts, its bolts are chip damage (30, so a plate or a phaser survives
one and the healer can refill it) at ×2.4, and the fight is decided by who
is held: four breakers kill it in 2:21 and lose the Galaxy every time
(a repair bill of 30% of a Galaxy plus its blocks), the mixed fleet takes
twice as long and keeps its hulls. That is a real differential the
campaign economy sees, not yet the §10 target "the naive fleet loses"; at
stat 2.0 the breakers do lose half their fights, but the mixed row there
never finished (last row), so the warbird ships at stat 1.6. Next lever, recorded for 0.42: the breakers' Galaxy dies because
its rim reactors chain (the warbird hunts reactors); a boss rule that
punishes the biggest hull without the beacon (turn on the biggest, not the
loudest) would make the beacon a choice rather than a default.

The references, re-measured with the healer's repair at 300 and the
Anchor's plated nacelle rows (both only reach fleets that carry them):

| Matchup | 0.40 | 0.41 |
|---|---|---|
| Constitution vs Raider (0 wins), Brawler, seeds 1–4 | 3 of 4 in 2:35–2:59 keeping 73–92% | identical |
| Constitution + Miranda + Defiant + Excelsior vs `pack` (0 wins), Wolf pack on all, seeds 1–4 | 4 of 4 in 3:57–6:56 keeping 42–73% | identical (the Galaxy fleet, not measured before: 4 of 4 in 2:31–3:59 keeping 71–85%, the same on main) |
| Four Cube breakers vs `cube` (0 wins) | 2 of 2 in 3:50–5:27 keeping 84–91% | identical |
| Mixed (Anchor + Lifeline + two Cube breakers) vs `cube` (0 wins) | 0.35: 8 of 8 over both tiers, 5:38–7:35 | 2 of 2 in 5:29–6:22 keeping 83–84% |

A whole run (`tools/campaign.js --battles 12`, seed 1, the mixed fleet
with the Warbird breaker on the Constitution and the Defiant): 9 of 12,
the cube in the first boss slot (battle 6, won in 7:43 keeping 89%) and
the warbird in the second (battle 12, won in 4:36 keeping 77%, a 1,562 cr
repair bill against a 5,604 cr payout), 600 → 9,838 cr (earned 20,549,
repairs 8,084, one hull lost). The two losses and the stalemate are solo
fights flown with a boss template (the Warbird breaker has no 1v1 rules);
the boss order holds (`bossesBeaten`).

The smoke test's new warbird pass (Constitution + Miranda + Defiant +
Excelsior on default layouts, Warbird breaker on all, 0 wins): a defeat
at 2:27 with every hull destroyed. Without a hull built to be held, the
hold is a death sentence, which is the point.

v0.40.0 (the campaign harness; heat measured and removed. Harness rows
with every hull's script set, seeds 1–4 for the 1v1, the pack and the
cruiser, 1–2 for the rest; `--eval "BS.Data.grid.heat.base = 1e6"` is "no
heat" on 0.39, the third column is 0.40 with heat gone):

| Matchup | 0.39 | 0.39, no heat | 0.40 |
|---|---|---|---|
| Constitution vs Raider (0 wins), Brawler | 3 of 4 in 2:35–2:59 keeping 73–92% | identical | identical |
| Four hulls vs `pack` (0 wins), Wolf pack | 4 of 4 in 3:57–6:56 keeping 42–73% | identical | identical |
| Four Cube breakers vs `cube` (0 wins) | 2 of 2 in 3:50–5:27 keeping 84–91% | identical | identical |
| Constitution vs Cruiser (4 wins), Brawler | 4 of 4 in 3:32–5:52 keeping 78–99% | identical | identical |
| Constitution vs Shadow (3 wins), Ambush | — | — | 2 of 2 in 3:46–5:54 keeping 100% (its heat `until`s gone) |

Two whole runs (`tools/campaign.js --battles 12`, seed 1, before the heat
cut; the cut changed no fight):

| Run | Battles | Credits | Notes |
|---|---|---|---|
| Constitution alone, Brawler | 11 of 12 won; no boss slot (one hull) | 600 → 6,688 (earned 14,613, repairs 5,451) | the one loss (the Leech, battle 5) cost the whole purse: the repair bill of a lost hull is capped at the credits in hand |
| Constitution + Galaxy + Excelsior + Defiant, Cube breakers | 11 of 12; the cube at battles 6 and 12, both won; no fleet skirmish drawn | 600 → 15,931 (earned 23,311, repairs 3,950) | one stalemate: the Shadow against a Cube breaker flagship (a cloaked raider nobody hunts); a four-hull fleet banks 16k credits with nothing to spend them on |

Honest reading: heat never bound a scripted fight, so it is gone and
nothing moved. The campaign harness shows two things the fight harness
could not: a single early loss empties the purse (repairs are 37% of a
solo run's income, 17% of a fleet's), and credits pile up once the fleet
is bought. Both are economy questions for after the second boss; and the
Shadow stalemate says a solo-tier template needs a cloak answer the fleet
templates lack (a `noCloak` / scan rule), noted for the next template pass.

v0.39.0 (vocabulary cut, tuning per ship, the tutorial tier; seeds 1–4
for the 1v1 and the pack, 1–2 for the rest; every hull's script set):

| Matchup | 0.38 | 0.39 |
|---|---|---|
| Constitution vs Raider (0 wins), Brawler | 3 of 4 in 2:35–2:59 keeping 73–92% | identical |
| Four hulls vs `pack` (0 wins), Wolf pack on all | 4 of 4 in 3:57–6:56 keeping 42–73% | identical |
| Four Cube breakers vs `cube` (0 wins) | 2 of 2 in 3:50–5:27 keeping 84–91% | identical |
| Constitution vs Torpedo boat (1 win), Brawler | 4 of 4 in 2:24–3:55 keeping 86–98% | 2 of 2 in 2:37–4:07 keeping 86–95% |

Honest reading: 0.39 changed what a script can say and what the hangar
shows, not how a fight runs; every reference is the same fight to the
second. The headless hangar check: an old save's rule naming `enemyState`
is dropped and the hangar says so; the sections read Flagship, Fleet,
Script, Intel, Tuning, Build; the weapons dropdown set to Graviton costs
198 cr on a stock Constitution and writes the rows. The pack fight's cost
(42–73% kept) is where the fleet tier stands after the manning cut of
0.38; the next balance pass (the second boss, §10) starts from here.

v0.38.0 (boarding, crew manning, skills and science out; seeds 1–4 for
the 1v1 and the pack, 1–2 for the rest; every hull's script set):

| Matchup | Before (0.37) | After |
|---|---|---|
| Constitution vs Raider (0 wins), Brawler | 3 of 4 in 2:35–2:59 keeping 73–92% | identical |
| Four hulls vs `pack` (0 wins), Wolf pack on all | 2 of 2 in 3:21–4:54 keeping 63–69% | **4 of 4** in 3:57–6:56 keeping 42–73%: longer and costlier |
| Four Cube breakers vs `cube` (0 wins) | 2 of 2 in 4:38–5:15 keeping 86–88% | 2 of 2 in 3:50–5:27 keeping 84–91% |
| Constitution vs Leech (3 wins), Brawler | not measured since 0.2x | 1 of 2 (4:28 keeping 76%, one loss) |

Honest reading: nothing a player can see changed in the 1v1 reference,
and the boss is the same outcome. The pack fight is harder without
manning: hits on crew decks used to slow a raider's guns and shields
(casualties were a hidden debuff on both sides, and the Wolf pack's
focus fire profited from it); now a raider shoots at full rate until it
dies. The outcome holds (4 of 4) at a higher price; nothing was re-tuned
in this PR, so the fleet tier's numbers are re-measured in 0.39 after the
vocabulary cut.

v0.37.0 (plays and the hand-flown bridge out, one doctrine list; seeds
1–4 for the 1v1 rows, 1–2 for the fleets; every hull's script set):

| Matchup | Before (0.36) | After |
|---|---|---|
| Constitution vs Raider (0 wins), Brawler | 3 of 4 in 2:35–2:59 keeping 73–92% | identical |
| Constitution vs Torpedo boat (1 win), Brawler | 4 of 4 in 2:57–3:51 keeping 92–98% | 4 of 4 in 2:24–3:55 keeping 86–98% (its Siege play is now three rules) |
| Constitution vs Interceptor (2 wins), Brawler | 2 of 4, 2 stalemates, 6:53–7:40 | identical (`dogfight` is the former fixed `skirmish`) |
| Four hulls vs `pack` (0 wins), Wolf pack on all | 2 of 2 in 3:21–3:49 keeping 72–73% | 2 of 2 in 3:21–4:54 keeping 63–69% (the pack's torpedo boat flies the new rules) |
| Four Cube breakers vs `cube` (0 wins) | 2 of 2 in 4:38–5:15 keeping 86–88% | identical |

Honest reading: folding the stances into the doctrine list changed no
player-side number (the four references that carry no torpedo boat are
identical to the second); the torpedo boat's three rules fight a little
differently from its play, within the same outcome. Nothing was re-tuned.

v0.35.0 (runs, roster, repair bills; the role numbers pass: cutting beam
extra penetration 4, Anchor v2; `--max 600`, seeds 1–4 for the rows that
decide, 1–2 for the rest; **every hull's script set with `--scripts`**,
see the correction below):

| Matchup | Scripts | Outcome |
|---|---|---|
| Constitution vs Raider (0 wins) | Brawler | **3 of 4** in 2:35–2:59 keeping 73–92%, as 0.31–0.34 |
| Constitution + Miranda + Defiant + Excelsior vs `pack` (0 wins) | Wolf pack on all four | 2 of 2 in 3:21–3:49 keeping 72–73%, the Excelsior lost both times |
| Constitution + Miranda vs `pair` (0 wins) | Wolf pack on both | 0 of 1 (5:09, 37%), as 0.32 |
| Constitution + Galaxy + Excelsior + Defiant vs `cube` (0 wins) | Brawler on all four | **0 of 2**, lost in 7:56–8:25 keeping 37–42% |
| same | **Cube breaker on all four** | **4 of 4** in 4:15–5:15 keeping 79–88%, no hull lost (the Galaxy at 48–72%) |
| same | Cube breaker on the flagship, Brawler on the rest | 1 of 4: a win at 8:40 keeping 69%, two losses, a stalemate |
| same | Mixed: Galaxy *Anchor*, Excelsior *Lifeline*, two breakers | **4 of 4** in 5:38–7:35 keeping 79–89%, no hull lost (the Constitution disabled in three) |
| same at 6 wins | Cube breaker on all four | 2 of 2 in 5:33–5:35 keeping 74–93%, the Galaxy lost once |
| same at 6 wins | Mixed | **4 of 4** in 5:45–8:14 keeping 70–82%, a hull lost in two |
| same at 6 wins, with 0.34's beam (penetration 8, Anchor v1) | Mixed | 2 of 2 in 7:08–9:43 keeping 62–71%, a hull lost in both |

Correction to the 0.33 and 0.34 tables: the harness gives `--script` to
the flagship only; the other hulls fly their assigned script or the
default template (the Brawler) unless `--scripts` names one per class.
`--scripts` arrived in 0.34, and the rows labelled "the same script on all
four" (0.33) and "four Cube breakers (default layouts)" (0.34) were run
without it, so they measured a Cube breaker flagship with three Brawlers.
That fleet does not reproduce those rows on the merged 0.34 either (1 of
4 at 0 wins, 0 of 2 at 6 wins; the same with the aft beams, the loudest
rule or the dodge rule taken out one at a time), so those rows came from
an earlier working state and are not to be trusted. The rows above are
the reference from now on.

Honest reading: with every bridge scripted the §10 target holds (four
Cube breakers 4 of 4, four Brawlers 0 of 2) and the run puts the boss in
its slot on schedule. The numbers pass makes the tank + healer pair a sure
win as well (8 of 8 over both tiers; with 0.34's deeper beam the 6-win
fights ran longer and cost a hull each), but four breakers are still the
faster fleet (4:15–5:15 against 5:38–7:35) and lose fewer hulls at 6 wins.
Roles are now a valid answer, not yet the better one: a boss whose damage
one afterburner burst cannot dodge is the lever that stays (§10). Cost
unchanged from 0.34.

> Correction (0.35): the "four Cube breakers" rows below were measured
> with the breaker on the flagship only (no `--scripts`); see v0.35.0.

v0.34.0 (role blocks; the cube with aft beams, beam 600 / 22 s; the fleet is
Constitution + Galaxy + Excelsior + Defiant, "mixed" = Constitution and
Defiant on the Cube breaker, Galaxy on the Anchor preset and template,
Excelsior on the Lifeline preset and template; 2 fights each):

| Fleet | 0 wins | 6 wins |
|---|---|---|
| Four Cube breakers (default layouts) | 2 of 2 in 4:06–4:24 keeping 88–89% | 2 of 2 in 5:02–5:30 keeping 81–85% |
| Mixed: tank + healer + two breakers | 2 of 2 in 5:56–6:12 keeping 81–86%, a hull lost each fight | 1 of 2 (a win at 7:01 keeping 71%, a loss at 7:04 with the Galaxy and two more lost) |
| Four breakers without the dodge rule | 2 of 2 in 4:20–5:44 keeping 74–87%, the Galaxy lost once | — |
| Mixed vs an undodgeable 760-damage beam (tried, not kept) | 2 of 2 in 7:40–8:05 keeping 59–66%, the Galaxy lost both times; four breakers against the same beam 2 of 2 in 4:14–6:02 keeping 75–84% | — |

Event counts in one mixed fight (seed 7): beacon lit, the Galaxy's
signature 1500; all 15 beam charges on the Galaxy, none on the others;
59 transfers moving 3,807 shield, 50 remote repairs restoring 1,378 hp,
2 escort orders; the Galaxy was still lost at 49% of its blocks.

Honest reading: 0.34 delivers the role machinery (cells, blocks, subjects,
actions, templates, presets) and the beacon does draw the boss exactly as
designed, but a tank plus healer is a worse fleet than two more breakers
against this boss, at both tiers. With the aft beams the dodge rule now
buys a little (a Galaxy lost once without it). Roles will pay off only
when a boss deals damage that cannot be spread or dodged and a healer's
throughput can hold one ship under it; that is a numbers pass for 0.35+,
recorded here so nobody mistakes the role templates for a solution.

> Correction (0.35): `--script` reached the flagship only; the other three
> hulls flew the Brawler in every row below. See v0.35.0.

v0.33.0 (the first boss; four Federation hulls, the same script on all four,
`--enemy cube --wins 0`, seeds 1–4 for the two rows that decide, 1–2 for
the rest, `--max 600`):

| Fleet script | Outcome |
|---|---|
| **Brawler** | **0 of 4**: lost in 7:10–8:35 keeping 31–35%, the cube at 46–49% hull, one escort destroyed at most |
| Wolf pack | 0 of 2: lost in 7:10–8:35, as the Brawler |
| **Cube breaker** | **4 of 4** in 4:31–5:31 keeping 83–93%: cube and both escorts destroyed (once the cube disabled), one hull lost in one fight |
| Cube breaker without the dodge rule | 2 of 2 in 4:55–5:01 keeping 87–90% |
| Cube breaker without the aft side (any side, no aim) | 2 of 2 in 7:58–9:15 keeping 72–93%: the enrage at 7:00 fired in both |

Cost (`--perf`, cube + four hulls before the escorts, 1,402 blocks): 13 ms
per simulated second, 10.2 ms per frame headless without a GPU.

Honest reading: the first boss meets the §10 target exactly: the intended
solution wins 4 of 4 and the two generic fleet scripts lose 0 of 6. Of the
mechanics, the escorts (killed first or they stay on you) and
concentration on the cube turn the loss; the bare aft halves the fight;
the cutting beam punishes the Brawler's close orbit on the three armed
faces but costs a fleet astern nothing, so the dodge rule is insurance
for the approach, not a solution. The remodulation never fired (nobody
tunes off the Federation default yet), and the enrage fired only in the
slow fights. Bosses are tuned by data (`enemyAI.boss`), not by rules.

v0.32.0 (fleet scripts: subjects, the target action; the Raider and
Cruiser scripts gained the `unfocused` rule, so enemy packs concentrate
fire too; seeds 1–4, `--max 480` for the 4v4):

| Matchup | Scripts | Outcome |
|---|---|---|
| Constitution vs Raider (0 wins) | Brawler | **3 of 4**, the same seconds and percentages as 0.31 (the new enemy rule never holds in a 1v1) |
| Constitution + Miranda + Defiant + Excelsior vs `pack` | Brawler on all four | **0 of 4** in 2:49–4:08 keeping 31–32%: every hull lost or disabled, the raiders at 32–100% (0.31: 1 of 2 before the pack concentrated fire) |
| same | **Wolf pack** on all four | **4 of 4** in 3:21–5:06 keeping 62–73%: one hull lost a fight (the Excelsior three times, the Constitution once), all four raiders destroyed or disabled |
| Constitution + Miranda vs `pair` | Wolf pack on both | 0 of 3 in 2:55–5:09 keeping 31–47%; one raider destroyed or disabled each time, the other over 74% |

Honest reading: the target action is the first script lever that moves a
fleet fight from a sure loss to a sure win at the same hulls, which is what
§10 asked of 0.32 (fire concentrated by plan, not by geometry). Two hulls
against two raiders of Constitution weight still lose, as expected before
the fleet economy. The Wolf pack beats the Brawler by concentration alone:
no role blocks, no boss yet.

v0.31.0 (fleet engine; the harness now stops the page's frame loop, so a
seed repeats exactly: the 0.25–0.30 rows drifted by a few seconds because
drawing consumed `Math.random` on wall-clock frames, and are not
seed-comparable with these):

| Matchup | Captain | Outcome |
|---|---|---|
| Constitution vs Raider (0 wins) | Brawler, seeds 1–4 | **3 of 4** in 2:35–2:59 keeping 73–92%, one loss (4:31 keeping 41%); the same seeds before 0.31 (frame loop running): 4 of 4 in 2:21–6:14 |
| Constitution alone vs `pair` (Raider + Gunboat, 0 wins) | Brawler | 0 of 3: disabled in 1:17–1:42 keeping 45–51%, both raiders over 79% |
| Constitution + Miranda vs `pair` | Brawler on both | 0 of 3 in 2:08–2:49 keeping 29–39%: both hulls lost, the Gunboat down to 42–97% |
| Constitution + Miranda + Defiant + Excelsior vs `pack` (four Birds-of-Prey) | Brawler on all | 1 of 2: a win at 5:33 keeping 55% (Reliant and Excelsior lost, all four raiders destroyed), a loss at 5:49 keeping 30% with one raider destroyed |

Cost (headless Chromium, software rendering, `--perf`: 600 fixed steps,
120 frames at 1280×800): 2 hulls (362 blocks) 5.1 ms per simulated second
and 5.2 ms per frame; 8 hulls (1,386 blocks) 18.9 ms per simulated second
(0.3 ms a step) and 11.9 ms per frame. The simulation is far from the
limit at eight grids; the draw stays inside a 60 fps frame even without a
GPU, with the hull plating the biggest share.

Honest reading: the fleet fights are engine checks, not balance (the
enemy's ×1.4 stat and ×1.6 damage multipliers make each Bird-of-Prey about
a Constitution, so two of them beat one hull or a hull and a Miranda, and
four Federation hulls split a pack 1 of 2). Both sides pick the nearest
hostile, so fire concentrates by geometry, not by plan; the target action
and subjects of 0.32 and the fleet economy of 0.35 decide the targets
worth setting.

Measurements before 0.31 (0.6–0.30, the hand-flown 1v1 game) are in
Appendix A at the end of this file.

## 9. Roadmap

| PR | Feature |
|---|---|
| A (done, v0.3) | EVE-style controls, HUD, capacitor, modules, lock, tracking, fixed fit |
| B (done, v0.4) | Hangar with slot fitting, market, credits, real-time skills, save |
| v0.5 PR 1 (done) | Block grid hulls, nine block types, per-block damage with penetration, splash and section loss, grid renderer, build preview and statistics |
| v0.5 PR 2 (done) | Hangar block editor (paint, erase, mirror, presets), block costs and refunds, saved builds |
| v0.34.0 (done) | Role blocks (§4 "Roles from blocks"): role cells in every Federation mask, shield transfer, remote repair and beacon blocks and modules, ally subjects with `support` and `escort`, the `loudest` subject, Anchor and Lifeline templates and presets, aft beams on the cube; measured as not yet paying off |
| v0.33.0 (done) | The first boss (§4 "Bosses"): the Borg cube, the cutting beam with a charge tell, summoned escorts, overdrive, the boss script with callouts, the Cube breaker template, enemy-only blocks and actions |
| v0.32.0 (done) | Fleet scripts (§4): subjects (`about`), the `target` action, ally and count conditions, scans per ship, the Wolf pack template, enemy packs that concentrate fire, the report per hull |
| v0.31.0 (done) | Fleet engine (§4, §10): teams, N ships against M, target selection and retargeting, team elimination, viewer and primary enemy, camera over every ship, encounters with `ships`, `save.fleet`, harness fleets and `--perf`, deterministic harness, learning zeroed |
| v0.40.0 (done) | `tools/campaign.js` plays a whole run headless (encounters as the game picks them, repairs and credits settled); heat measured with the cap at infinity (every reference identical) and removed with the governor, the heat bar, the heat conditions, the `kite` doctrine and the retired templates (§8 v0.40) |
| v0.39.0 (done) | Script vocabulary 53 → 33 conditions with a save migration; tuning per ship (three dropdowns); the solo tier trimmed to eight and `minHulls` on fleet encounters; the hangar in the loop's order (flagship, fleet, script, intel, tuning); §8 history before 0.31 moved to Appendix A |
| v0.38.0 (done) | Boarding (`js/boarding.js`), crew manning (`grid.crew`, `blocks.*.crew`, manning multipliers, far-from-quarters repair, the crew weak point), real-time skills and science removed; quarters are damage-control blocks; `script.scanSeconds`, `ew.cloakDetectRangeKm` |
| v0.37.0 (done) | Plays and the hand-flown bridge removed; stances folded into one doctrine list (§4 "One doctrine list"): labelled doctrines with build-derived ranges, the `doctrine` action for both bridges, a Fly bridge call; the Torpedo boat's Siege play as rules |
| v0.36.0 (done) | The vision (§1–§2: WoW raids in Trek ships in an arena) and the first cut (§10 "Streamline"): learning, signatures, the opening book, the counter table and the doctrine table removed; the report keeps the rule pair and the tuning line |
| v0.35.0 (done) | Runs, roster and repair bills (§4): encounter kinds solo / fleet / boss, a boss slot every 6th battle from 4 wins with two hulls, the shipyard's roster buttons, repair bills per destroyed block and lost hull with a Repairs row in the report; cutting beam penetration 4 and the Anchor v2 preset; §8 re-measured with every hull's script set (correction to the 0.33–0.34 fleet rows) |
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
| v0.30.0 (done) | Remodulating in battle (enemy reactions with callouts, two bridge calls, script vocabulary), the frequency weak point, the enemy reading the player's tuning from the last wins |
| v0.29.0 (done) | Tuning: five modulations on every shield emitter, armor plate and weapon block (shield frequency, alloy, ammo), one ring and one multiplier, faction defaults with an off-faction surcharge, Tune mode in the editor, tuning on scan / intel / Book / report, equal-hull measurements |
| v0.28.0 (done) | The element ring: five Trek elements (Graviton, Nadion, Photon, Plasma, Duranium) as block families, one rule (×1.35 into the element you beat, ×0.65 into the one that beats you), measured in both directions on every edge; Doctrine page, element answers in the enemy's learning |
| v0.27.0 (done) | Elements: five block families with a type chart in the damage path, a build's element in the hangar, the measured three-element wheel and the balanced pair on a Doctrine page, element answers in the enemy's learning, five new layouts, equal-hull duels in the harness |
| v0.26.0 (done) | Honest loss (contact instead of a cloaked ship's position, for both ships), "why you lost" with damage booked to the standing rules and the measured doctrine table, signatures of wins and an enemy that learns from them (same-weight answers, said in the hangar), the 3-win matrix in §8 |
| v0.25.0 (done) | Enemy reactions as script rules with callouts (roll when shadowed, reinforce and roll when their emitters are hunted, kite under an alpha, hold off a cloaked ship), new observations (enemy stance, aim, range band off our weapons, afterburner, heat, blind time), opening book per encounter, `tools/harness.js` and `tools/smoke.js` |
| v0.24.0 (done) | Battle report with the script timeline and never-fired reasons, clean-bridge bonus, refit & retry against the same enemy |
| v0.23.0 (done) | Battle screen: bridge calls (2 a battle, confirm by pressing twice, overrides that hand back), trace band, speed 1× / 2× / 4×, manual bridge behind a debug setting |
| v0.22.0 (done) | Hangar script editor (sentence dropdowns, templates, copy / save / assign), plan targets on the intel drawing, dry run against the next enemy |
| v0.21.0 (done) | Bridge scripts: when → do rules with policies, call-outs, templates from the plays, enemy scripts on the same engine, scan before weak points, sentences for every rule; balance: K't'inga stern cannons, Torpedo boat two tubes, first fight without weak-point hunting |
| v0.19.0 (done) | Decoy launchers (torpedo lures, enemy Siege K't'inga carries them), energy neutralisers (capacitor drain, `drained` enemy state, Leech encounter, counter rule), boarding parties (transporter window, defenders per crew deck, capture as a victory) |
| v0.18.0 (done) | Cut the neck (structure 400 hp, torpedoes ×2 on it, STRUCT aim, two-block necks in the analysis), hangar intel (scanned or bought enemy layouts drawn with weak points before the fight) |
| v0.17.0 (done) | Weak-point analysis with click-to-focus-fire on any block, enemies that aim at your weak points, counter-doctrines announced in the hangar |
| v0.16.0 (done) | Reactor power range (systems outside 15 cells of a reactor run at half; every layout re-placed its reactors), warp core breach with a blast and the AIs clearing it, severed sections that keep momentum, burn engines, cook off reactors and hit what they drift into |
| v0.15.0 (done) | Shield recharge delay (hit facings pause 4 s), attack side / blind-sector shadowing with an enemy counter-roll, critical hits by system |
| v0.14.0 (done) | Enemy scan panel in place of the full-width log (block grid with damage, shield bubbles and bare hull, cloak / ECM field gaps, systems, crew, power, heat, weapons bearing on us, threat); the bridge log is a two-line ticker over the display, LOG / G expands it |
| later | Science scan (`science.scanDuration`) gating the panel's detail; weakness bonus |
| later | Fire spreading put out by crew quarters; reactor power range; audio; sector map; sprites |
| later | Audio via events, sector map and missions, science scans and cloaked ships, optional image sprites |

## 10. Direction from 0.31: fleet, roles, boss (decided 2026-10-19)

The 1v1 "chess" line (0.25–0.30: reactions, learning, tuning, the counter
table) is **closed**. Its own measurements say why: the Brawler template
and an emitter hunter win 3–4 of 4 against every Bird-of-Prey variant
(§8 v0.26), the enemy has nothing to learn against them, and learned
tuning turns a tuned player into a 0 of 4 (§8 v0.30). From 0.31 the game
is a **PvE fleet game**: the player is the admiral, writes the scripts,
and the fights are a mix of skirmishes and designer-written bosses.

### Decisions

| Topic | Decision |
|---|---|
| The player | Admiral of a fleet of up to **4** hulls, each with its own build and script; the player watches the fight, with 2 bridge calls per battle for the whole fleet |
| In the fight | The scripts run; mechanics are solved by rules written beforehand, never by hand (the manual bridge stays a debug setting) |
| Formats | **1v1** (one hull picked from the fleet), **4v4** (fleet against an enemy fleet), **4 vs boss** (fleet against one large hull with phases, plus adds). Chosen per encounter in `campaign.encounters` |
| Structure | A run of 4–6 short fights (1v1 or 4v4, 2–3 minutes) then a boss (5–8 minutes); a boss win opens the next chapter. A list first, a sector map later |
| Roster | Picked per fight (one hull for a 1v1, up to four otherwise); the whole fleet is not always deployed |
| Losing a hull | A repair bill in credits; never permanent loss |
| Skirmishes | Fast and cheaply varied: environment and objective modifiers in data (nebula without shields, asteroid line-of-fire cover, escort a freighter, a time limit). The Brawler winning them is accepted: they are the farm |
| Bosses | Where the challenge is. A boss invalidates the Brawler with **mechanics**, not numbers; each mechanic is an enemy script rule with a callout, and the opening book records the tells across attempts |
| Enemy fleets | Built from the **player's own role blocks and script templates** (four scripts side by side); no separate fleet AI |
| Balance target | PvE only: the intended solution wins, a pure Brawler fleet loses. No symmetric counter table. If a dominant 4v4 composition appears, it is accepted or answered with a modifier, never with a counter table |
| Stopped | Pillars 2 / 4 / 6: the counter table, signatures and learning, learned tuning, the ghost of the player's build. Their data stays; `campaign.learn` probability goes to 0 for skirmishes |
| Kept | The script engine, battle report (timeline, never fired, why you lost), dry run, refit & retry, opening book, tuning and `remodulate` |

### Roles come from blocks

Roles are labels read off a build, not hull classes. Role blocks go only on
**role cells** in the hull mask (a new mask letter, as `n` is for engines),
and hulls differ in how many they offer, so a Galaxy heals better and an
Oberth jams better while any hull can still be built freely.

| Role | Already there | To add |
|---|---|---|
| DPS | phaser, pulse, disruptor, torpedo tube, ammo tuning | — |
| Tank | armor, shield emitters, hardener, decoys, alloys and frequencies | **beacon** block: raises the ship's signature so a boss rule "fire at the largest signature" picks it |
| Healer | — | **remote shield transfer** and **remote repair** blocks, 3–4 km |
| Jammer / support | ECM, neutraliser, cloak | tractor beam (hold adds), remote sensor boost (later) |
| Marines | boarding parties | — |

- **No aggro table.** A boss picks its target by a public rule in its
  script (largest signature, nearest, the ship hurting it most); the tank
  satisfies that rule (beacon, armor, decoys). Each boss can use a different
  rule, which is a mechanic for free.
- **Healing is a transfer, not creation.** Shield transfer moves shield and
  capacitor out of the healer; remote repair restores hp to damaged blocks
  only (destroyed blocks stay gone, as `repair` today), slower than the
  shield transfer. A healer cannot heal itself. Short range means the
  healer must stand near the boss; boss mechanics that punish clustering
  make "move in to heal or pull back" a scripted decision. Every boss has
  an **enrage** timer so a healer cannot stretch a fight forever.
- Tuning multipliers: `bonus` 1.35 / `malus` 0.65 (the hedgeable pair of
  §8 v0.29) so a hybrid hull is a real build choice and a boss remodulation
  punishes without one-shotting.

### The first boss (done in 0.33: the Borg cube, §4 "Bosses")

1. **Cutting beam**: a 6 s charge with a callout, then a beam 8 blocks deep
   into the ship it charged on; low tracking. Punishes a close orbit on
   the three armed faces.
2. **Exposed core**: no shield emitters on the aft face, the reactors
   clustered behind it; the broadside doctrine keeps the aft away.
   Attack side `aft` reaches it.
3. **Escorts** at 60% hull: two Birds-of-Prey summoned astern. "Target the
   smallest while two or more are left."
4. **Remodulation**: the cube retunes its shields when our ammo beats them.
5. **Overdrive** at 7 minutes: damage ×1.5, speed ×1.25, the enrage.

### The second boss (done in 0.41: the warbird, §4 "Bosses: the warbird")

Damage one afterburner burst cannot dodge, so the tank and the healer have
a job the Brawler's helm cannot do:

1. **Tractor beam**: every 30 s the loudest ship is held for 20 s; held,
   it cannot move, so every bolt lands. The tell is a callout; the hold
   breaks only when every emitter is gone (four, inside the head).
2. **Plasma cannons**: chip damage, 30 a bolt every 2 s from every cannon
   that bears, through a plate; it hunts reactors, so a rim reactor goes
   up with its neighbours. The Anchor's reactors are inboard and its
   nacelle rims are plate.
3. **Remodulation** as the cube.
4. **Overdrive** at 8 minutes. No escorts (§8 v0.41: with them the fight
   was about the escorts).

The answers: the beacon (so the hold lands on the hull built for it), the
healer on the held ship (`heldAlly`), the breakers disarming the cannons
while an ally is held (`aim: plasma`). Measured in §8 v0.41.

### Templates: why only the Brawler wins, and the rule for new ones

The seven 0.21 templates never touched the vocabulary added in 0.25–0.30
(no `scan`, `remodulate`, `enemyStance`, `enemyAimingAt`, `rangeBand`,
`blindFor`, `enemyFocusing`, `roll`, `side`, `board`, no tuning
condition). Some are broken outright: Alpha strike's two heat rules wait
for `heatAbove 0.9` on hulls that peak at 19%, Turtle has no win
condition, Siege's torpedoes miss a small fast target. But the deeper
reason is structural: the Brawler is **one rule** ("engage, everything
on") and wins because the intelligence sits below the script, in the
stance helm (auto-flip), the auto policies (booster, reinforce, decoy,
neut) and the doctrine machine. A script only earns its place by stating
something that layer cannot see, so in a 1v1 every template richer than
the Brawler can only be worse.

Decisions:
- Alpha strike, Turtle and Hit & fade are **retired** from the hangar
  list (`script.retiredTemplates`, kept as syntax examples and for the
  harness). Brawler stays the default, Siege stays (the Torpedo boat's
  play), Hunter stays, Ambush stays (a cloak has a place against a boss
  lance).
- The 1v1 templates are **not** tuned further: the harness would only
  confirm the Brawler.
- 0.32 rewrites templates **by role**, measured against the first boss,
  not the Raider: Tank (beacon, hold near the boss, reinforce on the
  tell), Healer (transfer to the ship the boss aims at, pull back on the
  sweep), DPS (switch to adds, remodulate on the callout), Jammer.
- **Rule for every new template**: it must use at least one condition the
  automatic layer cannot see (a boss callout, who the boss is aiming at,
  the weakest ally). A template without one is the Brawler in disguise.

### Scripts for a fleet (0.32: done, §4 "Fleet scripts")

- Conditions get a **subject** (`about`): the nearest, weakest or biggest
  enemy, the one shooting at us, the one most of us are fighting. All
  existing `enemy…` conditions read the subject; without `about`, the
  current target. Ally conditions: an ally's shield or hull, an ally under
  fire, outnumbered, enemies left, unfocused.
- Actions: **target** (a subject). The transfer actions (shields, repair)
  come with the role blocks of 0.34. `remodulate` exists.
- One script per hull; the battle report lists every hull.

### Order of work

| PR | Scope |
|---|---|
| 0.31 (done) | Engine for N v M: teams, ship arrays per side, target selection, camera fitting every ship, harness for fleets; measured with **8 block grids** (§4 "Fleet engine", §8) |
| 0.32 (done) | Script subjects and the target action; one script per hull; report per hull; the Wolf pack template (4 of 4 against the pack where the Brawler is 0 of 4). Transfer actions moved to 0.34 with their blocks |
| 0.33 (done) | The Borg cube (§4 "Bosses"): cutting beam with a tell, bare aft over the core, summoned escorts, remodulation, enrage at 7 min; the Cube breaker wins 4 of 4 where the Brawler loses 0 of 4 |
| 0.34 (done) | Role blocks (shield transfer, remote repair, beacon) on role cells, ally subjects, support and escort actions, Anchor and Lifeline. Measured: the pair draws the boss as designed but loses to two more breakers; the numbers pass is 0.35's |
| 0.35 (done) | Roster in the shipyard (four hulls, "Add to fleet"), repair bills, the skirmish-then-boss run (`campaign.run`: a boss slot every 6th battle from 4 wins with two hulls; fleet encounters in the pool with two hulls). Numbers pass: beam penetration 4, Anchor v2: the mixed fleet wins 8 of 8 but four breakers are still faster (§8). Skirmish modifiers not done, deferred |

### Streamline (decided 2026-10-19, 0.36–0.39)

The game grew by adding ideas for 35 versions and became two games in
one file: a hand-flown EVE-style duel (§1–§3 up to 0.35) and the raid
game of this section. The vision in §1–§2 is now the test: a system
stays only if it serves a step of the loop. Ranking, decided with the
numbers of 0.35 (54 script conditions, 28 used by no template or enemy
script; learning off since 0.31; plays shadowed by the script since 0.21):

| Rank | Systems | Decision |
|---|---|---|
| Core | block grids and role cells; the script engine, dry run and the report's "never fired"; the fleet engine, subjects, support and escort; bosses with public rules, tells, adds and enrage; runs, roster and repair bills; the doctrine machine; shields, capacitor, booster / hardener / afterburner; crew callouts; bridge calls; credits and salvage | keep |
| Support, simplify | script vocabulary (keep what a fleet reads: ranges, our and allies' shields and hull, counts, the boss's charge, tuning; cut the 1v1 micro conditions); stances and doctrines (one list); tuning per ship instead of per cell, kept as boss material (remodulation); the solo encounter list (a tutorial tier, 5–6 entries); intel as the boss's journal; EW blocks (jammer, cloak, decoy, neutraliser) as the future control role, no new work | simplify |
| Foreign | learning / signatures / opening book / counter table / doctrine table (0.26); plays; boarding and crew manning; real-time skills and science; the hand-flown bridge | cut |
| Measured, cut | heat and overload (0.40): with the cap at infinity every reference fight was identical, so it never bound a scripted fight; removed with the governor, the heat conditions, the `kite` doctrine and the retired templates | cut |

| PR | Scope |
|---|---|
| 0.36 (done) | §1–§2 rewritten as the vision; learning, signatures, the book, the counter table and the doctrine table removed (`campaign.learn`, `save.signatures / book`, `enemyAI.counters / signatureCounters / doctrineTable`, `encounters[].counter`, harness `--signature / --learn / --sigtune`); the report keeps the rule pair and the tuning line. Measured unchanged: 1v1 3 of 4, Wolf pack 2 of 2 |
| 0.37 (done) | Plays, `js/plays.js` and the hand-flown bridge (manual helm, stances, sides, aim chips, module clicks, fly-to, keys, `settings.manualBridge`) out; stances folded into `enemyAI.doctrines` as labelled doctrines with `ranges`; one `doctrine` action; bridge call *Fly*; the Torpedo boat's play as rules. Measured in §8 v0.37 |
| 0.38 (done) | Boarding, crew manning, real-time skills and science out: no step of the loop read them (no role boards, no boss tests manning, training is idle time). Quarters stay as damage-control blocks so no layout changes. Measured in §8 v0.38 |
| 0.39 (done) | 20 micro conditions cut (53 → 33), saves migrated with a notice; tuning per ship; the solo tier eight entries with `minHulls` on fleet fights (the `pair` wall of 0.35 closed); the hangar in the loop's order; §8 history in Appendix A. Measured in §8 v0.39 |
| 0.40 (done) | `tools/campaign.js` (a whole run headless) and the heat cut, both measured in §8 v0.40 |
| 0.41 (done) | The second boss: the warbird, its tractor beam and plasma cannons, the Warbird breaker; the healer's repair 45 → 300, the Anchor's nacelle rims plated; boss progression (`bossesBeaten`). Measured in §8 v0.41 |
| 0.42 (done) | The frozen fight (an escort whose last ally died called a stance setter removed in 0.37; the tools now exit on a page error); the warbird measured at stat 1.8 and 2.0 with the fix (the tank dies too: it stays at 1.6); the hull-lost penalty scaled by the reward multiple, measured over two 12-battle runs (§8 v0.42) |
| 0.43 (done) | A script per fight kind: a hull flies one script in fleet and boss fights and may fly another alone (`soloScriptByBuild`, two assign buttons, `--soloscript`); the Warbird breaker answers the cube too, so one boss script serves a run. Measured over 12-battle runs in §8 v0.43 (the Brawler alone wins the solo fights a boss script lost) |
| 0.44 (done) | The third script kind: a hull may fly its own script in a fleet skirmish (`fleetScriptByBuild`, the Wolf pack), so the pack is not fought with a boss script. Measured over 12-battle runs in §8 v0.44 |
| 0.45 (done) | Dev mode (nothing costs credits, to try builds); the fleet-tier scaling knob `enemyScaling.fleetFactor`, measured at 0.5 and shipped at 1: halving the pack's win bonus did not make it cheaper for the Wolf pack (§8 v0.45) |
| 0.46 (done) | The pack as a farm fight: a fleet encounter's ships take `fleetStatMult` / `fleetDamageMult` 0.8 on the 1v1 profile multipliers (stat ×1.4, damage ×1.5, sized for one hull); the pack at 8 wins goes from two hulls lost to none (§8 v0.46). A disengage rule for the hunted ship was tried and not kept |
| next | Skirmish modifiers (§10 "Skirmishes"); the third boss (damage the healer can race: phases, not a bigger hull); the Defiant in a fleet (7k of block hp, the pack's first kill in three fights of four at full strength) |

Known risks: the pivot touches nearly every file; 8 grids measured in 0.31
(12 ms a frame headless without a GPU, the simulation negligible); the §8
matrix must not be re-grown for 4v4 (measure intended solution vs pure
Brawler only). `CLAUDE.md` was updated with 0.31.

## Appendix A. Measured balance before 0.31 (history)

The 1v1, hand-flown game of 0.6–0.30 as it was measured at the time. Many
of the systems named here are gone (learning, counters, plays, boarding,
crew manning, per-cell tuning); the rows stay as a record of why numbers
are what they are.

v0.30.0 (remodulating; equal-hull Bird-of-Prey duels as in 0.29, 4 fights):

| Matchup | Enemy bridge | Outcome |
|---|---|---|
| our ammo Graviton vs their shields Nadion | 0.24 bridge (no reactions) | 4 of 4 in 1:11–2:12 keeping 95–100% |
| same | Raider script with the remodulate reactions (it remodulated once per fight) | 3 of 4 in 3:09–7:43 keeping 94–100%, one stalemate: the answer costs them the ten seconds and buys them the fight back only once |
| our shields Nadion vs their ammo Graviton, Brawler template (no scan, no answer) | Raider | 1 of 4 (3 lost) |
| same, our bridge runs scan → remodulate shields / ammo (the example script above) | Raider (an arms race: 22 remodulations over 4 fights, both sides) | 2 of 4 (2 lost) keeping 61–94% |
| our ammo Graviton vs their shields Nadion, both bridges remodulating | Raider (17 remodulations) | 4 of 4 in 2:22–3:42 keeping 82–100% |
| **They read your tuning**: Constitution with Graviton ammo (three wins with it on record) vs Raider at 3 wins, learning on | enemy answers shields Antiproton, ammo Graviton | **0 of 4** |
| same, learning off | faction default | 4 of 4 in 2:55–3:21 keeping 70–89% |

Campaign regression at faction defaults: Brawler vs Raider (0 wins) 4 of
4 keeping 44–91%; vs K't'inga (4 wins) 2 of 3 keeping 65–82%.

The engine bug the first run exposed: `remodulating: false` in a rule
was read as `remodulating: true` (flags were only ever written `true`), so
the reaction never fired; fixed in the engine, with the report's "never
fired" reason for negated flags.

v0.29.0 (tuning per block; equal-hull Bird-of-Prey duels, stock layout
both sides, Brawler template vs brawl doctrine, `--tune` / `--etune`,
4 fights each; cells are the player's wins):

| Player tuning | Enemy tuning | ×1.35 / ×0.65 | ×1.5 / ×0.5 |
|---|---|---|---|
| faction default (Polaron) | faction default | 4 of 4 keeping 84–98% | |
| ammo Graviton | shields + armor Nadion | 4 of 4 keeping 91–100% | **4 of 4** keeping 95–100% |
| shields + armor Nadion | ammo Graviton | 1 of 4 (3 lost) | **1 of 4** (3 lost) |
| ammo Nadion | shields + armor Graviton | 2 of 4 (2 lost) | **0 of 4** (3 lost, 1 st; malus 0.5) |
| shields + armor Graviton port / Nadion starboard (hybrid) | ammo Graviton | 2 of 4 (1 lost, 1 st) | 0 of 4 (3 lost, 1 st) |

Before the multiplier was applied to the whole shot (0.29 first cut: the
shield pool alone drained at the tuned rate, the hull behind untouched),
beaten defences still won 3 of 4: too weak to decide a fight. Campaign
regression at faction defaults (Federation Nadion ammo against Klingon
Polaron shields is a neutral pair, so nothing changes): Brawler vs Raider
(0 wins) 3 of 4 keeping 74–91%; vs K't'inga (4 wins) 2 of 3; Galaxy vs
Siege (6 wins) 2 of 2 keeping 91–96%. A stock Constitution (Nadion ammo)
against a 0-win Raider whose shields and plates are tuned Graviton:
**0 of 4** (the campaign enemy does not tune yet; this is what its
learned answer will do).

Honest reading: the rule decides a fight in both directions at ×1.5 /
×0.5 (beaten defence 1 of 4, beaten ammo 0 of 4). A hybrid hull does
**not** hedge at that strength: 0 of 4 against ammo that beats one half
(2 of 4 at ×1.35 / ×0.65), because the beaten half is where the brawl
flips to and where the plates go first. Not measured: mixed ammo
batteries. The enemy never retunes yet, so in the campaign the player
holds every edge until the next PR gives the enemy its answer; the 0 of 4
above says that answer will bite.

v0.28.0 (the element ring, one multiplier; the 0.27 weapon chart and
exponent removed; equal-hull duels as in 0.27, the beating element flown
by the player as attacker, then the beaten element flown by the player as
defender; 4 fights each):

| Edge | ±25%: attacker / defender | ±35% |
|---|---|---|
| Graviton (Bulwark, Turtle / broadside) beats Nadion (Pulser, Brawler / brawl) | **4 of 4** / 1 of 4 (2 st) | |
| Nadion beats Photon (Bombard, Siege / standoff) | 2 of 4 (2 st) / 1 of 4 (3 st): **stalemates** | **4 of 4** / 0 of 4 (4 st) |
| Photon beats Plasma (Interceptor, Brawler / skirmish) | **4 of 4** / 0 of 4 | |
| Plasma beats Duranium (Gunboat, Brawler / brawl) | **4 of 4** / 0 of 4 (1 st) | |
| Duranium beats Graviton | **3 of 4** / 0 of 4 | |

±50% on Nadion vs Photon gave the same as ±35% (4 of 4 / 0 of 4), so
the smaller step is the one shipped; the four edges that held at ±25% hold
at ±35% a fortiori. Campaign regression at ±35% (stock hulls are mixed, so
only the named variants and presets feel the ring): Brawler vs Raider (0
wins) 4 of 4 in 2:21–6:57 keeping 44–91%; vs Torpedo boat (1 win) 4 of 4
keeping 97–99%; vs K't'inga (4 wins) 2 of 3 keeping 65–83%; vs Shadow (3
wins) 2 of 2; Galaxy vs Siege (6 wins) 2 of 2 keeping 91–96%; Brawler vs
Bombard (3 wins) 1 of 4 (two losses, one stalemate). The ring in the
campaign: the Brawler preset (Duranium) on the Brawler template vs the
Interceptor (Plasma, 3 wins) **0 of 4**, as the ring says.

Honest reading: the ring is one number and it holds on every edge, both
ways, at ±35%. What it does not do yet: a mixed stock hull never feels
it, and the Nadion-Photon edge is a wall (the Photon ship cannot win, it
also does not die: four stalemates) rather than a kill.

v0.27.0 (elements; `tools/harness.js --ship bird_of_prey --rows variant:X
--equal`: both ships a Bird-of-Prey, the enemy's stat, damage and accuracy
multipliers 1, the player's reaction delay, no aim re-rolls, no retreat;
the player flies the variant with the natural template, the enemy the
variant with its doctrine: Interceptor / Brawler vs skirmish, Bombard /
Siege vs standoff + Siege play, Bulwark / Turtle vs broadside, Gunboat /
Brawler vs brawl, Pulser / Brawler vs brawl; 4 fights per cell, cells are
the player's wins, "st" stalemates; chart ×1.5 / ×0.7 / ×0.75, exponent
1.0):

| Player \ enemy | Impulse | Ordnance | Deflector | Armour | Phaser |
|---|---|---|---|---|---|
| **Impulse** | — | 1 (3 st) | **4** | **4** | 4 |
| **Ordnance** | **4** | — | 1 | 4* | 3* |
| **Deflector** | 0 | **4** | — | 4 | 4* |
| **Armour** | 0 | 1* | 3 | — | 4 |
| **Phaser** | 4* | 1* | 3* | 3 | — |

(* measured under the earlier chart ×2.0 / ×0.5 / ×0.5 or the 8-pulse
Pulser; the bold cells are the edges that held in both directions and are
published in `elements.edges`.) Reading: a three-element wheel Ordnance →
Impulse → Deflector → Ordnance, Impulse over Armour, and the rest even:
the player side wins both ways where no mechanic separates the builds.

What the chart did on the way: at ×2.0 / ×0.5 / ×0.5 Ordnance beat every
element (4 of 4 against all four) and the campaign broke (Brawler vs
K't'inga 3 of 3 keeping 100%, Brawler vs Bombard 0 of 4, Galaxy vs Siege
1 of 2); torpedoes at ×1.5 against the Bulwark stalemated both ways until
the Bombard got its fourth tube; the cannon-armed Interceptor stalemated
against the Bombard and lost to it as a strafer (passes with the
afterburner off eat torpedoes), the pulse-armed Interceptor on a skirmish
orbit is the Impulse that beats Deflector and Armour. The exponent alone
(0.6 → 1.0, 1.5) did not give Impulse the edge over Ordnance: 2 of 4 and
stalemates.

Campaign regression under the final chart: Brawler vs Raider (0 wins) 3 of
4 in 2:52–3:59 keeping 72–99%; vs Torpedo boat (1 win) 4 of 4 keeping
79–96%; vs K't'inga (4 wins) 2 of 3 keeping 92–100%, one stalemate; vs
Shadow (3 wins) 2 of 2; Galaxy vs Siege (6 wins) 2 of 2 keeping 91–98%;
Brawler vs **Bombard** (3 wins) 1 of 4 with three stalemates: the new
Ordnance encounter is a wall for a mixed build, as the wheel says. Sniper
Siege vs strafing Raider (3 wins) 1 of 4.

Honest reading: the wheel is three elements, not five, and it is the
game's own physics, not the one drawn beforehand (torpedoes kill the light
fast hull; the wall out-recharges the tubes; speed out-tracks the wall and
the cannons). Armour and Phaser need a mechanic of their own to earn an
edge (point-defence phasers against torpedoes would give Phaser over
Ordnance and close a five-cycle); that is the next measured step, not a
multiplier.

v0.26.0 (honest contact, learning; `tools/harness.js --variant / --doctrine /
--escript` force the enemy, `--signature tag --learn` force the learning
path; Constitution templates (presets where named) vs every Bird-of-Prey
variant at **3 wins** (strength 152%), 4 fights each, seeds fixed per row;
cells are the player's wins of 4, "st" stalemates at 10 min):

| Player \ enemy | Raider strafe | Gunboat brawl | Torpedo boat standoff | Jammer brawl | Leech brawl | Shadow ambush |
|---|---|---|---|---|---|---|
| **Brawler** | 3 | 3 | 4 (another seed: 2 + 2 st) | 3 | 4 | 4 |
| **Siege** on the Sniper preset (4 tubes) | **0** | 2 | **0** (3 lost, 1 st) | 2 | 2 | 0 (4 st) |
| **Ambush** on the Shadow hunter preset | 2 + 2 st | **1** (2 lost, 1 st) | 0 (4 st) | 3 | 3 | 2 + 2 st |
| **Emitter hunter** (§4 example script) | 3 | 4 | 4 | 4 | 4 | 4 |
| **Hit & fade** | **1** (3 lost) | 4 | 3 | 4 | 2 (1 lost, 1 st) | 3 |
| **Alpha strike** | 2 (2 lost) | 4 | 0 (4 st) | — | — | — |
| **Turtle** | **0** (4 lost) | 2 | 4 | — | — | — |

Learning path (`--signature … --learn`, the enemy answers the dominant
tag): standoff → Raider strafe 0 of 4; turtle → Raider strafe 0 of 4;
cloak → Gunboat brawl 0 of 4 (2 lost, 2 st); hit & fade → Raider strafe
1 of 4. Before the rows were measured the theory rows (standoff → Gunboat
2 of 4, brawl → Torpedo boat 4 of 4, cloak → Leech 3 of 4, emitter →
Jammer 4 of 4, shadow → Gunboat 4 of 4 keeping 99% / Siege cruiser 4 of 4)
all failed the 65/35 target and were dropped from the data.

Honest contact: Brawler vs Shadow (3 wins) 4 of 4 in 1:48–3:23 keeping
79–93% (0.25: 2 of 2); Shadow hunter Ambush vs Raider 2 of 4 + 2 st
(0.25: 3 of 4 + 1 st): the raider now hunts the last contact instead of
following the cloaked ship, and the ambusher gains nothing from it
because its own strike needs knife range anyway. Brawler vs Raider at 0
wins 4 of 4 in 2:21–6:57 keeping 44–91%; Galaxy vs Siege 2 of 2.

Honest reading: at Bird-of-Prey weight the game has **four measured
counters** (strafe beats standoff, turtle and hit & fade; a close brawl
beats a cloaked ambusher) and **two styles with no counter**: the Brawler
template and an emitter hunter win 3–4 of 4 against every variant. The
enemy can now learn and say so, but against those two it has nothing to
learn; the next lever is pillar 6 (the player's own winning build as the
opponent) or a counter-build at the same weight, not a rule. The 65/35
target is met by the four rows in the data and by nothing else.

v0.25.0 (enemy reactions, the blind roll moved into the scripts and counted
only in firing states; `--seed` fixed per pair so "react" and "no react"
meet the same rolls; 4 runs each unless noted):

| Matchup | Captain | Reactions on | 0.24 bridge (`--noreact`) |
|---|---|---|---|
| Constitution vs Raider (0 wins) | **Brawler** | **6 of 6** in 2:21–6:57 keeping 44–91% (the roll fired 0–2 times a fight) | 0.21: 4 of 6 |
| Constitution vs Raider (1 win) | **Emitter hunter** (scan at 10 km, Engage on their blind side aiming the emitter weak point, bare hull when they roll, Standoff when they kite beyond our reach) | 4 of 4 in 2:09–3:01 keeping 91–98%; reinforce + roll fired 6–9 times a fight | 4 of 4 in 2:10–2:56 keeping 88–97% |
| same, the reaction also aiming back at our emitter | Emitter hunter | 4 of 4 in 1:52–2:59 keeping 90–97% | |
| Constitution vs Raider (0 wins) | **Alpha strike** template | 2 of 4 in 3:59–4:55 keeping 93–94%, two losses; the kite reaction **never fired**: the stock Constitution's heat peaks at 19% even with the governor off, so `enemyHeatAbove` 0.6 sees only hot builds | 3 of 4 in 3:58–4:40 keeping 81–95% |
| **Shadow hunter** Constitution vs Raider (0 wins, counter: brawl) | **Ambush** template | 3 of 4 in 3:53–8:22 keeping 90–99%, one stalemate; the watch rule fired 4–9 times a fight | 2 of 4 in 6:08–8:43 keeping 90–94%, two stalemates |
| same, watch holding 8 km instead of 5 | Ambush | 4 of 4 in 2:11–4:11 keeping 97–100% | |
| same, watch as a 6 km / 4 km afterburner orbit | Ambush | 2 of 4 with two stalemates (5:12–5:34 / 6:47–8:34) | |
| Constitution vs K't'inga (4 wins) | Brawler shadowing the **blind** sector | 4 of 4 in 4:10–7:11 keeping 90–100%; the cruiser rolled 1–3 times | 4 of 4 in 4:09–7:11 keeping 90–100% |
| Constitution vs K't'inga (4 wins) | Brawler | 2 of 3 in 4:08–6:35 keeping 63–83%, one loss (the roll fired 3–10 times) | 0.21: 2 of 3 |
| Constitution vs Torpedo boat (1 win) / Shadow (3 wins) | Brawler | 2 of 2 in 3:15–6:52 keeping 97% / 2 of 2 in 2:34–2:49 keeping 83–90% | |
| Galaxy vs Siege K't'inga (6 wins) | Brawler | 2 of 2 in 3:54–6:25 keeping 91–96% | |

Honest reading: the reaction layer works as a mechanism (every rule fires
when its condition holds, Tactical calls it, the book records it) and
nothing regressed, but **no reaction yet costs the player anything
measurable**. The shadow roll against the Raider changes nothing (a strafer
is rarely in a firing state while shadowed); against the K't'inga it is the
same free win as in 0.21 (**not met**, still open). The emitter reaction
(reinforce + roll, with or without aiming back) does not slow an Emitter
hunter that wins in two to three minutes. The alpha reaction needs a build
that actually heats. The cloak reaction is the one that moves numbers, in
the wrong direction: holding 5 km off a cloaked ship means being struck
standing still (3 of 4 against 2 of 4), holding 8 km is worse, and a fast
orbit only turns wins into stalemates. Making reactions bite is pillar 2's
job (a public counter table measured pair by pair), not a number tweak
here.

v0.21.0 (bridge scripts on both sides, scan before weak points, K't'inga
stern cannons, Torpedo boat two tubes, first fight without weak-point
hunting; the harness captain is now a script: `BS.Script.start(player,
enemy, template | inline)`; 2–6 runs):

| Matchup | Captain | Outcome |
|---|---|---|
| Constitution vs Raider (0 wins, no weak points) | **Brawler** template | 4 of 6 in 1:59–3:31 keeping 76–90%, two losses keeping 12–29% |
| same | old hand-flown Engage captain | 2 of 4 in 3:33–4:44 keeping 64–68%, one stalemate |
| Constitution vs Raider (1 win: it scans at 12 km, then hunts weak points) | Brawler | 2 of 3 in 2:42–3:49 keeping 75–79%, one disabled loss |
| Constitution vs **Torpedo boat, two tubes** (1 win) | Brawler | 3 of 3 in 4:21–5:46 keeping 90–99% (three tubes, 0.19: 2 of 3 in 5:54–7:37 keeping 70–90%): now easier than the cruiser, as the unlock order says |
| Constitution vs K't'inga **with stern cannons** (4 wins) | Brawler | 2 of 3 in 3:09–4:55 keeping 54–81%, one loss |
| same | Brawler shadowing the **blind** sector | 3 of 3 in 4:29–5:45 keeping 96–100%, with `blindTolerance` 2.5 s: **not met**, the two stern cannons (about 25 dps into a hardened Constitution) do not make the tail costly |
| same | "Neck cutter": scan, Standoff aiming the neck weak point, aft when they roll | 1 of 2 (5:18 keeping 87%) and one stalemate; the K't'inga offers no `neck` weak point so the rule fell back to structure (the trace says so) |
| Galaxy vs Siege K't'inga (6 wins) | Brawler | 2 of 2 in 4:03–4:58 keeping 90% (with the Siege play wrongly given to the cruiser it was two stalemates: kept on its doctrine) |
| Constitution vs Raider (0 wins) | Alpha strike / Hunter / Hit & fade templates | 1 of 2 (7:03) / 2 of 2 in 2:11–5:30 keeping 77–79% / 1 of 2 (2:33) |

Honest reading: the script engine reproduces the hand-flown fights (the
Brawler template is the old Engage captain) and the balance fixes land as
intended except the blind sector on the cruiser, which stays a free win;
making the stern a real threat needs more than two cannons (a torpedo tube
aft, or a faster roll), left for the encounter "lock" pass.

v0.19.0 (decoys, neutralisers, boarding, Leech, drained enemies; harness
re-written: captain script once per simulated second with lock / stance /
play / side / aim / module policies, encounter forced by replacing
`campaign.encounters`; 2–4 runs each):

| Matchup | Captain | Outcome |
|---|---|---|
| Constitution vs Raider (0 wins) | Engage auto (baseline this build) | 2 of 3 in 3:08–3:54 keeping 84–90%, one disabled loss |
| Constitution + 2 decoy launchers vs Torpedo boat (1 win) | Engage, decoy when torpedoes inside 4 km | **3 of 3 in 3:59–4:59 keeping 84–97%**; 10–19 of 34–46 torpedoes died on flares |
| same build, decoys never fired | Engage | 2 of 3 in 5:54–7:37 keeping 70–90%, one 10-min stalemate |
| Constitution + 2 neutralisers vs K't'inga broadside (4 wins) | Engage, neut inside 4.5 km above 35% cap | **3 of 3 in 4:05–4:56 keeping 89–99%** (22–25 cycles; cruiser capacitor down to 4–19%, dry up to 12 s, opening the range when drained); stock Constitution in 0.18: 5:14–7:26 keeping 94–100% |
| Constitution + 2 neutralisers vs Raider (counter: standoff) | Engage, neut | 3 of 3 in 1:20–3:20 keeping 61–95% |
| **Miranda + 2 neutralisers vs Gunboat** (1 win) | Engage, neut | **3 of 3 in 4:55–7:58 keeping 91–95%**: the gunboat is dry 67–84 s in all and keeps running to 8 km to recharge; same build never firing them 0 of 2 (lost 3:04–4:52 keeping 30%); stock Miranda 0 of 2 (lost 4:27–6:30 keeping 45%). Before the `drained` rule: three 10-min stalemates keeping 100%, the dry gunboat sat at 3 km firing nothing and the Miranda could not finish it |
| Constitution vs **Leech** (3 wins) | Engage auto | 2 of 3 in 3:35–4:48 keeping 77–85%, one loss |
| Galaxy vs Siege K't'inga **with decoys** (6 wins) | Engage | 2 of 2 in 3:53–7:03 keeping 92–95%; torpedo hits 8 of 18 and 25 of 42 (0.18: 4:11 keeping 95%) |
| Defiant vs Raider | Engage; aim crew decks; Skirmish to close when their facing is open; board only when the party outnumbers the defenders | 4 of 4 in 3:53–5:06 keeping 48–99%, **1 capture** (12 v 11 at 3:35, +860 with 516 salvage) |
| Constitution vs Raider | same boarding plan | 3 of 4 in 3:01–4:19 keeping 80–95%, 1 capture (+1,328 with 867 salvage), one disabled loss |
| Defiant vs Raider | board whenever the window opens, no aim | 0 captures: 12 against 14–20 defenders is always repelled; a captain who kept sending parties lost three (26 crew), fell undermanned and the ship |

Iterations behind the numbers: with 2 defenders per deck and a 2-man guard
the plan captured 7 of 8 raiders (too strong); with a fixed 0.5 shield
threshold the transport aborted 3–10 times a fight as the facing
flickered; with the abort range at 1.25× a strafer's break-off aborted
every transport. Honest reading: decoys and neutralisers are build levers
that turn specific losses into wins (Miranda vs Gunboat) without changing
the stock fights; boarding is a one-in-four finisher that needs set-up and
reading the panel, and costs a party when misjudged. Not met: the Leech is
a Gunboat-grade fight for a stock Constitution, not the Jammer-boat lockout
intended.

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

v0.18.0 (structure 700 hp / torpedoes ×3, STRUCT aim, two-block necks,
raider weak points 25% without neck / wounded, weak-facing counter no longer
changes a raider's doctrine; 1–6 runs):

| Matchup | Captain | Outcome |
|---|---|---|
| Constitution vs Raider | Engage auto | **4 of 6 in 2:26–4:17 keeping 70–87%**, two disabled losses; with the raider finishing wounded systems and brawling on the weak-facing counter it was 3 of 6 and 2 of 5 |
| Constitution vs Raider | Engage blind / Skirmish / Siege / Hunter / Brawler Engage / no orders | 6:03 keeping 68% / 2:51 keeping 92% / 2 of 2 in 3:31–3:32 keeping 78–81% / 2 of 4 / 3:48 keeping 59% / lost in 1:44–2:38 |
| Constitution vs K't'inga broadside | Engage / Engage aiming STRUCT | 3 of 3 in 5:14–7:26 keeping 94–100% / 2 of 2 in 7:05–8:30 keeping 87–90% and one stalemate |
| Excelsior Lancer vs K't'inga broadside | Siege aiming STRUCT | 3 of 3 in 2:19–2:42 keeping 95–98%: torpedo volleys cut the cruiser's pylons and the sections take their weapons with them |
| Galaxy vs K't'inga Siege (STRUCT) / Defiant vs K't'inga (blind) / Torpedo boat (aft) / Gunboat | Engage | 4:11 keeping 95% / 5:26 keeping 100% / 4:48 keeping 90% / 2 of 2 in 3:06–4:36 keeping 74–79% |

Honest reading: the stock Engage fight is noisier than in 0.16 (4 of 6
rather than 5 of 6) because the raider now hunts emitters and reactor
clusters a quarter of the time; the wins sit in the 30–50% loss target.
Neck cutting is a torpedo play that works against the cruiser and does not
happen to the player by accident any more.

v0.17.0 (enemies aim at weak points 30% / 60%, counter-doctrines, Hunter
fallback; 1–3 runs):

| Matchup | Captain | Outcome |
|---|---|---|
| Constitution vs Raider | Engage auto / Engage blind / no orders | 2 of 3 in 3:05–3:22 keeping 75–93% / 3:04 keeping 89% / lost in 1:45 |
| Constitution Brawler (weak facing → raider brawls) / Sniper (4 tubes → strafes) / Shadow hunter (cloak → brawls) vs Raider | Engage | 2 of 2 in 3:34–4:11 keeping 85% / 5:12 keeping 79% / 4:16 keeping 81% |
| Constitution vs K't'inga broadside (aims at your weak points 60%) | Engage | 2 of 2 in 4:30–5:04 keeping 91–92% |
| Defiant vs K't'inga broadside | Engage blind | 6:33 keeping 100% |
| Constitution vs Raider | Hunter | 0 of 1 before the fallback, **3 of 3 in 1:59–2:52 keeping 85–99%** after it |
| Constitution vs Gunboat / vs Torpedo boat (aft) | Engage | 2:31 keeping 73% / one stalemate (earlier win in 6:30) |

Honest reading: enemies aiming at real weak points did not move the Engage
numbers (the raider mostly cannot reach the Constitution's interior reactors
either); the counter-doctrines produce the intended matchups (a pulse
Brawler gets a brawler, a Sniper a strafer) without breaking them. The
Torpedo boat stays a coin flip even from aft.

v0.16.0 (reactor power range 15 with reactors re-placed, core breach, section
physics; Torpedo boat back to ×1.0; 1–3 runs):

| Matchup | Captain | Outcome |
|---|---|---|
| Constitution vs Raider | Engage auto | 5 of 6 in 2:43–4:58 keeping 58–83% (median ~78%): the first batch at 30–50% loss the target asks for, with one disabled loss |
| Constitution vs Raider | Engage blind / Skirmish / no orders | 4 of 4 in 2:12–3:34 keeping 86–98% / 3:49–4:02 keeping 82–93% / lost in 1:59–3:01 |
| Constitution vs Raider | Siege / Hunter / Hit & fade / Ambush (Shadow hunter) / Brawler Engage | 1 of 3 / 1 of 2 / 3:31 keeping 81% / 3 of 4 in 4:34–7:21 keeping 74–88%, one stalemate / 3 of 4 in 2:22–6:17 keeping 54–85% |
| Constitution vs Gunboat / K't'inga broadside; Galaxy vs K't'inga Siege | Engage | 4:15 keeping 73% / 4:51–5:02 keeping 97–99% / 2:46–5:32 keeping 89–94% |
| Defiant vs K't'inga broadside | Engage blind | 2 of 2 in 4:43–6:52 keeping 99–100% |
| Constitution vs Torpedo boat (×1.25) | Engage | 0 of 3 (one stalemate): with the recharge delay its steady stream keeps a facing down for good, so it drops to ×1.0. At ×1.0 Engage auto is still 1 of 3 (its booster out-heals fire spread over four facings while its stream pins one of yours), but **Engage aft** wins in 6:30 keeping 82% (its tubes are all forward), **Alpha strike** in 4:15 keeping 87% (a burst beats the booster) and Engage blind 1 of 2. The first encounter that is a tactics puzzle rather than a dps check |

Bugs found by the harness on the way: a severed section spawned inside its
own hull and "hit" its own ship (now immune to its own fresh sections for
1.5 s); the first run of this batch scored 0 of 3 Engage because of it.
Honest reading: the game is harder than 0.15 in brawls (crits and the
recharge delay cut both ways) and the blind-sector shadow remains the safe
line; the Torpedo boat and Siege need another look.

v0.15.0 (shield recharge delay 4 s, attack sides, critical hits, enemy
comes about when nothing bears; 1–3 runs):

| Matchup | Captain | Outcome |
|---|---|---|
| Constitution vs Raider | Engage auto / Engage **blind** / Engage **aft** | 3 of 3 in 2:07–3:01 keeping 76–88% / 6 of 6 in 2:17–5:13 keeping 73–99% / 3 of 3 in 2:04–2:52 keeping 88–97% |
| Constitution vs Raider | Skirmish blind / Hit & fade / no orders | 3:37 keeping 99% / 2:23–3:27 keeping 93–97% / lost in 2:54–4:32 |
| Constitution vs K't'inga broadside (4 wins) | Engage auto / Engage blind | 6:19 keeping 76% / 4 of 4 in 5:29–8:22 keeping 97–100%: the cruiser carries no aft fire and turns too slowly to shake a shadow at 4 km |
| **Defiant** vs K't'inga broadside | Engage auto / Engage blind | 7:47 keeping 82% / **4 of 4 in 5:10–6:29 keeping 100%**: the escort beats the cruiser on geometry alone |
| Defiant vs Raider | Engage blind / Hit & fade | 3:13–3:39 keeping 100% / 2:38–3:44 keeping 100% |
| Constitution vs Gunboat | Engage auto / blind | 3:21 keeping 66% / 2 of 2 in 3:23–3:37 keeping 99% |
| Constitution vs Raider | Siege / Hunter / Ambush | 1 of 3 (one stalemate) / 0 of 2 / 4:39 keeping 84%: crits add variance both ways; Hunter's reactor aim now breaches reactors but eats the −15% |

Honest reading: shadowing the blind sector is the strongest single lever in
the game now, as intended for "the weak ship wins by geometry"; the enemy
counter-roll (`blindTolerance`) makes it cost hull against the raider but
not against the slow cruiser, whose fire is all abeam. If that proves too
easy in hand play, give the K't'inga aft cannons in its layout rather than
nerfing the mechanic.

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
