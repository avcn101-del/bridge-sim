# Changelog

All notable changes to Bridge Sim. Versions follow `DESIGN.md` roadmap.

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
