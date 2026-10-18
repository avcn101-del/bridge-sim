// js/effects.js — particles, shield ripples, flashes, screen shake.
// Subscribes to game events; game logic never calls this directly.
window.BS = window.BS || {};

BS.Effects = (function () {
  var U = BS.Util;
  var particles = [];   // { x, y, vx, vy, life, maxLife, size, color:[r,g,b], type, drag, grow }
  var ripples = [];     // { ship, angle, life, maxLife, strength, facing }
  var flashes = [];     // { x, y, life, maxLife, radius, color }
  var rings = [];       // { x, y, life, maxLife, radius }  expanding shockwaves
  var fragments = [];   // { ship, x, y, vx, vy, heading, rot, spin, life, maxLife, cells: [{dx, dy, color, type}], cellPx, tint, death }
  var shake = { intensity: 0 };
  var subscribed = false;
  var MAX_PARTICLES = 1400;

  function reset() { particles.length = 0; ripples.length = 0; flashes.length = 0; rings.length = 0; fragments.length = 0; shake.intensity = 0; if (!subscribed) { subscribe(); subscribed = true; } }

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
  function debris(x, y, n, speed, color) {
    for (var i = 0; i < n; i++) {
      var a = U.rand(0, U.TAU), s = U.rand(speed * 0.2, speed);
      spawn({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(1.2, 2.8), size: U.rand(1.5, 4), color: color || [170, 170, 180], type: "debris", drag: 0.6, spin: U.rand(-6, 6), rot: U.rand(0, U.TAU) });
    }
  }
  // A plate-sized chunk of hull in the block's own colour, tumbling away.
  function chunk(x, y, size, color, vx, vy) {
    spawn({ x: x, y: y, vx: vx + U.rand(-20, 20), vy: vy + U.rand(-20, 20), life: U.rand(1.6, 3.0), size: size, color: color, type: "chunk", drag: 0.5, spin: U.rand(-5, 5), rot: U.rand(0, U.TAU) });
  }
  function blockColor(b) { return hexToRgb(b.structural ? "#8a90a0" : b.def.color); }

  // A fragment: a group of blocks that leaves the ship as one piece, keeping its shape and colours.
  function fragmentFrom(ship, blocks, speed, life, death) {
    if (!blocks.length) return null;
    var cx = 0, cy = 0;
    blocks.forEach(function (b) { cx += b.lx; cy += b.ly; });
    cx /= blocks.length; cy /= blocks.length;
    var w = BS.Grid.localToWorld(ship, cx, cy);
    var away = (cx === 0 && cy === 0) ? U.rand(0, U.TAU) : Math.atan2(cy, cx) + ship.heading + U.rand(-0.35, 0.35);
    var sp = speed * U.rand(0.6, 1.3), V = BS.Data.visuals.fragments;
    var f = { ship: ship, x: w.x, y: w.y, vx: ship.vel.x * 0.5 + Math.cos(away) * sp, vy: ship.vel.y * 0.5 + Math.sin(away) * sp, heading: ship.heading, rot: 0,
      spin: U.rand(-V.spin, V.spin) * (death ? 1.4 : 1), life: life, maxLife: life, cellPx: ship.grid.cellPx, tint: ship.visual.hullTint, nacelleColor: ship.visual.nacelleColor, death: !!death,
      cells: blocks.map(function (b) { return { dx: b.lx - cx, dy: b.ly - cy, color: b.structural ? "#8a90a0" : b.def.color, type: b.type, nacelle: b.nacelle, armor: b.type === "armor" }; }) };
    fragments.push(f);
    return f;
  }
  // Split the ship's remaining blocks into a few connected pieces (multi-source flood fill from random seeds).
  function shatter(ship) {
    var V = BS.Data.visuals.fragments, alive = ship.grid.blocks.filter(function (b) { return b.alive; });
    if (!alive.length) return;
    var k = Math.min(alive.length, U.randInt(V.deathPieces[0], V.deathPieces[1])), owner = {}, queue = [];
    for (var i = 0; i < k; i++) { var seed = alive[Math.floor(Math.random() * alive.length)]; if (owner[seed.id] === undefined) { owner[seed.id] = i; queue.push(seed); } }
    var at = ship.grid.at;
    while (queue.length) {
      var b = queue.shift();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var q = at[(b.x + d[0]) + "," + (b.y + d[1])];
        if (q && q.alive && owner[q.id] === undefined) { owner[q.id] = owner[b.id]; queue.push(q); }
      });
    }
    var groups = [];
    alive.forEach(function (b) { var o = owner[b.id] === undefined ? 0 : owner[b.id]; (groups[o] = groups[o] || []).push(b); });   // ship state is left alone; the renderer hides destroyed hulls
    groups.forEach(function (g) { if (g) fragmentFrom(ship, g, V.deathSpeed, V.deathLife * U.rand(0.8, 1.1), true); });
  }
  function fragmentCellWorld(f, c) {
    var a = f.heading + f.rot, co = Math.cos(a), si = Math.sin(a);
    return { x: f.x + c.dx * co - c.dy * si, y: f.y + c.dx * si + c.dy * co };
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
      ripples.push({ ship: e.ship, angle: e.angle, life: 0.55, maxLife: 0.55, strength: strength, facing: e.facing, emitter: e.emitter });
      flash(e.impact.x, e.impact.y, 10 + strength * 14, [150, 210, 255], 0.2);
      sparks(e.impact.x, e.impact.y, Math.round(3 + strength * 5), 90, [160, 220, 255]);
      if (e.ship.isPlayer) addShake(e.kind === "torpedo" ? 5 : 1.5);
    });
    BS.Events.on("hullHit", function (e) {
      var big = e.hullDamage > 40;
      sparks(e.impact.x, e.impact.y, big ? 22 : 8, big ? 170 : 110);
      if (e.exposed) sparks(e.impact.x, e.impact.y, 6, 140, [255, 120, 80]);   // bare hull: hotter sparks
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
      var s = e.ship, br = s.grid.bridge, core = br ? BS.Grid.blockWorld(s, br) : { x: s.pos.x, y: s.pos.y };
      // the hull breaks into pieces that fly apart; the core goes up in a double shockwave
      shatter(s);
      flash(core.x, core.y, s.visual.length * 1.8, [255, 235, 190], 1.0);
      flash(core.x, core.y, s.visual.length * 0.7, [255, 255, 255], 0.35);
      rings.push({ x: core.x, y: core.y, life: 1.2, maxLife: 1.2, radius: s.visual.length * 2.4 });
      rings.push({ x: core.x, y: core.y, life: 1.8, maxLife: 1.8, radius: s.visual.length * 1.3 });
      sparks(core.x, core.y, 110, 300, [255, 210, 130]);
      debris(core.x, core.y, 30, 170, [200, 200, 210]);
      smoke(core.x, core.y, 50, [90, 80, 80], 70);
      fire(core.x, core.y, 50);
      s.grid.blocks.forEach(function (b) { if (!b.structural && Math.random() < 0.08) { var p = BS.Grid.blockWorld(s, b); chunk(p.x, p.y, s.grid.cellPx * U.rand(0.6, 1.1), blockColor(b), s.vel.x * 0.5, s.vel.y * 0.5); } });
      addShake(14);
    });
    BS.Events.on("torpedoHit", function (e) {
      var t = e.torpedo;
      flash(t.x, t.y, 34, hexToRgb(t.def.color), 0.35);
      fire(t.x, t.y, 14);
    });
    BS.Events.on("torpedoExpired", function (e) { var t = e.torpedo; flash(t.x, t.y, 12, hexToRgb(t.def.color), 0.3); });
    BS.Events.on("phaserFired", function (e) { flash(e.pos.x, e.pos.y, 6, hexToRgb(e.color), 0.15); });
    BS.Events.on("blockDestroyed", function (e) {
      var col = blockColor(e.block), s = e.ship;
      flash(e.pos.x, e.pos.y, 14, [255, 200, 140], 0.3); sparks(e.pos.x, e.pos.y, 14, 150); smoke(e.pos.x, e.pos.y, 4);
      debris(e.pos.x, e.pos.y, 4, 70, col);
      chunk(e.pos.x, e.pos.y, s.grid.cellPx * U.rand(0.5, 0.9), col, s.vel.x * 0.6, s.vel.y * 0.6);
      if (s.isPlayer) addShake(4);
    });
    BS.Events.on("blockExploded", function (e) {
      var r = e.ship.grid.cellPx * (e.radius + 1.5);
      flash(e.pos.x, e.pos.y, r * 2.2, [255, 220, 120], 0.45);
      rings.push({ x: e.pos.x, y: e.pos.y, life: 0.6, maxLife: 0.6, radius: r * 2.4 });
      sparks(e.pos.x, e.pos.y, 40, 220, [255, 210, 120]); fire(e.pos.x, e.pos.y, 18); smoke(e.pos.x, e.pos.y, 10, [80, 70, 60], 40);
      debris(e.pos.x, e.pos.y, 10, 120, [242, 193, 78]);
      addShake(e.ship.isPlayer ? 9 : 4);
    });
    BS.Events.on("criticalHit", function (e) {
      flash(e.pos.x, e.pos.y, 26, [255, 240, 200], 0.45); sparks(e.pos.x, e.pos.y, 22, 190, [255, 230, 140]); smoke(e.pos.x, e.pos.y, 5);
      addShake(e.ship.isPlayer ? 7 : 3);
    });
    BS.Events.on("sectionLost", function (e) {
      var V = BS.Data.visuals.fragments;
      // the whole section drifts off as one piece; sparks along the break
      fragmentFrom(e.ship, e.blocks, V.driftSpeed, V.sectionLife, false);
      e.positions.forEach(function (p, i) { if (i % 3 === 0) { sparks(p.x, p.y, 4, 60, [255, 220, 160]); smoke(p.x, p.y, 1); } });
      if (e.positions.length) { var p0 = e.positions[0]; flash(p0.x, p0.y, 22, [255, 220, 170], 0.4); }
      if (e.ship.isPlayer) addShake(6);
    });
    BS.Events.on("shieldBoosted", function (e) {
      var s = e.ship;
      ripples.push({ ship: s, angle: s.heading + BS.Ships.facingOffset(e.facing), life: 0.5, maxLife: 0.5, strength: 0.6, facing: e.facing, boost: true });
    });
  }

  function updateShipDamageFX(ship, dt) {
    if (ship.flags.destroyed) {
      // secondary explosions ripple through the drifting pieces during the death sequence
      if (ship.destroyedTimer < 2.4 && Math.random() < dt * 10) {
        var fs = fragments.filter(function (f) { return f.ship === ship && f.death; });
        if (fs.length) {
          var f = fs[Math.floor(Math.random() * fs.length)], c = f.cells[Math.floor(Math.random() * f.cells.length)], p = fragmentCellWorld(f, c);
          flash(p.x, p.y, U.rand(14, 34), [255, 210, 150], 0.3); sparks(p.x, p.y, 12, 130, [255, 200, 120]); smoke(p.x, p.y, 5, [80, 70, 70], 30); fire(p.x, p.y, 6);
          if (Math.random() < 0.3) chunk(p.x, p.y, f.cellPx * U.rand(0.5, 0.9), hexToRgb(c.color), f.vx, f.vy);
        }
      }
      return;
    }
    var frac = ship.hull / ship.hullMax;
    if (frac < BS.Data.balance.hullSmokeThreshold) {
      ship.smokeTimer -= dt;
      if (ship.smokeTimer <= 0) {
        ship.smokeTimer = 0.05 + frac * 0.2;
        var damaged = ship.grid.blocks.filter(function (b) { return b.alive && b.hp < b.maxHp; });
        var src = damaged.length ? damaged[Math.floor(Math.random() * damaged.length)] : ship.grid.blocks[Math.floor(Math.random() * ship.grid.blocks.length)];
        var q = BS.Grid.blockWorld(ship, src);
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
    for (i = fragments.length - 1; i >= 0; i--) {
      var f = fragments[i];
      f.life -= dt;
      if (f.life <= 0) { fragments.splice(i, 1); continue; }
      f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.spin * dt;
      var k = Math.max(0, 1 - 0.35 * dt); f.vx *= k; f.vy *= k;
      if (f.death && Math.random() < dt * 2.5) { var c = f.cells[Math.floor(Math.random() * f.cells.length)], q = fragmentCellWorld(f, c); smoke(q.x, q.y, 1, [90, 85, 90], 12); if (Math.random() < 0.5) fire(q.x, q.y, 1); }
    }
    shake.intensity = Math.max(0, shake.intensity - BS.Data.visuals.shakeDecay * dt * (1 + shake.intensity * 0.1));
    for (i = 0; i < ships.length; i++) updateShipDamageFX(ships[i], dt);
    for (i = 0; i < torpedoes.length; i++) torpedoTrail(torpedoes[i], dt);
  }

  return { particles: particles, ripples: ripples, flashes: flashes, rings: rings, fragments: fragments, shake: shake, reset: reset, update: update, addShake: addShake, hexToRgb: hexToRgb, fragmentCellWorld: fragmentCellWorld };
})();
