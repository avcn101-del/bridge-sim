# Changelog

All notable changes to Bridge Sim. Versions follow `DESIGN.md` roadmap.

## [0.18.0] — 2026-10-18 (cut the neck, hangar intel)

### Added
- **Cut the neck**: structural members stay at 700 hp but take triple
  torpedo damage (`grid.torpedoStructureMult`; at 400 hp stray cannon fire
  severed nacelles in ordinary fights); the **STRUCT** chip aims at them;
  the weak-point analysis also finds two-block necks such as a
  Bird-of-Prey's wing roots.
- **Intel** (`save.intel`): a layout held under lock for 10 s is on file
  for that encounter; the hangar's new Intel section draws it with weapons,
  shields, cover and its top weak points, or sells it for 150 cr.
- `BS.Renderer.drawTopDown` shared drawing; `BS.Game.state.lockTime`.

### Changed
- Enemy weak-point hunting per profile (`weakPointKinds`): a raider no
  longer cuts necks or finishes wounded systems, and rolls it 25% (was
  30%); the K't'inga does everything at 60%. The weak-facing counter no
  longer makes a Bird-of-Prey brawl; it doubles its weak-point hunting
  instead. Both measured: the stock Engage fight had become a coin flip.
- Crew callouts no longer crash on the structure / block aim types.

## [0.17.0] — 2026-10-18 (weak points, focus fire, counter-doctrines)

### Added
- **Weak points** (`BS.Grid.weakPoints`): the scan panel lists the enemy's
  emitter covering the most hull, touching reactors, the reactor that alone
  powers a part of the ship, the cheapest block that severs the most hull,
  crew decks one loss from undermanning and wounded systems open to a
  critical. Click a line, or any block on the drawing, to **focus fire** on
  that block (aim type `block`, −15%); click again to stop.
- **Enemies aim at your weak points** (`enemyAI.*.weakPointChance`: 30%
  Bird-of-Prey, 60% K't'inga per re-roll); Tactical calls what they go for.
- **Counter-doctrines** (`enemyAI.counters`): flagged encounters read your
  build (tubes, pulse phasers, cloak, weak facing) and pick their doctrine;
  the hangar's "Next:" line tells you which and why.

### Changed
- Hunter gives up on reactors after 60 s and moves to exposed hull (its aim
  could not reach reactors moved inside the hull in 0.16.0: 0 of 3; now
  3 of 3).

## [0.16.0] — 2026-10-18 (reactor power range, section physics, core breach)

### Added
- **Reactor power range** (`grid.powerRadius` 15, `unpoweredFactor` 0.5):
  systems outside every alive reactor's range run at half (weapon cycle,
  emitter strength and regen, thrust, sensors). Hangar dims those cells and
  reports coverage; the scan panel dims them on the enemy. Every layout's
  reactors were re-placed for 100% coverage (solver, mirrored, interior,
  never touching another reactor or the bridge).
- **Warp core breach** (`grid.breach`): the last reactor dying starts an
  8 s countdown; the ship then blows up and deals up to 900 damage within
  2 km. Crew callouts both ways; both AIs clear the radius on the
  afterburner (`clear` state).
- **Section physics** (`visuals.fragments`): severed sections keep full
  momentum, burn their engines, cook off their reactors and are solid:
  a ship they drift into takes damage per cell (`debrisHit`).

## [0.15.0] — 2026-10-18 (shield recharge delay, attack side, critical hits)

### Added
- **Shield recharge delay** (`grid.shieldRechargeDelay` 4 s): a facing that
  was hit stops regenerating for 4 s; the booster still fills it. Rewards
  hit-and-run over sustained brawling.
- **Attack side** (`helm.sides`, key B, command `side`): Engage / Skirmish
  can shadow the enemy's port, starboard or aft, or its **blind** sector
  (where the fewest of its weapons bear) with the new `shadow` movement
  command. The scan panel shows their fire per sector. Enemies come about
  after `blindTolerance` seconds with nothing bearing (`enemyAI.*`).
- **Critical hits** (`grid.crits`): a hit leaving a system under half hp
  rolls 25% to breach a reactor, tumble the ship (engine), drop its lock
  (sensor), bleed a facing (emitter), jam a mount (weapon), lose crew
  quarters or drop a cloak. Crew callouts, flash, "tumbling" status.

## [0.14.0] — 2026-10-18 (enemy scan panel)

### Added
- **Enemy scan panel** in the bottom row: the locked ship's block grid with
  damage, shield bubbles, bare hull, cloak and ECM field gaps and the aimed
  block type; hull and facings; systems alive / total, crew manning, power
  and heat; weapons bearing on us, orders, motion, threat (their hit chance
  on us, their torpedo damage on us) and cloak state with the decloak strike
  countdown. Cloaked targets show nothing.

### Changed
- The bridge log is a two-line ticker at the top-left of the tactical view;
  **LOG** (key G) expands it to the full scrollable log. The full-width
  comms row is gone.

## [0.13.0] — 2026-10-18 (crew manning)

### Added
- **Crew** (`grid.crew`, `blocks.*.crew`): every system block needs hands
  (phaser / cannon 2, pulse 1, tube 3, reactor 2, shield 1, engine 1, sensor
  1, jammer 1, cloak 2); the bridge supplies 10, each crew quarters 8.
  Manning = supply / need (floor 0.4) scales weapon cycling and shield
  regen like a brownout, so losing quarters in battle slows the ship. A
  build short of crew cannot undock. Hangar "Crew" line and a Ship-panel
  "Crew" row.
- Blocks more than 6 cells from any quarters or the bridge repair at half
  speed (amber dots in the hangar, validator warning).

### Changed
- Every default build, preset and enemy layout gained crew quarters
  (placed to cover the systems: Constitution 8, Galaxy 11, Bird-of-Prey 6,
  K't'inga 8); quarters draw no power.

## [0.12.0] — 2026-10-18 (disruptor cannons and pulse phasers)

### Added
- **Disruptor cannon** (block `D`, group DIS): 32 damage every 2.5 s,
  optimal 5 km, falloff 6 km, tracking 0.75 rad/s, one extra penetration
  point (through a plate of armor), drawn as a travelling bolt.
- **Pulse phaser** (block `U`, group PUL): 9.5 damage every second, tracking
  1.6 rad/s, optimal 4 km, falloff 3 km.
- Weapon `pierceBonus` carried through `applyDamage` / `Grid.hit`; glyphs
  `bolt` and `burst`; random variants may roll both types.

### Changed
- Klingon layouts (Bird-of-Prey and all variants, K't'inga and Siege) mount
  disruptor cannons instead of phasers. The broadside doctrine holds
  4.5–7 km (was 5.5–8.5) so cannons stay in optimal. The Gunboat goes back
  to the brawl doctrine (its Hit & fade with cannons stalled fights). Constitution **Brawler** preset: six pulse phasers on the
  saucer rim, four cannons at the bow.
- Stance ranges, plays (`noPhasers`), the target panel and the fit
  statistics treat any turret as a beam (`weapon.kind`), not just phasers.
- Harness results in `DESIGN.md` §8 (v0.12.0).

## [0.11.0] — 2026-10-18 (cloak and ECM fields)

### Added
- **Cloak field** (`ew.cloakRadius` 10): every cloaking device covers the
  blocks within 10 cells; a ship can cloak only while every alive block is
  inside a field (module reads "no field", Engineering counts the blocks
  outside), and losing a device or a section while cloaked collapses the
  cloak. Several devices per hull (5 power, 250 cr each, no longer unique).
  Shadow hunter carries three, the Shadow Bird-of-Prey five. The hangar
  frames cells outside the field in purple; play condition `noCloak`.
- **ECM field** (`ew.jamRadius` 7): a jam breaks the lock only when every
  block sits inside a jammer's field. A partial field keeps the enemy's lock
  but steers its fire onto the blocks outside the field for 4 s (aim
  `unjammed`), so half cover is a liability. Hangar frames those cells in
  green; the validator warns about both fields.

### Changed
- Torpedo boat damage back to ×1.0 (was 1.25): with the recharge delay its
  stream pins a facing for good; beat it from aft or with Alpha strike.
- Shadow hunter preset: no jammers (its half field only pushed fire onto the
  nacelles), cloaks deep in the engineering hull. Jammer boat description.

## [0.10.0] — 2026-10-18 (firing bearings, decloak strike, enemy plays)

### Added
- **Firing-bearing keep geometry** (`helm.bearingStep / keepBand /
  keepRunBelow / holdSpeed / keepFireFraction / kiteMinBearing`,
  `BS.Grid.bearingProfile`, `BS.Ships.firingBearings`): a ship keeping range
  holds the target on the bearing where the most of its fire bears (arc and
  line of fire included), slows to a stop at the bottom of the band, holds
  station down to 75% of the range and only then opens it, on a bearing that
  keeps the guns talking when one exists. Bow torpedo tubes used to fire at a
  third of their rate on both sides because `keep` flew abeam and ran tail-on.
- **Decloak strike** (`ew.strike`): for 10 s after decloaking every hit deals
  ×2 and 60% of it skips the shield into the hull; Tactical calls it,
  Engineering warns when it is done to you. Shadow enemies get it too.
- **Shields kept through the cloak**: cloaked or surging, the facing pools are
  down (absorb nothing, not drawn) but no longer zeroed; they recharge at the
  condition-green rate and the booster still fills them.
- **Enemy plays** (`campaign.encounters[].play`): an enemy bridge can run a
  play from `helm.plays` over its doctrine; the Gunboat runs Hit & fade, the
  Torpedo boat Siege. Encounters may also set their own `damageMult`.
  The Overview status shows "Play · state" for such an enemy.

### Changed
- **Siege** fires everything that reaches instead of tubes only, and returns
  to bombarding after 30 s or beyond 9 km (12 km never came against a
  strafer). **Ambush** strikes for the decloak window aiming at reactors,
  Reinforces, and slips away only until the shields are back.
- Torpedo boat damage ×1.25 and Shadow ×1.2 as encounter overrides (the
  Bird-of-Prey's ×1.5 stays: ×1.6–1.8 turned Engage, Turtle and Hunter into
  coin flips rather than costing 30–50% hull, see `DESIGN.md` §8); decloak
  surge 5 s (was 8).
- A new stance or doctrine keeps the once-per-battle retreat flag and pass
  count (`carryAI`), so an enemy on a play cannot retreat every phase.
- Harness results in `DESIGN.md` §8.

## [0.9.0] — 2026-10-18 (world scale, auto camera, plays)

### Added
- **Plays** (keys 5–0, Helm panel): scripted sequences of phases the bridge
  runs on its own, each phase a stance or doctrine plus a module policy,
  governor, aim and repair priority with exit conditions (`helm.plays`,
  `js/plays.js`). Six plays: Alpha strike, Siege, Turtle, Hunter, Ambush
  (needs a cloak) and Hit & fade. The helm narrates phase changes; the Helm row
  shows play, phase and state; any stance, Stop or fly-to cancels.
- **Auto-fitting camera**: follows the player, leans toward the enemy and
  zooms so both ships stay in view; wheel and +/− scale a bias on top.
- Doctrine `closein` (approach and keep approaching) for plays;
  `BS.EnemyAI.setDoctrine`; events `playChanged`, `playPhase`.

### Changed
- **World scale**: 150 px per km instead of 50, ship speeds ×3 in pixels
  (unchanged in km/s). A Constitution now measures about 1 km instead of
  3 km, so a 6 km orbit is six ship lengths rather than two. Tracking,
  ranges and timings are unchanged in km; the harness confirms the same
  outcomes.

## [0.8.0] — 2026-10-18 (shield bubbles, stance helm)

### Added
- **Shield bubbles**: every emitter covers the blocks within 5 cells
  (`grid.shieldRadius`); a hit on a covered block draws from the covering
  emitter's facing, a hit on bare hull skips the shield entirely. Bubbles
  are drawn as the union outline of the emitters' circles, coloured by the
  facing they feed, with ripples on the bubble that was hit. The hangar
  paints exposed cells red and shows "cover n% (m exposed)"; the validator
  warns below 90% cover. Aim type **Exposed** (EXP chip, hover highlight)
  steers shots at bare hull; enemies aim at it 10% of the time. All default
  layouts, presets and enemy variants had their emitters re-placed for
  93–100% cover.
- **Stance helm**: the Helm panel is four stances (keys 1–4) instead of
  orbit / keep / approach / come about / reverse. **Engage** (default at
  battle start) orbits inside phaser range, **Skirmish** orbits tight on
  the afterburner, **Standoff** holds torpedo range and kites,
  **Disengage** runs. Ranges derive from the fitted weapons (`helm.stances`);
  the helm reverses the orbit on its own when the other side has more
  guns to bear or a fresher shield (`orbitFlipped`), narrates its moves,
  owns the afterburner and re-locks a target you locked before. Stop (S)
  and fly-to put the helm on manual.
- The doctrine machine in `enemyai.js` now drives both ships; new **evade**
  doctrine; `stateChanged` / `stanceChanged` events.

### Changed
- Enemy multipliers re-tuned for working shields: Bird-of-Prey strength
  ×1.4 (was 1.08) and damage ×1.5 (was 1.35), K't'inga damage ×1.33.
- Removed `balance.orbitRangesKm / keepRangesKm` and class
  `preferredRangeKm`; right-click on the enemy now means Engage.

### Fixed
- Since 0.6.0 shield emitters added nothing: the facing lookup used by
  `derive` had been shadowed by the line-of-fire facing function, so every
  facing stayed at the 80 base. Facings are now 80 + 70 per emitter as
  documented (a stock Constitution: fore 360, others 220).

## [0.7.0] — 2026-10-18 (power grid, heat, electronic warfare)

### Added
- **Power grid**: every system draws power (phaser 5, tube 8, shield 4,
  sensor 3, engine 1, quarters 1, jammer 6, cloak 12); a hull supplies a
  class base plus 15 per reactor. The editor shows the figure and refuses
  an overdrawn build; losing reactors in battle browns the ship out
  (weapons and shields at supply / draw). This replaces any fixed weapon
  hardpoint count.
- **Heat and overload**: shots add heat (phaser 6, torpedo 30); capacity
  grows with the hull, dissipation with its rim. At capacity weapons stop;
  the shot that crosses it overloads the ship for 6 s. Heat ring on the
  gauge, "hot"/"OVERLOAD" states in the module bar, salvo and sustained
  figures in the editor, Engineering warnings; the AI stops at 85%.
- **Heat bar and governor**: a HEAT bar under the module bar shows heat /
  capacity with a marker for the next full salvo and colour zones (amber
  60%, red 85%). The **GOV** button (key H, on by default) holds fire above
  85% and releases below 60%, so the ship never overloads by accident;
  switch it off for an alpha strike. Engineering reports hold/release.
- **ECM jammer** block and module (F6): rolls jam strength against the
  enemy's sensors every 5 s; a hit breaks their lock for 4 s and blinds
  their torpedoes in flight.
- **Cloaking device** block and module (F7, one per ship): unlockable and,
  beyond 10 km (+1 km per enemy sensor array), unseen; shields down, weapons
  cold, capacitor drains 8/s; 2 s to decloak and 8 s of shield surge after.
  Ghost rendering inside detection range, overview shows "ghost" / "—".
- Enemies: **Jammer boat** (two ECM blocks, from win 3) and **Shadow**
  (cloak, new **ambush** doctrine: stalk cloaked, decloak at 4.5 km, pass,
  break off and cloak again; from win 3). Constitution preset **Shadow
  hunter** (cloak, two jammers, six phasers).

### Changed
- **Block icons**: every system block has its own glyph (phaser lens,
  torpedo diamond, shield half-ring, reactor burst, engine chevron, sensor
  dish, bridge star, crew windows, jammer zigzag, cloak eye) and a more
  distinct colour, drawn on the hull in battle and in the editor, in the
  palette and on the Blocks and Target chips. System plates are darker so
  the glyph reads.
- Brawler preset is ten phasers (power); Bird-of-Prey power base 35.

### Measured (DESIGN.md §8)
- Straightforward Constitution: 4 of 4 vs the raider (2:09–6:30), 3 of 4
  vs the Gunboat and vs the Shadow, 1 of 4 vs the Jammer boat.

## [0.6.0] — 2026-10-17 (Cosmoteer ideas: breaches, line of fire, armor, salvage)

### Added
- **Reactor breaches**: a destroyed reactor deals 80 damage to its eight
  neighbours; reactors among them go up too (chain reaction). Big flash,
  shockwave and debris; Engineering and Tactical report breaches. The
  editor warns when reactors touch each other or the bridge.
- **Line of fire**: a weapon cannot fire through the ship's own blocks
  near it (muzzle 1 cell out, hull within 3 cells masks). Its arc is
  centred on the open side of the hull, so rim weapons face outward and a
  ship fights with the guns on the engaged side. The editor marks fully
  masked weapons with a red cross, lists them in the warnings, leaves them
  out of the dps figure, and shows the hovered weapon's clear arc.
- **Reverse orbit** (button in the Orbit row, key V): flips the orbit
  direction to bring the other side's weapons to bear. Helm reports it.
- **Disabled ships and salvage**: a ship with no weapons and no engines
  left is dead in space and the battle ends. A win pays salvage on top of
  the reward: 10% of the enemy's surviving block value for a wreck, 25% for
  a ship disabled intact. The result screen has a Salvage row.

### Changed
- **Armor stops beams**: beams carry 2 penetration points; armor costs 2,
  structure 3, systems 1. A beam ends in the first plate it meets but still
  chews two deep through exposed systems.
- Phaser damage 24 → 28, torpedo 150 → 170 (half the guns bear at any
  moment now); enemy damage ×1.6 → ×1.35 (their guns got the same rule and
  their wing mounts fire properly). Constitution default: phasers moved to
  the port and starboard rim (four a side), tubes at the bow.
- Every default layout, preset and enemy variant was rebuilt for the new
  rules: weapons moved to the rim with a clear line of fire, reactors spread
  at least one cell apart and away from the bridge. Counts changed where
  the rim ran out of room: Defiant 8 phasers 2 tubes, Galaxy 10 phasers
  2 tubes, Sovereign 7 reactors, Interceptor preset no tube, Dreadnought
  8 reactors, Fortress 10 reactors.

### Measured (DESIGN.md §8)
- Straightforward Constitution that matches the raider's range and reverses
  its orbit when its engaged side is stripped: 5 of 5 wins, typically
  3:30–4:00, keeping 59–86% block hp. Orbit 6 km without ever reversing:
  0 of 5. No orders: disabled in about 3 minutes. K't'inga broadside beats
  a stock Constitution and is a 3-of-4 win for the Excelsior.

## [0.5.3] — 2026-10-17 (enemy doctrines)

### Changed
- **Enemies no longer orbit you at 6 km**, which turned every fight into a
  two-ship tail chase. Each encounter now fights by a doctrine
  (`enemyAI.doctrines`): the raider makes **strafing runs** (run in with
  the afterburner, a 12 s firing pass at 3 km, break off to 8 km, come
  around on a new bearing); the Gunboat **brawls** at 3.5 km and reverses
  its orbit every 20 s or whenever the fight settles into a tail chase; the
  Torpedo boat **stands off** at 14 km and kites when you close; the
  K't'inga holds a **broadside** band at 5.5–8.5 km, turning slowly to keep
  a fresh shield toward you; the Siege variant stands off at 17 km. Random
  variants draw a doctrine from a seeded list.
- The Overview status column names the enemy's manoeuvre (strafing run,
  firing pass, breaking off, coming around, kiting, broadside…) and
  Tactical calls the changes ("Here they come! Firing pass, close range!",
  "They're rolling a fresh shield toward us.").
- Torpedo tubes now get first call on the capacitor each step, so phasers
  no longer starve them.
- Enemy aim: sprays the hull 40% of the time (was 35%), picks phasers 15%
  (was 20%).

### Measured (DESIGN.md §8)
- Straightforward Constitution vs the strafing raider, turning into each
  pass with Approach: see the table; a captain who only orbits at 6 km now
  loses to a strafer, which is the point.

## [0.5.2] — 2026-10-17 (hulls, enemies, destruction, balance, v0.5 PR 3)

### Added
- **Five Starfleet hulls** in the shipyard, each with a mask, a default
  build and a preset: Miranda 22×14 (184 cells, 800 cr, fast), Defiant
  18×12 (126, 2 400 cr, escort), Excelsior 30×18 (262, 3 200 cr), Galaxy
  36×20 (406, 5 600 cr), Sovereign 38×18 (310, 8 000 cr). A ship's price
  includes its default build; bigger hulls carry more blocks but have a
  larger signature and a lower base speed.
- **Enemy variety**: Bird-of-Prey Raider, Gunboat (eleven disruptors) and
  Torpedo boat (three tubes) layouts, a **random variant generator**
  (`BS.Grid.randomVariant`, re-rolls 12% of a layout and re-validates) and a
  second enemy hull, the **K't'inga battlecruiser** 32×20 (210 cells) with
  a Siege layout and its own AI profile (slower, orbits at 7 km).
- **Encounters** (`campaign.encounters`): the next enemy is drawn by weight
  from what your win count has unlocked (K't'inga from win 4) and shown in
  the hangar as "Next: …"; tougher enemies pay up to ×1.9 credits. Klingon
  ships get names from a list.
- **Destruction**: debris keeps the colour of the block it came from and a
  plate tumbles off; a section cut from the bridge leaves as one drifting,
  spinning, scorching **fragment** of its blocks; a dying ship shatters into
  3–6 pieces with secondary explosions, a core flash and a double
  shockwave before the result screen (3.6 s).

### Changed
- **Damage spread**: shots land anywhere across the facing (`grid.hitScatter`)
  instead of always on the line through the ship centre, which used to
  drill one column and cut small hulls in half.
- **Aiming no longer bypasses armor**: an aimed shot is steered through the
  nearest block of that type (within 2 cells, wandering ±2) but still hits
  the outermost block on that line first.
- **Connectivity** counts all eight neighbours: a section breaks off only
  when a cut runs clean through, and a bridge can no longer be "isolated"
  by four dead neighbours.
- **Durability**: structure cells 220 → 700 hp, bridge 140 → 200, phaser
  and tube 30 → 50, shield and reactor 25 → 40, engine 30 → 45, sensor
  20 → 35, quarters 25 → 35; a ship is lost below 30% block hp (was 35%).
- **Balance**: shield booster +70 → +50 per cycle (fights no longer stall
  on healing); enemy base strength 108% and damage ×1.6; enemy boosts
  below 45% facing; the enemy sprays the hull 35% of the time instead of
  always aiming, and aims at the bridge only 5%; scaling 4% per win up to
  +40% (was 6% / 60%).
- Defiant flank phasers, Sovereign flank phasers and a wider neck, Miranda
  24 engines. Crew battle-start report names the enemy class.

### Measured (see DESIGN.md §8)
- Straightforward Constitution vs raider: wins in 2:16–5:57 keeping 62–84%
  of block hp (12 of 14 runs). No orders: lost in 3:06–4:15. Speed tank at
  3 km: wins nearly untouched.

## [0.5.1] — 2026-10-17 (block editor, v0.5 PR 2)

### Added
- **Block editor** in the hangar: paint blocks on the hull grid by clicking
  or dragging, right-click erases, a palette of the nine block types with
  price and hp, mirror mode paints both sides, Fill armor, Clear (keeps the
  bridge), presets (class default, Brawler, Sniper), Revert, and live
  validation and statistics while you paint. Only one bridge: placing a new
  one moves it.
- **Block economy**: applying a build charges the price of added blocks and
  refunds 60% for removed ones; the delta is shown before you apply. An
  invalid build (no bridge, disconnected blocks, no weapons, no engines) or
  an unaffordable one cannot be applied, and you cannot undock with
  unapplied changes.
- **Saved builds**: up to three named builds per hull, stored in the save
  (`builds`), loadable into the editor.
- Constitution presets: Brawler (fourteen phasers, armored bow) and Sniper
  (four tubes, extra sensors and engines).

## [0.5.0] — 2026-10-17 (block construction, v0.5 PR 1)

### Changed
- Ships are built from **blocks on a Trek-shaped cell grid**. Each class has a
  hull mask (Constitution 26×16 with 206 fillable cells, Bird-of-Prey 24×22
  with 140) and a default layout. Nine block types: armor, phaser emitter,
  torpedo tube, shield emitter, reactor, impulse engine, sensor array,
  bridge, crew quarters. Ship stats are sums of blocks: hull hp, shield per
  facing from emitter positions, capacitor from reactors, speed from thrust
  over mass (engines in nacelles count double), lock time from sensors,
  repair from crew quarters.
- **Spatial damage**: after shields, a shot hits the outermost block on the
  attacker's side. Beams penetrate two blocks; torpedoes explode on the
  entry block and splash into its neighbours. Destroyed blocks tumble away;
  blocks cut off from the bridge break off as a section. A ship is lost when
  the bridge dies or alive block hp falls below 35%. The Constitution's neck
  and pylons are fixed structure with 220 hp.
- **Aiming** at a block type (click a block on the enemy, or its chip in the
  Target panel) steers shots to the nearest block of that type near the
  entry point, at −15% accuracy. Repair priority is per block type.
- Weapon groups replace fitted weapon modules: F1 fires every phaser emitter
  whose outward arc (180°) allows, F2 every torpedo tube (220°). Booster,
  hardener and afterburner are built into every ship.
- Renderer draws grids as plated hulls with a smooth outline, shading, glowing
  engines, reactors, emitters and bridge, and running lights; the hangar
  shows a build preview with a block legend and layout statistics (block
  count, mass, value, dps, capacitor stability, defence per facing, mobility).
- Hull cells are 6 px (`grid.cellPx`); default zoom 0.8, max 2.0 for aiming
  at blocks.
- Save version 2 now stores `layouts` per class; module fits and the module
  market are gone (the block editor and block economy arrive in PR 2).
- New file `js/grid.js`. Ship classes without a mask (Miranda, Defiant,
  Excelsior, Galaxy, Sovereign) are removed until PR 3 adds their hulls.

### Measured balance (default layouts, no skills)
- Weapons + hardener at 6 km: wins in about 3:40 losing ~38% of block hp.
  Speed tank (booster pulsed, afterburner): wins in 5–8 min nearly untouched.
  Everything on: capacitor starves, often a stalemate. No orders: lost in
  about 3 min.

## [0.4.0] — 2026-10-16 (hangar, fitting, skills, save, PR B)

### Added
- Hangar screen between battles: ship card, shipyard (buy and board ships),
  fitting with high/mid/low slots, power grid and CPU limits, storage,
  market (buy, sell at 60%), fit statistics (dps, capacitor stability,
  defence, mobility, lock time), skills trained one at a time in real time,
  export/import save as JSON, reset.
- Credits per battle (win 500 − hull penalty + streak bonus, loss 120).
  The raider grows 6% stronger per victory, up to +60%.
- Progress saved automatically in localStorage (`bridgesim.save`, version 2).
- Result screen shows credits earned; "Return to hangar" replaces Restart.
- New files `js/campaign.js`, `js/hangar.js`.

### Changed
- World scale: 50 px per km (was 20) and ships drawn at about half size, so
  a 6 km orbit shows clear space between hulls and 15 km fits on screen.
  Torpedo speed 4 km/s, turret tracking 0.9 / 1.1 rad/s and default zoom
  0.6 retuned for the new scale.
- `upgrades` tier data removed; modules and skills replace it.

## [0.3.0] — 2026-10-16 (EVE-style combat, PR A)

### Changed
- Control model: EVE Online style. Select and lock a target, then give the
  helm relative commands (Approach, Orbit at 3/6/10/15 km, Keep at range
  6/10/15 km, Come about, fly to a point). No officer delays; officers now
  report and warn.
- Weapons and tactical systems are fitted **modules** on a HUD bar (F1–F8):
  phaser banks, torpedo launcher, shield booster, shield hardener,
  afterburner; passive damage amplifier and power relay. Every cycle costs
  **capacitor** (EVE recharge curve); modules shut down when it runs dry.
  Power presets are gone.
- **Lock** before firing (about 3 s). **Turret tracking and falloff**: hit
  chance falls with the target's angular velocity and beyond optimal range.
  **Torpedo damage** scales with target signature and speed.
- Shield passive regen reduced; the booster is the main tank. Reinforce has
  a 20 s cooldown.
- Interface streamlined: hull, shield facings and capacitor are one round
  gauge on the display next to the module bar (F1–F8, cooldown rings); the
  left panel keeps speed, subsystems and target info; the right panel holds
  the Overview and the selected-item commands; Reinforce, Hail, Red alert,
  help (?) and zoom live in the top bar. Target panel shows hit chance and
  torpedo damage estimates; readouts in km and km/s.
- Tactical display: km range rings for optimal / falloff / torpedo range,
  orbit ring, velocity vectors, lock-in-progress ring, locked brackets,
  enemy-lock indicator, distance tag.
- Enemy AI drives the same commands and modules (afterburner on approach,
  booster when a facing drops, hardener while attacking).
- Data: `units`, `modules`, per-class `capacitor`, `signature`,
  `sensorStrength`, `slots`, `fit`; skills shape for real-time training;
  save version 2 with fits and inventory.

### Measured balance
- Attentive captain wins in about 3:30–4:00 with 70–80% hull; a ship with
  no orders is lost in about 2 minutes.

## [0.2.1] — 2026-10-16

### Fixed
- Targeting a part had no visible effect while the enemy's facing shield was
  up: only the 15% bleed-through reached the part and the enemy repaired it
  within a second. Targeted hits now do 0.7× of hull damage to the part
  (random hits 0.45×), the Bird-of-Prey repairs at 2.0/s (was 2.5), Tactical
  reports when a shield is absorbing your shots and when the part becomes
  exposed, the hover label shows "SHIELDED 80%" or "SHIELD DOWN", and the
  targeted enemy chip is outlined.

## [0.2.0] — 2026-10-16

### Added
- Six targetable subsystems: Phasers, Torpedoes, Engines, Shields, Sensors,
  Bridge. Each has its own effect (sensors lower accuracy, bridge slows
  crew reaction, torpedoes slow reload). Defined in `BS.Data.subsystems`;
  buttons, status rows and enemy readout are generated from it.
- Click targeting on the tactical display: hover the enemy to see its
  hardpoints and health, click one to target it, click again or click the
  hull to return to hull targeting. Pulsing reticle marks the current target.
- Targeting a part costs 15% hit chance (`subsystemEffects.targetAccuracyMult`).
- Repair priority for every part, plus Auto.
- Enemy subsystem readout chips in the sensors panel. Subsystem hits spark
  at the part that was hit.

### Changed
- Enemy AI targets any of the six parts (weighted) and suffers the same
  accuracy penalty.
- Balance retuned: random subsystem hits 50% (was 60%), subsystem floor 0.4,
  enemy hull 900 / shields 330, enemy weapons slightly stronger.

## [0.1.1] — 2026-10-16

### Fixed
- Red alert, Yellow alert and Hail enemy were hidden below the fold of the
  order panel on screens shorter than about 800 px. The Ship-wide group now
  sits at the top of the order panel, panels are more compact, and a
  short-screen layout keeps all orders visible at 1280×720.

## [0.1.0] — 2026-10-04 (MVP)

### Added
- Start screen, battle screen, result screen with Restart.
- LCARS style interface: left ship status, centre tactical canvas, right
  order panel grouped by officer, bottom comms log (newest on top).
- Player ship (Constitution class) vs one enemy (Bird-of-Prey style) with AI:
  approach, attack, present fresh shields, retreat when badly damaged.
- Orders: Helm (Attack pattern, Evasive, Close range, Open range, Come about);
  Tactical (Target Weapons/Engines/Shields, Fire phasers, Fire torpedoes,
  Fire at will, Hold fire); Engineering (power presets, repair priority,
  Reinforce weakest shield); Ship-wide (Red alert, Yellow alert, Hail enemy).
- Crew AI with per-order delays, acknowledgements and reports.
- Four shield facings, subsystem damage, power allocation trade-offs.
- Phasers (fast, weak) and torpedoes (slow, strong).
- Visuals: parallax starfield, nebula, vector ship silhouettes, glowing
  beams, torpedo trails, shield ripples, sparks, explosions, screen shake.
- Real-time with Pause; orders accepted while paused.
- All stats data-driven in `js/data.js`; data shapes for campaign, shipyard,
  ship classes, crew XP and save files defined for later versions.
- Officer order queues are FIFO (one executing + four pending).
- Attack pattern turns in for a torpedo pass whenever tubes are loaded.
- Damage control patches hull slowly once all subsystems are repaired.
- Left panel shows phaser charge, torpedo reload and enemy sensor readout
  (hull, facing shield, range band, AI state).

### Balance
- Tuned with an accelerated headless simulation so an attentive captain wins
  in 3–5 minutes with 60–80% hull, and a ship given no orders is lost in
  about 3 minutes. See `DESIGN.md` section 8.

### Known limitations
- No audio. Google Fonts "Antonio" needs internet; otherwise a condensed
  system font is used.
- Single enemy type and single player ship class.

## [0.0.1] — 2026-10-04

### Added
- Repository setup: `CLAUDE.md`, `DESIGN.md`, `README.md`, `CHANGELOG.md`,
  `.gitignore`, folder structure (`css/`, `js/`, `assets/`).
