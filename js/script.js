// js/script.js — bridge scripts: ordered "when → do" rules the bridge runs on its own, for the player and the
// enemy alike (BS.Data.script holds the vocabulary and the templates; a save holds the player's scripts).
//
// A script is { name, policies, rules }. Every script.tickSeconds the rules are read top to bottom:
//   - a STANDING rule (no `once`, no `every`) whose conditions all hold becomes the standing orders; its actions are
//     applied once, when it takes over (so a stance is not re-issued every tick). A rule with `until` keeps the
//     orders until that holds (or `holdMax` seconds pass) unless a rule above it takes over: that is how phases
//     such as "vent until heat is under 30%" are written. A rule with no conditions is the default: it stands when
//     nothing above it does.
//   - a CALL-OUT (`once: true` or `every: N`) fires its actions whenever its conditions hold, once ever or at most
//     every N seconds, without disturbing the standing orders: scan, reinforce, a boarding party.
//   - POLICIES run every tick: lock the target, pulse the booster when a shield is low, reinforce when it is very
//     low, drop a decoy when torpedoes close, run the neutraliser in range (helm.playPolicy numbers).
// Conditions and actions are named in BS.Data.script.conditions / .actions with a sentence each, and
// BS.Script.describe(rule) turns a rule into one, so the trace, the editor and the battle report never show data.
// Aiming at a scanned weak point or a planned target needs a scan first (action `scan`: science.scanDuration
// seconds with the beam turrets holding fire; sets ship.scanned). Every firing is appended to ship.scriptTrace and
// emitted as `scriptRule`. A manual helm order suspends the player's script (`scriptSuspended`).
window.BS = window.BS || {};

BS.Script = (function () {
  var S = BS.Ships, M = BS.Modules;
  var D = function () { return BS.Data.script; };

  // ---- lifecycle --------------------------------------------------------------------------------------------
  // def may be a template id or an inline script object.
  function resolve(def) {
    if (!def) return null;
    if (typeof def === "string") return D().templates[def] || null;
    return def;
  }
  function start(ship, target, def) {
    var sc = resolve(def);
    if (!sc || !target) return false;
    ship.script = { def: sc, target: target, active: -1, activeSince: 0, t: 0, tick: 0, fired: {}, lastFire: {}, suspended: false, waiting: null, firedRules: {}, everTrue: {}, firstTrue: {}, extremes: null };
    ship.scriptTrace = [];
    ship.scanned = ship.scanned || false; ship.scanning = ship.scanning || 0;
    return true;
  }
  function stop(ship) { ship.script = null; }
  // A bridge call: an override rule that stands above every scripted rule for a while, then hands back.
  // call = { kind: "play" | "side" | "disengage" | "reinforce" | "focus", value } → the rule it becomes, or null.
  function callRule(call) {
    var BC = BS.Data.script.bridgeCall;
    switch (call.kind) {
      case "play": return { when: {}, do: { play: call.value }, holdMax: BC.holdSeconds, call: true };
      case "side": return { when: {}, do: { side: call.value }, holdMax: BC.holdSeconds, call: true };
      case "disengage": return { when: {}, do: { stance: "disengage" }, until: { weakestAbove: BC.disengageUntil }, holdMax: BC.holdSeconds, call: true };
      case "reinforce": return { when: {}, do: { reinforce: true }, once: true, call: true };
      case "focus": return { when: {}, do: { aim: { x: call.value.x, y: call.value.y } }, holdMax: BC.focusSeconds, call: true };
      case "remodShields": return { when: {}, do: { remodulate: "shields" }, once: true, call: true };
      case "remodAmmo": return { when: {}, do: { remodulate: "ammo" }, once: true, call: true };
      default: return null;
    }
  }
  function bridgeCall(ship, call) {
    var sc = ship.script, r = callRule(call);
    if (!sc || !r) return false;
    var target = sc.target;
    if (r.once) { var n0 = apply(ship, target, r.do, r); if (n0 && r.do.remodulate) { BS.Events.emit("bridgeCallNothing", { ship: ship, call: call, why: n0 }); return false; } trace(ship, null, "BRIDGE CALL: " + describeDo(r.do) + (n0 ? " (" + n0 + ")" : ""), "call"); return true; }
    sc.override = { rule: r, since: sc.t };
    var n1 = apply(ship, target, r.do, r);
    trace(ship, null, "BRIDGE CALL: " + describe(r, sc.def) + (n1 ? " (" + n1 + ")" : ""), "call");
    return true;
  }
  function suspend(ship, why) { if (ship.script && !ship.script.suspended) { ship.script.suspended = true; trace(ship, null, "manual: " + (why || "helm order") + ", script paused", "manual"); BS.Events.emit("scriptSuspended", { ship: ship, why: why }); } }
  function resume(ship) { if (ship.script) { ship.script.suspended = false; ship.script.active = -1; trace(ship, null, "script resumed", "manual"); } }

  // ---- conditions ---------------------------------------------------------------------------------------------
  // All conditions in `when` must hold. Values: km, fractions 0–1, seconds, counts, block types.
  function conditions(ship, target, when, time) {
    if (!when) return true;
    var keys = Object.keys(when);
    if (!keys.length) return true;
    var dKm = S.contactKm(ship, target), st = ship.stats, est = target.stats;   // ranges off our contact, not a cloaked ship's true position
    var heat = st.heatCap ? ship.heat / st.heatCap : 0;
    var facing = S.shieldFrac(ship, S.facingToward(ship, target.pos.x, target.pos.y)), weakest = S.shieldFrac(ship, S.weakestFacing(ship));
    var cap = ship.capMax ? ship.capacitor / ship.capMax : 0, ecap = target.capMax ? target.capacitor / target.capMax : 0;
    var alive = st.alive || {}, ealive = est.alive || {};
    var tai = target.ai, tstate = tai ? tai.state : "";
    var eheat = est.heatCap ? target.heat / est.heatCap : 0;
    // a flag condition written `flag: false` holds when the flag does not (the engine compares, not just reads)
    function holds(k) { var v = when[k], c = D().conditions[k]; var r = holds0(k, v); return c && c.kind === "flag" && v === false ? !r : r; }
    function holds0(k, v) {
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
        case "hullBelow": return ship.hull / ship.hullMax < v;
        case "time": return time > v;
        case "cloakOff": return ship.cloak.state === "off";
        case "cloaked": return ship.cloak.state === "cloaked";
        case "noCloak": return ship.cloak.state === "off" && !S.cloakFieldComplete(ship);
        case "overloaded": return ship.overload > 0;
        case "noTubes": return !st.weapons.some(function (b) { return b.alive && b.def.weapon.kind === "launcher"; });
        case "noPhasers": return !st.weapons.some(function (b) { return b.alive && b.def.weapon.kind === "turret"; });
        case "scanned": return !!ship.scanned === !!v;
        case "incomingTorpedoes": return BS.Weapons.incoming(ship, 99) >= v;
        case "boardable": return BS.Boarding.canBoard(ship, target) === "ok";
        case "enemyReactorsGone": return !(ealive.reactor > 0);
        case "enemyShieldsDown": return S.shieldFrac(target, S.facingToward(target, ship.pos.x, ship.pos.y)) <= 0.02;
        case "enemyFacingBelow": return S.shieldFrac(target, S.facingToward(target, ship.pos.x, ship.pos.y)) < v;
        case "enemyCapBelow": return ecap < v;
        case "enemyHullBelow": return target.hull / target.hullMax < v;
        case "enemyCharging": return (tstate === "run_in" || tstate === "approach") && closingKmS(ship, target) > D().chargingKmS;
        case "enemyCloaking": return target.cloak.state === "cloaking";
        case "enemyCloaked": return S.isCloaked(target);
        case "enemyRolling": return tstate === "reposition" || target.cmd.type === "comeAbout";
        case "enemyBreaching": return target.breach > 0;
        case "enemyKiting": return tstate === "kite" || tstate === "evade" || tstate === "drained" || tstate === "retreat";
        case "enemyFocusing": return focusType(target) === v;
        case "enemyState": return tstate === v;
        case "enemyStance": return stanceOf(target) === v;
        case "enemyAimingAt": return aimingAt(target) === v;
        case "rangeBand": return rangeBand(ship, dKm) === v;
        case "enemyAfterburner": return M.find(target, "afterburner").some(function (m) { return m.active; });
        case "enemyHeatAbove": return eheat > v;
        case "enemyHeatBelow": return eheat < v;
        case "blindFor": return !!ship.ai && ship.ai.blindTimer > v;
        case "enemyAmmoBeatsOurShields": { if (!ship.scanned) return false; var ta = BS.Grid.dominantTune(BS.Grid.tuningSummary(target.grid).ammo), of = BS.Grid.dominantTune(BS.Grid.tuningSummary(ship.grid).frequency); return !!(ta && of) && BS.Grid.tuneMult(ta, of) > 1; }
        case "ourAmmoBeaten": { if (!ship.scanned) return false; var oa = BS.Grid.dominantTune(BS.Grid.tuningSummary(ship.grid).ammo), tf = BS.Grid.dominantTune(BS.Grid.tuningSummary(target.grid).frequency); return !!(oa && tf) && BS.Grid.tuneMult(oa, tf) < 1; }
        case "remodulating": return !!ship.remod;
        default: return false;
      }
    }
    for (var i = 0; i < keys.length; i++) if (!holds(keys[i])) return false;
    return true;
  }
  function closingKmS(ship, target) {
    var ct = S.contact(ship, target); if (ct.ghost) return 0;
    var dx = target.pos.x - ship.pos.x, dy = target.pos.y - ship.pos.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    var rvx = target.vel.x - ship.vel.x, rvy = target.vel.y - ship.vel.y;
    return -S.km(rvx * dx / d + rvy * dy / d);   // positive when the range is closing
  }
  // What the other ship is doing, in one word (enemyAI.stanceLabels), read off its doctrine state and helm command.
  function stanceOf(t) {
    var st = t.ai ? t.ai.state : "", cmd = t.cmd ? t.cmd.type : "";
    if (cmd === "shadow") return "shadowing";
    if (st === "reposition" || cmd === "comeAbout") return "rolling";
    if (st === "kite" || st === "evade" || st === "retreat" || st === "drained") return "kiting";
    if (st === "approach" || st === "run_in" || st === "stalk" || st === "uncloak" || st === "turn_in") return "closing";
    if (st === "brawl" || st === "pass") return "orbiting";
    if (st === "standoff" || st === "broadside" || st === "clear") return "holding";
    return cmd === "orbit" ? "orbiting" : cmd === "approach" ? "closing" : "holding";
  }
  // What the other ship's fire is steered at (enemyAI.aimLabels): the hull, a system type, a weak point, structure.
  function aimingAt(t) {
    if (t.aimType === "block" && t.aimBlock) return t.aimBlock.block.structural ? "structure" : "weak";
    if (t.aimType === "structure") return "structure";
    return t.aimType ? "type" : "hull";
  }
  // The range in terms of our own fitted weapons (script.rangeBands): inside the longest beam optimal, inside the
  // longest torpedo range, or beyond both.
  function rangeBand(ship, dKm) {
    var beam = BS.EnemyAI.weaponRef(ship, "phaser"), torp = BS.EnemyAI.weaponRef(ship, "torpedo");
    if (beam !== null && dKm <= beam) return "beam";
    if (torp !== null && dKm <= torp) return "torpedo";
    return "out";
  }
  // What block type the other ship's fire is steered at (a focused block counts by its type).
  function focusType(ship) {
    if (ship.aimType === "block" && ship.aimBlock) return ship.aimBlock.block.structural ? "structure" : ship.aimBlock.block.type;
    return ship.aimType || null;
  }

  // ---- actions --------------------------------------------------------------------------------------------
  function setModules(ship, policy) {
    Object.keys(policy).forEach(function (id) {
      var on = policy[id], list = id === "weapons" ? M.weapons(ship) : M.find(ship, id);
      list.forEach(function (m) { if (m.active !== on) M.setActive(ship, m, on); });
    });
  }
  // Apply a rule's actions. Returns a note for the trace when something could not be done yet.
  function apply(ship, target, act, rule) {
    var note = null;
    var flying = ship.ai && !ship.ai.suspended;
    if (act.play) { if (!(ship.play && ship.play.id === act.play) && BS.Plays.start(ship, target, act.play) !== true) note = "no " + act.play + " play"; }
    else if (act.stance) { if (!(flying && !ship.play && ship.stance === act.stance)) { BS.Plays.stop(ship); BS.EnemyAI.setStance(ship, target, act.stance); } }
    else if (act.doctrine) { if (!(flying && !ship.play && !ship.stance && ship.doctrineId === act.doctrine)) { BS.Plays.stop(ship); BS.EnemyAI.setDoctrine(ship, target, act.doctrine); } }
    if (act.side && ship.attackSide !== act.side) BS.EnemyAI.setAttackSide(ship, target, act.side);
    if (act.modules) setModules(ship, act.modules);
    if (act.weapons !== undefined) setModules(ship, { weapons: !!act.weapons });
    if (act.governor !== undefined) ship.heatGovernor = !!act.governor;
    if (act.repair !== undefined) ship.repairPriority = act.repair || null;
    if (act.reinforce) S.startReinforce(ship);
    if (act.scan) { if (!ship.scanned && !ship.scanning) { ship.scanning = BS.Data.science.scanDuration; BS.Events.emit("scanStarted", { ship: ship, target: target, time: ship.scanning }); } }
    if (act.board) { var br = BS.Boarding.start(ship, target); if (br !== "ok") note = "boarding: " + br; }
    if (act.roll) { if (!BS.EnemyAI.roll(ship, target)) note = "cannot come about"; }
    if (act.remodulate) { var rn = S.remodulate(ship, act.remodulate, target); if (rn) note = "remodulate: " + rn; }
    if (act.aim !== undefined) { var an = aim(ship, target, act.aim); if (an) { note = an; if (ship.script && /scan/.test(an)) ship.script.waitingAim = act.aim; } else if (ship.script) ship.script.waitingAim = null; }
    return note;
  }
  // aim: null / block type / "exposed" / "structure" / { weak: kind } / { plan: n } (planned targets need a scan) /
  // { x, y } one block (a bridge call: no scan needed, the captain pointed at it)
  function aim(ship, target, a) {
    if (a === null || a === "hull" || a === "") { ship.aimType = null; S.setAimBlock(ship, null, null); ship.scriptAim = true; return null; }
    if (typeof a === "string") { ship.aimType = a; S.setAimBlock(ship, null, null); ship.scriptAim = true; return null; }
    if (a.x !== undefined && a.plan === undefined) { var fb = target.grid.at[a.x + "," + a.y]; if (!fb || !fb.alive) return "that block is already gone"; S.setAimBlock(ship, target, fb); ship.scriptAim = true; BS.Events.emit("scriptAim", { ship: ship, target: target, block: fb, label: (fb.structural ? "structure" : fb.def.name) + " at " + fb.x + "," + fb.y }); return null; }
    if (!ship.scanned) return "waiting for a scan before aiming at " + (a.weak ? "their " + a.weak : "plan target " + (a.plan + 1));
    var block = null, label = null;
    if (a.weak) { var wps = BS.Grid.weakPoints(target, ship).filter(function (w) { return a.weak === "any" || w.kind === a.weak; }); if (wps.length) { block = wps[0].block; label = wps[0].label; } }
    if (a.plan !== undefined) {
      var plan = BS.Campaign.planFor ? BS.Campaign.planFor(BS.Game.state.encounter) : null, tg = plan && plan.targets ? plan.targets[a.plan] : null;
      if (!tg) return "no plan target " + (a.plan + 1);
      if (tg.x !== undefined) { var b = target.grid.at[tg.x + "," + tg.y]; if (b && b.alive) { block = b; label = (b.structural ? "structure" : b.def.name) + " at " + b.x + "," + b.y; } else return "plan target " + (a.plan + 1) + " is already gone"; }
      else if (tg.type) { ship.aimType = tg.type; S.setAimBlock(ship, null, null); ship.scriptAim = true; return null; }
    }
    if (!block) return "nothing to aim at for " + (a.weak ? "weak point " + a.weak : "plan target " + (a.plan + 1));
    S.setAimBlock(ship, target, block); ship.scriptAim = true;
    BS.Events.emit("scriptAim", { ship: ship, target: target, block: block, label: label });
    return null;
  }

  // ---- policies ----------------------------------------------------------------------------------------------
  function policies(ship, target, pol) {
    var P = BS.Data.helm.playPolicy, EW = BS.Data.ew;
    if (pol.lock !== false && !ship.lock.target && ship.jammed <= 0 && !S.isCloaked(target) && S.distanceKm(ship, target) <= ship.cls.lockRangeKm) { S.startLock(ship, target); if (ship.ai) ship.ai.relock = true; }
    var weak = S.shieldFrac(ship, S.weakestFacing(ship)), cap = ship.capMax ? ship.capacitor / ship.capMax : 0;
    if (pol.booster === "auto") setModules(ship, { shield_booster: weak < P.boosterBelow && cap > P.boosterMinCap });
    if (pol.reinforce === "auto" && ship.reinforceCooldown <= 0 && weak < P.reinforceBelow) S.startReinforce(ship);
    if (pol.decoy === "auto") setModules(ship, { decoy: ship.cloak.state === "off" && BS.Weapons.incoming(ship, EW.decoy.aiIncomingKm) > 0 });
    if (pol.neut === "auto") setModules(ship, { neut: ship.lock.locked && S.distanceKm(ship, target) <= EW.neut.rangeKm + 0.5 && cap > EW.neut.aiMinCap });
    if (pol.hardener === "auto") setModules(ship, { shield_hardener: cap > 0.15 && ship.cloak.state === "off" });
  }

  // ---- trace -------------------------------------------------------------------------------------------------
  function trace(ship, rule, text, kind) {
    var t = BS.Game.state ? BS.Game.state.time : 0, entry = { t: t, rule: rule, text: text, kind: kind || "rule" };
    if (ship.script && rule !== null && rule !== undefined) ship.script.firedRules[rule] = true;
    ship.scriptTrace = ship.scriptTrace || [];
    ship.scriptTrace.push(entry);
    if (ship.scriptTrace.length > D().traceMax) ship.scriptTrace.shift();
    BS.Events.emit("scriptRule", { ship: ship, entry: entry });
  }

  // A rule's `callout`: what the other bridge's Tactical hears when it fires (event scriptCallout; crew.js reads it
  // for the enemy's rules, so an enemy reaction is always announced).
  function callout(ship, rule) { if (rule.callout) BS.Events.emit("scriptCallout", { ship: ship, text: rule.callout, rule: rule }); }

  // ---- update ------------------------------------------------------------------------------------------------
  function update(ship, dt) {
    // the scan runs even while the script is paused: beams hold fire until it is done
    if (ship.scanning > 0) { ship.scanning -= dt; if (ship.scanning <= 0) { ship.scanning = 0; ship.scanned = true; BS.Events.emit("scanned", { ship: ship, target: ship.script ? ship.script.target : null }); } }
    var sc = ship.script;
    if (!sc || sc.suspended || ship.flags.destroyed || ship.flags.disabled) return;
    var target = sc.target;
    if (!target || target.flags.destroyed) return;
    sc.t += dt; sc.tick -= dt;
    if (sc.tick > 0) return;
    sc.tick = D().tickSeconds;
    var def = sc.def, rules = def.rules || [];
    record(ship, target, sc);
    policies(ship, target, def.policies || {});
    // call-outs
    var i, r;
    for (i = 0; i < rules.length; i++) {
      r = rules[i];
      if (!r.once && !r.every) continue;
      if (r.once && sc.fired[i]) continue;
      if (r.every && sc.lastFire[i] !== undefined && sc.t - sc.lastFire[i] < r.every) continue;
      if (!conditions(ship, target, r.when, sc.t)) continue;
      var note = apply(ship, target, r.do || {}, r);
      if (note && r.once) continue;   // a once rule that could not act yet tries again (a scan not yet done)
      sc.fired[i] = true; sc.lastFire[i] = sc.t;
      trace(ship, i, describe(r, def) + (note ? " (" + note + ")" : ""), "callout");
      callout(ship, r);
    }
    // a bridge call override stands above everything until its until / holdMax; when it ends the script re-picks
    if (sc.override) {
      var ov = sc.override.rule, over = (ov.holdMax && sc.t - sc.override.since > ov.holdMax) || (ov.until && conditions(ship, target, ov.until, sc.t));
      if (!over) return;
      sc.override = null; sc.active = -1;
      trace(ship, null, "bridge call over: the script has the conn", "call");
    }
    // standing orders: the first standing rule whose conditions hold; a held rule keeps the orders
    var held = sc.active >= 0 && rules[sc.active] && rules[sc.active].until && !conditions(ship, target, rules[sc.active].until, sc.t) && !(rules[sc.active].holdMax && sc.t - sc.activeSince > rules[sc.active].holdMax);
    var pick = -1, dflt = -1;
    for (i = 0; i < rules.length; i++) {
      r = rules[i];
      if (r.once || r.every) continue;
      var empty = !r.when || !Object.keys(r.when).length;
      if (empty) { if (dflt < 0) dflt = i; continue; }
      if (held && i >= sc.active) break;   // nothing below the held rule may take over
      if (conditions(ship, target, r.when, sc.t)) { pick = i; break; }
    }
    if (pick < 0 && held) pick = sc.active;
    if (pick < 0) pick = dflt;
    if (pick < 0 || pick === sc.active) {
      // the standing rule's aim was waiting for a scan: take it now that the scan is in
      if (sc.waitingAim && ship.scanned && sc.active >= 0) { var wa = sc.waitingAim; sc.waitingAim = null; var an2 = aim(ship, target, wa); trace(ship, sc.active, "scan is in: " + describeDo({ aim: wa }) + (an2 ? " (" + an2 + ")" : ""), "standing"); }
      return;
    }
    sc.waitingAim = null;
    sc.active = pick; sc.activeSince = sc.t;
    var n2 = apply(ship, target, rules[pick].do || {}, rules[pick]);
    trace(ship, pick, describe(rules[pick], def) + (n2 ? " (" + n2 + ")" : ""), "standing");
    callout(ship, rules[pick]);
  }

  // ---- what the battle looked like, for the report: extremes of every measured quantity and which rules ever held ----
  function record(ship, target, sc) {
    var x = sc.extremes || (sc.extremes = { dKmMin: Infinity, dKmMax: 0, weakestMin: 1, facingMin: 1, heatMax: 0, capMin: 1, capMax: 0, hullMin: 1, efacingMin: 1, ecapMin: 1, ehullMin: 1, incomingMax: 0, ever: {} });
    var dKm = S.contactKm(ship, target), st = ship.stats, est = target.stats;
    x.dKmMin = Math.min(x.dKmMin, dKm); x.dKmMax = Math.max(x.dKmMax, dKm);
    x.weakestMin = Math.min(x.weakestMin, S.shieldFrac(ship, S.weakestFacing(ship)));
    x.facingMin = Math.min(x.facingMin, S.shieldFrac(ship, S.facingToward(ship, target.pos.x, target.pos.y)));
    x.heatMax = Math.max(x.heatMax, st.heatCap ? ship.heat / st.heatCap : 0);
    var cap = ship.capMax ? ship.capacitor / ship.capMax : 0; x.capMin = Math.min(x.capMin, cap); x.capMax = Math.max(x.capMax, cap);
    x.hullMin = Math.min(x.hullMin, ship.hull / ship.hullMax);
    x.efacingMin = Math.min(x.efacingMin, S.shieldFrac(target, S.facingToward(target, ship.pos.x, ship.pos.y)));
    x.ecapMin = Math.min(x.ecapMin, target.capMax ? target.capacitor / target.capMax : 0);
    x.ehullMin = Math.min(x.ehullMin, target.hull / target.hullMax);
    x.incomingMax = Math.max(x.incomingMax, BS.Weapons.incoming(ship, 99));
    x.eheatMax = Math.max(x.eheatMax || 0, est.heatCap ? target.heat / est.heatCap : 0);
    x.blindMax = Math.max(x.blindMax || 0, ship.ai ? ship.ai.blindTimer || 0 : 0);
    ["scanned", "boardable", "overloaded", "cloaked", "cloakOff", "noCloak", "noTubes", "noPhasers", "enemyReactorsGone", "enemyShieldsDown", "enemyCharging", "enemyCloaking", "enemyCloaked", "enemyRolling", "enemyBreaching", "enemyKiting", "enemyAfterburner", "enemyAmmoBeatsOurShields", "ourAmmoBeaten", "remodulating"].forEach(function (k) {
      if (!x.ever[k]) { var w = {}; w[k] = true; if (conditions(ship, target, w, sc.t)) x.ever[k] = sc.t; }
    });
    // per rule: whether all its conditions ever held together, and each condition on its own (for the report)
    sc.everKey = sc.everKey || {};
    (sc.def.rules || []).forEach(function (r, i) {
      if (!r.when) return;
      var ek = sc.everKey[i] || (sc.everKey[i] = {});
      Object.keys(r.when).forEach(function (k) { if (!ek[k]) { var w1 = {}; w1[k] = r.when[k]; if (conditions(ship, target, w1, sc.t)) ek[k] = sc.t; } });
      if (sc.everTrue[i]) return;
      if (Object.keys(r.when).length && conditions(ship, target, r.when, sc.t)) { sc.everTrue[i] = true; sc.firstTrue[i] = { t: sc.t, above: sc.override ? "call" : sc.active }; }
    });
  }
  // Why a rule never fired, in a sentence: the first of its conditions that never held, with how close it came.
  function explain(ship) {
    var sc = ship.script; if (!sc) return [];
    var out = [], V = D().conditions, x = sc.extremes || {}, rules = sc.def.rules || [];
    function pct(v) { return Math.round(v * 100) + "%"; }
    function km(v) { return (v === Infinity ? "—" : v.toFixed(1)) + " km"; }
    rules.forEach(function (r, i) {
      if (sc.firedRules[i]) return;
      var why = null;
      if (sc.everTrue[i]) { var ft = sc.firstTrue[i]; why = "it held at " + BS.Util.formatTime(ft.t) + " but " + (ft.above === "call" ? "a bridge call" : ft.above >= 0 ? "rule " + (ft.above + 1) : "a held rule") + " stood above it"; }
      else {
        var keys = Object.keys(r.when || {});
        for (var k0 = 0; k0 < keys.length && !why; k0++) {
          var k = keys[k0], v = r.when[k];
          switch (k) {
            case "dKmBelow": if (!(x.dKmMin < v)) why = "they never came inside " + v + " km (closest " + km(x.dKmMin) + ")"; break;
            case "dKmAbove": if (!(x.dKmMax > v)) why = "they never got beyond " + v + " km (farthest " + km(x.dKmMax) + ")"; break;
            case "weakestBelow": if (!(x.weakestMin < v)) why = "our weakest shield never fell under " + pct(v) + " (lowest " + pct(x.weakestMin) + ")"; break;
            case "facingBelow": if (!(x.facingMin < v)) why = "our shield facing them never fell under " + pct(v) + " (lowest " + pct(x.facingMin) + ")"; break;
            case "heatAbove": if (!(x.heatMax > v)) why = "our heat never rose over " + pct(v) + " (peak " + pct(x.heatMax) + ")"; break;
            case "capBelow": if (!(x.capMin < v)) why = "our capacitor never fell under " + pct(v) + " (lowest " + pct(x.capMin) + ")"; break;
            case "hullBelow": if (!(x.hullMin < v)) why = "our hull never fell under " + pct(v) + " (lowest " + pct(x.hullMin) + ")"; break;
            case "time": if (!(sc.t > v)) why = "the battle lasted " + Math.round(sc.t) + " s, not " + v; break;
            case "enemyFacingBelow": if (!(x.efacingMin < v)) why = "their shield facing us never fell under " + pct(v) + " (lowest " + pct(x.efacingMin) + ")"; break;
            case "enemyCapBelow": if (!(x.ecapMin < v)) why = "their capacitor never fell under " + pct(v) + " (lowest " + pct(x.ecapMin) + ")"; break;
            case "enemyHullBelow": if (!(x.ehullMin < v)) why = "their hull never fell under " + pct(v) + " (lowest " + pct(x.ehullMin) + ")"; break;
            case "incomingTorpedoes": if (!(x.incomingMax >= v)) why = "never " + v + " torpedoes at once (at most " + x.incomingMax + ")"; break;
            case "scanned": if (v && !x.ever.scanned) why = "we never scanned them"; break;
            case "enemyHeatAbove": if (!(x.eheatMax > v)) why = "their heat never rose over " + pct(v) + " (peak " + pct(x.eheatMax || 0) + ")"; break;
            case "blindFor": if (!(x.blindMax > v)) why = "our guns never lost them for " + v + " s (at most " + Math.round(x.blindMax || 0) + " s)"; break;
            default:
              if (V[k] && V[k].kind === "flag" && v !== false && !(x.ever && x.ever[k])) why = "\"" + V[k].label + "\" never happened";
              else if (V[k] && (V[k].kind === "stance" || V[k].kind === "aiming" || V[k].kind === "band" || V[k].kind === "state" || V[k].kind === "type") && !(sc.everKey && sc.everKey[i] && sc.everKey[i][k])) why = V[k].kind === "type" ? "they never shot at our " + fmtValue("type", v) : "they were never " + fmtValue(V[k].kind, v);
              break;
          }
        }
        if (!why) why = "its conditions never all held at the same time";
      }
      out.push({ rule: i, text: describe(r, sc.def), reason: why });
    });
    return out;
  }

  // ---- sentences ---------------------------------------------------------------------------------------------
  function fmtValue(kind, v) {
    if (kind === "pct") return Math.round(v * 100) + "%";
    if (kind === "km") return v + " km";
    if (kind === "sec") return v + " s";
    if (kind === "type") return BS.Data.blocks[v] ? BS.Data.blocks[v].name.toLowerCase() + "s" : String(v);
    if (kind === "state") return BS.Data.enemyAI.stateLabels[v] || String(v);
    if (kind === "stance") return BS.Data.enemyAI.stanceLabels[v] || String(v);
    if (kind === "aiming") return BS.Data.enemyAI.aimLabels[v] || String(v);
    if (kind === "band") return D().rangeBands[v] || String(v);
    return String(v);
  }
  function describeWhen(when) {
    var V = D().conditions, keys = Object.keys(when || {});
    if (!keys.length) return "otherwise";
    return "when " + keys.map(function (k) { var c = V[k]; if (!c) return k; if (c.kind === "bool" && !when[k] && c.negLabel) return c.negLabel; return c.label.replace("{v}", fmtValue(c.kind, when[k])); }).join(" and ");
  }
  function describeDo(act) {
    var A = D().actions, parts = [];
    Object.keys(act || {}).forEach(function (k) {
      var a = A[k], v = act[k];
      if (!a) return;
      var text;
      if (k === "stance") text = a.label.replace("{v}", BS.Data.helm.stances[v] ? BS.Data.helm.stances[v].label : v);
      else if (k === "play") text = a.label.replace("{v}", BS.Data.helm.plays[v] ? BS.Data.helm.plays[v].label : v);
      else if (k === "side") text = a.label.replace("{v}", BS.Data.helm.sides[v] ? BS.Data.helm.sides[v].label.toLowerCase() : v);
      else if (k === "doctrine") text = a.label.replace("{v}", v);
      else if (k === "aim") text = a.label.replace("{v}", aimLabel(v));
      else if (k === "modules") text = Object.keys(v).map(function (id) { var m = BS.Data.modules[id]; return (id === "weapons" ? "weapons" : m ? m.name.toLowerCase() : id) + (v[id] ? " on" : " off"); }).join(", ");
      else if (k === "weapons") text = "weapons " + (v ? "on" : "off");
      else if (k === "governor") text = "heat governor " + (v ? "on" : "off");
      else if (k === "repair") text = v ? a.label.replace("{v}", BS.Data.blocks[v] ? BS.Data.blocks[v].name.toLowerCase() + "s" : v) : "damage control on automatic";
      else if (k === "remodulate") text = a.label.replace("{v}", v === "ammo" ? "weapons to the ammo that beats their shields" : "shields to the frequency that beats their ammo");
      else text = a.label;
      parts.push(text);
    });
    return parts.join(", ") || "nothing";
  }
  function aimLabel(a) {
    if (a === null || a === "hull" || a === "" || a === undefined) return "anything";
    if (a === "exposed") return "bare hull";
    if (a === "structure") return "their necks and pylons";
    if (typeof a === "string") return BS.Data.blocks[a] ? "their " + BS.Data.blocks[a].name.toLowerCase() + "s" : a;
    if (a.weak) return a.weak === "any" ? "their top weak point" : "their weak point: " + (D().weakKinds[a.weak] || a.weak);
    if (a.plan !== undefined) return "plan target " + (a.plan + 1);
    if (a.x !== undefined) return "the block at " + a.x + "," + a.y;
    return "?";
  }
  function describe(rule, def) {
    var s = (rule.call ? "" : describeWhen(rule.when) + ": ") + describeDo(rule.do);
    if (rule.until) s += " — until " + describeWhen(rule.until).replace(/^when /, "");
    if (rule.holdMax) s += " (at most " + rule.holdMax + " s)";
    if (rule.once) s += " (once)";
    if (rule.every) s += " (every " + rule.every + " s)";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function describeScript(def) {
    var sc = resolve(def); if (!sc) return [];
    var out = (sc.rules || []).map(function (r, i) { return (i + 1) + ". " + describe(r, sc); });
    var pol = Object.keys(sc.policies || {}).filter(function (k) { return sc.policies[k] && sc.policies[k] !== false; }).map(function (k) { return D().policies[k] ? D().policies[k].label : k; });
    if (pol.length) out.push("Standing: " + pol.join("; ") + ".");
    return out;
  }

  return { start: start, stop: stop, suspend: suspend, resume: resume, update: update, bridgeCall: bridgeCall, callRule: callRule, explain: explain, conditions: conditions, apply: apply, describe: describe, describeScript: describeScript, describeWhen: describeWhen, describeDo: describeDo, resolve: resolve, focusType: focusType, stanceOf: stanceOf, aimingAt: aimingAt, rangeBand: rangeBand };
})();
