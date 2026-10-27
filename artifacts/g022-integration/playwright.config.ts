import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
// Set in the PARENT by run-playwright.mjs, before any selected spec is imported.
const build = process.env.GAME_TEST_BUILD_DIR;
const reports = process.env.GAME_TEST_ARTIFACT_DIR;
if (!build || !/^artifacts\/g022-[A-Za-z0-9_-]+$/.test(build))
  throw new Error('Explicit relative new G022 build path is required before starting the child.');
if (!reports || !/^artifacts\/g022-integration\/runs\/[A-Za-z0-9_-]+\/(candidate|live)$/.test(reports))
  throw new Error('Explicit fresh task-owned report path is required before starting the child.');
const mode = process.env.GAME_G022_MODE;
if (mode !== 'candidate' && mode !== 'live') throw new Error('GAME_G022_MODE must be candidate or live.');
const phase = process.env.GAME_G022_PHASE;
if (phase !== 'smoke' && phase !== 'full') throw new Error('GAME_G022_PHASE must be smoke or full.');
const requested = process.env.GAME_LIVE_ORIGIN;
if (mode === 'candidate' && requested) throw new Error('Candidate collection must not inherit GAME_LIVE_ORIGIN.');
if (mode === 'live' && requested !== 'http://192.168.0.195:3116')
  throw new Error('Live inspection requires explicit GAME_LIVE_ORIGIN=http://192.168.0.195:3116.');
const origin = mode === 'live' ? requested! : 'http://127.0.0.1:3130';

export default defineConfig({
  testDir: resolve(root, 'tests/e2e'),
  testMatch: phase === 'smoke' ? ['runner-jumper.spec.ts'] : mode === 'live'
    ? ['live-server.spec.ts', 'flappy-input.spec.ts', 'runner-jumper.spec.ts']
    : ['live-server.spec.ts', 'flappy-input.spec.ts', 'runner-jumper.spec.ts',
      'library-integration.spec.ts', 'multi-game-integration.spec.ts', 'breakout-integration.spec.ts'],
  ...(phase === 'smoke' ? { grep: /@smoke/ } : {}),
  fullyParallel: false, workers: 1, retries: 0, timeout: 40000, expect: { timeout: 5000 },
  globalSetup: resolve(import.meta.dirname, 'readiness.mjs'),
  outputDir: resolve(root, reports, 'test-results'),
  reporter: [['list'], ['json', { outputFile: resolve(root, reports, 'playwright-results.json') }]],
  metadata: { task: 'G022-INTEGRATION', target: mode, phase, build,
    incompleteReleaseGate: '07 approved source/intake and real lifecycle acceptance must be added and reviewed before release.' },
  use: { baseURL: origin, locale: 'ko-KR', trace: 'retain-on-failure', screenshot: 'off', video: 'off' },
  // Intentionally NO webServer: PM owns starting the candidate, and production is read-only.
  // This config never starts, reuses, restarts, probes for availability or terminates a server.
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 667 } } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
  ],
});
