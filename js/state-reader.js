import { SCHEMA } from './story-schema.js';

const BY_ID = new Map(SCHEMA.objects.map(object => [object.id, object]));
export const IDS = Object.fromEntries(SCHEMA.objects.map(object => [object.symbol, object.id]));
export const DIRECTIONS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'up', 'down', 'in', 'out', 'land'];
const ABBR = { northeast: 'NE', northwest: 'NW', southeast: 'SE', southwest: 'SW' };
const REVERSE = { north: 'south', northeast: 'southwest', east: 'west', southeast: 'northwest', south: 'north', southwest: 'northeast', west: 'east', northwest: 'southeast', up: 'down', down: 'up', in: 'out', out: 'in' };

export function readObject(vm, id) {
  const meta = BY_ID.get(id);
  if (!meta) throw new Error(`Unmapped story object ${id}`);
  const table = vm.m.getUint16(vm.objects + id * 9 + 7);
  const properties = {};
  let address = table + 1 + vm.m.getUint8(table) * 2;
  while (vm.m.getUint8(address)) {
    const header = vm.m.getUint8(address++);
    const length = (header >> 5) + 1;
    properties[header & 31] = Array.from(vm.m.getUint8Array(address, length));
    address += length;
  }
  return {
    ...meta,
    parent: vm.get_parent(id),
    flags: Object.keys(SCHEMA.attributes).filter(flag => vm.test_attr(id, SCHEMA.attributes[flag])),
    properties,
  };
}
export const has = (object, flag) => !!object?.flags.includes(flag);

// Exposure memory records what the engine has shown. It never changes VM memory.
export class StateReader {
  constructor(vm) {
    this.vm = vm;
    this.encounters = new Map();
    this.knownExits = new Map();
    this.previousRoom = null;
  }
  read(text, command = '') {
    const vm = this.vm;
    const objects = SCHEMA.objects.map(meta => readObject(vm, meta.id));
    const byId = new Map(objects.map(object => [object.id, object]));
    const roomId = vm.m.getUint16(vm.globals);
    const room = byId.get(roomId);
    if (room?.kind !== 'room') throw new Error('Unexpected location global');
    const known = this.encounters.get(roomId) || new Set();
    const words = new Set((text.toLowerCase().match(/[a-z0-9-]+/g) || []).map(word => word.slice(0, 6)));
    const mentioned = object => [...object.synonyms, ...object.name.toLowerCase().split(/\W+/).filter(w => w.length > 3)]
      .some(word => words.has(word.slice(0, 6)));
    const children = id => objects.filter(object => object.parent === id);
    const physical = [];
    function walk(id) {
      for (const object of children(id)) {
        if (object.id === IDS.ADVENTURER || has(object, 'INVISIBLE')) continue;
        physical.push(object);
        // Closed containers remain opaque to this policy, including transparent ones.
        if (has(object, 'SURFACEBIT') || (has(object, 'OPENBIT') && !has(object, 'ACTORBIT'))) walk(object.id);
      }
    }
    walk(roomId);
    const nearby = physical.slice();
    physical.length = 0;
    walk(IDS.ADVENTURER);
    const carried = physical.slice();
    // Pinned LIT global, verified against GO / V-LOOK / V-LAMP-ON bytecode.
    // This retains the game's own treatment of matches, translucent containers,
    // and ghost-mode illumination instead of inferring light from visible lamps.
    const lit = vm.m.getUint16(vm.globals + 2 * SCHEMA.globals.LIT) !== 0;
    const locals = (room.properties[SCHEMA.properties.GLOBAL] || []).map(id => byId.get(id)).filter(Boolean);
    const visible = new Map();
    for (const object of [...nearby, ...locals]) {
      if (!lit || has(object, 'INVISIBLE') || !object.noun || object.symbol === 'SONGBIRD') continue;
      if (has(object, 'NDESCBIT') || object.parent === IDS['LOCAL-GLOBALS']) {
        if (!mentioned(object) && !known.has(object.id)) continue;
      }
      known.add(object.id);
      visible.set(object.id, object);
    }
    for (const object of carried) {
      // Carried objects remain manipulable by touch in darkness.
      known.add(object.id);
      visible.set(object.id, object);
    }
    // A trap door is local-global from below but physically in the living room.
    this.encounters.set(roomId, known);
    const exits = [];
    const remembered = this.knownExits.get(roomId) || new Set();
    if (this.previousRoom !== null && this.previousRoom !== roomId && REVERSE[command]) {
      // The reverse of an observed transition is an informed attempt, not a new hidden exit.
      remembered.add(REVERSE[command]);
    }
    for (const direction of DIRECTIONS) {
      const prop = SCHEMA.directions[ABBR[direction] || direction.toUpperCase()];
      const data = room.properties[prop];
      if (!data) continue;
      let exposed = true;
      if (data.length === 3) {
        const gates = {
          'LIVING-ROOM:down': 'TRAP-DOOR',
          'GRATING-CLEARING:down': 'GRATE',
          'STUDIO:up': 'CHIMNEY',
        };
        const gate = gates[`${room.symbol}:${direction}`];
        exposed = gate ? visible.has(IDS[gate]) : room.symbol.startsWith('MAZE-');
      }
      // Conditional exits without a failure description are secret until enabled.
      if (data.length === 4 && ((!data[2] && !data[3]) || (room.symbol === 'CYCLOPS-ROOM' && direction === 'east'))) {
        exposed = data[1] >= 16 && vm.m.getUint16(vm.globals + 2 * (data[1] - 16)) !== 0;
      }
      // Door exits are offered only when the door has been encountered.
      if (data.length === 5) exposed = visible.has(data[1]) || known.has(data[1]);
      if (exposed && lit) remembered.add(direction);
      if (exposed && (lit || remembered.has(direction))) exits.push(direction);
    }
    this.knownExits.set(roomId, remembered);
    this.previousRoom = roomId;
    const score = vm.m.getInt16(vm.globals + 2);
    const playerParent = byId.get(vm.get_parent(IDS.ADVENTURER));
    return {
      room: { id: roomId, symbol: room.symbol, name: room.name },
      lit,
      exits,
      visibleObjects: [...visible.values()].sort((a, b) => a.id - b.id),
      inventory: carried.map(({ id, symbol, name, parent }) => ({ id, symbol, name, parent })).sort((a, b) => a.id - b.id),
      score,
      moves: vm.m.getUint16(vm.globals + 4),
      vehicle: has(playerParent, 'VEHBIT') ? { id: playerParent.id, name: playerParent.name } : null,
    };
  }
}
