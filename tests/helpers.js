import { readFile } from 'node:fs/promises';
import ZVM from '../vendor/ifvms/src/zvm.js';
import { EngineCore } from '../js/engine-core.js';
import { generateActions } from '../js/action-generator.js';
export async function fresh() {
  const game = new EngineCore(ZVM);
  await game.initialize(await readFile(new URL('../game/zork1-r119-s880429.z3', import.meta.url)));
  return game;
}
export function choose(game, id) {
  const action = generateActions(game.getAvailableState()).find(action => action.id === id);
  if (!action) throw new Error(`Unavailable ${id}: ${generateActions(game.getAvailableState()).map(a => a.id)}`);
  return game.executeAction(action.command);
}
export function ids(game) { return generateActions(game.getAvailableState()).map(a => a.id); }
