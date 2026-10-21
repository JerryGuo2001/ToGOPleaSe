import { test, expect, chromium } from '@playwright/test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { parse } from 'csv-parse/sync';

// Connect to a separate temporary Chrome profile with no Playwright focus
// emulation. Ordinary Playwright page fixtures force background tabs visible.
// Neither document.hidden nor visibilitychange is overridden in this test.
test('actual tab switches and window minimization flag RT during a complete real-engine session', async ({}, testInfo) => {
  const directory = await mkdtemp(join(tmpdir(), 'zork-native-visibility-'));
  const executable = testInfo.project.use.launchOptions.executablePath || chromium.executablePath();
  const chrome = spawn(executable, [
    `--user-data-dir=${join(directory, 'profile')}`, '--remote-debugging-port=0',
    '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let browser;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Chrome debugging endpoint did not start')), 10000);
      chrome.on('error', error => { clearTimeout(timeout); reject(error); });
      chrome.stderr.on('data', data => {
        output += data;
        const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
    });
    browser = await chromium.connectOverCDP(endpoint, { noDefaults: true });
    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory });
    const action = id => page.locator(`[data-action-id="${id}"]`);
    await page.goto(`${testInfo.project.use.baseURL}exp.html`);
    await page.locator('#start').click();
    await expect(action('look')).toBeEnabled();
    await expect.poll(() => page.evaluate(() => document.hidden)).toBe(false);

    const otherTab = await context.newPage();
    await otherTab.goto('about:blank');
    await otherTab.bringToFront();
    await expect.poll(() => page.evaluate(() => document.hidden)).toBe(true);
    await page.bringToFront();
    await expect.poll(() => page.evaluate(() => document.hidden)).toBe(false);
    await action('open_mailbox').click();
    await expect(action('take_advertisement')).toBeEnabled();

    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
    await expect.poll(() => page.evaluate(() => document.hidden)).toBe(true);
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
    await page.bringToFront();
    await expect.poll(() => page.evaluate(() => document.hidden)).toBe(false);
    await action('take_advertisement').click();
    await expect(action('read_advertisement')).toBeEnabled();
    await action('read_advertisement').click();

    for (let i = 0; i < 7; i++) {
      await expect(action('look')).toBeEnabled();
      await action('look').click();
    }
    await expect(page.locator('#completion-heading')).toHaveText('Session complete');
    await expect.poll(async () => (await readdir(directory)).filter(name => name.endsWith('.csv')).length).toBe(1);
    const filename = (await readdir(directory)).find(name => name.endsWith('.csv'));
    const csv = await readFile(join(directory, filename), 'utf8');
    const rows = parse(csv, { columns: true });
    expect(rows).toHaveLength(10);
    expect(rows[0].visibility_interrupted).toBe('true');
    expect(rows[1].visibility_interrupted).toBe('true');
    expect(rows.slice(2).every(row => row.visibility_interrupted === 'false')).toBe(true);
    expect(rows.every(row => +row.rt_ms >= 0 && row.session_status === 'completed')).toBe(true);
    await testInfo.attach('native-visibility-session.csv', { body: csv, contentType: 'text/csv' });
  } finally {
    await browser?.close();
    if (chrome.exitCode === null) {
      const exited = new Promise(resolve => chrome.once('exit', resolve));
      chrome.kill('SIGTERM');
      await exited;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
