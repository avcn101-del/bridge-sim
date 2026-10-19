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
  // The modulation of a block (BS.Data.tuning): its digit in the tuning rows, else the faction's default; null for a
  // block that is not tunable.
  function tuneOf(cls, type, tuningRows, x, y) {
    var T = BS.Data.tuning; if (!T || !T.tunable[type]) return null;
    var ch = tuningRows && tuningRows[y] ? tuningRows[y][x] : "0", id = null;
    Object.keys(T.list).forEach(function (k) { if (T.list[k].digit === ch) id = k; });
    return id || T.factionDefault[cls.faction] || T.order[0];
  }
  // Damage multiplier of an ammo modulation against a frequency or alloy: ×bonus when it beats it, ×malus when beaten.
  function tuneMult(ammo, def) {
    var T = BS.Data.tuning; if (!T || !ammo || !def || ammo === def) return 1;
    var o = T.order, a = o.indexOf(ammo), d = o.indexOf(def);
    if (a < 0 || d < 0) return 1;
    if ((a + 1) % o.length === d) return T.bonus;
    if ((d + 1) % o.length === a) return T.malus;
    return 1;
  }
  // Tuning rows of a class in the layout's shape, all faction default ("0").
  function blankTuning(cls) { return cls.mask.map(function (r) { return r.replace(/./g, "0"); }); }
  // Tuning rows from a spec { ammo, shield, armor } of modulation ids ("a:b" splits port / starboard halves), applied on
  // top of `base` rows (or blank) for the cells of those kinds in `rows`.
  function tuningRowsFor(cls, rows, spec, base) {
    var T = BS.Data.tuning, out = (base || blankTuning(cls)).slice(), h = cls.mask.length;
    function digit(id) { return id && T.list[id] ? T.list[id].digit : "0"; }
    for (var y = 0; y < h; y++) {
      var line = out[y].split("");
      for (var x = 0; x < line.length; x++) {
        var type = typeForLetter(rows[y] ? rows[y][x] : "."), kind = type ? T.tunable[type] : null;
        if (!kind) { line[x] = "0"; continue; }
        var want = spec[kind]; if (want === undefined) continue;
        if (want && want.indexOf(":") >= 0) { var pair = want.split(":"); want = y < h / 2 ? pair[0] : pair[1]; }
        line[x] = digit(want);
      }
      out[y] = line.join("");
    }
    return out;
  }
  // What a grid is tuned to, per kind: { ammo: { nadion: 8 }, frequency: {...}, alloy: {...} }, alive blocks only.
  function tuningSummary(grid, all) {
    var T = BS.Data.tuning, out = { ammo: {}, frequency: {}, alloy: {} };
    grid.blocks.forEach(function (b) { if ((!b.alive && !all) || !b.tune) return; var k = T.tunable[b.type]; if (k) out[k][b.tune] = (out[k][b.tune] || 0) + 1; });
    return out;
  }
  function dominantTune(counts) { var best = null; Object.keys(counts).forEach(function (k) { if (best === null || counts[k] > counts[best]) best = k; }); return best; }
  function tuningText(grid) {
    var T = BS.Data.tuning, s = tuningSummary(grid);
    function part(label, m) { var ks = Object.keys(m); if (!ks.length) return null; ks.sort(function (a, b) { return m[b] - m[a]; }); return label + " " + ks.map(function (k) { return T.list[k].name + (ks.length > 1 ? " " + m[k] : ""); }).join(" / "); }
    return [part("ammo", s.ammo), part("shields", s.frequency), part("armor", s.alloy)].filter(Boolean).join(" · ") || "untuned";
  }
  function build(cls, layoutRows, statMult, tuningRows) {
    statMult = statMult || 1;
    var mask = cls.mask, h = mask.length, w = mask[0].length, cellPx = G().cellPx;
    var grid = { w: w, h: h, mask: mask, blocks: [], at: {}, cellPx: cellPx, dirty: true, bridge: null, cls: cls };
    var layout = layoutRows || cls.layout;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var m = mask[y][x];
        if (m === ".") continue;
        var type = null, structural = false;
        if (m === "p") { type = "structure"; structural = true; }
        else { var ch = layout[y] ? layout[y][x] : "."; type = typeForLetter(ch); }
        if (!type) continue;
        var def = structural ? { hp: G().structureHp, mass: 1, color: "#8a90a0", name: "Structure", pierceCost: G().structurePierceCost } : BS.Data.blocks[type];
        var hp = Math.round(def.hp * statMult);
        var b = { x: x, y: y, type: type, def: def, hp: hp, maxHp: hp, alive: true, structural: structural, nacelle: m === "n",
                  lx: (x + 0.5 - w / 2) * cellPx, ly: (y + 0.5 - h / 2) * cellPx, cycleLeft: 0, id: y * w + x, tune: structural ? null : tuneOf(cls, type, tuningRows, x, y) };
        b.outward = Math.atan2(b.ly, b.lx);
        grid.blocks.push(b); grid.at[x + "," + y] = b;
        if (type === "bridge") grid.bridge = b;
      }
    }
    return grid;
  }

  function isRim(grid, b) {
    for (var i = 0; i < 4; i++) { var d = [[1, 0], [-1, 0], [0, 1], [0, -1]][i], q = grid.at[(b.x + d[0]) + "," + (b.y + d[1])]; if (!q || !q.alive) return true; }
    return false;
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
      counts: {}, alive: {}, hullTotal: 0, hullAlive: 0, weapons: [], bridgeAlive: false, powerUsed: 0, powerMax: grid.cls.powerBase || 0,
      heatCap: g.heat.base, heatDissipation: g.heat.dissipationBase, rimCells: 0 };
    // reactor power range: systems outside every alive reactor's radius run at g.unpoweredFactor (b.powered, b.powerMult)
    var pc = fieldCover(grid, "reactor", g.powerRadius, "powered");
    s.powered = pc.covered; s.unpowered = pc.exposed; s.poweredFrac = pc.frac;
    grid.blocks.forEach(function (b) {
      if (b.structural) return;
      s.counts[b.type] = (s.counts[b.type] || 0) + 1;
      s.hullTotal += b.maxHp;
      if (!b.alive) return;
      b.powerMult = b.powered ? 1 : g.unpoweredFactor;
      var pm = b.powerMult;
      s.alive[b.type] = (s.alive[b.type] || 0) + 1;
      s.hullAlive += b.hp;
      s.mass += b.def.mass;
      s.powerUsed += b.def.power || 0;
      if (b.type === "reactor") s.powerMax += g.powerPerReactor;
      s.heatCap += g.heat.perBlock;
      if (isRim(grid, b)) { s.rimCells++; s.heatDissipation += g.heat.dissipationPerRimCell; }
      var f = facingOf(b);
      switch (b.type) {
        case "engine": s.thrust += (b.nacelle ? g.nacelleThrustMult : 1) * pm; break;
        case "reactor": s.cap += g.capAdd; break;
        case "shield": s.shieldMax[f] += g.shieldAdd * pm; s.regen[f] += g.regenAdd * pm; break;
        case "sensor": s.sensors += g.sensorAdd * pm; break;
        case "quarters": s.repair += g.repairAdd; break;
        case "bridge": s.bridgeAlive = true; break;
      }
      if (b.def.weapon) s.weapons.push(b);
    });
    if (g.lineOfFire) s.weapons.forEach(function (b) { updateFacing(grid, b); });
    // shield cover: a block is protected only while an alive emitter sits within grid.shieldRadius cells (b.coverBy = nearest)
    var sc = fieldCover(grid, "shield", g.shieldRadius, "covered", "coverBy");
    s.covered = sc.covered; s.exposed = sc.exposed; s.coverFrac = sc.frac;
    // cloak and ECM fields (ew.cloakRadius / jamRadius): a cloak needs every block inside a field; blocks outside the
    // ECM field can still be targeted through a jam
    s.cloakCover = fieldCover(grid, "cloak", BS.Data.ew.cloakRadius, "cloakCovered");
    s.jamCover = fieldCover(grid, "jammer", BS.Data.ew.jamRadius, "jamCovered");
    grid.rev = (grid.rev || 0) + 1;
    s.speedMult = s.mass > 0 ? U.clamp(s.thrust * g.thrustPerPoint / s.mass, g.speedMultMin, g.speedMultMax) : g.speedMultMin;
    // brownout: with reactors gone the surviving systems share what is left
    s.powerFactor = s.powerUsed > s.powerMax ? Math.max(g.brownoutMin, s.powerMax / s.powerUsed) : 1;
    // crew: systems need hands (blocks.*.crew), the bridge and the quarters supply them; manning = supply / need, and a
    // system far from any quarters or the bridge (grid.crew.radius) is slow to repair (b.farCrew)
    var cr = g.crew, need = 0, supply = (s.bridgeAlive ? cr.bridge : 0) - (grid.crewAway || 0), far = 0, hands = grid.blocks.filter(function (b) { return b.alive && (b.type === "quarters" || b.type === "bridge"); });   // crewAway: a boarding party sent across (BS.Boarding)
    grid.blocks.forEach(function (b) {
      if (!b.alive || b.structural) return;
      if (b.type === "quarters") supply += cr.perQuarters;
      var c = b.def.crew || 0; need += c; b.farCrew = false;
      if (c > 0) {
        var near = false;
        for (var i = 0; i < hands.length && !near; i++) { var dx = hands[i].x - b.x, dy = hands[i].y - b.y; if (dx * dx + dy * dy <= cr.radius * cr.radius) near = true; }
        if (!near) { b.farCrew = true; far++; }
      }
    });
    supply = Math.max(0, supply);
    s.crew = { need: need, supply: supply, far: far, away: grid.crewAway || 0, manning: need > 0 ? U.clamp(supply / need, cr.minManning, 1) : 1 };
    grid.stats = s; grid.dirty = false;
    return s;
  }

  // ---- weak-point analysis -------------------------------------------------------------------------------------
  // What to shoot at on this ship, best first: the emitter covering the most hull, a reactor touching another (chain),
  // a reactor that alone powers the most systems (blackout), a block whose loss severs the most hull from the bridge
  // (neck: lost blocks per hp), a crew quarters whose loss undermans the ship, and wounded systems open to a critical.
  // Each: { kind, block, label, score, n }. Used by the scan panel (click to focus fire) and by cunning enemies.
  function weakPoints(ship, attacker) {
    var grid = ship.grid, g = G(), W = g.weakPoints, out = [], blocks = grid.blocks.filter(function (b) { return b.alive; }), st = grid.stats || derive(grid);
    var systems = blocks.filter(function (b) { return !b.structural && (b.def.crew || 0) > 0; });
    // 0. a facing whose emitters' frequency the attacker's dominant ammo beats (BS.Data.tuning): the attacker's edge
    if (attacker && attacker.grid) {
      var T = BS.Data.tuning, ammo = dominantTune(tuningSummary(attacker.grid).ammo);
      if (ammo) {
        var byFacing = {};
        blocks.forEach(function (b) { if (b.type === "shield" && b.tune && tuneMult(ammo, b.tune) > 1) { var f = facingOf(b); if (!byFacing[f]) byFacing[f] = { n: 0, block: b }; byFacing[f].n++; } });
        var bestF = null; Object.keys(byFacing).forEach(function (f) { if (!bestF || byFacing[f].n > byFacing[bestF].n) bestF = f; });
        if (bestF) out.push({ kind: "frequency", block: byFacing[bestF].block, n: byFacing[bestF].n, score: 6 + byFacing[bestF].n, label: "Their " + bestF + " emitters are " + T.list[byFacing[bestF].block.tune].name + ": our " + T.list[ammo].name + " ammo hits ×" + T.bonus + " there" });
      }
    }
    // 1. the emitter that covers the most blocks
    var coverCount = {};
    blocks.forEach(function (b) { if (b.coverBy) coverCount[b.coverBy.id] = (coverCount[b.coverBy.id] || 0) + 1; });
    var bestE = null;
    blocks.forEach(function (b) { if (b.type === "shield" && coverCount[b.id] && (!bestE || coverCount[b.id] > coverCount[bestE.id])) bestE = b; });
    if (bestE) out.push({ kind: "emitter", block: bestE, n: coverCount[bestE.id], score: coverCount[bestE.id] * 2, label: "Bare " + coverCount[bestE.id] + " blocks: kill the " + facingOf(bestE) + " emitter at " + bestE.x + "," + bestE.y });
    // 2. reactors touching each other (a breach chains)
    var chain = null, chainN = 0;
    blocks.forEach(function (b) {
      if (b.type !== "reactor") return;
      var n = 0;
      NEIGHBOURS8.forEach(function (d) { var q = grid.at[(b.x + d[0]) + "," + (b.y + d[1])]; if (q && q.alive && q.type === "reactor") n++; });
      if (n > chainN) { chainN = n; chain = b; }
    });
    if (chain) out.push({ kind: "chain", block: chain, n: chainN + 1, score: 30 + chainN * 20, label: "Chain breach: " + (chainN + 1) + " reactors touching at " + chain.x + "," + chain.y });
    // 3. a reactor that alone keeps systems powered
    var R2 = g.powerRadius * g.powerRadius, reactors = blocks.filter(function (b) { return b.type === "reactor"; }), bestR = null, bestRn = 0;
    reactors.forEach(function (r) {
      var n = 0;
      systems.forEach(function (s) {
        var dx = r.x - s.x, dy = r.y - s.y; if (dx * dx + dy * dy > R2) return;
        var other = reactors.some(function (o) { if (o === r) return false; var ex = o.x - s.x, ey = o.y - s.y; return ex * ex + ey * ey <= R2; });
        if (!other) n++;
      });
      if (n > bestRn) { bestRn = n; bestR = r; }
    });
    if (bestR && bestRn >= 3) out.push({ kind: "blackout", block: bestR, n: bestRn, score: bestRn * 1.5, label: "Blackout: the reactor at " + bestR.x + "," + bestR.y + " alone powers " + bestRn + " systems" });
    // 4. the neck: the block whose loss cuts the most hull off the bridge, weighed against its hp
    var bridge = grid.bridge, bestCut = null, bestCutScore = 0;
    if (bridge && bridge.alive) {
      var alive = {}; blocks.forEach(function (b) { alive[b.id] = true; });
      function reach(skip) {
        var seen = {}, stack = [bridge], n = 0; seen[bridge.id] = true;
        while (stack.length) { var b = stack.pop(); n++; NEIGHBOURS8.forEach(function (d) { var q = grid.at[(b.x + d[0]) + "," + (b.y + d[1])]; if (q && q.alive && q !== skip && !seen[q.id]) { seen[q.id] = true; stack.push(q); } }); }
        return n;
      }
      var total = reach(null);
      blocks.forEach(function (b) {
        if (b === bridge) return;
        var lost = total - 1 - reach(b);
        if (lost < W.neckMinBlocks) return;
        var sc = lost * W.cutHpWeight / Math.max(1, b.hp);
        if (sc > bestCutScore) { bestCutScore = sc; bestCut = { block: b, lost: lost, pair: null }; }
      });
      // two-block necks (a 2-wide pylon): a structural or rim block and one neighbour whose joint loss severs a section
      if (W.neckPairs && !bestCut) {
        var cand = blocks.filter(function (b) { return b !== bridge && (b.structural || isRim(grid, b)); });
        for (var i = 0; i < cand.length && !bestCut; i++) {
          var a = cand[i];
          for (var j = 0; j < NEIGHBOURS8.length; j++) {
            var q = grid.at[(a.x + NEIGHBOURS8[j][0]) + "," + (a.y + NEIGHBOURS8[j][1])];
            if (!q || !q.alive || q === bridge || q.id < a.id) continue;
            a.alive = false; var lost2 = total - 2 - reach(q); a.alive = true;
            if (lost2 < W.neckMinBlocks) continue;
            var sc2 = lost2 * W.cutHpWeight / Math.max(1, a.hp + q.hp);
            if (sc2 > bestCutScore) { bestCutScore = sc2; bestCut = { block: a.hp <= q.hp ? a : q, pair: a.hp <= q.hp ? q : a, lost: lost2 }; }
          }
        }
      }
      if (bestCut) out.push({ kind: "neck", block: bestCut.block, pair: bestCut.pair, n: bestCut.lost, score: bestCutScore * 2, label: "Cut: the " + (bestCut.block.structural ? "structure" : bestCut.block.def.name.toLowerCase()) + " at " + bestCut.block.x + "," + bestCut.block.y + (bestCut.pair ? " and its neighbour" : "") + " (" + Math.round(bestCut.block.hp + (bestCut.pair ? bestCut.pair.hp : 0)) + " hp) severs " + bestCut.lost + " blocks" });
    }
    // 5. crew: one quarters short of the posts
    var cw = st.crew;
    if (cw && cw.need > 0 && cw.supply - g.crew.perQuarters < cw.need) {
      var q0 = blocks.filter(function (b) { return b.type === "quarters"; }).sort(function (a, b) { return a.hp - b.hp; })[0];
      if (q0) out.push({ kind: "crew", block: q0, n: 1, score: 12, label: "Crew decks: one quarters lost undermans them (" + cw.supply + " / " + cw.need + ")" });
    }
    // 6. wounded systems open to a critical hit
    var wounded = systems.filter(function (b) { return b.hp < b.maxHp * g.crits.below; }).sort(function (a, b) { return a.hp / a.maxHp - b.hp / b.maxHp; });
    if (wounded.length) out.push({ kind: "wounded", block: wounded[0], n: wounded.length, score: 8 + wounded.length * 3, label: "Finish: " + wounded.length + " wounded system" + (wounded.length > 1 ? "s" : "") + " open to a critical (" + wounded[0].def.name.toLowerCase() + " at " + wounded[0].x + "," + wounded[0].y + ")" });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, W.maxPoints);
  }

  // Blocks within `radius` cells of an alive block of `type` are inside its field: sets b[flag] (and b[byKey] = the nearest
  // such block when asked) and counts the non-structural blocks in and out. frac is 1 only when every block is covered.
  function fieldCover(grid, type, radius, flag, byKey) {
    var sources = grid.blocks.filter(function (b) { return b.alive && b.type === type; }), R2 = radius * radius, out = { covered: 0, exposed: 0, sources: sources.length };
    grid.blocks.forEach(function (b) {
      if (!b.alive) return;
      var best = null, bestD = Infinity;
      for (var i = 0; i < sources.length; i++) { var e = sources[i], dx = e.x - b.x, dy = e.y - b.y, d2 = dx * dx + dy * dy; if (d2 <= R2 && d2 < bestD) { bestD = d2; best = e; } }
      b[flag] = !!best; if (byKey) b[byKey] = best;
      if (!b.structural) { if (best) out.covered++; else out.exposed++; }
    });
    out.frac = out.covered + out.exposed ? out.covered / (out.covered + out.exposed) : 0;
    return out;
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

  // First alive block along a line from the attacker's side toward the ship. The line is parallel to the
  // attacker→centre direction but offset sideways by up to grid.hitScatter × the hull's half-extent, so a
  // volley strafes the whole facing instead of drilling one column. A line that misses the hull is retried closer in.
  function entryBlock(ship, fromX, fromY, scatter) {
    var grid = ship.grid, l = worldToLocal(ship, fromX, fromY);
    var len = Math.sqrt(l.x * l.x + l.y * l.y);
    if (len < 1) return grid.bridge && grid.bridge.alive ? grid.bridge : null;
    var ux = -l.x / len, uy = -l.y / len, nx = -uy, ny = ux;
    var R = Math.max(grid.w, grid.h) * grid.cellPx * 0.75;
    var step = grid.cellPx * 0.4, n = Math.ceil((R * 2) / step);
    var off = (scatter === undefined ? G().hitScatter : scatter) * (Math.random() * 2 - 1) * Math.max(grid.w, grid.h) * grid.cellPx * 0.5;
    for (var tries = 0; tries < 4; tries++, off *= 0.5) {
      var startX = -ux * R + nx * off, startY = -uy * R + ny * off;   // start outside the hull on the attacker's side
      var last = null;
      for (var i = 0; i <= n; i++) {
        var px = startX + ux * step * i, py = startY + uy * step * i;
        var c = cellOfLocal(grid, px, py), b = grid.at[c.x + "," + c.y];
        if (b && b.alive && b !== last) return b;
        last = b;
      }
    }
    return null;
  }
  // First alive block along the line parallel to the attack direction that passes through block `through`.
  // Used for aimed shots: the shot is steered at the aimed block but still has to get past whatever is in front of it.
  function entryBlockThrough(ship, fromX, fromY, through) {
    var grid = ship.grid, l = worldToLocal(ship, fromX, fromY);
    var len = Math.sqrt(l.x * l.x + l.y * l.y) || 1, ux = -l.x / len, uy = -l.y / len;
    var R = Math.max(grid.w, grid.h) * grid.cellPx * 0.75, step = grid.cellPx * 0.4, n = Math.ceil((R * 2) / step);
    var off = (Math.random() * 2 - 1) * G().aimScatter * grid.cellPx, nx = -uy, ny = ux;
    var startX = through.lx - ux * R + nx * off, startY = through.ly - uy * R + ny * off, last = null;
    for (var i = 0; i <= n; i++) {
      var c = cellOfLocal(grid, startX + ux * step * i, startY + uy * step * i), b = grid.at[c.x + "," + c.y];
      if (b && b.alive && b !== last) return b;
      last = b;
    }
    return through;
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
  function pierceCost(b) { return b.def.pierceCost || 1; }
  // Blocks a beam with `points` penetration points reaches: it enters each block while points remain, and each block costs its pierceCost.
  function beamChain(ship, first, fromX, fromY, points) {   // points: grid.penetration plus the weapon's pierceBonus
    var chain = [first], left = points - pierceCost(first);
    if (left > 0) blocksBehind(ship, first, fromX, fromY, points).some(function (q) { chain.push(q); left -= pierceCost(q); return left <= 0; });
    return chain;
  }

  // ---- line of fire ---------------------------------------------------------------
  // True when nothing of the ship's own alive hull lies between weapon block `b` and the given local direction.
  function lineOfFireClear(grid, b, angle) {
    // the shot leaves the block's centre and travels in `angle`; any other alive block of this ship on the way masks it
    var g = G(), step = grid.cellPx * g.lineOfFireStep, R = grid.cellPx * (g.lineOfFireRangeCells + 0.5);
    var ux = Math.cos(angle), uy = Math.sin(angle);
    for (var d = grid.cellPx * g.lineOfFireMuzzle; d < R; d += step) {
      var c = cellOfLocal(grid, b.lx + ux * d, b.ly + uy * d);
      if (c.x < 0 || c.y < 0 || c.x >= grid.w || c.y >= grid.h) return true;
      var q = grid.at[c.x + "," + c.y];
      if (q && q !== b && q.alive) return false;
    }
    return true;
  }
  // A weapon faces the open side of the hull: its arc is centred on the mean of the clear directions around it.
  // Sets b.facing (null when nothing is clear) and b.coverage (fraction of the weapon's arc that is clear).
  function updateFacing(grid, b) {
    var w = b.def.weapon, sx = 0, sy = 0, any = false;
    for (var a = 0; a < 360; a += 10) { var r = a * U.DEG; if (lineOfFireClear(grid, b, r)) { sx += Math.cos(r); sy += Math.sin(r); any = true; } }
    b.facing = any ? Math.atan2(sy, sx) : null;
    if (!any) { b.coverage = 0; return; }
    var half = w.arc / 2, n = 0, clear = 0;
    for (var d = -half; d <= half; d += 10) { n++; if (lineOfFireClear(grid, b, b.facing + d * U.DEG)) clear++; }
    b.coverage = n ? clear / n : 1;
  }
  // Fraction of a weapon's arc that has a clear line of fire.
  function arcCoverage(grid, b) {
    if (!b.def.weapon) return 1;
    if (b.coverage === undefined) updateFacing(grid, b);
    return b.coverage;
  }
  function weaponFacingOf(b) { return b.facing === undefined || b.facing === null ? b.outward : b.facing; }
  // Fire that bears at each relative bearing (−180 .. 180 in steps of stepDeg; positive = starboard): the sum of damage
  // per second of the alive weapons whose arc contains that bearing with a clear line of fire, restricted to the block
  // types in `types` when given.
  // The helm uses it to hold a target where the guns are (ships.js firingBearings).
  function bearingProfile(ship, types, stepDeg) {
    var out = [];
    for (var deg = -180; deg < 180; deg += stepDeg) {
      var ang = deg * U.DEG, w = 0;
      ship.stats.weapons.forEach(function (b) {
        if (!b.alive || b.facing === null || (types && !types[b.type])) return;
        if (Math.abs(U.normAngle(ang - weaponFacingOf(b))) > (b.def.weapon.arc / 2) * U.DEG) return;
        if (G().lineOfFire && !lineOfFireClear(ship.grid, b, ang)) return;   // the own hull masks this bearing
        w += b.def.weapon.damage / b.def.weapon.cycle;
      });
      out.push({ deg: deg, w: w });
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

  // Nearest alive block outside a field: shield cover (aim type "exposed", flag "covered") or the ECM field ("unjammed").
  function nearestExposed(grid, from, flag) {
    var best = null, bestD = Infinity;
    flag = flag || "covered";
    grid.blocks.forEach(function (q) {
      if (!q.alive || q[flag]) return;
      var d = Math.abs(q.x - from.x) + Math.abs(q.y - from.y);
      if (d < bestD) { bestD = d; best = q; }
    });
    return best;
  }
  // The block a shot from a world point lands on, after aiming. Null when the line misses the hull.
  // aimType: a block type (steer at the nearest one), "exposed" (nearest block outside shield cover), "unjammed" (nearest
  // block outside the ECM field, forced on a partially jammed attacker) or null (spray).
  function resolveEntry(ship, fromX, fromY, aimType) {
    var grid = ship.grid, entry = entryBlock(ship, fromX, fromY);
    if (!entry || !aimType) return entry;
    var aimed = typeof aimType === "object" ? (aimType.alive ? aimType : null) : aimType === "exposed" ? nearestExposed(grid, entry) : aimType === "unjammed" ? nearestExposed(grid, entry, "jamCovered") : nearestOfType(grid, entry, aimType, G().aimRadius);
    return aimed ? entryBlockThrough(ship, fromX, fromY, aimed) : entry;
  }

  // ---- damage --------------------------------------------------------------------
  // Apply `amount` hull damage arriving from a world point. Returns { hits: [{block, dmg}], destroyed: [block], cutOff: [block] }.
  // kind "phaser": penetrates up to grid.penetration blocks along the shot line.
  // kind "torpedo": explodes on the entry block and splashes into its neighbours.
  // `first` is the entry block from resolveEntry when the caller already looked it up (so shield cover and the hit agree).
  function hit(ship, amount, fromX, fromY, aimType, kind, first, pierceBonus, ammo) {
    var grid = ship.grid, g = G();
    var res = { hits: [], destroyed: [], cutOff: [], explosions: [], crits: [] };
    if (first === undefined) first = resolveEntry(ship, fromX, fromY, aimType);
    if (!first) return res;
    var toExplode = [], C = g.crits;
    function damage(b, d) {
      if (!b.alive || d <= 0) return 0;
      // the ring: ammo against a plate's alloy. The plate soaks the shot's share at the tuned rate (a beaten plate
      // takes more per point and stops less of the beam)
      var am = ammo && b.type === "armor" ? tuneMult(ammo, b.tune) : 1;
      if (am !== 1) { var taken0 = Math.min(b.hp, d * am); b.hp -= taken0; res.hits.push({ block: b, dmg: taken0 }); if (b.hp <= 0) { b.alive = false; res.destroyed.push(b); } return taken0 / am; }
      var taken = Math.min(b.hp, d);
      b.hp -= taken; res.hits.push({ block: b, dmg: taken });
      if (b.hp <= 0) { b.alive = false; res.destroyed.push(b); if (b.def.explosion) toExplode.push(b); }
      // critical hit on a wounded system (grid.crits): reactors and crew decks are lost outright, the rest is applied by the ship
      else if (C && (b.def.crew || 0) > 0 && b.hp < b.maxHp * C.below && Math.random() < C.chance) {
        res.crits.push({ block: b, kind: b.def.weapon ? "weapon" : b.type });
        if (b.type === "reactor" || b.type === "quarters") { b.hp = 0; b.alive = false; res.destroyed.push(b); if (b.def.explosion) toExplode.push(b); }
      }
      return taken;
    }
    // a destroyed reactor blows up its neighbours; reactors among them explode in turn (chain reaction)
    function runExplosions() {
      while (toExplode.length) {
        var src = toExplode.shift(), ex = src.def.explosion;
        res.explosions.push(src);
        for (var dy = -ex.radius; dy <= ex.radius; dy++) for (var dx = -ex.radius; dx <= ex.radius; dx++) {
          if (!dx && !dy) continue;
          var q = grid.at[(src.x + dx) + "," + (src.y + dy)];
          if (q && q.alive) damage(q, ex.damage);
        }
      }
    }
    if (kind === "torpedo") {
      if (first.structural) amount *= g.torpedoStructureMult;   // warheads crack pylons
      var splash = g.torpedoSplash, left = amount - damage(first, amount * splash.centre);
      var nbs = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(function (d) { return grid.at[(first.x + d[0]) + "," + (first.y + d[1])]; }).filter(function (q) { return q && q.alive; });
      nbs.forEach(function (q) { left -= damage(q, amount * splash.neighbour); });
      if (!first.alive && left > 0) { var deeper = blocksBehind(ship, first, fromX, fromY, 1); if (deeper.length) damage(deeper[0], left); }
    } else {
      var chain = beamChain(ship, first, fromX, fromY, g.penetration + (pierceBonus || 0));
      var rem = amount;
      for (var i = 0; i < chain.length && rem > 0.01; i++) rem -= damage(chain[i], rem);
    }
    runExplosions();
    if (res.destroyed.length) {
      res.cutOff = pruneDisconnected(grid);
      grid.dirty = true;
    }
    return res;
  }

  // Blocks that no longer connect to the bridge break away. Connectivity counts all eight neighbours, so a
  // section is lost only when a cut runs clean through the hull (corner contact still holds).
  var NEIGHBOURS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function pruneDisconnected(grid) {
    var bridge = grid.bridge;
    if (!bridge || !bridge.alive) return [];
    var seen = {}, stack = [bridge]; seen[bridge.id] = true;
    while (stack.length) {
      var b = stack.pop();
      NEIGHBOURS8.forEach(function (d) {
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
    var farMult = G().crew.farRepairMult;
    for (var i = 0; i < pool.length && budget > 0; i++) {
      var b = pool[i], d = Math.min(b.maxHp - b.hp, budget);
      b.hp += b.farCrew ? d * farMult : d; budget -= d;   // a block far from the crew decks costs the same time for half the repair
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
    Object.keys(counts).forEach(function (t) { if (t !== "bridge" && BS.Data.blocks[t].unique && counts[t] > 1) errors.push("Only one " + BS.Data.blocks[t].name.toLowerCase() + " per ship."); });
    var grid = build(cls, rows);
    if (grid.bridge) { var lost = pruneDisconnected(grid).filter(function (b) { return !b.structural; }); if (lost.length) errors.push(lost.length + " block(s) are not connected to the bridge."); }
    var st = derive(grid);
    if (!st.weapons.length) errors.push("No weapons.");
    if (st.thrust === 0) errors.push("No engines.");
    if (st.powerUsed > st.powerMax) errors.push("Power grid overloaded: " + st.powerUsed + " / " + st.powerMax + ". Fewer systems or more reactors.");
    if (st.crew.supply < st.crew.need) errors.push("Undermanned: " + st.crew.supply + " crew for " + st.crew.need + " posts. Add crew quarters (8 each) or fewer systems.");
    // warnings do not block undocking
    var warnings = [], masked = st.weapons.filter(function (b) { return arcCoverage(grid, b) <= 0; }).length;
    if (masked) warnings.push(masked + " weapon(s) cannot fire past the hull.");
    if (st.exposed && st.coverFrac < 0.9) warnings.push(st.exposed + " block(s) outside shield cover (" + G().shieldRadius + " cells from an emitter) take hits unshielded.");
    if (st.cloakCover.sources && st.cloakCover.exposed) warnings.push(st.cloakCover.exposed + " block(s) outside the cloak field (" + BS.Data.ew.cloakRadius + " cells from a cloaking device): the ship cannot cloak.");
    if (st.jamCover.sources && st.jamCover.exposed) warnings.push(st.jamCover.exposed + " block(s) outside the ECM field (" + BS.Data.ew.jamRadius + " cells from a jammer): a jammed enemy can still hit them.");
    var hot = 0;
    grid.blocks.forEach(function (b) {
      if (b.type !== "reactor") return;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var q = grid.at[(b.x + dx) + "," + (b.y + dy)]; if (q && q !== b && (q.type === "reactor" || q.type === "bridge")) hot++; }
    });
    if (hot) warnings.push("Reactors touch each other or the bridge: one breach will chain.");
    if (st.crew.far) warnings.push(st.crew.far + " system block(s) more than " + G().crew.radius + " cells from crew quarters or the bridge repair at half speed.");
    if ((st.alive.neut || 0) > 0 && st.cap < BS.Data.ew.neut.warnCapBelow) warnings.push("An energy neutraliser drains your own capacitor too (" + BS.Data.modules.neut.cap + " per " + BS.Data.modules.neut.cycle + " s): with under " + BS.Data.ew.neut.warnCapBelow + " capacitor it will starve your other systems. Fit reactors.");
    var unp = grid.blocks.filter(function (b) { return b.alive && !b.structural && !b.powered && (b.def.crew || 0) > 0; }).length;
    if (unp) warnings.push(unp + " system block(s) more than " + G().powerRadius + " cells from a reactor run at " + Math.round(100 * G().unpoweredFactor) + "% power (dim cells).");
    return { ok: errors.length === 0, errors: errors, warnings: warnings, counts: counts, stats: st, masked: masked, grid: grid };
  }
  // Random variant of a layout: re-roll a fraction of the editable cells (armor ↔ system blocks, weighted by
  // grid.variant.systemWeights), keep the bridge, and only accept a layout that validates. `rng` returns [0,1).
  function randomVariant(cls, rows, rng) {
    var V = G().variant, w = cls.mask[0].length, h = cls.mask.length;
    var weights = V.systemWeights, keys = Object.keys(weights), total = keys.reduce(function (a, k) { return a + weights[k]; }, 0);
    function rollType() { var r = rng() * total; for (var i = 0; i < keys.length; i++) { r -= weights[keys[i]]; if (r < 0) return keys[i]; } return keys[0]; }
    var cells = [];
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var m = cls.mask[y][x]; if ((m === "#" || m === "n") && rows[y][x] !== "." && rows[y][x] !== "B") cells.push({ x: x, y: y }); }
    for (var attempt = 0; attempt < V.attempts; attempt++) {
      var out = rows.slice(), n = Math.max(1, Math.round(cells.length * V.fraction));
      for (var i = 0; i < n; i++) {
        var c = cells[Math.floor(rng() * cells.length)], cur = typeForLetter(out[c.y][c.x]);
        var next = cur === "armor" ? rollType() : "armor";
        if (next === cur) continue;
        var letter = BS.Data.blocks[next].letter, row = out[c.y];
        out[c.y] = row.slice(0, c.x) + letter + row.slice(c.x + 1);
      }
      if (validateLayout(cls, out).ok) return out;
    }
    return rows.slice();
  }
  function layoutCost(rows) {
    var cost = 0;
    rows.forEach(function (r) { for (var i = 0; i < r.length; i++) { var t = typeForLetter(r[i]); if (t) cost += BS.Data.blocks[t].cost; } });
    return cost;
  }

  return { tuneOf: tuneOf, tuneMult: tuneMult, blankTuning: blankTuning, tuningRowsFor: tuningRowsFor, tuningSummary: tuningSummary, dominantTune: dominantTune, tuningText: tuningText, build: build, derive: derive, facingOf: facingOf, worldToLocal: worldToLocal, localToWorld: localToWorld, cellOfLocal: cellOfLocal,
    blockAtWorld: blockAtWorld, blockWorld: blockWorld, entryBlock: entryBlock, entryBlockThrough: entryBlockThrough, resolveEntry: resolveEntry, hit: hit, blockFacing: facingOf, lineOfFireClear: lineOfFireClear, arcCoverage: arcCoverage, weaponFacing: weaponFacingOf, bearingProfile: bearingProfile, fieldCover: fieldCover, weakPoints: weakPoints, repair: repair, pruneDisconnected: pruneDisconnected,
    layoutFromGrid: layoutFromGrid, validateLayout: validateLayout, randomVariant: randomVariant, layoutCost: layoutCost, typeForLetter: typeForLetter };
})();
