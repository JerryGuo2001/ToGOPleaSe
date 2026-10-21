import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { COLUMNS } from '../../js/data-export.js';

const action = (page, id) => page.locator(`[data-action-id="${id}"]`);
const stored = page => page.evaluate(() => {
  const key = Object.keys(localStorage).find(key => /^zork-experiment:v1:[0-9a-f-]{36}$/.test(key));
  return key ? JSON.parse(localStorage.getItem(key)) : null;
});
async function start(page) {
  await page.goto('exp.html');
  await page.locator('#start').click();
  await expect(action(page, 'look')).toBeEnabled();
}
async function choose(page, id) {
  await action(page, id).click();
  await expect(action(page, 'look')).toBeEnabled();
}

test('complete ten-decision session downloads exact displayed menus and original text', async ({ page }) => {
  await start(page);
  const sequence = ['open_mailbox', 'take_advertisement', 'read_advertisement', 'close_mailbox', 'go_north', 'go_east', 'open_kitchen_window', 'go_in', 'go_west', 'take_lamp'];
  const expected = [];
  const downloadEvent = page.waitForEvent('download');
  for (let i = 0; i < sequence.length; i++) {
    await expect(action(page, sequence[i])).toBeEnabled();
    const snapshot = await page.evaluate(() => ({
      narrative: document.getElementById('narrative').textContent,
      actions: [...document.querySelectorAll('.action')].map(button => ({ id: button.dataset.actionId, label: button.textContent })),
    }));
    expected.push(snapshot);
    await action(page, sequence[i]).click();
  }
  await expect(page.locator('#completion-heading')).toHaveText('Session complete');
  await expect(page.locator('.action')).toHaveCount(0);
  const download = await downloadEvent;
  const csv = await readFile(await download.path(), 'utf8');
  const rows = parse(csv, { columns: true });
  expect(rows).toHaveLength(10);
  expect(Object.keys(rows[0])).toEqual(COLUMNS);
  expect(download.suggestedFilename()).toBe(`zork_${rows[0].participant_id}.csv`);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    expect(+row.step).toBe(i + 1);
    expect(row.selected_action_id).toBe(sequence[i]);
    expect(row.game_text_before).toBe(expected[i].narrative);
    expect(JSON.parse(row.available_actions).map(({ id, label }) => ({ id, label }))).toEqual(expected[i].actions);
    expect(+row.rt_ms).toBeGreaterThanOrEqual(0);
    expect(+row.rt_ms).toBeCloseTo(+row.performance_clicked_ms - +row.performance_presented_ms, 5);
    expect(+row.processing_ms).toBeCloseTo(+row.performance_response_ms - +row.performance_clicked_ms, 5);
    expect(Date.parse(row.timestamp_response)).toBeGreaterThanOrEqual(Date.parse(row.timestamp_clicked));
    expect(row.session_status).toBe('completed');
    if (i) expect(row.game_text_before).toBe(rows[i - 1].game_text_after);
  }
  expect(rows[9].game_text_after).toBe(await page.locator('#narrative').textContent());
  expect(JSON.parse(rows[9].inventory_after).map(item => item.symbol)).toContain('LAMP');
  const repeatEvent = page.waitForEvent('download');
  await page.locator('#download').click();
  expect(await readFile(await (await repeatEvent).path(), 'utf8')).toBe(csv);
  const detailEvent = page.waitForEvent('download');
  await page.locator('#details-download').click();
  const metadata = JSON.parse(await readFile(await (await detailEvent).path(), 'utf8'));
  expect(metadata.completed_decisions).toBe(10);
  expect(metadata.status).toBe('completed');
  expect((await stored(page)).rows).toHaveLength(10);
});

test('slow actual worker command locks clicks and does not contaminate reaction time', async ({ page }) => {
  await page.addInitScript(() => {
    const send = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (data, ...args) {
      if (data.type === 'execute') setTimeout(() => send.call(this, data, ...args), 250);
      else send.call(this, data, ...args);
    };
  });
  await start(page);
  await action(page, 'open_mailbox').dblclick();
  await expect(action(page, 'look')).toBeDisabled();
  await expect(action(page, 'take_advertisement')).toBeEnabled();
  const session = await stored(page);
  expect(session.rows).toHaveLength(1);
  expect(session.rows[0].processing_ms).toBeGreaterThanOrEqual(250);
  expect(session.rows[0].rt_ms).toBeCloseTo(session.rows[0].performance_clicked_ms - session.rows[0].performance_presented_ms, 5);
  await action(page, 'take_advertisement').focus();
  await page.keyboard.press('Enter');
  await expect(action(page, 'drop_advertisement')).toBeEnabled();
  expect((await stored(page)).rows).toHaveLength(2);
});

test('visibility events flag a choice and a hidden menu waits to activate', async ({ page }) => {
  await start(page);
  // Browser event-path test: override visibility in this test page only.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await action(page, 'open_mailbox').click();
  await expect(action(page, 'take_advertisement')).toBeDisabled();
  expect((await stored(page)).rows[0].visibility_interrupted).toBe(true);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(action(page, 'take_advertisement')).toBeEnabled();
  await choose(page, 'take_advertisement');
  expect((await stored(page)).rows[1].visibility_interrupted).toBe(false);
});

test('refresh preserves interrupted CSV and starts a fresh story with a new ID', async ({ page }) => {
  await start(page);
  await choose(page, 'open_mailbox');
  const prior = await stored(page);
  await page.reload();
  await expect(page.locator('#start')).toBeVisible();
  await expect(page.locator('#recovery-message')).toContainText('interrupted');
  const recoveryDownload = page.waitForEvent('download');
  await page.locator('#recover-download').click();
  const rows = parse(await readFile(await (await recoveryDownload).path(), 'utf8'), { columns: true });
  expect(rows).toHaveLength(1);
  expect(rows[0].participant_id).toBe(prior.participant_id);
  expect(rows[0].session_status).toBe('early_termination');
  await page.locator('#start').click();
  await choose(page, 'look');
  const active = await page.evaluate(() => {
    const id = sessionStorage.getItem('zork-experiment:v1:active');
    return JSON.parse(localStorage.getItem(`zork-experiment:v1:${id}`));
  });
  expect(active.participant_id).not.toBe(prior.participant_id);
  expect(active.rows).toHaveLength(1);
  expect(active.rows[0].game_text_after).toContain('There is a small mailbox here.');
  await expect(action(page, 'open_mailbox')).toBeVisible();
  await expect(action(page, 'take_advertisement')).toHaveCount(0);
});

test('corrupt story fails closed and offers zero-row CSV plus error metadata', async ({ page }) => {
  await page.route('**/*.z3', route => route.fulfill({ body: 'wrong story', contentType: 'application/octet-stream' }));
  const downloaded = page.waitForEvent('download');
  await page.goto('exp.html');
  await expect(page.locator('#completion-heading')).toHaveText('Session ended early');
  expect(parse(await readFile(await (await downloaded).path(), 'utf8'), { columns: true })).toHaveLength(0);
  const metadataEvent = page.waitForEvent('download');
  await page.locator('#details-download').click();
  const metadata = JSON.parse(await readFile(await (await metadataEvent).path(), 'utf8'));
  expect(metadata.termination_reason).toBe('initialization_error');
  expect(metadata.error).toContain('Story hash mismatch');
});

test('responsive keyboard interface has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await action(page, 'open_mailbox').focus();
  await page.keyboard.press('Enter');
  await expect(action(page, 'take_advertisement')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-mailbox.png', fullPage: true });
});
