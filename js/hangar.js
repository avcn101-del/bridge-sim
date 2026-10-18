// js/hangar.js — the hangar between battles: ship, block editor, skills, save.
window.BS = window.BS || {};

BS.Hangar = (function () {
  var U = BS.Util, C = BS.Campaign, Gr = BS.Grid;
  var $ = function (id) { return document.getElementById(id); };
  var el = {}, game = null, timer = null;
  // editor state
  var ed = { rows: null, classId: null, brush: "armor", mirror: true, hover: null, painting: false, paintType: null, scale: 1, ox: 0, oy: 0, ship: null, dirty: false };

  function init(gameRef) {
    game = gameRef;
    ["hangar-screen", "hg-credits", "hg-ship", "hg-ships", "hg-editor", "hg-palette", "hg-stats", "hg-skills", "hg-training", "hg-msg", "hg-record", "hg-threat", "hg-intel-view", "hg-intel-info",
     "hg-presets", "hg-builds", "btn-mirror", "btn-fill", "btn-clear", "btn-revert", "btn-apply", "btn-savebuild", "hg-buildname", "hg-delta",
     "btn-undock", "btn-export", "btn-import", "hg-import-file", "btn-reset"].forEach(function (id) { el[id] = $(id); });
    el["btn-undock"].addEventListener("click", function () {
      if (ed.dirty) { say("Apply or revert your build before undocking.", true); return; }
      hide(); game.startBattle();
    });
    el["btn-export"].addEventListener("click", exportSave);
    el["btn-import"].addEventListener("click", function () { el["hg-import-file"].value = ""; el["hg-import-file"].click(); });
    el["hg-import-file"].addEventListener("change", importSave);
    el["btn-reset"].addEventListener("click", function () {
      if (window.confirm("Reset all progress? Credits, ships, builds and skills will be lost.")) { C.reset(); ed.rows = null; render(); say("Progress reset."); }
    });
    el["btn-mirror"].addEventListener("click", function () { ed.mirror = !ed.mirror; renderEditor(); });
    el["btn-fill"].addEventListener("click", function () { fillEmpty("A"); });
    el["btn-clear"].addEventListener("click", function () { clearAll(); });
    el["btn-revert"].addEventListener("click", function () { ed.rows = C.layoutFor(ed.classId).slice(); ed.dirty = false; renderEditor(); say("Build reverted to the current layout."); });
    el["btn-apply"].addEventListener("click", applyBuild);
    el["btn-savebuild"].addEventListener("click", function () {
      var name = (el["hg-buildname"].value || "").trim() || ("Build " + (C.builds(ed.classId).length + 1));
      var err = C.saveBuild(ed.classId, name, ed.rows);
      if (err) say(err, true); else { say("Saved build \"" + name + "\"."); el["hg-buildname"].value = ""; renderBuilds(); }
    });
    el["hg-presets"].addEventListener("change", function () {
      var v = el["hg-presets"].value; if (!v) return;
      var cls = BS.Data.shipClasses[ed.classId];
      ed.rows = (v === "default" ? cls.layout : cls.presets[v].rows).slice(); ed.dirty = true; renderEditor();
      say("Loaded preset. Apply to pay for the changes."); el["hg-presets"].value = "";
    });
    bindEditorCanvas();
    BS.Events.on("skillTrained", function (e) { say(BS.Data.skills[e.skill].name + " trained to level " + e.level + "."); if (isOpen()) render(); });
  }

  function isOpen() { return !el["hangar-screen"].classList.contains("hidden"); }
  function show() { el["hangar-screen"].classList.remove("hidden"); render(); if (!timer) timer = setInterval(tick, 1000); }
  function hide() { el["hangar-screen"].classList.add("hidden"); if (timer) { clearInterval(timer); timer = null; } }
  function tick() { if (C.updateTraining()) render(); else renderTraining(); }
  function say(msg, bad) { el["hg-msg"].textContent = msg; el["hg-msg"].classList.toggle("bad", !!bad); }

  // ---- render ---------------------------------------------------------------
  // Intel: the next enemy's layout if it was scanned (held under lock) in an earlier battle of that kind or bought,
  // drawn top-down with its weak points, weapons and shields; otherwise an offer to buy it.
  function renderIntel(enc) {
    var cv = el["hg-intel-view"], c = cv.getContext("2d"), it = C.intelFor(enc), info = el["hg-intel-info"];
    c.clearRect(0, 0, cv.width, cv.height);
    if (!it) {
      c.fillStyle = "rgba(255,255,255,0.08)"; c.font = "13px Antonio, 'Arial Narrow', sans-serif"; c.textAlign = "center"; c.fillText("NO LAYOUT ON FILE", cv.width / 2, cv.height / 2);
      info.innerHTML = "<div class='dim'>" + enc.cls.className + (enc.variantName ? " · " + enc.variantName : "") + " · " + enc.doctrine + (enc.counterReason ? " (" + enc.counterReason + ")" : "") + ".<br>Hold a lock for " + BS.Data.campaign.intelMinLockSeconds + " s in battle to record its layout, or buy it now.</div>" +
        "<button id='btn-intel' class='lcars-btn c-purple'>Buy intel · " + BS.Data.campaign.intelCost + " cr</button>";
      var btn = document.getElementById("btn-intel");
      btn.addEventListener("click", function () { var err = C.buyIntel(enc); if (err) el["hg-msg"].textContent = err; render(); });
      return;
    }
    var ship = BS.Ships.create(it.classId, { layout: it.rows, pos: { x: 0, y: 0 }, heading: 0, statMult: C.enemyStatMult(enc.aiProfile) });
    c.save(); c.translate(cv.width / 2, cv.height / 2); BS.Renderer.drawTopDown(c, ship, cv.width, cv.height); c.restore();
    var st = ship.stats, wps = BS.Grid.weakPoints(ship);
    var weapons = {};
    st.weapons.forEach(function (b) { weapons[b.def.short] = (weapons[b.def.short] || 0) + 1; });
    var facings = BS.Ships.FACINGS.map(function (f) { return f.charAt(0).toUpperCase() + " " + ship.shieldMax[f]; }).join(" · ");
    info.innerHTML = "<div><b>" + enc.cls.className + (enc.variantName ? " · " + enc.variantName : "") + "</b> <span class='dim'>(" + it.how + ")</span> · " + enc.doctrine + (enc.counterReason ? " <span class='dim'>(" + enc.counterReason + ")</span>" : "") + "</div>" +
      "<div>Weapons " + (Object.keys(weapons).map(function (k) { return k + " " + weapons[k]; }).join(" · ") || "none") + " · shields " + facings + " · hull " + st.hullTotal + "</div>" +
      "<div>Reactors " + (st.counts.reactor || 0) + " · quarters " + (st.counts.quarters || 0) + " · cover " + Math.round(100 * st.coverFrac) + "%" + (st.cloakCover.sources ? " · cloak" : "") + (st.jamCover.sources ? " · ECM" : "") + "</div>" +
      (wps.length ? "<div class='hg-wps'>" + wps.slice(0, 3).map(function (w) { return "<div class='wp'>" + w.label + "</div>"; }).join("") + "</div>" : "");
  }
  function render() {
    var s = C.get(), cls = C.currentClass();
    if (ed.classId !== s.shipClass || !ed.rows) { ed.classId = s.shipClass; ed.rows = C.layoutFor(s.shipClass).slice(); ed.dirty = false; }
    el["hg-credits"].textContent = s.credits.toLocaleString() + " cr";
    el["hg-record"].textContent = s.campaign.battlesWon + " won · " + s.campaign.battlesLost + " lost" + (s.campaign.streak > 1 ? " · streak " + s.campaign.streak : "");
    var enc = C.encounter();
    var docLabel = BS.Data.enemyAI.stateLabels[enc.doctrine] || enc.doctrine;
    el["hg-threat"].textContent = "Next: " + enc.label + " · strength " + Math.round(C.enemyStatMult(enc.aiProfile) * 100) + "% · " + enc.doctrine + (enc.counterReason ? " (" + enc.counterReason + ")" : "");
    el["hg-threat"].title = "Sensors report a " + enc.cls.className + (enc.variantName ? " (" + enc.variantName + " layout)" : "") + ". Reward ×" + enc.rewardMult + ". Doctrine: " + enc.doctrine + (enc.counterReason ? ": " + enc.counterReason + ". Change your build and they change their plan." : ".");
    renderIntel(enc);
    el["hg-ship"].innerHTML = "<b>" + cls.name + "</b> · " + cls.className + " · " + cls.role +
      "<br><span class='dim'>" + cls.mask[0].length + "×" + cls.mask.length + " cell hull · base speed " + (cls.speed / BS.Data.units.pxPerKm).toFixed(1) + " km/s · signature " + cls.signature + " m</span>";
    renderShips(s); renderPalette(); renderPresets(cls); renderBuilds(); renderEditor(); renderSkills(s); renderTraining();
  }

  function renderShips(s) {
    var box = el["hg-ships"]; box.innerHTML = "";
    Object.keys(BS.Data.shipClasses).forEach(function (id) {
      var cls = BS.Data.shipClasses[id];
      if (!cls.purchasable && s.ownedShips.indexOf(id) < 0) return;
      var owned = s.ownedShips.indexOf(id) >= 0, current = s.shipClass === id;
      var cells = cls.mask.reduce(function (a, r) { return a + (r.match(/[#n]/g) || []).length; }, 0);
      var row = document.createElement("div"); row.className = "hg-row" + (current ? " current" : "");
      row.innerHTML = "<span class='hg-name'>" + cls.className + "</span><span class='dim'>" + cls.role + " · " + cells + " cells</span>";
      var b = document.createElement("button"); b.className = "lcars-btn " + (owned ? "c-blue" : "c-orange");
      b.textContent = current ? "Active" : owned ? "Board" : cls.cost.toLocaleString() + " cr";
      b.disabled = current;
      b.addEventListener("click", function () {
        if (owned) { C.selectShip(id); ed.rows = null; render(); say("Boarded " + cls.name + "."); }
        else { var err = C.buyShip(id); if (err) say(err, true); else { ed.rows = null; render(); say("Purchased " + cls.name + "."); } }
      });
      row.appendChild(b); box.appendChild(row);
    });
  }

  // ---- editor ---------------------------------------------------------------
  function renderPalette() {
    var box = el["hg-palette"]; box.innerHTML = "";
    Object.keys(BS.Data.blocks).forEach(function (type) {
      var d = BS.Data.blocks[type];
      var b = document.createElement("button"); b.className = "pal" + (ed.brush === type ? " active" : "");
      b.innerHTML = "<b>" + d.name + "</b><small>" + (d.cost ? d.cost + " cr" : "free") + " · " + d.hp + " hp</small>";
      b.insertBefore(BS.Renderer.blockIcon(type, 22), b.firstChild);
      b.title = d.desc;
      b.addEventListener("click", function () { ed.brush = type; renderPalette(); });
      box.appendChild(b);
    });
    var e = document.createElement("button"); e.className = "pal erase" + (ed.brush === "erase" ? " active" : "");
    e.innerHTML = "<i></i><b>Erase</b><small>right-click also erases</small>";
    e.querySelector("i").className = "erase-icon";
    e.addEventListener("click", function () { ed.brush = "erase"; renderPalette(); });
    box.appendChild(e);
  }
  function renderPresets(cls) {
    var sel = el["hg-presets"]; sel.innerHTML = "<option value=''>Load preset…</option><option value='default'>Class default</option>";
    Object.keys(cls.presets || {}).forEach(function (k) { var o = document.createElement("option"); o.value = k; o.textContent = cls.presets[k].name + " — " + cls.presets[k].desc; sel.appendChild(o); });
  }
  function renderBuilds() {
    var box = el["hg-builds"]; box.innerHTML = "";
    var list = C.builds(ed.classId);
    if (!list.length) { box.innerHTML = "<span class='dim'>No saved builds. Name one and press Save build.</span>"; return; }
    list.forEach(function (b) {
      var row = document.createElement("span"); row.className = "build";
      var load = document.createElement("button"); load.className = "lcars-btn c-blue"; load.textContent = b.name; load.title = "Load this build into the editor";
      load.addEventListener("click", function () { ed.rows = b.rows.slice(); ed.dirty = true; renderEditor(); say("Loaded \"" + b.name + "\". Apply to pay for the changes."); });
      var del = document.createElement("button"); del.className = "lcars-btn c-red sq"; del.textContent = "×"; del.title = "Delete";
      del.addEventListener("click", function () { C.deleteBuild(ed.classId, b.name); renderBuilds(); });
      row.appendChild(load); row.appendChild(del); box.appendChild(row);
    });
  }

  function rebuildShip() {
    var cls = BS.Data.shipClasses[ed.classId];
    // build without validation so the preview shows exactly what is painted (bridge may be missing)
    var grid = Gr.build(cls, ed.rows);
    ed.ship = { grid: grid, visual: { length: grid.w * grid.cellPx, width: grid.h * grid.cellPx, hullTint: cls.visual.hullTint, nacelleColor: cls.visual.nacelleColor }, pos: { x: 0, y: 0 }, heading: 0 };
    Gr.derive(grid);
  }

  function renderEditor() {
    var cls = BS.Data.shipClasses[ed.classId], canvas = el["hg-editor"], c = canvas.getContext("2d");
    rebuildShip();
    var g = ed.ship.grid, W2 = canvas.width, H2 = canvas.height;
    ed.scale = Math.min((W2 - 24) / (g.w * g.cellPx), (H2 - 24) / (g.h * g.cellPx));
    ed.ox = W2 / 2; ed.oy = H2 / 2;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W2, H2);
    c.save(); c.translate(ed.ox, ed.oy); c.scale(ed.scale, ed.scale);
    var cp = g.cellPx, half = cp / 2;
    // fillable cells and structure
    for (var y = 0; y < g.h; y++) for (var x = 0; x < g.w; x++) {
      var m = cls.mask[y][x]; if (m === ".") continue;
      var lx = (x + 0.5 - g.w / 2) * cp, ly = (y + 0.5 - g.h / 2) * cp;
      c.fillStyle = m === "p" ? "rgba(140,146,170,0.35)" : m === "n" ? "rgba(90,160,255,0.10)" : "rgba(255,255,255,0.05)";
      c.fillRect(lx - half, ly - half, cp, cp);
      c.strokeStyle = "rgba(255,255,255,0.08)"; c.lineWidth = 0.3 / ed.scale * 2; c.strokeRect(lx - half, ly - half, cp, cp);
    }
    BS.Renderer.drawGridShip(c, ed.ship, 0.5, { still: true });
    drawFireArcs(c, g);
    // shield cover: bubble outlines, and the cells no bubble reaches (hit unshielded)
    BS.Renderer.drawShieldCover(c, ed.ship);
    c.fillStyle = "rgba(255,70,60,0.4)";
    g.blocks.forEach(function (b) { if (b.alive && !b.structural && !b.covered) c.fillRect(b.lx - half, b.ly - half, cp, cp); });
    // cloak / ECM fields (only when the build carries the device): cells outside them get a purple / green frame
    var st0 = g.stats || BS.Grid.derive(g);
    c.lineWidth = 0.9;
    if (st0.cloakCover.sources) { c.strokeStyle = "rgba(155,140,255,0.9)"; g.blocks.forEach(function (b) { if (b.alive && !b.structural && !b.cloakCovered) c.strokeRect(b.lx - half + 0.6, b.ly - half + 0.6, cp - 1.2, cp - 1.2); }); }
    c.fillStyle = "rgba(255,196,80,0.95)";
    g.blocks.forEach(function (b) { if (b.alive && b.farCrew) c.fillRect(b.lx - 0.8, b.ly - 0.8, 1.6, 1.6); });
    c.fillStyle = "rgba(0,0,0,0.45)";   // out of reactor range: dimmed
    g.blocks.forEach(function (b) { if (b.alive && !b.structural && !b.powered && (b.def.crew || 0) > 0) c.fillRect(b.lx - half, b.ly - half, cp, cp); });
    if (st0.jamCover.sources) { c.strokeStyle = "rgba(53,224,143,0.9)"; g.blocks.forEach(function (b) { if (b.alive && !b.structural && !b.jamCovered) c.strokeRect(b.lx - half + 1.6, b.ly - half + 1.6, cp - 3.2, cp - 3.2); }); }
    // mirror line
    if (ed.mirror) { c.strokeStyle = "rgba(255,200,120,0.35)"; c.setLineDash([3, 3]); c.lineWidth = 0.6; c.beginPath(); c.moveTo(-g.w * cp / 2, 0); c.lineTo(g.w * cp / 2, 0); c.stroke(); c.setLineDash([]); }
    // hover
    if (ed.hover) {
      var hx = (ed.hover.x + 0.5 - g.w / 2) * cp, hy = (ed.hover.y + 0.5 - g.h / 2) * cp;
      c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 0.8; c.strokeRect(hx - half, hy - half, cp, cp);
      if (ed.mirror) { var my = (g.h - 1 - ed.hover.y + 0.5 - g.h / 2) * cp; c.strokeStyle = "rgba(255,255,255,0.45)"; c.strokeRect(hx - half, my - half, cp, cp); }
    }
    c.restore();
    el["btn-mirror"].classList.toggle("active", ed.mirror);
    renderStats();
  }

  // Weapons that cannot fire past the hull get a red mark; the hovered weapon shows its clear arc as a wedge.
  function drawFireArcs(c, g) {
    var cp = g.cellPx, hov = ed.hover ? g.at[ed.hover.x + "," + ed.hover.y] : null;
    g.stats.weapons.forEach(function (b) {
      var w = b.def.weapon, cov = Gr.arcCoverage(g, b), facing = Gr.weaponFacing(b);
      if (cov <= 0) { c.strokeStyle = "rgba(255,70,60,0.95)"; c.lineWidth = 0.9; c.beginPath(); c.moveTo(b.lx - cp * 0.3, b.ly - cp * 0.3); c.lineTo(b.lx + cp * 0.3, b.ly + cp * 0.3); c.moveTo(b.lx + cp * 0.3, b.ly - cp * 0.3); c.lineTo(b.lx - cp * 0.3, b.ly + cp * 0.3); c.stroke(); }
      if (b !== hov) return;
      var half = w.arc / 2, R = cp * 9;
      for (var a = -half; a < half; a += 5) {
        var a0 = facing + a * U.DEG, a1 = facing + (a + 5) * U.DEG, clear = Gr.lineOfFireClear(g, b, a0 + 2.5 * U.DEG);
        c.fillStyle = clear ? "rgba(255,170,90,0.22)" : "rgba(255,70,60,0.12)";
        c.beginPath(); c.moveTo(b.lx, b.ly); c.arc(b.lx, b.ly, R, a0, a1); c.closePath(); c.fill();
      }
    });
  }

  function renderStats() {
    var st = C.layoutStats(ed.classId, ed.rows), delta = C.layoutDelta(ed.classId, ed.rows), s = C.get();
    var capLine = st.lasts !== null ? "<span class='bad'>runs dry in " + Math.round(st.lasts) + " s with everything on</span>" : "stable at " + st.stableAt + "% with everything on";
    var shields = BS.Ships.FACINGS.map(function (f) { return f.charAt(0).toUpperCase() + " " + st.shields[f]; }).join(" · ");
    var counts = Object.keys(st.counts).map(function (t) { return BS.Data.blocks[t].short + " " + st.counts[t]; }).join(" · ");
    el["hg-stats"].innerHTML =
      (st.ok ? "" : "<div class='bad'>" + st.errors.join(" ") + "</div>") +
      (st.warnings.length ? "<div class='warn'>" + st.warnings.join(" ") + "</div>" : "") +
      "<div><label>Build</label><span>" + st.blocks + " blocks · mass " + st.mass + " · value " + st.cost.toLocaleString() + " cr <span class='dim'>(" + counts + ")</span></span></div>" +
      "<div><label>Damage</label><span>" + st.dps + " dps <span class='dim'>(beams " + st.turretDps + " · torpedoes " + st.launcherDps + ")</span></span></div>" +
      "<div><label>Capacitor</label><span>" + st.cap + " · " + capLine + " <span class='dim'>(drain " + st.drain + "/s · peak " + st.peakRecharge + "/s)</span></span></div>" +
      "<div><label>Heat</label><span>cap " + st.heatCap + " · full salvo " + st.salvoHeat + (st.salvoHeat > st.heatCap ? " <span class='bad'>(overloads)</span>" : "") + " · bleeds " + st.heatDissipation + "/s vs " + st.heatPerSec + "/s firing" + (st.heatNeutral < 1 ? " <span class='warn'>(sustained fire " + Math.round(100 * st.heatNeutral) + "%)</span>" : " (sustainable)") + "</span></div>" +
      "<div><label>Power</label><span class='" + (st.powerUsed > st.powerMax ? "bad" : "") + "'>" + st.powerUsed + " / " + st.powerMax + " <span class='dim'>(" + (st.counts.reactor || 0) + " reactors · phaser 5, cannon 5, pulse 4, tube 8, shield 4, sensor 3, engine 1, quarters 0, jammer 6, cloak 5)</span></span></div>" +
      "<div><label>Reactors</label><span>" + (st.counts.reactor || 0) + " · range " + BS.Data.grid.powerRadius + " cells · powered " + Math.round(100 * (st.poweredFrac || 0)) + "%" + (st.unpowered ? " <span class='warn'>(" + st.unpowered + " dim cells at " + Math.round(100 * BS.Data.grid.unpoweredFactor) + "%)</span>" : "") + "</span></div>" +
      "<div><label>Crew</label><span class='" + (st.crew.supply < st.crew.need ? "bad" : "") + "'>" + st.crew.supply + " / " + st.crew.need + " posts · manning " + Math.round(100 * st.crew.manning) + "%" + (st.crew.far ? " <span class='warn'>(" + st.crew.far + " far from quarters: half repair, amber dots)</span>" : "") + " <span class='dim'>(bridge 10 + 8 per quarters)</span></span></div>" +
      "<div><label>Defence</label><span>hull " + st.hull + " · shields " + shields + " · cover " + Math.round(100 * st.coverFrac) + "%" + (st.exposed ? " <span class='" + (st.coverFrac < 0.9 ? "bad" : "warn") + "'>(" + st.exposed + " exposed, red cells)</span>" : "") + " · repair " + st.repair + "/s" + (st.cloakCover && st.cloakCover.sources ? " · cloak field " + Math.round(100 * st.cloakCover.frac) + "%" + (st.cloakCover.exposed ? " <span class='bad'>(" + st.cloakCover.exposed + " outside, purple: cannot cloak)</span>" : "") : "") + (st.jamCover && st.jamCover.sources ? " · ECM field " + Math.round(100 * st.jamCover.frac) + "%" + (st.jamCover.exposed ? " <span class='warn'>(" + st.jamCover.exposed + " outside, green)</span>" : " (breaks locks)") : "") + "</span></div>" +
      "<div><label>Mobility</label><span>" + st.speed + " km/s <span class='dim'>(thrust " + st.thrust + " / mass " + st.mass + " = ×" + st.speedMult + ")</span> · lock " + st.lockTime + " s</span></div>";
    var net = delta.net;
    el["hg-delta"].textContent = ed.dirty ? (net > 0 ? "Costs " + net.toLocaleString() + " cr" : net < 0 ? "Refunds " + (-net).toLocaleString() + " cr" : "No cost change") + (delta.cost ? " (buy " + delta.cost.toLocaleString() + ", refund " + delta.refund.toLocaleString() + ")" : "") : "Build matches the current layout";
    el["btn-apply"].disabled = !ed.dirty || !st.ok || net > s.credits;
    el["btn-apply"].textContent = ed.dirty ? "Apply build" + (net > 0 ? " · " + net.toLocaleString() + " cr" : "") : "Applied";
    el["btn-undock"].disabled = ed.dirty;
    el["btn-undock"].title = ed.dirty ? "Apply or revert your build first" : "";
  }

  function cellAt(ev) {
    var canvas = el["hg-editor"], r = canvas.getBoundingClientRect();
    var px = (ev.clientX - r.left) * canvas.width / r.width, py = (ev.clientY - r.top) * canvas.height / r.height;
    var g = ed.ship.grid, cp = g.cellPx;
    var lx = (px - ed.ox) / ed.scale, ly = (py - ed.oy) / ed.scale;
    var x = Math.floor(lx / cp + g.w / 2), y = Math.floor(ly / cp + g.h / 2);
    if (x < 0 || y < 0 || x >= g.w || y >= g.h) return null;
    return { x: x, y: y };
  }
  function setCell(x, y, letter) {
    var cls = BS.Data.shipClasses[ed.classId], m = cls.mask[y][x];
    if (m === "." || m === "p") return false;
    var row = ed.rows[y];
    var type = Gr.typeForLetter(letter);
    if (type && BS.Data.blocks[type].unique) { ed.rows = ed.rows.map(function (r) { return r.split(letter).join(type === "bridge" ? "A" : "."); }); row = ed.rows[y]; }   // unique blocks move
    if (row[x] === letter) return false;
    ed.rows[y] = row.slice(0, x) + letter + row.slice(x + 1);
    return true;
  }
  function paint(cell, type) {
    var letter = type === "erase" ? "." : BS.Data.blocks[type].letter;
    var changed = setCell(cell.x, cell.y, letter);
    if (ed.mirror && letter !== "B") { var g = ed.ship.grid, my = g.h - 1 - cell.y; if (my !== cell.y) changed = setCell(cell.x, my, letter) || changed; }
    if (changed) { ed.dirty = true; renderEditor(); }
  }
  function fillEmpty(letter) {
    var cls = BS.Data.shipClasses[ed.classId], changed = false;
    for (var y = 0; y < cls.mask.length; y++) for (var x = 0; x < cls.mask[0].length; x++) {
      var m = cls.mask[y][x]; if ((m === "#" || m === "n") && ed.rows[y][x] === ".") changed = setCell(x, y, letter) || changed;
    }
    if (changed) { ed.dirty = true; renderEditor(); say("Empty cells filled with armor."); }
  }
  function clearAll() {
    ed.rows = ed.rows.map(function (r) { return r.replace(/[^.B]/g, "."); });
    ed.dirty = true; renderEditor(); say("Cleared. The bridge stays; paint the rest.");
  }
  function applyBuild() {
    var err = C.applyLayout(ed.classId, ed.rows);
    if (err) { say(err, true); return; }
    ed.dirty = false; render(); say("Build applied. Ready to undock.");
  }
  function bindEditorCanvas() {
    var canvas = el["hg-editor"];
    canvas.addEventListener("contextmenu", function (ev) { ev.preventDefault(); });
    canvas.addEventListener("mousedown", function (ev) {
      var cell = cellAt(ev); if (!cell) return;
      ed.painting = true; ed.paintType = ev.button === 2 ? "erase" : ed.brush;
      paint(cell, ed.paintType);
    });
    canvas.addEventListener("mousemove", function (ev) {
      var cell = cellAt(ev);
      var changed = !ed.hover || !cell || cell.x !== ed.hover.x || cell.y !== ed.hover.y;
      ed.hover = cell;
      if (ed.painting && cell) paint(cell, ed.paintType); else if (changed) renderEditor();
    });
    window.addEventListener("mouseup", function () { ed.painting = false; });
    canvas.addEventListener("mouseleave", function () { ed.hover = null; ed.painting = false; renderEditor(); });
  }

  // ---- skills ----------------------------------------------------------------
  function renderSkills(s) {
    var box = el["hg-skills"]; box.innerHTML = "";
    Object.keys(BS.Data.skills).forEach(function (id) {
      var sk = BS.Data.skills[id], lvl = s.skills[id] || 0;
      var row = document.createElement("div"); row.className = "hg-row";
      var effect = Object.keys(sk.perLevel).map(function (k) { var v = sk.perLevel[k] * 100; return (v > 0 ? "+" : "") + v.toFixed(0) + "% " + ({ turretDamageMult: "beam damage", launcherDamageMult: "torpedo damage", speedMult: "speed", shieldRegenMult: "shield regen", capRechargeMult: "cap recharge", lockMult: "lock time" })[k] + " per level"; }).join(", ");
      var pips = ""; for (var i = 1; i <= sk.levels; i++) pips += "<i class='" + (i <= lvl ? "on" : "") + "'></i>";
      row.innerHTML = "<span class='hg-name'>" + sk.name + " <span class='pips'>" + pips + "</span></span><span class='dim'>" + effect + "</span>";
      var training = s.training && s.training.skill === id;
      var b = document.createElement("button"); b.className = "lcars-btn " + (training ? "c-blue" : "c-purple");
      if (lvl >= sk.levels) { b.textContent = "Max"; b.disabled = true; }
      else if (training) { b.textContent = "Cancel"; b.addEventListener("click", function () { C.cancelTraining(); render(); }); }
      else { var h = C.skillHours(id, lvl + 1); b.textContent = "Train " + (lvl + 1) + " · " + (h < 1 ? Math.round(h * 60) + " min" : h + " h"); b.disabled = !!s.training; b.addEventListener("click", function () { var err = C.startTraining(id); if (err) say(err, true); else say("Training " + sk.name + " " + (lvl + 1) + "."); render(); }); }
      row.appendChild(b); box.appendChild(row);
    });
  }
  function renderTraining() {
    var s = C.get(), t = s.training;
    if (!t) { el["hg-training"].textContent = "Nothing training. Skills train in real time, even while the game is closed."; return; }
    var left = Math.max(0, t.finishesAt - Date.now()), total = t.finishesAt - t.startedAt;
    var pct = Math.round(100 * (1 - left / total)), mins = Math.ceil(left / 60000);
    el["hg-training"].textContent = "Training " + BS.Data.skills[t.skill].name + " " + t.level + " · " + pct + "% · " + (mins >= 60 ? Math.floor(mins / 60) + " h " + (mins % 60) + " min" : mins + " min") + " left";
  }

  // ---- save files -------------------------------------------------------------
  function exportSave() {
    var blob = new Blob([C.exportJSON()], { type: "application/json" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "bridge-sim-save.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    say("Save exported.");
  }
  function importSave(ev) {
    var file = ev.target.files && ev.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try { C.importJSON(String(reader.result)); ed.rows = null; render(); say("Save imported."); }
      catch (e) { say("Import failed: " + e.message, true); }
    };
    reader.readAsText(file);
  }

  return { init: init, show: show, hide: hide, render: render, isOpen: isOpen, editor: ed, paint: paint };
})();
