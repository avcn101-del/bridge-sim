// js/renderer.js — canvas drawing: space, ships, weapons, shields, effects.
// Ship drawing is dispatched by ship.visual.kind ("vector" | "sprite") and
// ship.visual.drawer, so sprites can replace vector art without touching logic.
window.BS = window.BS || {};

BS.Renderer = (function () {
  var U = BS.Util;
  var canvas, ctx, W = 0, H = 0, dpr = 1;
  var camera = { x: 0, y: 0, zoom: 1, initialised: false };
  var starLayers = [];
  var nebulaCanvas = null;
  var time = 0;
  var spriteCache = {};

  // ---------------------------------------------------------------- setup
  function init(canvasEl) {
    canvas = canvasEl; ctx = canvas.getContext("2d");
    buildStars();
    resize();
    window.addEventListener("resize", resize);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.floor(r.width)); H = Math.max(1, Math.floor(r.height));
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    buildNebula();
  }

  function buildStars() {
    var rnd = U.seededRandom(1701);
    var tile = BS.Data.visuals.starTile;
    starLayers = BS.Data.visuals.starLayers.map(function (L) {
      var stars = [];
      for (var i = 0; i < L.count; i++) {
        var tint = rnd();
        stars.push({ x: rnd() * tile, y: rnd() * tile, s: L.size[0] + rnd() * (L.size[1] - L.size[0]), a: L.alpha * (0.5 + rnd() * 0.5), twinkle: rnd() * U.TAU,
          color: tint < 0.15 ? "255,210,180" : tint < 0.3 ? "180,200,255" : "235,240,255" });
      }
      return { def: L, stars: stars };
    });
  }

  function buildNebula() {
    nebulaCanvas = document.createElement("canvas");
    var nw = Math.ceil(W * 1.4), nh = Math.ceil(H * 1.4);
    nebulaCanvas.width = nw; nebulaCanvas.height = nh;
    var c = nebulaCanvas.getContext("2d");
    c.fillStyle = "#03040a"; c.fillRect(0, 0, nw, nh);
    BS.Data.visuals.nebulae.forEach(function (n) {
      var r = n.r * Math.max(nw, nh);
      var g = c.createRadialGradient(n.x * nw, n.y * nh, 0, n.x * nw, n.y * nh, r);
      g.addColorStop(0, "rgba(" + n.color + ",0.42)");
      g.addColorStop(0.45, "rgba(" + n.color + ",0.18)");
      g.addColorStop(1, "rgba(" + n.color + ",0)");
      c.fillStyle = g; c.fillRect(0, 0, nw, nh);
    });
    // faint dust streaks
    var rnd = U.seededRandom(74656);
    for (var i = 0; i < 40; i++) {
      var x = rnd() * nw, y = rnd() * nh, rr = 40 + rnd() * 160;
      var g2 = c.createRadialGradient(x, y, 0, x, y, rr);
      g2.addColorStop(0, "rgba(120,90,160,0.05)"); g2.addColorStop(1, "rgba(120,90,160,0)");
      c.fillStyle = g2; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
  }

  // --------------------------------------------------------------- camera
  // Follows the player, leaning a third of the way toward the enemy, and zooms so both ships fit (balance.zoom);
  // the manual zoom bias multiplies the fit. Writes the effective zoom back to state.zoom.
  function updateCamera(st, alpha, dt) {
    var player = st.player, enemy = st.enemy, Z = BS.Data.balance.zoom;
    if (!player) return;
    var px = U.lerp(player.prevPos.x, player.pos.x, alpha), py = U.lerp(player.prevPos.y, player.pos.y, alpha);
    var tx = px, ty = py, fit = Z.autoMax;
    if (enemy && !enemy.flags.destroyed && BS.Ships.visibility(enemy, player) > 0) {
      var ex = U.lerp(enemy.prevPos.x, enemy.pos.x, alpha), ey = U.lerp(enemy.prevPos.y, enemy.pos.y, alpha);
      tx = px + (ex - px) * 0.33; ty = py + (ey - py) * 0.33;
      var span = U.dist(px, py, ex, ey) * 2 * 0.67 + player.visual.length + enemy.visual.length;
      fit = U.clamp(Math.min(W, H) / (span * Z.fitMargin), Math.min(W, H) < Z.shortPx ? Z.autoMinShort : Z.autoMin, Z.autoMax);
    }
    if (!camera.initialised) { camera.x = tx; camera.y = ty; camera.zoom = fit; camera.initialised = true; }
    var k = 1 - Math.pow(1 - BS.Data.balance.cameraLerp, dt * 60), kz = 1 - Math.pow(1 - Z.lerp, dt * 60);
    camera.x += (tx - camera.x) * k; camera.y += (ty - camera.y) * k;
    camera.zoom += (fit - camera.zoom) * kz;
    st.zoom = U.clamp(camera.zoom * (st.zoomBias || 1), Z.min, Z.max);
  }
  function resetCamera() { camera.initialised = false; }

  // ---------------------------------------------------------------- space
  function drawSpace() {
    // nebula with slight, bounded parallax drift
    var nx = -W * 0.2 + W * 0.18 * Math.sin(camera.x * 0.0009);
    var ny = -H * 0.2 + H * 0.18 * Math.sin(camera.y * 0.0009 + 1.3);
    ctx.fillStyle = "#03040a"; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(nebulaCanvas, nx, ny);
    // stars
    var tile = BS.Data.visuals.starTile;
    for (var L = 0; L < starLayers.length; L++) {
      var layer = starLayers[L], par = layer.def.parallax;
      var ox = ((camera.x * par) % tile + tile) % tile, oy = ((camera.y * par) % tile + tile) % tile;
      var stars = layer.stars;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var x = ((s.x - ox) % tile + tile) % tile, y = ((s.y - oy) % tile + tile) % tile;
        // tile repeat for screens wider than one tile offset
        if (x > W + 4 && x - tile < -4) continue;
        if (y > H + 4 && y - tile < -4) continue;
        if (x > W) x -= tile; if (y > H) y -= tile;
        var a = s.a * (0.75 + 0.25 * Math.sin(time * 1.5 + s.twinkle));
        ctx.fillStyle = "rgba(" + s.color + "," + a.toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(x, y, s.s, 0, U.TAU); ctx.fill();
      }
    }
  }

  // ------------------------------------------------------- tactical grid
  var zoom = 1;
  function kmLabel(r, text) {
    ctx.fillStyle = "rgba(150,170,255,0.45)"; ctx.font = (11 / zoom).toFixed(1) + "px Antonio, 'Arial Narrow', sans-serif"; ctx.textBaseline = "bottom";
    ctx.fillText(text, r * 0.72 + 4 / zoom, -r * 0.69);
  }
  function drawTacticalOverlay(player) {
    if (!player) return;
    var pk = BS.Data.units.pxPerKm;
    ctx.save();
    ctx.lineWidth = 1 / zoom;
    // weapon envelopes from the fitted modules
    var turret = player.modules.filter(function (m) { return m.def.kind === "turret"; })[0];
    var launcher = player.modules.filter(function (m) { return m.def.kind === "launcher"; })[0];
    if (turret) {
      ctx.strokeStyle = "rgba(255,170,110,0.16)"; ctx.setLineDash([3 / zoom, 6 / zoom]);
      ctx.beginPath(); ctx.arc(0, 0, turret.def.optimalKm * pk, 0, U.TAU); ctx.stroke(); kmLabel(turret.def.optimalKm * pk, "optimal " + turret.def.optimalKm + " km");
      ctx.strokeStyle = "rgba(255,170,110,0.09)";
      ctx.beginPath(); ctx.arc(0, 0, (turret.def.optimalKm + turret.def.falloffKm) * pk, 0, U.TAU); ctx.stroke(); kmLabel((turret.def.optimalKm + turret.def.falloffKm) * pk, "falloff " + (turret.def.optimalKm + turret.def.falloffKm) + " km");
    }
    if (launcher) {
      ctx.strokeStyle = "rgba(120,150,255,0.1)"; ctx.setLineDash([8 / zoom, 12 / zoom]);
      ctx.beginPath(); ctx.arc(0, 0, launcher.def.rangeKm * pk, 0, U.TAU); ctx.stroke(); kmLabel(launcher.def.rangeKm * pk, "torpedo " + launcher.def.rangeKm + " km");
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ------------------------------------------------ selection / lock / nav
  function drawNavigation(state, alpha, t) {
    var p = state.player, e = state.enemy;
    if (!p) return;
    var pk = BS.Data.units.pxPerKm;
    var px = U.lerp(p.prevPos.x, p.pos.x, alpha), py = U.lerp(p.prevPos.y, p.pos.y, alpha);
    ctx.save();
    ctx.lineWidth = 1 / zoom;
    // velocity vector
    if (p.speed > 1) {
      ctx.strokeStyle = "rgba(160,200,255,0.5)";
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + p.vel.x * 1.2, py + p.vel.y * 1.2); ctx.stroke();
    }
    // command visualisation
    var c = p.cmd;
    if ((c.type === "orbit" || c.type === "keep") && c.target && !c.target.flags.destroyed) {
      var tx = U.lerp(c.target.prevPos.x, c.target.pos.x, alpha), ty = U.lerp(c.target.prevPos.y, c.target.pos.y, alpha);
      ctx.strokeStyle = c.type === "orbit" ? "rgba(120,200,255,0.35)" : "rgba(200,180,255,0.35)"; ctx.setLineDash([4 / zoom, 6 / zoom]);
      ctx.beginPath(); ctx.arc(tx, ty, c.range, 0, U.TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    if (c.type === "flyTo" && c.point) {
      ctx.strokeStyle = "rgba(160,200,255,0.6)";
      ctx.beginPath(); ctx.arc(c.point.x, c.point.y, 6 / zoom, 0, U.TAU); ctx.stroke();
      ctx.setLineDash([3 / zoom, 5 / zoom]); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(c.point.x, c.point.y); ctx.stroke(); ctx.setLineDash([]);
    }
    if (!e || e.flags.destroyed || BS.Ships.visibility(e, p) <= 0) { ctx.restore(); return; }
    var ex = U.lerp(e.prevPos.x, e.pos.x, alpha), ey = U.lerp(e.prevPos.y, e.pos.y, alpha);
    var R = e.visual.length * 0.75;
    // enemy velocity vector
    if (e.speed > 1) { ctx.strokeStyle = "rgba(255,160,160,0.45)"; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + e.vel.x * 1.2, ey + e.vel.y * 1.2); ctx.stroke(); }
    // selection box
    if (p.selected === e) {
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1 / zoom;
      var k = R, L = R * 0.35;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) {
        ctx.beginPath(); ctx.moveTo(ex + q[0] * k, ey + q[1] * (k - L)); ctx.lineTo(ex + q[0] * k, ey + q[1] * k); ctx.lineTo(ex + q[0] * (k - L), ey + q[1] * k); ctx.stroke();
      });
    }
    // lock state
    var Lk = p.lock;
    if (Lk.target === e) {
      if (!Lk.locked) {
        ctx.strokeStyle = "rgba(255,210,120,0.9)"; ctx.lineWidth = 2 / zoom; ctx.setLineDash([R * 0.3, R * 0.2]); ctx.lineDashOffset = -t * 60;
        ctx.beginPath(); ctx.arc(ex, ey, R * 1.1, 0, U.TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(255,210,120,0.5)"; ctx.lineWidth = 3 / zoom;
        ctx.beginPath(); ctx.arc(ex, ey, R * 1.1, -Math.PI / 2, -Math.PI / 2 + U.TAU * Lk.progress); ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(255,90,70,0.95)"; ctx.lineWidth = 2 / zoom;
        var k2 = R * 1.05, L2 = R * 0.3;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) {
          ctx.beginPath(); ctx.moveTo(ex + q[0] * k2, ey + q[1] * (k2 - L2)); ctx.lineTo(ex + q[0] * k2, ey + q[1] * k2); ctx.lineTo(ex + q[0] * (k2 - L2), ey + q[1] * k2); ctx.stroke();
        });
      }
    }
    // enemy locking us
    if (e.lock.target === p && e.lock.locked) {
      ctx.strokeStyle = "rgba(255,90,70,0.5)"; ctx.lineWidth = 1 / zoom; ctx.setLineDash([2 / zoom, 4 / zoom]);
      ctx.beginPath(); ctx.arc(px, py, p.visual.length * 0.8, 0, U.TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    // distance tag
    var dKm = BS.Ships.km(U.dist(px, py, ex, ey));
    ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = (12 / zoom).toFixed(1) + "px Antonio, 'Arial Narrow', sans-serif"; ctx.textBaseline = "top";
    ctx.fillText((dKm < 10 ? dKm.toFixed(1) : Math.round(dKm)) + " km", ex + R * 0.8, ey + R * 0.8);
    ctx.restore();
  }

  // ----------------------------------------------------------- ship art
  var drawers = {};

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function hexToRgb(hex) { var n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, k) { return [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)]; }

  // Draw a block-grid ship in ship-local coordinates (x forward, y starboard) on context `c`.
  // Blocks are plated cells with a smooth outline, shading, and glowing systems.
  function drawGridShip(c, ship, t, opts) {
    opts = opts || {};
    var g = ship.grid, cp = g.cellPx, half = cp / 2, blocks = g.blocks;
    var tint = hexToRgb(ship.visual.hullTint || "#c6ccda"), dark = [18, 20, 30], red = [160, 40, 30];
    var alive = [];
    for (var i = 0; i < blocks.length; i++) if (blocks[i].alive) alive.push(blocks[i]);
    // 1. plates
    for (i = 0; i < alive.length; i++) {
      var b = alive[i], col = b.structural ? [138, 144, 160] : b.type === "armor" ? mix(hexToRgb(b.def.color), tint, 0.35) : mix(mix(hexToRgb(b.def.color), tint, 0.5), dark, 0.45);
      var frac = b.hp / b.maxHp;
      if (frac < 1) col = mix(col, red, (1 - frac) * 0.7);
      // subtle per-cell variation reads as panelling
      var v = ((b.x * 7 + b.y * 13) % 5) * 0.02 - 0.04;
      c.fillStyle = "rgb(" + Math.max(0, col[0] + col[0] * v | 0) + "," + Math.max(0, col[1] + col[1] * v | 0) + "," + Math.max(0, col[2] + col[2] * v | 0) + ")";
      c.fillRect(b.lx - half - 0.25, b.ly - half - 0.25, cp + 0.5, cp + 0.5);
    }
    // 2. shading across the hull (light from port-fore)
    c.save();
    c.beginPath();
    for (i = 0; i < alive.length; i++) c.rect(alive[i].lx - half, alive[i].ly - half, cp, cp);
    c.clip();
    var sg = c.createLinearGradient(-ship.visual.length / 2, -ship.visual.width / 2, ship.visual.length / 4, ship.visual.width / 2);
    sg.addColorStop(0, "rgba(255,255,255,0.22)"); sg.addColorStop(0.5, "rgba(255,255,255,0)"); sg.addColorStop(1, "rgba(0,0,0,0.35)");
    c.fillStyle = sg; c.fillRect(-ship.visual.length, -ship.visual.width, ship.visual.length * 2, ship.visual.width * 2);
    // panel lines every other cell
    c.strokeStyle = "rgba(0,0,0,0.12)"; c.lineWidth = 0.5;
    for (i = 0; i < alive.length; i++) { b = alive[i]; if ((b.x + b.y) % 2 === 0) { c.beginPath(); c.moveTo(b.lx - half, b.ly - half); c.lineTo(b.lx + half, b.ly - half); c.stroke(); } }
    c.restore();
    // 3. outline along hull edges
    c.strokeStyle = "rgba(" + dark.join(",") + ",0.95)"; c.lineWidth = 0.9; c.lineCap = "round"; c.lineJoin = "round";
    c.beginPath();
    for (i = 0; i < alive.length; i++) {
      b = alive[i];
      var n;
      n = g.at[(b.x + 1) + "," + b.y]; if (!n || !n.alive) { c.moveTo(b.lx + half, b.ly - half); c.lineTo(b.lx + half, b.ly + half); }
      n = g.at[(b.x - 1) + "," + b.y]; if (!n || !n.alive) { c.moveTo(b.lx - half, b.ly - half); c.lineTo(b.lx - half, b.ly + half); }
      n = g.at[b.x + "," + (b.y + 1)]; if (!n || !n.alive) { c.moveTo(b.lx - half, b.ly + half); c.lineTo(b.lx + half, b.ly + half); }
      n = g.at[b.x + "," + (b.y - 1)]; if (!n || !n.alive) { c.moveTo(b.lx - half, b.ly - half); c.lineTo(b.lx + half, b.ly - half); }
    }
    c.stroke();
    // 4. systems: glows and markers
    var pulse = 0.8 + 0.2 * Math.sin(t * 4), nac = ship.visual.nacelleColor || "90,160,255";
    c.save(); c.globalCompositeOperation = "lighter";
    for (i = 0; i < alive.length; i++) {
      b = alive[i];
      if (b.type === "engine") {
        var gl = c.createRadialGradient(b.lx, b.ly, 0, b.lx, b.ly, cp * (b.nacelle ? 1.6 : 1.1));
        gl.addColorStop(0, "rgba(" + nac + "," + (0.55 * pulse).toFixed(2) + ")"); gl.addColorStop(1, "rgba(" + nac + ",0)");
        c.fillStyle = gl; c.beginPath(); c.arc(b.lx, b.ly, cp * 1.6, 0, U.TAU); c.fill();
      } else if (b.type === "reactor") {
        c.fillStyle = "rgba(255,210,90," + (0.25 + 0.25 * Math.sin(t * 6 + b.x)).toFixed(2) + ")"; c.beginPath(); c.arc(b.lx, b.ly, cp * 0.7, 0, U.TAU); c.fill();
      } else if (b.type === "bridge") {
        var bg = c.createRadialGradient(b.lx, b.ly, 0, b.lx, b.ly, cp * 1.2); bg.addColorStop(0, "rgba(255,255,255,0.35)"); bg.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = bg; c.beginPath(); c.arc(b.lx, b.ly, cp * 1.2, 0, U.TAU); c.fill();
      }
    }
    c.restore();
    // 5. block glyphs: one distinct shape and colour per system type (same drawing as the palette icons)
    c.save();
    for (i = 0; i < alive.length; i++) { b = alive[i]; if (!b.structural && b.type !== "armor") drawBlockGlyph(c, b.type, b.lx, b.ly, cp, t); }
    c.restore();
    c.save(); c.globalCompositeOperation = "lighter";
    // running lights at the port/starboard extremes
    if (!opts.still && Math.sin(t * 6) > 0.6) {
      var minY = Infinity, maxY = -Infinity, pb = null, sb = null;
      for (i = 0; i < alive.length; i++) { b = alive[i]; if (b.ly < minY) { minY = b.ly; pb = b; } if (b.ly > maxY) { maxY = b.ly; sb = b; } }
      if (pb) { c.fillStyle = "#ff4040"; c.beginPath(); c.arc(pb.lx, pb.ly - half, cp * 0.25, 0, U.TAU); c.fill(); }
      if (sb) { c.fillStyle = "#40ff70"; c.beginPath(); c.arc(sb.lx, sb.ly + half, cp * 0.25, 0, U.TAU); c.fill(); }
    }
    c.restore();
  }

  drawers.grid = function (ship, t) { drawGridShip(ctx, ship, t); };

  // One glyph per block type, drawn centred on (x, y) in a cell of `size` px: bright shape with a dark outline.
  function drawBlockGlyph(c, type, x, y, size, t) {
    var d = BS.Data.blocks[type]; if (!d) return;
    var r = size * 0.5, col = d.color, g = d.glyph || "plate";
    c.save(); c.translate(x, y); c.lineJoin = "round"; c.lineCap = "round";
    function outline() { c.strokeStyle = "rgba(10,12,20,0.9)"; c.lineWidth = size * 0.16; c.stroke(); }
    switch (g) {
      case "lens":      // phaser: ring with a hot core
        c.beginPath(); c.arc(0, 0, r * 0.62, 0, U.TAU); outline(); c.strokeStyle = col; c.lineWidth = size * 0.14; c.stroke();
        c.fillStyle = "#fff3e0"; c.beginPath(); c.arc(0, 0, r * 0.22, 0, U.TAU); c.fill(); break;
      case "bolt":      // disruptor cannon: lightning bolt
        c.beginPath(); c.moveTo(r * 0.15, -r * 0.85); c.lineTo(-r * 0.45, r * 0.05); c.lineTo(r * 0.05, r * 0.05); c.lineTo(-r * 0.15, r * 0.85); c.lineTo(r * 0.45, -r * 0.05); c.lineTo(-r * 0.05, -r * 0.05); c.closePath(); outline(); c.fillStyle = col; c.fill(); break;
      case "burst":     // pulse phaser: three dots in a row
        c.beginPath(); [-0.55, 0, 0.55].forEach(function (k) { c.moveTo(k * r + r * 0.22, 0); c.arc(k * r, 0, r * 0.22, 0, U.TAU); }); outline(); c.fillStyle = col; c.fill(); break;
      case "warhead":   // torpedo: diamond
        c.beginPath(); c.moveTo(0, -r * 0.8); c.lineTo(r * 0.55, 0); c.lineTo(0, r * 0.8); c.lineTo(-r * 0.55, 0); c.closePath(); outline(); c.fillStyle = col; c.fill(); break;
      case "shield":    // shield emitter: half-ring facing out (up)
        c.beginPath(); c.arc(0, r * 0.15, r * 0.7, Math.PI * 1.1, Math.PI * 1.9); outline(); c.strokeStyle = col; c.lineWidth = size * 0.18; c.stroke();
        c.fillStyle = col; c.beginPath(); c.arc(0, r * 0.25, r * 0.18, 0, U.TAU); c.fill(); break;
      case "core":      // reactor: four-ray burst
        c.beginPath(); for (var k = 0; k < 4; k++) { var a = k * Math.PI / 2; c.moveTo(0, 0); c.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); } outline(); c.strokeStyle = col; c.lineWidth = size * 0.16; c.stroke();
        c.fillStyle = "#fff6c8"; c.beginPath(); c.arc(0, 0, r * 0.26, 0, U.TAU); c.fill(); break;
      case "thrust":    // engine: chevron pointing aft
        c.beginPath(); c.moveTo(r * 0.5, -r * 0.65); c.lineTo(-r * 0.4, 0); c.lineTo(r * 0.5, r * 0.65); outline(); c.strokeStyle = col; c.lineWidth = size * 0.18; c.stroke(); break;
      case "dish":      // sensor: two arcs and a dot (radar)
        c.beginPath(); c.arc(-r * 0.3, 0, r * 0.45, -0.9, 0.9); c.moveTo(r * 0.5, 0); c.arc(-r * 0.3, 0, r * 0.8, -0.9, 0.9); outline(); c.strokeStyle = col; c.lineWidth = size * 0.14; c.stroke();
        c.fillStyle = col; c.beginPath(); c.arc(-r * 0.3, 0, r * 0.2, 0, U.TAU); c.fill(); break;
      case "star":      // bridge: four-point star
        c.beginPath(); for (var j = 0; j < 8; j++) { var ang = j * Math.PI / 4 - Math.PI / 2, rr = j % 2 ? r * 0.3 : r * 0.85; c.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } c.closePath(); outline(); c.fillStyle = col; c.fill(); break;
      case "windows":   // crew quarters: 2×2 lit windows
        c.fillStyle = "rgba(10,12,20,0.9)"; c.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
        c.fillStyle = col; [[-0.45, -0.45], [0.1, -0.45], [-0.45, 0.1], [0.1, 0.1]].forEach(function (p) { c.fillRect(p[0] * r, p[1] * r, r * 0.35, r * 0.35); }); break;
      case "wave":      // jammer: zigzag
        c.beginPath(); c.moveTo(-r * 0.8, 0); c.lineTo(-r * 0.4, -r * 0.5); c.lineTo(0, r * 0.5); c.lineTo(r * 0.4, -r * 0.5); c.lineTo(r * 0.8, 0); outline(); c.strokeStyle = col; c.lineWidth = size * 0.16; c.stroke(); break;
      case "flare":     // decoy launcher: a comet (dot with a short tail)
        c.beginPath(); c.moveTo(-r * 0.85, r * 0.55); c.lineTo(r * 0.15, -r * 0.15); outline(); c.strokeStyle = col; c.lineWidth = size * 0.16; c.stroke();
        c.beginPath(); c.arc(r * 0.3, -r * 0.3, r * 0.34, 0, U.TAU); outline(); c.fillStyle = "#fff6d6"; c.fill(); c.strokeStyle = col; c.lineWidth = size * 0.1; c.stroke(); break;
      case "drain":     // energy neutraliser: ring with an arrow pulling in
        c.beginPath(); c.arc(0, 0, r * 0.66, Math.PI * 0.15, Math.PI * 1.85); outline(); c.strokeStyle = col; c.lineWidth = size * 0.14; c.stroke();
        c.beginPath(); c.moveTo(r * 0.95, -r * 0.45); c.lineTo(r * 0.1, 0); c.lineTo(r * 0.95, r * 0.45); outline(); c.strokeStyle = col; c.lineWidth = size * 0.14; c.stroke(); break;
      case "eye":       // cloak: eye
        c.beginPath(); c.moveTo(-r * 0.85, 0); c.quadraticCurveTo(0, -r * 0.9, r * 0.85, 0); c.quadraticCurveTo(0, r * 0.9, -r * 0.85, 0); c.closePath(); outline(); c.strokeStyle = col; c.lineWidth = size * 0.13; c.stroke();
        c.fillStyle = col; c.beginPath(); c.arc(0, 0, r * 0.28, 0, U.TAU); c.fill(); break;
      default: break;   // armor: the plate itself
    }
    c.restore();
  }
  // A small canvas icon of a block type for the DOM (palette, chips, rows).
  function blockIcon(type, px) {
    var cv = document.createElement("canvas"), s = px || 16, dpr2 = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = s * dpr2; cv.height = s * dpr2; cv.style.width = s + "px"; cv.style.height = s + "px"; cv.className = "blk-icon";
    var c = cv.getContext("2d"); c.scale(dpr2, dpr2);
    var d = BS.Data.blocks[type], rgb = d ? hexToRgb(d.color) : [120, 120, 130];
    c.fillStyle = type === "armor" ? "rgb(" + mix(rgb, [198, 204, 218], 0.35).join(",") + ")" : "rgb(" + mix(mix(rgb, [198, 204, 218], 0.5), [18, 20, 30], 0.45).join(",") + ")";
    roundRectOn(c, 0.5, 0.5, s - 1, s - 1, 3); c.fill(); c.strokeStyle = "rgba(10,12,20,0.9)"; c.lineWidth = 1; c.stroke();
    drawBlockGlyph(c, type, s / 2, s / 2, s * 0.9, 0);
    return cv;
  }
  function roundRectOn(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }

  // Image sprite drawer: assets/ships/<file>, drawn pointing +x, centred.
  drawers.sprite = function (ship, t) {
    var src = ship.visual.sprite, img = spriteCache[src];
    if (!img) { img = new Image(); img.src = src; spriteCache[src] = img; }
    if (!img.complete || !img.naturalWidth) { drawers.grid(ship, t); return; }
    var len = ship.visual.length, w = len * img.naturalHeight / img.naturalWidth;
    ctx.drawImage(img, -len / 2, -w / 2, len, w);
  };

  // Hangar preview: draw a ship into its own canvas, scaled to fit.
  function drawPreview(canvasEl, ship, t) {
    var c = canvasEl.getContext("2d"), W2 = canvasEl.width, H2 = canvasEl.height;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W2, H2);
    var sc = Math.min((W2 - 20) / ship.visual.length, (H2 - 20) / ship.visual.width);
    c.translate(W2 / 2, H2 / 2); c.scale(sc, sc);
    drawGridShip(c, ship, t || 0, { still: true });
    c.setTransform(1, 0, 0, 1, 0, 0);
    return sc;
  }

  var viewer = null;   // the player's ship: what the display can see is judged from here
  function drawShip(ship, alpha, t) {
    if (ship.flags.destroyed) return;   // the hull has broken into fragments (see drawFragments)
    var vis = BS.Ships.visibility(ship, viewer);
    if (vis <= 0) return;
    var x = U.lerp(ship.prevPos.x, ship.pos.x, alpha), y = U.lerp(ship.prevPos.y, ship.pos.y, alpha);
    var h = U.lerpAngle(ship.prevHeading, ship.heading, alpha);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(h); ctx.scale(ship.visual.scale || 1, ship.visual.scale || 1);
    if (vis < 1) {
      // cloak shimmer: the hull shows as a wavering ghost
      ctx.globalAlpha = vis * (0.7 + 0.3 * Math.sin(t * 7 + ship.id));
      ctx.translate(Math.sin(t * 11) * 1.5, Math.cos(t * 9) * 1.5);
    }
    var drawer = ship.visual.kind === "sprite" ? drawers.sprite : drawers.grid;
    drawer(ship, t);
    if (vis < 1) {
      ctx.globalAlpha = Math.min(1, vis * 1.5); ctx.strokeStyle = "rgba(150,170,255,0.6)"; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.ellipse(0, 0, ship.visual.length * 0.55, Math.max(ship.visual.width * 0.55, ship.visual.length * 0.35), 0, 0, U.TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // Fragments: block groups that broke off a ship, drawn with the same plating colours, scorching as they fade.
  function drawFragments(t) {
    var fs = BS.Effects.fragments, V = BS.Data.visuals.fragments, dark = [18, 20, 30], burnt = [40, 34, 34];
    for (var i = 0; i < fs.length; i++) {
      var f = fs[i], cp = f.cellPx, half = cp / 2, life = f.life / f.maxLife;
      var alpha = life < V.fadeFrom ? life / V.fadeFrom : 1, scorch = 1 - life;
      var tint = hexToRgb(f.tint || "#c6ccda");
      ctx.save();
      ctx.translate(f.x, f.y); ctx.rotate(f.heading + f.rot); ctx.globalAlpha = alpha;
      for (var k = 0; k < f.cells.length; k++) {
        var c = f.cells[k], col = mix(mix(hexToRgb(c.color), tint, c.armor ? 0.35 : 0.15), burnt, scorch * 0.6);
        ctx.fillStyle = "rgb(" + col.join(",") + ")";
        ctx.fillRect(c.dx - half - 0.25, c.dy - half - 0.25, cp + 0.5, cp + 0.5);
      }
      ctx.strokeStyle = "rgba(" + dark.join(",") + ",0.9)"; ctx.lineWidth = 0.8;
      for (k = 0; k < f.cells.length; k++) { c = f.cells[k]; ctx.strokeRect(c.dx - half, c.dy - half, cp, cp); }
      // dying engine glow on nacelle pieces
      if (f.nacelleColor) {
        ctx.globalCompositeOperation = "lighter";
        for (k = 0; k < f.cells.length; k++) {
          c = f.cells[k];
          if (c.type !== "engine") continue;
          var g = ctx.createRadialGradient(c.dx, c.dy, 0, c.dx, c.dy, cp * 1.3);
          g.addColorStop(0, "rgba(" + f.nacelleColor + "," + (0.5 * life * (0.7 + 0.3 * Math.sin(t * 9 + k))).toFixed(2) + ")"); g.addColorStop(1, "rgba(" + f.nacelleColor + ",0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.dx, c.dy, cp * 1.3, 0, U.TAU); ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // ------------------------------------------------------------- shields
  function shieldColor(frac) {
    var C = BS.Data.visuals.shieldColors;
    var a, b, k;
    if (frac > 0.6) { a = C.mid; b = C.strong; k = (frac - 0.6) / 0.4; }
    else if (frac > 0.3) { a = C.low; b = C.mid; k = (frac - 0.3) / 0.3; }
    else { a = C.critical; b = C.low; k = frac / 0.3; }
    return [Math.round(U.lerp(a[0], b[0], k)), Math.round(U.lerp(a[1], b[1], k)), Math.round(U.lerp(a[2], b[2], k))];
  }

  // Shield bubbles: one circle of grid.shieldRadius cells per alive emitter. The outline is the union of the
  // circles (arcs that fall inside a neighbour's circle are dropped); cached per grid revision.
  function freeArcs(occl) {
    var TAU = Math.PI * 2, iv = [];
    occl.forEach(function (p) {
      var len = p[1] - p[0];
      if (len >= TAU) { iv.push([0, TAU]); return; }
      var a0 = ((p[0] % TAU) + TAU) % TAU, a1 = a0 + len;
      if (a1 > TAU) { iv.push([a0, TAU]); iv.push([0, a1 - TAU]); } else iv.push([a0, a1]);
    });
    iv.sort(function (a, b) { return a[0] - b[0]; });
    var free = [], cur = 0;
    iv.forEach(function (p) { if (p[0] > cur + 1e-6) free.push([cur, p[0]]); cur = Math.max(cur, p[1]); });
    if (cur < TAU - 1e-6) free.push([cur, TAU]);
    return free;
  }
  function shieldArcs(ship) {
    var g = ship.grid, c = ship._shieldArcs;
    if (c && c.rev === g.rev) return c.list;
    var R = BS.Data.grid.shieldRadius * g.cellPx, em = g.blocks.filter(function (b) { return b.alive && b.type === "shield"; });
    var list = em.map(function (e, i) {
      var occl = [];
      for (var j = 0; j < em.length; j++) {
        if (j === i) continue;
        var o = em[j], dx = o.lx - e.lx, dy = o.ly - e.ly, d = Math.sqrt(dx * dx + dy * dy);
        if (d >= 2 * R - 0.01) continue;
        if (d < 0.01) { if (j < i) occl.push([0, Math.PI * 2]); continue; }
        var a = Math.atan2(dy, dx), half = Math.acos(d / (2 * R));
        occl.push([a - half, a + half]);
      }
      return { b: e, arcs: freeArcs(occl), facing: BS.Grid.blockFacing(e) };
    });
    ship._shieldArcs = { rev: g.rev, list: list };
    return list;
  }
  function traceArcs(c, list, R, filter) {
    c.beginPath();
    list.forEach(function (a) {
      if (filter && !filter(a)) return;
      a.arcs.forEach(function (s) { c.moveTo(a.b.lx + Math.cos(s[0]) * R, a.b.ly + Math.sin(s[0]) * R); c.arc(a.b.lx, a.b.ly, R, s[0], s[1]); });
    });
  }
  // Thin union outline of the bubbles in the ship's local frame (hangar editor).
  // Top-down scan drawing of a ship into a w×h box centred on the context origin, bow up: plates with damage tint, the
  // shield bubbles and bare hull in red. Returns the scale used so callers can add overlays in local block coordinates.
  function drawTopDown(c, ship, w, h) {
    var g = ship.grid, cp = g.cellPx, k = Math.min(w / (g.h * cp), h / (g.w * cp)) * 0.88, half = cp / 2;
    c.save(); c.scale(k, k); c.rotate(-Math.PI / 2);
    drawGridShip(c, ship, 0.5, { still: true });
    drawShieldCover(c, ship, "rgba(110,180,255,0.7)");
    c.fillStyle = "rgba(255,70,60,0.45)";
    g.blocks.forEach(function (b) { if (b.alive && !b.structural && !b.covered) c.fillRect(b.lx - half, b.ly - half, cp, cp); });
    c.restore();
    return k;
  }
  function drawShieldCover(c, ship, color) {
    var list = shieldArcs(ship), R = BS.Data.grid.shieldRadius * ship.grid.cellPx;
    c.strokeStyle = color || "rgba(110,180,255,0.6)"; c.lineWidth = 0.8;
    traceArcs(c, list, R); c.stroke();
  }

  function drawShields(ship, alpha, t) {
    if (ship.flags.destroyed || !BS.Ships.shieldsUp(ship)) return;   // cloaked or surging: pools kept, nothing projected
    var list = shieldArcs(ship);
    if (!list.length) return;
    var x = U.lerp(ship.prevPos.x, ship.pos.x, alpha), y = U.lerp(ship.prevPos.y, ship.pos.y, alpha);
    var h = U.lerpAngle(ship.prevHeading, ship.heading, alpha);
    var R = BS.Data.grid.shieldRadius * ship.grid.cellPx;
    var recentHits = BS.Effects.ripples.filter(function (r) { return r.ship === ship; });
    ctx.save(); ctx.translate(x, y); ctx.rotate(h);
    ctx.globalCompositeOperation = "lighter";
    // soft fill of the union: one path, so overlaps are filled once
    ctx.beginPath();
    list.forEach(function (a) { if (BS.Ships.shieldFrac(ship, a.facing) > 0.001) { ctx.moveTo(a.b.lx + R, a.b.ly); ctx.arc(a.b.lx, a.b.ly, R, 0, Math.PI * 2); } });
    ctx.fillStyle = "rgba(90,170,255,0.045)"; ctx.fill();
    // outline per emitter, coloured by the strength of the facing it feeds
    for (var i = 0; i < list.length; i++) {
      var a = list[i], frac = BS.Ships.shieldFrac(ship, a.facing);
      if (frac <= 0.001) continue;
      var col = shieldColor(frac), flash = 0;
      for (var r = 0; r < recentHits.length; r++) { var rh = recentHits[r]; if (rh.emitter === a.b || (!rh.emitter && rh.facing === a.facing)) flash = Math.max(flash, rh.life / rh.maxLife); }
      var al = 0.12 + 0.25 * frac + flash * 0.5;
      ctx.lineWidth = 1.5 + frac * 2 + flash * 3;
      ctx.strokeStyle = "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + al.toFixed(3) + ")";
      traceArcs(ctx, [a], R); ctx.stroke();
    }
    // ripples: an arc on the hit emitter's bubble, centred on the attack direction, growing and fading
    for (var k = 0; k < recentHits.length; k++) {
      var rp = recentHits[k], life = rp.life / rp.maxLife, grow = 1 - life, rel = rp.angle - h;
      var centres = rp.emitter && rp.emitter.alive ? [rp.emitter] : list.filter(function (q) { return q.facing === rp.facing; }).map(function (q) { return q.b; });
      var colr = shieldColor(BS.Ships.shieldFrac(ship, rp.facing)), span = 0.25 + grow * 0.9 * rp.strength;
      for (var m = 0; m < centres.length; m++) {
        var e = centres[m];
        ctx.lineWidth = 2.5 + grow * 4; ctx.strokeStyle = "rgba(" + colr[0] + "," + colr[1] + "," + colr[2] + "," + (life * 0.9).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(e.lx, e.ly, R * (1 + grow * 0.12), rel - span, rel + span); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255," + (life * 0.6).toFixed(3) + ")"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(e.lx, e.ly, R * (1 + grow * 0.05), rel - span * 0.5, rel + span * 0.5); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------- weapons
  function drawBeams(alpha, t) {
    var beams = BS.Weapons.beams;
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
    for (var i = 0; i < beams.length; i++) {
      var b = beams[i];
      var e = BS.Weapons.beamEndpoints(b, alpha);
      var life = b.life / b.maxLife;
      if (b.def.bolt) {   // a disruptor bolt: a short bright segment travelling from the muzzle to the impact
        var k1 = Math.min(1, 1 - life), k0 = Math.max(0, k1 - 0.35);
        e = { x1: e.x1 + (e.x2 - e.x1) * k0, y1: e.y1 + (e.y2 - e.y1) * k0, x2: e.x1 + (e.x2 - e.x1) * k1, y2: e.y1 + (e.y2 - e.y1) * k1 };
      }
      var flicker = 0.75 + 0.25 * Math.sin(t * 60 + i * 2) * Math.random();
      var fade = Math.min(1, life * 2.2) * flicker;
      var rgb = BS.Effects.hexToRgb(b.def.color);
      ctx.strokeStyle = "rgba(" + rgb.join(",") + "," + (0.25 * fade).toFixed(3) + ")"; ctx.lineWidth = 9 * fade;
      ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
      ctx.strokeStyle = "rgba(" + rgb.join(",") + "," + (0.9 * fade).toFixed(3) + ")"; ctx.lineWidth = 3.2 * fade;
      ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
      ctx.strokeStyle = b.def.coreColor; ctx.globalAlpha = fade; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke(); ctx.globalAlpha = 1;
      // impact bloom
      var g = ctx.createRadialGradient(e.x2, e.y2, 0, e.x2, e.y2, 12);
      g.addColorStop(0, "rgba(255,255,255," + (0.8 * fade) + ")"); g.addColorStop(1, "rgba(" + rgb.join(",") + ",0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x2, e.y2, 12, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawTorpedoes(alpha, t) {
    var torps = BS.Weapons.torpedoes;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < torps.length; i++) {
      var tp = torps[i];
      var x = U.lerp(tp.prevX, tp.x, alpha), y = U.lerp(tp.prevY, tp.y, alpha);
      var rgb = BS.Effects.hexToRgb(tp.def.color);
      var pulse = 0.85 + 0.15 * Math.sin(t * 25 + i);
      var g = ctx.createRadialGradient(x, y, 0, x, y, 16 * pulse);
      g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(0.25, "rgba(" + rgb.join(",") + ",0.8)"); g.addColorStop(1, "rgba(" + rgb.join(",") + ",0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16 * pulse, 0, U.TAU); ctx.fill();
      ctx.fillStyle = tp.def.coreColor; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
  }

  // Decoys: a flare that flickers and leaves a short glowing trail, fading as it burns out.
  function drawDecoys(alpha, t) {
    var ds = BS.Weapons.decoys;
    if (!ds.length) return;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < ds.length; i++) {
      var d = ds[i], x = U.lerp(d.prevX, d.x, alpha), y = U.lerp(d.prevY, d.y, alpha);
      var k = Math.max(0, d.life / d.maxLife), flick = 0.75 + 0.25 * Math.sin(t * 40 + i * 2.1), R = (10 + 10 * k) * flick;
      var g = ctx.createRadialGradient(x, y, 0, x, y, R * 1.8);
      g.addColorStop(0, "rgba(255,255,255," + (0.95 * k).toFixed(3) + ")"); g.addColorStop(0.3, "rgba(255,215,130," + (0.7 * k).toFixed(3) + ")"); g.addColorStop(1, "rgba(255,160,60,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 1.8, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = "rgba(255,200,120," + (0.5 * k).toFixed(3) + ")"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(d.heading) * 22, y - Math.sin(d.heading) * 22); ctx.stroke();
      ctx.fillStyle = "#fff8e0"; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
  }
  // Energy links (neutraliser): a crackling bolt between two ships that fades out.
  function drawBolts(t) {
    var bs = BS.Effects.bolts;
    if (!bs.length) return;
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i], k = Math.max(0, b.life / b.maxLife), c = b.color;
      var dx = b.x2 - b.x1, dy = b.y2 - b.y1, len = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / len, ny = dx / len, segs = 9;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1);
      for (var s2 = 1; s2 < segs; s2++) { var f = s2 / segs, off = Math.sin(t * 60 + s2 * 1.7 + i) * 9 * k; ctx.lineTo(b.x1 + dx * f + nx * off, b.y1 + dy * f + ny * off); }
      ctx.lineTo(b.x2, b.y2);
      ctx.strokeStyle = "rgba(" + c.join(",") + "," + (0.35 * k).toFixed(3) + ")"; ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = "rgba(255,230,250," + (0.9 * k).toFixed(3) + ")"; ctx.lineWidth = 1.8; ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ particles
  function drawParticles() {
    var ps = BS.Effects.particles;
    ctx.save();
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i], life = p.life / p.maxLife, c = p.color;
      if (p.type === "smoke") {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (life * 0.35).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, U.TAU); ctx.fill();
      } else if (p.type === "debris") {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + Math.min(1, life * 2).toFixed(3) + ")";
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore();
      } else if (p.type === "chunk") {
        ctx.globalCompositeOperation = "source-over";
        var ca = Math.min(1, life * 2.5), s2 = p.size;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
        ctx.fillStyle = "rgba(" + Math.round(c[0] * (0.5 + 0.5 * life)) + "," + Math.round(c[1] * (0.5 + 0.5 * life)) + "," + Math.round(c[2] * (0.5 + 0.5 * life)) + "," + ca.toFixed(3) + ")";
        ctx.fillRect(-s2 / 2, -s2 / 2, s2, s2);
        ctx.strokeStyle = "rgba(18,20,30," + ca.toFixed(3) + ")"; ctx.lineWidth = 0.6; ctx.strokeRect(-s2 / 2, -s2 / 2, s2, s2);
        ctx.restore();
      } else {
        ctx.globalCompositeOperation = "lighter";
        var a = p.type === "glow" ? life * 0.7 : Math.min(1, life * 1.5);
        ctx.fillStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a.toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.type === "spark" ? life : 1), 0, U.TAU); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "lighter";
    var fl = BS.Effects.flashes;
    for (var k = 0; k < fl.length; k++) {
      var f = fl[k], lf = f.life / f.maxLife, r = f.radius * (1.3 - lf * 0.3);
      var g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, "rgba(255,255,255," + (lf * 0.9).toFixed(3) + ")");
      g.addColorStop(0.4, "rgba(" + f.color.join(",") + "," + (lf * 0.6).toFixed(3) + ")");
      g.addColorStop(1, "rgba(" + f.color.join(",") + ",0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, U.TAU); ctx.fill();
    }
    var rings = BS.Effects.rings;
    for (var q = 0; q < rings.length; q++) {
      var rg = rings[q], lr = rg.life / rg.maxLife, rr = rg.radius * (1 - lr);
      ctx.strokeStyle = "rgba(255,230,200," + (lr * 0.8).toFixed(3) + ")"; ctx.lineWidth = 2 + (1 - lr) * 6;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rr, 0, U.TAU); ctx.stroke();
      ctx.strokeStyle = "rgba(255,140,80," + (lr * 0.35).toFixed(3) + ")"; ctx.lineWidth = 12 * (1 - lr) + 2;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rr * 0.9, 0, U.TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------- targeting overlay
  function drawTargeting(state, alpha, t) {
    var p = state.player, e = state.enemy;
    if (!p || !e || e.flags.destroyed || BS.Ships.visibility(e, p) < 1) return;
    var hover = state.hover && state.hover.ship === e ? state.hover : null, aim = p.aimType;
    var x = U.lerp(e.prevPos.x, e.pos.x, alpha), y = U.lerp(e.prevPos.y, e.pos.y, alpha);
    var h = U.lerpAngle(e.prevHeading, e.heading, alpha), g = e.grid, cp = g.cellPx, half = cp / 2;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(h);
    if (aim) {
      ctx.strokeStyle = "rgba(255,120,80," + (0.6 + 0.3 * Math.sin(t * 5)).toFixed(2) + ")"; ctx.lineWidth = 1 / zoom;
      for (var i = 0; i < g.blocks.length; i++) { var b = g.blocks[i]; if (b.alive && (b.type === aim || (aim === "exposed" && !b.covered))) ctx.strokeRect(b.lx - half, b.ly - half, cp, cp); }
    }
    if (hover && hover.block && hover.block.alive) {
      var hb = hover.block;
      ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 1.5 / zoom;
      ctx.strokeRect(hb.lx - half - 1 / zoom, hb.ly - half - 1 / zoom, cp + 2 / zoom, cp + 2 / zoom);
    }
    ctx.restore();
    if (hover && hover.block) {
      var blk = hover.block, bw = BS.Grid.blockWorld(e, blk);
      var facingPct = blk.coverBy ? BS.Ships.shieldFrac(e, BS.Grid.blockFacing(blk.coverBy)) : 0;
      var name = blk.structural ? "STRUCTURE" : blk.def.name.toUpperCase();
      var label = name + " " + Math.round(blk.hp) + "/" + blk.maxHp + (!blk.covered ? " · NO SHIELD COVER" : facingPct > 0.05 ? " · SHIELDED " + Math.round(facingPct * 100) + "%" : " · SHIELD DOWN");
      var hint = p.lock.target !== e ? "click: lock target · right-click: engage" : blk.structural ? "" : (aim === blk.type ? "click: stop aiming" : "click: aim at " + blk.def.name.toLowerCase() + "s");
      var z = 1 / zoom, lx = bw.x + 14 * z, ly = bw.y - 14 * z;
      ctx.save();
      ctx.font = "bold " + (12 * z).toFixed(1) + "px Antonio, 'Arial Narrow', sans-serif"; ctx.textBaseline = "middle";
      var w = Math.max(ctx.measureText(label).width, ctx.measureText(hint).width) + 12 * z;
      ctx.fillStyle = "rgba(0,0,0,0.7)"; roundRect(lx - 4 * z, ly - 10 * z, w, (hint ? 32 : 20) * z, 4 * z); ctx.fill();
      ctx.fillStyle = "#ffd9b3"; ctx.fillText(label, lx + 2 * z, ly);
      if (hint) { ctx.fillStyle = "#9a9ab5"; ctx.font = (11 * z).toFixed(1) + "px Antonio, 'Arial Narrow', sans-serif"; ctx.fillText(hint, lx + 2 * z, ly + 13 * z); }
      ctx.restore();
    }
  }

  // ----------------------------------------------------------- main draw
  function draw(state, alpha, dt) {
    if (!ctx) return;
    time += dt;
    var player = state.player, ships = state.ships;
    viewer = player;
    updateCamera(state, alpha, dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSpace();
    var sh = BS.Effects.shake.intensity;
    var sx = sh ? U.rand(-sh, sh) : 0, sy = sh ? U.rand(-sh, sh) : 0;
    zoom = state.zoom || 1;
    ctx.save();
    ctx.translate(Math.round(W / 2 + sx), Math.round(H / 2 + sy));
    ctx.scale(zoom, zoom);
    ctx.translate(-camera.x, -camera.y);
    if (player) { ctx.save(); ctx.translate(U.lerp(player.prevPos.x, player.pos.x, alpha), U.lerp(player.prevPos.y, player.pos.y, alpha)); drawTacticalOverlay(player); ctx.restore(); }
    drawFragments(time);
    drawParticles();
    for (var i = 0; i < ships.length; i++) drawShip(ships[i], alpha, time);
    for (var j = 0; j < ships.length; j++) drawShields(ships[j], alpha, time);
    drawBeams(alpha, time);
    drawBolts(time);
    drawTorpedoes(alpha, time);
    drawDecoys(alpha, time);
    if (player) drawNavigation(state, alpha, time);
    if (state.enemy) drawTargeting(state, alpha, time);
    ctx.restore();
    // subtle vignette
    var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  return { init: init, draw: draw, resize: resize, resetCamera: resetCamera, drawers: drawers, camera: camera, shieldColor: shieldColor, drawPreview: drawPreview, drawGridShip: drawGridShip, drawShieldCover: drawShieldCover, drawTopDown: drawTopDown, drawBlockGlyph: drawBlockGlyph, blockIcon: blockIcon,
    screenToWorld: function (x, y) { return { x: (x - W / 2) / zoom + camera.x, y: (y - H / 2) / zoom + camera.y }; },
    worldToScreen: function (x, y) { return { x: (x - camera.x) * zoom + W / 2, y: (y - camera.y) * zoom + H / 2 }; } };
})();
