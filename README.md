# Bridge Sim

A private, single-player Star Trek style **bridge combat simulator**. You are
the captain. You never fly or aim. You give orders by clicking buttons and
your AI crew (Helm, Tactical, Engineering) carries them out after a short
delay, reporting back in the comms log.

Plain HTML/CSS/JavaScript. No install, no build, no server.

## Run it

1. Download the repository as ZIP (GitHub → Code → Download ZIP) or clone it.
2. Unzip.
3. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).

That's it. Works offline (the sci-fi font loads from Google Fonts when
online and falls back to a system font otherwise).

## How to play

Control is EVE Online style. You never steer directly: you pick a target and
tell the helm how to fly relative to it, and you switch modules on and off.

- Click **Take the bridge**.
- **Click the Klingon ship** on the display (or double-click its row in the
  Overview). That selects it and starts a lock; "Target locked" appears in
  the log after about 3 s.
- Give the helm a command: **Orbit 6 km** is a good default. **Keep at
  range** holds a distance, **Approach** closes, **Come about** holds your
  strongest shield toward the enemy at low speed.
- Switch on modules in the bar at the bottom of the display (click or
  F1–F8): phaser banks, torpedo launcher, shield booster, shield hardener,
  afterburner. Every cycle costs **capacitor**: the dashed outer ring of the
  round gauge next to the module bar. The middle ring shows your four shield
  facings (top = front), the centre your hull. If the capacitor runs dry,
  modules shut down. Keep weapons and hardener on; pulse the booster and
  afterburner.
- Phasers hit best inside 8 km and against slow targets; orbiting fast and
  close makes enemy beams miss you (and yours miss them). Torpedoes always
  home in but do less damage to small fast ships.
- Damage hits the shield facing toward the enemy. **Reinforce** (top bar)
  or **Come about** when one facing collapses.
- Hover the locked enemy to see its parts; click one to aim at it (−15%
  accuracy). Parts only take real damage once the facing shield is down.
  Click your own subsystem rows to set repair priority.
- **Space** pauses; commands still work while paused. Mouse wheel zooms.
  The **?** button lists all controls.
- Destroy the enemy to win. Restart from the result screen.

## Tweaking balance

All numbers live in `js/data.js`. Edit with any text editor and reload.

| Where | What it changes |
|---|---|
| `units.pxPerKm` | World scale (20 px per km) |
| `modules.*` | Every weapon and module: damage, cycle, cap cost, optimal / falloff / tracking, torpedo explosion radius and velocity, booster amount |
| `shipClasses.*.capacitor` | Capacitor size and recharge time |
| `shipClasses.*.fit` | Which modules each class carries |
| `shipClasses.*.signature / sensorStrength / lockRangeKm` | Lock times and ranges |
| `shipClasses.*.hull / shields / speed / turnRate` | Toughness and agility |
| `balance.capCurve` | Capacitor recharge shape |
| `balance.lockBase` | Base lock time |
| `balance.orbitRangesKm / keepRangesKm` | Range buttons |
| `balance.shieldBleedThrough`, `subsystemHitChance`, `targetedSubsystemDamageFactor` | How damage reaches hull and parts |
| `subsystemEffects.*`, `subsystemFloor` | How much damaged parts hurt |
| `enemyAI.default` | Enemy accuracy, reaction, stat multiplier, orbit range, booster and afterburner thresholds |
| `crew.reports`, `crew.events`, `crew.hailReplies` | All officer dialogue |

Later features (campaign, shipyard upgrades, more ship classes, crew XP) have
their data shapes defined in the same file. See `DESIGN.md`.

## Project files

```
index.html      entry point
css/            LCARS interface styles
js/             data, game loop, ships, modules, weapons, crew, enemy AI, UI, renderer, effects
assets/         optional sprites / sounds (empty in MVP)
DESIGN.md       full game design and data structures
CHANGELOG.md    version history
CLAUDE.md       rules for AI-assisted development sessions
```
