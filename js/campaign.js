// js/campaign.js — progress between battles: save/load (localStorage, export,
// import), credits, ship and module ownership, fitting rules, fit statistics,
// real-time skill training, enemy scaling.
window.BS = window.BS || {};

BS.Campaign = (function () {
  var U = BS.Util;
  var KEY = "bridgesim.save";
  var save = null;

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }
  function D() { return BS.Data; }

  // ---- persistence --------------------------------------------------------
  function fresh() { var s = deepCopy(D().saveDefaults); s.credits = D().campaign.startingCredits; return s; }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var parsed = JSON.parse(raw); if (validate(parsed)) { save = migrate(parsed); return save; } }
    } catch (e) { console.warn("Save could not be read", e); }
    save = fresh();
    return save;
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { console.warn("Save could not be written", e); }
  }
  function reset() { save = fresh(); persist(); return save; }
  function validate(s) {
    return s && typeof s === "object" && typeof s.version === "number" && typeof s.credits === "number" && D().shipClasses[s.shipClass] && Array.isArray(s.ownedShips);
  }
  function migrate(s) {
    var base = fresh();
    var out = Object.assign(base, s);
    out.skills = Object.assign(base.skills, s.skills || {});
    out.campaign = Object.assign(base.campaign, s.campaign || {});
    out.settings = Object.assign(base.settings, s.settings || {});
    out.layouts = {};
    Object.keys(s.layouts || {}).forEach(function (id) { if (D().shipClasses[id] && Array.isArray(s.layouts[id])) out.layouts[id] = s.layouts[id]; });
    out.builds = {};
    Object.keys(s.builds || {}).forEach(function (id) { if (D().shipClasses[id] && Array.isArray(s.builds[id])) out.builds[id] = s.builds[id].filter(function (b) { return b && b.name && Array.isArray(b.rows); }); });
    out.ownedShips = s.ownedShips.filter(function (id) { return D().shipClasses[id]; });
    if (out.ownedShips.indexOf(out.shipClass) < 0) out.ownedShips.push(out.shipClass);
    out.version = 2;
    return out;
  }
  function exportJSON() { return JSON.stringify(save, null, 2); }
  function importJSON(text) {
    var parsed = JSON.parse(text);
    if (!validate(parsed)) throw new Error("Not a Bridge Sim save file.");
    save = migrate(parsed); persist(); return save;
  }
  function hasSave() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }

  // ---- ships and layouts ------------------------------------------------
  function currentClass() { return D().shipClasses[save.shipClass]; }
  function layoutFor(classId) {
    var cls = D().shipClasses[classId];
    if (!save.layouts[classId]) save.layouts[classId] = cls.layout.slice();
    return save.layouts[classId];
  }
  function setLayout(classId, rows) { save.layouts[classId] = rows.slice(); persist(); }
  function battleLayout(classId) {
    var rows = layoutFor(classId), v = BS.Grid.validateLayout(D().shipClasses[classId], rows);
    return v.ok ? rows : D().shipClasses[classId].layout;   // never undock an invalid build
  }
  // Cost of changing the hull's current layout to `rows`: added blocks are bought, removed blocks refunded.
  function layoutDelta(classId, rows) {
    var cur = countBlocks(layoutFor(classId)), nxt = countBlocks(rows), cost = 0, refund = 0;
    Object.keys(D().blocks).forEach(function (t) {
      var price = D().blocks[t].cost, d = (nxt[t] || 0) - (cur[t] || 0);
      if (d > 0) cost += d * price; else if (d < 0) refund += -d * price * D().editor.refund;
    });
    return { cost: cost, refund: Math.round(refund), net: Math.round(cost - refund) };
  }
  function countBlocks(rows) {
    var counts = {};
    rows.forEach(function (r) { for (var i = 0; i < r.length; i++) { var t = BS.Grid.typeForLetter(r[i]); if (t) counts[t] = (counts[t] || 0) + 1; } });
    return counts;
  }
  // Validate, charge the difference and store the layout. Returns null or an error string.
  function applyLayout(classId, rows) {
    var v = BS.Grid.validateLayout(D().shipClasses[classId], rows);
    if (!v.ok) return v.errors[0];
    var delta = layoutDelta(classId, rows);
    if (delta.net > save.credits) return "Not enough credits: this build costs " + delta.net.toLocaleString() + " cr more than you have.";
    save.credits -= delta.net;
    save.layouts[classId] = rows.slice();
    persist();
    return null;
  }
  function builds(classId) { if (!save.builds[classId]) save.builds[classId] = []; return save.builds[classId]; }
  function saveBuild(classId, name, rows) {
    var list = builds(classId), existing = list.filter(function (b) { return b.name === name; })[0];
    if (existing) existing.rows = rows.slice();
    else { if (list.length >= D().editor.maxSavedBuilds) return "Only " + D().editor.maxSavedBuilds + " saved builds per hull. Delete one first."; list.push({ name: name, rows: rows.slice() }); }
    persist(); return null;
  }
  function deleteBuild(classId, name) { save.builds[classId] = builds(classId).filter(function (b) { return b.name !== name; }); persist(); }

  function buyShip(classId) {
    var cls = D().shipClasses[classId];
    if (!cls || !cls.purchasable) return "Not for sale.";
    if (save.ownedShips.indexOf(classId) >= 0) return "Already owned.";
    if (save.credits < cls.cost) return "Not enough credits.";
    save.credits -= cls.cost; save.ownedShips.push(classId); save.shipClass = classId; layoutFor(classId); persist(); return null;
  }
  function selectShip(classId) { if (save.ownedShips.indexOf(classId) >= 0) { save.shipClass = classId; persist(); } }

  // ---- skills (real time) -------------------------------------------------
  function skillHours(skillId, level) { return D().skills[skillId].hoursPerLevel[level - 1]; }
  function updateTraining(now) {
    now = now || Date.now();
    var t = save.training;
    if (t && now >= t.finishesAt) {
      save.skills[t.skill] = Math.max(save.skills[t.skill], t.level);
      save.training = null; persist();
      BS.Events.emit("skillTrained", { skill: t.skill, level: t.level });
      return true;
    }
    return false;
  }
  function startTraining(skillId) {
    var sk = D().skills[skillId];
    if (!sk) return "Unknown skill.";
    if (save.training) return "Already training " + D().skills[save.training.skill].name + ".";
    var next = (save.skills[skillId] || 0) + 1;
    if (next > sk.levels) return sk.name + " is at maximum level.";
    var ms = skillHours(skillId, next) * 3600 * 1000;
    save.training = { skill: skillId, level: next, startedAt: Date.now(), finishesAt: Date.now() + ms };
    persist(); return null;
  }
  function cancelTraining() { save.training = null; persist(); }
  // Ship mods from trained skills (applied at ship creation).
  function skillMods() {
    var mods = { turretDamageMult: 1, launcherDamageMult: 1, speedMult: 1, shieldRegenMult: 1, capRechargeMult: 1, lockMult: 1 };
    Object.keys(D().skills).forEach(function (id) {
      var lvl = save.skills[id] || 0, per = D().skills[id].perLevel;
      Object.keys(per).forEach(function (k) { mods[k] = (mods[k] || 1) * (1 + per[k] * lvl); });
    });
    return mods;
  }

  // ---- layout statistics for the hangar -------------------------------------
  function layoutStats(classId, rows) {
    var cls = D().shipClasses[classId], mods = skillMods(), B = D().balance, g = D().grid;
    var v = BS.Grid.validateLayout(cls, rows), st = v.stats, blocks = D().blocks;
    var turretDps = 0, launcherDps = 0, drain = 0;
    st.weapons.forEach(function (b) {
      var w = b.def.weapon;
      if (w.kind === "turret") { turretDps += w.damage * mods.turretDamageMult * 0.8 / w.cycle; drain += w.cap / w.cycle; }
      else { launcherDps += w.damage * mods.launcherDamageMult * 0.85 / w.cycle; drain += w.cap / w.cycle; }
    });
    D().builtInModules.forEach(function (id) { var m = D().modules[id]; drain += m.cap / m.cycle; });
    var capMax = st.cap, tau = g.capRechargeTime, rechargeMult = mods.capRechargeMult;
    var peak = capMax / tau * B.capCurve * 0.25 * rechargeMult;
    var c = capMax, lasts = null, stableAt = null;
    for (var t = 0; t < 600; t += 0.5) {
      var f = c / capMax, rate = capMax / tau * B.capCurve * Math.max(0, Math.sqrt(f) - f) * rechargeMult;
      if (f < 0.02) rate = capMax / tau * 0.4 * rechargeMult;
      c = Math.min(capMax, c + (rate - drain) * 0.5);
      if (c <= 0) { lasts = t; break; }
    }
    if (lasts === null) { var best = 1; for (var ff = 1; ff > 0.02; ff -= 0.01) { if (capMax / tau * B.capCurve * (Math.sqrt(ff) - ff) * rechargeMult >= drain) { best = ff; break; } } stableAt = Math.round(best * 100); }
    var shieldTotal = 0; BS.Ships.FACINGS.forEach(function (fc) { shieldTotal += st.shieldMax[fc]; });
    return {
      ok: v.ok, errors: v.errors, counts: v.counts,
      dps: Math.round(turretDps + launcherDps), turretDps: Math.round(turretDps), launcherDps: Math.round(launcherDps),
      cap: capMax, drain: drain.toFixed(1), peakRecharge: peak.toFixed(1), stableAt: stableAt, lasts: lasts,
      speed: (cls.speed * st.speedMult * mods.speedMult / D().units.pxPerKm).toFixed(1), speedMult: st.speedMult.toFixed(2), mass: st.mass, thrust: st.thrust,
      hull: st.hullTotal, shields: st.shieldMax, shieldTotal: shieldTotal, repair: st.repair.toFixed(1), sensors: st.sensors,
      lockTime: (B.lockBase * (B.lockRefSignature / 250) * (B.lockRefSensor / Math.max(1, st.sensors)) * mods.lockMult).toFixed(1),
      cost: BS.Grid.layoutCost(rows), blocks: Object.keys(v.counts).reduce(function (a, k) { return a + v.counts[k]; }, 0),
    };
  }

  // ---- encounters, rewards and enemy scaling ------------------------------
  function enemyStatMult(profileId) {
    var sc = D().campaign.enemyScaling, prof = D().enemyAI[profileId || "default"] || D().enemyAI.default;
    return prof.statMult + Math.min(sc.maxBonus, sc.perWin * save.campaign.battlesWon);
  }
  // The next enemy, chosen from campaign.encounters by battlesWon. Seeded by the battle record so the
  // hangar threat line and the battle agree, and a reload does not re-roll the enemy.
  function encounter() {
    var c = save.campaign, rng = U.seededRandom(1 + c.battlesWon * 7919 + c.battlesLost * 104729);
    var pool = D().campaign.encounters.filter(function (e) { return c.battlesWon >= e.minWins && D().shipClasses[e.enemyClass]; });
    var total = pool.reduce(function (a, e) { return a + e.weight; }, 0), r = rng() * total, pick = pool[0];
    for (var i = 0; i < pool.length; i++) { r -= pool[i].weight; if (r < 0) { pick = pool[i]; break; } }
    var cls = D().shipClasses[pick.enemyClass], rows, variantName = null;
    if (pick.layout === "random") { rows = BS.Grid.randomVariant(cls, cls.layout, rng); variantName = "Variant"; }
    else if (pick.layout !== "default" && cls.variants && cls.variants[pick.layout]) { rows = cls.variants[pick.layout].rows; variantName = cls.variants[pick.layout].name; }
    else rows = cls.layout;
    var names = D().campaign.klingonNames, name = names.length ? names[Math.floor(rng() * names.length)] : cls.name;
    return { id: pick.id, classId: pick.enemyClass, cls: cls, rows: rows, name: name, variantName: variantName, rewardMult: pick.rewardMult, aiProfile: cls.aiProfile || "default",
      label: cls.className + (variantName ? " · " + variantName : "") };
  }
  function settleBattle(state) {
    var cr = D().campaign.credits, p = state.player, won = state.result === "victory";
    var hullLostPct = Math.round(100 * (1 - p.hull / p.hullMax));
    var earned;
    if (won) {
      save.campaign.battlesWon++; save.campaign.streak++;
      var mult = state.encounter ? state.encounter.rewardMult : 1;
      earned = cr.win * mult - hullLostPct * cr.hullLostPenaltyPerPct + Math.min(5, save.campaign.streak - 1) * cr.winStreakBonus;
    } else {
      save.campaign.battlesLost++; save.campaign.streak = 0;
      earned = cr.loss;
    }
    earned = Math.max(50, Math.round(earned));
    save.credits += earned;
    persist();
    return { earned: earned, hullLostPct: hullLostPct, streak: save.campaign.streak };
  }

  function get() { return save; }

  return { load: load, persist: persist, reset: reset, exportJSON: exportJSON, importJSON: importJSON, hasSave: hasSave, get: get,
    currentClass: currentClass, layoutFor: layoutFor, setLayout: setLayout, battleLayout: battleLayout, buyShip: buyShip, selectShip: selectShip,
    layoutDelta: layoutDelta, countBlocks: countBlocks, applyLayout: applyLayout, builds: builds, saveBuild: saveBuild, deleteBuild: deleteBuild,
    updateTraining: updateTraining, startTraining: startTraining, cancelTraining: cancelTraining, skillMods: skillMods, skillHours: skillHours,
    layoutStats: layoutStats, enemyStatMult: enemyStatMult, encounter: encounter, settleBattle: settleBattle };
})();
