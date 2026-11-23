import { test, expect } from '@playwright/test';
import { action, reveal, stored } from './menu-helpers.js';

async function expectFits(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const layout = await page.evaluate(() => {
    const visible = element => element.getClientRects().length > 0;
    const outside = [...document.querySelectorAll('button, #score, #bag-view, .story-panel, #completion')].filter(visible).filter(element => {
      const box = element.getBoundingClientRect();
      return box.left < -1 || box.top < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1;
    }).map(element => element.id || element.textContent);
    const clipped = [...document.querySelectorAll('#actions > li, #inventory > li')].filter(visible).filter(element => {
      const box = element.getBoundingClientRect(), parent = element.parentElement.getBoundingClientRect();
      return box.bottom > parent.bottom + 1 || box.right > parent.right + 1;
    }).map(element => element.textContent);
    const scrollable = [...document.querySelectorAll('body *')].filter(visible).filter(element =>
      /auto|scroll/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1
    ).map(element => element.id);
    return { outside, clipped, scrollable, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, innerWidth, innerHeight };
  });
  expect(layout.outside).toEqual([]);
  expect(layout.clipped).toEqual([]);
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
    const welcomeHeight = await page.locator('.titlebar').evaluate(element => element.getBoundingClientRect().height);
    await page.locator('#start').click();
    await expect(page.locator('.category').first()).toBeEnabled();
    expect(await page.locator('.titlebar').evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(welcomeHeight);
    const story = await page.locator('.story-panel').boundingBox();
    const bag = await page.locator('#bag-view').boundingBox();
    const commands = await page.locator('#choices').boundingBox();
    expect(bag.x).toBeGreaterThanOrEqual(story.x + story.width);
    expect(commands.y).toBeGreaterThanOrEqual(story.y + story.height);
    await expect(page.locator('.story-panel #score')).toHaveText('0');
    await expect(page.locator('#action-pages')).toBeHidden();
    await expectFits(page);
    for (const id of ['take_key', 'to_cottage', 'take_lantern', 'unlock_door']) {
      await (await reveal(page, id)).click();
      await expect(page.locator('.category').first()).toBeEnabled();
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

test('long menus and inventories paginate without commands, clipping, or lost options after resize', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.route('**/lantern-cove/story.json', async route => {
    const story = await (await route.fetch()).json();
    story.items = Object.fromEntries(Array.from({ length: 18 }, (_, i) => [`item_${i}`, { name: `Keepsake ${i + 1}`, description: 'A small souvenir from the cove.' }]));
    story.initialInventory = Object.keys(story.items);
    story.rooms = { shore: { name: 'Quiet Shore', text: 'The tide rolls in.', actions: Array.from({ length: 24 }, (_, i) => ({ id: `choice_${i}`, label: `Examine curiosity number ${i + 1}`, text: `You examine curiosity ${i + 1}.` })) } };
    await route.fulfill({ json: story });
  });
  await page.goto('index.html?story=lantern-cove');
  await page.locator('#start').click();
  await page.locator('.category[data-category="action"]').click();
  const before = await stored(page, 'lantern-cove');
  const seenActions = new Set(), seenItems = new Set();
  for (const [selector, next, seen] of [['#actions .action', '#action-next', seenActions], ['#inventory li', '#inventory-next', seenItems]]) {
    do {
      await expectFits(page);
      for (const label of await page.locator(`${selector}:visible`).allTextContents()) seen.add(label);
      if (await page.locator(next).isDisabled()) break;
      await page.locator(next).click();
    } while (true);
  }
  expect(seenActions.size).toBe(24);
  expect(seenItems.size).toBe(18);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#inventory-next')).toBeVisible();
  await expectFits(page);
  expect((await stored(page, 'lantern-cove')).rows).toEqual(before.rows);
  await (await reveal(page, 'choice_23')).click();
  await expect(page.locator('#narrative')).toContainText('curiosity 24');
  await expect(action(page, 'choice_23')).toBeEnabled();
  const after = await stored(page, 'lantern-cove');
  expect(after.rows).toHaveLength(1);
  expect(after.rows[0].performance_presented_ms).toBeLessThanOrEqual(before.ui_events[0].performance_ms);
  expect(after.ui_events.some(event => event.category.startsWith('action:page:'))).toBe(true);
  expect(after.ui_events.some(event => event.category.startsWith('inventory:page:'))).toBe(true);
  await expect(page.locator('#action-pages')).toBeHidden();
  await expectFits(page);
});
