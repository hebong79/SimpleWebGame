import { test, expect, type Page } from '@playwright/test';

const paths = {
  garden: '/game.html',
  snake: '/games/02-snake/index.html',
  pong: '/games/03-pong/index.html',
};
const keys = {
  garden: 'number-garden:profile:v1',
  snake: 'little-dragon.snake.v1',
  pong: 'neon-rally.pong.v1',
  favorites: 'simplegames.library.favorites.v1',
};
const launch = (page: Page, id: string) => page.locator(`.game-card[data-id="${id}"] a.card-action`).click();
const stored = (page: Page, key: string) => page.evaluate(k => localStorage.getItem(k), key);
const parsed = async (page: Page, key: string) => JSON.parse(await stored(page, key) || 'null');
const cardIds = (page: Page) => page.locator('.game-card').evaluateAll(cards => cards.map(card => (card as HTMLElement).dataset.id));

// Control the real animation loop through Playwright's clock; no game state is exposed or injected.
async function freezeClock(page: Page) {
  const time = new Date('2026-10-24T12:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
}

async function choosePongSetting(page: Page, id: string, value: string) {
  const setting = page.locator(`#${id}`);
  if (await setting.evaluate(node => node.tagName === 'SELECT')) {
    await setting.selectOption(value);
  } else {
    await setting.locator(`[data-value="${value}"]`).click();
    await expect(setting.locator(`[data-value="${value}"]`)).toHaveAttribute('aria-pressed', 'true');
  }
}

// Read the rendered mint paddle, rather than the private engine object.
async function paddleY(page: Page) {
  return page.locator('#court').evaluate(node => {
    const canvas = node as HTMLCanvasElement;
    const pixels = canvas.getContext('2d')!.getImageData(42, 0, 1, canvas.height).data;
    const ys: number[] = [];
    for (let y = 0; y < canvas.height; y++) {
      const i = y * 4;
      if (pixels[i] >= 90 && pixels[i] <= 115 && pixels[i + 1] >= 235 && pixels[i + 2] >= 195 && pixels[i + 2] <= 220) ys.push(y);
    }
    if (!ys.length) throw new Error('The player paddle was not rendered at its expected court position');
    return ys.reduce((sum, y) => sum + y, 0) / ys.length;
  });
}

const runtime = new WeakMap<Page, { errors: string[]; external: string[]; csp: unknown[]; failedResponses: string[] }>();
test.beforeEach(async ({ page, baseURL }) => {
  const evidence = { errors: [] as string[], external: [] as string[], csp: [] as unknown[], failedResponses: [] as string[] };
  runtime.set(page, evidence);
  const origin = new URL(baseURL!).origin;
  page.on('pageerror', error => evidence.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') evidence.errors.push(message.text()); });
  page.on('request', request => {
    const url = new URL(request.url());
    if (/^https?:$/.test(url.protocol) && url.origin !== origin) evidence.external.push(url.href);
  });
  page.on('response', response => { if (response.status() >= 400) evidence.failedResponses.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => {
    Math.random = () => 0;
    (window as Window & { __integrationCsp?: unknown[] }).__integrationCsp = [];
    document.addEventListener('securitypolicyviolation', event => {
      (window as unknown as { __integrationCsp: unknown[] }).__integrationCsp.push({ directive: event.violatedDirective, blocked: event.blockedURI });
    });
  });
  // CSP errors are also captured in console before a document is navigated away from.
});
test.afterEach(async ({ page }, info) => {
  const evidence = runtime.get(page)!;
  if (!page.isClosed()) evidence.csp = await page.evaluate(() => (window as Window & { __integrationCsp?: unknown[] }).__integrationCsp || []).catch(() => []);
  await info.attach('multi-game-runtime', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  expect(evidence.errors, 'page, console and CSP errors').toEqual([]);
  expect(evidence.external, 'requests outside the game origin').toEqual([]);
  expect(evidence.failedResponses, 'failed runtime assets').toEqual([]);
  expect(evidence.csp, 'security policy violations').toEqual([]);
});

test('G014-01 three available cards launch their own game and return to the shared home', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#catalog-total')).toHaveText('37');
  await expect(page.locator('#intro-preview')).toHaveText('플레이 가능 8 · 준비 중 29');
  await page.locator('#include-upcoming').uncheck();
  expect(await cardIds(page)).toEqual(['number-garden', 'little-dragon', 'neon-rally', 'cosmic-cleanup', 'block-workshop', 'balloon-sparrow', 'desert-post', 'cloud-bunny']);
  const games = [
    { id: 'number-garden', href: paths.garden, ready: '#board' },
    { id: 'little-dragon', href: paths.snake, ready: '#primary' },
    { id: 'neon-rally', href: paths.pong, ready: '#primary-action' },
  ];
  for (const game of games) {
    await expect(page.locator(`.game-card[data-id="${game.id}"] a.card-action`)).toHaveAttribute('href', game.href);
    await launch(page, game.id);
    expect(new URL(page.url()).pathname).toBe(game.href);
    await expect(page.locator(game.ready)).toBeVisible();
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/assets/favicon.svg');
    if (game.id === 'number-garden') {
      await page.locator('a.exit-home').first().click();
      await expect(page.locator('#game-dialog')).toBeVisible();
      await page.locator('#result-home').click();
    } else {
      await page.locator(game.id === 'little-dragon' ? '.home-link' : '.back-link').click();
    }
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.locator('#game-grid')).toBeVisible();
  }
});

test('G014-02 new game tags combine with favorites and persist through game navigation', async ({ page }) => {
  await page.goto('/');
  for (const [query, id] of [['snake', 'little-dragon'], ['퐁', 'neon-rally']]) {
    await page.locator('#game-search').fill(query);
    expect(await cardIds(page)).toEqual([id]);
    await page.locator(`.favorite-button[data-id="${id}"]`).click();
  }
  await page.locator('#clear-search').click();
  await page.locator('#favorites-only').click();
  expect(await cardIds(page)).toEqual(['little-dragon', 'neon-rally']);
  await page.locator('#genre-tabs [data-genre="순발력"]').click();
  await page.locator('#include-upcoming').uncheck();
  await page.locator('#game-search').fill('코스튬');
  expect(await cardIds(page)).toEqual(['little-dragon']);
  await launch(page, 'little-dragon');
  await page.locator('.home-link').click();
  await expect(page.locator('#favorite-count')).toHaveText('2');
  await page.locator('#favorites-only').click();
  expect(await cardIds(page)).toEqual(['little-dragon', 'neon-rally']);
  await page.reload();
  await expect(page.locator('#favorite-count')).toHaveText('2');
  expect(await parsed(page, keys.favorites)).toEqual(['little-dragon', 'neon-rally']);
});

test('G014-03 snake earns food through inputs, pauses, equips an unlocked outfit and reloads records', async ({ page }) => {
  await freezeClock(page);
  await page.goto(paths.snake);
  await page.locator('#primary').click();
  await expect(page.locator('#playfield')).toBeFocused();
  await page.clock.runFor(432); // Two cells right, toward the deterministic first food.
  await page.keyboard.press('ArrowUp');
  await page.clock.runFor(400); // Two cells up: first food at (12, 8).
  await expect(page.locator('#score')).toHaveText('10 점');
  expect(await parsed(page, keys.snake)).toMatchObject({ bestScore: 10, totalFood: 1, unlocked: ['base', 'explorer'] });
  await page.locator('#pause').click();
  await expect(page.locator('#primary')).toHaveText('여행 재개');
  await page.clock.runFor(32);
  const pausedBoard = await page.locator('#board').evaluate(node => (node as HTMLCanvasElement).toDataURL());
  await page.clock.runFor(1200);
  expect(await page.locator('#board').evaluate(node => (node as HTMLCanvasElement).toDataURL())).toBe(pausedBoard);
  await page.locator('#primary').click();
  await page.clock.runFor(240);
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await page.locator('#board').evaluate(node => (node as HTMLCanvasElement).toDataURL())).not.toBe(pausedBoard);
  await page.locator('#wardrobe').click();
  await expect(page.locator('#closet')).toBeVisible();
  await page.locator('[data-set="space"]').click();
  await expect(page.locator('#apply-outfit')).toBeDisabled();
  await page.locator('[data-set="explorer"]').click();
  await page.locator('#apply-outfit').click();
  await expect(page.locator('#closet')).toBeHidden();
  expect(await parsed(page, keys.snake)).toMatchObject({ equipment: { head: 'explorer', scales: 'explorer', tail: 'explorer' } });
  await page.reload();
  await expect(page.locator('#primary')).toHaveText('여행 시작');
  await expect(page.locator('#score')).toHaveText('0 점');
  await expect(page.locator('#best')).toHaveText('10 점');
  await page.locator('#wardrobe').click();
  await expect(page.locator('[data-set="explorer"]')).toHaveAttribute('aria-pressed', 'true');
});

test('G014-04 pong settings survive reload and real keyboard and pointer input move the paddle', async ({ page, isMobile, browserName, context }) => {
  await freezeClock(page);
  await page.goto(paths.pong);
  await choosePongSetting(page, 'difficulty', 'easy');
  await choosePongSetting(page, 'paddle-theme', 'prism');
  await choosePongSetting(page, 'ball-theme', 'diamond');
  await choosePongSetting(page, 'court-theme', 'orbit');
  await page.locator('#mute').click();
  expect(await parsed(page, keys.pong)).toMatchObject({ difficulty: 'easy', muted: true, themes: { paddle: 'prism', ball: 'diamond', court: 'orbit' } });
  await page.reload();
  await expect(page.locator('#ai-level')).toHaveText('AI / EASY');
  await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#primary-action').click();
  await expect(page.locator('#arena')).toBeFocused();
  await page.clock.runFor(32);
  const initial = await paddleY(page);
  await page.keyboard.down('ArrowDown');
  await page.clock.runFor(224);
  await page.keyboard.up('ArrowDown');
  expect(await paddleY(page)).toBeGreaterThan(initial + 60);
  await page.keyboard.press('p');
  await expect(page.locator('#status-label')).toHaveText('일시정지');
  const pausedCourt = await page.locator('#court').evaluate(node => (node as HTMLCanvasElement).toDataURL());
  await page.clock.runFor(1000);
  expect(await page.locator('#court').evaluate(node => (node as HTMLCanvasElement).toDataURL())).toBe(pausedCourt);
  await page.locator('#primary-action').click();
  const court = page.locator('#court');
  await court.scrollIntoViewIfNeeded();
  const rect = await court.boundingBox();
  expect(rect).not.toBeNull();
  if (isMobile && browserName === 'chromium') {
    // Chromium's native touch transport keeps a real pointer active for the drag.
    const session = await context.newCDPSession(page);
    const touch = (ratio: number) => [{ x: rect!.x + rect!.width * .1, y: rect!.y + rect!.height * ratio, radiusX: 1, radiusY: 1, force: 1, id: 1 }];
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch(.7) });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touch(.2) });
    await page.clock.runFor(400);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else {
    // Playwright WebKit has tap but no sustained touch transport; use its real pointer drag.
    if (isMobile) await page.touchscreen.tap(rect!.x + rect!.width * .2, rect!.y + rect!.height * .5);
    await page.mouse.move(rect!.x + rect!.width * .1, rect!.y + rect!.height * .7);
    await page.mouse.down();
    await page.mouse.move(rect!.x + rect!.width * .1, rect!.y + rect!.height * .2, { steps: 4 });
    await page.clock.runFor(400);
    await page.mouse.up();
  }
  expect(await paddleY(page)).toBeLessThan(initial - 60);
  await page.clock.runFor(800);
  await expect(page.locator('#status-label')).toHaveText('경기 중');
  await page.locator('#pause').click();
  await expect(page.locator('#status-label')).toHaveText('일시정지');
});

test('G014-05 three game profiles and home favorites stay isolated on the same origin', async ({ page }) => {
  await page.goto('/');
  await page.locator('.favorite-button[data-id="little-dragon"]').click();
  const favorites = await stored(page, keys.favorites);
  await launch(page, 'number-garden');
  await expect(page.locator('#board')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#score')).toHaveText('4');
  const garden = await stored(page, keys.garden);
  await page.locator('#exit-button').click();
  await page.locator('#result-home').click();
  await launch(page, 'little-dragon');
  await page.locator('#sound').click();
  const snake = await stored(page, keys.snake);
  expect(JSON.parse(snake!)).toMatchObject({ bestScore: 0, totalFood: 0, muted: false });
  expect(await stored(page, keys.garden)).toBe(garden);
  expect(await stored(page, keys.favorites)).toBe(favorites);
  await page.locator('.home-link').click();
  await launch(page, 'neon-rally');
  await choosePongSetting(page, 'difficulty', 'easy');
  await choosePongSetting(page, 'ball-theme', 'comet');
  const pong = await stored(page, keys.pong);
  expect(JSON.parse(pong!)).toMatchObject({ difficulty: 'easy', themes: { ball: 'comet' } });
  expect(await stored(page, keys.garden)).toBe(garden);
  expect(await stored(page, keys.snake)).toBe(snake);
  expect(await stored(page, keys.favorites)).toBe(favorites);
  await page.locator('.back-link').click();
  await page.locator('#favorites-only').click();
  expect(await cardIds(page)).toEqual(['little-dragon']);
  await page.locator('#favorites-only').click();
  await launch(page, 'number-garden');
  await expect(page.locator('#best-score')).toHaveText('4');
  expect((await parsed(page, keys.garden)).gamesStarted).toBe(2);
  expect(await stored(page, keys.snake)).toBe(snake);
  expect(await stored(page, keys.pong)).toBe(pong);
  expect(await stored(page, keys.favorites)).toBe(favorites);
});

test('G014-06 added game pages fit 320px and short landscape with usable controls', async ({ page }) => {
  const problems = async () => page.locator('button:visible,select:visible,a.home-link:visible,a.back-link:visible').evaluateAll(nodes => nodes.filter(node => {
    const rect = node.getBoundingClientRect();
    return rect.width < 43.9 || rect.height < 43.9;
  }).map(node => ({ id: node.id, text: node.textContent, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  for (const viewport of [{ width: 320, height: 667 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    for (const [path, start] of [[paths.snake, '#primary'], [paths.pong, '#primary-action']]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} horizontal overflow at ${viewport.width}`).toBe(true);
      expect(await problems(), `${path} target sizes at ${viewport.width}`).toEqual([]);
      const primary = await page.locator(start).boundingBox();
      const field = await page.locator(path === paths.snake ? '#playfield' : '#arena').boundingBox();
      expect(primary!.x).toBeGreaterThanOrEqual(field!.x - 1);
      expect(primary!.y).toBeGreaterThanOrEqual(field!.y - 1);
      expect(primary!.x + primary!.width).toBeLessThanOrEqual(field!.x + field!.width + 1);
      expect(primary!.y + primary!.height).toBeLessThanOrEqual(field!.y + field!.height + 1);
      if (path === paths.snake) {
        await page.locator('#wardrobe').click();
        await expect(page.locator('#closet')).toBeVisible();
        expect(await page.locator('#closet').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
        expect(await problems(), `snake wardrobe target sizes at ${viewport.width}`).toEqual([]);
        await page.locator('#cancel-outfit').click();
      }
    }
  }
});
