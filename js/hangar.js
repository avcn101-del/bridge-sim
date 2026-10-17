// js/hangar.js — the hangar between battles: ship, fitting, market, skills, save.
window.BS = window.BS || {};

BS.Hangar = (function () {
  var U = BS.Util, C = BS.Campaign;
  var $ = function (id) { return document.getElementById(id); };
  var el = {}, game = null, pick = null;   // pick = { slot, i } slot awaiting a module choice
  var timer = null;

  function init(gameRef) {
    game = gameRef;
    ["hangar-screen", "hg-credits", "hg-ship", "hg-ships", "hg-preview", "hg-legend", "hg-stats", "hg-skills", "hg-training", "hg-msg", "hg-record", "hg-threat",
     "btn-undock", "btn-export", "btn-import", "hg-import-file", "btn-reset"].forEach(function (id) { el[id] = $(id); });
    el["btn-undock"].addEventListener("click", function () { hide(); game.startBattle(); });
    el["btn-export"].addEventListener("click", exportSave);
    el["btn-import"].addEventListener("click", function () { el["hg-import-file"].value = ""; el["hg-import-file"].click(); });
    el["hg-import-file"].addEventListener("change", importSave);
    el["btn-reset"].addEventListener("click", function () {
      if (window.confirm("Reset all progress? Credits, ships, modules and skills will be lost.")) { C.reset(); render(); say("Progress reset."); }
    });
    BS.Events.on("skillTrained", function (e) { say(BS.Data.skills[e.skill].name + " trained to level " + e.level + "."); if (isOpen()) render(); });
  }

  function isOpen() { return !el["hangar-screen"].classList.contains("hidden"); }
  function show() { el["hangar-screen"].classList.remove("hidden"); pick = null; render(); if (!timer) timer = setInterval(tick, 1000); }
  function hide() { el["hangar-screen"].classList.add("hidden"); if (timer) { clearInterval(timer); timer = null; } }
  function tick() { if (C.updateTraining()) render(); else renderTraining(); }
  function say(msg, bad) { el["hg-msg"].textContent = msg; el["hg-msg"].classList.toggle("bad", !!bad); }

  // ---- render ---------------------------------------------------------------
  function render() {
    var s = C.get(), cls = C.currentClass();
    el["hg-credits"].textContent = s.credits.toLocaleString() + " cr";
    el["hg-record"].textContent = s.campaign.battlesWon + " won · " + s.campaign.battlesLost + " lost" + (s.campaign.streak > 1 ? " · streak " + s.campaign.streak : "");
    el["hg-threat"].textContent = "Raider strength " + Math.round(C.enemyStatMult() * 100) + "%";
    el["hg-ship"].innerHTML = "<b>" + cls.name + "</b> · " + cls.className + " · " + cls.role +
      "<br><span class='dim'>" + cls.mask[0].length + "×" + cls.mask.length + " cell hull · base speed " + (cls.speed / BS.Data.units.pxPerKm).toFixed(1) + " km/s · signature " + cls.signature + " m</span>";
    renderShips(s); renderBuild(s, cls); renderSkills(s); renderTraining();
  }

  function renderShips(s) {
    var box = el["hg-ships"]; box.innerHTML = "";
    Object.keys(BS.Data.shipClasses).forEach(function (id) {
      var cls = BS.Data.shipClasses[id];
      if (!cls.purchasable && s.ownedShips.indexOf(id) < 0) return;
      var owned = s.ownedShips.indexOf(id) >= 0, current = s.shipClass === id;
      var row = document.createElement("div"); row.className = "hg-row" + (current ? " current" : "");
      var cells = cls.mask.reduce(function (a, r) { return a + (r.match(/[#n]/g) || []).length; }, 0);
      row.innerHTML = "<span class='hg-name'>" + cls.className + "</span><span class='dim'>" + cls.role + " · " + cells + " cells</span>";
      var b = document.createElement("button"); b.className = "lcars-btn " + (owned ? "c-blue" : "c-orange");
      b.textContent = current ? "Active" : owned ? "Board" : cls.cost.toLocaleString() + " cr";
      b.disabled = current;
      b.addEventListener("click", function () {
        if (owned) { C.selectShip(id); render(); say("Boarded " + cls.name + "."); }
        else { var err = C.buyShip(id); if (err) say(err, true); else { render(); say("Purchased " + cls.name + ". Note: the hull silhouette is a placeholder until PR C."); } }
      });
      row.appendChild(b); box.appendChild(row);
    });
  }

  function renderBuild(s, cls) {
    var rows = C.layoutFor(s.shipClass);
    var st = C.layoutStats(s.shipClass, rows);
    var canvas = el["hg-preview"];
    var ship = BS.Ships.create(s.shipClass, { layout: st.ok ? rows : cls.layout });
    BS.Renderer.drawPreview(canvas, ship, 0.5);
    // legend with counts
    var lg = el["hg-legend"]; lg.innerHTML = "";
    Object.keys(BS.Data.blocks).forEach(function (type) {
      var d = BS.Data.blocks[type], n = st.counts[type] || 0;
      if (!n) return;
      var sp = document.createElement("span"); sp.className = "lg"; sp.innerHTML = "<i style='background:" + d.color + "'></i>" + d.name + " ×" + n; sp.title = d.desc; lg.appendChild(sp);
    });
    var capLine = st.lasts !== null ? "<span class='bad'>runs dry in " + Math.round(st.lasts) + " s with everything on</span>" : "stable at " + st.stableAt + "% with everything on";
    var shields = BS.Ships.FACINGS.map(function (f) { return f.charAt(0).toUpperCase() + " " + st.shields[f]; }).join(" · ");
    el["hg-stats"].innerHTML =
      (st.ok ? "" : "<div class='bad'>" + st.errors.join(" ") + " Default layout will be used.</div>") +
      "<div><label>Build</label><span>" + st.blocks + " blocks · mass " + st.mass + " · value " + st.cost.toLocaleString() + " cr</span></div>" +
      "<div><label>Damage</label><span>" + st.dps + " dps <span class='dim'>(beams " + st.turretDps + " · torpedoes " + st.launcherDps + ")</span></span></div>" +
      "<div><label>Capacitor</label><span>" + st.cap + " · " + capLine + " <span class='dim'>(drain " + st.drain + "/s · peak " + st.peakRecharge + "/s)</span></span></div>" +
      "<div><label>Defence</label><span>hull " + st.hull + " · shields " + shields + " · repair " + st.repair + "/s</span></div>" +
      "<div><label>Mobility</label><span>" + st.speed + " km/s <span class='dim'>(thrust " + st.thrust + " / mass " + st.mass + " = ×" + st.speedMult + ")</span> · lock " + st.lockTime + " s</span></div>";
  }

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
    var pct = Math.round(100 * (1 - left / total));
    var mins = Math.ceil(left / 60000);
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
      try { C.importJSON(String(reader.result)); render(); say("Save imported."); }
      catch (e) { say("Import failed: " + e.message, true); }
    };
    reader.readAsText(file);
  }

  return { init: init, show: show, hide: hide, render: render, isOpen: isOpen };
})();
