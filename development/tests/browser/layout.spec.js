import { test, expect } from '@playwright/test';
import { startAdventure, action, reveal, ready, stored, openCategory } from './menu-helpers.js';

async function expectFits(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const layout = await page.evaluate(() => {
    const visible = element => element.getClientRects().length > 0;
    const outside = [...document.querySelectorAll('button, #score, #bag-view, .story-panel, #completion')].filter(visible).filter(element => {
      const box = element.getBoundingClientRect();
      return box.left < -1 || box.top < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1;
    }).map(element => element.id || element.textContent);
    const clipped = [...document.querySelectorAll('.action-list > li, #inventory > li')].filter(visible).filter(element => {
      const box = element.getBoundingClientRect(), parent = element.parentElement.getBoundingClientRect();
      return box.bottom > parent.bottom + 1 || box.right > parent.right + 1;
    }).map(element => element.textContent);
    const scrollable = [...document.querySelectorAll('body *')].filter(visible).filter(element =>
      /auto|scroll/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1
    ).map(element => element.id);
    const clippedLabels = [...document.querySelectorAll('.action')].filter(visible).filter(button => {
      const range = document.createRange(); range.selectNodeContents(button);
      const text = range.getBoundingClientRect(), box = button.getBoundingClientRect();
      return text.top < box.top || text.bottom > box.bottom || text.left < box.left || text.right > box.right;
    }).map(button => button.textContent);
    return { outside, clipped, clippedLabels, scrollable, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, innerWidth, innerHeight };
  });
  expect(layout.outside).toEqual([]);
  expect(layout.clipped).toEqual([]);
  expect(layout.clippedLabels).toEqual([]);
  expect(layout.scrollable.filter(id => id !== 'transcript')).toEqual([]);
  expect(layout.width).toBeLessThanOrEqual(layout.innerWidth);
  expect(layout.height).toBeLessThanOrEqual(layout.innerHeight);
  expect(await page.locator('#transcript').evaluate(element => element.clientHeight)).toBeGreaterThanOrEqual(48);
}

for (const viewport of [
  { width: 1440, height: 900 }, { width: 1366, height: 768 },
  { width: 1280, height: 720 }, { width: 1024, height: 600 },
  { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 },
]) {
  test(`story, commands and persistent bag fit at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('index.html?story=lantern-cove');
    await expect(page.locator('#welcome-next')).toBeEnabled();
    await expect(page.locator('#welcome')).toBeVisible();
    await startAdventure(page);
    await ready(page);
    await expect(page.locator('#welcome')).toBeHidden();
    const story = await page.locator('.story-panel').boundingBox();
    const bag = await page.locator('#bag-view').boundingBox();
    const commands = await page.locator('#choices').boundingBox();
    expect(bag.x).toBeGreaterThanOrEqual(story.x + story.width);
    expect(commands.y).toBeGreaterThanOrEqual(story.y + story.height);
    await expect(page.locator('.story-panel #score')).toHaveText('0');
    await expect(page.locator('#action-pages, #bag-action-pages, #bag-actions')).toHaveCount(0);
    await expect(page.locator('#categories button:visible')).toHaveCount(3);
    await expect(page.locator('#action-panel')).toBeHidden();
    await expectFits(page);
    await page.screenshot({ path: `test-results/categories-${viewport.width}x${viewport.height}.png` });
    for (const id of ['take_key', 'to_cottage', 'take_lantern', 'unlock_door']) {
      const choice = await reveal(page, id);
      await expect(page.locator('#menu-back')).toBeVisible();
      await expectFits(page);
      await choice.click();
      await ready(page);
      await expect(page.locator('#categories button:visible')).toHaveCount(3);
      await expect(page.locator('#action-panel')).toBeHidden();
      await expect(page.locator('#bag-view')).toBeVisible();
      await expect(page.locator('#story-view')).toBeVisible();
      await expectFits(page);
    }
    await expect(page.locator('#inventory')).toContainText('Brass key');
    await expect(page.locator('#inventory')).toContainText('Lantern');
    await expect(page.locator('#score')).toHaveText('10');
    await page.screenshot({ path: `test-results/layout-${viewport.width}x${viewport.height}.png` });
    await (await reveal(page, 'light_beacon')).click();
    await expect(page.locator('#completion')).toBeVisible();
    await expect(page.locator('#score')).toHaveText('20');
    await page.screenshot({ path: `test-results/completion-${viewport.width}x${viewport.height}.png` });
    await expectFits(page);
  });
}

test('each submenu shows nine choices and a separate Back card, preserves RT, and rejects omitted commands', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.route('**/lantern-cove/story.json', async route => {
    const story = await (await route.fetch()).json();
    story.items = Object.fromEntries(Array.from({ length: 18 }, (_, i) => [`item_${i}`, { name: `Keepsake ${i + 1}`, description: 'A souvenir from the cove.' }]));
    story.initialInventory = Object.keys(story.items);
    story.rooms = { shore: { name: 'Quiet Shore', text: 'The tide rolls in.', actions: [
      ...Array.from({ length: 10 }, (_, i) => ({ id: `move_${i}`, label: `Take passage ${i + 1}`, category: 'navigation', to: 'trail' })),
      ...Array.from({ length: 15 }, (_, i) => ({ id: `look_${i}`, label: `Look at curiosity ${i + 1}`, text: 'Nothing changes.' })),
      ...Array.from({ length: 10 }, (_, i) => ({ id: `change_${i}`, label: `Activate mechanism ${i + 1}`, text: `Mechanism ${i + 1} activated.`, setFlags: [`active_${i}`] })),
      ...Array.from({ length: 12 }, (_, i) => ({ id: `inspect_${i}`, label: `Inspect keepsake ${i + 1}`, requiresItems: [`item_${i}`], text: 'Unchanged.' })),
      ...Array.from({ length: 12 }, (_, i) => ({ id: `use_${i}`, label: `Use keepsake ${i + 1}`, requiresItems: [`item_${i}`], setFlags: [`used_${i}`], text: 'Used.' })),
    ] }, trail: { name: 'Trail', text: 'A trail.', actions: [{ id: 'return', label: 'Return', to: 'shore' }] } };
    await route.fulfill({ json: story });
  });
  await page.goto('index.html?story=lantern-cove');
  await startAdventure(page);
  await ready(page);
  await expect(page.locator('#actions .action')).toHaveCount(27);
  for (const category of ['move', 'action', 'bag']) await expect(page.locator(`#actions .action[data-category="${category}"]`)).toHaveCount(9);
  await expect(action(page, 'look_0')).toHaveCount(0);
  await expect(action(page, 'inspect_0')).toHaveCount(0);
  await expect(action(page, 'move_9')).toHaveCount(0);
  await expect(action(page, 'change_9')).toHaveCount(0);
  await expect(action(page, 'use_9')).toHaveCount(0);
  const beforeBrowsing = await page.evaluate(() => performance.now());
  const seenItems = new Set();
  do {
    await expectFits(page);
    for (const label of await page.locator('#inventory li:visible').allTextContents()) seenItems.add(label);
    if (await page.locator('#inventory-next').isDisabled()) break;
    await page.locator('#inventory-next').click();
  } while (true);
  expect(seenItems.size).toBe(18);
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    for (const category of ['move', 'action', 'bag']) {
      await openCategory(page, category);
      await expect(page.locator('#categories')).toBeHidden();
      await expect(page.locator('#menu-back.menu-card')).toBeVisible();
      await expect(page.locator('#actions .action:visible')).toHaveCount(9);
      await expect(page.locator(`#actions .action[data-category="${category}"]:visible`)).toHaveCount(9);
      await expectFits(page);
      await page.screenshot({ path: `test-results/nine-${category}-${viewport.width}.png` });
      await page.locator('#menu-back').click();
      await expect(page.locator(`#category-${category}`)).toBeFocused();
      await expect(page.locator('#actions .action:visible')).toHaveCount(0);
      await expect(page.locator('#categories button:visible')).toHaveCount(3);
      await expectFits(page);
    }
  }
  expect((await stored(page, 'lantern-cove')).rows).toHaveLength(0);
  const displayed = await page.locator('.action').evaluateAll(buttons => buttons.map(button => button.dataset.actionId));
  await (await reveal(page, 'change_8')).click();
  await ready(page);
  await expect(page.locator('#categories button:visible')).toHaveCount(3);
  const after = await stored(page, 'lantern-cove');
  expect(after.rows).toHaveLength(1);
  expect(after.rows[0].available_actions.map(action => action.id)).toEqual(displayed);
  expect(after.rows[0].performance_presented_ms).toBeLessThanOrEqual(beforeBrowsing);
  for (const category of ['move', 'action', 'bag']) expect(after.ui_events.some(event => event.category === category)).toBe(true);
  expect(after.ui_events.some(event => event.category === 'categories')).toBe(true);
  expect(after.ui_events.some(event => event.category.startsWith('inventory:page:'))).toBe(true);
  const errors = await page.evaluate(() => new Promise(resolve => {
    const omitted = ['look_0', 'inspect_0', 'move_9', 'change_9', 'use_9'], errors = [];
    const worker = new Worker('./js/engine-worker.js', { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.requestId > 1) errors.push(data.error);
      if (errors.length === omitted.length) { worker.terminate(); resolve(errors); return; }
      const id = omitted[errors.length];
      worker.postMessage({ requestId: data.requestId + 1, type: 'execute', actionId: id, command: id });
    };
    worker.postMessage({ requestId: 1, type: 'initialize', storyId: 'lantern-cove' });
  }));
  for (const error of errors) expect(error).toContain('does not belong to the current menu');
});
