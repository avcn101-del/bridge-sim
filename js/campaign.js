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
    out.fits = s.fits || {};
    out.inventory = (s.inventory || []).filter(function (id) { return D().modules[id]; });
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

  // ---- ships and fits -----------------------------------------------------
  function currentClass() { return D().shipClasses[save.shipClass]; }
  function fitFor(classId) {
    var cls = D().shipClasses[classId];
    if (!save.fits[classId]) save.fits[classId] = deepCopy(cls.fit);
    var f = save.fits[classId];
    ["high", "mid", "low"].forEach(function (slot) {
      f[slot] = f[slot] || [];
      while (f[slot].length < cls.slots[slot]) f[slot].push(null);
      f[slot].length = cls.slots[slot];
    });
    return f;
  }
  function fitModules(fit) { return ["high", "mid", "low"].reduce(function (acc, s) { return acc.concat(fit[s].filter(Boolean)); }, []); }
  function usage(fit) {
    var pg = 0, cpu = 0;
    fitModules(fit).forEach(function (id) { pg += D().modules[id].pg; cpu += D().modules[id].cpu; });
    return { pg: pg, cpu: cpu };
  }
  // Can module `id` go into `slot` index `i` of the current ship? Returns null or a reason.
  function fitProblem(classId, fit, slot, i, id) {
    var def = D().modules[id], cls = D().shipClasses[classId];
    if (!def) return "Unknown module.";
    if (def.slot !== slot) return def.name + " is a " + def.slot + " slot module.";
    var trial = deepCopy(fit); trial[slot][i] = id;
    var u = usage(trial);
    if (u.pg > cls.powergrid) return "Not enough power grid (" + u.pg + " / " + cls.powergrid + ").";
    if (u.cpu > cls.cpu) return "Not enough CPU (" + u.cpu + " / " + cls.cpu + ").";
    return null;
  }
  function fitModule(slot, i, id) {
    var fit = fitFor(save.shipClass);
    var problem = fitProblem(save.shipClass, fit, slot, i, id);
    if (problem) return problem;
    var idx = save.inventory.indexOf(id);
    if (idx < 0) return "You do not own that module.";
    save.inventory.splice(idx, 1);
    if (fit[slot][i]) save.inventory.push(fit[slot][i]);
    fit[slot][i] = id;
    persist();
    return null;
  }
  function unfitModule(slot, i) {
    var fit = fitFor(save.shipClass);
    if (!fit[slot][i]) return;
    save.inventory.push(fit[slot][i]); fit[slot][i] = null; persist();
  }
  // A clean fit for battle: slots without nulls.
  function battleFit(classId) {
    var fit = fitFor(classId);
    return { high: fit.high.filter(Boolean), mid: fit.mid.filter(Boolean), low: fit.low.filter(Boolean) };
  }

  // ---- market -------------------------------------------------------------
  function buyModule(id) {
    var def = D().modules[id];
    if (!def) return "Unknown module.";
    if (save.credits < def.cost) return "Not enough credits.";
    save.credits -= def.cost; save.inventory.push(id); persist(); return null;
  }
  function sellModule(id) {
    var idx = save.inventory.indexOf(id);
    if (idx < 0) return "Not in inventory.";
    save.inventory.splice(idx, 1); save.credits += Math.round(D().modules[id].cost * D().campaign.sellBack); persist(); return null;
  }
  function buyShip(classId) {
    var cls = D().shipClasses[classId];
    if (!cls || !cls.purchasable) return "Not for sale.";
    if (save.ownedShips.indexOf(classId) >= 0) return "Already owned.";
    if (save.credits < cls.cost) return "Not enough credits.";
    save.credits -= cls.cost; save.ownedShips.push(classId); save.shipClass = classId; fitFor(classId); persist(); return null;
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

  // ---- fit statistics for the hangar ---------------------------------------
  function fitStats(classId, fit) {
    var cls = D().shipClasses[classId], mods = skillMods();
    var ids = fitModules(fit);
    var fe = { turretDamageMult: 1, launcherDamageMult: 1, capRechargeMult: 1, hullAdd: 0, speedMult: 1 };
    var drain = 0, turretDps = 0, launcherDps = 0, hasBooster = false, boostPerSec = 0;
    ids.forEach(function (id) {
      var def = D().modules[id], e = def.effect || {};
      if (def.kind === "passive") {
        if (e.turretDamageMult) fe.turretDamageMult *= e.turretDamageMult;
        if (e.launcherDamageMult) fe.launcherDamageMult *= e.launcherDamageMult;
        if (e.capRechargeMult) fe.capRechargeMult *= e.capRechargeMult;
        if (e.hullAdd) fe.hullAdd += e.hullAdd;
        if (e.speedMult) fe.speedMult *= e.speedMult;
      } else drain += def.cap / def.cycle;
    });
    ids.forEach(function (id) {
      var def = D().modules[id];
      if (def.kind === "turret") turretDps += def.damage * fe.turretDamageMult * mods.turretDamageMult * 0.8 / def.cycle;
      if (def.kind === "launcher") launcherDps += def.damage * fe.launcherDamageMult * mods.launcherDamageMult * 0.85 / def.cycle;
      if (def.effect && def.effect.shieldBoost) { hasBooster = true; boostPerSec += def.effect.shieldBoost / def.cycle; }
    });
    var capMax = cls.capacitor.max, tau = cls.capacitor.rechargeTime, B = D().balance;
    var rechargeMult = fe.capRechargeMult * mods.capRechargeMult;
    var peak = capMax / tau * B.capCurve * 0.25 * rechargeMult;
    // simulate capacitor with everything running for 10 minutes
    var c = capMax, stableAt = null, lasts = null;
    for (var t = 0; t < 600; t += 0.5) {
      var f = c / capMax, rate = capMax / tau * B.capCurve * Math.max(0, Math.sqrt(f) - f) * rechargeMult;
      if (f < 0.02) rate = capMax / tau * 0.4 * rechargeMult;
      c = Math.min(capMax, c + (rate - drain) * 0.5);
      if (c <= 0) { lasts = t; break; }
    }
    if (lasts === null) {
      // find equilibrium fraction: rate(f) = drain
      var best = 1;
      for (var ff = 1; ff > 0.02; ff -= 0.01) { var r = capMax / tau * B.capCurve * (Math.sqrt(ff) - ff) * rechargeMult; if (r >= drain) { best = ff; break; } }
      stableAt = Math.round(best * 100);
    }
    var u = usage(fit);
    return {
      dps: Math.round(turretDps + launcherDps), turretDps: Math.round(turretDps), launcherDps: Math.round(launcherDps),
      drain: drain.toFixed(1), peakRecharge: peak.toFixed(1), stableAt: stableAt, lasts: lasts,
      speed: (cls.speed * fe.speedMult * mods.speedMult / D().units.pxPerKm).toFixed(1),
      hull: cls.hull + fe.hullAdd, shieldHp: cls.shields.max * 4, shieldRegen: (cls.shields.regen * 4 * mods.shieldRegenMult).toFixed(1), boost: boostPerSec.toFixed(1), hasBooster: hasBooster,
      lockTime: (B.lockBase * (B.lockRefSignature / 250) * (B.lockRefSensor / cls.sensorStrength) * mods.lockMult).toFixed(1),
      pg: u.pg, pgMax: cls.powergrid, cpu: u.cpu, cpuMax: cls.cpu,
    };
  }

  // ---- battle rewards and enemy scaling -----------------------------------
  function enemyStatMult() {
    var sc = D().campaign.enemyScaling, base = D().enemyAI.default.statMult;
    return base + Math.min(sc.maxBonus, sc.perWin * save.campaign.battlesWon);
  }
  function settleBattle(state) {
    var cr = D().campaign.credits, p = state.player, won = state.result === "victory";
    var hullLostPct = Math.round(100 * (1 - p.hull / p.hullMax));
    var earned;
    if (won) {
      save.campaign.battlesWon++; save.campaign.streak++;
      earned = cr.win - hullLostPct * cr.hullLostPenaltyPerPct + Math.min(5, save.campaign.streak - 1) * cr.winStreakBonus;
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
    currentClass: currentClass, fitFor: fitFor, battleFit: battleFit, usage: usage, fitProblem: fitProblem, fitModule: fitModule, unfitModule: unfitModule,
    buyModule: buyModule, sellModule: sellModule, buyShip: buyShip, selectShip: selectShip,
    updateTraining: updateTraining, startTraining: startTraining, cancelTraining: cancelTraining, skillMods: skillMods, skillHours: skillHours,
    fitStats: fitStats, enemyStatMult: enemyStatMult, settleBattle: settleBattle };
})();
