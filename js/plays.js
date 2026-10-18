// js/plays.js — plays: scripted sequences of phases for the player's bridge (helm.plays). A phase sets a
// stance or doctrine for the helm, a module policy, the heat governor, the aim and repair priority, and
// names the conditions that move the play to its next phase. Pure data in, commands out: it only calls
// BS.EnemyAI.setStance / setDoctrine, BS.Modules.setActive and BS.Ships.startReinforce.
window.BS = window.BS || {};

BS.Plays = (function () {
  var S = BS.Ships, M = BS.Modules;

  function defs() { return BS.Data.helm.plays; }
  function available(ship, playId) { var P = defs()[playId]; return !!P && (!P.requires || M.find(ship, P.requires).length > 0); }

  // Start a play against `target`. Returns true, false (unknown play / no target) or "requires" (missing module).
  function start(ship, target, playId) {
    var P = defs()[playId];
    if (!P || !target) return false;
    if (P.requires && !M.find(ship, P.requires).length) return "requires";
    ship.play = { id: playId, def: P, phase: -1, t: 0, target: target };
    enterPhase(ship, 0);
    BS.Events.emit("playChanged", { ship: ship, play: playId });
    return true;
  }
  function stop(ship) {
    if (!ship.play) return;
    ship.play = null;
    BS.Events.emit("playChanged", { ship: ship, play: null });
  }

  function setModules(ship, policy) {
    Object.keys(policy).forEach(function (id) {
      var on = policy[id], list = id === "weapons" ? M.weapons(ship) : M.find(ship, id);
      list.forEach(function (m) { if (m.active !== on) M.setActive(ship, m, on); });
    });
  }
  function enterPhase(ship, i) {
    var pl = ship.play, ph = pl.def.phases[i];
    pl.phase = i; pl.t = 0;
    if (ph.stance) BS.EnemyAI.setStance(ship, pl.target, ph.stance);
    else if (ph.doctrine) BS.EnemyAI.setDoctrine(ship, pl.target, ph.doctrine);
    if (ph.modules) setModules(ship, ph.modules);
    if (ph.governor !== undefined) ship.heatGovernor = ph.governor;
    if (ph.aim !== undefined) ship.aimType = ph.aim;
    if (ph.repair !== undefined) ship.repairPriority = ph.repair;
    BS.Events.emit("playPhase", { ship: ship, play: pl.id, phase: i, def: ph });
  }

  // One condition set: true when any listed condition holds (or, with all: true, when every one holds).
  function conditions(ship, target, u, time) {
    if (!u) return false;
    var keys = Object.keys(u).filter(function (k) { return k !== "all"; });
    var dKm = S.distanceKm(ship, target), heat = ship.stats.heatCap ? ship.heat / ship.stats.heatCap : 0;
    var facing = S.shieldFrac(ship, S.facingToward(ship, target.pos.x, target.pos.y)), weakest = S.shieldFrac(ship, S.weakestFacing(ship)), cap = ship.capMax ? ship.capacitor / ship.capMax : 0;
    var alive = ship.stats.alive || {}, ealive = target.stats.alive || {};
    function holds(k) {
      var v = u[k];
      switch (k) {
        case "dKmBelow": return dKm < v;
        case "dKmAbove": return dKm > v;
        case "heatAbove": return heat > v;
        case "heatBelow": return heat < v;
        case "facingBelow": return facing < v;
        case "facingAbove": return facing > v;
        case "weakestBelow": return weakest < v;
        case "weakestAbove": return weakest > v;
        case "capBelow": return cap < v;
        case "capAbove": return cap > v;
        case "time": return time > v;
        case "cloakOff": return ship.cloak.state === "off";
        case "cloaked": return ship.cloak.state === "cloaked";
        case "overloaded": return ship.overload > 0;
        case "noTubes": return !(alive.torpedo > 0);
        case "noPhasers": return !(alive.phaser > 0);
        case "enemyReactorsGone": return !(ealive.reactor > 0);
        case "enemyShieldsDown": return S.shieldFrac(target, S.facingToward(target, ship.pos.x, ship.pos.y)) <= 0.02;
        default: return false;
      }
    }
    if (!keys.length) return false;
    return u.all ? keys.every(holds) : keys.some(holds);
  }

  function update(ship, dt) {
    var pl = ship.play;
    if (!pl || ship.flags.destroyed) return;
    var t = pl.target;
    if (!t || t.flags.destroyed) return;
    if (ship.ai && ship.ai.suspended) { stop(ship); return; }   // manual helm ends the play
    pl.t += dt;
    var ph = pl.def.phases[pl.phase], P = BS.Data.helm.playPolicy;
    // standing policies, evaluated every step
    if (ph.booster === "auto") {
      var weak = S.shieldFrac(ship, S.weakestFacing(ship)), cap = ship.capMax ? ship.capacitor / ship.capMax : 0;
      setModules(ship, { shield_booster: weak < P.boosterBelow && cap > P.boosterMinCap });
    }
    if (ph.reinforce && ship.reinforceCooldown <= 0 && S.shieldFrac(ship, S.weakestFacing(ship)) < P.reinforceBelow) S.startReinforce(ship);
    // phase transitions (never before the phase's minimum time, so a condition flickering at the boundary cannot flap)
    if (pl.t < (ph.minTime !== undefined ? ph.minTime : P.minPhaseTime)) return;
    var go = conditions(ship, t, ph.until, pl.t) || conditions(ship, t, ph.untilAll ? Object.assign({ all: true }, ph.untilAll) : null, pl.t);
    if (go) {
      var next = ph.next !== undefined ? ph.next : (pl.phase + 1) % pl.def.phases.length;
      enterPhase(ship, next);
    }
  }

  return { start: start, stop: stop, update: update, available: available };
})();
