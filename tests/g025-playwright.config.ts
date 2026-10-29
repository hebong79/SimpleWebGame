import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '..');
const build = process.env.GAME_TEST_BUILD_DIR;
const reports = process.env.GAME_TEST_ARTIFACT_DIR;
const target = process.env.GAME_G025_TARGET;
const mode = process.env.GAME_G025_MODE;
const origin = process.env.GAME_G025_ORIGIN;
if (build !== 'artifacts/g025-build') throw new Error('BLOCKED: explicit G025 build required');
if (!reports || !/^artifacts\/g025-integration\/runs\/[A-Za-z0-9_-]+\/children\/[A-Za-z0-9_-]+\/(discovery|execution)-[a-f0-9-]+$/.test(reports)) throw new Error('BLOCKED: fresh child-specific G025 reports required');
if (!['candidate', 'live'].includes(target ?? '') || !['smoke', 'full'].includes(mode ?? '')) throw new Error('Explicit G025 target/mode required');
if (origin !== (target === 'candidate' ? 'http://127.0.0.1:3155' : 'http://192.168.0.195:3116')) throw new Error('Origin is not authorized');
if (target === 'live' && process.env.GAME_LIVE_ORIGIN !== origin) throw new Error('Live requires explicit authorized LAN profile');
if (target === 'candidate' && process.env.GAME_LIVE_ORIGIN) throw new Error('Candidate must not inherit a live origin');
if (process.env.GAME_G025_BROWSER_GATE !== 'Local\\SimpleGamesG025BrowserGate') throw new Error('Use the exact G025 Win32 mutex runner');
const verifier = await import(pathToFileURL(resolve(root, 'scripts/g025-verify.mjs')).href);
await verifier.assertReady(root); // Also fail closed when someone invokes Playwright directly.
await verifier.guarded(root, reports);
const list = process.env.GAME_G025_LIST === '1';
if (list !== reports.includes('/discovery-')) throw new Error('Discovery and execution reports must remain distinct');
const existing = ['live-server.spec.ts', 'runner-jumper.spec.ts', 'flappy-input.spec.ts', 'g024-new-games.spec.ts'];
export default defineConfig({
  testDir: resolve(root, 'tests/e2e'),
  testMatch: mode === 'smoke'
    ? ['g025-new-games.spec.ts', 'g024-new-games.spec.ts', 'runner-jumper.spec.ts', 'live-server.spec.ts']
    : target === 'live' ? [...existing, 'g025-new-games.spec.ts']
      : [...existing, 'library-integration.spec.ts', 'multi-game-integration.spec.ts', 'breakout-integration.spec.ts', 'g025-new-games.spec.ts'],
  ...(mode === 'smoke' ? { grep: /@smoke|G022-LIVE01|G022-LIVE03/ } : {}),
  fullyParallel: false, workers: 1, retries: 0, timeout: 45000, expect: { timeout: 5000 },
  outputDir: resolve(root, reports, 'test-results'),
  reporter: [['list'], ['json', { outputFile: resolve(root, reports, list ? 'discovery.json' : 'playwright-results.json') }]],
  use: { baseURL: origin, locale: 'ko-KR', trace: 'retain-on-failure', screenshot: 'off', video: 'off' },
  // No webServer: candidate lifecycle belongs only to the runner. Live is GET/HEAD + isolated browser state only.
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 320, height: 667 } } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], viewport: { width: 320, height: 667 } } },
  ],
});
