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
  // What the captain is aiming at, for a sentence: a block type, the structure, one block, or the bare hull.
  function aimLabel() {
    var a = ship.aimType;
    if (a === "block" && ship.aimBlock) return (ship.aimBlock.block.structural ? "structure" : ship.aimBlock.block.def.name.toLowerCase()) + " at " + ship.aimBlock.block.x + "," + ship.aimBlock.block.y;
    if (a === "structure") return "structural members";
    if (a === "exposed") return "bare hull";
    return a && BS.Data.blocks[a] ? BS.Data.blocks[a].name.toLowerCase() + "s" : "the hull";
  }
  function say(officer, text, cls) { BS.Events.emit("log", { speaker: officer, text: text, cls: cls || "report" }); }
  function report(officer, key, vars, cls) {
    var str = D().reports[key];
    if (str) say(officer, U.template(str, vars || {}), cls);
  }
  function fmtKm(px) { var k = S.km(px); return k < 10 ? k.toFixed(1) : Math.round(k); }

  // ---- commands from the interface ----------------------------------------
  // All execute immediately on the player ship and are acknowledged by the
  // responsible officer.
  // The top bar's live inputs (0.37: everything else is the script's): red alert, the heat governor, a hail.
  function command(id, args) {
    args = args || {};
    if (!ship || ship.flags.destroyed) return;
    switch (id) {
      case "governor": ship.heatGovernor = args.on !== undefined ? !!args.on : !ship.heatGovernor; report("engineering", ship.heatGovernor ? "governorOn" : "governorOff"); break;
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
      var pct = S.shieldFrac(ship, f);
      var state = rs.shieldLow[f] || "ok";
      if (pct <= 0 && state !== "down") { rs.shieldLow[f] = "down"; say("tactical", U.template(D().events.shieldDown, { facing: U.capitalize(f) }), "warn"); }
      else if (pct > 0 && pct < 0.25 && state === "ok") { rs.shieldLow[f] = "low"; say("tactical", U.template(D().events.shieldLow, { facing: U.capitalize(f), pct: Math.round(pct * 100) }), "warn"); }
      else if (pct > 0.5 && state !== "ok") { rs.shieldLow[f] = "ok"; say("engineering", U.template(D().events.shieldRestored, { facing: U.capitalize(f) })); }
    });
    if (ship.hull / ship.hullMax < 0.25 && !rs.hullCritical) { rs.hullCritical = true; say("engineering", D().events.hullCritical, "warn"); }
    var cap = ship.capacitor / ship.capMax;
    if (cap < 0.2 && !rs.capLow) { rs.capLow = true; report("engineering", "capLow", { pct: Math.round(cap * 100) }, "warn"); }
    else if (cap > 0.4 && rs.capLow) rs.capLow = false;
    var heat = ship.stats.heatCap ? ship.heat / ship.stats.heatCap : 0;
    if (heat > 0.8 && !rs.heatHigh && ship.overload <= 0) { rs.heatHigh = true; report("engineering", "heatHigh", {}, "warn"); }
    else if (heat < 0.5 && rs.heatHigh) rs.heatHigh = false;
  }

  function subscribe() {
    var lastBlockReport = -99;
    BS.Events.on("blockDestroyed", function (e) {
      if (e.ship !== ship) return;
      var r = BS.Data.blockReports[e.block.type];
      if (r && r.destroyed && (e.block.type !== "armor" || now() - lastBlockReport > 10)) { say("engineering", r.destroyed, "warn"); lastBlockReport = now(); }
    });
    BS.Events.on("enemyFocus", function (e) { if (e.target === ship) say("tactical", U.template(D().events.enemyFocus, { label: e.point.kind === "emitter" ? "our " + BS.Grid.facingOf(e.point.block) + " shield emitter" : e.point.kind === "chain" ? "our reactors" : e.point.kind === "blackout" ? "the reactor that powers our " + e.point.n + " systems" : e.point.kind === "neck" ? "the " + (e.point.block.structural ? "structure" : e.point.block.def.name.toLowerCase()) + " that holds " + e.point.n + " blocks on" : e.point.kind === "crew" ? "our crew decks" : "our wounded systems" }), "warn"); });
    BS.Events.on("coreBreach", function (e) {
      if (e.ship === ship) report("engineering", "breachOwn", { t: Math.round(e.time) }, "warn");
      else if (e.ship === enemy) say("tactical", U.template(D().events.enemyBreach, { t: Math.round(e.time) }), "warn");
    });
    BS.Events.on("coreBlast", function (e) {
      if (e.ship === enemy) say("tactical", D().events.enemyBreachBlast, "warn");
      e.hits.forEach(function (h) { if (h.ship === ship) say("engineering", U.template(D().events.blastHit, { dmg: Math.round(h.damage) }), "warn"); });
    });
    BS.Events.on("debrisHit", function (e) { if (e.ship === ship && now() - (ship._debrisReported || -99) > 6) { ship._debrisReported = now(); report("engineering", "debrisHit", { facing: S.facingToward(ship, e.fragment.x, e.fragment.y) }, "warn"); } });
    BS.Events.on("criticalHit", function (e) {
      if (e.ship === ship) report("engineering", "crit_" + e.kind, { facing: e.facing || "" }, "warn");
      else if (e.ship === enemy) report("tactical", "enemyCrit_" + e.kind, {});
    });
    BS.Events.on("sectionLost", function (e) {
      if (e.ship !== ship) return;
      say("engineering", U.template(BS.Data.blockReports.cutOff, { n: e.blocks.length }), "warn");
    });
    var lastExplosion = -99;
    BS.Events.on("blockExploded", function (e) {
      if (now() - lastExplosion < 4) return;
      lastExplosion = now();
      if (e.ship === ship) say("engineering", BS.Data.blockReports.reactorExploded, "warn");
      else if (e.ship === enemy) say("tactical", BS.Data.blockReports.enemyReactorExploded);
    });
    BS.Events.on("hullHit", function (e) { if (e.ship === ship && e.strike && now() - (ship._strikeReported || -99) > 20) { ship._strikeReported = now(); say("engineering", D().events.enemyStrike, "warn"); } });
    BS.Events.on("jammed", function (e) {
      if (!e.hit) return;
      if (e.target === ship) report("tactical", e.partial ? "jammedUsPartial" : "jammedUs", { n: e.exposed }, "warn");
      else if (e.ship === ship) report("tactical", e.partial ? "jammedThemPartial" : "jammedThem", { n: e.exposed });
    });
    BS.Events.on("cloakRefused", function (e) { if (e.ship === ship) report("engineering", "cloakField", { n: e.exposed }, "warn"); });
    BS.Events.on("cloakChanged", function (e) {
      if (e.ship === ship) { if (e.state === "cloaking") report("engineering", "cloakOn"); else if (e.state === "decloaking") report("engineering", e.reason === "nocap" ? "cloakNoCap" : e.reason === "field" ? "cloakCollapsed" : "cloakOff", {}, e.reason ? "warn" : null); else if (e.state === "off" && ship.cloak.strike > 0) report("tactical", "strikeWindow"); }
      else if (e.ship === enemy) {
        if (e.state === "cloaking") say("tactical", D().events.enemyCloaked, "warn");
        else if (e.state === "decloaking") say("tactical", U.template(D().events.enemyDecloak, { facing: S.facingToward(ship, enemy.pos.x, enemy.pos.y) }), "warn");
      }
    });
    BS.Events.on("governorHold", function (e) { if (e.ship === ship && e.holding) report("engineering", "governorHold"); });
    // the bridge script: every rule that takes over or calls out is read into the log by the computer
    BS.Events.on("scriptRule", function (e) { if (e.ship === ship) say("computer", "Script " + (e.entry.rule !== null && e.entry.rule !== undefined ? (e.entry.rule + 1) + ": " : "") + e.entry.text, "system"); });
    BS.Events.on("bridgeCall", function (e) { if (e.ship === ship) report("helm", "bridgeCall", { text: e.entry.text, left: e.left }); });
    BS.Events.on("bridgeCallRefused", function () { report("helm", "bridgeCallNone", {}, "warn"); });
    BS.Events.on("scanStarted", function (e) { if (e.ship === ship) report("tactical", "scanStart", { t: Math.round(e.time) }); else if (e.ship === enemy) report("tactical", "enemyScanning"); });
    BS.Events.on("scanned", function (e) { if (e.ship === ship) report("tactical", "scanDone"); });
    BS.Events.on("remodulateStarted", function (e) { if (e.ship === ship) report(e.kind === "shields" ? "engineering" : "tactical", e.kind === "shields" ? "remodShields" : "remodAmmo", { mod: BS.Data.tuning.list[e.to].name, t: Math.round(e.time) }); });
    BS.Events.on("remodulated", function (e) { var what = e.kind === "shields" ? "shields" : "weapons", mod = BS.Data.tuning.list[e.to].name; if (e.ship === ship) report("engineering", "remodDone", { what: what, mod: mod }); else if (e.ship === enemy) report("tactical", "enemyRemodDone", { what: what, mod: mod }, "warn"); });
    BS.Events.on("bridgeCallNothing", function (e) { if (e.ship === ship) report("engineering", "remodNothing", { why: e.why.replace(/^remodulate: /, "") }, "warn"); });
    BS.Events.on("scriptAim", function (e) { if (e.ship === ship) report("tactical", "aimWeak", { label: e.label }); });
    // an enemy reaction rule with a callout: Tactical reads it out (the enemy's script stays hidden, its moves do not)
    BS.Events.on("scriptCallout", function (e) { if (e.ship && e.ship.team === "enemy") say("tactical", e.text, "warn"); });
    // support (0.34): transfers in and out, repair teams, the escort order
    BS.Events.on("shieldTransferred", function (e) { if (e.amount <= 0) return; if (e.ship === ship && now() - (ship._xferOut || -99) > 10) { ship._xferOut = now(); report("engineering", "transferOut", { amount: Math.round(e.amount), name: e.target.name }); } else if (e.target === ship && now() - (ship._xferIn || -99) > 10) { ship._xferIn = now(); report("engineering", "transferIn", { amount: Math.round(e.amount), name: e.ship.name, facing: e.to }); } });
    BS.Events.on("remoteRepaired", function (e) { if (e.target === ship && e.amount > 0 && now() - (ship._rrepIn || -99) > 15) { ship._rrepIn = now(); report("engineering", "repairIn", { name: e.ship.name }); } });
    BS.Events.on("escortChanged", function (e) { if (e.ship === ship) report("helm", "escort", { name: e.ally.name }); });
    // a charging weapon (0.33): the tell every bridge hears
    BS.Events.on("weaponCharging", function (e) { if (!ship || !e.target || e.target.team !== ship.team) return; if (e.target === ship) report("tactical", "lanceOnUs", { t: Math.round(e.time) }, "warn"); else report("tactical", "lanceOnAlly", { name: e.target.name, t: Math.round(e.time) }, "warn"); });
    // second-generation EW
    BS.Events.on("decoyLaunched", function (e) { if (e.ship === ship) report("tactical", e.incoming > 0 ? "decoyLaunched" : "decoyNoTorpedoes"); else if (e.ship === enemy) report("tactical", "enemyDecoy"); });
    BS.Events.on("torpedoLured", function (e) { if (e.ship === ship && now() - (ship._luredReported || -99) > 6) { ship._luredReported = now(); report("tactical", "decoyLured"); } });
    BS.Events.on("neutralised", function (e) {
      if (e.ship === ship) { if (e.dry && !ship._neutDryReported) { ship._neutDryReported = true; report("tactical", "neutDry"); } else if (now() - (ship._neutReported || -99) > 12) { ship._neutReported = now(); report("tactical", "neutHit", { amount: Math.round(e.drained), pct: Math.round(100 * e.target.capacitor / e.target.capMax) }); } }
      else if (e.target === ship && now() - (ship._neutOnUsReported || -99) > 12) { ship._neutOnUsReported = now(); report("engineering", "neutOnUs", { amount: Math.round(e.drained) }, "warn"); }
    });
    BS.Events.on("moduleToggled", function (e) { if (e.ship === ship && e.on && e.module.id === "neut" && ship.lock.target && S.distanceKm(ship, ship.lock.target) > BS.Data.ew.neut.rangeKm) report("tactical", "neutRange", { range: BS.Data.ew.neut.rangeKm }); });
    BS.Events.on("overload", function (e) { if (e.ship === ship) report("engineering", "overload", {}, "warn"); else if (e.ship === enemy) report("tactical", "enemyOverload"); });
    BS.Events.on("shipDisabled", function (e) { if (e.ship === enemy) report("tactical", "enemyDisabled"); else if (e.ship === ship) report("engineering", "shipDisabled", {}, "warn"); });
    BS.Events.on("lockAcquired", function (e) { if (e.ship === ship) { report("tactical", "lockDone"); if (ship.ai) ship.ai.relock = true; } else if (e.target === ship) say("tactical", D().events.enemyLocking, "warn"); });
    var lastExposed = -99;
    BS.Events.on("hullHit", function (e) { if (e.ship === ship && e.exposed && now() - lastExposed > 10) { lastExposed = now(); report("engineering", "hitExposed", {}, "warn"); } });
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
    BS.Events.on("stateChanged", function (e) {
      var ev = D().events;
      if (e.ship === ship) {   // our own helm narrates the doctrine's turning points
        if (e.state === "run_in" && e.prev !== "turn_in") return;
        if (D().reports["helm_" + e.state]) report("helm", "helm_" + e.state);
        return;
      }
      if (e.ship !== enemy) return;
      if (e.state === "retreat") say("tactical", ev.enemyRetreat);
      else if (e.prev === "retreat") say("tactical", ev.enemyReturn);
      else if (e.state === "run_in" && e.prev === "turn_in") say("tactical", ev.enemyPass, "warn");
      else if (e.state === "pass" && e.passes === 1) say("tactical", ev.enemyFirstPass, "warn");
      else if (e.state === "break_off" && e.passes === 1) say("tactical", ev.enemyBreakOff);
      else if (e.state === "standoff" && e.prev === "approach") say("tactical", ev.enemyStandoff);
      else if (e.state === "kite" && !e.ship._kiteReported) { e.ship._kiteReported = true; say("helm", ev.enemyKite); }
      else if (e.state === "broadside" && e.prev === "approach") say("tactical", ev.enemyBroadside);
    });
    BS.Events.on("enemyRolled", function (e) { if (e.ship === enemy && now() - (e.ship._rollReported || -99) > 25 && e.ship.ai.timer > 1) { e.ship._rollReported = now(); say("tactical", D().events.enemyRoll); } });
    BS.Events.on("orbitFlipped", function (e) { if (e.ship === enemy) say("helm", D().events.enemyFlip); else if (e.ship === ship) report("helm", e.reason === "shield" ? "autoFlipShield" : "autoFlip"); });
    BS.Events.on("shipDestroyed", function (e) { if (e.ship === enemy) say("tactical", D().events.enemyDestroyed); else if (e.ship === ship) report("engineering", "shipDead", {}, "warn"); });
    // targeted part behind an intact shield
    BS.Events.on("shieldHit", function (e) {
      if (!ship || e.ship !== enemy || !ship.aimType || ship.aimType === "exposed" || e.attacker !== ship) return;
      var absorbedAll = e.hullDamage < e.amount * 0.3;
      if (absorbedAll && shieldedState !== "shielded" && now() - shieldedAt > 12) {
        shieldedState = "shielded"; shieldedAt = now();
        say("tactical", U.template(D().reports.targetShielded, { facing: e.facing, label: aimLabel() }), "warn");
      }
    });
    BS.Events.on("hullHit", function (e) {
      if (!ship || e.ship !== enemy || !ship.aimType || ship.aimType === "exposed" || e.attacker !== ship) return;
      if (e.absorbed <= 0 && shieldedState === "shielded") {
        shieldedState = "exposed";
        say("tactical", U.template(D().reports.targetExposed, { facing: e.facing, label: aimLabel() }));
      }
    });
  }

  function battleStart() {
    var n = BS.Game && BS.Game.state.teams ? BS.Game.state.teams.enemy.length : 1;
    var vars = { className: n > 1 ? "squadron of " + n : enemy ? enemy.cls.className : "vessel", name: enemy ? enemy.name : "", range: BS.Data.balance.arenaStartDistanceKm };
    D().events.battleStart.forEach(function (m, i) {
      setTimeout(function () { say(m.officer, U.template(m.text, vars)); }, 400 + i * 1400);
    });
  }

  return { reset: reset, command: command, update: update, battleStart: battleStart, say: say, fmtKm: fmtKm };
})();
