// js/ui.js — DOM: status panel, overview, selected-item commands, module bar,
// comms log, alert lighting, overlays, mouse and keyboard input.
window.BS = window.BS || {};

BS.UI = (function () {
  var U = BS.Util, S = BS.Ships;
  var $ = function (id) { return document.getElementById(id); };
  var el = {};
  var game = null;
  var logList, MAX_LOG = 80;
  var subscribed = false;
  var moduleEls = [];
  var overviewRows = {};

  function init(gameRef) {
    game = gameRef;
    ["own-speed", "own-cmd", "own-subsystems", "enemy-subsystems", "gauge", "help-screen", "btn-help", "btn-help-close",
     "target-none", "target-info", "tg-name", "tg-hull", "tg-hull-val", "tg-shield", "tg-shield-val", "tg-range", "tg-angular", "tg-chance", "tg-aim",
     "clock", "alert-label", "btn-pause", "btn-redalert", "btn-zoom-in", "btn-zoom-out", "pause-overlay", "start-screen", "result-screen", "result-title", "result-sub", "result-head",
     "rs-time", "rs-dealt", "rs-taken", "rs-hull", "rs-phasers", "rs-torps", "rs-credits", "rs-salvage", "heat-bar", "heat-num", "btn-governor", "own-heat", "own-crew", "own-boarding", "own-boarding-row", "btn-board", "scan-view", "scan-info", "btn-log", "side-buttons", "ship-name", "view", "module-bar", "overview", "sel-name", "play-buttons", "trace", "speed-buttons", "call-tokens", "call-play", "call-side", "btn-focus", "bridge-calls", "rs-clean", "rs-script", "btn-retry"]
      .forEach(function (id) { el[id] = $(id); });
    logList = $("log");
    buildGauge();
    buildSubsystemWidgets();
    buildPlayButtons();

    document.querySelectorAll("[data-cmd]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var args = {};
        if (btn.hasAttribute("data-range")) args.rangeKm = parseFloat(btn.getAttribute("data-range"));
        if (btn.hasAttribute("data-stance")) args.stance = btn.getAttribute("data-stance");
        if (btn.hasAttribute("data-play")) args.play = btn.getAttribute("data-play");
        if (btn.hasAttribute("data-side")) args.side = btn.getAttribute("data-side");
        game.command(btn.getAttribute("data-cmd"), args); btn.blur();
      });
    });
    el["btn-pause"].addEventListener("click", function () { game.togglePause(); el["btn-pause"].blur(); });
    el["btn-redalert"].addEventListener("click", function () { game.command("redAlert"); el["btn-redalert"].blur(); });
    el["btn-governor"].addEventListener("click", function () { game.command("governor"); el["btn-governor"].blur(); });
    el["btn-zoom-in"].addEventListener("click", function () { game.setZoom(game.state.zoom + BS.Data.balance.zoom.step); });
    el["btn-zoom-out"].addEventListener("click", function () { game.setZoom(game.state.zoom - BS.Data.balance.zoom.step); });
    $("btn-start").addEventListener("click", function () { game.openHangar(); });
    el["btn-help"].addEventListener("click", function () { el["help-screen"].classList.remove("hidden"); });
    bindCompact();
    el["btn-help-close"].addEventListener("click", function () { el["help-screen"].classList.add("hidden"); });
    $("btn-restart").addEventListener("click", function () { game.openHangar(); });
    $("btn-retry").addEventListener("click", function () { BS.Campaign.setRetry(game.state.encounter); game.openHangar(); });
    bindCanvas();
    bindKeys();
    bindBridge();
    setManual(!!(BS.Campaign.get().settings || {}).manualBridge);
    if (!subscribed) { subscribe(); subscribed = true; }
  }
  // Manual bridge (debug): the hand-flown controls and their keys; off, the script fights and the captain has calls.
  function setManual(on) { document.body.classList.toggle("manual-bridge", !!on); }
  function manual() { return document.body.classList.contains("manual-bridge"); }

  // ---- bridge calls and speed ---------------------------------------------------------------------------------
  // A call button arms itself for script.bridgeCall.confirmSeconds and fires on the second press; a focus call
  // needs a block tapped on the scan panel first (pendingFocus).
  var armed = null, armTimer = null, pendingFocus = null, traceEntries = [];
  function disarm() { if (armed) { armed.btn.classList.remove("armed"); armed.btn.textContent = armed.label; } armed = null; if (armTimer) { clearTimeout(armTimer); armTimer = null; } }
  function armOrFire(btn, call) {
    if (game.state.phase !== "battle") return;
    if (game.state.calls <= 0) { BS.Events.emit("bridgeCallRefused", { call: call }); return; }
    if (armed && armed.btn === btn) { var c = armed.call; disarm(); var r = game.bridgeCall(c); if (r === "ok" && c.kind === "focus") { pendingFocus = null; updateFocusButton(); } return; }
    disarm();
    armed = { btn: btn, call: call, label: btn.textContent };
    btn.classList.add("armed"); btn.textContent = "Confirm · 1 call";
    armTimer = setTimeout(disarm, BS.Data.script.bridgeCall.confirmSeconds * 1000);
  }
  function bindBridge() {
    var P = BS.Data.helm.plays, sp = el["call-play"], ss = el["call-side"];
    Object.keys(P).forEach(function (id) { var o = document.createElement("option"); o.value = id; o.textContent = P[id].label; sp.appendChild(o); });
    Object.keys(BS.Data.helm.sides).forEach(function (id) { var o = document.createElement("option"); o.value = id; o.textContent = BS.Data.helm.sides[id].label; ss.appendChild(o); });
    ss.value = "blind";
    document.querySelectorAll("#bridge-calls [data-call]").forEach(function (b) {
      b.addEventListener("click", function () {
        var kind = b.getAttribute("data-call"), call = { kind: kind };
        if (kind === "play") call = { kind: "play", value: sp.value };
        if (kind === "side") call = { kind: "side", value: ss.value };
        if (kind === "focus") { if (!pendingFocus) return; call = { kind: "focus", value: { x: pendingFocus.x, y: pendingFocus.y } }; }
        armOrFire(b, call); b.blur();
      });
    });
    var speeds = BS.Data.balance.speeds;
    speeds.forEach(function (x) { var b = document.createElement("button"); b.className = "lcars-btn c-peach" + (x === 1 ? " active" : ""); b.textContent = x + "×"; b.title = "Battle speed " + x + "×"; b.addEventListener("click", function () { game.setSpeed(x); b.blur(); }); el["speed-buttons"].appendChild(b); });
    BS.Events.on("speedChanged", function (e) { el["speed-buttons"].querySelectorAll("button").forEach(function (b) { b.classList.toggle("active", parseFloat(b.textContent) === e.speed); }); });
    BS.Events.on("scriptRule", function (e) { if (e.ship === game.state.player) { traceEntries.push(e.entry); if (traceEntries.length > 3) traceEntries.shift(); renderTrace(); } });
    BS.Events.on("battleStarted", function () { traceEntries = []; renderTrace(); pendingFocus = null; disarm(); updateFocusButton(); });
  }
  function renderTrace() {
    el["trace"].innerHTML = traceEntries.map(function (en) {
      return "<div class='tr " + (en.kind || "") + "'><span class='t'>" + U.formatTime(en.t) + "</span><span class='r'>" + (en.kind === "call" ? "CALL" : en.kind === "manual" ? "MAN" : en.rule !== null && en.rule !== undefined ? "r" + (en.rule + 1) : "—") + "</span><span class='m'>" + escapeHtml(en.text) + "</span></div>";
    }).join("");
  }
  function escapeHtml(t) { return String(t).replace(/[&<>]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]; }); }
  function updateFocusButton() {
    var b = el["btn-focus"]; if (!b) return;
    if (armed && armed.btn === b) return;
    if (pendingFocus) { b.classList.remove("off"); b.textContent = "Focus: " + pendingFocus.label; }
    else { b.classList.add("off"); b.textContent = "Focus block · tap on SCAN"; }
  }
  function pickFocus(block) {
    if (!block || !block.alive) return;
    pendingFocus = { x: block.x, y: block.y, label: (block.structural ? "structure" : block.def.name) + " " + block.x + "," + block.y };
    disarm(); updateFocusButton();
  }

  function subscribe() {
    BS.Events.on("log", function (e) { addLog(e.speaker, e.text, e.cls); });
    el["btn-log"].addEventListener("click", function () { document.getElementById("comms").classList.toggle("expanded"); });
    // scan panel: a weak-point line or a block on the drawing focuses fire on that block
    el["scan-info"].addEventListener("click", function (ev) {
      var row = ev.target.closest ? ev.target.closest("[data-wp]") : null;
      if (!row || !scanWeak) return;
      var wp = scanWeak[parseInt(row.getAttribute("data-wp"), 10)];
      if (!wp) return;
      if (manual()) game.command("aimBlock", { block: wp.block, label: wp.label }); else pickFocus(wp.block);
    });
    el["scan-view"].addEventListener("click", function (ev) {
      var e = game.state.enemy, p = game.state.player, cv = el["scan-view"];
      if (!e || !p || p.lock.target !== e || !p.lock.locked) return;
      var r = cv.getBoundingClientRect(), g = e.grid, cp = g.cellPx, k = Math.min(cv.width / (g.h * cp), cv.height / (g.w * cp)) * 0.88;
      var cx = (ev.clientX - r.left) * cv.width / r.width, cy = (ev.clientY - r.top) * cv.height / r.height;
      var lx = (cv.height / 2 - cy) / k, ly = (cx - cv.width / 2) / k, b = BS.Grid.blockAtWorld(e, lx, ly, 1);
      if (!b || !b.alive) return;
      if (manual()) game.command("aimBlock", { block: b }); else pickFocus(b);
    });
    Object.keys(BS.Data.helm.sides).forEach(function (id) {
      var sd = BS.Data.helm.sides[id], b = document.createElement("button");
      b.className = "lcars-btn c-blue"; b.setAttribute("data-cmd", "side"); b.setAttribute("data-side", id); b.textContent = sd.label; b.title = sd.desc;
      b.addEventListener("click", function () { game.command("side", { side: id }); b.blur(); });
      el["side-buttons"].appendChild(b);
    });
    BS.Events.on("alertChanged", function (e) { if (e.ship.isPlayer) setAlert(e.alert); });
  }

  // ---- generated widgets ----------------------------------------------
  function buildSubsystemWidgets() {
    var blocks = BS.Data.blocks;
    el["own-subsystems"].innerHTML = ""; el["enemy-subsystems"].innerHTML = "";
    Object.keys(blocks).forEach(function (type) {
      var d = blocks[type];
      var row = document.createElement("div"); row.className = "row"; row.title = d.name + ": " + d.desc + " Click to make it the repair priority.";
      row.innerHTML = '<label>' + d.name.split(" ")[0] + '</label><div class="bar sub"><div class="fill"></div></div><span class="num">0</span>';
      row.querySelector("label").insertBefore(BS.Renderer.blockIcon(type, 12), row.querySelector("label").firstChild);
      row.addEventListener("click", function () { game.command("repair", { type: type }); });
      el["own-subsystems"].appendChild(row);
      el["sub-" + type] = row.querySelector(".fill"); el["sub-" + type + "-val"] = row.querySelector(".num"); el["subrow-" + type] = row;
      var chip = document.createElement("span"); chip.className = "chip"; chip.title = "Aim at their " + d.name.toLowerCase() + "s";
      chip.appendChild(BS.Renderer.blockIcon(type, 12)); var chipText = document.createElement("span"); chipText.textContent = d.short; chip.appendChild(chipText);
      chip.addEventListener("click", function () { game.command("aim", { type: type }); });
      el["enemy-subsystems"].appendChild(chip); el["en-" + type] = chip;
    });
    // hull outside every shield bubble: hits there skip the shield entirely
    var ex = document.createElement("span"); ex.className = "chip exposed"; ex.title = "Aim at hull outside their shield cover: nothing absorbs those hits (−15% accuracy)";
    ex.textContent = "EXP 0"; ex.addEventListener("click", function () { game.command("aim", { type: "exposed" }); });
    el["enemy-subsystems"].appendChild(ex); el["en-exposed"] = ex;
    var sx = document.createElement("span"); sx.className = "chip exposed"; sx.title = "Aim at their structural members (necks, pylons): 400 hp each, torpedoes do double to them, and a cut section takes everything on it (−15% accuracy)";
    sx.textContent = "STRUCT"; sx.addEventListener("click", function () { game.command("aim", { type: "structure" }); });
    el["enemy-subsystems"].appendChild(sx); el["en-structure"] = sx;
  }
  var playEls = {};
  function buildPlayButtons() {
    var plays = BS.Data.helm.plays;
    el["play-buttons"].innerHTML = ""; playEls = {};
    Object.keys(plays).forEach(function (id) {
      var P = plays[id], b = document.createElement("button");
      b.className = "lcars-btn c-peach"; b.setAttribute("data-cmd", "play"); b.setAttribute("data-play", id);
      b.textContent = P.label; b.title = P.key + ": " + P.desc;   // the generic [data-cmd] handler sends the command
      el["play-buttons"].appendChild(b); playEls[id] = b;
    });
  }

  // Circular ship gauge: hull (centre), four shield facings (middle), capacitor (outer).
  var gauge = {};
  function arcPath(cx, cy, r, a0, a1) {
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    return "M " + x0.toFixed(2) + " " + y0.toFixed(2) + " A " + r + " " + r + " 0 " + large + " 1 " + x1.toFixed(2) + " " + y1.toFixed(2);
  }
  function buildGauge() {
    var NS = "http://www.w3.org/2000/svg", C = 59;
    var svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 118 118");
    function mk(tag, attrs) { var e = document.createElementNS(NS, tag); Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); svg.appendChild(e); return e; }
    mk("circle", { class: "bg", cx: C, cy: C, r: 50, "stroke-width": 7 });
    gauge.capbg = mk("path", { class: "capbg", d: arcPath(C, C, 50, -Math.PI / 2, Math.PI * 1.5 - 0.001), "stroke-width": 7 });
    gauge.cap = mk("path", { class: "cap", d: "", "stroke-width": 7 });
    gauge.heat = mk("path", { class: "heat", d: "", "stroke-width": 3 });
    mk("circle", { class: "bg", cx: C, cy: C, r: 38, "stroke-width": 8 });
    // facings: fore top, starboard right, aft bottom, port left; each spans 80° around its centre
    gauge.sh = {};
    var centres = { fore: -Math.PI / 2, starboard: 0, aft: Math.PI / 2, port: Math.PI };
    S.FACINGS.forEach(function (f) { gauge.sh[f] = mk("path", { class: "sh", d: "", "stroke-width": 8, "data-c": centres[f] }); });
    mk("circle", { class: "bg", cx: C, cy: C, r: 26, "stroke-width": 9 });
    gauge.hull = mk("path", { class: "hull", d: "", "stroke-width": 9 });
    gauge.pct = mk("text", { class: "pct", x: C, y: C + 4 }); gauge.pct.textContent = "100%";
    gauge.lbl = mk("text", { class: "lbl", x: C, y: C + 15 }); gauge.lbl.textContent = "HULL";
    gauge.capnum = mk("text", { class: "capnum", x: C, y: C + 70 }); gauge.capnum.textContent = "";
    el["gauge"].innerHTML = ""; el["gauge"].appendChild(svg);
  }
  function updateGauge(p) {
    var C = 59, hf = p.hull / p.hullMax, cf = p.capacitor / p.capMax;
    gauge.hull.setAttribute("d", hf > 0.002 ? arcPath(C, C, 26, -Math.PI / 2, -Math.PI / 2 + U.TAU * Math.min(0.999, hf)) : "");
    gauge.hull.style.stroke = hullColor(hf);
    gauge.pct.textContent = Math.round(hf * 100) + "%";
    S.FACINGS.forEach(function (f) {
      var frac = S.shieldFrac(p, f), c = parseFloat(gauge.sh[f].getAttribute("data-c")), half = (80 * U.DEG / 2) * frac;
      gauge.sh[f].setAttribute("d", frac > 0.01 ? arcPath(C, C, 38, c - half, c + half) : "");
      gauge.sh[f].style.stroke = pctColor(frac);
    });
    gauge.cap.setAttribute("d", cf > 0.002 ? arcPath(C, C, 50, -Math.PI / 2, -Math.PI / 2 + U.TAU * Math.min(0.999, cf)) : "");
    gauge.cap.style.opacity = cf < 0.2 ? 0.5 + 0.5 * Math.sin(performance.now() / 100) : 1;
    gauge.capnum.textContent = "CAP " + Math.round(p.capacitor) + " / " + p.capMax;
    var hf2 = p.stats.heatCap > 0 ? p.heat / p.stats.heatCap : 0;
    gauge.heat.setAttribute("d", hf2 > 0.01 ? arcPath(C, C, 56, -Math.PI / 2, -Math.PI / 2 + U.TAU * Math.min(0.999, hf2)) : "");
    gauge.heat.style.stroke = p.overload > 0 ? "#ff4040" : hf2 > 0.75 ? "#ff8a3d" : "#f2c14e";
    gauge.heat.style.opacity = p.overload > 0 ? 0.5 + 0.5 * Math.sin(performance.now() / 80) : 1;
    gauge.lbl.textContent = p.overload > 0 ? "OVERLOAD" : "HULL";
  }

  // Module bar: one round button per fitted module, F-key labelled.
  function buildModuleBar(ship) {
    el["module-bar"].innerHTML = ""; moduleEls = [];
    var active = ship.modules.filter(function (m) { return m.def.kind !== "passive"; });
    active.forEach(function (m, i) {
      var b = document.createElement("div"); b.className = "module";
      var capText = m.def.capText || (m.def.cap ? m.def.cap + " cap" : (BS.Data.blocks[m.def.block].weapon.cap + " cap/shot"));
      b.innerHTML = '<span class="key">F' + (i + 1) + '</span><div class="ring"></div><span class="short">' + m.def.short + '</span><span class="capcost">' + capText + '</span><span class="state"></span>';
      b.title = m.def.name + " — " + m.def.desc + (m.def.cycle ? " Cycle " + m.def.cycle + " s, " + m.def.cap + " capacitor per cycle." : "");
      b.addEventListener("click", function () { if (manual()) game.command("module", { module: m }); });
      el["module-bar"].appendChild(b);
      moduleEls.push({ el: b, m: m, ring: b.querySelector(".ring"), state: b.querySelector(".state") });
    });
  }

  // ---- compact mode (phone landscape): drawers and fullscreen --------------------------------
  // The CSS turns the panels into drawers under 540 px of height; the tabs toggle body classes. Starting a battle
  // closes them so the display is clear; fullscreen asks for landscape where the browser allows it.
  function bindCompact() {
    document.querySelectorAll("#drawer-tabs [data-drawer]").forEach(function (b) {
      var id = b.getAttribute("data-drawer");
      b.addEventListener("click", function () {
        var on = document.body.classList.toggle("drawer-" + id);
        b.classList.toggle("active", on);
        if (on && id !== "scan") { var other = id === "status" ? "orders" : "status"; if (window.innerWidth < 700) closeDrawer(other); }   // no room for both on a phone
        b.blur();
      });
    });
    var full = document.getElementById("btn-full");
    if (full) full.addEventListener("click", function () {
      var root = document.documentElement;
      if (!document.fullscreenElement && root.requestFullscreen) {
        root.requestFullscreen().then(function () { if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(function () {}); }).catch(function () {});
      } else if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen();
      full.blur();
    });
    BS.Events.on("battleStarted", function () { ["status", "orders", "scan"].forEach(closeDrawer); });
  }
  function closeDrawer(id) {
    document.body.classList.remove("drawer-" + id);
    var b = document.querySelector("#drawer-tabs [data-drawer='" + id + "']"); if (b) b.classList.remove("active");
  }

  // ---- canvas input --------------------------------------------------------
  function bindCanvas() {
    var view = el["view"];
    function worldAt(ev) { var r = view.getBoundingClientRect(); return BS.Renderer.screenToWorld(ev.clientX - r.left, ev.clientY - r.top); }
    // touch: a finger is about 26 screen px wide, so the search radius grows as the camera zooms out
    function hoverAt(ev, touch) {
      var s = game.state;
      if (s.phase !== "battle" || !s.enemy || s.enemy.flags.destroyed || BS.Ships.visibility(s.enemy, s.player) < 1) { game.setHover(null); return null; }
      var w = worldAt(ev);
      var tol = touch ? Math.max(2, Math.ceil(26 / (Math.max(0.05, s.zoom) * BS.Data.grid.cellPx))) : (s.zoom < 0.8 ? 2 : 1);
      var b = BS.Grid.blockAtWorld(s.enemy, w.x, w.y, tol);
      var h = b ? { ship: s.enemy, block: b } : null;
      game.setHover(h);
      return h;
    }
    view.addEventListener("mousemove", function (ev) {
      var h = hoverAt(ev);
      view.classList.toggle("can-target", !!h);
      view.classList.toggle("on-hardpoint", !!(h && h.block && !h.block.structural));
    });
    view.addEventListener("mouseleave", function () { game.setHover(null); view.classList.remove("can-target", "on-hardpoint"); });
    view.addEventListener("click", function (ev) {
      if (performance.now() - lastTouchAt < 700) return;   // a tap was handled by the touch code below
      var s = game.state, h = hoverAt(ev);
      if (!h) return;
      var p = s.player, e = s.enemy;
      if (p.lock.target !== e) { game.command("select", { target: e }); game.command("lock", { target: e }); return; }
      if (!manual()) { if (h.block) pickFocus(h.block); return; }
      if (h.block && !h.block.structural) game.command("aim", { type: h.block.type });
    });
    view.addEventListener("dblclick", function (ev) {
      var h = hoverAt(ev);
      if (h || !manual()) return;
      game.command("flyTo", { point: worldAt(ev) });
    });
    view.addEventListener("contextmenu", function (ev) {
      ev.preventDefault();
      var s = game.state, h = hoverAt(ev);
      if (s.phase !== "battle" || !manual()) return;
      if (h) { game.command("select", { target: s.enemy }); game.command("stance", { target: s.enemy, stance: "engage" }); }
      else game.command("flyTo", { point: worldAt(ev) });
    });
    view.addEventListener("wheel", function (ev) {
      ev.preventDefault();
      var Z = BS.Data.balance.zoom;
      game.setZoom(game.state.zoom + (ev.deltaY < 0 ? Z.step : -Z.step));
    }, { passive: false });
    bindTouch(view, hoverAt, worldAt);
  }

  // Touch: tap the enemy = select and lock, tap one of its blocks (locked) = aim at that type, long-press the enemy =
  // Engage, long-press or double-tap empty space = fly there, two fingers = pinch zoom. Mouse events keep working;
  // the compatibility click a tap also fires is ignored for 700 ms (lastTouchAt).
  var lastTouchAt = -1e9;
  function bindTouch(view, hoverAt, worldAt) {
    var touches = {}, start = null, longTimer = null, lastTap = null, pinch = null;
    function count() { return Object.keys(touches).length; }
    function clearLong() { if (longTimer) { clearTimeout(longTimer); longTimer = null; } }
    function tapOrPress(ev, press, onEnemyAtStart) {   // onEnemyAtStart: the finger landed on the enemy (it may have moved during a long press)
      var s = game.state; if (s.phase !== "battle") return;
      lastTouchAt = performance.now();
      var h = hoverAt(ev, true), p = s.player, e = s.enemy;
      if (press) {
        if (!manual()) return;   // the script flies; long presses steer only on the manual bridge
        if (h || onEnemyAtStart) { game.command("select", { target: e }); game.command("stance", { target: e, stance: "engage" }); }
        else game.command("flyTo", { point: worldAt(ev) });
        return;
      }
      if (h) {
        if (p.lock.target !== e) { game.command("select", { target: e }); game.command("lock", { target: e }); }
        else if (!manual()) { if (h.block) pickFocus(h.block); }
        else if (h.block && !h.block.structural) game.command("aim", { type: h.block.type });
        lastTap = null;
        return;
      }
      var now = performance.now();
      if (lastTap && now - lastTap.t < 350 && Math.abs(lastTap.x - ev.clientX) < 30 && Math.abs(lastTap.y - ev.clientY) < 30) { game.command("flyTo", { point: worldAt(ev) }); lastTap = null; }
      else lastTap = { t: now, x: ev.clientX, y: ev.clientY };
    }
    view.addEventListener("pointerdown", function (ev) {
      if (ev.pointerType !== "touch") return;
      ev.preventDefault();
      touches[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      try { view.setPointerCapture(ev.pointerId); } catch (e) {}
      clearLong();
      if (count() === 2) {
        var ids = Object.keys(touches), a = touches[ids[0]], b = touches[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: game.state.zoom }; start = null;
        return;
      }
      start = { x: ev.clientX, y: ev.clientY, t: performance.now(), moved: false, id: ev.pointerId, ev: ev, onEnemy: game.state.phase === "battle" && !!hoverAt(ev, true) };
      longTimer = setTimeout(function () { longTimer = null; if (start && !start.moved && count() === 1) { tapOrPress(start.ev, true, start.onEnemy); start = null; } }, 500);
    });
    view.addEventListener("pointermove", function (ev) {
      if (ev.pointerType !== "touch" || !touches[ev.pointerId]) return;
      touches[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      if (pinch && count() === 2) {
        var ids = Object.keys(touches), a = touches[ids[0]], b = touches[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch.d > 0) game.setZoom(pinch.zoom * d / pinch.d);
        return;
      }
      if (start && ev.pointerId === start.id && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 12) { start.moved = true; clearLong(); }
    });
    function end(ev) {
      if (ev.pointerType !== "touch") return;
      delete touches[ev.pointerId];
      if (count() < 2) pinch = null;
      if (start && ev.pointerId === start.id) {
        clearLong();
        if (!start.moved && performance.now() - start.t < 500) tapOrPress(ev, false);
        start = null;
      }
    }
    view.addEventListener("pointerup", end);
    view.addEventListener("pointercancel", end);
  }

  function bindKeys() {
    window.addEventListener("keydown", function (ev) {
      var s = game.state;
      if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
      if (ev.key === "Escape") { el["help-screen"].classList.add("hidden"); return; }
      if (ev.code === "Space" && s.phase === "battle") { ev.preventDefault(); game.togglePause(); return; }
      if (s.phase !== "battle") return;
      if (ev.key.toLowerCase() === "g") { document.getElementById("comms").classList.toggle("expanded"); return; }
      if (!manual()) return;   // the script has the conn; the keys below are the manual bridge
      var fk = /^F(\d)$/.exec(ev.key);
      if (fk) { var i = parseInt(fk[1], 10) - 1; if (moduleEls[i]) { ev.preventDefault(); game.command("module", { module: moduleEls[i].m }); } return; }
      var stances = BS.Data.helm.stances, stanceKey = Object.keys(stances).filter(function (id) { return stances[id].key === ev.key; })[0];
      if (stanceKey) { game.command("stance", { stance: stanceKey }); return; }
      var plays = BS.Data.helm.plays, playKey = Object.keys(plays).filter(function (id) { return plays[id].key === ev.key; })[0];
      if (playKey) { game.command("play", { play: playKey }); return; }
      switch (ev.key.toLowerCase()) {
        case "l": game.command("lock"); break;
        case "h": game.command("governor"); break;
        case "b": { var ids = Object.keys(BS.Data.helm.sides), cur = ids.indexOf(game.state.player.attackSide); game.command("side", { side: ids[(cur + 1) % ids.length] }); break; }
        case "g": document.getElementById("comms").classList.toggle("expanded"); break;
        case "s": game.command("stop"); break;
        case "t": game.command("board"); break;
        case "r": game.command("redAlert"); break;
      }
    });
  }

  // ---- log -------------------------------------------------------------
  function addLog(speaker, text, cls) {
    var li = document.createElement("li");
    li.className = cls || "report";
    var off = BS.Data.crew.officers[speaker];
    var who = off ? off.title : speaker === "enemy" ? "Klingon" : speaker;
    var t = document.createElement("span"); t.className = "t"; t.textContent = U.formatTime(game ? game.state.time : 0);
    var w = document.createElement("span"); w.className = "who " + speaker; w.textContent = who;
    var m = document.createElement("span"); m.className = "msg"; m.textContent = text;
    li.appendChild(t); li.appendChild(w); li.appendChild(m);
    logList.insertBefore(li, logList.firstChild);
    while (logList.children.length > MAX_LOG) logList.removeChild(logList.lastChild);
  }
  function clearLog() { logList.innerHTML = ""; }

  // ---- alert -----------------------------------------------------------
  function setAlert(level) {
    document.body.classList.remove("alert-none", "alert-yellow", "alert-red");
    document.body.classList.add("alert-" + level);
    el["alert-label"].textContent = level === "red" ? "RED ALERT" : level === "yellow" ? "YELLOW ALERT" : "CONDITION GREEN · WEAPONS SAFE";
    el["btn-redalert"].classList.toggle("active", level === "red");
  }

  // ---- overlays --------------------------------------------------------
  function showStart() { el["start-screen"].classList.remove("hidden"); el["result-screen"].classList.add("hidden"); }
  function hideOverlays() { el["start-screen"].classList.add("hidden"); el["result-screen"].classList.add("hidden"); }
  function showResult(state) {
    var p = state.player, won = state.result === "victory";
    el["result-screen"].classList.remove("hidden");
    el["result-screen"].classList.toggle("victory", won); el["result-screen"].classList.toggle("defeat", !won);
    el["result-title"].textContent = won ? "Victory" : "Defeat";
    var disabled = state.resultHow === "disabled", captured = state.resultHow === "captured";
    el["result-head"].textContent = won ? (captured ? "BATTLE REPORT · ENEMY CAPTURED" : disabled ? "BATTLE REPORT · ENEMY DISABLED" : "BATTLE REPORT · ENEMY DESTROYED") : (disabled ? "BATTLE REPORT · SHIP DISABLED" : "BATTLE REPORT · SHIP LOST");
    el["result-sub"].textContent = won
      ? (captured ? "Your boarding party holds their bridge. The Klingon vessel is taken intact: a prize crew brings it home." : disabled ? "The Klingon vessel is dead in space, without weapons or engines. Salvage teams recover what they can." : "The Klingon vessel has been destroyed. Starfleet Command sends its compliments, Captain.")
      : (disabled ? "Without weapons or engines the ship drifted until the Klingons boarded. Starfleet will review the sensor logs." : "The ship was lost with all hands. Starfleet will review the sensor logs.");
    el["rs-time"].textContent = U.formatTime(state.time);
    el["rs-dealt"].textContent = Math.round(p.battle.damageDealt);
    el["rs-taken"].textContent = Math.round(p.battle.damageTaken);
    el["rs-hull"].textContent = Math.round(100 * p.hull / p.hullMax) + "%";
    el["rs-phasers"].textContent = p.battle.phaserHits + " / " + p.battle.phasersFired;
    el["rs-torps"].textContent = p.battle.torpedoHits + " / " + p.battle.torpedoesFired;
    var rw = state.reward;
    el["rs-credits"].textContent = rw ? "+" + rw.earned + " cr" + (rw.streak > 1 ? " (streak " + rw.streak + ")" : "") + " · " + BS.Campaign.get().credits.toLocaleString() + " cr total" : "—";
    el["rs-salvage"].textContent = rw && rw.salvage ? "+" + rw.salvage + " cr from the " + (rw.how === "captured" ? "prize (taken by boarding)" : rw.how === "disabled" ? "wreck (captured intact)" : "wreck") : "—";
    el["rs-clean"].textContent = rw && rw.clean ? "no bridge call spent · ×" + BS.Data.script.bridgeCall.noCallBonus + " (+" + rw.cleanBonus + " cr) · " + rw.cleanWins + " clean win" + (rw.cleanWins === 1 ? "" : "s") : won ? (state.callsUsed || 0) + " bridge call" + (state.callsUsed === 1 ? "" : "s") + " spent" : "—";
    el["btn-retry"].textContent = "Refit & retry · " + (state.enemy ? state.enemy.name : "same enemy");
    renderReport(state);
  }

  // Battle report: the script's timeline (every rule firing and bridge call), the end, and the rules that never
  // fired with the reason (BS.Script.explain).
  function renderReport(state) {
    var p = state.player, box = el["rs-script"], sc = p.script, won = state.result === "victory";
    if (!sc) { box.innerHTML = ""; return; }
    var html = "<h4>Script · " + escapeHtml(sc.def.name) + " · " + (state.callsUsed || 0) + " of " + BS.Data.script.bridgeCall.tokens + " bridge calls spent</h4><div class='tl'>";
    (p.scriptTrace || []).forEach(function (en) {
      html += "<div class='tr " + (en.kind || "") + "'><span class='t'>" + U.formatTime(en.t) + "</span><span class='r'>" + (en.kind === "call" ? "CALL" : en.kind === "manual" ? "MAN" : en.rule !== null && en.rule !== undefined ? "r" + (en.rule + 1) : "—") + "</span><span>" + escapeHtml(en.text) + "</span></div>";
    });
    var endText = won ? (state.resultHow === "captured" ? "Enemy captured" : state.resultHow === "disabled" ? "Enemy disabled" : "Enemy destroyed") : state.result === "defeat" ? (state.resultHow === "disabled" ? "Ship disabled" : "Ship lost") : "Stalemate";
    html += "<div class='tr end'><span class='t'>" + U.formatTime(state.time) + "</span><span class='r'>END</span><span>" + endText + "</span></div></div>";
    html += whySection(state);
    var nf = BS.Script.explain(p);
    if (nf.length) {
      html += "<h4>Never fired</h4>";
      nf.forEach(function (e) { html += "<div class='nf'><b>r" + (e.rule + 1) + "</b> " + escapeHtml(e.text) + "<br><span class='why'>— " + escapeHtml(e.reason) + "</span></div>"; });
    }
    // the rest of the fleet (0.32): every other hull of ours, its script, how it ended and which rules fired; and theirs
    var team = state.teams ? state.teams.player : [], eteam = state.teams ? state.teams.enemy : [];
    function hullPct(s) { var mx = 0, now = 0; s.grid.blocks.forEach(function (b) { if (!b.structural) { mx += b.maxHp; if (b.alive) now += b.hp; } }); return Math.round(100 * now / Math.max(1, mx)); }
    function ended(s) { return s.flags.destroyed ? "lost" : s.flags.captured ? "captured" : s.flags.disabled ? "disabled" : hullPct(s) + "% of blocks"; }
    if (team.length > 1) {
      html += "<h4>Fleet</h4>";
      team.forEach(function (s) {
        if (s === p) return;
        var fired = {}; (s.scriptTrace || []).forEach(function (en) { if (en.rule !== null && en.rule !== undefined && (en.kind === "standing" || en.kind === "callout")) fired[en.rule] = (fired[en.rule] || 0) + 1; });
        var fl = Object.keys(fired).map(function (k) { return "r" + (parseInt(k, 10) + 1) + "×" + fired[k]; }).join(" ");
        html += "<div class='nf'><b>" + escapeHtml(s.name) + "</b> · " + escapeHtml(s.script ? s.script.def.name : "no script") + " · " + ended(s) + "<br><span class='why'>" + (fl ? "rules fired: " + fl : "no rule fired") + (s.target ? " · last target " + escapeHtml(s.target.name) : "") + "</span></div>";
      });
    }
    if (eteam.length > 1) {
      html += "<h4>Their fleet</h4><div class='nf'>" + eteam.map(function (s) { return escapeHtml(s.name) + " (" + escapeHtml(s.cls.className) + ") " + (s.flags.destroyed ? "destroyed" : s.flags.captured ? "captured" : s.flags.disabled ? "disabled" : Math.round(100 * s.hull / s.hullMax) + "% hull"); }).join(" · ") + "</div>";
    }
    // their bridge: the enemy's script stays hidden, but every rule of theirs that fired is on record (and goes into
    // the opening book the hangar shows for this encounter)
    var e = state.enemy, et = e && e.scriptTrace ? e.scriptTrace.filter(function (en) { return en.rule !== null && en.rule !== undefined; }) : [];
    if (et.length) {
      html += "<h4>Their bridge · " + escapeHtml(e.name) + " (their rules, in their words)</h4><div class='tl'>";
      et.forEach(function (en) { var r = e.script && e.script.def.rules[en.rule]; html += "<div class='tr " + (en.kind || "") + "'><span class='t'>" + U.formatTime(en.t) + "</span><span class='r'>r" + (en.rule + 1) + "</span><span>" + escapeHtml(r && r.callout ? r.callout : en.text) + "</span></div>"; });
      html += "</div>";
    }
    box.innerHTML = html;
  }

  // Why you lost / what carried it (0.26): the pair of standing rules (theirs | ours) under which most of the damage
  // landed, the share it took, and the doctrine table's sentence for the two styles (BS.Game.styleTags).
  function whySection(state) {
    var p = state.player, e = state.enemy, won = state.result === "victory", at = state.attrib; if (!at || !e || !e.script || !p.script) return "";
    var map = won ? at.dealt : at.taken, total = 0, best = null;
    Object.keys(map).forEach(function (k) { total += map[k]; if (best === null || map[k] > map[best]) best = k; });
    if (!best || total <= 0) return "";
    var parts = best.split("|"), share = Math.round(100 * map[best] / total);
    function ruleText(ship, key) {
      if (key === "call") return "a bridge call stood";
      if (key === "none") return "no rule stood";
      var r = ship.script.def.rules[parseInt(key, 10)]; if (!r) return "no rule stood";
      return "r" + (parseInt(key, 10) + 1) + " stood: “" + (ship === e && r.callout ? r.callout : BS.Script.describe(r, ship.script.def)) + "”";
    }
    var sp = state.style ? state.style.player : null, se = state.style ? state.style.enemy : null;
    var pt = sp ? BS.Game.styleTags(sp, p) : [], et = se ? BS.Game.styleTags(se, e) : [];
    var row = won ? BS.Game.counterSentence(pt, et) : BS.Game.counterSentence(et, pt);
    var html = "<h4>" + (won ? "What carried it" : "Why you lost") + "</h4>";
    html += "<div class='nf'>" + escapeHtml(tuningLine(p, e)) + "<br><span class='why'>" + escapeHtml(tuningLine(e, p, true)) + "</span></div>";
    html += "<div class='nf'>" + share + "% of the damage " + (won ? "we dealt landed" : "we took landed") + " while their " + escapeHtml(ruleText(e, parts[0])) + "<br><span class='why'>… and our " + escapeHtml(ruleText(p, parts[1])) + "</span></div>";
    html += "<div class='nf'>Styles: ours " + escapeHtml(pt.join(", ") || "—") + " · theirs " + escapeHtml(et.join(", ") || "—") + "<br><span class='why'>" + (row ? "Table: " + escapeHtml(row.text) : "no pairing of these styles on the doctrine table") + "</span></div>";
    return html;
  }

  // "Our ammo vs their shields": the dominant ammo of one ship against the dominant frequency and alloy of the other,
  // with the ring's multipliers (BS.Grid.tuneMult).
  function tuningLine(a, b, theirs) {
    var T = BS.Data.tuning, sa = BS.Grid.tuningSummary(a.grid, true), sb = BS.Grid.tuningSummary(b.grid, true);
    var ammo = BS.Grid.dominantTune(sa.ammo), fq = BS.Grid.dominantTune(sb.frequency), al = BS.Grid.dominantTune(sb.alloy);
    if (!ammo) return (theirs ? "Their" : "Our") + " ammo: none";
    function m(d) { return d ? " ×" + BS.Grid.tuneMult(ammo, d).toFixed(2) : ""; }
    return (theirs ? "Their " : "Our ") + T.list[ammo].name + " ammo vs " + (theirs ? "our" : "their") + " shields " + (fq ? T.list[fq].name + m(fq) : "none") + " · armor " + (al ? T.list[al].name + m(al) : "none");
  }

  // Heat bar: fill, warning zones, where the next full salvo would land, governor state, overload countdown.
  function updateHeatBar(p) {
    var cap = p.stats.heatCap || 1, hf = U.clamp(p.heat / cap, 0, 1), bar = el["heat-bar"], track = bar.querySelector(".hb-track");
    track.querySelector(".hb-fill").style.width = (hf * 100).toFixed(1) + "%";
    var salvo = BS.Modules.pendingSalvoHeat(p), sm = track.querySelector(".hb-salvo");
    if (salvo > 0 && p.overload <= 0) { sm.style.display = "block"; sm.style.left = (Math.min(1, (p.heat + salvo) / cap) * 100).toFixed(1) + "%"; sm.style.background = p.heat + salvo > cap ? "#ff4040" : "rgba(255,255,255,0.7)"; } else sm.style.display = "none";
    bar.classList.toggle("hot", hf > 0.6 && p.overload <= 0);
    bar.classList.toggle("overload", p.overload > 0);
    bar.classList.toggle("holding", p.governorHold && p.overload <= 0);
    el["heat-num"].textContent = p.overload > 0 ? "OVERLOAD " + p.overload.toFixed(1) + " s" : p.governorHold ? "HOLD " + Math.round(hf * 100) + "%" : Math.round(p.heat) + " / " + Math.round(cap);
    el["btn-governor"].classList.toggle("active", p.heatGovernor);
    var cw = p.stats.crew || { supply: 0, need: 0, manning: 1 };
    el["own-crew"].textContent = cw.supply + " / " + cw.need + " · " + Math.round(cw.manning * 100) + "%" + (cw.manning < 1 ? " undermanned" : "") + (cw.away ? " · " + cw.away + " away" : " · spare " + Math.max(0, cw.supply - cw.need));
    updateBoarding(p);
    el["own-crew"].style.color = cw.manning < 0.7 ? "#e0463c" : cw.manning < 1 ? "#f2c14e" : "";
    el["own-heat"].textContent = Math.round(p.heat) + " / " + Math.round(cap) + " · −" + p.stats.heatDissipation.toFixed(0) + "/s" + (p.overload > 0 ? " · OVERLOAD" : p.governorHold ? " · holding" : "");
  }

  // Boarding row and the transporter button: progress while a party is away, otherwise why the button is off.
  var boardReasons = { nolock: "needs a lock", range: "closer than " + BS.Data.grid.boarding.rangeKm + " km", shields: "their facing shield must be 0", crew: "needs " + BS.Data.grid.boarding.minParty + " spare crew", busy: "party away" };
  function updateBoarding(p) {
    var bd = p.boarding, row = el["own-boarding-row"], btn = el["btn-board"], e = game.state.enemy;
    row.style.display = bd ? "" : "none";
    if (bd) {
      el["own-boarding"].textContent = bd.phase === "transport" ? "beaming " + Math.round(bd.party) + " · " + Math.max(0, BS.Data.grid.boarding.transportTime - bd.t).toFixed(1) + " s" : Math.ceil(bd.party) + " vs " + Math.ceil(bd.defenders) + " aboard";
      el["own-boarding"].style.color = bd.phase === "fight" && bd.party < bd.defenders ? "#e0463c" : "#f2c14e";
    }
    var why = e ? BS.Boarding.canBoard(p, e) : "nolock", ok = why === "ok";
    btn.classList.toggle("off", !ok && why !== "busy");
    btn.classList.toggle("active", why === "busy");
    btn.textContent = ok ? "Board · transporter" : why === "busy" ? "Boarding party away" : "Board · " + boardReasons[why];
  }

  // ---- per-frame update ---------------------------------------------------
  function pctColor(frac) { var c = BS.Renderer.shieldColor(frac); return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }
  function hullColor(frac) { return frac > 0.6 ? "#7fd8a0" : frac > 0.3 ? "#f2c14e" : "#e0463c"; }
  function setBar(fill, frac, color) { fill.style.width = (U.clamp(frac, 0, 1) * 100).toFixed(1) + "%"; if (color) fill.style.backgroundColor = color; }
  function fmtKm(k) { return (k < 10 ? k.toFixed(1) : Math.round(k)) + " km"; }
  function cmdText(p) {
    var st = p.ai ? (BS.Data.enemyAI.stateLabels[p.ai.state] || p.ai.state) : "";
    if (p.cmd.type === "shadow") st = "shadowing " + (p.attackSide === "blind" ? "blind sector" : p.attackSide);
    if (p.tumble > 0) st = "TUMBLING";
    if (p.breach > 0) st = "CORE BREACH " + p.breach.toFixed(0) + " s";
    if (p.scanning > 0) st = "SCANNING " + p.scanning.toFixed(1) + " s · " + st;
    var sc = p.script && !p.script.suspended && p.script.active >= 0 ? "Script " + (p.script.active + 1) + " · " : (p.script && p.script.suspended ? "Manual · " : "");
    if (p.play && p.ai && !p.ai.suspended) { var ph = p.play.def.phases[p.play.phase]; return sc + p.play.def.label + " · " + ph.label + " · " + st; }
    if (p.escorting && p.ai && p.ai.suspended) return sc + "Escorting " + p.escorting.name + (p.support ? " · supporting " + p.support.name : "");
    if (p.ai && !p.ai.suspended && p.stance) return sc + BS.Data.helm.stances[p.stance].label + " · " + st + (p.support ? " · supporting " + p.support.name : "");
    if (p.ai && !p.ai.suspended) return sc + (p.doctrineId || "helm") + " · " + st;
    return p.cmd.type === "flyTo" ? "Manual · flying to point" : "Manual · all stop";
  }

  function update(state) {
    var p = state.player, e = state.enemy;
    if (!p) return;
    el["clock"].textContent = U.formatTime(state.time);
    el["btn-pause"].textContent = state.paused ? "RESUME" : "PAUSE";
    el["btn-pause"].classList.toggle("active", state.paused);
    el["pause-overlay"].classList.toggle("hidden", !state.paused);

    updateGauge(p);
    updateHeatBar(p);
    var tok = el["call-tokens"]; if (tok) { var left = state.calls || 0, used = state.callsUsed || 0, dots = ""; for (var di = 0; di < left; di++) dots += "● "; for (var dj = 0; dj < used; dj++) dots += "○ "; tok.textContent = dots.trim() || "none"; tok.classList.toggle("none", left === 0); }
    document.querySelectorAll("#bridge-calls [data-call]").forEach(function (b) { if (b.id === "btn-focus") return; b.classList.toggle("off", (state.calls || 0) <= 0); });
    if (pendingFocus && e && e.grid.at[pendingFocus.x + "," + pendingFocus.y] && !e.grid.at[pendingFocus.x + "," + pendingFocus.y].alive) { pendingFocus = null; updateFocusButton(); }
    el["own-speed"].textContent = S.speedKmS(p).toFixed(1) + " km/s" + (p.activeEffects.speedMult > 1 ? " · AB" : "");
    el["own-cmd"].textContent = cmdText(p);
    var st = p.stats, est = e ? e.stats : null;
    Object.keys(BS.Data.blocks).forEach(function (type) {
      var total = st.counts[type] || 0, alive = st.alive[type] || 0;
      var hpNow = 0, hpMax = 0;
      p.grid.blocks.forEach(function (b) { if (b.type === type) { hpMax += b.maxHp; if (b.alive) hpNow += b.hp; } });
      var v = hpMax ? hpNow / hpMax : 0;
      el["subrow-" + type].style.display = total ? "" : "none";
      setBar(el["sub-" + type], v, hullColor(v)); el["sub-" + type + "-val"].textContent = alive + "/" + total;
      el["subrow-" + type].classList.toggle("prio", p.repairPriority === type);
      if (e) {
        var et = est.counts[type] || 0, ea = est.alive[type] || 0;
        el["en-" + type].style.display = et ? "" : "none";
        el["en-" + type].style.backgroundColor = e.flags.destroyed ? "#15162a" : hullColor(et ? ea / et : 0);
        el["en-" + type].lastChild.textContent = BS.Data.blocks[type].short + " " + ea + "/" + et;
        el["en-" + type].classList.toggle("targeted", p.aimType === type);
      }
    });
    if (e) { el["en-exposed"].textContent = "EXP " + e.stats.exposed; el["en-exposed"].classList.toggle("targeted", p.aimType === "exposed"); el["en-exposed"].style.display = e.flags.destroyed ? "none" : ""; }
    if (e) { var sn = e.grid.blocks.filter(function (b) { return b.structural && b.alive; }).length; el["en-structure"].textContent = "STRUCT " + sn; el["en-structure"].classList.toggle("targeted", p.aimType === "structure"); el["en-structure"].style.display = e.flags.destroyed || !sn ? "none" : ""; }

    // target panel
    var locked = p.lock.target && !p.lock.target.flags.destroyed ? p.lock.target : null;
    el["target-none"].classList.toggle("hidden", !!locked);
    el["target-info"].classList.toggle("hidden", !locked);
    if (locked) {
      var t = locked;
      el["tg-name"].textContent = t.name + (p.lock.locked ? "" : " · locking " + Math.round(p.lock.progress * 100) + "%");
      var ef = t.hull / t.hullMax;
      setBar(el["tg-hull"], ef, hullColor(ef)); el["tg-hull-val"].textContent = Math.round(ef * 100);
      var facing = S.facingToward(t, p.pos.x, p.pos.y), sf = S.shieldFrac(t, facing);
      setBar(el["tg-shield"], sf, pctColor(sf)); el["tg-shield-val"].textContent = Math.round(sf * 100);
      var dKm = S.distanceKm(p, t);
      var turretBlock = p.stats.weapons.filter(function (b) { return b.alive && b.def.weapon.kind === "turret"; })[0];
      var turret = turretBlock ? turretBlock.def.weapon : null;
      var band = turret ? (dKm <= turret.optimalKm ? "optimal" : dKm <= turret.optimalKm + turret.falloffKm ? "falloff" : "out of beam range") : "";
      el["tg-range"].textContent = fmtKm(dKm) + " · " + band;
      el["tg-angular"].textContent = S.angularVelocity(p, t).toFixed(2) + " rad/s · " + S.speedKmS(t).toFixed(1) + " km/s";
      if (turret && p.lock.locked) {
        var ch = BS.Weapons.turretHitChance(p, t, turret);
        var launcherBlock = p.stats.weapons.filter(function (b) { return b.alive && b.def.weapon.kind === "launcher"; })[0];
        var tm = launcherBlock ? BS.Weapons.torpedoDamageMult(launcherBlock.def.weapon, t) : 1;
        el["tg-chance"].textContent = turretBlock.def.short + " " + Math.round(ch * 100) + "%" + (launcherBlock ? " · TOR " + Math.round(tm * 100) + "%" : "");
      } else el["tg-chance"].textContent = p.lock.locked ? "—" : "locking…";
      el["tg-aim"].textContent = p.aimType === "block" && p.aimBlock ? (p.aimBlock.block.structural ? "Structure" : p.aimBlock.block.def.name) + " at " + p.aimBlock.block.x + "," + p.aimBlock.block.y + " (−15%)" : p.aimType === "exposed" ? "Exposed hull (−15%)" : p.aimType === "structure" ? "Structure: necks and pylons (−15%)" : p.aimType ? BS.Data.blocks[p.aimType].name + "s (−15%)" : "Any block";
    }

    // overview
    updateOverview(state);
    updateScan(state);
    el["sel-name"].textContent = p.selected ? p.selected.name : "nothing";
    var auto = p.ai && !p.ai.suspended;
    document.querySelectorAll("[data-cmd='stance']").forEach(function (b) { b.classList.toggle("active", !!auto && !p.play && p.stance === b.getAttribute("data-stance")); });
    document.querySelectorAll("[data-cmd='side']").forEach(function (b) { b.classList.toggle("active", p.attackSide === b.getAttribute("data-side")); });
    Object.keys(playEls).forEach(function (id) { playEls[id].classList.toggle("active", !!p.play && p.play.id === id); playEls[id].classList.toggle("off", !BS.Plays.available(p, id)); });
    document.querySelectorAll("[data-cmd='stop']").forEach(function (b) { b.classList.toggle("active", !auto); });

    // module bar
    for (var i = 0; i < moduleEls.length; i++) {
      var me = moduleEls[i], m = me.m;
      me.el.classList.toggle("active", m.active);
      me.el.classList.toggle("running", m.running);
      var weapon = BS.Modules.isWeapon(m);
      ["nocap", "nolock", "range", "notarmed", "arc", "none", "heat", "overload", "cloaked", "surge", "field", "scan"].forEach(function (st) { me.el.classList.toggle(st, (m.active || m.def.kind === "cloak") && m.state === st); });
      me.ring.style.setProperty("--p", weapon ? (100 * (1 - m.readiness)).toFixed(1) : (m.running ? (100 * (1 - m.cycleLeft / m.cycleTime)).toFixed(1) : 0));
      me.el.classList.toggle("running", weapon ? m.active && m.readiness < 1 : m.running);
      me.state.textContent = m.active && m.state !== "running" && m.state !== "off" && m.state !== "ok" ? ({ nocap: "no cap", nolock: "no lock", range: "range", notarmed: "safe", arc: "no arc", none: "lost", heat: "hot", overload: "OVERLOAD", cloaked: "cloaked", cloaking: "cloaking", decloaking: "decloak", surge: "surge", field: "no field", scan: "scanning" })[m.state] || "" : "";
    }
  }

  // ---- enemy scan panel: the locked ship's blocks, cover, fields, crew, power, heat and what bears on us ----
  var scanFrame = 0, scanHtmlLast = "", scanWeak = null;
  function updateScan(state) {
    var p = state.player, e = state.enemy, cv = el["scan-view"], c = cv.getContext("2d");
    if (!p || !e) return;
    var locked = p.lock.target === e && p.lock.locked, vis = S.visibility(e, p);
    scanFrame++;
    if (!locked || e.flags.destroyed || vis <= 0) {
      c.clearRect(0, 0, cv.width, cv.height);
      var msg = e.flags.destroyed ? "Target destroyed." : vis <= 0 ? "Sensors show nothing: the target is cloaked." : p.lock.target === e ? "Locking… scan follows the lock." : "No lock. Lock the target to scan it.";
      if (scanHtmlLast !== msg) { el["scan-info"].innerHTML = "<div class='dim'>" + msg + "</div>"; scanHtmlLast = msg; }
      return;
    }
    if (scanFrame % 3 === 0) {
      var g = e.grid, cp = g.cellPx, k = Math.min(cv.width / (g.h * cp), cv.height / (g.w * cp)) * 0.88;
      c.clearRect(0, 0, cv.width, cv.height);
      c.save(); c.translate(cv.width / 2, cv.height / 2); c.scale(k, k); c.rotate(-Math.PI / 2);   // bow up
      BS.Renderer.drawGridShip(c, e, 0.5, { still: true, tuning: !!p.scanned });
      BS.Renderer.drawShieldCover(c, e, "rgba(110,180,255,0.7)");
      var half = cp / 2, st = e.stats;
      c.fillStyle = "rgba(255,70,60,0.45)";
      g.blocks.forEach(function (b) { if (b.alive && !b.structural && !b.covered) c.fillRect(b.lx - half, b.ly - half, cp, cp); });
      c.lineWidth = 1.2;
      if (st.cloakCover && st.cloakCover.sources) { c.strokeStyle = "rgba(155,140,255,0.95)"; g.blocks.forEach(function (b) { if (b.alive && !b.structural && !b.cloakCovered) c.strokeRect(b.lx - half + 0.6, b.ly - half + 0.6, cp - 1.2, cp - 1.2); }); }
      if (st.jamCover && st.jamCover.sources) { c.strokeStyle = "rgba(53,224,143,0.95)"; g.blocks.forEach(function (b) { if (b.alive && !b.structural && !b.jamCovered) c.strokeRect(b.lx - half + 1.6, b.ly - half + 1.6, cp - 3.2, cp - 3.2); }); }
      c.fillStyle = "rgba(0,0,0,0.45)";   // out of reactor range: dimmed
      g.blocks.forEach(function (b) { if (b.alive && !b.structural && !b.powered && (b.def.crew || 0) > 0) c.fillRect(b.lx - half, b.ly - half, cp, cp); });
      // the block we focus on, or the block type we aim at
      if (p.aimType === "block" && p.aimBlock && p.aimBlock.ship === e && p.aimBlock.block.alive) { var ab = p.aimBlock.block; c.strokeStyle = "rgba(255,230,120,1)"; c.lineWidth = 1.6; c.strokeRect(ab.lx - half - 1, ab.ly - half - 1, cp + 2, cp + 2); c.beginPath(); c.moveTo(ab.lx - cp, ab.ly); c.lineTo(ab.lx - half - 1, ab.ly); c.moveTo(ab.lx + cp, ab.ly); c.lineTo(ab.lx + half + 1, ab.ly); c.stroke(); }
      else if (p.aimType && p.aimType !== "exposed" && p.aimType !== "unjammed" && p.aimType !== "block") { c.strokeStyle = "rgba(255,230,120,0.9)"; g.blocks.forEach(function (b) { if (b.alive && b.type === p.aimType) c.strokeRect(b.lx - half - 0.5, b.ly - half - 0.5, cp + 1, cp + 1); }); }
      c.restore();
    }
    if (scanFrame % 6 !== 1) return;
    var st2 = e.stats, D = BS.Data, hull = e.hull / e.hullMax;
    if (scanFrame % 60 === 1 || !scanWeak) scanWeak = BS.Grid.weakPoints(e, p);   // the analysis once a second
    function pct(x) { return Math.round(x * 100) + "%"; }
    function cls(x, lo, hi) { return x < lo ? "bad" : x < hi ? "warn" : "good"; }
    var html = "<div><h4>Hull & shields</h4>";
    html += "<div class='sl'><label>Hull</label><div class='bar enemy'><div class='fill' style='width:" + pct(hull) + ";background:" + hullColor(hull) + "'></div></div><span class='num'>" + pct(hull) + "</span></div>";
    S.FACINGS.forEach(function (f) { var fr = S.shieldFrac(e, f); html += "<div class='sl'><label>" + f + "</label><div class='bar enemy'><div class='fill' style='width:" + pct(fr) + ";background:" + pctColor(fr) + "'></div></div><span class='num'>" + Math.round(e.shields[f]) + "</span></div>"; });
    html += "<div class='sl'><label>Cover</label><span class='v " + cls(st2.coverFrac, 0.7, 0.9) + "'>" + pct(st2.coverFrac) + (st2.exposed ? " · " + st2.exposed + " bare" : "") + "</span></div>";
    if (st2.cloakCover && st2.cloakCover.sources) html += "<div class='sl'><label>Cloak</label><span class='v'>" + st2.cloakCover.sources + " device" + (st2.cloakCover.sources > 1 ? "s" : "") + " · field " + pct(st2.cloakCover.frac) + (st2.cloakCover.exposed ? " <span class='good'>(" + st2.cloakCover.exposed + " out: cannot cloak)</span>" : "") + "</span></div>";
    if (st2.jamCover && st2.jamCover.sources) html += "<div class='sl'><label>ECM</label><span class='v'>" + st2.jamCover.sources + " jammer" + (st2.jamCover.sources > 1 ? "s" : "") + " · field " + pct(st2.jamCover.frac) + (st2.jamCover.exposed ? " · " + st2.jamCover.exposed + " out" : " (breaks locks)") + "</span></div>";
    html += "</div><div><h4>Systems</h4>";
    var order = ["lance", "phaser", "disruptor", "pulse", "torpedo", "reactor", "shield", "engine", "sensor", "jammer", "cloak", "decoy", "neut", "quarters"];
    order.forEach(function (t) { var n = st2.counts[t]; if (!n) return; var a = st2.alive[t] || 0; html += "<div class='sl'><label>" + D.blocks[t].short + "</label><span class='v " + (a === 0 ? "bad" : a < n ? "warn" : "") + "'>" + a + " / " + n + "</span></div>"; });
    var cw = st2.crew || { manning: 1, supply: 0, need: 0 };
    html += "<div class='sl'><label>Crew</label><span class='v " + cls(cw.manning, 0.7, 1) + "'>" + cw.supply + " / " + cw.need + " · " + pct(cw.manning) + "</span></div>";
    html += "<div class='sl'><label>Power</label><span class='v " + cls(st2.powerFactor, 0.7, 1) + "'>" + st2.powerUsed + " / " + st2.powerMax + " · " + pct(st2.powerFactor) + (st2.unpowered ? " · " + st2.unpowered + " dark" : "") + (e.breach > 0 ? " <span class='good'>BREACH " + e.breach.toFixed(0) + " s</span>" : "") + "</span></div>";
    html += "<div class='sl'><label>Heat</label><span class='v'>" + Math.round(e.heat) + " / " + Math.round(st2.heatCap) + (e.overload > 0 ? " <span class='good'>OVERLOADED</span>" : "") + "</span></div>";
    var ecap = e.capMax ? e.capacitor / e.capMax : 0;
    html += "<div class='sl'><label>Cap</label><span class='v " + (ecap < 0.15 ? "good" : ecap < 0.4 ? "warn" : "") + "' title='Their capacitor: a neutraliser drains it; dry, their modules shut down'>" + Math.round(e.capacitor) + " / " + e.capMax + " · " + pct(ecap) + (ecap <= 0.02 ? " <span class='good'>DRY</span>" : "") + "</span></div>";
    var ebd = BS.Boarding.canBoard(p, e);
    html += "<div class='sl'><label>Boarding</label><span class='v " + (ebd === "ok" ? "good" : "") + "'>" + (ebd === "ok" ? "window open: press T" : ebd === "busy" ? "party aboard" : boardReasons[ebd]) + " · " + Math.round(BS.Boarding.defenders(e)) + " defenders</span></div>";
    var chg = BS.Modules.chargingOn(e, null);
    if (chg.length) html += "<div class='sl'><label>Charging</label><span class='v bad'>" + chg.map(function (c) { return c.block.def.name.toLowerCase() + " on " + (c.block.chargeTarget ? escapeHtml(c.block.chargeTarget.name) : "?") + ": " + c.left.toFixed(1) + " s"; }).join(" · ") + "</span></div>";
    html += "</div><div><h4>Tactical</h4>";
    var total = st2.weapons.filter(function (b) { return b.alive; }).length, bearing = BS.EnemyAI.bearingCount(e, p, false);
    html += "<div class='sl'><label>Bearing</label><span class='v " + (bearing === 0 ? "good" : bearing >= total * 0.6 ? "bad" : "warn") + "'>" + bearing + " of " + total + " weapons on us</span></div>";
    var prof = BS.Grid.bearingProfile(e, null, 90), sec = {};
    prof.forEach(function (q) { sec[q.deg] = Math.round(q.w); });
    html += "<div class='sl'><label>Sectors</label><span class='v' title='Their fire (dps) toward their bow / starboard / stern / port: shadow the weakest'>bow " + (sec[0] || 0) + " · stbd " + (sec[90] || 0) + " · aft " + (sec[-180] || 0) + " · port " + (sec[-90] || 0) + "</span></div>";
    var stLabel = e.ai ? (D.enemyAI.stateLabels[e.ai.state] || e.ai.state) : "";
    html += "<div class='sl'><label>Orders</label><span class='v'>" + (e.play ? e.play.def.label + " · " + e.play.def.phases[e.play.phase].label + " · " : (e.doctrineId || "") + " · ") + stLabel + "</span></div>";
    html += "<div class='sl'><label>Motion</label><span class='v'>" + fmtKm(S.distanceKm(p, e)) + " · " + S.speedKmS(e).toFixed(1) + " km/s · " + S.angularVelocity(p, e).toFixed(2) + " rad/s</span></div>";
    var theirTube = st2.weapons.filter(function (b) { return b.alive && b.def.weapon.kind === "launcher"; })[0];
    var theirTurret = st2.weapons.filter(function (b) { return b.alive && b.def.weapon.kind === "turret"; })[0];
    var threat = [];
    if (theirTurret) threat.push(theirTurret.def.short + " " + pct(BS.Weapons.turretHitChance(e, p, theirTurret.def.weapon)) + " to hit us");
    if (theirTube) threat.push("torpedoes " + pct(BS.Weapons.torpedoDamageMult(theirTube.def.weapon, p)) + " damage on us");
    html += "<div class='sl'><label>Threat</label><span class='v'>" + (threat.length ? threat.join(" · ") : "unarmed") + "</span></div>";
    if (p.script) { var psc = p.script, stRule = psc.override ? "BRIDGE CALL · " + BS.Script.describeDo(psc.override.rule.do) : psc.suspended ? "manual helm, script paused" : psc.active >= 0 && psc.def.rules[psc.active] ? "rule " + (psc.active + 1) + " · " + BS.Script.describe(psc.def.rules[psc.active], psc.def) : "waiting for a rule"; html += "<div class='sl'><label>Standing</label><span class='v' title='" + escapeHtml(stRule) + "'>" + escapeHtml(stRule.length > 70 ? stRule.slice(0, 68) + "…" : stRule) + "</span></div>"; }
    html += "<div class='sl'><label>Aiming</label><span class='v'>" + (p.aimType === "block" && p.aimBlock ? (p.aimBlock.block.structural ? "structure" : p.aimBlock.block.def.name.toLowerCase()) + " at " + p.aimBlock.block.x + "," + p.aimBlock.block.y : p.aimType === "exposed" ? "bare hull" : p.aimType === "structure" ? "necks and pylons" : p.aimType ? D.blocks[p.aimType].name.toLowerCase() + "s" : "anything") + (pendingFocus ? " · <span class='warn'>focus ready: " + escapeHtml(pendingFocus.label) + " (confirm in Bridge)</span>" : "") + "</span></div>";
    html += "<div class='sl'><label>Scan</label><span class='v'>" + (p.scanned ? "<span class='good'>scanned: weak points readable</span>" : p.scanning > 0 ? "scanning " + p.scanning.toFixed(1) + " s" : "not scanned (scan is a script action)") + (e.scanned ? " · they have scanned us" : "") + "</span></div>";
    html += "<div class='sl'><label>Tuning</label><span class='v'>" + (p.scanned ? escapeHtml(BS.Grid.tuningText(e.grid)) + (e.remod ? " <span class='warn'>(remodulating " + e.remod.kind + " " + e.remod.t.toFixed(0) + " s)</span>" : "") : "<span class='dim'>unknown until scanned</span>") + (p.remod ? " · <span class='warn'>ours: remodulating " + p.remod.kind + " " + p.remod.t.toFixed(0) + " s</span>" : "") + "</span></div>";
    html += "<div class='sl'><label>Cloak</label><span class='v'>" + (e.cloak.state !== "off" ? e.cloak.state : e.cloak.surge > 0 ? "surge: shields down" : e.cloak.strike > 0 ? "<span class='bad'>decloak strike " + e.cloak.strike.toFixed(0) + " s</span>" : "off") + (vis < 1 ? " · ghost contact" : "") + "</span></div>";
    html += "</div><div><h4>Weak points · click to focus fire</h4>";
    if (!scanWeak.length) html += "<div class='dim'>Nothing stands out.</div>";
    scanWeak.forEach(function (wp, i) {
      var on = p.aimType === "block" && p.aimBlock && p.aimBlock.block === wp.block;
      html += "<div class='wp" + (on ? " on" : "") + "' data-wp='" + i + "' title='" + (manual() ? "Click: focus every weapon on this block (−15% accuracy). Click again to stop." : "Tap: make this block the Focus bridge call, then confirm in the Bridge panel.") + "'>" + (on ? "▶ " : "") + wp.label + "</div>";
    });
    html += "</div>";
    if (html !== scanHtmlLast) { el["scan-info"].innerHTML = html; scanHtmlLast = html; }
  }

  function updateOverview(state) {
    var p = state.player, tbody = el["overview"].querySelector("tbody");
    state.ships.forEach(function (s) {
      if (s === p) return;
      var row = overviewRows[s.id];
      if (!row) {
        row = document.createElement("tr");
        row.innerHTML = '<td class="name"></td><td></td><td></td><td></td><td></td>';
        row.addEventListener("click", function () { game.command("select", { target: s }); });
        row.addEventListener("dblclick", function () { game.command("select", { target: s }); game.command("lock", { target: s }); });
        tbody.appendChild(row); overviewRows[s.id] = row;
      }
      var cells = row.children;
      cells[0].textContent = s.name; cells[0].title = s.cls.className;
      var vis = S.visibility(s, p);
      cells[1].textContent = s.flags.destroyed || vis <= 0 ? "—" : fmtKm(S.distanceKm(p, s)) + (vis < 1 ? " ghost" : "");
      cells[2].textContent = s.flags.destroyed ? "—" : S.speedKmS(s).toFixed(1);
      cells[3].textContent = s.flags.destroyed ? "—" : S.angularVelocity(p, s).toFixed(2);
      var stLabel = s.ai ? (BS.Data.enemyAI.stateLabels[s.ai.state] || s.ai.state) : "";
      if (s.play && s.cloak.state === "off") stLabel = s.play.def.label + " · " + stLabel;
      if (s.tumble > 0) stLabel = "tumbling";
      if (s.breach > 0) stLabel = "CORE BREACH " + s.breach.toFixed(0) + " s";
      cells[4].textContent = s.flags.destroyed ? "destroyed" : s.flags.disabled ? "disabled" : s.cloak.state !== "off" ? s.cloak.state : stLabel;
      row.classList.toggle("selected", p.selected === s);
      row.classList.toggle("locked", p.lock.target === s && p.lock.locked);
    });
    // drop rows for ships no longer present
    Object.keys(overviewRows).forEach(function (id) {
      if (!state.ships.some(function (s) { return String(s.id) === id; })) { tbody.removeChild(overviewRows[id]); delete overviewRows[id]; }
    });
  }

  function setShipName(name) { el["ship-name"].textContent = name; }

  return { init: init, update: update, addLog: addLog, clearLog: clearLog, setAlert: setAlert, showStart: showStart, hideOverlays: hideOverlays, showResult: showResult, setShipName: setShipName, buildModuleBar: buildModuleBar, setManual: setManual };
})();
