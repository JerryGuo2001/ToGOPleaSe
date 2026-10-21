# Measurement and data format

## Decision lifecycle

Load → ready preview → Start → presenting → choosing → processing → presenting. After response 10: finalized. A genuine game FINISH/quit or infrastructure error finalizes early. Start and internal initialization are never commands. There are no background LOOK/INVENTORY probes.

A decision is an accepted action whose command returns a response at the next original input boundary (including parser-recognized unsuccessful actions). Every successful command delivery consumes one experimental decision even when Zork's own moves counter is unchanged. The worker and controller reject overlapping requests; the controller closes the worker at finalization. Mouse click events with `detail > 1` are ignored; keyboard activation is supported.

Normal Zork death may resurrect the player. The adapter stops only at actual VM quit or the verified r119 FINISH management prompt, not on a generic “you have died” string. The test fixture reaches this routine by three actual deaths with no state patching.

## Timing

Narrative/options are rendered with disabled buttons. Two `requestAnimationFrame` callbacks provide layout/render opportunities; when the document is visible, the controller samples both clocks and enables the buttons in the same task. Buttons cannot issue commands while waiting for that activation. The next actual paint is typically within one display frame, but JavaScript cannot observe the physical onset of a monitor pixel. Menus can require scrolling on small screens.

`timestamp_presented`, `timestamp_clicked`, `timestamp_response` are ISO UTC timestamps. The first statement in the click handler samples `performance.now()` and `new Date().toISOString()`. `rt_ms` is the difference between monotonic click and presentation samples; wall-clock jumps do not enter that subtraction. Values are not rounded or corrected.

`processing_ms` runs from click until the main thread receives the completed command response/state/menu from the worker. It includes controller/recovery-write overhead, message transport, interpretation, state inspection and action generation. It is **not** included in RT and is not a pure VM CPU benchmark. Post-response rendering and the next two-frame activation wait are outside both that row's RT and processing duration.

`visibility_interrupted=true` if a visibility-hidden event occurs during choosing or processing. The flag is deliberately conservative: an interruption after the click still flags the step. RT values remain unchanged. An initially hidden page does not activate a timer; it waits until visible. This does not detect distraction, all forms of window occlusion, or loss of attention.

Per specification, the first narrative and disabled menu are previewed before Start. RT1 is therefore postactivation choice latency after potential advance reading; it is not a first-exposure response time. Trial timing on different refresh rates/devices/assistive technologies is not claimed to be equivalent. Avoid interpreting sub-frame differences as precise physical stimulus timing.

## CSV schema

`js/data-export.js` defines the authoritative fixed column order, beginning with all 21 requested columns:

`participant_id`, `step`, `game_version`, `game_location_before`, `game_location_after`, `available_actions`, `selected_action_id`, `selected_action_label`, `command_sent`, `game_text_before`, `game_text_after`, `inventory_before`, `inventory_after`, `score_after`, `timestamp_presented`, `timestamp_clicked`, `timestamp_response`, `rt_ms`, `processing_ms`, `visibility_interrupted`, `session_status`.

Additional columns are `experiment_version`, `action_generator_version`, `story_sha256`, `interpreter_version`, `random_seed`, `termination_reason`, `location_id_before`, `location_id_after`, `moves_before`, `moves_after`, `performance_presented_ms`, `performance_clicked_ms`, `performance_response_ms`, `time_origin_ms`, `game_raw_text_after`, `command_outcome`.

- Each row is one confirmed processed command. Steps are contiguous from 1.
- `available_actions` is the full ordered array `{id,label,command,category}` used to create the buttons; it is not regenerated after the click.
- Inventory cells are arrays of accessible carried object `{id,symbol,name,parent}` entries. Sealed contents are not guessed. Room IDs disambiguate multiple rooms named Forest, Maze, etc.
- Score and move counters come directly from signed score/unsigned moves globals.
- `game_text_before` is exactly the textContent shown while choosing. `game_text_after` is exactly the command response shown next. Narrative whitespace and quotes are retained; only the terminal `>` input cursor is excluded. `game_raw_text_after` retains the complete main-window output. No command echo is injected. Status-window layout and UI headings are separate.
- Finalization updates every row's `session_status` to `completed` or `early_termination`. `termination_reason` is `decision_limit`, `story_finish`, `vm_quit`, `initialization_error`, `interpreter_error`, `page_exit`, or `page_reload`.
- CSV uses quoted fields, doubled quotes, CRLF record separators and UTF-8. Embedded newlines remain inside quoted fields. Arrays are JSON-encoded once. Missing optional values are empty strings. Booleans serialize as `true`/`false`.

The anonymous UUID comes from `crypto.randomUUID()`. No identifying inputs or analytics are collected. The application never uploads behavioral data.

## Failures and recovery

CSV automatically downloads as `zork_<participant_id>.csv`; Download CSV generates another link to the retained finalized Blob. Session JSON includes versions, seed, timestamps, initial original output, termination reason and any error or pending attempt.

An interpreter timeout/failure does not imply that the command completed. The pending click, menu, command, RT and pre-state are retained in JSON as an **unconfirmed** attempt and are not fabricated into a CSV decision row. This distinction also applies to page exit during processing. A failure before any confirmed command produces a header-only CSV; its reason is in JSON.

Recovery writes occur at Start, before a command and after its response, and at finalization. A per-tab marker identifies the unfinished session, and local storage retains sessions by UUID plus a latest-archive pointer. Page exit finalizes when the browser delivers `pagehide`; after a crash without that event, recovery marks the saved active session `page_reload`. The new page always creates a new UUID and fresh story. An active timer lost on page exit without a click does not produce a row.

Storage is best effort, with visible notification if unavailable. Browser eviction, private browsing, clearing site storage, quota exhaustion, or abrupt process termination can prevent recovery. Confirmed in-memory results can still be downloaded while the page is open. Local recovery is not a remote backup.
