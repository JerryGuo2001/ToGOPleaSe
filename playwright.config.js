import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.CHROME_PATH || (existsSync(macChrome) ? macChrome : undefined);
export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8000/ToGOPleaSe/',
    browserName: 'chromium',
    launchOptions: { executablePath },
  },
  webServer: {
    command: 'BASE_PATH=/ToGOPleaSe node tools/serve.js',
    url: 'http://127.0.0.1:8000/ToGOPleaSe/exp.html',
    reuseExistingServer: false,
  },
});
