export function storyURL(id) {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) throw new Error('Use a story folder name containing lowercase letters, numbers, hyphens or underscores.');
  return new URL(`../story_version_control/${id}/story.json`, import.meta.url);
}

export async function loadStory(id) {
  const url = storyURL(id);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load story “${id}” (${response.status}). Check its story.json file.`);
  const text = await response.text();
  const story = JSON.parse(text);
  if (story.id !== id || !story.title || !story.version) throw new Error('story.json requires a matching id, a title and a version.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  let runtime;
  if (story.engine === 'text') {
    const { TextEngine } = await import('./text-engine.js');
    const engine = new TextEngine(story);
    runtime = { initialize: () => engine.initialize(), executeAction: command => engine.executeAction(command) };
  } else if (story.engine === 'z-machine') {
    const { createRuntime } = await import(new URL('./runtime.js', url).href);
    runtime = createRuntime(story);
  } else throw new Error(`Unsupported story engine: ${story.engine}`);
  return {
    runtime,
    metadata: {
      id, title: story.title, subtitle: story.subtitle || 'An interactive story',
      game_version: story.version, story_sha256: story.sha256 || hash, manifest_sha256: hash,
      action_generator_version: story.actionPolicyVersion || 'text-1.0.0',
      interpreter_version: story.interpreterVersion || 'text-engine 1.0.0',
      random_seed: story.randomSeed ?? null, max_score: story.maxScore ?? null,
    },
  };
}
