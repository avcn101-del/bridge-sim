# Changelog

All notable changes to Bridge Sim. Versions follow `DESIGN.md` roadmap.

## [0.1.0] — planned (MVP)

### Planned
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

## [0.0.1] — 2026-10-04

### Added
- Repository setup: `CLAUDE.md`, `DESIGN.md`, `README.md`, `CHANGELOG.md`,
  `.gitignore`, folder structure (`css/`, `js/`, `assets/`).
