# Action policy 3.0.0

## What the policy knows

The policy is pinned to story SHA-256 `37084966477dff679282de42974b2077156b1bd68fad92a65d4ea94d8eb64d79`, release 119/880429. Changing the executable causes initialization to fail. Object identity is cross-matched against all 250 archival source definitions using short names, containment and directed exit references, including duplicate room names. Twenty-eight attribute numbers are uniquely determined from source membership versus live initial attributes. FIGHTBIT, RMUNGBIT, STAGGERED and WEARBIT are not inferred or used because their initial memberships are ambiguous.

Z-machine globals 0, 1 and 2 are location, score and moves. LIT at global index 51 was verified against GO, V-LOOK and V-LAMP-ON compiled code and exercised through lit/dark attic transitions. It uses the game's illumination decisions, including light-source and ghost rules, rather than a JavaScript light simulation.

Visible objects start with objects directly in the room and carried by the adventurer. Recursion proceeds through surfaces and open containers, excluding INVISIBLE objects and NPC contents. Transparent but closed containers deliberately do not reveal their contents in the menu. This is conservative relative to the parser and avoids disclosure through inaccessible containment. Logged inventory uses accessible carried objects, including accessible nested items; sealed contents are omitted rather than inferred.

Local-global scenery must be in the room's original GLOBAL property and have been mentioned in that room's narrative. NDESCBIT objects likewise require a narrative mention or prior encounter in that room. Matching uses source synonyms/name tokens, with Zork's six-character dictionary stems. INVISIBLE is always checked, even for previously encountered objects. Songbird is withheld because its source handler explicitly says it cannot be seen. This is a conservative exposure heuristic, not a complete implementation of every custom DESCFCN routine.

Observation memory is part of the available-state representation. A pure generator called with the same state returns identical ordered options. Identical command sequences under the same seed reproduce that observation history. Reading state does not execute game commands; generating a menu does not mutate story memory or advance the RNG.

## Navigation

Direction properties are read from the actual current room. Single destinations and explicit blocked-direction descriptions yield directional attempts, without destination names. Normal compass alternatives in the source may be offered even when the prose does not list each compass direction; the menu therefore supplies navigation affordances compared with a typed interface.

Door-dependent exits require encounter with the door. Conditional exits with no failure description require their original condition global to be enabled. The Cyclops's secret eastern passage has an additional condition gate. Procedural exits are explicitly limited to the revealed trap door, revealed grating, encountered chimney, and source-defined maze down passages. No unresolved procedural exit is guessed.

In darkness, newly inspected exit properties are not advertised. Previously observed exits and the reverse of the immediately observed traversal can remain available if an actual corresponding exit property exists and its disclosure gate allows it. This may omit legal dark-room exploration but does not disclose an unseen layout.

## Commands

Each option contains a stable symbolic ID, participant label, single parser command and category. Noun phrases use the matched source's registered synonyms and adjectives; a few readability overrides are explicit in the registry. Commands do not contain separators or metacommands.

| Class | Applicability |
| --- | --- |
| Navigate | Exposed original exit property; fixed direction order |
| Examine | Scoped object with a registered noun |
| Take | TAKEBIT or TRYTAKEBIT, not carried, not an actor |
| Drop | Accessible carried object |
| Read | READBIT and original LIT true |
| Open/close | Container or door, not a surface; command determined by OPENBIT |
| Look inside | Open container |
| Put in/on | Held accessible object and open container/surface; no self/ancestor containment; liquids excluded |
| Light/extinguish | LIGHTBIT and ONBIT; actual game decides whether successful |
| Eat/drink | FOODBIT/DRINKBIT |
| Enter/exit vehicle | Visible VEHBIT object; actual player parent identifies being aboard |
| Attack | Scoped actor and an accessible carried WEAPONBIT object |
| Unlock grate | Grate is encountered and skeleton key is carried |
| Context interactions | Rug/leaves movement and looking under; tree climb; house walking/entry; window entry; match lighting; bell ringing; named button pushing; mirror touching; rope untying |
| General | Look and wait. Inventory viewing is the free Bag UI, not a game command. |

An anchored mailbox can still be taken as an attempt; the original response says it is anchored. A locked grating can still be opened as an attempt. Such failures are meaningful choices and count. The policy does not assert an action will succeed.

Ordering is directions (N, NE, E, SE, S, SW, W, NW, up, down, in, out, land), ascending original object ID, fixed verb order within each object, then Look/Wait. Duplicate commands are removed deterministically, keeping the first. No shuffling or adaptive recommendation is used. The worker then applies the priority cap described below, retaining source order among the selected options.

## Deliberate omissions and validation limits

This is not all of Zork's parser. It omits unrestricted conversation and NPC command syntax, magic words, arbitrary verb-object permutations, many indirect-object tools and puzzle combinations, some boat/river interactions, and numerous special late-game affordances. For example, the switch-turn command requires a tool; a bare incomplete command is not offered. The interface is not intended to guarantee a complete Zork solution.

Hidden information is filtered from participant options, not cryptographically protected: as with any static Zork deployment, a person inspecting the downloadable story or source could find spoilers. The participant UI does not expose those data.

The executed integration audit covers every presented action in 23 representative states (345 isolated executions in v2), plus explicit state-transition tests. It includes the starting surroundings, tree/nest, concealed grating, canyon view, house/window, kitchen containers, dark and illuminated attic, living room/trap door, and an armed troll encounter. Every audited command resolves without unknown-word or clarification output. This is a representative audit, not exhaustive enumeration of all trajectories or late-game states.

Some context entries are source-reviewed but not reached in that audit (for example bells, mirrors, dam buttons and vehicle boarding). Extending the policy requires actual-state fixtures and parser-response checks, a hidden-information review, and a policy version increment. Menu restriction itself changes participants' experience relative to typed Zork; the original mechanics remain in the VM, but inference about unrestricted Zork play is outside this instrument's validated scope.

## Presentation and nine-action cap (3.0.0)

`js/action-menu.js` limits the main grid to nine actions. Bag actions are excluded from this cap. The worker applies the filter before returning a result, validating the next command, or recording `available_actions`. The interface renders retained main choices first, then bag choices; each section keeps source order.

Priority is descending, with original source order breaking ties:

| Priority | Meaning |
| --- | --- |
| 3 | An explicitly `essential: true` JSON choice, including a vital clue with no state effect. |
| 2 | State-changing or unknown effects. Zork navigation, take/drop/open/close, reading, puzzle interactions and tool use normally remain here. |
| 1 | Zork Wait (it advances timed events) and redundant house/window traversal alternatives. |
| 0 | Informational/no-direct-effect choices: ordinary Look/Examine/Look inside, source-confirmed immovable Mailbox/Trophy case/Rug pickup attempts, permanently blocked front/wooden door opening, and exposed exits whose original condition or failure string prevents travel. |

For JSON stories, the runtime evaluates authored effects against the current room, items and flags. Changes to location, inventory, flags, score, a once-only choice's availability, or an ending receive priority 2. Text-only actions, travel to the same room and effects already satisfied receive 0, unless explicitly marked essential. `requiresItems`, `removeItems`, or `category: "bag"` route the choice to the bag. Pickup actions remain with the surroundings.

For Zork, priorities describe the direct action, excluding the universal move counter and background timed events. They do not promise that an attempted action succeeds or is completely inert. Unknown effects are not tested by running commands. `TRYTAKEBIT` is not treated as evidence of no effect: some attempted pickups change the world. Reading and contextual interactions such as moving leaves or looking under a rug remain above ordinary descriptive actions.

When more than nine higher-priority main choices remain, the first nine in the fixed order are retained. This hard cap can omit meaningful choices; it is not a complete-game or puzzle-solvability guarantee. The generator's uncapped candidates remain available to engine audits, while participants and exports receive only the capped menu.

The bag displays carried objects and actions on them, plus actions that use held tools (such as unlocking with a key or attacking with a weapon). All bag actions remain accessible; long lists use sidebar page controls. Viewing and paging send no game commands and use no decisions. Selecting any gameplay action still counts.
