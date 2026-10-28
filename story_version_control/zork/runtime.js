import ZVM from '../../js/vendor/ifvms/zvm.js';
import { EngineCore, GAME_VERSION, RANDOM_SEED } from './engine.js';
import { generateActions, ACTION_GENERATOR_VERSION } from './action-generator.js';
import { SCHEMA } from './story-schema.js';

export function createRuntime(story) {
  if (story.version !== GAME_VERSION || story.sha256 !== SCHEMA.sha256 || story.randomSeed !== RANDOM_SEED || story.actionPolicyVersion !== ACTION_GENERATOR_VERSION) {
    throw new Error('Zork manifest does not match the pinned story runtime.');
  }
  const engine = new EngineCore(ZVM);
  const withActions = result => ({ ...result, actions: result.gameOver ? [] : generateActions(result.state) });
  return {
    async initialize() {
      const response = await fetch(new URL('./zork1-r119-s880429.z3', import.meta.url));
      if (!response.ok) throw new Error(`Story load failed (${response.status})`);
      return withActions(await engine.initialize(await response.arrayBuffer()));
    },
    executeAction(command) { return withActions(engine.executeAction(command)); },
  };
}
