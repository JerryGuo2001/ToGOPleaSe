import { readFile } from 'node:fs/promises';
import ZVM from '../../js/vendor/ifvms/src/zvm.js';
import { EngineCore } from '../../story_version_control/zork/engine.js';
import { generateActions } from '../../story_version_control/zork/action-generator.js';
export async function fresh() {
  const game = new EngineCore(ZVM);
  await game.initialize(await readFile(new URL('../../story_version_control/zork/zork1-r119-s880429.z3', import.meta.url)));
  return game;
}
export function choose(game, id) {
  const action = generateActions(game.getAvailableState()).find(action => action.id === id);
  if (!action) throw new Error(`Unavailable ${id}: ${generateActions(game.getAvailableState()).map(a => a.id)}`);
  return game.executeAction(action.command);
}
export function ids(game) { return generateActions(game.getAvailableState()).map(a => a.id); }
