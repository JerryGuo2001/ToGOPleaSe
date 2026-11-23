import { expect } from '@playwright/test';
export const action = (page, id) => page.locator(`[data-action-id="${id}"]`);
export const ready = page => expect(page.locator('#choices')).toHaveAttribute('aria-busy', 'false');
export async function reveal(page, id) {
  const button = action(page, id);
  await expect(button).toBeEnabled();
  if (await button.getAttribute('data-category') === 'bag') {
    while (!await button.isVisible() && await page.locator('#bag-action-next').isEnabled()) await page.locator('#bag-action-next').click();
    while (!await button.isVisible() && await page.locator('#bag-action-previous').isEnabled()) await page.locator('#bag-action-previous').click();
  }
  await expect(button).toBeVisible();
  return button;
}
export const stored = (page, story = 'zork') => page.evaluate(storyId => {
  const prefix = `exploration-task:v2:${storyId}:`;
  const id = sessionStorage.getItem(prefix + 'active') || localStorage.getItem(prefix + 'latest');
  return id ? JSON.parse(localStorage.getItem(prefix + id)) : null;
}, story);
