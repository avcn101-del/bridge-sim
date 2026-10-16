// js/ui.js — DOM: status panel, order buttons, comms log, alert lighting, overlays.
window.BS = window.BS || {};

BS.UI = (function () {
  var U = BS.Util;
  var $ = function (id) { return document.getElementById(id); };
  var el = {};
  var game = null;
  var logList, logCount = 0, MAX_LOG = 80;
  var subscribed = false;

  function init(gameRef) {
    game = gameRef;
    ["hull-fill", "hull-val",
     "pow-weapons", "pow-shields", "pow-engines", "pow-weapons-val", "pow-shields-val", "pow-engines-val",
     "wpn-phasers", "wpn-torps", "wpn-phasers-val", "wpn-torps-val", "en-hull", "en-hull-val", "en-shield", "en-shield-val", "en-range", "en-state",
     "clock", "alert-label", "btn-pause", "pause-overlay", "start-screen", "result-screen", "result-title", "result-sub", "result-head",
     "rs-time", "rs-dealt", "rs-taken", "rs-hull", "rs-torps", "btn-fireatwill", "ship-name",
     "busy-helm", "busy-tactical", "busy-engineering", "view", "own-subsystems", "enemy-subsystems", "target-buttons", "repair-buttons"].forEach(function (id) { el[id] = $(id); });
    buildSubsystemWidgets();
    BS.Ships.FACINGS.forEach(function (f) { el["sh-" + f] = $("sh-" + f); el["sh-" + f + "-val"] = $("sh-" + f + "-val"); });
    logList = $("log");

    // officer names from data
    Object.keys(BS.Data.crew.officers).forEach(function (o) { var n = $("off-" + o); if (n) n.textContent = BS.Data.crew.officers[o].name; });

    // order buttons (a target button clicked while already active returns to hull targeting)
    document.querySelectorAll("[data-order]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var order = btn.getAttribute("data-order"), t = btn.getAttribute("data-target");
        if (t && game.state.player && game.state.player.targetSubsystem === t) order = "targetHull";
        game.giveOrder(order); btn.blur();
      });
    });
    bindCanvasTargeting();
    el["btn-pause"].addEventListener("click", function () { game.togglePause(); el["btn-pause"].blur(); });
    $("btn-start").addEventListener("click", function () { game.startBattle(); });
    $("btn-restart").addEventListener("click", function () { game.startBattle(); });
    window.addEventListener("keydown", function (e) {
      if (e.code === "Space" && game.state.phase === "battle") { e.preventDefault(); game.togglePause(); }
    });

    if (!subscribed) { subscribe(); subscribed = true; }
  }

  // ---- generated widgets from BS.Data.subsystems ------------------------
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function buildSubsystemWidgets() {
    var subs = BS.Data.subsystems, ids = Object.keys(subs);
    el["own-subsystems"].innerHTML = ""; el["enemy-subsystems"].innerHTML = ""; el["target-buttons"].innerHTML = ""; el["repair-buttons"].innerHTML = "";
    ids.forEach(function (sys) {
      var d = subs[sys];
      var row = document.createElement("div"); row.className = "row"; row.title = d.label + ": " + d.effect;
      row.innerHTML = '<label>' + d.label + '</label><div class="bar sub"><div class="fill"></div></div><span class="num">100</span>';
      el["own-subsystems"].appendChild(row);
      el["sub-" + sys] = row.querySelector(".fill"); el["sub-" + sys + "-val"] = row.querySelector(".num");
      var chip = document.createElement("span"); chip.className = "chip"; chip.textContent = d.short; chip.title = "Enemy " + d.label.toLowerCase();
      el["enemy-subsystems"].appendChild(chip); el["en-" + sys] = chip;
      var tb = document.createElement("button"); tb.className = "lcars-btn c-orange mode-target"; tb.setAttribute("data-order", "target" + cap(sys)); tb.setAttribute("data-target", sys); tb.textContent = d.label; tb.title = "Target their " + d.label.toLowerCase() + " (" + d.effect + "). Click again to target the hull.";
      el["target-buttons"].appendChild(tb);
      var rb = document.createElement("button"); rb.className = "lcars-btn c-lilac mode-repair"; rb.setAttribute("data-order", "repair" + cap(sys)); rb.setAttribute("data-repair", sys); rb.textContent = d.label;
      el["repair-buttons"].appendChild(rb);
    });
    var auto = document.createElement("button"); auto.className = "lcars-btn c-lilac mode-repair wide"; auto.setAttribute("data-order", "repairAuto"); auto.setAttribute("data-repair", "auto"); auto.textContent = "Auto · most damaged first";
    el["repair-buttons"].appendChild(auto);
  }

  // ---- click a part of the enemy ship on the tactical display -----------
  function bindCanvasTargeting() {
    var view = el["view"];
    function hoverAt(ev) {
      var s = game.state;
      if (s.phase !== "battle" || !s.enemy || s.enemy.flags.destroyed) { game.setHover(null); return null; }
      var r = view.getBoundingClientRect();
      var w = BS.Renderer.screenToWorld(ev.clientX - r.left, ev.clientY - r.top);
      var h = BS.Ships.hardpointAt(s.enemy, w.x, w.y, 5);
      game.setHover(h);
      return h;
    }
    view.addEventListener("mousemove", function (ev) {
      var h = hoverAt(ev);
      view.classList.toggle("can-target", !!h);
      view.classList.toggle("on-hardpoint", !!(h && h.sys));
    });
    view.addEventListener("mouseleave", function () { game.setHover(null); view.classList.remove("can-target", "on-hardpoint"); });
    view.addEventListener("click", function (ev) {
      var h = hoverAt(ev);
      if (!h) return;
      var p = game.state.player;
      if (!h.sys || p.targetSubsystem === h.sys) game.giveOrder("targetHull"); else game.giveOrder("target" + cap(h.sys));
    });
  }

  function subscribe() {
    BS.Events.on("log", function (e) { addLog(e.speaker, e.text, e.cls); });
    BS.Events.on("alertChanged", function (e) { if (e.ship.isPlayer) setAlert(e.alert); });
  }

  // ---------------------------------------------------------------- log
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
    logCount++;
    while (logList.children.length > MAX_LOG) logList.removeChild(logList.lastChild);
  }
  function clearLog() { logList.innerHTML = ""; logCount = 0; }

  // -------------------------------------------------------------- alert
  function setAlert(level) {
    document.body.classList.remove("alert-none", "alert-yellow", "alert-red");
    document.body.classList.add("alert-" + level);
    el["alert-label"].textContent = level === "red" ? "RED ALERT" : level === "yellow" ? "YELLOW ALERT" : "CONDITION GREEN";
    document.querySelectorAll(".mode-alert").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-alert") === level); });
  }

  // ------------------------------------------------------------ overlays
  function showStart() { el["start-screen"].classList.remove("hidden"); el["result-screen"].classList.add("hidden"); }
  function hideOverlays() { el["start-screen"].classList.add("hidden"); el["result-screen"].classList.add("hidden"); }
  function showResult(state) {
    var p = state.player, won = state.result === "victory";
    el["result-screen"].classList.remove("hidden");
    el["result-screen"].classList.toggle("victory", won); el["result-screen"].classList.toggle("defeat", !won);
    el["result-title"].textContent = won ? "Victory" : "Defeat";
    el["result-head"].textContent = won ? "BATTLE REPORT · ENEMY DESTROYED" : "BATTLE REPORT · SHIP LOST";
    el["result-sub"].textContent = won ? "The Klingon raider has been destroyed. Starfleet Command sends its compliments, Captain." : "The ship was lost with all hands. Starfleet will review the sensor logs.";
    el["rs-time"].textContent = U.formatTime(state.time);
    el["rs-dealt"].textContent = Math.round(p.stats.damageDealt);
    el["rs-taken"].textContent = Math.round(p.stats.damageTaken);
    el["rs-hull"].textContent = Math.round(100 * p.hull / p.hullMax) + "%";
    el["rs-torps"].textContent = p.stats.torpedoHits + " / " + p.stats.torpedoesFired;
  }

  // ------------------------------------------------------- status panel
  function pctColor(frac) {
    var c = BS.Renderer.shieldColor(frac);
    return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
  }
  function hullColor(frac) { return frac > 0.6 ? "#7fd8a0" : frac > 0.3 ? "#f2c14e" : "#e0463c"; }
  function setBar(fill, frac, color) { fill.style.width = (U.clamp(frac, 0, 1) * 100).toFixed(1) + "%"; if (color) fill.style.backgroundColor = color; }

  function update(state) {
    var p = state.player, e = state.enemy;
    if (!p) return;
    el["clock"].textContent = U.formatTime(state.time);
    el["btn-pause"].textContent = state.paused ? "RESUME" : "PAUSE";
    el["btn-pause"].classList.toggle("active", state.paused);
    el["pause-overlay"].classList.toggle("hidden", !state.paused);

    var hf = p.hull / p.hullMax;
    setBar(el["hull-fill"], hf, hullColor(hf)); el["hull-val"].textContent = Math.round(hf * 100) + "%";
    BS.Ships.FACINGS.forEach(function (f) {
      var frac = p.shields[f] / p.shieldMax;
      var fill = el["sh-" + f];
      if (f === "fore" || f === "aft") fill.style.width = (frac * 100).toFixed(1) + "%"; else fill.style.height = (frac * 100).toFixed(1) + "%";
      fill.style.backgroundColor = pctColor(frac);
      el["sh-" + f + "-val"].textContent = Math.round(frac * 100);
    });
    BS.Ships.subsystemIds().forEach(function (s) {
      var v = p.subsystems[s] / 100;
      setBar(el["sub-" + s], v, hullColor(v)); el["sub-" + s + "-val"].textContent = Math.round(v * 100);
      if (e) { var ev = e.subsystems[s] / 100; el["en-" + s].style.backgroundColor = e.flags.destroyed ? "#15162a" : hullColor(ev); el["en-" + s].textContent = BS.Data.subsystems[s].short + " " + Math.round(ev * 100); el["en-" + s].classList.toggle("targeted", p.targetSubsystem === s); }
    });
    ["weapons", "engines", "shields"].forEach(function (s) {
      setBar(el["pow-" + s], p.power[s] / 0.6); el["pow-" + s + "-val"].textContent = Math.round(p.power[s] * 100);
    });
    var pc = p.phaserDef.cooldown, pr = p.torpedoDef.reload;
    var pf = p.phaserCooldown > 0 ? 1 - p.phaserCooldown / pc : 1, tf = p.torpedoReload > 0 ? 1 - p.torpedoReload / pr : 1;
    setBar(el["wpn-phasers"], pf); el["wpn-phasers-val"].textContent = !p.flags.armed ? "SAFE" : pf >= 1 ? "RDY" : Math.round(pf * 100) + "%";
    setBar(el["wpn-torps"], tf); el["wpn-torps-val"].textContent = !p.flags.armed ? "SAFE" : tf >= 1 ? "RDY" : Math.round(tf * 100) + "%";

    if (e) {
      var ef = e.hull / e.hullMax;
      setBar(el["en-hull"], ef, hullColor(ef)); el["en-hull-val"].textContent = e.flags.destroyed ? "0" : Math.round(ef * 100);
      var facing = BS.Ships.facingToward(e, p.pos.x, p.pos.y), sf = e.shields[facing] / e.shieldMax;
      setBar(el["en-shield"], sf, pctColor(sf)); el["en-shield-val"].textContent = Math.round(sf * 100);
      var d = BS.Ships.distanceTo(p, e);
      el["en-range"].textContent = e.flags.destroyed ? "—" : Math.round(d) + (d <= p.phaserDef.optimalRange ? " · optimal" : d <= p.phaserDef.range ? " · phaser range" : d <= p.torpedoDef.range ? " · torpedo range" : " · out of range");
      el["en-state"].textContent = e.flags.destroyed ? "destroyed" : e.ai ? ({ approach: "closing", attack: "attacking", reposition: "turning", retreat: "retreating" })[e.ai.state] : "—";
    }

    // button states
    document.querySelectorAll(".mode-helm").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-mode") === p.helm.mode); });
    document.querySelectorAll(".mode-target").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-target") === p.targetSubsystem); });
    document.querySelectorAll(".mode-power").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-power") === p.powerPreset); });
    document.querySelectorAll(".mode-repair").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-repair") === (p.repairPriority || "auto")); });
    el["btn-fireatwill"].classList.toggle("active", p.flags.fireAtWill);
    ["helm", "tactical", "engineering"].forEach(function (o) { el["busy-" + o].classList.toggle("on", BS.Crew.isBusy(o)); });
  }

  function setShipName(name) { el["ship-name"].textContent = name; }

  return { init: init, update: update, addLog: addLog, clearLog: clearLog, setAlert: setAlert, showStart: showStart, hideOverlays: hideOverlays, showResult: showResult, setShipName: setShipName };
})();
