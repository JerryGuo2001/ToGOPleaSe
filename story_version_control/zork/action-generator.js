import { has } from './state-reader.js';

export const ACTION_GENERATOR_VERSION = '2.0.0';
const key = object => object.symbol.toLowerCase().replaceAll('-', '_');
const nounOverrides = { ADVERTISEMENT: 'leaflet', RUG: 'rug', LAMP: 'brass lantern', WATER: 'water', 'GLOBAL-WATER': 'water', 'KITCHEN-WINDOW': 'kitchen window', 'FRONT-DOOR': 'front door', 'TRAP-DOOR': 'trap door' };
export const noun = object => nounOverrides[object.symbol] || object.noun;

// Explicit, source-audited object affordances. These do not assert success and
// contain no puzzle solutions or new world transitions.
const SPECIAL = {
  RUG: [['move', 'Move'], ['look under', 'Look under']],
  LEAVES: [['move', 'Move'], ['look under', 'Look under']],
  'WHITE-HOUSE': [['walk around', 'Walk around'], ['enter', 'Enter']],
  TREE: [['climb', 'Climb']],
  'KITCHEN-WINDOW': [['enter', 'Climb through']],
  MATCH: [['light', 'Light']],
  BELL: [['ring', 'Ring']],
  'HOT-BELL': [['ring', 'Ring']],
  'BLUE-BUTTON': [['push', 'Push']],
  'RED-BUTTON': [['push', 'Push']],
  'YELLOW-BUTTON': [['push', 'Push']],
  'BROWN-BUTTON': [['push', 'Push']],
  'MIRROR-1': [['touch', 'Touch']],
  'MIRROR-2': [['touch', 'Touch']],
  ROPE: [['untie', 'Untie']],
};

export function generateActions(state) {
  const actions = [];
  const carried = new Set(state.inventory.map(object => object.id));
  let subjectId = null;
  const add = (id, label, command, category = 'interaction') => actions.push({
    id, label, command, category, subjectId,
    menuGroup: category === 'navigation' ? 'move' : carried.has(subjectId) || id.startsWith('put_') ? 'bag' : 'action',
  });
  for (const direction of state.exits) add(`go_${direction}`, `Go ${direction}`, direction, 'navigation');
  const objects = state.visibleObjects;
  const held = objects.filter(object => carried.has(object.id));
  for (const object of objects) {
    subjectId = object.id;
    const id = key(object), name = object.name, target = noun(object);
    if (!target) continue;
    add(`examine_${id}`, `Examine ${name}`, `examine ${target}`, 'examination');
    if (!carried.has(object.id) && !has(object, 'ACTORBIT') && (has(object, 'TAKEBIT') || has(object, 'TRYTAKEBIT'))) add(`take_${id}`, `Take ${name}`, `take ${target}`, 'inventory');
    if (carried.has(object.id)) add(`drop_${id}`, `Drop ${name}`, `drop ${target}`, 'inventory');
    if (has(object, 'READBIT') && state.lit) add(`read_${id}`, `Read ${name}`, `read ${target}`, 'reading');
    if ((has(object, 'CONTBIT') || has(object, 'DOORBIT')) && !has(object, 'SURFACEBIT')) {
      const verb = has(object, 'OPENBIT') ? 'close' : 'open';
      add(`${verb}_${id}`, `${verb === 'open' ? 'Open' : 'Close'} ${name}`, `${verb} ${target}`);
    }
    if (has(object, 'CONTBIT') && has(object, 'OPENBIT')) add(`look_in_${id}`, `Look inside ${name}`, `look in ${target}`, 'examination');
    if (has(object, 'LIGHTBIT')) {
      const on = has(object, 'ONBIT');
      add(`${on ? 'extinguish' : 'light'}_${id}`, `${on ? 'Extinguish' : 'Light'} ${name}`, `${on ? 'extinguish' : 'light'} ${target}`);
    }
    if (has(object, 'FOODBIT')) add(`eat_${id}`, `Eat ${name}`, `eat ${target}`);
    if (has(object, 'DRINKBIT')) add(`drink_${id}`, `Drink ${name}`, `drink ${target}`);
    if (has(object, 'VEHBIT') && state.vehicle?.id !== object.id) add(`enter_${id}`, `Enter ${name}`, `board ${target}`, 'navigation');
    for (const [verb, label] of SPECIAL[object.symbol] || []) {
      // Untying an unattached rope is a contextual attempt; no suggested anchor.
      add(`${verb.replaceAll(' ', '_')}_${id}`, `${label} ${name}`, `${verb} ${target}`);
    }
    if (has(object, 'ACTORBIT')) {
      for (const weapon of held.filter(item => has(item, 'WEAPONBIT'))) {
        add(`attack_${id}_with_${key(weapon)}`, `Attack ${name} with ${weapon.name}`, `attack ${target} with ${noun(weapon)}`, 'combat');
      }
    }
    if (object.symbol === 'GRATE') {
      const skeletonKey = held.find(item => item.symbol === 'KEYS');
      if (skeletonKey) add(`unlock_${id}_with_${key(skeletonKey)}`, `Unlock ${name} with ${skeletonKey.name}`, `unlock ${target} with ${noun(skeletonKey)}`);
    }
    if (has(object, 'SURFACEBIT') || (has(object, 'CONTBIT') && has(object, 'OPENBIT'))) {
      for (const item of held) {
        if (item.id === object.id || item.parent === object.id || has(item, 'DRINKBIT')) continue;
        // Do not offer placing an ancestor inside its descendant.
        let parent = object.parent;
        const seen = new Set();
        while (parent && !seen.has(parent) && parent !== item.id) {
          seen.add(parent);
          parent = objects.find(candidate => candidate.id === parent)?.parent;
        }
        if (parent === item.id) continue;
        const prep = has(object, 'SURFACEBIT') ? 'on' : 'in';
        add(`put_${key(item)}_${prep}_${id}`, `Put ${item.name} ${prep} ${name}`, `put ${noun(item)} ${prep} ${target}`, 'inventory');
      }
    }
  }
  subjectId = null;
  if (state.vehicle) add('exit_vehicle', `Exit ${state.vehicle.name}`, 'exit', 'navigation');
  add('look', 'Look around', 'look', 'examination');
  add('wait', 'Wait', 'wait', 'other');
  const ids = new Set(), commands = new Set();
  return actions.filter(action => {
    if (ids.has(action.id) || commands.has(action.command)) return false;
    ids.add(action.id); commands.add(action.command);
    return true;
  });
}
