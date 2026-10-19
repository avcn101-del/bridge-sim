// js/enemyai.js — the doctrine machine. Every ship, enemy and player, flies by a doctrine
// (enemyAI.doctrines): strafe (hit-and-run passes), brawl (close orbit that flips sides), standoff
// (torpedo range, kites when chased), broadside (slow cruiser presenting fresh shields), ambush
// (cloaked stalk) or evade (open the range). The enemy's encounter names its doctrine; a script sets
// one with the `doctrine` action. A doctrine with `ranges` takes its range fields from the ship's
// fitted weapons (the player's labelled set). Enemy-only: module management, target choice and the
// once-per-battle retreat.
window.BS = window.BS || {};

BS.EnemyAI = (function () {
  var U = BS.Util, S = BS.Ships, M = BS.Modules;

  function newAI(target) {
    return { state: "approach", timer: 0, decision: 0, canRetreat: true, player: target, passes: 0, lowAngular: 0, flipTimer: 0, rollTimer: 0, blindTimer: 0, announced: {}, suspended: false, relock: false };
  }

  // ---- enemy ------------------------------------------------------------------
  function attach(ship, player, profileId, doctrineId, overrides) {
    var p = BS.Data.enemyAI[profileId || "default"];
    if (overrides) p = Object.assign({}, p, overrides);   // per-encounter tweaks (a counter-doctrine's weakPointChance)
    var d = BS.Data.enemyAI.doctrines[doctrineId || p.doctrine || "brawl"];
    ship.aiProfile = p; ship.doctrine = d; ship.doctrineId = doctrineId || p.doctrine || "brawl";
    ship.ai = newAI(player);
    S.setAlert(ship, "red");
    ship.selected = player;
    ship.aimType = pickTarget(p, ship, player);
    S.setCommand(ship, "approach", { target: player });
    S.startLock(ship, player);
    // weapons always on; they fire once the lock lands and range allows
    M.weapons(ship).forEach(function (m) { M.setActive(ship, m, true); });
  }

  // What the enemy aims at next: with weakPointChance, its target's top weak point (a specific block); otherwise a block
  // type or the bare hull by targetWeights.
  function pickTarget(p, ship, target) {
    if (ship && target && p.weakPointChance && ship.scanned && Math.random() < p.weakPointChance) {   // weak points are read off a scan (script action), same rule as the player
      var wps = BS.Grid.weakPoints(target, ship).filter(function (w) { return !p.weakPointKinds || p.weakPointKinds.indexOf(w.kind) >= 0; });
      if (wps.length) { S.setAimBlock(ship, target, wps[0].block); BS.Events.emit("enemyFocus", { ship: ship, target: target, point: wps[0] }); return "block"; }
    }
    if (ship) S.setAimBlock(ship, null, null);
    var r = Math.random(), acc = 0;
    var keys = Object.keys(p.targetWeights);
    for (var i = 0; i < keys.length; i++) { acc += p.targetWeights[keys[i]]; if (r < acc) return keys[i] === "none" ? null : keys[i]; }
    return null;
  }

  // A new stance or doctrine keeps what outlives it: the re-lock order, the once-per-battle retreat and the pass count.
  function carryAI(ship, ai) {
    if (ship.ai) { ai.relock = ship.ai.relock; ai.canRetreat = ship.ai.canRetreat; ai.passes = ship.ai.passes; }
    return ai;
  }

  // ---- player helm ---------------------------------------------------------------
  // Range reference from the build: the longest alive weapon of that kind ("phaser" = any turret's optimal range,
  // "torpedo" = any launcher's range), or null.
  function weaponRef(ship, kind) {
    var best = null, wk = kind === "phaser" ? "turret" : "launcher";
    ship.stats.weapons.forEach(function (b) {
      if (!b.alive || b.def.weapon.kind !== wk) return;
      var w = b.def.weapon, r = wk === "turret" ? w.optimalKm : w.rangeKm;
      if (best === null || r > best) best = r;
    });
    return best;
  }
  // The doctrine with its range fields replaced by build-derived values (doctrines[].ranges), when it has any.
  function doctrineFor(ship, base) {
    if (!base.ranges) return base;
    var d = {};
    Object.keys(base).forEach(function (k) { if (k !== "ranges") d[k] = base[k]; });
    Object.keys(base.ranges).forEach(function (k) {
      var spec = base.ranges[k], v = null;
      for (var i = 0; i + 1 < spec.length; i += 2) { var ref = weaponRef(ship, spec[i]); if (ref !== null) { v = ref * spec[i + 1]; break; } }
      d[k] = v === null ? spec[spec.length - 1] : v;
    });
    return d;
  }
  function setDoctrine(ship, target, doctrineId) {
    var base = BS.Data.enemyAI.doctrines[doctrineId];
    if (!base || !target) return false;
    var d = doctrineFor(ship, base);
    ship.doctrine = d; ship.doctrineId = doctrineId; ship.escorting = null;
    ship.ai = carryAI(ship, newAI(target));
    if (S.distanceKm(ship, target) < d.engageKm) enter(ship, target, d); else S.setCommand(ship, "approach", { target: target });
    BS.Events.emit("stanceChanged", { ship: ship, doctrine: doctrineId });
    return true;
  }
  // Escort (0.34, script action `escort`): the helm keeps station support.escortKm from an ally instead of flying a
  // doctrine, until a stance or doctrine is set again. The weapons still fire at the lock.
  function escort(ship, ally) {
    if (!ally || ally === ship || ally.flags.destroyed) return false;
    if (!ship.ai) ship.ai = newAI(ally);
    ship.ai.suspended = true; ship.escorting = ally;
    S.setCommand(ship, "keep", { target: ally, rangeKm: BS.Data.support.escortKm });
    BS.Events.emit("escortChanged", { ship: ship, ally: ally });
    return true;
  }

  // ---- shared machine --------------------------------------------------------------
  function setState(ship, state) {
    var prev = ship.ai.state;
    if (prev === state) return;
    ship.ai.state = state; ship.ai.timer = 0;
    BS.Events.emit("stateChanged", { ship: ship, state: state, prev: prev, passes: ship.ai.passes });
  }

  function setModule(ship, id, on) { M.find(ship, id).forEach(function (m) { if (m.active !== on) M.setActive(ship, m, on); }); }
  function orbit(ship, target, rangeKm, flip) { S.setCommand(ship, "orbit", { target: target, rangeKm: rangeKm, flipOrbit: !!flip }); }
  // Attack side: the bearing (radians from the target's heading) the helm shadows for ship.attackSide, or null for auto.
  // "blind" is the sector where the least of the target's fire bears (its bearingProfile), kept until another sector has
  // under helm.shadow.blindHysteresis of its fire so the ship does not dither between two equal sectors.
  function sideBearing(ship, target) {
    var H = BS.Data.helm, side = H.sides[ship.attackSide];
    if (!side || ship.attackSide === "auto") return null;
    if (side.bearing !== undefined) return side.bearing * U.DEG;
    var prof = BS.Grid.bearingProfile(target, null, H.bearingStep), best = null;
    prof.forEach(function (p) { if (!best || p.w < best.w || (p.w === best.w && Math.abs(p.deg) > Math.abs(best.deg))) best = p; });
    var cur = ship.ai.blindBearing;
    if (cur !== undefined && cur !== null) {
      var curW = prof.filter(function (p) { return Math.abs(p.deg - cur) < 0.5; })[0];
      if (curW && best.w >= curW.w * H.shadow.blindHysteresis) return cur * U.DEG;
    }
    ship.ai.blindBearing = best.deg;
    return best.deg * U.DEG;
  }
  function shadowOrOrbit(ship, target, rangeKm, flip) {
    var b = sideBearing(ship, target);
    if (b === null) { orbit(ship, target, rangeKm, flip); return false; }
    if (ship.cmd.type !== "shadow" || Math.abs(U.normAngle(ship.cmd.bearing - b)) > 0.01 || Math.abs(S.km(ship.cmd.range) - rangeKm) > 0.01) S.setCommand(ship, "shadow", { target: target, rangeKm: rangeKm, bearing: b });
    return true;
  }
  function setAttackSide(ship, target, side) {
    if (!BS.Data.helm.sides[side]) return false;
    ship.attackSide = side; if (ship.ai) { ship.ai.blindBearing = null; ship.ai.decision = 0; }
    if (ship.ai && ship.ai.state === "brawl" && target) { if (side === "auto") orbit(ship, target, ship.doctrine.orbitKm); else shadowOrOrbit(ship, target, ship.doctrine.orbitKm); }
    BS.Events.emit("sideChanged", { ship: ship, side: side });
    return true;
  }
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
    var ct = S.contact(ship, target), live = !ct.ghost;   // a cloaked target beyond our sensors: the last contact, not its true position
    var facing = S.facingToward(ship, ct.pos.x, ct.pos.y);
    var facingPct = S.shieldFrac(ship, facing);
    var capPct = ship.capacitor / ship.capMax;
    var dKm = S.km(BS.Util.dist(ship.pos.x, ship.pos.y, ct.pos.x, ct.pos.y));
    var engaged = ai.state !== "approach" && ai.state !== "retreat" && ai.state !== "stalk";

    // the target's core is going critical: everybody with a working helm clears the blast radius
    if (target.breach > 0 && ai.state !== "clear") { setState(ship, "clear"); keep(ship, target, BS.Data.grid.breach.radiusKm * 1.6); setModule(ship, "afterburner", true); return; }
    if (ai.state === "clear") { if (target.breach <= 0) enter(ship, target, d); return; }
    if (enemy) {
      // module management shared by all states: weapons stay on whenever there is capacitor for them
      {
        var weaponsOn = capPct > 0.12;
        M.weapons(ship).forEach(function (m) { if (m.active !== weaponsOn) M.setActive(ship, m, weaponsOn); });
        setModule(ship, "shield_booster", facingPct < p.boosterBelow && capPct > p.boosterMinCap);
        setModule(ship, "shield_hardener", capPct > 0.15 && engaged && ship.cloak.state === "off");
      }
      setModule(ship, "jammer", engaged && capPct > 0.3 && ship.cloak.state === "off");
      // second-generation EW: the neutraliser runs whenever the target is inside its reach and there is capacitor to
      // spare; a decoy goes out when torpedoes hunting this ship are close (BS.Weapons.incoming)
      var EW = BS.Data.ew;
      setModule(ship, "neut", engaged && capPct > EW.neut.aiMinCap && dKm <= EW.neut.rangeKm && ship.cloak.state === "off" && ship.lock.locked);
      setModule(ship, "decoy", ship.cloak.state === "off" && BS.Weapons.incoming(ship, EW.decoy.aiIncomingKm) > 0);
      if (ai.timer > 20 && engaged && !ship.scriptAim) { ship.aimType = pickTarget(p, ship, target); ai.timer = 0; }   // a script that set the aim keeps it
      // retreat is shared by all doctrines: once per battle, when the hull gets low
      if (engaged && hullPct < p.retreatHull && ai.canRetreat) {
        setState(ship, "retreat"); keep(ship, target, p.retreatRangeKm); ship.repairPriority = "shield"; return;
      }
    }

    // drained: a neutraliser has emptied the capacitor, so open the range past it until the capacitor is back
    if (enemy && engaged && ai.state !== "drained" && ship.neuted > 0 && capPct < p.drainedBelow) {
      setState(ship, "drained"); keep(ship, target, BS.Data.ew.neut.fleeKm); return;
    }
    if (ai.state === "drained") {
      keep(ship, target, BS.Data.ew.neut.fleeKm);
      if (capPct > p.drainedUntil || ai.timer > p.drainedTime) enter(ship, target, d);
      return;
    }
    // shadowed: how long nothing has borne on the target (it sits in a blind sector). Since 0.25 the answer is a
    // script rule (condition blindFor → action roll), no longer a profile threshold here.
    // Counted only in the states that mean to fire (brawl, pass, broadside, standoff): a ship breaking off or kiting
    // shows its tail on purpose.
    var firing = ai.state === "brawl" || ai.state === "pass" || ai.state === "broadside" || ai.state === "standoff";
    if (firing && live) { if (bearingCount(ship, target, false) === 0) ai.blindTimer += (enemy ? p.reactionDelay : H.reactionDelay); else ai.blindTimer = 0; } else ai.blindTimer = 0;
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
        if (ship.attackSide !== "auto" && shadowOrOrbit(ship, target, d.orbitKm)) { setModule(ship, "afterburner", capPct > d.abMinCap); break; }   // shadowing a side: no orbit flips
        if (ship.cmd.type !== "orbit") orbit(ship, target, d.orbitKm);
        if ((enemy && ai.flipTimer > d.flipEvery) || ai.lowAngular > d.tailChaseTime) { orbit(ship, target, d.orbitKm, true); ai.flipTimer = 0; ai.lowAngular = 0; BS.Events.emit("orbitFlipped", { ship: ship, reason: ai.lowAngular > d.tailChaseTime ? "tailchase" : "timer" }); }
        setModule(ship, "afterburner", capPct > d.abMinCap);
        break;
      case "reposition":
        setModule(ship, "afterburner", false);
        if (ai.timer > (enemy ? p.repositionDuration : H.repositionDuration) || (ship.cmd.type === "comeAbout" && bearingCount(ship, target, false) > 0 && ai.timer > 1.5) || (facingPct > 0.5 && bearingCount(ship, target, false) > 0)) { enter(ship, target, d, true); }
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

  // Come about with the side that carries the most fire toward the target (script action `roll`): a reposition that
  // the doctrine resumes from after repositionDuration, or sooner once guns bear again. A slow hull takes a while,
  // which is the small ship's window. Both ships may do it.
  function roll(ship, target) {
    if (!ship.ai || !target || ship.flags.destroyed || ship.flags.disabled) return false;
    var prof = BS.Grid.bearingProfile(ship, null, 90), bestSec = null;
    prof.forEach(function (q) { if (!bestSec || q.w > bestSec.w) bestSec = q; });
    var fc = bestSec && bestSec.deg === 90 ? "starboard" : bestSec && bestSec.deg === -90 ? "port" : bestSec && bestSec.deg === -180 ? "aft" : "fore";
    ship.ai.blindTimer = 0; setState(ship, "reposition"); S.setCommand(ship, "comeAbout", { target: target, facing: fc });
    BS.Events.emit("enemyRolled", { ship: ship, facing: fc, blind: true });
    return true;
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

  return { attach: attach, update: update, setDoctrine: setDoctrine, escort: escort, doctrineFor: doctrineFor, bearingCount: bearingCount, setAttackSide: setAttackSide, sideBearing: sideBearing, roll: roll, weaponRef: weaponRef };
})();
