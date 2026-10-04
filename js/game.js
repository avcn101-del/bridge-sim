// js/game.js — game state, fixed-timestep loop, pause, battle start/end.
window.BS = window.BS || {};

BS.Game = (function () {
  var U = BS.Util;
  var state = { phase: "start", time: 0, paused: false, player: null, enemy: null, ships: [], result: null, endTimer: 0 };
  var accumulator = 0, lastFrame = 0, running = false;
  var subscribed = false;

  function init() {
    BS.Renderer.init(document.getElementById("view"));
    BS.UI.init(api);
    BS.Effects.reset();
    if (!subscribed) { subscribe(); subscribed = true; }
    BS.UI.showStart();
    if (!running) { running = true; lastFrame = performance.now(); requestAnimationFrame(frame); }
  }

  function subscribe() {
    BS.Events.on("shipDestroyed", function (e) {
      if (state.phase !== "battle") return;
      state.result = e.ship.isPlayer ? "defeat" : "victory";
      state.phase = "ending";
      state.endTimer = BS.Data.balance.destroyedEndDelay;
      BS.Events.emit("battleEnded", { result: state.result, state: state });
    });
  }

  function startBattle() {
    var B = BS.Data.balance;
    BS.Weapons.reset();
    BS.Effects.reset();
    BS.Renderer.resetCamera();
    BS.UI.clearLog();
    BS.UI.hideOverlays();
    state.time = 0; state.paused = false; state.result = null; state.endTimer = 0;
    var player = BS.Ships.create("constitution", { isPlayer: true, pos: { x: 0, y: 0 }, heading: -Math.PI / 2 });
    var ang = U.rand(-0.6, 0.6) - Math.PI / 2;
    var profile = BS.Data.enemyAI.default;
    var enemy = BS.Ships.create("bird_of_prey", { pos: { x: Math.cos(ang) * B.arenaStartDistance, y: Math.sin(ang) * B.arenaStartDistance }, heading: ang + Math.PI, statMult: profile.statMult });
    BS.EnemyAI.attach(enemy, "default");
    player.target = enemy.id; enemy.target = player.id;
    state.player = player; state.enemy = enemy; state.ships = [player, enemy];
    BS.Crew.reset(player, enemy);
    BS.UI.setAlert("none");
    BS.UI.setShipName(player.name.toUpperCase());
    state.phase = "battle";
    BS.Events.emit("battleStarted", state);
    BS.UI.addLog("computer", "Simulation running. You have the conn, Captain.", "system");
    BS.Crew.battleStart();
  }

  function giveOrder(id) {
    if (state.phase !== "battle") return;
    BS.Crew.give(id);
  }

  function togglePause() {
    if (state.phase !== "battle") return;
    state.paused = !state.paused;
    BS.UI.addLog("computer", state.paused ? "Simulation paused." : "Simulation resumed.", "system");
  }

  function step(dt) {
    var p = state.player, e = state.enemy;
    BS.Crew.update(dt);
    BS.EnemyAI.update(e, p, dt);
    BS.Ships.update(p, e, dt);
    BS.Ships.update(e, p, dt);
    BS.Weapons.updateShipFiring(p, e, dt);
    BS.Weapons.updateShipFiring(e, p, dt);
    BS.Weapons.update(dt);
    BS.Effects.update(dt, state.ships, BS.Weapons.torpedoes);
    if (state.phase === "battle") state.time += dt;
    if (state.phase === "ending") {
      state.endTimer -= dt;
      if (state.endTimer <= 0) { state.phase = "ended"; BS.UI.showResult(state); }
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
      // keep effects alive on the result screen so the explosion finishes
      if (state.phase === "ended") BS.Effects.update(dt, state.ships, []);
      accumulator = 0;
    }
    var alpha = simulating ? accumulator / B.simStep : 1;
    if (state.player) {
      BS.Renderer.draw(state, alpha, dt);
      BS.UI.update(state);
    } else {
      BS.Renderer.draw({ player: null, ships: [] }, 1, dt);
    }
    requestAnimationFrame(frame);
  }

  var api = { init: init, startBattle: startBattle, giveOrder: giveOrder, togglePause: togglePause, state: state, step: step };
  return api;
})();
