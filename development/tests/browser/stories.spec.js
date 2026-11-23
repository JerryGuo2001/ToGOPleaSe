import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { action, reveal, ready, stored } from './menu-helpers.js';

async function choose(page, id) {
  await (await reveal(page, id)).click();
  await ready(page);
}

test('Move, Action and Bag show choices below the story while inventory stays visible; score follows the engine', async ({ page }) => {
  const commands = [];
  await page.addInitScript(() => {
    window.sentCommands = [];
    const send = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (data, ...args) {
      if (data.type === 'execute') window.sentCommands.push(data.command);
      return send.call(this, data, ...args);
    };
  });
  await page.goto('./');
  await expect(page.locator('#story-title')).toHaveText('Zork I');
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#score-max')).toHaveText('/ 350');
  await expect(action(page, 'open_mailbox')).toBeDisabled();
  await page.locator('#start').click();
  const initial = await stored(page);
  await ready(page);
  await expect(page.locator('#empty-bag')).toBeVisible();
  await expect(page.locator('#story-view')).toBeVisible();
  await expect(page.locator('#categories [role="tab"]')).toHaveCount(3);
  await expect(page.locator('#category-move')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.masthead')).toBeHidden();
  await expect(page.locator('.titlebar')).toBeHidden();
  await expect(page.locator('.session-bar')).toBeHidden();
  await page.locator('#bag-view').hover();
  for (const category of ['bag', 'action', 'move']) {
    await page.locator(`#category-${category}`).click();
    await expect(page.locator('#bag-view')).toBeVisible();
    await expect(page.locator('#story-view')).toBeVisible();
    expect(await page.locator('#actions .action:visible').count()).toBeLessThanOrEqual(9);
  }
  const browsed = await stored(page);
  expect(browsed.rows).toEqual(initial.rows);
  expect(browsed.ui_events.map(event => event.category)).toEqual(['bag', 'action', 'move']);
  expect(await page.evaluate(() => window.sentCommands)).toEqual(commands);
  await expect(page.locator('#progress')).toHaveText('Decision 1 / 10');
  await choose(page, 'open_mailbox');
  await choose(page, 'take_advertisement');
  const before = await stored(page);
  const text = await page.locator('#narrative').textContent();
  await expect(page.locator('#inventory')).toContainText('leaflet');
  await expect(await reveal(page, 'read_advertisement')).toBeVisible();
  await expect(action(page, 'inventory')).toHaveCount(0);
  expect((await stored(page)).rows).toEqual(before.rows);
  await expect(page.locator('#narrative')).toHaveText(text);
  for (const id of ['go_north', 'go_east', 'open_kitchen_window', 'go_in']) await choose(page, id);
  await expect(page.locator('#score')).toHaveText('10');
  const rows = (await stored(page)).rows;
  expect(rows).toHaveLength(6);
  expect(rows[0].moves_before).toBe(0);
  expect(rows[2].moves_before).toBe(rows[1].moves_after);
  expect(rows[5].score_after).toBe(10);
  expect(rows[5].menu_category).toBe('move');
  await page.screenshot({ path: 'test-results/desktop-kitchen.png', fullPage: true });
});

test('a JSON-only story uses the same UI, inventory, score and export with isolated recovery', async ({ page }) => {
  await page.goto('./');
  await page.locator('#start').click();
  await choose(page, 'open_mailbox');
  const zork = await stored(page);
  await page.goto('index.html?story=lantern-cove');
  await expect(page.locator('#story-title')).toHaveText('Lantern Cove');
  await expect(page.locator('#recovery')).toBeHidden();
  await page.locator('#start').click();
  for (const id of ['take_key', 'to_cottage', 'take_lantern', 'unlock_door']) await choose(page, id);
  await expect(page.locator('#inventory')).toContainText('Brass key');
  await expect(page.locator('#inventory')).toContainText('Lantern');
  await expect(page.locator('#score')).toHaveText('10');
  const downloadEvent = page.waitForEvent('download');
  await (await reveal(page, 'light_beacon')).click();
  await expect(page.locator('#score')).toHaveText('20');
  await expect(page.locator('#completion-message')).toContainText('game has ended');
  await expect(page.locator('.transcript-entry')).toHaveCount(6);
  await expect(page.locator('.transcript-action').last()).toHaveText('Light the beacon with your lantern');
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^lantern-cove_/);
  const rows = parse(await readFile(await download.path(), 'utf8'), { columns: true });
  expect(rows).toHaveLength(5);
  expect(rows.every(row => row.story_id === 'lantern-cove' && row.game_version === '1.0.0')).toBe(true);
  expect(rows[4].menu_category).toBe('bag');
  expect(rows[4].score_after).toBe('20');
  await page.goto('./');
  await expect(page.locator('#recovery')).toBeVisible();
  expect((await stored(page)).participant_id).toBe(zork.participant_id);
});

test('missing and invalid story folders show a useful error', async ({ page }) => {
  for (const story of ['does-not-exist', '../zork']) {
    await page.goto(`index.html?story=${encodeURIComponent(story)}`);
    await expect(page.locator('#completion')).toBeVisible();
    await expect(page.locator('#story-title')).toHaveText('Story unavailable');
    await expect(page.locator('#completion-message')).toContainText(story === '../zork' ? 'folder name' : 'story.json');
    await expect(page.locator('#start')).toBeHidden();
  }
});

test('mobile category tabs and bag actions below the story work with the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.locator('#start').click();
  await choose(page, 'open_mailbox'); await choose(page, 'take_advertisement');
  await page.locator('#category-action').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#category-bag')).toBeFocused();
  await expect(page.locator('#category-bag')).toHaveAttribute('aria-selected', 'true');
  await expect(action(page, 'read_advertisement')).toBeVisible();
  await page.keyboard.press('Home');
  await expect(page.locator('#category-move')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#category-bag')).toBeFocused();
  await action(page, 'read_advertisement').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#inventory')).toContainText('leaflet');
  await ready(page);
  expect((await stored(page)).rows).toHaveLength(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-bag.png', fullPage: true });
});
