import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '..');
const build = process.env.GAME_TEST_BUILD_DIR;
const reports = process.env.GAME_TEST_ARTIFACT_DIR;
const mode = process.env.GAME_G026_MODE;
const origin = process.env.GAME_G026_ORIGIN;
const list = process.env.GAME_G026_LIST === '1';
if (!build || !/^artifacts\/g027-build(?:-[A-Za-z0-9_-]+)?$/.test(build)) throw new Error('BLOCKED: explicit G026 candidate build required');
if (!reports || !/^artifacts\/g027-builder\/runs\/[a-f0-9]{8}\/(discovery|execution)$/.test(reports)) throw new Error('BLOCKED: fresh child-owned report path required');
if (!['smoke', 'full'].includes(mode ?? '') || origin !== 'http://127.0.0.1:3171' || process.env.GAME_LIVE_ORIGIN) throw new Error('BLOCKED: only explicit candidate3171 smoke/full authorized');
if (list !== reports.endsWith('/discovery')) throw new Error('BLOCKED: discovery is not execution');
if (!list && process.env.GAME_G026_BROWSER_GATE !== 'Local\\SimpleGamesG026BrowserGate') throw new Error('BLOCKED: use the G026 Win32 HANDLE runner');
const verifier = await import(pathToFileURL(resolve(root, 'scripts/g026-verify.mjs')).href);
await verifier.assertReady(root, build);
await verifier.guarded(root, reports);
export default defineConfig({
  testDir: resolve(root, 'tests/e2e'),
  testMatch: mode === 'smoke' ? ['g026-new-games.spec.ts', 'live-server.spec.ts'] : verifier.SPECS,
  ...(mode === 'smoke' ? { grep: /@smoke|G022-LIVE01|G022-LIVE03/ } : {}),
  fullyParallel: false, workers: 1, retries: 0, timeout: 45_000, expect: { timeout: 5_000 },
  outputDir: resolve(root, reports, 'test-results'),
  reporter: [['list'], ['json', { outputFile: resolve(root, reports, list ? 'discovery.json' : 'playwright-results.json') }]],
  use: { baseURL: origin, locale: 'ko-KR', trace: 'retain-on-failure', screenshot: 'off', video: 'off' },
  // Runner alone owns its loopback server. Never reuse a service or start3116.
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 320, height: 667 } } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], viewport: { width: 320, height: 667 } } },
  ],
});
