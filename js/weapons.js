// js/weapons.js — phasers (hitscan beams), torpedoes (projectiles), hit resolution.
window.BS = window.BS || {};

BS.Weapons = (function () {
  var U = BS.Util, S = BS.Ships;
  var beams = [];      // { source, mount, target, hit, missOffset, life, maxLife, def }
  var torpedoes = [];  // { source, target, x, y, prevX, prevY, vx, vy, heading, hit, aimOffset, life, def, dead }

  function reset() { beams.length = 0; torpedoes.length = 0; }

  function accuracyFor(ship, target, def) {
    var B = BS.Data.balance;
    var acc = def.accuracy + ship.mods.accuracyBonus;
    if (ship.aiProfile) acc *= ship.aiProfile.accuracyMult;
    if (ship.flags.evasive) acc *= B.evasiveOwnAccuracy;
    if (target.flags.evasive) acc *= B.evasiveIncomingAccuracy;
    return U.clamp(acc, 0.05, 0.99);
  }

  function canFirePhasers(ship, target) {
    if (!ship.flags.armed) return "notArmed";
    if (!target || target.flags.destroyed) return "noTarget";
    if (S.distanceTo(ship, target) > ship.phaserDef.range) return "outOfRange";
    if (!S.inArc(ship, target, ship.phaserDef.arc)) return "outOfRange";
    if (ship.phaserCooldown > 0) return "charging";
    return "ok";
  }
  function canFireTorpedoes(ship, target) {
    if (!ship.flags.armed) return "notArmed";
    if (!target || target.flags.destroyed) return "noTarget";
    if (ship.torpedoReload > 0 || ship.pendingSpread > 0) return "loading";
    if (S.distanceTo(ship, target) > ship.torpedoDef.range) return "noArc";
    if (!S.inArc(ship, target, ship.torpedoDef.arc)) return "noArc";
    return "ok";
  }

  function firePhasers(ship, target) {
    var def = ship.phaserDef;
    var mounts = ship.cls.phaserMounts;
    var d = S.distanceTo(ship, target);
    var falloff = d > def.optimalRange ? 1 - def.falloff * (d - def.optimalRange) / (def.range - def.optimalRange) : 1;
    var dmgEach = def.damage * ship.mods.damageMult * S.weaponsMult(ship) * falloff / mounts.length;
    var acc = accuracyFor(ship, target, def) * (d > def.optimalRange ? 0.9 : 1);
    var anyHit = false;
    for (var i = 0; i < mounts.length; i++) {
      var hit = Math.random() < acc;
      var beam = { source: ship, mount: mounts[i], target: target, hit: hit, missOffset: U.rand(-1, 1) * target.visual.length * 0.9, life: def.beamLife, maxLife: def.beamLife, def: def, damageApplied: false, damage: dmgEach };
      beams.push(beam);
      if (hit) anyHit = true;
    }
    ship.phaserCooldown = def.cooldown * ship.mods.cooldownMult;
    ship.stats.phasersFired++;
    BS.Events.emit("phaserFired", { ship: ship, target: target, hit: anyHit });
  }

  function launchTorpedo(ship, target) {
    var def = ship.torpedoDef;
    var tube = ship.cls.torpedoTubes[ship.stats.torpedoesFired % ship.cls.torpedoTubes.length];
    var p = U.localToWorld(ship, tube.x, tube.y);
    var hit = Math.random() < accuracyFor(ship, target, def);
    var side = Math.random() < 0.5 ? 1 : -1;
    var t = { source: ship, target: target, x: p.x, y: p.y, prevX: p.x, prevY: p.y, heading: ship.heading, speed: def.speed, hit: hit, aimOffset: hit ? 0 : side * target.visual.length * 1.1, life: def.range / def.speed + 1.5, def: def, dead: false, age: 0 };
    torpedoes.push(t);
    ship.stats.torpedoesFired++;
    BS.Events.emit("torpedoLaunched", { ship: ship, target: target, torpedo: t });
  }

  // Fire a spread: first torpedo now, the rest staggered.
  function fireTorpedoSpread(ship, target) {
    var def = ship.torpedoDef;
    launchTorpedo(ship, target);
    ship.pendingSpread = def.spread - 1;
    ship.spreadTimer = def.spreadDelay;
    ship.torpedoReload = def.reload * ship.mods.reloadMult;
  }

  // Called each sim step for each ship: handles fire-at-will and fire-once orders.
  function updateShipFiring(ship, target, dt) {
    if (ship.flags.destroyed || !target || target.flags.destroyed) return;
    if (ship.pendingSpread > 0) {
      ship.spreadTimer -= dt;
      if (ship.spreadTimer <= 0) { launchTorpedo(ship, target); ship.pendingSpread--; ship.spreadTimer = ship.torpedoDef.spreadDelay; }
    }
    var wantPhasers = ship.flags.fireAtWill || ship.fireOnce.phasers;
    var wantTorps = ship.flags.fireAtWill || ship.fireOnce.torpedoes;
    if (wantPhasers && canFirePhasers(ship, target) === "ok") { firePhasers(ship, target); ship.fireOnce.phasers = false; }
    if (wantTorps && canFireTorpedoes(ship, target) === "ok") { fireTorpedoSpread(ship, target); ship.fireOnce.torpedoes = false; }
  }

  function beamEndpoints(beam, alpha) {
    var s = beam.source, t = beam.target;
    var sh = U.lerpAngle(s.prevHeading, s.heading, alpha);
    var sp = { x: U.lerp(s.prevPos.x, s.pos.x, alpha), y: U.lerp(s.prevPos.y, s.pos.y, alpha) };
    var c = Math.cos(sh), si = Math.sin(sh), sc = s.visual.scale || 1;
    var x1 = sp.x + (beam.mount.x * c - beam.mount.y * si) * sc, y1 = sp.y + (beam.mount.x * si + beam.mount.y * c) * sc;
    var tx = U.lerp(t.prevPos.x, t.pos.x, alpha), ty = U.lerp(t.prevPos.y, t.pos.y, alpha);
    var x2, y2;
    if (beam.hit) { x2 = tx; y2 = ty; }
    else {
      var ang = Math.atan2(ty - y1, tx - x1) + Math.PI / 2;
      x2 = tx + Math.cos(ang) * beam.missOffset + (tx - x1) * 0.25; y2 = ty + Math.sin(ang) * beam.missOffset + (ty - y1) * 0.25;
    }
    return { x1: x1, y1: y1, x2: x2, y2: y2 };
  }

  function update(dt) {
    var i, b, t;
    for (i = beams.length - 1; i >= 0; i--) {
      b = beams[i];
      if (!b.damageApplied) {
        b.damageApplied = true;
        if (b.hit) {
          var e = beamEndpoints(b, 1);
          S.applyDamage(b.target, b.damage, e.x1, e.y1, b.source.targetSubsystem, b.source, "phaser");
        }
      }
      b.life -= dt;
      if (b.life <= 0) beams.splice(i, 1);
    }
    for (i = torpedoes.length - 1; i >= 0; i--) {
      t = torpedoes[i];
      t.prevX = t.x; t.prevY = t.y;
      t.age += dt; t.life -= dt;
      var tg = t.target;
      if (!t.dead && tg && !tg.flags.destroyed) {
        // aim point: target, or a point beside it for a miss
        var perp = Math.atan2(tg.pos.y - t.y, tg.pos.x - t.x) + Math.PI / 2;
        var ax = tg.pos.x + Math.cos(perp) * t.aimOffset, ay = tg.pos.y + Math.sin(perp) * t.aimOffset;
        var want = Math.atan2(ay - t.y, ax - t.x);
        var diff = U.normAngle(want - t.heading);
        var maxTurn = t.def.turnRate * U.DEG * dt * (t.age < 0.4 ? 0.3 : 1);
        t.heading += U.clamp(diff, -maxTurn, maxTurn);
        var hitR = tg.visual.length * BS.Data.balance.hitRadiusFactor;
        if (t.hit && U.dist(t.x, t.y, tg.pos.x, tg.pos.y) < hitR) {
          var dmg = t.def.damage * t.source.mods.damageMult * (0.7 + 0.3 * S.weaponsMult(t.source));
          var res = S.applyDamage(tg, dmg, t.x, t.y, t.source.targetSubsystem, t.source, "torpedo");
          t.source.stats.torpedoHits++;
          t.dead = true;
          BS.Events.emit("torpedoHit", { torpedo: t, ship: tg, result: res });
        }
      }
      if (!t.dead) {
        t.x += Math.cos(t.heading) * t.speed * dt;
        t.y += Math.sin(t.heading) * t.speed * dt;
        if (t.life <= 0) { t.dead = true; BS.Events.emit("torpedoExpired", { torpedo: t }); }
      }
      if (t.dead) torpedoes.splice(i, 1);
    }
  }

  return {
    beams: beams, torpedoes: torpedoes, reset: reset, update: update,
    updateShipFiring: updateShipFiring, canFirePhasers: canFirePhasers, canFireTorpedoes: canFireTorpedoes,
    beamEndpoints: beamEndpoints, firePhasers: firePhasers, fireTorpedoSpread: fireTorpedoSpread,
  };
})();
