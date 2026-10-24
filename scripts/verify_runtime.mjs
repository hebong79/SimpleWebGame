import { chromium, devices } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const baseURL = process.argv[2] ?? 'http://127.0.0.1:3103';
await mkdir('artifacts/pm', { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const [name, settings] of [
    ['desktop', { viewport: { width: 1366, height: 1000 } }],
    ['mobile', { ...devices['Pixel 7'], viewport: { width: 375, height: 667 } }],
  ]) {
    const context = await browser.newContext(settings);
    const page = await context.newPage();
    const errors = [];
    const external = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('**/*', async route => {
      if (new URL(route.request().url()).origin !== new URL(baseURL).origin) {
        external.push(route.request().url()); await route.abort();
      } else await route.continue();
    });
    await page.addInitScript(() => { Math.random = () => 0; });
    await page.goto(baseURL);
    await page.locator('#start-button').click();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('#score').textContent(), '4');
    await page.locator('#help-button').click();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab');
      assert.ok(await page.evaluate(() => !!document.activeElement?.closest('dialog')));
    }
    await page.keyboard.press('Escape');
    assert.ok(await page.locator('#board').evaluate(el => el === document.activeElement));
    const metrics = await page.evaluate(() => {
      const r = document.querySelector('#board').getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > innerWidth, board: { width: r.width, height: r.height } };
    });
    assert.equal(metrics.overflow, false);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    await page.screenshot({ path: `artifacts/pm/runtime-${name}.png`, fullPage: true });
    await page.reload();
    assert.ok(await page.locator('#ready-panel').isVisible());
    assert.equal(await page.locator('#best-score').textContent(), '4');
    results.push({ name, browser: browser.version(), status: 'PASS', metrics, errors, external });
    await context.close();
  }
} finally { await browser.close(); }
await writeFile('artifacts/pm/runtime-browser.json', JSON.stringify({ baseURL, results }, null, 2));
console.log(JSON.stringify(results, null, 2));
