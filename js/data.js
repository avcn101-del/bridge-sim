// js/data.js — every tunable number in the game lives here.
// Game logic reads from BS.Data and never hard-codes balance values.
window.BS = window.BS || {};

BS.Data = {
  version: "0.3.0",

  // ------------------------------------------------------------------ units
  // World space is pixels; the interface shows kilometres and km/s.
  units: { pxPerKm: 20 },

  // ---------------------------------------------------------------- balance
  balance: {
    simStep: 1 / 60,
    maxFrameTime: 0.1,
    shieldBleedThrough: 0.15,     // fraction of absorbed shield damage that still leaks to hull
    subsystemDamageFactor: 0.45,  // hull damage × this = subsystem damage on an untargeted (random) hit
    targetedSubsystemDamageFactor: 0.7, // same for a hit on the subsystem you are targeting
    subsystemHitChance: 0.5,      // chance an untargeted hull hit also damages a random subsystem
    hullSmokeThreshold: 0.5,      // below this hull fraction the ship vents/burns
    hullRepairRate: 0.8,          // hull hp/s patched by damage control once every subsystem is at 100
    cameraLerp: 0.06,
    noAlertShieldRegenMult: 0.5,  // shield regen when weapons are not armed (condition green)
    destroyedEndDelay: 2.6,       // seconds between destruction and result screen
    reinforceFraction: 0.45,      // fraction of strongest facing moved to weakest
    reinforceDuration: 3.0,       // seconds the transfer takes
    reinforceCooldown: 20,        // seconds before Engineering can do it again
    hitRadiusFactor: 0.42,        // ship length × this = torpedo hit radius
    arenaStartDistanceKm: 38,     // enemy spawn distance from player
    // EVE-style capacitor: recharge/s = capMax / rechargeTime × capCurve × (sqrt(f) − f), f = fraction full (peaks at 25%)
    capCurve: 5,
    // lock time = lockBase × (lockRefSignature / target signature) × (lockRefSensor / own sensor strength)
    lockBase: 3.0, lockRefSignature: 300, lockRefSensor: 10,
    // turret hit chance = accuracy × 0.5 ^ ((angular / tracking)² + (max(0, d − optimal) / falloff)²)
    // torpedo damage mult = min(1, sig / explosionRadius, ((sig / explosionRadius) × (explosionVelocity / targetSpeed)) ^ 0.6)
    orbitRangesKm: [3, 6, 10, 15],
    keepRangesKm: [6, 10, 15],
    zoom: { min: 0.5, max: 1.6, step: 0.1, start: 0.85 },
  },

  // ------------------------------------------------------------ subsystems
  // Order here is the order of status rows and chips. Each ship class has
  // health 0..100 for every id listed. Effects are applied in ships.js.
  subsystems: {
    weapons:   { label: "Phasers",   short: "PHA", effect: "phaser damage and cycle time",
                 targetReport: "Locking phasers on their phaser banks.",
                 damaged: "Phaser banks hit! Our phaser power is dropping.", repaired: "Phaser banks repaired, Captain." },
    torpedoes: { label: "Torpedoes", short: "TOR", effect: "torpedo reload speed",
                 targetReport: "Targeting their torpedo launcher, Captain.",
                 damaged: "Torpedo launcher damaged! Reload times are up.", repaired: "Torpedo launcher back online." },
    engines:   { label: "Engines",   short: "ENG", effect: "speed and agility",
                 targetReport: "Targeting their engines, Captain.",
                 damaged: "Impulse engines damaged! We're losing speed and agility.", repaired: "Impulse engines back to full, Captain." },
    shields:   { label: "Shields",   short: "SHD", effect: "shield regeneration and boosting",
                 targetReport: "Targeting their shield generators.",
                 damaged: "Shield generators hit! Regeneration is down.", repaired: "Shield generators repaired." },
    sensors:   { label: "Sensors",   short: "SEN", effect: "accuracy, tracking and lock time",
                 targetReport: "Targeting their sensor array. That'll spoil their aim.",
                 damaged: "Sensor array damaged! Targeting and lock times are degraded.", repaired: "Sensors recalibrated, Captain." },
    bridge:    { label: "Bridge",    short: "BRG", effect: "capacitor management",
                 targetReport: "Targeting their bridge, Captain. Precision shot.",
                 damaged: "Direct hit on the bridge! Power management is suffering.", repaired: "Bridge systems restored, Captain." },
  },
  subsystemFloor: 0.4,           // multiplier left when a part is at 0 health
  subsystemEffects: {
    sensorsAccuracyFloor: 0.7,   // accuracy multiplier at 0 sensor health
    sensorsLockMaxMult: 1.8,     // lock time multiplier at 0 sensor health
    bridgeCapMinMult: 0.6,       // capacitor recharge multiplier at 0 bridge health
    targetAccuracyMult: 0.85,    // hit chance multiplier while a subsystem is targeted
  },

  // ---------------------------------------------------------------- modules
  // slot: high (weapons), mid (active tactical), low (passive). Active modules
  // cycle: each cycle costs capacitor. pg / cpu are fitting costs (used in PR B).
  modules: {
    phaser_bank: {
      slot: "high", kind: "turret", name: "Type-IX phaser bank", short: "PHA",
      damage: 26, cycle: 2.6, cap: 7, optimalKm: 8, falloffKm: 7, tracking: 2.4, accuracy: 0.95,
      pg: 20, cpu: 12, subsystem: "weapons", color: "#ff8a3d", coreColor: "#fff3e0", beamLife: 0.4, cost: 400,
      desc: "Beam weapon. Best inside 8 km; loses hits against fast-moving targets.",
    },
    disruptor_cannon: {
      slot: "high", kind: "turret", name: "Disruptor cannon", short: "DIS",
      damage: 24, cycle: 2.6, cap: 7, optimalKm: 7, falloffKm: 6, tracking: 2.8, accuracy: 0.92,
      pg: 18, cpu: 10, subsystem: "weapons", color: "#5cff6a", coreColor: "#e8ffe8", beamLife: 0.35, cost: 350,
      desc: "Klingon beam weapon.",
    },
    torpedo_launcher: {
      slot: "high", kind: "launcher", name: "Photon torpedo launcher", short: "TOR",
      damage: 120, cycle: 11, cap: 14, rangeKm: 30, speedKmS: 12, explosionRadius: 280, explosionVelocity: 4.2, turnRate: 160,
      pg: 30, cpu: 18, subsystem: "torpedoes", color: "#ffb347", coreColor: "#ffffff", cost: 700,
      desc: "Heavy warhead. Full damage on big or slow targets; weak against small fast ones.",
    },
    klingon_launcher: {
      slot: "high", kind: "launcher", name: "Klingon torpedo launcher", short: "TOR",
      damage: 130, cycle: 12, cap: 14, rangeKm: 28, speedKmS: 11, explosionRadius: 320, explosionVelocity: 4.0, turnRate: 140,
      pg: 32, cpu: 18, subsystem: "torpedoes", color: "#ff4d4d", coreColor: "#ffe6e6", cost: 700,
      desc: "Klingon heavy torpedo.",
    },
    shield_booster: {
      slot: "mid", kind: "active", name: "Shield booster", short: "SB",
      cycle: 4, cap: 32, effect: { shieldBoost: 70 }, pg: 15, cpu: 20, cost: 500,
      desc: "Each cycle restores 70 shield to the weakest facing. Expensive on capacitor: pulse it.",
    },
    shield_hardener: {
      slot: "mid", kind: "active", name: "Shield hardener", short: "SH",
      cycle: 8, cap: 7, effect: { shieldResist: 0.3 }, pg: 5, cpu: 15, cost: 350,
      desc: "While running, shields take 30% less damage.",
    },
    afterburner: {
      slot: "mid", kind: "active", name: "Afterburner", short: "AB",
      cycle: 8, cap: 16, effect: { speedMult: 1.5 }, pg: 10, cpu: 12, cost: 300,
      desc: "+50% speed while running. Higher angular velocity makes enemy beams miss.",
    },
    sensor_booster: {
      slot: "mid", kind: "active", name: "Sensor booster", short: "SEB",
      cycle: 10, cap: 5, effect: { lockMult: 0.6, trackingMult: 1.15 }, pg: 3, cpu: 18, cost: 250,
      desc: "Faster locks and better tracking while running.",
    },
    damage_amp: {
      slot: "low", kind: "passive", name: "Phaser damage amplifier", short: "DA",
      effect: { turretDamageMult: 1.1 }, pg: 2, cpu: 20, cost: 450,
      desc: "+10% beam damage.",
    },
    power_relay: {
      slot: "low", kind: "passive", name: "Capacitor power relay", short: "CPR",
      effect: { capRechargeMult: 1.2 }, pg: 1, cpu: 10, cost: 300,
      desc: "+20% capacitor recharge.",
    },
    hull_plating: {
      slot: "low", kind: "passive", name: "Duranium plating", short: "DP",
      effect: { hullAdd: 200, speedMult: 0.95 }, pg: 5, cpu: 5, cost: 350,
      desc: "+200 hull, −5% speed.",
    },
  },

  // ----------------------------------------------------------- ship classes
  shipClasses: {
    constitution: {
      id: "constitution", name: "USS Constitution", className: "Constitution class",
      role: "Heavy cruiser", faction: "federation", cost: 0, purchasable: true,
      hull: 1000,
      shields: { max: 380, regen: 3 },
      speed: 95, turnRate: 90,
      signature: 400, sensorStrength: 12, lockRangeKm: 45,
      capacitor: { max: 500, rechargeTime: 45 },
      slots: { high: 3, mid: 3, low: 2 }, powergrid: 110, cpu: 120,
      fit: { high: ["phaser_bank", "phaser_bank", "torpedo_launcher"], mid: ["shield_booster", "shield_hardener", "afterburner"], low: ["damage_amp", "power_relay"] },
      subsystems: { weapons: 100, torpedoes: 100, engines: 100, shields: 100, sensors: 100, bridge: 100 },
      phaserMounts: [ { x: 34, y: -14 }, { x: 34, y: 14 } ],
      torpedoTubes: [ { x: 4, y: 0 } ],
      repairRate: 3.5,
      preferredRangeKm: 7,
      visual: { kind: "vector", drawer: "federation_constitution", sprite: null, scale: 1.0, length: 112, width: 70,
        hardpoints: {
          weapons:   [ { x: 30, y: -20, r: 8 }, { x: 30, y: 20, r: 8 } ],
          torpedoes: [ { x: 0, y: 0, r: 7 } ],
          engines:   [ { x: -26, y: -30, r: 9 }, { x: -26, y: 30, r: 9 } ],
          shields:   [ { x: -26, y: 0, r: 8 } ],
          sensors:   [ { x: 13, y: 0, r: 6 } ],
          bridge:    [ { x: 30, y: 0, r: 7 } ],
        } },
    },
    bird_of_prey: {
      id: "bird_of_prey", name: "IKS Rotarran", className: "B'rel class Bird-of-Prey",
      role: "Raider", faction: "klingon", cost: 0, purchasable: false,
      hull: 900,
      shields: { max: 330, regen: 2.5 },
      speed: 105, turnRate: 110,
      signature: 250, sensorStrength: 10, lockRangeKm: 40,
      capacitor: { max: 400, rechargeTime: 42 },
      slots: { high: 3, mid: 2, low: 1 }, powergrid: 90, cpu: 90,
      fit: { high: ["disruptor_cannon", "disruptor_cannon", "klingon_launcher"], mid: ["shield_booster", "afterburner"], low: ["damage_amp"] },
      subsystems: { weapons: 100, torpedoes: 100, engines: 100, shields: 100, sensors: 100, bridge: 100 },
      phaserMounts: [ { x: -30, y: -46 }, { x: -30, y: 46 } ],
      torpedoTubes: [ { x: 44, y: 0 } ],
      repairRate: 2.0,
      preferredRangeKm: 6,
      visual: { kind: "vector", drawer: "klingon_bird_of_prey", sprite: null, scale: 1.0, length: 100, width: 96,
        hardpoints: {
          weapons:   [ { x: -30, y: -46, r: 9 }, { x: -30, y: 46, r: 9 } ],
          torpedoes: [ { x: 52, y: 0, r: 7 } ],
          engines:   [ { x: -32, y: 0, r: 9 } ],
          shields:   [ { x: -8, y: 0, r: 9 } ],
          sensors:   [ { x: 24, y: 0, r: 7 } ],
          bridge:    [ { x: 40, y: 0, r: 7 } ],
        } },
    },
    // --- stubs for PR C (stats only, drawers fall back to constitution) ---
    miranda:   { id: "miranda", name: "USS Reliant", className: "Miranda class", role: "Light cruiser", faction: "federation", cost: 800, purchasable: true, hull: 800, shields: { max: 320, regen: 7 }, speed: 100, turnRate: 100, signature: 340, sensorStrength: 11, lockRangeKm: 40, capacitor: { max: 360, rechargeTime: 50 }, slots: { high: 3, mid: 2, low: 2 }, powergrid: 95, cpu: 105, fit: { high: ["phaser_bank", "phaser_bank", "torpedo_launcher"], mid: ["shield_booster", "afterburner"], low: ["damage_amp", "power_relay"] }, subsystems: { weapons: 100, torpedoes: 100, engines: 100, shields: 100, sensors: 100, bridge: 100 }, phaserMounts: [ { x: 30, y: -12 }, { x: 30, y: 12 } ], torpedoTubes: [ { x: 0, y: 0 } ], repairRate: 3, preferredRangeKm: 7, visual: { kind: "vector", drawer: "federation_constitution", sprite: null, scale: 0.9, length: 100, width: 64 } },
    defiant:   { id: "defiant", name: "USS Defiant", className: "Defiant class", role: "Escort", faction: "federation", cost: 2400, purchasable: true, hull: 900, shields: { max: 300, regen: 8 }, speed: 130, turnRate: 140, signature: 220, sensorStrength: 13, lockRangeKm: 40, capacitor: { max: 300, rechargeTime: 40 }, slots: { high: 4, mid: 2, low: 1 }, powergrid: 100, cpu: 100, fit: { high: ["phaser_bank", "phaser_bank", "phaser_bank", "torpedo_launcher"], mid: ["shield_hardener", "afterburner"], low: ["damage_amp"] }, subsystems: { weapons: 100, torpedoes: 100, engines: 100, shields: 100, sensors: 100, bridge: 100 }, phaserMounts: [ { x: 30, y: -12 }, { x: 30, y: 12 } ], torpedoTubes: [ { x: 30, y: 0 } ], repairRate: 3, preferredRangeKm: 5, visual: { kind: "vector", drawer: "federation_constitution", sprite: null, scale: 0.7, length: 80, width: 50 } },
    excelsior: { id: "excelsior", name: "USS Excelsior", className: "Excelsior class", role: "Heavy cruiser", faction: "federation", cost: 3200, purchasable: true, hull: 1300, shields: { max: 450, regen: 8 }, speed: 95, turnRate: 80, signature: 450, sensorStrength: 13, lockRangeKm: 50, capacitor: { max: 500, rechargeTime: 60 }, slots: { high: 4, mid: 3, low: 2 }, powergrid: 140, cpu: 140, fit: { high: ["phaser_bank", "phaser_bank", "torpedo_launcher", "torpedo_launcher"], mid: ["shield_booster", "shield_hardener", "afterburner"], low: ["damage_amp", "power_relay"] }, subsystems: { weapons: 100, torpedoes: 100, engines: 100, shields: 100, sensors: 100, bridge: 100 }, phaserMounts: [ { x: 36, y: -14 }, { x: 36, y: 14 } ], torpedoTubes: [ { x: 4, y: 0 } ], repairRate: 4, preferredRangeKm: 8, visual: { kind: "vector", drawer: "federation_constitution", sprite: null, scale: 1.1, length: 124, width: 74 } },
    galaxy:    { id: "galaxy", name: "USS Galaxy", className: "Galaxy class", role: "Explorer", faction: "federation", cost: 5600, purchasable: true, hull: 1800, shields: { max: 600, regen: 10 }, speed: 85, turnRate: 60, signature: 600, sensorStrength: 14, lockRangeKm: 55, capacitor: { max: 700, rechargeTime: 70 }, slots: { high: 4, mid: 4, low: 3 }, powergrid: 190, cpu: 180, fit: { high: ["phaser_bank", "phaser_bank", "phaser_bank", "torpedo_launcher"], mid: ["shield_booster", "shield_booster", "shield_hardener", "sensor_booster"], low: ["damage_amp", "power_relay", "hull_plating"] }, subsystems: { weapons: 100, torpedoes: 100, engines: 100, shields: 100, sensors: 100, bridge: 100 }, phaserMounts: [ { x: 40, y: -18 }, { x: 40, y: 18 } ], torpedoTubes: [ { x: 4, y: 0 } ], repairRate: 5, preferredRangeKm: 9, visual: { kind: "vector", drawer: "federation_constitution", sprite: null, scale: 1.3, length: 146, width: 90 } },
    sovereign: { id: "sovereign", name: "USS Sovereign", className: "Sovereign class", role: "Battleship", faction: "federation", cost: 8000, purchasable: true, hull: 2000, shields: { max: 650, regen: 11 }, speed: 100, turnRate: 75, signature: 520, sensorStrength: 15, lockRangeKm: 60, capacitor: { max: 800, rechargeTime: 70 }, slots: { high: 5, mid: 4, low: 3 }, powergrid: 220, cpu: 200, fit: { high: ["phaser_bank", "phaser_bank", "phaser_bank", "torpedo_launcher", "torpedo_launcher"], mid: ["shield_booster", "shield_hardener", "afterburner", "sensor_booster"], low: ["damage_amp", "damage_amp", "power_relay"] }, subsystems: { weapons: 100, torpedoes: 100, engines: 100, shields: 100, sensors: 100, bridge: 100 }, phaserMounts: [ { x: 40, y: -16 }, { x: 40, y: 16 } ], torpedoTubes: [ { x: 8, y: 0 } ], repairRate: 5, preferredRangeKm: 9, visual: { kind: "vector", drawer: "federation_constitution", sprite: null, scale: 1.25, length: 140, width: 80 } },
  },

  // ------------------------------------------------------------------- crew
  // Officers no longer gate orders; they report, warn and add flavour.
  crew: {
    officers: {
      helm:        { name: "Lt. Sulu",   title: "Helm",        color: "var(--c-blue)" },
      tactical:    { name: "Lt. Worf",   title: "Tactical",    color: "var(--c-orange)" },
      engineering: { name: "Cdr. Scott", title: "Engineering", color: "var(--c-purple)" },
      comms:       { name: "Lt. Uhura",  title: "Comms",       color: "var(--c-peach)" },
    },
    reports: {
      approach: "Approaching the target, Captain.",
      orbit: "Orbiting at {range} kilometres.",
      keepRange: "Holding range at {range} kilometres.",
      flyTo: "Coming to new heading.",
      stop: "All stop.",
      comeAbout: "Coming about, presenting our {facing} shields.",
      comeAbout_aft: "Presenting our aft shields, Captain. Phasers won't bear like this.",
      lockStart: "Acquiring lock on {name}.",
      lockDone: "Target locked, Captain.",
      lockLost: "Lock lost. Target is out of sensor range.",
      unlock: "Target released.",
      lockNoTarget: "No target selected, Captain.",
      lockOutOfRange: "Target is beyond sensor range. Close to {range} kilometres.",
      targetHull: "Targeting their hull, Captain. Full accuracy.",
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
      hail: "Hailing the Klingon vessel... they're responding, Captain.",
      hail_noResponse: "No response, Captain. They've cut the channel.",
      targetShielded: "Their {facing} shields are absorbing it, Captain. We need to drop that shield to reach their {label}.",
      targetExposed: "Their {facing} shields are down. Hitting their {label} now, Captain!",
    },
    events: {
      battleStart: [
        { officer: "tactical", text: "Klingon Bird-of-Prey on sensors, Captain, 38 kilometres and closing. They're powering weapons." },
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
      enemyDestroyed: "Enemy vessel destroyed, Captain.",
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

  // --------------------------------------------------------------- enemy AI
  enemyAI: {
    default: {
      accuracyMult: 0.85, reactionDelay: 1.2, statMult: 0.95,
      retreatHull: 0.28, retreatMinTime: 9, retreatMaxTime: 22,
      repositionShield: 0.22, repositionDuration: 5,
      orbitRangeKm: 6, retreatRangeKm: 22,
      boosterBelow: 0.55, boosterMinCap: 0.3, afterburnerMinCap: 0.25,
      targetWeights: { weapons: 0.3, shields: 0.2, engines: 0.15, torpedoes: 0.1, sensors: 0.15, bridge: 0.1 },
    },
  },

  // ------------------------------------------------------------- PR B/C data
  // Shapes are defined now so logic never changes when the features arrive.
  upgrades: {
    phasers:       { name: "Phaser arrays",   tiers: [ { cost: 0 }, { cost: 300, damageMult: 1.15 }, { cost: 700, damageMult: 1.3, cycleMult: 0.9 }, { cost: 1500, damageMult: 1.5, cycleMult: 0.8 } ] },
    torpedoes:     { name: "Torpedo launchers", tiers: [ { cost: 0 }, { cost: 300, damageMult: 1.15 }, { cost: 700, cycleMult: 0.85, damageMult: 1.25 }, { cost: 1500, cycleMult: 0.7, damageMult: 1.4 } ] },
    shields:       { name: "Shield grid",     tiers: [ { cost: 0 }, { cost: 350, maxMult: 1.15 }, { cost: 800, maxMult: 1.3, regenMult: 1.2 }, { cost: 1600, maxMult: 1.5, regenMult: 1.4 } ] },
    warpCore:      { name: "Warp core",       tiers: [ { cost: 0 }, { cost: 400, capMult: 1.15 }, { cost: 900, capMult: 1.3 }, { cost: 1800, capMult: 1.5 } ] },
    engines:       { name: "Impulse engines", tiers: [ { cost: 0 }, { cost: 250, speedMult: 1.1, turnMult: 1.1 }, { cost: 600, speedMult: 1.2, turnMult: 1.25 }, { cost: 1200, speedMult: 1.35, turnMult: 1.4 } ] },
    hull:          { name: "Hull plating",    tiers: [ { cost: 0 }, { cost: 300, hullMult: 1.15 }, { cost: 700, hullMult: 1.3 }, { cost: 1400, hullMult: 1.5 } ] },
    damageControl: { name: "Damage control",  tiers: [ { cost: 0 }, { cost: 200, repairMult: 1.25 }, { cost: 500, repairMult: 1.5 }, { cost: 1000, repairMult: 2.0 } ] },
  },

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
    credits: { win: 500, loss: 100, damageTakenPenaltyPerPct: 3 },
    missions: [
      { id: "m1", name: "Border skirmish", enemyClass: "bird_of_prey", difficulty: "default", briefing: "A lone Bird-of-Prey is raiding the Archanis sector." },
    ],
  },

  science: { scanDuration: 4, weaknessBonus: 1.25, cloakDetectRangeKm: 10 },

  saveDefaults: {
    version: 2, credits: 0, shipClass: "constitution", ownedShips: ["constitution"],
    fits: { constitution: null },      // null = class default fit
    inventory: [],                     // module ids owned but not fitted
    upgrades: { phasers: 0, torpedoes: 0, shields: 0, warpCore: 0, engines: 0, hull: 0, damageControl: 0 },
    skills: { gunnery: 0, missiles: 0, navigation: 0, shields: 0, capacitor: 0, targeting: 0, training: null },
    campaign: { missionIndex: 0, battlesWon: 0, battlesLost: 0 },
    settings: { sound: true, screenShake: true },
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
  },
};
