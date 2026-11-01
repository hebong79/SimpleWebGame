import { test as base, expect, type Page, type TestInfo, type Locator } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Both actual main modules and implementation handoffs were read. The two
// adapters below observe their distinct state/modal/control shapes only.
export const G028_ADAPTERS_READY = true;
const FAVORITES = 'simplegames.library.favorites.v1';
const SENTINEL = 'g028.integration.unrelated-sentinel';
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const GAMES = [
  { id: 'sun-sea-four', title: '햇빛과 바다 4목', route: '/games/15-connect-four/index.html', key: 'simplegames.sun-sea-four.v1' },
  { id: 'four-star-song', title: '네 별의 노래', route: '/games/16-simon/index.html', key: 'simplegames.four-star-song.v1' },
] as const;
type Game = typeof GAMES[number];
const FIRST12 = ['number-garden', 'little-dragon', 'neon-rally', 'cosmic-cleanup', 'block-workshop', 'balloon-sparrow', 'desert-post', 'cloud-bunny', 'chick-picnic', 'hamster-depot', 'gem-survey', 'number-postbox'];
const EXISTING = [...FIRST12, 'snack-pairs', 'star-moon'];
const attach = (info: TestInfo, name: string, data: unknown) => info.attach(name, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
// Contract: actual native/unfrozen hold >=80ms, not an exact80ms driver delay.
// Leave 20ms scheduling margin; trustedPresses still rejects any actual hold <80ms.
const press = (control: Locator) => control.click({ delay: 100 }); // Native trusted events, real clock, never page.clock.
const stored = (page: Page): Promise<Record<string, string | null>> => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])));
const cardIds = (page: Page) => page.locator('.game-card').evaluateAll(nodes => nodes.map(n => (n as HTMLElement).dataset.id));
interface Audit { console: unknown[]; pageErrors: unknown[]; csp: unknown[]; external: unknown[]; failedHTTP: unknown[]; failedRequests: unknown[]; unsafeMethods: unknown[] }
const test = base.extend<{ audit: Audit }>({
  audit: [async ({ context, baseURL }, use, info) => {
    const origin = new URL(baseURL!).origin;
    const audit: Audit = { console: [], pageErrors: [], csp: [], external: [], failedHTTP: [], failedRequests: [], unsafeMethods: [] };
    const watch = (page: Page) => {
      page.on('console', m => audit.console.push({ type: m.type(), text: m.text(), location: m.location() }));
      page.on('pageerror', e => audit.pageErrors.push(e.stack ?? e.message));
      page.on('websocket', s => audit.external.push({ websocket: s.url() }));
    };
    context.pages().forEach(watch); context.on('page', watch);
    await context.route('**/*', async route => {
      const r = route.request();
      if (new URL(r.url()).origin !== origin) { audit.external.push(r.url()); await route.abort(); }
      else if (!['GET', 'HEAD'].includes(r.method())) { audit.unsafeMethods.push({ url: r.url(), method: r.method() }); await route.abort(); }
      else await route.continue();
    });
    context.on('response', r => { if (r.status() >= 400) audit.failedHTTP.push({ url: r.url(), status: r.status() }); });
    context.on('requestfailed', r => audit.failedRequests.push({ url: r.url(), failure: r.failure() }));
    await context.exposeBinding('__g028CspAudit', ({ frame }, data) => audit.csp.push({ frame: frame.url(), data }));
    await context.addInitScript(() => {
      const w = window as unknown as { __g028CspAudit: (data: unknown) => Promise<void>; __g028Clicks: unknown[] };
      w.__g028Clicks = [];
      let down: { target: Element; at: number; trusted: boolean; pointerId: number } | null = null;
      let released: { target: Element; holdMs: number; trusted: boolean } | null = null;
      document.addEventListener('pointerdown', e => {
        const target = e.target instanceof Element ? e.target.closest('button,a') : null;
        down = target ? { target, at: performance.now(), trusted: e.isTrusted, pointerId: e.pointerId } : null;
        released = null;
      }, true);
      document.addEventListener('pointerup', e => {
        const target = e.target instanceof Element ? e.target.closest('button,a') : null;
        released = down && down.pointerId === e.pointerId && down.target === target
          ? { target, holdMs: performance.now() - down.at, trusted: down.trusted && e.isTrusted } : null;
        down = null;
      }, true);
      document.addEventListener('securitypolicyviolation', e => { void w.__g028CspAudit({ uri: e.blockedURI, directive: e.effectiveDirective, policy: e.originalPolicy }); });
      document.addEventListener('click', e => {
        const n = e.target instanceof Element ? e.target.closest('button,a') : null;
        if (n) w.__g028Clicks.push({ id: n.id, label: n.getAttribute('aria-label') ?? n.textContent, trusted: e.isTrusted, timestamp: performance.now(),
          holdMs: released?.target === n ? released.holdMs : null, pointerTrusted: released?.target === n ? released.trusted : false });
        released = null;
      }, true);
    });
    try { await use(audit); }
    finally {
      await attach(info, 'unfiltered-console-network-csp', audit);
      for (const [name, values] of Object.entries(audit)) expect.soft(values, name).toEqual([]);
    }
  }, { auto: true }],
});
async function home(page: Page) {
  await expect(page).toHaveURL(/\/(?:index\.html)?$/);
  await expect(page.locator('#catalog-total')).toHaveText('45');
  await expect(page.locator('#intro-preview')).toHaveText('플레이 가능 16 · 준비 중 29');
}
async function reveal(page: Page, id: string) {
  // Search is a public route to any card; never assume a first12 position.
  // Reset is intentionally visible only in the empty state, not on initial home.
  await page.locator('#game-search').fill('g028-no-such-game-reset');
  await expect(page.locator('#empty-state')).toBeVisible();
  await press(page.locator('#reset-filters'));
  const query = GAMES.find(g => g.id === id)?.title ?? ({ 'memory-pieces': '기억의 조각', 'leisure-line': '한 줄의 여유', 'dice-picnic': '주사위 소풍' } as Record<string, string>)[id];
  if (!query) throw new Error(`No public search label registered for ${id}`);
  await page.locator('#game-search').fill(query);
  const card = page.locator(`.game-card[data-id="${id}"]`); await expect(card).toBeVisible(); return card;
}
async function launch(page: Page, game: Game, info: TestInfo) {
  await home(page); const card = await reveal(page, game.id);
  const svg = card.locator('svg'); await expect(svg).toHaveAttribute('viewBox', '0 0 96 96');
  expect(await svg.locator('script,style,foreignObject,use,image').count()).toBe(0);
  expect(await svg.locator('path,circle,rect').count()).toBeGreaterThan(5);
  await attach(info, `${game.id}-original-card-svg`, await svg.evaluate(n => n.outerHTML));
  const link = card.locator('a.card-action'); await expect(link).toHaveAttribute('href', game.route);
  const navigation = page.waitForNavigation(); await press(link); const response = await navigation;
  expect(response?.status()).toBe(200); expect(response?.headers()['content-security-policy']).toBe(CSP);
  await expect(page).toHaveURL(new RegExp(`${game.route.replaceAll('.', '\\.')}$`));
}
async function layout(page: Page, info: TestInfo, label: string) {
  const geometry = await page.evaluate(() => ({ width: innerWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth,
    controls: [...document.querySelectorAll('button,a,input,summary,[role="gridcell"]')]
      .filter(n => n.getClientRects().length && !n.closest('[hidden],dialog:not([open])') && getComputedStyle(n).visibility !== 'hidden')
      .map(n => { const r = n.getBoundingClientRect(); return { id: n.id, label: n.getAttribute('aria-label') ?? n.textContent, width: r.width, height: r.height }; }) }));
  await attach(info, label, geometry); expect(geometry.doc).toBeLessThanOrEqual(geometry.width); expect(geometry.body).toBeLessThanOrEqual(geometry.width);
  expect(geometry.controls.filter(n => n.width < 44 || n.height < 44), 'minimum44px interactive hit targets').toEqual([]);
}
async function shortDialogLayout(page: Page, info: TestInfo, label: string) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Explicit desktop/mobile viewport required');
  await layout(page, info, label);
  await page.setViewportSize({ width: 320, height: 480 });
  try { await layout(page, info, `${label}-320x480`); }
  finally { await page.setViewportSize(viewport); }
}
async function trustedPresses(page: Page) {
  const clicks = await page.evaluate(() => (window as unknown as { __g028Clicks: { id: string; trusted: boolean; pointerTrusted: boolean; holdMs: number | null }[] }).__g028Clicks);
  expect(clicks.length).toBeGreaterThan(0);
  for (const click of clicks) {
    expect(click.trusted, `${click.id}: trusted native click`).toBe(true);
    expect(click.pointerTrusted, `${click.id}: trusted pointer down/up`).toBe(true);
    expect(click.holdMs, `${click.id}: actual unfrozen pointer hold`).not.toBeNull();
    expect(click.holdMs!, `${click.id}: actual pointer hold >=80ms`).toBeGreaterThanOrEqual(80);
  }
  return clicks;
}
interface FourSnapshot {
  phase: string; subphase: string; round: number; board: (null | 'sun' | 'sea')[][];
  moves: number; current: string; starter: string; remainingMs: number; outcome: string | null;
  records: { sunWins: number; seaWins: number; draws: number };
  settings: { theme: 'coast' | 'evening'; muted: boolean }; modal: string | null;
}
interface SongSnapshot {
  phase: string; subphase: string; round: number; sequence: number[]; cursor: number;
  remaining: number; completedLength: number; token: number; modal: string | null;
  records: { plays: number; bestLength: number; totalCompleted: number };
  settings: { theme: 'night' | 'dawn'; muted: boolean }; result: null | { reason: string; score: number };
}
const four = (page: Page): Promise<FourSnapshot> => page.evaluate(() => (window as unknown as { __g028Snapshot: () => FourSnapshot }).__g028Snapshot());
const song = (page: Page): Promise<SongSnapshot> => page.evaluate(() => (window as unknown as { __g028Snapshot: () => SongSnapshot }).__g028Snapshot());
async function fourLifecycle(page: Page, info: TestInfo) {
  const ready = await four(page); expect(ready.phase).toBe('ready'); expect(ready.moves).toBe(0);
  await press(page.locator('#start')); await expect.poll(async () => (await four(page)).phase).toBe('playing');
  await press(page.locator('.column[data-column="0"]'));
  await expect.poll(async () => (await four(page)).subphase).toBe('choosing');
  const moved = await four(page); expect(moved.moves).toBe(1); expect(moved.board[5]![0]).toBe('sun');
  await press(page.locator('#pause')); await expect(page.locator('#resume')).toHaveText('이어서하기');
  const paused = await four(page); await page.waitForTimeout(280); expect(await four(page)).toEqual(paused);
  await press(page.locator('#settings')); await expect(page.locator('#modal')).toBeVisible();
  await shortDialogLayout(page, info, 'four-theme-modal');
  const theme = ready.settings.theme === 'coast' ? 'evening' : 'coast';
  await press(page.locator(`.theme-option[data-theme="${theme}"]`));
  expect((await four(page)).settings.theme).toBe(ready.settings.theme);
  await press(page.locator('#settings-apply')); const applied = await four(page);
  expect(applied.phase).toBe('paused'); expect(applied.board).toEqual(paused.board); expect(applied.settings.theme).toBe(theme);
  await press(page.locator('#mute')); expect((await four(page)).settings.muted).toBe(!ready.settings.muted);
  await press(page.locator('#help')); await press(page.locator('#modal-close')); expect((await four(page)).phase).toBe('paused');
  const beforeCancel = await four(page);
  await press(page.locator('#restart')); await press(page.locator('#modal-close')); expect(await four(page)).toEqual(beforeCancel);
  await press(page.locator('#home')); await press(page.locator('#modal-close')); expect(await four(page)).toEqual(beforeCancel);
  await press(page.locator('#resume'));
  for (const col of [1, 0, 1, 0, 1, 0]) {
    await press(page.locator(`.column[data-column="${col}"]`));
    await expect.poll(async () => (await four(page)).subphase).toBe('choosing');
  }
  const won = await four(page); expect(won.phase).toBe('result'); expect(won.outcome).toBe('sun');
  expect(won.moves).toBe(7); expect(won.records.sunWins).toBe(ready.records.sunWins + 1);
  await press(page.locator('#next')); const next = await four(page);
  expect(next.starter).toBe('sea'); expect(next.moves).toBe(0); expect(next.records).toEqual(won.records);
  await press(page.locator('#home')); const clicks = await trustedPresses(page);
  await attach(info, 'four-actual-api-real-clock', { ready, moved, paused, applied, won, next, clicks });
  await press(page.locator('#modal-confirm')); await home(page);
}
async function songLifecycle(page: Page, info: TestInfo) {
  const ready = await song(page); expect(ready.phase).toBe('ready'); expect(ready.sequence).toEqual([]);
  await press(page.locator('#start'));
  await expect.poll(async () => (await song(page)).subphase).toBe('input');
  const input = await song(page); expect(input.sequence).toHaveLength(1); expect(input.completedLength).toBe(0);
  await press(page.locator(`#pad-${input.sequence[0]}`));
  await expect.poll(async () => (await song(page)).completedLength).toBe(1);
  await press(page.locator('#pause')); await expect(page.locator('#resume')).toHaveText('이어서하기');
  const paused = await song(page); await page.waitForTimeout(280); expect(await song(page)).toEqual(paused);
  await press(page.locator('#theme')); await shortDialogLayout(page, info, 'song-theme-modal');
  const theme = ready.settings.theme === 'night' ? 'dawn' : 'night';
  await press(page.locator(`#theme-${theme}`)); expect((await song(page)).settings.theme).toBe(ready.settings.theme);
  await press(page.locator('#modal-apply')); const applied = await song(page);
  expect(applied.phase).toBe('paused'); expect(applied.sequence).toEqual(paused.sequence); expect(applied.remaining).toBe(paused.remaining);
  expect(applied.settings.theme).toBe(theme);
  await press(page.locator('#mute')); expect((await song(page)).settings.muted).toBe(!ready.settings.muted);
  await press(page.locator('#help')); await press(page.locator('#modal-close')); expect((await song(page)).phase).toBe('paused');
  const beforeCancel = await song(page);
  await press(page.locator('#restart')); await press(page.locator('#modal-close')); expect(await song(page)).toEqual(beforeCancel);
  await press(page.locator('#home')); await press(page.locator('#modal-close')); expect(await song(page)).toEqual(beforeCancel);
  await press(page.locator('#resume')); await expect.poll(async () => (await song(page)).subphase).toBe('input');
  const second = await song(page); expect(second.sequence).toHaveLength(2); expect(second.sequence[0]).toBe(input.sequence[0]);
  await press(page.locator(`#pad-${(second.sequence[0]! + 1) % 4}`));
  const result = await song(page); expect(result.phase).toBe('result'); expect(result.result?.reason).toBe('wrong');
  expect(result.completedLength).toBe(1); expect(result.records.plays).toBe(ready.records.plays + 1);
  expect(result.records.totalCompleted).toBe(ready.records.totalCompleted + 1);
  await press(page.locator('#help')); await press(page.locator('#modal-close')); expect((await song(page)).records).toEqual(result.records);
  await press(page.locator('#retry')); expect((await song(page)).token).toBeGreaterThan(result.token);
  await press(page.locator('#home')); const clicks = await trustedPresses(page);
  await attach(info, 'song-actual-api-real-clock', { ready, input, paused, applied, second, result, clicks });
  await press(page.locator('#modal-apply')); await home(page);
}
async function lifecycle(page: Page, game: Game, info: TestInfo): Promise<void> {
  if (game.id === 'sun-sea-four') return fourLifecycle(page, info);
  return songLifecycle(page, info);
}

test('G028-CATALOG @smoke 45/16/29, public More reveals new cards, old upcoming records remain separate', async ({ page }, info) => {
  const r = await page.goto('/'); expect(r?.headers()['content-security-policy']).toBe(CSP); await home(page);
  await expect(page.locator('.game-card')).toHaveCount(12); expect(await cardIds(page)).toEqual(FIRST12);
  for (const count of [24, 36, 45]) { await press(page.locator('#load-more')); await expect(page.locator('.game-card')).toHaveCount(count); }
  expect(new Set(await cardIds(page)).size).toBe(45); await expect(page.locator('.game-card.available')).toHaveCount(16); await expect(page.locator('.game-card.upcoming')).toHaveCount(29);
  for (const id of ['memory-pieces', 'leisure-line']) {
    const card = page.locator(`.game-card[data-id="${id}"]`); await expect(card.locator('button.card-action')).toBeDisabled(); await expect(card.locator('a.card-action')).toHaveCount(0);
  }
  for (const game of GAMES) await expect(page.locator(`.game-card[data-id="${game.id}"] a.card-action`)).toHaveAttribute('href', game.route);
  await attach(info, 'public-pagination', { cards: await cardIds(page), first12: FIRST12, previous14: EXISTING });
});
for (const game of GAMES) {
  test(`G028-${game.id} @smoke public card → start/input/pause/theme/mute/resume/home trusted80ms strictCSP`, async ({ page, browserName }, info) => {
    await page.goto('/'); await launch(page, game, info); await layout(page, info, `${game.id}-ready`);
    await lifecycle(page, game, info); await home(page);
    expect((await stored(page))[game.key], 'explicit settings action must persist its own game key').toBeTruthy();
    await page.reload(); await home(page);
    await attach(info, 'render-evidence-scope', { realClock: true, holdMs: 80, clockFrozen: false, physicalDevice: 'not_executed', webkitImage: 'not_executed: DOM geometry only under strict CSP' });
    if (browserName === 'chromium') await info.attach(`${game.id}-home-render`, { body: await page.screenshot({ fullPage: true, animations: 'allow', caret: 'initial' }), contentType: 'image/png' });
  });
}
test('G028-FAVORITES @smoke search new+old upcoming favorites, reload/remove/compound filter without first12 assumptions', async ({ page }) => {
  await page.goto('/');
  for (const id of ['memory-pieces', 'sun-sea-four', 'four-star-song']) { const card = await reveal(page, id); await press(card.locator('.favorite-button')); }
  await page.reload(); await home(page); await expect(page.locator('#favorite-count')).toHaveText('3');
  await press(page.locator('#favorites-only')); expect(await cardIds(page)).toEqual(['sun-sea-four', 'four-star-song', 'memory-pieces']);
  await page.locator('#include-upcoming').uncheck(); expect(await cardIds(page)).toEqual(['sun-sea-four', 'four-star-song']);
  await page.locator('#genre-tabs [data-genre="기억"]').click(); expect(await cardIds(page)).toEqual(['four-star-song']);
  await press(page.locator('.favorite-button')); await expect(page.locator('#empty-state')).toBeVisible(); await expect(page.locator('#favorites-only')).toBeFocused();
  expect(JSON.parse((await stored(page))[FAVORITES]!)).toEqual(['memory-pieces', 'sun-sea-four']);
});
test('G028-LAYOUT full native320/short dialogs + reducedmotion geometry/render evidence', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of [{ width: 320, height: 667 }, { width: 320, height: 480 }]) {
    await page.setViewportSize(viewport);
    for (const game of GAMES) {
      await page.goto('/'); await launch(page, game, info); await layout(page, info, `${game.id}-${viewport.height}-reduced`);
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
      await lifecycle(page, game, info);
    }
  }
});
async function existingProfiles(): Promise<Record<string, string>> {
  const build = resolve(import.meta.dirname, '../..', process.env.GAME_TEST_BUILD_DIR!);
  const product = (p: string) => import(pathToFileURL(resolve(build, p)).href);
  const values: Record<string, string> = {}, put = (key: string, record: unknown) => { values[key] = JSON.stringify(record); };
  const garden = await product('public/games/01-2048/storage.js'); put(garden.STORAGE_KEY, garden.defaultProfile());
  const snake = await product('public/games/02-snake/engine.mjs'); put(snake.STORAGE_KEY, snake.defaultProfile());
  const pong = await product('public/games/03-pong/save.mjs'); put(pong.SAVE_KEY, pong.normalizeSave(null));
  for (const directory of ['04-breakout', '05-falling-blocks']) {
    const e = await product(`public/games/${directory}/engine.mjs`), s = await product(`public/games/${directory}/save.mjs`);
    const game = e.createGame(); e.startGame(game); e.finishGame(game, 'quit');
    const memory = new Map<string, string>();
    const store = s.createStore(() => ({ getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v) }));
    store.record(game); const record = store.snapshot(); expect(s.validateSave(record)).toBe(true); put(s.STORAGE_KEY, record);
  }
  for (const [directory, result] of [['06-flappy', { score: 2, reason: 'quit' }], ['07-dino', { score: 12, metric: 123, reason: 'quit' }], ['08-doodle', { score: 10, metric: 104, reason: 'quit' }]] as const) {
    const s = await product(`public/games/${directory}/save.mjs`), record = s.settleRecord(s.defaultRecord(), result).record;
    expect(s.validateRecord(record).recovered).toBe(false); put(s.STORAGE_KEY, record);
  }
  const chick = await product('public/games/09-crossy/save.js'); const picnic = chick.settleRecord(chick.defaults(), 1); expect(chick.validRecord(picnic)).toBe(true); put(chick.STORAGE_KEY, picnic);
  const hamster = await product('public/games/10-sokoban/save.mjs'), depot = await product('public/games/10-sokoban/engine.mjs');
  const won = depot.move(depot.move(depot.createGame(1), 'R'), 'R'); expect(won.won).toBe(true);
  const delivery = hamster.settleClear(hamster.defaultRecord(), 1, { pushes: won.pushes, moves: won.moves }).record; expect(hamster.validateRecord(delivery)).toEqual(delivery); put(hamster.STORAGE_KEY, delivery);
  const mines = await product('public/games/11-mines/save.mjs'), map = mines.settleRecord(mines.defaults(), 'won', 1234); expect(mines.validateRecord(map)).toEqual(map); put(mines.STORAGE_KEY, map);
  const fifteen = await product('public/games/12-fifteen/save.mjs'), puzzles = await product('public/games/12-fifteen/puzzles.mjs');
  const mail = fifteen.settleRecord(fifteen.defaults(), puzzles.MODE_IDS[0], 20, 2345).save; expect(fifteen.sanitize(mail).recovered).toBe(false); put(fifteen.STORAGE_KEY, mail);
  const memory = await product('public/games/13-memory/save.mjs'); const snack = memory.defaults(); expect(memory.parseSave(JSON.stringify(snack)).warning).toBe(false); put(memory.STORAGE_KEY, snack);
  const three = await product('public/games/14-tic-tac-toe/save.mjs'); const night = three.defaultRecord(); expect(three.recoverRecord(night).warnings).toEqual([]); put(three.STORAGE_KEY, night);
  expect(Object.keys(values)).toHaveLength(14); return values;
}
test('G028-STORE full fourteen product-valid profiles + sentinel/upcoming favorites byte-preserved, two new keys survive reload', async ({ page }, info) => {
  const fixture = { ...await existingProfiles(), [FAVORITES]: JSON.stringify(['number-garden', 'memory-pieces', 'dice-picnic']), [SENTINEL]: 'preserve-unrelated-bytes' };
  await page.goto('/'); await page.evaluate(values => {
    if (localStorage.length !== 0) throw new Error('Expected fresh isolated context; seed must execute only once');
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
  }, fixture);
  await page.reload(); expect(await stored(page)).toEqual(fixture);
  const fresh: Record<string, string | null> = {};
  for (const game of GAMES) {
    await launch(page, game, info); await lifecycle(page, game, info); await home(page);
    const after = await stored(page); fresh[game.key] = after[game.key]; expect(fresh[game.key]).toBeTruthy();
    for (const [key, value] of Object.entries(fixture)) expect(after[key], key).toBe(value);
  }
  await page.reload(); const after = await stored(page);
  expect(after).toEqual({ ...fixture, ...fresh });
  await attach(info, 'fourteen-profiles-and-favorites', { fixture, fresh, after, seedExecutions: 1, reloadReseed: false, fixtureKind: 'actual product factories/settlements, not live state setters' });
});
