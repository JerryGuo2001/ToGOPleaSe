# Exploration Task

A browser-based interactive-fiction task with a retro adventure menu, live score, and local CSV export. Zork I runs the original, unmodified **119 / 880429** story. You can also write a new story in JSON and use the same interface, inventory, scoring, timing and downloads.

## Run

```sh
npm --prefix development run serve
```

Open [http://localhost:8000/](http://localhost:8000/). The root now has only the four entries shown below; the usual hidden Git/GitHub configuration remains in place. No build or package install is needed to serve the bundled app. Alternatively use `python3 -m http.server 8000`. Use HTTP/HTTPS; module workers and Web Crypto do not support opening this app through `file://`.

## Folder structure

```text
index.html                         # GitHub Pages entry point
js/
  task.js                          # Shared interface, score, Bag and history
  data_save.js                     # CSV/JSON formatting and downloads
  config.js                        # Default story folder
  styles/task.css                  # Shared visual design
  vendor/ifvms/                    # Bundled interpreter and upstream licenses
  ...                              # Supporting JavaScript modules
story_version_control/
  zork/                            # All Zork text, sources, binary and adapters
  lantern-cove/story.json           # Editable example story
  README.md                        # Story authoring guide
development/
  README.md                        # This guide
  LICENSE                          # Project license
  THIRD_PARTY_NOTICES.md            # Attribution and third-party notices
  docs/                            # Measurement, action policy and validation
  tools/                           # Local server and Zork schema utilities
  tests/                           # Automated and browser tests
  package.json                     # Development commands and dependencies
  package-lock.json
  playwright.config.js
  playwright.visibility.config.js
  node_modules/                    # Local dependencies (ignored by Git)
  test-results/                    # Local test output (ignored by Git)
```

All Zork narrative and Zork-specific definitions live in `story_version_control/zork`. The original ZIL and binary were moved without editing their content. The binary remains the source of the text displayed during Zork gameplay; editing the archival ZIL does not change the compiled game. New text stories use editable JSON directly.

## Add or switch a story

1. Copy `story_version_control/lantern-cove` into `story_version_control/my-story`.
2. Edit its `story.json`: set `id` to `my-story`, then write your title, rooms, narrative, items and choices.
3. Open [http://localhost:8000/?story=my-story](http://localhost:8000/?story=my-story).

To make it the default for everyone, change `DEFAULT_STORY` in `js/config.js` to `my-story`. No changes to the HTML, UI, controller or export code are needed. Folder names use lowercase letters, numbers, hyphens or underscores. Try the bundled example at [http://localhost:8000/?story=lantern-cove](http://localhost:8000/?story=lantern-cove).

See the [story authoring guide](../story_version_control/README.md) for a minimal working story and supported choice rules. A new compiled interactive-fiction game needs its own runtime adapter; Zork's object mapping and parser policy are specific to the pinned Zork binary.

## How the task works

- **Move** opens available navigation choices.
- **Action** opens interactions with your surroundings: look, examine, take, open, wait, and other contextual actions.
- **Bag** displays carried items on the left (above the menu on mobile), with available item actions on the right. In Zork, reading, dropping and examining a held item are here.
- Opening categories, returning to the category menu, and checking Bag use **no decision and no game move**. They read the existing state without sending a command to the game.
- Selecting a gameplay action, including Look, using an item, or an unsuccessful attempt, counts as one decision. The session still ends after **10 decisions**, or earlier if the story ends.
- The top-right score comes from the story state. Zork's score is the original signed score global, with its original maximum of 350.

Keyboard users can Tab between controls and activate them with Enter/Space. Escape returns from a category. All choices lock while a command is processing. Start does not issue a command. The main story keeps a scrollable transcript of the opening narrative and every selected action with its response. Each new turn brings the newest entry into view; scroll up to revisit earlier turns or use “Latest response” to return. Opening Bag and returning preserves the transcript and its scroll position. The complete history remains available when the session ends.

## Timing and saved data

Data stays in the browser. There is no backend, analytics, or upload. Finishing downloads `<story-id>_<anonymous-id>.csv`; buttons let you download the CSV again and save session details as JSON. Interrupted sessions can be downloaded after reloading. Recovery is separated by story; earlier v1 Zork sessions can still be recovered.

The measurement starts when the category menu is enabled after two visible animation frames. Reaction time includes category browsing and Bag viewing; the timer is not reset by either. Category visits are saved as `ui_events` in session JSON without adding CSV decision rows. CSV includes `story_id`, `menu_category`, the complete available action list, original text, inventory, score, engine moves, timestamps, timing, visibility interruptions and reproducibility metadata. See [MEASUREMENT.md](docs/MEASUREMENT.md).

**The category UI changes the experimental procedure.** The category UI and Zork action-policy version are `2.0.0`; implementation `2.1.0` additionally exposes the running story history; v1 response times and decision counts that included Inventory should not be treated as the same task condition.

## GitHub Pages

Use the branch containing these files with **`/ (root)`** as the Pages source. GitHub Pages will serve `index.html` at [the repository root URL](https://jerryguo2001.github.io/ToGOPleaSe/). Keep `index.html`, `js/`, and `story_version_control/` together. Retain `development/LICENSE`, `development/THIRD_PARTY_NOTICES.md`, and the licenses bundled with the game and interpreter. All runtime assets are local and relative to the document/module, including the story worker. `.nojekyll` is included.

To test a repository subdirectory locally:

```sh
BASE_PATH=/ToGOPleaSe npm --prefix development run serve
```

Open [http://localhost:8000/ToGOPleaSe/](http://localhost:8000/ToGOPleaSe/). The tests exercise this path. The validation workflow does not publish or change remote Pages settings.

## Zork fidelity and action coverage

Zork's executable SHA-256 is `37084966477dff679282de42974b2077156b1bd68fad92a65d4ea94d8eb64d79`. The adapter checks it before execution. All story logic, scores, combat, narrative and movement remain in that binary. `state-reader.js` and `story-schema.js` read its objects and globals; `action-generator.js` supplies deterministic choices without probing or patching the interpreter. The fixed interpreter seed is 119880429, recorded with each session.

The menu is a bounded experimental action space, not every valid Zork command. It does not claim to support completing the entire adventure. Closed-container contents, concealed objects and undiscovered dark exits remain withheld by the policy. Bag lists accessible carried objects; it does not disclose sealed contents. See [ACTION_POLICY.md](docs/ACTION_POLICY.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Development

Use Node 22+ and Python 3. From the repository root:

```sh
cd development
npm ci
npm run verify:schema
npm test
npx playwright install chromium
npm run test:browser
```

Run the commands above from `development/`; from the root you can instead use `npm --prefix development run <command>`. Dependencies, test reports, and screenshots stay inside that folder. The local server always serves the repository root.

Browser tests use installed Chrome on macOS, or Playwright Chromium elsewhere. `CHROME_PATH` can override the executable. `npm run test:visibility` additionally checks real tab switching/window minimization with a graphical Chrome session. Use `npm run generate:schema` to regenerate Zork metadata and `npm run build:vendor` only when rebuilding the interpreter bundle.

Current validation and historical limitations are in [VALIDATION.md](docs/VALIDATION.md).
