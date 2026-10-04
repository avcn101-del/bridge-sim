// js/crew.js — crew AI: order queues per officer, delays, acknowledgements,
// execution on the player ship, and spontaneous situation reports.
window.BS = window.BS || {};

BS.Crew = (function () {
  var U = BS.Util, S = BS.Ships, W = BS.Weapons;
  var D = function () { return BS.Data.crew; };
  var officers = {};   // officer -> { current: order|null, pending: [order] }  (FIFO, bounded)
  var MAX_PENDING = 4;
  var ship = null, enemy = null;
  var subscribed = false;

  function reset(playerShip, enemyShip) {
    ship = playerShip; enemy = enemyShip;
    officers = {};
    Object.keys(D().officers).forEach(function (o) { officers[o] = { current: null, pending: [] }; });
    if (!subscribed) { subscribe(); subscribed = true; }
  }

  function say(officer, text, cls) {
    BS.Events.emit("log", { speaker: officer, text: text, cls: cls || "report" });
  }
  function report(key, vars) {
    var str = D().reports[key];
    if (!str) return;
    var officer = D().orderOfficer[key.split("_")[0]];
    say(officer, U.template(str, vars || {}));
  }

  // ---- giving orders ----------------------------------------------------
  function give(orderId) {
    var officer = D().orderOfficer[orderId];
    if (!officer || !ship || ship.flags.destroyed) return;
    var q = officers[officer];
    var delay = D().orderDelays[orderId] * ship.mods.delayMult;
    if (ship.flags.alert === "red") delay *= D().redAlertDelayMult;
    var order = { id: orderId, officer: officer, delay: delay, timer: delay };
    BS.Events.emit("orderGiven", order);
    say(officer, U.pick(D().acks[officer]), "ack");
    if (!q.current) q.current = order;
    else { q.pending.push(order); if (q.pending.length > MAX_PENDING) q.pending.shift(); }
  }

  // ---- executing orders -------------------------------------------------
  function execute(order) {
    var id = order.id;
    var vars = {};
    switch (id) {
      case "attackPattern": S.setHelmMode(ship, "attack"); break;
      case "evasive": S.setHelmMode(ship, "evasive"); break;
      case "closeRange": S.setHelmMode(ship, "close"); break;
      case "openRange": S.setHelmMode(ship, "open"); break;
      case "comeAbout": {
        var already = enemy && S.facingToward(ship, enemy.pos.x, enemy.pos.y) === S.strongestFacing(ship) && ship.helm.mode === "comeAbout";
        S.setHelmMode(ship, "comeAbout"); vars.facing = ship.helm.comeAboutFacing;
        if (already) { report("comeAbout_already", vars); BS.Events.emit("orderExecuted", order); return; }
        if (vars.facing === "aft") { report("comeAbout_aft", vars); BS.Events.emit("orderExecuted", order); return; }
        break;
      }
      case "targetWeapons": ship.targetSubsystem = "weapons"; break;
      case "targetEngines": ship.targetSubsystem = "engines"; break;
      case "targetShields": ship.targetSubsystem = "shields"; break;
      case "firePhasers": {
        var c = W.canFirePhasers(ship, enemy);
        if (c === "ok") { W.firePhasers(ship, enemy); report("firePhasers"); }
        else if (c === "charging") { ship.fireOnce.phasers = true; report("firePhasers_charging"); }
        else if (c === "notArmed") report("firePhasers_notArmed");
        else report("firePhasers_outOfRange");
        BS.Events.emit("orderExecuted", order); return;
      }
      case "fireTorpedoes": {
        var ct = W.canFireTorpedoes(ship, enemy);
        if (ct === "ok") { W.fireTorpedoSpread(ship, enemy); report("fireTorpedoes"); }
        else if (ct === "loading") { ship.fireOnce.torpedoes = true; report("fireTorpedoes_loading"); }
        else if (ct === "notArmed") report("fireTorpedoes_notArmed");
        else { ship.fireOnce.torpedoes = true; report("fireTorpedoes_noArc"); }
        BS.Events.emit("orderExecuted", order); return;
      }
      case "fireAtWill":
        ship.flags.fireAtWill = !ship.flags.fireAtWill;
        report(ship.flags.fireAtWill ? "fireAtWill_on" : "fireAtWill_off");
        if (ship.flags.fireAtWill && !ship.flags.armed) report("firePhasers_notArmed");
        BS.Events.emit("orderExecuted", order); return;
      case "holdFire": ship.flags.fireAtWill = false; ship.fireOnce.phasers = false; ship.fireOnce.torpedoes = false; break;
      case "powerBalanced": S.setPowerPreset(ship, "balanced"); break;
      case "powerWeapons": S.setPowerPreset(ship, "weapons"); break;
      case "powerShields": S.setPowerPreset(ship, "shields"); break;
      case "powerEngines": S.setPowerPreset(ship, "engines"); break;
      case "repairWeapons": ship.repairPriority = "weapons"; break;
      case "repairEngines": ship.repairPriority = "engines"; break;
      case "repairShields": ship.repairPriority = "shields"; break;
      case "repairAuto": ship.repairPriority = null; break;
      case "reinforceShields": {
        var r = S.startReinforce(ship);
        if (r) report("reinforceShields", { weak: r.to, strong: r.from }); else report("reinforceShields_none");
        BS.Events.emit("orderExecuted", order); return;
      }
      case "redAlert": S.setAlert(ship, "red"); BS.Events.emit("alertChanged", { ship: ship, alert: "red" }); break;
      case "yellowAlert": S.setAlert(ship, "yellow"); BS.Events.emit("alertChanged", { ship: ship, alert: "yellow" }); break;
      case "hail":
        if (enemy && !enemy.flags.destroyed) {
          report("hail");
          var reply = U.pick(D().hailReplies);
          setTimeout(function () { BS.Events.emit("log", { speaker: "enemy", text: reply, cls: "enemy" }); }, 900);
        } else report("hail_noResponse");
        BS.Events.emit("orderExecuted", order); return;
    }
    report(id, vars);
    BS.Events.emit("orderExecuted", order);
  }

  function update(dt) {
    if (!ship) return;
    Object.keys(officers).forEach(function (o) {
      var q = officers[o];
      if (!q.current) return;
      q.current.timer -= dt;
      if (q.current.timer <= 0) {
        var done = q.current;
        q.current = q.pending.length ? q.pending.shift() : null;
        if (!ship.flags.destroyed) execute(done);
      }
    });
    checkSituation(dt);
  }

  function isBusy(officer) { return !!(officers[officer] && officers[officer].current); }

  // ---- spontaneous reports ---------------------------------------------
  function checkSituation(dt) {
    if (ship.flags.destroyed) return;
    var rs = ship.reportState;
    S.FACINGS.forEach(function (f) {
      var pct = ship.shields[f] / ship.shieldMax;
      var state = rs.shieldLow[f] || "ok";
      if (pct <= 0 && state !== "down") { rs.shieldLow[f] = "down"; say("tactical", U.template(D().events.shieldDown, { facing: U.capitalize(f) }), "warn"); }
      else if (pct > 0 && pct < 0.25 && state === "ok") { rs.shieldLow[f] = "low"; say("tactical", U.template(D().events.shieldLow, { facing: U.capitalize(f), pct: Math.round(pct * 100) }), "warn"); }
      else if (pct > 0.5 && state !== "ok") { rs.shieldLow[f] = "ok"; say("engineering", U.template(D().events.shieldRestored, { facing: U.capitalize(f) })); }
    });
    if (ship.hull / ship.hullMax < 0.25 && !rs.hullCritical) { rs.hullCritical = true; say("engineering", D().events.hullCritical, "warn"); }
  }

  function subscribe() {
    BS.Events.on("subsystemDamaged", function (e) {
      if (e.ship !== ship) return;
      var rs = ship.reportState.subsystemLow;
      if (ship.subsystems[e.subsystem] < 60 && !rs[e.subsystem]) { rs[e.subsystem] = true; say("engineering", D().events.subsystemDamaged[e.subsystem], "warn"); }
    });
    BS.Events.on("subsystemRepaired", function (e) {
      if (e.ship !== ship) return;
      if (ship.reportState.subsystemLow[e.subsystem]) { ship.reportState.subsystemLow[e.subsystem] = false; say("engineering", D().events.subsystemRepaired[e.subsystem]); }
    });
    BS.Events.on("torpedoHit", function (e) {
      if (!e.torpedo || e.torpedo.source !== ship || !e.result) return;
      if (e.result.shieldsDown) say("tactical", U.template(D().events.torpedoHitShieldsDown, { facing: e.result.facing }));
      else say("tactical", U.template(U.pick(D().events.torpedoHit), { facing: e.result.facing }));
    });
    BS.Events.on("torpedoLaunched", function (e) {
      if (e.ship === ship && ship.flags.fireAtWill && ship.pendingSpread === 0) report("fireTorpedoes");
      if (e.ship === enemy) say("tactical", D().events.enemyFiringTorpedo, "warn");
    });
    BS.Events.on("enemyStateChanged", function (e) {
      if (e.state === "retreat") say("tactical", D().events.enemyRetreat);
      else if (e.state === "attack" && e.prev === "retreat") say("tactical", D().events.enemyReturn);
    });
    BS.Events.on("shipDestroyed", function (e) {
      if (e.ship === enemy) say("tactical", D().events.enemyDestroyed);
    });
  }

  function battleStart() {
    D().events.battleStart.forEach(function (m, i) {
      setTimeout(function () { say(m.officer, m.text); }, 400 + i * 1400);
    });
  }

  return { reset: reset, give: give, update: update, isBusy: isBusy, battleStart: battleStart, say: say };
})();
