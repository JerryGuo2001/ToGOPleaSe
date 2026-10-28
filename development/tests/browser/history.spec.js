import { test, expect } from '@playwright/test';
import { action, reveal, stored } from './menu-helpers.js';

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`story history retains actions and responses with free scrollback at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('index.html');
    await expect(page.locator('#start')).toBeVisible();
    const opening = await page.locator('#narrative').textContent();
    await expect(page.locator('.transcript-entry')).toHaveCount(1);
    await page.locator('#start').click();
    await expect(action(page, 'look')).toBeEnabled();
    await expect(page.locator('.transcript-entry')).toHaveCount(1);
    for (const id of ['open_mailbox', 'take_advertisement', 'read_advertisement', 'look']) {
      await (await reveal(page, id)).click();
      await expect(action(page, 'look')).toBeEnabled();
    }
    const before = await stored(page);
    await expect(page.locator('.transcript-entry')).toHaveCount(5);
    expect(await page.locator('.story-response').allTextContents()).toEqual([opening, ...before.rows.map(row => row.game_text_after)]);
    expect(await page.locator('.transcript-action').allTextContents()).toEqual(before.rows.map(row => row.selected_action_label));
    await expect(page.locator('#narrative')).toHaveCount(1);
    await expect(page.locator('#narrative')).toHaveText(before.rows.at(-1).game_text_after);
    const transcript = page.locator('#transcript');
    expect(await transcript.evaluate(el => el.scrollHeight > el.clientHeight && el.scrollTop > 0)).toBe(true);
    // Participants can use the keyboard to scroll back inside the story panel.
    await transcript.focus();
    await page.keyboard.press('Home');
    await expect.poll(() => transcript.evaluate(el => el.scrollTop)).toBe(0);
    await expect(page.locator('.story-response').first()).toBeInViewport();
    await page.locator('.category[data-category="bag"]').click();
    await expect(page.locator('#inventory')).toContainText('leaflet');
    await page.locator('#menu-back').click();
    expect(await transcript.evaluate(el => el.scrollTop)).toBe(0);
    await page.locator('#latest-response').click();
    expect(await transcript.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await expect(page.locator('.transcript-action').last()).toBeInViewport();
    expect((await stored(page)).rows).toEqual(before.rows);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/history-${viewport.width}.png`, fullPage: true });
  });
}
