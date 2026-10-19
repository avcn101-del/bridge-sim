// tools/smoke.js — the headless check CLAUDE.md asks for: open index.html, undock through the real interface, let the
// battle run for N simulated seconds at desktop size and at phone landscape (844×390, touch), and fail on any console
// error (a blocked Google Fonts request is not one).
//   NODE_PATH=/opt/node-tools/node_modules node tools/smoke.js [--seconds 40]
// A third pass (0.31) undocks a fleet of four against the "cube" boss encounter (0.33: the cube, its summoned escorts,
// its callouts and the charging beam) and runs the battle to its end (at most --fleet-seconds 420 simulated), so the
// panels, the viewer hand-over and the result screen are exercised with the biggest grids the game has.
var path = require("path"), pw = require("playwright");
var seconds = parseInt((process.argv.indexOf("--seconds") >= 0 ? process.argv[process.argv.indexOf("--seconds") + 1] : "40"), 10);
var fleetSeconds = parseInt((process.argv.indexOf("--fleet-seconds") >= 0 ? process.argv[process.argv.indexOf("--fleet-seconds") + 1] : "420"), 10);

async function play(browser, label, ctxOpts, fleet) {
  var ctx = await browser.newContext(ctxOpts), page = await ctx.newPage(), errors = [];
  page.on("pageerror", function (e) { errors.push(String(e)); });
  page.on("console", function (m) { if (m.type() === "error" && !/fonts\.g|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto("file://" + path.resolve(__dirname, "..", "index.html"));
  await page.waitForFunction(function () { return window.BS && BS.Game && BS.Campaign; });
  await page.evaluate(function () { BS.Campaign.reset(); });
  await page.reload(); await page.waitForFunction(function () { return window.BS && BS.Game; });
  if (fleet) {   // four hulls against the pack: the save owns them, the encounter pool holds only the pack
    await page.evaluate(function () { var sv = BS.Campaign.get(); ["miranda", "defiant", "excelsior"].forEach(function (id) { if (sv.ownedShips.indexOf(id) < 0) sv.ownedShips.push(id); }); BS.Campaign.setFleet(["miranda", "defiant", "excelsior"]); BS.Data.campaign.encounters = BS.Data.campaign.encounters.filter(function (e) { return e.id === "cube"; }).map(function (e) { return Object.assign({}, e, { minWins: 0 }); }); ["miranda", "defiant", "excelsior", "constitution"].forEach(function (id) { sv.scriptByBuild[id] = "cubebreaker"; }); });
    seconds = fleetSeconds;
  }
  // start screen → hangar → Undock, through the real buttons
  await page.locator("#btn-start").click();
  await page.locator("#btn-undock").click();
  await page.waitForFunction(function () { return BS.Game.state.phase === "battle"; });
  await page.evaluate(function () { BS.Game.setSpeed(4); });
  await page.waitForFunction(function (s) { return BS.Game.state.time >= s || BS.Game.state.phase !== "battle"; }, seconds, { timeout: 240000 });
  if (fleet) await page.waitForFunction(function () { return BS.Game.state.phase === "ended" || BS.Game.state.phase === "battle"; }, null, { timeout: 30000 });
  // bridge call through the interface: a button pressed twice
  var hasCalls = await page.evaluate(function () { return BS.Game.state.phase === "battle" && BS.Game.state.calls > 0; });
  if (hasCalls) {
    var tab = page.locator("#drawer-tabs [data-drawer='orders']"); if (await tab.isVisible()) await tab.click();   // phone: the BRIDGE drawer
    var btn = page.locator("#bridge-calls [data-call='reinforce']"); if (await btn.count()) { await btn.click(); await btn.click(); }
  }
  var st = await page.evaluate(function () { var s = BS.Game.state; return { phase: s.phase, time: s.time, result: s.result, calls: s.calls, log: document.body.innerText.length, ships: s.ships.length, viewer: s.player ? s.player.name : null, lost: s.ships.filter(function (x) { return x.flags.destroyed; }).length }; });
  await page.screenshot({ path: path.join(process.env.SMOKE_OUT || __dirname, "smoke-" + label + ".png") });
  await ctx.close();
  console.log(label + ": phase " + st.phase + " at " + Math.round(st.time) + " s" + (st.result ? " (" + st.result + ")" : "") + ", bridge calls left " + st.calls + (fleet ? ", " + st.ships + " ships, " + st.lost + " destroyed, viewer " + st.viewer : "") + ", console errors " + errors.length + (errors.length ? "\n  " + errors.join("\n  ") : ""));
  return errors.length;
}

(async function () {
  var browser = await pw.chromium.launch();
  var n = 0;
  n += await play(browser, "desktop", { viewport: { width: 1440, height: 900 } });
  n += await play(browser, "phone", { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  n += await play(browser, "fleet", { viewport: { width: 1440, height: 900 } }, true);
  await browser.close();
  if (n) { console.log("FAIL: " + n + " console error(s)"); process.exit(1); }
  console.log("OK: zero console errors");
})().catch(function (e) { console.error(e); process.exit(1); });
