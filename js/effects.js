// js/effects.js — particles, shield ripples, flashes, screen shake.
// Subscribes to game events; game logic never calls this directly.
window.BS = window.BS || {};

BS.Effects = (function () {
  var U = BS.Util;
  var particles = [];   // { x, y, vx, vy, life, maxLife, size, color:[r,g,b], type, drag, grow }
  var ripples = [];     // { ship, angle, life, maxLife, strength, facing }
  var flashes = [];     // { x, y, life, maxLife, radius, color }
  var rings = [];       // { x, y, life, maxLife, radius }  expanding shockwaves
  var shake = { intensity: 0 };
  var subscribed = false;
  var MAX_PARTICLES = 1400;

  function reset() { particles.length = 0; ripples.length = 0; flashes.length = 0; rings.length = 0; shake.intensity = 0; if (!subscribed) { subscribe(); subscribed = true; } }

  function spawn(p) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    p.maxLife = p.life; p.drag = p.drag || 0; p.grow = p.grow || 0;
    particles.push(p);
  }

  function sparks(x, y, n, speed, color) {
    for (var i = 0; i < n; i++) {
      var a = U.rand(0, U.TAU), s = U.rand(speed * 0.3, speed);
      spawn({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.25, 0.7), size: U.rand(1, 2.4), color: color || [255, 220, 140], type: "spark", drag: 2.5 });
    }
  }
  function smoke(x, y, n, color, speed) {
    for (var i = 0; i < n; i++) {
      var a = U.rand(0, U.TAU), s = U.rand(4, speed || 18);
      spawn({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.8, 1.8), size: U.rand(3, 7), color: color || [120, 120, 130], type: "smoke", drag: 0.8, grow: 6 });
    }
  }
  function fire(x, y, n) {
    for (var i = 0; i < n; i++) {
      var a = U.rand(0, U.TAU), s = U.rand(3, 14);
      spawn({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.3, 0.7), size: U.rand(2, 4.5), color: [255, U.randInt(120, 190), 50], type: "fire", drag: 1, grow: -2 });
    }
  }
  function debris(x, y, n, speed) {
    for (var i = 0; i < n; i++) {
      var a = U.rand(0, U.TAU), s = U.rand(speed * 0.2, speed);
      spawn({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(1.2, 2.8), size: U.rand(1.5, 4), color: [170, 170, 180], type: "debris", drag: 0.6, spin: U.rand(-6, 6), rot: U.rand(0, U.TAU) });
    }
  }
  function flash(x, y, radius, color, life) { flashes.push({ x: x, y: y, radius: radius, color: color || [255, 240, 200], life: life || 0.3, maxLife: life || 0.3 }); }
  function addShake(amount) { shake.intensity = Math.min(BS.Data.visuals.shakeMax, shake.intensity + amount); }

  function torpedoTrail(t, dt) {
    // bright core trail + faint smoke
    var c = hexToRgb(t.def.color);
    spawn({ x: t.x + U.rand(-1, 1), y: t.y + U.rand(-1, 1), vx: -Math.cos(t.heading) * 20 + U.rand(-8, 8), vy: -Math.sin(t.heading) * 20 + U.rand(-8, 8), life: U.rand(0.35, 0.6), size: U.rand(2, 3.5), color: c, type: "glow", drag: 1.5, grow: -3 });
  }

  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function subscribe() {
    BS.Events.on("shieldHit", function (e) {
      var strength = U.clamp(e.absorbed / 120, 0.3, 1.2);
      ripples.push({ ship: e.ship, angle: e.angle, life: 0.55, maxLife: 0.55, strength: strength, facing: e.facing });
      flash(e.impact.x, e.impact.y, 10 + strength * 14, [150, 210, 255], 0.2);
      sparks(e.impact.x, e.impact.y, Math.round(3 + strength * 5), 90, [160, 220, 255]);
      if (e.ship.isPlayer) addShake(e.kind === "torpedo" ? 5 : 1.5);
    });
    BS.Events.on("hullHit", function (e) {
      var big = e.hullDamage > 40;
      sparks(e.impact.x, e.impact.y, big ? 22 : 8, big ? 170 : 110);
      smoke(e.impact.x, e.impact.y, big ? 6 : 2);
      flash(e.impact.x, e.impact.y, big ? 26 : 12, [255, 200, 120], 0.25);
      if (e.ship.isPlayer) addShake(big ? 9 : 3);
      else if (big) addShake(2);
    });
    BS.Events.on("subsystemDamaged", function (e) {
      var pt = e.subsystemPoint || e.impact;
      sparks(pt.x, pt.y, 8, 140, [255, 255, 200]); smoke(pt.x, pt.y, 2); flash(pt.x, pt.y, 9, [255, 240, 200], 0.2);
    });
    BS.Events.on("shipDestroyed", function (e) {
      var s = e.ship;
      flash(s.pos.x, s.pos.y, s.visual.length * 1.6, [255, 230, 180], 0.9);
      rings.push({ x: s.pos.x, y: s.pos.y, life: 1.1, maxLife: 1.1, radius: s.visual.length * 2.2 });
      sparks(s.pos.x, s.pos.y, 90, 260, [255, 200, 120]);
      debris(s.pos.x, s.pos.y, 45, 150);
      smoke(s.pos.x, s.pos.y, 40, [90, 80, 80], 60);
      fire(s.pos.x, s.pos.y, 40);
      addShake(14);
    });
    BS.Events.on("torpedoHit", function (e) {
      var t = e.torpedo;
      flash(t.x, t.y, 34, hexToRgb(t.def.color), 0.35);
      fire(t.x, t.y, 14);
    });
    BS.Events.on("torpedoExpired", function (e) { var t = e.torpedo; flash(t.x, t.y, 12, hexToRgb(t.def.color), 0.3); });
    BS.Events.on("phaserFired", function (e) {
      var m = e.ship.cls.phaserMounts;
      for (var i = 0; i < m.length; i++) { var p = U.localToWorld(e.ship, m[i].x, m[i].y); flash(p.x, p.y, 7, hexToRgb(e.ship.phaserDef.color), 0.15); }
    });
  }

  function updateShipDamageFX(ship, dt) {
    if (ship.flags.destroyed) {
      // secondary explosions during the death sequence
      if (ship.destroyedTimer < 1.4 && Math.random() < dt * 9) {
        var p = U.localToWorld(ship, U.rand(-ship.visual.length * 0.4, ship.visual.length * 0.4), U.rand(-ship.visual.width * 0.4, ship.visual.width * 0.4));
        flash(p.x, p.y, U.rand(14, 30), [255, 210, 150], 0.3); sparks(p.x, p.y, 10, 120); smoke(p.x, p.y, 4);
      }
      return;
    }
    var frac = ship.hull / ship.hullMax;
    if (frac < BS.Data.balance.hullSmokeThreshold) {
      ship.smokeTimer -= dt;
      if (ship.smokeTimer <= 0) {
        ship.smokeTimer = 0.05 + frac * 0.2;
        var q = U.localToWorld(ship, U.rand(-ship.visual.length * 0.35, ship.visual.length * 0.35), U.rand(-ship.visual.width * 0.3, ship.visual.width * 0.3));
        smoke(q.x, q.y, 1, [110, 105, 110], 10);
        if (frac < 0.3 && Math.random() < 0.6) fire(q.x, q.y, 1);
        if (frac < 0.3 && Math.random() < 0.08) sparks(q.x, q.y, 3, 60);
      }
    }
  }

  function update(dt, ships, torpedoes) {
    var i, p;
    for (i = particles.length - 1; i >= 0; i--) {
      p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.drag) { var k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      if (p.grow) p.size = Math.max(0.3, p.size + p.grow * dt);
      if (p.spin) p.rot += p.spin * dt;
    }
    for (i = ripples.length - 1; i >= 0; i--) { ripples[i].life -= dt; if (ripples[i].life <= 0) ripples.splice(i, 1); }
    for (i = flashes.length - 1; i >= 0; i--) { flashes[i].life -= dt; if (flashes[i].life <= 0) flashes.splice(i, 1); }
    for (i = rings.length - 1; i >= 0; i--) { rings[i].life -= dt; if (rings[i].life <= 0) rings.splice(i, 1); }
    shake.intensity = Math.max(0, shake.intensity - BS.Data.visuals.shakeDecay * dt * (1 + shake.intensity * 0.1));
    for (i = 0; i < ships.length; i++) updateShipDamageFX(ships[i], dt);
    for (i = 0; i < torpedoes.length; i++) torpedoTrail(torpedoes[i], dt);
  }

  return { particles: particles, ripples: ripples, flashes: flashes, rings: rings, shake: shake, reset: reset, update: update, addShake: addShake, hexToRgb: hexToRgb };
})();
