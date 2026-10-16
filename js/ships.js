// js/ships.js — ship model: hull, shields, subsystems, power, helm steering, damage.
window.BS = window.BS || {};

BS.Ships = (function () {
  var U = BS.Util;
  var FACINGS = ["fore", "starboard", "aft", "port"];
  var nextId = 1;

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  // Build a runtime ship object from a class id. options: { name, pos, heading,
  // statMult, mods, isPlayer, aiProfile }
  function create(classId, options) {
    options = options || {};
    var cls = BS.Data.shipClasses[classId];
    if (!cls) throw new Error("Unknown ship class " + classId);
    var statMult = options.statMult || 1;
    var mods = Object.assign({
      damageMult: 1, cooldownMult: 1, reloadMult: 1, shieldMaxMult: 1, shieldRegenMult: 1,
      totalPower: 1, speedMult: 1, turnMult: 1, hullMult: 1, repairMult: 1,
      accuracyBonus: 0, delayMult: 1,
    }, options.mods || {});

    var hullMax = Math.round(cls.hull * statMult * mods.hullMult);
    var shieldMax = Math.round(cls.shields.max * statMult * mods.shieldMaxMult);
    var ship = {
      id: nextId++,
      classId: classId,
      cls: cls,
      name: options.name || cls.name,
      faction: cls.faction,
      isPlayer: !!options.isPlayer,
      pos: { x: options.pos ? options.pos.x : 0, y: options.pos ? options.pos.y : 0 },
      prevPos: { x: 0, y: 0 },
      heading: options.heading || 0,
      prevHeading: options.heading || 0,
      speed: 0,
      hull: hullMax, hullMax: hullMax,
      shields: { fore: shieldMax, aft: shieldMax, port: shieldMax, starboard: shieldMax },
      shieldMax: shieldMax,
      shieldRegen: cls.shields.regen * mods.shieldRegenMult,
      subsystems: deepCopy(cls.subsystems),
      power: Object.assign({}, BS.Data.powerPresets.balanced),
      powerPreset: "balanced",
      phaserCooldown: 0,
      torpedoReload: 0,
      pendingSpread: 0, spreadTimer: 0,
      fireOnce: { phasers: false, torpedoes: false },
      flags: { alert: "none", fireAtWill: false, evasive: false, destroyed: false, armed: false },
      target: null,
      targetSubsystem: null,
      helm: { mode: "idle", desiredHeading: options.heading || 0, desiredSpeed: 0, phase: "run", phaseTimer: 0, orbitDir: Math.random() < 0.5 ? 1 : -1, comeAboutFacing: null },
      repairPriority: null,
      reinforce: null,           // { from, to, perSecond, remaining }
      visual: Object.assign({}, cls.visual),
      stats: { damageDealt: 0, damageTaken: 0, torpedoesFired: 0, torpedoHits: 0, phasersFired: 0 },
      mods: mods,
      statMult: statMult,
      aiProfile: options.aiProfile || null,
      ai: null,
      destroyedTimer: 0,
      smokeTimer: 0,
      reportState: { shieldLow: {}, subsystemLow: {}, hullCritical: false },
      phaserDef: BS.Data.weapons[cls.weapons.phasers],
      torpedoDef: BS.Data.weapons[cls.weapons.torpedoes],
    };
    ship.prevPos.x = ship.pos.x; ship.prevPos.y = ship.pos.y;
    return ship;
  }

  // ---- multipliers ------------------------------------------------------
  function subMult(ship, sys) {
    var f = BS.Data.subsystemFloor;
    return f + (1 - f) * U.clamp(ship.subsystems[sys], 0, 100) / 100;
  }
  function powerMult(ship, sys) {
    var c = BS.Data.powerCurve[sys];
    return (c.base + ship.power[sys] * ship.mods.totalPower * c.slope);
  }
  function weaponsMult(ship) { return powerMult(ship, "weapons") * subMult(ship, "weapons"); }
  function torpedoMult(ship) { return (0.6 + 0.4 * powerMult(ship, "weapons")) * subMult(ship, "torpedoes"); }
  // accuracy multiplier from sensor health (1 at full, floor at 0)
  function sensorsMult(ship) {
    var f = BS.Data.subsystemEffects.sensorsAccuracyFloor;
    return f + (1 - f) * U.clamp(ship.subsystems.sensors, 0, 100) / 100;
  }
  // order / reaction delay multiplier from bridge health (1 at full, max at 0)
  function bridgeDelayMult(ship) {
    var m = BS.Data.subsystemEffects.bridgeDelayMaxMult;
    return 1 + (m - 1) * (1 - U.clamp(ship.subsystems.bridge, 0, 100) / 100);
  }
  function subsystemIds() { return Object.keys(BS.Data.subsystems); }
  function enginesMult(ship) { return powerMult(ship, "engines") * subMult(ship, "engines"); }
  function shieldsMult(ship) {
    var m = powerMult(ship, "shields") * subMult(ship, "shields");
    if (ship.flags.alert === "none") m *= BS.Data.balance.noAlertShieldRegenMult;
    if (ship.flags.alert === "red") m *= BS.Data.balance.redAlertRegenBonus;
    return m;
  }
  function maxSpeed(ship) { return ship.cls.speed * enginesMult(ship) * ship.mods.speedMult; }
  function turnRate(ship) { return ship.cls.turnRate * U.DEG * enginesMult(ship) * ship.mods.turnMult; }

  // ---- geometry ---------------------------------------------------------
  // Which shield facing faces a world point?
  function facingToward(ship, x, y) {
    var rel = U.normAngle(U.angleTo(ship.pos.x, ship.pos.y, x, y) - ship.heading);
    var a = Math.abs(rel);
    if (a < Math.PI / 4) return "fore";
    if (a > 3 * Math.PI / 4) return "aft";
    return rel > 0 ? "starboard" : "port";
  }
  // Heading offset (radians) of a facing relative to the bow
  function facingOffset(facing) {
    return { fore: 0, starboard: Math.PI / 2, aft: Math.PI, port: -Math.PI / 2 }[facing];
  }
  function strongestFacing(ship) {
    var best = "fore";
    for (var i = 0; i < FACINGS.length; i++) if (ship.shields[FACINGS[i]] > ship.shields[best]) best = FACINGS[i];
    return best;
  }
  function weakestFacing(ship) {
    var worst = "fore";
    for (var i = 0; i < FACINGS.length; i++) if (ship.shields[FACINGS[i]] < ship.shields[worst]) worst = FACINGS[i];
    return worst;
  }
  function distanceTo(ship, other) { return U.dist(ship.pos.x, ship.pos.y, other.pos.x, other.pos.y); }
  function bearingTo(ship, other) { return U.normAngle(U.angleTo(ship.pos.x, ship.pos.y, other.pos.x, other.pos.y) - ship.heading); }
  function inArc(ship, other, arcDeg) { return Math.abs(bearingTo(ship, other)) <= (arcDeg / 2) * U.DEG; }

  // ---- hardpoints -------------------------------------------------------
  // World position of a subsystem's (first) hardpoint, or null.
  function hardpointWorld(ship, sys) {
    var hps = ship.visual.hardpoints && ship.visual.hardpoints[sys];
    if (!hps || !hps.length) return null;
    var h = hps[Math.floor(Math.random() * hps.length)];
    return U.localToWorld(ship, h.x, h.y);
  }
  // Which subsystem hardpoint is under a world point? Returns { sys, x, y, r } or null.
  // Also returns { sys: null } when the point is on the hull but not on a hardpoint.
  function hardpointAt(ship, wx, wy, slack) {
    var hps = ship.visual.hardpoints;
    if (!hps) return null;
    var sc = ship.visual.scale || 1, best = null, bestD = Infinity;
    Object.keys(hps).forEach(function (sys) {
      hps[sys].forEach(function (h) {
        var w = U.localToWorld(ship, h.x, h.y);
        var d = U.dist(wx, wy, w.x, w.y), r = h.r * sc + (slack || 0);
        if (d <= r && d < bestD) { bestD = d; best = { sys: sys, x: w.x, y: w.y, r: h.r * sc }; }
      });
    });
    if (best) return best;
    if (U.dist(wx, wy, ship.pos.x, ship.pos.y) <= ship.visual.length * 0.55) return { sys: null, x: ship.pos.x, y: ship.pos.y, r: 0 };
    return null;
  }

  // ---- orders applied to a ship ----------------------------------------
  function setHelmMode(ship, mode) {
    ship.helm.mode = mode;
    ship.helm.phase = "run";
    ship.helm.phaseTimer = 0;
    ship.flags.evasive = (mode === "evasive");
    if (mode === "comeAbout") ship.helm.comeAboutFacing = strongestFacing(ship);
  }
  function setPowerPreset(ship, preset) {
    var p = BS.Data.powerPresets[preset];
    if (!p) return;
    ship.power = Object.assign({}, p);
    ship.powerPreset = preset;
  }
  function setAlert(ship, level) {
    ship.flags.alert = level;
    ship.flags.armed = level !== "none";
  }
  function startReinforce(ship) {
    var from = strongestFacing(ship), to = weakestFacing(ship);
    if (from === to || ship.shields[from] - ship.shields[to] < ship.shieldMax * 0.1) return null;
    var amount = ship.shields[from] * BS.Data.balance.reinforceFraction;
    ship.reinforce = { from: from, to: to, perSecond: amount / BS.Data.balance.reinforceDuration, remaining: amount };
    return ship.reinforce;
  }

  // ---- damage -----------------------------------------------------------
  // Returns { facing, absorbed, hullDamage, subsystem, shieldsDown }
  function applyDamage(ship, amount, fromX, fromY, targetSubsystem, attacker, kind) {
    if (ship.flags.destroyed) return null;
    var B = BS.Data.balance;
    var facing = facingToward(ship, fromX, fromY);
    var shield = ship.shields[facing];
    var absorbed = Math.min(shield, amount);
    ship.shields[facing] = shield - absorbed;
    var hullDamage = (amount - absorbed) + absorbed * B.shieldBleedThrough;
    var shieldsDown = ship.shields[facing] <= 0 && shield > 0;
    var subsystem = null;
    if (hullDamage > 0) {
      ship.hull = Math.max(0, ship.hull - hullDamage);
      ship.stats.damageTaken += hullDamage;
      if (attacker) attacker.stats.damageDealt += hullDamage;
      var sys = targetSubsystem;
      if (!sys && Math.random() < B.subsystemHitChance) sys = U.pick(subsystemIds());
      if (sys) {
        var before = ship.subsystems[sys];
        var factor = targetSubsystem ? B.targetedSubsystemDamageFactor : B.subsystemDamageFactor;
        ship.subsystems[sys] = Math.max(0, before - hullDamage * factor);
        subsystem = sys;
      }
    }
    // impact point on the shield bubble / hull, for effects
    var ang = U.angleTo(ship.pos.x, ship.pos.y, fromX, fromY);
    var impact = { x: ship.pos.x + Math.cos(ang) * ship.visual.length * 0.5, y: ship.pos.y + Math.sin(ang) * ship.visual.length * 0.5 };
    var result = { ship: ship, facing: facing, absorbed: absorbed, hullDamage: hullDamage, subsystem: subsystem, shieldsDown: shieldsDown, impact: impact, angle: ang, kind: kind, amount: amount };
    if (subsystem) { var hp = hardpointWorld(ship, subsystem); if (hp) result.subsystemPoint = hp; }
    if (absorbed > 0) BS.Events.emit("shieldHit", result);
    if (hullDamage > 0) BS.Events.emit("hullHit", result);
    if (subsystem) BS.Events.emit("subsystemDamaged", result);
    if (ship.hull <= 0) {
      ship.flags.destroyed = true;
      ship.destroyedTimer = 0;
      BS.Events.emit("shipDestroyed", { ship: ship, killer: attacker });
    }
    return result;
  }

  // ---- helm steering ----------------------------------------------------
  function orbitHeading(ship, target, range, dir) {
    var d = distanceTo(ship, target);
    var toT = U.angleTo(ship.pos.x, ship.pos.y, target.pos.x, target.pos.y);
    if (d > range * 1.2) return { heading: toT + dir * 0.35, speed: 1 };
    if (d < range * 0.75) return { heading: toT + dir * (Math.PI / 2 + 0.6), speed: 1 };
    // tangent, nudged in/out to hold range
    var nudge = (d - range) / range;  // positive = too far
    return { heading: toT + dir * (Math.PI / 2 - nudge * 0.9), speed: 0.85 };
  }

  function updateHelm(ship, target, dt) {
    var h = ship.helm;
    var cls = ship.cls;
    var pr = (ship.aiProfile && ship.aiProfile.preferredRange) || cls.preferredRange;
    if (!target || target.flags.destroyed) {
      h.desiredSpeed = 0;
      return;
    }
    var toT = U.angleTo(ship.pos.x, ship.pos.y, target.pos.x, target.pos.y);
    var d = distanceTo(ship, target);
    var out;
    switch (h.mode) {
      case "attack":
        // Orbit at preferred range; turn in for a torpedo pass whenever the tubes
        // are loaded (or every so often anyway), then break off again.
        h.phaseTimer += dt;
        if (h.phase === "run") {
          out = { heading: toT, speed: 1 };
          var fired = ship.torpedoReload > 0 && ship.pendingSpread === 0;
          if ((fired && h.phaseTimer > 1.5) || h.phaseTimer > 9 || d < pr * 0.45) { h.phase = "break"; h.phaseTimer = 0; h.orbitDir = -h.orbitDir; }
        } else {
          out = orbitHeading(ship, target, pr, h.orbitDir);
          var wantTorps = ship.flags.armed && ship.torpedoReload <= 0 && (ship.flags.fireAtWill || ship.fireOnce.torpedoes);
          if ((wantTorps && h.phaseTimer > 2.5) || h.phaseTimer > 16) { h.phase = "run"; h.phaseTimer = 0; }
        }
        break;
      case "evasive":
        h.phaseTimer += dt;
        out = orbitHeading(ship, target, pr * 1.1, h.orbitDir);
        out.heading += Math.sin(h.phaseTimer * 1.7) * 0.9;
        out.speed = 1;
        break;
      case "close":
        out = orbitHeading(ship, target, cls.closeRange, h.orbitDir);
        break;
      case "open":
        out = d < cls.openRange * 0.9 ? { heading: toT + Math.PI + h.orbitDir * 0.4, speed: 1 } : orbitHeading(ship, target, cls.openRange, h.orbitDir);
        break;
      case "comeAbout":
        out = { heading: toT - facingOffset(h.comeAboutFacing || "fore"), speed: 0.25 };
        break;
      default: // idle: drift to a stop
        out = { heading: ship.heading, speed: 0 };
    }
    h.desiredHeading = out.heading;
    h.desiredSpeed = out.speed * maxSpeed(ship);
  }

  function updateMovement(ship, dt) {
    ship.prevPos.x = ship.pos.x; ship.prevPos.y = ship.pos.y; ship.prevHeading = ship.heading;
    var diff = U.normAngle(ship.helm.desiredHeading - ship.heading);
    var maxTurn = turnRate(ship) * dt;
    if (Math.abs(diff) <= maxTurn) ship.heading = ship.helm.desiredHeading; else ship.heading += Math.sign(diff) * maxTurn;
    ship.heading = U.normAngle(ship.heading);
    var accel = maxSpeed(ship) * 0.9;
    if (ship.speed < ship.helm.desiredSpeed) ship.speed = Math.min(ship.helm.desiredSpeed, ship.speed + accel * dt);
    else ship.speed = Math.max(ship.helm.desiredSpeed, ship.speed - accel * dt);
    ship.pos.x += Math.cos(ship.heading) * ship.speed * dt;
    ship.pos.y += Math.sin(ship.heading) * ship.speed * dt;
  }

  // ---- per-step systems -------------------------------------------------
  function updateSystems(ship, dt) {
    // shields regen
    var regen = ship.shieldRegen * shieldsMult(ship) * dt;
    for (var i = 0; i < FACINGS.length; i++) {
      var f = FACINGS[i];
      if (ship.shields[f] < ship.shieldMax) ship.shields[f] = Math.min(ship.shieldMax, ship.shields[f] + regen);
    }
    // reinforce transfer
    var r = ship.reinforce;
    if (r) {
      var step = Math.min(r.perSecond * dt, r.remaining, ship.shields[r.from]);
      ship.shields[r.from] -= step;
      ship.shields[r.to] = Math.min(ship.shieldMax, ship.shields[r.to] + step);
      r.remaining -= step;
      if (r.remaining <= 0.01 || step <= 0) ship.reinforce = null;
    }
    // repairs
    var rate = ship.cls.repairRate * ship.mods.repairMult * dt;
    var prio = ship.repairPriority;
    var ids = subsystemIds();
    if (!prio) {
      var worst = null;
      ids.forEach(function (s) { if (ship.subsystems[s] < 100 && (worst === null || ship.subsystems[s] < ship.subsystems[worst])) worst = s; });
      prio = worst;
    }
    ids.forEach(function (s) {
      if (ship.subsystems[s] >= 100) return;
      var before = ship.subsystems[s];
      ship.subsystems[s] = Math.min(100, before + (s === prio ? rate : rate * 0.25));
      if (before < 100 && ship.subsystems[s] >= 100) BS.Events.emit("subsystemRepaired", { ship: ship, subsystem: s });
    });
    // hull patching once damage control has nothing else to do
    if (ship.hull < ship.hullMax && subsystemIds().every(function (s) { return ship.subsystems[s] >= 100; })) {
      ship.hull = Math.min(ship.hullMax, ship.hull + BS.Data.balance.hullRepairRate * ship.mods.repairMult * dt);
    }
    // weapon timers
    var wm = weaponsMult(ship);
    if (ship.phaserCooldown > 0) ship.phaserCooldown -= dt * wm;
    if (ship.torpedoReload > 0) ship.torpedoReload -= dt * torpedoMult(ship);
  }

  function update(ship, target, dt) {
    if (ship.flags.destroyed) { ship.destroyedTimer += dt; ship.prevPos.x = ship.pos.x; ship.prevPos.y = ship.pos.y; ship.prevHeading = ship.heading; return; }
    updateHelm(ship, target, dt);
    updateMovement(ship, dt);
    updateSystems(ship, dt);
  }

  return {
    FACINGS: FACINGS,
    create: create,
    update: update,
    applyDamage: applyDamage,
    facingToward: facingToward,
    facingOffset: facingOffset,
    strongestFacing: strongestFacing,
    weakestFacing: weakestFacing,
    distanceTo: distanceTo,
    bearingTo: bearingTo,
    inArc: inArc,
    setHelmMode: setHelmMode,
    setPowerPreset: setPowerPreset,
    setAlert: setAlert,
    startReinforce: startReinforce,
    weaponsMult: weaponsMult,
    torpedoMult: torpedoMult,
    sensorsMult: sensorsMult,
    bridgeDelayMult: bridgeDelayMult,
    subsystemIds: subsystemIds,
    hardpointWorld: hardpointWorld,
    hardpointAt: hardpointAt,
    enginesMult: enginesMult,
    shieldsMult: shieldsMult,
    subMult: subMult,
    maxSpeed: maxSpeed,
  };
})();
