// A small data-driven story runtime. All narrative, choices and rules live in story.json.
const owns = (object, key) => Object.hasOwn(object, key);
export class TextEngine {
  constructor(story) {
    this.story = story;
    this.validate();
    this.roomId = story.start;
    this.items = new Set(story.initialInventory || []);
    this.flags = new Set();
    this.used = new Set();
    this.score = 0;
    this.moves = 0;
    this.gameOver = false;
  }
  validate() {
    const { rooms, items = {}, start } = this.story;
    const fail = message => { throw new Error(`Invalid text story: ${message}`); };
    if (!rooms || typeof rooms !== 'object' || !owns(rooms, start)) fail('start must identify a room');
    for (const [id, item] of Object.entries(items)) {
      if (!item || typeof item.name !== 'string') fail(`item ${id} needs a name`);
    }
    const itemList = (list, label) => {
      if (!Array.isArray(list) || list.some(id => !owns(items, id))) fail(`${label} references an unknown item`);
    };
    itemList(this.story.initialInventory || [], 'initialInventory');
    for (const [id, room] of Object.entries(rooms)) {
      if (!room || typeof room.name !== 'string' || typeof room.text !== 'string' || !Array.isArray(room.actions)) fail(`room ${id} needs name, text and actions`);
      const ids = new Set();
      for (const action of room.actions) {
        if (!action || !/^[a-z][a-z0-9_-]*$/.test(action.id) || ids.has(action.id)) fail(`room ${id} has a missing, duplicate or invalid action id`);
        ids.add(action.id);
        if (!action.label || typeof action.label !== 'string') fail(`${action.id} needs a label`);
        if (action.category && !['navigation', 'interaction', 'bag'].includes(action.category)) fail(`${action.id} has an invalid category`);
        if (action.to !== undefined && !owns(rooms, action.to)) fail(`${action.id} has an unknown destination`);
        if (action.text !== undefined && typeof action.text !== 'string') fail(`${action.id} text must be a string`);
        if (action.score !== undefined && !Number.isFinite(action.score)) fail(`${action.id} score must be a number`);
        for (const field of ['requiresItems', 'withoutItems', 'addItems', 'removeItems']) itemList(action[field] || [], action.id);
        for (const field of ['requiresFlags', 'withoutFlags', 'setFlags', 'clearFlags']) {
          if (action[field] !== undefined && (!Array.isArray(action[field]) || action[field].some(flag => typeof flag !== 'string'))) fail(`${action.id} ${field} must be a list of strings`);
        }
      }
    }
  }
  available() {
    if (this.gameOver) return [];
    return this.story.rooms[this.roomId].actions.filter(action =>
      !(action.once && this.used.has(`${this.roomId}:${action.id}`)) &&
      (action.requiresItems || []).every(id => this.items.has(id)) &&
      (action.withoutItems || []).every(id => !this.items.has(id)) &&
      (action.requiresFlags || []).every(flag => this.flags.has(flag)) &&
      (action.withoutFlags || []).every(flag => !this.flags.has(flag)));
  }
  initialize() { return this.capture(this.story.rooms[this.roomId].text); }
  executeAction(command) {
    const action = this.available().find(choice => choice.id === command);
    if (!action) throw new Error('Action does not belong to the current menu');
    this.used.add(`${this.roomId}:${action.id}`);
    for (const id of action.removeItems || []) this.items.delete(id);
    for (const id of action.addItems || []) this.items.add(id);
    for (const flag of action.clearFlags || []) this.flags.delete(flag);
    for (const flag of action.setFlags || []) this.flags.add(flag);
    this.score += action.score || 0;
    this.moves++;
    if (action.to) this.roomId = action.to;
    this.gameOver = !!action.end;
    const text = [action.text, action.to ? this.story.rooms[this.roomId].text : null].filter(Boolean).join('\n\n');
    return this.capture(text || this.story.rooms[this.roomId].text);
  }
  capture(response) {
    const room = this.story.rooms[this.roomId];
    return {
      response, rawResponse: response,
      state: {
        room: { id: this.roomId, name: room.name }, score: this.score, moves: this.moves,
        inventory: [...this.items].map(id => ({ id, name: this.story.items[id].name, description: this.story.items[id].description || '' })),
      },
      actions: this.available().map(action => ({ id: action.id, label: action.label, command: action.id, category: action.category || 'interaction' })),
      gameOver: this.gameOver, terminationReason: this.gameOver ? 'story_finish' : '',
    };
  }
}
