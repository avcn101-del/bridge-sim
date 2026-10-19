# Changelog

All notable changes to Bridge Sim. Versions follow `DESIGN.md` roadmap.

## [0.36.0] — 2026-10-19 (the vision and the first cut; DESIGN §10 "Streamline")

### Changed
- **DESIGN §1–§2 rewritten as the vision**: WoW raids in Trek ships in an
  arena. The admiral prepares (build, roster, script, intel, dry run) and
  watches; roles and bosses are the game; every system must serve a step
  of the loop. §10 ranks every system (core / simplify / cut / measure)
  and lists the cut PRs 0.36–0.39.
- The report's *Why you lost* keeps the tuning line and the pair of
  standing rules; the style tags and the doctrine table's sentence are
  gone. The hangar's Doctrine box is now the Tuning box (the ring only).

### Removed
- Learning and signatures (`campaign.learn`, `save.signatures`,
  `enemyAI.signatureCounters`, the "They have watched you" and "They
  read your tuning" lines), the opening book (`save.book`, the hangar's
  "Book ·" line), the build counter table (`enemyAI.counters`,
  `encounters[].counter`, the "Next:" counter reason), the doctrine
  table (`enemyAI.doctrineTable`), style recording (`state.style`,
  `BS.Game.styleTags / counterSentence`), harness `--signature`,
  `--learn` and `--sigtune`. Old saves load: the two fields are dropped.

### Measured (DESIGN §8)
- Unchanged: 1v1 Brawler vs Raider 3 of 4 in 2:35–2:59 keeping 73–92%;
  Wolf pack vs pack 2 of 2 in 3:21–3:49.

## [0.35.0] — 2026-10-19 (runs, roster and repair bills; 0.35 of DESIGN §10)

### Added
- **Runs** (`campaign.run`): counting wins and losses, every 6th battle is
  a boss fight once the fleet has two hulls and 4 wins are in. The `cube`
  joins the pool at 4 wins, the `pair` (2 wins) and the `pack` (5 wins)
  are fleet encounters (`kind: "fleet"`) that need two hulls. The hangar's
  threat line names the kind, who undocks and "boss in n".
- **Roster**: "Add to fleet" / "In fleet ✓" on owned hulls in the shipyard
  (at most 4 with the flagship); solo encounters send the flagship alone,
  fleet and boss encounters send the roster (`enc.roster`).
- **Repair bills** (`campaign.repair`): 20% of each destroyed block's
  price, 30% of a lost hull's block value, capped at the credits in hand;
  the report's "Repairs" row lists them per hull.

### Changed
- Cutting beam: 4 extra penetration points (was 8), so a tank takes it on
  its armor instead of a core breach. Galaxy *Anchor* preset v2: the
  saucer-rim reactors moved inboard.
- Harness and smoke set `campaign.run` so a forced encounter survives the
  run filter.

### Measured (DESIGN §8), honest
- With every hull's script set (`--scripts`): four Cube breakers 4 of 4 at
  0 wins, four Brawlers 0 of 2; tank + healer + two breakers 4 of 4 at 0
  and at 6 wins (with 0.34's beam: longer, a hull lost each) but still
  slower than four breakers. Correction: the 0.33–0.34 "four breakers"
  rows had the breaker on the flagship only. 1v1 unchanged (3 of 4).

## [0.34.0] — 2026-10-19 (role blocks on role cells; 0.34 of DESIGN §10)

### Added
- **Role cells**: mask letter `r` in every Federation hull (Constitution 2,
  Miranda 1, Defiant 1, Excelsior 3, Galaxy 5, Sovereign 3), fillable by
  anything and the only place a `roleOnly` block fits (validation, editor
  message, orange outline in the editor).
- **Role blocks and modules**: shield transfer emitter (`shield_transfer`:
  100 shield per emitter from our strongest facing to the supported ally's
  weakest, 4 km, our pool pays), remote repair projector (`remote_repair`:
  45 hp per projector to the ally's damaged blocks), signature beacon
  (`beacon`: signature ×2.5 while it runs). `BS.Data.support`.
- **Ally subjects** (`weakestAlly`, `hurtAlly`, `huntedAlly`, `flagship`),
  actions `support` and `escort` (the helm keeps station 2.5 km from an
  ally), policy `support: auto`, subject `loudest`. The Borg cube turns on
  the loudest ship, so a lit beacon draws every beam charge.
- Templates **Anchor** (tank) and **Lifeline** (healer); presets Galaxy
  *Anchor* and Excelsior *Lifeline*. Crew lines for transfers, repairs and
  the escort order; harness `--layouts a:preset` and `--scripts a:id`.

### Changed
- The Borg cube carries a pair of cutting beams on its aft face too; the
  beam is 600 damage every 22 s (was 520 / 28). A false flag condition
  reads "not: …" in a sentence.

### Measured (DESIGN §8), honest
- The machinery works (in one fight all 15 beams charged on the beacon
  ship; 59 transfers, 50 repairs), but tank + healer + two breakers is a
  worse fleet than four Cube breakers against the cube at 0 and 6 wins,
  with a dodgeable beam and with an undodgeable one (tried, not kept).
  The numbers pass that makes the pair pay off is 0.35's. 1v1 unchanged.

## [0.33.0] — 2026-10-19 (the first boss: the Borg cube; 0.33 of DESIGN §10)

### Added
- **Borg cube** (`shipClasses.borg_cube`, encounter `cube`, `kind: "boss"`):
  a 24×24 hull with cutting beams on three faces, cannons on four, shields
  everywhere but the aft, the reactors behind the bare aft. Profile
  `enemyAI.boss` (never retreats, `statMult` 1.8, `shieldMult` 4).
- **Cutting beam** (block `lance`, `enemyOnly`): charges 6 s (event
  `weaponCharging`: Tactical calls it, the block glows, the scan panel
  lists it), then fires at the ship it charged on, 8 blocks deep, tracking
  0.35. Conditions `lanceCharging`, `allyLanced`.
- **Boss script** (`enemyScripts.borg`) with callouts: turn on the nearest
  ship every 30 s, remodulate when beaten, **summon** two escorts at 60%
  hull (`BS.Game.summon`, encounter `reinforcements`, event
  `reinforcements`), **overdrive** at 7 min (`enemyAI.overdrive`: damage
  ×1.5, speed ×1.25), roll when blind.
- Template **Cube breaker**: skirmish on the afterburner under a charging
  beam, escorts first, retune the ammo, then the cube's aft and reactors.
- Subject `smallest`; conditions `notTargeting: <subject>`,
  `enemiesAtLeast`; actions `summon`, `overdrive` (enemy only, not in the
  editor). Enemy-only blocks are out of the palette and fail validation on
  a Federation hull. Callouts from every enemy hull reach Tactical.
- The smoke test's fleet pass fights the cube.

### Measured (DESIGN §8)
- Four hulls vs the cube: Brawler **0 of 4** (lost in 7–9 min), Wolf pack
  0 of 2, **Cube breaker 4 of 4** in 4:31–5:31 keeping 83–93%. Without
  the aft side the breaker still wins but takes 8–9 min; without the dodge
  rule nothing changes (no beam faces aft). Cost with the cube and four
  hulls: 10 ms a frame headless.

## [0.32.0] — 2026-10-19 (fleet scripts: subjects and the target action; 0.32 of DESIGN §10)

### Added
- **Subjects** (`script.subjects`, `BS.Fleet.subject`): a rule may be
  `about` the nearest, weakest or biggest enemy, the one shooting at us or
  the one most of us are fighting; its conditions then read that ship.
  Action **`target`** switches our fire to a subject (helm, lock and aim
  follow). Conditions `allyShieldBelow`, `allyHullBelow`, `allyUnderFire`,
  `outnumbered`, `enemiesAtMost`, `unfocused`. The editor shows an "about"
  dropdown on every rule with a condition and the subjects for `target`.
- Template **Wolf pack**: finish the enemy closest to breaking, otherwise
  all guns on the ship most of us are fighting; the Brawler when alone.
- The battle report lists every hull of ours (script, how it ended, rules
  fired, last target) and the enemy fleet; the dry run prints both sides.

### Changed
- Scans are per ship (`ship.scannedOf`): `ship.scanned` follows the
  current target, so a weak-point aim on a new target waits for its scan.
- The Raider and Cruiser enemy scripts shift fire to the ship their pack
  is on (`unfocused`, every 10 s, with a callout); in a 1v1 it never fires.

### Measured (DESIGN §8)
- 1v1 identical to 0.31. Four Federation hulls vs the pack: Brawler on all
  0 of 4, **Wolf pack on all 4 of 4** in 3:21–5:06 keeping 62–73%. Two
  hulls vs the pair still 0 of 3.

## [0.31.0] — 2026-10-19 (fleet engine: N ships against M; 0.31 of DESIGN §10)

### Added
- **Teams** (`js/fleet.js`, `ship.team`, `state.teams`): a battle holds the
  player's fleet (`save.fleet`, up to `campaign.fleetMax` 4, the hangar's ship
  first, one script per hull) against every ship of the encounter
  (`campaign.encounters[].ships`). Both sides spawn line abreast
  (`balance.fleetSpacingKm`). Every ship fights its own target: the nearest
  hostile it can see, re-chosen when that one is destroyed; retargeting
  rebinds the script, the play, the helm (it re-enters its stance or
  doctrine), the lock and the aim. A side loses when none of its ships can
  still fight (destroyed, disabled or captured); salvage counts every enemy
  hull by how it ended; hull lost is read over the whole side.
- The panels follow a **viewer** (`state.player`, the flagship until it is
  lost, then the next fighting hull) and a **primary enemy** (`state.enemy`,
  the viewer's current target). The camera fits every ship in view; only
  the viewer's hits shake the screen. Contacts are kept per ship seen.
- Encounters `pair` and `pack` (two and four Birds-of-Prey), out of the
  campaign pool until the fleet hangar of 0.35; harness `--fleet a,b,c`,
  `--efleet id,id` and `--perf`; `tools/smoke.js` runs a third pass with a
  fleet of four to the end of the battle.

### Changed
- `campaign.learn.chance` and `tuneChance` are 0 (DESIGN §10): no encounter
  answers the player's last wins any more; the machinery stays for the
  harness (`--learn`) and for bosses.
- The harness stops the page's frame loop: drawing consumed `Math.random`
  (beam flicker, screen shake) on wall-clock frames, so a seeded run drifted
  by a few seconds between invocations. Runs now repeat exactly; §8 numbers
  from 0.31 on are not seed-comparable with 0.25–0.30.
- `CLAUDE.md` describes the admiral, the scripts and the team model.

### Not yet (0.32+)
- The scan panel, the overlays, the enemy chips, click and tap hit-testing
  and the crew voices follow the viewer and the primary enemy only; allied
  hulls fight silently. `ship.scanned` is per ship, not per target. Script
  conditions have no subject; `enemy…` reads the ship's current target.

### Measured (DESIGN §8)
- 1v1 unchanged in substance: Brawler vs Raider 3 of 4 (seeds 1–4, now
  exact). Fleet engine: Constitution alone vs `pair` 0 of 3 (disabled in
  1:17–1:42); Constitution + Miranda vs `pair` 0 of 3; four Federation hulls
  vs `pack` 1 of 2 (5:33 keeping 55%). Not balance targets: the fleet
  economy and role blocks come with 0.34–0.35.
- Cost (headless, software rendering): 2 hulls 5 ms per simulated second
  and 5 ms per frame; 8 hulls (1,386 blocks) 19 ms per simulated second
  (0.3 ms a step) and 12 ms per frame. The simulation is not the limit; the
  draw is within a 60 fps frame even without a GPU.

### Direction

- DESIGN §10 records the decided direction: a PvE fleet game (admiral,
  up to four hulls, roles from blocks on role cells, 1v1 / 4v4 / 4 vs
  boss, skirmish-then-boss runs). The 1v1 "chess" line (counter table,
  learning, learned tuning) is closed; tuning and `remodulate` stay as
  boss material.
- Templates Alpha strike, Turtle and Hit & fade leave the hangar list
  (`script.retiredTemplates`, kept for the harness and as syntax
  examples; a save that assigned one undocks with the Brawler). DESIGN
  §10 records why only the Brawler wins and the rule for role templates
  in 0.32.

## [0.30.0] — 2026-10-19 (remodulating; PR E of the "chess" pillars)

### Added
- **Remodulate** in battle (`BS.Ships.remodulate`, `tuning.remodulate`):
  shields take the frequency that beats their ammo (10 s with the
  deflector down) or weapons take the ammo that beats their shields (5 s
  cold); needs a scan. Script conditions `enemyAmmoBeatsOurShields`,
  `ourAmmoBeaten`, `remodulating` and action `remodulate`; the Raider,
  Cruiser and Siege cruiser scripts react with callouts; two bridge calls
  *Remodulate shields* / *Remodulate ammo* (a call with nothing to do
  spends no token).
- Weak point **frequency**: the facing whose shield frequency our ammo
  beats, on the scan panel, the intel box and in the enemy's aim.
- **They read your tuning**: from 3 wins on, the enemy's shields and ammo
  answer the tuning of the remembered wins (`campaign.learn.tuneChance`);
  the hangar says so.
- Harness `--sigtune`; the summary shows the enemy's tuning and how often
  it remodulated.

### Fixed
- A script flag condition written `flag: false` was read as `true`.

## [0.29.0] — 2026-10-19 (tuning: shield frequencies, alloys, ammo; PR D of the "chess" pillars)

### Added
- **Tuning** (`BS.Data.tuning`, `save.tuning[classId]`): five modulations
  (Graviton, Nadion, Tetryon, Polaron, Antiproton) in a ring; every
  shield emitter has a frequency, every armor plate an alloy, every
  weapon block an ammo modulation, so hulls and batteries can be hybrid.
  One rule: ammo that beats the frequency of the emitter it hits is ×1.5
  for the whole shot while that shield is up, ammo the frequency beats
  ×0.5; the same against a plate's alloy; systems ×1.
- Faction defaults (Federation Nadion, Klingon Polaron) and a 15%
  surcharge for off-faction tuning; retuning pays only the surcharge.
- Editor **Tune** mode: a modulation palette, "set all weapons / shields /
  armor", painting per block with Mirror, dots in each block's colour.
  Build stats Tuning line; Doctrine page redrawn for the ring; Intel
  "Tuning: theirs … · yours …".
- The enemy's tuning shows on the scan panel only once scanned; intel,
  the Book and the signature of a win keep it; the report opens with the
  ammo-vs-shields multipliers.
- Harness `--tune` / `--etune`.

### Removed
- The build-family element ring of 0.27–0.28 (`elements`, `elementOf`,
  the Build line's element, the element answers in learning).

## [0.28.0] — 2026-10-19 (the element ring; PR C of the "chess" pillars, second cut)

### Changed
- **One rule instead of a chart**: five Trek elements named for their
  science (Graviton / Deflector, Nadion / Phaser, Photon / Ordnance,
  Plasma / Impulse, Duranium / Armour), each beats the next in a ring; a
  ship's hits do ×1.35 into the element it beats and ×0.65 into the one
  that beats it, a mixed ship gives and takes ×1 (`BS.Ships.elementMult`).
  The 0.27 weapon-type chart and the torpedo exponent change are removed.
- Every edge measured in both directions on equal hulls (DESIGN §8): ±25%
  held four edges and stalemated Nadion vs Photon; ±35% holds all five.
- Doctrine page redrawn as the ring with "Your ship: … +35% vs … · −35% vs
  …"; Intel and the battle report show the multipliers in force; the
  enemy's learning answers the player's element with the one that beats it.

## [0.27.0] — 2026-10-19 (elements: the measured wheel; PR C of the "chess" pillars)

### Added
- **Elements** (`BS.Data.elements`): Impulse, Ordnance, Deflector, Armour,
  Phaser as block families; a build's element is read off its layout
  against the class default (`BS.Grid.elementOf`, shown in the hangar
  Build line and the Intel box); variants and presets name theirs.
- **Type chart** in the damage path: torpedoes drain shields ×1.5, cannon
  bolts ×0.7, beams and pulses into armor plating ×0.75;
  `balance.torpedoSpeedExponent` 1.0.
- **Doctrine page** in the hangar: the measured wheel Ordnance → Impulse →
  Deflector → Ordnance, Impulse over Armour, Armour and Phaser balanced,
  each edge as a sentence with its numbers (`elements.edges`, equal-hull
  duels in DESIGN §8). The battle report quotes the edge between the two
  builds; the enemy's learning answers the player's element first.
- Layouts: Bird-of-Prey Interceptor, Bombard, Bulwark, Pulser (encounters
  from 2–3 wins); Constitution presets Courier and Bulwark.
- Harness: `--rows variant:X`, `--equal` (equal-hull duels).

### Changed
- The wheel drawn beforehand (five elements in a ring) did not survive the
  duels; `elements.edges` holds only what held both ways. The first chart
  (×2.0 / ×0.5 / ×0.5) made Ordnance beat everything and the K't'inga
  harmless; the moderate chart keeps the campaign where 0.26 left it.

## [0.26.0] — 2026-10-19 (honest loss, why you lost, the enemy learns; PR B of the "chess" pillars)

### Added
- **Why you lost / What carried it** in the battle report: the pair of
  standing rules (theirs | ours) under which most of the damage landed,
  both fights' style tags and the doctrine table's sentence for the pair
  (`enemyAI.doctrineTable`, measured rows only).
- **Signatures and learning**: a win records its style (tags, range, side,
  aim, script, cost; `save.signatures`, last 3). From 3 wins on, with a
  60% seeded chance, the next encounter answers the dominant tag with a
  measured counter of the same weight (`enemyAI.signatureCounters`,
  `campaign.learn`); the hangar says "They have watched your last 3
  fights (…): expect …".
- `tools/harness.js`: `--variant / --doctrine / --escript` force the enemy,
  `--signature tag --learn` force the learning path.

### Changed
- **Honest contact**: a cloaked ship beyond the viewer's sensors is known
  only by its last contact (`BS.Ships.contact`); the doctrine machine, the
  helm and the script conditions read ranges and bearings from it, for
  both ships. The helm now flies against the last contact instead of
  holding course.
- DESIGN §8 carries the 3-win matrix (7 player styles × 6 Bird-of-Prey
  variants); the theory counters that failed it were dropped from data.

## [0.25.0] — 2026-10-19 (enemy reactions, opening book, PR A of the "chess" pillars)

### Added
- **Enemy reactions** as script rules with callouts (`script.enemyScripts`,
  same engine, nothing new in `enemyai.js`): roll when shadowed, reinforce
  and roll when their emitters are hunted, kite under an alpha strike, hold
  off a cloaked ship then scan. Tactical reads each reaction out; the
  Gunboat, random variant, Jammer boat and Leech fly the Raider script.
- **Conditions**: `enemyStance` (orbiting / holding / shadowing / kiting /
  closing / rolling), `enemyAimingAt` (hull / a type / a weak point /
  structure), `rangeBand` measured off our own weapons (beam optimal,
  torpedo range, beyond), `enemyAfterburner`, `enemyHeatAbove / Below`,
  `blindFor`. **Action** `roll` (come about to the side with the most fire)
  and rule field `callout`.
- **Opening book**: the battle report lists *Their bridge* (the enemy rules
  that fired, in their words); the hangar Intel box shows the book for the
  next encounter ("Book · 3 fights: …", `save.book`).
- `script.maxScripts` (12): Copy as new refuses beyond it.
- `tools/harness.js` (balance runs per DESIGN §8: forced encounter, seeded
  rolls, `--noreact`, `--eval`, `--debug`) and `tools/smoke.js` (headless
  interface check, desktop and phone landscape).

### Changed
- The blind-sector roll left `enemyai.js` (`blindTolerance` removed): it is
  a rule in every enemy script, and the blind time counts only in the
  firing states (brawl, pass, broadside, standoff), so a strafer breaking
  off no longer "rolls".
- Reaction doctrines `kite` (keep 9 km) and `watch` (hold 5 km) in
  `enemyAI.doctrines`; `helm.repositionDuration` for a player roll.
- Battle report reasons: "they never shot at our shield emitters", "they
  were never rolling a fresh side", "our guns never lost them for 3 s".

### Measured (DESIGN §8)
- Nothing regressed (Brawler vs Raider 6 of 6; cruiser, torpedo boat,
  Shadow, Siege as before). No reaction yet costs the player anything
  measurable; the cloak reaction even helps the ambusher. Left for the
  counter table (pillar 2).

## [0.24.0] — 2026-10-18 (battle report, refit & retry, PR D of "build & fight")

### Added
- **Battle report**: the script's timeline (every rule firing and bridge
  call, then the end), and **Never fired**: each rule that never fired
  with the reason and how close it came ("they never came inside 5 km
  (closest 6.2 km)", "it held at 01:41 but rule 2 stood above it").
  `BS.Script.explain`; the dry run shows the same lines.
- **Clean bridge**: a win with no bridge call spent pays ×1.2 on the win
  credits (`script.bridgeCall.noCallBonus`), counted as clean wins in the
  hangar record.
- **Refit & retry**: pins the enemy just fought for the next undock (same
  seed: layout, name, doctrine; counter read off the new build); "Retry:"
  in the hangar header and *Let it go* in the Intel box. A loss still
  counts.

## [0.23.0] — 2026-10-18 (bridge calls and the watching battle, PR C of "build & fight")

### Added
- **Bridge calls**: two per battle (● ●), never refilled: Change play
  (45 s), Change side (45 s), Disengage (until the weakest shield is over
  60%), Reinforce (now), Focus block (tap a block on the scan panel or the
  display, confirm; 30 s). A button fires on the second press within 3 s.
  Calls are overrides on the running script that hand back when they end;
  the Helm acknowledges, the trace records them (`bridgeCall` event,
  `state.callLog` for the battle report).
- **Trace band** under the log ticker (last three rule firings); scan
  panel lines *Standing* and *Aiming*.
- **Speed** 1× / 2× / 4× in the top bar (`balance.speeds`,
  `balance.maxStepsPerFrame`).
- Hangar checkbox **Manual bridge (debug)** (`settings.manualBridge`).

### Changed
- The hand-flown helm column, top-bar Reinforce, aim chips, module clicks,
  canvas steering (long-press, double-tap, right-click) and the stance /
  play / side / aim keys are hidden and inert unless the manual bridge is
  on; Space, G and ? keep working. The phone drawer ORDERS is BRIDGE.

## [0.22.0] — 2026-10-18 (script editor and plan, PR B of "build & fight")

### Added
- **Script editor** in the hangar: templates and own scripts in a dropdown;
  Copy as new / Rename / Save / Delete / Assign to this build. Rules are
  cards built from dropdowns whose entries are the sentences of
  `script.conditions / actions` (number boxes for km / s, 0–100% sliders
  for fractions, on / off, dropdowns for stances, plays, sides, block
  types, weak points and plan targets); each card reads back as a sentence
  with warnings (aim needs a scan, Otherwise not last, empty rule). Kinds:
  Standing orders / Once / Every N s, with UNTIL and "At most N s".
- **Plan**: up to three targets on the next enemy, tapped on the intel
  drawing (numbered markers) or chosen by type without intel; saved per
  encounter and read by `aim: plan target n`.
- **Dry run vs next enemy**: one simulated battle with the current build,
  script and seeded enemy in about a second, result line plus the first
  trace lines; nothing is saved (`BS.Game.dryRun`).
- A standing rule whose aim waited for a scan takes it when the scan is in
  ("scan is in: aim at plan target 1").

## [0.21.0] — 2026-10-18 (bridge scripts, PR A of "build & fight")

### Added
- **Bridge scripts** (`js/script.js`, `BS.Data.script`): ordered when → do
  rules with standing orders, `until` / `holdMax` phases, once / every
  call-outs and standing policies; every condition and action carries a
  sentence, `BS.Script.describe` reads a rule as orders, the trace and the
  log record each takeover with the reason an action waited.
- Seven templates (Brawler, Alpha strike, Siege, Turtle, Hunter, Ambush,
  Hit & fade) as rules; a hull undocks with its assigned script or the
  Brawler. Enemy encounters run scripts on the same engine (doctrine, the
  Torpedo boat's Siege play, scan rules).
- **Scan** action (4 s, beams hold fire, module state `scan`): weak-point
  and plan aims need it, for the enemy too (`pickTarget` requires a scan).
  A scan records intel.
- Save: `scripts`, `scriptByBuild`, `plans`, `settings.manualBridge`
  (editor and battle view follow in PR B / C).

### Changed
- K't'inga default and Siege layouts carry two stern disruptors;
  `enemyAI.ktinga.blindTolerance` 4 → 2.5 s.
- Torpedo boat: two tubes (was three).
- The first fight (0 wins) has no weak-point hunting
  (`campaign.firstFight`).
- A manual stance / play / side / fly-to / stop pauses the player's script
  (Helm row "Manual").

## [0.20.0] — 2026-10-18 (phone landscape)

### Added
- **Compact mode** under 540 px of height: the tactical view fills the
  screen, the Ship / Orders / Scan panels are drawers opened from SHIP /
  SCAN / ORDERS tabs in the top strip, bigger buttons, smaller HUD,
  scrolling overlays and hangar (Build first, 4-column palette).
- **Touch**: tap the enemy to lock, tap a block to aim at its type,
  long-press the enemy to Engage, long-press or double-tap empty space to
  fly there, pinch to zoom; finger painting in the hangar editor.
- ⛶ fullscreen button (locks landscape where allowed); "turn your phone"
  screen in portrait; mobile web-app meta tags.
- `zoom.autoMinShort / shortPx`: the camera zooms out further on short
  views; `zoom.min` 0.1.

### Not changed
- Balance and game logic. Distribution is still a URL: the repository is
  private, so GitHub Pages is not available on the free plan.

## [0.19.0] — 2026-10-18 (decoys, energy neutralisers, boarding)

### Added
- **Decoy launcher** (block `Y`, module 20 s / 15 cap, `ew.decoy`): drops
  a flare astern per launcher block for 8 s; torpedoes hunting you within
  3 km turn on it and blow up on it. Timing call: 2–4 km out. The Siege
  K't'inga carries two and the enemy AI drops one when torpedoes close.
- **Energy neutraliser** (block `X`, module 6 s / 20 cap, `ew.neut`): with
  a lock inside 4 km drains 30 capacitor per block from the target; their
  booster, hardener, afterburner, cloak and finally guns starve. An enemy
  drained under 8% opens the range to 8 km (`drained` state) until its
  capacitor is back. The scan panel shows their capacitor.
- **Leech** encounter (Bird-of-Prey with two neutralisers, brawl, from
  win 3) and a counter rule: two or more neutralisers in your build make a
  flagged raider stand off and a K't'inga siege.
- **Boarding** (`js/boarding.js`, key T, `grid.boarding`): with a lock,
  inside 3 km and their facing shield down, the transporter beams your
  spare crew across (manning drops for the rest of the battle); aboard they
  fight 2 + 3 per alive crew deck by Lanchester's law. Captured ends the
  battle as a victory with 30% salvage; repelled loses the party. Ship
  panel row, transporter button with the reason it is off, scan panel
  line with the defenders, Security officer callouts, result overlay.
- Hangar: Crew line shows spare crew / boarding party; capacitor "runs
  dry" now counts block-bound active modules (jammer, decoy, neutraliser);
  warning for a neutraliser on a small capacitor.
- Events `decoyLaunched, decoyExpired, torpedoLured, torpedoDecoyed,
  neutralised, boardingStarted, boardingAborted, boardingFight,
  boardingEnded, shipCaptured`; neutraliser bolt and decoy flare visuals.

### Changed
- `BS.Grid.derive` subtracts `grid.crewAway` from the crew supply.
- Balance measured in DESIGN §8 (Miranda + 2 neutralisers beats the
  Gunboat it loses to stock; decoys cut Torpedo-boat fights from 6–8 to
  4–5 min; boarding captures about one raider in four with set-up).

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
