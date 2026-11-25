import { test, expect } from '@playwright/test';
import { readInstructions, startAdventure, ready, reveal, stored } from './menu-helpers.js';

for (const viewport of [
  { width: 1280, height: 720 }, { width: 390, height: 844 },
  { width: 320, height: 568 }, { width: 844, height: 390 },
]) {
  test(`centered welcome and separate instruction pages fit at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('index.html?story=lantern-cove');
    await expect(page.locator('#welcome-next')).toBeEnabled();
    await expect(page.locator('#story-title')).toHaveText('Lantern Cove');
    await expect(page.locator('#game')).toBeHidden();
    await expect(page.locator('#start')).toBeHidden();
    await expect(page.locator('#welcome-back')).toBeHidden();
    const count = await page.locator('.instruction-page').count();
    for (let i = 0; i < count; i++) {
      await expect(page.locator('.instruction-page:visible')).toHaveCount(1);
      await expect(page.locator('#instruction-progress')).toHaveText(`${i + 1} / ${count}`);
      const size = await page.locator('.welcome-content').evaluate(element => {
        const box = element.getBoundingClientRect();
        return {
          dx: Math.abs(box.x + box.width / 2 - innerWidth / 2),
          dy: Math.abs(box.y + box.height / 2 - innerHeight / 2),
          overflowX: document.documentElement.scrollWidth - innerWidth,
          overflowY: document.documentElement.scrollHeight - innerHeight,
          aligned: getComputedStyle(element).textAlign,
        };
      });
      expect(size.dx).toBeLessThan(2);
      expect(size.dy).toBeLessThan(2);
      expect(size.overflowX).toBeLessThanOrEqual(0);
      expect(size.overflowY).toBeLessThanOrEqual(0);
      expect(size.aligned).toBe('center');
      expect(await stored(page, 'lantern-cove')).toBeNull();
      await page.screenshot({ path: `test-results/welcome-${viewport.width}-page-${i + 1}.png` });
      if (i < count - 1) {
        await expect(page.locator('#start')).toBeHidden();
        await page.locator('#welcome-next').click();
      }
    }
    await expect(page.locator('#welcome-next')).toBeHidden();
    await expect(page.locator('#start')).toBeEnabled();
    await page.locator('#welcome-back').click();
    await expect(page.locator('#instruction-progress')).toHaveText(`3 / ${count}`);
    await expect(page.locator('#start')).toBeHidden();
    await expect(page.locator('#story-guide-heading')).toBeFocused();
    await page.locator('#welcome-next').click();
    await expect(page.locator('#start')).toBeEnabled();
    await expect(page.locator('#game')).toBeHidden();
  });
}

test('Start enters actual browser fullscreen and the game remains usable after fullscreen exits', async ({ page }) => {
  await page.goto('index.html');
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  await startAdventure(page);
  expect(await page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
  await expect(page.locator('#welcome')).toBeHidden();
  await expect(page.locator('#categories button:visible')).toHaveCount(3);
  await page.evaluate(() => document.exitFullscreen());
  await (await reveal(page, 'open_mailbox')).click();
  await ready(page);
  expect((await stored(page)).rows).toHaveLength(1);
});

test('fullscreen transition finishes before session timing starts and repeated Start cannot start twice', async ({ page }) => {
  await page.addInitScript(() => {
    window.fullscreenRequests = 0;
    Element.prototype.requestFullscreen = options => {
      window.fullscreenRequests++;
      window.fullscreenOptions = options;
      window.hadUserActivation = navigator.userActivation.isActive;
      return new Promise(resolve => { window.finishFullscreen = () => { window.fullscreenSettledAt = performance.now(); resolve(); }; });
    };
  });
  await page.goto('index.html');
  await readInstructions(page);
  await page.locator('#start').click();
  await expect(page.locator('#start')).toBeDisabled();
  await expect(page.locator('#welcome-back')).toBeDisabled();
  await expect(page.locator('#game')).toBeHidden();
  expect(await stored(page)).toBeNull();
  await page.evaluate(() => document.getElementById('start').dispatchEvent(new MouseEvent('click')));
  expect(await page.evaluate(() => window.fullscreenRequests)).toBe(1);
  expect(await page.evaluate(() => window.hadUserActivation)).toBe(true);
  expect(await page.evaluate(() => window.fullscreenOptions)).toEqual({ navigationUI: 'hide' });
  await page.evaluate(() => window.finishFullscreen());
  await ready(page);
  await (await reveal(page, 'open_mailbox')).click();
  await ready(page);
  const session = await stored(page);
  expect(session.rows).toHaveLength(1);
  expect(session.rows[0].performance_presented_ms).toBeGreaterThanOrEqual(await page.evaluate(() => window.fullscreenSettledAt));
});

for (const mode of ['unavailable', 'denied']) {
  test(`fullscreen ${mode} still starts the game in the available viewport`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(mode => {
      Element.prototype.requestFullscreen = mode === 'unavailable' ? undefined : () => Promise.reject(new Error('Fullscreen denied'));
    }, mode);
    await page.goto('index.html');
    await startAdventure(page);
    await expect(page.locator('#game')).toBeVisible();
    await expect(page.locator('#welcome')).toBeHidden();
    await (await reveal(page, 'open_mailbox')).click();
    await ready(page);
    expect((await stored(page)).rows).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}
