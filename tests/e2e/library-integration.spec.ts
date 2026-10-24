import { test, expect, type Page } from '@playwright/test';

const KEY = 'number-garden:profile:v1';
const FAVORITES = 'simplegames.library.favorites.v1';
const board = (page: Page) => page.locator('#board .cell').evaluateAll(cells => cells.map(cell => Number((cell as HTMLElement).dataset.value)));
const profile = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), KEY);
const ids = (page: Page) => page.locator('.game-card').evaluateAll(cards => cards.map(card => (card as HTMLElement).dataset.id));
const more = async (page: Page) => { while (await page.locator('#load-more').isVisible()) await page.locator('#load-more').click(); };
const sortBy = async (page: Page, value: string) => {
  await page.locator('#game-sort').click(); await page.locator(`#sort-menu button[data-sort="${value}"]`).click();
  await expect(page.locator('#sort-menu')).not.toHaveAttribute('open', ''); await expect(page.locator('#game-sort')).toBeFocused();
};
const runtime = new WeakMap<Page, { errors: string[]; external: string[] }>();
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  const evidence = { errors: [] as string[], external: [] as string[] }; runtime.set(page, evidence);
  page.on('pageerror', e => evidence.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') evidence.errors.push(m.text()); });
  page.on('request', r => { if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(r.url()).hostname)) evidence.external.push(r.url()); });
});
test.afterEach(async ({ page }, info) => {
  const evidence = runtime.get(page)!;
  await info.attach('runtime-evidence', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  expect(evidence.errors, 'home and game runtime errors').toEqual([]);
  expect(evidence.external, 'external requests').toEqual([]);
});

test('18 library 32 entries pagination search genre state sorting and zero reset', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('.game-card')).toHaveCount(12);
  await expect(page.locator('#result-count')).toHaveText('32개');
  await page.locator('#load-more').click(); await expect(page.locator('.game-card')).toHaveCount(24);
  await page.locator('#load-more').click(); await expect(page.locator('.game-card')).toHaveCount(32);
  const all = await ids(page); expect(new Set(all).size).toBe(32);
  const byDuration = await page.locator('.game-card').evaluateAll(cards => cards.map(card => ({ id: (card as HTMLElement).dataset.id, minutes: Number(card.querySelector('.duration')!.textContent!.match(/\d+/)![0]) })).sort((a, b) => a.minutes - b.minutes).map(card => card.id));
  await expect(page.locator('a.card-action[href="/game.html"],a.card-action[href="game.html"]')).toHaveCount(1);
  await expect(page.locator('button.card-action:disabled')).toHaveCount(29); await expect(page.locator('#load-more')).toBeHidden();
  await sortBy(page, 'name'); await expect(page.locator('.game-card')).toHaveCount(12); await more(page);
  const names = await page.locator('.game-card h3').allTextContents(); expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ko')));
  await sortBy(page, 'duration'); await more(page); expect(await ids(page)).toEqual(byDuration);
  await sortBy(page, 'default'); await more(page); expect(await ids(page)).toEqual(all);
  await page.locator('#game-search').fill('카드'); expect((await ids(page)).length).toBeGreaterThan(0);
  await page.locator('#game-search').fill('숫자 정원'); await expect(page.locator('.game-card')).toHaveCount(1);
  await page.locator('#include-upcoming').uncheck(); await expect(page.locator('.game-card')).toHaveCount(1);
  await page.locator('#game-search').fill('없는게임XYZ'); await expect(page.locator('#result-count')).toHaveText('0개'); await expect(page.locator('#empty-state')).toBeVisible();
  await page.locator('#reset-filters').click(); await expect(page.locator('.game-card')).toHaveCount(12); await expect(page.locator('#include-upcoming')).toBeChecked();
});

test('19 library favorites keyboard persistence compound filter removal and blocked storage', async ({ page, browser }) => {
  await page.goto('/'); const first = page.locator('.favorite-button').first(); await first.focus(); await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('aria-pressed', 'true'); await expect(first).toBeFocused();
  await page.reload(); await expect(page.locator('#favorite-count')).toHaveText('1');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]').length, FAVORITES)).toBe(1);
  await page.locator('#favorites-only').click(); await expect(page.locator('.game-card')).toHaveCount(1);
  await page.locator('#genre-tabs button[data-genre="숫자"]').click();
  await page.locator('#game-search').fill('숫자 정원'); await page.locator('#include-upcoming').uncheck(); await expect(page.locator('.game-card')).toHaveCount(1);
  await page.locator('.favorite-button').click(); await expect(page.locator('#empty-state')).toBeVisible();
  await expect(page.locator('#favorites-only')).toBeFocused();
  const isolated = await browser.newContext(); await isolated.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
  const p = await isolated.newPage(); const errors: string[] = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(test.info().project.use.baseURL + '/'); await p.locator('.favorite-button').first().click();
  await expect(p.locator('#favorite-count')).toHaveText('1'); await expect(p.locator('#storage-notice')).toBeVisible(); expect(errors).toEqual([]); await isolated.close();
});

test('20 actual home game score exits through result then home and record persists', async ({ page }) => {
  await page.goto('/'); expect(await profile(page)).toBeNull(); await page.locator('.game-card[data-id="number-garden"] a.card-action').click();
  await expect(page).toHaveURL(/\/game\.html$/); await expect(page.locator('#board')).toBeFocused();
  expect((await board(page)).filter(Boolean)).toHaveLength(2); await page.keyboard.press('ArrowLeft'); await expect(page.locator('#score')).toHaveText('4');
  const before = await board(page); await page.locator('#pause-button').click();
  await expect(page.getByRole('button', { name: '이어서하기', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '이어서하기', exact: true }).click(); expect(await board(page)).toEqual(before);
  await page.locator('#exit-button').click(); await expect(page.locator('#game-dialog')).toBeVisible();
  await expect(page.locator('#result-summary strong')).toHaveText('4'); await expect(page.locator('#dialog-content')).toContainText('종료');
  await expect(page.getByRole('button', { name: '이어서하기', exact: true })).toHaveCount(0);
  expect(await profile(page)).toMatchObject({ gamesStarted: 1, gamesFinished: 0, totalMoves: 1, totalScore: 4, bestScore: 4 });
  await page.locator('#result-home').click(); await expect(page).toHaveURL(/\/(?:index\.html)?$/);
  await expect(page.locator('#game-grid')).toBeVisible(); await page.locator('.game-card[data-id="number-garden"] a.card-action').click();
  await expect(page.locator('#score')).toHaveText('0'); await expect(page.locator('#best-score')).toHaveText('4'); expect((await profile(page)).gamesStarted).toBe(2);
});

test('21 paused restart cancel preserves pause and exit result cannot resume', async ({ page }) => {
  await page.goto('/game.html'); await page.keyboard.press('ArrowLeft'); await expect(page.locator('#score')).toHaveText('4');
  const before = await board(page); await page.locator('#pause-button').click();
  await page.locator('#dialog-content').getByRole('button', { name: '다시시작', exact: true }).click(); await page.getByRole('button', { name: '취소 · 돌아가기', exact: true }).click();
  await expect(page.getByRole('button', { name: '이어서하기', exact: true })).toBeVisible(); expect(await board(page)).toEqual(before);
  await page.locator('#dialog-content').getByRole('button', { name: '게임종료', exact: true }).click(); await expect(page.locator('#dialog-content')).toContainText('종료');
  await page.keyboard.press('Escape'); await expect(page.locator('#game-dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: '이어서하기', exact: true })).toHaveCount(0);
  expect((await profile(page)).gamesFinished).toBe(0);
});

test('22 automatic blur pause uses game resume and home links require exit result', async ({ page }) => {
  await page.goto('/game.html'); await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('button', { name: '게임 재개', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '이어서하기', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '게임 재개', exact: true }).click();
  await page.locator('a.exit-home').first().click(); await expect(page).toHaveURL(/\/game\.html$/); await expect(page.locator('#game-dialog')).toBeVisible();
  await page.locator('#result-home').click(); await expect(page.locator('#game-grid')).toBeVisible();
});

test('23 home responsive controls scrolling last entry and return to top', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 }); await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const small = await page.locator('button:visible,input[type=search]:visible,summary:visible,a.card-action').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().width < 43.9 || node.getBoundingClientRect().height < 43.9).map(node => node.textContent));
    expect(small).toEqual([]);
    await page.locator('#genre-tabs button[data-genre="숫자"]').click(); await expect(page.locator('#result-count')).toHaveText('5개'); await page.locator('#genre-tabs button[data-genre="전체"]').click();
    await more(page); await page.locator('.game-card').last().scrollIntoViewIfNeeded(); expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await page.locator('#back-to-top').click(); await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
  }
});
