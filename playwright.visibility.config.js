import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

// Requires a graphical desktop. Kept separate from headless CI coverage.
export default defineConfig({
  ...base,
  testDir: './tests/native-browser',
  use: { ...base.use, headless: false, baseURL: 'http://127.0.0.1:8002/ToGOPleaSe/' },
  webServer: {
    command: 'PORT=8002 BASE_PATH=/ToGOPleaSe node tools/serve.js',
    url: 'http://127.0.0.1:8002/ToGOPleaSe/exp.html',
    reuseExistingServer: false,
  },
});
