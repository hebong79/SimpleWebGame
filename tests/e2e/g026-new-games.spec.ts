import { test as base, expect, type Page, type TestInfo, type Locator } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Both actual builder handoffs + main.mjs were read; adapters below use their
// different snapshot/modal/control shapes, not a speculative common game API.
export const G026_ADAPTERS_READY = true;
const FAVORITES = 'simplegames.library.favorites.v1';
const SENTINEL = 'g026.integration.unrelated-sentinel';
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const GAMES = [
  { id: 'snack-pairs', title: '간식 짝꿍', route: '/games/13-memory/index.html', key: 'simplegames.snack-pairs.v1' },
  { id: 'star-moon', title: '별과 달 3목', route: '/games/14-tic-tac-toe/index.html', key: 'simplegames.star-moon.v1' },
] as const;
type Game = typeof GAMES[number];
const EXISTING = ['number-garden', 'little-dragon', 'neon-rally', 'cosmic-cleanup', 'block-workshop', 'balloon-sparrow', 'desert-post', 'cloud-bunny', 'chick-picnic', 'hamster-depot', 'gem-survey', 'number-postbox'];
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
    await context.exposeBinding('__g026CspAudit', ({ frame }, data) => audit.csp.push({ frame: frame.url(), data }));
    await context.addInitScript(() => {
      const w = window as unknown as { __g026CspAudit: (data: unknown) => Promise<void>; __g026Clicks: unknown[] };
      w.__g026Clicks = [];
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
      document.addEventListener('securitypolicyviolation', e => { void w.__g026CspAudit({ uri: e.blockedURI, directive: e.effectiveDirective, policy: e.originalPolicy }); });
      document.addEventListener('click', e => {
        const n = e.target instanceof Element ? e.target.closest('button,a') : null;
        if (n) w.__g026Clicks.push({ id: n.id, label: n.getAttribute('aria-label') ?? n.textContent, trusted: e.isTrusted, timestamp: performance.now(),
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
  await expect(page.locator('#catalog-total')).toHaveText('43');
  await expect(page.locator('#intro-preview')).toHaveText('플레이 가능 14 · 준비 중 29');
}
async function reveal(page: Page, id: string) {
  // Search is a public route to any card; never assume a first12 position.
  // Reset is intentionally visible only in the empty state, not on initial home.
  await page.locator('#game-search').fill('g026-no-such-game-reset');
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
  const clicks = await page.evaluate(() => (window as unknown as { __g026Clicks: { id: string; trusted: boolean; pointerTrusted: boolean; holdMs: number | null }[] }).__g026Clicks);
  expect(clicks.length).toBeGreaterThan(0);
  for (const click of clicks) {
    expect(click.trusted, `${click.id}: trusted native click`).toBe(true);
    expect(click.pointerTrusted, `${click.id}: trusted pointer down/up`).toBe(true);
    expect(click.holdMs, `${click.id}: actual unfrozen pointer hold`).not.toBeNull();
    expect(click.holdMs!, `${click.id}: actual pointer hold >=80ms`).toBeGreaterThanOrEqual(80);
  }
  return clicks;
}
// Actual13 intake: docs/G026_13_IMPLEMENTATION.md, snapshot section40..47.
// This is observation only; no setter/state injection/clock override.
interface MemorySnapshot {
  gameId: 'snack-pairs'; phase: string; round: number;
  cards: { index: number; id: string; revealed: boolean; matched: boolean }[];
  attempts: number; matchedPairs: number; firstIndex: number | null;
  timing: { activeElapsedMs: number; mismatchRemainingMs: number; firstFlipStarted: boolean };
  settings: { mode: string; theme: string; muted: boolean };
  record: unknown; dialog: null | { kind: string; pending: unknown };
}
const memory = (page: Page): Promise<MemorySnapshot> => page.evaluate(() => (window as unknown as { __g026Snapshot: () => MemorySnapshot }).__g026Snapshot());
async function memoryLifecycle(page: Page, info: TestInfo) {
  const ready = await memory(page); expect(ready.gameId).toBe('snack-pairs'); expect(ready.phase).toBe('ready');
  await press(page.locator('#primary')); expect((await memory(page)).phase).toBe('playing');
  await press(page.locator('#board .card[data-index="0"]'));
  const opened = await memory(page); expect(opened.cards[0].revealed).toBe(true); expect(opened.attempts).toBe(0); expect(opened.firstIndex).toBe(0);
  await press(page.locator('#primary')); const paused = await memory(page); expect(paused.phase).toBe('paused');
  await page.waitForTimeout(180); expect(await memory(page)).toEqual(paused);
  await press(page.locator('#mute')); expect((await memory(page)).settings.muted).toBe(!paused.settings.muted);
  await press(page.locator('#mute')); expect((await memory(page)).settings.muted).toBe(paused.settings.muted);
  const choice = paused.settings.theme === 'meadow' ? 'evening' : 'meadow';
  await press(page.locator('#theme')); await expect(page.locator('#dialog')).toBeVisible();
  await shortDialogLayout(page, info, 'snack-pairs-theme-dialog');
  await press(page.locator(`[data-choice="${choice}"]`)); await press(page.locator('#dialog-cancel'));
  const cancelled = await memory(page); expect(cancelled.settings.theme).toBe(paused.settings.theme); expect(cancelled.cards).toEqual(paused.cards); expect(cancelled.phase).toBe('paused');
  await press(page.locator('#theme')); await press(page.locator(`[data-choice="${choice}"]`)); await press(page.locator('#dialog-apply'));
  const applied = await memory(page); expect(applied.settings.theme).toBe(choice); expect(applied.cards).toEqual(paused.cards); expect(applied.record).toEqual(paused.record); expect(applied.phase).toBe('paused');
  await press(page.locator('#home')); expect((await memory(page)).dialog?.kind).toBe('home'); await press(page.locator('#dialog-cancel'));
  const homeCancelled = await memory(page); expect(homeCancelled.phase).toBe('paused'); expect(homeCancelled.cards).toEqual(paused.cards); expect(homeCancelled.round).toBe(paused.round); expect(homeCancelled.timing).toEqual(paused.timing);
  await press(page.locator('#primary')); expect((await memory(page)).phase).toBe('playing'); expect((await memory(page)).cards).toEqual(paused.cards);
  await press(page.locator('#home')); await expect(page.locator('#dialog')).toBeVisible();
  const clicks = await trustedPresses(page);
  await attach(info, 'snack-pairs-actual-api-trusted80ms', { ready, opened, paused, applied, homeCancelled, clicks, clock: 'native/unfrozen' });
  await press(page.locator('#dialog-apply')); await home(page);
}
// Actual14 intake: docs/G026_14_IMPLEMENTATION.md + main.mjs. Unlike13,
// round is an object, modal is not dialog, timing is null, controls are separate.
interface ThreeSnapshot {
  gameId: 'star-moon'; phase: 'ready' | 'playing' | 'paused' | 'result';
  pauseCause: null | 'manual' | 'dialog' | 'protection';
  round: { id: number; starter: 'X' | 'O'; current: 'X' | 'O'; board: (null | 'X' | 'O')[]; moves: number; winner: null | 'X' | 'O' | 'draw'; winningLines: number[][] };
  board: (null | 'X' | 'O')[];
  stats: { session: { xWins: number; oWins: number; draws: number }; lifetime: { xWins: number; oWins: number; draws: number } };
  settings: { theme: 'paper' | 'night'; muted: boolean };
  record: { version: 1; settings: { theme: 'paper' | 'night'; muted: boolean }; lifetime: { xWins: number; oWins: number; draws: number } };
  timing: null; selection: number; modal: null | { kind: 'help' | 'theme' | 'home' | 'restart'; preview: 'paper' | 'night' }; warnings: string[];
}
const three = (page: Page): Promise<ThreeSnapshot> => page.evaluate(() => (window as unknown as { __g026Snapshot: () => ThreeSnapshot }).__g026Snapshot());
async function threeLifecycle(page: Page, info: TestInfo) {
  const ready = await three(page); expect(ready.gameId).toBe('star-moon'); expect(ready.phase).toBe('ready'); expect(ready.timing).toBeNull();
  expect(ready.round.board).toEqual(Array(9).fill(null)); expect(ready.round.starter).toBe('X'); expect(ready.modal).toBeNull();
  await press(page.locator('#start')); const started = await three(page); expect(started.phase).toBe('playing'); expect(started.round.id).toBe(ready.round.id + 1);
  await press(page.locator('#cell-0')); const opened = await three(page);
  expect(opened.round.board).toEqual(['X', ...Array(8).fill(null)]); expect(opened.board).toEqual(opened.round.board); expect(opened.round.moves).toBe(1); expect(opened.round.current).toBe('O');
  await press(page.locator('#pause')); const paused = await three(page); expect(paused.phase).toBe('paused'); expect(paused.pauseCause).toBe('manual');
  await page.waitForTimeout(180); expect(await three(page)).toEqual(paused);
  await press(page.locator('#mute')); expect((await three(page)).settings.muted).toBe(!paused.settings.muted);
  await press(page.locator('#mute')); expect((await three(page)).settings.muted).toBe(paused.settings.muted);
  const choice = paused.settings.theme === 'paper' ? 'night' : 'paper';
  await press(page.locator('#theme')); await expect(page.locator('#modal')).toBeVisible(); expect((await three(page)).modal?.kind).toBe('theme');
  await shortDialogLayout(page, info, 'star-moon-theme-dialog');
  await press(page.locator(`#theme-${choice}`)); const preview = await three(page);
  expect(preview.modal?.preview).toBe(choice); expect(preview.settings).toEqual(paused.settings); expect(preview.record).toEqual(paused.record); expect(preview.round).toEqual(paused.round);
  await expect(page.locator('body')).toHaveAttribute('data-theme', choice);
  await press(page.locator('#modal-close')); const cancelled = await three(page);
  expect(cancelled).toEqual(paused); await expect(page.locator('body')).toHaveAttribute('data-theme', paused.settings.theme);
  await press(page.locator('#theme')); await press(page.locator(`#theme-${choice}`)); await press(page.locator('#modal-apply'));
  const applied = await three(page); expect(applied.settings.theme).toBe(choice); expect(applied.phase).toBe('paused'); expect(applied.modal).toBeNull();
  expect(applied.round).toEqual(paused.round); expect(applied.stats).toEqual(paused.stats); expect(applied.record.lifetime).toEqual(paused.record.lifetime);
  expect(applied.settings.muted).toBe(paused.settings.muted); expect(applied.pauseCause).toBe(paused.pauseCause);
  await press(page.locator('#restart')); expect((await three(page)).modal?.kind).toBe('restart'); await press(page.locator('#modal-close'));
  expect(await three(page)).toEqual(applied);
  await press(page.locator('#home')); expect((await three(page)).modal?.kind).toBe('home'); await press(page.locator('#modal-close'));
  const homeCancelled = await three(page); expect(homeCancelled).toEqual(applied);
  await page.waitForTimeout(180); expect(await three(page)).toEqual(homeCancelled); // no auto-resume
  await press(page.locator('#resume')); const resumed = await three(page); expect(resumed.phase).toBe('playing'); expect(resumed.pauseCause).toBeNull(); expect(resumed.round).toEqual(paused.round);
  await press(page.locator('#cell-4')); const moved = await three(page); expect(moved.round.moves).toBe(2); expect(moved.round.board[4]).toBe('O'); expect(moved.round.current).toBe('X');
  expect(moved.round.id).toBe(paused.round.id); expect(moved.stats).toEqual(paused.stats);
  await press(page.locator('#home')); await expect(page.locator('#modal')).toBeVisible(); expect((await three(page)).modal?.kind).toBe('home');
  const clicks = await trustedPresses(page);
  await attach(info, 'star-moon-actual-api-trusted80ms', { ready, started, opened, paused, preview, cancelled, applied, homeCancelled, resumed, moved, clicks, clock: 'native/unfrozen' });
  await press(page.locator('#modal-apply')); await home(page);
}
async function lifecycle(page: Page, game: Game, info: TestInfo): Promise<void> {
  if (game.id === 'snack-pairs') return memoryLifecycle(page, info);
  return threeLifecycle(page, info);
}

test('G026-CATALOG @smoke 43/14/29, public More reveals new cards, old upcoming records remain separate', async ({ page }, info) => {
  const r = await page.goto('/'); expect(r?.headers()['content-security-policy']).toBe(CSP); await home(page);
  await expect(page.locator('.game-card')).toHaveCount(12); expect(await cardIds(page)).toEqual(EXISTING);
  for (const count of [24, 36, 43]) { await press(page.locator('#load-more')); await expect(page.locator('.game-card')).toHaveCount(count); }
  expect(new Set(await cardIds(page)).size).toBe(43); await expect(page.locator('.game-card.available')).toHaveCount(14); await expect(page.locator('.game-card.upcoming')).toHaveCount(29);
  for (const id of ['memory-pieces', 'leisure-line']) {
    const card = page.locator(`.game-card[data-id="${id}"]`); await expect(card.locator('button.card-action')).toBeDisabled(); await expect(card.locator('a.card-action')).toHaveCount(0);
  }
  for (const game of GAMES) await expect(page.locator(`.game-card[data-id="${game.id}"] a.card-action`)).toHaveAttribute('href', game.route);
  await attach(info, 'public-pagination', { cards: await cardIds(page), first12: EXISTING });
});
for (const game of GAMES) {
  test(`G026-${game.id} @smoke public card → start/input/pause/theme/mute/resume/home trusted80ms strictCSP`, async ({ page, browserName }, info) => {
    await page.goto('/'); await launch(page, game, info); await layout(page, info, `${game.id}-ready`);
    await lifecycle(page, game, info); await home(page);
    expect((await stored(page))[game.key], 'explicit settings action must persist its own game key').toBeTruthy();
    await page.reload(); await home(page);
    await attach(info, 'render-evidence-scope', { realClock: true, holdMs: 80, clockFrozen: false, physicalDevice: 'not_executed', webkitImage: 'not_executed: DOM geometry only under strict CSP' });
    if (browserName === 'chromium') await info.attach(`${game.id}-home-render`, { body: await page.screenshot({ fullPage: true, animations: 'allow', caret: 'initial' }), contentType: 'image/png' });
  });
}
test('G026-FAVORITES @smoke search new+old upcoming favorites, reload/remove/compound filter without first12 assumptions', async ({ page }) => {
  await page.goto('/');
  for (const id of ['memory-pieces', 'snack-pairs', 'star-moon']) { const card = await reveal(page, id); await press(card.locator('.favorite-button')); }
  await page.reload(); await home(page); await expect(page.locator('#favorite-count')).toHaveText('3');
  await press(page.locator('#favorites-only')); expect(await cardIds(page)).toEqual(['snack-pairs', 'star-moon', 'memory-pieces']);
  await page.locator('#include-upcoming').uncheck(); expect(await cardIds(page)).toEqual(['snack-pairs', 'star-moon']);
  await page.locator('#genre-tabs [data-genre="기억"]').click(); expect(await cardIds(page)).toEqual(['snack-pairs']);
  await press(page.locator('.favorite-button')); await expect(page.locator('#empty-state')).toBeVisible(); await expect(page.locator('#favorites-only')).toBeFocused();
  expect(JSON.parse((await stored(page))[FAVORITES]!)).toEqual(['memory-pieces', 'star-moon']);
});
test('G026-LAYOUT full native320/short dialogs + reducedmotion geometry/render evidence', async ({ page }, info) => {
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
  expect(Object.keys(values)).toHaveLength(12); return values;
}
test('G026-STORE full twelve product-valid profiles + sentinel/upcoming favorites byte-preserved, two new keys survive reload', async ({ page }, info) => {
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
  await attach(info, 'twelve-profiles-and-favorites', { fixture, fresh, after, seedExecutions: 1, reloadReseed: false, fixtureKind: 'actual product factories/settlements, not live state setters' });
});
