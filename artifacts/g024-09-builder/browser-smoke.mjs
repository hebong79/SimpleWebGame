import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, webkit } from '@playwright/test';
const root = process.cwd();
const build = resolve(process.env.GAME_TEST_BUILD_DIR);
const out = resolve(process.env.GAME_TEST_ARTIFACT_DIR, `browser-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(out, { recursive: true });
const { createGameServer } = await import(pathToFileURL(resolve(build, 'src/server/index.js')));
const server = createGameServer(resolve(build, 'public'));
const { STORAGE_KEY, defaults, settleRecord } = await import('../../public/games/09-crossy/save.js');
const results = [], diagnostics = [], snapshots = [];
const entry = 'http://127.0.0.1:3141/games/09-crossy/index.html';
const snap = (page) => page.evaluate(() => window.__simpleGames09Snapshot());
const physical = (s) => ({ elapsed: s.elapsed, idleAge: s.idleAge, x: s.x, y: s.y, highest: s.highest, row: s.row, col: s.col, lanes: s.lanes, hop: s.hop });
async function until(page, predicate, timeout = 4000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const s = await snap(page); if (predicate(s)) return s; await page.waitForTimeout(15); }
  throw new Error(`Snapshot deadline; last=${JSON.stringify(await snap(page))}`);
}
async function caseRun(name, fn) {
  try { await fn(); results.push({ name, passed: true }); }
  catch (e) { results.push({ name, passed: false, error: e.stack }); throw e; }
}
async function press80(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  const r = await page.locator(selector).boundingBox(); assert.ok(r);
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
}
async function open(page) { await page.goto(entry); await page.waitForFunction(() => typeof window.__simpleGames09Snapshot === 'function'); }
async function targets(page) {
  const bad = await page.evaluate(() => [...document.querySelectorAll('button')].filter((e) => e.getClientRects().length).map((e) => ({ id: e.id || e.dataset.direction || e.dataset.set, w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })).filter((r) => r.w < 44 || r.h < 44));
  assert.deepEqual(bad, []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
}
try {
  await new Promise((ok, no) => { server.once('error', no); server.listen(3141, '127.0.0.1', ok); });
  for (const [name, type, viewport, mobile] of [['chromium-desktop', chromium, { width: 1366, height: 900 }, false], ['chromium-320-touch', chromium, { width: 320, height: 740 }, true], ['webkit-mobile', webkit, { width: 390, height: 844 }, true]]) {
    const browser = await type.launch();
    const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce' });
    const errors = [], requests = [];
    const page = await context.newPage();
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.stack || String(e)));
    page.on('request', (r) => { requests.push(r.url()); if (!r.url().startsWith('http://127.0.0.1:3141/')) errors.push(`external ${r.url()}`); });
    try {
      await open(page);
      await caseRun(`${name}: visible target sizes, 320/desktop, landscape, scrollable dialogs`, async () => {
        await targets(page);
        const original = page.viewportSize(); await page.setViewportSize({ width: 667, height: 375 });
        await targets(page); await press80(page, '#help'); await targets(page);
        assert.equal(await page.evaluate(() => { const d = document.getElementById('help-dialog'); return d.scrollHeight > d.clientHeight && d.clientHeight <= innerHeight * 0.89; }), true);
        await press80(page, '#help-close');
        await page.setViewportSize(original); await targets(page);
      });
      await caseRun(`${name}: natural valid score, backtracking, repeat/modifier protection`, async () => {
        await press80(page, '#primary'); await page.keyboard.press('ArrowUp'); await until(page, (s) => s.row === 1 && !s.hop);
        assert.equal((await snap(page)).highest, 1);
        await page.keyboard.press('ArrowDown'); await until(page, (s) => s.row === 0 && !s.hop);
        await page.keyboard.press('ArrowUp'); await until(page, (s) => s.row === 1 && !s.hop);
        assert.equal((await snap(page)).highest, 1);
        await page.keyboard.press('Shift+ArrowLeft'); assert.equal((await snap(page)).col, 4);
        await page.keyboard.down('ArrowLeft'); await page.keyboard.down('ArrowLeft'); await page.keyboard.up('ArrowLeft');
        await until(page, (s) => !s.hop); assert.equal((await snap(page)).col, 3);
        await press80(page, '#primary'); assert.equal((await snap(page)).mode, 'paused');
      });
      await caseRun(`${name}: help Tab trap, Escape return, paused physics unchanged`, async () => {
        const before = await snap(page); await press80(page, '#help');
        await page.keyboard.press('Shift+Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'help-close');
        await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'help-close');
        await page.keyboard.press('Escape'); await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'help');
        const after = await snap(page); assert.deepEqual(physical(after), physical(before)); assert.equal(after.pauseReason, 'manual');
      });
      await caseRun(`${name}: all preview poses/directions, locked apply, mixed parts, cancel`, async () => {
        await press80(page, '#wardrobe'); await targets(page);
        for (let p = 0; p < 4; p++) {
          for (let d = 0; d < 4; d++) {
            assert.equal((await snap(page)).preview.direction, ['down', 'right', 'up', 'left'][d]);
            assert.equal((await snap(page)).preview.pose, ['stand', 'hop', 'land', 'fail'][p]);
            await press80(page, '#preview-direction');
          }
          await press80(page, '#preview-pose');
        }
        await press80(page, '[data-set="frog"]'); assert.equal(await page.locator('#wardrobe-apply').isDisabled(), true);
        await press80(page, '#wardrobe-cancel'); assert.equal((await snap(page)).record.equipped.hat, 'basic');
        await press80(page, '#wardrobe'); await press80(page, '#part-hat'); await press80(page, '#wardrobe-apply');
        assert.deepEqual((await snap(page)).record.equipped, { hat: 'straw', top: 'basic', backpack: 'basic' });
      });
      await caseRun(`${name}: restart cancellation preserves physics/reason, confirmed quit settles once`, async () => {
        const before = await snap(page); await press80(page, '#restart'); await press80(page, '#confirm-cancel');
        const after = await snap(page); assert.deepEqual(physical(after), physical(before)); assert.equal(after.pauseReason, before.pauseReason);
        await press80(page, '#restart'); await press80(page, '#confirm-yes');
        assert.equal((await snap(page)).mode, 'result'); assert.equal((await snap(page)).record.plays, 1);
        assert.equal((await snap(page)).record.totalRows, 1);
        await press80(page, '#result-wardrobe'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'result-wardrobe');
        await press80(page, '#retry'); assert.equal((await snap(page)).mode, 'ready'); assert.equal((await snap(page)).record.plays, 1);
        await page.reload(); await page.waitForFunction(() => typeof window.__simpleGames09Snapshot === 'function');
        assert.equal((await snap(page)).mode, 'ready'); assert.equal((await snap(page)).record.bestRows, 1);
      });
      await caseRun(`${name}: monotonic arrival 300ms stall advances zero ticks`, async () => {
        await press80(page, '#primary');
        const measurement = await page.evaluate(async () => {
          const before = window.__simpleGames09Snapshot(); const t = performance.now(); while (performance.now() - t < 300) { /* intentional UI stall */ }
          const immediate = window.__simpleGames09Snapshot();
          await new Promise(requestAnimationFrame);
          return { before, immediate, after: window.__simpleGames09Snapshot() };
        });
        assert.deepEqual(physical(measurement.immediate), physical(measurement.before));
        assert.deepEqual(physical(measurement.after), physical(measurement.before));
        assert.equal(measurement.after.pauseReason, 'long-frame'); assert.equal(measurement.after.mode, 'paused');
        snapshots.push({ browser: name, stall: measurement });
        await press80(page, '#primary'); await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        const paused = await snap(page); assert.equal(paused.mode, 'paused'); assert.equal(paused.pauseReason, 'blur');
        await page.waitForTimeout(120); assert.deepEqual(physical(await snap(page)), physical(paused));
      });
      await caseRun(`${name}: natural moving collision + completed save, no live state injection`, async () => {
        await page.reload(); await page.waitForFunction(() => typeof window.__simpleGames09Snapshot === 'function');
        await press80(page, '#primary'); await page.keyboard.press('ArrowUp'); await until(page, (s) => s.row === 1 && !s.hop);
        if (name === 'chromium-desktop') await page.screenshot({ path: resolve(out, 'playing.png'), fullPage: true, animations: 'allow', caret: 'initial' });
        for (let i = 0; i < 80 && (await snap(page)).mode === 'playing'; i++) {
          await page.keyboard.press('ArrowUp'); await page.waitForTimeout(135);
        }
        const result = await snap(page); assert.equal(result.mode, 'result'); assert.equal(result.reason, 'collision'); assert.ok(result.highest >= 1);
        assert.equal(result.record.plays, 2); assert.equal(result.record.totalRows, 1 + result.highest);
        const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY); assert.deepEqual(stored, result.record);
        snapshots.push({ browser: name, naturalCollision: result });
        await press80(page, '#retry'); assert.equal((await snap(page)).record.plays, 2);
      });
      await caseRun(`${name}: actual-clock 8s idle warning then 10s loss exactly once`, async () => {
        await press80(page, '#primary');
        const warning = await until(page, (s) => s.idleAge >= 8 || s.mode !== 'playing', 15000);
        assert.equal(warning.mode, 'playing'); assert.equal(await page.locator('#idle-warning').isVisible(), true);
        const end = await until(page, (s) => s.mode === 'result', 5000);
        assert.equal(end.reason, 'idle'); assert.equal(end.record.plays, 3); assert.equal(end.highest, 0);
        await page.waitForTimeout(300); assert.equal((await snap(page)).record.plays, 3);
        snapshots.push({ browser: name, idle: end });
      });
      await caseRun(`${name}: clean CSP/console/network diagnostics`, async () => { assert.deepEqual(errors, []); });
      diagnostics.push({ browser: name, errors, requests });
    } finally { await context.close(); await browser.close(); }
  }
  // Independent initial-storage fixture ONLY. Generated with the pure settlement API, not a live-state setter.
  const browser = await chromium.launch();
  try {
    let fixture = defaults(); for (let i = 0; i < 6; i++) fixture = settleRecord(fixture, 50);
    const ctx = await browser.newContext();
    await ctx.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, { key: STORAGE_KEY, value: JSON.stringify(fixture) });
    const page = await ctx.newPage(); await open(page);
    await caseRun('initial valid fixture: independent unlock truth table and mixed unlocked apply', async () => {
      await press80(page, '#wardrobe'); await press80(page, '[data-set="firefighter"]'); assert.equal(await page.locator('#wardrobe-apply').isDisabled(), false);
      await press80(page, '#part-hat'); assert.equal((await snap(page)).preview.equipped.hat, 'frog');
      await press80(page, '#wardrobe-apply'); assert.deepEqual((await snap(page)).record.equipped, { hat: 'frog', top: 'firefighter', backpack: 'firefighter' });
      await page.reload(); await page.waitForFunction(() => typeof window.__simpleGames09Snapshot === 'function');
      assert.equal((await snap(page)).record.equipped.hat, 'frog'); assert.equal((await snap(page)).mode, 'ready');
    });
    await ctx.close();
    const broken = await browser.newContext();
    await broken.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('fixture denied'); } }); });
    const bp = await broken.newPage(); await open(bp);
    await caseRun('storage getter failure: visible persistent warning, memory play still works', async () => {
      assert.equal(await bp.locator('#storage-warning').isVisible(), true); await press80(bp, '#primary');
      await bp.keyboard.press('ArrowUp'); await until(bp, (s) => s.highest === 1);
      await press80(bp, '#restart'); await press80(bp, '#confirm-yes'); assert.equal((await snap(bp)).record.totalRows, 1); assert.ok((await snap(bp)).storageWarning);
    });
    await broken.close();
    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const tp = await touch.newPage(); await open(tp); const cdp = await touch.newCDPSession(tp);
    await caseRun('Chromium CDP trusted touch: tap, cancel, outside second finger cancellation', async () => {
      await press80(tp, '#primary'); const r = await tp.locator('#arena').boundingBox();
      const p = { x: r.x + r.width / 2, y: r.y + r.height * 0.8, id: 1 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await until(tp, (s) => s.row === 1 && !s.hop); assert.equal((await snap(tp)).hops, 1);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await tp.waitForTimeout(150); assert.equal((await snap(tp)).hops, 1);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
      await tp.keyboard.press('ArrowRight');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p, { x: 5, y: 5, id: 2 }] });
      assert.equal((await snap(tp)).input.gesture, false);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await tp.waitForTimeout(160);
      assert.equal((await snap(tp)).hops, 2); assert.equal((await snap(tp)).input.pointerCount, 0);
    });
    await caseRun('Chromium CDP trusted swipe: CSS threshold, dominance, down, upward/tie no-op', async () => {
      await tp.reload(); await tp.waitForFunction(() => typeof window.__simpleGames09Snapshot === 'function'); await press80(tp, '#primary');
      const r = await tp.locator('#arena').boundingBox(); const x = r.x + r.width / 2, y = r.y + r.height / 2;
      async function swipe(dx, dy) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 3 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y: y + dy, id: 3 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await tp.waitForTimeout(150);
      }
      await swipe(25, 0); assert.equal((await snap(tp)).col, 5);
      await swipe(-25, 0); assert.equal((await snap(tp)).col, 4);
      const before = (await snap(tp)).hops;
      await swipe(0, -25); await swipe(24, 24); await swipe(0, 25); assert.equal((await snap(tp)).hops, before);
      await swipe(23, 0); assert.equal((await snap(tp)).row, 1);
      await swipe(0, 26); assert.equal((await snap(tp)).row, 0);
    });
    await caseRun('Chromium outside arena retains ordinary page scrolling', async () => {
      await tp.mouse.move(2, 700); await tp.mouse.wheel(0, 300); await tp.waitForTimeout(150);
      assert.ok(await tp.evaluate(() => scrollY > 0));
    });
    await touch.close();
    const noAudio = await browser.newContext();
    await noAudio.addInitScript(() => { Object.defineProperty(window, 'AudioContext', { value: class { constructor() { throw new Error('fixture no audio'); } } }); });
    const ap = await noAudio.newPage(); await open(ap);
    await caseRun('AudioContext construction failure degrades visibly without blocking gameplay', async () => {
      await press80(ap, '#primary'); await press80(ap, '#mute'); assert.equal(await ap.locator('#audio-warning').isVisible(), true);
      await ap.locator('#arena').focus(); await ap.keyboard.press('ArrowUp'); await until(ap, (s) => s.highest === 1); assert.equal((await snap(ap)).mode, 'playing');
    });
    await noAudio.close();
  } finally { await browser.close(); }
} catch (error) { diagnostics.push({ fatal: error.stack }); process.exitCode = 1; }
finally {
  server.closeAllConnections(); await new Promise((ok) => server.close(ok));
  const report = { root, build, out, results, executed: results.length, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length, skipped: 0, diagnostics, snapshots };
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out, results, executed: report.executed, passed: report.passed, failed: report.failed, skipped: 0, diagnostics }, null, 2));
}
