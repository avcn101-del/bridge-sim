// tools/harness.js — accelerated balance runs (DESIGN.md §8). Plain Node + Playwright, no package.json:
//   NODE_PATH=/opt/node-tools/node_modules node tools/harness.js --enemy raider --wins 0 --script brawler --runs 4
// Options:
//   --enemy <id>        encounter id from campaign.encounters (raider, gunboat, torpedo, variant, jammer, shadow, leech,
//                       cruiser, siege, warlord); forced by replacing campaign.encounters
//   --wins <n>          battles won (enemy strength and scan / weak-point rules follow it)
//   --ship <classId>    player hull (default constitution); --preset <name> one of its presets (e.g. shadowhunter)
//   --script <id|file>  a template id, or a JSON file with an inline script { name, policies, rules }
//   --side <side>       add "keep to their <side>" to every rule that sets a stance (blind, aft, port, starboard)
//   --noreact           the enemy flies the 0.24 script (scan, blind roll, doctrine): no reaction rules
//   --runs <n>          how many fights (default 4); --max <s> stalemate after this many simulated seconds (600)
//   --seed <n>          first seed (Math.random is seeded per run: seed + run index), so runs repeat
//   --eval "<js>"       run this in the page before each fight (try a data tweak: "BS.Data.enemyAI.doctrines.watch.holdKm = 8")
//   --debug             print the enemy's measured extremes (their heat peak, our blind time) after each run
//   --signature a,b     pretend the last wins carried these style tags (campaign.learn): the enemy may answer them
//   --learn             force the learning roll (campaign.learn.chance = 1) so the signature counter is always taken
//   --variant <layout> --doctrine <id> --escript <id>   force the enemy's layout (a class variant or "default"), doctrine
//                       and script regardless of the encounter (the matrix runs of DESIGN §8)
// Each run is BS.Game.dryRun: the battle set up exactly as Undock would, stepped at 1/60 s with no interface.
var fs = require("fs"), path = require("path");
var pw = require("playwright");

var args = {}; process.argv.slice(2).forEach(function (a, i, all) { if (a.indexOf("--") === 0) { var v = all[i + 1]; args[a.slice(2)] = v === undefined || v.indexOf("--") === 0 ? true : v; } });
var opts = {
  enemy: args.enemy || "raider", wins: parseInt(args.wins || "0", 10), ship: args.ship || "constitution", preset: args.preset || null,
  script: args.script || "brawler", side: args.side || null, noreact: !!args.noreact, runs: parseInt(args.runs || "4", 10),
  max: parseInt(args.max || "600", 10), seed: parseInt(args.seed || "1", 10), eval: args.eval || null, debug: !!args.debug,
  signature: args.signature ? String(args.signature).split(",") : null, learn: !!args.learn,
  variant: args.variant || null, doctrine: args.doctrine || null, escript: args.escript || null,
};
if (fs.existsSync(opts.script)) opts.script = JSON.parse(fs.readFileSync(opts.script, "utf8"));

function fmt(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ":" + (s < 10 ? "0" : "") + s; }

(async function () {
  var browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  var page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  var errors = [];
  page.on("pageerror", function (e) { errors.push(String(e)); });
  page.on("console", function (m) { if (m.type() === "error" && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto("file://" + path.resolve(__dirname, "..", "index.html"));
  await page.waitForFunction(function () { return window.BS && BS.Game && BS.Campaign; });
  var results = [];
  for (var i = 0; i < opts.runs; i++) {
    var o = Object.assign({}, opts, { runSeed: opts.seed + i });
    var out = await page.evaluate(function (o) {
      return new Promise(function (resolve) {
        // seeded Math.random so a run can be repeated (mulberry32)
        var a = o.runSeed >>> 0; Math.random = function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
        var save = BS.Campaign.reset();
        save.shipClass = o.ship; if (save.ownedShips.indexOf(o.ship) < 0) save.ownedShips.push(o.ship);
        save.campaign.battlesWon = o.wins;
        var cls = BS.Data.shipClasses[o.ship];
        if (o.preset) { if (!cls.presets || !cls.presets[o.preset]) throw new Error("no preset " + o.preset); save.layouts[o.ship] = cls.presets[o.preset].rows.slice(); }
        var enc = BS.Data.campaign.encounters.filter(function (e) { return e.id === o.enemy; })[0];
        if (!enc) throw new Error("no encounter " + o.enemy);
        enc = Object.assign({}, enc, { minWins: 0, weight: 1 });
        if (o.variant) { enc.layout = o.variant; enc.counter = false; }
        if (o.doctrine) enc.doctrine = o.doctrine;
        if (o.escript) enc.script = o.escript;
        if (o.noreact) {
          // the 0.24 enemy bridge: a scan rule where the encounter had one, the blind-sector roll that enemyai.js used to
          // hard-code (blindTolerance 3 / 2.5), then the doctrine
          var old = BS.Data.script.enemyScripts[enc.script] || BS.Data.script.enemyScripts.doctrine, ktinga = enc.enemyClass === "ktinga";
          BS.Data.script.enemyScripts.noreact = { name: "No reactions", rules: (old.rules || []).filter(function (r) { return r.do && r.do.scan; }).concat([
            { when: { blindFor: ktinga ? 2.5 : 3 }, do: { roll: true }, every: 8 },
            old.rules[old.rules.length - 1] ]) };
          enc.script = "noreact";
        }
        BS.Data.campaign.encounters = [enc];
        if (o.signature) { save.signatures = [0, 1, 2].map(function () { return { tags: o.signature.slice(), rangeKm: 0, side: "auto", aim: "hull", script: null, classId: o.ship, cost: 0, at: 0 }; }); }
        if (o.learn) BS.Data.campaign.learn.chance = 1;
        if (o.eval) (new Function(o.eval))();
        BS.Data.script.dryRun.maxSeconds = o.max;
        var script = typeof o.script === "string" ? JSON.parse(JSON.stringify(BS.Data.script.templates[o.script])) : o.script;
        if (!script) throw new Error("no script " + o.script);
        if (o.side) script.rules.forEach(function (r) { if (r.do && (r.do.stance || r.do.doctrine)) r.do.side = o.side; });
        var encInfo = BS.Campaign.encounter();
        BS.Game.dryRun(script, null, function (out) {
          var st = BS.Game.state, e = st.enemy;
          out.enemy = { name: e.name, doctrine: encInfo.doctrine, script: encInfo.script, counter: encInfo.counterReason || null, learned: encInfo.learned ? encInfo.learned.reason : null, variant: encInfo.variantName || "default", trace: (e.scriptTrace || []).map(function (en) { var r = e.script.def.rules[en.rule]; return { t: en.t, rule: en.rule, kind: en.kind, text: r && r.callout ? r.callout : en.text }; }) };
          out.calls = st.callsUsed;
          out.extremes = st.player.script.extremes; out.enemy.extremes = e.script.extremes; out.enemy.neverFired = BS.Script.explain(e);
          resolve(out);
        });
      });
    }, o);
    results.push(out);
    var fired = {}; out.enemy.trace.forEach(function (en) { if (en.rule !== null && en.rule !== undefined) fired[en.rule] = (fired[en.rule] || 0) + 1; });
    console.log("run " + (i + 1) + ": " + (out.result === "victory" ? "WIN" + (out.how ? " (" + out.how + ")" : "") : out.result === "defeat" ? "LOSS" : "STALEMATE") + " " + fmt(out.time) + " · our blocks " + out.hullPct + "% · their hull " + out.enemyHullPct + "%" + (out.scanned ? " · scanned" : "") + " · enemy rules fired: " + (Object.keys(fired).map(function (k) { return "r" + (parseInt(k, 10) + 1) + "×" + fired[k]; }).join(" ") || "none"));
    out.enemy.trace.filter(function (en) { return en.kind === "callout" || en.kind === "standing"; }).slice(0, 12).forEach(function (en) { console.log("    " + fmt(en.t) + " r" + (en.rule + 1) + " " + en.text); });
    if (opts.debug) { var px = out.extremes || {}; console.log("    we: heat peak " + Math.round((px.heatMax || 0) * 100) + "%, cap min " + Math.round((px.capMin || 0) * 100) + "%, weakest shield min " + Math.round((px.weakestMin || 0) * 100) + "%"); (out.neverFired || []).forEach(function (nf) { console.log("    our r" + (nf.rule + 1) + " never fired: " + nf.reason); }); var x = out.enemy.extremes || {}; console.log("    enemy sees: our heat peak " + Math.round((x.eheatMax || 0) * 100) + "%, closest " + (x.dKmMin || 0).toFixed(1) + " km, blind at most " + Math.round(x.blindMax || 0) + " s, our hull min " + Math.round((x.ehullMin || 0) * 100) + "%"); (out.enemy.neverFired || []).forEach(function (nf) { console.log("    never fired r" + (nf.rule + 1) + ": " + nf.reason); }); }
  }
  var wins = results.filter(function (r) { return r.result === "victory"; });
  var kept = wins.map(function (r) { return r.hullPct; }).sort(function (a, b) { return a - b; });
  var times = wins.map(function (r) { return r.time; }).sort(function (a, b) { return a - b; });
  console.log("\n" + opts.ship + (opts.preset ? " (" + opts.preset + ")" : "") + " · " + (typeof opts.script === "string" ? opts.script : opts.script.name) + (opts.side ? " side " + opts.side : "") + " vs " + opts.enemy + " (" + opts.wins + " wins" + (results[0] ? ", " + results[0].enemy.doctrine + ", script " + results[0].enemy.script + (results[0].enemy.counter ? ", counter: " + results[0].enemy.counter : "") + (results[0].enemy.learned ? ", learned " + results[0].enemy.variant + ": " + results[0].enemy.learned : "") : "") + "): "
    + wins.length + " of " + results.length + (wins.length ? " in " + fmt(times[0]) + "–" + fmt(times[times.length - 1]) + " keeping " + kept[0] + "–" + kept[kept.length - 1] + "%" : "")
    + (results.length - wins.length ? ", " + results.filter(function (r) { return r.result === "defeat"; }).length + " lost, " + results.filter(function (r) { return r.result !== "victory" && r.result !== "defeat"; }).length + " stalemate" : ""));
  if (errors.length) { console.log("PAGE ERRORS:\n" + errors.join("\n")); process.exitCode = 1; }
  await browser.close();
})().catch(function (e) { console.error(e); process.exit(1); });
