import { test as base, expect, type Page, type TestInfo, type Locator } from '@playwright/test';

const FAVORITES = 'simplegames.library.favorites.v1';
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const GAMES = [
  { id: 'gem-survey', title: '보석 탐사 지도', route: '/games/11-mines/index.html', key: 'simplegames.gem-survey.v1' },
  { id: 'number-postbox', title: '숫자 우체통', route: '/games/12-fifteen/index.html', key: 'simplegames.number-postbox.v1' },
] as const;
type Game = typeof GAMES[number];
// Intake proposal, not an assertion about unmerged builder code. Keep changes to
// this adapter explicit after PM intake; never substitute a test state setter.
interface Snapshot {
  phase: 'ready' | 'playing' | 'paused' | 'won' | 'lost';
  elapsedMs: number;
  goalPreview?: boolean;
  game: { opened?: boolean[]; board?: number[]; blank?: number; size?: number; moveCount?: number };
  record: unknown;
}
interface Audit { console: unknown[]; pageErrors: string[]; csp: unknown[]; external: unknown[]; failedHTTP: unknown[]; failedRequests: unknown[]; unsafeMethods: unknown[] }
const attach = (info: TestInfo, name: string, value: unknown) => info.attach(name, { body: JSON.stringify(value, null, 2), contentType: 'application/json' });
const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => (window as unknown as { __g025Snapshot: () => Snapshot }).__g025Snapshot());
const storage = (page: Page): Promise<Record<string, string | null>> => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])));
const press = (control: Locator) => control.click({ delay: 80 }); // Real clock, native trusted pointerdown/up/click.
const controls = (page: Page) => ({
  start: page.getByRole('button', { name: /^(?:(?:탐사|퍼즐|게임) ?)?시작$/ }),
  pause: page.getByRole('button', { name: /^(?:일시 ?정지|게임 정지)$/ }),
  resume: page.getByRole('button', { name: /^(?:(?:탐사|퍼즐|게임) ?)?재개$/ }),
  home: page.getByRole('button', { name: /^(?:게임 서재|홈(?:으로)?)$/ }),
  mute: page.getByRole('button', { name: /^(?:음소거|소리)(?: 켜기| 끄기)?$/ }),
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
}
async function launch(page: Page, game: Game, info: TestInfo) {
  await home(page); await page.locator('#include-upcoming').uncheck();
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
      .filter(r => r.width < 43.9 || r.height < 43.9) }));
  await attach(info, `${game.id}-${name}-geometry`, geometry);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.width); expect(geometry.bodyWidth).toBeLessThanOrEqual(geometry.width); expect(geometry.small).toEqual([]);
}
async function input(page: Page, game: Game) {
  const before = await snapshot(page);
  if (game.id === 'gem-survey') {
    const cells = page.getByRole('gridcell'); await expect(cells).toHaveCount(81);
    // Index1 is guaranteed safe by index0's first-click neighborhood exclusion.
    // A public right-click flag keeps it closed, so random flood cannot end this
    // lifecycle smoke before pause/resume. This is input, not an RNG/state seed.
    await cells.nth(1).click({ button: 'right', delay: 80 });
    await press(cells.first());
    await expect.poll(async () => (await snapshot(page)).game.opened?.filter(Boolean).length ?? 0).toBeGreaterThan(0);
    expect((await snapshot(page)).game.opened?.[1]).toBe(false);
  } else {
    const { board, blank, size, moveCount } = before.game;
    expect(board).toHaveLength(16); expect(size).toBe(4); expect(Number.isInteger(blank)).toBe(true);
    const index = blank! % size! > 0 ? blank! - 1 : blank! + 1;
    await press(page.getByRole('button', { name: `숫자 ${board![index]}`, exact: true }));
    await expect.poll(async () => (await snapshot(page)).game.moveCount).toBe(moveCount! + 1);
    expect((await snapshot(page)).game.board).not.toEqual(board);
  }
  await expect.poll(async () => (await snapshot(page)).elapsedMs).toBeGreaterThan(0);
}
async function exitHome(page: Page) {
  await press(controls(page).home);
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await press(dialog.getByRole('button', { name: /^(?:나가기|탐사 종료|홈으로|확인)$/ }));
  await home(page);
}
async function lifecycle(page: Page, game: Game, info: TestInfo) {
  await launch(page, game, info); await layout(page, info, game, 'ready');
  await press(controls(page).start); expect((await snapshot(page)).phase).toBe('playing');
  await input(page, game); await press(controls(page).pause);
  const paused = await snapshot(page); expect(paused.phase).toBe('paused');
  await page.waitForTimeout(180); expect(await snapshot(page)).toEqual(paused);
  await press(controls(page).mute); await press(controls(page).mute);
  await press(controls(page).resume); expect((await snapshot(page)).phase).toBe('playing');
  expect((await snapshot(page)).game).toEqual(paused.game);
  // D01/v1.1: closing a modal opened while playing must NOT auto-resume.
  await press(controls(page).home); const cancelDialog = page.getByRole('dialog');
  await expect(cancelDialog).toBeVisible();
  await press(cancelDialog.getByRole('button', { name: /^(?:취소|돌아가기)$/ }));
  const cancelled = await snapshot(page); expect(cancelled.phase).toBe('paused'); expect(cancelled.game).toEqual(paused.game);
  await page.waitForTimeout(180); expect(await snapshot(page)).toEqual(cancelled);
  await press(controls(page).resume); expect((await snapshot(page)).phase).toBe('playing');
  const clicks = await page.evaluate(() => (window as unknown as { __g025TrustedClicks: { trusted: boolean }[] }).__g025TrustedClicks);
  expect(clicks.length).toBeGreaterThanOrEqual(6); expect(clicks.every(c => c.trusted)).toBe(true);
  await attach(info, `${game.id}-trusted-input-and-snapshot`, { clicks, snapshot: await snapshot(page), clock: 'native/unfrozen; clicks held80ms; not physical-device evidence' });
  await exitHome(page);
}
for (const game of GAMES) {
  test(`G025-${game.id} @smoke card → start/input/pause/resume/home trusted80ms strictCSP console0`, async ({ page, browserName }, info) => {
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
  const viewport = page.locator('#map-viewport'); await expect(viewport).toBeVisible();
  const before = await snapshot(page);
  const scroll = await viewport.evaluate(node => {
    const el = node as HTMLElement;
    const initial = { client: el.clientWidth, scroll: el.scrollWidth, overflow: getComputedStyle(el).overflowX };
    el.scrollLeft = el.scrollWidth;
    return { ...initial, last: el.scrollLeft };
  });
  expect(['auto', 'scroll']).toContain(scroll.overflow); expect(scroll.scroll).toBeGreaterThan(scroll.client); expect(scroll.last).toBeGreaterThan(0);
  const cells = page.getByRole('gridcell'); await cells.last().scrollIntoViewIfNeeded(); await expect(cells.last()).toBeInViewport();
  await viewport.evaluate(node => { node.scrollLeft = 0; }); await cells.first().scrollIntoViewIfNeeded(); await expect(cells.first()).toBeInViewport();
  expect(await snapshot(page)).toEqual(before);
  await attach(info, 'map-inner-scroll-diagnostic', { scroll, note: 'real DOM scrolling/reachability; native touch cancellation is independent QA scope' });
});
test('G025-goal-release @smoke normal held-goal release restores playing without a modal-resume requirement', async ({ page }, info) => {
  await page.goto('/'); await launch(page, GAMES[1], info); await press(controls(page).start); await input(page, GAMES[1]);
  const before = await snapshot(page), goal = page.getByRole('button', { name: '목표 보기', exact: true });
  await goal.scrollIntoViewIfNeeded(); const box = await goal.boundingBox(); expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2); await page.mouse.down();
  try {
    const held = await snapshot(page); expect(held.goalPreview).toBe(true); expect(held.game).toEqual(before.game);
    await page.waitForTimeout(180); expect((await snapshot(page)).elapsedMs).toBe(held.elapsedMs);
  } finally { await page.mouse.up(); }
  await expect.poll(async () => (await snapshot(page)).goalPreview).toBe(false);
  expect((await snapshot(page)).phase).toBe('playing'); expect((await snapshot(page)).game).toEqual(before.game);
  await attach(info, 'normal-goal-release-exception', { before, after: await snapshot(page), scope: 'trusted pointer hold/release; blur/cancel/protective-pause cases belong to independent QA' });
});
test('G025-STORE full preserves all ten existing profiles plus old upcoming favorites through both new games', async ({ page }, info) => {
  await page.goto('/'); await page.locator('.favorite-button[data-id="number-garden"]').click({ delay: 80 });
  for (const title of ['기억의 조각', '주사위 소풍']) {
    await page.locator('#game-search').fill(title); await page.locator('.favorite-button').click({ delay: 80 });
  }
  // Real public UI creates existing profiles. No fabricated profile or state seeds.
  await page.goto('/game.html'); await press(page.locator('#exit-button')); await press(page.locator('#result-home'));
  for (const [route, control] of [['02-snake', '#sound'], ['03-pong', '#mute'], ['04-breakout', '#mute'], ['05-falling-blocks', '#mute'], ['06-flappy', '#mute'], ['07-dino', '#mute'], ['08-doodle', '#mute']]) {
    await page.goto(`/games/${route}/index.html`); await press(page.locator(control));
  }
  await page.goto('/games/09-crossy/index.html'); await press(page.locator('#primary')); await page.keyboard.press('ArrowUp');
  await press(page.locator('#home')); await press(page.locator('#confirm-yes')); await press(page.locator('#result-home'));
  await page.goto('/games/10-sokoban/index.html'); await press(page.locator('#primary')); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await press(page.locator('#result-home'));
  const old = await storage(page);
  const keys = ['number-garden:profile:v1', 'little-dragon.snake.v1', 'neon-rally.pong.v1', 'simplegames.breakout.v1', 'simplegames.fallingblocks.v1', 'simplegames.flappy.v1', 'simplegames.dino.v1', 'simplegames.doodle.v1', 'simple-games:chick-picnic:v1', 'simplegames.hamster-depot.v1', FAVORITES];
  for (const key of keys) expect(old[key], key).toBeTruthy();
  const fresh: Record<string, string | null> = {};
  for (const game of GAMES) {
    await lifecycle(page, game, info); fresh[game.key] = (await storage(page))[game.key]; expect(fresh[game.key]).toBeTruthy();
  }
  await page.reload(); const after = await storage(page);
  for (const [key, value] of Object.entries(old)) expect(after[key], key).toBe(value);
  for (const game of GAMES) expect(after[game.key]).toBe(fresh[game.key]);
  expect(JSON.parse(after[FAVORITES]!)).toEqual(['number-garden', 'memory-pieces', 'dice-picnic']);
  await attach(info, 'existing-ten-records-and-favorites-preserved', { physicalOrigin: new URL(page.url()).origin, before: old, after, newProfiles: fresh });
});
