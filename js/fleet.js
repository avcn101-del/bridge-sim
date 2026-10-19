// js/fleet.js — teams and target selection (0.31). A battle holds N ships on the player's side and M on the enemy's
// (ship.team: "player" | "enemy"); every ship fights its own current target (ship.target), chosen here: the nearest
// hostile it can see, re-chosen when that target is destroyed. Retargeting rebinds everything that was tied to the old
// target: the script, the doctrine machine (the helm re-enters its doctrine against the new
// ship), the lock and the selection. A team is beaten when none of its ships can still fight (destroyed, disabled or
// disabled). Nothing here reads the interface; the viewer (state.player) and the primary enemy (state.enemy) the panels
// follow are picked in game.js.
window.BS = window.BS || {};

BS.Fleet = (function () {
  var S = BS.Ships;

  function alive(s) { return !s.flags.destroyed; }
  function fighting(s) { return !s.flags.destroyed && !s.flags.disabled; }
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
  function nearestOf(ship, list) { var b = null, bd = Infinity; list.forEach(function (o) { var d = S.contactKm(ship, o); if (d < bd) { b = o; bd = d; } }); return b; }
  // Subjects (script.subjects, 0.32): the enemy a rule is about, or the ship an action switches our fire to. Ships still
  // able to fight come first; null when no hostile is left (or no enemy is shooting at us, for "hunter").
  function subject(ship, id) {
    var hs = hostiles(ship);
    if (!hs.length) return null;
    var f = hs.filter(fighting); if (f.length) hs = f;
    switch (id) {
      case "nearest": return nearestOf(ship, hs);
      case "weakest": { var w = null; hs.forEach(function (o) { if (!w || o.hull / o.hullMax < w.hull / w.hullMax) w = o; }); return w; }
      case "biggest": { var g = null; hs.forEach(function (o) { if (!g || o.hullMax > g.hullMax) g = o; }); return g; }
      case "smallest": { var sm = null; hs.forEach(function (o) { if (!sm || o.hullMax < sm.hullMax) sm = o; }); return sm; }
      case "loudest": { var lo = null; hs.forEach(function (o) { if (!lo || o.signature > lo.signature) lo = o; }); return lo; }
      case "hunter": { var h = hs.filter(function (o) { return o.target === ship; }); return h.length ? nearestOf(ship, h) : null; }
      case "focus": {   // the hostile most of our side is fighting, the nearest among equals
        var count = {}; allies(ship).concat([ship]).forEach(function (a) { if (a.target && hs.indexOf(a.target) >= 0) count[a.target.id] = (count[a.target.id] || 0) + 1; });
        var best = null, bn = -1;
        hs.forEach(function (o) { var n = count[o.id] || 0; if (!best || n > bn || (n === bn && S.contactKm(ship, o) < S.contactKm(ship, best))) { best = o; bn = n; } });
        return best;
      }
      default: return targetOf(ship) || nearestOf(ship, hs);
    }
  }
  function fightingAllies(ship) { return allies(ship).filter(fighting); }
  // Ally subjects (script.allySubjects, 0.34): who a support or escort action is for; null when alone.
  function ally(ship, id) {
    var al = fightingAllies(ship);
    if (!al.length) return null;
    switch (id) {
      case "hurtAlly": { var h = null; al.forEach(function (a) { if (!h || a.hull / a.hullMax < h.hull / h.hullMax) h = a; }); return h; }
      case "huntedAlly": { var hs = hostiles(ship), best = null, bn = -1; al.forEach(function (a) { var n = hs.filter(function (o) { return o.target === a; }).length; if (n > bn || (n === bn && best && S.contactKm(ship, a) < S.contactKm(ship, best))) { best = a; bn = n; } }); return best; }
      case "flagship": { var st = BS.Game.state, f = st.teams[ship.team][0]; return f && f !== ship && fighting(f) ? f : al[0]; }
      default: { var w = null; al.forEach(function (a) { var v = S.shieldFrac(a, S.weakestFacing(a)); if (!w || v < w.v) w = { a: a, v: v }; }); return w ? w.a : null; }
    }
  }

  // Point every layer of a ship at `t`. The helm re-enters the doctrine it was
  // flying, which re-issues the movement command; the lock policy and the AI re-lock on their own tick.
  function retarget(ship, t, why) {
    if (!t || t === ship.target) return false;
    var prev = ship.target;
    ship.target = t; ship.selected = t;
    if (ship.script) ship.script.target = t;
    if (ship.lock.target && ship.lock.target !== t) S.clearLock(ship, "retarget");
    if (ship.aimBlock && ship.aimBlock.ship !== t) S.setAimBlock(ship, null, null);
    ship.scanned = !!(ship.scannedOf && ship.scannedOf[t.id]);   // a scan is of one ship (0.32)
    if (ship.ai && !ship.ai.suspended) {
      ship.ai.player = t;
      if (ship.doctrineId) BS.EnemyAI.setDoctrine(ship, t, ship.doctrineId);
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

  return { hostiles: hostiles, allies: allies, fightingAllies: fightingAllies, teamShips: teamShips, teamFighting: teamFighting, nearestHostile: nearestHostile, targetOf: targetOf, subject: subject, ally: ally, retarget: retarget, update: update, fighting: fighting };
})();
