import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'screenshots-library');
await mkdir(output, { recursive: true });
const evidence = { generatedAt: new Date().toISOString(), node: process.version,
  scope: 'Local file UI library prototype; real 2048 gameplay, builds and physical devices are not tested.',
  checks: [], screenshots: [], errors: [], externalRequests: [], layout: [] };
const browser = await chromium.launch();
evidence.browser = browser.version();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const home = pathToFileURL(path.join(root, 'index.html')).href;
page.on('pageerror', e => evidence.errors.push(e.message));
page.on('request', r => { if (/^https?:/.test(r.url())) evidence.externalRequests.push(r.url()); });
const check = async (name, action) => { try { await action(); evidence.checks.push({ name, status: 'pass' }); } catch(e) { evidence.checks.push({ name, status: 'fail', error: e.message }); throw e; } };
const ids = () => page.locator('article.game-card').evaluateAll(cards => cards.map(c => c.dataset.id));
const shot = async (name, fullPage = false) => { await page.screenshot({ path: path.join(output, name), fullPage }); evidence.screenshots.push(`screenshots-library/${name}`); };
const countIs = async n => assert.equal((await page.locator('#result-count').innerText()).replace(/\D/g, ''), String(n));
const fresh = async () => { await page.goto(home); await page.locator('#game-search').waitFor(); };
const reset = async () => { await fresh(); };
let catalog;
const matches = ({ search = '', genre = '', favorites, includeUpcoming = true } = {}) => catalog.filter(g => (!search || [g.title, g.genre, ...g.tags].join(' ').toLowerCase().includes(search.toLowerCase())) && (!genre || genre === '전체' || g.genre === genre) && (!favorites || favorites.includes(g.id)) && (includeUpcoming || g.status === 'preview'));
const assertResults = async expected => { await countIs(expected.length); assert.deepEqual(await ids(), expected.slice(0, 12).map(g => g.id)); };
const allShown = async () => { while (await page.locator('#load-more').isVisible()) await page.locator('#load-more').click(); };
const auditLayout = async width => {
  const result = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, toolsHeight: document.querySelector('.library-tools').getBoundingClientRect().height, viewportHeight: innerHeight }));
  assert.ok(result.document <= width && result.body <= width, JSON.stringify(result));
  const small = await page.locator('button:visible,input[type=search]:visible,select:visible,a.button:visible').evaluateAll(els => els.map(el => ({ text: el.textContent.trim().slice(0, 40), id: el.id, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height })).filter(e => e.w < 43.9 || e.h < 43.9));
  assert.deepEqual(small, []);
  assert.ok(result.toolsHeight < result.viewportHeight * .45, 'Sticky tools occupy excessive viewport height');
  evidence.layout.push({ width, ...result });
};

try {
  await check('Catalog has 30 unique examples, one preview and 29 upcoming entries', async () => {
    await fresh(); catalog = await page.evaluate(() => GAME_CATALOG);
    assert.equal(catalog.length, 30); assert.equal(new Set(catalog.map(g => g.id)).size, 30);
    assert.equal(catalog.filter(g => g.status === 'preview').length, 1); assert.equal(catalog.filter(g => g.status === 'upcoming').length, 29);
    const counts = Object.fromEntries(['퍼즐', '숫자', '기억', '순발력', '보드'].map(g => [g, catalog.filter(c => c.genre === g).length]));
    assert.deepEqual(counts, { 퍼즐: 8, 숫자: 5, 기억: 5, 순발력: 6, 보드: 6 });
    assert.match(await page.locator('.preview-note').innerText(), /예시.*시안.*가상/);
    evidence.catalog = catalog;
  });
  await check('Initial 12 then 24 then all 30 retain order without omissions or duplicates', async () => {
    await assertResults(catalog); await shot('home-desktop.png'); await shot('home-desktop-full.png', true);
    await page.locator('#load-more').click(); assert.deepEqual(await ids(), catalog.slice(0, 24).map(g => g.id));
    await page.locator('#load-more').click(); assert.deepEqual(await ids(), catalog.map(g => g.id));
    assert.equal(await page.locator('#load-more').isVisible(), false); assert.equal(await page.locator('#all-loaded').isVisible(), true);
    assert.equal(await page.locator('a.card-action[href="game.html"]').count(), 1);
    assert.equal(await page.locator('button.card-action:disabled').count(), 29);
    assert.match(await page.locator('a.card-action').innerText(), /시안/);
    await page.locator('article.game-card').last().scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => scrollY > 0)); assert.ok(await page.locator('article.game-card').last().evaluate(el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }));
    await shot('all-games-bottom.png'); await page.locator('#back-to-top').click();
    await page.waitForFunction(() => scrollY < 2);
  });
  await check('Title and tag search update exact counts and preserve continuous input focus', async () => {
    await reset(); const search = page.locator('#game-search');
    await search.click(); await search.pressSequentially('숫자');
    assert.equal(await search.inputValue(), '숫자'); assert.equal(await search.evaluate(el => el === document.activeElement), true);
    await assertResults(matches({ search: '숫자' }));
    const term = catalog.find(g => g.tags.some(t => t.includes('기억')))?.tags.find(t => t.includes('기억')) || catalog[1].tags[0];
    await search.fill(term); await assertResults(matches({ search: term })); await shot('search-desktop.png');
    await page.locator('#clear-search').click(); await assertResults(catalog);
  });
  await check('Genre and state filters use AND semantics and accurate facet totals', async () => {
    const selected = catalog[0].genre;
    await page.locator(`#genre-tabs button[data-genre="${selected}"]`).click(); await assertResults(matches({ genre: selected }));
    await page.locator('#include-upcoming').uncheck(); await assertResults(matches({ genre: selected, includeUpcoming: false }));
    for (const g of ['전체', '퍼즐', '숫자', '기억', '순발력', '보드']) {
      const expected = matches({ includeUpcoming: false }).filter(item => g === '전체' || item.genre === g).length;
      assert.equal(await page.locator(`#genre-tabs button[data-genre="${g}"] .genre-count`).innerText(), String(expected));
    }
    const other = catalog.find(g => g.genre !== selected).genre;
    await page.locator(`#genre-tabs button[data-genre="${other}"]`).click(); await assertResults([]);
    await page.locator('#reset-filters').click(); await assertResults(catalog);
  });
  await check('Condition changes reset display limit to 12', async () => {
    await page.locator('#load-more').click(); assert.equal((await ids()).length, 24);
    await page.locator('#game-sort').selectOption('name'); assert.equal((await ids()).length, 12);
    await page.locator('#load-more').click(); await page.locator('#game-search').fill(' '); assert.equal((await ids()).length, 12);
    await reset();
  });
  await check('Default, Korean name and shortest-duration sorting are deterministic', async () => {
    for (const sort of ['name', 'duration', 'default']) {
      await page.locator('#game-sort').selectOption(sort); await allShown();
      const expected = [...catalog];
      if (sort === 'name') expected.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
      if (sort === 'duration') expected.sort((a, b) => a.minutes - b.minutes);
      assert.deepEqual(await ids(), expected.map(g => g.id));
    }
  });
  await check('Favorites keyboard toggle preserves focus, filters AND with search and genre, and reload persists', async () => {
    await reset(); const selected = catalog[0]; const button = page.locator(`button.favorite-button[data-id="${selected.id}"]`);
    await button.focus(); await page.keyboard.press('Enter');
    assert.equal(await button.getAttribute('aria-pressed'), 'true'); assert.equal(await button.evaluate(el => el === document.activeElement), true);
    await page.locator('button.favorite-button').nth(1).click();
    assert.equal(await page.locator('#favorite-count').innerText(), '2');
    await page.reload(); assert.equal(await page.locator('#favorite-count').innerText(), '2');
    await page.locator('#favorites-only').click(); await assertResults(catalog.slice(0, 2)); await shot('favorites-desktop.png');
    await page.locator('#game-search').fill(selected.title); await page.locator(`#genre-tabs button[data-genre="${selected.genre}"]`).click();
    await assertResults([selected]); await page.locator('#include-upcoming').uncheck(); await assertResults([selected]);
    await page.locator(`button.favorite-button[data-id="${selected.id}"]`).click(); await assertResults([]);
    assert.equal(await page.locator('#empty-state').isVisible(), true); await shot('empty-desktop.png');
    await page.locator('#reset-filters').click(); await assertResults(catalog);
    assert.equal(await page.locator('#favorites-only').getAttribute('aria-pressed'), 'false');
    // Clean this isolated context so subsequent checks start with no favorites.
    await page.evaluate(() => localStorage.removeItem('simplegames.prototype.library.favorites.v1')); await page.reload();
  });
  await check('No-match search shows zero results and reset restores default controls', async () => {
    await page.locator('#game-search').fill('존재하지않는게임XYZ'); await assertResults([]);
    assert.equal(await page.locator('#empty-state').isVisible(), true);
    await page.locator('#reset-filters').click(); await assertResults(catalog);
    assert.equal(await page.locator('#game-search').inputValue(), ''); assert.equal(await page.locator('#game-sort').inputValue(), 'default');
    assert.equal(await page.locator('#include-upcoming').isChecked(), true);
  });
  for (const width of [320, 390, 768, 1440]) {
    await check(`${width}px layout, 44px controls, scrolling, sticky tools and genre accessibility`, async () => {
      await page.setViewportSize({ width, height: 900 }); await fresh(); await auditLayout(width);
      const fontSizes = await page.locator('.card-content p, .card-tags span, .include-upcoming').evaluateAll(els => els.map(el => ({ text: el.textContent.trim(), size: parseFloat(getComputedStyle(el).fontSize) })));
      assert.ok(fontSizes.every(e => e.size >= 12), JSON.stringify(fontSizes.filter(e => e.size < 12)));
      const mainText = await page.locator('.card-description').evaluateAll(els => els.map(el => parseFloat(getComputedStyle(el).fontSize)));
      assert.ok(mainText.every(size => size >= 14));
      assert.ok(await page.locator('#favorites-only').evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 12), 'Favorites control label is below 12px');
      await page.locator('#browse-link').click();
      await page.waitForTimeout(350);
      const positions = await page.evaluate(() => ({ toolsBottom: document.querySelector('.library-tools').getBoundingClientRect().bottom, firstTop: document.querySelector('.game-card').getBoundingClientRect().top }));
      assert.ok(positions.firstTop >= positions.toolsBottom - 1, JSON.stringify(positions));
      if (await page.locator('#genre-select').isVisible()) {
        await page.locator('#genre-select').selectOption(catalog[0].genre); await assertResults(matches({ genre: catalog[0].genre })); await page.locator('#genre-select').selectOption('전체');
      }
      if (width === 390) { await page.locator('#back-to-top').click(); await page.waitForFunction(() => scrollY < 2); await shot('home-mobile.png'); await shot('home-mobile-full.png', true); }
      await allShown(); await page.locator('article.game-card').last().scrollIntoViewIfNeeded(); assert.ok(await page.evaluate(() => scrollY > 0)); await auditLayout(width);
    });
  }
  await check('Blocked localStorage falls back without uncaught errors; favorites remain usable', async () => {
    const isolated = await browser.newContext();
    await isolated.addInitScript(() => Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Blocked', 'SecurityError'); } }));
    const p = await isolated.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.goto(home); assert.equal(await p.locator('article.game-card').count(), 12);
    await p.locator('button.favorite-button').first().click(); assert.equal(await p.locator('#favorite-count').innerText(), '1');
    await p.locator('#favorites-only').click(); assert.equal(await p.locator('article.game-card').count(), 1);
    assert.deepEqual(errors, []); assert.equal(await p.locator('#storage-notice').isVisible(), true); await isolated.close();
  });
  await check('Catalog extension to 31 derives counts and paging from data length', async () => {
    await fresh();
    await page.evaluate(() => { GAME_CATALOG.push({ ...GAME_CATALOG[29], id: 'qa-expansion-example', title: '추가 검증 게임' }); render(); });
    await countIs(31); assert.equal(await page.locator('.library-total strong').innerText(), '31');
    await allShown(); assert.equal((await ids()).length, 31); assert.equal((await ids()).at(-1), 'qa-expansion-example');
    assert.equal(await page.locator('#load-more').isVisible(), false); await fresh();
  });
  await check('Library has no runtime errors or external HTTP requests', async () => { assert.deepEqual(evidence.errors, []); assert.deepEqual(evidence.externalRequests, []); });
  await check('Desktop and mobile overview generated from verified viewport captures', async () => {
    const sections = await Promise.all([['PC · 검색과 장르, 게임 목록', 'home-desktop.png'], ['모바일 · 반응형 게임 서재', 'home-mobile.png']].map(async ([title, file]) => `<section><h2>${title}</h2><img src="data:image/png;base64,${(await readFile(path.join(output, file))).toString('base64')}"></section>`));
    await page.setViewportSize({ width: 1504, height: 1000 });
    await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#e9e9e4;color:#284d3b;font-family:Arial,sans-serif}main{display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:24px;align-items:start}section{background:white;border-radius:10px;overflow:hidden}h2{font-size:19px;margin:0;padding:16px}img{width:100%;height:auto;display:block}</style><main>${sections.join('')}</main></html>`);
    await shot('overview.png', true);
  });
} catch (e) { evidence.failure = e.message; process.exitCode = 1; }
finally {
  evidence.summary = { passed: evidence.checks.filter(c => c.status === 'pass').length, failed: evidence.checks.filter(c => c.status === 'fail').length };
  await writeFile(path.join(root, 'verification-library.json'), JSON.stringify(evidence, null, 2) + '\n');
  await browser.close(); console.log(JSON.stringify(evidence.summary)); if (evidence.failure) console.error(evidence.failure);
}
