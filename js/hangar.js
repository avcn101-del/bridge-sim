// js/hangar.js — the hangar between battles: ship, block editor, skills, save.
window.BS = window.BS || {};

BS.Hangar = (function () {
  var U = BS.Util, C = BS.Campaign, Gr = BS.Grid;
  var $ = function (id) { return document.getElementById(id); };
  var el = {}, game = null, timer = null;
  // editor state
  var ed = { rows: null, classId: null, brush: "armor", mirror: true, hover: null, painting: false, paintType: null, scale: 1, ox: 0, oy: 0, ship: null, dirty: false };
  // script editor state: the script being edited (a working copy), whether it is a read-only template, the dry run
  var sc = { id: null, def: null, template: false, dirty: false, dry: null, intelShip: null, enc: null };

  function init(gameRef) {
    game = gameRef;
    ["hangar-screen", "hg-credits", "hg-ship", "hg-ships", "hg-editor", "hg-palette", "hg-stats", "hg-skills", "hg-training", "hg-msg", "hg-record", "hg-threat", "hg-intel-view", "hg-intel-info", "hg-plan", "hg-script", "hg-doctrine",
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
    var manual = document.getElementById("hg-manual");
    if (manual) manual.addEventListener("change", function () { var s = C.get(); s.settings.manualBridge = manual.checked; C.persist(); BS.UI.setManual(manual.checked); });
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
    el["hg-intel-view"].addEventListener("click", planClick);
    BS.Events.on("skillTrained", function (e) { say(BS.Data.skills[e.skill].name + " trained to level " + e.level + "."); if (isOpen()) render(); });
  }

  function isOpen() { return !el["hangar-screen"].classList.contains("hidden"); }
  function show() { el["hangar-screen"].classList.remove("hidden"); render(); if (!timer) timer = setInterval(tick, 1000); }
  function hide() { el["hangar-screen"].classList.add("hidden"); if (timer) { clearInterval(timer); timer = null; } if (sc.dry && sc.dry.running) { game.cancelDryRun(); sc.dry = null; } }
  function tick() { if (C.updateTraining()) render(); else renderTraining(); }
  function say(msg, bad) { el["hg-msg"].textContent = msg; el["hg-msg"].classList.toggle("bad", !!bad); }

  // ---- render ---------------------------------------------------------------
  // Intel: the next enemy's layout if it was scanned (held under lock) in an earlier battle of that kind or bought,
  // drawn top-down with its weak points, weapons and shields; otherwise an offer to buy it.
  function renderIntel(enc) {
    var cv = el["hg-intel-view"], c = cv.getContext("2d"), it = C.intelFor(enc), info = el["hg-intel-info"];
    c.clearRect(0, 0, cv.width, cv.height);
    sc.intelShip = null; sc.enc = enc;
    if (!it) {
      c.fillStyle = "rgba(255,255,255,0.08)"; c.font = "13px Antonio, 'Arial Narrow', sans-serif"; c.textAlign = "center"; c.fillText("NO LAYOUT ON FILE", cv.width / 2, cv.height / 2);
      info.innerHTML = (enc.retry ? "<div class='warn'>Retry of the last fight: " + enc.name + " waits for you. <button id='btn-letgo' class='lcars-btn c-lilac'>Let it go</button></div>" : "") +
        "<div class='dim'>" + enc.cls.className + (enc.variantName ? " · " + enc.variantName : "") + " · " + enc.doctrine + (enc.counterReason ? " (" + enc.counterReason + ")" : "") + ".<br>Hold a lock for " + BS.Data.campaign.intelMinLockSeconds + " s in battle to record its layout, or buy it now.</div>" +
        "<button id='btn-intel' class='lcars-btn c-purple'>Buy intel · " + BS.Data.campaign.intelCost + " cr</button>";
      info.innerHTML += bookLine(enc);
      var btn = document.getElementById("btn-intel");
      btn.addEventListener("click", function () { var err = C.buyIntel(enc); if (err) el["hg-msg"].textContent = err; render(); });
      var lg0 = document.getElementById("btn-letgo"); if (lg0) lg0.addEventListener("click", function () { C.letGo(); render(); say("Let it go. The sector sends what it sends."); });
      return;
    }
    var ship = BS.Ships.create(it.classId, { layout: it.rows, pos: { x: 0, y: 0 }, heading: 0, statMult: C.enemyStatMult(enc.aiProfile) });
    sc.intelShip = ship;
    c.save(); c.translate(cv.width / 2, cv.height / 2); var k = BS.Renderer.drawTopDown(c, ship, cv.width, cv.height); c.restore();
    drawPlanMarkers(c, cv, ship, k, enc);
    var st = ship.stats, wps = BS.Grid.weakPoints(ship);
    var weapons = {};
    st.weapons.forEach(function (b) { weapons[b.def.short] = (weapons[b.def.short] || 0) + 1; });
    var facings = BS.Ships.FACINGS.map(function (f) { return f.charAt(0).toUpperCase() + " " + ship.shieldMax[f]; }).join(" · ");
    info.innerHTML = (enc.retry ? "<div class='warn'>Retry of the last fight: " + enc.name + " waits for you. <button id='btn-letgo' class='lcars-btn c-lilac'>Let it go</button></div>" : "") +
      "<div><b>" + enc.cls.className + (enc.variantName ? " · " + enc.variantName : "") + "</b> <span class='dim'>(" + it.how + ")</span> · " + enc.doctrine + (enc.counterReason ? " <span class='dim'>(" + enc.counterReason + ")</span>" : "") + "</div>" +
      "<div>Weapons " + (Object.keys(weapons).map(function (k) { return k + " " + weapons[k]; }).join(" · ") || "none") + " · shields " + facings + " · hull " + st.hullTotal + "</div>" +
      "<div>Reactors " + (st.counts.reactor || 0) + " · quarters " + (st.counts.quarters || 0) + " · cover " + Math.round(100 * st.coverFrac) + "%" + (st.cloakCover.sources ? " · cloak" : "") + (st.jamCover.sources ? " · ECM" : "") + "</div>" +
      (wps.length ? "<div class='hg-wps'>" + wps.slice(0, 3).map(function (w) { return "<div class='wp'>" + w.label + "</div>"; }).join("") + "</div>" : "") +
      bookLine(enc);
    var lg = document.getElementById("btn-letgo"); if (lg) lg.addEventListener("click", function () { C.letGo(); render(); say("Let it go. The sector sends what it sends."); });
  }
  // Opening book: what this encounter's bridge has been seen doing (save.book), most often first.
  function bookLine(enc) {
    var EL = BS.Data.elements.list, mine = BS.Grid.elementOf(BS.Data.shipClasses[ed.classId], ed.rows).id, theirs = enc.element || "mixed";
    var edge = BS.Game.elementSentence(mine, theirs) ? "your " + EL[mine].name + " beats their " + EL[theirs].name : BS.Game.elementSentence(theirs, mine) ? "their " + EL[theirs].name + " beats your " + EL[mine].name : "no measured edge between them";
    var elLine = "<div class='hg-element'>Element: theirs <b style='color:" + (EL[theirs] ? EL[theirs].color : "#999") + "'>" + (EL[theirs] ? EL[theirs].name : "mixed") + "</b> · yours <b style='color:" + (EL[mine] ? EL[mine].color : "#999") + "'>" + (EL[mine] ? EL[mine].name : "mixed") + "</b> · " + edge + "</div>";
    var b = C.bookFor(enc), lr = elLine + (enc.learned ? "<div class='warn hg-learned'>They have watched your last " + enc.learned.fights + " fight" + (enc.learned.fights === 1 ? "" : "s") + " (" + escapeHtml(enc.learned.tags.join(" · ")) + "): " + escapeHtml(enc.learned.reason) + ".</div>" : "");
    return lr + bookLine0(b);
  }
  function bookLine0(b) {
    if (!b || !b.fights) return "<div class='dim hg-book'>Book · no fights on record: their bridge is a closed book.</div>";
    var rules = Object.keys(b.rules).map(function (k) { return b.rules[k]; }).sort(function (a, c) { return c.n - a.n; });
    return "<div class='dim hg-book'>Book · " + b.fights + " fight" + (b.fights === 1 ? "" : "s") + ": " + rules.map(function (r) { return escapeHtml(r.text) + " (" + r.n + ")"; }).join(" · ") + "</div>";
  }
  function render() {
    var s = C.get(), cls = C.currentClass();
    if (ed.classId !== s.shipClass || !ed.rows) { ed.classId = s.shipClass; ed.rows = C.layoutFor(s.shipClass).slice(); ed.dirty = false; }
    el["hg-credits"].textContent = s.credits.toLocaleString() + " cr";
    var mb = document.getElementById("hg-manual"); if (mb) mb.checked = !!(s.settings && s.settings.manualBridge);
    el["hg-record"].textContent = s.campaign.battlesWon + " won · " + s.campaign.battlesLost + " lost" + (s.campaign.cleanWins ? " · " + s.campaign.cleanWins + " clean" : "") + (s.campaign.streak > 1 ? " · streak " + s.campaign.streak : "");
    var enc = C.encounter();
    var docLabel = BS.Data.enemyAI.stateLabels[enc.doctrine] || enc.doctrine;
    el["hg-threat"].textContent = (enc.retry ? "Retry: " : "Next: ") + enc.label + " · strength " + Math.round(C.enemyStatMult(enc.aiProfile) * 100) + "% · " + enc.doctrine + (enc.learned ? " (they have watched you: " + enc.learned.reason + ")" : enc.counterReason ? " (" + enc.counterReason + ")" : "");
    el["hg-threat"].title = "Sensors report a " + enc.cls.className + (enc.variantName ? " (" + enc.variantName + " layout)" : "") + ". Reward ×" + enc.rewardMult + ". Doctrine: " + enc.doctrine + (enc.counterReason ? ": " + enc.counterReason + ". Change your build and they change their plan." : ".");
    renderIntel(enc);
    renderPlan(enc);
    renderDoctrine(enc);
    renderScript();
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
      "<div><label>Build</label><span>" + st.blocks + " blocks · mass " + st.mass + " · value " + st.cost.toLocaleString() + " cr · element <b>" + (function () { var e = BS.Grid.elementOf(BS.Data.shipClasses[ed.classId], ed.rows), EL = BS.Data.elements.list; return EL[e.id] ? EL[e.id].name : "mixed"; })() + "</b> <span class='dim'>(" + counts + ")</span></span></div>" +
      "<div><label>Damage</label><span>" + st.dps + " dps <span class='dim'>(beams " + st.turretDps + " · torpedoes " + st.launcherDps + ")</span></span></div>" +
      "<div><label>Capacitor</label><span>" + st.cap + " · " + capLine + " <span class='dim'>(drain " + st.drain + "/s · peak " + st.peakRecharge + "/s)</span></span></div>" +
      "<div><label>Heat</label><span>cap " + st.heatCap + " · full salvo " + st.salvoHeat + (st.salvoHeat > st.heatCap ? " <span class='bad'>(overloads)</span>" : "") + " · bleeds " + st.heatDissipation + "/s vs " + st.heatPerSec + "/s firing" + (st.heatNeutral < 1 ? " <span class='warn'>(sustained fire " + Math.round(100 * st.heatNeutral) + "%)</span>" : " (sustainable)") + "</span></div>" +
      "<div><label>Power</label><span class='" + (st.powerUsed > st.powerMax ? "bad" : "") + "'>" + st.powerUsed + " / " + st.powerMax + " <span class='dim'>(" + (st.counts.reactor || 0) + " reactors · phaser 5, cannon 5, pulse 4, tube 8, shield 4, sensor 3, engine 1, quarters 0, jammer 6, cloak 5, decoy 2, neutraliser 4)</span></span></div>" +
      "<div><label>Reactors</label><span>" + (st.counts.reactor || 0) + " · range " + BS.Data.grid.powerRadius + " cells · powered " + Math.round(100 * (st.poweredFrac || 0)) + "%" + (st.unpowered ? " <span class='warn'>(" + st.unpowered + " dim cells at " + Math.round(100 * BS.Data.grid.unpoweredFactor) + "%)</span>" : "") + "</span></div>" +
      "<div><label>Crew</label><span class='" + (st.crew.supply < st.crew.need ? "bad" : "") + "'>" + st.crew.supply + " / " + st.crew.need + " posts · manning " + Math.round(100 * st.crew.manning) + "%" + " · spare " + Math.max(0, st.crew.supply - st.crew.need) + (st.crew.supply - st.crew.need >= BS.Data.grid.boarding.minParty ? " (boarding party " + Math.min(BS.Data.grid.boarding.partyMax, st.crew.supply - st.crew.need) + ")" : " <span class='dim'>(no boarding party: needs " + BS.Data.grid.boarding.minParty + ")</span>") + (st.crew.far ? " <span class='warn'>(" + st.crew.far + " far from quarters: half repair, amber dots)</span>" : "") + " <span class='dim'>(bridge 10 + 8 per quarters)</span></span></div>" +
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
    // touch: a finger paints the brush (the Erase palette entry erases); preventDefault keeps the page from scrolling
    // and stops the compatibility mouse events, so a tap paints once
    canvas.addEventListener("pointerdown", function (ev) {
      if (ev.pointerType !== "touch") return;
      ev.preventDefault();
      var cell = cellAt(ev); if (!cell) return;
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
      ed.painting = true; ed.paintType = ed.brush; ed.hover = cell; paint(cell, ed.paintType);
    });
    canvas.addEventListener("pointermove", function (ev) {
      if (ev.pointerType !== "touch" || !ed.painting) return;
      var cell = cellAt(ev); if (cell) { ed.hover = cell; paint(cell, ed.paintType); }
    });
    ["pointerup", "pointercancel"].forEach(function (n) { canvas.addEventListener(n, function (ev) { if (ev.pointerType === "touch") { ed.painting = false; ed.hover = null; renderEditor(); } }); });
  }

  // ---- doctrine: the public wheel (BS.Data.elements), with the player's and the next enemy's element marked -------
  function renderDoctrine(enc) {
    var E = BS.Data.elements, EL = E.list, box = el["hg-doctrine"], mine = BS.Grid.elementOf(BS.Data.shipClasses[ed.classId], ed.rows), theirs = enc ? enc.element : null;
    function chip(id) { var e = EL[id], tag = (id === mine.id ? " <span class='me'>YOU</span>" : "") + (id === theirs ? " <span class='them'>NEXT</span>" : ""); return "<span class='el' style='border-color:" + e.color + "' title='" + escapeHtml(e.desc + " Blocks: " + e.blocks.map(function (b) { return BS.Data.blocks[b].name.toLowerCase(); }).join(", ") + ".") + "'>" + e.name + tag + "</span>"; }
    // the wheel: the measured cycle Ordnance → Impulse → Deflector → Ordnance; then every measured edge as a sentence
    var cycle = ["ordnance", "impulse", "deflector"];
    var html = "<div class='wheel'>" + cycle.map(function (id, i) { return chip(id) + "<span class='arrow'>beats</span>"; }).join("") + chip(cycle[0]) + "</div>";
    html += "<div class='wheel'>" + E.order.filter(function (id) { return cycle.indexOf(id) < 0; }).map(chip).join("") + "<span class='arrow'>balanced: no edge that held both ways</span></div>";
    html += "<div class='dim'>Your build reads as <b>" + (EL[mine.id] ? EL[mine.id].name : "mixed") + "</b> (" + E.order.map(function (id) { return EL[id].name.slice(0, 3) + " ×" + mine.emphasis[id].toFixed(1); }).join(" · ") + " of the class default; under ×" + E.minEmphasis + " is mixed). Cloak, ECM, neutralisers and decoys are abilities outside the wheel. Chart: torpedoes drain shields ×" + E.chart.torpedo.shield + ", cannon bolts ×" + E.chart.disruptor.shield + ", beams into plating ×" + E.chart.phaser.armor + ".</div>";
    html += E.edges.map(function (e) { return "<div class='edge'><b style='color:" + EL[e.beats].color + "'>" + EL[e.beats].name + "</b> beats <b style='color:" + EL[e.loses].color + "'>" + EL[e.loses].name + "</b>: " + escapeHtml(e.how.split(": ").slice(1).join(": ")) + " <span class='dim'>Measured " + escapeHtml(e.measured) + " (equal hulls, as attacker / as defender).</span></div>"; }).join("");
    box.innerHTML = html;
  }

  // ---- plan: up to script.planTargets targets on the next enemy, in order ------------------------------------
  // With intel on file a target is a block (tap it on the drawing, or a weak-point line); without, a block type.
  function planTargets(enc) { var pl = C.planFor(enc); return pl && pl.targets ? pl.targets.slice() : []; }
  function targetLabel(t, ship) {
    if (t.type) return BS.Data.blocks[t.type] ? BS.Data.blocks[t.type].name + "s" : t.type;
    var b = ship ? ship.grid.at[t.x + "," + t.y] : null;
    return (b ? (b.structural ? "Structure" : b.def.name) : "Block") + " " + t.x + "," + t.y;
  }
  function renderPlan(enc) {
    var box = el["hg-plan"], N = BS.Data.script.planTargets, targets = planTargets(enc), it = C.intelFor(enc);
    box.innerHTML = "";
    var lbl = document.createElement("span"); lbl.className = "dim"; lbl.textContent = "Plan · targets in order" + (it ? " (tap a block above)" : " (no intel: by type)"); box.appendChild(lbl);
    for (var i = 0; i < N; i++) {
      var t = targets[i];
      if (it) {
        var chip = document.createElement("span"); chip.className = "pt" + (t ? "" : " empty");
        chip.innerHTML = "<b>" + (i + 1) + "▸</b>" + (t ? targetLabel(t, sc.intelShip) + " ✕" : "—");
        if (t) (function (idx) { chip.title = "Remove"; chip.addEventListener("click", function () { var tg = planTargets(enc); tg.splice(idx, 1); C.setPlan(enc, tg); render(); }); })(i);
        box.appendChild(chip);
      } else {
        var sel = document.createElement("select"); sel.className = "lcars-select";
        sel.innerHTML = "<option value=''>" + (i + 1) + "▸ —</option>" + Object.keys(BS.Data.blocks).filter(function (k) { return k !== "bridge" || true; }).map(function (k) { return "<option value='" + k + "'" + (t && t.type === k ? " selected" : "") + ">" + (i + 1) + "▸ " + BS.Data.blocks[k].name + "s</option>"; }).join("");
        (function (idx, s2) { s2.addEventListener("change", function () { var tg = planTargets(enc); while (tg.length < idx) tg.push({ type: "armor" }); if (s2.value) tg[idx] = { type: s2.value }; else tg.splice(idx, 1); C.setPlan(enc, tg); render(); }); })(i, sel);
        box.appendChild(sel);
      }
    }
    if (targets.length) { var clr = document.createElement("button"); clr.className = "lcars-btn c-lilac"; clr.textContent = "Clear plan"; clr.addEventListener("click", function () { C.setPlan(enc, []); render(); }); box.appendChild(clr); }
  }
  // the drawing is translated to the centre, scaled by k and turned bow-up: invert that for a click
  function intelCell(ev) {
    var cv = el["hg-intel-view"], ship = sc.intelShip; if (!ship) return null;
    var r = cv.getBoundingClientRect(), g = ship.grid, cp = g.cellPx, k = Math.min(cv.width / (g.h * cp), cv.height / (g.w * cp)) * 0.88;
    var cx = (ev.clientX - r.left) * cv.width / r.width, cy = (ev.clientY - r.top) * cv.height / r.height;
    var lx = (cv.height / 2 - cy) / k, ly = (cx - cv.width / 2) / k;
    return BS.Grid.blockAtWorld(ship, lx, ly, 1);
  }
  function planClick(ev) {
    var enc = sc.enc, b = intelCell(ev); if (!enc || !b) return;
    var tg = planTargets(enc), i = -1;
    tg.forEach(function (t, j) { if (t.x === b.x && t.y === b.y) i = j; });
    if (i >= 0) tg.splice(i, 1); else if (tg.length < BS.Data.script.planTargets) tg.push({ x: b.x, y: b.y }); else { say("The plan already names " + BS.Data.script.planTargets + " targets. Tap one to remove it.", true); return; }
    C.setPlan(enc, tg); render();
  }
  function drawPlanMarkers(c, cv, ship, k, enc) {
    var tg = planTargets(enc), g = ship.grid;
    tg.forEach(function (t, i) {
      var b = t.x !== undefined ? g.at[t.x + "," + t.y] : null; if (!b) return;
      var cx = cv.width / 2 + b.ly * k, cy = cv.height / 2 - b.lx * k;
      c.beginPath(); c.arc(cx, cy, 7, 0, Math.PI * 2); c.fillStyle = "rgba(255,153,102,0.95)"; c.fill(); c.strokeStyle = "#000"; c.lineWidth = 1; c.stroke();
      c.fillStyle = "#000"; c.font = "bold 10px Antonio, 'Arial Narrow', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(i + 1), cx, cy + 0.5);
    });
  }

  // ---- script editor: when → do rules as sentences built from dropdowns ---------------------------------------
  function SD() { return BS.Data.script; }
  function copyDef(d) { return JSON.parse(JSON.stringify(d)); }
  function currentScriptId() { var s = C.get(); return s.scriptByBuild[ed.classId] || SD().defaultTemplate; }
  function loadScript(id) {
    var own = C.get().scripts.filter(function (x) { return x.id === id; })[0];
    if (own) { sc.id = id; sc.def = copyDef(own); sc.template = false; }
    else { var t = SD().templates[id] || SD().templates[SD().defaultTemplate]; sc.id = SD().templates[id] ? id : SD().defaultTemplate; sc.def = copyDef(t); sc.template = true; }
    sc.dirty = false; sc.dry = null;
  }
  function renderScript() {
    if (!sc.def || (sc.classLoaded !== ed.classId && !sc.dirty)) { loadScript(currentScriptId()); sc.classLoaded = ed.classId; }
    var box = el["hg-script"], save = C.get(), def = sc.def, ro = sc.template;
    box.innerHTML = "";
    // head: which script, copy / rename / save / delete / assign
    var head = document.createElement("div"); head.className = "sc-head";
    var sel = document.createElement("select"); sel.className = "lcars-select";
    var og1 = document.createElement("optgroup"); og1.label = "Templates";
    Object.keys(SD().templates).forEach(function (id) { var o = document.createElement("option"); o.value = id; o.textContent = SD().templates[id].name; og1.appendChild(o); });
    var og2 = document.createElement("optgroup"); og2.label = "My scripts";
    save.scripts.forEach(function (x) { var o = document.createElement("option"); o.value = x.id; o.textContent = x.name; og2.appendChild(o); });
    sel.appendChild(og1); if (save.scripts.length) sel.appendChild(og2);
    sel.value = sc.id;
    sel.addEventListener("change", function () { if (sc.dirty && !window.confirm("Discard the unsaved changes to this script?")) { sel.value = sc.id; return; } loadScript(sel.value); renderScript(); });
    head.appendChild(sel);
    function btn(label, cls, title, fn) { var b = document.createElement("button"); b.className = "lcars-btn " + cls; b.textContent = label; if (title) b.title = title; b.addEventListener("click", fn); return b; }
    head.appendChild(btn("Copy as new", "c-blue", "Make an editable copy of this script", function () {
      if (save.scripts.length >= SD().maxScripts) { say(SD().maxScripts + " scripts saved: delete one first.", true); return; }
      var name = window.prompt("Name for the new script", def.name + " (copy)"); if (!name) return;
      var d = copyDef(def); d.name = name.trim().slice(0, 24); d.id = "s" + Date.now().toString(36); delete d.desc; delete d.requires;
      C.saveScript(d); loadScript(d.id); renderScript(); say("Script \"" + d.name + "\" created. Edit the rules, then Save.");
    }));
    if (!ro) {
      head.appendChild(btn("Rename", "c-lilac", null, function () { var name = window.prompt("Script name", def.name); if (name) { def.name = name.trim().slice(0, 24); sc.dirty = true; renderScript(); } }));
      head.appendChild(btn(sc.dirty ? "Save" : "Saved", sc.dirty ? "c-orange" : "c-peach", null, function () { if (!sc.dirty) return; C.saveScript(copyDef(def)); sc.dirty = false; renderScript(); say("Script saved."); }));
      head.appendChild(btn("Delete", "c-red", null, function () { if (!window.confirm("Delete script \"" + def.name + "\"?")) return; C.deleteScript(sc.id); loadScript(currentScriptId()); renderScript(); }));
    }
    var assigned = currentScriptId() === sc.id;
    head.appendChild(btn(assigned ? "✓ This ship flies it" : "Assign to this build", assigned ? "c-peach" : "c-purple", "The script the " + BS.Data.shipClasses[ed.classId].className + " undocks with", function () { if (!assigned) { if (sc.dirty) { C.saveScript(copyDef(def)); sc.dirty = false; } C.setScriptFor(ed.classId, sc.id); renderScript(); say("The ship will fly \"" + def.name + "\"."); } }));
    box.appendChild(head);
    if (def.desc || ro) { var ds = document.createElement("div"); ds.className = "sc-desc"; ds.textContent = (def.desc || "") + (ro ? " Templates are read-only: Copy as new to edit." : ""); box.appendChild(ds); }
    // rules
    (def.rules || []).forEach(function (r, i) { box.appendChild(ruleCard(r, i, ro)); });
    var foot = document.createElement("div"); foot.className = "sc-foot";
    if (!ro && (def.rules || []).length < SD().maxRules) foot.appendChild(btn("+ Rule", "c-blue", null, function () { def.rules.push({ when: {}, do: {} }); sc.dirty = true; renderScript(); }));
    // policies
    var pol = document.createElement("div"); pol.className = "sc-policies";
    Object.keys(SD().policies).forEach(function (k) {
      var l = document.createElement("label"), cb = document.createElement("input"); cb.type = "checkbox"; cb.disabled = ro;
      var on = def.policies && def.policies[k] && def.policies[k] !== false; cb.checked = !!on;
      cb.addEventListener("change", function () { def.policies = def.policies || {}; def.policies[k] = cb.checked ? (k === "lock" ? true : "auto") : false; sc.dirty = true; });
      l.appendChild(cb); l.appendChild(document.createTextNode(SD().policies[k].label)); pol.appendChild(l);
    });
    box.appendChild(pol);
    // dry run
    foot.appendChild(btn(sc.dry && sc.dry.running ? "Running… " + Math.round(sc.dry.t || 0) + " s" : "Dry run vs next enemy", "c-purple", "One simulated battle with this script against the next enemy (hit rolls are random; nothing is saved)", function () {
      if (sc.dry && sc.dry.running) return;
      if (ed.dirty) { say("Apply or revert your build first: the dry run flies the applied layout.", true); return; }
      sc.dry = { running: true, t: 0 }; renderScript();
      game.dryRun(copyDef(def), function (t) { sc.dry.t = t; var b = box.querySelector(".sc-foot .c-purple"); if (b) b.textContent = "Running… " + Math.round(t) + " s"; }, function (out) { sc.dry = { running: false, out: out }; renderScript(); });
    }));
    box.appendChild(foot);
    if (sc.dry && sc.dry.out) {
      var o = sc.dry.out, d2 = document.createElement("div"); d2.className = "sc-dry";
      var res = o.result === "victory" ? "Victory" + (o.how === "captured" ? " (captured)" : o.how === "disabled" ? " (disabled)" : "") : o.result === "defeat" ? "Defeat" : "Stalemate";
      d2.innerHTML = "<b>" + res + "</b> in " + U.formatTime(o.time) + " · our blocks " + o.hullPct + "% · their hull " + o.enemyHullPct + "%" + (o.scanned ? " · scanned" : " · never scanned") + "<br>" +
        o.trace.slice(0, 8).map(function (e) { return "<span class='t'>" + U.formatTime(e.t) + "</span> " + (e.rule !== null && e.rule !== undefined ? (e.rule + 1) + ". " : "") + escapeHtml(e.text); }).join("<br>") + (o.trace.length > 8 ? "<br><span class='t'>… " + (o.trace.length - 8) + " more</span>" : "") +
        (o.neverFired && o.neverFired.length ? "<br>" + o.neverFired.slice(0, 3).map(function (e) { return "<span class='nf'>Rule " + (e.rule + 1) + " never fired: " + escapeHtml(e.reason) + "</span>"; }).join("<br>") : "");
      box.appendChild(d2);
    }
  }
  function escapeHtml(t) { return String(t).replace(/[&<>]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]; }); }

  // One rule as a card: number, kind, WHEN terms, DO terms, optional until, and the sentence it reads as.
  function ruleCard(r, i, ro) {
    var def = sc.def, card = document.createElement("div"), isDefault = !r.when || !Object.keys(r.when).length;
    card.className = "rule" + (isDefault && !r.once && !r.every ? " otherwise" : "");
    var top = document.createElement("div"); top.className = "r-top";
    top.innerHTML = "<span class='n'>" + (i + 1) + "</span>";
    var kind = document.createElement("select"); kind.className = "lcars-select kind"; kind.disabled = ro;
    kind.innerHTML = "<option value='standing'>Standing orders</option><option value='once'>Once</option><option value='every'>Every N s</option>";
    kind.value = r.once ? "once" : r.every ? "every" : "standing";
    kind.addEventListener("change", function () { delete r.once; delete r.every; if (kind.value === "once") r.once = true; else if (kind.value === "every") r.every = 20; if (kind.value !== "standing") { delete r.until; delete r.holdMax; } sc.dirty = true; renderScript(); });
    top.appendChild(kind);
    if (r.every) { var ev = document.createElement("input"); ev.type = "number"; ev.min = 1; ev.max = 600; ev.value = r.every; ev.disabled = ro; ev.style.width = "52px"; ev.addEventListener("change", function () { r.every = Math.max(1, parseFloat(ev.value) || 20); sc.dirty = true; renderSentence(); }); top.appendChild(ev); top.appendChild(document.createTextNode("s")); }
    if (!ro) {
      var up = document.createElement("button"); up.className = "lcars-btn c-blue sq"; up.textContent = "▲"; up.disabled = i === 0; up.addEventListener("click", function () { def.rules.splice(i, 1); def.rules.splice(i - 1, 0, r); sc.dirty = true; renderScript(); });
      var dn = document.createElement("button"); dn.className = "lcars-btn c-blue sq"; dn.textContent = "▼"; dn.disabled = i === def.rules.length - 1; dn.addEventListener("click", function () { def.rules.splice(i, 1); def.rules.splice(i + 1, 0, r); sc.dirty = true; renderScript(); });
      var del = document.createElement("button"); del.className = "lcars-btn c-red sq"; del.textContent = "✕"; del.addEventListener("click", function () { def.rules.splice(i, 1); sc.dirty = true; renderScript(); });
      top.appendChild(up); top.appendChild(dn); top.appendChild(del);
    }
    card.appendChild(top);
    card.appendChild(termLine(isDefault && !r.once && !r.every ? "Otherwise" : "When", r.when || (r.when = {}), "cond", ro, function () { sc.dirty = true; renderScript(); }));
    card.appendChild(termLine("Do", r.do || (r.do = {}), "act", ro, function () { sc.dirty = true; renderScript(); }));
    if (!r.once && !r.every) {
      if (r.until || !ro) {
        var ul = termLine("Until", r.until || {}, "cond", ro, function (obj) { if (Object.keys(obj).length) r.until = obj; else delete r.until; sc.dirty = true; renderScript(); }, true);
        if (r.until || !ro) card.appendChild(ul);
      }
      if (r.until) {
        var hm = document.createElement("div"); hm.className = "r-line"; hm.innerHTML = "<b>At most</b>";
        var inp = document.createElement("input"); inp.type = "number"; inp.min = 0; inp.max = 600; inp.value = r.holdMax || ""; inp.placeholder = "∞"; inp.disabled = ro; inp.style.width = "58px";
        inp.addEventListener("change", function () { var v = parseFloat(inp.value); if (v > 0) r.holdMax = v; else delete r.holdMax; sc.dirty = true; renderSentence(); });
        var tm = document.createElement("span"); tm.className = "term"; tm.appendChild(inp); tm.appendChild(document.createTextNode("s")); hm.appendChild(tm); card.appendChild(hm);
      }
    }
    var sayEl = document.createElement("div"); sayEl.className = "r-say"; card.appendChild(sayEl);
    var warn = document.createElement("div"); warn.className = "r-warn"; card.appendChild(warn);
    function renderSentence() {
      sayEl.textContent = "“" + BS.Script.describe(r, def) + "”";
      var w = [];
      var a = r.do && r.do.aim;
      if (a && typeof a === "object" && !(def.rules || []).some(function (q) { return q.do && q.do.scan; })) w.push("Aiming at a weak point or a plan target needs a scan: add a rule that scans them.");
      if (isDefault && !r.once && !r.every && i !== def.rules.length - 1 && def.rules.slice(i + 1).some(function (q) { return !q.once && !q.every; })) w.push("An Otherwise rule only stands when nothing above it does; rules below it still take over when they hold.");
      if (!Object.keys(r.do || {}).length) w.push("This rule does nothing yet.");
      warn.textContent = w.join(" ");
    }
    renderSentence();
    return card;
  }
  // A line of terms (conditions or actions) with a "+ and" dropdown. `onChange(obj)` is told after any change.
  function termLine(label, obj, mode, ro, onChange, optional) {
    var line = document.createElement("div"); line.className = "r-line";
    line.innerHTML = "<b>" + label + "</b>";
    var V = mode === "cond" ? SD().conditions : SD().actions;
    var keys = mode === "act" ? actionKeys(obj) : Object.keys(obj);
    keys.forEach(function (k) {
      var t = document.createElement("span"); t.className = "term";
      var lab = document.createElement("span"); lab.textContent = termLabel(k, obj, mode); t.appendChild(lab);
      var val = valueInput(k, obj, mode, ro, function () { onChange(obj); });
      if (val) t.appendChild(val);
      if (!ro) { var x = document.createElement("span"); x.className = "x"; x.textContent = "✕"; x.title = "Remove"; x.addEventListener("click", function () { removeTerm(k, obj, mode); onChange(obj); }); t.appendChild(x); }
      line.appendChild(t);
    });
    if (!ro) {
      var add = document.createElement("select"); add.className = "add";
      var first = document.createElement("option"); first.value = ""; first.textContent = keys.length ? "+ and…" : (optional ? "+ until…" : (mode === "cond" ? "+ condition…" : "+ action…")); add.appendChild(first);
      Object.keys(V).forEach(function (k) {
        if (mode === "act" && (k === "doctrine")) return;
        if (mode === "act" && k === "modules") { Object.keys(BS.Data.modules).forEach(function (id) { if (BS.Data.modules[id].kind === "turretGroup" || BS.Data.modules[id].kind === "launcherGroup") return; var o = document.createElement("option"); o.value = "modules." + id; o.textContent = BS.Data.modules[id].name + " on / off"; add.appendChild(o); }); return; }
        if (keys.indexOf(k) >= 0) return;
        var o = document.createElement("option"); o.value = k; o.textContent = plainLabel(V[k].label); add.appendChild(o);
      });
      add.addEventListener("change", function () { if (!add.value) return; addTerm(add.value, obj, mode); onChange(obj); });
      line.appendChild(add);
    }
    return line;
  }
  function plainLabel(l) { return l.replace("{v}", "…"); }
  function actionKeys(act) {
    var out = [];
    Object.keys(act).forEach(function (k) { if (k === "modules") Object.keys(act.modules).forEach(function (id) { out.push("modules." + id); }); else out.push(k); });
    return out;
  }
  function termLabel(k, obj, mode) {
    if (k.indexOf("modules.") === 0) { var id = k.slice(8); return id === "weapons" ? "weapons" : (BS.Data.modules[id] ? BS.Data.modules[id].name.toLowerCase() : id); }
    var V = mode === "cond" ? SD().conditions : SD().actions, d = V[k]; if (!d) return k;
    if (mode === "cond" && d.kind === "bool") return "";
    var parts = d.label.split("{v}");
    return parts[0].trim();
  }
  function addTerm(k, obj, mode) {
    if (k.indexOf("modules.") === 0) { obj.modules = obj.modules || {}; obj.modules[k.slice(8)] = true; return; }
    var V = mode === "cond" ? SD().conditions : SD().actions, d = V[k];
    if (mode === "cond") obj[k] = d.kind === "flag" ? true : d.kind === "bool" ? (d.def !== undefined ? d.def : true) : d.def;
    else obj[k] = { stance: "engage", play: "alpha", side: "blind", aim: "reactor", weapons: true, governor: true, repair: "shield", reinforce: true, scan: true, board: true, roll: true }[k];
  }
  function removeTerm(k, obj, mode) {
    if (k.indexOf("modules.") === 0) { delete obj.modules[k.slice(8)]; if (!Object.keys(obj.modules).length) delete obj.modules; return; }
    delete obj[k];
  }
  // The value control for a term: number (km / s / count), slider (fractions), on / off, or a dropdown.
  function valueInput(k, obj, mode, ro, onChange) {
    var V = mode === "cond" ? SD().conditions : SD().actions;
    function sel(options, value, set) { var s = document.createElement("select"); s.disabled = ro; options.forEach(function (o) { var e = document.createElement("option"); e.value = o[0]; e.textContent = o[1]; s.appendChild(e); }); s.value = value; s.addEventListener("change", function () { set(s.value); onChange(); }); return s; }
    function num(value, set, suffix) { var w = document.createElement("span"); var n = document.createElement("input"); n.type = "number"; n.step = "any"; n.value = value; n.disabled = ro; n.addEventListener("change", function () { set(parseFloat(n.value) || 0); onChange(); }); w.appendChild(n); if (suffix) w.appendChild(document.createTextNode(" " + suffix)); return w; }
    function pct(value, set) { var w = document.createElement("span"); var rg = document.createElement("input"); rg.type = "range"; rg.min = 0; rg.max = 100; rg.step = 5; rg.value = Math.round(value * 100); rg.disabled = ro; var pv = document.createElement("span"); pv.className = "pv"; pv.textContent = Math.round(value * 100) + "%"; rg.addEventListener("input", function () { pv.textContent = rg.value + "%"; }); rg.addEventListener("change", function () { set(parseInt(rg.value, 10) / 100); onChange(); }); w.appendChild(rg); w.appendChild(pv); return w; }
    if (k.indexOf("modules.") === 0) { var id = k.slice(8); return sel([["on", "on"], ["off", "off"]], obj.modules[id] ? "on" : "off", function (v) { obj.modules[id] = v === "on"; }); }
    var d = V[k]; if (!d) return null;
    if (mode === "cond") {
      switch (d.kind) {
        case "km": return num(obj[k], function (v) { obj[k] = v; }, "km");
        case "sec": return num(obj[k], function (v) { obj[k] = v; }, "s");
        case "count": return num(obj[k], function (v) { obj[k] = Math.max(1, Math.round(v)); }, "");
        case "pct": return pct(obj[k], function (v) { obj[k] = v; });
        case "bool": return sel([["1", d.label], ["0", d.negLabel || ("not: " + d.label)]], obj[k] ? "1" : "0", function (v) { obj[k] = v === "1"; });
        case "type": return sel(Object.keys(BS.Data.blocks).map(function (b) { return [b, BS.Data.blocks[b].name.toLowerCase() + "s"]; }), obj[k], function (v) { obj[k] = v; });
        case "state": return sel(Object.keys(BS.Data.enemyAI.stateLabels).map(function (st) { return [st, BS.Data.enemyAI.stateLabels[st]]; }), obj[k], function (v) { obj[k] = v; });
        case "stance": return sel(Object.keys(BS.Data.enemyAI.stanceLabels).map(function (st) { return [st, BS.Data.enemyAI.stanceLabels[st]]; }), obj[k], function (v) { obj[k] = v; });
        case "aiming": return sel(Object.keys(BS.Data.enemyAI.aimLabels).map(function (st) { return [st, BS.Data.enemyAI.aimLabels[st]]; }), obj[k], function (v) { obj[k] = v; });
        case "band": return sel(Object.keys(SD().rangeBands).map(function (st) { return [st, SD().rangeBands[st]]; }), obj[k], function (v) { obj[k] = v; });
        default: return null;
      }
    }
    switch (k) {
      case "stance": return sel(Object.keys(BS.Data.helm.stances).map(function (id) { return [id, BS.Data.helm.stances[id].label]; }), obj[k], function (v) { obj[k] = v; });
      case "play": return sel(Object.keys(BS.Data.helm.plays).map(function (id) { return [id, BS.Data.helm.plays[id].label]; }), obj[k], function (v) { obj[k] = v; });
      case "side": return sel(Object.keys(BS.Data.helm.sides).map(function (id) { return [id, BS.Data.helm.sides[id].label.toLowerCase()]; }), obj[k], function (v) { obj[k] = v; });
      case "weapons": case "governor": return sel([["on", "on"], ["off", "off"]], obj[k] ? "on" : "off", function (v) { obj[k] = v === "on"; });
      case "repair": return sel([["", "automatic"]].concat(Object.keys(BS.Data.blocks).map(function (b) { return [b, BS.Data.blocks[b].name.toLowerCase() + "s"]; })), obj[k] || "", function (v) { obj[k] = v || null; });
      case "aim": {
        var opts = [["hull", "anything (full accuracy)"], ["exposed", "bare hull"], ["structure", "their necks and pylons"]];
        Object.keys(BS.Data.blocks).forEach(function (b) { opts.push([b, "their " + BS.Data.blocks[b].name.toLowerCase() + "s"]); });
        Object.keys(SD().weakKinds).forEach(function (w) { opts.push(["weak:" + w, "weak point: " + SD().weakKinds[w] + " (needs a scan)"]); });
        for (var n = 0; n < SD().planTargets; n++) opts.push(["plan:" + n, "plan target " + (n + 1) + " (needs a scan)"]);
        var cur = obj[k], v = cur === null || cur === undefined ? "hull" : typeof cur === "string" ? cur : cur.weak ? "weak:" + cur.weak : "plan:" + cur.plan;
        return sel(opts, v, function (val) { if (val === "hull") obj[k] = null; else if (val.indexOf("weak:") === 0) obj[k] = { weak: val.slice(5) }; else if (val.indexOf("plan:") === 0) obj[k] = { plan: parseInt(val.slice(5), 10) }; else obj[k] = val; });
      }
      default: return null;   // flags: reinforce, scan, board
    }
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
