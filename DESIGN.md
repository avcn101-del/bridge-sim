# DESIGN.md — Bridge Sim

Version: 0.18.0 (cut the neck, hangar intel). Keep this file in sync with the game.

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
facing, peak heat, lowest capacitor and hull on both sides, most torpedoes
in flight, the first time each flag condition held) and, per rule, the
first time its conditions all held and what stood above it then. The
reason is the first condition that never held, with how close it came
("they never came inside 5 km (closest 6.2 km)", "our weakest shield never
fell under 25% (lowest 41%)", "we never scanned them"), or "it held at
01:41 but rule 2 stood above it". The dry run shows the same reasons.
**Refit & retry** pins the enemy just fought (`save.campaign.retry = {
encounterId, seed, battlesWon }`): `BS.Campaign.encounter()` re-rolls from
that seed and unlock pool, so the hangar's "Retry:" line, the intel on
file, the dry run and the next undock all meet the same ship, layout and
name, while the counter-doctrine is read off the new build. A lost fight
still counts (loss credits, streak reset). The pin clears when that fight
is settled, or with *Let it go* in the Intel box.

**Why you lost / What carried it** (0.26): before *Never fired*, the pair
of standing rules (theirs | ours) under which the largest share of the
damage landed ("61% of the damage we took landed while their r4 stood:
'The cruiser is opening the range under our strike' … and our r2 stood:
'When our heat is over 90%: weapons off'"), then both fights' style tags
(`BS.Game.styleTags`) and the doctrine table's sentence for the pair
(`enemyAI.doctrineTable`, `BS.Game.counterSentence`), or "no pairing of
these styles on the doctrine table". Every shield or hull hit is booked
to the rules standing at that moment (`state.attrib`, events `shieldHit`
/ `hullHit`), so the sentence names what actually hurt, not a guess.

**Tuning** (0.29): the *Why you lost* block opens with "Our Graviton
ammo vs their shields Polaron ×1.00 · armor Polaron ×1.00" and the same
from their side (`BS.Grid.tuningSummary`, dead blocks counted).

**Their bridge** (0.25): under *Never fired*, every rule of the enemy's
script that fired, with the time and, for a reaction, the callout Tactical
read out ("The cruiser is coming about to bring its batteries round").
The enemy's script itself stays hidden; what it did is on record and goes
into the opening book (§4 *Enemy reactions and the opening book*).

### Battle screen since 0.23: watch, trace, bridge calls
The tactical view is the screen; the captain does not fly. Left panel as
before (ship, blocks, target). The right panel opens with **Bridge calls**:
`script.bridgeCall.tokens` (2) per battle, shown as ● ● → ○ ○, never
refilled. Buttons: *Change play* (a helm play for `holdSeconds` 45 s),
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
`balance.maxStepsPerFrame`) in the top bar; Space pauses. The old helm
column (lock, stances, sides, plays, stop, transporter), the top-bar
Reinforce, aim chips, module clicks, canvas steering and the keys are the
**manual bridge**: hidden unless `settings.manualBridge` (hangar checkbox
"Manual bridge (debug)", `body.manual-bridge`); a manual order pauses the
script. On a phone the ORDERS drawer is now BRIDGE.

### Hangar: plan and script editor (0.22, `js/hangar.js`)
The left column of the hangar carries the pre-battle thinking:
- **Plan** under Intel: up to `script.planTargets` (3) targets on the next
  enemy, in order. With intel on file, tap a block on the intel drawing
  (numbered orange markers; tap again to remove); without, three dropdowns
  by block type. Saved per encounter (`save.plans[encounterId]`, with the
  layout rows it was made on). Rules with `aim: plan target n` read it.
- **Script**: a dropdown of the seven templates (read-only) and the player's
  own scripts; *Copy as new* makes an editable copy, *Rename*, *Save*,
  *Delete*, *Assign to this build* (`save.scriptByBuild[classId]`, "✓ This
  ship flies it"). Each rule is a card: number, kind (Standing orders /
  Once / Every N s), ▲ ▼ ✕, a WHEN line of terms, a DO line of terms, and
  for standing rules an UNTIL line and "At most N s" (`holdMax`). Terms
  are built from dropdowns whose labels are the sentences in
  `script.conditions / actions` (`{v}` becomes a number box for km, s and
  counts, a 0–100% slider in steps of 5 for fractions, on / off, or a
  dropdown of stances, plays, sides, block types, weak-point kinds and plan
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
  sentence with its measured numbers. The Intel box adds "Tuning: theirs
  … · yours …"; the Build stats carry a Tuning line; the editor's *Tune*
  button opens the modulation palette.
- **They have watched you** (0.26): when the next encounter learned from
  your signatures (below), a yellow line under the Intel drawing and the
  "Next:" header say so: "They have watched your last 3 fights (standoff ·
  standoff · brawl): expect fast passes: torpedoes lose their damage to
  speed."
- **Book** (0.25) under the Intel text: "Book · 3 fights: scanned us
  inside 12 km (3) · They're coming about to bring their guns round on us
  (2)": the enemy rules seen firing against this encounter, most often
  first (`save.book[encounterId]`, `BS.Campaign.bookFor`); with no fight
  on record, "their bridge is a closed book". *Copy as new* refuses beyond
  `script.maxScripts` (12) own scripts.
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
- **Attack side** (`helm.sides`, `helm.shadow`, command `side`, key B,
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
  | **Hunter** | Engage aiming at reactors → when none are left, or after 60 s, aim at exposed hull |
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
quarters, cover and its top three weak points, next to the doctrine and the
counter reason, so you fit against what you will actually meet. Unknown:
"No layout on file" and the buy button.

### Counter-doctrines (`enemyAI.counters`, `campaign.encounters[].counter`)
A flagged encounter (Raider, random Bird-of-Prey variant, K't'inga
warlord) reads your battle layout in `BS.Campaign.encounter()` and takes
the first rule it meets: 4+ tubes → it strafes (torpedoes lose damage to
fast passes; the K't'inga keeps its broadside), 4+ pulse phasers with at
most 2 other beams → it stands off outside pulse range (K't'inga: siege),
a cloak → it brawls and sticks close, a shield facing under 60% of the
strongest → a K't'inga broadsides and any hull hunts your weak points
twice as often (`weakPointChance` 0.6 for that fight; a Bird-of-Prey keeps
its doctrine: making it brawl turned the stock Constitution fight into a
coin flip). The hangar's
"Next:" line says the doctrine and why ("brawl (they have seen your weak
shield facing)"), so the build → fight → build loop is visible before
undocking. Encounters with their own plays or fixed doctrines (Torpedo
boat, Shadow, Jammer boat, Gunboat, K't'inga Siege) do not counter.

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

### Boarding (`BS.Boarding`, `grid.boarding`, command `board`, key T)
Transporter window: a lock on the target, inside `rangeKm` 3, and the
target's shield facing toward us under `gapStart` 2% of its maximum (or
not projected: cloak surge), and at least `minParty` 4 spare crew (supply −
need, shown in the Ship panel and the hangar's Crew line). The party is
min(`partyMax` 12, spare crew); it leaves at once (`grid.crewAway`, read by
`BS.Grid.derive`, so manning and with it weapon and shield rates drop for
the rest of the battle) and beams for `transportTime` 3 s. The transport
aborts, party home, if that facing comes back above `gapAbort` 15% (a
booster pulse does it: the defender's counter) or the range opens past
`rangeKm × abortRangeMult` (6 km). Aboard, the party fights `bridgeGuard` 2
+ `defenderPerQuarters` 3 per alive crew quarters of the target by
Lanchester's square law (`rate` 0.08 per second each way); under `floor`
0.5 on a side ends it, the party checked first so even numbers go to the
defenders. Captured → `shipCaptured` → victory with salvage `captured` 30%
of the enemy's remaining block value (a prize, nearly intact); repelled →
the party is lost. A full-crew raider holds 20 defenders against a party
of 12, so the plan is: shoot its crew decks (the CQ chip, or the "crew"
weak point) until the scan panel's Boarding line says the window would be
won, close to Skirmish range, and press T when the facing drops. Security
(Lt. Cdr. Giotto) calls the transport, the fight and the outcome; the Ship
panel shows "beaming 12 · 2.0 s" then "11 vs 7 aboard"; the transporter
button reads why it is off. Only the player boards in this version.

### Leech encounter and the neutraliser counter
The **Leech** (Bird-of-Prey, two neutralisers in the hull where the Jammer
boat carries its ECM, six disruptors, brawl, from win 3, ×1.2) drains you
every six seconds inside 4 km: reactors and range are the answer, as for
the ECM boat sensors were. Counter-doctrine rule: a battle layout with two
or more neutralisers makes a flagged Bird-of-Prey stand off and a K't'inga
siege ("they will stay out of your neutraliser range").

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
  written ("when heat is over 90%: weapons off, until heat is under 30%").
  A rule with no conditions is the default and stands when nothing above
  it does.
- **Call-outs** (`once: true` or `every: N`) fire their actions whenever
  their conditions hold, once ever or at most every N seconds, without
  changing the standing orders: scan, reinforce, the boarding party. A
  once rule that could not act yet (a scan still running) tries again.
- **Policies** run every tick: `lock` (keep a lock), `booster` / `reinforce`
  (the play policies, `helm.playPolicy`), `hardener`, `decoy` (drop one
  when torpedoes are inside `ew.decoy.aiIncomingKm`), `neut` (run it in
  range).
- **Conditions** (`script.conditions`, each with a sentence): every play
  condition (`dKm`, `facing`, `weakest`, `heat`, `cap`, `time`, cloak and
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
- **Actions** (`script.actions`): `stance` (player ranges from the build),
  `doctrine` (fixed ranges: enemy scripts), `play`, `side`, `aim` (block
  type, `exposed`, `structure`, `{ weak: kind }`, `{ plan: n }`), `weapons`,
  `modules`, `governor`, `repair`, `reinforce`, `scan`, `board`, `roll`
  (0.25: come about to the side with the most fire, `BS.EnemyAI.roll`, a
  reposition the doctrine resumes from after `repositionDuration` or once
  guns bear).
- **Callouts** (0.25): a rule may carry `callout: "…"`; when it fires or
  takes over the engine emits `scriptCallout` and, for the enemy's rules,
  Tactical reads it out. The player's own callouts are silent (the trace
  already reads every rule).
- **Scan** (`science.scanDuration` 4 s): the beam turrets hold fire
  (module state `scan`), then `ship.scanned` is set; aiming at a weak point
  or a plan target needs it (the rule still stands, the trace says
  "waiting for a scan"). The enemy reads weak points off a scan as well:
  `pickTarget` rolls `weakPointChance` only when the enemy ship has
  scanned, so its scripts carry a scan rule (Raider inside 12 km, K't'inga
  inside 14 km, Siege inside 20 km). A scan also records intel.
- **Sentences**: `BS.Script.describe(rule)` turns a rule into "When they
  are closer than 5 km: run the Alpha strike play (at most 30 s)";
  `describeScript` lists a script. The trace (`ship.scriptTrace`, event
  `scriptRule`, read into the log by the computer) records every takeover
  and call-out with the reason an action could not be done.
- **Templates** (`script.templates`): Brawler (the default fight: Engage,
  weapons, hardener, governor), Alpha strike, Siege, Turtle, Hunter, Ambush,
  Hit & fade, each the play rewritten as rules. A hull undocks with
  `save.scriptByBuild[classId]` (an own script by id, PR B's editor, or a
  template), else `script.defaultTemplate`. A manual helm order (stance,
  play, side, fly-to, stop) suspends the player's script: the Helm row
  reads "Manual".
- **Enemy scripts** (`script.enemyScripts`, `campaign.encounters[].script`):
  `doctrine: "encounter"` flies the doctrine the encounter rolled; the
  Torpedo boat runs the Siege play as before; the Raider, K't'inga and
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
- **Hangar.** *Tune* in the editor switches the palette to the five
  modulations plus "faction default" and "set all weapons / shields /
  armor" dropdowns; painting a tunable block (Mirror applies) sets its
  digit; every tuned block shows a dot in its modulation's colour. The
  Build stats carry a Tuning line; the Doctrine page shows the ring, the
  rule, the factions, "Your Graviton ammo vs their Polaron shields: ×1.00"
  from intel or the faction default, and each modulation's sentence with
  its measured numbers.
- **Hidden until seen.** The enemy's tuning shows on the scan panel
  (dots on the drawing and a Tuning line) only once scanned; intel stores
  the tuning it saw (`save.intel[].tuning`), the Book keeps the last
  tuning text (`save.book[].tuning`), the signature of a win keeps the
  dominant ammo, frequency and alloy (`signatures[].tuning`). The
  report's *Why you lost* opens with "Our Graviton ammo vs their shields
  Polaron ×1.00 · armor Polaron ×1.00" and the same from their side.
- Enemy variants carry no tuning yet (all Klingon Polaron): the enemy's
  answer to the player's ammo and frequencies (remodulating in battle, a
  *Remodulate* bridge call, learning) is the next PR.

### Honest loss (0.26)
A loss is meant to be accepted and answered with a new build or script,
so the enemy may never win by information the player cannot have:
- The enemy's conditions are the player's conditions (`script.conditions`,
  one engine). Its strength is the shown percentage (`enemyStatMult`).
- **Contact, not position**: `BS.Ships.contact(viewer, target)` gives the
  target itself while it is visible (not cloaked, or cloaked inside the
  viewer's detect range `science.cloakDetectRangeKm` + `ew.detectPerSensor`
  per sensor) and otherwise a ghost standing at the last contact. The
  doctrine machine (`BS.EnemyAI.update`: range, facing, blind time), the
  helm (`updateCommand`: approach / orbit / keep / shadow fly against the
  ghost instead of holding course as before) and the script conditions
  (`dKm*`, `rangeBand`, `enemyCharging`) all read ranges and bearings from
  it, for both ships. A cloaked ship beyond sensors is hunted at its last
  known point, not followed.
- Every reaction carries a callout, read out when the rule takes over,
  before its effect lands; the report shows which rule hurt.
- The enemy learns only from fights the player won (signatures below),
  and the hangar says what it learned before the undock.

### Signatures and learning (0.26, `campaign.learn`, `save.signatures`, `enemyAI.signatureCounters`)
Pillar 4. `settleBattle` records the signature of a win: the fight's
style tags (`BS.Game.styleTags`: the dominant doctrine as brawl /
standoff / strafe / turtle / hitfade / ambush / kite / alpha, plus
`shadow` when a side was held over `learn.tagFraction` 30% of the time,
`alpha` for governor-off fire, `cloak` over `cloakFraction` 10%, `emitter`
for weak-point or emitter aim, `roll`, `long` / `close` by average range
against `longRangeKm` 9 / `closeRangeKm` 4), the average range, side,
aim, script and build cost; the last `remember` (3) are kept. From
`fromWins` (3) wins on, `BS.Campaign.encounter()` rolls `chance` (0.6,
seeded with the encounter so a reload or a retry agrees) and, when it
hits, takes the first `signatureCounters` row for the dominant tag over
the remembered wins (ties to the latest) whose answer exists for the
rolled hull: that layout, doctrine and script replace the encounter's,
provided the answer's **effective cost** (block cost × the enemy's stat
multiplier: a Bird-of-Prey at ×1.52 weighs about a stock Constitution)
is within `costBand` 25% of the player's build cost, so the answer is a
ship of the same weight. A learned answer keeps its doctrine against the
build counter (`enemyAI.counters`); the first-fight and weak-point rules
still apply. Rows are measured only (DESIGN §8 v0.26): standoff / long /
turtle / hitfade → the Raider's strafing passes; cloak / ambush → the
Gunboat brawling. Nothing of Bird-of-Prey weight beats a Brawler or an
emitter hunter yet and the K't'inga rows are unmeasured, so those tags
learn nothing and the hangar says nothing. Fights 0–2 stay naive.

### Enemy reactions and the opening book (0.25, `script.enemyScripts`, `save.book`)
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
| `enemyHeatAbove` 0.6 inside 6 km: we are dumping heat (alpha) | `doctrine: kite` (`enemyAI.doctrines.kite`: keep 9 km on the afterburner) until our heat is under 35%, at most 20 / 15 s | |
| `enemyCloaked`: we are cloaked | `doctrine: watch` (`doctrines.watch`: hold 5 km, afterburner cold) until we show, at most 60 s, then a scan inside 8 km | |

Enemy scripts never set modules: `enemyai.js` keeps weapons, hardener,
booster, jammer, neutraliser and decoy on its own policy every decision
tick, so a script rule and the profile never fight over a module. The
Torpedo boat (Siege play) does not react: measured in 0.21, any change
to it breaks the fight. The blind-sector roll moved out of `enemyai.js`
(`blindTolerance` is gone; `blindTimer` stays, counted only in the firing
states) into the scripts, so the harness's `--noreact` enemy (scan, blind
roll, doctrine) is exactly the 0.24 bridge.

**Opening book**: `settleBattle` records, per encounter id, how many
fights and which enemy rules were seen firing (`save.book[id] = { fights,
rules: { "script:ruleIndex": { text, n } } }`, text = the callout or the
rule's sentence; dry runs record nothing). The battle report shows the
fight's enemy rules under *Their bridge*, the hangar Intel box the book.
The enemy's script stays hidden; only what it did is known.

### Win / lose
Enemy hull 0 → Victory; player hull 0 → Defeat; enemy bridge taken by a
boarding party → Victory ("captured"). Result overlay with stats.

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
modules: { phaser_group, torpedo_group, shield_booster, shield_hardener, afterburner, jammer (block-bound active, effect.jam), cloak (kind "cloak", block-bound),
           decoy (block-bound active, effect.decoy), neut (block-bound active, effect.neut) }
ew: { jamPerBlock, jamDuration, cloakTime, decloakTime, surgeTime, cloakDrain, cloakMinCap, detectPerSensor, ghostAlpha, ownCloakAlpha, cloakRadius, jamRadius, strike,
      decoy: { life, lureKm, speedKmS, hitKm, spreadDeg, aiIncomingKm }, neut: { rangeKm, perBlock, aiMinCap, warnCapBelow, drainMemory, fleeKm } }
grid.boarding: { rangeKm, minParty, partyMax, transportTime, bridgeGuard, defenderPerQuarters, gapStart, gapAbort, abortRangeMult, rate, floor }
script: { tickSeconds, chargingKmS, traceMax, planTargets, defaultTemplate, maxRules, dryRun: { maxSeconds, stepsPerChunk }, bridgeCall: { tokens, holdSeconds, focusSeconds, confirmSeconds, disengageUntil, noCallBonus }, conditions: { id: { label, kind, def, negLabel? } }, actions: { id: { label, kind } }, policies: { id: { label } }, weakKinds,
          templates: { id: { name, desc, requires?, policies, rules: [{ when, do, until?, holdMax?, once?, every? }] } }, enemyScripts: { id: { name, rules } } }
campaign.firstFight: { weakPointChance }; campaign.encounters[].script; campaign.learn; tuning (order, list, factionDefault, offFactionCost, tunable, measured, bonus / malus); save.tuning{}, builds[].tuning, intel[].tuning, book[].tuning, signatures[].tuning; shipClasses.*.variants / presets[].element; enemyAI.doctrineTable / signatureCounters; save: scripts[], scriptByBuild{}, plans{}, book{}, signatures[], settings.manualBridge, campaign.cleanWins, campaign.retry
campaign.salvage: { destroyed, disabled, captured }; enemyAI.*: drainedBelow, drainedUntil, drainedTime; enemyAI.counters[].when.neutMin
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
repairPriority, reinforce, stats, mods, aiProfile, ai{state, timer, suspended, relock, ...}, stance, doctrine, play{id, def, phase, t, target},
neuted, boarding{target, phase, t, party, partyMax, defenders, defendersMax}, script{def, target, active, activeSince, t, fired, lastFire, suspended},
scriptTrace[], scanned, scanning, scriptAim`; `grid.crewAway`; torpedo: `lured`; `BS.Weapons.decoys[]`;
block: `covered, coverBy` from derive.

## 7. Events
`lockStarted, lockAcquired, lockLost, moduleToggled, moduleCycle,
moduleOffline, shieldBoosted, phaserFired, torpedoLaunched, torpedoHit,
torpedoExpired, shieldHit, hullHit, blockDestroyed, sectionLost,
blockExploded, shipDisabled, shipDestroyed, overload, jammed, cloakChanged,
alertChanged, stateChanged, orbitFlipped, stanceChanged, playChanged, playPhase, enemyRolled, commandGiven,
decoyLaunched, decoyExpired, torpedoLured, torpedoDecoyed, neutralised, boardingStarted, boardingAborted,
boardingFight, boardingEnded, shipCaptured, scriptRule, scriptSuspended, scriptAim, scanStarted, scanned, bridgeCall, bridgeCallRefused, speedChanged,
log, battleStarted, battleEnded, skillTrained`.

## 8. Measured balance (accelerated simulation, scripted captains, default builds, no skills)

Harness: `BS.Game.state.paused = true`, `BS.Game.step(1/60)` in a loop, the
captain script runs once per simulated second. Enemy strength as at the
given number of wins. Hit rolls and the enemy's aim choice are random, so
single runs vary a lot; ranges below are over 4–6 runs. Since 0.25 the
harness is in the repository: `tools/harness.js` (Playwright, one
`BS.Game.dryRun` per fight, the encounter forced by replacing
`campaign.encounters`, seeded `Math.random`, `--noreact` for the 0.24 enemy
bridge, `--eval` for a data tweak, `--debug` for what each bridge saw) and
`tools/smoke.js` (the headless interface check).

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
