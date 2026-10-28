# Executed validation

## Root-folder cleanup — 2026-10-23

The visible repository root contains only `index.html`, `js/`, `story_version_control/` and `development/`. Styles and the vendored interpreter are under `js/`; documentation, licenses, packages, tools, tests and generated reports are under `development/`. The hidden Git/GitHub configuration remains at the root.

From the repository root, `npm --prefix development run verify:schema`, `npm --prefix development test` (**20 passed**), and `npm --prefix development run test:browser` (**13 passed**) all succeeded. The browser suite serves the repository under `/ToGOPleaSe/` and verifies local asset/worker loading, both story runtimes, downloads, history and responsive layout. CI paths were updated to the new development folder.

The rebuilt interpreter differs from the earlier bundle only in generated source-path comments/module labels. Rebuilding in the new location is byte-for-byte reproducible, SHA-256 `ecfbd9155e6b2012d995bf0ef8c29bd712b63946456fff07f4ff43f593945bea`. The upstream interpreter source and original Zork binary/source hashes still pass provenance checks. No live Pages deployment was performed.

## Version 2.1.0 — story history

- `npm test`: **20 passed**; `npm run test:browser`: **13 passed**.
- Desktop (1280px) and mobile (390px) checks confirm that the opening narrative and every confirmed action/response stay in order, Start does not duplicate the opening, the final response appears once, and a fresh session starts a fresh transcript.
- Keyboard scrollback, “Latest response”, and Bag round trips preserve history without adding decisions or changing CSV response fields. Zork and the JSON-only example both retain history through completion.
- Desktop and mobile history screenshots were visually inspected. The shared interface and story-folder structure remain unchanged.

## Version 2.0.0 — 2026-10-23

The reorganized multi-story task was checked locally on macOS with Node 23.11.0 and Playwright/Chrome. No remote deployment was performed.

- `npm run verify:schema`: 250 object identities and 28 uniquely identified attributes verified after moving the Zork files.
- `npm test`: **20 passed**, including original story/source hash preservation, 345 isolated Zork actions across 23 states, 800 sampled commands, JSON-story conditions/inventory/scoring, story-separated recovery and a check that browsing preserves the decision timer and game state.
- `npm run test:browser`: **11 passed** through the Pages-style `/ToGOPleaSe/` path. Covers categorized Zork gameplay, exact ten-row CSV, timing/locking, refresh recovery, corruption errors, root `index.html` serving, keyboard operation, story switching, JSON-story completion, and missing/invalid story errors.
- The Bag test observes worker messages and verifies that category/Bag visits send no game commands and add no CSV rows. It checks item contents after pickup, unchanged narrative on return, and original score increasing from 0 to 10 when entering the kitchen.
- The second-story test completes `lantern-cove` solely from JSON, reaches score 20, exports five decisions with the correct story identity, and returns to Zork's separate recovery record.
- Desktop (1280px) and mobile (390px) screenshots were inspected. Bag uses the left panel on desktop and the upper panel on mobile. No horizontal overflow was observed at the tested mobile size.

The native headed visibility suite was updated for category navigation but was not rerun for v2. The earlier results below are historical evidence, not a new execution of that suite. Chrome was tested; Safari/Firefox and a remote GitHub Pages deployment were not tested.

## Original v1 validation

Final run: 2026-10-21, macOS, Node 23.11.0, Python 3, installed Google Chrome driven by Playwright 1.64.1. This report records local executions, not an assumed CI or production deployment result.

| Check | Executed result |
| --- | --- |
| Story provenance | Z-machine v3, release 119, serial 880429, 86,838 bytes; embedded checksum BF44 matches computed checksum; SHA-256 matches pinned executable |
| Source preservation | Manifest hashes match original user files, archival source and vendored interpreter source; interpreter source also compared directly to the downloaded upstream tree |
| Schema | `npm run verify:schema` passes: 250 object identities, 28 uniquely mapped attributes; unused ambiguous flags explicitly omitted |
| Reproducible bundle | `npm run build:vendor` reproduces the identical browser bundle SHA-256 `e2d1e5125bf2651a11f374b85f11825747ca9acf096e35db094ec61420d11950` |
| Node tests | **15 passed, 0 failed** (`npm test`) |
| Browser tests | **7 passed, 0 failed** (`npm run test:browser`) |
| Native desktop visibility | **1 passed, 0 failed** (`npm run test:visibility`); separate headed Chrome profile, actual tab switch and window minimize/restore, complete ten-row CSV |
| Action fixtures | **368** isolated real-engine action executions across **23** representative states; no unknown-word/incomplete-command/clarification responses detected |
| Additional exploration | **80** fixed test-selection trajectories × **10** commands = **800** real commands; 14 rooms, 35 distinct commands, no parser clarification failures |
| Complete experiment | Ten real browser choices, exactly ten CSV rows, no remaining action controls; response 10 is displayed and recorded |
| Original mechanics | Mailbox/leaflet, close/open filtering, original reading text, inventory, placing in container, blocked door/grate, window entry, room navigation, kitchen sack, lamp, darkness, rug/trap-door discovery, cellar transition |
| Ending | Real third-death FINISH fixture: early export, no restart command; ordinary resurrection does not end the experiment |
| Timing | Controlled clock: 150 ms RT versus 40 ms processing; browser execution delayed by 250 ms while real VM still runs; locks/monotonic equations verified |
| Double activation | Concurrent choices blocked; mouse double-click produces one processed choice; keyboard Enter works |
| Visibility | Hidden-event path and native tab switch/minimize flag corresponding data; hidden presentation waits to activate; subsequent visible decision resets flag |
| CSV | Standard csv-parse verifies column order, ten rows, every displayed menu/label/text, original multiline quotes, commas, Unicode, 500-action JSON list, null optional score and partial-session export |
| Downloads/recovery | Automatic download received; manual re-download is byte-identical; JSON metadata downloads; refresh recovers partial CSV and starts a fresh game with a different ID |
| Failure handling | Corrupted story is rejected; header-only CSV plus initialization diagnostic JSON; injected interpreter error retains confirmed CSV rows and unconfirmed attempt separately |
| Hosting | Actual browser tests served at `/ToGOPleaSe/index.html`; repository-relative modules/worker/story load locally; no external runtime requests or page errors in gameplay test |
| Layout | 390 × 844 mobile viewport: no horizontal overflow, keyboard use passes; rendered full-page mailbox screenshot visually inspected |

## Scope of these results

Game integration tests execute the actual bundled story, not mocked narrative or manually defined room transitions. Controller fault tests deliberately inject failures, and the timing unit tests deliberately control clocks. The headless visibility test uses a test-only visibility override. A separate headed test switches actual Chrome tabs and minimizes/restores the window, without overriding `document.hidden` or dispatching synthetic visibility events. It checks that the first two CSV rows are flagged and the remaining eight are not. The early-end controller fixture starts from an advanced state reached by real commands and temporarily exposes a test-only jump option to reach FINISH; normal sessions always start at the original opening.

During the follow-up audit, the first native-test attempts failed to observe a hidden page because ordinary Playwright contexts enable focus emulation. Disabling it through an additional CDP session did not remove the existing session's override. The final test starts a separate temporary Chrome profile and connects with `noDefaults: true`; native visibility transitions then pass. No application behavior was changed to make this test pass. The native test requires a graphical desktop and is separate from headless CI.

The 80 exploration trajectories use a deterministic sampler **only in tests**, weighted toward navigation. Participant action order is never randomized. These sampled sessions are mostly outdoors; deeper house/dungeon states are separately covered by explicit fixtures. Neither sampling nor 23 fixtures proves exhaustive action-space or late-game puzzle coverage.

GitHub Pages has not been enabled or published by this task, and the GitHub Actions workflow has not run remotely. Browser compatibility was executed in Chrome only; Safari and Firefox are not claimed tested. Desktop focus loss and visibility events are not a substitute for calibrated physical presentation timing. No full-game walkthrough or full Z-machine conformance suite is claimed.

See `REQUIREMENTS_AUDIT.md` for the requirement-by-requirement evidence, `ACTION_POLICY.md` for omitted actions and scope filtering, and `MEASUREMENT.md` for RT interpretation, data semantics and recovery limits.
