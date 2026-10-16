// js/weapons.js — turrets (hitscan beams with tracking and falloff) and
// launchers (homing torpedoes with signature/velocity damage), hit resolution.
window.BS = window.BS || {};

BS.Weapons = (function () {
  var U = BS.Util, S = BS.Ships;
  var beams = [];      // { source, mount, target, hit, missOffset, life, maxLife, def, damage, damageApplied }
  var torpedoes = [];  // { source, target, x, y, prevX, prevY, heading, speed, life, def, dead, age, damage }

  function reset() { beams.length = 0; torpedoes.length = 0; }

  function baseAccuracy(ship, target, def) {
    var acc = (def.accuracy !== undefined ? def.accuracy : 1) + ship.mods.accuracyBonus;
    acc *= S.sensorsMult(ship);
    if (ship.targetSubsystem) acc *= BS.Data.subsystemEffects.targetAccuracyMult;
    if (ship.aiProfile) acc *= ship.aiProfile.accuracyMult;
    return U.clamp(acc, 0.05, 1);
  }

  // EVE turret formula: 0.5 ^ ((angular / tracking)^2 + (max(0, d − optimal) / falloff)^2)
  function turretHitChance(ship, target, def) {
    var dKm = S.distanceKm(ship, target);
    var ang = S.angularVelocity(ship, target);
    var tracking = def.tracking * (ship.activeEffects.trackingMult || 1) * (0.7 + 0.3 * S.sensorsMult(ship));
    var rangeTerm = Math.max(0, dKm - def.optimalKm) / def.falloffKm;
    var chance = Math.pow(0.5, Math.pow(ang / tracking, 2) + rangeTerm * rangeTerm);
    return chance * baseAccuracy(ship, target, def);
  }

  function fireTurret(ship, m, target) {
    var def = m.def;
    var mounts = ship.cls.phaserMounts;
    var mount = mounts[m.mountIndex % mounts.length];
    var chance = turretHitChance(ship, target, def);
    var hit = Math.random() < chance;
    var dmg = def.damage * ship.mods.damageMult * ship.mods.turretDamageMult * ship.fitEffects.turretDamageMult * S.subMult(ship, def.subsystem || "weapons");
    beams.push({ source: ship, mount: mount, target: target, hit: hit, missOffset: U.rand(-1, 1) * target.visual.length * 0.9, life: def.beamLife, maxLife: def.beamLife, def: def, damage: dmg, damageApplied: false });
    ship.stats.phasersFired++;
    if (hit) ship.stats.phaserHits++;
    BS.Events.emit("phaserFired", { ship: ship, target: target, hit: hit, chance: chance, color: def.color, mount: mount });
  }

  // EVE missile formula, simplified: min(1, sig/expR, ((sig/expR) × (expVel/targetSpeed))^0.6)
  function torpedoDamageMult(def, target) {
    var sigFactor = target.signature / def.explosionRadius;
    var speedKm = Math.max(0.01, S.speedKmS(target));
    return Math.min(1, sigFactor, Math.pow(sigFactor * (def.explosionVelocity / speedKm), 0.6));
  }

  function fireLauncher(ship, m, target) {
    var def = m.def;
    var tubes = ship.cls.torpedoTubes;
    var tube = tubes[ship.stats.torpedoesFired % tubes.length];
    var p = U.localToWorld(ship, tube.x, tube.y);
    var dmg = def.damage * ship.mods.damageMult * ship.mods.launcherDamageMult * ship.fitEffects.launcherDamageMult;
    var t = { source: ship, target: target, x: p.x, y: p.y, prevX: p.x, prevY: p.y, heading: ship.heading, speed: S.px(def.speedKmS), life: def.rangeKm / def.speedKmS + 2, def: def, dead: false, age: 0, damage: dmg };
    torpedoes.push(t);
    ship.stats.torpedoesFired++;
    BS.Events.emit("torpedoLaunched", { ship: ship, target: target, torpedo: t });
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
        var want = Math.atan2(tg.pos.y - t.y, tg.pos.x - t.x);
        var diff = U.normAngle(want - t.heading);
        var maxTurn = t.def.turnRate * U.DEG * dt * (t.age < 0.4 ? 0.3 : 1);
        t.heading += U.clamp(diff, -maxTurn, maxTurn);
        var hitR = tg.visual.length * BS.Data.balance.hitRadiusFactor;
        if (U.dist(t.x, t.y, tg.pos.x, tg.pos.y) < hitR) {
          var mult = torpedoDamageMult(t.def, tg);
          var res = S.applyDamage(tg, t.damage * mult, t.x, t.y, t.source.targetSubsystem, t.source, "torpedo");
          t.source.stats.torpedoHits++;
          t.dead = true;
          BS.Events.emit("torpedoHit", { torpedo: t, ship: tg, result: res, mult: mult });
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

  return { beams: beams, torpedoes: torpedoes, reset: reset, update: update, fireTurret: fireTurret, fireLauncher: fireLauncher, beamEndpoints: beamEndpoints, turretHitChance: turretHitChance, torpedoDamageMult: torpedoDamageMult };
})();
