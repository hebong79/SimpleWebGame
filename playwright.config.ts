import { defineConfig, devices } from '@playwright/test';
const buildDir = process.env.GAME_TEST_BUILD_DIR ?? 'dist';
const reportDir = process.env.GAME_TEST_ARTIFACT_DIR ?? 'artifacts/g013-qa';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1,
  timeout: 30_000, expect: { timeout: 5_000 }, retries: 0,
  outputDir: `${reportDir}/test-results`,
  reporter: [['list'], ['json', { outputFile: `${reportDir}/playwright-results.json` }], ['html', { outputFolder: `${reportDir}/html-report`, open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3103', locale: 'ko-KR', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: `node "${buildDir}/src/server/index.js" --port 3103`, url: 'http://127.0.0.1:3103', reuseExistingServer: false, timeout: 20_000 },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 667 } } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
  ],
});
