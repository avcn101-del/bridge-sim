# HANDOFF — Bridge Sim as an MVP concept demo (0.1 → 0.48, closed 2026-10-20)

This file is for the next project, not for this one. It says what the MVP
proved, what it disproved, and which parts can be lifted into a new game of
a different style. Everything here is backed by `DESIGN.md` §8 (measured
balance) and §10 (decisions); where a claim is an opinion it says so.

## 1. What the MVP was

A single-player, plain-JS (`file://`, no build) fleet game: *WoW raids, in
Star Trek ships, in an arena*. The player is the admiral: build block-grid
hulls, write each bridge's when → do script, dry-run, undock, watch (two
bridge calls a battle). Runs of skirmishes lead to bosses with public
mechanics. 7.7k lines of JS in 17 files, 103 commits, 38 measured versions.

## 2. What worked (measured)

1. **Prepare-then-watch loop.** Build → script → dry run → undock → report
   is coherent and every step reads the one before. The script engine
   (`js/script.js`: ordered rules, `when` terms with subjects, `do` terms,
   policies, `until` / `holdMax` / `once` / `every`, callouts, the report's
   "never fired" explanations) carried everything from 0.21 to 0.48 without
   a redesign. Scripts per fight kind (boss / skirmish / alone) fixed the
   last structural gap (0.43–0.44).
2. **Block-grid hulls** (`js/grid.js`): mask + layout letters → blocks →
   derived stats; damage enters at the outermost block on the attacker's
   side, beams penetrate by cost, torpedoes splash, reactors chain, blocks
   cut from the bridge break away. Emergent tactics fell out of it for free
   (aim at reactors, attack from the aft, armour the nacelles), and every
   boss hull was data only.
3. **Measurement as the development loop.** `tools/harness.js` (seeded,
   deterministic, `--eval` for a data tweak, per-hull scripts and layouts),
   `tools/campaign.js` (a whole run), `tools/smoke.js` (zero console errors
   in four passes), plus the habit of a per-ship event trace injected with
   `--eval`. Every balance claim in `DESIGN.md` §8 is a harness row with an
   honest reading; several "obvious" ideas were refused by the numbers
   (§8 v0.45, v0.46, v0.47's eight steps). The harness also found three real
   bugs (a frozen fight from a removed function, a spawn-order bug, a hull
   that fell apart). **This is the most valuable thing to copy.**
4. **The streamline pass** (0.36–0.40): ranking every system against the
   loop in §1–§2 and cutting what no step read (learning, plays, boarding,
   crew manning, skills, heat, 20 micro-conditions). The game got smaller
   and clearer, and nothing measured moved.
5. **Role checks as a rule** (§10 "Role checks", 0.47): a boss is two or
   three hard checks (taunt, heal, dispel, DPS), each with a criterion
   "the fleet missing the role loses ≥ 3 of 4". The first one works: the
   warbird's shield-drain hold is won by a healer and lost without one,
   4 of 4 and 0 of 4 over four seeds.
6. **Economy that sees the difference**: repair bills (a lost hull pays
   30% of its block value), the hull-lost penalty scaled by the boss's
   reward, fleet encounters scaled back to farm fights. The role fleet ends
   a 12-battle run at 20k, the naive fleet at 0.

## 3. What did not work, and why (lessons)

1. **Damage-shaped checks never forced a role.** Five versions tried to
   make tank + healer *necessary* with more damage, a bigger hull, chip
   damage, escorts; every fleet with enough block hp won anyway and the role
   fleet was only cheaper. The check started working only when (a) the
   raced quantity was small (a shield facing, not a hull pool), (b) the
   race was between two rates (drain vs transfer), and (c) the penalty did
   not depend on hull size (a fixed burn wrapping round the hull). Design
   hard checks this way from the start.
2. **Healer design.** A transfer paid from the healer's own shields ran dry
   in thirty seconds; a repair projector at 7 hp/s was a rounding error;
   a healer that keeps shooting has no capacitor left to heal; a transfer
   onto "the weakest facing" missed the drained one. Healing needs a
   sustainable source (reactor recharge), a target rule tied to the check,
   and a script line that stops the healer from doing DPS.
3. **Soft roles are not roles.** Roles from blocks (beacon, transfer,
   repair on role cells) are the right *tooling*, but without hard checks
   the biggest hull is a tank by accident and the beacon is decoration. The
   taunt check is still unenforced; the dispel check was never built.
4. **Variance is large.** Same build, same script: 4:18 and 10:40 on two
   seeds. Hit rolls plus reactor chains make single fights noisy; four
   seeds was the minimum for any claim, and "prepared well → win" is
   weaker than the design wants.
5. **Multipliers compound in N v M.** 1v1 enemy profiles (stat ×1.4,
   damage ×1.5) made a 4v4 four times harder than intended until fleet
   encounters got their own scale. The 7k-hull Defiant dies first to any
   focusing pack; composition is a design question the MVP left open.
6. **Idea pile-up is the default failure.** The repo went from one idea
   to two games in one file by 0.35; the cure was writing the vision table
   first (§1), ranking systems against it, and later a rule table (§10
   "Role checks") that every idea must pass. Write the rule table before
   the mechanics.
7. **"Watch-only" fun is unverified.** The harness measures outcomes, not
   whether five minutes of watching with two button presses is engaging.
   No playtest data exists. This is the biggest unknown and should be the
   first thing a new project tests, with a human, before balance.
8. **Bugs the tests did not catch**: a code path reached only when every
   ally dies (a removed function) froze a fight; the smoke test never got
   there. Any path that only a loss reaches needs a forced test.

## 4. What to copy into a new project

Lift these as files or as patterns; each is self-contained enough.

| Asset | Where | How to lift |
|---|---|---|
| Headless balance harness | `tools/harness.js` (forced encounter, seeded `Math.random`, `--eval`, per-hull scripts/layouts, `--debug`, `--perf`) | Keep the shape: one `dryRun` per fight, the page steps itself (no rAF), a seeded RNG, an `--eval` hook for data tweaks and event traces, a one-line summary per run. Fail fast on page errors. |
| Whole-run harness | `tools/campaign.js` | The campaign picks encounters as the game would; settle credits between fights; one line per battle. |
| Smoke test | `tools/smoke.js` | Real buttons, desktop + phone + the heaviest fight, zero console errors or fail. |
| Script engine | `js/script.js` + `script.*` in `js/data.js` | Rules as data with labels for every term (the editor and the report are generated from the same table); subjects (`about`); `until`/`holdMax`; the "never fired" explanation from measured extremes. |
| Block-grid hull model | `js/grid.js` (+ `blocks`, `grid` in data) | Only if the new game wants block ships. The hit model (entry block, penetration cost, splash, chains, connectivity prune) is the part worth keeping. |
| Event bus and presentation split | `js/events.js`; renderer/effects/ui/crew subscribe | Logic emits, presentation subscribes; audio and sprites slot in later without touching logic. |
| Run structure | `js/campaign.js`: encounter kinds, boss slots, `bossesBeaten`, repair bills, reward-scaled penalties, dev mode | The pattern of a seeded `encounter()` that hangar and battle both read. |
| Document shape | `DESIGN.md` §1 (vision table), §2 (loop), §8 (measured rows + honest reading), §9 (data structures by version), §10 (decisions, rule tables, PR table); `CHANGELOG.md`; `CLAUDE.md` workflow rules | Start the new repo with these three files and the §10 rule table before any mechanic. |
| Working rules | `CLAUDE.md`: data-driven stats, one responsibility per file, docs in the same commit, smoke test before finishing, balance measured and recorded, no build tooling | Copy verbatim and edit the game-specific parts. |
| Process | one PR per version; a criterion stated before the measurement; "measured, not kept" rows; per-ship traces when a number surprises | — |

## 5. What not to copy

Heat and overload, boarding, crew manning, learning and counter tables,
the hand-flown bridge (all cut, all documented in §10 "Streamline");
transfer paid from the healer's own shields; the hollow-ring hull without
a frame; 1v1 enemy multipliers reused for fleets; a boss checked by
damage. The LCARS skin is specific to this theme.

## 6. Open questions the new project should answer first

1. Is watching with a few interventions fun, or does the player need a
   live hand? Playtest before balance.
2. Which hard checks exist in the new game's fiction (the four kinds, or
   others), and what is the small raced quantity for each?
3. What gives the healer agency (a visible rate race, a target decision, a
   cost) rather than a passive module?
4. How is variance bounded so preparation is rewarded (fewer rolls, more
   deterministic mechanics, or more seeds shown to the player)?
5. What ends a run (chapters, a boss ladder), and what are credits for
   after the fleet is bought?

## 7. Starting the new chat

Point it at this repository and this file, then give it the new game's
vision in the §1 table form (one row per pillar: what it is, where it
comes from, how it shows in play). Decide the check table before the
first mechanic. Set up the harness and the smoke test in the first
version, and record the first balance row before adding a second system.
