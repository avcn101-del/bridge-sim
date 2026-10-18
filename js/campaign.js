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
    out.intel = {};
    Object.keys(s.intel || {}).forEach(function (id) { var it = s.intel[id]; if (it && Array.isArray(it.rows) && D().shipClasses[it.classId]) out.intel[id] = it; });
    out.scripts = (s.scripts || []).filter(function (sc) { return sc && sc.id && sc.name && Array.isArray(sc.rules); });
    out.scriptByBuild = {}; Object.keys(s.scriptByBuild || {}).forEach(function (id) { if (D().shipClasses[id]) out.scriptByBuild[id] = s.scriptByBuild[id]; });
    out.plans = {}; Object.keys(s.plans || {}).forEach(function (id) { var pl = s.plans[id]; if (pl && Array.isArray(pl.targets)) out.plans[id] = pl; });
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
      if (BS.Grid.arcCoverage(v.grid, b) <= 0) return;
      if (w.kind === "turret") { turretDps += w.damage * mods.turretDamageMult * 0.8 / w.cycle; drain += w.cap / w.cycle; }
      else { launcherDps += w.damage * mods.launcherDamageMult * 0.85 / w.cycle; drain += w.cap / w.cycle; }
    });
    D().builtInModules.forEach(function (id) { var m = D().modules[id]; drain += m.cap / m.cycle; });
    Object.keys(D().modules).forEach(function (id) { var m = D().modules[id]; if (m.block && m.cycle && m.cap && st.alive[m.block]) drain += m.cap / m.cycle; });   // jammer, decoy, neutraliser
    var salvoHeat = 0, heatPerSec = 0;
    st.weapons.forEach(function (b) { var w = b.def.weapon; if (BS.Grid.arcCoverage(v.grid, b) <= 0) return; salvoHeat += w.heat || 0; heatPerSec += (w.heat || 0) / w.cycle; });
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
      ok: v.ok, errors: v.errors, warnings: v.warnings || [], masked: v.masked || 0, counts: v.counts,
      dps: Math.round(turretDps + launcherDps), turretDps: Math.round(turretDps), launcherDps: Math.round(launcherDps),
      cap: capMax, drain: drain.toFixed(1), peakRecharge: peak.toFixed(1), stableAt: stableAt, lasts: lasts,
      powerUsed: st.powerUsed, powerMax: st.powerMax, coverFrac: st.coverFrac, exposed: st.exposed, cloakCover: st.cloakCover, jamCover: st.jamCover, crew: st.crew, poweredFrac: st.poweredFrac, unpowered: st.unpowered,
      heatCap: Math.round(st.heatCap), heatDissipation: st.heatDissipation.toFixed(1), salvoHeat: salvoHeat, heatPerSec: heatPerSec.toFixed(1),
      heatNeutral: Math.min(1, heatPerSec > 0 ? st.heatDissipation / heatPerSec : 1),
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
    var c = save.campaign, rt = c.retry;
    // a retry pins the last fight: the same seed and unlock pool give the same enemy, layout and name
    var seed = rt ? rt.seed : c.battlesWon * 7919 + c.battlesLost * 104729, wonAt = rt ? rt.battlesWon : c.battlesWon;
    var rng = U.seededRandom(1 + seed);
    var pool = D().campaign.encounters.filter(function (e) { return wonAt >= e.minWins && D().shipClasses[e.enemyClass]; });
    var total = pool.reduce(function (a, e) { return a + e.weight; }, 0), r = rng() * total, pick = pool[0];
    for (var i = 0; i < pool.length; i++) { r -= pool[i].weight; if (r < 0) { pick = pool[i]; break; } }
    var cls = D().shipClasses[pick.enemyClass], rows, variantName = null;
    if (pick.layout === "random") { rows = BS.Grid.randomVariant(cls, cls.layout, rng); variantName = "Variant"; }
    else if (pick.layout !== "default" && cls.variants && cls.variants[pick.layout]) { rows = cls.variants[pick.layout].rows; variantName = cls.variants[pick.layout].name; }
    else rows = cls.layout;
    var names = D().campaign.klingonNames, name = names.length ? names[Math.floor(rng() * names.length)] : cls.name;
    var doc = pick.doctrine; if (Array.isArray(doc)) doc = doc[Math.floor(rng() * doc.length)];
    // counter-doctrine: a flagged encounter reads the player's battle layout and answers it (enemyAI.counters)
    var counterReason = null, counterWeak = null;
    if (pick.counter) {
      var pcls = D().shipClasses[save.shipClass], pst = BS.Grid.derive(BS.Grid.build(pcls, battleLayout(save.shipClass)));
      var tubes = pst.alive.torpedo || 0, pulse = pst.alive.pulse || 0, beams = (pst.alive.phaser || 0) + (pst.alive.disruptor || 0), hasCloak = (pst.alive.cloak || 0) > 0, neuts = pst.alive.neut || 0;
      var fac = ["fore", "aft", "port", "starboard"].map(function (f) { return pst.shieldMax[f]; }), weakRatio = Math.min.apply(null, fac) / Math.max(1, Math.max.apply(null, fac));
      var hullKey = pick.enemyClass === "ktinga" ? "ktinga" : "bop";
      for (var ci = 0; ci < D().enemyAI.counters.length; ci++) {
        var ru = D().enemyAI.counters[ci], w = ru.when, ok = true;
        if (w.tubesMin !== undefined && tubes < w.tubesMin) ok = false;
        if (w.pulseMin !== undefined && pulse < w.pulseMin) ok = false;
        if (w.beamsMax !== undefined && beams > w.beamsMax) ok = false;
        if (w.cloak !== undefined && hasCloak !== w.cloak) ok = false;
        if (w.neutMin !== undefined && neuts < w.neutMin) ok = false;
        if (w.weakFacingBelow !== undefined && weakRatio >= w.weakFacingBelow) ok = false;
        if (ok) { if (ru[hullKey] && D().enemyAI.doctrines[ru[hullKey]]) doc = ru[hullKey]; counterReason = ru.reason; counterWeak = ru.weakPointChance || null; break; }
      }
    }
    if (wonAt === 0 && D().campaign.firstFight && counterWeak === null) counterWeak = D().campaign.firstFight.weakPointChance;   // the first fight: no weak-point hunting
    return { id: pick.id, classId: pick.enemyClass, cls: cls, rows: rows, name: name, variantName: variantName, seed: seed, battlesWon: wonAt, retry: !!rt, rewardMult: pick.rewardMult, play: pick.play || null, script: pick.script || "doctrine", damageMult: pick.damageMult || null, counterReason: counterReason, weakPointChance: counterWeak, aiProfile: cls.aiProfile || "default",
      doctrine: doc || D().enemyAI[cls.aiProfile || "default"].doctrine, label: cls.className + (variantName ? " · " + variantName : "") };
  }
  // Refit & retry: pin the last enemy for the next fight (cleared when that fight is settled, or by letGo).
  function setRetry(enc) { if (!enc) return; save.campaign.retry = { encounterId: enc.id, seed: enc.seed, battlesWon: enc.battlesWon !== undefined ? enc.battlesWon : save.campaign.battlesWon }; persist(); }
  function letGo() { save.campaign.retry = null; persist(); }

  // Intel: a layout held under lock long enough is remembered for that encounter id (random variants by seed).
  function recordIntel(enc, how) {
    if (!enc) return;
    save.intel[enc.id] = { rows: enc.rows.slice(), classId: enc.classId, layoutName: enc.variantName || "default", seed: enc.seed || null, how: how, at: Date.now() };
  }
  function intelFor(enc) {
    var it = save.intel[enc.id];
    if (!it) return null;
    if (enc.rows.join("|") !== it.rows.join("|")) return null;   // a different roll of this encounter: stale
    return it;
  }
  // ---- bridge scripts and plans ---------------------------------------------------------------------------
  // The script a hull undocks with: an own script by id, a template by id, or the default template.
  function scriptFor(classId) {
    var id = save.scriptByBuild[classId] || D().script.defaultTemplate, own = save.scripts.filter(function (s) { return s.id === id; })[0];
    return own || D().script.templates[id] || D().script.templates[D().script.defaultTemplate];
  }
  function setScriptFor(classId, id) { save.scriptByBuild[classId] = id; persist(); }
  function saveScript(sc) {
    if (!sc.id) sc.id = "s" + Date.now().toString(36);
    var i = save.scripts.map(function (s) { return s.id; }).indexOf(sc.id);
    if (i >= 0) save.scripts[i] = sc; else save.scripts.push(sc);
    persist(); return sc.id;
  }
  function deleteScript(id) { save.scripts = save.scripts.filter(function (s) { return s.id !== id; }); Object.keys(save.scriptByBuild).forEach(function (c) { if (save.scriptByBuild[c] === id) delete save.scriptByBuild[c]; }); persist(); }
  // The plan for an encounter: up to script.planTargets targets in order ({ x, y } on the intel layout, or { type }).
  function planFor(enc) { return enc && save.plans ? save.plans[enc.id] || null : null; }
  function setPlan(enc, targets) { save.plans[enc.id] = { targets: targets.slice(0, D().script.planTargets), rows: enc.rows.slice() }; persist(); }

  function buyIntel(enc) {
    var cost = D().campaign.intelCost;
    if (save.credits < cost) return "Not enough credits (" + cost + " cr).";
    save.credits -= cost; recordIntel(enc, "bought"); persist();
    return null;
  }
  function settleBattle(state) {
    var cr = D().campaign.credits, p = state.player, won = state.result === "victory";
    if (state.encounter && ((state.lockTime || 0) >= D().campaign.intelMinLockSeconds || p.scanned)) recordIntel(state.encounter, "scanned");
    var hullLostPct = Math.round(100 * (1 - p.hull / p.hullMax));
    var earned, salvage = 0, cleanBonus = 0, clean = won && !(state.callsUsed > 0);
    if (won) {
      save.campaign.battlesWon++; save.campaign.streak++;
      var mult = state.encounter ? state.encounter.rewardMult : 1;
      earned = cr.win * mult - hullLostPct * cr.hullLostPenaltyPerPct + Math.min(5, save.campaign.streak - 1) * cr.winStreakBonus;
      // a clean bridge (no bridge call spent) pays script.bridgeCall.noCallBonus on the win credits, before salvage
      if (clean) { cleanBonus = Math.round(Math.max(50, earned) * (D().script.bridgeCall.noCallBonus - 1)); save.campaign.cleanWins = (save.campaign.cleanWins || 0) + 1; }
      // salvage: whatever of the enemy is still in one piece has value; a disabled ship is captured nearly intact
      var e = state.enemy, frac = D().campaign.salvage[state.resultHow === "disabled" ? "disabled" : state.resultHow === "captured" ? "captured" : "destroyed"];
      if (e) salvage = Math.round(e.grid.blocks.reduce(function (a, b) { return a + (b.alive && !b.structural ? b.def.cost : 0); }, 0) * frac);
    } else {
      save.campaign.battlesLost++; save.campaign.streak = 0;
      earned = cr.loss;
    }
    earned = Math.max(50, Math.round(earned)) + cleanBonus + salvage;
    save.credits += earned;
    save.campaign.retry = null;   // the pinned fight, won or lost, is over
    persist();
    return { earned: earned, salvage: salvage, cleanBonus: cleanBonus, clean: clean, hullLostPct: hullLostPct, streak: save.campaign.streak, how: state.resultHow, cleanWins: save.campaign.cleanWins || 0 };
  }

  function get() { return save; }

  return { load: load, persist: persist, reset: reset, exportJSON: exportJSON, importJSON: importJSON, hasSave: hasSave, get: get,
    currentClass: currentClass, layoutFor: layoutFor, setLayout: setLayout, battleLayout: battleLayout, buyShip: buyShip, selectShip: selectShip,
    layoutDelta: layoutDelta, countBlocks: countBlocks, applyLayout: applyLayout, builds: builds, saveBuild: saveBuild, deleteBuild: deleteBuild, intelFor: intelFor, buyIntel: buyIntel,
    scriptFor: scriptFor, setScriptFor: setScriptFor, saveScript: saveScript, deleteScript: deleteScript, planFor: planFor, setPlan: setPlan, setRetry: setRetry, letGo: letGo,
    updateTraining: updateTraining, startTraining: startTraining, cancelTraining: cancelTraining, skillMods: skillMods, skillHours: skillHours,
    layoutStats: layoutStats, enemyStatMult: enemyStatMult, encounter: encounter, settleBattle: settleBattle };
})();
