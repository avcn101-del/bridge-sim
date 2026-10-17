// js/enemyai.js — enemy behaviour: approach → attack (orbit) → reposition → retreat.
// Drives the same commands and modules the player has.
window.BS = window.BS || {};

BS.EnemyAI = (function () {
  var U = BS.Util, S = BS.Ships, M = BS.Modules;

  function attach(ship, player, profileId) {
    var p = BS.Data.enemyAI[profileId || "default"];
    ship.aiProfile = p;
    ship.ai = { state: "approach", timer: 0, decision: 0, canRetreat: true, player: player };
    S.setAlert(ship, "red");
    ship.selected = player;
    ship.aimType = pickTarget(p);
    S.setCommand(ship, "approach", { target: player });
    S.startLock(ship, player);
    // weapons always on; they fire once the lock lands and range allows
    M.weapons(ship).forEach(function (m) { M.setActive(ship, m, true); });
  }

  function pickTarget(p) {
    var r = Math.random(), acc = 0;
    var keys = Object.keys(p.targetWeights);
    for (var i = 0; i < keys.length; i++) { acc += p.targetWeights[keys[i]]; if (r < acc) return keys[i]; }
    return keys[0];
  }

  function setState(ship, state) {
    var prev = ship.ai.state;
    if (prev === state) return;
    ship.ai.state = state; ship.ai.timer = 0;
    BS.Events.emit("enemyStateChanged", { ship: ship, state: state, prev: prev });
  }

  function setModule(ship, id, on) { M.find(ship, id).forEach(function (m) { if (m.active !== on) M.setActive(ship, m, on); }); }

  function update(ship, player, dt) {
    if (!ship.ai || ship.flags.destroyed || !player || player.flags.destroyed) return;
    var ai = ship.ai, p = ship.aiProfile;
    ai.timer += dt; ai.decision -= dt;
    if (ai.decision > 0) return;
    ai.decision = p.reactionDelay;

    // keep the lock alive
    if (!ship.lock.target && S.distanceKm(ship, player) <= ship.cls.lockRangeKm) S.startLock(ship, player);

    var hullPct = ship.hull / ship.hullMax;
    var facing = S.facingToward(ship, player.pos.x, player.pos.y);
    var facingPct = S.shieldFrac(ship, facing);
    var capPct = ship.capacitor / ship.capMax;
    var dKm = S.distanceKm(ship, player);

    // module management shared by all states: weapons stay on whenever there is capacitor for them
    var weaponsOn = capPct > 0.12;
    M.weapons(ship).forEach(function (m) { if (m.active !== weaponsOn) M.setActive(ship, m, weaponsOn); });
    setModule(ship, "shield_booster", facingPct < p.boosterBelow && capPct > p.boosterMinCap);
    setModule(ship, "shield_hardener", capPct > 0.15 && (ai.state === "attack" || ai.state === "reposition"));

    switch (ai.state) {
      case "approach":
        setModule(ship, "afterburner", capPct > p.afterburnerMinCap);
        if (ship.cmd.type !== "approach") S.setCommand(ship, "approach", { target: player });
        if (dKm < p.orbitRangeKm * 1.4) { setState(ship, "attack"); S.setCommand(ship, "orbit", { target: player, rangeKm: p.orbitRangeKm }); }
        break;
      case "attack":
        if (hullPct < p.retreatHull && ai.canRetreat) { setState(ship, "retreat"); S.setCommand(ship, "keep", { target: player, rangeKm: p.retreatRangeKm }); ship.repairPriority = "shields"; break; }
        if (facingPct < p.repositionShield && S.strongestFacing(ship) !== facing && S.shieldFrac(ship, S.strongestFacing(ship)) > 0.5) {
          setState(ship, "reposition"); S.setCommand(ship, "comeAbout", { target: player }); break;
        }
        if (ship.cmd.type !== "orbit") S.setCommand(ship, "orbit", { target: player, rangeKm: p.orbitRangeKm });
        // afterburner while the player's beams are landing (angular velocity makes them miss), if cap allows
        setModule(ship, "afterburner", capPct > 0.45);
        if (ai.timer > 20) { ship.aimType = pickTarget(p); ai.timer = 0; }
        break;
      case "reposition":
        setModule(ship, "afterburner", false);
        if (hullPct < p.retreatHull && ai.canRetreat) { setState(ship, "retreat"); S.setCommand(ship, "keep", { target: player, rangeKm: p.retreatRangeKm }); break; }
        if (ai.timer > p.repositionDuration || facingPct > 0.5) { setState(ship, "attack"); S.setCommand(ship, "orbit", { target: player, rangeKm: p.orbitRangeKm, flipOrbit: true }); }
        break;
      case "retreat":
        setModule(ship, "afterburner", capPct > p.afterburnerMinCap);
        if (ship.cmd.type !== "keep") S.setCommand(ship, "keep", { target: player, rangeKm: p.retreatRangeKm });
        var shieldsOk = facingPct > 0.6;
        if ((ai.timer > p.retreatMinTime && shieldsOk) || ai.timer > p.retreatMaxTime) {
          ai.canRetreat = false; setState(ship, "attack"); S.setCommand(ship, "orbit", { target: player, rangeKm: p.orbitRangeKm }); ship.repairPriority = null;
        }
        break;
    }
  }

  return { attach: attach, update: update };
})();
