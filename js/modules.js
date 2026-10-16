// js/modules.js — fitted modules: passive bonuses, active cycling, capacitor use,
// weapon firing through BS.Weapons. EVE-style: a module that is "active" keeps
// cycling until switched off or the capacitor runs dry.
window.BS = window.BS || {};

BS.Modules = (function () {
  var U = BS.Util;

  // Build ship.modules from a fit { high: [ids], mid: [ids], low: [ids] } and
  // aggregate passive effects into ship.fitEffects.
  function fit(ship, fitDef) {
    ship.modules = [];
    ship.fitEffects = { turretDamageMult: 1, launcherDamageMult: 1, capRechargeMult: 1, hullAdd: 0, speedMult: 1 };
    ["high", "mid", "low"].forEach(function (slot) {
      (fitDef[slot] || []).forEach(function (id, i) {
        var def = BS.Data.modules[id];
        if (!def) { console.warn("Unknown module " + id); return; }
        var m = { id: id, def: def, slot: slot, index: i, active: false, running: false, cycleLeft: 0, cycleTime: 0, state: "off", mountIndex: i };
        ship.modules.push(m);
        if (def.kind === "passive" && def.effect) {
          var e = def.effect, fe = ship.fitEffects;
          if (e.turretDamageMult) fe.turretDamageMult *= e.turretDamageMult;
          if (e.launcherDamageMult) fe.launcherDamageMult *= e.launcherDamageMult;
          if (e.capRechargeMult) fe.capRechargeMult *= e.capRechargeMult;
          if (e.hullAdd) fe.hullAdd += e.hullAdd;
          if (e.speedMult) fe.speedMult *= e.speedMult;
        }
      });
    });
  }

  function cycleTime(ship, m) {
    var def = m.def, t = def.cycle;
    if (def.subsystem) t /= BS.Ships.subMult(ship, def.subsystem);
    if (def.kind === "turret" || def.kind === "launcher") t *= ship.mods.cycleMult;
    return t;
  }

  function isWeapon(m) { return m.def.kind === "turret" || m.def.kind === "launcher"; }

  // Try to start a cycle. Returns true if the cycle started.
  function tryStart(ship, m) {
    var def = m.def;
    if (ship.capacitor < def.cap) { m.state = "nocap"; return false; }
    if (isWeapon(m)) {
      if (!ship.flags.armed) { m.state = "notarmed"; return false; }
      var L = ship.lock;
      if (!L.locked || !L.target || L.target.flags.destroyed) { m.state = "nolock"; return false; }
      var dKm = BS.Ships.distanceKm(ship, L.target);
      var maxKm = def.kind === "turret" ? def.optimalKm + def.falloffKm * 2.5 : def.rangeKm;
      if (dKm > maxKm) { m.state = "range"; return false; }
      ship.capacitor -= def.cap;
      if (def.kind === "turret") BS.Weapons.fireTurret(ship, m, L.target); else BS.Weapons.fireLauncher(ship, m, L.target);
    } else {
      ship.capacitor -= def.cap;
      if (def.effect && def.effect.shieldBoost) {
        var f = BS.Ships.weakestFacing(ship);
        var boost = def.effect.shieldBoost * BS.Ships.subMult(ship, "shields");
        ship.shields[f] = Math.min(ship.shieldMax, ship.shields[f] + boost);
        BS.Events.emit("shieldBoosted", { ship: ship, facing: f, amount: boost });
      }
    }
    m.running = true; m.cycleTime = cycleTime(ship, m); m.cycleLeft = m.cycleTime; m.state = "running";
    BS.Events.emit("moduleCycle", { ship: ship, module: m });
    return true;
  }

  function setActive(ship, m, on) {
    if (m.def.kind === "passive") return;
    if (on && isWeapon(m) && !ship.flags.armed && ship.isPlayer) {
      BS.Ships.setAlert(ship, "red");
      BS.Events.emit("alertChanged", { ship: ship, alert: "red", auto: true });
    }
    m.active = on;
    if (!on && !m.running) m.state = "off";
    BS.Events.emit("moduleToggled", { ship: ship, module: m, on: on });
  }
  function toggle(ship, m) { setActive(ship, m, !m.active); }

  function update(ship, dt) {
    var eff = { speedMult: 1, shieldResist: 0, lockMult: 1, trackingMult: 1 };
    for (var i = 0; i < ship.modules.length; i++) {
      var m = ship.modules[i];
      if (m.def.kind === "passive") continue;
      if (m.running) {
        m.cycleLeft -= dt;
        if (m.cycleLeft <= 0) {
          m.running = false;
          if (m.active) {
            if (!tryStart(ship, m) && m.state === "nocap") { m.active = false; BS.Events.emit("moduleOffline", { ship: ship, module: m, reason: "nocap" }); }
          } else m.state = "off";
        }
      } else if (m.active) {
        if (!tryStart(ship, m) && m.state === "nocap") { m.active = false; BS.Events.emit("moduleOffline", { ship: ship, module: m, reason: "nocap" }); }
      }
      // active effects apply while the module is running
      if (m.running && m.def.effect) {
        var e = m.def.effect;
        if (e.speedMult) eff.speedMult *= e.speedMult;
        if (e.shieldResist) eff.shieldResist = 1 - (1 - eff.shieldResist) * (1 - e.shieldResist);
        if (e.lockMult) eff.lockMult *= e.lockMult;
        if (e.trackingMult) eff.trackingMult *= e.trackingMult;
      }
    }
    ship.activeEffects = eff;
  }

  function byKind(ship, kind) { return ship.modules.filter(function (m) { return m.def.kind === kind; }); }
  function find(ship, id) { return ship.modules.filter(function (m) { return m.id === id; }); }

  return { fit: fit, update: update, setActive: setActive, toggle: toggle, cycleTime: cycleTime, byKind: byKind, find: find, isWeapon: isWeapon };
})();
