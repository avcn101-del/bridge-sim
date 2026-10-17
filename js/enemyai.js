// js/enemyai.js — enemy behaviour. Each encounter fights by a doctrine
// (enemyAI.doctrines): strafe (hit-and-run passes), brawl (close orbit that
// flips direction), standoff (torpedo range, kites when chased) or broadside
// (slow turning cruiser presenting fresh shields). All doctrines share
// approach, retreat and module management, and drive the same commands and
// modules the player has.
window.BS = window.BS || {};

BS.EnemyAI = (function () {
  var U = BS.Util, S = BS.Ships, M = BS.Modules;

  function attach(ship, player, profileId, doctrineId) {
    var p = BS.Data.enemyAI[profileId || "default"];
    var d = BS.Data.enemyAI.doctrines[doctrineId || p.doctrine || "brawl"];
    ship.aiProfile = p; ship.doctrine = d; ship.doctrineId = doctrineId || p.doctrine || "brawl";
    ship.ai = { state: "approach", timer: 0, decision: 0, canRetreat: true, player: player, passes: 0, lowAngular: 0, flipTimer: 0, rollTimer: 0, announced: {} };
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
    for (var i = 0; i < keys.length; i++) { acc += p.targetWeights[keys[i]]; if (r < acc) return keys[i] === "none" ? null : keys[i]; }
    return null;
  }

  function setState(ship, state) {
    var prev = ship.ai.state;
    if (prev === state) return;
    ship.ai.state = state; ship.ai.timer = 0;
    BS.Events.emit("enemyStateChanged", { ship: ship, state: state, prev: prev, passes: ship.ai.passes });
  }

  function setModule(ship, id, on) { M.find(ship, id).forEach(function (m) { if (m.active !== on) M.setActive(ship, m, on); }); }
  function orbit(ship, player, rangeKm, flip) { S.setCommand(ship, "orbit", { target: player, rangeKm: rangeKm, flipOrbit: !!flip }); }
  function keep(ship, player, rangeKm) { if (ship.cmd.type !== "keep" || Math.abs(S.km(ship.cmd.range) - rangeKm) > 0.01) S.setCommand(ship, "keep", { target: player, rangeKm: rangeKm }); }

  function update(ship, player, dt) {
    if (!ship.ai || ship.flags.destroyed || !player || player.flags.destroyed) return;
    var ai = ship.ai, p = ship.aiProfile, d = ship.doctrine;
    ai.timer += dt; ai.decision -= dt; ai.flipTimer += dt; ai.rollTimer += dt;
    // tail-chase detector: both ships circling the same way at the same pace means almost no angular velocity
    if (S.angularVelocity(ship, player) < d.tailChaseAngular) ai.lowAngular += dt; else ai.lowAngular = 0;
    if (ai.decision > 0) return;
    ai.decision = p.reactionDelay;

    // keep the lock alive
    if (!ship.lock.target && S.distanceKm(ship, player) <= ship.cls.lockRangeKm) S.startLock(ship, player);

    var hullPct = ship.hull / ship.hullMax;
    var facing = S.facingToward(ship, player.pos.x, player.pos.y);
    var facingPct = S.shieldFrac(ship, facing);
    var capPct = ship.capacitor / ship.capMax;
    var dKm = S.distanceKm(ship, player);
    var engaged = ai.state !== "approach" && ai.state !== "retreat";

    // module management shared by all states: weapons stay on whenever there is capacitor for them
    var weaponsOn = capPct > 0.12;
    M.weapons(ship).forEach(function (m) { if (m.active !== weaponsOn) M.setActive(ship, m, weaponsOn); });
    setModule(ship, "shield_booster", facingPct < p.boosterBelow && capPct > p.boosterMinCap);
    setModule(ship, "shield_hardener", capPct > 0.15 && engaged);
    if (ai.timer > 20 && engaged) { ship.aimType = pickTarget(p); ai.timer = 0; }

    // retreat is shared: once per battle, when the hull gets low
    if (engaged && hullPct < p.retreatHull && ai.canRetreat) {
      setState(ship, "retreat"); keep(ship, player, p.retreatRangeKm); ship.repairPriority = "shield"; return;
    }

    switch (ai.state) {
      case "approach":
        setModule(ship, "afterburner", capPct > p.afterburnerMinCap);
        if (ship.cmd.type !== "approach") S.setCommand(ship, "approach", { target: player });
        if (dKm < d.engageKm) enter(ship, player, d);
        break;
      case "retreat":
        setModule(ship, "afterburner", capPct > p.afterburnerMinCap);
        keep(ship, player, p.retreatRangeKm);
        if ((ai.timer > p.retreatMinTime && facingPct > 0.6) || ai.timer > p.retreatMaxTime) { ai.canRetreat = false; ship.repairPriority = null; enter(ship, player, d); }
        break;

      // ---- strafe: run in with the afterburner, fire on the pass, break off, come around on a new bearing
      case "run_in":
        setModule(ship, "afterburner", capPct > d.abMinCap);
        if (ship.cmd.type !== "approach") S.setCommand(ship, "approach", { target: player });
        if (dKm < d.passKm || ai.timer > d.runInMaxTime) { ai.passes++; setState(ship, "pass"); orbit(ship, player, d.passOrbitKm, Math.random() < 0.5); }
        break;
      case "pass":
        setModule(ship, "afterburner", false);   // slow enough on the pass to actually hit
        if (ship.cmd.type !== "orbit") orbit(ship, player, d.passOrbitKm);
        if (ai.timer > d.passTime) { setState(ship, "break_off"); keep(ship, player, d.breakKm); }
        break;
      case "break_off":
        setModule(ship, "afterburner", capPct > d.abMinCap);
        keep(ship, player, d.breakKm);
        if (dKm > d.breakKm * 0.9 || ai.timer > d.breakMaxTime) { setState(ship, "turn_in"); orbit(ship, player, d.breakKm, Math.random() < 0.5); }
        break;
      case "turn_in":
        setModule(ship, "afterburner", false);
        if (ai.timer > d.turnTime) { setState(ship, "run_in"); S.setCommand(ship, "approach", { target: player }); }
        break;

      // ---- brawl: close orbit, flip direction on a timer or when the fight turns into a tail chase
      case "brawl":
        if (facingPct < p.repositionShield && S.strongestFacing(ship) !== facing && S.shieldFrac(ship, S.strongestFacing(ship)) > 0.5) {
          setState(ship, "reposition"); S.setCommand(ship, "comeAbout", { target: player }); break;
        }
        if (ship.cmd.type !== "orbit") orbit(ship, player, d.orbitKm);
        if (ai.flipTimer > d.flipEvery || ai.lowAngular > d.tailChaseTime) { orbit(ship, player, d.orbitKm, true); ai.flipTimer = 0; ai.lowAngular = 0; BS.Events.emit("enemyFlipped", { ship: ship }); }
        setModule(ship, "afterburner", capPct > d.abMinCap);
        break;
      case "reposition":
        setModule(ship, "afterburner", false);
        if (ai.timer > p.repositionDuration || facingPct > 0.5) { enter(ship, player, d, true); }
        break;

      // ---- standoff: sit at torpedo range; kite with the afterburner when the player closes
      case "standoff":
        keep(ship, player, d.holdKm);
        setModule(ship, "afterburner", false);
        if (dKm < d.kiteBelowKm) { setState(ship, "kite"); keep(ship, player, d.kiteToKm); }
        break;
      case "kite":
        setModule(ship, "afterburner", capPct > p.afterburnerMinCap);
        keep(ship, player, d.kiteToKm);
        if (dKm > d.holdKm || ai.timer > d.kiteMaxTime) { setState(ship, "standoff"); keep(ship, player, d.holdKm); }
        break;

      // ---- broadside: hold a range band on a slow course, rolling the strongest shield toward the player
      case "broadside":
        setModule(ship, "afterburner", false);
        if (dKm > d.bandKm[1]) { if (ship.cmd.type !== "approach") S.setCommand(ship, "approach", { target: player }); }
        else if (dKm < d.bandKm[0]) keep(ship, player, d.bandKm[1]);
        else if (ship.cmd.type !== "comeAbout" || ai.rollTimer > d.rollEvery || (facingPct < p.repositionShield && S.strongestFacing(ship) !== facing)) {
          S.setCommand(ship, "comeAbout", { target: player }); ai.rollTimer = 0;
          BS.Events.emit("enemyRolled", { ship: ship, facing: ship.cmd.facing });
        }
        break;
    }
  }

  // Enter the doctrine's fighting state.
  function enter(ship, player, d, flip) {
    switch (d.kind) {
      case "strafe": setState(ship, "run_in"); S.setCommand(ship, "approach", { target: player }); break;
      case "standoff": setState(ship, "standoff"); keep(ship, player, d.holdKm); break;
      case "broadside": setState(ship, "broadside"); S.setCommand(ship, "comeAbout", { target: player }); ship.ai.rollTimer = 0; break;
      default: setState(ship, "brawl"); orbit(ship, player, d.orbitKm, flip); ship.ai.flipTimer = 0; break;
    }
  }

  return { attach: attach, update: update };
})();
