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
     "rs-time", "rs-dealt", "rs-taken", "rs-hull", "rs-phasers", "rs-torps", "rs-credits", "ship-name", "view", "module-bar", "overview", "sel-name", "orbit-buttons", "keep-buttons"]
      .forEach(function (id) { el[id] = $(id); });
    logList = $("log");
    buildGauge();
    buildSubsystemWidgets();
    buildRangeButtons();

    document.querySelectorAll("[data-cmd]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var args = {};
        if (btn.hasAttribute("data-range")) args.rangeKm = parseFloat(btn.getAttribute("data-range"));
        game.command(btn.getAttribute("data-cmd"), args); btn.blur();
      });
    });
    el["btn-pause"].addEventListener("click", function () { game.togglePause(); el["btn-pause"].blur(); });
    el["btn-redalert"].addEventListener("click", function () { game.command("redAlert"); el["btn-redalert"].blur(); });
    el["btn-zoom-in"].addEventListener("click", function () { game.setZoom(game.state.zoom + BS.Data.balance.zoom.step); });
    el["btn-zoom-out"].addEventListener("click", function () { game.setZoom(game.state.zoom - BS.Data.balance.zoom.step); });
    $("btn-start").addEventListener("click", function () { game.openHangar(); });
    el["btn-help"].addEventListener("click", function () { el["help-screen"].classList.remove("hidden"); });
    el["btn-help-close"].addEventListener("click", function () { el["help-screen"].classList.add("hidden"); });
    $("btn-restart").addEventListener("click", function () { game.openHangar(); });
    bindCanvas();
    bindKeys();
    if (!subscribed) { subscribe(); subscribed = true; }
  }

  function subscribe() {
    BS.Events.on("log", function (e) { addLog(e.speaker, e.text, e.cls); });
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
      row.addEventListener("click", function () { game.command("repair", { type: type }); });
      el["own-subsystems"].appendChild(row);
      el["sub-" + type] = row.querySelector(".fill"); el["sub-" + type + "-val"] = row.querySelector(".num"); el["subrow-" + type] = row;
      var chip = document.createElement("span"); chip.className = "chip"; chip.textContent = d.short; chip.title = "Aim at their " + d.name.toLowerCase() + "s";
      chip.addEventListener("click", function () { game.command("aim", { type: type }); });
      el["enemy-subsystems"].appendChild(chip); el["en-" + type] = chip;
    });
  }
  function buildRangeButtons() {
    var B = BS.Data.balance;
    el["orbit-buttons"].innerHTML = ""; el["keep-buttons"].innerHTML = "";
    B.orbitRangesKm.forEach(function (r) {
      var b = document.createElement("button"); b.className = "lcars-btn c-blue"; b.setAttribute("data-cmd", "orbit"); b.setAttribute("data-range", r); b.textContent = r + " km"; el["orbit-buttons"].appendChild(b);
    });
    B.keepRangesKm.forEach(function (r) {
      var b = document.createElement("button"); b.className = "lcars-btn c-lilac"; b.setAttribute("data-cmd", "keep"); b.setAttribute("data-range", r); b.textContent = r + " km"; el["keep-buttons"].appendChild(b);
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
  }

  // Module bar: one round button per fitted module, F-key labelled.
  function buildModuleBar(ship) {
    el["module-bar"].innerHTML = ""; moduleEls = [];
    var active = ship.modules.filter(function (m) { return m.def.kind !== "passive"; });
    active.forEach(function (m, i) {
      var b = document.createElement("div"); b.className = "module";
      var capText = m.def.cap ? m.def.cap + " cap" : (BS.Data.blocks[m.def.block].weapon.cap + " cap/shot");
      b.innerHTML = '<span class="key">F' + (i + 1) + '</span><div class="ring"></div><span class="short">' + m.def.short + '</span><span class="capcost">' + capText + '</span><span class="state"></span>';
      b.title = m.def.name + " — " + m.def.desc + (m.def.cycle ? " Cycle " + m.def.cycle + " s, " + m.def.cap + " capacitor per cycle." : "");
      b.addEventListener("click", function () { game.command("module", { module: m }); });
      el["module-bar"].appendChild(b);
      moduleEls.push({ el: b, m: m, ring: b.querySelector(".ring"), state: b.querySelector(".state") });
    });
  }

  // ---- canvas input --------------------------------------------------------
  function bindCanvas() {
    var view = el["view"];
    function worldAt(ev) { var r = view.getBoundingClientRect(); return BS.Renderer.screenToWorld(ev.clientX - r.left, ev.clientY - r.top); }
    function hoverAt(ev) {
      var s = game.state;
      if (s.phase !== "battle" || !s.enemy || s.enemy.flags.destroyed) { game.setHover(null); return null; }
      var w = worldAt(ev);
      var b = BS.Grid.blockAtWorld(s.enemy, w.x, w.y, s.zoom < 0.8 ? 2 : 1);
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
      var s = game.state, h = hoverAt(ev);
      if (!h) return;
      var p = s.player, e = s.enemy;
      if (p.lock.target !== e) { game.command("select", { target: e }); game.command("lock", { target: e }); return; }
      if (h.block && !h.block.structural) game.command("aim", { type: h.block.type });
    });
    view.addEventListener("dblclick", function (ev) {
      var h = hoverAt(ev);
      if (h) return;
      game.command("flyTo", { point: worldAt(ev) });
    });
    view.addEventListener("contextmenu", function (ev) {
      ev.preventDefault();
      var s = game.state, h = hoverAt(ev);
      if (s.phase !== "battle") return;
      if (h) { game.command("select", { target: s.enemy }); game.command("orbit", { target: s.enemy, rangeKm: s.enemy.cls.preferredRangeKm || 6 }); }
      else game.command("flyTo", { point: worldAt(ev) });
    });
    view.addEventListener("wheel", function (ev) {
      ev.preventDefault();
      var Z = BS.Data.balance.zoom;
      game.setZoom(game.state.zoom + (ev.deltaY < 0 ? Z.step : -Z.step));
    }, { passive: false });
  }

  function bindKeys() {
    window.addEventListener("keydown", function (ev) {
      var s = game.state;
      if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
      if (ev.key === "Escape") { el["help-screen"].classList.add("hidden"); return; }
      if (ev.code === "Space" && s.phase === "battle") { ev.preventDefault(); game.togglePause(); return; }
      if (s.phase !== "battle") return;
      var fk = /^F(\d)$/.exec(ev.key);
      if (fk) { var i = parseInt(fk[1], 10) - 1; if (moduleEls[i]) { ev.preventDefault(); game.command("module", { module: moduleEls[i].m }); } return; }
      switch (ev.key.toLowerCase()) {
        case "l": game.command("lock"); break;
        case "a": game.command("approach"); break;
        case "o": game.command("orbit", { rangeKm: BS.Data.balance.orbitRangesKm[1] }); break;
        case "k": game.command("keep", { rangeKm: BS.Data.balance.keepRangesKm[1] }); break;
        case "c": game.command("comeAbout"); break;
        case "s": game.command("stop"); break;
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
    el["result-head"].textContent = won ? "BATTLE REPORT · ENEMY DESTROYED" : "BATTLE REPORT · SHIP LOST";
    el["result-sub"].textContent = won ? "The Klingon vessel has been destroyed. Starfleet Command sends its compliments, Captain." : "The ship was lost with all hands. Starfleet will review the sensor logs.";
    el["rs-time"].textContent = U.formatTime(state.time);
    el["rs-dealt"].textContent = Math.round(p.stats.damageDealt);
    el["rs-taken"].textContent = Math.round(p.stats.damageTaken);
    el["rs-hull"].textContent = Math.round(100 * p.hull / p.hullMax) + "%";
    el["rs-phasers"].textContent = p.stats.phaserHits + " / " + p.stats.phasersFired;
    el["rs-torps"].textContent = p.stats.torpedoHits + " / " + p.stats.torpedoesFired;
    var rw = state.reward;
    el["rs-credits"].textContent = rw ? "+" + rw.earned + " cr" + (rw.streak > 1 ? " (streak " + rw.streak + ")" : "") + " · " + BS.Campaign.get().credits.toLocaleString() + " cr total" : "—";
  }

  // ---- per-frame update ---------------------------------------------------
  function pctColor(frac) { var c = BS.Renderer.shieldColor(frac); return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }
  function hullColor(frac) { return frac > 0.6 ? "#7fd8a0" : frac > 0.3 ? "#f2c14e" : "#e0463c"; }
  function setBar(fill, frac, color) { fill.style.width = (U.clamp(frac, 0, 1) * 100).toFixed(1) + "%"; if (color) fill.style.backgroundColor = color; }
  function fmtKm(k) { return (k < 10 ? k.toFixed(1) : Math.round(k)) + " km"; }
  function cmdText(p) {
    var c = p.cmd, k = BS.Ships.km(c.range);
    switch (c.type) {
      case "approach": return "Approaching";
      case "orbit": return "Orbit " + fmtKm(k);
      case "keep": return "Keep " + fmtKm(k);
      case "flyTo": return "Flying to point";
      case "comeAbout": return "Presenting " + c.facing + " shield";
      default: return "All stop";
    }
  }

  function update(state) {
    var p = state.player, e = state.enemy;
    if (!p) return;
    el["clock"].textContent = U.formatTime(state.time);
    el["btn-pause"].textContent = state.paused ? "RESUME" : "PAUSE";
    el["btn-pause"].classList.toggle("active", state.paused);
    el["pause-overlay"].classList.toggle("hidden", !state.paused);

    updateGauge(p);
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
        el["en-" + type].textContent = BS.Data.blocks[type].short + " " + ea + "/" + et;
        el["en-" + type].classList.toggle("targeted", p.aimType === type);
      }
    });

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
      var turretBlock = p.stats.weapons.filter(function (b) { return b.type === "phaser"; })[0];
      var turret = turretBlock ? turretBlock.def.weapon : null;
      var band = turret ? (dKm <= turret.optimalKm ? "optimal" : dKm <= turret.optimalKm + turret.falloffKm ? "falloff" : "out of phaser range") : "";
      el["tg-range"].textContent = fmtKm(dKm) + " · " + band;
      el["tg-angular"].textContent = S.angularVelocity(p, t).toFixed(2) + " rad/s · " + S.speedKmS(t).toFixed(1) + " km/s";
      if (turret && p.lock.locked) {
        var ch = BS.Weapons.turretHitChance(p, t, turret);
        var launcherBlock = p.stats.weapons.filter(function (b) { return b.type === "torpedo"; })[0];
        var tm = launcherBlock ? BS.Weapons.torpedoDamageMult(launcherBlock.def.weapon, t) : 1;
        el["tg-chance"].textContent = "PHA " + Math.round(ch * 100) + "% · TOR " + Math.round(tm * 100) + "%";
      } else el["tg-chance"].textContent = p.lock.locked ? "—" : "locking…";
      el["tg-aim"].textContent = p.aimType ? BS.Data.blocks[p.aimType].name + "s (−15%)" : "Any block";
    }

    // overview
    updateOverview(state);
    el["sel-name"].textContent = p.selected ? p.selected.name : "nothing";
    document.querySelectorAll("[data-cmd='orbit'],[data-cmd='keep']").forEach(function (b) {
      var r = parseFloat(b.getAttribute("data-range"));
      b.classList.toggle("active", p.cmd.type === b.getAttribute("data-cmd") && Math.abs(S.km(p.cmd.range) - r) < 0.01);
    });
    document.querySelectorAll("[data-cmd='approach'],[data-cmd='comeAbout']").forEach(function (b) { b.classList.toggle("active", p.cmd.type === b.getAttribute("data-cmd")); });

    // module bar
    for (var i = 0; i < moduleEls.length; i++) {
      var me = moduleEls[i], m = me.m;
      me.el.classList.toggle("active", m.active);
      me.el.classList.toggle("running", m.running);
      var weapon = BS.Modules.isWeapon(m);
      ["nocap", "nolock", "range", "notarmed", "arc", "none"].forEach(function (st) { me.el.classList.toggle(st, m.active && m.state === st); });
      me.ring.style.setProperty("--p", weapon ? (100 * (1 - m.readiness)).toFixed(1) : (m.running ? (100 * (1 - m.cycleLeft / m.cycleTime)).toFixed(1) : 0));
      me.el.classList.toggle("running", weapon ? m.active && m.readiness < 1 : m.running);
      me.state.textContent = m.active && m.state !== "running" && m.state !== "off" && m.state !== "ok" ? ({ nocap: "no cap", nolock: "no lock", range: "range", notarmed: "safe", arc: "no arc", none: "lost" })[m.state] || "" : "";
    }
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
      cells[1].textContent = s.flags.destroyed ? "—" : fmtKm(S.distanceKm(p, s));
      cells[2].textContent = s.flags.destroyed ? "—" : S.speedKmS(s).toFixed(1);
      cells[3].textContent = s.flags.destroyed ? "—" : S.angularVelocity(p, s).toFixed(2);
      cells[4].textContent = s.flags.destroyed ? "destroyed" : s.ai ? (BS.Data.enemyAI.stateLabels[s.ai.state] || s.ai.state) : "";
      row.classList.toggle("selected", p.selected === s);
      row.classList.toggle("locked", p.lock.target === s && p.lock.locked);
    });
    // drop rows for ships no longer present
    Object.keys(overviewRows).forEach(function (id) {
      if (!state.ships.some(function (s) { return String(s.id) === id; })) { tbody.removeChild(overviewRows[id]); delete overviewRows[id]; }
    });
  }

  function setShipName(name) { el["ship-name"].textContent = name; }

  return { init: init, update: update, addLog: addLog, clearLog: clearLog, setAlert: setAlert, showStart: showStart, hideOverlays: hideOverlays, showResult: showResult, setShipName: setShipName, buildModuleBar: buildModuleBar };
})();
