// js/crew.js — crew voices and instant commands. Officers report what the
// ship does and warn about danger; they no longer delay orders.
window.BS = window.BS || {};

BS.Crew = (function () {
  var U = BS.Util, S = BS.Ships;
  var D = function () { return BS.Data.crew; };
  var ship = null, enemy = null;
  var subscribed = false;
  var shieldedState = null, shieldedAt = -99;

  function reset(playerShip, enemyShip) {
    ship = playerShip; enemy = enemyShip;
    shieldedState = null; shieldedAt = -99;
    if (!subscribed) { subscribe(); subscribed = true; }
  }

  function now() { return BS.Game ? BS.Game.state.time : 0; }
  function say(officer, text, cls) { BS.Events.emit("log", { speaker: officer, text: text, cls: cls || "report" }); }
  function report(officer, key, vars, cls) {
    var str = D().reports[key];
    if (str) say(officer, U.template(str, vars || {}), cls);
  }
  function fmtKm(px) { var k = S.km(px); return k < 10 ? k.toFixed(1) : Math.round(k); }

  // ---- commands from the interface ----------------------------------------
  // All execute immediately on the player ship and are acknowledged by the
  // responsible officer.
  function command(id, args) {
    args = args || {};
    if (!ship || ship.flags.destroyed) return;
    var target = args.target || ship.lock.target || ship.selected;
    switch (id) {
      case "approach": if (!target) return report("tactical", "lockNoTarget"); S.setCommand(ship, "approach", { target: target }); report("helm", "approach"); break;
      case "orbit": if (!target) return report("tactical", "lockNoTarget"); S.setCommand(ship, "orbit", { target: target, rangeKm: args.rangeKm }); report("helm", "orbit", { range: args.rangeKm }); break;
      case "keep": if (!target) return report("tactical", "lockNoTarget"); S.setCommand(ship, "keep", { target: target, rangeKm: args.rangeKm }); report("helm", "keepRange", { range: args.rangeKm }); break;
      case "flyTo": S.setCommand(ship, "flyTo", { point: args.point }); report("helm", "flyTo"); break;
      case "stop": S.setCommand(ship, "idle"); report("helm", "stop"); break;
      case "comeAbout": {
        S.setCommand(ship, "comeAbout", { target: target });
        var f = ship.cmd.facing;
        report("helm", f === "aft" ? "comeAbout_aft" : "comeAbout", { facing: f });
        break;
      }
      case "select": ship.selected = args.target || null; break;
      case "lock": {
        if (!target) return report("tactical", "lockNoTarget");
        var r = S.startLock(ship, target);
        if (r === "ok") report("tactical", "lockStart", { name: target.name });
        else if (r === "outOfRange") report("tactical", "lockOutOfRange", { range: ship.cls.lockRangeKm });
        break;
      }
      case "unlock": S.clearLock(ship, "unlock"); report("tactical", "unlock"); break;
      case "targetSubsystem": {
        var sys = args.subsystem;
        if (!sys || ship.targetSubsystem === sys) { ship.targetSubsystem = null; report("tactical", "targetHull"); }
        else { ship.targetSubsystem = sys; say("tactical", BS.Data.subsystems[sys].targetReport); }
        shieldedState = null;
        break;
      }
      case "module": BS.Modules.toggle(ship, args.module); break;
      case "repair": {
        var rs = args.subsystem;
        if (!rs || ship.repairPriority === rs) { ship.repairPriority = null; report("engineering", "repairAuto"); }
        else { ship.repairPriority = rs; report("engineering", "repair", { label: BS.Data.subsystems[rs].label.toLowerCase() }); }
        break;
      }
      case "reinforce": {
        var res = S.startReinforce(ship);
        if (res === "cooldown") report("engineering", "reinforceShields_cooldown");
        else if (res) report("engineering", "reinforceShields", { weak: res.to, strong: res.from });
        else report("engineering", "reinforceShields_none");
        break;
      }
      case "redAlert": S.setAlert(ship, "red"); BS.Events.emit("alertChanged", { ship: ship, alert: "red" }); report("tactical", "redAlert"); break;
      case "hail":
        if (enemy && !enemy.flags.destroyed) {
          report("comms", "hail");
          var reply = U.pick(D().hailReplies);
          setTimeout(function () { BS.Events.emit("log", { speaker: "enemy", text: reply, cls: "enemy" }); }, 900);
        } else report("comms", "hail_noResponse");
        break;
    }
    BS.Events.emit("commandGiven", { id: id, args: args });
  }

  // ---- spontaneous reports ---------------------------------------------
  function update(dt) {
    if (!ship || ship.flags.destroyed) return;
    var rs = ship.reportState;
    S.FACINGS.forEach(function (f) {
      var pct = ship.shields[f] / ship.shieldMax;
      var state = rs.shieldLow[f] || "ok";
      if (pct <= 0 && state !== "down") { rs.shieldLow[f] = "down"; say("tactical", U.template(D().events.shieldDown, { facing: U.capitalize(f) }), "warn"); }
      else if (pct > 0 && pct < 0.25 && state === "ok") { rs.shieldLow[f] = "low"; say("tactical", U.template(D().events.shieldLow, { facing: U.capitalize(f), pct: Math.round(pct * 100) }), "warn"); }
      else if (pct > 0.5 && state !== "ok") { rs.shieldLow[f] = "ok"; say("engineering", U.template(D().events.shieldRestored, { facing: U.capitalize(f) })); }
    });
    if (ship.hull / ship.hullMax < 0.25 && !rs.hullCritical) { rs.hullCritical = true; say("engineering", D().events.hullCritical, "warn"); }
    var cap = ship.capacitor / ship.capMax;
    if (cap < 0.2 && !rs.capLow) { rs.capLow = true; report("engineering", "capLow", { pct: Math.round(cap * 100) }, "warn"); }
    else if (cap > 0.4 && rs.capLow) rs.capLow = false;
  }

  function subscribe() {
    BS.Events.on("subsystemDamaged", function (e) {
      if (e.ship !== ship) return;
      var low = ship.reportState.subsystemLow;
      if (ship.subsystems[e.subsystem] < 60 && !low[e.subsystem]) { low[e.subsystem] = true; say("engineering", BS.Data.subsystems[e.subsystem].damaged, "warn"); }
    });
    BS.Events.on("subsystemRepaired", function (e) {
      if (e.ship !== ship) return;
      if (ship.reportState.subsystemLow[e.subsystem]) { ship.reportState.subsystemLow[e.subsystem] = false; say("engineering", BS.Data.subsystems[e.subsystem].repaired); }
    });
    BS.Events.on("lockAcquired", function (e) { if (e.ship === ship) report("tactical", "lockDone"); else if (e.target === ship) say("tactical", D().events.enemyLocking, "warn"); });
    BS.Events.on("lockLost", function (e) { if (e.ship === ship && e.reason === "range") report("tactical", "lockLost", {}, "warn"); });
    BS.Events.on("moduleOffline", function (e) { if (e.ship === ship) say("engineering", U.template(D().reports.moduleNoCap, { module: e.module.def.name }), "warn"); });
    BS.Events.on("alertChanged", function (e) { if (e.ship === ship && e.auto) report("tactical", "autoArm"); });
    BS.Events.on("moduleToggled", function (e) {
      if (e.ship !== ship || !e.on || !BS.Modules.isWeapon(e.module)) return;
      if (!ship.lock.locked) report("tactical", "moduleNoLock");
    });
    BS.Events.on("torpedoHit", function (e) {
      if (!e.torpedo || e.torpedo.source !== ship || !e.result) return;
      if (e.result.shieldsDown) say("tactical", U.template(D().events.torpedoHitShieldsDown, { facing: e.result.facing }));
      else say("tactical", U.template(U.pick(D().events.torpedoHit), { facing: e.result.facing }));
    });
    BS.Events.on("torpedoLaunched", function (e) { if (e.ship === enemy) say("tactical", D().events.enemyFiringTorpedo, "warn"); });
    BS.Events.on("moduleCycle", function (e) {
      if (e.ship === enemy && e.module.id === "afterburner" && !e.ship._abReported) { e.ship._abReported = true; say("helm", D().events.enemyAfterburner); }
    });
    BS.Events.on("enemyStateChanged", function (e) {
      if (e.state === "retreat") say("tactical", D().events.enemyRetreat);
      else if (e.state === "attack" && e.prev === "retreat") say("tactical", D().events.enemyReturn);
    });
    BS.Events.on("shipDestroyed", function (e) { if (e.ship === enemy) say("tactical", D().events.enemyDestroyed); });
    // targeted part behind an intact shield
    BS.Events.on("shieldHit", function (e) {
      if (!ship || e.ship !== enemy || !ship.targetSubsystem || e.attacker !== ship) return;
      var absorbedAll = e.hullDamage < e.amount * 0.3;
      if (absorbedAll && shieldedState !== "shielded" && now() - shieldedAt > 12) {
        shieldedState = "shielded"; shieldedAt = now();
        say("tactical", U.template(D().reports.targetShielded, { facing: e.facing, label: BS.Data.subsystems[ship.targetSubsystem].label.toLowerCase() }), "warn");
      }
    });
    BS.Events.on("hullHit", function (e) {
      if (!ship || e.ship !== enemy || !ship.targetSubsystem || e.attacker !== ship) return;
      if (e.absorbed <= 0 && shieldedState === "shielded") {
        shieldedState = "exposed";
        say("tactical", U.template(D().reports.targetExposed, { facing: e.facing, label: BS.Data.subsystems[ship.targetSubsystem].label.toLowerCase() }));
      }
    });
  }

  function battleStart() {
    D().events.battleStart.forEach(function (m, i) {
      setTimeout(function () { say(m.officer, m.text); }, 400 + i * 1400);
    });
  }

  return { reset: reset, command: command, update: update, battleStart: battleStart, say: say, fmtKm: fmtKm };
})();
