// js/enemyai.js — the doctrine machine. Every ship, enemy and player, flies by a doctrine
// (enemyAI.doctrines): strafe (hit-and-run passes), brawl (close orbit that flips sides), standoff
// (torpedo range, kites when chased), broadside (slow cruiser presenting fresh shields), ambush
// (cloaked stalk) or evade (open the range). The enemy's encounter names its doctrine; the player's
// helm runs the doctrine of the chosen stance (helm.stances) with ranges taken from the fitted
// weapons. Enemy-only: module management, target choice and the once-per-battle retreat.
window.BS = window.BS || {};

BS.EnemyAI = (function () {
  var U = BS.Util, S = BS.Ships, M = BS.Modules;

  function newAI(target) {
    return { state: "approach", timer: 0, decision: 0, canRetreat: true, player: target, passes: 0, lowAngular: 0, flipTimer: 0, rollTimer: 0, announced: {}, suspended: false, relock: false };
  }

  // ---- enemy ------------------------------------------------------------------
  function attach(ship, player, profileId, doctrineId) {
    var p = BS.Data.enemyAI[profileId || "default"];
    var d = BS.Data.enemyAI.doctrines[doctrineId || p.doctrine || "brawl"];
    ship.aiProfile = p; ship.doctrine = d; ship.doctrineId = doctrineId || p.doctrine || "brawl";
    ship.ai = newAI(player);
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

  // ---- player helm ---------------------------------------------------------------
  // Range reference from the build: the longest alive weapon of that kind (phaser optimal / torpedo range), or null.
  function weaponRef(ship, kind) {
    var best = null;
    ship.stats.weapons.forEach(function (b) {
      if (!b.alive || b.type !== kind) return;
      var w = b.def.weapon, r = kind === "phaser" ? w.optimalKm : w.rangeKm;
      if (best === null || r > best) best = r;
    });
    return best;
  }
  // The stance's doctrine with its range fields replaced by build-derived values (helm.stances[].ranges).
  function doctrineFor(ship, stance) {
    var base = BS.Data.enemyAI.doctrines[stance.doctrine], d = {};
    Object.keys(base).forEach(function (k) { d[k] = base[k]; });
    Object.keys(stance.ranges || {}).forEach(function (k) {
      var spec = stance.ranges[k], v = null;
      for (var i = 0; i + 1 < spec.length; i += 2) { var ref = weaponRef(ship, spec[i]); if (ref !== null) { v = ref * spec[i + 1]; break; } }
      d[k] = v === null ? spec[spec.length - 1] : v;
    });
    return d;
  }
  function setStance(ship, target, stanceId) {
    var st = BS.Data.helm.stances[stanceId];
    if (!st || !target) return false;
    var relock = ship.ai ? ship.ai.relock : false;
    ship.stance = stanceId; ship.doctrine = doctrineFor(ship, st); ship.doctrineId = st.doctrine;
    ship.ai = newAI(target); ship.ai.relock = relock;
    if (S.distanceKm(ship, target) < ship.doctrine.engageKm) enter(ship, target, ship.doctrine);
    else S.setCommand(ship, "approach", { target: target });
    BS.Events.emit("stanceChanged", { ship: ship, stance: stanceId });
    return true;
  }
  // A play may hand the helm a doctrine directly (no stance; ranges as in the doctrine).
  function setDoctrine(ship, target, doctrineId) {
    var d = BS.Data.enemyAI.doctrines[doctrineId];
    if (!d || !target) return false;
    var relock = ship.ai ? ship.ai.relock : false;
    ship.stance = null; ship.doctrine = d; ship.doctrineId = doctrineId;
    ship.ai = newAI(target); ship.ai.relock = relock;
    if (S.distanceKm(ship, target) < d.engageKm) enter(ship, target, d); else S.setCommand(ship, "approach", { target: target });
    BS.Events.emit("stanceChanged", { ship: ship, stance: null, doctrine: doctrineId });
    return true;
  }
  // Manual helm: the doctrine stops driving until a stance is picked again.
  function suspend(ship) { if (ship.ai) ship.ai.suspended = true; }

  // ---- shared machine --------------------------------------------------------------
  function setState(ship, state) {
    var prev = ship.ai.state;
    if (prev === state) return;
    ship.ai.state = state; ship.ai.timer = 0;
    BS.Events.emit("stateChanged", { ship: ship, state: state, prev: prev, passes: ship.ai.passes });
  }

  function setModule(ship, id, on) { M.find(ship, id).forEach(function (m) { if (m.active !== on) M.setActive(ship, m, on); }); }
  function orbit(ship, target, rangeKm, flip) { S.setCommand(ship, "orbit", { target: target, rangeKm: rangeKm, flipOrbit: !!flip }); }
  function keep(ship, target, rangeKm) { if (ship.cmd.type !== "keep" || Math.abs(S.km(ship.cmd.range) - rangeKm) > 0.01) S.setCommand(ship, "keep", { target: target, rangeKm: rangeKm }); }

  // Weapons that could bear on the target from the current geometry (mirror = after the orbit is reversed, the
  // target sits on the other side of the ship).
  function bearingCount(ship, target, mirror) {
    var l = BS.Grid.worldToLocal(ship, target.pos.x, target.pos.y), ang = Math.atan2(mirror ? -l.y : l.y, l.x), n = 0;
    ship.stats.weapons.forEach(function (b) {
      if (!b.alive || b.facing === null) return;
      if (Math.abs(U.normAngle(ang - BS.Grid.weaponFacing(b))) <= (b.def.weapon.arc / 2) * U.DEG) n++;
    });
    return n;
  }
  // Why an orbiting ship should reverse now: "guns" (more weapons bear from the other side) or "shield"
  // (engaged facing weak, opposite facing fresh); null to keep going.
  function flipReason(ship, target, facing, facingPct) {
    var H = BS.Data.helm;
    if (bearingCount(ship, target, true) > bearingCount(ship, target, false)) return "guns";
    var other = facing === "port" ? "starboard" : facing === "starboard" ? "port" : null;
    if (other && facingPct < H.flipShieldLow && S.shieldFrac(ship, other) > H.flipShieldHigh) return "shield";
    return null;
  }

  function update(ship, target, dt) {
    if (!ship.ai || ship.ai.suspended || ship.flags.destroyed || ship.flags.disabled || !target || target.flags.destroyed) return;
    var ai = ship.ai, p = ship.aiProfile, d = ship.doctrine, enemy = !!p, H = BS.Data.helm;
    ai.timer += dt; ai.decision -= dt; ai.flipTimer += dt; ai.rollTimer += dt;
    // tail-chase detector: both ships circling the same way at the same pace means almost no angular velocity
    if (S.angularVelocity(ship, target) < d.tailChaseAngular) ai.lowAngular += dt; else ai.lowAngular = 0;
    if (ai.decision > 0) return;
    ai.decision = enemy ? p.reactionDelay : H.reactionDelay;

    // keep the lock alive (the player's tactical officer only re-locks a target the captain locked before)
    if (!ship.lock.target && (enemy || ai.relock) && ship.jammed <= 0 && !S.isCloaked(target) && S.distanceKm(ship, target) <= ship.cls.lockRangeKm) S.startLock(ship, target);

    var hullPct = ship.hull / ship.hullMax;
    var facing = S.facingToward(ship, target.pos.x, target.pos.y);
    var facingPct = S.shieldFrac(ship, facing);
    var capPct = ship.capacitor / ship.capMax;
    var dKm = S.distanceKm(ship, target);
    var engaged = ai.state !== "approach" && ai.state !== "retreat" && ai.state !== "stalk";

    if (enemy) {
      // module management shared by all states: weapons stay on whenever there is capacitor for them
      var weaponsOn = capPct > 0.12;
      M.weapons(ship).forEach(function (m) { if (m.active !== weaponsOn) M.setActive(ship, m, weaponsOn); });
      setModule(ship, "shield_booster", facingPct < p.boosterBelow && capPct > p.boosterMinCap);
      setModule(ship, "shield_hardener", capPct > 0.15 && engaged && ship.cloak.state === "off");
      setModule(ship, "jammer", engaged && capPct > 0.3 && ship.cloak.state === "off");
      if (ai.timer > 20 && engaged) { ship.aimType = pickTarget(p); ai.timer = 0; }
      // retreat is shared by all doctrines: once per battle, when the hull gets low
      if (engaged && hullPct < p.retreatHull && ai.canRetreat) {
        setState(ship, "retreat"); keep(ship, target, p.retreatRangeKm); ship.repairPriority = "shield"; return;
      }
    }

    // auto-flip while orbiting: bring the other battery round, or show a fresh shield
    if ((ai.state === "brawl" || ai.state === "pass") && ship.cmd.type === "orbit" && ai.flipTimer > H.flipMinInterval) {
      var why = flipReason(ship, target, facing, facingPct);
      if (why) { orbit(ship, target, S.km(ship.cmd.range), true); ai.flipTimer = 0; ai.lowAngular = 0; BS.Events.emit("orbitFlipped", { ship: ship, reason: why }); }
    }

    switch (ai.state) {
      case "approach":
        setModule(ship, "afterburner", capPct > (enemy ? p.afterburnerMinCap : 0.5));
        if (ship.cmd.type !== "approach") S.setCommand(ship, "approach", { target: target });
        if (dKm < d.engageKm) enter(ship, target, d);
        break;
      case "retreat":
        setModule(ship, "afterburner", capPct > p.afterburnerMinCap);
        keep(ship, target, p.retreatRangeKm);
        if ((ai.timer > p.retreatMinTime && facingPct > 0.6) || ai.timer > p.retreatMaxTime) { ai.canRetreat = false; ship.repairPriority = null; enter(ship, target, d); }
        break;

      // ---- strafe: run in with the afterburner, fire on the pass, break off, come around on a new bearing
      case "run_in":
        setModule(ship, "afterburner", capPct > d.abMinCap);
        if (ship.cmd.type !== "approach") S.setCommand(ship, "approach", { target: target });
        if (dKm < d.passKm || ai.timer > d.runInMaxTime) { ai.passes++; setState(ship, "pass"); orbit(ship, target, d.passOrbitKm, Math.random() < 0.5); }
        break;
      case "pass":
        setModule(ship, "afterburner", false);   // slow enough on the pass to actually hit
        if (ship.cmd.type !== "orbit") orbit(ship, target, d.passOrbitKm);
        if (ai.timer > d.passTime) { setState(ship, "break_off"); keep(ship, target, d.breakKm); }
        break;
      case "break_off":
        setModule(ship, "afterburner", capPct > d.abMinCap);
        keep(ship, target, d.breakKm);
        if (d.kind === "ambush") { if (dKm > d.recloakKm || ai.timer > d.breakMaxTime) { setState(ship, "stalk"); S.setCommand(ship, "approach", { target: target }); } break; }
        if (dKm > d.breakKm * 0.9 || ai.timer > d.breakMaxTime) { setState(ship, "turn_in"); orbit(ship, target, d.breakKm, Math.random() < 0.5); }
        break;
      case "turn_in":
        setModule(ship, "afterburner", false);
        if (ai.timer > d.turnTime) { setState(ship, "run_in"); S.setCommand(ship, "approach", { target: target }); }
        break;

      // ---- ambush: stalk cloaked, decloak at knife range, firing pass, break off and cloak again
      case "stalk":
        setModule(ship, "afterburner", false);
        if (ship.cloak.state === "off" && capPct > 0.5) setModule(ship, "cloak", true);
        if (ship.cmd.type !== "approach") S.setCommand(ship, "approach", { target: target });
        if (dKm < d.decloakKm || (ship.cloak.state === "off" && capPct < 0.5)) { setState(ship, "uncloak"); setModule(ship, "cloak", false); }
        break;
      case "uncloak":
        setModule(ship, "cloak", false);
        if (ship.cloak.state === "off") { ai.passes++; setState(ship, "pass"); orbit(ship, target, d.passOrbitKm, Math.random() < 0.5); }
        break;

      // ---- brawl: close orbit; flips on a timer, on a tail chase, or by flipReason above
      case "brawl":
        if (enemy && facingPct < p.repositionShield && S.strongestFacing(ship) !== facing && S.shieldFrac(ship, S.strongestFacing(ship)) > 0.5) {
          setState(ship, "reposition"); S.setCommand(ship, "comeAbout", { target: target }); break;
        }
        if (ship.cmd.type !== "orbit") orbit(ship, target, d.orbitKm);
        if ((enemy && ai.flipTimer > d.flipEvery) || ai.lowAngular > d.tailChaseTime) { orbit(ship, target, d.orbitKm, true); ai.flipTimer = 0; ai.lowAngular = 0; BS.Events.emit("orbitFlipped", { ship: ship, reason: ai.lowAngular > d.tailChaseTime ? "tailchase" : "timer" }); }
        setModule(ship, "afterburner", capPct > d.abMinCap);
        break;
      case "reposition":
        setModule(ship, "afterburner", false);
        if (ai.timer > p.repositionDuration || facingPct > 0.5) { enter(ship, target, d, true); }
        break;

      // ---- standoff: sit at torpedo range; kite with the afterburner when the target closes
      case "standoff":
        keep(ship, target, d.holdKm);
        setModule(ship, "afterburner", false);
        if (dKm < d.kiteBelowKm) { setState(ship, "kite"); keep(ship, target, d.kiteToKm); }
        break;
      case "kite":
        setModule(ship, "afterburner", capPct > (enemy ? p.afterburnerMinCap : 0.3));
        keep(ship, target, d.kiteToKm);
        if (dKm > d.holdKm || ai.timer > d.kiteMaxTime) { setState(ship, "standoff"); keep(ship, target, d.holdKm); }
        break;

      // ---- broadside: hold a range band on a slow course, rolling the strongest shield toward the target
      case "broadside":
        setModule(ship, "afterburner", false);
        // too far: close in; otherwise hold the broadside (a cruiser that runs shows its tail and fires nothing)
        if (dKm > d.bandKm[1]) { if (ship.cmd.type !== "approach") S.setCommand(ship, "approach", { target: target }); }
        else if (ship.cmd.type !== "comeAbout" || ai.rollTimer > d.rollEvery || (facingPct < (enemy ? p.repositionShield : H.flipShieldLow) && S.strongestFacing(ship) !== facing)) {
          S.setCommand(ship, "comeAbout", { target: target }); ai.rollTimer = 0;
          BS.Events.emit("enemyRolled", { ship: ship, facing: ship.cmd.facing });
        }
        break;

      // ---- evade: open the range on the afterburner and stay there
      case "evade":
        setModule(ship, "afterburner", capPct > d.abMinCap);
        keep(ship, target, d.holdKm);
        break;
    }
  }

  // Enter the doctrine's fighting state.
  function enter(ship, target, d, flip) {
    switch (d.kind) {
      case "strafe": setState(ship, "run_in"); S.setCommand(ship, "approach", { target: target }); break;
      case "ambush": setState(ship, "stalk"); S.setCommand(ship, "approach", { target: target }); break;
      case "standoff": setState(ship, "standoff"); keep(ship, target, d.holdKm); break;
      case "broadside": setState(ship, "broadside"); S.setCommand(ship, "comeAbout", { target: target }); ship.ai.rollTimer = 0; break;
      case "evade": setState(ship, "evade"); keep(ship, target, d.holdKm); break;
      case "approach": setState(ship, "approach"); S.setCommand(ship, "approach", { target: target }); break;
      default: setState(ship, "brawl"); orbit(ship, target, d.orbitKm, flip); ship.ai.flipTimer = 0; break;
    }
  }

  return { attach: attach, update: update, setStance: setStance, setDoctrine: setDoctrine, suspend: suspend, doctrineFor: doctrineFor, bearingCount: bearingCount };
})();
