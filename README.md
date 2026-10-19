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

**Phones and tablets**: open the same page from any URL that serves the
folder (a phone cannot open `index.html` from disk), hold the phone
sideways and tap ⛶ for fullscreen. Under 540 px of height the panels become
drawers (SHIP / SCAN / ORDERS in the top bar). Touch: tap the enemy to
lock, tap a block to aim at its type, long-press the enemy to Engage,
long-press or double-tap empty space to fly there, pinch to zoom.

## How to play

Control is EVE Online style. You never steer directly: you pick a target and
tell the helm how to fly relative to it, and you switch modules on and off.

- Click **Enter the hangar**. Build your ship in the editor, apply the build,
  then click **Undock** to fight. The hangar header says which enemy is
  waiting ("Next: …").
- **Click the Klingon ship** on the display (or double-click its row in the
  Overview). That selects it and starts a lock; "Target locked" appears in
  the log after about 3 s.
- Read the **weak points** column of the scan panel and click one (or any
  block on the drawing) to focus every weapon on it; the enemy reads yours.
- Pick an **attack side** (B): shadow their blind sector, a flank or their
  tail instead of circling; the scan panel shows their fire per sector.
- The bridge fights by a **script**: ordered "when → do" rules. In the
  hangar's Script section pick a template (Brawler, Siege, Hunter,
  Ambush), *Copy as new*, and build rules from
  dropdowns that read as sentences ("When our weakest shield is under 25%:
  fly Disengage"); *Assign to this build* and the ship flies it.
  **Plan** names up to three targets on the next enemy (tap its intel
  drawing); a rule can aim at plan target 1 after a scan. **Dry run vs
  next enemy** fights one simulated battle in a second and shows the
  trace. In battle the script has the conn: watch at 1× / 2× / 4×, read
  the trace band, and spend your **two bridge calls** (Bridge panel:
  fly a doctrine, change side, disengage, reinforce, remodulate, or focus
  a block tapped on the scan panel; press a button twice to confirm). A
  win without a call pays ×1.2. The battle report shows the script's
  timeline and why each unfired rule never fired; **Refit & retry** brings
  the same enemy back. There is no hand-flown bridge.
- The camera keeps both ships in view; wheel or +/− zooms on top of that.
  A Constitution measures about 1 km on the game's scale (three times its
  real size, so you can see the blocks).
- The bottom row is the **scan panel**: once you hold a lock it shows the
  enemy's blocks and damage, shields and bare hull, cloak and ECM field
  gaps, power, how many of its weapons bear on you and what its
  torpedoes would do to you. The bridge log is the two-line ticker at the
  top of the display; LOG (G) opens the full log.
- Switch on systems in the bar at the bottom of the display (click or
  F1–F8): F1 fires every phaser emitter that can bear (cannons and pulse phasers get their own groups), F2 every torpedo
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
  down.
- **Electronic warfare**: an **ECM jammer** block (F6) rolls against the
  enemy's sensors every five seconds and breaks their lock; a **cloaking
  device** (F7, one per ship, 400 cr) makes you unlockable and unseen
  beyond ten kilometres, at the price of shields, weapons and capacitor.
  Klingon Shadows do the same to you: when Tactical says they cloaked,
  watch for the ghost inside ten kilometres and keep your strong shield
  toward it.
- **Decoys and neutralisers**: a **decoy launcher** block drops a flare
  astern for 8 s and every torpedo hunting you within 3 km of it turns on
  the flare and dies on it: fire it when the volley is 2–4 km out. An
  **energy neutraliser** block, with a lock inside 4 km, drains 30
  capacitor per block from the enemy every 6 s until its booster,
  hardener, afterburner, cloak and guns starve; a drained enemy runs out to
  8 km to recharge, so stay on it. The Leech raider does it to you.
- A ship with no weapons and no engines left is **disabled** and the battle
  ends. Disabling the enemy instead of destroying it pays 25% of its
  remaining block value as **salvage** (10% for a wreck).
- Enemies: Bird-of-Prey raiders in several layouts, then the heavier
  K't'inga battlecruiser from the fifth battle onward. Every win makes them
  4% stronger; bigger enemies pay more credits.
- Each enemy fights its own way, and the Overview status column tells you
  which: a **strafing** raider runs in, makes a close firing pass and breaks
  off to come around again; a **brawler** orbits close and reverses
  direction; a **standoff** torpedo boat sits at 14 km and runs when you
  close (Engage chases it); the **broadside** cruiser turns slowly to keep
  a fresh shield toward you. Your script answers with the doctrine it sets.
- Weapons only fire where your own hull does not block them, so a saucer
  fights with the guns on the side facing the enemy; the helm reverses the
  orbit when the other side has more to bring to bear. Paint weapons on
  the rim; a weapon buried inside the hull shows a red cross in the editor
  and never fires.
- **Space** pauses; commands still work while paused. Mouse wheel zooms.
  The **?** button lists all controls.
- Destroy the enemy to win. The result screen shows the credits you earned;
  **Return to hangar** to spend them.

## Hangar, build, roster, saving

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
- **Saving**: automatic in this browser. **Export save** downloads a JSON
  file; **Import save** loads one. **Reset progress** starts over.

## Tweaking balance

All numbers live in `js/data.js`. Edit with any text editor and reload.

| Where | What it changes |
|---|---|
| `units.pxPerKm`, `grid.cellPx` | World scale and cell size |
| `blocks.*` | Every block: hp, mass, cost, colour, glyph, weapon stats (damage, cycle, cap, optimal / falloff / tracking, arc, `pierceBonus`), effects |
| `grid.lineOfFire / lineOfFireMuzzle / lineOfFireRangeCells` | Whether and how the own hull masks weapons |
| `grid.shieldBase / shieldAdd / regenBase / regenAdd / shieldRadius / shieldRechargeDelay` | Shield facings from emitters; bubble radius in cells; seconds a hit facing waits before regenerating |
| `grid.crits` | Critical hits: hp threshold, chance, tumble time and spin, sensor blind time, emitter drain, weapon jam cycles |
| `grid.powerRadius / unpoweredFactor`, `grid.breach` | Reactor power range and the penalty outside it; core breach countdown, radius and damage |
| `helm.sides`, `helm.shadow`, `helm.repositionDuration` | Attack sides (bearings from the target's heading, blind-sector hysteresis, station radius) and how long a player come about (script action `roll`) holds; how long an enemy tolerates nothing bearing is its script's `blindFor` |
| `helm` | The default doctrine, auto-flip interval and shield thresholds, keep geometry (`bearingStep / keepBand / keepRunBelow / holdSpeed / keepFireFraction / kiteMinBearing`), the standing script policies (`policy`: booster and reinforce thresholds) |
| `balance.zoom` | Auto-fit camera limits and margin (`autoMinShort / shortPx` for short phone views), manual zoom bias range |
| `grid.capBase / capAdd / capRechargeTime` | Capacitor from reactors |
| `grid.thrustPerPoint / nacelleThrustMult / speedMultMin / speedMultMax` | Speed from engines and mass |
| `grid.hitScatter / penetration / torpedoSplash / aimRadius / aimScatter / deadFraction / structureHp / torpedoStructureMult` | Where shots land, how damage travels through the hull, when a ship is lost, how tough necks are and what torpedoes do to them |
| `campaign.intelMinLockSeconds / intelCost` | How long a lock must hold to record an enemy layout; the price of buying it |
| `blocks.*.pierceCost`, `grid.structurePierceCost` | How much of a beam's penetration each block type eats (armor 2, structure 3) |
| `blocks.reactor.explosion`, `grid.lineOfFire` | Reactor breach damage and radius; whether the own hull masks weapons |
| `blocks.*.power`, `shipClasses.*.powerBase`, `grid.powerPerReactor / brownoutMin` | Power grid: what each system draws, what a hull and its reactors supply, how a brownout bites |
| `ew.*` (`ew.cloakDetectRangeKm`) | Jam strength and duration, cloak timings, surge and drain, decloak strike (`ew.strike`: window, shield bypass, damage), field radii (`cloakRadius`, `jamRadius`), detection range |
| `ew.decoy`, `ew.neut`, `enemyAI.*.drainedBelow / drainedUntil / drainedTime` | Decoy life, lure radius, speed; neutraliser range, drain per block, the enemy's flee range and when a drained enemy opens the range |
| `script.*` | Rule tick, charging speed, trace length, plan targets, default template, rules per script, own scripts per save (`maxScripts`), range bands (`rangeBands`), subjects a rule can be about and the `target` action switches to (`subjects`), dry-run length, bridge calls (`bridgeCall`: tokens, hold and focus seconds, confirm window), the sentence for every condition / action / policy, the templates (Wolf pack for a fleet) and the enemy scripts with their reaction rules and callouts |
| `tuning.order`, `tuning.bonus / malus`, `tuning.list`, `tuning.factionDefault`, `tuning.offFactionCost`, `tuning.tunable`, `tuning.remodulate`, `tuning.measured` | The modulation ring (each beats the next), the one multiplier (×1.5 for ammo that beats the frequency or alloy it hits, ×0.5 when beaten), each modulation's digit, colour and sentence, the faction defaults, the surcharge for off-faction tuning, which block types carry a modulation, how long a remodulation takes (shields down / weapons cold), the measured numbers |
| `balance.speeds / maxStepsPerFrame` | Battle speed buttons and the fixed steps a frame may run |
| `campaign.firstFight`, `campaign.encounters[].script` | The first fight's enemy overrides; which script each encounter runs |
| `campaign.salvage` | Share of the enemy's surviving block value paid after a win (destroyed / disabled / captured) |
| `shipClasses.*.mask / layout / variants` | Hull shapes, default builds, enemy layouts |
| `modules.*` (booster, hardener, afterburner) | Built-in active systems |
| `shipClasses.*.presets` | Preset builds offered in the editor |
| `editor.refund / maxSavedBuilds` | Refund on removed blocks, saved builds per hull |
| `campaign.encounters / enemyScaling / klingonNames` | Which enemy shows up when, which play it runs (`play`), its own damage multiplier (`damageMult`), how it scales, what it pays; `ships` lists the hulls that come with it (a fleet encounter) |
| `support.*`, `blocks.transfer / repairbeam / beacon`, `modules.shield_transfer / remote_repair / beacon`, `script.allySubjects`, mask letter `r` | Role blocks (0.34): the healer's reach and amounts per emitter and projector, the escort distance, the beacon's signature multiplier, who a support or escort action can be for, and which cells of a hull take role blocks |
| `shipClasses.borg_cube`, `enemyAI.boss / overdrive`, `blocks.lance` (`weapon.charge`), `campaign.encounters[].kind / reinforcements`, `script.enemyScripts.borg`, `script.templates.cubebreaker` | The first boss (0.33): its hull and layout, its profile (stat, damage and shield multipliers, no retreat) and enrage, the cutting beam's charge time, damage, depth and tracking, which escorts it summons, the rules and callouts of its bridge, and the template that beats it |
| `shipClasses.dderidex`, `enemyAI.warbird`, `blocks.plasma / tractor`, `modules.tractor`, `ew.tractor` (`rangeKm`, `hold`, `aiMinCap`), `campaign.encounters[].name`, `script.enemyScripts.warbird`, `script.templates.warbreaker`, `save.campaign.bossesBeaten` | The second boss (0.41): the warbird's hull and layout, its profile (it hunts reactors), the plasma bolt, the tractor beam's reach, hold time and the capacitor the AI keeps for it, its name, its bridge rules and callouts, the template that beats it, and the boss order (a boss slot takes the first boss not yet beaten) |
| `campaign.fleetMax`, `balance.fleetSpacingKm`, `save.fleet` | Hulls a side, how far apart they spawn, which owned hulls undock with the flagship on fleet and boss fights (the shipyard's "Add to fleet" buttons; the harness sets it with `--fleet`) |
| `campaign.run.bossEvery / bossFromWins / fleetMinHulls`, `campaign.encounters[].kind` | Runs (0.35): every n-th battle is a boss fight once the roster has the hulls and the wins; which encounters are solo (the flagship alone), fleet (the roster undocks, two hulls needed) or boss |
| `campaign.credits.win / loss / hullLostPenaltyPerPct / hullLostScalesWithReward / winStreakBonus` | Credits per battle (0.42: the hull-lost penalty is per percent of the side's block hp, times the encounter's reward multiple when the flag is on, so a boss docks for the hulls it cost) |
| `campaign.repair.destroyedBlock / lostHull` | Repair bills (0.35): the share of a destroyed block's price and of a lost hull's block value paid after a fight, capped at the credits in hand |
| `campaign.*` | Economy |
| `balance.capCurve / lockBase / zoom` | Capacitor curve, lock time, zoom |
| `enemyAI.doctrines` | How each doctrine flies (one list for both sides since 0.37; the labelled ones are the player's set and take their `ranges` from the fitted weapons): strafe pass range and timing, brawl orbit and flip timer, standoff hold and kite ranges, broadside band and roll timer, evade range, the reaction doctrines `kite` (9 km) and `watch` (5 km) |
| `enemyAI.default / ktinga` | Enemy accuracy, damage and stat multipliers, retreat thresholds, aim weights (`none` = spray), `weakPointChance` and `weakPointKinds` |
| `grid.weakPoints` | Weak-point analysis thresholds |
| `visuals.fragments` | Section break-off and ship shatter: piece count, speed, spin, lifetime, inertia, engine burn, reactor fuse and blast, debris damage per cell |
| `crew.reports`, `crew.events`, `blockReports` | All officer dialogue |

Later features (audio, sector map, science scans, sprites) have their data
shapes defined in the same file where they exist. See `DESIGN.md`.

## Project files

```
index.html      entry point
css/            LCARS interface styles
js/             data, grid, game loop, ships, modules, weapons, crew voices, enemy AI (the doctrine machine), fleet, scripts, campaign, hangar, UI, renderer, effects
assets/         optional sprites / sounds (empty in MVP)
tools/          harness.js (accelerated balance runs, DESIGN.md §8: forced encounter, equal-hull duels, tuning per side, fleets on both sides, --perf cost; exits on a page error), campaign.js (a whole run headless: encounters as the game picks them, credits and repairs settled between fights; --soloscript for the flagship's solo fights, --eval for a data tweak) and smoke.js (headless interface check, desktop, phone and a fleet of four); plain Node + Playwright, not needed to play
DESIGN.md       full game design and data structures
CHANGELOG.md    version history
CLAUDE.md       rules for AI-assisted development sessions
```
