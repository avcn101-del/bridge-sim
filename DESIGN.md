# DESIGN.md — Bridge Sim

Version: 0.1 (MVP design). Keep this file in sync with the game.

## 1. Concept

You are the captain of a Federation starship. You never fly or aim. You give
orders by clicking buttons. Three AI officers (Helm, Tactical, Engineering)
acknowledge, execute after a short realistic delay, and report in the comms
log. One enemy ship fights back with its own AI. Win by destroying it, lose
when your hull reaches zero.

Decided parameters (from Phase 1):

| Topic | Decision |
|---|---|
| Battle length | 3–5 minutes with reasonable play |
| Difficulty | Enemy slightly weaker; losing is possible if shields/power are ignored |
| Order delay | 0.5–1.5 s depending on order; officer says "Aye, Captain" then reports |
| Speed control | Pause only (orders can be given while paused) |
| Sound | None in MVP; event hooks exist so audio can subscribe later |
| Enemy look | Klingon Bird-of-Prey style silhouette, green/dark palette |
| Camera | Follows the player ship (player ship near screen centre, world scrolls) |
| End screen | Victory/Defeat, stats (damage dealt/taken, time), Restart |

## 2. Gameplay loop

1. **Start screen**: title, short briefing, "Take the bridge" button.
2. **Battle** (real-time, pausable):
   - Enemy approaches. Captain sets alert, power preset, target, firing mode,
     helm pattern.
   - Officers execute with delay; comms log shows acknowledgement and results.
   - Damage hits the shield facing toward the attacker; bleed-through damages
     hull and a random subsystem; subsystem damage reduces performance.
   - Captain reacts: come about to present fresh shields, reinforce shields,
     set repair priority, change power preset.
3. **Result screen**: Victory/Defeat, time, damage dealt/taken, Restart.

Decision pressure comes from: power trade-offs, shield facing management,
target choice (weapons/engines/shields), when to open/close range.

## 3. Screens

- **Start** — full-screen overlay over the tactical display.
- **Battle** — main layout (below).
- **Result** — overlay with stats and Restart.

### Battle layout

```
+-------------+-----------------------------+----------------+
| LEFT        | CENTRE: tactical canvas     | RIGHT          |
| Ship status | top-down 2D, camera on      | Order panel    |
| hull, 4     | player ship, parallax stars | grouped by     |
| shields,    | nebula, ships, phasers,     | officer        |
| subsystems, | torpedoes, shield bubbles   |                |
| power       |                             |                |
+-------------+-----------------------------+----------------+
| BOTTOM: comms log (newest on top) | PAUSE | alert state     |
+----------------------------------------------------------- +
```

### Order buttons

**Helm**
- Attack pattern — orbit the enemy at preferred range; whenever the torpedo
  tubes are loaded (or every 16 s regardless) turn in for a firing pass, then
  break off in the other direction. This is how torpedoes (70° forward arc)
  get their windows.
- Evasive maneuvers — weave, reduces enemy hit chance, less of own fire lands.
- Close range — approach to short range (torpedo accuracy up).
- Open range — pull away to long range (phaser range edge).
- Come about — turn to present strongest shield facing to enemy and hold at
  quarter speed. Helm warns if that facing is aft ("no weapons on target").

**Tactical**
- Target subsystem: Phasers / Torpedoes / Engines / Shields / Sensors /
  Bridge — damage that bleeds through the shields also hits that part.
  Targeting a part costs 15% hit chance (`subsystemEffects.targetAccuracyMult`).
  Clicking the active button again, or clicking the enemy's hull on the
  display, returns to hull targeting at full accuracy.
- Click targeting on the tactical display: hovering the enemy shows its
  hardpoints (rings coloured by health, label with percentage); clicking one
  gives the matching Tactical order. The selected part carries a pulsing
  bracket reticle. Hardpoints are defined per ship class in
  `visual.hardpoints` (ship-local coordinates), so a sprite ship just needs
  its own list.
- Fire phasers — one phaser volley if in range and charged.
- Fire torpedoes — one torpedo spread if loaded and in arc.
- Fire at will (toggle) — auto-fire all weapons as they become ready.
- Hold fire — cancels Fire at will, no shooting.

**Engineering**
- Power preset: Balanced / Weapons / Shields / Engines.
- Repair priority: Weapons / Engines / Shields / None (auto = most damaged).
- Reinforce weakest shield — moves shield strength from the strongest facing
  to the weakest over a few seconds.

**Ship-wide**
- Red alert — shields up, weapons armed, UI turns red; small reaction bonus.
- Yellow alert — shields up, weapons armed, no bonus.
- Hail enemy — flavour only: the enemy replies with a taunt in the log.

## 4. Mechanics

### Time
- Fixed simulation step 1/60 s, accumulator loop, rendering interpolated.
- Pause stops simulation; UI and order queue still accept clicks (orders
  queue and start executing when unpaused, acknowledgements log immediately).

### Ships
- `hull` (0..max). At 0: destroyed. No shield-style regen, but once every
  subsystem is back at 100 damage control patches hull slowly
  (`balance.hullRepairRate`), for both sides.
- `shields` with four facings `fore`, `aft`, `port`, `starboard`, each 0..max.
  Facing hit = the arc (90° each) that faces the attacker, computed from the
  angle of the incoming shot relative to the ship's heading.
- Regeneration per facing per second, scaled by shield power and shield
  subsystem health.
- `subsystems`: six parts, each 0..100 health, listed in `BS.Data.subsystems`
  (order there is the order of buttons and status rows). Multiplier =
  `subsystemFloor` + (1 − floor) × health/100 unless noted.
  - weapons (Phasers): phaser damage and recharge speed
  - torpedoes: torpedo reload speed
  - engines: speed and turn rate
  - shields: shield regeneration
  - sensors: weapon accuracy (floor `sensorsAccuracyFloor`, 0.7)
  - bridge: order delays (player) / reaction delay (enemy), up to
    `bridgeDelayMaxMult` (1.8×) at zero health
  Untargeted hull hits damage a random part with `subsystemHitChance`.
  Repair priority (one button per part, or Auto = most damaged) repairs that
  part at full rate and the others at a quarter rate.
- `power`: fractions for weapons/shields/engines summing to 1 (presets in data).
  - weapons power → recharge speed and damage multiplier
  - shields power → regen rate
  - engines power → speed, turn rate, evasion
- Movement: ships have `pos`, `heading`, `speed`. Helm AI steers toward a
  desired heading and speed; turn rate limited; motion interpolated.

### Weapons
- **Phasers**: fast, hitscan beam, moderate damage (20 per volley split over
  two mounts), 2.6 s cooldown, 270° arc, damage falls off with range beyond
  optimal (260 of 440).
- **Torpedoes**: projectile, 11 s reload, heavy damage (95 each, spread of 2),
  70° forward arc, travel time, homing, can miss if target is evasive.
- Hit resolution: `damage × powerMult × subsystemMult × accuracyRoll`. Damage
  goes to the facing shield first; leftover × bleed factor goes to hull and a
  targeted subsystem (if a target subsystem is set) or random subsystem.

### Crew AI (orders)
- Each officer has a FIFO order queue: one executing plus up to 4 pending.
  Clicking several buttons quickly is safe; the oldest pending order is
  dropped only when the queue overflows.
- Flow: click → immediate `ack` message ("Helm: Aye, Captain.") → delay
  (per order, from data; red alert and crew XP reduce it) → `execute` →
  `report` message ("Tactical: Torpedoes away, Captain.").
- Officers also report spontaneously on events: shield facing below 25%,
  subsystem damaged, enemy retreating, torpedo hit confirmed.

### Enemy AI (state machine)
- `approach`: head toward player at full speed until medium range.
- `attack`: hold medium range, orbit, fire when ready; prefer presenting
  the strongest shield facing when the facing to player < threshold.
- `reposition`: when facing shield < 20%, turn fresh shield toward player.
- `retreat`: when hull < 28%, open range to max, power to shields; returns
  to `attack` once the facing shield is above 60% (after at least 9 s) or
  after 22 s. A Klingon retreats only once per battle, then fights to the end.
- Difficulty profile in data: accuracy, reaction delay, stats multipliers.

### Win / lose
- Enemy hull 0 → Victory. Player hull 0 → Defeat. Result overlay with stats.

## 5. Visual style

- **UI**: LCARS. Rounded end-caps on bars, colour blocks orange `#ff9966`,
  peach `#ffcc99`, purple `#cc99cc`, blue `#9999ff`, dark background
  `#000`. Font "Antonio" (Google Fonts) → "Arial Narrow" → sans-serif.
  Red alert: `body.red-alert` shifts palette to reds, pulsing border glow.
  Yellow alert: amber accents.
- **Space**: three parallax star layers (parallax factors 0.2/0.5/1.0), soft
  nebula drawn with radial gradients, slow drift.
- **Ships**: vector silhouettes on canvas.
  - Federation (player, Constitution-like in MVP): saucer with gradient and
    hull lines, bridge dome, neck, secondary hull, two nacelles with glowing
    blue bussard/warp grilles, blinking running lights.
  - Enemy (Bird-of-Prey style): wings angled down, head/neck, green glow at
    wing-tip disruptors, dark green/grey gradient.
- **Weapons**: phaser beams orange-red with white core, flicker alpha and
  width, impact flash. Torpedoes: bright orange-white orb with additive glow
  and a fading trail of particles.
- **Shields**: translucent ellipse bubble around ship, colour from blue
  (strong) → cyan → yellow → red (weak); on hit, a ripple arc expands from
  the impact point on the correct facing.
- **Damage**: sparks on subsystem hits, persistent smoke/fire particles when
  hull < 50%, big explosion with debris on destruction, screen shake scaled
  by hit size (capped).

## 6. Data structures (`js/data.js`)

Defined now, including fields for later features, so logic never changes
shape when those features arrive.

```js
BS.Data = {
  balance: {
    simStep: 1/60,
    shieldBleedThrough: 0.15,       // fraction of absorbed shield damage that leaks to hull
    hullRepairRate: 0.8,
    subsystemHitChance: 0.5, subsystemDamageFactor: 0.45,
  },
  subsystemFloor: 0.4,
  subsystems: { weapons: { label, short, effect, targetReport, damaged, repaired }, torpedoes: {...}, engines, shields, sensors, bridge },
  subsystemEffects: { sensorsAccuracyFloor: 0.7, bridgeDelayMaxMult: 1.8, targetAccuracyMult: 0.85 },

  shipClasses: {
    constitution: {
      id: "constitution", name: "Constitution class", role: "Cruiser",
      faction: "federation", cost: 0, purchasable: true,
      hull: 1000,
      shields: { max: 380, regen: 7 },           // per facing, per second at balanced power
      speed: 95, turnRate: 65,                   // px/s, deg/s
      subsystems: { weapons: 100, torpedoes: 100, engines: 100, shields: 100, sensors: 100, bridge: 100 },
      weapons: { phasers: "phaser_mk1", torpedoes: "photon_mk1" },
      phaserMounts: [ {x, y} ], torpedoTubes: [ {x, y} ],
      repairRate: 3.5,                           // subsystem hp/s at full damage control
      visual: { kind: "vector", drawer: "federation_constitution",
                sprite: null, scale: 1.0, length: 112, width: 70,
                hardpoints: { weapons: [ {x, y, r} ], torpedoes: [...], engines: [...], shields: [...], sensors: [...], bridge: [...] } },
    },
    // later: miranda, defiant, excelsior, galaxy, sovereign — same shape
    bird_of_prey: { ... faction: "klingon", purchasable: false, ... },
  },

  weapons: {
    phaser_mk1:  { type: "phaser",  damage: 20, cooldown: 2.6, range: 440,
                   optimalRange: 260, arc: 270, accuracy: 0.92 },
    photon_mk1:  { type: "torpedo", damage: 95, reload: 11, speed: 240,
                   range: 640, arc: 70, accuracy: 0.78, spread: 2 },
    disruptor_mk1: { type: "phaser", ... },
  },

  powerPresets: {
    balanced: { weapons: 0.34, shields: 0.33, engines: 0.33 },
    weapons:  { weapons: 0.5,  shields: 0.25, engines: 0.25 },
    shields:  { weapons: 0.25, shields: 0.5,  engines: 0.25 },
    engines:  { weapons: 0.25, shields: 0.25, engines: 0.5  },
  },

  crew: {
    officers: ["helm", "tactical", "engineering"],
    orderDelays: { attackPattern: 1.0, evasive: 0.8, closeRange: 1.0, ... },
    redAlertDelayMult: 0.8,
    reports: { ... templated strings per order and event ... },
  },

  enemyAI: {
    default: { accuracyMult: 0.85, reactionDelay: 1.2, statMult: 0.85,
               retreatHull: 0.28, retreatMinTime: 9, retreatMaxTime: 22,
               repositionShield: 0.22, preferredRange: 240 },
  },

  // ---- Later features: shapes defined now, unused in MVP ----

  upgrades: {   // 3 tiers each; tier 0 = stock
    phasers:      { tiers: [ {cost:0}, {cost:300, damageMult:1.15}, {cost:700, damageMult:1.3, cooldownMult:0.9}, {cost:1500, ...} ] },
    torpedoes:    { tiers: [...] },
    shields:      { tiers: [...] },   // maxMult, regenMult
    warpCore:     { tiers: [...] },   // totalPower (1.0 → 1.15 → 1.3 → 1.5)
    engines:      { tiers: [...] },   // speedMult, turnMult
    hull:         { tiers: [...] },   // hullMult
    damageControl:{ tiers: [...] },   // repairMult
  },

  crewXP: {
    levels: [ { xp: 0, delayMult: 1.0, accuracyBonus: 0, repairMult: 1.0 },
              { xp: 100, delayMult: 0.9, ... }, ... ],
    xpPerBattle: { win: 50, loss: 15, perDamageDealt: 0.02 },
  },

  campaign: {
    credits: { win: 500, loss: 100, damageTakenPenaltyPerPct: 3 },
    missions: [ { id, name, enemyClass, difficulty, briefing } ],
  },

  science: { scanDuration: 4, weaknessBonus: 1.25, cloakDetectRange: 200 },
};
```

### Runtime ship object (created by `BS.Ships.create(classId, options)`)

```js
{
  id, classId, faction, name,
  pos: {x,y}, prevPos: {x,y}, heading, prevHeading, speed,
  hull, hullMax,
  shields: { fore, aft, port, starboard }, shieldMax,
  subsystems: { weapons, torpedoes, engines, shields, sensors, bridge },   // 0..100
  power: { weapons, shields, engines },
  phaserCooldown, torpedoReload,
  flags: { alert: "none"|"yellow"|"red", fireAtWill, evasive, destroyed },
  target: shipId|null, targetSubsystem: null | one of BS.Data.subsystems keys (null = hull),
  helm: { mode: "attack"|"evasive"|"close"|"open"|"comeAbout"|"idle", desiredHeading, desiredSpeed },
  repairPriority: null | subsystem key (null = auto, most damaged first),
  visual: { kind, drawer, sprite, scale, length },
  stats: { damageDealt, damageTaken },
  mods: { damageMult, shieldMult, ... }   // from upgrades + crew XP, applied at creation
}
```

### Save file (localStorage key `bridgesim.save`, also Export/Import JSON)

```js
{
  version: 1,
  credits: 0,
  shipClass: "constitution",
  ownedShips: ["constitution"],
  upgrades: { phasers:0, torpedoes:0, shields:0, warpCore:0, engines:0, hull:0, damageControl:0 },
  crew: { helm: {xp:0}, tactical: {xp:0}, engineering: {xp:0}, science: {xp:0} },
  campaign: { missionIndex: 0, battlesWon: 0, battlesLost: 0 },
  settings: { sound: true, screenShake: true },
}
```

## 7. Events (`BS.Events`)

`orderGiven`, `orderAck`, `orderExecuted`, `phaserFired`, `torpedoLaunched`,
`shieldHit`, `hullHit`, `subsystemDamaged`, `shipDestroyed`, `alertChanged`,
`enemyStateChanged`, `log`, `battleEnded`. Audio, effects and UI subscribe;
logic never calls them directly.

## 8. MVP scope (v0.1) — built

- All screens, all order buttons above, one enemy (Bird-of-Prey), one player
  class (Constitution), full visual style, pause, result screen, restart.
- No campaign, no shipyard, no saving, no sound, no science station.

Measured balance (accelerated simulation, 6 runs each, v0.2.0):

| Captain behaviour | Outcome |
|---|---|
| Attentive (red alert, attack pattern, fire at will, weapons power, target phasers, comes about when a facing drops, repairs sensors) | Wins in 3:05–4:10 with 52–67% hull |
| Passive (red alert, attack pattern, fire at will, nothing else) | Wins in 3:40–5:00 with 10–56% hull |
| Stationary (yellow alert, fire at will, no helm orders) | Coin flip, 5–7 min |
| No orders | Loses in 2:40–4:30 |

## 9. Roadmap

| Version | Feature |
|---|---|
| 0.2 | Six targetable subsystems with click targeting on the display (done) |
| 0.2.x | Audio via Web Audio hooks; difficulty selector; polish pass |
| 0.3 | Campaign: credits per battle, mission list, save to localStorage |
| 0.4 | Shipyard: 7 upgrade tracks × 3 tiers |
| 0.5 | Buyable ship classes: Miranda, Constitution, Defiant, Excelsior, Galaxy, Sovereign with distinct silhouettes |
| 0.6 | Crew experience: reaction speed, accuracy, repair speed |
| 0.7 | Science station: scan weaknesses, detect cloaked ships; cloaking enemies |
| 0.8 | Export/Import save file; optional image sprites from `assets/ships/` |
| 1.0 | Multiple enemies per battle, enemy variety, balance pass |
