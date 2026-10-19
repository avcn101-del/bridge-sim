// js/data.js — every tunable number in the game lives here.
// Game logic reads from BS.Data and never hard-codes balance values.
window.BS = window.BS || {};

BS.Data = {
  version: "0.34.0",

  // ------------------------------------------------------------------ units
  // World space is pixels; the interface shows kilometres and km/s.
  units: { pxPerKm: 150 },          // a Constitution (156 px) measures about 1 km: three times its real size, so blocks stay readable at combat ranges

  // ---------------------------------------------------------------- balance
  balance: {
    torpedoSpeedExponent: 0.6,   // torpedo damage vs a target faster than the warhead's explosion velocity: (sig × v_expl / v_target) ^ this
    simStep: 1 / 60,
    maxFrameTime: 0.1,
    maxStepsPerFrame: 32,         // fixed steps a frame may run (speed 4× at 60 fps needs 4)
    speeds: [1, 2, 4],            // battle speed buttons (state.speed)
    shieldBleedThrough: 0.15,     // fraction of absorbed shield damage that still leaks to hull
    subsystemDamageFactor: 0.45,  // hull damage × this = subsystem damage on an untargeted (random) hit
    targetedSubsystemDamageFactor: 0.7, // same for a hit on the subsystem you are targeting
    subsystemHitChance: 0.5,      // chance an untargeted hull hit also damages a random subsystem
    hullSmokeThreshold: 0.5,      // below this hull fraction the ship vents/burns
    hullRepairRate: 0.8,          // hull hp/s patched by damage control once every subsystem is at 100
    cameraLerp: 0.06,
    noAlertShieldRegenMult: 0.5,  // shield regen when weapons are not armed (condition green)
    destroyedEndDelay: 3.6,       // seconds between destruction and result screen (the hull breaks up first)
    reinforceFraction: 0.45,      // fraction of strongest facing moved to weakest
    reinforceDuration: 3.0,       // seconds the transfer takes
    reinforceCooldown: 20,        // seconds before Engineering can do it again
    arenaStartDistanceKm: 38,     // enemy spawn distance from player
    fleetSpacingKm: 1.6,          // a fleet (0.31) spawns line abreast with this much between hull centres, on both sides
    hitRadiusFactor: 0.45,
    // EVE-style capacitor: recharge/s = capMax / rechargeTime × capCurve × (sqrt(f) − f), f = fraction full (peaks at 25%)
    capCurve: 5,
    // lock time = lockBase × (lockRefSignature / target signature) × (lockRefSensor / own sensor strength)
    lockBase: 3.0, lockRefSignature: 300, lockRefSensor: 10,
    // turret hit chance = accuracy × 0.5 ^ ((angular / tracking)² + (max(0, d − optimal) / falloff)²)
    // torpedo damage mult = min(1, sig / explosionRadius, ((sig / explosionRadius) × (explosionVelocity / targetSpeed)) ^ 0.6)
    zoom: { min: 0.1, max: 2.5, step: 0.1, start: 0.8, autoMin: 0.22, autoMinShort: 0.12, shortPx: 500, autoMax: 1.0, fitMargin: 1.25, lerp: 0.05, biasMin: 0.4, biasMax: 3 },   // auto-fit keeps both ships in view (a view under shortPx tall, a phone, may zoom out to autoMinShort); wheel / buttons / pinch scale a bias on top
  },

  // ---------------------------------------------------------- aim penalty
  subsystemEffects: { targetAccuracyMult: 0.85 },   // hit chance multiplier while aiming at a block type
  blockReports: {
    phaser:   { destroyed: "We've lost a phaser emitter, Captain!", aim: "Aiming for their phaser emitters." },
    reactorExploded: "Reactor breach! It took the compartments around it with it!",
    enemyReactorExploded: "Their reactor just went up, Captain! Secondary explosions!",
    torpedo:  { destroyed: "Torpedo tube destroyed!", aim: "Targeting their torpedo tubes." },
    disruptor: { destroyed: "Disruptor cannon gone, Captain!", aim: "Targeting their disruptor cannons." },
    pulse:    { destroyed: "We've lost a pulse phaser!", aim: "Targeting their pulse phasers." },
    shield:   { destroyed: "Shield emitter gone! That facing will be weaker.", aim: "Targeting their shield emitters." },
    reactor:  { destroyed: "Reactor breach! Capacitor capacity is down.", aim: "Targeting their reactors. Starve their power." },
    lance:    { destroyed: "Their cutting beam emitter is gone!", aim: "Targeting their cutting beam emitters." },
    engine:   { destroyed: "Impulse engine destroyed! We're losing speed.", aim: "Targeting their engines." },
    sensor:   { destroyed: "Sensor array hit! Locks will take longer.", aim: "Targeting their sensors." },
    bridge:   { destroyed: "The bridge... ", aim: "Going for their bridge, Captain. Precision shot." },
    quarters: { destroyed: "Crew quarters hit. Casualties reported.", aim: "Targeting their crew decks." },
    armor:    { destroyed: "Armor plating blown off!", aim: "Targeting their armor." },
    structure: { destroyed: "Structural member lost!", aim: "" },
    decoy:    { destroyed: "Decoy launcher destroyed, Captain.", aim: "Targeting their decoy launchers." },
    neut:     { destroyed: "Energy neutraliser gone!", aim: "Targeting their energy neutralisers." },
    cutOff:   "Section torn away, Captain! {n} blocks lost.",
  },

  // ------------------------------------------------------------------ grid
  // Ships are built from blocks on a hull-shaped cell grid (see shipClasses.*.mask).
  grid: {
    cellPx: 6,                    // world pixels per cell
    structureHp: 700,             // fixed structural cells (neck, pylons) — not editable, not counted as hull; beams barely scratch them, torpedoes cut them
    structurePierceCost: 3,       // beams never pass through a structural member
    torpedoStructureMult: 3.0,    // a warhead on a pylon: torpedo damage to structural cells is multiplied (cutting necks is torpedo work)
    shieldBase: 80,               // shield per facing before emitters
    shieldRechargeDelay: 4,       // seconds a facing must go unhit before it regenerates (0 = always); the booster ignores it
    shieldAdd: 70,                // per shield emitter on that facing
    shieldRadius: 5,              // cells: a block is protected only while an alive emitter sits within this radius; hits elsewhere skip the shield
    regenBase: 0.6, regenAdd: 0.4,
    capBase: 80, capAdd: 80, capRechargeTime: 40,
    thrustPerPoint: 12,           // speed multiplier = thrustPoints × this / mass, clamped below
    nacelleThrustMult: 2,         // engine blocks in nacelle cells count double
    speedMultMin: 0.35, speedMultMax: 1.25,
    sensorBase: 8, sensorAdd: 2,
    powerPerReactor: 15,          // power grid per alive reactor, on top of the class powerBase; blocks.*.power is what each system draws
    brownoutMin: 0.4,             // when reactors die and draw exceeds supply, weapons cycle and shields regen at supply/draw (never below this)
    repairBase: 0.6, repairAdd: 0.5,   // hp/s restored to damaged (not destroyed) blocks
    // crew: every system block needs hands (blocks.*.crew); the bridge supplies `bridge`, each crew quarters `perQuarters`.
    // Short of crew, weapons cycle and shields regenerate at supply / need (never below minManning), like a brownout.
    // A system block farther than `radius` cells from the nearest quarters or the bridge is repaired at farRepairMult.
    crew: { bridge: 10, perQuarters: 8, radius: 6, farRepairMult: 0.5, minManning: 0.4 },
    // critical hits: a hit that leaves a system block under `below` of its hp rolls `chance` for a critical effect by type:
    // reactor breaches (explodes), engine tumbles the ship (tumbleTime s, tumbleSpin °/s, no helm), sensor blinds it
    // (lock lost, sensorBlind s), shield emitter bleeds emitterDrain of its facing, a weapon mount jams for weaponJam
    // cycles, crew quarters are lost with their crew, a cloaking device drops the cloak. Aimed fire finds them.
    crits: { below: 0.5, chance: 0.25, tumbleTime: 3, tumbleSpin: 70, sensorBlind: 2, emitterDrain: 0.3, weaponJam: 2 },
    // reactor power range: a system block within powerRadius cells of an alive reactor runs at full power; outside every
    // reactor's range it runs at unpoweredFactor (weapon cycle, shield emitter strength and regen, engine thrust, sensor
    // strength). Losing a reactor browns out its neighbourhood; big hulls need their reactors spread out.
    powerRadius: 15, unpoweredFactor: 0.5,
    // warp core breach: when the last reactor dies the core goes critical; after `time` seconds the ship blows up and
    // deals `damage` (linear falloff to zero at radiusKm) to anything inside the radius. Get clear.
    breach: { time: 8, radiusKm: 2.0, damage: 900 },
    // weak-point analysis (BS.Grid.weakPoints): what the scan panel offers to click and what a cunning enemy aims at
    weakPoints: { neckMinBlocks: 8, maxPoints: 5, cutHpWeight: 60, neckPairs: true },   // neckPairs: also look for two-block necks
    // boarding (BS.Boarding, command `board`, key T): with a lock, inside rangeKm, and the target's shield facing toward us
    // down (under gapStart of its maximum, or not projected: cloak surge), the transporter sends min(partyMax, spare crew) of our crew (supply − need,
    // at least minParty) across in transportTime s. Those hands are gone for the rest of the battle (manning drops).
    // Aboard, the party fights the defenders (bridgeGuard + defenderPerQuarters per alive crew quarters: shoot their crew
    // decks first and there are fewer of them) by Lanchester's square
    // law at `rate` per second each; under `floor` on either side ends it: captured (victory, salvage `captured`) or
    // repelled (the party is lost). The transport aborts, party home, if that facing comes back above gapAbort of its
    // maximum (a booster pulse does it: their counter) or they open the range past rangeKm × abortRangeMult meanwhile.
    boarding: { rangeKm: 3, minParty: 4, partyMax: 12, transportTime: 3, bridgeGuard: 2, defenderPerQuarters: 3, gapStart: 0.02, gapAbort: 0.15, abortRangeMult: 2, rate: 0.08, floor: 0.5 },
    // heat: every shot adds its weapon's heat; capacity grows with hull size, dissipation with hull surface (rim cells)
    heat: { base: 80, perBlock: 2, dissipationBase: 6, dissipationPerRimCell: 0.25, overloadTime: 6, aiFireBelow: 0.85,
            governorHigh: 0.85, governorLow: 0.6 },   // heat governor (H): holds fire above governorHigh until heat falls below governorLow
    hitScatter: 1.0,              // shots land anywhere across the facing: sideways offset up to this × the hull half-extent
    penetration: 2,               // beam penetration points: each block on the path costs its pierceCost (armor 2, structure 3, systems 1); the beam stops at 0
    lineOfFire: true,             // a weapon cannot fire through the ship's own alive blocks (editor shows masked weapons)
    lineOfFireStep: 0.5,          // raycast step in cells
    lineOfFireMuzzle: 1.0,        // the muzzle protrudes this many cells: a rim weapon fires almost anywhere into the open, a buried one not at all
    lineOfFireRangeCells: 3,      // only the hull within this many cells of the weapon can mask it (a bow phaser still fires past the saucer rim)
    torpedoSplash: { centre: 0.5, neighbour: 0.2 }, // torpedoes explode on the entry block and splash into its four neighbours
    aimRadius: 2,                 // cells searched around the entry block for the aimed block type
    aimScatter: 2.0,              // aimed shots wander ±this many cells around the aimed block's line, so a focused volley still has to clear a strip of armor
    deadFraction: 0.3,            // ship is lost when alive block hp falls below this fraction of total
    // random enemy variants: a fraction of the base layout's cells is re-rolled (armor → system, system → armor) and the result re-validated
    variant: { fraction: 0.12, attempts: 12, systemWeights: { phaser: 2, disruptor: 3, pulse: 2, shield: 3, reactor: 2, engine: 2, armor: 6, quarters: 1, sensor: 1, torpedo: 1, jammer: 1, decoy: 1, neut: 1 } },
    maskLegend: { ".": "empty", "#": "fillable", "n": "nacelle (engine ×2)", "p": "structure (fixed)", "r": "role cell (fillable; the only place for role blocks)" },
    layoutLegend: { A: "armor", P: "phaser", D: "disruptor", U: "pulse", T: "torpedo", S: "shield", R: "reactor", E: "engine", N: "sensor", B: "bridge", Q: "quarters", J: "jammer", C: "cloak", Y: "decoy", X: "neut", L: "lance", W: "transfer", H: "repairbeam", K: "beacon" },
  },

  editor: {
    maxSavedBuilds: 3,            // named builds kept per hull in the save
    refund: 0.6,                  // fraction of a block's price refunded when a build removes it
  },

  // ---------------------------------------------------------------- blocks
  blocks: {
    armor:    { letter: "A", name: "Armor plating",   short: "AR", hp: 60, mass: 2, cost: 20,  color: "#a3aabb", glyph: "plate", pierceCost: 2, desc: "Cheap and tough. Stops a beam dead: nothing behind a plate is hit until the plate is gone." },
    phaser:   { letter: "P", name: "Phaser emitter",  short: "PH", hp: 50, mass: 2, cost: 120, power: 5, crew: 2, color: "#ff8a3d", glyph: "lens", desc: "Beam weapon. Fires into the 180° arc facing away from the ship's centre.",
                weapon: { kind: "turret", damage: 28, cycle: 2.6, cap: 2.5, heat: 6, optimalKm: 8, falloffKm: 7, tracking: 0.9, accuracy: 0.95, arc: 180, color: "#ff8a3d", coreColor: "#fff3e0", beamLife: 0.4 } },
    // Beam trade-offs (EVE style): phaser = range and tracking at a middling punch; disruptor cannon = the hardest hit,
    // one extra penetration point (through a plate of armor), short optimal, poor tracking; pulse phaser = a stream of
    // light hits with the best tracking and the shortest reach. All turrets: damage × accuracy × tracking × falloff.
    disruptor: { letter: "D", name: "Disruptor cannon", short: "DC", hp: 50, mass: 2, cost: 130, power: 5, crew: 2, color: "#8cff6a", glyph: "bolt", desc: "Bolt: 32 damage every 2.5 s with an extra penetration point, so it punches through a plate of armor into the block behind. Optimal 5 km, falloff 6 km, tracking 0.75 rad/s: misses fast orbiters. Klingon standard.",
                weapon: { kind: "turret", damage: 32, cycle: 2.5, cap: 2.6, heat: 7, optimalKm: 5, falloffKm: 6, tracking: 0.75, accuracy: 0.95, arc: 160, pierceBonus: 1, bolt: true, color: "#8cff6a", coreColor: "#eaffdd", beamLife: 0.3 } },
    pulse:    { letter: "U", name: "Pulse phaser",     short: "PP", hp: 45, mass: 2, cost: 110, power: 4, crew: 1, color: "#ffd36a", glyph: "burst", desc: "Rapid pulses: 9.5 damage every second with tracking 1.6 rad/s, the gun that still hits a Bird-of-Prey on the afterburner. Optimal 4 km, falloff 3 km: a knife-range weapon.",
                weapon: { kind: "turret", damage: 9.5, cycle: 1.0, cap: 1.0, heat: 2.2, optimalKm: 4, falloffKm: 3, tracking: 1.6, accuracy: 0.95, arc: 180, color: "#ffd36a", coreColor: "#fffbe8", beamLife: 0.18 } },
    torpedo:  { letter: "T", name: "Torpedo tube",    short: "TT", hp: 50, mass: 3, cost: 180, power: 8, crew: 3, color: "#ff4d6d", glyph: "warhead", desc: "Heavy warhead, slow reload. Fires into the 220° arc facing away from the ship's centre: mount tubes where you want to shoot.",
                weapon: { kind: "launcher", damage: 170, cycle: 11, cap: 14, heat: 30, rangeKm: 30, speedKmS: 4, explosionRadius: 280, explosionVelocity: 1.5, turnRate: 160, arc: 220, color: "#ff4d6d", coreColor: "#ffffff" } },
    shield:   { letter: "S", name: "Shield emitter",  short: "SH", hp: 40, mass: 2, cost: 90,  power: 4, crew: 1,  color: "#3f8cff", glyph: "shield", desc: "+70 shield and +0.4/s regen on its facing; covers blocks within 4 cells. Hull outside every bubble takes hits unshielded." },
    reactor:  { letter: "R", name: "Reactor",         short: "RE", hp: 40, mass: 3, cost: 100, crew: 2, color: "#ffd23f", glyph: "core", explosion: { damage: 80, radius: 1 }, desc: "+80 capacitor and +15 power for the grid. Explodes when destroyed: 80 damage to every block around it, and a reactor next to it goes up too. Keep them apart and armored." },
    engine:   { letter: "E", name: "Impulse engine",  short: "EN", hp: 45, mass: 2, cost: 80,  power: 1, crew: 1,  color: "#5fe9ff", glyph: "thrust", desc: "Thrust. Counts double inside nacelles. Speed = thrust / mass." },
    sensor:   { letter: "N", name: "Sensor array",    short: "SE", hp: 35, mass: 1, cost: 110, power: 3, crew: 1, color: "#d26bff", glyph: "dish", desc: "Faster locks and better tracking." },
    bridge:   { letter: "B", name: "Bridge",          short: "BR", hp: 200, mass: 2, cost: 0,   color: "#ffffff", glyph: "star", unique: true, desc: "Exactly one. If it dies, the ship is lost. Blocks cut off from it break away." },
    jammer:   { letter: "J", name: "ECM jammer",      short: "JM", hp: 35, mass: 2, cost: 110, power: 6, crew: 1, color: "#35e08f", glyph: "wave", desc: "Electronic warfare with a 7-cell field. Each 5 s cycle (10 cap) rolls jam strength 3 against the enemy's sensors. On a hit, if every block sits inside a jammer's field their lock drops for 4 s and their torpedoes go blind; otherwise they keep the lock but can only hit the blocks outside the field." },
    cloak:    { letter: "C", name: "Cloaking device", short: "CL", hp: 40, mass: 3, cost: 250, power: 5, crew: 2, color: "#9b8cff", glyph: "eye", desc: "Projects a cloak field 10 cells around it; the ship can cloak only while every block sits inside a field, and losing one collapses the cloak. Cloaked you cannot be locked or seen beyond sensor range, but shields are down (the pools keep, recharging slowly), weapons are cold and the capacitor drains 8/s. Decloaking takes 2 s and shields stay down 5 s more; for 10 s after decloaking your hits deal double and most of it goes straight through their shields." },
    quarters: { letter: "Q", name: "Crew quarters",   short: "CQ", hp: 35, mass: 1, cost: 40,  power: 0,  color: "#c9a97a", glyph: "windows", desc: "Houses 8 crew for the systems (phaser 2, cannon 2, pulse 1, tube 3, reactor 2, shield 1, engine 1, sensor 1, jammer 1, cloak 2, decoy 1, neutraliser 1; the bridge adds 10). Short of crew, weapons and shields slow down. Spare crew (beyond the posts) is who you can send as a boarding party. +0.5 hp/s damage-control repair; blocks more than 6 cells from quarters or the bridge repair at half speed." },
    // electronic warfare, second generation: a decoy lures torpedoes away for a few seconds; an energy neutraliser drains
    // the locked target's capacitor at short range, so its booster, hardener, afterburner and cloak starve
    decoy:    { letter: "Y", name: "Decoy launcher",  short: "DY", hp: 40, mass: 1, cost: 90,  power: 2, crew: 1, color: "#ffc96b", glyph: "flare", desc: "Module (F-key, 20 s cycle, 15 cap): drops a decoy astern that burns for 8 s. Every torpedo within 3 km of it that was hunting you turns on the decoy instead and blows up on it. Fire it when the volley is 2–4 km out: too early and the decoy burns out before they arrive, too late and they are already on you. One decoy per launcher block per cycle." },
    // role blocks (0.34, DESIGN §10): they fit only the hull's role cells (mask `r`), and hulls differ in how many they have.
    // The healer's transfer is a transfer, not creation: it comes out of its own shield pool. Remote repair restores hp to
    // damaged blocks only. The beacon makes the ship the loudest contact so a boss that turns on the loudest turns on it.
    transfer: { letter: "W", name: "Shield transfer emitter", short: "ST", hp: 40, mass: 2, cost: 220, power: 6, crew: 2, color: "#6ad5ff", glyph: "shield", roleOnly: true, desc: "Role cell only. Module (5 s cycle, 24 cap): moves 100 shield per emitter from our strongest facing to the supported ally's weakest facing, within 4 km. Our own shields pay for it; it cannot support ourselves." },
    repairbeam: { letter: "H", name: "Remote repair projector", short: "RR", hp: 40, mass: 2, cost: 200, power: 5, crew: 2, color: "#ffb86a", glyph: "windows", roleOnly: true, desc: "Role cell only. Module (6 s cycle, 18 cap): repairs 45 hp per projector on the supported ally's damaged blocks, within 4 km. Destroyed blocks stay gone." },
    beacon:   { letter: "K", name: "Signature beacon", short: "BC", hp: 40, mass: 1, cost: 160, power: 3, crew: 1, color: "#ff7a7a", glyph: "dish", roleOnly: true, desc: "Role cell only. Module (4 s cycle, 6 cap): while it runs our signature is ×2.5: we are the loudest contact (a boss turns on us), we are locked faster and torpedoes hit us for full damage." },
    // boss weapon (0.33, enemy only): a cutting beam that charges for `charge` seconds (event weaponCharging, the tell)
    // before it fires at the ship it was charging on, and cuts `pierceBonus` blocks deep. Low tracking: an orbit on the
    // afterburner is nearly immune, a ship holding station or closing is not.
    lance:    { letter: "L", name: "Cutting beam",    short: "CB", hp: 90, mass: 4, cost: 600, power: 10, crew: 3, color: "#7dff9e", glyph: "lens", enemyOnly: true, desc: "Boss weapon: charges for 6 s, then a beam that cuts 8 blocks deep into the ship it charged on, every 22 s. Tracking 0.35 rad/s: outrun it on the afterburner, or be the ship built to take it.",
                weapon: { kind: "turret", damage: 600, cycle: 22, cap: 30, heat: 20, optimalKm: 7, falloffKm: 2.5, tracking: 0.35, accuracy: 1, arc: 100, pierceBonus: 8, charge: 6, color: "#9dffb0", coreColor: "#ffffff", beamLife: 0.9 } },
    neut:     { letter: "X", name: "Energy neutraliser", short: "NT", hp: 40, mass: 2, cost: 110, power: 4, crew: 1, color: "#ff6ad5", glyph: "drain", desc: "Module (F-key, 6 s cycle, 20 cap, needs a lock inside 4 km): drains 30 capacitor per neutraliser block from the target each cycle. A ship with no capacitor loses its booster, hardener, afterburner and cloak and fires nothing. It drains your own capacitor too: fit reactors." },
  },

  // ---------------------------------------------------------------- modules
  // Weapon groups come from blocks; the three active systems are built into every ship.
  modules: {
    phaser_group:  { kind: "turretGroup",   block: "phaser",  name: "Phaser emitters", short: "PHA", desc: "All phaser emitters fire at the locked target when their arc allows." },
    lance_group:   { kind: "turretGroup",   block: "lance",   name: "Cutting beams",   short: "CUT", desc: "Boss: every cutting beam charges on the locked target, then fires." },
    disruptor_group: { kind: "turretGroup", block: "disruptor", name: "Disruptor cannons", short: "DIS", desc: "All disruptor cannons fire at the locked target: heavy bolts, short optimal, extra penetration, poor tracking." },
    pulse_group:   { kind: "turretGroup",   block: "pulse",   name: "Pulse phasers",   short: "PUL", desc: "All pulse phasers fire at the locked target: light rapid hits with the best tracking, knife range." },
    torpedo_group: { kind: "launcherGroup", block: "torpedo", name: "Torpedo tubes",   short: "TOR", desc: "All tubes fire forward at the locked target." },
    shield_booster: { kind: "active", name: "Shield booster", short: "SB", cycle: 4, cap: 32, effect: { shieldBoost: 50 }, desc: "Each cycle restores 50 shield to the weakest facing. Expensive on capacitor: pulse it." },
    shield_hardener: { kind: "active", name: "Shield hardener", short: "SH", cycle: 8, cap: 7, effect: { shieldResist: 0.3 }, desc: "While running, shields take 30% less damage." },
    afterburner: { kind: "active", name: "Afterburner", short: "AB", cycle: 8, cap: 16, effect: { speedMult: 1.5 }, desc: "+50% speed while running. Higher angular velocity makes enemy beams miss." },
    jammer: { kind: "active", block: "jammer", name: "ECM jammer", short: "JAM", cycle: 5, cap: 10, effect: { jam: true }, desc: "Every 5 s: jam strength (3 per jammer block) against the enemy's sensor strength. A hit breaks their lock for 4 s and blinds their torpedoes." },
    cloak: { kind: "cloak", block: "cloak", name: "Cloaking device", short: "CLK", cycle: 0, cap: 0, capText: "8 cap/s", desc: "Cloak in 3 s: unlockable and unseen beyond their sensors. Shields down, weapons cold, capacitor drains. Decloak takes 2 s; shields recover 5 s later; 10 s decloak strike: double damage, 60% of it straight through their shields." },
    decoy: { kind: "active", block: "decoy", name: "Decoy", short: "DCY", cycle: 20, cap: 15, effect: { decoy: true }, desc: "Drops one decoy per launcher block astern for 8 s; torpedoes hunting you within 3 km of it turn on the decoy and blow up on it. Time it for when the volley is 2–4 km out." },
    shield_transfer: { kind: "active", block: "transfer", name: "Shield transfer", short: "XFER", cycle: 5, cap: 24, effect: { transfer: true }, desc: "Every 5 s: 100 shield per emitter from our strongest facing to the supported ally's weakest, within 4 km." },
    remote_repair: { kind: "active", block: "repairbeam", name: "Remote repair", short: "RREP", cycle: 6, cap: 18, effect: { repair: true }, desc: "Every 6 s: 45 hp per projector to the supported ally's damaged blocks, within 4 km." },
    beacon: { kind: "active", block: "beacon", name: "Signature beacon", short: "BCN", cycle: 4, cap: 6, effect: { sigMult: 2.5 }, desc: "While running: signature ×2.5. The loudest contact draws the boss." },
    neut: { kind: "active", block: "neut", name: "Energy neutraliser", short: "NEUT", cycle: 6, cap: 20, effect: { neut: true }, desc: "Every 6 s, with a lock inside 4 km: drains 30 capacitor per neutraliser block from the target. Starves their booster, hardener, afterburner and cloak." },
  },
  builtInModules: ["shield_booster", "shield_hardener", "afterburner"],

  // ----------------------------------------------------------- ship classes
  // mask: hull shape (see grid.maskLegend). layout: default build (grid.layoutLegend).
  // Stats are derived from blocks; the class gives the base speed, turn and signature.
  shipClasses: {
    constitution: {
      id: "constitution", name: "USS Constitution", className: "Constitution class",
      role: "Heavy cruiser", faction: "federation", cost: 0, purchasable: true,
      speed: 285, turnRate: 90, signature: 400, lockRangeKm: 45,
      powerBase: 50,              // power grid before reactors (grid.powerPerReactor each)
      mask: [
        "..........................",
        ".nnnnnnnnn.........#......",
        ".nnnnnnnnn......#######...",
        ".....pp........#########..",
        ".....pp.......###########.",
        ".....pp##.....###########.",
        "...##pp#####.#############",
        "..##########ppp#r#########",
        "..##########ppp#r#########",
        "...##pp#####.#############",
        ".....pp##.....###########.",
        ".....pp.......###########.",
        ".....pp........#########..",
        ".nnnnnnnnn......#######...",
        ".nnnnnnnnn.........#......",
        ".........................."
      ],
      layout: [
        "..........................",
        ".EEEEESAAA.........P......",
        ".EEEEEQAAA......PAAQAAP...",
        "...............SAAAAAASA..",
        "..............AAAAASAAAAP.",
        ".......SA.....AAARAAQAAAA.",
        "...AA..AAAAA.AARAAQARAANAT",
        "..AAAAAAAAAA...AAAAAAAAAAA",
        "..AAAAAAAAAA...AAABAAAAAAA",
        "...AA..AAAAA.AARAAQARAANAT",
        ".......SA.....AAARAAQAAAA.",
        "..............AAAAASAAAAP.",
        "...............SAAAAAASA..",
        ".EEEEEQAAA......PAAQAAP...",
        ".EEEEESAAA.........P......",
        ".........................."
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "90,160,255", hullTint: "#c6ccda" },
      presets: {
        shadowhunter: { name: "Shadow hunter", desc: "Three cloaking devices (one in the saucer, two deep in the engineering hull) so the whole hull sits inside the cloak field, six phasers, two tubes. Cloak, close, decloak on their flank and hit the reactors. No jammer: a half-covered ECM field would only steer their fire onto the nacelles.", rows: [
          "..........................",
          ".EEEEESAAA.........P......",
          ".EEEEEQAAA......PAAQAAP...",
          "...............SQAAAQASA..",
          "..............AAAAASAAAAA.",
          ".......SA.....AAARAACAAAA.",
          "...AA..AAAAA.AARAAAARAANAT",
          "..AAACAAAAAA...AAAAAAAAAAA",
          "..AAACAAAAAA...AAABAAAAAAA",
          "...AA..AAAAA.AARAAAARAANAT",
          ".......SA.....AAARAAQAAAA.",
          "..............AAAAASAAAAA.",
          "...............SQAAAQASA..",
          ".EEEEEQAAA......PAAQAAP...",
          ".EEEEESAAA.........P......",
          ".........................."
        ] },
        courier: { name: "Courier", desc: "Twelve more engines in the nacelle roots, the stock phasers and tubes: fast enough to pick the range.", rows: [
          "..........................",
          ".EEEEESEEE.........P......",
          ".EEEEEQEEE......PAAQAAP...",
          "...............SAAAAAASA..",
          "..............AAAAASAAAAP.",
          ".......SA.....AAARAAQAAAA.",
          "...AA..AAAAA.AARAAQARAANAT",
          "..AAAAAAAAAA...AAAAQAAAAAA",
          "..AAAAAAAAAA...AAABAAAAAAA",
          "...AA..AAAAA.AARAAQARAANAT",
          ".......SA.....AAARAAQAAAA.",
          "..............AAAAASAAAAP.",
          "...............SAAAAAASA..",
          ".EEEEEQEEE......PAAQAAP...",
          ".EEEEESEEE.........P......",
          ".........................."
        ] },
        bulwark: { name: "Bulwark", desc: "Sixteen shield emitters and a seventh reactor: the saucer and the engineering hull each sit under a double wall.", rows: [
          "..........................",
          ".EEEEESAAA.........P......",
          ".EEEEEQAAA......PAAQAAP...",
          "...............SAAAAAASA..",
          "..............ASAAASAAASP.",
          ".......SA.....AAARAAQAAAA.",
          "...AA..AASAA.AARAAQARAANAT",
          "..AAAAARAAAA...AAAAAAAAAAA",
          "..AAAAAAAAAA...AAABAAAAAAA",
          "...AA..AASAA.AARAAQARAANAT",
          ".......SA.....AAARAAQAAAA.",
          "..............ASAAASAAASP.",
          "...............SAAAAAASA..",
          ".EEEEEQAAA......PAAQAAP...",
          ".EEEEESAAA.........P......",
          ".........................."
        ] },
        brawler: { name: "Brawler", desc: "Six pulse phasers on the saucer rim and four disruptor cannons on the flanks, three tubes. Orbit close: the pulses track anything, the cannons punch through armor.", rows: [
          "..........................",
          ".EEEEESAAA.........A......",
          ".EEEEEQAAA......AUAUAAA...",
          "...............UQAAAAASA..",
          "..............AAAAASAAAAD.",
          ".......SA.....AAARAAQAAAT.",
          "...AA..AAAAA.AARAAQARAANAA",
          "..AAAAAAAAAA...AAAAAAAAAAA",
          "..AAAAAAAAAA...AAABAAAAAAD",
          "...AA..AAAAA.AARAAQARAANAD",
          ".......SA.....AAARAAQAANT.",
          "..............AAAAASAAAAD.",
          "...............UQAAAAAST..",
          ".EEEEEQAAA......AUAUAAA...",
          ".EEEEESAAA.........A......",
          ".........................."
        ] },
        sniper: { name: "Sniper", desc: "Four torpedo tubes, extra sensors and engines, four phasers. Keep at range.", rows: [
          "..........................",
          ".EEEEEEEEA.........A......",
          ".EEEEEEEEA......SAAQAAA...",
          "...............AAAAAAASA..",
          "..............AAAAASAAAAP.",
          ".......SA.....AAARAAQANAT.",
          "...SA..QAAAA.AARAAQARAAAAT",
          "..AQAAAAAAAA...AAAAAAAAAAP",
          "..AQAAAAAAAA...AAABAAAAAAP",
          "...SA..QAAAA.AARAAQARAAAAT",
          ".......SA.....AAARAAQANAT.",
          "..............AAAAASAAAAP.",
          "...............AAAAAAASA..",
          ".EEEEEEEEA......SAAQAAA...",
          ".EEEEEEEEA.........A......",
          ".........................."
        ] },
      },
    },
    miranda: {
      id: "miranda", name: "USS Reliant", className: "Miranda class",
      role: "Light cruiser", faction: "federation", cost: 800, purchasable: true,
      speed: 300, turnRate: 100, signature: 340, lockRangeKm: 40,
      powerBase: 30,              // power grid before reactors (grid.powerPerReactor each)
      mask: [
        "......................",
        ".nnnnnnnn.....####....",
        ".nnnnnnnn...########..",
        "....pp.....##########.",
        "....####..############",
        "...###################",
        "...#########r#########",
        "...###################",
        "...###################",
        "....####..############",
        "....pp.....##########.",
        ".nnnnnnnn...########..",
        ".nnnnnnnn.....####....",
        "......................"
      ],
      layout: [
        "......................",
        ".EEEEEEAA.....APAA....",
        ".EEEEEEAA...AAQQAASP..",
        "...........AAAAAAAAAA.",
        "....ASAA..RAANASAAAAAP",
        "...AQARARAAAAAAAAAAAAT",
        "...AAAAAAAAAAAAQBAAAAP",
        "...AAAAAAAAAAAAQAAAAAP",
        "...AQARARAAAAAAAAAAAAT",
        "....ASAA..RAANASAAAAAP",
        "...........AAAAAAAAAA.",
        ".EEEEEEAA...AAQQAASP..",
        ".EEEEEEAA.....APAA....",
        "......................"
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "90,160,255", hullTint: "#c6ccda" },
      presets: {
        skirmisher: { name: "Skirmisher", desc: "Eight phasers on the rim, four more engines, no tubes. Orbit at 3 km.", rows: [
          "......................",
          ".EEEEEEAA.....PPAA....",
          ".EEEEEEAA...AAQQAASP..",
          "...........AAAAAAAAAA.",
          "....ASAA..RAANASAAAAAA",
          "...AQARARAAAAAAAAAAAAA",
          "...AAAAAAAAAAAAQBAAAAP",
          "...AAAAAAAAAAAAQAAAAAP",
          "...AQARARAAAAAAAAAAAAA",
          "....ASAA..RAANASAAAAAA",
          "...........AAAAAAAAAA.",
          ".EEEEEEAA...AAQQAASP..",
          ".EEEEEEAA.....PPAA....",
          "......................"
        ] },
      },
    },
    defiant: {
      id: "defiant", name: "USS Defiant", className: "Defiant class",
      role: "Escort", faction: "federation", cost: 2400, purchasable: true,
      speed: 390, turnRate: 140, signature: 220, lockRangeKm: 40,
      powerBase: 30,              // power grid before reactors (grid.powerPerReactor each)
      mask: [
        "..................",
        "..nnnnnn..........",
        ".nnnnnnn###.......",
        ".###############..",
        ".################.",
        "..######r#########",
        "..################",
        ".################.",
        ".###############..",
        ".nnnnnnn###.......",
        "..nnnnnn..........",
        ".................."
      ],
      layout: [
        "..................",
        "..EEEEEE..........",
        ".SQQAAAAAAP.......",
        ".AAAAASRARAAPSAP..",
        ".AAAARAAAAANQAAAT.",
        "..AAAAAAAABAAAAAAP",
        "..AAAAAAAAQAAAAAAP",
        ".AAAARAAAAANQAAAT.",
        ".AAAAASRARAAPSAP..",
        ".SQQAAAAAAP.......",
        "..EEEEEE..........",
        ".................."
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "120,180,255", hullTint: "#9aa3b5" },
      presets: {
        interceptor: { name: "Interceptor", desc: "Every nacelle cell an engine, six forward phasers, no tubes. Orbit at 3 km with the afterburner.", rows: [
          "..................",
          "..EEEEEE..........",
          ".EEEEEEEAAA.......",
          ".SQQAASAAAAAASAP..",
          ".AAAARARAAANQAAAP.",
          "..AAAAAAAABAAAAAAP",
          "..AAAAAAAAQAAAAAAP",
          ".AAAARARAAANQAAAP.",
          ".SQQAASAAAAAASAP..",
          ".EEEEEEEAAA.......",
          "..EEEEEE..........",
          ".................."
        ] },
      },
    },
    excelsior: {
      id: "excelsior", name: "USS Excelsior", className: "Excelsior class",
      role: "Heavy cruiser", faction: "federation", cost: 3200, purchasable: true,
      speed: 285, turnRate: 80, signature: 450, lockRangeKm: 50,
      powerBase: 55,              // power grid before reactors (grid.powerPerReactor each)
      mask: [
        "..............................",
        ".nnnnnnnnnn..........###......",
        ".nnnnnnnnnn........#######....",
        "......pp..........#########...",
        "......pp.........###########..",
        "......pp##.......############.",
        "....##pp####....#############.",
        "...#########ppp###############",
        "...#########ppp####r#r########",
        "...#########ppp####r##########",
        "...#########ppp###############",
        "....##pp####....#############.",
        "......pp##.......############.",
        "......pp.........###########..",
        "......pp..........#########...",
        ".nnnnnnnnnn........#######....",
        ".nnnnnnnnnn..........###......",
        ".............................."
      ],
      layout: [
        "..............................",
        ".EEEEEEAAAA..........APA......",
        ".EEEEEEQAAA........AARAAAA....",
        "..................AAAAAAAAP...",
        ".................SAAAAAAAQSA..",
        "........SA.......AAAAASAAAAAP.",
        "....AA..AAAA....AAAAAAQAAAAAT.",
        "...AARARAAAA...AAAAAAAQAAAAAAT",
        "...AAAAAAAAA...AAAAAAABAANAAAP",
        "...AAAAAAAAA...AAAAAAAQAANAAAP",
        "...AARARAAAA...AAAAAAAQAAAAAAT",
        "....AA..AAAA....AAAAAAQAAAAAT.",
        "........SA.......AAAAASAAAAAP.",
        ".................SAAAAAAAQSA..",
        "..................AAAAAAAAP...",
        ".EEEEEEQAAA........AARAAAA....",
        ".EEEEEEAAAA..........APA......",
        ".............................."
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "90,160,255", hullTint: "#cdd3e0" },
      presets: {
        lifeline: { name: "Lifeline", desc: "Healer: the default Excelsior with two shield transfer emitters and a remote repair projector on its role cells, two torpedo tubes given up for the power. Support an ally within 4 km; the transfer comes out of its own shields.", rows: [
          "..............................",
          ".EEEEEEAAAA..........APA......",
          ".EEEEEEQAAA........AARAAAA....",
          "..................AAAAAAAAP...",
          ".................SAAAAAAAQSA..",
          "........SA.......AAAAASAAAAAP.",
          "....AA..AAAA....AAAAAAQAAAAAA.",
          "...AARARAAAA...AAAAAAAQAAAAAAT",
          "...AAAAAAAAA...AAAAWAHBAANAAAP",
          "...AAAAAAAAA...AAAAWAAQAANAAAP",
          "...AARARAAAA...AAAAAAAQAAAAAAT",
          "....AA..AAAA....AAAAAAQAAAAAA.",
          "........SA.......AAAAASAAAAAP.",
          ".................SAAAAAAAQSA..",
          "..................AAAAAAAAP...",
          ".EEEEEEQAAA........AARAAAA....",
          ".EEEEEEAAAA..........APA......",
          ".............................."
        ] },
        lancer: { name: "Lancer", desc: "Six torpedo tubes in the saucer bow, eight reactors, four phasers. Keep at 10 km.", rows: [
          "..............................",
          ".EEEEEESAAA..........AAA......",
          ".EEEEEEQAAA........AARAAAA....",
          "..................AQAAAAAAP...",
          ".................SAAAAAAAQSA..",
          "........SA.......AAAAASAAAAAT.",
          "....AS..RAAA....TAAAAAQAAAAAT.",
          "...AAARAAARA...TAAAAAAQAAAAAAA",
          "...AAAAAAAAA...AAAAAAABAANAAAP",
          "...AAAAAAAAA...AAAAAAAQAANAAAP",
          "...AAARAAARA...AAAAAAAQAAAAAAA",
          "....AS..RAAA....TAAAAAQAAAAAT.",
          "........SA.......AAAAASAAAAAT.",
          ".................SAAAAAAAQSA..",
          "..................AQAAAAAAP...",
          ".EEEEEEQAAA........AARAAAA....",
          ".EEEEEESAAA..........AAA......",
          ".............................."
        ] },
      },
    },
    galaxy: {
      id: "galaxy", name: "USS Galaxy", className: "Galaxy class",
      role: "Explorer", faction: "federation", cost: 5600, purchasable: true,
      speed: 255, turnRate: 60, signature: 600, lockRangeKm: 55,
      powerBase: 80,              // power grid before reactors (grid.powerPerReactor each)
      mask: [
        "....................................",
        "..nnnnnnnnnn..........########......",
        "..nnnnnnnnnn........############....",
        "......pp...........##############...",
        "......pp..........################..",
        "......pp.........##################.",
        "....########.....##################.",
        "...##########...###################.",
        "...##########ppp####r###############",
        "...##########ppp##r#r#r#############",
        "...##########ppp####r###############",
        "...##########ppp####################",
        "...##########...###################.",
        "....########.....##################.",
        "......pp.........##################.",
        "......pp..........################..",
        "......pp...........##############...",
        "..nnnnnnnnnn........############....",
        "..nnnnnnnnnn..........########......",
        "...................................."
      ],
      layout: [
        "....................................",
        "..EEEEEEEESA..........AAAPAAAA......",
        "..EEEEEEEEAA........AARAAAAAAAAP....",
        "...................AAAAAAAAAAAQAA...",
        "..................AAAAAAAAAAAAAAAA..",
        ".................TSAAAAAASAAAAAASAP.",
        "....SAQSAAAA.....AAAAAAAAAAAAAAAAAA.",
        "...AAAARARAAA...AAAAAAAAAAQANAAAAAP.",
        "...AAAAAAAARA...AAAAAAAAAAQAAAAAAAAP",
        "...AAAAAAAAAA...AAAAAAAAAABQANAAAAAA",
        "...AAAAAAAAAA...AAAAAAAAAAQQANAAAAAA",
        "...AAAAAAAARA...AAAAAAAAAAQAAAAAAAAP",
        "...AAAARARAAA...AAAAAAAAAAQANAAAAAP.",
        "....SAQSAAAA.....AAAAAAAAAAAAAAAAAA.",
        ".................TSAAAAAASAAAAAASAP.",
        "..................AAAAAAAAAAAAAAAA..",
        "...................AAAAAAAAAAAQAA...",
        "..EEEEEEEEAA........AARAAAAAAAAP....",
        "..EEEEEEEESA..........AAAPAAAA......",
        "...................................."
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "90,160,255", hullTint: "#d2d7e3" },
      presets: {
        anchor: { name: "Anchor", desc: "Tank: the default Galaxy with a signature beacon on a role cell. Switched on, it is the loudest thing in the sky, so a boss that turns on the loudest ship turns on it.", rows: [
          "....................................",
          "..EEEEEEEESA..........AAAPAAAA......",
          "..EEEEEEEEAA........AARAAAAAAAAP....",
          "...................AAAAAAAAAAAQAA...",
          "..................AAAAAAAAAAAAAAAA..",
          ".................TSAAAAAASAAAAAASAP.",
          "....SAQSAAAA.....AAAAAAAAAAAAAAAAAA.",
          "...AAAARARAAA...AAAAAAAAAAQANAAAAAP.",
          "...AAAAAAAARA...AAAAKAAAAAQAAAAAAAAP",
          "...AAAAAAAAAA...AAAAAAAAAABQANAAAAAA",
          "...AAAAAAAAAA...AAAAAAAAAAQQANAAAAAA",
          "...AAAAAAAARA...AAAAAAAAAAQAAAAAAAAP",
          "...AAAARARAAA...AAAAAAAAAAQANAAAAAP.",
          "....SAQSAAAA.....AAAAAAAAAAAAAAAAAA.",
          ".................TSAAAAAASAAAAAASAP.",
          "..................AAAAAAAAAAAAAAAA..",
          "...................AAAAAAAAAAAQAA...",
          "..EEEEEEEEAA........AARAAAAAAAAP....",
          "..EEEEEEEESA..........AAAPAAAA......",
          "...................................."
        ] },
        fortress: { name: "Fortress", desc: "Twenty-eight shield emitters, ten reactors spread apart, nine crew quarters. Sits at 6 km and soaks it up.", rows: [
          "....................................",
          "..EEEEEEEESA..........AASPSAAA......",
          "..EEEEEEEEAA........AASRAAAAAASP....",
          "...................AAAAAAAAAAAAAA...",
          "..................AASAAAAAAAAQAASA..",
          ".................TAAAAAAASAAAAAAAAP.",
          "....ASQASAAA.....AAAAAAAAAAAAAAAAAA.",
          "...AARARAAARA...ASAAAAAQAAQANAAAAAP.",
          "...AAAAAAAAAA...AAAAAAAAAAQAAAAAAAAS",
          "...ASAAAARARA...AAAAAAAAAABQANAAAASA",
          "...ASAAAAAAAA...AAAAAAAAAAQQANAAAASA",
          "...AAAAAAAAAA...AAAAAAAAAAQAAAAAAAAS",
          "...AARARAAARA...ASAAAAAQAAQANAAAAAP.",
          "....ASQASAAA.....AAAAAAAAAAAAAAAAAA.",
          ".................TAAAAAAASAAAAAAAAP.",
          "..................AASAAAAAAAAQAASA..",
          "...................AAAAAAAAAAAAAA...",
          "..EEEEEEEEAA........AASRAAAAAASP....",
          "..EEEEEEEESA..........AASPSAAA......",
          "...................................."
        ] },
      },
    },
    sovereign: {
      id: "sovereign", name: "USS Sovereign", className: "Sovereign class",
      role: "Battleship", faction: "federation", cost: 8000, purchasable: true,
      speed: 300, turnRate: 75, signature: 520, lockRangeKm: 60,
      powerBase: 90,              // power grid before reactors (grid.powerPerReactor each)
      mask: [
        "......................................",
        "..nnnnnnnnnnn.........................",
        "..nnnnnnnnnnn.........#####...........",
        "......pp.............#########........",
        "......pp...........#############......",
        "......pp#.........################....",
        "....######.......###################..",
        "...#######pppp.######################.",
        "...##############r#r##################",
        "...##############r####################",
        "...#######pppp.######################.",
        "....######.......###################..",
        "......pp#.........################....",
        "......pp...........#############......",
        "......pp.............#########........",
        "..nnnnnnnnnnn.........#####...........",
        "..nnnnnnnnnnn.........................",
        "......................................"
      ],
      layout: [
        "......................................",
        "..EEEEEEEEAAA.........................",
        "..EEEEEEEEAAA.........PAPAA...........",
        ".....................AQRAAAAAP........",
        "...................AAQAAAAAAAAAA......",
        "........S.........PAAAAAASAAAAAAAP....",
        "....SAQAAR.......TAAAAAAAAAAAAAAQSAA..",
        "...AARAAAA.....ATSAAAAAAAAQAAANAAAAAP.",
        "...AAAAAAAARAAAAAAAAAAAAAABQAAANAAAAAP",
        "...AAAAAAAAAAAAAAAAAAAAAAAQAAAANAAAAAP",
        "...AARAAAA.....ATSAAAAAAAAQAAANAAAAAP.",
        "....SAQAAR.......TAAAAAAAAAAAAAAQSAA..",
        "........S.........PAAAAAASAAAAAAAP....",
        "...................AAQAAAAAAAAAA......",
        ".....................AQRAAAAAP........",
        "..EEEEEEEEAAA.........PAPAA...........",
        "..EEEEEEEEAAA.........................",
        "......................................"
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "100,170,255", hullTint: "#b9c0cf" },
      presets: {
        dreadnought: { name: "Dreadnought", desc: "Sixteen phasers along the rim, four tubes, eight reactors. Orbit at 6 km and never stop firing.", rows: [
          "......................................",
          "..EEEEEEEEAAA.........................",
          "..EEEEEEEEAAA.........APAPA...........",
          ".....................AQRAAAAAP........",
          "...................AAQAAAAAAAAAP......",
          "........S.........TAAAAAASAAAAAAAP....",
          "....SAQAAR.......TAAAAAAAAAAAAAAQSAP..",
          "...ARAAAAA.....ASAAAAAAAAAQAAANAAAAAP.",
          "...AAARAAAARAAAAAAAAAAAAAABQAAANAAAAAP",
          "...AAAAAAAAAAAAAAAAAAAAAAAQAAAANAAAAAP",
          "...ARAAAAA.....ASAAAAAAAAAQAAANAAAAAP.",
          "....SAQAAR.......TAAAAAAAAAAAAAAQSAP..",
          "........S.........TAAAAAASAAAAAAAP....",
          "...................AAQAAAAAAAAAP......",
          ".....................AQRAAAAAP........",
          "..EEEEEEEEAAA.........APAPA...........",
          "..EEEEEEEEAAA.........................",
          "......................................"
        ] },
      },
    },
    bird_of_prey: {
      id: "bird_of_prey", name: "IKS Rotarran", className: "B'rel class Bird-of-Prey",
      role: "Raider", faction: "klingon", cost: 0, purchasable: false,
      speed: 315, turnRate: 110, signature: 250, lockRangeKm: 40,
      powerBase: 35,              // power grid before reactors (grid.powerPerReactor each)
      mask: [
        "nnn.....................",
        "nnn#....................",
        "..###...................",
        "...###..................",
        "....###.................",
        ".....###................",
        "......###...............",
        ".......###..............",
        ".....######.......###...",
        "....########....#######.",
        "...#####################",
        "...#####################",
        "....########....#######.",
        ".....######.......###...",
        ".......###..............",
        "......###...............",
        ".....###................",
        "....###.................",
        "...###..................",
        "..###...................",
        "nnn#....................",
        "nnn....................."
      ],
      layout: [
        "EEE.....................",
        "EEED....................",
        "..SQD...................",
        "...AAA..................",
        "....AAA.................",
        ".....AAA................",
        "......SAA...............",
        ".......AAA..............",
        ".....AAAARA.......AAD...",
        "....ARAAQAAD....AAQAAAA.",
        "...AAAAAAAAAAAAAAASAANAA",
        "...AAAAABAAAAAAAAASAAAAT",
        "....ARAAQAAD....AAQAAAA.",
        ".....AAAARA.......AAD...",
        ".......AAA..............",
        "......SAA...............",
        ".....AAA................",
        "....AAA.................",
        "...AAA..................",
        "..SQD...................",
        "EEED....................",
        "EEE....................."
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "110,255,120", hullTint: "#5d7a5c" },
      variants: {
        shadow: { name: "Shadow", desc: "Five cloaking devices spread over the hull so the field covers it all, six disruptors. It stalks you cloaked and decloaks at knife range.", rows: [
          "EEE.....................",
          "EEED....................",
          "..SCD...................",
          "...AQA..................",
          "....AQA.................",
          ".....AAA................",
          "......SAA...............",
          ".......AAA..............",
          ".....AAARAA.......CAA...",
          "....ARAACAAD....AAQAAAA.",
          "...AAAAAAAAAAARAAASAANAA",
          "...AAAAABAAAAAAAAASAAAAT",
          "....ARAAQAAD....AAQAAAA.",
          ".....AAARAA.......CAA...",
          ".......AAA..............",
          "......SAA...............",
          ".....AAA................",
          "....AQA.................",
          "...AQA..................",
          "..SCD...................",
          "EEED....................",
          "EEE....................."
        ] },
        jammer: { name: "Jammer boat", desc: "Two ECM jammers in the hull, six disruptors. Its field covers only the core, so a jam pushes your fire onto the wings and nacelles instead of breaking the lock.", rows: [
          "EEE.....................",
          "EEED....................",
          "..SQD...................",
          "...AAA..................",
          "....AAA.................",
          ".....AAA................",
          "......SAA...............",
          ".......AAA..............",
          ".....AAAARA.......AAA...",
          "....ARAAQAAD....AAQAAAA.",
          "...AAAAJJAAAAAAAAASAANAA",
          "...AAAAABAAAAAAAAASAAAAT",
          "....ARAAQAAD....AAQAAAA.",
          ".....AAAARA.......AAA...",
          ".......AAA..............",
          "......SAA...............",
          ".....AAA................",
          "....AAA.................",
          "...AAA..................",
          "..SQD...................",
          "EEED....................",
          "EEE....................."
        ] },
        leech: { name: "Leech", desc: "Two energy neutralisers in the hull, six disruptors. It brawls inside 4 km and drains your capacitor every six seconds until your booster, hardener and afterburner starve.", rows: [
          "EEE.....................",
          "EEED....................",
          "..SQD...................",
          "...AAA..................",
          "....AAA.................",
          ".....AAA................",
          "......SAA...............",
          ".......AAA..............",
          ".....AAAARA.......AAA...",
          "....ARAAQAAD....AAQAAAA.",
          "...AAAAXXAAAAAAAAASAANAA",
          "...AAAAABAAAAAAAAASAAAAT",
          "....ARAAQAAD....AAQAAAA.",
          ".....AAAARA.......AAA...",
          ".......AAA..............",
          "......SAA...............",
          ".....AAA................",
          "....AAA.................",
          "...AAA..................",
          "..SQD...................",
          "EEED....................",
          "EEE....................."
        ] },
        gunboat: { name: "Gunboat", desc: "Eleven disruptor cannons along the wings, no torpedo, thinner armor.", rows: [
          "EEE.....................",
          "EEED....................",
          "..AQD...................",
          "...AAA..................",
          "....AAA.................",
          ".....AAA................",
          "......SAA...............",
          ".......AAD..............",
          ".....AAAARA.......AAD...",
          "....ARAAQAAD....AAQAAAA.",
          "...AAAAAAAAAAAAAAASAANAD",
          "...AAAAABAAAAAAAAASAAAAD",
          "....ARAAQAAD....AAQAAAA.",
          ".....AAAARA.......AAA...",
          ".......AAD..............",
          "......SAA...............",
          ".....AAA................",
          "....AAA.................",
          "...AAA..................",
          "..AQD...................",
          "EEED....................",
          "EEE....................."
        ] },
        interceptor: { name: "Interceptor", desc: "Thirty engines down the wings, six pulse phasers: a tight afterburner orbit nothing can track.", rows: [
          "EEE.....................",
          "EEEU....................",
          "..SQU...................",
          "...EEE..................",
          "....EEE.................",
          ".....EEE................",
          "......SAA...............",
          ".......AAA..............",
          ".....AAAARA.......AAA...",
          "....ARAAQAAU....AAQAAAA.",
          "...AQAAAAAAAQAAAAASAANAA",
          "...AQAAABAAAARAAAASAAAAT",
          "....ARAAQAAU....AAQAAAA.",
          ".....AAAARA.......AAA...",
          ".......AAA..............",
          "......SAA...............",
          ".....EEE................",
          "....EEE.................",
          "...EEE..................",
          "..SQU...................",
          "EEEU....................",
          "EEE....................."
        ] },
        bulwark: { name: "Bulwark", desc: "Twelve shield emitters and five reactors behind six disruptors: a wall that holds a broadside.", rows: [
          "EEE.....................",
          "EEED....................",
          "..SQD...................",
          "...AAA..................",
          "....ASA.................",
          ".....AAA................",
          "......SAA...............",
          ".......AAA..............",
          ".....AAAARA.......AAA...",
          "....ARAAQAAD....AAQAAAA.",
          "...AAASAAAAAAASAAASAANAA",
          "...AAASABAAAARASAASAAAAT",
          "....ARAAQAAD....AAQAAAA.",
          ".....AAAARA.......AAA...",
          ".......AAA..............",
          "......SAA...............",
          ".....AAA................",
          "....ASA.................",
          "...AAA..................",
          "..SQD...................",
          "EEED....................",
          "EEE....................."
        ] },
        pulser: { name: "Pulser", desc: "Ten pulse phasers in place of the cannons: light, fast, and they track anything.", rows: [
          "EEE.....................",
          "EEEU....................",
          "..SQU...................",
          "...AAA..................",
          "....AAA.................",
          ".....AAA................",
          "......SAA...............",
          ".......AAA..............",
          ".....AAAARA.......AAU...",
          "....ARAAQAAU....AAQAAAA.",
          "...AAAAAAAAAAAAAAASAANUA",
          "...AAAAABAAAAAAAAASAAUAT",
          "....ARAAQAAU....AAQAAAA.",
          ".....AAAARA.......AAU...",
          ".......AAA..............",
          "......SAA...............",
          ".....AAA................",
          "....AAA.................",
          "...AAA..................",
          "..SQU...................",
          "EEEU....................",
          "EEE....................."
        ] },
        bombard: { name: "Bombard", desc: "Four torpedo tubes on six reactors, two disruptors: it holds station and fires every tube.", rows: [
          "EEE.....................",
          "EEED....................",
          "..SQA...................",
          "...AAA..................",
          "....AAA.................",
          ".....AAA................",
          "......SAA...............",
          ".......ASA..............",
          ".....AAARAR.......AAA...",
          "....ARAAQAAA....AAQAAAT.",
          "...AAAAAAAAAAAAAAASNAAAT",
          "...AAAAABAAAAAAAAASAAAAT",
          "....ARAAQAAA....AAQAAAT.",
          ".....AAARAR.......AAA...",
          ".......ASA..............",
          "......SAA...............",
          ".....AAA................",
          "....AAA.................",
          "...AAA..................",
          "..SQA...................",
          "EEED....................",
          "EEE....................."
        ] },
        torpedo: { name: "Torpedo boat", desc: "Two forward tubes, six reactors, four disruptors.", rows: [
          "EEE.....................",
          "EEED....................",
          "..SQA...................",
          "...AAA..................",
          "....AAA.................",
          ".....AAA................",
          "......SAA...............",
          ".......ASA..............",
          ".....AAARAR.......AAA...",
          "....ARAAQAAD....AAQAAAA.",
          "...AAAAAAAAAAAAAAASNAAAT",
          "...AAAAABAAAAAAAAASAAAAT",
          "....ARAAQAAD....AAQAAAA.",
          ".....AAARAR.......AAA...",
          ".......ASA..............",
          "......SAA...............",
          ".....AAA................",
          "....AAA.................",
          "...AAA..................",
          "..SQA...................",
          "EEED....................",
          "EEE....................."
        ] },
      },
    },
    // The first boss (0.33, DESIGN §10): a Borg cube. 24×24 cells, cutting beams on all four faces (the aft pair
    // since 0.34, so no face is safe from the beam), cannons on all four, shield emitters on the fore, port and starboard
    // sides only: the aft face is bare hull over the reactor core.
    borg_cube: {
      id: "borg_cube", name: "Borg cube", className: "Borg cube",
      role: "Boss", faction: "borg", cost: 0, purchasable: false,
      speed: 300, turnRate: 24, signature: 1400, lockRangeKm: 60,
      powerBase: 80,
      aiProfile: "boss",
      mask: [
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################",
        "########################"
      ],
      layout: [
        "AAADAAADAAALAAAADAAADAAA",
        "AANASAAAASAAAASAAAASAAAA",
        "AAAAAAAAAAAAAAAAAAAAAANA",
        "DAAAAAAAAAAAAAAAAAAAAAAD",
        "AAAAAAAAAAAAAAAAAAAAAASA",
        "AAARAAAAAAAAAAAAAAAAAAAA",
        "AAAAAAAAAAAAAARAAAAAAAAA",
        "DAAAAARAAAAAAAAAAAAAAAAD",
        "AAAAAAAAAQAAEQAAAQAAAAAA",
        "AAARAAAAARAQAAAAAAAAAASA",
        "AAAAAEAEAAQAQAQAEAAAAAAA",
        "LAAAEAAAEQABAQAAAAAQAAAL",
        "LAAAEARAEAQAQAAAAAAQAAAL",
        "AAAAAEAEAAAQAAQAEAAAAAAA",
        "AAARAAAAARQAQAAAAAAAAASA",
        "AAAAAAAAAQAAEQAAAQAAAAAA",
        "DAAAAARAAAAAAAAAAAAAAAAD",
        "AAAAAAAAAAAAAARAAAAAAAAA",
        "AAARAAAAAAAAAAAAAAAAAAAA",
        "AAAAAAAAAAAAAAAAAAAAAASA",
        "DAAAAAAAAAAAAAAAAAAAAAAD",
        "AAAAAAAAAAAAAAAAAAAAAANA",
        "AANASAAAASAAAASAAAASAAAA",
        "AAADAAADAAALAAAADAAADAAA"
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "120,255,150", hullTint: "#3d4a40" },
    },
    ktinga: {
      id: "ktinga", name: "IKS Amar", className: "K't'inga class battlecruiser",
      role: "Battlecruiser", faction: "klingon", cost: 0, purchasable: false,
      speed: 255, turnRate: 70, signature: 480, lockRangeKm: 45,
      powerBase: 50,              // power grid before reactors (grid.powerPerReactor each)
      aiProfile: "ktinga",
      mask: [
        "nnnn............................",
        "nnnn#...........................",
        "..####..........................",
        "...####.........................",
        "....#####.......................",
        ".....######................####.",
        "......########..........######..",
        ".......#########.......########.",
        "........########pppppp##########",
        "........########################",
        "........########################",
        "........########pppppp##########",
        ".......#########.......########.",
        "......########..........######..",
        ".....######................####.",
        "....#####.......................",
        "...####.........................",
        "..####..........................",
        "nnnn#...........................",
        "nnnn............................"
      ],
      layout: [
        "EEEE............................",
        "EEEED...........................",
        "..SQAA..........................",
        "...AAQD.........................",
        "....AAAAA.......................",
        ".....AAAASD................AAAA.",
        "......AAAAAAAA..........AAARAA..",
        ".......AAAAQAAAA.......AAAAAAAA.",
        "........DARAAARA......AAAASNAAAD",
        "........EEAAAAAASAAAAAAAAAQBAAAT",
        "........EEAAAAAASAAAAAAAAAAQAAAT",
        "........DARAAARA......AAAASNAAAD",
        ".......AAAAQAAAA.......AAAAAAAA.",
        "......AAAAAAAA..........AAARAA..",
        ".....AAAASD................AAAA.",
        "....AAAAA.......................",
        "...AAQD.........................",
        "..SQAA..........................",
        "EEEED...........................",
        "EEEE............................"
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "255,120,90", hullTint: "#7a6660" },
      variants: {
        siege: { name: "Siege", desc: "Four forward tubes, eight reactors, four disruptors plus two covering the stern, two decoy launchers: it holds station at torpedo range and decoys your volleys.", rows: [
          "EEEE............................",
          "EEEED...........................",
          "..SQAA..........................",
          "...AAAA.........................",
          "....AQAAA.......................",
          ".....AAAASD................AAAA.",
          "......AAAAAAAA..........AAARAA..",
          ".......AAYAAQRAA.......AAAAAAAA.",
          "........DRAAAAAR......AAAASNAAAT",
          "........EEAAAAAASAAAAAAAAAQBAAAT",
          "........EEAAAAAASAAAAAAAAAAQAAAT",
          "........DRAAAAAR......AAAASNAAAT",
          ".......AAYAAQRAA.......AAAAAAAA.",
          "......AAAAAAAA..........AAARAA..",
          ".....AAAASD................AAAA.",
          "....AQAAA.......................",
          "...AAAA.........................",
          "..SQAA..........................",
          "EEEED...........................",
          "EEEE............................"
        ] },
      },
    },
  },

  // ------------------------------------------------------------------- crew
  // Officers no longer gate orders; they report, warn and add flavour.
  crew: {
    officers: {
      helm:        { name: "Lt. Sulu",   title: "Helm",        color: "var(--c-blue)" },
      tactical:    { name: "Lt. Worf",   title: "Tactical",    color: "var(--c-orange)" },
      engineering: { name: "Cdr. Scott", title: "Engineering", color: "var(--c-purple)" },
      comms:       { name: "Lt. Uhura",  title: "Comms",       color: "var(--c-peach)" },
      security:    { name: "Lt. Cdr. Giotto", title: "Security", color: "var(--c-red)" },
    },
    reports: {
      stance_engage: "Engaging, Captain. Closing to phaser range; I'll keep our guns on them.",
      stance_skirmish: "Skirmishing, aye. Tight orbit, full burn; they will not track us.",
      stance_standoff: "Standing off at torpedo range, Captain. We'll kite if they close.",
      stance_disengage: "Breaking off! Opening the range at full burn.",
      stanceNoTarget: "No target to fly against, Captain.",
      side_auto: "Back to a free orbit, Captain. I'll pick the side.",
      side_blind: "Shadowing their blind sector, Captain. Staying where their guns can't reach.",
      side_port: "Holding on their port side, Captain.",
      side_starboard: "Holding on their starboard side, Captain.",
      side_aft: "Sitting on their tail, Captain. Watch for them coming about.",
      sideNoTarget: "No target to shadow, Captain.",
      crit_reactor: "Critical hit on a reactor, it's breaching!",
      crit_engine: "Engine took a critical hit. We're tumbling, helm has no control!",
      crit_sensor: "Sensors knocked out! Lock lost, re-acquiring.",
      crit_shield: "Emitter feedback! The {facing} shield is bleeding off!",
      crit_weapon: "Weapon mount jammed by that hit, Captain.",
      crit_quarters: "Direct hit on the crew decks. Heavy casualties.",
      crit_cloak: "Cloak generator hit! Cloak is down!",
      breachOwn: "Warp core breach! Containment failing, {t} seconds! Get us clear or we go with it!",
      breachOwnTick: "Core breach in {t}!",
      debrisHit: "Debris impact on the {facing} side!",
      enemyCrit_reactor: "Critical hit! Their reactor is breaching!",
      enemyCrit_engine: "Their engines just blew. They're tumbling, Captain!",
      enemyCrit_sensor: "We knocked out their sensors. They've lost their lock on us!",
      enemyCrit_shield: "Their emitter is feeding back, that shield is draining!",
      enemyCrit_weapon: "Jammed one of their mounts, Captain.",
      enemyCrit_quarters: "Their crew decks are venting. They'll be short-handed.",
      enemyCrit_cloak: "We hit their cloak generator!",
      playRequires: "We can't run that play without a {module}, Captain.",
      playStopped: "Play cancelled. Helm, your orders?",
      autoFlip: "Coming about, bringing the other battery to bear.",
      autoFlipShield: "Reversing our orbit, showing them a fresh shield.",
      helm_run_in: "Coming around for another pass.",
      helm_break_off: "Breaking off, opening the range.",
      helm_kite: "They're closing. Kiting, keeping the range open.",
      flyTo: "Coming to new heading. Helm on manual.",
      stop: "All stop. Helm on manual.",
      aimExposed: "Targeting their hull outside the shield cover.",
      aimStructure: "Targeting their structural members, Captain. Torpedoes will do the cutting.",
      hitExposed: "They're hitting bare hull outside our shield cover!",
      lockStart: "Acquiring lock on {name}.",
      lockDone: "Target locked, Captain.",
      lockLost: "Lock lost. Target is out of sensor range.",
      unlock: "Target released.",
      lockNoTarget: "No target selected, Captain.",
      lockOutOfRange: "Target is beyond sensor range. Close to {range} kilometres.",
      lockJammed: "Our targeting is jammed, Captain! No lock until it clears.",
      lockCloaked: "Can't get a lock, Captain. They're cloaked.",
      jammedUs: "They're jamming our targeting! Lock lost.",
      jammedThem: "Their lock just dropped. The jammer is working.",
      jammedUsPartial: "They're jamming us, Captain. We can only get a fix on the {n} blocks outside their ECM field.",
      jammedThemPartial: "Jam is holding, but {n} of our blocks sit outside the field. They'll aim for those.",
      cloakField: "Can't cloak, Captain: {n} blocks are outside the cloak field. Every block needs a cloaking device within range.",
      cloakCollapsed: "Cloak field collapsed! We're visible!",
      cloakOn: "Cloak engaged. Shields down, weapons cold, Captain.",
      cloakOff: "Decloaking. Shields will take a moment to come back.",
      cloakNoCap: "Capacitor too low to hold the cloak. We're decloaking!",
      strikeWindow: "Decloaked on their flank, Captain. Their shields haven't re-tuned, pour it on!",
      targetHull: "Targeting whatever we can hit, Captain. Full accuracy.",
      aimBlock: "Focusing fire on their {name} at {x},{y}, Captain.",
      scanStart: "Science scan running, Captain: {t} seconds, phasers on hold.",
      bridgeCall: "Bridge call, aye: {text}. {left} left.",
      bridgeCallNone: "No bridge calls left, Captain. The script has the conn.",
      scanDone: "Scan complete. We have their layout and their weak points.",
      remodShields: "Remodulating shields to {mod}, Captain: {t} seconds with the deflector down.",
      remodAmmo: "Retuning every weapon to {mod}: {t} seconds cold.",
      remodDone: "Remodulation complete: {what} on {mod}.",
      remodNothing: "Nothing to remodulate, Captain: {why}.",
      enemyRemodDone: "Their {what} are back, retuned to {mod}.",
      enemyScanning: "They're scanning us, Captain. They're reading our layout.",
      lanceOnUs: "Cutting beam charging on us, Captain: {t} seconds. Get us moving!",
      transferOut: "Transferring {amount} shield to the {name}, Captain.",
      transferIn: "The {name} is feeding our {facing} shield: +{amount}.",
      repairIn: "Repair teams from the {name} are on our hull.",
      escort: "Helm answering: keeping station on the {name}.",
      lanceOnAlly: "Cutting beam charging on the {name}: {t} seconds.",
      aimWeak: "Aye. {label}.",
      reinforceShields: "Reinforcing the {weak} shield from the {strong} grid.",
      reinforceShields_none: "Shields are already balanced, Captain.",
      reinforceShields_cooldown: "Shield grid is still rebalancing. Give it a moment.",
      repair: "Damage control teams to the {label}, Captain.",
      repairAuto: "Damage control on automatic priority, Captain.",
      redAlert: "Red alert. Shields up, weapons armed. All hands to battle stations.",
      autoArm: "Going to red alert, Captain. Weapons armed.",
      moduleNoLock: "No target lock, Captain. Weapons are not firing.",
      moduleNoCap: "Capacitor is dry! {module} has shut down.",
      capLow: "Capacitor at {pct} percent, Captain.",
      capEmpty: "Capacitor empty! Everything's going offline.",
      heatHigh: "Weapons are running hot, Captain. Ease off or we overload.",
      governorOn: "Heat governor on: weapons hold fire above 85 percent and resume at 60.",
      governorOff: "Heat governor off. Weapons will fire until we overload, Captain.",
      governorHold: "Governor holding fire: letting the heat bleed off.",
      overload: "Heat overload! Weapons and systems are down until it bleeds off!",
      enemyOverload: "Their ship just overloaded, Captain. Everything they have is offline. Hit them now!",
      hail: "Hailing the Klingon vessel... they're responding, Captain.",
      hail_noResponse: "No response, Captain. They've cut the channel.",
      targetShielded: "Their {facing} shields are absorbing it, Captain. We need to drop that shield to reach their {label}.",
      targetExposed: "Their {facing} shields are down. Hitting their {label} now, Captain!",
      shipDead: "Hull integrity failing. We're breaking up!",
      shipDisabled: "We've lost every weapon and engine, Captain. We're dead in space.",
      enemyDisabled: "They're dead in space, Captain: no weapons, no engines. Salvage teams standing by.",
      decoyLaunched: "Decoy away, Captain.",
      decoyLured: "Their torpedoes are turning onto the decoy!",
      decoyNoTorpedoes: "Decoy away, Captain, but nothing is hunting us right now.",
      enemyDecoy: "They've dropped a decoy, our torpedoes are going for it!",
      neutHit: "Neutraliser hit, Captain: {amount} drained from their capacitor. They're at {pct} percent.",
      neutDry: "Their capacitor is dry, Captain! Their systems are starving.",
      neutOnUs: "They're draining our capacitor, Captain! Energy neutraliser, {amount} gone!",
      neutRange: "Neutraliser can't reach, Captain. We need to be inside {range} kilometres.",
      board_nolock: "No lock, Captain. The transporter needs a target fix.",
      board_range: "Too far for the transporter, Captain. Inside {range} kilometres.",
      board_shields: "Their shields are up on that side, Captain. We can't beam through them.",
      board_crew: "We can't spare a boarding party, Captain: {spare} hands free, we need {min}.",
      board_busy: "The party is already across, Captain.",
      board_transport: "Energising. Security party of {party} beaming across!",
      board_aborted: "Transport aborted, Captain, the window closed. Party is back aboard.",
      board_fight: "We're aboard! {party} of ours against about {defenders} of theirs.",
      board_captured: "Their bridge is ours, Captain! The ship is taken!",
      board_repelled: "We've lost the boarding party, Captain. They held the corridors.",
    },
    events: {
      battleStart: [
        { officer: "tactical", text: "Klingon {className} on sensors, Captain, {range} kilometres and closing. They're powering weapons." },
        { officer: "helm",     text: "Helm answering. Select the target and give me an orbit, Captain." },
      ],
      shieldLow: "{facing} shields down to {pct} percent, Captain!",
      shieldDown: "{facing} shields have collapsed!",
      shieldRestored: "{facing} shields back above fifty percent.",
      hullCritical: "Hull breach on decks seven through nine! We can't take much more.",
      torpedoHit: ["Direct hit, Captain!", "Torpedo hit on their {facing} shields.", "That one got through, Captain!"],
      torpedoHitShieldsDown: "Direct hit, Captain! Their {facing} shields are down!",
      enemyRetreat: "The Klingon is breaking off, Captain. They're running!",
      enemyReturn: "Enemy vessel coming about. They're re-engaging.",
      enemyPass: "They're coming around for another pass, Captain!",
      enemyFirstPass: "Here they come! Firing pass, close range!",
      enemyBreakOff: "They're breaking off after that pass.",
      enemyStandoff: "They're pulling back to torpedo range. We'll have to close on them.",
      enemyKite: "They're running from us, keeping their distance.",
      enemyBroadside: "The cruiser is turning to bring its broadside to bear.",
      enemyRoll: "They're rolling a fresh shield toward us.",
      enemyFlip: "They've reversed their orbit, Captain.",
      enemyCloaked: "They've cloaked, Captain. Sensors show nothing inside ten kilometres... stay sharp.",
      enemyDecloak: "Decloaking off the {facing} bow! Here they come!",
      enemyStrike: "They've caught our shields cold, Captain, that's going straight through!",
      enemyFocus: "They're going for {label}, Captain!",
      enemyDestroyed: "Enemy vessel destroyed, Captain.",
      enemyBreach: "Their warp core is going critical, Captain! Get us clear, {t} seconds!",
      enemyBreachBlast: "Their core just went up!",
      blastHit: "Shockwave hit, Captain! {dmg} through the hull.",
      enemyLocking: "They're locking us, Captain.",
      enemyFiringTorpedo: "Incoming torpedo!",
      enemyAfterburner: "The Klingon is going to full burn.",
    },
    hailReplies: [
      "\"Federation ship! Today is a good day to die... for you.\"",
      "\"Your crew will make fine trophies, Captain.\"",
      "\"Surrender, and I may let your officers keep their honor.\"",
      "\"Qapla'! Prepare to be boarded!\"",
    ],
  },

  // ------------------------------------------------------------------- helm
  // The captain picks a stance; the helm flies it with the doctrine machine the enemy uses (enemyAI.doctrines),
  // with ranges taken from the fitted weapons. ranges.X = [ref, fraction, ref, fraction, ..., fallbackKm]: the first
  // ref with an alive weapon wins (ref "phaser" = phaser optimal range, "torpedo" = torpedo range).
  helm: {
    defaultStance: "engage", reactionDelay: 0.5, repositionDuration: 5,   // repositionDuration: how long a player "come about" (script action roll) holds before the doctrine resumes
    stances: {
      engage:    { label: "Engage",    key: "1", doctrine: "brawl",    desc: "Close orbit inside phaser optimal; the helm flips sides to keep guns and shields fresh.",
                   ranges: { engageKm: ["phaser", 1.0, 8], orbitKm: ["phaser", 0.5, 4] } },
      skirmish:  { label: "Skirmish",  key: "2", doctrine: "skirmish", desc: "Tight orbit on the afterburner: too fast to track, but the burn eats capacitor.",
                   ranges: { engageKm: ["phaser", 1.0, 8], orbitKm: ["phaser", 0.35, 2.8] } },
      standoff:  { label: "Standoff",  key: "3", doctrine: "standoff", desc: "Hold at torpedo range and kite when they close.",
                   ranges: { engageKm: ["torpedo", 0.55, "phaser", 1.1, 15], holdKm: ["torpedo", 0.5, "phaser", 1.0, 14], kiteBelowKm: ["torpedo", 0.32, "phaser", 0.65, 9], kiteToKm: ["torpedo", 0.6, "phaser", 1.25, 17] } },
      disengage: { label: "Disengage", key: "4", doctrine: "evade",    desc: "Open the range at full burn; shields and heat recover. No return until you say so.",
                   ranges: { holdKm: ["torpedo", 0.8, "phaser", 3.0, 24] } },
    },
    // auto-flip (player and enemy): an orbiting ship reverses when the mirrored geometry would bring more weapons to
    // bear, or its engaged shield facing is below flipShieldLow while the opposite one is above flipShieldHigh
    flipMinInterval: 8, flipShieldLow: 0.3, flipShieldHigh: 0.6,
    // keep-at-range geometry (player and enemy): fire that bears is sampled every bearingStep degrees (damage per second of
    // the alive weapons in active groups, line of fire included). Inside the band (keepBand × range) the helm holds the
    // target on the bearing with the most fire at a speed that falls from holdSpeed at the top of the band to a stop at
    // the bottom, and holds station (stopped, guns on them) down to keepRunBelow × range; closer than that it opens the
    // range on the bearing beyond kiteMinBearing with the most fire, tail-on when less than keepFireFraction of the best
    // fire bears back there; beyond the band it closes
    bearingStep: 10, keepBand: [0.92, 1.08], keepRunBelow: 0.75, holdSpeed: 0.35, keepFireFraction: 0.5, kiteMinBearing: 120,
    // attack side (player, Engage / Skirmish): instead of circling, the helm shadows the target at a bearing measured from
    // the target's own heading (sides[].bearing, degrees, positive = their starboard). "blind" picks the bearing where the
    // least of their fire bears (their bearingProfile), and only moves when another sector has under blindHysteresis of
    // the current one's fire. shadow.stationKm: how close to the station point counts as on station.
    sides: {
      auto:      { label: "Auto",  desc: "Orbit and let the helm flip sides for guns and shields." },
      blind:     { label: "Blind", desc: "Shadow the sector where the fewest of their weapons bear; re-checked as they lose guns." },
      port:      { label: "Port",  bearing: -90, desc: "Stay on their port side." },
      starboard: { label: "Stbd",  bearing: 90,  desc: "Stay on their starboard side." },
      aft:       { label: "Aft",   bearing: 180, desc: "Sit on their tail: most hulls carry little aft fire, but it is where their engines are." },
    },
    shadow: { stationKm: 0.5, blindHysteresis: 0.7 },
    // Plays: scripted sequences of phases (js/plays.js). A phase sets a stance or a doctrine, a module policy
    // (module id or "weapons" → on/off), governor, aim and repair priority, and moves on when any condition in
    // `until` holds or every condition in `untilAll` holds (dKmBelow/Above, heatAbove/Below, facingBelow/Above,
    // weakestBelow/Above (weakest facing), capBelow/Above, time, cloakOff, cloaked, noCloak (field broken), overloaded, noTubes, noPhasers,
    // enemyReactorsGone, enemyShieldsDown). A phase never ends before minTime (default playPolicy.minPhaseTime).
    // `next` names the phase to go to (default: the following one, wrapping round). booster "auto" and reinforce
    // true are standing policies (playPolicy). Picking a stance, Stop or fly-to ends the play.
    playPolicy: { boosterBelow: 0.5, boosterMinCap: 0.4, reinforceBelow: 0.3, minPhaseTime: 3 },
    plays: {
      alpha:   { label: "Alpha strike", key: "5", desc: "Close with weapons cold, then fire everything with the governor off; vent when the heat is up and strike again. For builds whose salvo beats the heat cap.",
                 say: "Alpha strike, aye. Closing in, weapons cold until we're on top of them.",
                 phases: [
                   { label: "closing", doctrine: "closein", modules: { weapons: false, shield_hardener: true }, governor: true, until: { dKmBelow: 4.5 } },
                   { label: "strike", stance: "engage", modules: { weapons: true, shield_hardener: true }, governor: false, booster: "auto", reinforce: true, say: "In range. All weapons, fire at will!", minTime: 10, until: { heatAbove: 0.9, overloaded: true } },
                   { label: "venting", stance: "engage", modules: { weapons: false }, governor: true, booster: "auto", reinforce: true, say: "Venting heat. Weapons cold for a moment.", minTime: 4, until: { heatBelow: 0.3 }, next: 1 },
                 ] },
      siege:   { label: "Siege", key: "6", desc: "Hold station at torpedo range with everything that reaches, hardener up; fights at close quarters if they get inside 5 km and goes back to range when they fall off. For torpedo builds against slow or standoff ships.",
                 say: "Siege pattern. Holding at range, tubes have the lead.",
                 phases: [
                   { label: "bombarding", stance: "standoff", modules: { weapons: true, shield_hardener: true }, governor: true, booster: "auto", minTime: 8, until: { noTubes: true, dKmBelow: 5 } },
                   { label: "repelling", stance: "engage", modules: { weapons: true, shield_hardener: true }, say: "They're on us. All weapons!", booster: "auto", minTime: 15, until: { dKmAbove: 9, time: 30 }, next: 0 },
                 ] },
      turtle:  { label: "Turtle", key: "7", desc: "Hold a slow broadside at mid range with the hardener on, reinforce and roll fresh shields; wins by attrition.",
                 say: "Shield wall, aye. Holding the broadside, hardener up.",
                 phases: [
                   { label: "holding", doctrine: "broadside", modules: { weapons: true, shield_hardener: true }, governor: true, booster: "auto", reinforce: true, repair: "shield" },
                 ] },
      hunter:  { label: "Hunter", key: "8", desc: "Engage and aim for the reactors; when they are gone, or after a minute of trying, pick at hull outside their shield cover.",
                 say: "Hunter pattern. Going for their reactors.",
                 phases: [
                   { label: "reactors", stance: "engage", modules: { weapons: true, shield_hardener: true }, governor: true, aim: "reactor", booster: "auto", until: { enemyReactorsGone: true, time: 60 } },
                   { label: "exposed hull", stance: "engage", aim: "exposed", say: "Their reactors are gone. Targeting bare hull.", booster: "auto" },
                 ] },
      ambush:  { label: "Ambush", key: "9", requires: "cloak", desc: "Cloak, close to knife range, decloak and hit their reactors with the governor off while the decloak strike lasts (10 s: double damage, most of it through their shields), then cloak and slip away to do it again. Needs a cloaking device.",
                 say: "Ambush, aye. Cloaking and closing.",
                 phases: [
                   { label: "stalking", doctrine: "closein", modules: { weapons: false, cloak: true, shield_hardener: false }, governor: true, until: { dKmBelow: 3.5, capBelow: 0.15, noCloak: true } },
                   { label: "decloaking", doctrine: "closein", modules: { cloak: false }, say: "Dropping the cloak!", minTime: 0, until: { cloakOff: true } },
                   { label: "strike", stance: "engage", modules: { weapons: true, shield_hardener: true }, governor: false, aim: "reactor", booster: "auto", reinforce: true, minTime: 8, until: { heatAbove: 0.85, weakestBelow: 0.25, time: 12 } },
                   { label: "slipping away", stance: "disengage", modules: { weapons: false, shield_hardener: false, cloak: true }, governor: true, booster: "auto", say: "Cloaking. Breaking off to come round again.", minTime: 8, untilAll: { cloaked: true, weakestAbove: 0.6 }, until: { time: 40, capBelow: 0.2, noCloak: true }, next: 0 },
                 ] },
      hitfade: { label: "Hit & fade", key: "0", desc: "Engage until a shield facing runs low, then fade into a tight afterburner orbit they cannot track while the shields recover, and engage again.",
                 say: "Hit and fade, aye. Engaging until the shields say otherwise.",
                 phases: [
                   { label: "hitting", stance: "engage", modules: { weapons: true, shield_hardener: true }, governor: true, booster: "auto", minTime: 10, until: { weakestBelow: 0.25 } },
                   { label: "fading", stance: "skirmish", modules: { weapons: true, shield_hardener: false }, booster: "auto", reinforce: true, say: "Shields are thin. Going to full burn until they recover.", minTime: 10, untilAll: { weakestAbove: 0.6 }, until: { time: 45 }, next: 0 },
                 ] },
    },
  },

  // --------------------------------------------------------------- enemy AI
  // ------------------------------------------------------------- tuning (0.29)
  // Five modulations, the Trek "shield frequency" made a rule. Every shield emitter has a frequency, every armor plate
  // an alloy, every weapon block an ammo modulation (save.tuning[classId]: rows of digits in the layout's shape, 0 = the
  // faction's default, 1–5 = `list[].digit`). Each modulation beats the next in `order` (a ring, the last beats the
  // first): a hit whose ammo beats the frequency of the emitter covering the struck block drains that shield ×bonus,
  // one the frequency beats ×malus; the same against the alloy of a plate it lands on; system blocks take ×1. Tuning a
  // block off its faction's default costs offFactionCost of its price. EW blocks are outside the ring.
  tuning: {
    bonus: 1.5, malus: 0.5,   // measured (DESIGN §8 v0.29): ×1.35 / ×0.65 left the beaten-ammo side at 2 of 4; ×0.5 makes it a loss
    order: ["graviton", "nadion", "tetryon", "polaron", "antiproton"],
    list: {
      graviton:   { digit: "1", name: "Graviton",   short: "GR", color: "#6ab4ff", how: "Graviton beats Nadion: a graviton lattice scatters nadion particles before they couple to the field." },
      nadion:     { digit: "2", name: "Nadion",     short: "NA", color: "#ff8a5c", how: "Nadion beats Tetryon: rapid nadion emissions collapse a tetryon field's coherence." },
      tetryon:    { digit: "3", name: "Tetryon",    short: "TE", color: "#c9a0ff", how: "Tetryon beats Polaron: tetryon bleed disrupts the polaron bias a field or a bolt is built on." },
      polaron:    { digit: "4", name: "Polaron",    short: "PO", color: "#7fd8a0", how: "Polaron beats Antiproton: a polaron charge cancels an antiproton stream before it annihilates on the target." },
      antiproton: { digit: "5", name: "Antiproton", short: "AP", color: "#ffd166", how: "Antiproton beats Graviton: antiproton annihilation overloads a graviton lattice faster than it can re-form." },
    },
    factionDefault: { federation: "nadion", klingon: "polaron", borg: "antiproton" },
    offFactionCost: 0.15,
    // Remodulating in battle (BS.Ships.remodulate, script action `remodulate`, bridge calls Remodulate shields / ammo):
    // every emitter takes the frequency that beats the other ship's dominant ammo, with the deflector down for
    // shieldsSeconds; or every weapon block takes the ammo that beats their dominant frequency, with the weapons cold for
    // ammoSeconds. The other ship's tuning is read only once scanned (script conditions), so a remodulation is an answer
    // to something seen, never a guess at hidden data.
    remodulate: { shieldsSeconds: 10, ammoSeconds: 5 },
    tunable: { shield: "frequency", armor: "alloy", phaser: "ammo", pulse: "ammo", disruptor: "ammo", torpedo: "ammo" },
    measured: { ring: "equal hulls, ×1.5 / ×0.5: ammo that beats the defence 4 of 4, a beaten defence 1 of 4, beaten ammo 0 of 4, a hybrid hull against ammo beating one half 0 of 4 (DESIGN §8 v0.29)" },
  },

  enemyAI: {
    // How an enemy fights (enemyAI.doctrines[id]); the encounter names one. All in km / seconds.
    doctrines: {
      strafe:    { kind: "strafe", engageKm: 16, passKm: 4.5, runInMaxTime: 14, passOrbitKm: 3, passTime: 12, breakKm: 8, breakMaxTime: 8, turnTime: 2, abMinCap: 0.5, tailChaseAngular: 0.15, tailChaseTime: 99 },
      brawl:     { kind: "brawl", engageKm: 8, orbitKm: 3.5, flipEvery: 20, abMinCap: 0.7, tailChaseAngular: 0.15, tailChaseTime: 4 },
      skirmish:  { kind: "brawl", engageKm: 8, orbitKm: 2.8, flipEvery: 99, abMinCap: 0.3, tailChaseAngular: 0.15, tailChaseTime: 4 },   // player stance: speed tank
      standoff:  { kind: "standoff", engageKm: 15, holdKm: 14, kiteBelowKm: 9, kiteToKm: 17, kiteMaxTime: 15, tailChaseAngular: 0.15, tailChaseTime: 99 },
      broadside: { kind: "broadside", engageKm: 10, bandKm: [4.5, 7], rollEvery: 30, tailChaseAngular: 0.15, tailChaseTime: 99 },   // inside disruptor optimal
      evade:     { kind: "evade", engageKm: 999, holdKm: 24, abMinCap: 0.25, tailChaseAngular: 0.15, tailChaseTime: 99 },
      closein:   { kind: "approach", engageKm: 0, tailChaseAngular: 0.15, tailChaseTime: 99 },   // plays: approach and keep approaching
      ambush:    { kind: "ambush", engageKm: 22, decloakKm: 4.5, recloakKm: 9, passOrbitKm: 3, passTime: 12, breakKm: 10, breakMaxTime: 10, abMinCap: 0.5, tailChaseAngular: 0.15, tailChaseTime: 99 },
      siege:     { kind: "standoff", engageKm: 18, holdKm: 17, kiteBelowKm: 11, kiteToKm: 20, kiteMaxTime: 15, tailChaseAngular: 0.15, tailChaseTime: 99 },
      // reaction doctrines (enemy scripts, 0.25): kite opens the range for a while under an alpha strike; watch holds
      // a few km off a cloaked opponent, afterburner cold, until it shows
      kite:      { kind: "evade", engageKm: 999, holdKm: 9, abMinCap: 0.3, tailChaseAngular: 0.15, tailChaseTime: 99 },
      watch:     { kind: "evade", engageKm: 999, holdKm: 5, abMinCap: 2, tailChaseAngular: 0.15, tailChaseTime: 99 },
    },
    // Overview status text per AI state
    // what a script condition "they are {v}" (enemyStance) reads off the other ship's state and command
    stanceLabels: { orbiting: "orbiting us", holding: "holding station", shadowing: "shadowing us", kiting: "kiting", closing: "closing", rolling: "rolling a fresh side" },
    aimLabels: { hull: "spraying our hull", type: "aiming at one of our system types", weak: "aiming at one of our weak points", structure: "cutting our structure" },
    stateLabels: { approach: "closing", shadow: "shadowing", clear: "clearing the blast", drained: "drained, opening the range", retreat: "retreating", run_in: "strafing run", pass: "firing pass", break_off: "breaking off", turn_in: "coming around", brawl: "attacking", reposition: "turning", standoff: "standing off", kite: "kiting", broadside: "broadside", stalk: "cloaked", uncloak: "decloaking", evade: "disengaging" },
    default: {
      doctrine: "brawl",
      accuracyMult: 0.85, reactionDelay: 1.2, statMult: 1.4, damageMult: 1.5,
      retreatHull: 0.28, retreatMinTime: 9, retreatMaxTime: 22,
      repositionShield: 0.22, repositionDuration: 5,   // a come about (shield roll, or the script's `roll` when shadowed) holds this long
      orbitRangeKm: 6, retreatRangeKm: 22,
      boosterBelow: 0.45, boosterMinCap: 0.35, afterburnerMinCap: 0.25, weakPointChance: 0.25,   // chance each re-roll to aim at your top weak point instead
      drainedBelow: 0.08, drainedUntil: 0.35, drainedTime: 20,   // neutralised under drainedBelow cap: open the range past the neutraliser until drainedUntil cap or drainedTime s
      weakPointKinds: ["frequency", "emitter", "chain", "blackout", "crew"],   // a raider neither cuts necks nor finishes wounded systems: measured, both turned Engage into a coin flip
      targetWeights: { none: 0.3, exposed: 0.1, phaser: 0.15, reactor: 0.15, engine: 0.12, shield: 0.13, bridge: 0.05 },   // none = spray the hull, no −15% aim penalty; exposed = hull outside shield cover
    },
    // The boss (0.33): never retreats, never hunts weak points, sprays; its answers are in its script (script.enemyScripts.borg)
    boss: {
      doctrine: "broadside",
      accuracyMult: 0.8, reactionDelay: 1.5, statMult: 1.8, damageMult: 1.6,
      shieldMult: 4, shieldRegenMult: 2,   // a boss's shield pools and regen on top of what its emitters give (BS.Ships.create mods)
      retreatHull: 0, retreatMinTime: 8, retreatMaxTime: 16,
      repositionShield: 0.15, repositionDuration: 8,
      orbitRangeKm: 6, retreatRangeKm: 20,
      boosterBelow: 0.4, boosterMinCap: 0.3, afterburnerMinCap: 0.3, weakPointChance: 0,
      drainedBelow: 0.08, drainedUntil: 0.35, drainedTime: 20,
      weakPointKinds: [],
      targetWeights: { none: 0.6, exposed: 0.2, shield: 0.2 },
    },
    // overdrive (0.33, script action `overdrive`): a boss's enrage, damage and speed multiplied for the rest of the fight
    overdrive: { damageMult: 1.5, speedMult: 1.25 },
    // K't'inga: slower to react, holds a longer orbit, fights to the end rather than running
    ktinga: {
      doctrine: "broadside",
      accuracyMult: 0.7, reactionDelay: 1.6, statMult: 0.9, damageMult: 1.33,
      retreatHull: 0.2, retreatMinTime: 8, retreatMaxTime: 16,
      repositionShield: 0.2, repositionDuration: 6,   // its scripts roll when shadowed after blindFor 2.5 s, sooner than a raider (its stern carries two cannons since 0.21)
      orbitRangeKm: 7, retreatRangeKm: 18,
      boosterBelow: 0.5, boosterMinCap: 0.3, afterburnerMinCap: 0.35, weakPointChance: 0.6,
      drainedBelow: 0.06, drainedUntil: 0.3, drainedTime: 25,
      weakPointKinds: ["frequency", "emitter", "chain", "blackout", "neck", "crew", "wounded"],   // the cruiser cuts necks
      targetWeights: { none: 0.2, exposed: 0.1, phaser: 0.18, reactor: 0.17, engine: 0.12, shield: 0.13, bridge: 0.1 },
    },
    // The public doctrine table (0.26): who beats whom, measured (DESIGN §8, Constitution templates vs Bird-of-Prey
    // variants at 3 wins, 4 fights each; `measured` is the player's wins). The report's "why you lost" quotes the first
    // row whose winning tag the winner's fight carried and whose losing tag the loser's did (BS.Game.styleTags); the
    // hangar's doctrine page reads it. Tags: brawl, standoff, alpha, shadow, turtle, roll, strafe, hitfade, kite,
    // ambush, cloak, emitter, long, close. Rows the theory expects but the harness did not confirm are not here.
    doctrineTable: [
      { beats: "strafe",   loses: "standoff", measured: "0 of 4", text: "strafing beats standoff: torpedoes lose most of their damage to a fast pass, and each pass arrives on a fresh bearing inside the tubes' arc" },
      { beats: "strafe",   loses: "turtle",   measured: "0 of 4", text: "strafing beats turtle: the broadside rolls its best shield toward a ship that is already on another bearing" },
      { beats: "strafe",   loses: "hitfade",  measured: "1 of 4", text: "strafing beats hit & fade: the fade on the afterburner meets a run-in on the afterburner, and the pass lands on the shield that was fading" },
      { beats: "brawl",    loses: "ambush",   measured: "1 of 4", text: "a close brawl beats ambush: a brawler that sticks inside 3 km is never where the decloak strike was aimed, and its guns are on the cloak generators the moment the field drops" },
      { beats: "brawl",    loses: "cloak",    measured: "1 of 4", text: "a close brawl beats a cloak: the field drops on the first hit, and a brawler is never far enough to lose" },
      { beats: "standoff", loses: "ambush",   measured: "0 of 4, stalemates", text: "standoff beats ambush: a torpedo boat holding 14 km never comes to the knife range the decloak strike needs" },
      { beats: "standoff", loses: "alpha",    measured: "0 of 4, stalemates", text: "standoff beats alpha: the strike has to cross the whole torpedo band before its guns reach, and the boat kites when it does" },
      { beats: "strafe",   loses: "alpha",    measured: "2 of 4", text: "strafing holds its own against alpha: the strike lands on one pass and the next pass comes from behind" },
    ],
    // Signature counters (0.26, campaign.learn): the dominant tag of the player's last wins → the build and bridge the
    // next encounter answers with, per hull (null keeps the encounter's own). Only measured answers (DESIGN §8): the
    // Raider's strafing passes beat standoff, turtle and hit & fade outright; a close brawler beats a cloaked ambusher.
    // Nothing at the Bird-of-Prey weight beats a Brawler or an emitter hunter yet, and the K't'inga rows are unmeasured,
    // so those learn nothing. `reason` is what the hangar says.
    signatureCounters: [
      { tag: "standoff", bop: { layout: "default", doctrine: "strafe", script: "raider" }, ktinga: null, reason: "expect fast passes: torpedoes lose their damage to speed" },
      { tag: "long",     bop: { layout: "default", doctrine: "strafe", script: "raider" }, ktinga: null, reason: "expect fast passes: torpedoes lose their damage to speed" },
      { tag: "turtle",   bop: { layout: "default", doctrine: "strafe", script: "raider" }, ktinga: null, reason: "expect fast passes from a new bearing each time: your best shield is never the right one" },
      { tag: "hitfade",  bop: { layout: "default", doctrine: "strafe", script: "raider" }, ktinga: null, reason: "expect fast passes that follow you into the fade" },
      { tag: "cloak",    bop: { layout: "gunboat", doctrine: "brawl", script: "raider" },  ktinga: null, reason: "expect a brawler that sticks inside 3 km: the strike lands on nothing, and its cannons find the cloak generators" },
      { tag: "ambush",   bop: { layout: "gunboat", doctrine: "brawl", script: "raider" },  ktinga: null, reason: "expect a brawler that sticks inside 3 km: the strike lands on nothing, and its cannons find the cloak generators" },
    ],
    // Counter-doctrine: an encounter flagged `counter` reads your build before the fight (BS.Campaign.encounter) and takes
    // the first rule whose condition your battle layout meets: tubes, pulse / beam counts, a cloak, or a shield facing
    // much weaker than the strongest. `bop` / `ktinga` name the doctrine per hull (null keeps the encounter's own);
    // `weakPointChance` overrides the profile's for that fight; `reason` is what the hangar tells you.
    counters: [
      { when: { tubesMin: 4 },                bop: "strafe",   ktinga: "broadside", reason: "they expect torpedoes and will keep moving" },
      { when: { pulseMin: 4, beamsMax: 2 },   bop: "standoff", ktinga: "siege",     reason: "they will stay out of your pulse range" },
      { when: { neutMin: 2 },                 bop: "standoff", ktinga: "siege",     reason: "they will stay out of your neutraliser range" },
      { when: { cloak: true },                bop: "brawl",    ktinga: "brawl",     reason: "they will stick close so you cannot slip away" },
      { when: { weakFacingBelow: 0.6 },       bop: null,       ktinga: "broadside", weakPointChance: 0.6, reason: "they have seen your weak shield facing and will pick on it" },   // doctrine unchanged for a Bird-of-Prey (a brawling raider made the stock fight a coin flip), but it hunts weak points twice as often
    ],
  },

  // ------------------------------------------------------------- PR B/C data
  // Shapes are defined now so logic never changes when the features arrive.
  // Skills train in real time (EVE style) once PR B lands.
  skills: {
    gunnery:    { name: "Gunnery",    levels: 5, hoursPerLevel: [0.5, 2, 6, 16, 40], perLevel: { turretDamageMult: 0.03 } },
    missiles:   { name: "Torpedoes",  levels: 5, hoursPerLevel: [0.5, 2, 6, 16, 40], perLevel: { launcherDamageMult: 0.03 } },
    navigation: { name: "Navigation", levels: 5, hoursPerLevel: [0.5, 2, 6, 16, 40], perLevel: { speedMult: 0.03 } },
    shields:    { name: "Shield ops", levels: 5, hoursPerLevel: [0.5, 2, 6, 16, 40], perLevel: { shieldRegenMult: 0.04 } },
    capacitor:  { name: "Capacitor",  levels: 5, hoursPerLevel: [0.5, 2, 6, 16, 40], perLevel: { capRechargeMult: 0.04 } },
    targeting:  { name: "Targeting",  levels: 5, hoursPerLevel: [0.5, 2, 6, 16, 40], perLevel: { lockMult: -0.05 } },
  },

  campaign: {
    startingCredits: 600,
    credits: { win: 500, loss: 120, hullLostPenaltyPerPct: 3, winStreakBonus: 50 },   // per battle
    // salvage: credits for the enemy's surviving block value after a win; a ship disabled (no weapons, no engines) is captured intact
    salvage: { destroyed: 0.1, disabled: 0.25, captured: 0.3 },   // captured: taken by a boarding party, nearly intact
    // intel: a layout you held a lock on for intelMinLockSeconds is remembered (save.intel[encounterId]) and drawn in the
    // hangar before the next fight of that kind; intelCost buys it for the next encounter sight unseen
    intelMinLockSeconds: 10, intelCost: 150,
    sellBack: 0.6,                      // fraction of price refunded when selling a module
    // the raider gets tougher with every victory: statMult = base + perWin × wins (capped)
    enemyScaling: { perWin: 0.04, maxBonus: 0.4 },
    fleetMax: 4,                        // hulls a side (0.31): the player's save.fleet and an encounter's ships, flagship included
    // Which enemy shows up: weighted random among the encounters unlocked by battlesWon; "random" layouts are
    // generated from the class default (grid.variant). rewardMult scales the win payout. Seeded by the battle record.
    // `play` names a play (helm.plays) the enemy bridge runs instead of flying its doctrine alone; the doctrine stays
    // as the fallback when the play's required module is missing. `damageMult` overrides the profile's for that encounter.
    encounters: [
    // `script` names the bridge script (script.enemyScripts) the enemy runs on top of its doctrine: the same rule engine,
    // conditions and actions as the player's (BS.Script). The doctrine stays the movement layer the script's rules pick.
      { id: "raider",   enemyClass: "bird_of_prey", layout: "default", doctrine: "strafe",    script: "raider",  minWins: 0, weight: 3, rewardMult: 1.0, counter: true },
      { id: "gunboat",  enemyClass: "bird_of_prey", layout: "gunboat", doctrine: "brawl",     script: "raider",   minWins: 1, weight: 2, rewardMult: 1.1 },
      { id: "torpedo",  enemyClass: "bird_of_prey", layout: "torpedo", doctrine: "standoff",  script: "torpedoBoat", minWins: 1, weight: 2, rewardMult: 1.1, damageMult: 1.0 },   // holds station and fires every tube; with the recharge delay its stream keeps a facing down
      { id: "variant",  enemyClass: "bird_of_prey", layout: "random",  doctrine: ["strafe", "brawl"], script: "raider",   minWins: 2, weight: 3, rewardMult: 1.1, counter: true },
      { id: "interceptor", enemyClass: "bird_of_prey", layout: "interceptor", doctrine: "skirmish", script: "raider", minWins: 2, weight: 1, rewardMult: 1.1 },   // the Impulse answer
      { id: "bombard",  enemyClass: "bird_of_prey", layout: "bombard", doctrine: "standoff", script: "torpedoBoat", minWins: 3, weight: 1, rewardMult: 1.2 },   // the Ordnance answer
      { id: "bulwark",  enemyClass: "bird_of_prey", layout: "bulwark", doctrine: "broadside", script: "cruiser", minWins: 2, weight: 1, rewardMult: 1.1 },   // the Deflector answer
      { id: "pulser",   enemyClass: "bird_of_prey", layout: "pulser",  doctrine: "brawl",     script: "raider",  minWins: 2, weight: 1, rewardMult: 1.1 },   // the Phaser answer
      { id: "jammer",   enemyClass: "bird_of_prey", layout: "jammer",  doctrine: "brawl",     script: "raider",   minWins: 3, weight: 2, rewardMult: 1.2 },
      { id: "shadow",   enemyClass: "bird_of_prey", layout: "shadow",  doctrine: "ambush",    script: "doctrine", minWins: 3, weight: 2, rewardMult: 1.3, damageMult: 1.2 },   // its decloak strikes already double
      { id: "leech",    enemyClass: "bird_of_prey", layout: "leech",   doctrine: "brawl",     script: "raider",   minWins: 3, weight: 2, rewardMult: 1.2 },   // two neutralisers: a close brawl becomes a capacitor war
      { id: "cruiser",  enemyClass: "ktinga",       layout: "default", doctrine: "broadside", script: "cruiser", minWins: 4, weight: 2, rewardMult: 1.8 },
      { id: "siege",    enemyClass: "ktinga",       layout: "siege",   doctrine: "siege",     script: "siegeCruiser", minWins: 6, weight: 2, rewardMult: 1.9 },
      { id: "warlord",  enemyClass: "ktinga",       layout: "random",  doctrine: ["broadside", "brawl"], script: "cruiser", minWins: 8, weight: 2, rewardMult: 1.9, counter: true },
      // fleet encounters (0.31): `ships` lists the hulls that come with the first one, each { enemyClass, layout, doctrine,
      // script, damageMult }. Out of the campaign pool (minWins 999) until the fleet hangar of 0.35 lets the player bring
      // more than one hull; the harness reaches them by id (--enemy pair / --enemy pack).
      { id: "pair",     enemyClass: "bird_of_prey", layout: "default", doctrine: "strafe",    script: "raider",  minWins: 999, weight: 1, rewardMult: 1.8,
        ships: [{ enemyClass: "bird_of_prey", layout: "gunboat", doctrine: "brawl", script: "raider" }] },
      // the first boss (0.33): `kind: "boss"`, its own script with the mechanics, `reinforcements` summoned by the script
      { id: "cube",     kind: "boss", enemyClass: "borg_cube", layout: "default", doctrine: "broadside", script: "borg", minWins: 999, weight: 1, rewardMult: 6,
        reinforcements: [{ enemyClass: "bird_of_prey", layout: "default", doctrine: "strafe", script: "raider" }, { enemyClass: "bird_of_prey", layout: "gunboat", doctrine: "brawl", script: "raider" }] },
      { id: "pack",     enemyClass: "bird_of_prey", layout: "default", doctrine: "strafe",    script: "raider",  minWins: 999, weight: 1, rewardMult: 3.2,
        ships: [{ enemyClass: "bird_of_prey", layout: "gunboat", doctrine: "brawl", script: "raider" }, { enemyClass: "bird_of_prey", layout: "torpedo", doctrine: "standoff", script: "torpedoBoat" }, { enemyClass: "bird_of_prey", layout: "jammer", doctrine: "brawl", script: "raider" }] },
    ],
    // the very first fight: the raider does not hunt weak points yet (enemyAI profile override while battlesWon is 0)
    firstFight: { weakPointChance: 0 },
    // They learn (0.26): the campaign keeps the signature of the last `remember` wins (save.signatures: style tags, average
    // range, side, aim, script). From `fromWins` wins on, with `chance` (seeded) the next encounter takes the first
    // enemyAI.signatureCounters row matching the dominant tag of those wins: its layout, doctrine and script, provided the
    // counter layout's effective cost (block cost × the enemy's stat multiplier) is within costBand of the player's build
    // cost, so the answer is a ship of the same weight. The hangar says so. Fights 0–2 stay naive.
    // 0.31 (DESIGN §10): the learning line is closed; chance and tuneChance are 0, so every encounter is a skirmish at
    // its own tuning. The machinery stays for the harness (--learn) and for bosses.
    learn: { fromWins: 3, chance: 0, remember: 3, costBand: 0.25, tagFraction: 0.3, cloakFraction: 0.1, longRangeKm: 9, closeRangeKm: 4,
             tuneChance: 0 },   // tuneChance: from fromWins on, the enemy's shields take the frequency that beats the ammo of the remembered wins and its ammo the modulation that beats their shields
    klingonNames: ["IKS Rotarran", "IKS Hegh'ta", "IKS Pagh", "IKS Koraga", "IKS Vorn", "IKS Amar", "IKS Gr'oth", "IKS Bortas", "IKS Ch'Tang", "IKS Maht-H'a"],
  },

  science: { scanDuration: 4, weaknessBonus: 1.25, cloakDetectRangeKm: 10 },
  // electronic warfare: ECM rolls jam / (jam + target sensors); cloak timings in seconds; detection grows with sensor arrays
  // support (0.34): the healer's reach, what each emitter and projector moves per cycle, and how close an escort keeps
  support: { rangeKm: 4, transferPerBlock: 100, repairPerBlock: 45, escortKm: 2.5 },
  ew: { jamPerBlock: 3, jamDuration: 4, cloakTime: 3, decloakTime: 2, surgeTime: 5, cloakDrain: 8, cloakMinCap: 5, detectPerSensor: 1, ghostAlpha: 0.25, ownCloakAlpha: 0.35,
        // fields (cells from the block): a ship cloaks only with every block inside a cloak field; a jam breaks the lock only
        // with every block inside an ECM field, otherwise it just forces their fire onto the blocks outside it
        cloakRadius: 10, jamRadius: 7,
        // decloak strike: for `window` seconds after decloaking, hits deal ×damageMult and shieldBypass of each hit skips the
        // target's shield straight into the hull (their emitters have not re-tuned to the sudden contact): the strike is
        // the whole point of a cloak, so it is short and decisive
        strike: { window: 10, shieldBypass: 0.6, damageMult: 2.0 },
        // decoy (module `decoy`): a flare dropped astern at speedKmS, burning for `life` s; a torpedo hunting the launcher
        // within lureKm of a decoy turns on it (nearest), and dies on it inside hitKm; when the decoy burns out the
        // torpedo goes back to its target. The enemy AI drops one when `aiIncomingKm` has torpedoes inside it.
        decoy: { life: 8, lureKm: 3, speedKmS: 1.0, hitKm: 0.25, spreadDeg: 35, aiIncomingKm: 4.5 },
        // energy neutraliser (module `neut`): with a lock inside rangeKm, each cycle drains perBlock × alive neutraliser
        // blocks from the target's capacitor; the enemy AI runs it above aiMinCap
        // drainMemory: seconds a drained ship (ship.neuted) remembers it; the enemy AI opens the range (state `drained`,
        // enemyAI.*.drainedBelow / drainedUntil / drainedTime) while its capacitor is that low and the neutraliser is on it
        neut: { rangeKm: 4, perBlock: 30, aiMinCap: 0.35, warnCapBelow: 240, drainMemory: 8, fleeKm: 8 } },

  // ------------------------------------------------------------- bridge scripts
  // The bridge fights by a script: ordered "when → do" rules (js/script.js). Every condition and action has a sentence
  // here ({v} is the value) so the editor, the trace and the battle report read as orders, never as data.
  script: {
    tickSeconds: 0.5,              // how often the rules are read
    chargingKmS: 1.0,              // "they are charging": closing faster than this while running in
    traceMax: 60,                  // trace entries kept per ship
    planTargets: 3,                // targets a plan may name, in order
    defaultTemplate: "brawler",    // what a ship undocks with when no script is assigned
    maxRules: 12,                  // rules per script in the editor
    maxScripts: 12,                // own scripts a save holds (Copy as new refuses beyond it)
    rangeBands: { beam: "inside our beam optimal", torpedo: "inside our torpedo range", out: "beyond our reach" },   // condition rangeBand, measured off the fitted weapons
    // subjects (0.32, BS.Fleet.subject): a rule's `about` picks which enemy its conditions read ("target" = the ship we
    // are fighting); the action `target` switches our fire to one. "hunter" is null when nobody is shooting at us.
    subjects: { target: "the ship we are fighting", nearest: "the nearest enemy", weakest: "the enemy with the least hull", biggest: "the biggest enemy", smallest: "the smallest enemy", loudest: "the loudest enemy (largest signature)", hunter: "the enemy shooting at us", focus: "the enemy most of us are fighting" },
    // ally subjects (0.34): who a support or escort action is for
    allySubjects: { weakestAlly: "the ally with the weakest shield", hurtAlly: "the ally with the least hull", huntedAlly: "the ally the most enemies are firing at", flagship: "the flagship" },
    // bridge calls (BS.Script.bridgeCall, BS.Game.bridgeCall): the captain's `tokens` interventions per battle, never
    // refilled. A play or side call is an override that stands for holdSeconds and then hands back to the script;
    // Disengage stands until the weakest shield is back over disengageUntil (or holdSeconds); Reinforce acts at once;
    // Focus aims every weapon at one block for focusSeconds. A button asks to be pressed twice within confirmSeconds.
    bridgeCall: { tokens: 2, holdSeconds: 45, focusSeconds: 30, confirmSeconds: 3, disengageUntil: 0.6, noCallBonus: 1.2 },
    dryRun: { maxSeconds: 600, stepsPerChunk: 1200 },   // the hangar's dry run: one simulated battle, stepped in chunks so the page stays responsive
    conditions: {
      dKmBelow:         { label: "they are closer than {v}", kind: "km", def: 5 },
      dKmAbove:         { label: "they are farther than {v}", kind: "km", def: 10 },
      facingBelow:      { label: "our shield facing them is under {v}", kind: "pct", def: 0.3 },
      facingAbove:      { label: "our shield facing them is over {v}", kind: "pct", def: 0.6 },
      weakestBelow:     { label: "our weakest shield is under {v}", kind: "pct", def: 0.25 },
      weakestAbove:     { label: "our weakest shield is over {v}", kind: "pct", def: 0.6 },
      heatAbove:        { label: "our heat is over {v}", kind: "pct", def: 0.9 },
      heatBelow:        { label: "our heat is under {v}", kind: "pct", def: 0.3 },
      capBelow:         { label: "our capacitor is under {v}", kind: "pct", def: 0.2 },
      capAbove:         { label: "our capacitor is over {v}", kind: "pct", def: 0.6 },
      hullBelow:        { label: "our hull is under {v}", kind: "pct", def: 0.4 },
      time:             { label: "more than {v} have passed", kind: "sec", def: 60 },
      scanned:          { label: "we have scanned them", kind: "bool", def: true, negLabel: "we have not scanned them yet" },
      incomingTorpedoes:{ label: "{v} or more torpedoes are coming at us", kind: "count", def: 1 },
      boardable:        { label: "the transporter has a window", kind: "flag" },
      overloaded:       { label: "we are overloaded", kind: "flag" },
      cloaked:          { label: "we are cloaked", kind: "flag" },
      cloakOff:         { label: "our cloak is off", kind: "flag" },
      noCloak:          { label: "our cloak field is broken", kind: "flag" },
      noTubes:          { label: "we have no torpedo tubes left", kind: "flag" },
      noPhasers:        { label: "we have no beam weapons left", kind: "flag" },
      enemyReactorsGone:{ label: "their reactors are all gone", kind: "flag" },
      enemyShieldsDown: { label: "their shield facing us is down", kind: "flag" },
      enemyFacingBelow: { label: "their shield facing us is under {v}", kind: "pct", def: 0.3 },
      enemyCapBelow:    { label: "their capacitor is under {v}", kind: "pct", def: 0.1 },
      enemyHullBelow:   { label: "their hull is under {v}", kind: "pct", def: 0.5 },
      enemyCharging:    { label: "they are charging us", kind: "flag" },
      enemyCloaking:    { label: "they are cloaking", kind: "flag" },
      enemyCloaked:     { label: "they are cloaked", kind: "flag" },
      enemyRolling:     { label: "they are turning a fresh shield to us", kind: "flag" },
      enemyBreaching:   { label: "their core is breaching", kind: "flag" },
      enemyKiting:      { label: "they are running from us", kind: "flag" },
      enemyFocusing:    { label: "they are shooting at our {v}", kind: "type", def: "reactor" },
      enemyState:       { label: "they are {v}", kind: "state", def: "pass" },
      // 0.25: observations both bridges may script against
      enemyStance:      { label: "they are {v}", kind: "stance", def: "orbiting" },          // enemyAI.stanceLabels, read off state and command
      enemyAimingAt:    { label: "they are {v}", kind: "aiming", def: "weak" },              // enemyAI.aimLabels
      rangeBand:        { label: "they are {v}", kind: "band", def: "beam" },                // script.rangeBands, off our own fitted weapons
      enemyAfterburner: { label: "their afterburner is lit", kind: "flag" },
      enemyHeatAbove:   { label: "their heat is over {v}", kind: "pct", def: 0.6 },
      enemyHeatBelow:   { label: "their heat is under {v}", kind: "pct", def: 0.35 },
      blindFor:         { label: "none of our weapons have borne on them for {v}", kind: "sec", def: 3 },
      // 0.30: tuning, readable only once we have scanned them (BS.Data.tuning)
      enemyAmmoBeatsOurShields: { label: "their ammo beats our shield frequency", kind: "flag" },
      ourAmmoBeaten:    { label: "their shield frequency beats our ammo", kind: "flag" },
      remodulating:     { label: "we are remodulating", kind: "flag" },
      // 0.32: the rest of our side and the count of theirs (a fleet; alone, the ally conditions never hold)
      allyShieldBelow:  { label: "an ally's weakest shield is under {v}", kind: "pct", def: 0.3 },
      allyHullBelow:    { label: "an ally's hull is under {v}", kind: "pct", def: 0.4 },
      allyUnderFire:    { label: "an ally is under fire", kind: "flag" },
      outnumbered:      { label: "they outnumber us", kind: "flag" },
      enemiesAtMost:    { label: "{v} or fewer enemies are left", kind: "count", def: 1 },
      unfocused:        { label: "we are not firing at the ship most of us are fighting", kind: "flag" },
      // 0.33: bosses
      notTargeting:     { label: "we are not firing at {v}", kind: "subject", def: "nearest" },
      enemiesAtLeast:   { label: "{v} or more enemies are left", kind: "count", def: 2 },
      lanceCharging:    { label: "a cutting beam is charging on us", kind: "flag" },
      allyLanced:       { label: "a cutting beam is charging on an ally", kind: "flag" },
    },
    actions: {
      stance:    { label: "fly {v}", kind: "stance" },
      doctrine:  { label: "fly the {v} doctrine", kind: "doctrine" },   // enemy scripts: fixed-range doctrines
      play:      { label: "run the {v} play", kind: "play" },
      side:      { label: "keep to their {v}", kind: "side" },
      aim:       { label: "aim at {v}", kind: "aim" },
      weapons:   { label: "weapons {v}", kind: "bool" },
      modules:   { label: "{v}", kind: "modules" },
      governor:  { label: "heat governor {v}", kind: "bool" },
      repair:    { label: "damage control to the {v}", kind: "type" },
      reinforce: { label: "reinforce the weakest shield", kind: "flag" },
      scan:      { label: "scan them (4 s, beams hold fire)", kind: "flag" },
      board:     { label: "send the boarding party", kind: "flag" },
      roll:      { label: "come about to bring guns round", kind: "flag" },   // BS.EnemyAI.roll: a reposition toward the side with the most fire
      remodulate:{ label: "remodulate our {v}", kind: "remod" },   // "shields" (frequency that beats their ammo, deflector down meanwhile) or "ammo" (ammo that beats their frequency, weapons cold meanwhile)
      target:    { label: "switch our fire to {v}", kind: "subject" },   // 0.32: script.subjects; the helm, lock and aim follow (BS.Fleet.retarget)
      support:   { label: "support {v}", kind: "ally" },     // 0.34: the ally our shield transfer and remote repair work on
      escort:    { label: "escort {v}", kind: "ally" },      // 0.34: the helm keeps station on that ally (support.escortKm) until a stance or doctrine
      summon:    { label: "call in the reinforcements", kind: "flag", enemyOnly: true },   // 0.33: the encounter's `reinforcements` drop in beside the ship, once
      overdrive: { label: "reroute all power to weapons", kind: "flag", enemyOnly: true }, // 0.33: enemyAI.overdrive for the rest of the fight
    },
    policies: {
      support:   { label: "support the ally with the weakest shield" },   // 0.34: re-picked every tick for the transfer and repair modules
      lock:      { label: "keep a lock on the target" },
      booster:   { label: "pulse the booster when a shield is low" },
      reinforce: { label: "reinforce when a shield is very low" },
      hardener:  { label: "keep the hardener up" },
      decoy:     { label: "drop a decoy when torpedoes close" },
      neut:      { label: "run the neutraliser in range" },
    },
    weakKinds: { emitter: "the emitter covering the most hull", chain: "reactors that touch", blackout: "the reactor that alone powers a part of them", neck: "the block that severs the most hull", crew: "their crew decks", wounded: "a wounded system", frequency: "the facing whose shield frequency our ammo beats", any: "whatever stands out most" },
    // Templates: the six plays and the default fight written as rules. `until` holds a rule until its condition
    // (or holdMax s); a rule without conditions is the default. once / every make call-outs.
    templates: {
      brawler: { name: "Brawler", desc: "Engage and keep guns on them; the helm flips sides for guns and shields.", policies: { lock: true, booster: "auto", reinforce: "auto", decoy: "auto", neut: "auto" },
        rules: [
          { when: {}, do: { stance: "engage", weapons: true, modules: { shield_hardener: true }, governor: true } },
        ] },
      // 0.32: the first fleet template. Everyone on the same ship: whoever is closest to breaking, else the ship most of
      // us are already fighting. Alone it is the Brawler.
      wolfpack: { name: "Wolf pack", desc: "Fleet: finish the enemy closest to breaking, otherwise all guns on the ship most of us are fighting.", policies: { lock: true, booster: "auto", reinforce: "auto", decoy: "auto", neut: "auto" },
        rules: [
          { when: { enemyHullBelow: 0.4 }, about: "weakest", do: { target: "weakest", stance: "engage", weapons: true, modules: { shield_hardener: true }, governor: true } },
          { when: { unfocused: true }, do: { target: "focus" }, every: 8 },
          { when: {}, do: { stance: "engage", weapons: true, modules: { shield_hardener: true }, governor: true } },
        ] },
      // 0.34: role templates (DESIGN §10). Anchor is the tank: beacon lit, on the biggest enemy, hardener and reinforce.
      // Lifeline is the healer: escorts the ally under most fire, supports the weakest shield, runs transfer and repair.
      anchor: { name: "Anchor", desc: "Tank: light the beacon so the boss turns on us, engage the biggest enemy with the hardener up, reinforce when a shield falls.", policies: { lock: true, booster: "auto", reinforce: "auto", decoy: "auto", neut: "auto" },
        rules: [
          { when: { weakestBelow: 0.3 }, do: { reinforce: true }, every: 20 },
          { when: {}, do: { target: "biggest", stance: "engage", weapons: true, modules: { beacon: true, shield_hardener: true }, governor: true, repair: "shield" } },
        ] },
      lifeline: { name: "Lifeline", desc: "Healer: keep station on the ally under most fire, transfer shields and repair the weakest, skirmish away from a charging beam. Needs transfer emitters or repair projectors.", policies: { lock: true, booster: "auto", reinforce: "auto", decoy: "auto", support: "auto" },
        rules: [
          { when: { lanceCharging: true }, do: { stance: "skirmish", modules: { afterburner: true } }, until: { lanceCharging: false }, holdMax: 9 },
          { when: {}, do: { escort: "huntedAlly", weapons: true, modules: { shield_transfer: true, remote_repair: true, shield_hardener: true }, governor: true } },
        ] },
      // 0.33: the intended answer to the first boss (DESIGN §4 "Bosses"): outrun the cutting beam on the afterburner
      // while it charges, kill the escorts first, retune the ammo, and work the bare aft over the reactors.
      cubebreaker: { name: "Cube breaker", desc: "Boss: skirmish on the afterburner while a cutting beam charges on us, finish the escorts first, retune the ammo, then stay on their aft and shoot the reactors.", policies: { lock: true, booster: "auto", reinforce: "auto", decoy: "auto", neut: "auto" },
        rules: [
          { when: { lanceCharging: true }, do: { stance: "skirmish", modules: { afterburner: true } }, until: { lanceCharging: false }, holdMax: 9 },
          { when: { enemiesAtLeast: 2 }, about: "smallest", do: { target: "smallest", stance: "engage", weapons: true, modules: { shield_hardener: true }, governor: true } },
          { when: { scanned: false, dKmBelow: 15 }, do: { scan: true }, once: true },
          { when: { scanned: true, ourAmmoBeaten: true, remodulating: false }, do: { remodulate: "ammo" }, every: 45 },
          { when: {}, do: { target: "biggest", stance: "engage", side: "aft", aim: "reactor", weapons: true, modules: { shield_hardener: true }, governor: true } },
        ] },
      siege: { name: "Siege", desc: "Hold at torpedo range with everything that reaches; fight close only when they come inside 5 km.", policies: { lock: true, booster: "auto", reinforce: "auto", decoy: "auto" },
        rules: [
          { when: { noTubes: true }, do: { stance: "engage", weapons: true, modules: { shield_hardener: true } } },
          { when: { dKmBelow: 5 }, do: { stance: "engage", weapons: true, modules: { shield_hardener: true } }, until: { dKmAbove: 9 }, holdMax: 30 },
          { when: {}, do: { stance: "standoff", weapons: true, modules: { shield_hardener: true }, governor: true } },
        ] },
      hunter: { name: "Hunter", desc: "Engage aiming at their reactors; when they are gone, or after a minute, pick at bare hull.", policies: { lock: true, booster: "auto", reinforce: "auto", decoy: "auto" },
        rules: [
          { when: { enemyReactorsGone: true }, do: { stance: "engage", aim: "exposed", weapons: true } },
          { when: { time: 60 }, do: { stance: "engage", aim: "exposed", weapons: true } },
          { when: {}, do: { stance: "engage", aim: "reactor", weapons: true, modules: { shield_hardener: true }, governor: true } },
        ] },
      ambush: { name: "Ambush", desc: "Cloak in, decloak at knife range for the strike on their reactors, slip away cloaked and come again. Needs a cloak.", requires: "cloak", policies: { lock: true, booster: "auto", reinforce: "auto" },
        rules: [
          { when: { noCloak: true }, do: { stance: "engage", weapons: true, modules: { shield_hardener: true }, governor: true } },
          { when: { weakestBelow: 0.25 }, do: { stance: "disengage", weapons: false, modules: { shield_hardener: false, cloak: true }, governor: true }, until: { weakestAbove: 0.6, cloaked: true }, holdMax: 40 },
          { when: { dKmBelow: 3.5 }, do: { stance: "engage", modules: { cloak: false, shield_hardener: true }, weapons: true, governor: false, aim: "reactor" }, until: { heatAbove: 0.85 }, holdMax: 14 },
          { when: { capBelow: 0.15 }, do: { stance: "engage", modules: { cloak: false, shield_hardener: true }, weapons: true, governor: false, aim: "reactor" }, until: { heatAbove: 0.85 }, holdMax: 14 },
          { when: {}, do: { doctrine: "closein", weapons: false, modules: { cloak: true, shield_hardener: false }, governor: true } },
        ] },
    },
    // Retired from the hangar list (DESIGN §10): written at 0.21 and never below the Brawler in the §8 matrix (Alpha's
    // heat rules never fire on a stock hull, Turtle and Hit & fade lose to the strafe). Kept as syntax examples and for
    // tools/harness.js --script; a save that assigned one falls back to defaultTemplate. Role templates replace them in 0.32.
    retiredTemplates: {
      alpha: { name: "Alpha strike", desc: "Close with weapons cold, dump everything with the governor off, vent, strike again.", policies: { lock: true, booster: "auto", reinforce: "auto", decoy: "auto" },
        rules: [
          { when: { dKmAbove: 4.5, time: 0 }, do: { doctrine: "closein", weapons: false, modules: { shield_hardener: true }, governor: true }, until: { dKmBelow: 4.5 } },
          { when: { heatAbove: 0.9 }, do: { stance: "engage", weapons: false, governor: true }, until: { heatBelow: 0.3 } },
          { when: { overloaded: true }, do: { stance: "engage", weapons: false, governor: true }, until: { heatBelow: 0.3 } },
          { when: {}, do: { stance: "engage", weapons: true, modules: { shield_hardener: true }, governor: false } },
        ] },
      turtle: { name: "Turtle", desc: "A slow broadside with the hardener up, reinforcing and rolling fresh shields.", policies: { lock: true, booster: "auto", reinforce: "auto", decoy: "auto" },
        rules: [
          { when: {}, do: { doctrine: "broadside", weapons: true, modules: { shield_hardener: true }, governor: true, repair: "shield" } },
        ] },
      hitfade: { name: "Hit & fade", desc: "Engage until a shield runs low, then a tight afterburner orbit until it recovers.", policies: { lock: true, booster: "auto", reinforce: "auto", decoy: "auto" },
        rules: [
          { when: { weakestBelow: 0.25 }, do: { stance: "skirmish", weapons: true, modules: { shield_hardener: false } }, until: { weakestAbove: 0.6 }, holdMax: 45 },
          { when: {}, do: { stance: "engage", weapons: true, modules: { shield_hardener: true }, governor: true } },
        ] },
    },
    // Enemy scripts: the encounter's doctrine (and play) as rules, so both bridges run the same engine. The enemy AI keeps
    // its own module policies (booster, hardener, afterburner) in enemyai.js. `doctrine` means the encounter's doctrine.
    // Reactions (0.25) are rules like any other, with `callout`: what Tactical says when the rule takes over or calls
    // out. Enemy scripts never set modules (enemyai.js manages weapons, hardener and booster every decision tick); they
    // react with the helm: roll, reinforce, a reaction doctrine held until its until / holdMax, a scan.
    enemyScripts: {
      doctrine:      { name: "Doctrine", rules: [
                        { when: { blindFor: 3 }, do: { roll: true }, every: 8, callout: "They're coming about to bring their guns round." },
                        { when: {}, do: { doctrine: "encounter" } } ] },
      raider:        { name: "Raider", rules: [
                        { when: { scanned: false, dKmBelow: 12 }, do: { scan: true }, once: true },
                        { when: { unfocused: true }, do: { target: "focus" }, every: 10, callout: "They're shifting fire to the ship their pack is on." },
                        { when: { scanned: true, enemyAmmoBeatsOurShields: true, remodulating: false }, do: { remodulate: "shields" }, every: 45, callout: "They're remodulating their shields, Captain. Ten seconds with the deflector down." },
                        { when: { scanned: true, ourAmmoBeaten: true, remodulating: false }, do: { remodulate: "ammo" }, every: 45, callout: "They're retuning their weapons to our shield frequency." },
                        { when: { blindFor: 3 }, do: { roll: true }, every: 8, callout: "They're coming about to bring their guns round on us." },
                        { when: { enemyFocusing: "shield" }, do: { reinforce: true, roll: true }, every: 20, callout: "They're reinforcing and turning that emitter away from us." },
                        { when: { enemyHeatAbove: 0.6, dKmBelow: 6 }, do: { doctrine: "kite" }, until: { enemyHeatBelow: 0.35 }, holdMax: 20, callout: "They're opening the range, riding out our strike." },
                        { when: { enemyCloaked: true }, do: { doctrine: "watch" }, until: { enemyCloaked: false }, holdMax: 60, callout: "They're holding at five klicks, waiting for us to show." },
                        { when: { enemyCloaked: false, scanned: false, dKmBelow: 8 }, do: { scan: true }, once: true },
                        { when: {}, do: { doctrine: "encounter" } } ] },
      torpedoBoat:   { name: "Torpedo boat", rules: [ { when: {}, do: { play: "siege" } } ] },
      // the first boss (0.33): every mechanic is a rule with a callout the fleet can script against
      borg:          { name: "Borg cube", rules: [
                        { when: { scanned: false, dKmBelow: 20 }, do: { scan: true }, once: true },
                        { when: { notTargeting: "loudest" }, do: { target: "loudest" }, every: 30, callout: "The cube is turning on the loudest ship." },
                        { when: { scanned: true, enemyAmmoBeatsOurShields: true, remodulating: false }, do: { remodulate: "shields" }, every: 45, callout: "The cube is adapting: its shields are remodulating." },
                        { when: { hullBelow: 0.6 }, do: { summon: true }, once: true, callout: "Two assimilated Birds-of-Prey are dropping out of warp beside the cube!" },
                        { when: { time: 420 }, do: { overdrive: true }, once: true, callout: "The cube is rerouting everything to its weapons. Finish it now or not at all." },
                        { when: { blindFor: 4 }, do: { roll: true }, every: 12, callout: "The cube is rolling a fresh face toward us." },
                        { when: {}, do: { doctrine: "encounter" } } ] },
      cruiser:       { name: "Cruiser", rules: [
                        { when: { scanned: false, dKmBelow: 14 }, do: { scan: true }, once: true },
                        { when: { unfocused: true }, do: { target: "focus" }, every: 10, callout: "The cruiser is shifting fire to the ship its escorts are on." },
                        { when: { scanned: true, enemyAmmoBeatsOurShields: true, remodulating: false }, do: { remodulate: "shields" }, every: 45, callout: "The cruiser is remodulating its shields: ten seconds with its deflector down." },
                        { when: { scanned: true, ourAmmoBeaten: true, remodulating: false }, do: { remodulate: "ammo" }, every: 45, callout: "The cruiser is retuning its disruptors to our shield frequency." },
                        { when: { blindFor: 2.5 }, do: { roll: true }, every: 10, callout: "The cruiser is coming about to bring its batteries round." },
                        { when: { enemyFocusing: "shield" }, do: { reinforce: true, roll: true }, every: 25, callout: "The cruiser is reinforcing and rolling that emitter away." },
                        { when: { enemyHeatAbove: 0.6, dKmBelow: 6 }, do: { doctrine: "kite" }, until: { enemyHeatBelow: 0.35 }, holdMax: 15, callout: "The cruiser is opening the range under our strike." },
                        { when: { enemyCloaked: true }, do: { doctrine: "watch" }, until: { enemyCloaked: false }, holdMax: 60, callout: "The cruiser is holding at five klicks, waiting for us to decloak." },
                        { when: { enemyCloaked: false, scanned: false, dKmBelow: 8 }, do: { scan: true }, once: true },
                        { when: {}, do: { doctrine: "encounter" } } ] },
      siegeCruiser:  { name: "Siege cruiser", rules: [
                        { when: { scanned: false, dKmBelow: 20 }, do: { scan: true }, once: true },
                        { when: { scanned: true, enemyAmmoBeatsOurShields: true, remodulating: false }, do: { remodulate: "shields" }, every: 45, callout: "The cruiser is remodulating its shields: ten seconds with its deflector down." },
                        { when: { scanned: true, ourAmmoBeaten: true, remodulating: false }, do: { remodulate: "ammo" }, every: 45, callout: "The cruiser is retuning its torpedoes to our shield frequency." },
                        { when: { blindFor: 2.5 }, do: { roll: true }, every: 10, callout: "The cruiser is coming about to bring its batteries round." },
                        { when: { enemyFocusing: "shield" }, do: { reinforce: true, roll: true }, every: 25, callout: "The cruiser is reinforcing and rolling that emitter away." },
                        { when: { enemyCloaked: true }, do: { doctrine: "watch" }, until: { enemyCloaked: false }, holdMax: 60, callout: "The cruiser is holding at five klicks, waiting for us to decloak." },
                        { when: { enemyCloaked: false, scanned: false, dKmBelow: 8 }, do: { scan: true }, once: true },
                        { when: {}, do: { doctrine: "encounter" } } ] },
    },
  },

  saveDefaults: {
    version: 2, credits: 600, shipClass: "constitution", ownedShips: ["constitution"],
    fleet: [],                         // owned class ids that undock with the hangar's ship (0.31, campaign.fleetMax in all); empty = alone
    layouts: {},                       // classId → array of layout rows; missing = class default layout
    builds: {},                        // classId → [{ name, rows, tuning }] named builds (up to editor.maxSavedBuilds)
    skills: { gunnery: 0, missiles: 0, navigation: 0, shields: 0, capacitor: 0, targeting: 0 },
    training: null,                    // { skill, level, startedAt, finishesAt } (ms timestamps)
    campaign: { missionIndex: 0, battlesWon: 0, battlesLost: 0, streak: 0, cleanWins: 0, retry: null },   // retry: { encounterId, seed, battlesWon } pins the last enemy for the next fight
    intel: {},                         // encounterId → { rows, classId, layoutName, seed } layouts scanned in battle or bought
    scripts: [],                       // [{ id, name, policies, rules }] the player's bridge scripts (BS.Script); templates live in script.templates
    scriptByBuild: {},                 // classId → script id or template id the ship undocks with (missing: script.defaultTemplate)
    plans: {},                         // encounterId → { targets: [{ x, y } | { type }], rows } up to script.planTargets targets in order
    book: {},                          // encounterId → { fights, rules: { "<script>:<rule>": { text, n } } } the enemy rules seen firing (opening book)
    signatures: [],                    // the last campaign.learn.remember wins: { tags, rangeKm, side, aim, script, classId, cost, tuning, at } (BS.Game.styleTags); the enemy learns from them
    tuning: {},                        // classId → rows of digits in the layout's shape (BS.Data.tuning): shield frequencies, armor alloys, ammo per block
    settings: { sound: true, screenShake: true, manualBridge: false },   // manualBridge: show the hand-flown helm controls (debug)
  },

  // -------------------------------------------------------------- visuals
  visuals: {
    starLayers: [
      { count: 420, parallax: 0.15, size: [0.6, 1.3], alpha: 0.6 },
      { count: 240, parallax: 0.4,  size: [0.9, 1.9], alpha: 0.85 },
      { count: 110, parallax: 0.8,  size: [1.3, 2.6], alpha: 1.0 },
    ],
    starTile: 2048,
    nebulae: [
      { x: 0.25, y: 0.35, r: 0.6,  color: "120, 50, 170" },
      { x: 0.78, y: 0.72, r: 0.55, color: "40, 100, 190" },
      { x: 0.6,  y: 0.15, r: 0.4,  color: "30, 140, 150" },
      { x: 0.1,  y: 0.85, r: 0.35, color: "180, 70, 110" },
    ],
    shieldColors: { strong: [90, 170, 255], mid: [120, 230, 255], low: [255, 210, 80], critical: [255, 80, 70] },
    shakeMax: 14,
    shakeDecay: 6,
    // destruction: fragments are groups of blocks that drift off as one piece and keep their colours
    // sections keep the ship's momentum, burn their engines for thrustTime, explode their reactors after reactorFuse
    // seconds, and hit anything they drift into for damagePerCell × cells (once, when solid: life above fadeFrom)
    fragments: { sectionLife: 4.0, deathLife: 4.0, deathPieces: [3, 6], driftSpeed: 26, deathSpeed: 50, spin: 1.6, fadeFrom: 0.45, inertia: 1.0, thrustTime: 1.2, thrustPush: 90, reactorFuse: [0.8, 1.8], reactorBlast: 80, damagePerCell: 6, ownImmunity: 1.5 },
  },
};
