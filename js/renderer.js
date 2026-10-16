// js/renderer.js — canvas drawing: space, ships, weapons, shields, effects.
// Ship drawing is dispatched by ship.visual.kind ("vector" | "sprite") and
// ship.visual.drawer, so sprites can replace vector art without touching logic.
window.BS = window.BS || {};

BS.Renderer = (function () {
  var U = BS.Util;
  var canvas, ctx, W = 0, H = 0, dpr = 1;
  var camera = { x: 0, y: 0, initialised: false };
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
  function updateCamera(player, alpha, dt) {
    if (!player) return;
    var px = U.lerp(player.prevPos.x, player.pos.x, alpha), py = U.lerp(player.prevPos.y, player.pos.y, alpha);
    if (!camera.initialised) { camera.x = px; camera.y = py; camera.initialised = true; }
    var k = 1 - Math.pow(1 - BS.Data.balance.cameraLerp, dt * 60);
    camera.x += (px - camera.x) * k; camera.y += (py - camera.y) * k;
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
    if (!e || e.flags.destroyed) { ctx.restore(); return; }
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

  function nacelleGlow(x, y, w, h, color, pulse) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h));
    g.addColorStop(0, "rgba(" + color + "," + (0.55 * pulse) + ")");
    g.addColorStop(1, "rgba(" + color + ",0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, Math.max(w, h), Math.max(w, h), 0, 0, U.TAU); ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  // Federation Constitution-class, drawn pointing +x, length ≈ 112.
  drawers.federation_constitution = function (ship, t) {
    var pulse = 0.85 + 0.15 * Math.sin(t * 4);
    var dmg = 1 - ship.hull / ship.hullMax;
    // nacelle glow halos (additive)
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    nacelleGlow(-24, -30, 26, 8, "90,160,255", pulse * 0.8);
    nacelleGlow(-24, 30, 26, 8, "90,160,255", pulse * 0.8);
    nacelleGlow(-1, -30, 6, 6, "255,120,70", pulse);
    nacelleGlow(-1, 30, 6, 6, "255,120,70", pulse);
    ctx.restore();

    // pylons
    ctx.strokeStyle = "#9ea4b8"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-22, -6); ctx.lineTo(-30, -26); ctx.moveTo(-22, 6); ctx.lineTo(-30, 26); ctx.stroke();
    // nacelles
    [-30, 30].forEach(function (y) {
      var g = ctx.createLinearGradient(0, y - 5, 0, y + 5);
      g.addColorStop(0, "#d7dbe6"); g.addColorStop(0.5, "#aab0c2"); g.addColorStop(1, "#6e7486");
      ctx.fillStyle = g; roundRect(-50, y - 5, 52, 10, 5); ctx.fill();
      // warp grille
      ctx.fillStyle = "rgba(100,170,255," + (0.65 + 0.3 * pulse) + ")"; roundRect(-44, y - 2.2, 36, 4.4, 2); ctx.fill();
      // bussard collector
      var bg = ctx.createRadialGradient(0, y, 0, 0, y, 5);
      bg.addColorStop(0, "#ffd8a8"); bg.addColorStop(0.5, "#ff7a3c"); bg.addColorStop(1, "#8a2a10");
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, y, 4.6, 0, U.TAU); ctx.fill();
    });
    // secondary hull
    var sh = ctx.createLinearGradient(0, -10, 0, 10);
    sh.addColorStop(0, "#e2e5ee"); sh.addColorStop(0.5, "#b4bacb"); sh.addColorStop(1, "#6b7184");
    ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(-16, 0, 30, 9, 0, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = "rgba(40,45,60,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(8, 0); ctx.stroke();
    // deflector dish
    var dg = ctx.createRadialGradient(13, 0, 0, 13, 0, 5);
    dg.addColorStop(0, "#d9f0ff"); dg.addColorStop(0.6, "#4fa3ff"); dg.addColorStop(1, "#1a3d80");
    ctx.fillStyle = dg; ctx.beginPath(); ctx.ellipse(13, 0, 3.5, 5.5, 0, 0, U.TAU); ctx.fill();
    // neck
    ctx.fillStyle = "#b0b6c7"; ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(14, -4); ctx.lineTo(18, 4); ctx.lineTo(-2, 5); ctx.closePath(); ctx.fill();
    // saucer
    var sg = ctx.createRadialGradient(24, -8, 2, 28, 0, 32);
    sg.addColorStop(0, "#f4f6fb"); sg.addColorStop(0.55, "#c6ccda"); sg.addColorStop(1, "#6c7387");
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(28, 0, 29, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = "rgba(30,35,50,0.35)"; ctx.lineWidth = 1;
    [22, 15, 8].forEach(function (r) { ctx.beginPath(); ctx.arc(28, 0, r, 0, U.TAU); ctx.stroke(); });
    ctx.strokeStyle = "rgba(30,35,50,0.22)";
    for (var i = 0; i < 12; i++) { var a = i * U.TAU / 12; ctx.beginPath(); ctx.moveTo(28 + Math.cos(a) * 10, Math.sin(a) * 10); ctx.lineTo(28 + Math.cos(a) * 28, Math.sin(a) * 28); ctx.stroke(); }
    // windows on saucer rim
    ctx.fillStyle = "rgba(255,240,200,0.8)";
    for (var k = 0; k < 16; k++) { var b = k * U.TAU / 16 + 0.2; ctx.fillRect(28 + Math.cos(b) * 25 - 0.7, Math.sin(b) * 25 - 0.7, 1.4, 1.4); }
    // bridge dome
    var bd = ctx.createRadialGradient(27, -2, 0, 28, 0, 6);
    bd.addColorStop(0, "#ffffff"); bd.addColorStop(1, "#8e95a8");
    ctx.fillStyle = bd; ctx.beginPath(); ctx.arc(28, 0, 5.5, 0, U.TAU); ctx.fill();
    // registry stripe
    ctx.strokeStyle = "rgba(200,40,40,0.55)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(28, 0, 19, 2.6, 3.7); ctx.stroke();
    // running lights: red port (−y), green starboard (+y), white strobe
    var blink = Math.sin(t * 6) > 0.6, strobe = (t % 1.1) < 0.08;
    if (blink) { ctx.fillStyle = "#ff3030"; ctx.beginPath(); ctx.arc(28, -28, 1.6, 0, U.TAU); ctx.fill(); ctx.fillStyle = "#30ff60"; ctx.beginPath(); ctx.arc(28, 28, 1.6, 0, U.TAU); ctx.fill(); }
    if (strobe) { ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(-50, -30, 1.8, 0, U.TAU); ctx.arc(-50, 30, 1.8, 0, U.TAU); ctx.fill(); }
    // scorch marks when damaged
    if (dmg > 0.3) { ctx.fillStyle = "rgba(20,15,15," + (dmg * 0.6) + ")"; ctx.beginPath(); ctx.arc(20, -10, 7, 0, U.TAU); ctx.arc(-20, 4, 6, 0, U.TAU); ctx.fill(); }
  };

  // Klingon Bird-of-Prey, drawn pointing +x, wingspan ≈ 96.
  drawers.klingon_bird_of_prey = function (ship, t) {
    var pulse = 0.8 + 0.2 * Math.sin(t * 3 + 1);
    var dmg = 1 - ship.hull / ship.hullMax;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    nacelleGlow(-28, -46, 7, 7, "110,255,120", pulse);
    nacelleGlow(-28, 46, 7, 7, "110,255,120", pulse);
    nacelleGlow(-34, 0, 12, 6, "255,120,60", pulse * 0.8);
    ctx.restore();
    // wings
    [-1, 1].forEach(function (s) {
      var g = ctx.createLinearGradient(0, 0, -30, s * 46);
      g.addColorStop(0, "#5d7a5c"); g.addColorStop(0.6, "#3f5a40"); g.addColorStop(1, "#263a28");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(8, s * 8); ctx.lineTo(-14, s * 18); ctx.lineTo(-30, s * 48); ctx.lineTo(-36, s * 46); ctx.lineTo(-28, s * 20); ctx.lineTo(-18, s * 8); ctx.closePath(); ctx.fill();
      // feather lines
      ctx.strokeStyle = "rgba(10,20,10,0.5)"; ctx.lineWidth = 1;
      for (var i = 1; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(-6 - i * 3, s * (10 + i * 2)); ctx.lineTo(-28 - i * 1.5, s * (20 + i * 6)); ctx.stroke(); }
      // disruptor pod at wing tip
      ctx.fillStyle = "#7f8f7c"; roundRect(-36, s * 46 - 3, 12, 6, 3); ctx.fill();
      ctx.fillStyle = "rgba(120,255,130," + (0.6 + 0.4 * pulse) + ")"; ctx.beginPath(); ctx.arc(-25, s * 46, 2.2, 0, U.TAU); ctx.fill();
    });
    // body
    var bg = ctx.createLinearGradient(0, -12, 0, 12);
    bg.addColorStop(0, "#8ea08a"); bg.addColorStop(0.5, "#596d58"); bg.addColorStop(1, "#2c3c2d");
    ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(-8, 0, 22, 12, 0, 0, U.TAU); ctx.fill();
    // engine
    var eg = ctx.createRadialGradient(-30, 0, 0, -30, 0, 7);
    eg.addColorStop(0, "#ffd9a0"); eg.addColorStop(0.5, "#ff7030"); eg.addColorStop(1, "rgba(120,30,10,0)");
    ctx.fillStyle = eg; ctx.beginPath(); ctx.ellipse(-30, 0, 7, 5, 0, 0, U.TAU); ctx.fill();
    // neck
    var ng = ctx.createLinearGradient(0, -5, 0, 5);
    ng.addColorStop(0, "#9aa996"); ng.addColorStop(1, "#44533f");
    ctx.fillStyle = ng; roundRect(8, -4.5, 30, 9, 3); ctx.fill();
    ctx.strokeStyle = "rgba(10,20,10,0.5)"; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(36, 0); ctx.stroke();
    // head
    var hg = ctx.createRadialGradient(44, -3, 1, 44, 0, 12);
    hg.addColorStop(0, "#b7c3b0"); hg.addColorStop(0.6, "#6e8068"); hg.addColorStop(1, "#33402f");
    ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(42, 0, 12, 8, 0, 0, U.TAU); ctx.fill();
    // bridge windows + torpedo tube
    ctx.fillStyle = "rgba(255,80,60," + (0.5 + 0.5 * pulse) + ")"; ctx.beginPath(); ctx.arc(52, 0, 2, 0, U.TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,230,180,0.8)"; ctx.fillRect(40, -4, 1.2, 1.5); ctx.fillRect(40, 2.5, 1.2, 1.5); ctx.fillRect(44, -5, 1.2, 1.5); ctx.fillRect(44, 3.5, 1.2, 1.5);
    // trefoil emblem
    ctx.strokeStyle = "rgba(220,40,40,0.6)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(-4, 0); ctx.lineTo(-10, 5); ctx.stroke();
    var blink = Math.sin(t * 5 + 2) > 0.7;
    if (blink) { ctx.fillStyle = "#ff3030"; ctx.beginPath(); ctx.arc(-33, -47, 1.4, 0, U.TAU); ctx.fill(); ctx.fillStyle = "#40ff80"; ctx.beginPath(); ctx.arc(-33, 47, 1.4, 0, U.TAU); ctx.fill(); }
    if (dmg > 0.3) { ctx.fillStyle = "rgba(10,10,10," + (dmg * 0.6) + ")"; ctx.beginPath(); ctx.arc(-10, -6, 6, 0, U.TAU); ctx.arc(20, 2, 4, 0, U.TAU); ctx.fill(); }
  };

  // Image sprite drawer: assets/ships/<file>, drawn pointing +x, centred.
  drawers.sprite = function (ship, t) {
    var src = ship.visual.sprite;
    var img = spriteCache[src];
    if (!img) { img = new Image(); img.src = src; spriteCache[src] = img; }
    if (!img.complete || !img.naturalWidth) { drawers.federation_constitution(ship, t); return; }
    var len = ship.visual.length, w = len * img.naturalHeight / img.naturalWidth;
    ctx.drawImage(img, -len / 2, -w / 2, len, w);
  };

  function drawShip(ship, alpha, t) {
    var x = U.lerp(ship.prevPos.x, ship.pos.x, alpha), y = U.lerp(ship.prevPos.y, ship.pos.y, alpha);
    var h = U.lerpAngle(ship.prevHeading, ship.heading, alpha);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(h); ctx.scale(ship.visual.scale || 1, ship.visual.scale || 1);
    if (ship.flags.destroyed) {
      var f = U.clamp(1 - ship.destroyedTimer / 1.4, 0, 1);
      ctx.globalAlpha = f;
      if (f <= 0) { ctx.restore(); return; }
    }
    var drawer = ship.visual.kind === "sprite" ? drawers.sprite : (drawers[ship.visual.drawer] || drawers.federation_constitution);
    drawer(ship, t);
    ctx.restore();
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

  function drawShields(ship, alpha, t) {
    if (ship.flags.destroyed) return;
    var x = U.lerp(ship.prevPos.x, ship.pos.x, alpha), y = U.lerp(ship.prevPos.y, ship.pos.y, alpha);
    var h = U.lerpAngle(ship.prevHeading, ship.heading, alpha);
    var rx = ship.visual.length * 0.62, ry = Math.max(ship.visual.width * 0.62, ship.visual.length * 0.42);
    var recentHits = BS.Effects.ripples.filter(function (r) { return r.ship === ship; });
    ctx.save(); ctx.translate(x, y); ctx.rotate(h);
    ctx.globalCompositeOperation = "lighter";
    // four facing arcs, each 90° centred on bow / starboard / stern / port
    var facings = [["fore", 0], ["starboard", Math.PI / 2], ["aft", Math.PI], ["port", -Math.PI / 2]];
    for (var i = 0; i < facings.length; i++) {
      var f = facings[i][0], c = facings[i][1];
      var frac = ship.shields[f] / ship.shieldMax;
      if (frac <= 0.001) continue;
      var col = shieldColor(frac);
      var flashBoost = 0;
      for (var r = 0; r < recentHits.length; r++) if (recentHits[r].facing === f) flashBoost = Math.max(flashBoost, recentHits[r].life / recentHits[r].maxLife);
      var a = 0.10 + 0.22 * frac + flashBoost * 0.5;
      ctx.lineWidth = 2 + frac * 2 + flashBoost * 3;
      ctx.strokeStyle = "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + a.toFixed(3) + ")";
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, c - Math.PI / 4 + 0.03, c + Math.PI / 4 - 0.03); ctx.stroke();
      // soft fill wedge
      ctx.fillStyle = "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + (a * 0.18).toFixed(3) + ")";
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.ellipse(0, 0, rx, ry, 0, c - Math.PI / 4, c + Math.PI / 4); ctx.closePath(); ctx.fill();
    }
    // ripples
    for (var k = 0; k < recentHits.length; k++) {
      var rp = recentHits[k], life = rp.life / rp.maxLife, grow = 1 - life;
      var rel = rp.angle - h;
      var colr = shieldColor(ship.shields[rp.facing] / ship.shieldMax);
      ctx.lineWidth = 2.5 + grow * 4;
      ctx.strokeStyle = "rgba(" + colr[0] + "," + colr[1] + "," + colr[2] + "," + (life * 0.9).toFixed(3) + ")";
      var span = 0.25 + grow * 0.9 * rp.strength;
      ctx.beginPath(); ctx.ellipse(0, 0, rx * (1 + grow * 0.12), ry * (1 + grow * 0.12), 0, rel - span, rel + span); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255," + (life * 0.6).toFixed(3) + ")"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, 0, rx * (1 + grow * 0.05), ry * (1 + grow * 0.05), 0, rel - span * 0.5, rel + span * 0.5); ctx.stroke();
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
  function hullColorRGB(frac) { return frac > 0.6 ? "127,216,160" : frac > 0.3 ? "242,193,78" : "224,70,60"; }
  function drawTargeting(state, alpha, t) {
    var p = state.player, e = state.enemy;
    if (!p || !e || e.flags.destroyed || !e.visual.hardpoints) return;
    var hover = state.hover && state.hover.ship === e ? state.hover : null, target = p.targetSubsystem;
    var x = U.lerp(e.prevPos.x, e.pos.x, alpha), y = U.lerp(e.prevPos.y, e.pos.y, alpha);
    var h = U.lerpAngle(e.prevHeading, e.heading, alpha), sc = e.visual.scale || 1;
    var c = Math.cos(h), si = Math.sin(h);
    ctx.save();
    ctx.font = "bold " + (12 / zoom).toFixed(1) + "px Antonio, 'Arial Narrow', sans-serif"; ctx.textBaseline = "middle";
    Object.keys(e.visual.hardpoints).forEach(function (sys) {
      var showAll = !!hover, isHover = hover && hover.sys === sys, isTarget = target === sys;
      if (!showAll && !isTarget) return;
      var frac = e.subsystems[sys] / 100, col = hullColorRGB(frac);
      e.visual.hardpoints[sys].forEach(function (hp) {
        var wx = x + (hp.x * c - hp.y * si) * sc, wy = y + (hp.x * si + hp.y * c) * sc, r = hp.r * sc;
        if (showAll) {
          ctx.lineWidth = (isHover ? 2 : 1) / zoom;
          ctx.strokeStyle = "rgba(" + col + "," + (isHover ? 1 : 0.55) + ")";
          ctx.beginPath(); ctx.arc(wx, wy, r + (isHover ? 3 : 0), 0, U.TAU); ctx.stroke();
          ctx.fillStyle = "rgba(" + col + "," + (isHover ? 0.25 : 0.08) + ")"; ctx.fill();
        }
        if (isTarget) {
          // pulsing bracket reticle
          var k = r + 5 + Math.sin(t * 5) * 1.5, L = Math.max(4, k * 0.5);
          ctx.strokeStyle = "rgba(255,120,80,0.95)"; ctx.lineWidth = 2 / zoom;
          [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) {
            ctx.beginPath(); ctx.moveTo(wx + q[0] * k, wy + q[1] * (k - L)); ctx.lineTo(wx + q[0] * k, wy + q[1] * k); ctx.lineTo(wx + q[0] * (k - L), wy + q[1] * k); ctx.stroke();
          });
        }
      });
    });
    // label for the hovered hardpoint, or the hull
    if (hover) {
      var facingPct = e.shields[BS.Ships.facingToward(e, p.pos.x, p.pos.y)] / e.shieldMax;
      var label = hover.sys ? BS.Data.subsystems[hover.sys].label.toUpperCase() + " " + Math.round(e.subsystems[hover.sys]) + "%" : "HULL " + Math.round(100 * e.hull / e.hullMax) + "%";
      label += facingPct > 0.05 ? " · SHIELDED " + Math.round(facingPct * 100) + "%" : " · SHIELD DOWN";
      var hint = p.lock.target !== e ? "click: lock target · right-click: orbit" : hover.sys ? (target === hover.sys ? "click: target hull" : "click: target part") : (target ? "click: target hull" : "right-click: orbit");
      var lx = hover.x + 14 / zoom, ly = hover.y - 14 / zoom, z = 1 / zoom;
      var w = Math.max(ctx.measureText(label).width, ctx.measureText(hint).width) + 12 * z;
      ctx.fillStyle = "rgba(0,0,0,0.7)"; roundRect(lx - 4 * z, ly - 10 * z, w, (hint ? 32 : 20) * z, 4 * z); ctx.fill();
      ctx.fillStyle = "#ffd9b3"; ctx.fillText(label, lx + 2 * z, ly);
      if (hint) { ctx.fillStyle = "#9a9ab5"; ctx.font = (11 * z).toFixed(1) + "px Antonio, 'Arial Narrow', sans-serif"; ctx.fillText(hint, lx + 2 * z, ly + 13 * z); }
    }
    ctx.restore();
  }

  // ----------------------------------------------------------- main draw
  function draw(state, alpha, dt) {
    if (!ctx) return;
    time += dt;
    var player = state.player, ships = state.ships;
    updateCamera(player, alpha, dt);
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
    drawParticles();
    for (var i = 0; i < ships.length; i++) drawShip(ships[i], alpha, time);
    for (var j = 0; j < ships.length; j++) drawShields(ships[j], alpha, time);
    drawBeams(alpha, time);
    drawTorpedoes(alpha, time);
    if (player) drawNavigation(state, alpha, time);
    if (state.enemy) drawTargeting(state, alpha, time);
    ctx.restore();
    // subtle vignette
    var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  return { init: init, draw: draw, resize: resize, resetCamera: resetCamera, drawers: drawers, camera: camera, shieldColor: shieldColor,
    screenToWorld: function (x, y) { return { x: (x - W / 2) / zoom + camera.x, y: (y - H / 2) / zoom + camera.y }; },
    worldToScreen: function (x, y) { return { x: (x - camera.x) * zoom + W / 2, y: (y - camera.y) * zoom + H / 2 }; } };
})();
