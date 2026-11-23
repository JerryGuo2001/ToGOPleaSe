import test from 'node:test';
import assert from 'node:assert/strict';
import { selectMenu, menuGroup } from '../../js/action-menu.js';
import { TextEngine } from '../../js/text-engine.js';
import { generateActions } from '../../story_version_control/zork/action-generator.js';
import { fresh } from './helpers.js';

const choice = (id, menuPriority = 2, menuGroup = 'action') => ({ id, label: id, command: id, menuPriority, menuGroup });
test('nine main choices prioritize effects, preserve tie order, and do not cap bag actions', () => {
  const information = Array.from({ length: 8 }, (_, i) => choice(`look_${i}`, 0));
  const changing = Array.from({ length: 8 }, (_, i) => choice(`change_${i}`));
  const essential = choice('read_clue', 3);
  const bag = Array.from({ length: 12 }, (_, i) => choice(`use_${i}`, 0, 'bag'));
  const actions = [...information, ...bag, ...changing, essential];
  const snapshot = structuredClone(actions);
  assert.deepEqual(selectMenu(actions).map(a => a.id), [...changing, essential, ...bag].map(a => a.id));
  assert.deepEqual(actions, snapshot);
  assert.deepEqual(selectMenu(changing.slice(0, 3)), changing.slice(0, 3));
  assert.deepEqual(selectMenu([...changing, choice('ninth'), choice('tenth')]).map(a => a.id), [...changing.map(a => a.id), 'ninth']);
});

test('text priorities reflect current state, including flags, once-only effects, endings and essential clues', () => {
  const game = new TextEngine({
    start: 'room', items: { key: { name: 'Key' } }, initialInventory: ['key'],
    rooms: { room: { name: 'Room', text: 'A room.', actions: [
      { id: 'look', label: 'Look' }, { id: 'same_room', label: 'Stay', to: 'room' },
      { id: 'clue', label: 'Read vital clue', essential: true },
      { id: 'flag', label: 'Set flag', setFlags: ['done'] },
      { id: 'once', label: 'Once', once: true }, { id: 'score', label: 'Score', score: 1 },
      { id: 'unlock', label: 'Unlock using key', requiresItems: ['key'], setFlags: ['open'] },
      { id: 'finish', label: 'Finish', end: true },
    ] } },
  });
  const priorities = result => Object.fromEntries(result.actions.map(action => [action.id, action.menuPriority]));
  assert.deepEqual(priorities(game.initialize()), { look: 0, same_room: 0, clue: 3, flag: 2, once: 2, score: 2, unlock: 2, finish: 2 });
  assert.equal(menuGroup(game.initialize().actions.find(a => a.id === 'unlock')), 'bag');
  assert.equal(priorities(game.executeAction('flag')).flag, 0);
});

test('attempted pickups with possible world effects are kept ahead of descriptive options', () => {
  const state = { inventory: [], exits: [], lit: true, visibleObjects: [
    { id: 1, symbol: 'TOOL-CHEST', name: 'tool chest', noun: 'chest', flags: ['TRYTAKEBIT'] },
    { id: 2, symbol: 'BONES', name: 'bones', noun: 'bones', flags: ['TRYTAKEBIT'] },
  ] };
  const generated = generateActions(state);
  const actions = selectMenu([...Array.from({ length: 7 }, (_, i) => choice(`change_${i}`)), ...generated]);
  assert.ok(actions.some(action => action.id === 'take_tool_chest'));
  assert.ok(actions.some(action => action.id === 'take_bones'));
  assert.ok(!actions.some(action => action.category === 'examination'));
});

test('capped Zork menus retain the mailbox, window, lantern and trap-door progression without probing the VM', async () => {
  const game = await fresh();
  for (const id of ['open_mailbox', 'take_advertisement', 'read_advertisement', 'close_mailbox', 'go_north', 'go_east', 'open_kitchen_window', 'go_in', 'go_west', 'take_lamp', 'light_lamp', 'move_rug', 'open_trap_door', 'go_down']) {
    const memory = Array.from(game.vm.ram.getUint8Array(0, game.vm.staticmem));
    const rng = game.vm.xorshift_seed;
    const actions = selectMenu(generateActions(game.getAvailableState()));
    assert.ok(actions.filter(a => menuGroup(a) !== 'bag').length <= 9);
    const selected = actions.find(action => action.id === id);
    assert.ok(selected, `${id} should remain available in ${game.getAvailableState().room.name}`);
    assert.deepEqual(Array.from(game.vm.ram.getUint8Array(0, game.vm.staticmem)), memory);
    assert.equal(game.vm.xorshift_seed, rng);
    if (['read_advertisement', 'light_lamp'].includes(id)) assert.equal(menuGroup(selected), 'bag');
    game.executeAction(selected.command);
  }
  assert.equal(game.getAvailableState().room.name, 'Cellar');
  assert.equal(game.getAvailableState().lit, true);
});
