import { expect } from '@playwright/test';
export const action = (page, id) => page.locator(`[data-action-id="${id}"]`);
export const ready = page => expect(page.locator('#choices')).toHaveAttribute('aria-busy', 'false');
export async function openCategory(page, category) {
  await ready(page);
  if (await page.locator('#choices').getAttribute('data-menu') === category) return;
  if (await page.locator('#menu-back').isVisible()) await page.locator('#menu-back').click();
  await page.locator(`#category-${category}`).click();
}
export async function reveal(page, id) {
  const button = action(page, id);
  await expect(button).toBeEnabled();
  await openCategory(page, await button.getAttribute('data-category'));
  await expect(button).toBeVisible();
  return button;
}
export const stored = (page, story = 'zork') => page.evaluate(storyId => {
  const prefix = `exploration-task:v2:${storyId}:`;
  const id = sessionStorage.getItem(prefix + 'active') || localStorage.getItem(prefix + 'latest');
  return id ? JSON.parse(localStorage.getItem(prefix + id)) : null;
}, story);
