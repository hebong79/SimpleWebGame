import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, webkit } from '@playwright/test';
const root = process.cwd();
const build = resolve(process.env.GAME_TEST_BUILD_DIR);
const out = resolve(process.env.GAME_TEST_ARTIFACT_DIR, `early-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(out, { recursive: true });
const { createGameServer, CSP } = await import(pathToFileURL(resolve(build, 'src/server/index.js')));
const server = createGameServer(resolve(build, 'public'));
const results = [], diagnostics = [];
const sha = (b) => createHash('sha256').update(b).digest('hex');
const entry = 'http://127.0.0.1:3141/games/09-crossy/';
async function caseRun(name, fn) {
  try { await fn(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); throw error; }
}
async function click80(page, selector) {
  const button = page.locator(selector); await button.scrollIntoViewIfNeeded();
  const b = await button.boundingBox(); assert.ok(b); assert.ok(b.width >= 44 && b.height >= 44);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
}
try {
  await new Promise((ok, no) => { server.once('error', no); server.listen(3141, '127.0.0.1', ok); });
  await caseRun('actual HTTP strict CSP + all seven identical assets', async () => {
    for (const file of ['index.html', 'style.css', 'main.js', 'engine.js', 'save.js', 'art.js', 'icon.svg']) {
      const res = await fetch(entry + file); assert.equal(res.status, 200); assert.equal(res.headers.get('content-security-policy'), CSP);
      const bytes = Buffer.from(await res.arrayBuffer());
      assert.equal(sha(bytes), sha(await readFile(resolve(root, 'public/games/09-crossy', file))));
    }
  });
  for (const [name, type, viewport] of [['chromium-desktop', chromium, { width: 1366, height: 900 }], ['webkit-mobile', webkit, { width: 390, height: 844 }]]) {
    const browser = await type.launch();
    try {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
      page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1:3141/')) errors.push(`external request ${r.url()}`); });
      await page.goto(entry + 'index.html');
      await page.waitForFunction(() => typeof window.__simpleGames09Snapshot === 'function');
      const snap = () => page.evaluate(() => window.__simpleGames09Snapshot());
      await caseRun(`${name}: nonfrozen trusted 80ms start/pause/resume`, async () => {
        await click80(page, '#primary'); assert.equal((await snap()).mode, 'playing');
        await click80(page, '#primary'); assert.equal((await snap()).mode, 'paused');
        const before = await snap(); await page.waitForTimeout(180); assert.equal((await snap()).elapsed, before.elapsed);
        await click80(page, '#primary'); assert.equal((await snap()).mode, 'playing');
      });
      await caseRun(`${name}: trusted mute + wardrobe part/cancel/set/apply`, async () => {
        await click80(page, '#mute'); assert.equal((await snap()).record.muted, false);
        await click80(page, '#mute'); assert.equal((await snap()).record.muted, true);
        await click80(page, '#wardrobe'); assert.equal((await snap()).dialog, 'wardrobe-dialog'); assert.equal((await snap()).mode, 'paused');
        await click80(page, '#part-hat'); assert.equal((await snap()).preview.equipped.hat, 'straw');
        await click80(page, '#wardrobe-cancel'); assert.equal((await snap()).record.equipped.hat, 'basic');
        await page.waitForTimeout(300); assert.equal(await page.evaluate(() => document.activeElement.id), 'wardrobe');
        await click80(page, '#wardrobe'); await click80(page, '[data-set="straw"]'); await click80(page, '#wardrobe-apply');
        assert.deepEqual((await snap()).record.equipped, { hat: 'straw', top: 'straw', backpack: 'straw' });
        assert.equal((await snap()).mode, 'paused');
      });
      await caseRun(`${name}: layout + clone-only snapshot + clean diagnostics`, async () => {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.evaluate(() => { const s = window.__simpleGames09Snapshot(); s.highest = 9999; s.record.bestRows = 9999; });
        assert.equal((await snap()).highest, 0); assert.equal((await snap()).record.bestRows, 0);
        assert.deepEqual(errors, []);
        if (name.startsWith('chromium')) await page.screenshot({ path: resolve(out, `${name}.png`), fullPage: true, animations: 'allow', caret: 'initial' });
      });
      diagnostics.push({ browser: name, errors, snapshot: await snap() });
    } finally { await browser.close(); }
  }
} catch (error) { diagnostics.push({ fatal: error.stack }); process.exitCode = 1; }
finally {
  await new Promise((ok) => server.close(ok)); server.closeAllConnections();
  const summary = { results, executed: results.length, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length, skipped: 0, diagnostics };
  await writeFile(resolve(out, 'report.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ out, ...summary }, null, 2));
}
