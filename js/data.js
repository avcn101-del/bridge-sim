// js/data.js — every tunable number in the game lives here.
// Game logic reads from BS.Data and never hard-codes balance values.
window.BS = window.BS || {};

BS.Data = {
  version: "0.7.0",

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
    reactorExploded: "Reactor breach! It took the compartments around it with it!",
    enemyReactorExploded: "Their reactor just went up, Captain! Secondary explosions!",
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
    structurePierceCost: 3,       // beams never pass through a structural member
    shieldBase: 80,               // shield per facing before emitters
    shieldAdd: 70,                // per shield emitter on that facing
    regenBase: 0.6, regenAdd: 0.4,
    capBase: 80, capAdd: 80, capRechargeTime: 40,
    thrustPerPoint: 12,           // speed multiplier = thrustPoints × this / mass, clamped below
    nacelleThrustMult: 2,         // engine blocks in nacelle cells count double
    speedMultMin: 0.35, speedMultMax: 1.25,
    sensorBase: 8, sensorAdd: 2,
    powerPerReactor: 15,          // power grid per alive reactor, on top of the class powerBase; blocks.*.power is what each system draws
    brownoutMin: 0.4,             // when reactors die and draw exceeds supply, weapons cycle and shields regen at supply/draw (never below this)
    repairBase: 0.6, repairAdd: 0.5,   // hp/s restored to damaged (not destroyed) blocks
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
    variant: { fraction: 0.12, attempts: 12, systemWeights: { phaser: 4, shield: 3, reactor: 2, engine: 2, armor: 6, quarters: 1, sensor: 1, torpedo: 1, jammer: 1 } },
    maskLegend: { ".": "empty", "#": "fillable", "n": "nacelle (engine ×2)", "p": "structure (fixed)" },
    layoutLegend: { A: "armor", P: "phaser", T: "torpedo", S: "shield", R: "reactor", E: "engine", N: "sensor", B: "bridge", Q: "quarters", J: "jammer", C: "cloak" },
  },

  editor: {
    maxSavedBuilds: 3,            // named builds kept per hull in the save
    refund: 0.6,                  // fraction of a block's price refunded when a build removes it
  },

  // ---------------------------------------------------------------- blocks
  blocks: {
    armor:    { letter: "A", name: "Armor plating",   short: "AR", hp: 60, mass: 2, cost: 20,  color: "#a3aabb", glyph: "plate", pierceCost: 2, desc: "Cheap and tough. Stops a beam dead: nothing behind a plate is hit until the plate is gone." },
    phaser:   { letter: "P", name: "Phaser emitter",  short: "PH", hp: 50, mass: 2, cost: 120, power: 5, color: "#ff8a3d", glyph: "lens", desc: "Beam weapon. Fires into the 180° arc facing away from the ship's centre.",
                weapon: { kind: "turret", damage: 28, cycle: 2.6, cap: 2.5, heat: 6, optimalKm: 8, falloffKm: 7, tracking: 0.9, accuracy: 0.95, arc: 180, color: "#ff8a3d", coreColor: "#fff3e0", beamLife: 0.4 } },
    torpedo:  { letter: "T", name: "Torpedo tube",    short: "TT", hp: 50, mass: 3, cost: 180, power: 8, color: "#ff4d6d", glyph: "warhead", desc: "Heavy warhead, slow reload. Fires into the 220° arc facing away from the ship's centre: mount tubes where you want to shoot.",
                weapon: { kind: "launcher", damage: 170, cycle: 11, cap: 14, heat: 30, rangeKm: 30, speedKmS: 4, explosionRadius: 280, explosionVelocity: 1.5, turnRate: 160, arc: 220, color: "#ff4d6d", coreColor: "#ffffff" } },
    shield:   { letter: "S", name: "Shield emitter",  short: "SH", hp: 40, mass: 2, cost: 90,  power: 4,  color: "#3f8cff", glyph: "shield", desc: "+70 shield and +0.4/s regen on the facing it sits on." },
    reactor:  { letter: "R", name: "Reactor",         short: "RE", hp: 40, mass: 3, cost: 100, color: "#ffd23f", glyph: "core", explosion: { damage: 80, radius: 1 }, desc: "+80 capacitor and +15 power for the grid. Explodes when destroyed: 80 damage to every block around it, and a reactor next to it goes up too. Keep them apart and armored." },
    engine:   { letter: "E", name: "Impulse engine",  short: "EN", hp: 45, mass: 2, cost: 80,  power: 1,  color: "#5fe9ff", glyph: "thrust", desc: "Thrust. Counts double inside nacelles. Speed = thrust / mass." },
    sensor:   { letter: "N", name: "Sensor array",    short: "SE", hp: 35, mass: 1, cost: 110, power: 3, color: "#d26bff", glyph: "dish", desc: "Faster locks and better tracking." },
    bridge:   { letter: "B", name: "Bridge",          short: "BR", hp: 200, mass: 2, cost: 0,   color: "#ffffff", glyph: "star", unique: true, desc: "Exactly one. If it dies, the ship is lost. Blocks cut off from it break away." },
    jammer:   { letter: "J", name: "ECM jammer",      short: "JM", hp: 35, mass: 2, cost: 110, power: 6, color: "#35e08f", glyph: "wave", desc: "Electronic warfare. Each 5 s cycle (10 cap) rolls jam strength 3 against the enemy's sensors: on a hit their lock drops and they cannot lock for 4 s, and their torpedoes in flight go blind." },
    cloak:    { letter: "C", name: "Cloaking device", short: "CL", hp: 40, mass: 3, cost: 400, power: 12, unique: true, color: "#9b8cff", glyph: "eye", desc: "One per ship. While cloaked you cannot be locked or seen beyond sensor range, but shields are down, weapons are cold and the capacitor drains 8/s. Decloaking takes 2 s and shields stay down 8 s more." },
    quarters: { letter: "Q", name: "Crew quarters",   short: "CQ", hp: 35, mass: 1, cost: 40,  power: 1,  color: "#c9a97a", glyph: "windows", desc: "+0.5 hp/s damage-control repair of damaged blocks." },
  },

  // ---------------------------------------------------------------- modules
  // Weapon groups come from blocks; the three active systems are built into every ship.
  modules: {
    phaser_group:  { kind: "turretGroup",   block: "phaser",  name: "Phaser emitters", short: "PHA", desc: "All phaser emitters fire at the locked target when their arc allows." },
    torpedo_group: { kind: "launcherGroup", block: "torpedo", name: "Torpedo tubes",   short: "TOR", desc: "All tubes fire forward at the locked target." },
    shield_booster: { kind: "active", name: "Shield booster", short: "SB", cycle: 4, cap: 32, effect: { shieldBoost: 50 }, desc: "Each cycle restores 50 shield to the weakest facing. Expensive on capacitor: pulse it." },
    shield_hardener: { kind: "active", name: "Shield hardener", short: "SH", cycle: 8, cap: 7, effect: { shieldResist: 0.3 }, desc: "While running, shields take 30% less damage." },
    afterburner: { kind: "active", name: "Afterburner", short: "AB", cycle: 8, cap: 16, effect: { speedMult: 1.5 }, desc: "+50% speed while running. Higher angular velocity makes enemy beams miss." },
    jammer: { kind: "active", block: "jammer", name: "ECM jammer", short: "JAM", cycle: 5, cap: 10, effect: { jam: true }, desc: "Every 5 s: jam strength (3 per jammer block) against the enemy's sensor strength. A hit breaks their lock for 4 s and blinds their torpedoes." },
    cloak: { kind: "cloak", block: "cloak", name: "Cloaking device", short: "CLK", cycle: 0, cap: 0, capText: "8 cap/s", desc: "Cloak in 3 s: unlockable and unseen beyond their sensors. Shields down, weapons cold, capacitor drains. Decloak takes 2 s; shields recover 8 s later." },
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
      powerBase: 50,              // power grid before reactors (grid.powerPerReactor each)
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
        ".EEEEEAAAA.........P......",
        ".EEEEEAAAA......PAAAAAP...",
        "...............ASAAAASAA..",
        "..............SAAAAAAAAAP.",
        ".......AA.....AAARAAQAAAA.",
        "...AA..AAAAA.AARAAQARAANAT",
        "..ASAAAAAAAA...AAAAAAAAAAA",
        "..ASAAAAAAAA...AAABAAAAAAA",
        "...AA..AAAAA.AARAAQARAANAT",
        ".......AA.....AAARAAQAAAA.",
        "..............SAAAAAAAAAP.",
        "...............ASAAAASAA..",
        ".EEEEEAAAA......PAAAAAP...",
        ".EEEEEAAAA.........P......",
        ".........................."
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "90,160,255", hullTint: "#c6ccda" },
      presets: {
        shadowhunter: { name: "Shadow hunter", desc: "A cloaking device and two ECM jammers in the crew decks, six phasers. Cloak, close, decloak on their flank, jam their lock and fire.", rows: [
          "..........................",
          ".EEEEEAAAA.........P......",
          ".EEEEEAAAA......PAAAAAP...",
          "...............ASAAAASAA..",
          "..............SAAAAAAAAAA.",
          ".......AA.....AAARAACAAAA.",
          "...AA..AAAAA.AARAAJARAANAT",
          "..ASAAAAAAAA...AAAAAAAAAAA",
          "..ASAAAAAAAA...AAABAAAAAAA",
          "...AA..AAAAA.AARAAJARAANAT",
          ".......AA.....AAARAAQAAAA.",
          "..............SAAAAAAAAAA.",
          "...............ASAAAASAA..",
          ".EEEEEAAAA......PAAAAAP...",
          ".EEEEEAAAA.........P......",
          ".........................."
        ] },
        brawler: { name: "Brawler", desc: "Ten phaser emitters on the flanks, armored bow, three tubes. Orbit close and keep them on your beam.", rows: [
          "..........................",
          ".EEEEEAAAA.........A......",
          ".EEEEEAAAA......APAPAAA...",
          "...............PSAAAASAA..",
          "..............SAAAAAAAAAP.",
          ".......AA.....AAARAAQAAAT.",
          "...AA..AAAAA.AARAAQARAANAA",
          "..ASAAAAAAAA...AAAAAAAAAAA",
          "..ASAAAAAAAA...AAABAAAAAAP",
          "...AA..AAAAA.AARAAQARAANAP",
          ".......AA.....AAARAAQAANT.",
          "..............SAAAAAAAAAP.",
          "...............PSAAAASAT..",
          ".EEEEEAAAA......APAPAAA...",
          ".EEEEEAAAA.........A......",
          ".........................."
        ] },
        sniper: { name: "Sniper", desc: "Four torpedo tubes, extra sensors and engines, four phasers. Keep at range.", rows: [
          "..........................",
          ".EEEEEEEEA.........A......",
          ".EEEEEEEEA......AAAAAAA...",
          "...............ASAAAASAA..",
          "..............SAAAAAAAAAP.",
          ".......AA.....AAARAAQANAT.",
          "...AA..AAAAA.AARAAQARAAAAT",
          "..ASAAAAAAAA...AAAAAAAAAAP",
          "..ASAAAAAAAA...AAABAAAAAAP",
          "...AA..AAAAA.AARAAQARAAAAT",
          ".......AA.....AAARAAQANAT.",
          "..............SAAAAAAAAAP.",
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
      powerBase: 30,              // power grid before reactors (grid.powerPerReactor each)
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
        ".EEEEEEAA...AAAAAAAP..",
        "...........AASAAAAAAA.",
        "....AAAA..RAANAAAAAAAP",
        "...AAARARAAAAAAAAAAAAT",
        "...ASAAAAAAAAAAQBAAASP",
        "...ASAAAAAAAAAAQAAAASP",
        "...AAARARAAAAAAAAAAAAT",
        "....AAAA..RAANAAAAAAAP",
        "...........AASAAAAAAA.",
        ".EEEEEEAA...AAAAAAAP..",
        ".EEEEEEAA.....APSA....",
        "......................"
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "90,160,255", hullTint: "#c6ccda" },
      presets: {
        skirmisher: { name: "Skirmisher", desc: "Eight phasers on the rim, four more engines, no tubes. Orbit at 3 km.", rows: [
          "......................",
          ".EEEEEEAA.....PPSA....",
          ".EEEEEEAA...AAAAAAAP..",
          "...........AASAAAAAAA.",
          "....AAAA..RAANAAAAAAAA",
          "...AAARARAAAAAAAAAAAAA",
          "...ASAAAAAAAAAAQBAAASP",
          "...ASAAAAAAAAAAQAAAASP",
          "...AAARARAAAAAAAAAAAAA",
          "....AAAA..RAANAAAAAAAA",
          "...........AASAAAAAAA.",
          ".EEEEEEAA...AAAAAAAP..",
          ".EEEEEEAA.....PPSA....",
          "......................"
        ] },
      },
    },
    defiant: {
      id: "defiant", name: "USS Defiant", className: "Defiant class",
      role: "Escort", faction: "federation", cost: 2400, purchasable: true,
      speed: 130, turnRate: 140, signature: 220, lockRangeKm: 40,
      powerBase: 30,              // power grid before reactors (grid.powerPerReactor each)
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
        ".AAAAAARARSAPAAP..",
        ".AAAARAAAAANAASAT.",
        "..SAAAAAAABAAAAAAP",
        "..SAAAAAAAQAAAAAAP",
        ".AAAARAAAAANAASAT.",
        ".AAAAAARARSAPAAP..",
        ".AAAAAAAAAP.......",
        "..EEEEEE..........",
        ".................."
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "120,180,255", hullTint: "#9aa3b5" },
      presets: {
        interceptor: { name: "Interceptor", desc: "Every nacelle cell an engine, six forward phasers, no tubes. Orbit at 3 km with the afterburner.", rows: [
          "..................",
          "..EEEEEE..........",
          ".EEEEEEEAAA.......",
          ".AAAAAAAAASAAAAP..",
          ".AAAARARAAANAASAP.",
          "..SAAAAAAABAAAAAAP",
          "..SAAAAAAAQAAAAAAP",
          ".AAAARARAAANAASAP.",
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
      powerBase: 55,              // power grid before reactors (grid.powerPerReactor each)
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
        "....AA..ARAA....AAAAAAQAAAAAT.",
        "...ASRARAAAA...AAAAAAAQAAAAAST",
        "...AAAAAAAAA...AAAAAAABAANAAAP",
        "...AAAAAAAAA...AAAAAAAQAANAAAP",
        "...ASRARAAAA...AAAAAAAQAAAAAST",
        "....AA..ARAA....AAAAAAQAAAAAT.",
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
          "........AA.......AAAAAAAAAAAT.",
          "....RA..RAAA....TAAAAAQAAAAAT.",
          "...ASARAAARA...TAAAAAAQAAAAASA",
          "...AAAAAAAAA...AAAAAAABAANAAAP",
          "...AAAAAAAAA...AAAAAAAQAANAAAP",
          "...ASARAAARA...AAAAAAAQAAAAASA",
          "....RA..RAAA....TAAAAAQAAAAAT.",
          "........AA.......AAAAAAAAAAAT.",
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
      powerBase: 80,              // power grid before reactors (grid.powerPerReactor each)
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
        "..EEEEEEEEAA........AASAAAAAAAAP....",
        "...................AAAAAAAAAAAAAA...",
        "..................AASAAAAAAAAAAAAA..",
        ".................TAAAAAAAAAAAAAAAAP.",
        "....AAAAAAAA.....AAAAAAAAAAAAAAAAAA.",
        "...AARARARAAA...ASAAAAAAAAQANAAAAAP.",
        "...AAAAAAAARA...AAAAAAAAAAQAAAAAAAAP",
        "...ASAAAAAAAA...AAAAAAAAAABQANAAAASA",
        "...ASAAAAAAAA...AAAAAAAAAAQQANAAAASA",
        "...AAAAAAAARA...AAAAAAAAAAQAAAAAAAAP",
        "...AARARARAAA...ASAAAAAAAAQANAAAAAP.",
        "....AAAAAAAA.....AAAAAAAAAAAAAAAAAA.",
        ".................TAAAAAAAAAAAAAAAAP.",
        "..................AASAAAAAAAAAAAAA..",
        "...................AAAAAAAAAAAAAA...",
        "..EEEEEEEEAA........AASAAAAAAAAP....",
        "..EEEEEEEEAA..........AAAPAAAA......",
        "...................................."
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "90,160,255", hullTint: "#d2d7e3" },
      presets: {
        fortress: { name: "Fortress", desc: "Twenty-two shield emitters, ten reactors spread apart, nine crew quarters. Sits at 6 km and soaks it up.", rows: [
          "....................................",
          "..EEEEEEEEAA..........AASPSAAA......",
          "..EEEEEEEEAA........AASAAAAAAASP....",
          "...................AAAAAAAAAAAAAA...",
          "..................AASAAAAAAAAAAASA..",
          ".................TAAAAAAAAAAAAAAAAP.",
          "....ASAAARAA.....AAAAAAAAAAAAAAAAAA.",
          "...AARARAAARA...ASAAAAAQAAQANAAAAAP.",
          "...AAAAAAAAAA...AAAAAAAAAAQAAAAAAAAS",
          "...ASAAAARARA...AAAAAAAAAABQANAAAASA",
          "...ASAAAAAAAA...AAAAAAAAAAQQANAAAASA",
          "...AAAAAAAAAA...AAAAAAAAAAQAAAAAAAAS",
          "...AARARAAARA...ASAAAAAQAAQANAAAAAP.",
          "....ASAAARAA.....AAAAAAAAAAAAAAAAAA.",
          ".................TAAAAAAAAAAAAAAAAP.",
          "..................AASAAAAAAAAAAASA..",
          "...................AAAAAAAAAAAAAA...",
          "..EEEEEEEEAA........AASAAAAAAASP....",
          "..EEEEEEEEAA..........AASPSAAA......",
          "...................................."
        ] },
      },
    },
    sovereign: {
      id: "sovereign", name: "USS Sovereign", className: "Sovereign class",
      role: "Battleship", faction: "federation", cost: 8000, purchasable: true,
      speed: 100, turnRate: 75, signature: 520, lockRangeKm: 60,
      powerBase: 90,              // power grid before reactors (grid.powerPerReactor each)
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
        "..EEEEEEEEAAA.........PAPAA...........",
        ".....................ASAAAAAAP........",
        "...................ASAAAAAAAAAAA......",
        "........A.........PSAAAAAAAAAAAAAP....",
        "....AAARAR.......TAAAAAAAAAAAAAAAAAA..",
        "...AARAAAA.....ATAAAAAAAAAQAAANAAAAAP.",
        "...ASAAAAAARAAAAAAAAAAAAAABQAAANAAAASP",
        "...ASAAAAAAAAAAAAAAAAAAAAAQAAAANAAAASP",
        "...AARAAAA.....ATAAAAAAAAAQAAANAAAAAP.",
        "....AAARAR.......TAAAAAAAAAAAAAAAAAA..",
        "........A.........PSAAAAAAAAAAAAAP....",
        "...................ASAAAAAAAAAAA......",
        ".....................ASAAAAAAP........",
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
          ".....................ASAAAAAAP........",
          "...................ASAAAAAAAAAAP......",
          "........A.........TSAAAAAAAAAAAAAP....",
          "....AAARAR.......TAAAAAAAAAAAAAAAAAP..",
          "...ARAAAAA.....AAAAAAAAAAAQAAANAAAAAP.",
          "...ASARAAAARAAAAAAAAAAAAAABQAAANAAAASP",
          "...ASAAAAAAAAAAAAAAAAAAAAAQAAAANAAAASP",
          "...ARAAAAA.....AAAAAAAAAAAQAAANAAAAAP.",
          "....AAARAR.......TAAAAAAAAAAAAAAAAAP..",
          "........A.........TSAAAAAAAAAAAAAP....",
          "...................ASAAAAAAAAAAP......",
          ".....................ASAAAAAAP........",
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
      powerBase: 35,              // power grid before reactors (grid.powerPerReactor each)
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
        "..AAP...................",
        "...AAA..................",
        "....AAA.................",
        ".....AAA................",
        "......AAA...............",
        ".......AAA..............",
        ".....AAARAA.......AAP...",
        "....ARAAQASP....AAAAAAA.",
        "...AAAAAAAAAAAAAASAAANAA",
        "...ASAAABAAAAAAAASAAAAAT",
        "....ARAAQASP....AAAAAAA.",
        ".....AAARAA.......AAP...",
        ".......AAA..............",
        "......AAA...............",
        ".....AAA................",
        "....AAA.................",
        "...AAA..................",
        "..AAP...................",
        "EEEP....................",
        "EEE....................."
      ],
      visual: { kind: "grid", sprite: null, nacelleColor: "110,255,120", hullTint: "#5d7a5c" },
      variants: {
        shadow: { name: "Shadow", desc: "A cloaking device in place of the crew decks, six disruptors. It stalks you cloaked and decloaks at knife range.", rows: [
          "EEE.....................",
          "EEEP....................",
          "..AAP...................",
          "...AAA..................",
          "....AAA.................",
          ".....AAA................",
          "......AAA...............",
          ".......AAA..............",
          ".....AAARAA.......AAA...",
          "....ARAACASP....AAAAAAA.",
          "...AAAAAAAAAAAAAASAAANAA",
          "...ASAAABAAAAAAAASAAAAAT",
          "....ARAAQASP....AAAAAAA.",
          ".....AAARAA.......AAA...",
          ".......AAA..............",
          "......AAA...............",
          ".....AAA................",
          "....AAA.................",
          "...AAA..................",
          "..AAP...................",
          "EEEP....................",
          "EEE....................."
        ] },
        jammer: { name: "Jammer boat", desc: "Two ECM jammers, six disruptors. Breaks your target lock every few seconds.", rows: [
          "EEE.....................",
          "EEEP....................",
          "..AAP...................",
          "...AAA..................",
          "....AAA.................",
          ".....AAA................",
          "......AAA...............",
          ".......AAA..............",
          ".....AAARAA.......AAA...",
          "....ARAAQASP....AAAAAAA.",
          "...AAAAJJAAAAAAAASAAANAA",
          "...ASAAABAAAAAAAASAAAAAT",
          "....ARAAQASP....AAAAAAA.",
          ".....AAARAA.......AAA...",
          ".......AAA..............",
          "......AAA...............",
          ".....AAA................",
          "....AAA.................",
          "...AAA..................",
          "..AAP...................",
          "EEEP....................",
          "EEE....................."
        ] },
        gunboat: { name: "Gunboat", desc: "Eleven disruptors along the wings, no torpedo, thinner armor.", rows: [
          "EEE.....................",
          "EEEP....................",
          "..AAP...................",
          "...AAA..................",
          "....AAA.................",
          ".....AAA................",
          "......AAA...............",
          ".......AAP..............",
          ".....AAARAA.......AAP...",
          "....ARAAQASP....AAAAAAA.",
          "...AAAAAAAAAAAAAASAAANAP",
          "...ASAAABAAAAAAAASAAAAAP",
          "....ARAAQASP....AAAAAAA.",
          ".....AAARAA.......AAA...",
          ".......AAP..............",
          "......AAA...............",
          ".....AAA................",
          "....AAA.................",
          "...AAA..................",
          "..AAP...................",
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
          ".....AAARAR.......AAA...",
          "....ARAAQASP....AAAAAAT.",
          "...AAAAAAAAAAAAAASANAAAT",
          "...ASAAABAAAAAAAASAAAAAT",
          "....ARAAQASP....AAAAAAA.",
          ".....AAARAR.......AAA...",
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
      powerBase: 50,              // power grid before reactors (grid.powerPerReactor each)
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
        ".......AAAAARASS.......AAAAAAAA.",
        "........SARAAARA......AAAAANAAAP",
        "........EEAAAAAAAAAAAAAAAAQBAAST",
        "........EEAAAAAAAAAAAAAAAAAQAAST",
        "........SARAAARA......AAAAANAAAP",
        ".......AAAAARASS.......AAAAAAAA.",
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
          ".......AAAARARSS.......AAAAAAAA.",
          "........SRAAAAAR......AAAAANAAAT",
          "........EEAAAAAAAAAAAAAAAAQBAAST",
          "........EEAAAAAAAAAAAAAAAAAQAAST",
          "........SRAAAAAR......AAAAANAAAT",
          ".......AAAARARSS.......AAAAAAAA.",
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
      orbitReverse: "Reversing our orbit, Captain. Bringing the other side to bear.",
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
      lockJammed: "Our targeting is jammed, Captain! No lock until it clears.",
      lockCloaked: "Can't get a lock, Captain. They're cloaked.",
      jammedUs: "They're jamming our targeting! Lock lost.",
      jammedThem: "Their lock just dropped. The jammer is working.",
      cloakOn: "Cloak engaged. Shields down, weapons cold, Captain.",
      cloakOff: "Decloaking. Shields will take a moment to come back.",
      cloakNoCap: "Capacitor too low to hold the cloak. We're decloaking!",
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
    // How an enemy fights (enemyAI.doctrines[id]); the encounter names one. All in km / seconds.
    doctrines: {
      strafe:    { kind: "strafe", engageKm: 16, passKm: 4.5, runInMaxTime: 14, passOrbitKm: 3, passTime: 12, breakKm: 8, breakMaxTime: 8, turnTime: 2, abMinCap: 0.5, tailChaseAngular: 0.15, tailChaseTime: 99 },
      brawl:     { kind: "brawl", engageKm: 8, orbitKm: 3.5, flipEvery: 20, abMinCap: 0.7, tailChaseAngular: 0.15, tailChaseTime: 4 },
      standoff:  { kind: "standoff", engageKm: 15, holdKm: 14, kiteBelowKm: 9, kiteToKm: 17, kiteMaxTime: 15, tailChaseAngular: 0.15, tailChaseTime: 99 },
      broadside: { kind: "broadside", engageKm: 10, bandKm: [5.5, 8.5], rollEvery: 30, tailChaseAngular: 0.15, tailChaseTime: 99 },
      ambush:    { kind: "ambush", engageKm: 22, decloakKm: 4.5, recloakKm: 9, passOrbitKm: 3, passTime: 12, breakKm: 10, breakMaxTime: 10, abMinCap: 0.5, tailChaseAngular: 0.15, tailChaseTime: 99 },
      siege:     { kind: "standoff", engageKm: 18, holdKm: 17, kiteBelowKm: 11, kiteToKm: 20, kiteMaxTime: 15, tailChaseAngular: 0.15, tailChaseTime: 99 },
    },
    // Overview status text per AI state
    stateLabels: { approach: "closing", retreat: "retreating", run_in: "strafing run", pass: "firing pass", break_off: "breaking off", turn_in: "coming around", brawl: "attacking", reposition: "turning", standoff: "standing off", kite: "kiting", broadside: "broadside", stalk: "cloaked", uncloak: "decloaking" },
    default: {
      doctrine: "brawl",
      accuracyMult: 0.85, reactionDelay: 1.2, statMult: 1.08, damageMult: 1.35,
      retreatHull: 0.28, retreatMinTime: 9, retreatMaxTime: 22,
      repositionShield: 0.22, repositionDuration: 5,
      orbitRangeKm: 6, retreatRangeKm: 22,
      boosterBelow: 0.45, boosterMinCap: 0.35, afterburnerMinCap: 0.25,
      targetWeights: { none: 0.4, phaser: 0.15, reactor: 0.15, engine: 0.12, shield: 0.13, bridge: 0.05 },   // none = spray the hull, no −15% aim penalty
    },
    // K't'inga: slower to react, holds a longer orbit, fights to the end rather than running
    ktinga: {
      doctrine: "broadside",
      accuracyMult: 0.7, reactionDelay: 1.6, statMult: 0.9, damageMult: 1.2,
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
    // salvage: credits for the enemy's surviving block value after a win; a ship disabled (no weapons, no engines) is captured intact
    salvage: { destroyed: 0.1, disabled: 0.25 },
    sellBack: 0.6,                      // fraction of price refunded when selling a module
    // the raider gets tougher with every victory: statMult = base + perWin × wins (capped)
    enemyScaling: { perWin: 0.04, maxBonus: 0.4 },
    // Which enemy shows up: weighted random among the encounters unlocked by battlesWon; "random" layouts are
    // generated from the class default (grid.variant). rewardMult scales the win payout. Seeded by the battle record.
    encounters: [
      { id: "raider",   enemyClass: "bird_of_prey", layout: "default", doctrine: "strafe",    minWins: 0, weight: 3, rewardMult: 1.0 },
      { id: "gunboat",  enemyClass: "bird_of_prey", layout: "gunboat", doctrine: "brawl",     minWins: 1, weight: 2, rewardMult: 1.1 },
      { id: "torpedo",  enemyClass: "bird_of_prey", layout: "torpedo", doctrine: "standoff",  minWins: 1, weight: 2, rewardMult: 1.1 },
      { id: "variant",  enemyClass: "bird_of_prey", layout: "random",  doctrine: ["strafe", "brawl"], minWins: 2, weight: 3, rewardMult: 1.1 },
      { id: "jammer",   enemyClass: "bird_of_prey", layout: "jammer",  doctrine: "brawl",     minWins: 3, weight: 2, rewardMult: 1.2 },
      { id: "shadow",   enemyClass: "bird_of_prey", layout: "shadow",  doctrine: "ambush",    minWins: 3, weight: 2, rewardMult: 1.3 },
      { id: "cruiser",  enemyClass: "ktinga",       layout: "default", doctrine: "broadside", minWins: 4, weight: 2, rewardMult: 1.8 },
      { id: "siege",    enemyClass: "ktinga",       layout: "siege",   doctrine: "siege",     minWins: 6, weight: 2, rewardMult: 1.9 },
      { id: "warlord",  enemyClass: "ktinga",       layout: "random",  doctrine: ["broadside", "brawl"], minWins: 8, weight: 2, rewardMult: 1.9 },
    ],
    klingonNames: ["IKS Rotarran", "IKS Hegh'ta", "IKS Pagh", "IKS Koraga", "IKS Vorn", "IKS Amar", "IKS Gr'oth", "IKS Bortas", "IKS Ch'Tang", "IKS Maht-H'a"],
  },

  science: { scanDuration: 4, weaknessBonus: 1.25, cloakDetectRangeKm: 10 },
  // electronic warfare: ECM rolls jam / (jam + target sensors); cloak timings in seconds; detection grows with sensor arrays
  ew: { jamPerBlock: 3, jamDuration: 4, cloakTime: 3, decloakTime: 2, surgeTime: 8, cloakDrain: 8, cloakMinCap: 5, detectPerSensor: 1, ghostAlpha: 0.25, ownCloakAlpha: 0.35 },

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
