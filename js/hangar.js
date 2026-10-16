// js/hangar.js — the hangar between battles: ship, fitting, market, skills, save.
window.BS = window.BS || {};

BS.Hangar = (function () {
  var U = BS.Util, C = BS.Campaign;
  var $ = function (id) { return document.getElementById(id); };
  var el = {}, game = null, pick = null;   // pick = { slot, i } slot awaiting a module choice
  var timer = null;

  function init(gameRef) {
    game = gameRef;
    ["hangar-screen", "hg-credits", "hg-ship", "hg-ships", "hg-slots", "hg-pg", "hg-cpu", "hg-pg-val", "hg-cpu-val", "hg-stats", "hg-inventory", "hg-market", "hg-skills", "hg-training", "hg-msg", "hg-record", "hg-threat",
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
      "<br><span class='dim'>hull " + cls.hull + " · shields " + cls.shields.max + "×4 · speed " + (cls.speed / BS.Data.units.pxPerKm).toFixed(1) + " km/s · cap " + cls.capacitor.max + " · sensors " + cls.sensorStrength + " · sig " + cls.signature + " m</span>";
    renderShips(s); renderSlots(s, cls); renderInventory(s); renderMarket(s); renderSkills(s); renderTraining();
  }

  function renderShips(s) {
    var box = el["hg-ships"]; box.innerHTML = "";
    Object.keys(BS.Data.shipClasses).forEach(function (id) {
      var cls = BS.Data.shipClasses[id];
      if (!cls.purchasable && s.ownedShips.indexOf(id) < 0) return;
      var owned = s.ownedShips.indexOf(id) >= 0, current = s.shipClass === id;
      var row = document.createElement("div"); row.className = "hg-row" + (current ? " current" : "");
      row.innerHTML = "<span class='hg-name'>" + cls.className + "</span><span class='dim'>" + cls.role + " · " + cls.slots.high + "/" + cls.slots.mid + "/" + cls.slots.low + " slots</span>";
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

  function renderSlots(s, cls) {
    var fit = C.fitFor(s.shipClass), box = el["hg-slots"]; box.innerHTML = "";
    ["high", "mid", "low"].forEach(function (slot) {
      var group = document.createElement("div"); group.className = "hg-slotgroup";
      group.innerHTML = "<div class='sub-label'>" + slot + " slots</div>";
      var rowBox = document.createElement("div"); rowBox.className = "hg-slotrow";
      fit[slot].forEach(function (id, i) {
        var d = document.createElement("div"); d.className = "hg-slot " + slot + (id ? " filled" : "") + (pick && pick.slot === slot && pick.i === i ? " picking" : "");
        var def = id && BS.Data.modules[id];
        d.innerHTML = def ? "<b>" + def.short + "</b><small>" + def.name + "</small>" : "<b>+</b><small>empty</small>";
        d.title = def ? def.name + " — " + def.desc + " Click to pick a replacement; right-click to unfit." : "Click to fit a module from your inventory.";
        d.addEventListener("click", function () { pick = (pick && pick.slot === slot && pick.i === i) ? null : { slot: slot, i: i }; render(); say(pick ? "Pick a " + slot + " slot module from the inventory." : ""); });
        d.addEventListener("contextmenu", function (ev) { ev.preventDefault(); if (id) { C.unfitModule(slot, i); pick = null; render(); say(def.name + " moved to inventory."); } });
        rowBox.appendChild(d);
      });
      group.appendChild(rowBox); box.appendChild(group);
    });
    var u = C.usage(fit);
    el["hg-pg"].style.width = Math.min(100, 100 * u.pg / cls.powergrid) + "%"; el["hg-pg"].classList.toggle("over", u.pg > cls.powergrid);
    el["hg-cpu"].style.width = Math.min(100, 100 * u.cpu / cls.cpu) + "%"; el["hg-cpu"].classList.toggle("over", u.cpu > cls.cpu);
    el["hg-pg-val"].textContent = u.pg + " / " + cls.powergrid; el["hg-cpu-val"].textContent = u.cpu + " / " + cls.cpu;
    var st = C.fitStats(s.shipClass, fit);
    var capLine = st.lasts !== null ? "<span class='bad'>runs dry in " + Math.round(st.lasts) + " s with everything on</span>" : "stable at " + st.stableAt + "% with everything on";
    el["hg-stats"].innerHTML =
      "<div><label>Damage</label><span>" + st.dps + " dps <span class='dim'>(beams " + st.turretDps + " · torpedoes " + st.launcherDps + ")</span></span></div>" +
      "<div><label>Capacitor</label><span>" + capLine + " <span class='dim'>(drain " + st.drain + "/s · peak recharge " + st.peakRecharge + "/s)</span></span></div>" +
      "<div><label>Defence</label><span>hull " + st.hull + " · shields " + st.shieldHp + " · regen " + st.shieldRegen + "/s" + (st.hasBooster ? " · booster " + st.boost + "/s" : "") + "</span></div>" +
      "<div><label>Mobility</label><span>" + st.speed + " km/s · lock " + st.lockTime + " s on a Bird-of-Prey</span></div>";
  }

  function renderInventory(s) {
    var box = el["hg-inventory"]; box.innerHTML = "";
    if (!s.inventory.length) { box.innerHTML = "<div class='dim'>Nothing in storage. Buy modules in the market, or right-click a fitted module to unfit it.</div>"; return; }
    var counts = {};
    s.inventory.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    Object.keys(counts).forEach(function (id) {
      var def = BS.Data.modules[id];
      var row = document.createElement("div"); row.className = "hg-row";
      var usable = pick ? !C.fitProblem(s.shipClass, C.fitFor(s.shipClass), pick.slot, pick.i, id) : false;
      row.innerHTML = "<span class='hg-name'>" + def.name + (counts[id] > 1 ? " ×" + counts[id] : "") + "</span><span class='dim'>" + def.slot + " · pg " + def.pg + " · cpu " + def.cpu + "</span>";
      row.title = def.desc;
      if (pick) {
        var fb = document.createElement("button"); fb.className = "lcars-btn c-orange"; fb.textContent = "Fit"; fb.disabled = !usable;
        fb.title = usable ? "" : (C.fitProblem(s.shipClass, C.fitFor(s.shipClass), pick.slot, pick.i, id) || "");
        fb.addEventListener("click", function () { var err = C.fitModule(pick.slot, pick.i, id); if (err) say(err, true); else { say(def.name + " fitted."); pick = null; } render(); });
        row.appendChild(fb);
      }
      var sb = document.createElement("button"); sb.className = "lcars-btn c-lilac"; sb.textContent = "Sell " + Math.round(def.cost * BS.Data.campaign.sellBack);
      sb.addEventListener("click", function () { var err = C.sellModule(id); if (err) say(err, true); else say("Sold " + def.name + "."); render(); });
      row.appendChild(sb); box.appendChild(row);
    });
  }

  function renderMarket(s) {
    var box = el["hg-market"]; box.innerHTML = "";
    Object.keys(BS.Data.modules).forEach(function (id) {
      var def = BS.Data.modules[id];
      if (/disruptor|klingon/.test(id)) return;   // Klingon gear is not sold at a Starfleet yard
      var row = document.createElement("div"); row.className = "hg-row";
      row.innerHTML = "<span class='hg-name'>" + def.name + "</span><span class='dim'>" + def.slot + " · pg " + def.pg + " · cpu " + def.cpu + (def.cap ? " · " + def.cap + " cap/" + def.cycle + "s" : "") + "</span>";
      row.title = def.desc;
      var b = document.createElement("button"); b.className = "lcars-btn c-orange"; b.textContent = def.cost.toLocaleString() + " cr"; b.disabled = s.credits < def.cost;
      b.addEventListener("click", function () { var err = C.buyModule(id); if (err) say(err, true); else say("Bought " + def.name + ". It is in storage; click a slot to fit it."); render(); });
      row.appendChild(b); box.appendChild(row);
    });
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
