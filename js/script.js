// js/script.js — bridge scripts: ordered "when → do" rules the bridge runs on its own, for the player and the
// enemy alike (BS.Data.script holds the vocabulary and the templates; a save holds the player's scripts).
//
// A script is { name, policies, rules }. Every script.tickSeconds the rules are read top to bottom:
//   - a STANDING rule (no `once`, no `every`) whose conditions all hold becomes the standing orders; its actions are
//     applied once, when it takes over (so a stance is not re-issued every tick). A rule with `until` keeps the
//     orders until that holds (or `holdMax` seconds pass) unless a rule above it takes over: that is how phases
//     such as "disengage until the weakest shield is over 60%" are written. A rule with no conditions is the default: it stands when
//     nothing above it does.
//   - a CALL-OUT (`once: true` or `every: N`) fires its actions whenever its conditions hold, once ever or at most
//     every N seconds, without disturbing the standing orders: scan, reinforce, remodulate.
//   - POLICIES run every tick: lock the target, pulse the booster when a shield is low, reinforce when it is very
//     low, drop a decoy when torpedoes close, run the neutraliser in range (helm.policy numbers).
// Conditions and actions are named in BS.Data.script.conditions / .actions with a sentence each, and
// BS.Script.describe(rule) turns a rule into one, so the trace, the editor and the battle report never show data.
// Aiming at a scanned weak point or a planned target needs a scan first (action `scan`: script.scanSeconds
// seconds with the beam turrets holding fire; sets ship.scanned). Every firing is appended to ship.scriptTrace and
// emitted as `scriptRule`.
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
    ship.scannedOf = ship.scannedOf || {}; ship.scanned = !!ship.scannedOf[target.id]; ship.scanning = ship.scanning || 0;
    return true;
  }
  function stop(ship) { ship.script = null; }
  // A bridge call: an override rule that stands above every scripted rule for a while, then hands back.
  // call = { kind: "doctrine" | "side" | "disengage" | "reinforce" | "focus" | "remodShields" | "remodAmmo", value } → the rule it becomes, or null.
  function callRule(call) {
    var BC = BS.Data.script.bridgeCall;
    switch (call.kind) {
      case "doctrine": return { when: {}, do: { doctrine: call.value }, holdMax: BC.holdSeconds, call: true };
      case "side": return { when: {}, do: { side: call.value }, holdMax: BC.holdSeconds, call: true };
      case "disengage": return { when: {}, do: { doctrine: "disengage" }, until: { weakestAbove: BC.disengageUntil }, holdMax: BC.holdSeconds, call: true };
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

  // ---- conditions ---------------------------------------------------------------------------------------------
  // All conditions in `when` must hold. Values: km, fractions 0–1, seconds, counts, block types.
  function conditions(ship, target, when, time) {
    if (!when) return true;
    var keys = Object.keys(when);
    if (!keys.length) return true;
    var dKm = S.contactKm(ship, target), st = ship.stats, est = target.stats;   // ranges off our contact, not a cloaked ship's true position
    var facing = S.shieldFrac(ship, S.facingToward(ship, target.pos.x, target.pos.y)), weakest = S.shieldFrac(ship, S.weakestFacing(ship));
    var cap = ship.capMax ? ship.capacitor / ship.capMax : 0, ecap = target.capMax ? target.capacitor / target.capMax : 0;
    var alive = st.alive || {}, ealive = est.alive || {};
    var tai = target.ai, tstate = tai ? tai.state : "";
    // a flag condition written `flag: false` holds when the flag does not (the engine compares, not just reads)
    function holds(k) { var v = when[k], c = D().conditions[k]; var r = holds0(k, v); return c && c.kind === "flag" && v === false ? !r : r; }
    function holds0(k, v) {
      switch (k) {
        case "dKmBelow": return dKm < v;
        case "dKmAbove": return dKm > v;
        case "weakestBelow": return weakest < v;
        case "weakestAbove": return weakest > v;
        case "capBelow": return cap < v;
        case "hullBelow": return ship.hull / ship.hullMax < v;
        case "time": return time > v;
        case "cloaked": return ship.cloak.state === "cloaked";
        case "noCloak": return ship.cloak.state === "off" && !S.cloakFieldComplete(ship);
        case "noTubes": return !st.weapons.some(function (b) { return b.alive && b.def.weapon.kind === "launcher"; });
        case "scanned": return !!ship.scanned === !!v;
        case "enemyReactorsGone": return !(ealive.reactor > 0);
        case "enemyShieldsDown": return S.shieldFrac(target, S.facingToward(target, ship.pos.x, ship.pos.y)) <= 0.02;
        case "enemyHullBelow": return target.hull / target.hullMax < v;
        case "enemyCloaked": return S.isCloaked(target);
        case "enemyFocusing": return focusType(target) === v;
        case "blindFor": return !!ship.ai && ship.ai.blindTimer > v;
        case "enemyAmmoBeatsOurShields": { if (!ship.scanned) return false; var ta = BS.Grid.dominantTune(BS.Grid.tuningSummary(target.grid).ammo), of = BS.Grid.dominantTune(BS.Grid.tuningSummary(ship.grid).frequency); return !!(ta && of) && BS.Grid.tuneMult(ta, of) > 1; }
        case "ourAmmoBeaten": { if (!ship.scanned) return false; var oa = BS.Grid.dominantTune(BS.Grid.tuningSummary(ship.grid).ammo), tf = BS.Grid.dominantTune(BS.Grid.tuningSummary(target.grid).frequency); return !!(oa && tf) && BS.Grid.tuneMult(oa, tf) < 1; }
        case "remodulating": return !!ship.remod;
        // 0.32: the rest of our side and the count of theirs (BS.Fleet)
        case "allyShieldBelow": return BS.Fleet.fightingAllies(ship).some(function (a) { return S.shieldFrac(a, S.weakestFacing(a)) < v; });
        case "allyHullBelow": return BS.Fleet.fightingAllies(ship).some(function (a) { return a.hull / a.hullMax < v; });
        case "allyUnderFire": { var al = BS.Fleet.fightingAllies(ship); return BS.Fleet.hostiles(ship).some(function (o) { return o.target && al.indexOf(o.target) >= 0; }); }
        case "outnumbered": return BS.Fleet.hostiles(ship).filter(BS.Fleet.fighting).length > BS.Fleet.fightingAllies(ship).length + 1;
        case "enemiesAtMost": return BS.Fleet.hostiles(ship).filter(BS.Fleet.fighting).length <= v;
        case "unfocused": { var fo = BS.Fleet.subject(ship, "focus"); return !!fo && fo !== BS.Fleet.targetOf(ship); }
        // 0.33: bosses
        case "notTargeting": { var nt = BS.Fleet.subject(ship, v); return !!nt && nt !== BS.Fleet.targetOf(ship); }
        case "enemiesAtLeast": return BS.Fleet.hostiles(ship).filter(BS.Fleet.fighting).length >= v;
        case "lanceCharging": return BS.Fleet.hostiles(ship).some(function (o) { return M.chargingOn(o, ship).length > 0; });
        // 0.41: the warbird's tractor beam
        case "tractored": return ship.tractored > 0;
        case "allyTractored": return BS.Fleet.fightingAllies(ship).some(function (a) { return a.tractored > 0; });
        case "allyLanced": { var al2 = BS.Fleet.fightingAllies(ship); return BS.Fleet.hostiles(ship).some(function (o) { return o.grid.blocks.some(function (b) { return b.alive && b.charging > 0 && b.chargeTarget && al2.indexOf(b.chargeTarget) >= 0; }); }); }
        default: return false;
      }
    }
    for (var i = 0; i < keys.length; i++) if (!holds(keys[i])) return false;
    return true;
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
    // switch our fire (0.32): the subject becomes the ship's target before the rest of the actions act on it
    if (act.target) { var ts = BS.Fleet.subject(ship, act.target); if (!ts) note = "no " + subjectLabel(act.target); else if (ts !== BS.Fleet.targetOf(ship)) { BS.Fleet.retarget(ship, ts, "script"); target = ts; } }
    var flying = ship.ai && !ship.ai.suspended;
    if (act.doctrine) { if (!(flying && ship.doctrineId === act.doctrine)) { ship.escortSubject = null; BS.EnemyAI.setDoctrine(ship, target, act.doctrine); } }
    if (act.side && ship.attackSide !== act.side) BS.EnemyAI.setAttackSide(ship, target, act.side);
    if (act.modules) setModules(ship, act.modules);
    if (act.weapons !== undefined) setModules(ship, { weapons: !!act.weapons });
    if (act.repair !== undefined) ship.repairPriority = act.repair || null;
    if (act.reinforce) S.startReinforce(ship);
    if (act.scan) { if (!ship.scanned && !ship.scanning) { ship.scanning = D().scanSeconds; ship.scanTarget = target; BS.Events.emit("scanStarted", { ship: ship, target: target, time: ship.scanning }); } }
    if (act.roll) { if (!BS.EnemyAI.roll(ship, target)) note = "cannot come about"; }
    if (act.remodulate) { var rn = S.remodulate(ship, act.remodulate, target); if (rn) note = "remodulate: " + rn; }
    if (act.support !== undefined) { var sa = BS.Fleet.ally(ship, act.support); if (sa) ship.support = sa; else note = "no " + allyLabel(act.support); }
    if (act.escort !== undefined) { var ea = BS.Fleet.ally(ship, act.escort); ship.escortSubject = act.escort; if (!ea || !BS.EnemyAI.escort(ship, ea)) note = "no " + allyLabel(act.escort); }
    if (act.summon) { var sn = BS.Game.summon(ship); if (sn) note = "summon: " + sn; }
    if (act.overdrive) { var on = BS.Ships.overdrive(ship); if (on) note = "overdrive: " + on; }
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
    var P = BS.Data.helm.policy, EW = BS.Data.ew;
    if (pol.lock !== false && !ship.lock.target && ship.jammed <= 0 && !S.isCloaked(target) && S.distanceKm(ship, target) <= ship.cls.lockRangeKm) { S.startLock(ship, target); if (ship.ai) ship.ai.relock = true; }
    var weak = S.shieldFrac(ship, S.weakestFacing(ship)), cap = ship.capMax ? ship.capacitor / ship.capMax : 0;
    if (pol.booster === "auto") setModules(ship, { shield_booster: weak < P.boosterBelow && cap > P.boosterMinCap });
    if (pol.reinforce === "auto" && ship.reinforceCooldown <= 0 && weak < P.reinforceBelow) S.startReinforce(ship);
    if (pol.decoy === "auto") setModules(ship, { decoy: ship.cloak.state === "off" && BS.Weapons.incoming(ship, EW.decoy.aiIncomingKm) > 0 });
    if (pol.neut === "auto") setModules(ship, { neut: ship.lock.locked && S.distanceKm(ship, target) <= EW.neut.rangeKm + 0.5 && cap > EW.neut.aiMinCap });
    if (pol.hardener === "auto") setModules(ship, { shield_hardener: cap > 0.15 && ship.cloak.state === "off" });
    // 0.34: the supported ally is re-picked every tick; an escort whose ally is lost picks the subject again
    if (pol.support === "auto") { var wa = BS.Fleet.ally(ship, "weakestAlly"); if (wa) ship.support = wa; }
    if (ship.escortSubject && (!ship.escorting || ship.escorting.flags.destroyed)) { var ne = BS.Fleet.ally(ship, ship.escortSubject); if (ne) BS.EnemyAI.escort(ship, ne); else { ship.escortSubject = null; BS.EnemyAI.setDoctrine(ship, target, BS.Data.helm.defaultDoctrine); } }   // the last ally gone: back to the default doctrine (0.42: this called the stance setter removed in 0.37 and froze the fight)
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
    if (ship.scanning > 0) { ship.scanning -= dt; if (ship.scanning <= 0) { ship.scanning = 0; var scOf = ship.scanTarget || (ship.script ? ship.script.target : null); ship.scannedOf = ship.scannedOf || {}; if (scOf) ship.scannedOf[scOf.id] = true; var cur = ship.script ? ship.script.target : scOf; ship.scanned = !!(cur && ship.scannedOf[cur.id]); BS.Events.emit("scanned", { ship: ship, target: scOf }); } }
    var sc = ship.script;
    if (!sc || sc.suspended || ship.flags.destroyed || ship.flags.disabled) return;
    var target = sc.target;
    if (!target || target.flags.destroyed) return;
    // a rule's subject (0.32): the enemy its conditions are about; the current target unless `about` says otherwise
    function subj(r) { if (!r.about || r.about === "target") return target; return BS.Fleet.subject(ship, r.about) || target; }
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
      if (!conditions(ship, subj(r), r.when, sc.t)) continue;
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
    var held = sc.active >= 0 && rules[sc.active] && rules[sc.active].until && !conditions(ship, subj(rules[sc.active]), rules[sc.active].until, sc.t) && !(rules[sc.active].holdMax && sc.t - sc.activeSince > rules[sc.active].holdMax);
    var pick = -1, dflt = -1;
    for (i = 0; i < rules.length; i++) {
      r = rules[i];
      if (r.once || r.every) continue;
      var empty = !r.when || !Object.keys(r.when).length;
      if (empty) { if (dflt < 0) dflt = i; continue; }
      if (held && i >= sc.active) break;   // nothing below the held rule may take over
      if (conditions(ship, subj(r), r.when, sc.t)) { pick = i; break; }
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
    var x = sc.extremes || (sc.extremes = { dKmMin: Infinity, dKmMax: 0, weakestMin: 1, capMin: 1, hullMin: 1, ehullMin: 1, ever: {} });
    var dKm = S.contactKm(ship, target), st = ship.stats, est = target.stats;
    x.dKmMin = Math.min(x.dKmMin, dKm); x.dKmMax = Math.max(x.dKmMax, dKm);
    x.weakestMin = Math.min(x.weakestMin, S.shieldFrac(ship, S.weakestFacing(ship)));
    var cap = ship.capMax ? ship.capacitor / ship.capMax : 0; x.capMin = Math.min(x.capMin, cap); x.capMax = Math.max(x.capMax, cap);
    x.hullMin = Math.min(x.hullMin, ship.hull / ship.hullMax);
    x.ehullMin = Math.min(x.ehullMin, target.hull / target.hullMax);
    x.blindMax = Math.max(x.blindMax || 0, ship.ai ? ship.ai.blindTimer || 0 : 0);
    var al = BS.Fleet.fightingAllies(ship), hs = BS.Fleet.hostiles(ship).filter(BS.Fleet.fighting);
    x.allyWeakestMin = Math.min(x.allyWeakestMin === undefined ? 1 : x.allyWeakestMin, al.length ? Math.min.apply(null, al.map(function (a) { return S.shieldFrac(a, S.weakestFacing(a)); })) : 1);
    x.allyHullMin = Math.min(x.allyHullMin === undefined ? 1 : x.allyHullMin, al.length ? Math.min.apply(null, al.map(function (a) { return a.hull / a.hullMax; })) : 1);
    x.enemiesMin = Math.min(x.enemiesMin === undefined ? 99 : x.enemiesMin, hs.length);
    x.enemiesMax = Math.max(x.enemiesMax === undefined ? 0 : x.enemiesMax, hs.length);
    ["scanned", "cloaked", "noCloak", "noTubes", "enemyReactorsGone", "enemyShieldsDown", "enemyCloaked", "enemyAmmoBeatsOurShields", "ourAmmoBeaten", "remodulating", "allyUnderFire", "outnumbered", "unfocused", "lanceCharging", "allyLanced", "tractored", "allyTractored"].forEach(function (k) {
      if (!x.ever[k]) { var w = {}; w[k] = true; if (conditions(ship, target, w, sc.t)) x.ever[k] = sc.t; }
    });
    // per rule: whether all its conditions ever held together, and each condition on its own (for the report)
    sc.everKey = sc.everKey || {};
    (sc.def.rules || []).forEach(function (r, i) {
      if (!r.when) return;
      var ek = sc.everKey[i] || (sc.everKey[i] = {}), rt = r.about && r.about !== "target" ? (BS.Fleet.subject(ship, r.about) || target) : target;
      Object.keys(r.when).forEach(function (k) { if (!ek[k]) { var w1 = {}; w1[k] = r.when[k]; if (conditions(ship, rt, w1, sc.t)) ek[k] = sc.t; } });
      if (sc.everTrue[i]) return;
      if (Object.keys(r.when).length && conditions(ship, rt, r.when, sc.t)) { sc.everTrue[i] = true; sc.firstTrue[i] = { t: sc.t, above: sc.override ? "call" : sc.active }; }
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
            case "capBelow": if (!(x.capMin < v)) why = "our capacitor never fell under " + pct(v) + " (lowest " + pct(x.capMin) + ")"; break;
            case "hullBelow": if (!(x.hullMin < v)) why = "our hull never fell under " + pct(v) + " (lowest " + pct(x.hullMin) + ")"; break;
            case "time": if (!(sc.t > v)) why = "the battle lasted " + Math.round(sc.t) + " s, not " + v; break;
            case "enemyHullBelow": if (!(x.ehullMin < v)) why = "their hull never fell under " + pct(v) + " (lowest " + pct(x.ehullMin) + ")"; break;
            case "scanned": if (v && !x.ever.scanned) why = "we never scanned them"; break;
            case "blindFor": if (!(x.blindMax > v)) why = "our guns never lost them for " + v + " s (at most " + Math.round(x.blindMax || 0) + " s)"; break;
            case "allyShieldBelow": if (!(x.allyWeakestMin < v)) why = "no ally's weakest shield fell under " + pct(v) + " (lowest " + pct(x.allyWeakestMin === undefined ? 1 : x.allyWeakestMin) + ")"; break;
            case "allyHullBelow": if (!(x.allyHullMin < v)) why = "no ally's hull fell under " + pct(v) + " (lowest " + pct(x.allyHullMin === undefined ? 1 : x.allyHullMin) + ")"; break;
            case "enemiesAtMost": if (!(x.enemiesMin <= v)) why = "never " + v + " or fewer enemies left (at least " + (x.enemiesMin === undefined ? "?" : x.enemiesMin) + ")"; break;
            case "enemiesAtLeast": if (!(x.enemiesMax >= v)) why = "never " + v + " or more enemies (at most " + (x.enemiesMax === undefined ? "?" : x.enemiesMax) + ")"; break;
            case "notTargeting": if (!(sc.everKey && sc.everKey[i] && sc.everKey[i][k])) why = "we were always firing at " + subjectLabel(v); break;
            default:
              if (V[k] && V[k].kind === "flag" && v !== false && !(x.ever && x.ever[k])) why = "\"" + V[k].label + "\" never happened";
              else if (V[k] && V[k].kind === "type" && !(sc.everKey && sc.everKey[i] && sc.everKey[i][k])) why = V[k].kind === "type" ? "they never shot at our " + fmtValue("type", v) : "they were never " + fmtValue(V[k].kind, v);
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
    return String(v);
  }
  function subjectLabel(id) { return (D().subjects && D().subjects[id]) || String(id); }
  function allyLabel(id) { return (D().allySubjects && D().allySubjects[id]) || String(id); }
  function describeWhen(when, about) {
    var V = D().conditions, keys = Object.keys(when || {});
    if (!keys.length) return "otherwise";
    return (about && about !== "target" ? "about " + subjectLabel(about) + ", " : "") + "when " + keys.map(function (k) { var c = V[k]; if (!c) return k; if (c.kind === "bool" && !when[k] && c.negLabel) return c.negLabel; if (c.kind === "flag" && when[k] === false) return "not: " + c.label; return c.label.replace("{v}", c.kind === "subject" ? subjectLabel(when[k]) : fmtValue(c.kind, when[k])); }).join(" and ");
  }
  function describeDo(act) {
    var A = D().actions, parts = [];
    Object.keys(act || {}).forEach(function (k) {
      var a = A[k], v = act[k];
      if (!a) return;
      var text;
      if (k === "side") text = a.label.replace("{v}", BS.Data.helm.sides[v] ? BS.Data.helm.sides[v].label.toLowerCase() : v);
      else if (k === "doctrine") { var dd = BS.Data.enemyAI.doctrines[v]; text = a.label.replace("{v}", dd && dd.label ? dd.label : "the " + v + " doctrine"); }
      else if (k === "aim") text = a.label.replace("{v}", aimLabel(v));
      else if (k === "modules") text = Object.keys(v).map(function (id) { var m = BS.Data.modules[id]; return (id === "weapons" ? "weapons" : m ? m.name.toLowerCase() : id) + (v[id] ? " on" : " off"); }).join(", ");
      else if (k === "weapons") text = "weapons " + (v ? "on" : "off");
      else if (k === "repair") text = v ? a.label.replace("{v}", BS.Data.blocks[v] ? BS.Data.blocks[v].name.toLowerCase() + "s" : v) : "damage control on automatic";
      else if (k === "remodulate") text = a.label.replace("{v}", v === "ammo" ? "weapons to the ammo that beats their shields" : "shields to the frequency that beats their ammo");
      else if (k === "target") text = a.label.replace("{v}", subjectLabel(v));
      else if (k === "support" || k === "escort") text = a.label.replace("{v}", allyLabel(v));
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
    var s = (rule.call ? "" : describeWhen(rule.when, rule.about) + ": ") + describeDo(rule.do);
    if (rule.until) s += " — until " + describeWhen(rule.until, rule.about).replace(/^(about [^,]+, )?when /, "$1");
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

  return { start: start, stop: stop, update: update, bridgeCall: bridgeCall, callRule: callRule, explain: explain, conditions: conditions, apply: apply, describe: describe, describeScript: describeScript, describeWhen: describeWhen, describeDo: describeDo, subjectLabel: subjectLabel, allyLabel: allyLabel, resolve: resolve, focusType: focusType };
})();
