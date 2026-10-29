import { test as base, expect, type Page, type TestInfo, type Locator } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FAVORITES = 'simplegames.library.favorites.v1';
const SENTINEL = 'g025.integration.unrelated-sentinel';
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const GAMES = [
  { id: 'gem-survey', title: '보석 탐사 지도', route: '/games/11-mines/index.html', key: 'simplegames.gem-survey.v1' },
  { id: 'number-postbox', title: '숫자 우체통', route: '/games/12-fifteen/index.html', key: 'simplegames.number-postbox.v1' },
] as const;
type Game = typeof GAMES[number];
// Actual builder clones: 11 game.status + top-level elapsedMs/record;
// 12 game.status/elapsedMs/preview + save. Observe only; never write live state.
interface Board {
  opened?: boolean[]; flagged?: boolean[]; armed?: boolean;
  board?: number[]; blank?: number; size?: number; moveCount?: number;
  [key: string]: unknown;
}
interface RawSnapshot {
  game: Board & { status: Snapshot['phase']; elapsedMs?: number; activeSince?: number | null; pauseReason?: string; preview?: boolean };
  elapsedMs?: number;
  record?: { muted: boolean; theme: string };
  save?: { muted: boolean; theme: string };
  [key: string]: unknown;
}
interface Snapshot {
  phase: 'ready' | 'playing' | 'paused' | 'won' | 'lost';
  elapsedMs: number;
  goalPreview: boolean;
  game: Board;
  record: { muted: boolean; theme: string };
  raw: RawSnapshot;
}
interface Audit { console: unknown[]; pageErrors: string[]; csp: unknown[]; external: unknown[]; failedHTTP: unknown[]; failedRequests: unknown[]; unsafeMethods: unknown[] }
const attach = (info: TestInfo, name: string, value: unknown) => info.attach(name, { body: JSON.stringify(value, null, 2), contentType: 'application/json' });
const snapshot = async (page: Page): Promise<Snapshot> => {
  const raw = await page.evaluate(() => (window as unknown as { __g025Snapshot: () => RawSnapshot }).__g025Snapshot());
  // Board/flags/history/counters must stay exact; lifecycle/clock fields have
  // their own assertions. Preserve the raw clone in all attached evidence.
  const { status, elapsedMs, activeSince, pauseReason, preview, ...game } = raw.game;
  const elapsed = raw.elapsedMs ?? elapsedMs;
  expect(typeof elapsed).toBe('number');
  return { phase: status, elapsedMs: elapsed!, goalPreview: preview ?? false, game, record: (raw.record ?? raw.save)!, raw };
};
const storage = (page: Page): Promise<Record<string, string | null>> => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])));
const press = (control: Locator) => control.click({ delay: 80 }); // Real clock, native trusted pointerdown/up/click.
const controls = (page: Page) => ({
  start: page.locator('#start'), pause: page.locator('#pause'),
  resume: page.getByRole('button', { name: /^(?:탐사 재개|재개)$/ }),
  home: page.locator('#home'), mute: page.locator('#mute'),
  apply: page.locator('#dialog-apply,#modal-apply'), cancel: page.locator('#dialog-close,#modal-close'),
});
const test = base.extend<{ audit: Audit }>({
  audit: [async ({ context, baseURL }, use, info) => {
    const origin = new URL(baseURL!).origin;
    const audit: Audit = { console: [], pageErrors: [], csp: [], external: [], failedHTTP: [], failedRequests: [], unsafeMethods: [] };
    const watch = (page: Page) => {
      page.on('console', m => audit.console.push({ type: m.type(), text: m.text() }));
      page.on('pageerror', e => audit.pageErrors.push(e.message));
      page.on('websocket', s => audit.external.push({ socket: s.url() }));
    };
    context.pages().forEach(watch); context.on('page', watch);
    // Enforce external-network nondependence without taking the local server offline.
    await context.route('**/*', async route => {
      const r = route.request(), url = new URL(r.url());
      if (url.origin !== origin) { audit.external.push(r.url()); await route.abort(); }
      else if (!['GET', 'HEAD'].includes(r.method())) { audit.unsafeMethods.push({ url: r.url(), method: r.method() }); await route.abort(); }
      else await route.continue();
    });
    context.on('response', r => { if (r.status() >= 400) audit.failedHTTP.push({ url: r.url(), status: r.status() }); });
    context.on('requestfailed', r => audit.failedRequests.push({ url: r.url(), failure: r.failure() }));
    await context.exposeBinding('__g025CspAudit', ({ frame }, data) => audit.csp.push({ frame: frame.url(), data }));
    await context.addInitScript(() => {
      const w = window as unknown as { __g025CspAudit: (value: unknown) => Promise<void>; __g025TrustedClicks: { name: string; trusted: boolean }[] };
      w.__g025TrustedClicks = [];
      document.addEventListener('securitypolicyviolation', e => { void w.__g025CspAudit({ blockedURI: e.blockedURI, directive: e.effectiveDirective, policy: e.originalPolicy }); });
      document.addEventListener('click', e => {
        const target = e.target instanceof Element ? e.target.closest('button,a,[role="gridcell"]') : null;
        if (target) w.__g025TrustedClicks.push({ name: target.getAttribute('aria-label') ?? target.textContent ?? '', trusted: e.isTrusted });
      }, true);
    });
    try { await use(audit); }
    finally {
      await attach(info, 'unfiltered-runtime-audit', audit);
      for (const [name, values] of Object.entries(audit)) expect.soft(values, name).toEqual([]);
    }
  }, { auto: true }],
});
async function home(page: Page) {
  await expect(page).toHaveURL(/\/(?:index\.html)?$/);
  await expect(page.locator('#catalog-total')).toHaveText('41');
  await expect(page.locator('#intro-preview')).toHaveText('플레이 가능 12 · 준비 중 29');
  // Default initial DOM, before search/filter/load-more. New two follow old ten.
  await expect(page.locator('#include-upcoming')).toBeChecked();
  await expect(page.locator('#game-search')).toHaveValue('');
  await expect(page.locator('#game-sort')).toHaveText('기본순');
  await expect(page.locator('.game-card')).toHaveCount(12);
  expect(await page.locator('.game-card').evaluateAll(cards => cards.map(n => (n as HTMLElement).dataset.id))).toEqual([
    'number-garden', 'little-dragon', 'neon-rally', 'cosmic-cleanup', 'block-workshop', 'balloon-sparrow',
    'desert-post', 'cloud-bunny', 'chick-picnic', 'hamster-depot', 'gem-survey', 'number-postbox',
  ]);
  for (const game of GAMES) await expect(page.locator(`.game-card[data-id="${game.id}"]`)).toBeVisible();
}
async function launch(page: Page, game: Game, info: TestInfo) {
  await home(page);
  await expect(page.locator('.game-card.available')).toHaveCount(12);
  const link = page.getByRole('link', { name: `${game.title} 게임 시작`, exact: true });
  await expect(link).toHaveAttribute('href', game.route);
  const art = page.locator(`.game-card[data-id="${game.id}"] svg`);
  await expect(art).toHaveAttribute('viewBox', '0 0 96 96');
  expect(await art.locator('script,style,foreignObject,use,image').count()).toBe(0);
  await attach(info, `${game.id}-original-card-svg`, await art.evaluate(n => n.outerHTML));
  const navigation = page.waitForNavigation(); await press(link); const response = await navigation;
  expect(response?.headers()['content-security-policy']).toBe(CSP);
  await expect(page).toHaveURL(new RegExp(`${game.route.replaceAll('.', '\\.')}$`));
  await page.waitForFunction(() => typeof (window as unknown as { __g025Snapshot?: unknown }).__g025Snapshot === 'function');
  expect((await snapshot(page)).phase).toBe('ready');
}
async function layout(page: Page, info: TestInfo, game: Game, name: string) {
  const geometry = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth,
    small: [...document.querySelectorAll('button,a,[role="gridcell"]')].filter(n => n.getClientRects().length && !n.closest('[hidden],dialog:not([open])') && getComputedStyle(n).visibility !== 'hidden')
      .map(n => ({ id: n.id, name: n.getAttribute('aria-label') ?? n.textContent, width: n.getBoundingClientRect().width, height: n.getBoundingClientRect().height }))
      .filter(r => r.width < 44 || r.height < 44) }));
  await attach(info, `${game.id}-${name}-geometry`, geometry);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.width); expect(geometry.bodyWidth).toBeLessThanOrEqual(geometry.width); expect(geometry.small).toEqual([]);
}
async function input(page: Page, game: Game) {
  const before = await snapshot(page);
  if (game.id === 'gem-survey') {
    const cells = page.locator('#grid .cell[role="gridcell"]'); await expect(cells).toHaveCount(81);
    // Index1 is guaranteed safe by index0's first-click neighborhood exclusion.
    // A public flag-mode tap keeps it closed, so random flood cannot end this
    // lifecycle smoke before pause/resume. This is input, not an RNG/state seed.
    await press(page.locator('#mode')); await press(cells.nth(1)); await press(page.locator('#mode'));
    const flagged = await snapshot(page);
    expect(flagged.game.flagged?.[1]).toBe(true); expect(flagged.game.armed).toBe(false); expect(flagged.elapsedMs).toBe(0);
    await press(cells.first());
    await expect.poll(async () => (await snapshot(page)).game.opened?.filter(Boolean).length ?? 0).toBeGreaterThan(0);
    expect((await snapshot(page)).game.opened?.[1]).toBe(false);
    expect((await snapshot(page)).phase).toBe('playing');
  } else {
    const { board, blank, size, moveCount } = before.game;
    expect(board).toHaveLength(16); expect(size).toBe(4); expect(Number.isInteger(blank)).toBe(true);
    expect(board).toEqual([1, 2, 0, 4, 5, 10, 3, 6, 9, 14, 12, 11, 13, 8, 15, 7]); // Actual post-20-v1 fixture.
    const index = blank! % size! > 0 ? blank! - 1 : blank! + 1;
    const tile = page.locator(`#board .tile[data-index="${index}"]`);
    await expect(tile).toHaveText(String(board![index])); await press(tile);
    await expect.poll(async () => (await snapshot(page)).game.moveCount).toBe(moveCount! + 1);
    expect((await snapshot(page)).game.board).not.toEqual(board);
  }
  await expect.poll(async () => (await snapshot(page)).elapsedMs).toBeGreaterThan(0);
}
async function exitHome(page: Page) {
  await press(controls(page).home);
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await expect(controls(page).apply).toHaveText('서재로 돌아가기'); await press(controls(page).apply);
  await home(page);
}
async function lifecycle(page: Page, game: Game, info: TestInfo) {
  await launch(page, game, info); await layout(page, info, game, 'ready');
  await press(controls(page).start); expect((await snapshot(page)).phase).toBe('playing');
  await input(page, game); await press(controls(page).pause);
  const paused = await snapshot(page); expect(paused.phase).toBe('paused');
  await page.waitForTimeout(180); expect(await snapshot(page)).toEqual(paused);
  await press(controls(page).mute); expect((await snapshot(page)).record.muted).toBe(false);
  await press(controls(page).mute); expect((await snapshot(page)).record.muted).toBe(true);
  await press(page.locator('#theme')); await expect(page.getByRole('dialog')).toBeVisible();
  await press(page.locator(game.id === 'gem-survey' ? '[data-theme-choice="forest"]' : '[data-id="meadow"]'));
  await press(controls(page).cancel); expect((await snapshot(page)).record.theme).toBe(paused.record.theme);
  expect((await snapshot(page)).game).toEqual(paused.game);
  await press(controls(page).resume); expect((await snapshot(page)).phase).toBe('playing');
  expect((await snapshot(page)).game).toEqual(paused.game);
  // D01/v1.1: closing a modal opened while playing must NOT auto-resume.
  await press(controls(page).home); const cancelDialog = page.getByRole('dialog');
  await expect(cancelDialog).toBeVisible();
  const modal = await snapshot(page); expect(modal.phase).toBe('paused');
  await press(controls(page).cancel);
  const cancelled = await snapshot(page); expect(cancelled.phase).toBe('paused'); expect(cancelled.game).toEqual(paused.game);
  expect(cancelled.raw.game).toEqual(modal.raw.game); expect(cancelled.elapsedMs).toBe(modal.elapsedMs);
  await page.waitForTimeout(180); expect(await snapshot(page)).toEqual(cancelled);
  await press(controls(page).resume); expect((await snapshot(page)).phase).toBe('playing');
  const clicks = await page.evaluate(() => (window as unknown as { __g025TrustedClicks: { trusted: boolean }[] }).__g025TrustedClicks);
  expect(clicks.length).toBeGreaterThanOrEqual(6); expect(clicks.every(c => c.trusted)).toBe(true);
  await attach(info, `${game.id}-trusted-input-and-snapshot`, { clicks, snapshot: await snapshot(page), clock: 'native/unfrozen; clicks held80ms; not physical-device evidence' });
  await exitHome(page);
}
for (const game of GAMES) {
  test(`G025-${game.id} @smoke default first12 card → start/input/pause/resume/home trusted80ms strictCSP console0`, async ({ page, browserName }, info) => {
    const response = await page.goto('/'); expect(response?.headers()['content-security-policy']).toBe(CSP);
    await lifecycle(page, game, info);
    await page.reload(); await home(page);
    expect((await storage(page))[game.key], 'mute controls must persist the new profile').toBeTruthy();
    await attach(info, 'visual-evidence-scope', { webkitImageAcceptance: 'UNVERIFIED: no screenshotter invoked under strict CSP', physicalDevice: 'UNVERIFIED' });
    if (browserName === 'chromium') await info.attach(`${game.id}-home`, { body: await page.screenshot({ fullPage: true, animations: 'allow', caret: 'initial' }), contentType: 'image/png' });
  });
}
test('G025-map-inner-scroll @smoke 320px map preserves44px and reaches both edge columns without opening', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 667 }); await page.goto('/'); await launch(page, GAMES[0], info);
  await layout(page, info, GAMES[0], '320');
  const viewport = page.locator('#map-window'); await expect(viewport).toBeVisible();
  const before = await snapshot(page);
  const scroll = await viewport.evaluate(node => {
    const el = node as HTMLElement;
    const initial = { client: el.clientWidth, scroll: el.scrollWidth, overflow: getComputedStyle(el).overflowX };
    el.scrollLeft = el.scrollWidth;
    return { ...initial, last: el.scrollLeft };
  });
  expect(['auto', 'scroll']).toContain(scroll.overflow); expect(scroll.scroll).toBeGreaterThan(scroll.client); expect(scroll.last).toBeGreaterThan(0);
  const cells = page.locator('#grid .cell'); await expect(cells).toHaveCount(81);
  await cells.last().scrollIntoViewIfNeeded(); await expect(cells.last()).toBeInViewport();
  await viewport.evaluate(node => { node.scrollLeft = 0; }); await cells.first().scrollIntoViewIfNeeded(); await expect(cells.first()).toBeInViewport();
  expect(await snapshot(page)).toEqual(before);
  await attach(info, 'map-inner-scroll-diagnostic', { scroll, note: 'real DOM scrolling/reachability; native touch cancellation is independent QA scope' });
});
test('G025-goal-release @smoke normal held-goal release restores playing, blur protection takes priority', async ({ page }, info) => {
  await page.goto('/'); await launch(page, GAMES[1], info); await press(controls(page).start); await input(page, GAMES[1]);
  const before = await snapshot(page), goal = page.locator('#goal');
  await goal.scrollIntoViewIfNeeded(); const box = await goal.boundingBox(); expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2); await page.mouse.down();
  try {
    await page.waitForTimeout(80);
    const held = await snapshot(page); expect(held.goalPreview).toBe(true); expect(held.game).toEqual(before.game);
    await page.waitForTimeout(180); expect((await snapshot(page)).elapsedMs).toBe(held.elapsedMs);
  } finally { await page.mouse.up(); }
  await expect.poll(async () => (await snapshot(page)).goalPreview).toBe(false);
  expect((await snapshot(page)).phase).toBe('playing'); expect((await snapshot(page)).game).toEqual(before.game);
  const released = await snapshot(page);
  await page.mouse.down();
  try {
    await page.waitForTimeout(80); expect((await snapshot(page)).goalPreview).toBe(true);
    // Synthetic lifecycle event only, not a timer/state setter. Real OS/tab
    // deactivation is separate independent QA/physical-device evidence.
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  } finally { await page.mouse.up(); }
  const protectedState = await snapshot(page);
  expect(protectedState.phase).toBe('paused'); expect(protectedState.goalPreview).toBe(false);
  expect(protectedState.raw.game.pauseReason).toBe('protection'); expect(protectedState.game).toEqual(before.game);
  await page.waitForTimeout(180); expect(await snapshot(page)).toEqual(protectedState);
  await press(controls(page).resume); expect((await snapshot(page)).phase).toBe('playing');
  await attach(info, 'normal-goal-release-and-blur-priority', { before, released, protectedState, scope: 'trusted pointer held80ms; synthetic blur; native clock; no state setter' });
});
async function existingProfiles(): Promise<Record<string, string>> {
  // Product APIs, build-bound on the Node side. No hand-authored profile tuples,
  // live-game injection, RNG override or reload-time storage reseeding.
  const build = resolve(import.meta.dirname, '../..', process.env.GAME_TEST_BUILD_DIR!);
  const product = (path: string) => import(pathToFileURL(resolve(build, path)).href);
  const values: Record<string, string> = {};
  const put = (key: string, record: unknown) => { values[key] = JSON.stringify(record); };
  const garden = await product('src/client/storage.js'); put(garden.STORAGE_KEY, garden.defaultProfile());
  const snake = await product('public/games/02-snake/engine.mjs'); put(snake.STORAGE_KEY, snake.defaultProfile());
  // Legacy Pong exposes no pure settlement helper: use its normal zero-match
  // factory rather than fabricating wins or copying a DOM-only settlement.
  const pong = await product('public/games/03-pong/save.mjs'); put(pong.SAVE_KEY, pong.normalizeSave(null));
  for (const directory of ['04-breakout', '05-falling-blocks']) {
    const engine = await product(`public/games/${directory}/engine.mjs`), save = await product(`public/games/${directory}/save.mjs`);
    const state = engine.createGame(); engine.startGame(state); engine.finishGame(state, 'quit');
    const memory = new Map<string, string>();
    const store = save.createStore(() => ({ getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) }));
    store.record(state); const record = store.snapshot();
    expect(save.validateSave(record)).toBe(true); expect(record.plays).toBe(1); put(save.STORAGE_KEY, record);
  }
  for (const [directory, result] of [
    ['06-flappy', { score: 2, reason: 'quit' }], ['07-dino', { score: 12, metric: 123, reason: 'quit' }], ['08-doodle', { score: 10, metric: 104, reason: 'quit' }],
  ] as const) {
    const save = await product(`public/games/${directory}/save.mjs`);
    const record = save.settleRecord(save.defaultRecord(), result).record;
    expect(save.validateRecord(record).recovered).toBe(false); put(save.STORAGE_KEY, record);
  }
  const chick = await product('public/games/09-crossy/save.js');
  const picnic = chick.settleRecord(chick.defaults(), 1); expect(chick.validRecord(picnic)).toBe(true); put(chick.STORAGE_KEY, picnic);
  const hamster = await product('public/games/10-sokoban/save.mjs'), depot = await product('public/games/10-sokoban/engine.mjs');
  const won = depot.move(depot.move(depot.createGame(1), 'R'), 'R'); expect(won.won).toBe(true);
  const delivery = hamster.settleClear(hamster.defaultRecord(), 1, { pushes: won.pushes, moves: won.moves }).record;
  expect(hamster.validateRecord(delivery)).toEqual(delivery); put(hamster.STORAGE_KEY, delivery);
  expect(Object.keys(values)).toHaveLength(10); return values;
}
test('G025-STORE full preserves ten product-valid profiles, sentinel and old upcoming favorites through both new games', async ({ page }, info) => {
  const fixture = { ...await existingProfiles(), [FAVORITES]: JSON.stringify(['number-garden', 'memory-pieces', 'dice-picnic']), [SENTINEL]: 'unrelated-value-must-survive' };
  await page.goto('/');
  await page.evaluate(values => {
    if (localStorage.length !== 0) throw new Error('Expected fresh isolated storage before the one-time seed');
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
  }, fixture);
  await page.reload(); await home(page); expect(await storage(page)).toEqual(fixture);
  const old = await storage(page);
  const fresh: Record<string, string | null> = {};
  for (const game of GAMES) {
    await lifecycle(page, game, info); fresh[game.key] = (await storage(page))[game.key]; expect(fresh[game.key]).toBeTruthy();
    for (const [key, value] of Object.entries(old)) expect((await storage(page))[key], key).toBe(value);
  }
  await page.reload(); await home(page); const after = await storage(page);
  for (const [key, value] of Object.entries(old)) expect(after[key], key).toBe(value);
  for (const game of GAMES) expect(after[game.key]).toBe(fresh[game.key]);
  expect(Object.keys(after).sort()).toEqual([...Object.keys(fixture), ...GAMES.map(game => game.key)].sort());
  expect(JSON.parse(after[FAVORITES]!)).toEqual(['number-garden', 'memory-pieces', 'dice-picnic']);
  await attach(info, 'existing-ten-records-sentinel-and-favorites-preserved', { physicalOrigin: new URL(page.url()).origin, before: old, after, newProfiles: fresh, seedExecutions: 1, reloadReseed: false });
});
