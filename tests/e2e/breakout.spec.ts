import { test, expect, type Page, type TestInfo } from '@playwright/test';

const URL_PATH = '/games/04-breakout/index.html';
const KEY = 'simplegames.breakout.v1';
const OTHER_KEYS = ['number-garden:profile:v1', 'little-dragon.snake.v1', 'neon-rally.pong.v1', 'simplegames.library.favorites.v1'];
const runtime = new WeakMap<Page, { errors: string[]; external: string[]; badResponses: string[]; requests: string[] }>();
// The only game inspection API used here returns a deep-copied, frozen snapshot.
async function snapshot(page: Page): Promise<any> {
  return page.evaluate(async () => { const modulePath = '/games/04-breakout/main.mjs'; return (await import(modulePath)).getSnapshot(); });
}
// WebKit's installed screenshotter inserts an inline `body {}` style even with
// caret: initial / animations: allow. Keep strict CSP and all error assertions;
// substitute read-only DOM/layout evidence, NOT an image-acceptance claim.
async function attachScreenEvidence(page: Page, info: TestInfo, name: string, browserName: string) {
  if (browserName !== 'webkit') {
    await info.attach(name, { body: await page.screenshot({ fullPage: true, caret: 'initial', animations: 'allow' }), contentType: 'image/png' });
    return;
  }
  const dom = await page.evaluate(() => ({
    url: location.href, title: document.title,
    viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight },
    activeElement: document.activeElement?.id,
    html: document.documentElement.outerHTML, text: document.body.innerText,
    inlineStyleElements: document.querySelectorAll('style').length,
    layout: Array.from(document.querySelectorAll('button,a,#court,#canvas,#overlay,#confirm-dialog,#over-copy,#status,#score,#remaining,#lives')).map(node => {
      const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
      return { tag: node.tagName, id: node.id, text: node.textContent, role: node.getAttribute('role'), ariaLabel: node.getAttribute('aria-label'), ariaPressed: node.getAttribute('aria-pressed'), hidden: (node as HTMLElement).hidden,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, display: style.display, visibility: style.visibility, color: style.color, backgroundColor: style.backgroundColor, fontSize: style.fontSize };
    }),
  }));
  await info.attach(`${name}-webkit-readonly-dom-layout`, { body: JSON.stringify({ evidenceKind: 'read-only DOM/layout/game snapshot; not a screenshot', webkitImageAcceptance: 'UNVERIFIED', dom, snapshot: await snapshot(page) }, null, 2), contentType: 'application/json' });
}
async function open(page: Page) {
  const time = new Date('2026-10-25T00:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  const response = await page.goto(URL_PATH);
  await expect(page.locator('#primary')).toBeVisible();
  expect(response?.status()).toBe(200);
  return response!;
}
async function start(page: Page) {
  await page.locator('#primary').click();
  await expect(page.locator('#court')).toBeFocused();
  expect((await snapshot(page)).game).toMatchObject({ status: 'playing', phase: 'attached', score: 0, lives: 3 });
}
async function courtRect(page: Page) {
  await page.locator('#court').scrollIntoViewIfNeeded();
  const r = await page.locator('#court').boundingBox();
  expect(r).not.toBeNull(); return r!;
}
async function moveTo(page: Page, logicalX: number) {
  const r = await courtRect(page);
  await page.mouse.move(r.x + logicalX / 720 * r.width, r.y + r.height * .82);
  await page.clock.runFor(32);
}
async function stored(page: Page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), KEY); }
async function quitToReady(page: Page) {
  await page.locator('#restart').click();
  await page.locator('#confirm-ok').click();
  expect((await snapshot(page)).game.status).toBe('ready');
}

test.beforeEach(async ({ page, baseURL }) => {
  const record = { errors: [] as string[], external: [] as string[], badResponses: [] as string[], requests: [] as string[] };
  runtime.set(page, record);
  const origin = new URL(baseURL!).origin;
  await page.route('**/*', async route => {
    const requestURL = new globalThis.URL(route.request().url());
    if (/^https?:$/.test(requestURL.protocol) && requestURL.origin !== origin) {
      record.external.push(requestURL.href); await route.abort('blockedbyclient');
    } else await route.continue();
  });
  page.on('pageerror', error => record.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') record.errors.push(message.text()); });
  page.on('request', request => record.requests.push(request.url()));
  page.on('response', response => { if (response.status() >= 400) record.badResponses.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => console.error(`CSP_VIOLATION ${event.violatedDirective} ${event.blockedURI}`)));
});
test.afterEach(async ({ page }, info) => {
  const record = runtime.get(page)!;
  await info.attach('http-runtime-evidence', { body: JSON.stringify(record, null, 2), contentType: 'application/json' });
  if (!page.isClosed() && new globalThis.URL(page.url()).pathname === URL_PATH) {
    await info.attach('readonly-final-snapshot', { body: JSON.stringify(await snapshot(page), null, 2), contentType: 'application/json' });
  }
  expect.soft(record.errors, 'runtime/console/CSP errors').toEqual([]);
  expect.soft(record.external, 'attempts outside loopback origin (aborted, never fulfilled)').toEqual([]);
  expect.soft(record.badResponses, 'HTTP asset failures').toEqual([]);
});

test('B11/B23/B26 real HTTP ready, strict CSP, start does not launch', async ({ page, browserName }, info) => {
  const response = await open(page);
  const csp = response.headers()['content-security-policy'];
  expect(csp).toContain("default-src 'none'");
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("style-src 'self'");
  expect(csp).toContain("connect-src 'none'");
  expect(csp).not.toContain("'unsafe-inline'");
  expect(csp).not.toContain("'unsafe-eval'");
  expect((await snapshot(page)).game).toMatchObject({ status: 'ready', phase: 'attached', stage: 1, score: 0, lives: 3, totalBricks: 0 });
  await expect(page.locator('#save-warning')).toBeHidden();
  await expect(page.locator('#remaining')).toHaveText('32');
  const ready = (await snapshot(page)).game;
  await page.locator('#court').focus();
  await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight');
  await page.clock.runFor(1500);
  expect((await snapshot(page)).game).toEqual(ready);
  await attachScreenEvidence(page, info, 'ready-screen', browserName);
  await start(page); await page.clock.runFor(1500);
  expect((await snapshot(page)).game.phase).toBe('attached');
  await page.locator('#launch').click(); await page.clock.runFor(64);
  expect((await snapshot(page)).game.phase).toBe('flight');
});

test('B12/B22 keyboard focus, modifier pass-through, mouse position and click launch', async ({ page }) => {
  await open(page); await start(page);
  await page.keyboard.down('ArrowRight'); await page.clock.runFor(224); await page.keyboard.up('ArrowRight');
  expect((await snapshot(page)).game.paddle.x).toBeGreaterThan(450);
  await page.locator('#mute').focus(); const unfocused = (await snapshot(page)).game;
  await page.keyboard.press('ArrowLeft'); await page.clock.runFor(160);
  expect((await snapshot(page)).game).toEqual(unfocused);
  await page.locator('#court').focus();
  const prevented = await page.locator('#court').evaluate(node => ['Control','Alt','Meta'].map(modifier => {
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true, ctrlKey: modifier === 'Control', altKey: modifier === 'Alt', metaKey: modifier === 'Meta' });
    node.dispatchEvent(event); return event.defaultPrevented;
  }));
  expect(prevented).toEqual([false, false, false]);
  await page.clock.runFor(160); expect((await snapshot(page)).game).toEqual(unfocused);
  await moveTo(page, 216); expect((await snapshot(page)).game.paddle.x).toBeCloseTo(216, 0);
  const r = await courtRect(page); await page.mouse.click(r.x + r.width * .3, r.y + r.height * .82);
  expect((await snapshot(page)).game.phase).toBe('flight');
});

test('B15 protection blur/pagehide, explicit resume and stale-key clearing (DOM lifecycle dispatch)', async ({ page }) => {
  await open(page); await start(page); await page.keyboard.press('Space'); await page.clock.runFor(128);
  await page.keyboard.down('ArrowRight');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const paused = (await snapshot(page)).game; expect(paused.status).toBe('paused');
  await page.keyboard.press('Space'); await page.clock.runFor(2000);
  expect((await snapshot(page)).game).toEqual(paused);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.clock.runFor(200); expect((await snapshot(page)).game).toEqual(paused);
  await page.locator('#primary').click(); await page.clock.runFor(128);
  expect((await snapshot(page)).game.paddle).toEqual(paused.paddle);
  await page.keyboard.up('ArrowRight');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect((await snapshot(page)).game.status).toBe('paused');
});

test('B16/B18 modal cancel, background isolation, Tab trap, Escape and return focus', async ({ page }) => {
  await open(page); await start(page); await page.keyboard.press('Space'); await page.clock.runFor(160);
  await page.locator('#restart').click();
  const original = (await snapshot(page)).game;
  expect(original.status).toBe('paused');
  await expect(page.locator('#confirm-cancel')).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(page.locator('#confirm-ok')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('#confirm-cancel')).toBeFocused();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space'); await page.clock.runFor(1000);
  expect((await snapshot(page)).game).toEqual(original);
  await page.keyboard.press('Escape');
  await expect(page.locator('#confirm-dialog')).not.toBeVisible();
  await expect(page.locator('#restart')).toBeFocused();
  expect((await snapshot(page)).game).toEqual(original);
  expect((await snapshot(page)).save.plays).toBe(0);
  await page.locator('#home').click(); await page.locator('#confirm-cancel').click();
  await expect(page.locator('#home')).toBeFocused(); expect((await snapshot(page)).game).toEqual(original);
  await page.locator('#primary').click(); expect((await snapshot(page)).game.status).toBe('playing');
});

test('B18/B20/B21 quit recorded once, settings persist and all other keys stay isolated', async ({ page }) => {
  await page.addInitScript(keys => { for (const key of keys) localStorage.setItem(key, `sentinel:${key}`); }, OTHER_KEYS);
  await open(page);
  const initial = (await snapshot(page)).game;
  for (const theme of ['solar','mono','mint']) {
    await page.locator(`[data-skin="${theme}"]`).click();
    await expect(page.locator(`[data-skin="${theme}"]`)).toHaveAttribute('aria-pressed', 'true');
    expect((await snapshot(page)).game).toEqual(initial);
  }
  await page.locator('[data-skin="mono"]').click(); await page.locator('#mute').click();
  await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'true');
  await start(page); await quitToReady(page);
  expect(await stored(page)).toMatchObject({ plays: 1, wins: 0, bestStage: 1, totalBricks: 0, bestScore: 0, muted: true, paddleTheme: 'mono' });
  await page.locator('#restart').click(); expect((await snapshot(page)).save.plays).toBe(1);
  await page.reload(); await expect(page.locator('#primary')).toBeVisible();
  expect((await snapshot(page)).save).toMatchObject({ plays: 1, muted: true, paddleTheme: 'mono' });
  expect(await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), OTHER_KEYS)).toEqual(OTHER_KEYS.map(key => `sentinel:${key}`));
  await page.locator('#home').click(); await expect(page).toHaveURL('/');
  expect(await stored(page)).toMatchObject({ plays: 1 });
});

test('B17/B18 started home confirmation saves before navigation, reload does not recount', async ({ page }) => {
  await open(page); await start(page); await page.locator('#home').click();
  await expect(page.locator('#confirm-dialog')).toBeVisible();
  await page.locator('#confirm-ok').click(); await expect(page).toHaveURL('/');
  expect(await stored(page)).toMatchObject({ plays: 1, wins: 0, bestStage: 1, totalBricks: 0, bestScore: 0 });
  await page.goto(URL_PATH); await expect(page.locator('#primary')).toBeVisible();
  expect((await snapshot(page)).save.plays).toBe(1);
});

for (const invalid of ['{bad JSON', JSON.stringify({ version: 0 }), 'null']) {
  test(`B19 invalid storage recovers with warning: ${invalid}`, async ({ page }) => {
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: KEY, value: invalid });
    await open(page); await expect(page.locator('#save-warning')).toBeVisible();
    expect((await snapshot(page)).save).toMatchObject({ plays: 0, bestScore: 0 });
    await start(page); await quitToReady(page); expect((await snapshot(page)).save.plays).toBe(1);
  });
}
for (const failure of ['getter', 'getItem', 'setItem'] as const) {
  test(`B19 storage ${failure} denied, persistent warning and tab-memory quit record`, async ({ page }) => {
    await page.addInitScript(mode => {
      if (mode === 'getter') Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('QA storage denied', 'SecurityError'); } });
      else Object.defineProperty(Storage.prototype, mode, { configurable: true, value() { throw new DOMException('QA storage denied', 'SecurityError'); } });
    }, failure);
    await open(page);
    if (failure === 'setItem') await page.locator('#mute').click();
    await expect(page.locator('#save-warning')).toBeVisible();
    await start(page); await quitToReady(page);
    expect((await snapshot(page)).save).toMatchObject({ plays: 1, bestStage: 1 });
    await page.locator('#restart').click(); expect((await snapshot(page)).save.plays).toBe(1);
    await expect(page.locator('#save-warning')).toBeVisible();
  });
}

test('B22/B23 320px and 667x375 no overflow, all visible touch targets 44px, modal reachable', async ({ page, browserName }, info) => {
  await open(page); await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of [{ width: 320, height: 667 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const sizes = await page.locator('button,a').evaluateAll(nodes => nodes.filter(node => (node as HTMLElement).getClientRects().length > 0).map(node => ({ id: node.id, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
    for (const size of sizes) { expect(size.width, `${size.id} width`).toBeGreaterThanOrEqual(44); expect(size.height, `${size.id} height`).toBeGreaterThanOrEqual(44); }
    if ((await snapshot(page)).game.status === 'ready') await start(page);
    await page.locator('#restart').click();
    await expect(page.locator('#confirm-cancel')).toBeInViewport(); await expect(page.locator('#confirm-ok')).toBeInViewport();
    await attachScreenEvidence(page, info, `responsive-${viewport.width}x${viewport.height}`, browserName);
    await page.locator('#confirm-cancel').click();
  }
});

test('B14 DOM pointercancel/lostpointercapture clear held input (not native touch evidence)', async ({ page }) => {
  await open(page); await start(page); const r = await courtRect(page);
  for (const eventType of ['pointercancel', 'lostpointercapture']) {
    await page.mouse.move(r.x + r.width * .4, r.y + r.height * .85); await page.mouse.down(); await page.clock.runFor(32);
    await page.locator('#court').dispatchEvent(eventType, { pointerId: 1, pointerType: 'mouse', bubbles: true });
    await page.mouse.up(); await page.clock.runFor(32);
    expect((await snapshot(page)).game.phase).toBe('attached');
  }
});

test('B13/B14 native Chromium CDP lower drag, tap, cancel, outside second finger and outside scroll', async ({ page, context, browserName, isMobile }, info) => {
  test.skip(!(isMobile && browserName === 'chromium'), 'Sustained native CDP touch exists only in mobile Chromium; WebKit native drag remains unverified.');
  await open(page); await start(page);
  // Keep the complete court on screen for actual native touch delivery.
  await page.setViewportSize({ width: 375, height: 950 });
  const r = await courtRect(page); const client = await context.newCDPSession(page);
  const point = (ratio: number, id = 1) => ({ x: r.x + r.width * ratio, y: r.y + r.height * .85, radiusX: 1, radiusY: 1, force: 1, id });
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(.25)] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(.7)] });
  await page.clock.runFor(64);
  expect((await snapshot(page)).game.paddle.x).toBeCloseTo(504, 0);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect((await snapshot(page)).game.phase).toBe('attached');
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(.45)] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await page.clock.runFor(64); expect((await snapshot(page)).game.phase).toBe('attached');
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(.35)] });
  const outside = { x: 5, y: Math.max(5, r.y - 30), radiusX: 1, radiusY: 1, force: 1, id: 2 };
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(.35), outside] });
  const canceledX = (await snapshot(page)).game.paddle.x;
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(.8), outside] });
  await page.clock.runFor(64); expect((await snapshot(page)).game.paddle.x).toBe(canceledX);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect((await snapshot(page)).game.phase).toBe('attached');
  await page.touchscreen.tap(point(.5).x, r.y + r.height * .3);
  expect((await snapshot(page)).game.phase).toBe('attached'); // Upper 65% is not a mobile launch zone.
  await page.touchscreen.tap(point(.5).x, point(.5).y); expect((await snapshot(page)).game.phase).toBe('flight');
  const beforeScroll = await page.evaluate(() => scrollY);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 4, y: 800, id: 3 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 4, y: 650, id: 3 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 4, y: 450, id: 3 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(beforeScroll);
  await info.attach('native-touch-transport', { body: 'Real Chromium Input.dispatchTouchEvent: lower drag, cancel, outside second finger, outside vertical scroll; native touchscreen upper tap rejection and lower tap launch. No state mutation or pointer-capture override.', contentType: 'text/plain' });
  await client.detach();
});

test('B13 native mobile touchscreen lower tap launches (WebKit drag not inferred)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile touchscreen only.');
  await open(page); await start(page); const r = await courtRect(page);
  await page.touchscreen.tap(r.x + r.width * .5, r.y + r.height * .85);
  expect((await snapshot(page)).game.phase).toBe('flight');
});

test('B09/B11/B17/B18 real browser scoring, three manual launches, loss result and replay', async ({ page, browserName }, info) => {
  test.setTimeout(90_000);
  await open(page); await start(page);
  for (let remaining = 3; remaining > 0; remaining--) {
    await moveTo(page, 360); await page.locator('#court').focus(); await page.keyboard.press('Space');
    // Real input moves the paddle away; virtual clock drives the unchanged real RAF/engine.
    await moveTo(page, 60); await page.clock.runFor(7000);
    const state = (await snapshot(page)).game;
    expect(state.lives).toBe(remaining - 1);
    if (remaining > 1) {
      expect(state.phase).toBe('attached'); await page.clock.runFor(2000);
      expect((await snapshot(page)).game.lives).toBe(remaining - 1);
      expect((await snapshot(page)).game.phase).toBe('attached');
    }
  }
  const result = await snapshot(page);
  expect(result.game).toMatchObject({ status: 'finished', endReason: 'lost', lives: 0 });
  expect(result.game.score).toBeGreaterThan(0);
  expect(result.save).toMatchObject({ plays: 1, wins: 0, bestStage: 1, bestScore: result.game.score, totalBricks: result.game.totalBricks });
  await expect(page.locator('#over-copy')).toContainText('남은 목숨 없음');
  await expect(page.locator('#over-copy')).toContainText('새로운 최고 기록');
  await expect(page.locator('#result-home')).toBeVisible();
  await attachScreenEvidence(page, info, 'actual-loss-result', browserName);
  await page.locator('#court').focus(); await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight'); await page.clock.runFor(2000);
  expect((await snapshot(page)).game).toEqual(result.game); expect((await snapshot(page)).save.plays).toBe(1);
  await page.locator('#primary').click(); expect((await snapshot(page)).game).toMatchObject({ status: 'ready', score: 0, lives: 3 });
  expect((await snapshot(page)).save).toEqual(result.save);
});
