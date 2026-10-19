// js/game.js — game state, fixed-timestep loop, pause, battle start/end, commands.
window.BS = window.BS || {};

BS.Game = (function () {
  var U = BS.Util;
  var state = { phase: "start", time: 0, paused: false, player: null, enemy: null, ships: [], result: null, endTimer: 0, hover: null, zoom: 1, zoomBias: 1, reward: null, encounter: null, speed: 1, calls: 0, callsUsed: 0 };
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
    function endBattle(ship, how) {
      if (state.phase !== "battle") return;
      state.result = ship.isPlayer ? "defeat" : "victory";
      state.resultHow = how;
      state.phase = "ending";
      state.endTimer = BS.Data.balance.destroyedEndDelay;
      BS.Events.emit("battleEnded", { result: state.result, how: how, state: state });
    }
    BS.Events.on("shipDestroyed", function (e) { endBattle(e.ship, "destroyed"); });
    BS.Events.on("shipDisabled", function (e) { endBattle(e.ship, "disabled"); });
    BS.Events.on("shipCaptured", function (e) { endBattle(e.ship, "captured"); });
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
    state.speed = 1; state.calls = BS.Data.script.bridgeCall.tokens; state.callsUsed = 0; state.callLog = [];
    // what the fight looked like (0.26): damage landed per pair of standing rules (their rule | our rule), and each
    // ship's style (time per doctrine, side and aim, average range, cloaked and governor-off time) for the report's
    // "why you lost" and the campaign's signature of a win
    state.attrib = { taken: {}, dealt: {} };
    state.style = { player: newStyle(), enemy: newStyle() };
    state.zoom = BS.Data.balance.zoom.start; state.zoomBias = 1;
    var save = BS.Campaign.get();
    var player = BS.Ships.create(save.shipClass, { isPlayer: true, pos: { x: 0, y: 0 }, heading: -Math.PI / 2, layout: BS.Campaign.battleLayout(save.shipClass), mods: BS.Campaign.skillMods() });
    var ang = U.rand(-0.6, 0.6) - Math.PI / 2;
    var dist = BS.Ships.px(B.arenaStartDistanceKm);
    var enc = BS.Campaign.encounter();
    var enemy = BS.Ships.create(enc.classId, { name: enc.name, layout: enc.rows, element: enc.element || undefined, pos: { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist }, heading: ang + Math.PI, statMult: BS.Campaign.enemyStatMult(enc.aiProfile), mods: { damageMult: enc.damageMult || BS.Data.enemyAI[enc.aiProfile].damageMult } });
    var overrides = {};
    if (enc.weakPointChance !== null && enc.weakPointChance !== undefined) overrides.weakPointChance = enc.weakPointChance;
    BS.EnemyAI.attach(enemy, player, enc.aiProfile, enc.doctrine, Object.keys(overrides).length ? overrides : null);
    state.encounter = enc;
    player.selected = enemy;
    // both bridges fight by a script (BS.Script): the enemy's names its doctrine ("encounter") and plays; the player's
    // is the one assigned to this hull in the hangar, a template by default
    var es = BS.Script.resolve(BS.Data.script.enemyScripts[enc.script] || BS.Data.script.enemyScripts.doctrine);
    BS.Script.start(enemy, player, bindDoctrine(es, enc.doctrine));
    BS.EnemyAI.setStance(player, enemy, BS.Data.helm.defaultStance);   // the helm flies the default stance from the start
    BS.Script.start(player, enemy, opts.script || BS.Campaign.scriptFor(save.shipClass));
    state.player = player; state.enemy = enemy; state.ships = [player, enemy];
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
      var blockMax = p.grid.blocks.reduce(function (a, b) { return a + (b.structural ? 0 : b.maxHp); }, 0), blockNow = p.grid.blocks.reduce(function (a, b) { return a + (b.alive && !b.structural ? b.hp : 0); }, 0);
      var out = { result: state.result || "stalemate", how: state.resultHow, time: state.time, hullPct: Math.round(100 * blockNow / Math.max(1, blockMax)), enemyHullPct: Math.round(100 * e.hull / e.hullMax), trace: (p.scriptTrace || []).slice(), scanned: !!p.scanned, neverFired: BS.Script.explain(p) };
      state.phase = "ended"; state.dry = false; state.paused = false;
      if (onDone) onDone(out);
    }
    setTimeout(chunk, 0);
    return token;
  }
  function cancelDryRun() { dryToken++; if (state.dry) { state.phase = "ended"; state.dry = false; state.paused = false; } }
  function B() { return BS.Data.balance; }

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
  // The wheel's sentence when the winner's element beats the loser's (BS.Data.elements), else null.
  function elementSentence(winEl, loseEl) {
    var E = BS.Data.elements, o = E.order, a = o.indexOf(winEl), b = o.indexOf(loseEl);
    if (a < 0 || b < 0 || (a + 1) % o.length !== b) return null;
    return { beats: winEl, loses: loseEl, text: E.list[winEl].how, measured: E.measured[winEl + ":" + loseEl] || null };
  }
  function counterSentence(winnerTags, loserTags) {
    var rows = BS.Data.enemyAI.doctrineTable;
    for (var i = 0; i < rows.length; i++) if (winnerTags.indexOf(rows[i].beats) >= 0 && loserTags.indexOf(rows[i].loses) >= 0) return rows[i];
    return null;
  }

  function step(dt) {
    var p = state.player, e = state.enemy;
    if (state.phase === "battle" && state.style) { recordStyle(p, e, state.style.player, dt); recordStyle(e, p, state.style.enemy, dt); }
    BS.Crew.update(dt);
    BS.Script.update(e, dt);
    BS.Script.update(p, dt);
    BS.Plays.update(e, dt);
    BS.EnemyAI.update(e, p, dt);
    BS.Plays.update(p, dt);
    BS.EnemyAI.update(p, e, dt);
    BS.Ships.update(p, dt);
    BS.Ships.update(e, dt);
    BS.Boarding.update(p, dt);
    BS.Boarding.update(e, dt);
    BS.Weapons.update(dt);
    BS.Effects.update(dt, state.ships, BS.Weapons.torpedoes);
    if (state.phase === "battle") { state.time += dt; if (p.lock.target === e && p.lock.locked) state.lockTime += dt; }   // lock time feeds intel
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

  function openHangar() { BS.UI.hideOverlays(); state.phase = state.player ? "ended" : "start"; BS.Hangar.show(); }

  var api = { styleTags: styleTags, counterSentence: counterSentence, elementSentence: elementSentence, templateId: templateId, init: init, startBattle: startBattle, dryRun: dryRun, cancelDryRun: cancelDryRun, openHangar: openHangar, command: command, bridgeCall: bridgeCall, setSpeed: setSpeed, togglePause: togglePause, setHover: setHover, setZoom: setZoom, state: state, step: step };
  return api;
})();
