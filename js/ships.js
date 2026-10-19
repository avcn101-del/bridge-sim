// js/ships.js — ship model built from a block grid: hull from blocks, shield
// facings, capacitor, lock, movement commands, per-block damage.
window.BS = window.BS || {};

BS.Ships = (function () {
  var U = BS.Util, Gr = BS.Grid;
  var FACINGS = ["fore", "starboard", "aft", "port"];
  var nextId = 1;

  function km(px) { return px / BS.Data.units.pxPerKm; }
  function px(kmv) { return kmv * BS.Data.units.pxPerKm; }

  // options: { name, pos, heading, statMult, mods, isPlayer, layout }
  function create(classId, options) {
    options = options || {};
    var cls = BS.Data.shipClasses[classId];
    if (!cls) throw new Error("Unknown ship class " + classId);
    var statMult = options.statMult || 1;
    var mods = Object.assign({
      damageMult: 1, turretDamageMult: 1, launcherDamageMult: 1, cycleMult: 1, shieldMaxMult: 1, shieldRegenMult: 1, capMult: 1, capRechargeMult: 1,
      speedMult: 1, turnMult: 1, repairMult: 1, accuracyBonus: 0, lockMult: 1,
    }, options.mods || {});
    var grid = Gr.build(cls, options.layout || cls.layout, statMult);
    var st = Gr.derive(grid);
    var ship = {
      id: nextId++, classId: classId, cls: cls, name: options.name || cls.name, faction: cls.faction, isPlayer: !!options.isPlayer,
      pos: { x: options.pos ? options.pos.x : 0, y: options.pos ? options.pos.y : 0 }, prevPos: { x: 0, y: 0 },
      heading: options.heading || 0, prevHeading: options.heading || 0, speed: 0, vel: { x: 0, y: 0 },
      grid: grid, stats: st, statMult: statMult, mods: mods,
      hullMax: st.hullTotal, hull: st.hullAlive,
      shieldMax: {}, shields: {}, shieldRegen: {},
      capMax: 0, capacitor: 0, heat: 0, overload: 0, heatGovernor: true, governorHold: false, jammed: 0, partialJam: 0, partialJamBy: null, neuted: 0, boarding: null, shieldDelay: { fore: 0, aft: 0, port: 0, starboard: 0 }, attackSide: "auto", tumble: 0, tumbleDir: 1, breach: 0, hadReactors: false, aimBlock: null, cloak: { state: "off", t: 0, surge: 0, strike: 0 },
      signature: cls.signature,
      flags: { alert: "none", destroyed: false, disabled: false, armed: false },
      selected: null, lock: { target: null, progress: 0, locked: false, time: 0 }, aimType: null, stance: null, play: null,
      cmd: { type: "idle", target: null, range: 0, point: null, orbitDir: Math.random() < 0.5 ? 1 : -1, facing: null, bearing: 0 },
      desiredHeading: options.heading || 0, desiredSpeed: 0,
      repairPriority: null, reinforce: null, reinforceCooldown: 0,
      visual: Object.assign({}, cls.visual, { scale: 1, length: grid.w * grid.cellPx, width: grid.h * grid.cellPx }),
      battle: { damageDealt: 0, damageTaken: 0, torpedoesFired: 0, torpedoHits: 0, phasersFired: 0, phaserHits: 0, blocksLost: 0, blocksKilled: 0 },
      aiProfile: options.aiProfile || null, ai: null, destroyedTimer: 0, smokeTimer: 0,
      reportState: { shieldLow: {}, capLow: false, hullCritical: false },
      modules: [], activeEffects: {},
    };
    ship.prevPos.x = ship.pos.x; ship.prevPos.y = ship.pos.y;
    refreshDerived(ship, true);
    BS.Modules.fit(ship);
    return ship;
  }

  // No weapons and no engines left: dead in space. The battle ends; the enemy is captured for salvage.
  function checkDisabled(ship, by) {
    var st = ship.stats;
    if (ship.flags.disabled || ship.flags.destroyed || st.weapons.length || st.thrust > 0) return false;
    ship.flags.disabled = true;
    BS.Modules.weapons(ship).forEach(function (m) { BS.Modules.setActive(ship, m, false); });
    setCommand(ship, "idle");
    BS.Events.emit("shipDisabled", { ship: ship, by: by || null });
    return true;
  }
  // Recompute block-derived numbers; `initial` fills shields and capacitor.
  function refreshDerived(ship, initial) {
    var st = Gr.derive(ship.grid);
    ship.stats = st;
    if (initial) ship.hadReactors = (st.alive.reactor || 0) > 0;
    // the last reactor gone: the core goes critical (grid.breach); the countdown runs in updateSystems
    if (!initial && ship.hadReactors && !(st.alive.reactor > 0) && ship.breach <= 0 && !ship.flags.destroyed) { ship.breach = BS.Data.grid.breach.time; BS.Events.emit("coreBreach", { ship: ship, time: ship.breach }); }
    ship.hull = st.hullAlive; ship.hullMax = st.hullTotal;
    FACINGS.forEach(function (f) {
      ship.shieldMax[f] = Math.round(st.shieldMax[f] * ship.statMult * ship.mods.shieldMaxMult);
      ship.shieldRegen[f] = st.regen[f] * ship.mods.shieldRegenMult;
      if (initial) ship.shields[f] = ship.shieldMax[f]; else ship.shields[f] = Math.min(ship.shields[f], ship.shieldMax[f]);
    });
    ship.capMax = Math.round(st.cap * ship.mods.capMult);
    if (initial) ship.capacitor = ship.capMax; else ship.capacitor = Math.min(ship.capacitor, ship.capMax);
    ship.sensorStrength = st.sensors;
    if (!initial) checkDisabled(ship, null);
    return st;
  }

  // ---- multipliers ------------------------------------------------------
  function shieldFrac(ship, f) { return ship.shieldMax[f] > 0 ? ship.shields[f] / ship.shieldMax[f] : 0; }
  function trackingMult(ship) { return (1 + 0.03 * (ship.stats.sensors - BS.Data.grid.sensorBase)) * (ship.activeEffects.trackingMult || 1); }
  function lockTimeMult(ship) { return (ship.activeEffects.lockMult || 1) * ship.mods.lockMult; }
  function capRechargeMult(ship) { return ship.mods.capRechargeMult; }
  function shieldsMult(ship) { return ship.flags.armed ? 1 : BS.Data.balance.noAlertShieldRegenMult; }
  function maxSpeed(ship) { return ship.cls.speed * ship.stats.speedMult * ship.mods.speedMult * (ship.activeEffects.speedMult || 1); }
  function turnRate(ship) { return ship.cls.turnRate * U.DEG * (0.5 + 0.5 * Math.min(1, ship.stats.speedMult)) * ship.mods.turnMult; }
  function blockTypes() { return Object.keys(BS.Data.blocks); }

  // ---- geometry ---------------------------------------------------------
  function facingToward(ship, x, y) {
    var rel = U.normAngle(U.angleTo(ship.pos.x, ship.pos.y, x, y) - ship.heading);
    var a = Math.abs(rel);
    if (a < Math.PI / 4) return "fore";
    if (a > 3 * Math.PI / 4) return "aft";
    return rel > 0 ? "starboard" : "port";
  }
  function facingOffset(facing) { return { fore: 0, starboard: Math.PI / 2, aft: Math.PI, port: -Math.PI / 2 }[facing]; }
  function strongestFacing(ship) { var best = "fore"; FACINGS.forEach(function (f) { if (ship.shields[f] > ship.shields[best]) best = f; }); return best; }
  function weakestFacing(ship) { var worst = "fore"; FACINGS.forEach(function (f) { if (ship.shields[f] < ship.shields[worst]) worst = f; }); return worst; }
  function distanceTo(ship, other) { return U.dist(ship.pos.x, ship.pos.y, other.pos.x, other.pos.y); }
  function distanceKm(ship, other) { return km(distanceTo(ship, other)); }
  function bearingTo(ship, other) { return U.normAngle(U.angleTo(ship.pos.x, ship.pos.y, other.pos.x, other.pos.y) - ship.heading); }
  function angularVelocity(ship, other) {
    var dx = other.pos.x - ship.pos.x, dy = other.pos.y - ship.pos.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) return 0;
    var rvx = other.vel.x - ship.vel.x, rvy = other.vel.y - ship.vel.y;
    return Math.abs(rvx * (-dy / d) + rvy * (dx / d)) / d;
  }
  function speedKmS(ship) { return km(ship.speed); }

  // ---- commands ---------------------------------------------------------
  function setCommand(ship, type, opts) {
    opts = opts || {};
    var c = ship.cmd;
    c.type = type; c.target = opts.target || null;
    c.range = opts.rangeKm !== undefined ? px(opts.rangeKm) : c.range;
    c.point = opts.point || null;
    if (type === "comeAbout") c.facing = opts.facing || strongestFacing(ship);
    if (opts.bearing !== undefined) c.bearing = opts.bearing;   // shadow: radians from the target's heading
    if (opts.flipOrbit) c.orbitDir = -c.orbitDir;
  }
  function setAlert(ship, level) { ship.flags.alert = level; ship.flags.armed = level !== "none"; }
  function startReinforce(ship) {
    if (ship.reinforceCooldown > 0) return "cooldown";
    var from = strongestFacing(ship), to = weakestFacing(ship);
    if (from === to || ship.shields[from] - ship.shields[to] < ship.shieldMax[from] * 0.1) return null;
    var amount = ship.shields[from] * BS.Data.balance.reinforceFraction;
    ship.reinforce = { from: from, to: to, perSecond: amount / BS.Data.balance.reinforceDuration, remaining: amount };
    ship.reinforceCooldown = BS.Data.balance.reinforceCooldown;
    return ship.reinforce;
  }

  // ---- electronic warfare -------------------------------------------------
  function isCloaked(ship) { return ship.cloak.state === "cloaked" || ship.cloak.state === "cloaking"; }
  // How visible `ship` is to `viewer`: 1 normal, 0 invisible, in between a ghost or a transition.
  function visibility(ship, viewer) {
    var c = ship.cloak, E = BS.Data.ew;
    if (c.state === "off") return 1;
    var hidden = viewer === ship ? E.ownCloakAlpha : (viewer && distanceKm(ship, viewer) <= detectRangeKm(viewer) ? E.ghostAlpha : 0);
    if (c.state === "cloaked") return hidden;
    var k = U.clamp(c.t / (c.state === "cloaking" ? E.cloakTime : E.decloakTime), 0, 1);
    return c.state === "cloaking" ? U.lerp(1, hidden, k) : U.lerp(hidden, 1, k);
  }
  // What a viewer knows of a target's position (honest loss, 0.26): the target itself while it is visible (not cloaked,
  // or cloaked inside the viewer's detect range), otherwise the last contact the viewer had, standing still. The AI, the
  // helm and the script conditions read ranges and bearings from this, never from a cloaked ship's true position.
  function contact(viewer, target) {
    if (!target) return null;
    var k = viewer.contact;
    if (!k || k.of !== target) k = viewer.contact = { of: target, pos: { x: target.pos.x, y: target.pos.y }, heading: target.heading, live: true, lostAt: 0, ghost: null };
    if (visibility(target, viewer) > 0) { k.pos.x = target.pos.x; k.pos.y = target.pos.y; k.heading = target.heading; k.live = true; k.ghost = null; return target; }
    if (k.live || !k.ghost) { k.live = false; k.lostAt = BS.Game && BS.Game.state ? BS.Game.state.time : 0; k.ghost = { ghost: true, pos: { x: k.pos.x, y: k.pos.y }, vel: { x: 0, y: 0 }, heading: k.heading, speed: 0, flags: {}, cmd: { type: "idle" } }; }
    return k.ghost;
  }
  function contactKm(viewer, target) { var c = contact(viewer, target); return c ? km(U.dist(viewer.pos.x, viewer.pos.y, c.pos.x, c.pos.y)) : 999; }
  function detectRangeKm(viewer) { return BS.Data.science.cloakDetectRangeKm + BS.Data.ew.detectPerSensor * ((viewer.stats.alive && viewer.stats.alive.sensor) || 0); }
  // A ship can cloak only while every alive block lies inside a cloak field (stats.cloakCover, ew.cloakRadius).
  function cloakFieldComplete(ship) { var cc = ship.stats.cloakCover; return !!cc && cc.sources > 0 && cc.frac >= 1; }
  function setCloak(ship, on) {
    var c = ship.cloak;
    if (on && c.state === "off" && !cloakFieldComplete(ship)) { BS.Events.emit("cloakRefused", { ship: ship, exposed: ship.stats.cloakCover ? ship.stats.cloakCover.exposed : 0 }); return false; }
    if (on && c.state === "off") { c.state = "cloaking"; c.t = 0; BS.Events.emit("cloakChanged", { ship: ship, state: c.state }); return true; }
    if (!on && isCloaked(ship)) { c.state = "decloaking"; c.t = 0; BS.Events.emit("cloakChanged", { ship: ship, state: c.state }); return true; }
    return false;
  }
  function updateCloak(ship, dt) {
    var c = ship.cloak, E = BS.Data.ew;
    if (c.surge > 0) c.surge -= dt;
    if (c.strike > 0) c.strike -= dt;
    if (c.state === "off") return;
    c.t += dt;
    if (c.state === "cloaking" && c.t >= E.cloakTime) { c.state = "cloaked"; c.t = 0; BS.Events.emit("cloakChanged", { ship: ship, state: c.state }); }
    if (c.state === "cloaked") {
      ship.capacitor = Math.max(0, ship.capacitor - E.cloakDrain * dt);
      if (ship.capacitor < E.cloakMinCap) { c.state = "decloaking"; c.t = 0; BS.Events.emit("cloakChanged", { ship: ship, state: "decloaking", reason: "nocap" }); }
    }
    // a block outside every cloak field (a cloaking device lost, a section cut off) collapses the cloak
    if (isCloaked(ship) && !cloakFieldComplete(ship)) { c.state = "decloaking"; c.t = 0; BS.Events.emit("cloakChanged", { ship: ship, state: "decloaking", reason: "field" }); }
    if (c.state === "decloaking" && c.t >= E.decloakTime) { c.state = "off"; c.t = 0; c.surge = E.surgeTime; c.strike = E.strike.window; BS.Events.emit("cloakChanged", { ship: ship, state: "off" }); }
  }
  // Shields are projected only with the cloak off and the decloak surge over; cloaked or surging, the pools are kept but
  // absorb nothing, so an ambusher comes out of cloak with the shields it went in with.
  function shieldsUp(ship) { return ship.cloak.state === "off" && ship.cloak.surge <= 0; }
  // What a shot at `target` is steered at: a partial jam (their ECM field does not cover the whole ship) forces the
  // attacker's fire onto the blocks outside that field; otherwise the captain's aim.
  function effectiveAim(ship, target) {
    if (ship.partialJam > 0 && ship.partialJamBy === target) return "unjammed";
    if (ship.aimType === "block") return ship.aimBlock && ship.aimBlock.ship === target && ship.aimBlock.block.alive ? ship.aimBlock.block : null;   // focus fire on one block
    return ship.aimType;
  }
  // Focus fire on one block of `target` (aim type "block"); null clears it. Same −15% as aiming at a type.
  function setAimBlock(ship, target, block) {
    if (!block || !target) { if (ship.aimType === "block") ship.aimType = null; ship.aimBlock = null; return false; }
    ship.aimType = "block"; ship.aimBlock = { ship: target, block: block };
    return true;
  }

  // ---- locking ----------------------------------------------------------
  function lockTime(ship, target) {
    var B = BS.Data.balance;
    return B.lockBase * (B.lockRefSignature / target.signature) * (B.lockRefSensor / Math.max(1, ship.stats.sensors)) * lockTimeMult(ship);
  }
  function startLock(ship, target) {
    if (!target || target.flags.destroyed) return "noTarget";
    if (ship.jammed > 0) return "jammed";
    if (isCloaked(target)) return "cloaked";
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
    if (isCloaked(L.target)) { clearLock(ship, "cloaked"); return; }
    if (L.locked) return;
    L.time = lockTime(ship, L.target);
    L.progress += dt / L.time;
    if (L.progress >= 1) { L.progress = 1; L.locked = true; BS.Events.emit("lockAcquired", { ship: ship, target: L.target }); }
  }

  // ---- warp core breach: the ship is lost and everything inside the radius takes the blast ------------------------
  function coreBlast(ship) {
    var B = BS.Data.grid.breach, R = px(B.radiusKm), hits = [];
    (BS.Game.state.ships || []).forEach(function (o) {
      if (o === ship || o.flags.destroyed) return;
      var d = distanceTo(ship, o), k = 1 - d / R;
      if (k <= 0) return;
      var dmg = B.damage * k;
      var res = applyDamage(o, dmg, ship.pos.x, ship.pos.y, null, ship, "blast");
      hits.push({ ship: o, damage: dmg, result: res });
    });
    ship.flags.destroyed = true; ship.destroyedTimer = 0;
    BS.Events.emit("coreBlast", { ship: ship, hits: hits, radius: R });
    BS.Events.emit("shipDestroyed", { ship: ship, killer: null, breach: true });
  }
  // Drifting debris (a severed section) hits a ship: plain hull damage from its direction, no aim.
  function debrisHit(ship, amount, fromX, fromY) { return applyDamage(ship, amount, fromX, fromY, null, null, "debris"); }

  // ---- critical hits (grid.crits): the ship-level consequences; reactors and quarters were already lost in Grid.hit ----
  function applyCrit(ship, block, kind, attacker) {
    var C = BS.Data.grid.crits, facing = null;
    switch (kind) {
      case "engine": ship.tumble = C.tumbleTime; ship.tumbleDir = Math.random() < 0.5 ? 1 : -1; break;
      case "sensor": clearLock(ship, "crit"); ship.jammed = Math.max(ship.jammed, C.sensorBlind); break;
      case "shield": facing = Gr.blockFacing(block); ship.shields[facing] *= (1 - C.emitterDrain); break;
      case "weapon": block.cycleLeft = Math.max(block.cycleLeft || 0, block.def.weapon.cycle * C.weaponJam); break;
      case "cloak": if (isCloaked(ship)) setCloak(ship, false); break;
    }
    BS.Events.emit("criticalHit", { ship: ship, block: block, kind: kind, facing: facing, attacker: attacker, pos: Gr.blockWorld(ship, block) });
  }

  // ---- damage -----------------------------------------------------------
  function applyDamage(ship, amount, fromX, fromY, aimType, attacker, kind, pierceBonus) {
    if (ship.flags.destroyed) return null;
    var B = BS.Data.balance;
    // the shot lands on `first`; it is shielded only while an emitter covers that block, and then draws from that emitter's facing
    var first = Gr.resolveEntry(ship, fromX, fromY, aimType);
    var exposed = !!first && !first.covered;
    var facing = first && first.coverBy ? Gr.blockFacing(first.coverBy) : facingToward(ship, fromX, fromY);
    var shield = exposed || !shieldsUp(ship) ? 0 : ship.shields[facing];
    var resist = ship.activeEffects.shieldResist || 0;
    // decloak strike: an attacker fresh out of cloak hits harder and part of each hit skips the shield (ew.strike)
    var strike = attacker && attacker.cloak && attacker.cloak.strike > 0 ? BS.Data.ew.strike : null;
    if (strike) amount *= strike.damageMult;
    var bypass = strike && !exposed ? amount * strike.shieldBypass : 0;
    var shieldAmount = (amount - bypass) * (1 - resist);
    var absorbed = Math.min(shield, shieldAmount);
    ship.shields[facing] = shield - absorbed;
    var leftover = shieldAmount - absorbed;
    var hullDamage = leftover / Math.max(0.01, 1 - resist) + absorbed * B.shieldBleedThrough + bypass;
    if (absorbed <= 0) hullDamage = amount;
    var shieldsDown = ship.shields[facing] <= 0 && shield > 0;
    var ang = U.angleTo(ship.pos.x, ship.pos.y, fromX, fromY);
    var impact = { x: ship.pos.x + Math.cos(ang) * ship.visual.length * 0.5, y: ship.pos.y + Math.sin(ang) * ship.visual.length * 0.5 };
    var emitter = first && first.coverBy ? first.coverBy : null;
    if (emitter) {   // the shield ripple sits on the covering emitter's bubble, on the attacker's side
      var ew = Gr.blockWorld(ship, emitter), ea = U.angleTo(ew.x, ew.y, fromX, fromY), R = BS.Data.grid.shieldRadius * ship.grid.cellPx;
      impact = { x: ew.x + Math.cos(ea) * R, y: ew.y + Math.sin(ea) * R };
    }
    var result = { ship: ship, facing: facing, absorbed: absorbed, hullDamage: hullDamage, shieldsDown: shieldsDown, impact: impact, angle: ang, kind: kind, amount: amount, attacker: attacker, exposed: exposed, emitter: emitter, strike: !!strike, hits: [], destroyed: [], cutOff: [], explosions: [] };
    if (absorbed > 0) BS.Events.emit("shieldHit", result);
    if (!exposed) ship.shieldDelay[facing] = BS.Data.grid.shieldRechargeDelay;   // a facing under fire does not recharge
    if (hullDamage > 0) {
      var hr = Gr.hit(ship, hullDamage, fromX, fromY, aimType, kind, first, pierceBonus);
      result.hits = hr.hits; result.destroyed = hr.destroyed; result.cutOff = hr.cutOff; result.explosions = hr.explosions; result.crits = hr.crits;
      hr.crits.forEach(function (cr) { applyCrit(ship, cr.block, cr.kind, attacker); });
      var dealt = hr.hits.reduce(function (a, h) { return a + h.dmg; }, 0);
      ship.battle.damageTaken += dealt;
      if (attacker) attacker.battle.damageDealt += dealt;
      if (hr.hits.length) { var hb = hr.hits[0].block; result.impact = Gr.blockWorld(ship, hb); result.block = hb; }
      BS.Events.emit("hullHit", result);
      if (hr.destroyed.length || hr.cutOff.length) {
        ship.battle.blocksLost += hr.destroyed.length + hr.cutOff.length;
        if (attacker) attacker.battle.blocksKilled += hr.destroyed.length + hr.cutOff.length;
        refreshDerived(ship, false);
        hr.destroyed.forEach(function (b) { BS.Events.emit("blockDestroyed", { ship: ship, block: b, pos: Gr.blockWorld(ship, b), attacker: attacker }); });
        hr.explosions.forEach(function (b) { BS.Events.emit("blockExploded", { ship: ship, block: b, pos: Gr.blockWorld(ship, b), radius: b.def.explosion.radius, attacker: attacker }); });
        if (hr.cutOff.length) BS.Events.emit("sectionLost", { ship: ship, blocks: hr.cutOff, positions: hr.cutOff.map(function (b) { return Gr.blockWorld(ship, b); }) });
        var st = ship.stats;
        if (!st.bridgeAlive || st.hullAlive / st.hullTotal < BS.Data.grid.deadFraction) {
          ship.flags.destroyed = true; ship.destroyedTimer = 0;
          BS.Events.emit("shipDestroyed", { ship: ship, killer: attacker });
        } else checkDisabled(ship, attacker);
      } else ship.hull = ship.stats.hullAlive = ship.grid.blocks.reduce(function (a, b) { return a + (b.alive && !b.structural ? b.hp : 0); }, 0);
    }
    return result;
  }

  // ---- movement from commands ------------------------------------------
  function orbitHeading(ship, target, range, dir) {
    var d = distanceTo(ship, target), toT = U.angleTo(ship.pos.x, ship.pos.y, target.pos.x, target.pos.y);
    if (d > range * 1.25) return { heading: toT + dir * 0.3, speed: 1 };
    if (d < range * 0.7) return { heading: toT + dir * (Math.PI / 2 + 0.7), speed: 1 };
    var nudge = (d - range) / range;
    return { heading: toT + dir * (Math.PI / 2 - nudge * 1.0), speed: 1 };
  }
  // Where the helm holds a target relative to the bow while keeping range (helm.bearingStep / keepFireFraction /
  // kiteMinBearing). `hold` is the bearing on the orbit side where the most fire bears (ties go to the one nearest
  // abeam, so a ship with guns all round still circles); `kite` the bearing at or beyond kiteMinBearing with the most
  // fire (ties to the widest), tail-on when nothing bears aft. Only weapons in active groups count (a Siege bridge with
  // phasers cold points its tubes), all weapons when none is active. Degrees, positive to starboard; a ship with nothing
  // to bear holds abeam and kites tail-on as before.
  function firingBearings(ship, dir) {
    var H = BS.Data.helm, types = null, active = {}, any = false;
    BS.Modules.weapons(ship).forEach(function (m) { if (m.active) { active[m.def.block] = true; any = true; } });
    if (any) types = active;
    var side = -dir, prof = Gr.bearingProfile(ship, types, H.bearingStep).filter(function (p) { return p.deg * side >= 0; });
    var hold = null, kite = null;
    prof.forEach(function (p) {
      if (!hold || p.w > hold.w || (p.w === hold.w && Math.abs(Math.abs(p.deg) - 90) < Math.abs(Math.abs(hold.deg) - 90))) hold = p;
      if (Math.abs(p.deg) >= H.kiteMinBearing && (!kite || p.w > kite.w || (p.w === kite.w && Math.abs(p.deg) > Math.abs(kite.deg)))) kite = p;
    });
    if (!hold || hold.w <= 0) return { hold: side * 90, kite: 180 };
    return { hold: hold.deg, kite: kite && kite.w >= hold.w * H.keepFireFraction ? kite.deg : 180 };
  }
  // Keep at range: close when beyond the band; in the band hold the target on the firing bearing at a speed that falls
  // from holdSpeed at the top of the band to a stop at the bottom; below the band hold station (stop, guns on them)
  // until the target comes inside keepRunBelow × range, then open the range on the kite bearing at full speed. So a
  // bow-tube ship sits and fires instead of charging and turning away, and only runs when really crowded.
  function keepHeading(ship, target, range, dir) {
    var H = BS.Data.helm, d = distanceTo(ship, target), toT = U.angleTo(ship.pos.x, ship.pos.y, target.pos.x, target.pos.y);
    if (d > range * H.keepBand[1]) return { heading: toT, speed: 1 };
    var fb = firingBearings(ship, dir);
    if (d < range * H.keepRunBelow) return { heading: toT - fb.kite * U.DEG, speed: 1 };
    var k = (d - range * H.keepBand[0]) / (range * (H.keepBand[1] - H.keepBand[0]));
    return { heading: toT - fb.hold * U.DEG, speed: H.holdSpeed * U.clamp(k, 0, 1) };
  }
  function updateCommand(ship, dt) {
    var c = ship.cmd, out, t = c.target;
    if (t && t.flags.destroyed) { c.type = "idle"; t = null; }
    if (t && c.type !== "flyTo") t = contact(ship, t);   // lost them (cloaked beyond our sensors): the helm flies against the last contact
    switch (c.type) {
      case "approach": out = { heading: U.angleTo(ship.pos.x, ship.pos.y, t.pos.x, t.pos.y), speed: distanceTo(ship, t) < ship.visual.length ? 0.2 : 1 }; break;
      case "orbit": out = orbitHeading(ship, t, c.range, c.orbitDir); break;
      case "keep": out = keepHeading(ship, t, c.range, c.orbitDir); break;
      case "shadow": {   // hold a station point at c.range from the target on bearing c.bearing from its heading (helm.shadow)
        var H = BS.Data.helm.shadow, sa = t.heading + c.bearing, sx = t.pos.x + Math.cos(sa) * c.range, sy = t.pos.y + Math.sin(sa) * c.range;
        var ds = U.dist(ship.pos.x, ship.pos.y, sx, sy), station = px(H.stationKm);
        if (ds > station) out = { heading: U.angleTo(ship.pos.x, ship.pos.y, sx + t.vel.x * 0.8, sy + t.vel.y * 0.8), speed: 1 };
        else out = { heading: ds < station * 0.25 ? t.heading : U.angleTo(ship.pos.x, ship.pos.y, sx, sy), speed: U.clamp((t.speed + ds * 1.5) / Math.max(1, maxSpeed(ship)), 0.1, 1) };
        break;
      }
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
    var diff = U.normAngle(ship.desiredHeading - ship.heading), maxTurn = turnRate(ship) * dt;
    if (ship.tumble > 0) {   // an engine critical: spinning, no helm, bleeding speed (grid.crits)
      ship.tumble -= dt; ship.heading += ship.tumbleDir * BS.Data.grid.crits.tumbleSpin * U.DEG * dt; ship.desiredSpeed = Math.min(ship.desiredSpeed, ship.speed * 0.6);
    }
    else if (Math.abs(diff) <= maxTurn) ship.heading = ship.desiredHeading; else ship.heading += Math.sign(diff) * maxTurn;
    ship.heading = U.normAngle(ship.heading);
    var accel = maxSpeed(ship) * 0.8;
    if (ship.speed < ship.desiredSpeed) ship.speed = Math.min(ship.desiredSpeed, ship.speed + accel * dt);
    else ship.speed = Math.max(ship.desiredSpeed, ship.speed - accel * dt);
    ship.vel.x = Math.cos(ship.heading) * ship.speed; ship.vel.y = Math.sin(ship.heading) * ship.speed;
    ship.pos.x += ship.vel.x * dt; ship.pos.y += ship.vel.y * dt;
  }

  // ---- per-step systems -------------------------------------------------
  function updateSystems(ship, dt) {
    var B = BS.Data.balance, g = BS.Data.grid;
    if (ship.grid.dirty) refreshDerived(ship, false);
    var f = ship.capMax > 0 ? ship.capacitor / ship.capMax : 0;
    var rate = (ship.capMax / g.capRechargeTime) * B.capCurve * Math.max(0, Math.sqrt(f) - f) * capRechargeMult(ship);
    if (f < 0.02) rate = (ship.capMax / g.capRechargeTime) * 0.4 * capRechargeMult(ship);
    ship.capacitor = Math.min(ship.capMax, ship.capacitor + rate * dt);
    FACINGS.forEach(function (fc) {   // the pools recharge whether or not they are projected (cloaked: at the condition-green rate)
      if (ship.shieldDelay[fc] > 0) { ship.shieldDelay[fc] -= dt; return; }   // recharge delay after a hit (grid.shieldRechargeDelay)
      var regen = ship.shieldRegen[fc] * shieldsMult(ship) * (ship.stats.powerFactor || 1) * (ship.stats.crew ? ship.stats.crew.manning : 1) * (shieldsUp(ship) ? 1 : BS.Data.balance.noAlertShieldRegenMult) * dt;
      if (ship.shields[fc] < ship.shieldMax[fc]) ship.shields[fc] = Math.min(ship.shieldMax[fc], ship.shields[fc] + regen);
    });
    if (ship.jammed > 0) ship.jammed -= dt;
    if (ship.neuted > 0) ship.neuted -= dt;
    if (ship.breach > 0) { ship.breach -= dt; if (ship.breach <= 0) coreBlast(ship); }
    if (ship.partialJam > 0) { ship.partialJam -= dt; if (ship.partialJam <= 0) ship.partialJamBy = null; }
    updateCloak(ship, dt);
    if (ship.reinforceCooldown > 0) ship.reinforceCooldown -= dt;
    ship.heat = Math.max(0, ship.heat - ship.stats.heatDissipation * dt);
    if (ship.overload > 0) ship.overload -= dt;
    var r = ship.reinforce;
    if (r) {
      var step = Math.min(r.perSecond * dt, r.remaining, ship.shields[r.from]);
      ship.shields[r.from] -= step; ship.shields[r.to] = Math.min(ship.shieldMax[r.to], ship.shields[r.to] + step);
      r.remaining -= step;
      if (r.remaining <= 0.01 || step <= 0) ship.reinforce = null;
    }
    Gr.repair(ship.grid, ship.stats.repair * ship.mods.repairMult, ship.repairPriority, dt);
    ship.hull = ship.grid.blocks.reduce(function (a, b) { return a + (b.alive && !b.structural ? b.hp : 0); }, 0);
    ship.stats.hullAlive = ship.hull;
  }

  function update(ship, dt) {
    if (ship.flags.destroyed) { ship.destroyedTimer += dt; ship.prevPos.x = ship.pos.x; ship.prevPos.y = ship.pos.y; ship.prevHeading = ship.heading; ship.vel.x = ship.vel.y = 0; return; }
    BS.Modules.update(ship, dt);
    updateLock(ship, dt);
    updateCommand(ship, dt);
    updateMovement(ship, dt);
    updateSystems(ship, dt);
  }

  return {
    FACINGS: FACINGS, km: km, px: px, create: create, update: update, applyDamage: applyDamage, refreshDerived: refreshDerived,
    facingToward: facingToward, facingOffset: facingOffset, strongestFacing: strongestFacing, weakestFacing: weakestFacing, shieldFrac: shieldFrac,
    distanceTo: distanceTo, distanceKm: distanceKm, bearingTo: bearingTo, angularVelocity: angularVelocity, speedKmS: speedKmS,
    setCommand: setCommand, setAlert: setAlert, startReinforce: startReinforce, startLock: startLock, clearLock: clearLock, lockTime: lockTime,
    trackingMult: trackingMult, maxSpeed: maxSpeed, firingBearings: firingBearings, shieldsUp: shieldsUp, effectiveAim: effectiveAim, setAimBlock: setAimBlock, cloakFieldComplete: cloakFieldComplete, debrisHit: debrisHit, capRechargeMult: capRechargeMult, blockTypes: blockTypes,
    isCloaked: isCloaked, visibility: visibility, detectRangeKm: detectRangeKm, setCloak: setCloak, contact: contact, contactKm: contactKm,
  };
})();
