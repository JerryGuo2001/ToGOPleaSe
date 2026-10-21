import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh } from './helpers.js';
import { generateActions } from '../js/action-generator.js';

const kitchen = ['north', 'east', 'open kitchen window', 'in'];
export const routes = [
  [], ['open mailbox'], ['open mailbox', 'take leaflet'],
  ['north'], ['south'], ['west'], ['north', 'north'], ['north', 'north', 'up'],
  ['north', 'north', 'up', 'take nest'], ['north', 'north', 'north'], ['north', 'north', 'north', 'move leaves'],
  ['north', 'east'], ['north', 'east', 'east'], ['north', 'east', 'east', 'east'],
  kitchen, [...kitchen, 'open sack'], [...kitchen, 'take bottle', 'open bottle'],
  [...kitchen, 'west'], [...kitchen, 'west', 'take lamp', 'light lamp'],
  [...kitchen, 'west', 'move rug'], [...kitchen, 'west', 'take sword', 'take lamp', 'light lamp', 'move rug', 'open trap door', 'down', 'north'],
  [...kitchen, 'up'], [...kitchen, 'west', 'take lamp', 'light lamp', 'east', 'up'],
];
test('all offered actions in representative real-story states resolve without parser clarification or unknown words', async () => {
  let count = 0;
  const invalid = [];
  for (const route of routes) {
    const sample = await fresh();
    route.forEach(command => sample.executeAction(command));
    for (const action of generateActions(sample.getAvailableState())) {
      const isolated = await fresh();
      route.forEach(command => isolated.executeAction(command));
      const result = isolated.executeAction(action.command);
      count++;
      if (/don't know the word|don't understand that|can't use the word|What do you want to|Which .*do you mean|Please be more specific|not enough nouns/i.test(result.response)) {
        invalid.push({ route, action, response: result.response });
      }
    }
  }
  console.log(`Coverage audit: ${count} isolated real-engine action executions across ${routes.length} fixtures.`);
  assert.deepEqual(invalid, []);
});

test('80 reproducible menu-driven ten-decision trajectories remain parser-recognized', async () => {
  let total = 0;
  const rooms = new Set(), commands = new Set();
  for (let seed = 1; seed <= 80; seed++) {
    const game = await fresh();
    let random = seed;
    const next = () => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random / 4294967296; };
    const sequence = [];
    for (let step = 0; step < 10; step++) {
      const state = game.getAvailableState();
      rooms.add(state.room.symbol);
      const all = generateActions(state), navigation = all.filter(action => action.category === 'navigation');
      const pool = next() < 0.55 && navigation.length ? navigation : all;
      const selected = pool[Math.floor(next() * pool.length)];
      commands.add(selected.command); sequence.push(selected.command);
      const result = game.executeAction(selected.command);
      total++;
      assert.doesNotMatch(result.response, /don't know the word|don't understand that|can't use the word|What do you want to|Which .*do you mean|Please be more specific|not enough nouns/i, `Seed ${seed}: ${sequence.join('; ')}`);
      assert.equal(result.gameOver, false, 'These fixed exploration trajectories should complete ten decisions');
    }
  }
  assert.equal(total, 800);
  console.log(`Trajectory audit: ${total} commands, ${rooms.size} rooms, ${commands.size} distinct commands. Test-only selection sampling does not change menu ordering.`);
});
