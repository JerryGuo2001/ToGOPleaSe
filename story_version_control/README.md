# Writing a story

Each story is a folder containing `story.json`. Copy `lantern-cove/` as a starting point, change its `id` to match your new folder name, and open `index.html?story=your-folder`. Set `DEFAULT_STORY` in `../js/config.js` to choose which story loads without a query parameter. Switching stories starts a fresh session; recovery data remains separate.

For a text story, everything below is plain JSON: there is no JavaScript or build step. A folder does not need to be added to a registry. Serve the entire repository over HTTP, as described in the [project guide](../development/README.md).

## Minimal complete example

Save this as `story_version_control/my-story/story.json`:

```json
{
  "id": "my-story",
  "title": "The Garden Gate",
  "subtitle": "A small adventure",
  "version": "1.0.0",
  "engine": "text",
  "maxScore": 10,
  "start": "garden",
  "items": {
    "key": { "name": "Iron key", "description": "It might fit the garden gate." }
  },
  "rooms": {
    "garden": {
      "name": "Walled Garden",
      "text": "A key lies beside the fountain. A locked gate leads outside.\n\nThe air smells of rain.",
      "actions": [
        {
          "id": "take_key",
          "label": "Pick up the key",
          "text": "You pick up the cold iron key.",
          "addItems": ["key"],
          "once": true,
          "score": 5
        },
        {
          "id": "open_gate",
          "label": "Unlock the garden gate",
          "category": "navigation",
          "requiresItems": ["key"],
          "to": "outside",
          "score": 5,
          "end": true
        }
      ]
    },
    "outside": {
      "name": "Beyond the Gate",
      "text": "The gate opens onto a sunlit road. Your adventure is complete.",
      "actions": []
    }
  }
}
```

## Story fields

| Field | Meaning |
| --- | --- |
| `id` | Exactly matches the folder name. Use lowercase letters, numbers, `_` or `-`. |
| `title`, `subtitle` | Displayed in the page header. Subtitle is optional. |
| `version` | Your story version. Change it when revising text or rules. |
| `engine` | Use `"text"` for JSON stories. |
| `start` | ID of the initial room. |
| `maxScore` | Optional maximum shown beside the live score; it does not cap earned points. |
| `items` | Object mapping item IDs to `{ "name": "…", "description": "…" }`. Descriptions are optional. |
| `initialInventory` | Optional array of item IDs carried at the start. |
| `rooms` | Object mapping room IDs to `{ "name": "…", "text": "…", "actions": […] }`. |

Write paragraphs using `\n\n` inside JSON strings. Text is rendered as plain text, so HTML and Markdown formatting are not interpreted. All item and destination IDs must exist. A room with no available actions should be reached through an action with `end: true`; otherwise leave a way to continue playing.

## Choice fields

| Field | Meaning |
| --- | --- |
| `id` | Unique within its room; starts with a lowercase letter, followed by lowercase letters, numbers, `_` or `-`. Recorded as the command. |
| `label` | Button text. |
| `category` | `"navigation"` → Move; `"interaction"` (default) → Action; `"bag"` → Bag. |
| `text` | Optional response after selecting this choice. |
| `to` | Optional destination room ID. Its full narrative appears after the response. |
| `addItems`, `removeItems` | Arrays of item IDs to add to/remove from inventory. |
| `requiresItems`, `withoutItems` | Show the choice only if all listed items are carried / none are carried. |
| `setFlags`, `clearFlags` | Arrays of named story flags to set/clear. All flags start unset. |
| `requiresFlags`, `withoutFlags` | Show the choice only if all listed flags are set / none are set. |
| `score` | Points to add when the choice is executed; may be negative. Defaults to zero. |
| `once` | `true` hides this choice after its first use, even after returning to the room. |
| `end` | `true` ends the story after displaying the response/destination and exports the session. |

Conditions on a choice are combined with AND. For example, `requiresItems: ["key"]` and `withoutFlags: ["door_open"]` means the player must have the key and must not have opened the door. Use flags for puzzle state. Use `once: true` for a reward that should not be farmed by revisiting a room. Removing an item does not automatically hide the corresponding choice: add `requiresItems` when consumption requires possession.

The engine automatically updates inventory and score. Every executed choice uses one decision and one text-engine move. Simply visiting Move, Action or Bag never executes a choice. There is no need to write a “check inventory” action. A Bag choice that uses an item is a normal counted action; set its `requiresItems` accordingly.

The task ends at 10 decisions unless the story finishes earlier. This experimental limit is shared by all stories and defined in `js/experiment-controller.js`.

## Original Zork and other compiled games

Zork uses `engine: "z-machine"` and its own `runtime.js`. Its text and mechanics are embedded in the unmodified `.z3` file; matching readable source is in `zork/source-r119`. `zork/original-source` preserves the initially supplied development source. The manifest, binary hash, seed and action-policy version must match its pinned adapter.

Adding another existing Z-machine game requires a story-specific `runtime.js`, state reader, and action definitions for that binary. It is not enough to replace Zork's `.z3`. The runtime exports `createRuntime(manifest)` with `initialize()` and `executeAction(command)`, returning:

```js
{
  response: 'Displayed story text',
  rawResponse: 'Original complete output',
  state: {
    room: { id: 'room-id', name: 'Room title' },
    inventory: [{ id: 'item-id', name: 'Item name' }],
    score: 0,
    moves: 0
  },
  actions: [{ id: 'go_north', label: 'Go north', command: 'north', category: 'navigation' }],
  gameOver: false,
  terminationReason: ''
}
```

The worker validates each command against the latest menu before passing it to the runtime. A runtime can explicitly set each action's `menuGroup` to `move`, `action` or `bag`. The JSON engine handles this contract for you, so new authored stories normally need only `story.json`.
