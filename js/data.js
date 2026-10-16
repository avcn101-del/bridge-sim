// js/data.js — every tunable number in the game lives here.
// Game logic reads from BS.Data and never hard-codes balance values.
window.BS = window.BS || {};

BS.Data = {
  version: "0.2.0",

  // ---------------------------------------------------------------- balance
  balance: {
    simStep: 1 / 60,
    maxFrameTime: 0.1,
    shieldBleedThrough: 0.15,     // fraction of absorbed shield damage that still leaks to hull
    subsystemDamageFactor: 0.45,  // hull damage × this = subsystem damage on an untargeted (random) hit
    targetedSubsystemDamageFactor: 0.7, // same for a hit on the subsystem Tactical is targeting
    subsystemHitChance: 0.5,      // chance an untargeted hull hit also damages a random subsystem
    hullSmokeThreshold: 0.5,      // below this hull fraction the ship vents/burns
    hullRepairRate: 0.8,          // hull hp/s patched by damage control once every subsystem is at 100
    cameraLerp: 0.06,
    noAlertShieldRegenMult: 0.5,  // shield regen when no alert is set
    redAlertRegenBonus: 1.1,
    evasiveIncomingAccuracy: 0.65, // enemy accuracy multiplier when this ship is evasive
    evasiveOwnAccuracy: 0.8,       // own accuracy multiplier while evasive
    destroyedEndDelay: 2.6,        // seconds between destruction and result screen
    reinforceFraction: 0.45,       // fraction of strongest facing moved to weakest
    reinforceDuration: 3.0,        // seconds the transfer takes
    hitRadiusFactor: 0.42,         // ship length × this = torpedo hit radius
    arenaStartDistance: 760,       // enemy spawn distance from player
  },

  // ------------------------------------------------------------ subsystems
  // Order here is the order of buttons and status rows. Each ship class has
  // health 0..100 for every id listed. Effects are applied in ships.js.
  subsystems: {
    weapons:   { label: "Phasers",   short: "PHA", effect: "phaser damage and recharge",
                 targetReport: "Locking phasers on their phaser banks.",
                 damaged: "Phaser banks hit! Our phaser power is dropping.", repaired: "Phaser banks repaired, Captain." },
    torpedoes: { label: "Torpedoes", short: "TOR", effect: "torpedo reload speed",
                 targetReport: "Targeting their torpedo launcher, Captain.",
                 damaged: "Torpedo launcher damaged! Reload times are up.", repaired: "Torpedo launcher back online." },
    engines:   { label: "Engines",   short: "ENG", effect: "speed and turn rate",
                 targetReport: "Targeting their engines, Captain.",
                 damaged: "Impulse engines damaged! We're losing maneuverability.", repaired: "Impulse engines back to full, Captain." },
    shields:   { label: "Shields",   short: "SHD", effect: "shield regeneration",
                 targetReport: "Targeting their shield generators.",
                 damaged: "Shield generators hit! Regeneration is down.", repaired: "Shield generators repaired." },
    sensors:   { label: "Sensors",   short: "SEN", effect: "weapon accuracy",
                 targetReport: "Targeting their sensor array. That'll spoil their aim.",
                 damaged: "Sensor array damaged! Targeting accuracy is degraded.", repaired: "Sensors recalibrated, Captain." },
    bridge:    { label: "Bridge",    short: "BRG", effect: "crew reaction time",
                 targetReport: "Targeting their bridge, Captain. Precision shot.",
                 damaged: "Direct hit on the bridge! Casualties reported, orders are getting through slowly.", repaired: "Bridge systems restored, Captain." },
  },
  subsystemEffects: {
    sensorsAccuracyFloor: 0.7,   // accuracy multiplier at 0 sensor health
    bridgeDelayMaxMult: 1.8,     // order / reaction delay multiplier at 0 bridge health
    targetAccuracyMult: 0.85,    // hit chance multiplier while a subsystem is targeted
  },

  // ---------------------------------------------------------- power presets
  powerPresets: {
    balanced: { weapons: 0.34, shields: 0.33, engines: 0.33 },
    weapons:  { weapons: 0.50, shields: 0.25, engines: 0.25 },
    shields:  { weapons: 0.25, shields: 0.50, engines: 0.25 },
    engines:  { weapons: 0.25, shields: 0.25, engines: 0.50 },
  },
  // multiplier = base + powerFraction × slope (balanced ≈ 1.0)
  powerCurve: {
    weapons: { base: 0.5, slope: 1.5 },   // damage and recharge speed
    shields: { base: 0.3, slope: 2.1 },   // regen rate
    engines: { base: 0.6, slope: 1.2 },   // speed, turn rate
  },
  // subsystem health 0..100 → multiplier = floor + (1-floor) × health/100
  subsystemFloor: 0.4,

  // ---------------------------------------------------------------- weapons
  weapons: {
    phaser_mk1: {
      type: "phaser", name: "Type-IX phaser array",
      damage: 20, cooldown: 2.6, range: 440, optimalRange: 260, falloff: 0.5,
      arc: 270, accuracy: 0.92, beamLife: 0.4,
      color: "#ff8a3d", coreColor: "#fff3e0",
    },
    photon_mk1: {
      type: "torpedo", name: "Photon torpedo",
      damage: 95, reload: 11, speed: 240, range: 640, arc: 70,
      accuracy: 0.78, spread: 2, spreadDelay: 0.3, turnRate: 160,
      color: "#ffb347", coreColor: "#ffffff",
    },
    disruptor_mk1: {
      type: "phaser", name: "Disruptor cannon",
      damage: 44, cooldown: 2.6, range: 420, optimalRange: 240, falloff: 0.5,
      arc: 200, accuracy: 0.88, beamLife: 0.35,
      color: "#5cff6a", coreColor: "#e8ffe8",
    },
    klingon_torpedo: {
      type: "torpedo", name: "Klingon photon torpedo",
      damage: 150, reload: 12, speed: 220, range: 600, arc: 80,
      accuracy: 0.72, spread: 1, spreadDelay: 0.3, turnRate: 140,
      color: "#ff4d4d", coreColor: "#ffe6e6",
    },
  },

  // ----------------------------------------------------------- ship classes
  // Every class shares this shape. Later classes (Miranda, Defiant, Excelsior,
  // Galaxy, Sovereign) are stubbed with stats and will get drawers in v0.5.
  shipClasses: {
    constitution: {
      id: "constitution", name: "USS Constitution", className: "Constitution class",
      role: "Heavy cruiser", faction: "federation", cost: 0, purchasable: true,
      hull: 1000,
      shields: { max: 380, regen: 7 },
      speed: 95, turnRate: 65,
      subsystems: { weapons: 100, torpedoes: 100, engines: 100, shields: 100, sensors: 100, bridge: 100 },
      weapons: { phasers: "phaser_mk1", torpedoes: "photon_mk1" },
      phaserMounts: [ { x: 34, y: -14 }, { x: 34, y: 14 } ],
      torpedoTubes: [ { x: 4, y: 0 } ],
      repairRate: 3.5,
      preferredRange: 250, closeRange: 150, openRange: 470,
      visual: { kind: "vector", drawer: "federation_constitution", sprite: null, scale: 1.0, length: 112, width: 70,
        // clickable hardpoints in ship-local coordinates (x forward, y starboard)
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
      shields: { max: 330, regen: 6 },
      speed: 105, turnRate: 80,
      subsystems: { weapons: 100, torpedoes: 100, engines: 100, shields: 100, sensors: 100, bridge: 100 },
      weapons: { phasers: "disruptor_mk1", torpedoes: "klingon_torpedo" },
      phaserMounts: [ { x: -30, y: -46 }, { x: -30, y: 46 } ],
      torpedoTubes: [ { x: 44, y: 0 } ],
      repairRate: 2.0,
      preferredRange: 240, closeRange: 140, openRange: 520,
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
    // --- stubs for v0.5 (stats only, drawers fall back to constitution) ---
    miranda:   { id: "miranda", name: "USS Reliant", className: "Miranda class", role: "Light cruiser", faction: "federation", cost: 800, purchasable: true, hull: 800, shields: { max: 320, regen: 7 }, speed: 100, turnRate: 75, subsystems: { weapons: 100, torpedoes: 100, engines: 100, shields: 100, sensors: 100, bridge: 100 }, weapons: { phasers: "phaser_mk1", torpedoes: "photon_mk1" }, phaserMounts: [ { x: 30, y: -12 }, { x: 30, y: 12 } ], torpedoTubes: [ { x: 0, y: 0 } ], repairRate: 3, preferredRange: 250, closeRange: 150, openRange: 470, visual: { kind: "vector", drawer: "federation_constitution", sprite: null, scale: 0.9, length: 100, width: 64 } },
    defiant:   { id: "defiant", name: "USS Defiant", className: "Defiant class", role: "Escort", faction: "federation", cost: 2400, purchasable: true, hull: 900, shields: { max: 300, regen: 8 }, speed: 130, turnRate: 110, subsystems: { weapons: 100, torpedoes: 100, engines: 100, shields: 100, sensors: 100, bridge: 100 }, weapons: { phasers: "phaser_mk1", torpedoes: "photon_mk1" }, phaserMounts: [ { x: 30, y: -12 }, { x: 30, y: 12 } ], torpedoTubes: [ { x: 30, y: 0 } ], repairRate: 3, preferredRange: 200, closeRange: 120, openRange: 420, visual: { kind: "vector", drawer: "federation_constitution", sprite: null, scale: 0.7, length: 80, width: 50 } },
    excelsior: { id: "excelsior", name: "USS Excelsior", className: "Excelsior class", role: "Heavy cruiser", faction: "federation", cost: 3200, purchasable: true, hull: 1300, shields: { max: 450, regen: 8 }, speed: 95, turnRate: 55, subsystems: { weapons: 100, torpedoes: 100, engines: 100, shields: 100, sensors: 100, bridge: 100 }, weapons: { phasers: "phaser_mk1", torpedoes: "photon_mk1" }, phaserMounts: [ { x: 36, y: -14 }, { x: 36, y: 14 } ], torpedoTubes: [ { x: 4, y: 0 } ], repairRate: 4, preferredRange: 260, closeRange: 160, openRange: 480, visual: { kind: "vector", drawer: "federation_constitution", sprite: null, scale: 1.1, length: 124, width: 74 } },
    galaxy:    { id: "galaxy", name: "USS Galaxy", className: "Galaxy class", role: "Explorer", faction: "federation", cost: 5600, purchasable: true, hull: 1800, shields: { max: 600, regen: 10 }, speed: 85, turnRate: 45, subsystems: { weapons: 100, torpedoes: 100, engines: 100, shields: 100, sensors: 100, bridge: 100 }, weapons: { phasers: "phaser_mk1", torpedoes: "photon_mk1" }, phaserMounts: [ { x: 40, y: -18 }, { x: 40, y: 18 } ], torpedoTubes: [ { x: 4, y: 0 } ], repairRate: 5, preferredRange: 280, closeRange: 170, openRange: 500, visual: { kind: "vector", drawer: "federation_constitution", sprite: null, scale: 1.3, length: 146, width: 90 } },
    sovereign: { id: "sovereign", name: "USS Sovereign", className: "Sovereign class", role: "Battleship", faction: "federation", cost: 8000, purchasable: true, hull: 2000, shields: { max: 650, regen: 11 }, speed: 100, turnRate: 55, subsystems: { weapons: 100, torpedoes: 100, engines: 100, shields: 100, sensors: 100, bridge: 100 }, weapons: { phasers: "phaser_mk1", torpedoes: "photon_mk1" }, phaserMounts: [ { x: 40, y: -16 }, { x: 40, y: 16 } ], torpedoTubes: [ { x: 8, y: 0 } ], repairRate: 5, preferredRange: 280, closeRange: 170, openRange: 500, visual: { kind: "vector", drawer: "federation_constitution", sprite: null, scale: 1.25, length: 140, width: 80 } },
  },

  // ------------------------------------------------------------------- crew
  crew: {
    officers: {
      helm:        { name: "Lt. Sulu",   title: "Helm",        color: "var(--c-blue)" },
      tactical:    { name: "Lt. Worf",   title: "Tactical",    color: "var(--c-orange)" },
      engineering: { name: "Cdr. Scott", title: "Engineering", color: "var(--c-purple)" },
      comms:       { name: "Lt. Uhura",  title: "Comms",       color: "var(--c-peach)" },
    },
    acks: {
      helm:        ["Aye, Captain.", "Aye, sir.", "Helm answering."],
      tactical:    ["Aye, Captain.", "Understood.", "Tactical, aye."],
      engineering: ["Aye, Captain.", "Working on it, Captain.", "Engineering, aye."],
      comms:       ["Aye, Captain."],
    },
    // seconds from acknowledgement to execution
    orderDelays: {
      attackPattern: 1.0, evasive: 0.8, closeRange: 0.9, openRange: 0.9, comeAbout: 1.2,
      target: 0.6, targetHull: 0.4,
      firePhasers: 0.5, fireTorpedoes: 0.8, fireAtWill: 0.6, holdFire: 0.4,
      powerBalanced: 1.2, powerWeapons: 1.2, powerShields: 1.2, powerEngines: 1.2,
      repair: 1.0, repairAuto: 1.0,
      reinforceShields: 1.4,
      redAlert: 0.5, yellowAlert: 0.5, hail: 1.5,
    },
    redAlertDelayMult: 0.8,
    reports: {
      attackPattern: "Coming to attack pattern Delta. Closing to firing range.",
      evasive: "Evasive maneuvers, pattern Omega. Hold on to something.",
      closeRange: "Closing to point-blank range, Captain.",
      openRange: "Opening the range. Pulling us out to the edge of their envelope.",
      comeAbout: "Coming about, presenting our {facing} shields to the enemy.",
      comeAbout_aft: "Coming about, presenting our aft shields. Captain, we'll have no weapons on target like this.",
      comeAbout_already: "We're already presenting our strongest shield, Captain. Holding position.",
      target: "Targeting their {label}, Captain.",      // fallback; subsystems[x].targetReport wins
      targetHull: "Targeting their hull, Captain. Full accuracy.",
      firePhasers: "Phasers firing.",
      firePhasers_charging: "Phasers recharging. Firing as soon as they're ready.",
      firePhasers_notArmed: "Weapons aren't armed, Captain. Recommend we go to alert status.",
      firePhasers_outOfRange: "Target is out of phaser range, Captain.",
      fireTorpedoes: "Torpedoes away, Captain.",
      fireTorpedoes_loading: "Tubes are still loading. Torpedoes will launch when ready.",
      fireTorpedoes_notArmed: "Weapons aren't armed, Captain. Recommend we go to alert status.",
      fireTorpedoes_noArc: "Target's outside the forward firing arc. Helm needs to bring us around.",
      fireAtWill_on: "Firing at will, Captain. All weapons on automatic.",
      fireAtWill_off: "Weapons back on manual, Captain.",
      holdFire: "Holding fire.",
      powerBalanced: "Power rebalanced across all systems.",
      powerWeapons: "Diverting power to weapons. Phasers will hit harder and recharge faster.",
      powerShields: "Routing extra power to the shield grid.",
      powerEngines: "Power to engines. She'll turn like a shuttlecraft now.",
      repair: "Damage control teams to the {label}, Captain.",
      repairAuto: "Damage control on automatic priority, Captain.",
      reinforceShields: "Reinforcing the {weak} shield from the {strong} grid.",
      reinforceShields_none: "Shields are already balanced, Captain.",
      redAlert: "Red alert. Shields up, weapons armed. All hands to battle stations.",
      yellowAlert: "Yellow alert. Shields up, weapons armed.",
      hail: "Hailing the Klingon vessel... they're responding, Captain.",
      hail_noResponse: "No response, Captain. They've cut the channel.",
    },
    // officer who reports each order
    orderOfficer: {
      attackPattern: "helm", evasive: "helm", closeRange: "helm", openRange: "helm", comeAbout: "helm",
      target: "tactical", targetHull: "tactical",
      firePhasers: "tactical", fireTorpedoes: "tactical", fireAtWill: "tactical", holdFire: "tactical",
      powerBalanced: "engineering", powerWeapons: "engineering", powerShields: "engineering", powerEngines: "engineering",
      repair: "engineering", repairAuto: "engineering",
      reinforceShields: "engineering",
      redAlert: "tactical", yellowAlert: "tactical", hail: "comms",
    },
    // spontaneous situation reports
    events: {
      battleStart: [
        { officer: "tactical", text: "Klingon Bird-of-Prey decloaking off the bow, Captain. They're powering weapons." },
        { officer: "helm",     text: "Standing by for orders, Captain." },
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
      weaponsAutoArm: "Weapons armed, Captain.",
      enemyFiringTorpedo: "Incoming torpedo!",
      targetShielded: "Their {facing} shields are absorbing it, Captain. We need to drop that shield to reach their {label}.",
      targetExposed: "Their {facing} shields are down. Hitting their {label} now, Captain!",
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
      accuracyMult: 0.85, reactionDelay: 1.2, statMult: 0.85,
      retreatHull: 0.28, retreatMinTime: 9, retreatMaxTime: 22,
      repositionShield: 0.22, repositionDuration: 5,
      preferredRange: 240,
      targetWeights: { weapons: 0.3, shields: 0.2, engines: 0.15, torpedoes: 0.1, sensors: 0.15, bridge: 0.1 },
      taunts: ["The Klingon captain laughs over an open channel."],
    },
    // v0.2 difficulty selector will add easy / hard profiles here.
  },

  // ------------------------------------------------------------- v0.2+ data
  // Shapes are defined now so logic never changes when the features arrive.
  upgrades: {
    phasers:       { name: "Phaser arrays",   tiers: [ { cost: 0 }, { cost: 300, damageMult: 1.15 }, { cost: 700, damageMult: 1.3, cooldownMult: 0.9 }, { cost: 1500, damageMult: 1.5, cooldownMult: 0.8 } ] },
    torpedoes:     { name: "Torpedo launchers", tiers: [ { cost: 0 }, { cost: 300, damageMult: 1.15 }, { cost: 700, reloadMult: 0.85, damageMult: 1.25 }, { cost: 1500, reloadMult: 0.7, damageMult: 1.4 } ] },
    shields:       { name: "Shield grid",     tiers: [ { cost: 0 }, { cost: 350, maxMult: 1.15 }, { cost: 800, maxMult: 1.3, regenMult: 1.2 }, { cost: 1600, maxMult: 1.5, regenMult: 1.4 } ] },
    warpCore:      { name: "Warp core",       tiers: [ { cost: 0 }, { cost: 400, totalPower: 1.15 }, { cost: 900, totalPower: 1.3 }, { cost: 1800, totalPower: 1.5 } ] },
    engines:       { name: "Impulse engines", tiers: [ { cost: 0 }, { cost: 250, speedMult: 1.1, turnMult: 1.1 }, { cost: 600, speedMult: 1.2, turnMult: 1.25 }, { cost: 1200, speedMult: 1.35, turnMult: 1.4 } ] },
    hull:          { name: "Hull plating",    tiers: [ { cost: 0 }, { cost: 300, hullMult: 1.15 }, { cost: 700, hullMult: 1.3 }, { cost: 1400, hullMult: 1.5 } ] },
    damageControl: { name: "Damage control",  tiers: [ { cost: 0 }, { cost: 200, repairMult: 1.25 }, { cost: 500, repairMult: 1.5 }, { cost: 1000, repairMult: 2.0 } ] },
  },

  crewXP: {
    levels: [
      { name: "Ensign",     xp: 0,   delayMult: 1.0,  accuracyBonus: 0,    repairMult: 1.0 },
      { name: "Lieutenant", xp: 100, delayMult: 0.9,  accuracyBonus: 0.02, repairMult: 1.1 },
      { name: "Lt. Cdr.",   xp: 300, delayMult: 0.8,  accuracyBonus: 0.04, repairMult: 1.25 },
      { name: "Commander",  xp: 700, delayMult: 0.7,  accuracyBonus: 0.06, repairMult: 1.4 },
    ],
    xpPerBattle: { win: 50, loss: 15, perDamageDealt: 0.02 },
  },

  campaign: {
    credits: { win: 500, loss: 100, damageTakenPenaltyPerPct: 3 },
    missions: [
      { id: "m1", name: "Border skirmish", enemyClass: "bird_of_prey", difficulty: "default", briefing: "A lone Bird-of-Prey is raiding the Archanis sector." },
    ],
  },

  science: { scanDuration: 4, weaknessBonus: 1.25, cloakDetectRange: 200 },

  saveDefaults: {
    version: 1, credits: 0, shipClass: "constitution", ownedShips: ["constitution"],
    upgrades: { phasers: 0, torpedoes: 0, shields: 0, warpCore: 0, engines: 0, hull: 0, damageControl: 0 },
    crew: { helm: { xp: 0 }, tactical: { xp: 0 }, engineering: { xp: 0 }, science: { xp: 0 } },
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
