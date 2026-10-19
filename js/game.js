// js/game.js — game state, fixed-timestep loop, pause, battle start/end, commands.
window.BS = window.BS || {};

BS.Game = (function () {
  var U = BS.Util;
  var state = { phase: "start", time: 0, paused: false, player: null, enemy: null, ships: [], teams: { player: [], enemy: [] }, result: null, endTimer: 0, hover: null, zoom: 1, zoomBias: 1, reward: null, encounter: null, speed: 1, calls: 0, callsUsed: 0 };
  var accumulator = 0, lastFrame = 0, running = false;
  var subscribed = false;

  function init() {
    BS.Events.on("shieldHit", function (r) { attribute(r.ship, r.absorbed); });
    BS.Events.on("hullHit", function (r) { attribute(r.ship, r.hullDamage); });
    BS.Events.on("enemyRolled", function (r) { if (state.style) { if (r.ship === state.player) state.style.player.roll = true; else if (r.ship === state.enemy) state.style.enemy.roll = true; } });
    state.zoom = BS.Data.balance.zoom.start;
    BS.Renderer.init(document.getElementById("view"));
    BS.Campaign.load();
    BS.Hangar.init(api);
    BS.UI.init(api);
    BS.Effects.reset();
    if (!subscribed) { subscribe(); subscribed = true; }
    BS.UI.showStart();
    if (!running) { running = true; lastFrame = performance.now(); requestAnimationFrame(frame); }
  }

  function subscribe() {
    // A side loses when none of its ships can still fight (BS.Fleet.teamFighting): destroyed, disabled or captured.
    // `how` is what happened to the last of them, for the report and the salvage rate.
    function shipOut(ship, how) {
      if (state.phase !== "battle") return;
      if (how === "captured") ship.flags.captured = true;
      var lost = ship.team === "player" ? !BS.Fleet.teamFighting("player") : !BS.Fleet.teamFighting("enemy");
      if (!lost) { syncRoles(); return; }
      state.result = ship.team === "player" ? "defeat" : "victory";
      state.resultHow = how;
      state.phase = "ending";
      state.endTimer = BS.Data.balance.destroyedEndDelay;
      BS.Events.emit("battleEnded", { result: state.result, how: how, state: state });
    }
    BS.Events.on("shipDestroyed", function (e) { shipOut(e.ship, "destroyed"); });
    BS.Events.on("shipDisabled", function (e) { shipOut(e.ship, "disabled"); });
    BS.Events.on("shipCaptured", function (e) { shipOut(e.ship, "captured"); });
  }
  // The viewer (state.player: the hull the panels, the module bar and the crew voices follow) and the primary enemy
  // (state.enemy: the scan panel, the overlays and the report's "their bridge"). With one ship a side they never change;
  // in a fleet the viewer passes to the next fighting hull when it is lost, and the primary enemy follows the viewer's
  // current target.
  function syncRoles() {
    var p = state.player;
    if (!p || !BS.Fleet.fighting(p)) {
      var next = state.teams.player.filter(BS.Fleet.fighting)[0] || state.teams.player.filter(function (s) { return !s.flags.destroyed; })[0] || p;
      if (next && next !== p) { state.player = next; if (!state.dry) { BS.UI.setShipName(next.name.toUpperCase()); BS.UI.buildModuleBar(next); } BS.Events.emit("viewerChanged", { ship: next, prev: p }); }
    }
    var v = state.player, e = state.enemy;
    var want = v && v.target && !v.target.flags.destroyed ? v.target : (e && !e.flags.destroyed ? e : state.teams.enemy.filter(function (s) { return !s.flags.destroyed; })[0] || e);
    if (want !== e) { state.enemy = want; BS.Events.emit("primaryEnemyChanged", { ship: want, prev: e }); }
    if (state.player !== p || state.enemy !== e) BS.Crew.reset(state.player, state.enemy);
  }

  // opts.dry: a dry run from the hangar (BS.Game.dryRun): the same battle set-up without touching the interface, stepped
  // by hand and never settled. opts.script overrides the player's script.
  function startBattle(opts) {
    opts = opts || {};
    var B = BS.Data.balance, dry = !!opts.dry;
    BS.Weapons.reset();
    BS.Effects.reset();
    BS.Renderer.resetCamera();
    if (!dry) { BS.UI.clearLog(); BS.UI.hideOverlays(); }
    state.dry = dry;
    state.time = 0; state.paused = false; state.result = null; state.resultHow = null; state.endTimer = 0; state.hover = null; state.reward = null; state.lockTime = 0; state.boardingLog = null;
    state.speed = 1; state.calls = BS.Data.script.bridgeCall.tokens; state.callsUsed = 0; state.callLog = []; state.summoned = false;
    // what the fight looked like (0.26): damage landed per pair of standing rules (their rule | our rule), and each
    // ship's style (time per doctrine, side and aim, average range, cloaked and governor-off time) for the report's
    // "why you lost" and the campaign's signature of a win
    state.attrib = { taken: {}, dealt: {} };
    state.style = { player: newStyle(), enemy: newStyle() };
    state.zoom = BS.Data.balance.zoom.start; state.zoomBias = 1;
    var save = BS.Campaign.get();
    // the player's side: the hulls of save.fleet (the hangar's ship first), one script each, line abreast at the origin
    var enc = BS.Campaign.encounter();
    var fleet = enc.roster || BS.Campaign.fleet(), spacing = BS.Ships.px(B.fleetSpacingKm), players = [], enemies = [];
    fleet.forEach(function (classId, i) {
      var off = (i - (fleet.length - 1) / 2) * spacing;
      players.push(BS.Ships.create(classId, { isPlayer: true, team: "player", pos: { x: off, y: 0 }, heading: -Math.PI / 2, layout: BS.Campaign.battleLayout(classId), tuning: BS.Campaign.battleTuning(classId), mods: BS.Campaign.skillMods() }));
    });
    var player = players[0];
    // the enemy's side: every ship of the encounter (enc.ships; one for a classic 1v1), spread across their bearing
    var ang = U.rand(-0.6, 0.6) - Math.PI / 2;
    var dist = BS.Ships.px(B.arenaStartDistanceKm);
    enc.ships.forEach(function (sp, i) {
      var off = (i - (enc.ships.length - 1) / 2) * spacing, ox = Math.cos(ang + Math.PI / 2) * off, oy = Math.sin(ang + Math.PI / 2) * off;
      enemies.push(spawnEnemy(sp, { x: Math.cos(ang) * dist + ox, y: Math.sin(ang) * dist + oy }, ang + Math.PI));
    });
    var enemy = enemies[0];
    state.encounter = enc;
    state.player = player; state.enemy = enemy; state.enemyFlag = enemy;
    state.teams = { player: players, enemy: enemies }; state.ships = players.concat(enemies);
    // every ship fights its nearest hostile to begin with (BS.Fleet); both bridges fight by a script (BS.Script): the
    // enemy's names its doctrine ("encounter") and plays; the player's is the one assigned to each hull in the hangar,
    // a template by default (opts.script overrides the flagship's)
    enemies.forEach(function (e) { bindEnemy(e, BS.Fleet.nearestHostile(e) || player); });
    players.forEach(function (pl, i) {
      var t = BS.Fleet.nearestHostile(pl) || enemy;
      pl.target = t; pl.selected = t;
      BS.EnemyAI.setStance(pl, t, BS.Data.helm.defaultStance);   // the helm flies the default stance from the start
      BS.Script.start(pl, t, (i === 0 && opts.script) || BS.Campaign.scriptFor(pl.classId));
    });
    BS.Crew.reset(player, enemy);
    state.phase = "battle";
    if (dry) { state.paused = true; return; }
    BS.UI.setAlert("none");
    BS.UI.setShipName(player.name.toUpperCase());
    BS.UI.buildModuleBar(player);
    BS.Events.emit("battleStarted", state);
    BS.UI.addLog("computer", "Simulation running. You have the conn, Captain.", "system");
    BS.Crew.battleStart();
  }

  // Dry run (hangar): one simulated battle of the current ship, script and next enemy, stepped in chunks between
  // frames; onDone gets { result, how, time, hullPct, enemyHullPct, trace }. Nothing is settled or saved; the hangar
  // stays open. Hit rolls are random, so it is one possible fight, not a verdict.
  var dryToken = 0;
  function dryRun(script, onProgress, onDone) {
    var DR = BS.Data.script.dryRun, token = ++dryToken;
    startBattle({ dry: true, script: script });
    var p = state.player, e = state.enemy, dt = B().simStep;
    function chunk() {
      if (token !== dryToken) return;
      var n = 0;
      while (state.phase === "battle" && state.time < DR.maxSeconds && n++ < DR.stepsPerChunk) step(dt);
      if (state.phase === "battle" && state.time < DR.maxSeconds) { if (onProgress) onProgress(state.time); setTimeout(chunk, 0); return; }
      var guard = 0; while (state.phase === "ending" && guard++ < 2000) step(dt);
      var blockMax = 0, blockNow = 0, eHull = 0, eHullMax = 0;
      state.teams.player.forEach(function (s) { s.grid.blocks.forEach(function (b) { if (!b.structural) { blockMax += b.maxHp; if (b.alive) blockNow += b.hp; } }); });
      state.teams.enemy.forEach(function (s) { eHullMax += s.hullMax; eHull += s.hull; });   // hull left at the end, destroyed or not (as the single-enemy report read it)
      var out = { result: state.result || "stalemate", how: state.resultHow, time: state.time, hullPct: Math.round(100 * blockNow / Math.max(1, blockMax)), enemyHullPct: Math.round(100 * eHull / Math.max(1, eHullMax)), trace: (p.scriptTrace || []).slice(), scanned: !!p.scanned, neverFired: BS.Script.explain(p),
        ships: state.teams.player.map(function (s) { var mx = 0, now = 0; s.grid.blocks.forEach(function (b) { if (!b.structural) { mx += b.maxHp; if (b.alive) now += b.hp; } }); return { name: s.name, classId: s.classId, hullPct: Math.round(100 * now / Math.max(1, mx)), destroyed: s.flags.destroyed, disabled: s.flags.disabled }; }),
        enemies: state.teams.enemy.map(function (s) { return { name: s.name, classId: s.classId, hullPct: Math.round(100 * s.hull / s.hullMax), destroyed: s.flags.destroyed, disabled: s.flags.disabled, captured: !!s.flags.captured }; }) };
      state.phase = "ended"; state.dry = false; state.paused = false;
      if (onDone) onDone(out);
    }
    setTimeout(chunk, 0);
    return token;
  }
  function cancelDryRun() { dryToken++; if (state.dry) { state.phase = "ended"; state.dry = false; state.paused = false; } }
  function B() { return BS.Data.balance; }

  // One enemy hull from an encounter spec (BS.Campaign.encounter().ships / .reinforcements), not yet fighting.
  function spawnEnemy(sp, pos, heading) {
    var prof = BS.Data.enemyAI[sp.aiProfile] || BS.Data.enemyAI.default;
    var e = BS.Ships.create(sp.classId, { name: sp.name, team: "enemy", layout: sp.rows, tuning: sp.tuning || null, pos: pos, heading: heading, statMult: BS.Campaign.enemyStatMult(sp.aiProfile), mods: { damageMult: sp.damageMult || prof.damageMult, shieldMaxMult: prof.shieldMult || 1, shieldRegenMult: prof.shieldRegenMult || 1 } });
    e.spec = sp;
    return e;
  }
  // Its doctrine machine and bridge script, against a first target.
  function bindEnemy(e, t) {
    var sp = e.spec, overrides = {};
    if (sp.weakPointChance !== null && sp.weakPointChance !== undefined) overrides.weakPointChance = sp.weakPointChance;
    e.target = t;
    BS.EnemyAI.attach(e, t, sp.aiProfile, sp.doctrine, Object.keys(overrides).length ? overrides : null);
    var es = BS.Script.resolve(BS.Data.script.enemyScripts[sp.script] || BS.Data.script.enemyScripts.doctrine);
    BS.Script.start(e, t, bindDoctrine(es, sp.doctrine));
  }
  // Script action `summon` (0.33): the encounter's reinforcements drop in astern of the ship, once per battle.
  function summon(ship) {
    var enc = state.encounter, specs = enc ? enc.reinforcements : null;
    if (!specs || !specs.length) return "no reinforcements";
    if (state.summoned) return "already called";
    state.summoned = true;
    var B = BS.Data.balance, spacing = BS.Ships.px(B.fleetSpacingKm), back = ship.heading + Math.PI, out = [];
    specs.forEach(function (sp, i) {
      var off = (i - (specs.length - 1) / 2) * spacing, d = ship.visual.length * 0.9 + spacing;
      var e = spawnEnemy(sp, { x: ship.pos.x + Math.cos(back) * d + Math.cos(back + Math.PI / 2) * off, y: ship.pos.y + Math.sin(back) * d + Math.sin(back + Math.PI / 2) * off }, ship.heading);
      state.teams.enemy.push(e); state.ships.push(e);
      bindEnemy(e, BS.Fleet.nearestHostile(e) || state.player);
      out.push(e);
    });
    BS.Events.emit("reinforcements", { ship: ship, ships: out });
    return null;
  }
  // An enemy script's "doctrine: encounter" means the doctrine the encounter rolled.
  function bindDoctrine(sc, doctrineId) {
    var out = JSON.parse(JSON.stringify(sc));
    (out.rules || []).forEach(function (r) { if (r.do && r.do.doctrine === "encounter") r.do.doctrine = doctrineId; });
    return out;
  }

  function command(id, args) {
    if (state.phase !== "battle") return;
    BS.Crew.command(id, args);
  }
  // The captain's bridge call (script.bridgeCall.tokens per battle): an override on the running script.
  function bridgeCall(call) {
    if (state.phase !== "battle" || !state.player) return "phase";
    if (state.calls <= 0) { BS.Events.emit("bridgeCallRefused", { call: call }); return "none"; }
    if (!BS.Script.bridgeCall(state.player, call)) return "failed";
    state.calls--; state.callsUsed++;
    var entry = { t: state.time, call: call, text: BS.Script.describeDo(BS.Script.callRule(call).do) };
    state.callLog.push(entry);
    BS.Events.emit("bridgeCall", { ship: state.player, call: call, left: state.calls, entry: entry });
    return "ok";
  }
  function setSpeed(x) { var ok = BS.Data.balance.speeds; state.speed = ok.indexOf(x) >= 0 ? x : 1; BS.Events.emit("speedChanged", { speed: state.speed }); }
  function setHover(h) { state.hover = h; }
  // the camera auto-fits both ships; a manual zoom scales a bias on top of that fit
  function setZoom(z) { var Z = BS.Data.balance.zoom; state.zoomBias = U.clamp(state.zoomBias * (U.clamp(z, Z.min, Z.max) / Math.max(0.01, state.zoom)), Z.biasMin, Z.biasMax); }

  function togglePause() {
    if (state.phase !== "battle") return;
    state.paused = !state.paused;
    BS.UI.addLog("computer", state.paused ? "Simulation paused." : "Simulation resumed.", "system");
  }

  function newStyle() { return { t: 0, doctrine: {}, side: {}, aim: {}, aimType: {}, rangeSum: 0, cloakT: 0, alphaT: 0, roll: false }; }
  function ruleKey(ship) { var sc = ship.script; if (!sc) return "none"; if (sc.override) return "call"; return sc.active >= 0 ? String(sc.active) : "none"; }
  // Damage landed on `victim` is booked to the pair of rules standing at that moment (theirs | ours).
  function attribute(victim, amount) {
    if (!state.attrib || !state.enemy || !state.player || !(amount > 0)) return;
    var map = victim === state.player ? state.attrib.taken : state.attrib.dealt, key = ruleKey(state.enemy) + "|" + ruleKey(state.player);
    map[key] = (map[key] || 0) + amount;
  }
  function recordStyle(ship, other, st, dt) {
    st.t += dt;
    var d = ship.doctrineId || "none"; st.doctrine[d] = (st.doctrine[d] || 0) + dt;
    var sd = ship.attackSide || "auto"; st.side[sd] = (st.side[sd] || 0) + dt;
    var a = BS.Script.aimingAt(ship); st.aim[a] = (st.aim[a] || 0) + dt;
    if (a === "type") st.aimType[ship.aimType] = (st.aimType[ship.aimType] || 0) + dt;
    st.rangeSum += BS.Ships.distanceKm(ship, other) * dt;
    if (BS.Ships.isCloaked(ship)) st.cloakT += dt;
    if (!ship.heatGovernor && BS.Modules.weapons(ship).some(function (m) { return m.active; })) st.alphaT += dt;
  }
  // The style of a fight as tags the doctrine table (enemyAI.doctrineTable) and the signature counters read:
  // the dominant doctrine, a shadowed side, an alpha (governor off), a cloak, weak-point or emitter hunting, rolls.
  function styleTags(st, ship) {
    var L = BS.Data.campaign.learn, tags = [], t = Math.max(1e-6, st.t);
    var best = null; Object.keys(st.doctrine).forEach(function (k) { if (!best || st.doctrine[k] > st.doctrine[best]) best = k; });
    var map = { brawl: "brawl", skirmish: "hitfade", standoff: "standoff", siege: "standoff", strafe: "strafe", broadside: "turtle", ambush: "ambush", evade: "kite", kite: "kite", watch: "kite", closein: "alpha" };
    if (best && map[best]) tags.push(map[best]);
    var shadowT = 0; Object.keys(st.side).forEach(function (k) { if (k !== "auto") shadowT += st.side[k]; });
    if (shadowT / t > L.tagFraction) tags.push("shadow");
    if (st.alphaT / t > L.tagFraction) tags.push("alpha");
    if (st.cloakT / t > L.cloakFraction) tags.push("cloak");
    if (((st.aim.weak || 0) + (st.aimType.shield || 0)) / t > L.tagFraction) tags.push("emitter");
    if (st.roll) tags.push("roll");
    var tpl = ship && ship.script ? templateId(ship.script.def) : null;
    if (tpl === "turtle" && tags.indexOf("turtle") < 0) tags.push("turtle");
    if (tpl === "hitfade" && tags.indexOf("hitfade") < 0) tags.push("hitfade");
    if (tpl === "alpha" && tags.indexOf("alpha") < 0) tags.push("alpha");
    var avg = st.rangeSum / t; if (avg > L.longRangeKm) tags.push("long"); else if (avg < L.closeRangeKm) tags.push("close");
    return tags;
  }
  function templateId(def) { var T = BS.Data.script.templates, id = null; Object.keys(T).forEach(function (k) { if (T[k] === def) id = k; }); return id || (def && def.id) || null; }
  // The doctrine table's sentence for a pair of styles: the first row whose winning tag the winner carried and whose
  // losing tag the loser carried.
  function counterSentence(winnerTags, loserTags) {
    var rows = BS.Data.enemyAI.doctrineTable;
    for (var i = 0; i < rows.length; i++) if (winnerTags.indexOf(rows[i].beats) >= 0 && loserTags.indexOf(rows[i].loses) >= 0) return rows[i];
    return null;
  }

  function step(dt) {
    if (state.phase === "battle") { BS.Fleet.update(state); syncRoles(); }
    var p = state.player, e = state.enemy, ships = state.ships, i, s;
    if (state.phase === "battle" && state.style && p && e && !e.flags.destroyed) { recordStyle(p, e, state.style.player, dt); recordStyle(e, p, state.style.enemy, dt); }
    BS.Crew.update(dt);
    // every ship's bridge, helm and hull, enemies first as before (the order only decides who moves first in a step)
    var order = state.teams.enemy.concat(state.teams.player);
    for (i = 0; i < order.length; i++) BS.Script.update(order[i], dt);
    for (i = 0; i < order.length; i++) { s = order[i]; BS.Plays.update(s, dt); BS.EnemyAI.update(s, BS.Fleet.targetOf(s), dt); }
    for (i = 0; i < ships.length; i++) BS.Ships.update(ships[i], dt);
    for (i = 0; i < ships.length; i++) BS.Boarding.update(ships[i], dt);
    BS.Weapons.update(dt);
    BS.Effects.update(dt, state.ships, BS.Weapons.torpedoes);
    if (state.phase === "battle") { state.time += dt; if (p && p.lock.target && p.lock.target.team !== p.team && p.lock.locked) state.lockTime += dt; }   // lock time feeds intel
    if (state.phase === "ending") {
      state.endTimer -= dt;
      if (state.endTimer <= 0) { if (state.dry) { state.phase = "ended"; return; } state.phase = "ended"; state.reward = BS.Campaign.settleBattle(state); BS.UI.showResult(state); }
    }
  }

  function frame(now) {
    var B = BS.Data.balance;
    var dt = Math.min(B.maxFrameTime, (now - lastFrame) / 1000);
    lastFrame = now;
    var simulating = (state.phase === "battle" || state.phase === "ending") && !state.paused;
    if (simulating) {
      accumulator += dt * (state.speed || 1);
      var steps = 0, maxSteps = B.maxStepsPerFrame || 8;
      while (accumulator >= B.simStep && steps < maxSteps) { step(B.simStep); accumulator -= B.simStep; steps++; }
      if (steps === maxSteps) accumulator = 0;
    } else {
      if (state.phase === "ended") BS.Effects.update(dt, state.ships, []);
      accumulator = 0;
    }
    var alpha = simulating ? accumulator / B.simStep : 1;
    if (state.player) {
      BS.Renderer.draw(state, alpha, dt);
      BS.UI.update(state);
    } else {
      BS.Renderer.draw({ player: null, ships: [], zoom: state.zoom }, 1, dt);
    }
    requestAnimationFrame(frame);
  }

  // A fleet's hull state for the report and the campaign: block hp kept per ship and over the side.
  function teamHull(team) {
    var mx = 0, now = 0;
    (state.teams[team] || []).forEach(function (s) { s.grid.blocks.forEach(function (b) { if (!b.structural) { mx += b.maxHp; if (b.alive) now += b.hp; } }); });
    return { max: mx, now: now, frac: mx ? now / mx : 0 };
  }
  function openHangar() { BS.UI.hideOverlays(); state.phase = state.player ? "ended" : "start"; BS.Hangar.show(); }

  var api = { teamHull: teamHull, summon: summon, styleTags: styleTags, counterSentence: counterSentence, templateId: templateId, init: init, startBattle: startBattle, dryRun: dryRun, cancelDryRun: cancelDryRun, openHangar: openHangar, command: command, bridgeCall: bridgeCall, setSpeed: setSpeed, togglePause: togglePause, setHover: setHover, setZoom: setZoom, state: state, step: step };
  return api;
})();
