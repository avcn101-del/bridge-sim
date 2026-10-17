// js/data.js — every tunable number in the game lives here.
// Game logic reads from BS.Data and never hard-codes balance values.
window.BS = window.BS || {};

BS.Data = {
  version: "0.5.2",

  // ------------------------------------------------------------------ units
  // World space is pixels; the interface shows kilometres and km/s.
  units: { pxPerKm: 50 },

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
    destroyedEndDelay: 3.6,       // seconds between destruction and result screen (the hull breaks up first)
    reinforceFraction: 0.45,      // fraction of strongest facing moved to weakest
    reinforceDuration: 3.0,       // seconds the transfer takes
    reinforceCooldown: 20,        // seconds before Engineering can do it again
    arenaStartDistanceKm: 38,     // enemy spawn distance from player
    hitRadiusFactor: 0.45,
    // EVE-style capacitor: recharge/s = capMax / rechargeTime × capCurve × (sqrt(f) − f), f = fraction full (peaks at 25%)
    capCurve: 5,
    // lock time = lockBase × (lockRefSignature / target signature) × (lockRefSensor / own sensor strength)
    lockBase: 3.0, lockRefSignature: 300, lockRefSensor: 10,
    // turret hit chance = accuracy × 0.5 ^ ((angular / tracking)² + (max(0, d − optimal) / falloff)²)
    // torpedo damage mult = min(1, sig / explosionRadius, ((sig / explosionRadius) × (explosionVelocity / targetSpeed)) ^ 0.6)
    orbitRangesKm: [3, 6, 10, 15],
    keepRangesKm: [6, 10, 15],
    zoom: { min: 0.3, max: 2.0, step: 0.1, start: 0.8 },
  },

  // ---------------------------------------------------------- aim penalty
  subsystemEffects: { targetAccuracyMult: 0.85 },   // hit chance multiplier while aiming at a block type
  blockReports: {
    phaser:   { destroyed: "We've lost a phaser emitter, Captain!", aim: "Aiming for their phaser emitters." },
    torpedo:  { destroyed: "Torpedo tube destroyed!", aim: "Targeting their torpedo tubes." },
    shield:   { destroyed: "Shield emitter gone! That facing will be weaker.", aim: "Targeting their shield emitters." },
    reactor:  { destroyed: "Reactor breach! Capacitor capacity is down.", aim: "Targeting their reactors. Starve their power." },
    engine:   { destroyed: "Impulse engine destroyed! We're losing speed.", aim: "Targeting their engines." },
    sensor:   { destroyed: "Sensor array hit! Locks will take longer.", aim: "Targeting their sensors." },
    bridge:   { destroyed: "The bridge... ", aim: "Going for their bridge, Captain. Precision shot." },
    quarters: { destroyed: "Crew quarters hit. Casualties reported.", aim: "Targeting their crew decks." },
    armor:    { destroyed: "Armor plating blown off!", aim: "Targeting their armor." },
    structure: { destroyed: "Structural member lost!", aim: "" },
    cutOff:   "Section torn away, Captain! {n} blocks lost.",
  },

  // ------------------------------------------------------------------ grid
  // Ships are built from blocks on a hull-shaped cell grid (see shipClasses.*.mask).
  grid: {
    cellPx: 6,                    // world pixels per cell
    structureHp: 700,             // fixed structural cells (neck, pylons) — not editable, not counted as hull; tough, so a cut neck is a rare disaster
    shieldBase: 80,               // shield per facing before emitters
    shieldAdd: 70,                // per shield emitter on that facing
    regenBase: 0.6, regenAdd: 0.4,
    capBase: 80, capAdd: 80, capRechargeTime: 40,
    thrustPerPoint: 12,           // speed multiplier = thrustPoints × this / mass, clamped below
    nacelleThrustMult: 2,         // engine blocks in nacelle cells count double
    speedMultMin: 0.35, speedMultMax: 1.25,
    sensorBase: 8, sensorAdd: 2,
    repairBase: 0.6, repairAdd: 0.5,   // hp/s restored to damaged (not destroyed) blocks
    hitScatter: 1.0,              // shots land anywhere across the facing: sideways offset up to this × the hull half-extent
    penetration: 2,               // a beam can chew through up to this many blocks along its path
    torpedoSplash: { centre: 0.5, neighbour: 0.2 }, // torpedoes explode on the entry block and splash into its four neighbours
    aimRadius: 2,                 // cells searched around the entry block for the aimed block type
    aimScatter: 2.0,              // aimed shots wander ±this many cells around the aimed block's line, so a focused volley still has to clear a strip of armor
    deadFraction: 0.3,            // ship is lost when alive block hp falls below this fraction of total
    // random enemy variants: a fraction of the base layout's cells is re-rolled (armor → system, system → armor) and the result re-validated
    variant: { fraction: 0.12, attempts: 12, systemWeights: { phaser: 4, shield: 3, reactor: 2, engine: 2, armor: 6, quarters: 1, sensor: 1, torpedo: 1 } },
    maskLegend: { ".": "empty", "#": "fillable", "n": "nacelle (engine ×2)", "p": "structure (fixed)" },
    layoutLegend: { A: "armor", P: "phaser", T: "torpedo", S: "shield", R: "reactor", E: "engine", N: "sensor", B: "bridge", Q: "quarters" },
  },

  editor: {
    maxSavedBuilds: 3,            // named builds kept per hull in the save
    refund: 0.6,                  // fraction of a block's price refunded when a build removes it
  },

  // ---------------------------------------------------------------- blocks
  blocks: {
    armor:    { letter: "A", name: "Armor plating",   short: "AR", hp: 60, mass: 2, cost: 20,  color: "#a3aabb", desc: "Cheap and tough. Outer armor protects what is behind it." },
    phaser:   { letter: "P", name: "Phaser emitter",  short: "PH", hp: 50, mass: 2, cost: 120, color: "#ff8a3d", desc: "Beam weapon. Fires into the 180° arc facing away from the ship's centre.",
                weapon: { kind: "turret", damage: 24, cycle: 2.6, cap: 2.5, optimalKm: 8, falloffKm: 7, tracking: 0.9, accuracy: 0.95, arc: 180, color: "#ff8a3d", coreColor: "#fff3e0", beamLife: 0.4 } },
    torpedo:  { letter: "T", name: "Torpedo tube",    short: "TT", hp: 50, mass: 3, cost: 180, color: "#ffb347", desc: "Heavy warhead, slow reload. Fires into the 220° arc facing away from the ship's centre: mount tubes where you want to shoot.",
                weapon: { kind: "launcher", damage: 150, cycle: 11, cap: 14, rangeKm: 30, speedKmS: 4, explosionRadius: 280, explosionVelocity: 1.5, turnRate: 160, arc: 220, color: "#ffb347", coreColor: "#ffffff" } },
    shield:   { letter: "S", name: "Shield emitter",  short: "SH", hp: 40, mass: 2, cost: 90,  color: "#6fb6ff", desc: "+70 shield and +0.4/s regen on the facing it sits on." },
    reactor:  { letter: "R", name: "Reactor",         short: "RE", hp: 40, mass: 3, cost: 100, color: "#f2c14e", desc: "+80 capacitor. Losing reactors starves your modules." },
    engine:   { letter: "E", name: "Impulse engine",  short: "EN", hp: 45, mass: 2, cost: 80,  color: "#7fd8ff", desc: "Thrust. Counts double inside nacelles. Speed = thrust / mass." },
    sensor:   { letter: "N", name: "Sensor array",    short: "SE", hp: 35, mass: 1, cost: 110, color: "#cc99cc", desc: "Faster locks and better tracking." },
    bridge:   { letter: "B", name: "Bridge",          short: "BR", hp: 200, mass: 2, cost: 0,   color: "#ffffff", unique: true, desc: "Exactly one. If it dies, the ship is lost. Blocks cut off from it break away." },
    quarters: { letter: "Q", name: "Crew quarters",   short: "CQ", hp: 35, mass: 1, cost: 40,  color: "#d3bfa6", desc: "+0.5 hp/s damage-control repair of damaged blocks." },
  },

  // ---------------------------------------------------------------- modules
  // Weapon groups come from blocks; the three active systems are built into every ship.
  modules: {
    phaser_group:  { kind: "turretGroup",   block: "phaser",  name: "Phaser emitters", short: "PHA", desc: "All phaser emitters fire at the locked target when their arc allows." },
    torpedo_group: { kind: "launcherGroup", block: "torpedo", name: "Torpedo tubes",   short: "TOR", desc: "All tubes fire forward at the locked target." },
    shield_booster: { kind: "active", name: "Shield booster", short: "SB", cycle: 4, cap: 32, effect: { shieldBoost: 50 }, desc: "Each cycle restores 50 shield to the weakest facing. Expensive on capacitor: pulse it." },
    shield_hardener: { kind: "active", name: "Shield hardener", short: "SH", cycle: 8, cap: 7, effect: { shieldResist: 0.3 }, desc: "While running, shields take 30% less damage." },
    afterburner: { kind: "active", name: "Afterburner", short: "AB", cycle: 8, cap: 16, effect: { speedMult: 1.5 }, desc: "+50% speed while running. Higher angular velocity makes enemy beams miss." },
  },
  builtInModules: ["shield_booster", "shield_hardener", "afterburner"],

  // ----------------------------------------------------------- ship classes
  // mask: hull shape (see grid.maskLegend). layout: default build (grid.layoutLegend).
  // Stats are derived from blocks; the class gives the base speed, turn and signature.
  shipClasses: {
    constitution: {
      id: "constitution", name: "USS Constitution", className: "Constitution class",
      role: "Heavy cruiser", faction: "federation", cost: 0, purchasable: true,
      speed: 95, turnRate: 90, signature: 400, lockRangeKm: 45,
      preferredRangeKm: 7,
      mask: [
        "..........................",
        ".nnnnnnnnn.........#......",
        ".nnnnnnnnn......#######...",
        ".....pp........#########..",
        ".....pp.......###########.",
        ".....pp##.....###########.",
        "...##pp#####.#############",
        "..##########ppp###########",
        "..##########ppp###########",
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
        ".EEEEEAAAA.........A......",
        ".EEEEEAAAA......AAAPAAA...",
        "...............ASAAAASAA..",
        "..............SPAAAAAAAPA.",
        ".......AA.....AAAAAAQAAAA.",
        "...AA..AAAAA.AAAAAQAAAANAA",
        "..ASAAAAAAAA...ARRAARAAATP",
        "..ASAAAAAAAA...ARRBARAAATP",
        "...AA..AAAAA.AAAAAQAAAANAA",
        ".......AA.....AAAAAAQAAAA.",
        "..............SPAAAAAAAPA.",
        "...............ASAAAASAA..",
        ".EEEEEAAAA......AAAPAAA...",
        ".EEEEEAAAA.........A......",
        ".........................."
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "90,160,255", hullTint: "#c6ccda" },
      presets: {
        brawler: { name: "Brawler", desc: "Fourteen phaser emitters, armored bow, three tubes. Orbit close.", rows: [
          "..........................",
          ".EEEEEAAAA.........A......",
          ".EEEEEAAAA......APAPAAA...",
          "...............ASAAAASAA..",
          "..............SPAAAAAAAPA.",
          ".......AA.....PAAAAAQAAAA.",
          "...AA..AAAAA.AAAAAQAAAANAP",
          "..ASAAAAAAAA...ARRAARAAATP",
          "..ASAAAAAAAA...ARRBARAAATP",
          "...AA..AAAAA.AAAAAQAAAANTP",
          ".......AA.....PAAAAAQAANA.",
          "..............SPAAAAAAAPA.",
          "...............ASAAAASAA..",
          ".EEEEEAAAA......APAPAAA...",
          ".EEEEEAAAA.........A......",
          ".........................."
        ] },
        sniper: { name: "Sniper", desc: "Four torpedo tubes, extra sensors and engines, four phasers. Keep at range.", rows: [
          "..........................",
          ".EEEEEEEEA.........A......",
          ".EEEEEEEEA......AAAAAAA...",
          "...............ASAAAASAA..",
          "..............SAAAAAAAAPA.",
          ".......AA.....AAAAAAQANAA.",
          "...AA..AAAAA.AAAAAQAAAATAA",
          "..ASAAAAAAAA...ARRAARAAATP",
          "..ASAAAAAAAA...ARRBARAAATP",
          "...AA..AAAAA.AAAAAQAAAATAA",
          ".......AA.....AAAAAAQANAA.",
          "..............SAAAAAAAAPA.",
          "...............ASAAAASAA..",
          ".EEEEEEEEA......AAAAAAA...",
          ".EEEEEEEEA.........A......",
          ".........................."
        ] },
      },
    },
    miranda: {
      id: "miranda", name: "USS Reliant", className: "Miranda class",
      role: "Light cruiser", faction: "federation", cost: 800, purchasable: true,
      speed: 100, turnRate: 100, signature: 340, lockRangeKm: 40,
      preferredRangeKm: 6,
      mask: [
        "......................",
        ".nnnnnnnn.....####....",
        ".nnnnnnnn...########..",
        "....pp.....##########.",
        "....####..############",
        "...###################",
        "...###################",
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
        ".EEEEEEAA.....APSA....",
        ".EEEEEEAA...AAAAAAAA..",
        "...........AASAAAAAPA.",
        "....AAAA..AAANAAAAAAPA",
        "...AAAAAAAAAAAAAAAATAA",
        "...ASAARRRAAAAAQBAAASP",
        "...ASAARRRAAAAAQAAAASP",
        "...AAAAAAAAAAAAAAAATAA",
        "....AAAA..AAANAAAAAAPA",
        "...........AASAAAAAPA.",
        ".EEEEEEAA...AAAAAAAA..",
        ".EEEEEEAA.....APSA....",
        "......................"
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "90,160,255", hullTint: "#c6ccda" },
      presets: {
        skirmisher: { name: "Skirmisher", desc: "Eight phasers on the rim, four more engines, no tubes. Orbit at 3 km.", rows: [
          "......................",
          ".EEEEEEAA.....APSA....",
          ".EEEEEEAA...AAAPAAAA..",
          "...........AASAAAAAPA.",
          "....AAAA..AAANAAAAAAAA",
          "...AAAAAAAAAAAAAAAAAAA",
          "...ASAARRRAAAAAQBAAASP",
          "...ASAARRRAAAAAQAAAASP",
          "...AAAAAAAAAAAAAAAAAAA",
          "....AAAA..AAANAAAAAAAA",
          "...........AASAAAAAPA.",
          ".EEEEEEAA...AAAPAAAA..",
          ".EEEEEEAA.....APSA....",
          "......................"
        ] },
      },
    },
    defiant: {
      id: "defiant", name: "USS Defiant", className: "Defiant class",
      role: "Escort", faction: "federation", cost: 2400, purchasable: true,
      speed: 130, turnRate: 140, signature: 220, lockRangeKm: 40,
      preferredRangeKm: 4,
      mask: [
        "..................",
        "..nnnnnn..........",
        ".nnnnnnn###.......",
        ".###############..",
        ".################.",
        "..################",
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
        ".AAAAAAAAAP.......",
        ".AAAAAAAAASAPAAP..",
        ".AAAAAAAAAANAASAT.",
        "..SAAARRRABAAAAATP",
        "..SAAARRRAQAAAAATP",
        ".AAAAAAAAAANAASAT.",
        ".AAAAAAAAASAPAAP..",
        ".AAAAAAAAAP.......",
        "..EEEEEE..........",
        ".................."
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "120,180,255", hullTint: "#9aa3b5" },
      presets: {
        interceptor: { name: "Interceptor", desc: "Every nacelle cell an engine, six forward phasers, one tube. Orbit at 3 km with the afterburner.", rows: [
          "..................",
          "..EEEEEE..........",
          ".EEEEEEEAAA.......",
          ".AAAAAAAAASAAAAP..",
          ".AAAAAAAAAANAASAP.",
          "..SAAARRAABAAAAATP",
          "..SAAARRAAQAAAAAAP",
          ".AAAAAAAAAANAASAP.",
          ".AAAAAAAAASAAAAP..",
          ".EEEEEEEAAA.......",
          "..EEEEEE..........",
          ".................."
        ] },
      },
    },
    excelsior: {
      id: "excelsior", name: "USS Excelsior", className: "Excelsior class",
      role: "Heavy cruiser", faction: "federation", cost: 3200, purchasable: true,
      speed: 95, turnRate: 80, signature: 450, lockRangeKm: 50,
      preferredRangeKm: 8,
      mask: [
        "..............................",
        ".nnnnnnnnnn..........###......",
        ".nnnnnnnnnn........#######....",
        "......pp..........#########...",
        "......pp.........###########..",
        "......pp##.......############.",
        "....##pp####....#############.",
        "...#########ppp###############",
        "...#########ppp###############",
        "...#########ppp###############",
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
        ".EEEEEEAAAA........ASAAAAA....",
        "..................SAAAAAAAP...",
        ".................AAAAAAAAAAA..",
        "........AA.......AAAAAAAAAAAP.",
        "....AA..AAAA....AAAAAAQAAAATA.",
        "...ASAAAAAAA...AAAAAAAQAAAAASA",
        "...AAARRRAAA...AAAAAAABAANAATP",
        "...AAARRRAAA...AAAAAAAQAANAATP",
        "...ASAAAAAAA...AAAAAAAQAAAAASA",
        "....AA..AAAA....AAAAAAQAAAATA.",
        "........AA.......AAAAAAAAAAAP.",
        ".................AAAAAAAAAAA..",
        "..................SAAAAAAAP...",
        ".EEEEEEAAAA........ASAAAAA....",
        ".EEEEEEAAAA..........APA......",
        ".............................."
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "90,160,255", hullTint: "#cdd3e0" },
      presets: {
        lancer: { name: "Lancer", desc: "Six torpedo tubes in the saucer bow, eight reactors, four phasers. Keep at 10 km.", rows: [
          "..............................",
          ".EEEEEEAAAA..........AAA......",
          ".EEEEEEAAAA........ASAAAAA....",
          "..................SAAAAAAAP...",
          ".................AAAAAAAAAAA..",
          "........AA.......AAAAAAAAAATA.",
          "....AA..AAAA....AAAAAAQAAAAAT.",
          "...ASAAAAAAA...ATAAAAAQAAAAASA",
          "...AARRRRAAA...TAAAAAABAANAAAP",
          "...AARRRRAAA...AAAAAAAQAANAAAP",
          "...ASAAAAAAA...ATAAAAAQAAAAASA",
          "....AA..AAAA....AAAAAAQAAAAAT.",
          "........AA.......AAAAAAAAAATA.",
          ".................AAAAAAAAAAA..",
          "..................SAAAAAAAP...",
          ".EEEEEEAAAA........ASAAAAA....",
          ".EEEEEEAAAA..........AAA......",
          ".............................."
        ] },
      },
    },
    galaxy: {
      id: "galaxy", name: "USS Galaxy", className: "Galaxy class",
      role: "Explorer", faction: "federation", cost: 5600, purchasable: true,
      speed: 85, turnRate: 60, signature: 600, lockRangeKm: 55,
      preferredRangeKm: 8,
      mask: [
        "....................................",
        "..nnnnnnnnnn..........########......",
        "..nnnnnnnnnn........############....",
        "......pp...........##############...",
        "......pp..........################..",
        "......pp.........##################.",
        "....########.....##################.",
        "...##########...###################.",
        "...##########ppp####################",
        "...##########ppp####################",
        "...##########ppp####################",
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
        "..EEEEEEEEAA..........AAAPAAAA......",
        "..EEEEEEEEAA........AASAAAAAAAAA....",
        "...................AAAAAAAAAAAPAA...",
        "..................AASAAAAAAAAAAAAA..",
        ".................AAAAAAAAAAAAAAAAPA.",
        "....AAAAAAAA.....AAAAAAAAAAAAAAAAAA.",
        "...AAAAAAAAAA...ASATAAAAAAQANAAAAAP.",
        "...AAAAARRAAA...AAAAAAAAAAQAAAAAAAAP",
        "...ASAAARRAAA...AAAATAAAAABQANAAAASA",
        "...ASAAARRAAA...AAAATAAAAAQQANAAAASA",
        "...AAAAARRAAA...AAAAAAAAAAQAAAAAAAAP",
        "...AAAAAAAAAA...ASATAAAAAAQANAAAAAP.",
        "....AAAAAAAA.....AAAAAAAAAAAAAAAAAA.",
        ".................AAAAAAAAAAAAAAAAPA.",
        "..................AASAAAAAAAAAAAAA..",
        "...................AAAAAAAAAAAPAA...",
        "..EEEEEEEEAA........AASAAAAAAAAA....",
        "..EEEEEEEEAA..........AAAPAAAA......",
        "...................................."
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "90,160,255", hullTint: "#d2d7e3" },
      presets: {
        fortress: { name: "Fortress", desc: "Sixteen shield emitters, ten reactors, eight crew quarters. Sits at 6 km and soaks it up.", rows: [
          "....................................",
          "..EEEEEEEEAA..........AASPSAAA......",
          "..EEEEEEEEAA........AASAAAAAAASA....",
          "...................AAAAAAAAAAAPAA...",
          "..................AASAAAAAAAAAAASA..",
          ".................AAAAAAAAAAAAAAAAPA.",
          "....ASAAAAAA.....AAAAAAAAAAAAAAAAAA.",
          "...AAAAAAAAAA...ASATAAAQAAQANAAAAAP.",
          "...AAAAARRRAA...AAAAAAAAAAQAAAAAAAAS",
          "...ASAAARRRAA...AAAATAAAAABQANAAAASA",
          "...ASAAARRRAA...AAAATAAAAAQQANAAAASA",
          "...AAAAARRRAA...AAAAAAAAAAQAAAAAAAAS",
          "...AAAAAAAAAA...ASATAAAQAAQANAAAAAP.",
          "....ASAAAAAA.....AAAAAAAAAAAAAAAAAA.",
          ".................AAAAAAAAAAAAAAAAPA.",
          "..................AASAAAAAAAAAAASA..",
          "...................AAAAAAAAAAAPAA...",
          "..EEEEEEEEAA........AASAAAAAAASA....",
          "..EEEEEEEEAA..........AASPSAAA......",
          "...................................."
        ] },
      },
    },
    sovereign: {
      id: "sovereign", name: "USS Sovereign", className: "Sovereign class",
      role: "Battleship", faction: "federation", cost: 8000, purchasable: true,
      speed: 100, turnRate: 75, signature: 520, lockRangeKm: 60,
      preferredRangeKm: 8,
      mask: [
        "......................................",
        "..nnnnnnnnnnn.........................",
        "..nnnnnnnnnnn.........#####...........",
        "......pp.............#########........",
        "......pp...........#############......",
        "......pp#.........################....",
        "....######.......###################..",
        "...#######pppp.######################.",
        "...###################################",
        "...###################################",
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
        "..EEEEEEEEAAA.........AAPAA...........",
        ".....................ASPAAAAAA........",
        "...................ASAAAAAAAAPAA......",
        "........A.........PSAAAAAAAAAAAAAA....",
        "....AAAAAA.......AAAAAAAAAAAAAAAAAPA..",
        "...AAAAAAA.....AAATAAAAAAAQAAANAAAAAP.",
        "...ASARRRRAAAAAAAAAATAAAAABQAAANAAAASP",
        "...ASARRRRAAAAAAAAAATAAAAAQAAAANAAAASP",
        "...AAAAAAA.....AAATAAAAAAAQAAANAAAAAP.",
        "....AAAAAA.......AAAAAAAAAAAAAAAAAPA..",
        "........A.........PSAAAAAAAAAAAAAA....",
        "...................ASAAAAAAAAPAA......",
        ".....................ASPAAAAAA........",
        "..EEEEEEEEAAA.........AAPAA...........",
        "..EEEEEEEEAAA.........................",
        "......................................"
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "100,170,255", hullTint: "#b9c0cf" },
      presets: {
        dreadnought: { name: "Dreadnought", desc: "Sixteen phasers along the rim, four tubes, ten reactors. Orbit at 6 km and never stop firing.", rows: [
          "......................................",
          "..EEEEEEEEAAA.........................",
          "..EEEEEEEEAAA.........APAPA...........",
          ".....................ASAAAAAPA........",
          "...................ASAAAAAAAAPAA......",
          "........A.........ASAAAAAAAAAAAAPA....",
          "....AAAAAA.......AAAAAAAAAAAAAAAAAPA..",
          "...AAAAAAA.....AAATAAAAAAAQAAANAAAAAP.",
          "...ASRRRRRAAAAAAAAAATAAAAABQAAANAAAASP",
          "...ASRRRRRAAAAAAAAAATAAAAAQAAAANAAAASP",
          "...AAAAAAA.....AAATAAAAAAAQAAANAAAAAP.",
          "....AAAAAA.......AAAAAAAAAAAAAAAAAPA..",
          "........A.........ASAAAAAAAAAAAAPA....",
          "...................ASAAAAAAAAPAA......",
          ".....................ASAAAAAPA........",
          "..EEEEEEEEAAA.........APAPA...........",
          "..EEEEEEEEAAA.........................",
          "......................................"
        ] },
      },
    },
    bird_of_prey: {
      id: "bird_of_prey", name: "IKS Rotarran", className: "B'rel class Bird-of-Prey",
      role: "Raider", faction: "klingon", cost: 0, purchasable: false,
      speed: 105, turnRate: 110, signature: 250, lockRangeKm: 40,
      preferredRangeKm: 6,
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
        "EEEP....................",
        "..AAA...................",
        "...APA..................",
        "....AAA.................",
        ".....AAA................",
        "......AAA...............",
        ".......AAA..............",
        ".....AAAAAA.......AAA...",
        "....AAAAQASA....AAAAAAA.",
        "...AAARRAPAAAAAAASAPANAA",
        "...ASARRBPAAAAAAASAAAAAT",
        "....AAAAQASA....AAAAPAA.",
        ".....AAAAAA.......AAA...",
        ".......AAA..............",
        "......AAA...............",
        ".....AAA................",
        "....AAA.................",
        "...APA..................",
        "..AAA...................",
        "EEEP....................",
        "EEE....................."
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "110,255,120", hullTint: "#5d7a5c" },
      variants: {
        gunboat: { name: "Gunboat", desc: "Eleven disruptors along the wings, no torpedo, thinner armor.", rows: [
          "EEE.....................",
          "EEEP....................",
          "..AAA...................",
          "...APA..................",
          "....AAA.................",
          ".....AAA................",
          "......AAA...............",
          ".......APA..............",
          ".....AAAAAA.......AAA...",
          "....AAAAQASA....AAAAAAA.",
          "...AAARRAPAAAAAAASAPANAP",
          "...ASARRBPAAAAAAASAAAAAP",
          "....AAAAQASA....AAAAAAA.",
          ".....AAAAAA.......AAA...",
          ".......APA..............",
          "......AAA...............",
          ".....AAA................",
          "....AAA.................",
          "...APA..................",
          "..AAA...................",
          "EEEP....................",
          "EEE....................."
        ] },
        torpedo: { name: "Torpedo boat", desc: "Three forward tubes, six reactors, four disruptors.", rows: [
          "EEE.....................",
          "EEEP....................",
          "..AAA...................",
          "...AAA..................",
          "....AAA.................",
          ".....AAA................",
          "......AAA...............",
          ".......AAA..............",
          ".....AAAAAA.......AAA...",
          "....AAARQASA....AAAAAAT.",
          "...AAARRAPAAAAAAASANAAAT",
          "...ASARRBPAAAAAAASAAAAAT",
          "....AAARQASA....AAAAAAA.",
          ".....AAAAAA.......AAA...",
          ".......AAA..............",
          "......AAA...............",
          ".....AAA................",
          "....AAA.................",
          "...AAA..................",
          "..AAA...................",
          "EEEP....................",
          "EEE....................."
        ] },
      },
    },
    ktinga: {
      id: "ktinga", name: "IKS Amar", className: "K't'inga class battlecruiser",
      role: "Battlecruiser", faction: "klingon", cost: 0, purchasable: false,
      speed: 85, turnRate: 70, signature: 480, lockRangeKm: 45,
      preferredRangeKm: 7, aiProfile: "ktinga",
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
        "EEEEP...........................",
        "..AAAA..........................",
        "...AAAP.........................",
        "....AAAAA.......................",
        ".....AAAAAP................AAAA.",
        "......AAAAAAAA..........AAAAAA..",
        ".......AAAAAAASS.......AAAAAAAA.",
        "........SAAAAAAA......AAAAANAAAP",
        "........EEARRRAAAAAAAAAAAAQBAAST",
        "........EEARRRAAAAAAAAAAAAAQAAST",
        "........SAAAAAAA......AAAAANAAAP",
        ".......AAAAAAASS.......AAAAAAAA.",
        "......AAAAAAAA..........AAAAAA..",
        ".....AAAAAP................AAAA.",
        "....AAAAA.......................",
        "...AAAP.........................",
        "..AAAA..........................",
        "EEEEP...........................",
        "EEEE............................"
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "255,120,90", hullTint: "#7a6660" },
      variants: {
        siege: { name: "Siege", desc: "Four forward tubes, eight reactors, four disruptors.", rows: [
          "EEEE............................",
          "EEEEP...........................",
          "..AAAA..........................",
          "...AAAA.........................",
          "....AAAAA.......................",
          ".....AAAAAP................AAAA.",
          "......AAAAAAAA..........AAAAAA..",
          ".......AAAAAAASS.......AAAAAAAA.",
          "........SAAAAAAA......AAAAANAAAT",
          "........EERRRRAAAAAAAAAAAAQBAAST",
          "........EERRRRAAAAAAAAAAAAAQAAST",
          "........SAAAAAAA......AAAAANAAAT",
          ".......AAAAAAASS.......AAAAAAAA.",
          "......AAAAAAAA..........AAAAAA..",
          ".....AAAAAP................AAAA.",
          "....AAAAA.......................",
          "...AAAA.........................",
          "..AAAA..........................",
          "EEEEP...........................",
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
      targetHull: "Targeting whatever we can hit, Captain. Full accuracy.",
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
      shipDead: "Hull integrity failing. We're breaking up!",
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
      accuracyMult: 0.85, reactionDelay: 1.2, statMult: 1.08, damageMult: 1.6,
      retreatHull: 0.28, retreatMinTime: 9, retreatMaxTime: 22,
      repositionShield: 0.22, repositionDuration: 5,
      orbitRangeKm: 6, retreatRangeKm: 22,
      boosterBelow: 0.45, boosterMinCap: 0.35, afterburnerMinCap: 0.25,
      targetWeights: { none: 0.35, phaser: 0.2, reactor: 0.15, engine: 0.12, shield: 0.13, bridge: 0.05 },   // none = spray the hull, no −15% aim penalty
    },
    // K't'inga: slower to react, holds a longer orbit, fights to the end rather than running
    ktinga: {
      accuracyMult: 0.8, reactionDelay: 1.6, statMult: 0.9, damageMult: 1.6,
      retreatHull: 0.2, retreatMinTime: 8, retreatMaxTime: 16,
      repositionShield: 0.2, repositionDuration: 6,
      orbitRangeKm: 7, retreatRangeKm: 18,
      boosterBelow: 0.5, boosterMinCap: 0.3, afterburnerMinCap: 0.35,
      targetWeights: { none: 0.3, phaser: 0.18, reactor: 0.17, engine: 0.12, shield: 0.13, bridge: 0.1 },
    },
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
    sellBack: 0.6,                      // fraction of price refunded when selling a module
    // the raider gets tougher with every victory: statMult = base + perWin × wins (capped)
    enemyScaling: { perWin: 0.04, maxBonus: 0.4 },
    // Which enemy shows up: weighted random among the encounters unlocked by battlesWon; "random" layouts are
    // generated from the class default (grid.variant). rewardMult scales the win payout. Seeded by the battle record.
    encounters: [
      { id: "raider",   enemyClass: "bird_of_prey", layout: "default", minWins: 0, weight: 3, rewardMult: 1.0 },
      { id: "gunboat",  enemyClass: "bird_of_prey", layout: "gunboat", minWins: 1, weight: 2, rewardMult: 1.1 },
      { id: "torpedo",  enemyClass: "bird_of_prey", layout: "torpedo", minWins: 1, weight: 2, rewardMult: 1.1 },
      { id: "variant",  enemyClass: "bird_of_prey", layout: "random",  minWins: 2, weight: 3, rewardMult: 1.1 },
      { id: "cruiser",  enemyClass: "ktinga",       layout: "default", minWins: 4, weight: 2, rewardMult: 1.8 },
      { id: "siege",    enemyClass: "ktinga",       layout: "siege",   minWins: 6, weight: 2, rewardMult: 1.9 },
      { id: "warlord",  enemyClass: "ktinga",       layout: "random",  minWins: 8, weight: 2, rewardMult: 1.9 },
    ],
    klingonNames: ["IKS Rotarran", "IKS Hegh'ta", "IKS Pagh", "IKS Koraga", "IKS Vorn", "IKS Amar", "IKS Gr'oth", "IKS Bortas", "IKS Ch'Tang", "IKS Maht-H'a"],
  },

  science: { scanDuration: 4, weaknessBonus: 1.25, cloakDetectRangeKm: 10 },

  saveDefaults: {
    version: 2, credits: 600, shipClass: "constitution", ownedShips: ["constitution"],
    layouts: {},                       // classId → array of layout rows; missing = class default layout
    builds: {},                        // classId → [{ name, rows }] named builds (up to editor.maxSavedBuilds)
    skills: { gunnery: 0, missiles: 0, navigation: 0, shields: 0, capacitor: 0, targeting: 0 },
    training: null,                    // { skill, level, startedAt, finishesAt } (ms timestamps)
    campaign: { missionIndex: 0, battlesWon: 0, battlesLost: 0, streak: 0 },
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
    // destruction: fragments are groups of blocks that drift off as one piece and keep their colours
    fragments: { sectionLife: 3.2, deathLife: 4.0, deathPieces: [3, 6], driftSpeed: 26, deathSpeed: 50, spin: 1.6, fadeFrom: 0.45 },
  },
};
