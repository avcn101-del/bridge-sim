// js/game.js — game state, fixed-timestep loop, pause, battle start/end, commands.
window.BS = window.BS || {};

BS.Game = (function () {
  var U = BS.Util;
  var state = { phase: "start", time: 0, paused: false, player: null, enemy: null, ships: [], result: null, endTimer: 0, hover: null, zoom: 1, reward: null, encounter: null };
  var accumulator = 0, lastFrame = 0, running = false;
  var subscribed = false;

  function init() {
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
  }

  function startBattle() {
    var B = BS.Data.balance;
    BS.Weapons.reset();
    BS.Effects.reset();
    BS.Renderer.resetCamera();
    BS.UI.clearLog();
    BS.UI.hideOverlays();
    state.time = 0; state.paused = false; state.result = null; state.resultHow = null; state.endTimer = 0; state.hover = null; state.reward = null;
    state.zoom = BS.Data.balance.zoom.start;
    var save = BS.Campaign.get();
    var player = BS.Ships.create(save.shipClass, { isPlayer: true, pos: { x: 0, y: 0 }, heading: -Math.PI / 2, layout: BS.Campaign.battleLayout(save.shipClass), mods: BS.Campaign.skillMods() });
    var ang = U.rand(-0.6, 0.6) - Math.PI / 2;
    var dist = BS.Ships.px(B.arenaStartDistanceKm);
    var enc = BS.Campaign.encounter();
    var enemy = BS.Ships.create(enc.classId, { name: enc.name, layout: enc.rows, pos: { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist }, heading: ang + Math.PI, statMult: BS.Campaign.enemyStatMult(enc.aiProfile), mods: { damageMult: BS.Data.enemyAI[enc.aiProfile].damageMult } });
    BS.EnemyAI.attach(enemy, player, enc.aiProfile, enc.doctrine);
    state.encounter = enc;
    player.selected = enemy;
    BS.EnemyAI.setStance(player, enemy, BS.Data.helm.defaultStance);   // the helm flies the default stance from the start
    state.player = player; state.enemy = enemy; state.ships = [player, enemy];
    BS.Crew.reset(player, enemy);
    BS.UI.setAlert("none");
    BS.UI.setShipName(player.name.toUpperCase());
    BS.UI.buildModuleBar(player);
    state.phase = "battle";
    BS.Events.emit("battleStarted", state);
    BS.UI.addLog("computer", "Simulation running. You have the conn, Captain.", "system");
    BS.Crew.battleStart();
  }

  function command(id, args) {
    if (state.phase !== "battle") return;
    BS.Crew.command(id, args);
  }
  function setHover(h) { state.hover = h; }
  function setZoom(z) { var Z = BS.Data.balance.zoom; state.zoom = U.clamp(z, Z.min, Z.max); }

  function togglePause() {
    if (state.phase !== "battle") return;
    state.paused = !state.paused;
    BS.UI.addLog("computer", state.paused ? "Simulation paused." : "Simulation resumed.", "system");
  }

  function step(dt) {
    var p = state.player, e = state.enemy;
    BS.Crew.update(dt);
    BS.EnemyAI.update(e, p, dt);
    BS.EnemyAI.update(p, e, dt);
    BS.Ships.update(p, dt);
    BS.Ships.update(e, dt);
    BS.Weapons.update(dt);
    BS.Effects.update(dt, state.ships, BS.Weapons.torpedoes);
    if (state.phase === "battle") state.time += dt;
    if (state.phase === "ending") {
      state.endTimer -= dt;
      if (state.endTimer <= 0) { state.phase = "ended"; state.reward = BS.Campaign.settleBattle(state); BS.UI.showResult(state); }
    }
  }

  function frame(now) {
    var B = BS.Data.balance;
    var dt = Math.min(B.maxFrameTime, (now - lastFrame) / 1000);
    lastFrame = now;
    var simulating = (state.phase === "battle" || state.phase === "ending") && !state.paused;
    if (simulating) {
      accumulator += dt;
      var steps = 0;
      while (accumulator >= B.simStep && steps < 8) { step(B.simStep); accumulator -= B.simStep; steps++; }
      if (steps === 8) accumulator = 0;
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

  var api = { init: init, startBattle: startBattle, openHangar: openHangar, command: command, togglePause: togglePause, setHover: setHover, setZoom: setZoom, state: state, step: step };
  return api;
})();
