import { test, expect } from '@playwright/test';
import { action, reveal, ready, stored } from './menu-helpers.js';

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
    await expect(page.locator('#start')).toBeVisible();
    await expect(page.locator('.titlebar')).toBeVisible();
    await page.locator('#start').click();
    await ready(page);
    for (const selector of ['.masthead', '.titlebar', '.session-bar']) await expect(page.locator(selector)).toBeHidden();
    const story = await page.locator('.story-panel').boundingBox();
    const bag = await page.locator('#bag-view').boundingBox();
    const commands = await page.locator('#choices').boundingBox();
    expect(bag.x).toBeGreaterThanOrEqual(story.x + story.width);
    expect(commands.y).toBeGreaterThanOrEqual(story.y + story.height);
    await expect(page.locator('.story-panel #score')).toHaveText('0');
    await expect(page.locator('#action-pages, #categories')).toHaveCount(0);
    await expectFits(page);
    for (const id of ['take_key', 'to_cottage', 'take_lantern', 'unlock_door']) {
      await (await reveal(page, id)).click();
      await ready(page);
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

test('nine main choices stay visible while bag actions paginate separately and omitted commands are rejected', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.route('**/lantern-cove/story.json', async route => {
    const story = await (await route.fetch()).json();
    story.items = Object.fromEntries(Array.from({ length: 18 }, (_, i) => [`item_${i}`, { name: `Keepsake ${i + 1}`, description: 'A souvenir from the cove.' }]));
    story.initialInventory = Object.keys(story.items);
    story.rooms = { shore: { name: 'Quiet Shore', text: 'The tide rolls in.', actions: [
      ...Array.from({ length: 15 }, (_, i) => ({ id: `look_${i}`, label: `Look at curiosity ${i + 1}`, text: 'Nothing changes.' })),
      ...Array.from({ length: 10 }, (_, i) => ({ id: `change_${i}`, label: `Activate mechanism ${i + 1}`, text: `Mechanism ${i + 1} activated.`, setFlags: [`active_${i}`] })),
      ...Array.from({ length: 12 }, (_, i) => ({ id: `use_${i}`, label: `Use keepsake ${i + 1}`, requiresItems: [`item_${i}`], text: 'Used.' })),
    ] } };
    await route.fulfill({ json: story });
  });
  await page.goto('index.html?story=lantern-cove');
  await page.locator('#start').click();
  await ready(page);
  await expect(page.locator('#actions .action')).toHaveCount(9);
  await expect(page.locator('#bag-actions .action')).toHaveCount(12);
  await expect(action(page, 'look_0')).toHaveCount(0);
  await expect(action(page, 'change_9')).toHaveCount(0);
  const beforePaging = await page.evaluate(() => performance.now());
  const seenItems = new Set(), seenBagActions = new Set();
  for (const [selector, next, seen] of [['#inventory li', '#inventory-next', seenItems], ['#bag-actions .action', '#bag-action-next', seenBagActions]]) {
    do {
      await expectFits(page);
      for (const label of await page.locator(`${selector}:visible`).allTextContents()) seen.add(label);
      if (await page.locator(next).isDisabled()) break;
      await page.locator(next).click();
    } while (true);
  }
  expect(seenItems.size).toBe(18);
  expect(seenBagActions.size).toBe(12);
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await expectFits(page);
    await expect(page.locator('#actions .action:visible')).toHaveCount(9);
    await page.screenshot({ path: `test-results/nine-actions-${viewport.width}.png` });
  }
  expect((await stored(page, 'lantern-cove')).rows).toHaveLength(0);
  const displayed = await page.locator('.action').evaluateAll(buttons => buttons.map(button => button.dataset.actionId));
  await action(page, 'change_8').click();
  await ready(page);
  const after = await stored(page, 'lantern-cove');
  expect(after.rows).toHaveLength(1);
  expect(after.rows[0].available_actions.map(action => action.id)).toEqual(displayed);
  expect(after.rows[0].performance_presented_ms).toBeLessThanOrEqual(beforePaging);
  expect(after.ui_events.some(event => event.category.startsWith('bag:page:'))).toBe(true);
  expect(after.ui_events.some(event => event.category.startsWith('inventory:page:'))).toBe(true);
  const error = await page.evaluate(() => new Promise(resolve => {
    const worker = new Worker('./js/engine-worker.js', { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.requestId === 1) worker.postMessage({ requestId: 2, type: 'execute', actionId: 'look_0', command: 'look_0' });
      else { worker.terminate(); resolve(data.error); }
    };
    worker.postMessage({ requestId: 1, type: 'initialize', storyId: 'lantern-cove' });
  }));
  expect(error).toContain('does not belong to the current menu');
});
