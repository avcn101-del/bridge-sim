# Changelog

All notable changes to Bridge Sim. Versions follow `DESIGN.md` roadmap.

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
