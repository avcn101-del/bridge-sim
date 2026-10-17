// js/ships.js — ship model: hull, shields, subsystems, capacitor, lock,
// movement commands, fitted modules, damage.
window.BS = window.BS || {};

BS.Ships = (function () {
  var U = BS.Util;
  var FACINGS = ["fore", "starboard", "aft", "port"];
  var nextId = 1;

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }
  function km(px) { return px / BS.Data.units.pxPerKm; }
  function px(kmv) { return kmv * BS.Data.units.pxPerKm; }

  // Build a runtime ship object from a class id. options: { name, pos, heading,
  // statMult, mods, isPlayer, fit }
  function create(classId, options) {
    options = options || {};
    var cls = BS.Data.shipClasses[classId];
    if (!cls) throw new Error("Unknown ship class " + classId);
    var statMult = options.statMult || 1;
    var mods = Object.assign({
      damageMult: 1, turretDamageMult: 1, launcherDamageMult: 1, cycleMult: 1, shieldMaxMult: 1, shieldRegenMult: 1, capMult: 1, capRechargeMult: 1,
      speedMult: 1, turnMult: 1, hullMult: 1, repairMult: 1, accuracyBonus: 0, lockMult: 1,
    }, options.mods || {});

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
      vel: { x: 0, y: 0 },
      subsystems: deepCopy(cls.subsystems),
      flags: { alert: "none", destroyed: false, armed: false },
      // targeting
      selected: null,                       // ship selected in the overview / on the display
      lock: { target: null, progress: 0, locked: false, time: 0 },
      targetSubsystem: null,
      // movement command
      cmd: { type: "idle", target: null, range: 0, point: null, orbitDir: Math.random() < 0.5 ? 1 : -1, facing: null },
      desiredHeading: options.heading || 0, desiredSpeed: 0,
      repairPriority: null,
      reinforce: null, reinforceCooldown: 0,
      visual: Object.assign({}, cls.visual),
      stats: { damageDealt: 0, damageTaken: 0, torpedoesFired: 0, torpedoHits: 0, phasersFired: 0, phaserHits: 0 },
      mods: mods,
      statMult: statMult,
      aiProfile: options.aiProfile || null,
      ai: null,
      destroyedTimer: 0,
      smokeTimer: 0,
      reportState: { shieldLow: {}, subsystemLow: {}, hullCritical: false, capLow: false },
      modules: [],
      fitEffects: {},
      activeEffects: {},
    };
    ship.prevPos.x = ship.pos.x; ship.prevPos.y = ship.pos.y;
    BS.Modules.fit(ship, options.fit || cls.fit);
    var hullMax = Math.round((cls.hull + (ship.fitEffects.hullAdd || 0)) * statMult * mods.hullMult);
    var shieldMax = Math.round(cls.shields.max * statMult * mods.shieldMaxMult);
    ship.hull = hullMax; ship.hullMax = hullMax;
    ship.shields = { fore: shieldMax, aft: shieldMax, port: shieldMax, starboard: shieldMax };
    ship.shieldMax = shieldMax;
    ship.shieldRegen = cls.shields.regen * mods.shieldRegenMult;
    ship.capMax = Math.round(cls.capacitor.max * mods.capMult);
    ship.capacitor = ship.capMax;
    ship.signature = cls.signature;
    return ship;
  }

  // ---- multipliers ------------------------------------------------------
  function subMult(ship, sys) {
    var f = BS.Data.subsystemFloor;
    return f + (1 - f) * U.clamp(ship.subsystems[sys], 0, 100) / 100;
  }
  function sensorsMult(ship) {
    var f = BS.Data.subsystemEffects.sensorsAccuracyFloor;
    return f + (1 - f) * U.clamp(ship.subsystems.sensors, 0, 100) / 100;
  }
  function lockTimeMult(ship) {
    var m = BS.Data.subsystemEffects.sensorsLockMaxMult;
    return (1 + (m - 1) * (1 - U.clamp(ship.subsystems.sensors, 0, 100) / 100)) * (ship.activeEffects.lockMult || 1) * ship.mods.lockMult;
  }
  function capRechargeMult(ship) {
    var m = BS.Data.subsystemEffects.bridgeCapMinMult;
    var bridge = m + (1 - m) * U.clamp(ship.subsystems.bridge, 0, 100) / 100;
    return bridge * (ship.fitEffects.capRechargeMult || 1) * ship.mods.capRechargeMult;
  }
  function shieldsMult(ship) {
    var m = subMult(ship, "shields");
    if (!ship.flags.armed) m *= BS.Data.balance.noAlertShieldRegenMult;
    return m;
  }
  function enginesMult(ship) { return subMult(ship, "engines"); }
  function maxSpeed(ship) {
    return ship.cls.speed * enginesMult(ship) * ship.mods.speedMult * (ship.fitEffects.speedMult || 1) * (ship.activeEffects.speedMult || 1);
  }
  function turnRate(ship) { return ship.cls.turnRate * U.DEG * (0.5 + 0.5 * enginesMult(ship)) * ship.mods.turnMult; }
  function subsystemIds() { return Object.keys(BS.Data.subsystems); }

  // ---- geometry ---------------------------------------------------------
  function facingToward(ship, x, y) {
    var rel = U.normAngle(U.angleTo(ship.pos.x, ship.pos.y, x, y) - ship.heading);
    var a = Math.abs(rel);
    if (a < Math.PI / 4) return "fore";
    if (a > 3 * Math.PI / 4) return "aft";
    return rel > 0 ? "starboard" : "port";
  }
  function facingOffset(facing) { return { fore: 0, starboard: Math.PI / 2, aft: Math.PI, port: -Math.PI / 2 }[facing]; }
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
  function distanceKm(ship, other) { return km(distanceTo(ship, other)); }
  function bearingTo(ship, other) { return U.normAngle(U.angleTo(ship.pos.x, ship.pos.y, other.pos.x, other.pos.y) - ship.heading); }
  function inArc(ship, other, arcDeg) { return Math.abs(bearingTo(ship, other)) <= (arcDeg / 2) * U.DEG; }
  // angular velocity of `other` as seen from `ship`, rad/s
  function angularVelocity(ship, other) {
    var dx = other.pos.x - ship.pos.x, dy = other.pos.y - ship.pos.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) return 0;
    var rvx = other.vel.x - ship.vel.x, rvy = other.vel.y - ship.vel.y;
    var transversal = Math.abs(rvx * (-dy / d) + rvy * (dx / d));
    return transversal / d;
  }
  function speedKmS(ship) { return km(ship.speed); }

  // ---- hardpoints -------------------------------------------------------
  function hardpointWorld(ship, sys) {
    var hps = ship.visual.hardpoints && ship.visual.hardpoints[sys];
    if (!hps || !hps.length) return null;
    var h = hps[Math.floor(Math.random() * hps.length)];
    return U.localToWorld(ship, h.x, h.y);
  }
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
    if (U.dist(wx, wy, ship.pos.x, ship.pos.y) <= ship.visual.length * 0.6) return { sys: null, x: ship.pos.x, y: ship.pos.y, r: 0 };
    return null;
  }

  // ---- commands ---------------------------------------------------------
  function setCommand(ship, type, opts) {
    opts = opts || {};
    var c = ship.cmd;
    c.type = type;
    c.target = opts.target || null;
    c.range = opts.rangeKm !== undefined ? px(opts.rangeKm) : c.range;
    c.point = opts.point || null;
    if (type === "comeAbout") c.facing = strongestFacing(ship);
    if (opts.flipOrbit) c.orbitDir = -c.orbitDir;
  }
  function setAlert(ship, level) { ship.flags.alert = level; ship.flags.armed = level !== "none"; }
  function startReinforce(ship) {
    if (ship.reinforceCooldown > 0) return "cooldown";
    var from = strongestFacing(ship), to = weakestFacing(ship);
    if (from === to || ship.shields[from] - ship.shields[to] < ship.shieldMax * 0.1) return null;
    var amount = ship.shields[from] * BS.Data.balance.reinforceFraction;
    ship.reinforce = { from: from, to: to, perSecond: amount / BS.Data.balance.reinforceDuration, remaining: amount };
    ship.reinforceCooldown = BS.Data.balance.reinforceCooldown;
    return ship.reinforce;
  }

  // ---- locking ----------------------------------------------------------
  function lockTime(ship, target) {
    var B = BS.Data.balance;
    return B.lockBase * (B.lockRefSignature / target.signature) * (B.lockRefSensor / ship.cls.sensorStrength) * lockTimeMult(ship);
  }
  function startLock(ship, target) {
    if (!target || target.flags.destroyed) return "noTarget";
    if (distanceKm(ship, target) > ship.cls.lockRangeKm) return "outOfRange";
    if (ship.lock.target === target && (ship.lock.locked || ship.lock.progress > 0)) return "already";
    ship.lock = { target: target, progress: 0, locked: false, time: lockTime(ship, target) };
    BS.Events.emit("lockStarted", { ship: ship, target: target });
    return "ok";
  }
  function clearLock(ship, reason) {
    var had = ship.lock.target;
    ship.lock = { target: null, progress: 0, locked: false, time: 0 };
    if (had) BS.Events.emit("lockLost", { ship: ship, target: had, reason: reason || "unlock" });
  }
  function updateLock(ship, dt) {
    var L = ship.lock;
    if (!L.target) return;
    if (L.target.flags.destroyed || distanceKm(ship, L.target) > ship.cls.lockRangeKm * 1.1) { clearLock(ship, "range"); return; }
    if (L.locked) return;
    L.time = lockTime(ship, L.target);
    L.progress += dt / L.time;
    if (L.progress >= 1) { L.progress = 1; L.locked = true; BS.Events.emit("lockAcquired", { ship: ship, target: L.target }); }
  }

  // ---- damage -----------------------------------------------------------
  function applyDamage(ship, amount, fromX, fromY, targetSubsystem, attacker, kind) {
    if (ship.flags.destroyed) return null;
    var B = BS.Data.balance;
    var facing = facingToward(ship, fromX, fromY);
    var shield = ship.shields[facing];
    var resist = ship.activeEffects.shieldResist || 0;
    var shieldAmount = amount * (1 - resist);
    var absorbed = Math.min(shield, shieldAmount);
    ship.shields[facing] = shield - absorbed;
    var leftover = shieldAmount - absorbed;             // what the (resisted) shield could not take
    var hullDamage = leftover / Math.max(0.01, 1 - resist) + absorbed * B.shieldBleedThrough;
    if (absorbed <= 0) hullDamage = amount;             // shield already down: full damage, no resist
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
    var ang = U.angleTo(ship.pos.x, ship.pos.y, fromX, fromY);
    var impact = { x: ship.pos.x + Math.cos(ang) * ship.visual.length * 0.5, y: ship.pos.y + Math.sin(ang) * ship.visual.length * 0.5 };
    var result = { ship: ship, facing: facing, absorbed: absorbed, hullDamage: hullDamage, subsystem: subsystem, shieldsDown: shieldsDown, impact: impact, angle: ang, kind: kind, amount: amount, attacker: attacker };
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

  // ---- movement from commands ------------------------------------------
  function orbitHeading(ship, target, range, dir) {
    var d = distanceTo(ship, target);
    var toT = U.angleTo(ship.pos.x, ship.pos.y, target.pos.x, target.pos.y);
    if (d > range * 1.25) return { heading: toT + dir * 0.3, speed: 1 };
    if (d < range * 0.7) return { heading: toT + dir * (Math.PI / 2 + 0.7), speed: 1 };
    var nudge = (d - range) / range;
    return { heading: toT + dir * (Math.PI / 2 - nudge * 1.0), speed: 1 };
  }
  function keepHeading(ship, target, range, dir) {
    var d = distanceTo(ship, target);
    var toT = U.angleTo(ship.pos.x, ship.pos.y, target.pos.x, target.pos.y);
    if (d > range * 1.08) return { heading: toT, speed: 1 };
    if (d < range * 0.92) return { heading: toT + Math.PI, speed: 1 };
    // on the ring: drift sideways slowly to keep some angular motion
    return { heading: toT + dir * Math.PI / 2, speed: 0.35 };
  }

  function updateCommand(ship, dt) {
    var c = ship.cmd, out;
    var t = c.target;
    if (t && t.flags.destroyed) { c.type = "idle"; t = null; }
    switch (c.type) {
      case "approach":
        out = { heading: U.angleTo(ship.pos.x, ship.pos.y, t.pos.x, t.pos.y), speed: distanceTo(ship, t) < ship.visual.length ? 0.2 : 1 };
        break;
      case "orbit": out = orbitHeading(ship, t, c.range, c.orbitDir); break;
      case "keep": out = keepHeading(ship, t, c.range, c.orbitDir); break;
      case "flyTo": {
        var d = U.dist(ship.pos.x, ship.pos.y, c.point.x, c.point.y);
        if (d < 12) { c.type = "idle"; out = { heading: ship.heading, speed: 0 }; }
        else out = { heading: U.angleTo(ship.pos.x, ship.pos.y, c.point.x, c.point.y), speed: d < 60 ? 0.4 : 1 };
        break;
      }
      case "comeAbout": {
        var ref = t || ship.lock.target || ship.selected;
        if (!ref) { out = { heading: ship.heading, speed: 0 }; break; }
        out = { heading: U.angleTo(ship.pos.x, ship.pos.y, ref.pos.x, ref.pos.y) - facingOffset(c.facing || "fore"), speed: 0.25 };
        break;
      }
      default: out = { heading: ship.heading, speed: 0 };
    }
    ship.desiredHeading = out.heading;
    ship.desiredSpeed = out.speed * maxSpeed(ship);
  }

  function updateMovement(ship, dt) {
    ship.prevPos.x = ship.pos.x; ship.prevPos.y = ship.pos.y; ship.prevHeading = ship.heading;
    var diff = U.normAngle(ship.desiredHeading - ship.heading);
    var maxTurn = turnRate(ship) * dt;
    if (Math.abs(diff) <= maxTurn) ship.heading = ship.desiredHeading; else ship.heading += Math.sign(diff) * maxTurn;
    ship.heading = U.normAngle(ship.heading);
    var accel = maxSpeed(ship) * 0.8;
    if (ship.speed < ship.desiredSpeed) ship.speed = Math.min(ship.desiredSpeed, ship.speed + accel * dt);
    else ship.speed = Math.max(ship.desiredSpeed, ship.speed - accel * dt);
    ship.vel.x = Math.cos(ship.heading) * ship.speed; ship.vel.y = Math.sin(ship.heading) * ship.speed;
    ship.pos.x += ship.vel.x * dt;
    ship.pos.y += ship.vel.y * dt;
  }

  // ---- per-step systems -------------------------------------------------
  function updateSystems(ship, dt) {
    var B = BS.Data.balance;
    // capacitor recharge (EVE curve: fastest around 25%)
    var f = ship.capacitor / ship.capMax;
    var rate = (ship.capMax / ship.cls.capacitor.rechargeTime) * B.capCurve * Math.max(0, Math.sqrt(f) - f) * capRechargeMult(ship);
    if (f < 0.02) rate = (ship.capMax / ship.cls.capacitor.rechargeTime) * 0.4 * capRechargeMult(ship);  // never fully stalls
    ship.capacitor = Math.min(ship.capMax, ship.capacitor + rate * dt);
    // shields regen
    var regen = ship.shieldRegen * shieldsMult(ship) * dt;
    for (var i = 0; i < FACINGS.length; i++) {
      var fc = FACINGS[i];
      if (ship.shields[fc] < ship.shieldMax) ship.shields[fc] = Math.min(ship.shieldMax, ship.shields[fc] + regen);
    }
    // reinforce transfer
    if (ship.reinforceCooldown > 0) ship.reinforceCooldown -= dt;
    var r = ship.reinforce;
    if (r) {
      var step = Math.min(r.perSecond * dt, r.remaining, ship.shields[r.from]);
      ship.shields[r.from] -= step;
      ship.shields[r.to] = Math.min(ship.shieldMax, ship.shields[r.to] + step);
      r.remaining -= step;
      if (r.remaining <= 0.01 || step <= 0) ship.reinforce = null;
    }
    // repairs
    var rrate = ship.cls.repairRate * ship.mods.repairMult * dt;
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
      ship.subsystems[s] = Math.min(100, before + (s === prio ? rrate : rrate * 0.25));
      if (before < 100 && ship.subsystems[s] >= 100) BS.Events.emit("subsystemRepaired", { ship: ship, subsystem: s });
    });
    if (ship.hull < ship.hullMax && ids.every(function (s) { return ship.subsystems[s] >= 100; })) {
      ship.hull = Math.min(ship.hullMax, ship.hull + B.hullRepairRate * ship.mods.repairMult * dt);
    }
  }

  function update(ship, dt) {
    if (ship.flags.destroyed) { ship.destroyedTimer += dt; ship.prevPos.x = ship.pos.x; ship.prevPos.y = ship.pos.y; ship.prevHeading = ship.heading; ship.vel.x = ship.vel.y = 0; return; }
    BS.Modules.update(ship, dt);      // sets activeEffects, fires weapons, spends capacitor
    updateLock(ship, dt);
    updateCommand(ship, dt);
    updateMovement(ship, dt);
    updateSystems(ship, dt);
  }

  return {
    FACINGS: FACINGS, km: km, px: px,
    create: create, update: update, applyDamage: applyDamage,
    facingToward: facingToward, facingOffset: facingOffset, strongestFacing: strongestFacing, weakestFacing: weakestFacing,
    distanceTo: distanceTo, distanceKm: distanceKm, bearingTo: bearingTo, inArc: inArc, angularVelocity: angularVelocity, speedKmS: speedKmS,
    setCommand: setCommand, setAlert: setAlert, startReinforce: startReinforce,
    startLock: startLock, clearLock: clearLock, lockTime: lockTime,
    sensorsMult: sensorsMult, subsystemIds: subsystemIds, hardpointWorld: hardpointWorld, hardpointAt: hardpointAt,
    enginesMult: enginesMult, shieldsMult: shieldsMult, subMult: subMult, maxSpeed: maxSpeed, capRechargeMult: capRechargeMult,
  };
})();
