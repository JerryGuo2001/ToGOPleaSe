import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TextEngine } from '../../js/text-engine.js';
import { SessionStore } from '../../js/session-store.js';
import { storyURL } from '../../js/story-loader.js';

const story = JSON.parse(await readFile(new URL('../../story_version_control/lantern-cove/story.json', import.meta.url)));
test('a JSON story gates choices, keeps inventory, awards once-only score and ends', () => {
  const game = new TextEngine(structuredClone(story));
  assert.equal(game.initialize().state.room.name, 'Quiet Shore');
  game.executeAction('to_cottage');
  assert.throws(() => game.executeAction('unlock_door'), /current menu/);
  game.executeAction('to_shore');
  const pickup = game.executeAction('take_key');
  assert.equal(pickup.state.score, 5);
  assert.equal(pickup.state.inventory[0].name, 'Brass key');
  assert.throws(() => game.executeAction('take_key'), /current menu/);
  game.executeAction('to_cottage');
  game.executeAction('take_lantern');
  game.executeAction('unlock_door');
  const end = game.executeAction('light_beacon');
  assert.equal(end.state.score, 20);
  assert.equal(end.gameOver, true);
  assert.deepEqual(end.actions, []);
  assert.match(end.response, /boat is coming home/);
  assert.throws(() => game.executeAction('to_cottage'), /current menu/);
});

test('text story conditions support flags and consumed items without rewriting the UI', () => {
  const fixture = structuredClone(story);
  fixture.rooms.shore.actions.push({ id: 'trade_key', label: 'Trade key', requiresItems: ['key'], removeItems: ['key'], setFlags: ['traded'], once: true });
  fixture.rooms.shore.actions.push({ id: 'reward', label: 'Collect reward', requiresFlags: ['traded'], withoutFlags: ['paid'], setFlags: ['paid'], score: 2 });
  const game = new TextEngine(fixture);
  assert.throws(() => game.executeAction('reward'), /current menu/);
  game.executeAction('take_key');
  assert.deepEqual(game.executeAction('trade_key').state.inventory, []);
  assert.equal(game.executeAction('reward').state.score, 7);
  assert.throws(() => game.executeAction('reward'), /current menu/);
});

test('story validation identifies invalid destinations, items and duplicate actions', () => {
  const invalid = mutate => { const fixture = structuredClone(story); mutate(fixture); return () => new TextEngine(fixture); };
  assert.throws(invalid(s => s.rooms.shore.actions[0].to = 'missing'), /unknown destination/);
  assert.throws(invalid(s => s.rooms.shore.actions[1].addItems = ['missing']), /unknown item/);
  assert.throws(invalid(s => s.rooms.shore.actions.push(s.rooms.shore.actions[0])), /duplicate/);
  assert.throws(() => storyURL('../zork'), /folder name/);
  assert.ok(storyURL('my-story').href.endsWith('/story_version_control/my-story/story.json'));
});

test('recovery is separated by story and older Zork sessions remain downloadable', () => {
  const memory = () => ({ data: new Map(), getItem(k) { return this.data.get(k) ?? null; }, setItem(k, v) { this.data.set(k, v); }, removeItem(k) { this.data.delete(k); } });
  const local = memory(), tab = memory();
  const zork = new SessionStore(local, tab, 'zork');
  const cove = new SessionStore(local, tab, 'lantern-cove');
  zork.save({ participant_id: 'z', status: 'in_progress', rows: [] });
  assert.equal(cove.recover(), null);
  cove.save({ participant_id: 'c', status: 'completed', rows: [] });
  assert.equal(zork.recover().participant_id, 'z');
  assert.equal(cove.recover().participant_id, 'c');
  const legacy = memory();
  legacy.setItem('zork-experiment:v1:latest', 'old');
  legacy.setItem('zork-experiment:v1:old', JSON.stringify({ participant_id: 'old', status: 'completed', rows: [] }));
  assert.equal(new SessionStore(legacy, memory(), 'zork').recover().participant_id, 'old');
});
