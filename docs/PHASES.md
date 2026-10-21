# Validation gates

## Phase 1 — repository inspection and architecture

Inspected every non-Git input file. Original download is retained in `zork/zork1-develop/` (three ZIL files, README, MIT license, gitignore). No executable, interpreter, build setup or tests were present. The local develop source declares RELEASEID 1 and requires absent `../zork-substrate/*` files; it cannot reproduce the requested binary as supplied. Its README says development started from r119, which is not evidence of byte equivalence.

Selected the exact archived `zork1-r119-s880429.z3`, Z-machine v3, 86,838 bytes, embedded checksum BF44 (verified against all bytes after header), SHA-256 `37084966477dff679282de42974b2077156b1bd68fad92a65d4ea94d8eb64d79`. Matching archival source in `game/source-r119/` is separate from the user's files. Source URL: https://eblong.com/infocom/sources/zork1-r119.zip . Story URL: https://eblong.com/infocom/gamefiles/zork1-r119-s880429.z3 . Retrieved 2026-10-20.

Selected MIT-licensed ifvms.js ZVM 1.1.6, commit `6ac63e6b61144d4353a168df16c4ad5c22526f88` (https://github.com/curiousdannii/ifvms.js). Vendored unmodified source; esbuild creates the browser bundle. Current Parchment is a larger Glk application; a direct ZVM/Glk adapter makes command boundaries and read-only memory inspection explicit. Runtime will be static, local assets only.

Gate executed: direct Glk initialization and `open mailbox`, `take leaflet`, `read leaflet` all run against the exact binary. Opening narrative and original responses observed; VM object 76 moves from mailbox 230 into adventurer 44. Initial location object 64 is West of House. Z-machine globals 0–2 provide location, score, moves. All 250 object identities were cross-matched with archival source using names, containment and exit relations; 28 attribute indices are uniquely identifiable. Four unused attributes cannot be distinguished by initial membership and are deliberately omitted.

Architecture: a worker owns the VM, accepts one command per request, captures the main Glk text stream up to the next input request, and returns read-only state. A deterministic registry filters commands using object attributes, accessible containment, visible scenery, room exit properties, and explicit hidden-exit gates. No command probes run in a participant VM. Original bytecode alone performs all transitions. Full parser/puzzle enumeration is infeasible; action coverage must be described as a bounded policy, not every possible command.

## Phase 2 — functional gameplay prototype

Passed `npm test`: 6 tests, including 369 isolated real-engine commands across 23 representative states. Verified original mailbox responses, leaflet containment/inventory, navigation, unsuccessful front-door and locked-grating interactions, kitchen-window opening/closing, sack contents, light/darkness, lamp activation, rug/trap-door discovery, actual cellar movement, menu determinism and absence of VM-memory changes during generation. Fixed-seed replay produces identical responses and states for tested routes. No mocked responses used for these integration tests.

Passed automated Chrome gameplay test through a local server at `/ToGOPleaSe/exp.html`: local worker and story load, menu is initially disabled, Start activates choices, clickable open/take/read sequence works, no text entry, no external requests or browser errors. Proceeded to measurement only after this gate passed.

## Phase 3 — experimental implementation

Passed 13 Node tests and 7 automated Chrome tests. A complete session executes exactly ten original game commands and exports ten CSV rows; every displayed label, ID and narrative matches the downloaded data. Standard `csv-parse` round-trips multiline quoted game text, commas, Unicode, a 500-option JSON list and missing values. Deterministic-clock tests isolate 150 ms RT from 40 ms processing; browser tests delay the actual worker by 250 ms, verify disabled controls and no extra double-click decisions. Visibility event-path and hidden-presentation tests pass. Refresh preserves interrupted data under the old ID and starts a fresh game with a different ID. Re-download returns identical CSV bytes. A real-story fixture reaches the third-death FINISH routine and exports one partial row; ordinary resurrection is not treated as game termination. Interpreter fault tests preserve confirmed rows and an explicitly unconfirmed attempt in session metadata.

## Phase 4 — integration and validation

Final checks are recorded in `VALIDATION.md`. During final review, removed an incomplete switch-turn command (original syntax requires an indirect object) and actor-taking affordances. The final action audit has 368 isolated executions in 23 fixtures. Replaced inferred illumination with verified read-only global LIT (slot 51, address 790), correlated with GO assignment at bytecode 20824, V-LAMP-ON use at 33862, and room-description tests at 38087, and exercised by dark/illuminated attic routes. No story data or transition code was modified.
