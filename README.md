# Zork I — 10-decision behavioral experiment

Open **`exp.html` through an HTTP server**. It runs the original Zork I release **119 / 880429** in a browser worker, presents state-dependent clickable actions, and exports one CSV row for each of ten processed choices. Everything needed at runtime is bundled. There is no backend, runtime CDN, analytics, or typed command interface.

## Run locally

No build or package installation is needed to serve the included experiment:

```sh
python3 -m http.server 8000
```

Visit [http://localhost:8000/exp.html](http://localhost:8000/exp.html). Alternatively, with Node installed:

```sh
npm run serve
```

Use HTTP on localhost, or HTTPS on a deployed host. `file://` is not supported because the application uses module workers, fetch and Web Crypto.

## GitHub Pages

Commit/push the project files. In the repository's **Settings → Pages**, choose deployment from the branch containing these files, with **`/ (root)`** as the source. The entry point for this repository will be:

[https://jerryguo2001.github.io/ToGOPleaSe/exp.html](https://jerryguo2001.github.io/ToGOPleaSe/exp.html)

This URL is the intended deployment path, not a claim that deployment has already happened. No remote repository settings were changed. Keep `exp.html`, `assets/`, `js/`, `game/zork1-r119-s880429.z3`, and `vendor/ifvms/zvm.js` together, and retain the licenses and notices. All asset references are relative to the module or document, so repository subdirectories work. `.nojekyll` is included. The CI workflow validates code; it does not publish.

To exercise the Pages-style path locally:

```sh
BASE_PATH=/ToGOPleaSe npm run serve
```

Then visit [the subdirectory preview](http://localhost:8000/ToGOPleaSe/exp.html).

## Architecture

- **Original game:** the unmodified, hash-checked `game/zork1-r119-s880429.z3`. Its SHA-256 is `37084966477dff679282de42974b2077156b1bd68fad92a65d4ea94d8eb64d79`. Version, embedded checksum and provenance are recorded in `game/PROVENANCE.json`.
- **Interpreter:** MIT-licensed ifvms.js ZVM 1.1.6, pinned upstream source and browser bundle under `vendor/ifvms/`.
- **I/O:** `js/glk-port.js` receives original lower-window Glk text. `engine-core.js` supplies one line-input event and runs to the next input boundary. A command's response is its own output stream, not a scraped transcript. The terminal `>` input cursor is omitted from displayed narrative; the full stream, including that cursor, is also recorded as `game_raw_text_after`.
- **Isolation:** `engine-worker.js` owns the VM. `game-adapter.js` handles requests, validates choices against the current menu, and enforces a 15-second processing timeout. Initialization, execution, response, available state and game-over methods are provided.
- **State:** `state-reader.js` reads the object tree, attributes, properties, location/score/moves globals, and the pinned LIT global. `story-schema.js` maps all 250 object identities and 28 uniquely identified attributes to the matching archival source. It contains identity metadata, not room-transition logic.
- **Actions:** `action-generator.js` is a deterministic, pure registry over the returned state. The original bytecode remains solely responsible for movement, inventory, scores, puzzles, narrative, combat and randomness.
- **Experiment:** `experiment-controller.js`, `timing.js`, `data-export.js` and `session-store.js` implement decisions, timing, CSV and recovery separately from gameplay.

The original download contained only incomplete development ZIL sources; its declared release and missing substrate prevent treating it as a buildable copy of r119. Those files were preserved. The matching archival source is in a different directory. See [phase inspection and validation gates](docs/PHASES.md).

## Action policy and coverage

Policy version **1.0.0** supports navigation/blocked navigation, examining, taking/dropping, reading, open/close, looking into open containers, putting held items in/on accessible containers/surfaces, light controls, eating/drinking, entering/exiting vehicles, weapon-dependent combat, and selected source-defined interactions such as moving the rug/leaves, climbing the tree, entering the kitchen window, and ringing a bell.

Scope uses original containment, INVISIBLE/open/surface flags, local-global room properties, original illumination, and observation history for scenery. Contents of closed containers are withheld, even for transparent containers. Hidden trap-door, grating, and conditional exits are gated. Darkness exposes no new room objects or undiscovered exits; known reverse movement and carried objects remain usable. Ordering is fixed: direction order, then numeric story-object ID and verb order, then Look/Inventory/Wait.

**This is a bounded experimental action space, not an enumeration of every valid Zork command.** Generic parser machinery, free speech, arbitrary indirect-object combinations, magic words, some transport/tool puzzles, and many late-game special actions are not exposed. No completion of the entire Zork adventure is claimed. There is no runtime probing of candidate commands. See [the action policy and its limits](docs/ACTION_POLICY.md) before using it as a research instrument.

## Procedure, timing and data

Initialization loads a fresh game and displays its initial narrative and disabled menu. Start activates the experiment without issuing a game command or recording a decision. Each accepted selection sends exactly one command; a blocked/unsuccessful game interaction still counts. Looking and inventory also count regardless of Zork's internal moves counter. After the tenth response, the worker closes and all actions disappear. A genuine FINISH/quit exports a partial session. Ordinary in-game resurrection does not terminate the session.

`performance.now()` measures `rt_ms = clicked − presented`; ISO timestamps use `new Date().toISOString()`. Two animation frames precede menu activation; hidden documents wait until visible. Click time is sampled at the beginning of the handler, before disabling controls, saving recovery state, or contacting the worker. Processing time is separate. Visibility interruptions are retained as flags without adjusting RT. Buttons lock synchronously; repeated double-click events are ignored.

The CSV includes all requested columns, implementation/action-policy versions, seed, hash, original raw output, object IDs, internal move counts and monotonic clock samples. Lists are JSON within properly quoted CSV cells. Missing values are empty fields. The final status and termination reason are repeated on every row. Files are UTF-8 browser-generated Blobs, automatically downloaded with a manual re-download fallback. No files are written to the repository or a remote database.

Session details are also downloadable as JSON. If the engine fails, confirmed rows remain in the CSV; the unconfirmed attempted command and error are in JSON. A zero-decision failure produces a header-only CSV plus the diagnostic session JSON, not an invented decision.

Recovery data is stored in this browser's local storage under anonymous session IDs, with a per-tab active-session marker. The most recent archived session can be downloaded again. Refresh/exit marks an unfinished session interrupted; the next session gets a new ID and a new game. It never resumes with mismatched game and log state. Storage denial/quota failure is nonfatal, but then recovery after closing the page is unavailable. Clear this site's browser storage to remove retained local data.

See [measurement and CSV documentation](docs/MEASUREMENT.md).

## Reproducibility

Every initialization seeds the interpreter's existing Xorshift RNG with **−119880429** before the first story instruction. The recorded `random_seed` is its positive configuration value. No story bytes, flags, puzzles or event routines are patched. This fixes the random stream for identical command sequences in this pinned interpreter; it is not a claim of the same random sequence as every historical interpreter.

The complete replay inputs are the exact story hash, interpreter revision, implementation and policy versions, RNG seed, and ordered `command_sent` values. Observation memory is part of the action-policy state and is reconstructed from original outputs during replay. Increment implementation/policy versions when behavior changes, and retain the corresponding code revision for each study.

Timing limits matter: browser frames, input dispatch, OS scheduling, device differences and scrolling introduce uncertainty. The initial menu is previewed before Start as specified, so **RT1 measures latency after activation, not first exposure to the options**. The implementation does not claim laboratory-grade display timing or exhaustive action coverage.

## Development and tests

Use Node 22+ and Python 3:

```sh
npm ci
npm run verify:schema
npm test
npx playwright install chromium
npm run test:browser
```

On this Mac the browser tests use installed Google Chrome. Elsewhere they use Playwright Chromium; `CHROME_PATH` can override the executable. Linux CI installs browser system dependencies.

With a graphical desktop available, run `npm run test:visibility` for native Chrome tab switching and window minimization. This launches a separate temporary browser profile without Playwright's focus emulation, completes ten choices, and verifies interruption flags in the downloaded CSV. It is separate from the headless suite and CI.

Rebuild the included interpreter bundle only after changing its source/build tooling:

```sh
npm run build:vendor
```

Regenerate identity metadata from the bundled archival source and live story object table:

```sh
npm run generate:schema
```

The final executed results and limitations are in [VALIDATION.md](docs/VALIDATION.md), with a [requirements audit](docs/REQUIREMENTS_AUDIT.md). Tests include original game transitions, isolated action coverage, a ten-choice session, real game termination, fault handling, CSV parsing, rendered menu matching, timing, double clicks, simulated and native visibility handling, recovery and a Pages-style HTTP path.

Attribution and licenses: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
