// js/fleet.js — teams and target selection (0.31). A battle holds N ships on the player's side and M on the enemy's
// (ship.team: "player" | "enemy"); every ship fights its own current target (ship.target), chosen here: the nearest
// hostile it can see, re-chosen when that target is destroyed. Retargeting rebinds everything that was tied to the old
// target: the script, the running play, the doctrine machine (the helm re-enters its stance or doctrine against the new
// ship), the lock and the selection. A team is beaten when none of its ships can still fight (destroyed, disabled or
// captured). Nothing here reads the interface; the viewer (state.player) and the primary enemy (state.enemy) the panels
// follow are picked in game.js.
window.BS = window.BS || {};

BS.Fleet = (function () {
  var S = BS.Ships;

  function alive(s) { return !s.flags.destroyed; }
  function fighting(s) { return !s.flags.destroyed && !s.flags.disabled && !s.flags.captured; }
  function hostile(a, b) { return a.team !== b.team; }
  function ships() { return (BS.Game && BS.Game.state && BS.Game.state.ships) || []; }
  function hostiles(ship) { return ships().filter(function (o) { return o !== ship && alive(o) && hostile(ship, o); }); }
  function allies(ship) { return ships().filter(function (o) { return o !== ship && alive(o) && !hostile(ship, o); }); }
  function teamShips(team) { return ships().filter(function (o) { return o.team === team; }); }
  function teamFighting(team) { return teamShips(team).some(fighting); }

  // The nearest hostile by contact range (a cloaked ship beyond our sensors is known only by its last contact), ships
  // still able to fight before disabled ones.
  function nearestHostile(ship) {
    var best = null, bestD = Infinity, bestF = false;
    hostiles(ship).forEach(function (o) {
      var d = S.contactKm(ship, o), f = fighting(o);
      if ((f && !bestF) || (f === bestF && d < bestD)) { best = o; bestD = d; bestF = f; }
    });
    return best;
  }
  function targetOf(ship) { return ship.target && alive(ship.target) ? ship.target : null; }

  // Point every layer of a ship at `t`. The helm re-enters the stance (player side) or doctrine (enemy side) it was
  // flying, which re-issues the movement command; the lock policy and the AI re-lock on their own tick.
  function retarget(ship, t, why) {
    if (!t || t === ship.target) return false;
    var prev = ship.target;
    ship.target = t; ship.selected = t;
    if (ship.script) ship.script.target = t;
    if (ship.play) ship.play.target = t;
    if (ship.lock.target && ship.lock.target !== t) S.clearLock(ship, "retarget");
    if (ship.aimBlock && ship.aimBlock.ship !== t) S.setAimBlock(ship, null, null);
    if (ship.ai && !ship.ai.suspended) {
      ship.ai.player = t;
      if (ship.stance) BS.EnemyAI.setStance(ship, t, ship.stance);
      else if (ship.doctrineId) BS.EnemyAI.setDoctrine(ship, t, ship.doctrineId);
    }
    if (ship.cmd && ship.cmd.target && ship.cmd.target !== t && ship.cmd.type !== "flyTo") ship.cmd.target = t;
    BS.Events.emit("targetChanged", { ship: ship, target: t, prev: prev, why: why || "pick" });
    return true;
  }
  // Every ship without a live target picks one (called each step before the bridges run).
  function update(state) {
    var list = state.ships || [];
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (!alive(s) || s.flags.disabled) continue;
      if (targetOf(s)) continue;
      var t = nearestHostile(s);
      if (t) retarget(s, t, s.target ? "target lost" : "first target");
    }
  }

  return { hostiles: hostiles, allies: allies, teamShips: teamShips, teamFighting: teamFighting, nearestHostile: nearestHostile, targetOf: targetOf, retarget: retarget, update: update, fighting: fighting };
})();
