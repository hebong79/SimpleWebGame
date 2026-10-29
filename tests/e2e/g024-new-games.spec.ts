import { test as base, expect, type Page, type TestInfo } from '@playwright/test';

const FAVORITES = 'simplegames.library.favorites.v1';
const CHICK = 'simple-games:chick-picnic:v1';
const HAMSTER = 'simplegames.hamster-depot.v1';
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
interface Chick { mode: string; row: number; highest: number; hops: number; elapsed: number; dialog: string | null; record: { plays: number; muted: boolean; bestRows: number; totalRows: number } }
interface Hamster { phase: string; activePanel: string | null; game: { moves: number; pushes: number }; record: { muted: boolean; cleared: number[]; unlocked: number; bests: Record<string, { pushes: number; moves: number }> } }
const chick = (page: Page): Promise<Chick> => page.evaluate(() => (window as unknown as { __simpleGames09Snapshot: () => Chick }).__simpleGames09Snapshot());
const hamster = (page: Page): Promise<Hamster> => page.evaluate(() => (window as unknown as { __simpleGames10Snapshot: () => Hamster }).__simpleGames10Snapshot());
const press = (page: Page, selector: string) => page.locator(selector).click({ delay: 80 });
const storage = (page: Page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])));
const attach = (info: TestInfo, name: string, data: unknown) => info.attach(name, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
interface Audit { console: unknown[]; pageErrors: string[]; csp: unknown[]; external: string[]; failedHTTP: unknown[]; failedRequests: unknown[] }
const test = base.extend<{ audit: Audit }>({
  audit: [async ({ context, baseURL }, use, info) => {
    const origin = new URL(baseURL!).origin;
    const audit = { console: [] as unknown[], pageErrors: [] as string[], csp: [] as unknown[], external: [] as string[], failedHTTP: [] as unknown[], failedRequests: [] as unknown[] };
    const watch = (page: Page) => {
      page.on('console', m => { if (['error', 'warning', 'warn'].includes(m.type())) audit.console.push({ type: m.type(), text: m.text() }); });
      page.on('pageerror', e => audit.pageErrors.push(e.message));
      page.on('websocket', s => audit.external.push(s.url()));
    };
    context.pages().forEach(watch); context.on('page', watch);
    context.on('request', r => { if (new URL(r.url()).origin !== origin) audit.external.push(r.url()); });
    context.on('response', r => { if (r.status() >= 400) audit.failedHTTP.push({ url: r.url(), status: r.status() }); });
    context.on('requestfailed', r => audit.failedRequests.push({ url: r.url(), failure: r.failure() }));
    await context.exposeBinding('__g024Csp', ({ frame }, data) => audit.csp.push({ frame: frame.url(), data }));
    await context.addInitScript(() => document.addEventListener('securitypolicyviolation', e => {
      void (window as unknown as { __g024Csp: (value: unknown) => Promise<void> }).__g024Csp({ blockedURI: e.blockedURI, directive: e.effectiveDirective, policy: e.originalPolicy });
    }));
    try { await use(audit); }
    finally { await attach(info, 'unfiltered-runtime-audit', audit); for (const [key, value] of Object.entries(audit)) expect.soft(value, key).toEqual([]); }
  }, { auto: true }],
});
async function home(page: Page) {
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#catalog-total')).toHaveText('41');
  await expect(page.locator('#intro-preview')).toHaveText('플레이 가능 12 · 준비 중 29');
}
async function launch(page: Page, id: string, route: string, info?: TestInfo) {
  const link = page.locator(`.game-card[data-id="${id}"] a.card-action`);
  await expect(link).toHaveAttribute('href', route);
  const art = page.locator(`.game-card[data-id="${id}"] .card-art svg`);
  await expect(art).toHaveAttribute('viewBox', '0 0 96 96');
  expect(await art.locator('circle,ellipse,path,rect').count()).toBe(id === 'chick-picnic' ? 9 : 12);
  expect(await art.locator('script,foreignObject,use,image,style').count()).toBe(0);
  if (info) await attach(info, `${id}-original-vector`, await art.evaluate(n => ({ svg: n.outerHTML, rect: n.getBoundingClientRect().toJSON() })));
  await press(page, `.game-card[data-id="${id}"] a.card-action`);
  await expect(page).toHaveURL(new RegExp(`${route.replaceAll('.', '\\.')}$`));
  await page.waitForLoadState('load');
  await page.waitForFunction(id => typeof (window as unknown as Record<string, unknown>)[id === 'chick-picnic' ? '__simpleGames09Snapshot' : '__simpleGames10Snapshot'] === 'function', id);
}
async function layout(page: Page, info: TestInfo, name: string) {
  const data = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
    small: [...document.querySelectorAll('button,a')].filter(n => n.getClientRects().length && !n.closest('[hidden],dialog:not([open])') && getComputedStyle(n).visibility !== 'hidden').map(n => ({ id: n.id, width: n.getBoundingClientRect().width, height: n.getBoundingClientRect().height })).filter(r => r.width < 43.9 || r.height < 43.9) }));
  await attach(info, name, data); expect(data.scroll).toBeLessThanOrEqual(data.width); expect(data.small).toEqual([]);
}
async function favorite(page: Page, id: string) {
  await press(page, `.favorite-button[data-id="${id}"]`);
  await expect(page.locator(`.favorite-button[data-id="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
}

test('G024-09 @smoke real HTTP card start input pause resume mute wardrobe home, unfrozen trusted80ms', async ({ page, browserName }, info) => {
  const response = await page.goto('/'); expect(response?.headers()['content-security-policy']).toBe(CSP); await home(page);
  await favorite(page, 'number-garden'); await favorite(page, 'chick-picnic');
  const before = await storage(page);
  if (browserName === 'chromium') await page.locator('.game-card[data-id="chick-picnic"]').screenshot({ path: info.outputPath('chick-card.png') });
  await launch(page, 'chick-picnic', '/games/09-crossy/index.html', info);
  await layout(page, info, '09-ready-layout'); expect((await chick(page)).mode).toBe('ready');
  await press(page, '#primary'); expect((await chick(page)).mode).toBe('playing'); await expect(page.locator('#arena')).toBeFocused();
  await page.keyboard.press('ArrowUp'); await expect.poll(async () => (await chick(page)).highest).toBe(1);
  await press(page, '#primary'); const paused = await chick(page); expect(paused.mode).toBe('paused');
  await page.waitForTimeout(180); expect(await chick(page)).toEqual(paused);
  await press(page, '#mute'); expect((await chick(page)).record.muted).toBe(false);
  await press(page, '#mute'); expect((await chick(page)).record.muted).toBe(true);
  await press(page, '#wardrobe'); await expect(page.locator('#wardrobe-dialog')).toBeVisible();
  await press(page, '#part-hat'); await press(page, '#wardrobe-cancel');
  await press(page, '#wardrobe'); await press(page, '[data-set="straw"]'); await press(page, '#wardrobe-apply');
  await press(page, '#primary'); expect((await chick(page)).mode).toBe('playing');
  await press(page, '#home'); await expect(page.locator('#confirm-dialog')).toBeVisible();
  await press(page, '#confirm-yes'); expect((await chick(page)).mode).toBe('result'); expect((await chick(page)).record).toMatchObject({ plays: 1, bestRows: 1, totalRows: 1 });
  await attach(info, '09-public-input-result', await chick(page));
  await press(page, '#result-home'); await home(page);
  const after = await storage(page); for (const [key, value] of Object.entries(before)) expect(after[key], key).toBe(value);
  expect(JSON.parse(after[FAVORITES]!)).toEqual(['number-garden', 'chick-picnic']);
  await page.reload(); await expect(page.locator('#favorite-count')).toHaveText('2');
  await launch(page, 'chick-picnic', '/games/09-crossy/index.html'); expect((await chick(page)).record.plays).toBe(1); expect((await chick(page)).mode).toBe('ready');
});

test('G024-10 @smoke real HTTP card start input pause resume mute wardrobe confirmed home, trusted80ms', async ({ page, browserName }, info) => {
  await page.goto('/'); await home(page); await favorite(page, 'memory-pieces'); await favorite(page, 'hamster-depot');
  const before = await storage(page);
  if (browserName === 'chromium') await page.locator('.game-card[data-id="hamster-depot"]').screenshot({ path: info.outputPath('hamster-card.png') });
  await launch(page, 'hamster-depot', '/games/10-sokoban/index.html', info);
  await layout(page, info, '10-ready-layout'); expect((await hamster(page)).phase).toBe('ready');
  await press(page, '#primary'); expect((await hamster(page)).phase).toBe('playing'); await expect(page.locator('#arena')).toBeFocused();
  await page.keyboard.press('ArrowRight'); expect((await hamster(page)).game).toMatchObject({ moves: 1, pushes: 1 });
  await press(page, '#primary'); const paused = await hamster(page); expect(paused.phase).toBe('paused');
  await page.waitForTimeout(180); expect(await hamster(page)).toEqual(paused);
  await press(page, '#mute'); expect((await hamster(page)).record.muted).toBe(false);
  await press(page, '#mute'); expect((await hamster(page)).record.muted).toBe(true);
  await press(page, '#wardrobe'); await expect(page.locator('#modal')).toBeVisible();
  await press(page, '#preview-turn'); await press(page, '#wardrobe-cancel');
  await press(page, '#wardrobe'); await press(page, '#set-options [data-set="delivery"]'); await press(page, '#wardrobe-apply');
  await press(page, '#primary'); expect((await hamster(page)).phase).toBe('playing');
  await press(page, '#home'); expect((await hamster(page)).activePanel).toBe('confirm');
  await press(page, '#confirm-cancel'); expect((await hamster(page)).game).toEqual(paused.game);
  await press(page, '#primary'); await press(page, '#home'); await press(page, '#confirm-yes'); await home(page);
  const after = await storage(page); for (const [key, value] of Object.entries(before)) expect(after[key], key).toBe(value);
  expect(JSON.parse(after[FAVORITES]!)).toEqual(['memory-pieces', 'hamster-depot']);
  await page.reload(); await expect(page.locator('#favorite-count')).toHaveText('2');
  await attach(info, '10-returned-storage', after);
});

test('G024-STORE all eight existing profiles and old upcoming favorites survive two new games via public UI', async ({ page }, info) => {
  // No storage seeds/setters: all records and favorites below come from public controls.
  await page.goto('/'); await favorite(page, 'number-garden');
  await page.locator('#game-search').fill('주사위 소풍'); await favorite(page, 'dice-picnic');
  await page.goto('/game.html'); await press(page, '#exit-button');
  await press(page, '#result-home');
  for (const [route, control] of [
    ['02-snake', '#sound'], ['03-pong', '#mute'], ['04-breakout', '#mute'], ['05-falling-blocks', '#mute'],
    ['06-flappy', '#mute'], ['07-dino', '#mute'], ['08-doodle', '#mute'],
  ]) { await page.goto(`/games/${route}/index.html`); await press(page, control); }
  await page.goto('/'); const old = await storage(page);
  const oldKeys = ['number-garden:profile:v1', 'little-dragon.snake.v1', 'neon-rally.pong.v1', 'simplegames.breakout.v1', 'simplegames.fallingblocks.v1', 'simplegames.flappy.v1', 'simplegames.dino.v1', 'simplegames.doodle.v1', FAVORITES];
  for (const key of oldKeys) expect(old[key], key).toBeTruthy();
  await launch(page, 'chick-picnic', '/games/09-crossy/index.html'); await press(page, '#primary');
  await page.keyboard.press('ArrowUp'); await expect.poll(async () => (await chick(page)).highest).toBe(1);
  await press(page, '#home'); await press(page, '#confirm-yes'); await press(page, '#result-home');
  const chickSaved = (await storage(page))[CHICK]; expect(JSON.parse(chickSaved!)).toMatchObject({ plays: 1, bestRows: 1, totalRows: 1 });
  await launch(page, 'hamster-depot', '/games/10-sokoban/index.html'); await press(page, '#primary');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  expect((await hamster(page)).phase).toBe('won'); expect((await hamster(page)).record).toMatchObject({ cleared: [1], unlocked: 2, bests: { '1': { pushes: 2, moves: 2 } } });
  await press(page, '#result-home'); await home(page); await page.reload();
  const after = await storage(page); for (const key of oldKeys) expect(after[key], key).toBe(old[key]); expect(after[CHICK]).toBe(chickSaved);
  expect(JSON.parse(after[HAMSTER]!)).toMatchObject({ cleared: [1], unlocked: 2 });
  await page.locator('#favorites-only').click(); expect(await page.locator('.game-card').evaluateAll(n => n.map(c => (c as HTMLElement).dataset.id))).toEqual(['number-garden', 'dice-picnic']);
  await attach(info, 'all-eight-public-records-preserved', { old, after });
});
