// js/enemyai.js — enemy behaviour: approach → attack → reposition → retreat.
window.BS = window.BS || {};

BS.EnemyAI = (function () {
  var U = BS.Util, S = BS.Ships;

  function attach(ship, profileId) {
    var p = BS.Data.enemyAI[profileId || "default"];
    ship.aiProfile = p;
    ship.ai = { state: "approach", timer: 0, decision: 0, canRetreat: true };
    ship.flags.fireAtWill = true;
    S.setAlert(ship, "red");
    ship.targetSubsystem = pickTarget(p);
    S.setHelmMode(ship, "attack");
    ship.helm.phase = "run";
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

  function update(ship, player, dt) {
    if (!ship.ai || ship.flags.destroyed || !player || player.flags.destroyed) return;
    var ai = ship.ai, p = ship.aiProfile;
    ai.timer += dt; ai.decision -= dt;
    if (ai.decision > 0) return;
    ai.decision = p.reactionDelay * S.bridgeDelayMult(ship);

    var hullPct = ship.hull / ship.hullMax;
    var facing = S.facingToward(ship, player.pos.x, player.pos.y);
    var facingPct = ship.shields[facing] / ship.shieldMax;
    var d = S.distanceTo(ship, player);

    switch (ai.state) {
      case "approach":
        if (ship.helm.mode !== "attack") S.setHelmMode(ship, "attack");
        if (d < p.preferredRange * 1.3) setState(ship, "attack");
        break;
      case "attack":
        if (hullPct < p.retreatHull && ai.canRetreat) { setState(ship, "retreat"); S.setHelmMode(ship, "open"); S.setPowerPreset(ship, "shields"); ship.repairPriority = "shields"; break; }
        if (facingPct < p.repositionShield && S.strongestFacing(ship) !== facing && ship.shields[S.strongestFacing(ship)] > ship.shieldMax * 0.5) {
          setState(ship, "reposition"); S.setHelmMode(ship, "comeAbout"); break;
        }
        if (ship.helm.mode !== "attack") S.setHelmMode(ship, "attack");
        if (ship.powerPreset !== "weapons" && facingPct > 0.5) S.setPowerPreset(ship, "weapons");
        else if (ship.powerPreset !== "balanced" && facingPct <= 0.5) S.setPowerPreset(ship, "balanced");
        if (ai.timer > 20) { ship.targetSubsystem = pickTarget(p); ai.timer = 0; }
        break;
      case "reposition":
        if (hullPct < p.retreatHull && ai.canRetreat) { setState(ship, "retreat"); S.setHelmMode(ship, "open"); S.setPowerPreset(ship, "shields"); break; }
        if (ai.timer > p.repositionDuration || facingPct > 0.5) { setState(ship, "attack"); S.setHelmMode(ship, "attack"); }
        break;
      case "retreat":
        if (ship.helm.mode !== "open") S.setHelmMode(ship, "open");
        var shieldsOk = facingPct > 0.6;
        // Hull does not regenerate: the Klingon regroups behind fresh shields, then comes back to die with honour.
        if ((ai.timer > p.retreatMinTime && shieldsOk) || ai.timer > p.retreatMaxTime) { ai.canRetreat = false; setState(ship, "attack"); S.setHelmMode(ship, "attack"); S.setPowerPreset(ship, "weapons"); ship.repairPriority = null; }
        break;
    }
  }

  return { attach: attach, update: update };
})();
