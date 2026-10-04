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

- Click **Take the bridge** on the start screen.
- The enemy ship approaches. Give orders from the right-hand panel:
  - **Helm**: Attack pattern, Evasive, Close range, Open range, Come about.
  - **Tactical**: pick a target subsystem, Fire phasers, Fire torpedoes,
    Fire at will (auto), Hold fire.
  - **Engineering**: power preset, repair priority, Reinforce weakest shield.
  - **Ship-wide**: Red alert, Yellow alert, Hail enemy.
- Officers answer "Aye, Captain", execute after a short delay, then report.
- Watch the left panel: hull, four shield facings, subsystem health, power.
  Damage hits the shield facing toward the enemy. Turn fresh shields toward
  them before a facing collapses.
- **Space** or the PAUSE button pauses. You can still give orders while
  paused.
- Destroy the enemy to win. Lose your hull and you're defeated. Restart from
  the result screen.

Tips: Red alert first. Weapons power + target Weapons wins faster; Shields
power + Come about survives longer. Torpedoes hit hardest at close range.

## Tweaking balance

All numbers live in `js/data.js`. Edit with any text editor and reload.

| Where | What it changes |
|---|---|
| `shipClasses.*.hull` | Hit points of the hull |
| `shipClasses.*.shields.max / regen` | Shield strength per facing and regen per second |
| `shipClasses.*.speed / turnRate` | Movement speed and turning |
| `weapons.phaser_mk1.damage / cooldown / range` | Phaser strength, rate of fire, reach |
| `weapons.photon_mk1.damage / reload / speed` | Torpedo strength, reload time, flight speed |
| `powerPresets` | How much each preset favours weapons/shields/engines |
| `balance.shieldBleedThrough` | Fraction of damage that leaks through shields to hull |
| `crew.orderDelays` | Seconds each order takes before execution |
| `enemyAI.default` | Enemy accuracy, reaction, stat multiplier, retreat thresholds |

Later features (campaign, shipyard upgrades, more ship classes, crew XP) have
their data shapes defined in the same file. See `DESIGN.md`.

## Project files

```
index.html      entry point
css/            LCARS interface styles
js/             data, game loop, ships, weapons, crew AI, enemy AI, UI, renderer, effects
assets/         optional sprites / sounds (empty in MVP)
DESIGN.md       full game design and data structures
CHANGELOG.md    version history
CLAUDE.md       rules for AI-assisted development sessions
```
