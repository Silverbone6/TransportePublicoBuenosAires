import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const directory = process.env.TRAMA_E2E_DATA_DIR || mkdtempSync(path.join(tmpdir(), 'trama-e2e-'));
process.env.TRAMA_E2E_DATA_DIR = directory;
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 35000,
  fullyParallel: false,
  workers: 1,
  globalTeardown: './tests/e2e/cleanup.js',
  use: { baseURL: 'http://127.0.0.1:5174', viewport: { width: 1440, height: 960 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --port 5174 --strictPort', url: 'http://127.0.0.1:5174', reuseExistingServer: false, env: { TRAMA_DATA_DIR: directory } },
});
