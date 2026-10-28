import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const build = process.env.GAME_TEST_BUILD_DIR;
const reports = process.env.GAME_TEST_ARTIFACT_DIR;
const target = process.env.GAME_G024_TARGET;
const mode = process.env.GAME_G024_MODE;
const origin = process.env.GAME_G024_ORIGIN;
if (build !== 'artifacts/g024-build') throw new Error('G024 requires the explicit current-task build.');
if (!reports || !/^artifacts\/g024-integration\/runs\/[A-Za-z0-9_-]+$/.test(reports)) throw new Error('G024 requires a fresh task-owned report directory.');
if (!['candidate', 'live'].includes(target ?? '') || !['smoke', 'full'].includes(mode ?? '')) throw new Error('Explicit G024 target/mode required.');
if (origin !== (target === 'candidate' ? 'http://127.0.0.1:3145' : 'http://192.168.0.195:3116')) throw new Error('Origin is not authorized for this mode.');
if (process.env.GAME_G024_BROWSER_GATE !== 'Local\\HermesG024BrowserGate') throw new Error('Run through the named Win32 browser gate.');
const list = process.env.GAME_G024_LIST === '1';
export default defineConfig({
  testDir: resolve(root, 'tests/e2e'),
  testMatch: mode === 'smoke'
    ? ['g024-new-games.spec.ts', 'runner-jumper.spec.ts', 'live-server.spec.ts']
    : target === 'live'
      ? ['live-server.spec.ts', 'runner-jumper.spec.ts', 'flappy-input.spec.ts', 'g024-new-games.spec.ts']
      : ['live-server.spec.ts', 'library-integration.spec.ts', 'multi-game-integration.spec.ts', 'breakout-integration.spec.ts', 'runner-jumper.spec.ts', 'flappy-input.spec.ts', 'g024-new-games.spec.ts'],
  ...(mode === 'smoke' ? { grep: /@smoke|G022-LIVE01|G022-LIVE03/ } : {}),
  fullyParallel: false, workers: 1, retries: 0, timeout: 40000, expect: { timeout: 5000 },
  outputDir: resolve(root, reports, list ? 'discovery-results' : 'test-results'),
  reporter: [['list'], ['json', { outputFile: resolve(root, reports, list ? 'discovery.json' : 'playwright-results.json') }]],
  use: { baseURL: origin, locale: 'ko-KR', trace: 'retain-on-failure', screenshot: 'off', video: 'off' },
  // No webServer: candidate lifecycle belongs to the runner; live has NO lifecycle actions.
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 320, height: 667 } } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
  ],
});
