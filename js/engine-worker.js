import { loadStory } from './story-loader.js';

let runtime, metadata;
let choices = [];
let initialized = false;
self.onmessage = async ({ data }) => {
  try {
    let result;
    if (data.type === 'initialize' && !initialized) {
      initialized = true;
      ({ runtime, metadata } = await loadStory(data.storyId));
      result = await runtime.initialize();
    } else if (data.type === 'execute' && runtime) {
      const selected = choices.find(action => action.id === data.actionId && action.command === data.command);
      if (!selected) throw new Error('Action does not belong to the current menu');
      result = await runtime.executeAction(selected.command);
    } else throw new Error('Invalid engine request');
    choices = result.gameOver ? [] : result.actions;
    self.postMessage({ requestId: data.requestId, result: { ...result, story: metadata, actions: choices } });
  } catch (error) {
    self.postMessage({ requestId: data.requestId, error: String(error.message || error) });
  }
};
