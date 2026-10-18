// js/weapons.js — turret blocks (hitscan beams with tracking and falloff) and
// launcher blocks (homing torpedoes with signature/velocity damage).
window.BS = window.BS || {};

BS.Weapons = (function () {
  var U = BS.Util, S = BS.Ships, Gr = BS.Grid;
  var beams = [];      // { source, block, target, hit, missOffset, life, maxLife, w, damage, damageApplied }
  var torpedoes = [];  // { source, target, x, y, prevX, prevY, heading, speed, life, w, dead, age, damage }

  function reset() { beams.length = 0; torpedoes.length = 0; }

  function baseAccuracy(ship, target, w) {
    var acc = (w.accuracy !== undefined ? w.accuracy : 1) + ship.mods.accuracyBonus;
    if (ship.aimType) acc *= BS.Data.subsystemEffects.targetAccuracyMult;
    if (ship.aiProfile) acc *= ship.aiProfile.accuracyMult;
    return U.clamp(acc, 0.05, 1);
  }
  // EVE turret formula: 0.5 ^ ((angular / tracking)^2 + (max(0, d − optimal) / falloff)^2)
  function turretHitChance(ship, target, w) {
    var dKm = S.distanceKm(ship, target), ang = S.angularVelocity(ship, target);
    var tracking = w.tracking * S.trackingMult(ship);
    var rangeTerm = Math.max(0, dKm - w.optimalKm) / w.falloffKm;
    return Math.pow(0.5, Math.pow(ang / tracking, 2) + rangeTerm * rangeTerm) * baseAccuracy(ship, target, w);
  }
  function torpedoDamageMult(w, target) {
    var sigFactor = target.signature / w.explosionRadius, speedKm = Math.max(0.01, S.speedKmS(target));
    return Math.min(1, sigFactor, Math.pow(sigFactor * (w.explosionVelocity / speedKm), 0.6));
  }

  function fireTurretBlock(ship, block, target) {
    var w = block.def.weapon, chance = turretHitChance(ship, target, w), hit = Math.random() < chance;
    var dmg = w.damage * ship.mods.damageMult * ship.mods.turretDamageMult;
    beams.push({ source: ship, block: block, target: target, hit: hit, missOffset: U.rand(-1, 1) * target.visual.length * 0.9, life: w.beamLife, maxLife: w.beamLife, w: w, def: w, damage: dmg, damageApplied: false });
    ship.battle.phasersFired++; if (hit) ship.battle.phaserHits++;
    BS.Events.emit("phaserFired", { ship: ship, target: target, hit: hit, chance: chance, color: w.color, pos: Gr.blockWorld(ship, block) });
  }
  function fireLauncherBlock(ship, block, target) {
    var w = block.def.weapon, p = Gr.blockWorld(ship, block);
    var dmg = w.damage * ship.mods.damageMult * ship.mods.launcherDamageMult;
    var t = { source: ship, target: target, x: p.x, y: p.y, prevX: p.x, prevY: p.y, heading: ship.heading, speed: S.px(w.speedKmS), life: w.rangeKm / w.speedKmS + 2, w: w, def: w, dead: false, age: 0, damage: dmg };
    torpedoes.push(t);
    ship.battle.torpedoesFired++;
    BS.Events.emit("torpedoLaunched", { ship: ship, target: target, torpedo: t });
  }

  function beamEndpoints(beam, alpha) {
    var s = beam.source, t = beam.target;
    var sh = U.lerpAngle(s.prevHeading, s.heading, alpha);
    var sx = U.lerp(s.prevPos.x, s.pos.x, alpha), sy = U.lerp(s.prevPos.y, s.pos.y, alpha);
    var c = Math.cos(sh), si = Math.sin(sh);
    var x1 = sx + beam.block.lx * c - beam.block.ly * si, y1 = sy + beam.block.lx * si + beam.block.ly * c;
    var tx = U.lerp(t.prevPos.x, t.pos.x, alpha), ty = U.lerp(t.prevPos.y, t.pos.y, alpha);
    var x2, y2;
    if (beam.hit) {
      if (beam.hitPos) { x2 = beam.hitPos.x; y2 = beam.hitPos.y; } else { x2 = tx; y2 = ty; }
    } else {
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
          var res = S.applyDamage(b.target, b.damage, e.x1, e.y1, b.source.aimType, b.source, "phaser");
          if (res && res.impact) b.hitPos = { x: res.impact.x, y: res.impact.y };
        }
      }
      b.life -= dt;
      if (b.life <= 0) beams.splice(i, 1);
    }
    for (i = torpedoes.length - 1; i >= 0; i--) {
      t = torpedoes[i];
      t.prevX = t.x; t.prevY = t.y; t.age += dt; t.life -= dt;
      var tg = t.target;
      if (tg && (BS.Ships.isCloaked(tg) || t.source.jammed > 0)) tg = null;   // blind: the target cloaked or the launcher is jammed
      if (!t.dead && tg && !tg.flags.destroyed) {
        var want = Math.atan2(tg.pos.y - t.y, tg.pos.x - t.x), diff = U.normAngle(want - t.heading);
        var maxTurn = t.w.turnRate * U.DEG * dt * (t.age < 0.4 ? 0.3 : 1);
        t.heading += U.clamp(diff, -maxTurn, maxTurn);
        var hitR = tg.visual.length * BS.Data.balance.hitRadiusFactor;
        if (U.dist(t.x, t.y, tg.pos.x, tg.pos.y) < hitR) {
          var mult = torpedoDamageMult(t.w, tg);
          var r2 = S.applyDamage(tg, t.damage * mult, t.x, t.y, t.source.aimType, t.source, "torpedo");
          t.source.battle.torpedoHits++; t.dead = true;
          BS.Events.emit("torpedoHit", { torpedo: t, ship: tg, result: r2, mult: mult });
        }
      }
      if (!t.dead) {
        t.x += Math.cos(t.heading) * t.speed * dt; t.y += Math.sin(t.heading) * t.speed * dt;
        if (t.life <= 0) { t.dead = true; BS.Events.emit("torpedoExpired", { torpedo: t }); }
      }
      if (t.dead) torpedoes.splice(i, 1);
    }
  }

  return { beams: beams, torpedoes: torpedoes, reset: reset, update: update, fireTurretBlock: fireTurretBlock, fireLauncherBlock: fireLauncherBlock, beamEndpoints: beamEndpoints, turretHitChance: turretHitChance, torpedoDamageMult: torpedoDamageMult };
})();
