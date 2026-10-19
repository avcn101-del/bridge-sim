// js/campaign.js — progress between battles: save/load (localStorage, export,
// import), credits, ship and module ownership, fitting rules, fit statistics,
// enemy scaling.
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
    // 0.37: the `stance` action became `doctrine` (same ids); plays are gone, a rule that only ran one is dropped.
    // 0.39: a rule naming a condition or action that no longer exists is dropped and the hangar says so (out.notice)
    var dropped = [], C0 = D().script.conditions, A0 = D().script.actions;
    out.scripts.forEach(function (sc) {
      sc.rules = sc.rules.filter(function (r) {
        if (!r || !r.do) return true;
        if (r.do.stance !== undefined) { if (r.do.doctrine === undefined) r.do.doctrine = r.do.stance; delete r.do.stance; }
        if (r.do.play !== undefined) { delete r.do.play; if (!Object.keys(r.do).length) return false; }
        var gone = Object.keys(r.when || {}).concat(Object.keys(r.until || {})).filter(function (k) { return !C0[k]; })
          .concat(Object.keys(r.do).filter(function (k) { return k !== "modules" && !A0[k]; }));
        if (gone.length) { dropped.push(sc.name + ": " + gone.join(", ")); return false; }
        return true;
      });
    });
    if (dropped.length) out.notice = "Rules dropped (their conditions no longer exist): " + dropped.join(" · ");
    out.scriptByBuild = {}; Object.keys(s.scriptByBuild || {}).forEach(function (id) { if (D().shipClasses[id]) out.scriptByBuild[id] = s.scriptByBuild[id]; });
    out.soloScriptByBuild = {}; Object.keys(s.soloScriptByBuild || {}).forEach(function (id) { if (D().shipClasses[id]) out.soloScriptByBuild[id] = s.soloScriptByBuild[id]; });
    out.fleetScriptByBuild = {}; Object.keys(s.fleetScriptByBuild || {}).forEach(function (id) { if (D().shipClasses[id]) out.fleetScriptByBuild[id] = s.fleetScriptByBuild[id]; });
    out.plans = {}; Object.keys(s.plans || {}).forEach(function (id) { var pl = s.plans[id]; if (pl && Array.isArray(pl.targets)) out.plans[id] = pl; });
    out.tuning = {}; Object.keys(s.tuning || {}).forEach(function (id) { if (D().shipClasses[id] && Array.isArray(s.tuning[id])) out.tuning[id] = s.tuning[id]; });
    out.fleet = (Array.isArray(s.fleet) ? s.fleet : []).filter(function (id, i, a) { return D().shipClasses[id] && out.ownedShips.indexOf(id) >= 0 && a.indexOf(id) === i; }).slice(0, D().campaign.fleetMax);
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
  // Tuning rows of a hull (BS.Data.tuning): shield frequencies, armor alloys and ammo per block; blank = faction default.
  function tuningFor(classId) {
    var cls = D().shipClasses[classId];
    if (!save.tuning[classId] || save.tuning[classId].length !== cls.mask.length) save.tuning[classId] = BS.Grid.blankTuning(cls);
    return save.tuning[classId];
  }
  function battleTuning(classId) { return tuningFor(classId).slice(); }
  // Per-cell block prices: a block tuned off its faction's default costs tuning.offFactionCost more.
  function cellCounts(classId, rows, tuning) {
    var cls = D().shipClasses[classId], T = D().tuning, counts = {}, dflt = T.factionDefault[cls.faction];
    for (var y = 0; y < rows.length; y++) for (var x = 0; x < rows[y].length; x++) {
      var t = BS.Grid.typeForLetter(rows[y][x]); if (!t) continue;
      var tune = BS.Grid.tuneOf(cls, t, tuning, x, y), key = t + (tune && tune !== dflt ? "|tuned" : "");
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }
  function battleLayout(classId) {
    var rows = layoutFor(classId), v = BS.Grid.validateLayout(D().shipClasses[classId], rows);
    return v.ok ? rows : D().shipClasses[classId].layout;   // never undock an invalid build
  }
  // Cost of changing the hull's current layout to `rows`: added blocks are bought, removed blocks refunded.
  // Blocks are bought and refunded at their price; retuning a block only pays or refunds the off-faction surcharge.
  function layoutDelta(classId, rows, tuning) {
    var cur = cellCounts(classId, layoutFor(classId), tuningFor(classId)), nxt = cellCounts(classId, rows, tuning || tuningFor(classId)), cost = 0, refund = 0, T = D().tuning, R = D().editor.refund;
    Object.keys(D().blocks).forEach(function (t) {
      var price = D().blocks[t].cost, dAll = ((nxt[t] || 0) + (nxt[t + "|tuned"] || 0)) - ((cur[t] || 0) + (cur[t + "|tuned"] || 0)), dTuned = (nxt[t + "|tuned"] || 0) - (cur[t + "|tuned"] || 0);
      if (dAll > 0) cost += dAll * price; else if (dAll < 0) refund += -dAll * price * R;
      var sur = price * T.offFactionCost;
      if (dTuned > 0) cost += dTuned * sur; else if (dTuned < 0) refund += -dTuned * sur * R;
    });
    return { cost: Math.round(cost), refund: Math.round(refund), net: Math.round(cost - refund) };
  }
  // Block cost of a layout, and the effective cost of an enemy layout: its blocks times the stat multiplier it fights
  // with (a Bird-of-Prey at ×1.4 weighs about what a stock Constitution does).
  function layoutCost(rows) { var c = countBlocks(rows), cost = 0; Object.keys(c).forEach(function (t) { cost += c[t] * (D().blocks[t] ? D().blocks[t].cost : 0); }); return cost; }
  function effectiveCost(rows, profileId) { return layoutCost(rows) * enemyStatMult(profileId); }
  function countBlocks(rows) {
    var counts = {};
    rows.forEach(function (r) { for (var i = 0; i < r.length; i++) { var t = BS.Grid.typeForLetter(r[i]); if (t) counts[t] = (counts[t] || 0) + 1; } });
    return counts;
  }
  // Validate, charge the difference and store the layout. Returns null or an error string.
  function applyLayout(classId, rows, tuning) {
    var v = BS.Grid.validateLayout(D().shipClasses[classId], rows);
    if (!v.ok) return v.errors[0];
    var delta = layoutDelta(classId, rows, tuning);
    if (!canAfford(delta.net)) return "Not enough credits: this build costs " + delta.net.toLocaleString() + " cr more than you have.";
    spend(delta.net);
    save.layouts[classId] = rows.slice();
    if (tuning) save.tuning[classId] = tuning.slice();
    persist();
    return null;
  }
  function builds(classId) { if (!save.builds[classId]) save.builds[classId] = []; return save.builds[classId]; }
  function saveBuild(classId, name, rows, tuning) {
    var list = builds(classId), existing = list.filter(function (b) { return b.name === name; })[0];
    if (existing) { existing.rows = rows.slice(); existing.tuning = tuning ? tuning.slice() : null; }
    else { if (list.length >= D().editor.maxSavedBuilds) return "Only " + D().editor.maxSavedBuilds + " saved builds per hull. Delete one first."; list.push({ name: name, rows: rows.slice(), tuning: tuning ? tuning.slice() : null }); }
    persist(); return null;
  }
  function deleteBuild(classId, name) { save.builds[classId] = builds(classId).filter(function (b) { return b.name !== name; }); persist(); }

  function buyShip(classId) {
    var cls = D().shipClasses[classId];
    if (!cls || !cls.purchasable) return "Not for sale.";
    if (save.ownedShips.indexOf(classId) >= 0) return "Already owned.";
    if (!canAfford(cls.cost)) return "Not enough credits.";
    spend(cls.cost); save.ownedShips.push(classId); save.shipClass = classId; layoutFor(classId); persist(); return null;
  }
  function selectShip(classId) { if (save.ownedShips.indexOf(classId) >= 0) { save.shipClass = classId; persist(); } }
  // The hulls that undock together (0.31, campaign.fleetMax): the hangar's ship first, then the rest of save.fleet. One
  // hull per class (a class has one layout, one tuning and one script in the save). Empty save.fleet = the ship alone.
  function fleet() {
    var max = D().campaign.fleetMax, out = [save.shipClass];
    (save.fleet || []).forEach(function (id) { if (out.length < max && out.indexOf(id) < 0 && save.ownedShips.indexOf(id) >= 0 && D().shipClasses[id]) out.push(id); });
    return out;
  }
  function setFleet(ids) { save.fleet = (ids || []).filter(function (id, i, a) { return D().shipClasses[id] && save.ownedShips.indexOf(id) >= 0 && a.indexOf(id) === i; }).slice(0, D().campaign.fleetMax); persist(); }

  // ---- layout statistics for the hangar -------------------------------------
  function layoutStats(classId, rows) {
    var cls = D().shipClasses[classId], mods = { turretDamageMult: 1, launcherDamageMult: 1, speedMult: 1, shieldRegenMult: 1, capRechargeMult: 1, lockMult: 1 }, B = D().balance, g = D().grid;
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
      powerUsed: st.powerUsed, powerMax: st.powerMax, coverFrac: st.coverFrac, exposed: st.exposed, cloakCover: st.cloakCover, jamCover: st.jamCover, poweredFrac: st.poweredFrac, unpowered: st.unpowered,
      speed: (cls.speed * st.speedMult * mods.speedMult / D().units.pxPerKm).toFixed(1), speedMult: st.speedMult.toFixed(2), mass: st.mass, thrust: st.thrust,
      hull: st.hullTotal, shields: st.shieldMax, shieldTotal: shieldTotal, repair: st.repair.toFixed(1), sensors: st.sensors,
      lockTime: (B.lockBase * (B.lockRefSignature / 250) * (B.lockRefSensor / Math.max(1, st.sensors)) * mods.lockMult).toFixed(1),
      cost: BS.Grid.layoutCost(rows), blocks: Object.keys(v.counts).reduce(function (a, k) { return a + v.counts[k]; }, 0),
    };
  }

  // ---- encounters, rewards and enemy scaling ------------------------------
  // kind (0.45): a fleet encounter takes enemyScaling.fleetFactor of the win bonus
  function enemyStatMult(profileId, kind) {
    var sc = D().campaign.enemyScaling, prof = D().enemyAI[profileId || "default"] || D().enemyAI.default;
    return prof.statMult + Math.min(sc.maxBonus, sc.perWin * save.campaign.battlesWon) * (kind === "fleet" ? (sc.fleetFactor === undefined ? 1 : sc.fleetFactor) : 1);
  }
  // dev mode (0.45, save.settings.devMode): nothing costs credits, so a build can be tried
  function devMode() { return !!(save.settings && save.settings.devMode); }
  function setDevMode(on) { save.settings = save.settings || {}; save.settings.devMode = !!on; persist(); }
  function canAfford(cost) { return devMode() || cost <= save.credits; }
  function spend(cost) { if (!devMode()) save.credits -= cost; }
  // The next enemy, chosen from campaign.encounters by battlesWon. Seeded by the battle record so the
  // hangar threat line and the battle agree, and a reload does not re-roll the enemy.
  function encounter() {
    var c = save.campaign, rt = c.retry;
    // a retry pins the last fight: the same seed and unlock pool give the same enemy, layout and name
    var seed = rt ? rt.seed : c.battlesWon * 7919 + c.battlesLost * 104729, wonAt = rt ? rt.battlesWon : c.battlesWon;
    var rng = U.seededRandom(1 + seed);
    // runs (0.35): a boss slot every bossEvery-th battle once the roster can meet it; fleet encounters need the roster too
    var R = D().campaign.run, hulls = fleet().length, battles = rt ? rt.battles || 0 : c.battlesWon + c.battlesLost;
    var bossSlot = hulls >= R.fleetMinHulls && wonAt >= R.bossFromWins && battles % R.bossEvery === R.bossEvery - 1;
    var pool = D().campaign.encounters.filter(function (e) {
      if (!(wonAt >= e.minWins && D().shipClasses[e.enemyClass])) return false;
      var kind = e.kind || "solo";
      if (bossSlot) return kind === "boss";
      if (kind === "boss") return false;
      if (kind === "fleet") return hulls >= (e.minHulls || R.fleetMinHulls);
      return true;
    });
    // a boss slot takes the first boss not yet beaten (0.41, save.campaign.bossesBeaten); all beaten: any of them by weight
    if (bossSlot && pool.length) { var beaten = c.bossesBeaten || [], fresh = pool.filter(function (e) { return beaten.indexOf(e.id) < 0; }); if (fresh.length) pool = [fresh[0]]; }
    if (!pool.length) pool = D().campaign.encounters.filter(function (e) { return (e.kind || "solo") === "solo" && wonAt >= e.minWins; });
    var total = pool.reduce(function (a, e) { return a + e.weight; }, 0), r = rng() * total, pick = pool[0];
    for (var i = 0; i < pool.length; i++) { r -= pool[i].weight; if (r < 0) { pick = pool[i]; break; } }
    var cls = D().shipClasses[pick.enemyClass], rows, variantName = null;
    if (pick.layout === "random") { rows = BS.Grid.randomVariant(cls, cls.layout, rng); variantName = "Variant"; }
    else if (pick.layout !== "default" && cls.variants && cls.variants[pick.layout]) { rows = cls.variants[pick.layout].rows; variantName = cls.variants[pick.layout].name; }
    else rows = cls.layout;
    var names = D().campaign.klingonNames, name = pick.name || (names.length ? names[Math.floor(rng() * names.length)] : cls.name);   // a boss carries its own name (0.41)
    var doc = pick.doctrine; if (Array.isArray(doc)) doc = doc[Math.floor(rng() * doc.length)];
    var script = pick.script || "doctrine";
    // the very first fight: no weak-point hunting (campaign.firstFight)
    var counterWeak = wonAt === 0 && D().campaign.firstFight ? D().campaign.firstFight.weakPointChance : null;
    var variant = null; if (cls.variants) Object.keys(cls.variants).forEach(function (k) { if (cls.variants[k].rows === rows) variant = cls.variants[k]; });
    var tuningRows = variant && variant.tuning ? variant.tuning : null;
    var enc = { id: pick.id, classId: pick.enemyClass, cls: cls, rows: rows, name: name, variantName: variantName, tuning: tuningRows, seed: seed, battlesWon: wonAt, retry: !!rt, rewardMult: pick.rewardMult, script: script, damageMult: pick.damageMult || null, weakPointChance: counterWeak, aiProfile: cls.aiProfile || "default",
      doctrine: doc || D().enemyAI[cls.aiProfile || "default"].doctrine, label: cls.className + (variantName ? " · " + variantName : "") };
    // the enemy side (0.31): the ship above, then every entry of pick.ships (a fleet encounter), each rolled from the
    // same seeded stream so the hangar and the battle agree
    enc.ships = [shipSpec(enc)].concat((pick.ships || []).map(function (ent) { return extraSpec(ent, rng, name); }));
    enc.kind = pick.kind || "solo";
    enc.battles = battles; enc.bossSlot = bossSlot;
    // who undocks (0.35): a solo encounter sends the hangar's ship alone, the rest send the roster
    enc.roster = enc.kind === "solo" ? [save.shipClass] : fleet();
    enc.nextBoss = !bossSlot && hulls >= R.fleetMinHulls && wonAt >= R.bossFromWins ? (R.bossEvery - 1 - (battles % R.bossEvery)) : null;
    // a boss's reinforcements (0.33): spawned by its script's `summon` action, rolled here so hangar and battle agree
    enc.reinforcements = (pick.reinforcements || []).map(function (ent) { return extraSpec(ent, rng, name); });
    if (enc.ships.length > 1) enc.label += " +" + (enc.ships.length - 1);
    return enc;
  }
  // What BS.Game needs to spawn one enemy ship.
  function shipSpec(e) { return { classId: e.classId, rows: e.rows, name: e.name, tuning: e.tuning || null, doctrine: e.doctrine, script: e.script, aiProfile: e.aiProfile, damageMult: e.damageMult, weakPointChance: e.weakPointChance, variantName: e.variantName }; }
  // An extra ship of a fleet encounter ({ enemyClass, layout, doctrine, script, damageMult }): no learning, no counter.
  function extraSpec(ent, rng, usedName) {
    var cls = D().shipClasses[ent.enemyClass], rows, variantName = null;
    if (ent.layout === "random") { rows = BS.Grid.randomVariant(cls, cls.layout, rng); variantName = "Variant"; }
    else if (ent.layout !== "default" && cls.variants && cls.variants[ent.layout]) { rows = cls.variants[ent.layout].rows; variantName = cls.variants[ent.layout].name; }
    else rows = cls.layout;
    var names = D().campaign.klingonNames.filter(function (n) { return n !== usedName; }), name = names.length ? names[Math.floor(rng() * names.length)] : cls.name;
    var doc = ent.doctrine; if (Array.isArray(doc)) doc = doc[Math.floor(rng() * doc.length)];
    var variant = null; if (cls.variants) Object.keys(cls.variants).forEach(function (k) { if (cls.variants[k].rows === rows) variant = cls.variants[k]; });
    var prof = cls.aiProfile || "default";
    return { classId: ent.enemyClass, rows: rows, name: name, tuning: variant && variant.tuning ? variant.tuning : null, doctrine: doc || D().enemyAI[prof].doctrine, script: ent.script || "doctrine", aiProfile: prof, damageMult: ent.damageMult || null, weakPointChance: null, variantName: variantName };
  }
  // Refit & retry: pin the last enemy for the next fight (cleared when that fight is settled, or by letGo).
  function setRetry(enc) { if (!enc) return; save.campaign.retry = { encounterId: enc.id, seed: enc.seed, battlesWon: enc.battlesWon !== undefined ? enc.battlesWon : save.campaign.battlesWon, battles: enc.battles }; persist(); }
  function letGo() { save.campaign.retry = null; persist(); }

  // Intel: a layout held under lock long enough is remembered for that encounter id (random variants by seed).
  function recordIntel(enc, how) {
    if (!enc) return;
    save.intel[enc.id] = { rows: enc.rows.slice(), classId: enc.classId, layoutName: enc.variantName || "default", seed: enc.seed || null, tuning: enc.tuning || null, how: how, at: Date.now() };
  }
  function intelFor(enc) {
    var it = save.intel[enc.id];
    if (!it) return null;
    if (enc.rows.join("|") !== it.rows.join("|")) return null;   // a different roll of this encounter: stale
    return it;
  }
  // ---- bridge scripts and plans ---------------------------------------------------------------------------
  // The script a hull undocks with: an own script by id, a template by id, or the default template.
  // The script a hull undocks with, by the encounter's kind (0.43 / 0.44): its solo script alone, its skirmish script in a
  // fleet fight, else the one in scriptByBuild (the boss script, and the default for the kinds without one).
  function kindMap(kind) { return kind === "solo" ? save.soloScriptByBuild : kind === "fleet" ? save.fleetScriptByBuild : null; }
  function scriptIdFor(classId, kind) { var m = kindMap(kind); return (m && m[classId]) || save.scriptByBuild[classId] || D().script.defaultTemplate; }
  function scriptFor(classId, kind) {
    var id = scriptIdFor(classId, kind), own = save.scripts.filter(function (s) { return s.id === id; })[0];
    return own || D().script.templates[id] || D().script.templates[D().script.defaultTemplate];
  }
  function setScriptFor(classId, id, kind) { var m = kindMap(kind); if (m) m[classId] = id; else save.scriptByBuild[classId] = id; persist(); }
  function saveScript(sc) {
    if (!sc.id) sc.id = "s" + Date.now().toString(36);
    var i = save.scripts.map(function (s) { return s.id; }).indexOf(sc.id);
    if (i >= 0) save.scripts[i] = sc; else save.scripts.push(sc);
    persist(); return sc.id;
  }
  function deleteScript(id) { save.scripts = save.scripts.filter(function (s) { return s.id !== id; }); [save.scriptByBuild, save.soloScriptByBuild, save.fleetScriptByBuild].forEach(function (map) { Object.keys(map).forEach(function (c) { if (map[c] === id) delete map[c]; }); }); persist(); }
  // The plan for an encounter: up to script.planTargets targets in order ({ x, y } on the intel layout, or { type }).
  function planFor(enc) { return enc && save.plans ? save.plans[enc.id] || null : null; }
  function setPlan(enc, targets) { save.plans[enc.id] = { targets: targets.slice(0, D().script.planTargets), rows: enc.rows.slice() }; persist(); }

  function buyIntel(enc) {
    var cost = D().campaign.intelCost;
    if (!canAfford(cost)) return "Not enough credits (" + cost + " cr).";
    spend(cost); recordIntel(enc, "bought"); persist();
    return null;
  }
  function settleBattle(state) {
    var cr = D().campaign.credits, p = state.player, won = state.result === "victory";
    var team = state.teams && state.teams.player && state.teams.player.length ? state.teams.player : [p], eteam = state.teams && state.teams.enemy && state.teams.enemy.length ? state.teams.enemy : (state.enemy ? [state.enemy] : []);
    if (state.encounter && ((state.lockTime || 0) >= D().campaign.intelMinLockSeconds || team.some(function (s) { return s.scanned; }))) recordIntel(state.encounter, "scanned");
    // hull lost over the whole side (every hull's block hp, a destroyed hull counting as all lost)
    var hMax = 0, hNow = 0; team.forEach(function (s) { hMax += s.hullMax; hNow += s.flags.destroyed ? 0 : s.hull; });
    var hullLostPct = Math.round(100 * (1 - hNow / Math.max(1, hMax)));
    var earned, salvage = 0, cleanBonus = 0, clean = won && !(state.callsUsed > 0);
    if (won) {
      save.campaign.battlesWon++; save.campaign.streak++;
      if (state.encounter && state.encounter.kind === "boss") { var bb = save.campaign.bossesBeaten = save.campaign.bossesBeaten || []; if (bb.indexOf(state.encounter.id) < 0) bb.push(state.encounter.id); }   // 0.41: the boss slot moves on
      var mult = state.encounter ? state.encounter.rewardMult : 1;
      earned = cr.win * mult - hullLostPct * cr.hullLostPenaltyPerPct * (cr.hullLostScalesWithReward ? mult : 1) + Math.min(5, save.campaign.streak - 1) * cr.winStreakBonus;
      // a clean bridge (no bridge call spent) pays script.bridgeCall.noCallBonus on the win credits, before salvage
      if (clean) { cleanBonus = Math.round(Math.max(50, earned) * (D().script.bridgeCall.noCallBonus - 1)); save.campaign.cleanWins = (save.campaign.cleanWins || 0) + 1; }
      // every enemy hull still in one piece pays by how it ended: a disabled hull is worth more than a wreck
      eteam.forEach(function (e) {
        var how = e.flags.disabled && !e.flags.destroyed ? "disabled" : "destroyed", frac = D().campaign.salvage[how];
        salvage += Math.round(e.grid.blocks.reduce(function (a, b) { return a + (b.alive && !b.structural ? b.def.cost : 0); }, 0) * frac);
      });
    } else {
      save.campaign.battlesLost++; save.campaign.streak = 0;
      earned = cr.loss;
    }
    earned = Math.max(50, Math.round(earned)) + cleanBonus + salvage;
    save.credits += earned;
    // repair bills (0.35): destroyed blocks are rebuilt at a fraction of their price, a lost hull at a larger one
    var RP = D().campaign.repair, repairs = 0, repairLines = [];
    team.forEach(function (s) {
      var lost = s.flags.destroyed, cost = 0;
      s.grid.blocks.forEach(function (b) { if (b.structural) return; if (lost) cost += b.def.cost * RP.lostHull; else if (!b.alive) cost += b.def.cost * RP.destroyedBlock; });
      cost = Math.round(cost);
      if (cost > 0) { repairs += cost; repairLines.push({ name: s.name, cost: cost, lost: lost }); }
    });
    repairs = Math.min(repairs, save.credits);   // never below zero: the yard works on credit it will never collect
    save.credits -= repairs;
    save.campaign.retry = null;   // the pinned fight, won or lost, is over
    persist();
    return { earned: earned, salvage: salvage, cleanBonus: cleanBonus, clean: clean, hullLostPct: hullLostPct, streak: save.campaign.streak, how: state.resultHow, cleanWins: save.campaign.cleanWins || 0, repairs: repairs, repairLines: repairLines };
  }

  function get() { return save; }

  return { load: load, persist: persist, reset: reset, exportJSON: exportJSON, importJSON: importJSON, hasSave: hasSave, get: get,
    currentClass: currentClass, layoutFor: layoutFor, setLayout: setLayout, battleLayout: battleLayout, buyShip: buyShip, selectShip: selectShip, fleet: fleet, setFleet: setFleet,
    layoutDelta: layoutDelta, countBlocks: countBlocks, applyLayout: applyLayout, tuningFor: tuningFor, battleTuning: battleTuning, builds: builds, saveBuild: saveBuild, deleteBuild: deleteBuild, intelFor: intelFor, buyIntel: buyIntel, layoutCost: layoutCost, effectiveCost: effectiveCost,
    scriptFor: scriptFor, scriptIdFor: scriptIdFor, setScriptFor: setScriptFor, saveScript: saveScript, deleteScript: deleteScript, planFor: planFor, setPlan: setPlan, setRetry: setRetry, letGo: letGo,
    layoutStats: layoutStats, enemyStatMult: enemyStatMult, encounter: encounter, settleBattle: settleBattle, devMode: devMode, setDevMode: setDevMode, canAfford: canAfford };
})();
