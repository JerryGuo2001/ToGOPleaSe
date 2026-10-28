# Requirements audit — 2026-10-21

This document records the original v1 implementation audit. Paths have been updated after the v2 reorganization. For the current category menu, free Bag policy, and reusable story format, see the development/README.md, MEASUREMENT.md and story_version_control/README.md.

The four implementation phases are complete and their executed gates are recorded in `PHASES.md`. The requested A–F acceptance scenarios have passing evidence, with the limits below. This is not a claim of exhaustive Zork action coverage, laboratory timing calibration, cross-browser certification, or a published GitHub Pages deployment.

## Acceptance tests

| Requested test | Executed evidence | Scope and limits |
| --- | --- | --- |
| A: initialization | `development/tests/engine.test.js`, `development/tests/browser/gameplay.spec.js`: exact r119/880429 story, opening narrative, initial menu, original input boundary | Chrome and bundled interpreter; no full Z-machine conformance suite |
| B: original mechanics | `development/tests/engine.test.js`, `development/tests/coverage.test.js`: mailbox open/close, hidden leaflet, taking/reading/placing, inventory, blocked door/grate, navigation, window, lamp, darkness, discovered trap door and cellar | 368 isolated choices in 23 reached states, plus 800 commands over 80 ten-choice trajectories; not every possible state/action |
| C: ten decisions | `development/tests/experiment.test.js`, `development/tests/browser/experiment.spec.js`, `development/tests/native-browser/visibility.spec.js`: exactly ten rows, tenth response retained, interaction disabled, original commands/output aligned | Automated participant sessions; no human-participant pilot study claimed |
| D: timing | Controlled monotonic clock, separate 250 ms worker delay, two-frame presentation gate, double activation lock; native Chrome tab switching and minimize/restore flags verified in downloaded CSV | Browser/software validation, no external display/input timing equipment; RT1 follows an initial preview, and activation has frame/input-dispatch uncertainty |
| E: CSV | `csv-parse` round-trip checks exact displayed menu IDs/labels and narrative, all columns, multiline text, commas, quotes, Unicode, long lists, missing values, partial termination, identical re-download | Actual normal downloads and manual fallback tested; no claim that every browser's blocked-download policy was exercised |
| F: hosting | Actual Chrome sessions at `/ToGOPleaSe/index.html` through local HTTP; worker, modules, story and bundle all local; no external runtime requests | Pages-equivalent subdirectory passed. Live GitHub Pages and remote Actions workflow have not been run |

## Specification implementation

| Requested component | Implementation/evidence | Qualification |
| --- | --- | --- |
| Inspect local project and preserve inputs | `development/docs/PHASES.md`, `story_version_control/zork/PROVENANCE.json`, provenance tests | Original incomplete development ZIL kept separate from matching r119 archive |
| Original executable and engine | Hash-checked `.z3`, unmodified ifvms.js source, Glk port, worker adapter | Only terminal input cursor removed from display; full raw output also retained |
| Persistent game state and accessible inspection | Original VM handles all transitions; read-only object tree/properties/flags/globals | 250 object identities mapped; four ambiguous unused attributes omitted |
| Dynamic structured actions | Pure versioned registry, stable IDs, labels, command and category; fixed ordering | Bounded action policy explicitly allowed by the specification; not an open-parser replacement with complete coverage |
| Hidden-information controls | INVISIBLE/closed-container filtering, original illumination, discovery gates, observation memory; initial/mailbox/grate/trap-door/darkness fixtures | Scenery matching is a conservative source-synonym heuristic. Arbitrary custom descriptions and all late-game discovery conditions are not exhaustively validated |
| Relevant action classes | Navigation, examine, take/drop, read, open/close, containment, light, food/drink, combat and selected context actions | Some source-reviewed late-game/context entries lack reached-state fixtures; omissions listed in `ACTION_POLICY.md` |
| Exactly ten processed choices | Controller's synchronous lock and decision limit; worker closes after tenth response | Game FINISH/error/page exit exports a partial session; unconfirmed error attempts are metadata, not invented CSV decisions |
| Start/presentation/RT/timestamps | Start is not a command; two-frame visibility gate; `performance.now()` and ISO timestamps; click captured before command work | Standard browser timing, not measured physical screen onset |
| CSV/session metadata | All requested columns plus implementation/policy/interpreter versions, story hash and seed | Missing optional values remain empty; arrays are JSON inside escaped CSV fields |
| Recovery and local-only export | Blob download/fallback, local storage archives, fresh ID and game after interruption | Storage availability is browser-dependent; no backend or remote persistence |
| Participant UI | `index.html`, text-only narrative, hyperlink-style keyboard-accessible buttons, progress, responsive CSS | Chrome desktop and 390 × 844 viewport checked; no Safari/Firefox or assistive-technology certification |
| Reproducibility | Fixed existing interpreter RNG seed; identical-command replay checks; pure action ordering | Determinism is scoped to this pinned interpreter/story/policy and observation history |
| Static packaging/licenses | Local runtime assets, relative URLs, `.nojekyll`, MIT notices, provenance | Repository changes are local; no commit, push, Pages configuration or publication performed |
| Documentation | README, provenance, phase gates, action policy, measurement, validation and this audit | Review action-space restrictions and RT1 preview semantics before collecting research data |

## Executed test totals

- `npm test`: 15 passed.
- `npm run test:browser`: 7 passed.
- `npm run test:visibility`: 1 passed.
- Schema verification, source/story integrity checks and reproducible interpreter bundle checks passed.

The first native visibility harness attempts failed because the ordinary Playwright context forces focus. The final passing native test uses a separate browser profile without that override. This correction and all remaining validation limits are recorded in `VALIDATION.md`.
