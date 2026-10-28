import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, choose, ids } from './helpers.js';
import { generateActions } from '../../story_version_control/zork/action-generator.js';

test('original story initializes; schema and initial menu do not expose hidden objects', async () => {
  const game = await fresh();
  assert.match(game.getLastResponse(), /Release 119 \/ Serial number 880429/);
  assert.match(game.getLastResponse(), /You are standing in an open field west of a white house/);
  assert.equal(game.getAvailableState().room.name, 'West of House');
  assert.equal(game.getAvailableState().score, 0);
  assert.ok(ids(game).includes('open_mailbox'));
  assert.ok(!ids(game).some(id => /advertisement|barrow|go_in|go_southwest/.test(id)));
  assert.ok(!game.getLastResponse().endsWith('>'));
});

test('mailbox visibility, inventory, read, drop and container closure use actual VM state', async () => {
  const game = await fresh();
  const opened = choose(game, 'open_mailbox');
  assert.equal(opened.response, 'Opening the small mailbox reveals a leaflet.\n\n');
  assert.ok(ids(game).includes('take_advertisement'));
  assert.ok(!ids(game).includes('open_mailbox'));
  choose(game, 'close_mailbox');
  assert.ok(!ids(game).includes('take_advertisement'));
  choose(game, 'open_mailbox');
  choose(game, 'take_advertisement');
  assert.equal(game.getAvailableState().inventory[0].symbol, 'ADVERTISEMENT');
  assert.ok(ids(game).includes('drop_advertisement'));
  assert.match(choose(game, 'read_advertisement').response, /"WELCOME TO ZORK!\n\n/);
  choose(game, 'put_advertisement_in_mailbox');
  assert.equal(game.getAvailableState().inventory.length, 0);
});

test('navigation, blocked door, window state, lantern and hidden trap door', async () => {
  const game = await fresh();
  const blocked = choose(game, 'open_front_door');
  assert.equal(blocked.response, 'The door cannot be opened.\n\n');
  assert.equal(blocked.state.room.name, 'West of House');
  choose(game, 'go_north'); choose(game, 'go_east');
  assert.equal(game.getAvailableState().room.name, 'Behind House');
  assert.match(choose(game, 'go_in').response, /closed/);
  choose(game, 'open_kitchen_window'); choose(game, 'go_in');
  assert.equal(game.getAvailableState().room.name, 'Kitchen');
  assert.equal(game.getAvailableState().score, 10);
  assert.ok(!ids(game).some(id => /lunch|garlic|water/.test(id)));
  choose(game, 'open_sandwich_bag');
  assert.ok(ids(game).includes('take_lunch'));
  choose(game, 'go_west');
  assert.ok(!ids(game).some(id => /trap_door|go_down/.test(id)));
  choose(game, 'take_lamp'); choose(game, 'light_lamp');
  assert.ok(ids(game).includes('extinguish_lamp'));
  choose(game, 'move_rug');
  assert.ok(ids(game).includes('open_trap_door'));
  assert.ok(ids(game).includes('go_down'));
  choose(game, 'open_trap_door'); choose(game, 'go_down');
  assert.equal(game.getAvailableState().room.name, 'Cellar');
  assert.equal(game.getAvailableState().lit, true);
});

test('concealed grate and darkness do not leak object contents or new exits', async () => {
  const game = await fresh();
  choose(game, 'go_north'); choose(game, 'go_north'); choose(game, 'go_north');
  assert.ok(!ids(game).some(id => /grate|go_down/.test(id)));
  choose(game, 'move_leaves');
  assert.ok(ids(game).includes('open_grate'));
  assert.ok(ids(game).includes('go_down'));
  assert.match(choose(game, 'open_grate').response, /locked/);
  const dark = await fresh();
  choose(dark, 'go_north'); choose(dark, 'go_east'); choose(dark, 'open_kitchen_window'); choose(dark, 'go_in'); choose(dark, 'go_up');
  assert.equal(dark.getAvailableState().lit, false);
  assert.ok(!ids(dark).some(id => /rope|knife/.test(id)));
  assert.ok(ids(dark).includes('go_down'));
});

test('generation is read-only and ordered; fixed interpreter seed reproduces trajectories', async () => {
  const one = await fresh(), two = await fresh();
  for (const command of ['north', 'north', 'up', 'look', 'down', 'west', 'south', 'look']) {
    const before = Array.from(one.vm.ram.getUint8Array(0, one.vm.staticmem));
    assert.deepEqual(generateActions(one.getAvailableState()), generateActions(one.getAvailableState()));
    assert.deepEqual(Array.from(one.vm.ram.getUint8Array(0, one.vm.staticmem)), before);
    assert.deepEqual(one.executeAction(command), two.executeAction(command));
    assert.equal(one.vm.xorshift_seed, two.vm.xorshift_seed);
  }
  assert.throws(() => one.executeAction('north. south'), /one registered/);
  assert.throws(() => one.executeAction('quit'), /one registered/);
});
