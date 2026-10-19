// js/modules.js — ship modules: weapon groups built from blocks, plus the
// built-in active systems (booster, hardener, afterburner). Active modules
// cycle and cost capacitor; weapon groups fire every ready block in arc.
window.BS = window.BS || {};

BS.Modules = (function () {
  var U = BS.Util;

  function isWeapon(m) { return m.def.kind === "turretGroup" || m.def.kind === "launcherGroup"; }

  function fit(ship) {
    ship.modules = [];
    var types = {};
    ship.grid.blocks.forEach(function (b) { if (!b.structural) types[b.type] = true; });
    Object.keys(BS.Data.modules).forEach(function (id) {
      var def = BS.Data.modules[id];
      if (def.block && !types[def.block]) return;      // no such weapon blocks on this ship
      if (!def.block && BS.Data.builtInModules.indexOf(id) < 0) return;
      ship.modules.push({ id: id, def: def, active: false, running: false, cycleLeft: 0, cycleTime: def.cycle || 0, state: "off", readiness: 1 });
    });
  }

  function weaponBlocks(ship, m) { return ship.grid.blocks.filter(function (b) { return b.alive && b.type === m.def.block; }); }

  function blockCanFire(ship, b, target) {
    // every weapon fires away from the ship centre: compare the target bearing with the block's outward direction,
    // and the ship's own hull must not be in the way
    var w = b.def.weapon, bearing = BS.Ships.bearingTo(ship, target);
    if (BS.Data.grid.lineOfFire && b.facing === null) return false;   // buried: nothing in the open
    if (Math.abs(U.normAngle(bearing - BS.Grid.weaponFacing(b))) > (w.arc / 2) * U.DEG) return false;
    return !BS.Data.grid.lineOfFire || BS.Grid.lineOfFireClear(ship.grid, b, bearing);
  }

  function updateWeaponGroup(ship, m, dt) {
    var blocks = weaponBlocks(ship, m);
    if (!blocks.length) { m.state = "none"; m.readiness = 0; return; }
    var L = ship.lock, target = L.locked && L.target && !L.target.flags.destroyed ? L.target : null;
    var ready = 0, fired = 0, reason = "ok";
    blocks.forEach(function (b) {
      var w = b.def.weapon;
      var cycle = w.cycle * ship.mods.cycleMult / ((ship.stats.powerFactor || 1) * (ship.stats.crew ? ship.stats.crew.manning : 1) * (b.powerMult || 1));   // brownout / short crew / out of reactor range: slower cycling
      if (b.cycleLeft > 0) b.cycleLeft -= dt;
      if (b.cycleLeft <= 0) ready++;
      if (!m.active || b.cycleLeft > 0) return;
      if (!ship.flags.armed || ship.flags.disabled) { reason = "notarmed"; return; }
      if (ship.overload > 0) { reason = "overload"; return; }
      if (ship.cloak.state !== "off") { reason = "cloaked"; return; }
      if (ship.scanning > 0 && w.kind === "turret") { reason = "scan"; return; }   // a science scan borrows the beam emitters
      if (ship.remod && ship.remod.kind === "ammo") { reason = "remodulate"; return; }   // weapons cold while their ammo is retuned
      if (ship.heat >= ship.stats.heatCap || (ship.aiProfile && ship.heat > ship.stats.heatCap * BS.Data.grid.heat.aiFireBelow)) { reason = "heat"; return; }
      if (ship.governorHold) { reason = "heat"; return; }
      if (!target) { reason = "nolock"; return; }
      var dKm = BS.Ships.distanceKm(ship, target);
      var maxKm = w.kind === "turret" ? w.optimalKm + w.falloffKm * 2.5 : w.rangeKm;
      if (dKm > maxKm) { reason = "range"; return; }
      if (!blockCanFire(ship, b, target)) { if (reason === "ok") reason = "arc"; return; }
      if (ship.capacitor < w.cap) { reason = "nocap"; return; }
      ship.capacitor -= w.cap;
      if (w.kind === "turret") BS.Weapons.fireTurretBlock(ship, b, target); else BS.Weapons.fireLauncherBlock(ship, b, target);
      b.cycleLeft = cycle; fired++;
      ship.heat += w.heat || 0;
      if (ship.heat > ship.stats.heatCap && ship.overload <= 0) { ship.overload = BS.Data.grid.heat.overloadTime; BS.Events.emit("overload", { ship: ship }); }
    });
    m.readiness = ready / blocks.length;
    m.running = m.active && fired > 0 || (m.active && ready < blocks.length);
    m.state = m.active ? (fired > 0 ? "running" : reason) : "off";
  }

  function tryStartActive(ship, m) {
    var def = m.def, target;
    // the neutraliser needs a lock inside ew.neut.rangeKm before it spends anything (it waits, like a weapon out of arc)
    if (def.effect && def.effect.neut) {
      target = ship.lock.locked && ship.lock.target && !ship.lock.target.flags.destroyed ? ship.lock.target : null;
      if (!target) { m.state = "nolock"; return false; }
      if (BS.Ships.distanceKm(ship, target) > BS.Data.ew.neut.rangeKm) { m.state = "range"; return false; }
      if (ship.overload > 0) { m.state = "overload"; return false; }
    }
    if (ship.capacitor < def.cap) { m.state = "nocap"; return false; }
    ship.capacitor -= def.cap;
    if (def.effect && def.effect.neut) {
      var amount = weaponBlocks(ship, m).length * BS.Data.ew.neut.perBlock, before = target.capacitor;
      target.capacitor = Math.max(0, target.capacitor - amount);
      target.neuted = BS.Data.ew.neut.drainMemory;   // the drained ship knows it (enemy AI opens the range)
      BS.Events.emit("neutralised", { ship: ship, target: target, amount: amount, drained: before - target.capacitor, dry: target.capacitor <= 0 });
    }
    if (def.effect && def.effect.decoy) BS.Weapons.launchDecoy(ship, weaponBlocks(ship, m).length);
    if (def.effect && def.effect.jam) {
      var target = ship.lock.target || ship.selected, strength = weaponBlocks(ship, m).length * BS.Data.ew.jamPerBlock;
      if (target && !target.flags.destroyed && strength > 0) {
        var chance = strength / (strength + Math.max(1, target.stats.sensors)), hit = Math.random() < chance;
        // a complete ECM field (every block inside ew.jamRadius of a jammer) breaks their lock; a partial one only hides the
        // blocks inside it, so their fire is forced onto the rest
        var jc = ship.stats.jamCover, partial = !jc || jc.frac < 1;
        if (hit && !partial) { target.jammed = BS.Data.ew.jamDuration; BS.Ships.clearLock(target, "jammed"); }
        else if (hit) { target.partialJam = BS.Data.ew.jamDuration; target.partialJamBy = ship; }
        BS.Events.emit("jammed", { ship: ship, target: target, hit: hit, chance: chance, partial: partial, exposed: jc ? jc.exposed : 0 });
      }
    }
    if (def.effect && def.effect.shieldBoost) {
      var f = BS.Ships.weakestFacing(ship);
      ship.shields[f] = Math.min(ship.shieldMax[f], ship.shields[f] + def.effect.shieldBoost);
      BS.Events.emit("shieldBoosted", { ship: ship, facing: f, amount: def.effect.shieldBoost });
    }
    m.running = true; m.cycleTime = def.cycle; m.cycleLeft = def.cycle; m.state = "running";
    BS.Events.emit("moduleCycle", { ship: ship, module: m });
    return true;
  }

  function setActive(ship, m, on) {
    if (m.def.kind === "cloak") { m.active = on; BS.Ships.setCloak(ship, on); BS.Events.emit("moduleToggled", { ship: ship, module: m, on: on }); return; }
    if (on && isWeapon(m) && !ship.flags.armed && ship.isPlayer) {
      BS.Ships.setAlert(ship, "red");
      BS.Events.emit("alertChanged", { ship: ship, alert: "red", auto: true });
    }
    m.active = on;
    if (!on && !m.running) m.state = "off";
    BS.Events.emit("moduleToggled", { ship: ship, module: m, on: on });
  }
  function toggle(ship, m) { setActive(ship, m, !m.active); }

  // Torpedo tubes get first call on the capacitor: a volley is cheap per second and otherwise phasers starve it.
  function updateOrder(ship) {
    return ship.modules.slice().sort(function (a, b) { return (a.def.kind === "launcherGroup" ? 0 : 1) - (b.def.kind === "launcherGroup" ? 0 : 1); });
  }
  function update(ship, dt) {
    var eff = { speedMult: 1, shieldResist: 0, lockMult: 1, trackingMult: 1 }, order = updateOrder(ship);
    // heat governor: hold fire above the high mark until the heat falls below the low mark (hysteresis)
    var H = BS.Data.grid.heat, hf = ship.stats.heatCap > 0 ? ship.heat / ship.stats.heatCap : 0;
    if (ship.heatGovernor && !ship.aiProfile) {
      if (!ship.governorHold && hf > H.governorHigh) { ship.governorHold = true; BS.Events.emit("governorHold", { ship: ship, holding: true }); }
      else if (ship.governorHold && hf < H.governorLow) { ship.governorHold = false; BS.Events.emit("governorHold", { ship: ship, holding: false }); }
    } else ship.governorHold = false;
    for (var i = 0; i < order.length; i++) {
      var m = order[i];
      if (isWeapon(m)) { updateWeaponGroup(ship, m, dt); continue; }
      if (m.def.kind === "cloak") {
        var cs = ship.cloak.state;
        if (!weaponBlocks(ship, m).length) { if (cs !== "off") BS.Ships.setCloak(ship, false); m.active = false; m.state = "none"; continue; }
        if (cs === "off" && m.active) m.active = false;   // dropped for lack of capacitor
        m.running = cs !== "off"; m.cycleTime = 1; m.cycleLeft = 0;
        m.state = cs === "off" ? (ship.cloak.surge > 0 ? "surge" : !BS.Ships.cloakFieldComplete(ship) ? "field" : "off") : cs;
        continue;
      }
      if (ship.overload > 0) { m.state = m.active ? "overload" : "off"; continue; }   // overloaded: nothing cycles or starts
      if (m.running) {
        m.cycleLeft -= dt;
        if (m.cycleLeft <= 0) {
          m.running = false;
          if (m.active) { if (!tryStartActive(ship, m) && m.state === "nocap") { m.active = false; BS.Events.emit("moduleOffline", { ship: ship, module: m, reason: "nocap" }); } }
          else m.state = "off";
        }
      } else if (m.active) {
        if (!tryStartActive(ship, m) && m.state === "nocap") { m.active = false; BS.Events.emit("moduleOffline", { ship: ship, module: m, reason: "nocap" }); }
      }
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

  function find(ship, id) { return ship.modules.filter(function (m) { return m.id === id; }); }
  function weapons(ship) { return ship.modules.filter(isWeapon); }

  // Heat of the next full salvo: every ready weapon that is active and could fire
  function pendingSalvoHeat(ship) {
    var total = 0;
    ship.modules.forEach(function (m) { if (!isWeapon(m) || !m.active) return; weaponBlocks(ship, m).forEach(function (b) { if (b.cycleLeft <= 0 && b.facing !== null) total += b.def.weapon.heat || 0; }); });
    return total;
  }
  return { fit: fit, update: update, setActive: setActive, pendingSalvoHeat: pendingSalvoHeat, toggle: toggle, find: find, weapons: weapons, isWeapon: isWeapon, weaponBlocks: weaponBlocks, blockCanFire: blockCanFire };
})();
