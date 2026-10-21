import ZVM from '../vendor/ifvms/zvm.js';
import { EngineCore } from './engine-core.js';
import { generateActions } from './action-generator.js';

const engine = new EngineCore(ZVM);
let choices = [];
let initialized = false;
self.onmessage = async ({ data }) => {
  try {
    let result;
    if (data.type === 'initialize' && !initialized) {
      initialized = true;
      const response = await fetch(new URL('../game/zork1-r119-s880429.z3', import.meta.url));
      if (!response.ok) throw new Error(`Story load failed (${response.status})`);
      result = await engine.initialize(await response.arrayBuffer());
    } else if (data.type === 'execute' && initialized) {
      const selected = choices.find(action => action.id === data.actionId && action.command === data.command);
      if (!selected) throw new Error('Action does not belong to the current menu');
      result = engine.executeAction(selected.command);
    } else throw new Error('Invalid engine request');
    choices = result.gameOver ? [] : generateActions(result.state);
    self.postMessage({ requestId: data.requestId, result: { ...result, actions: choices } });
  } catch (error) {
    self.postMessage({ requestId: data.requestId, error: String(error.message || error) });
  }
};
