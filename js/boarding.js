// js/boarding.js — boarding parties (grid.boarding). With a lock, inside rangeKm and the target's shield facing toward
// us at zero (or not projected), the transporter sends the ship's spare crew across; those hands are gone for the rest
// of the battle (grid.crewAway, read by BS.Grid.derive, so manning drops). Aboard, the party fights the defenders by
// Lanchester's square law; captured ends the battle as a victory (salvage `captured`), repelled loses the party.
// Pure logic: it reads ships, updates ship.boarding and emits events (boardingStarted, boardingAborted, boardingFight,
// boardingEnded, shipCaptured). Only the player boards in this version; the enemy's crew defends.
window.BS = window.BS || {};

BS.Boarding = (function () {
  var S = BS.Ships;
  var D = function () { return BS.Data.grid.boarding; };

  // Crew beyond the posts, minus the party already away: who can be sent.
  function spareCrew(ship) {
    var cw = ship.stats.crew || { supply: 0, need: 0 };
    return Math.max(0, cw.supply - cw.need);
  }
  // Defenders: the bridge guard plus a squad per alive crew quarters (kill their crew decks first and fewer stand in the way).
  function defenders(target) {
    var B = D(), q = (target.stats.alive && target.stats.alive.quarters) || 0;
    return B.bridgeGuard + B.defenderPerQuarters * q;
  }
  // Is the shield between us and them down? The facing pool under `frac` of its maximum (gapStart to open the window,
  // gapAbort to keep a transport going), or shields not projected (cloak surge).
  function shieldGap(ship, target, frac) {
    if (!S.shieldsUp(target)) return true;
    var f = S.facingToward(target, ship.pos.x, ship.pos.y);
    return S.shieldFrac(target, f) <= (frac === undefined ? D().gapStart : frac);
  }
  // "ok" or the reason the transporter cannot send a party now.
  function canBoard(ship, target) {
    var B = D();
    if (ship.boarding) return "busy";
    if (!target || !ship.lock.locked || ship.lock.target !== target || target.flags.destroyed) return "nolock";
    if (S.distanceKm(ship, target) > B.rangeKm) return "range";
    if (!shieldGap(ship, target)) return "shields";
    if (spareCrew(ship) < B.minParty) return "crew";
    return "ok";
  }
  function start(ship, target) {
    var why = canBoard(ship, target);
    if (why !== "ok") return why;
    var B = D(), party = Math.min(B.partyMax, spareCrew(ship));
    ship.boarding = { target: target, phase: "transport", t: 0, party: party, partyMax: party, defenders: 0, defendersMax: 0 };
    // the party leaves the ship now: manning drops at once (derive reads grid.crewAway)
    ship.grid.crewAway = (ship.grid.crewAway || 0) + party; ship.grid.dirty = true;
    BS.Events.emit("boardingStarted", { ship: ship, target: target, party: party, time: B.transportTime });
    return "ok";
  }
  function bringHome(ship, bd) {
    ship.grid.crewAway = Math.max(0, (ship.grid.crewAway || 0) - bd.party); ship.grid.dirty = true;
  }
  function update(ship, dt) {
    var bd = ship.boarding;
    if (!bd || ship.flags.destroyed) return;
    var B = D(), target = bd.target;
    bd.t += dt;
    if (target.flags.destroyed) { ship.boarding = null; return; }   // the battle is over anyway
    if (bd.phase === "transport") {
      // the window must hold while the party beams: the shield facing stays open and they do not get clean away
      if (S.distanceKm(ship, target) > B.rangeKm * B.abortRangeMult || !shieldGap(ship, target, B.gapAbort)) {
        bringHome(ship, bd); ship.boarding = null;
        BS.Events.emit("boardingAborted", { ship: ship, target: target });
        return;
      }
      if (bd.t >= B.transportTime) {
        bd.phase = "fight"; bd.t = 0; bd.defenders = bd.defendersMax = defenders(target);
        BS.Events.emit("boardingFight", { ship: ship, target: target, party: bd.party, defenders: bd.defenders });
      }
      return;
    }
    // aboard: Lanchester's square law, each side loses rate × the other's numbers per second
    var p = bd.party, d = bd.defenders;
    bd.party = Math.max(0, p - B.rate * d * dt);
    bd.defenders = Math.max(0, d - B.rate * p * dt);
    if (bd.party < B.floor) {   // checked first: on even numbers the defenders hold their own decks
      ship.boarding = null;   // the party is lost: crewAway stays
      BS.Events.emit("boardingEnded", { ship: ship, target: target, result: "repelled", defenders: bd.defenders, time: bd.t });
    } else if (bd.defenders < B.floor) {
      ship.boarding = null;
      BS.Events.emit("boardingEnded", { ship: ship, target: target, result: "captured", party: bd.party, time: bd.t });
      BS.Events.emit("shipCaptured", { ship: target, by: ship });
    }
  }

  return { canBoard: canBoard, start: start, update: update, spareCrew: spareCrew, defenders: defenders, shieldGap: shieldGap };
})();
