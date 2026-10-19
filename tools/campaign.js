// tools/campaign.js — a whole run, headless (DESIGN §8): the campaign picks each encounter as the game would (runs, boss
// slots, fleet encounters by roster size), every battle is a BS.Game.dryRun, and BS.Campaign.settleBattle books the
// credits, salvage and repair bills between fights. Prints one line per battle and a summary. Plain Node + Playwright:
//   NODE_PATH=/opt/node-tools/node_modules node tools/campaign.js --battles 12 --fleet miranda,defiant,excelsior --scripts miranda:wolfpack,defiant:wolfpack,excelsior:wolfpack --script wolfpack
// Options (as tools/harness.js where they share a name):
//   --battles <n>       fights to play (default 12); a loss is not retried (the run moves on, as "Let it go")
//   --seed <n>          Math.random seed for the whole run (default 1)
//   --ship <classId>    the flagship (default constitution); --fleet a,b,c the rest of the roster (bought for free)
//   --layouts a:preset,b:preset   a preset per class; --scripts a:id,b:id a template per class; --script <id> the flagship's
//   --credits <n>       starting credits (default campaign.startingCredits)
//   --max <s>           stalemate after this many simulated seconds (default 600)
//   --eval "<js>"       run this in the page before the run (a data tweak, as tools/harness.js)
var path = require("path"), pw = require("playwright");
var args = {}; process.argv.slice(2).forEach(function (a, i, all) { if (a.indexOf("--") === 0) { var v = all[i + 1]; args[a.slice(2)] = v === undefined || v.indexOf("--") === 0 ? true : v; } });
var opts = { battles: parseInt(args.battles || "12", 10), seed: parseInt(args.seed || "1", 10), ship: args.ship || "constitution", fleet: args.fleet ? String(args.fleet).split(",") : null,
  layouts: args.layouts || null, scripts: args.scripts || null, script: args.script || null, credits: args.credits ? parseInt(args.credits, 10) : null, max: parseInt(args.max || "600", 10), eval: args.eval || null };
function fmt(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ":" + (s < 10 ? "0" : "") + s; }

(async function () {
  var browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  var page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
  page.on("pageerror", function (e) { errors.push(String(e)); console.log("PAGE ERROR (the fight will not end): " + String(e)); process.exitCode = 1; setTimeout(function () { process.exit(1); }, 200); });
  page.on("console", function (m) { if (m.type() === "error" && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto("file://" + path.resolve(__dirname, "..", "index.html"));
  await page.waitForFunction(function () { return window.BS && BS.Game && BS.Campaign; });
  await page.evaluate(function () { window.requestAnimationFrame = function () {}; });
  await page.evaluate(function (o) {
    var a = o.seed >>> 0; Math.random = function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    var save = BS.Campaign.reset();
    save.shipClass = o.ship; if (save.ownedShips.indexOf(o.ship) < 0) save.ownedShips.push(o.ship);
    if (o.fleet) { o.fleet.forEach(function (id) { if (!BS.Data.shipClasses[id]) throw new Error("no class " + id); if (save.ownedShips.indexOf(id) < 0) save.ownedShips.push(id); }); save.fleet = o.fleet.slice(); }
    if (o.layouts) String(o.layouts).split(",").forEach(function (kv) { var p = kv.split(":"), c = BS.Data.shipClasses[p[0]]; if (!c || !c.presets || !c.presets[p[1]]) throw new Error("no preset " + kv); save.layouts[p[0]] = c.presets[p[1]].rows.slice(); });
    if (o.scripts) String(o.scripts).split(",").forEach(function (kv) { var p = kv.split(":"); save.scriptByBuild[p[0]] = p[1]; });
    if (o.script) save.scriptByBuild[o.ship] = o.script;
    if (o.credits !== null) save.credits = o.credits;
    BS.Data.script.dryRun.maxSeconds = o.max;
    if (o.eval) (new Function(o.eval))();   // 0.42: a data tweak before the run, as the fight harness's --eval
  }, opts);
  var rows = [];
  for (var i = 0; i < opts.battles; i++) {
    var r = await page.evaluate(function () {
      return new Promise(function (resolve) {
        var save = BS.Campaign.get(), enc = BS.Campaign.encounter(), before = save.credits;
        var label = enc.label + (enc.kind === "boss" ? " (BOSS)" : enc.kind === "fleet" ? " (fleet)" : "");
        BS.Game.dryRun(BS.Campaign.scriptFor(save.shipClass), null, function (out) {
          var st = BS.Game.state, rw = BS.Campaign.settleBattle(st);
          resolve({ id: enc.id, kind: enc.kind, label: label, roster: enc.roster.length, result: out.result, how: out.how, time: out.time, hullPct: out.hullPct,
            lost: (out.ships || []).filter(function (s) { return s.destroyed; }).length, earned: rw.earned, salvage: rw.salvage, repairs: rw.repairs, credits: save.credits, before: before,
            won: save.campaign.battlesWon, lostCount: save.campaign.battlesLost, nextBoss: enc.nextBoss });
        });
      });
    });
    rows.push(r);
    console.log("battle " + (i + 1) + ": " + r.label + " · " + r.roster + " hull" + (r.roster === 1 ? "" : "s") + " · " + (r.result === "victory" ? "WIN" : r.result === "defeat" ? "LOSS" : "STALEMATE") + " " + fmt(r.time) + " keeping " + r.hullPct + "%" + (r.lost ? " · " + r.lost + " hull" + (r.lost === 1 ? "" : "s") + " lost" : "") + " · +" + r.earned + (r.salvage ? " +" + r.salvage + " salvage" : "") + (r.repairs ? " −" + r.repairs + " repairs" : "") + " → " + r.credits + " cr" + (r.nextBoss !== null && r.nextBoss !== undefined ? " · boss in " + r.nextBoss : ""));
  }
  var wins = rows.filter(function (r) { return r.result === "victory"; }), bosses = rows.filter(function (r) { return r.kind === "boss"; }), fleets = rows.filter(function (r) { return r.kind === "fleet"; });
  console.log("\n" + opts.ship + (opts.fleet ? " +" + opts.fleet.join("+") : "") + " · " + opts.battles + " battles, seed " + opts.seed + ": " + wins.length + " won, " + (rows.length - wins.length) + " not; bosses " + bosses.filter(function (r) { return r.result === "victory"; }).length + " of " + bosses.length + ", fleet fights " + fleets.filter(function (r) { return r.result === "victory"; }).length + " of " + fleets.length
    + "; credits " + rows[0].before + " → " + rows[rows.length - 1].credits + " (earned " + rows.reduce(function (a, r) { return a + r.earned + (r.salvage || 0); }, 0) + ", repairs " + rows.reduce(function (a, r) { return a + (r.repairs || 0); }, 0) + "); hulls lost " + rows.reduce(function (a, r) { return a + r.lost; }, 0) + "; longest fight " + fmt(Math.max.apply(null, rows.map(function (r) { return r.time; }))));
  if (errors.length) { console.log("PAGE ERRORS:\n" + errors.join("\n")); process.exitCode = 1; }
  await browser.close();
})();
