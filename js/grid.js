// js/grid.js — hull grids: masks, block layouts, derived stats, hit lookup,
// per-block damage and connectivity. Pure logic; no DOM, no canvas.
window.BS = window.BS || {};

BS.Grid = (function () {
  var U = BS.Util;
  var G = function () { return BS.Data.grid; };
  var letterToType = null;

  function typeForLetter(ch) {
    if (!letterToType) { letterToType = {}; Object.keys(BS.Data.blocks).forEach(function (t) { letterToType[BS.Data.blocks[t].letter] = t; }); }
    return letterToType[ch] || null;
  }

  // ---- building ------------------------------------------------------------
  // Returns { w, h, mask: [rows], blocks: [], at: {"x,y": block}, cellPx }
  function build(cls, layoutRows, statMult) {
    statMult = statMult || 1;
    var mask = cls.mask, h = mask.length, w = mask[0].length, cellPx = G().cellPx;
    var grid = { w: w, h: h, mask: mask, blocks: [], at: {}, cellPx: cellPx, dirty: true, bridge: null };
    var layout = layoutRows || cls.layout;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var m = mask[y][x];
        if (m === ".") continue;
        var type = null, structural = false;
        if (m === "p") { type = "structure"; structural = true; }
        else { var ch = layout[y] ? layout[y][x] : "."; type = typeForLetter(ch); }
        if (!type) continue;
        var def = structural ? { hp: G().structureHp, mass: 1, color: "#8a90a0", name: "Structure" } : BS.Data.blocks[type];
        var hp = Math.round(def.hp * statMult);
        var b = { x: x, y: y, type: type, def: def, hp: hp, maxHp: hp, alive: true, structural: structural, nacelle: m === "n",
                  lx: (x + 0.5 - w / 2) * cellPx, ly: (y + 0.5 - h / 2) * cellPx, cycleLeft: 0, id: y * w + x };
        b.outward = Math.atan2(b.ly, b.lx);
        grid.blocks.push(b); grid.at[x + "," + y] = b;
        if (type === "bridge") grid.bridge = b;
      }
    }
    return grid;
  }

  function facingOf(b) {
    var a = Math.abs(b.outward);
    if (a < Math.PI / 4) return "fore";
    if (a > 3 * Math.PI / 4) return "aft";
    return b.outward > 0 ? "starboard" : "port";
  }

  // ---- derived stats ---------------------------------------------------------
  function derive(grid) {
    var g = G(), s = { mass: 0, thrust: 0, cap: g.capBase, shieldMax: { fore: g.shieldBase, aft: g.shieldBase, port: g.shieldBase, starboard: g.shieldBase },
      regen: { fore: g.regenBase, aft: g.regenBase, port: g.regenBase, starboard: g.regenBase }, sensors: g.sensorBase, repair: g.repairBase,
      counts: {}, alive: {}, hullTotal: 0, hullAlive: 0, weapons: [], bridgeAlive: false };
    grid.blocks.forEach(function (b) {
      if (b.structural) return;
      s.counts[b.type] = (s.counts[b.type] || 0) + 1;
      s.hullTotal += b.maxHp;
      if (!b.alive) return;
      s.alive[b.type] = (s.alive[b.type] || 0) + 1;
      s.hullAlive += b.hp;
      s.mass += b.def.mass;
      var f = facingOf(b);
      switch (b.type) {
        case "engine": s.thrust += b.nacelle ? g.nacelleThrustMult : 1; break;
        case "reactor": s.cap += g.capAdd; break;
        case "shield": s.shieldMax[f] += g.shieldAdd; s.regen[f] += g.regenAdd; break;
        case "sensor": s.sensors += g.sensorAdd; break;
        case "quarters": s.repair += g.repairAdd; break;
        case "bridge": s.bridgeAlive = true; break;
        case "phaser": case "torpedo": s.weapons.push(b); break;
      }
    });
    s.speedMult = s.mass > 0 ? U.clamp(s.thrust * g.thrustPerPoint / s.mass, g.speedMultMin, g.speedMultMax) : g.speedMultMin;
    grid.stats = s; grid.dirty = false;
    return s;
  }

  // ---- geometry -----------------------------------------------------------------
  function worldToLocal(ship, wx, wy) {
    var dx = wx - ship.pos.x, dy = wy - ship.pos.y, c = Math.cos(-ship.heading), s = Math.sin(-ship.heading);
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  }
  function localToWorld(ship, lx, ly) {
    var c = Math.cos(ship.heading), s = Math.sin(ship.heading);
    return { x: ship.pos.x + lx * c - ly * s, y: ship.pos.y + lx * s + ly * c };
  }
  function cellOfLocal(grid, lx, ly) {
    return { x: Math.floor(lx / grid.cellPx + grid.w / 2), y: Math.floor(ly / grid.cellPx + grid.h / 2) };
  }
  function blockAtWorld(ship, wx, wy, slackCells) {
    var grid = ship.grid, l = worldToLocal(ship, wx, wy), c = cellOfLocal(grid, l.x, l.y);
    var b = grid.at[c.x + "," + c.y];
    if (b && b.alive) return b;
    var r = slackCells || 0, best = null, bestD = Infinity;
    for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
      var q = grid.at[(c.x + dx) + "," + (c.y + dy)];
      if (!q || !q.alive) continue;
      var d = U.dist(l.x, l.y, q.lx, q.ly);
      if (d < bestD) { bestD = d; best = q; }
    }
    return best;
  }
  function blockWorld(ship, b) { return localToWorld(ship, b.lx, b.ly); }

  // First alive block along the line from a world point toward the ship centre.
  function entryBlock(ship, fromX, fromY) {
    var grid = ship.grid, l = worldToLocal(ship, fromX, fromY);
    var len = Math.sqrt(l.x * l.x + l.y * l.y);
    if (len < 1) return grid.bridge && grid.bridge.alive ? grid.bridge : null;
    var ux = -l.x / len, uy = -l.y / len;
    var R = Math.max(grid.w, grid.h) * grid.cellPx * 0.75;
    var startX = -ux * R, startY = -uy * R;   // start outside the hull on the attacker's side
    var step = grid.cellPx * 0.4, n = Math.ceil((R * 2) / step);
    var last = null;
    for (var i = 0; i <= n; i++) {
      var px = startX + ux * step * i, py = startY + uy * step * i;
      var c = cellOfLocal(grid, px, py), b = grid.at[c.x + "," + c.y];
      if (b && b.alive && b !== last) return b;
      last = b;
    }
    return null;
  }
  // Next alive blocks behind `b` along the same direction (for penetration).
  function blocksBehind(ship, b, fromX, fromY, count) {
    var grid = ship.grid, l = worldToLocal(ship, fromX, fromY);
    var len = Math.sqrt(l.x * l.x + l.y * l.y) || 1, ux = -l.x / len, uy = -l.y / len;
    var out = [], seen = { }; seen[b.id] = true;
    var step = grid.cellPx * 0.4;
    for (var i = 1; i < 60 && out.length < count; i++) {
      var c = cellOfLocal(grid, b.lx + ux * step * i, b.ly + uy * step * i), q = grid.at[c.x + "," + c.y];
      if (q && q.alive && !seen[q.id]) { seen[q.id] = true; out.push(q); }
    }
    return out;
  }
  function nearestOfType(grid, b, type, radius) {
    var best = null, bestD = Infinity;
    for (var dy = -radius; dy <= radius; dy++) for (var dx = -radius; dx <= radius; dx++) {
      var q = grid.at[(b.x + dx) + "," + (b.y + dy)];
      if (!q || !q.alive || q.type !== type) continue;
      var d = Math.abs(dx) + Math.abs(dy);
      if (d < bestD) { bestD = d; best = q; }
    }
    return best;
  }

  // ---- damage --------------------------------------------------------------------
  // Apply `amount` hull damage arriving from a world point. Returns { hits: [{block, dmg}], destroyed: [block], cutOff: [block] }.
  // kind "phaser": penetrates up to grid.penetration blocks along the shot line.
  // kind "torpedo": explodes on the entry block and splashes into its neighbours.
  function hit(ship, amount, fromX, fromY, aimType, kind) {
    var grid = ship.grid, g = G();
    var res = { hits: [], destroyed: [], cutOff: [] };
    var entry = entryBlock(ship, fromX, fromY);
    if (!entry) return res;
    var first = entry;
    if (aimType) { var aimed = nearestOfType(grid, entry, aimType, g.aimRadius); if (aimed) first = aimed; }
    function damage(b, d) {
      if (!b.alive || d <= 0) return 0;
      var taken = Math.min(b.hp, d);
      b.hp -= taken; res.hits.push({ block: b, dmg: taken });
      if (b.hp <= 0) { b.alive = false; res.destroyed.push(b); }
      return taken;
    }
    if (kind === "torpedo") {
      var splash = g.torpedoSplash, left = amount - damage(first, amount * splash.centre);
      var nbs = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(function (d) { return grid.at[(first.x + d[0]) + "," + (first.y + d[1])]; }).filter(function (q) { return q && q.alive; });
      nbs.forEach(function (q) { left -= damage(q, amount * splash.neighbour); });
      if (!first.alive && left > 0) { var deeper = blocksBehind(ship, first, fromX, fromY, 1); if (deeper.length) damage(deeper[0], left); }
    } else {
      var chain = [first].concat(blocksBehind(ship, first, fromX, fromY, g.penetration - 1));
      var rem = amount;
      for (var i = 0; i < chain.length && rem > 0.01; i++) rem -= damage(chain[i], rem);
    }
    if (res.destroyed.length) {
      res.cutOff = pruneDisconnected(grid);
      grid.dirty = true;
    }
    return res;
  }

  // Blocks that no longer connect to the bridge break away.
  function pruneDisconnected(grid) {
    var bridge = grid.bridge;
    if (!bridge || !bridge.alive) return [];
    var seen = {}, stack = [bridge]; seen[bridge.id] = true;
    while (stack.length) {
      var b = stack.pop();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var q = grid.at[(b.x + d[0]) + "," + (b.y + d[1])];
        if (q && q.alive && !seen[q.id]) { seen[q.id] = true; stack.push(q); }
      });
    }
    var lost = [];
    grid.blocks.forEach(function (b) { if (b.alive && !seen[b.id]) { b.alive = false; lost.push(b); } });
    return lost;
  }

  // Damage control: restore hp to damaged, alive blocks. Priority type first.
  function repair(grid, rate, priorityType, dt) {
    var budget = rate * dt, pool = grid.blocks.filter(function (b) { return b.alive && b.hp < b.maxHp; });
    if (!pool.length) return;
    pool.sort(function (a, b) { return (b.type === priorityType) - (a.type === priorityType) || (a.hp / a.maxHp) - (b.hp / b.maxHp); });
    for (var i = 0; i < pool.length && budget > 0; i++) {
      var b = pool[i], d = Math.min(b.maxHp - b.hp, budget);
      b.hp += d; budget -= d;
    }
  }

  // ---- layout helpers (hangar) -------------------------------------------------
  function layoutFromGrid(grid) {
    var rows = [];
    for (var y = 0; y < grid.h; y++) {
      var r = "";
      for (var x = 0; x < grid.w; x++) { var b = grid.at[x + "," + y]; r += b && !b.structural ? b.def.letter : "."; }
      rows.push(r);
    }
    return rows;
  }
  // Validate a layout against a class: returns { ok, errors: [], counts }
  function validateLayout(cls, rows) {
    var errors = [], counts = {}, bridges = 0;
    var mask = cls.mask;
    for (var y = 0; y < mask.length; y++) for (var x = 0; x < mask[0].length; x++) {
      var ch = rows[y] ? rows[y][x] : ".";
      if (ch === ".") continue;
      var m = mask[y][x];
      if (m === "." || m === "p") { errors.push("Block outside the hull at " + x + "," + y); continue; }
      var t = typeForLetter(ch);
      if (!t) { errors.push("Unknown block '" + ch + "'"); continue; }
      counts[t] = (counts[t] || 0) + 1;
      if (t === "bridge") bridges++;
    }
    if (bridges !== 1) errors.push("Exactly one bridge is required (" + bridges + " placed).");
    var grid = build(cls, rows);
    if (grid.bridge) { var lost = pruneDisconnected(grid); if (lost.length) errors.push(lost.length + " block(s) are not connected to the bridge."); }
    var st = derive(grid);
    if (!st.weapons.length) errors.push("No weapons.");
    if (st.thrust === 0) errors.push("No engines.");
    return { ok: errors.length === 0, errors: errors, counts: counts, stats: st };
  }
  function layoutCost(rows) {
    var cost = 0;
    rows.forEach(function (r) { for (var i = 0; i < r.length; i++) { var t = typeForLetter(r[i]); if (t) cost += BS.Data.blocks[t].cost; } });
    return cost;
  }

  return { build: build, derive: derive, facingOf: facingOf, worldToLocal: worldToLocal, localToWorld: localToWorld, cellOfLocal: cellOfLocal,
    blockAtWorld: blockAtWorld, blockWorld: blockWorld, entryBlock: entryBlock, hit: hit, repair: repair, pruneDisconnected: pruneDisconnected,
    layoutFromGrid: layoutFromGrid, validateLayout: validateLayout, layoutCost: layoutCost, typeForLetter: typeForLetter };
})();
