// js/weapons.js — turret blocks (hitscan beams with tracking and falloff) and
// launcher blocks (homing torpedoes with signature/velocity damage).
window.BS = window.BS || {};

BS.Weapons = (function () {
  var U = BS.Util, S = BS.Ships, Gr = BS.Grid;
  var beams = [];      // { source, block, target, hit, missOffset, life, maxLife, w, damage, damageApplied }
  var torpedoes = [];  // { source, target, x, y, prevX, prevY, heading, speed, life, w, dead, age, damage, lured }
  var decoys = [];     // { source, x, y, prevX, prevY, heading, speed, life, maxLife } (ew.decoy): flares that torpedoes hunting the source turn onto

  function reset() { beams.length = 0; torpedoes.length = 0; decoys.length = 0; }

  function baseAccuracy(ship, target, w) {
    var acc = (w.accuracy !== undefined ? w.accuracy : 1) + ship.mods.accuracyBonus;
    if (S.effectiveAim(ship, target)) acc *= BS.Data.subsystemEffects.targetAccuracyMult;
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

  // Decoys (module `decoy`): one flare per alive launcher block, dropped astern with a little spread. Torpedoes hunting
  // the launcher inside ew.decoy.lureKm of a flare turn onto it (nearest) and die on it; a burnt-out flare hands them back.
  function launchDecoy(ship, n) {
    var E = BS.Data.ew.decoy, out = [];
    for (var i = 0; i < Math.max(1, n); i++) {
      var h = ship.heading + Math.PI + U.rand(-1, 1) * E.spreadDeg * U.DEG;
      var d = { source: ship, x: ship.pos.x, y: ship.pos.y, prevX: ship.pos.x, prevY: ship.pos.y, heading: h, speed: S.px(E.speedKmS), life: E.life, maxLife: E.life };
      decoys.push(d); out.push(d);
    }
    BS.Events.emit("decoyLaunched", { ship: ship, decoys: out, incoming: incoming(ship, 99) });
    return out;
  }
  // Torpedoes still hunting `ship` (not lured away) within rangeKm of it.
  function incoming(ship, rangeKm) {
    var n = 0, R = S.px(rangeKm);
    for (var i = 0; i < torpedoes.length; i++) { var t = torpedoes[i]; if (!t.dead && t.target === ship && !t.lured && U.dist(t.x, t.y, ship.pos.x, ship.pos.y) <= R) n++; }
    return n;
  }
  function nearestDecoy(t, ship, maxPx) {
    var best = null, bd = maxPx;
    for (var i = 0; i < decoys.length; i++) { var d = decoys[i]; if (d.source !== ship || d.life <= 0) continue; var dd = U.dist(t.x, t.y, d.x, d.y); if (dd <= bd) { bd = dd; best = d; } }
    return best;
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
          var res = S.applyDamage(b.target, b.damage, e.x1, e.y1, S.effectiveAim(b.source, b.target), b.source, "phaser", b.w.pierceBonus || 0);
          if (res && res.impact) b.hitPos = { x: res.impact.x, y: res.impact.y };
        }
      }
      b.life -= dt;
      if (b.life <= 0) beams.splice(i, 1);
    }
    var E = BS.Data.ew.decoy, lureR = S.px(E.lureKm), decoyHitR = S.px(E.hitKm);
    for (i = decoys.length - 1; i >= 0; i--) {
      var dc = decoys[i];
      dc.prevX = dc.x; dc.prevY = dc.y; dc.life -= dt;
      dc.x += Math.cos(dc.heading) * dc.speed * dt; dc.y += Math.sin(dc.heading) * dc.speed * dt;
      if (dc.life <= 0) { decoys.splice(i, 1); BS.Events.emit("decoyExpired", { decoy: dc }); }
    }
    for (i = torpedoes.length - 1; i >= 0; i--) {
      t = torpedoes[i];
      t.prevX = t.x; t.prevY = t.y; t.age += dt; t.life -= dt;
      var tg = t.target;
      if (tg && (BS.Ships.isCloaked(tg) || t.source.jammed > 0)) tg = null;   // blind: the target cloaked or the launcher is jammed
      // decoys: a flare of the hunted ship inside lureKm takes the torpedo; it goes back to the ship when the flare burns out
      if (t.lured && t.lured.life <= 0) t.lured = null;
      if (!t.dead && t.target && !t.lured && t.age >= 0.4) { var lure = nearestDecoy(t, t.target, lureR); if (lure) { t.lured = lure; BS.Events.emit("torpedoLured", { torpedo: t, decoy: lure, ship: t.target }); } }
      if (!t.dead && t.lured) {
        var lw = Math.atan2(t.lured.y - t.y, t.lured.x - t.x), ld = U.normAngle(lw - t.heading), lmax = t.w.turnRate * U.DEG * dt;
        t.heading += U.clamp(ld, -lmax, lmax);
        if (U.dist(t.x, t.y, t.lured.x, t.lured.y) < decoyHitR) { t.dead = true; BS.Events.emit("torpedoDecoyed", { torpedo: t, decoy: t.lured, ship: t.target }); }
        tg = null;
      }
      if (!t.dead && tg && !tg.flags.destroyed) {
        var want = Math.atan2(tg.pos.y - t.y, tg.pos.x - t.x), diff = U.normAngle(want - t.heading);
        var maxTurn = t.w.turnRate * U.DEG * dt * (t.age < 0.4 ? 0.3 : 1);
        t.heading += U.clamp(diff, -maxTurn, maxTurn);
        var hitR = tg.visual.length * BS.Data.balance.hitRadiusFactor;
        if (U.dist(t.x, t.y, tg.pos.x, tg.pos.y) < hitR) {
          var mult = torpedoDamageMult(t.w, tg);
          var r2 = S.applyDamage(tg, t.damage * mult, t.x, t.y, S.effectiveAim(t.source, tg), t.source, "torpedo");
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

  return { beams: beams, torpedoes: torpedoes, decoys: decoys, reset: reset, update: update, fireTurretBlock: fireTurretBlock, fireLauncherBlock: fireLauncherBlock, beamEndpoints: beamEndpoints, turretHitChance: turretHitChance, torpedoDamageMult: torpedoDamageMult, launchDecoy: launchDecoy, incoming: incoming };
})();
