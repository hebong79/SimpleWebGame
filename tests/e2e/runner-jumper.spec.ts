import { test as base, expect, type BrowserContext, type Page, type TestInfo } from '@playwright/test';

// G022 provenance: accepted 08 18afb7533ca515224056774523b126834114bda7; candidate 07 56ad2e6fb12f7be4c7182a470658726ffd9c30b7.
// Native cody-01 integration acceptance delta; independent QA and production release remain PM gates.
// No source fulfillment, game setters, seeded RNG, storage deletion or frozen clock is used.
const GAME = '/games/08-doodle/index.html';
const KEY = 'simplegames.doodle.v1';
const FOREIGN = ['number-garden:profile:v1', 'little-dragon.snake.v1', 'neon-rally.pong.v1',
  'simplegames.breakout.v1', 'simplegames.fallingblocks.v1', 'simplegames.flappy.v1',
  'simplegames.dino.v1', 'simplegames.library.favorites.v1'];
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
interface RecordData {
  version: number; bestScore: number; totalScore: number; bestMetric: number; totalMetric: number;
  plays: number; losses: number; quits: number; unlockedSets: string[];
  equipped: { ears: string; body: string; bag: string }; muted: boolean;
}
interface Engine {
  state: 'ready' | 'playing' | 'paused' | 'result'; round: number; time: number;
  body: { x: number; foot: number; vy: number }; cameraTop: number; minEverFoot: number;
  score: number; metric: number; direction: number; bounces: number; pauseReason: string | null;
  result: { reason: 'fall' | 'quit'; score: number; metric: number } | null;
  platforms: { id: number; x: number; top: number }[];
}
interface Snapshot {
  engine: Engine; storage: { record: RecordData; blocked: boolean; recovered: boolean; firstVisit: boolean; saturated: boolean };
  ui: { activeDialog: string | null; previewPose: string; draft: RecordData['equipped']; held: string[]; multi: boolean };
}
interface Audit {
  console: { type: string; text: string; location: unknown }[];
  pageErrors: string[]; csp: unknown[]; external: string[]; failedHTTP: unknown[]; failedRequests: unknown[];
}
async function attach(info: TestInfo, name: string, value: unknown) {
  await info.attach(name, { body: JSON.stringify(value, null, 2), contentType: 'application/json' });
}
const test = base.extend<{ audit: Audit }>({
  audit: [async ({ context, page, baseURL }, use, info) => {
    const origin = new URL(baseURL!).origin;
    const audit: Audit = { console: [], pageErrors: [], csp: [], external: [], failedHTTP: [], failedRequests: [] };
    const watch = (p: Page) => {
      p.on('console', m => audit.console.push({ type: m.type(), text: m.text(), location: m.location() }));
      p.on('pageerror', e => audit.pageErrors.push(e.stack || e.message));
      p.on('websocket', socket => audit.external.push(socket.url())); // connect-src none also forbids same-origin sockets.
    };
    context.pages().forEach(watch); context.on('page', watch);
    context.on('request', r => { if (new URL(r.url()).origin !== origin) audit.external.push(r.url()); });
    context.on('response', r => { if (r.status() >= 400) audit.failedHTTP.push({ url: r.url(), status: r.status() }); });
    context.on('requestfailed', r => audit.failedRequests.push({ url: r.url(), failure: r.failure() }));
    await context.exposeBinding('__g022Csp', ({ frame }, value) => { audit.csp.push({ frame: frame.url(), value }); });
    await context.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', e => {
        const report = (window as unknown as { __g022Csp: (data: unknown) => Promise<void> }).__g022Csp;
        void report({ blockedURI: e.blockedURI, directive: e.effectiveDirective, policy: e.originalPolicy, disposition: e.disposition });
      });
    });
    try { await use(audit); }
    finally {
      try {
        if (!page.isClosed() && [GAME, '/games/07-dino/index.html'].includes(new URL(page.url()).pathname)) {
          await attach(info, 'final-readonly-snapshot', new URL(page.url()).pathname === GAME ? await read(page) : await dinoRead(page));
          await layout(page, info, 'final-layout', false);
        }
      } finally {
        await attach(info, 'unfiltered-browser-diagnostics', audit);
        expect.soft(audit.console.filter(m => ['warning', 'warn', 'error'].includes(m.type)), 'all console warnings/errors').toEqual([]);
        expect.soft(audit.pageErrors).toEqual([]); expect.soft(audit.csp).toEqual([]);
        expect.soft(audit.external).toEqual([]); expect.soft(audit.failedHTTP).toEqual([]); expect.soft(audit.failedRequests).toEqual([]);
      }
    }
  }, { auto: true }],
});
// A new context per test; save fixtures below never establish normal-play achievements.
test.use({ storageState: { cookies: [], origins: [] } });
const read = (page: Page): Promise<Snapshot> => page.evaluate(async () => {
  const url = '/games/08-doodle/main.mjs';
  return (await import(url)).getSnapshot();
});
const press = (page: Page, selector: string) => page.locator(selector).click({ delay: 80 });
async function open(page: Page) {
  const response = await page.goto(GAME);
  expect(response?.status()).toBe(200);
  expect(response?.headers()['content-security-policy']).toBe(CSP);
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  await expect(page.locator('#state-label')).toHaveText('준비');
}
async function start(page: Page) {
  await press(page, '#primary');
  await expect(page.locator('#state-label')).toHaveText('도약 중');
  await expect(page.locator('#game-area')).toBeFocused();
}
async function frozen(page: Page) {
  const before = await read(page); expect(before.engine.state).toBe('paused');
  expect(before.engine.direction).toBe(0); expect(before.ui.held).toEqual([]);
  await page.waitForTimeout(180);
  expect((await read(page)).engine).toEqual(before.engine);
}
async function layout(page: Page, info: TestInfo, name: string, assert = true) {
  // No screenshotter on WebKit: retain functional/CSP checks and actual DOM geometry.
  const data = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight }, docWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    dialogs: [...document.querySelectorAll('dialog[open]')].map(d => ({ id: d.id, scroll: d.scrollWidth, client: d.clientWidth,
      height: d.getBoundingClientRect().height, scrollHeight: d.scrollHeight, clientHeight: d.clientHeight,
      overflowY: getComputedStyle(d).overflowY })),
    controls: [...document.querySelectorAll('button,a')].filter(n => n.getClientRects().length &&
      !n.closest('[hidden],dialog:not([open])') && getComputedStyle(n).visibility !== 'hidden').map(n => {
      const r = n.getBoundingClientRect(); return { id: n.id, text: n.textContent, width: r.width, height: r.height };
    }),
  }));
  await attach(info, name, data);
  if (assert) {
    expect(data.docWidth).toBeLessThanOrEqual(data.viewport.width); expect(data.bodyWidth).toBeLessThanOrEqual(data.viewport.width);
    expect(data.controls.filter(r => r.width < 44 || r.height < 44)).toEqual([]);
    for (const d of data.dialogs) {
      expect(d.scroll).toBeLessThanOrEqual(d.client); expect(d.height).toBeLessThanOrEqual(data.viewport.height);
      if (d.scrollHeight > d.clientHeight) expect(['auto', 'scroll']).toContain(d.overflowY);
    }
  }
}
interface Probe { calls: { operation: string; key: string }[]; raw: string | null; foreign: (string | null)[] }
async function storageProbe(context: BrowserContext, mode = 'normal', raw: string | null = null, key = KEY, foreign = FOREIGN) {
  await context.addInitScript(({ key, foreign, mode, raw }) => {
    const store = window.localStorage, proto = Storage.prototype;
    const get = proto.getItem, set = proto.setItem;
    // Fixture writes occur before observation and only in this fresh test context.
    if (raw !== null && get.call(store, key) === null) set.call(store, key, raw);
    foreign.forEach((k, i) => { if (get.call(store, k) === null) set.call(store, k, `g022-foreign-${i}`); });
    const calls: { operation: string; key: string }[] = [];
    Object.defineProperty(window, '__g022Storage', { value: () => ({ calls: structuredClone(calls),
      raw: get.call(store, key), foreign: foreign.map(k => get.call(store, k)) }) });
    for (const operation of ['getItem', 'setItem', 'removeItem', 'clear'] as const) {
      const native = proto[operation];
      Object.defineProperty(proto, operation, { configurable: true, value: function(this: Storage, ...args: string[]) {
        if (this === store) {
          calls.push({ operation, key: args[0] ?? '' });
          if ((mode === 'get' && operation === 'getItem') || (mode === 'set' && operation === 'setItem'))
            throw new DOMException('G022 isolated storage failure', 'SecurityError');
        }
        return Reflect.apply(native, this, args);
      } });
    }
    if (mode === 'getter') Object.defineProperty(window, 'localStorage', { configurable: true, get() {
      calls.push({ operation: 'getter', key }); throw new DOMException('G022 getter failure', 'SecurityError');
    } });
  }, { key, foreign, mode, raw });
}
async function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => (window as unknown as { __g022Storage: () => Probe }).__g022Storage());
}
async function isolatedKeys(page: Page) {
  const p = await probe(page);
  expect(p.foreign).toEqual(FOREIGN.map((_, i) => `g022-foreign-${i}`));
  expect(p.calls.every(c => c.key === KEY && !['clear', 'removeItem'].includes(c.operation))).toBe(true);
  return p;
}
async function watchText(page: Page, selector: string) {
  await page.evaluate(selector => {
    const data = { count: 0, redundant: [] as string[] };
    const observer = new MutationObserver(records => {
      for (const r of records) {
        data.count++;
        if (r.type === 'characterData' && r.oldValue === r.target.textContent) data.redundant.push(r.target.parentElement?.id || 'text');
        if (r.type === 'childList' && [...r.removedNodes].map(n => n.textContent).join('') === [...r.addedNodes].map(n => n.textContent).join(''))
          data.redundant.push((r.target as HTMLElement).id || 'button');
      }
    });
    document.querySelectorAll(selector).forEach(n => observer.observe(n, { childList: true, subtree: true, characterData: true, characterDataOldValue: true }));
    (window as unknown as { __g022Text: () => typeof data }).__g022Text = () => ({ ...data, redundant: [...data.redundant] });
  }, selector);
}
const textMutations = (page: Page) => page.evaluate(() => (window as unknown as { __g022Text: () => { count: number; redundant: string[] } }).__g022Text());

// @smoke is deliberately real-time/trusted; no virtual clock can hide a broken held click.
test('G022-08-01 @smoke unfrozen 80ms primary/mute/wardrobe and zero redundant text mutation', async ({ page, context }, info) => {
  await storageProbe(context); await open(page);
  const initial = await read(page); expect(initial.engine.score).toBe(0); expect(initial.engine.time).toBe(0);
  expect(initial.storage).toMatchObject({ firstVisit: true, blocked: false, recovered: false, record: { plays: 0, muted: true } });
  await watchText(page, '#primary,#mute,#pause'); await page.waitForTimeout(180);
  expect((await read(page)).engine).toEqual(initial.engine); expect(await textMutations(page)).toEqual({ count: 0, redundant: [] });
  expect((await probe(page)).calls.filter(c => c.operation === 'setItem')).toHaveLength(0);
  await start(page); await press(page, '#pause'); await frozen(page);
  await press(page, '#mute'); await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'false');
  await press(page, '#mute'); await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'true');
  expect((await textMutations(page)).redundant).toEqual([]);
  await press(page, '#wardrobe-open'); await expect(page.locator('#wardrobe')).toBeVisible();
  await watchText(page, '#wardrobe button,#wardrobe small,#primary,#mute'); await page.waitForTimeout(180);
  expect(await textMutations(page)).toEqual({ count: 0, redundant: [] });
  for (const part of ['ears', 'body', 'bag']) {
    const choice = page.locator(`#part-${part} [data-item="star-${part}"]`);
    await choice.click({ delay: 80 }); await expect(choice).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#wardrobe-apply')).toBeDisabled();
    await press(page, `#part-${part} [data-item="none"]`);
  }
  await press(page, '[data-set="star"]'); await expect(page.locator('#wardrobe-apply')).toBeDisabled();
  await press(page, '[data-pose="hit"]'); await expect(page.locator('#preview-base')).toHaveAttribute('href', './assets/kit.svg#base-hit');
  await press(page, '#wardrobe-cancel'); await frozen(page);
  expect((await textMutations(page)).redundant).toEqual([]);
  await start(page); expect((await read(page)).storage.record.plays).toBe(0);
  await isolatedKeys(page); await attach(info, 'trusted-80ms-and-mutations', await textMutations(page));
});

test('G022-08-02 Arrow/A/D scoped movement, last-down priority, modifier and trusted repeat', async ({ page }, info) => {
  await open(page); await start(page);
  const observations: unknown[] = [];
  for (const [key, direction] of [['ArrowLeft', -1], ['ArrowRight', 1], ['KeyA', -1], ['KeyD', 1]] as const) {
    const before = await read(page); await page.keyboard.down(key); await page.waitForTimeout(90); await page.keyboard.up(key);
    const after = await read(page); expect(after.engine.direction).toBe(0);
    expect((after.engine.body.x - before.engine.body.x) * direction).toBeGreaterThan(0);
    observations.push({ key, before: before.engine.body.x, after: after.engine.body.x });
  }
  await page.keyboard.down('ArrowLeft'); await page.keyboard.down('ArrowRight'); expect((await read(page)).engine.direction).toBe(1);
  await page.keyboard.up('ArrowRight'); expect((await read(page)).engine.direction).toBe(-1); await page.keyboard.up('ArrowLeft');
  for (const modifier of ['Control', 'Alt', 'Meta']) {
    await page.keyboard.down(modifier); await page.keyboard.down('ArrowLeft');
    expect((await read(page)).engine.direction).toBe(0); await page.keyboard.up('ArrowLeft'); await page.keyboard.up(modifier);
  }
  await page.locator('#mute').focus(); const x = (await read(page)).engine.body.x;
  await page.keyboard.press('ArrowRight'); expect((await read(page)).engine.body.x).toBe(x);
  await page.locator('#game-area').focus(); await page.keyboard.down('KeyP');
  await page.keyboard.down('KeyP'); expect((await read(page)).engine.state).toBe('paused'); await page.keyboard.up('KeyP');
  await page.keyboard.press('KeyP'); expect((await read(page)).engine.state).toBe('playing');
  await attach(info, 'actual-key-movement', observations);
});

test('G022-08-03 normal landing, maximum-height scoring, natural fall once, reload and retry', async ({ page, context }, info) => {
  await storageProbe(context); await open(page); await start(page);
  let held: string | null = null, s = await read(page), previous = s.engine;
  let targetId: number | undefined, targetBounce = -1;
  const landDeadline = Date.now() + 6500;
  while (Date.now() < landDeadline && s.engine.state === 'playing' && s.engine.bounces < 1) {
    const e = s.engine;
    expect(e.score).toBe(Math.floor(e.metric / 10)); expect(e.metric).toBe(Math.floor(Math.max(0, 560 - e.minEverFoot) + 1e-9));
    expect(e.metric).toBeGreaterThanOrEqual(previous.metric); expect(e.cameraTop).toBeLessThanOrEqual(previous.cameraTop);
    expect(s.storage.record.plays).toBe(0);
    // Lock a reachable target for this flight; changing it every RAF can steer away mid-descent.
    if (e.bounces !== targetBounce) {
      targetBounce = e.bounces;
      targetId = e.platforms.filter(p => p.top < e.body.foot - 1 && p.top >= e.body.foot - 150).sort((a, b) => b.top - a.top)[0]?.id;
    }
    const target = e.platforms.find(p => p.id === targetId);
    const next = target && Math.abs(target.x - e.body.x) > 8 ? (target.x < e.body.x ? 'ArrowLeft' : 'ArrowRight') : null;
    if (next !== held) { if (held) await page.keyboard.up(held); if (next) await page.keyboard.down(next); held = next; }
    previous = e; await page.waitForTimeout(25); s = await read(page);
  }
  if (held) await page.keyboard.up(held);
  expect(s.engine.bounces, 'real public-input re-landing').toBeGreaterThanOrEqual(1); expect(s.engine.score).toBeGreaterThan(0);
  await attach(info, 'public-input-first-landing', s);
  // A pure read-only flight prediction chooses escape input. It never alters live state/RNG/platforms.
  let escape: string | null = null, lastBounce = -1;
  const fallDeadline = Date.now() + 12000;
  while (Date.now() < fallDeadline) {
    s = await read(page); if (s.engine.state === 'result') break;
    expect(s.engine.state).toBe('playing');
    if (s.engine.bounces !== lastBounce) {
      lastBounce = s.engine.bounces;
      const next = await page.evaluate(async () => {
        const main = '/games/08-doodle/main.mjs', engine = '/games/08-doodle/engine.mjs';
        const e = (await import(main)).getSnapshot().engine, { flyInterval } = await import(engine);
        const choices = [-1, 1].map(direction => ({ direction,
          flight: flyInterval(e.body, e.platforms, direction, e.time, 2, e.cameraTop, e.minEverFoot) }))
          .sort((a, b) => Number(b.flight.failed) - Number(a.flight.failed) || b.flight.seconds - a.flight.seconds);
        return choices[0].direction < 0 ? 'ArrowLeft' : 'ArrowRight';
      });
      if (next !== escape) { if (escape) await page.keyboard.up(escape); await page.keyboard.down(next); escape = next; }
    }
    await page.waitForTimeout(30);
  }
  if (escape) await page.keyboard.up(escape); s = await read(page);
  expect(s.engine.state).toBe('result'); expect(s.engine.result?.reason).toBe('fall');
  expect(s.storage.record).toMatchObject({ plays: 1, losses: 1, quits: 0, totalScore: s.engine.score, bestScore: s.engine.score,
    totalMetric: s.engine.metric, bestMetric: s.engine.metric });
  const record = s.storage.record, p = await isolatedKeys(page);
  expect(p.calls.filter(c => c.operation === 'setItem')).toHaveLength(1);
  await page.waitForTimeout(220); expect((await read(page)).storage.record).toEqual(record);
  await page.reload(); await expect(page.locator('#state-label')).toHaveText('준비');
  expect((await read(page)).storage.record).toEqual(record); await start(page);
  expect((await read(page)).storage.record).toEqual(record);
  await attach(info, 'natural-fall-record-not-fixture', { record, probe: p });
});

test('G022-08-04 pause/blur/long RAF/cancel do not advance and require explicit resume; quit once and home', async ({ page, context }) => {
  await storageProbe(context); await open(page); await start(page);
  await press(page, '#pause'); await frozen(page); await start(page);
  await page.keyboard.down('ArrowRight'); await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.keyboard.up('ArrowRight'); expect((await read(page)).engine.pauseReason).toBe('blur'); await frozen(page); await start(page);
  const beforeDelay: Engine = await page.evaluate(async () => {
    const url = '/games/08-doodle/main.mjs'; const before = (await import(url)).getSnapshot().engine;
    const end = performance.now() + 300; while (performance.now() < end) { /* actual UI-thread delay, not virtual time */ }
    return before;
  });
  await expect.poll(async () => (await read(page)).engine.pauseReason).toBe('longframe');
  const delayed = (await read(page)).engine;
  expect(delayed.time).toBe(beforeDelay.time); expect(delayed.body).toEqual(beforeDelay.body); await frozen(page); await start(page);
  const area = page.locator('#game-area'); await area.scrollIntoViewIfNeeded(); const box = (await area.boundingBox())!;
  await area.dispatchEvent('pointerdown', { pointerId: 301, pointerType: 'touch', isPrimary: true, button: 0,
    clientX: box.x + box.width * .75, clientY: box.y + box.height * .6 });
  expect((await read(page)).engine.direction).toBe(1);
  await area.dispatchEvent('pointercancel', { pointerId: 301, pointerType: 'touch' });
  expect((await read(page)).engine.pauseReason).toBe('pointercancel'); await frozen(page);
  await press(page, '#restart'); await press(page, '#confirm-cancel'); await frozen(page);
  expect((await read(page)).storage.record.plays).toBe(0);
  await press(page, '#restart'); await press(page, '#confirm-ok');
  expect((await read(page)).engine.state).toBe('ready'); expect((await read(page)).storage.record).toMatchObject({ plays: 1, quits: 1, losses: 0 });
  await page.waitForTimeout(180); expect((await probe(page)).calls.filter(c => c.operation === 'setItem')).toHaveLength(1);
  await start(page); await press(page, '#home'); await press(page, '#confirm-cancel'); await frozen(page);
  await isolatedKeys(page);
  await press(page, '#home'); await press(page, '#confirm-ok'); await expect(page).toHaveURL(/\/$/);
  const returned = await probe(page);
  expect(JSON.parse(returned.raw!)).toMatchObject({ plays: 2, quits: 2, losses: 0 });
  // The HOME is allowed to read its own favorites key; do not misattribute that to the game.
  expect(returned.foreign).toEqual(FOREIGN.map((_, i) => `g022-foreign-${i}`));
});

test('G022-08-05 native pointer hold/release, page-wide second contact and outside scroll policy', async ({ page, context, browserName, isMobile }, info) => {
  await page.setViewportSize({ width: 375, height: 812 }); await open(page); await start(page);
  const left = page.locator('#left'); await left.scrollIntoViewIfNeeded(); const button = (await left.boundingBox())!;
  const before = (await read(page)).engine.body.x;
  await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2); await page.mouse.down();
  await page.waitForTimeout(90); expect((await read(page)).engine.direction).toBe(-1); await page.mouse.up();
  expect((await read(page)).engine.direction).toBe(0); expect((await read(page)).engine.body.x).toBeLessThan(before);
  const area = page.locator('#game-area'); await area.scrollIntoViewIfNeeded(); const r = (await area.boundingBox())!;
  const point = { x: r.x + r.width * .75, y: r.y + r.height * .55, id: 11 };
  let transport: string;
  if (browserName === 'chromium' && isMobile) {
    const session = await context.newCDPSession(page);
    try {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      expect((await read(page)).engine.direction).toBe(1);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point, { x: 20, y: 20, id: 12 }] });
      expect((await read(page)).engine.pauseReason).toBe('multitouch');
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); transport = 'trusted CDP mobile touch';
    } finally { await session.detach(); }
  } else {
    await area.dispatchEvent('pointerdown', { pointerId: 101, pointerType: 'touch', isPrimary: true, button: 0, clientX: point.x, clientY: point.y });
    expect((await read(page)).engine.direction).toBe(1);
    await page.locator('header').dispatchEvent('pointerdown', { pointerId: 102, pointerType: 'touch', isPrimary: false, button: 0, clientX: 20, clientY: 20 });
    expect((await read(page)).engine.pauseReason).toBe('multitouch');
    await page.locator('header').dispatchEvent('pointerup', { pointerId: 102, pointerType: 'touch' });
    await area.dispatchEvent('pointerup', { pointerId: 101, pointerType: 'touch' }); transport = 'synthetic PointerEvent multitouch, trusted mouse hold';
  }
  await frozen(page); await start(page); await press(page, '#pause');
  if (browserName === 'chromium') {
    await page.mouse.move(365, 600); const y = await page.evaluate(() => scrollY); await page.mouse.wheel(0, 400);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y);
  } else {
    const policy = await page.locator('header').evaluate(node => {
      const event = new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 401 });
      const allowed = node.dispatchEvent(event); window.scrollTo(0, 500);
      return { allowed, touchAction: getComputedStyle(node).touchAction };
    });
    expect(policy.allowed).toBe(true); expect(policy.touchAction).not.toBe('none');
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  }
  await attach(info, 'input-transport-limits', { transport, nativeWebKitFingerScroll: 'unverified', physicalDevice: 'unverified' });
});

async function cycleDialog(page: Page, id: string) {
  const dialog = page.locator(`#${id}`); await expect(dialog).toBeVisible();
  const ids = await dialog.locator('button:not(:disabled),a[href],[tabindex="0"]').evaluateAll(nodes => nodes
    .filter(n => n.getClientRects().length && !n.closest('[hidden]')).map(n => n.id || n.getAttribute('data-pose') || n.getAttribute('data-item')));
  expect(ids.length).toBeGreaterThan(0);
  const tabbable = dialog.locator('button:not(:disabled):visible,a[href]:visible,[tabindex="0"]:visible');
  await tabbable.last().focus(); await page.keyboard.press('Tab'); await expect(tabbable.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(tabbable.last()).toBeFocused();
}

test('G022-08-06 native dialogs Tab/ShiftTab/Escape focus return and trusted button Enter/Space repeat', async ({ page }, info) => {
  await open(page); await start(page);
  for (const [button, dialog] of [['#menu-open', 'menu'], ['#help', 'help-dialog'], ['#wardrobe-open', 'wardrobe'], ['#restart', 'confirm']]) {
    await press(page, button); await cycleDialog(page, dialog); const before = (await read(page)).engine;
    await page.keyboard.press('ArrowRight'); expect((await read(page)).engine).toEqual(before);
    await page.keyboard.press('Escape'); await expect(page.locator(`#${dialog}`)).toBeHidden();
    // QA08-002: actual trusted click trigger, not document.activeElement before opening.
    expect(await page.evaluate(() => document.activeElement?.id)).toBe(button.slice(1));
    await page.waitForTimeout(250);
    await expect(page.locator(button)).toBeFocused(); await frozen(page);
  }
  const observations: unknown[] = [];
  for (const key of ['Enter', 'Space']) {
    await page.locator('#mute').focus(); const muted = (await read(page)).storage.record.muted;
    await page.evaluate(() => {
      const events: unknown[] = [];
      (window as unknown as { __g022Keys: unknown[] }).__g022Keys = events;
      document.addEventListener('keydown', e => { if (e.target === document.getElementById('mute')) events.push({ kind: 'key', trusted: e.isTrusted, repeat: e.repeat, prevented: e.defaultPrevented }); });
      document.addEventListener('click', e => { if (e.target === document.getElementById('mute')) events.push({ kind: 'click', trusted: e.isTrusted }); });
    });
    await page.keyboard.down(key); await page.waitForTimeout(90); await page.keyboard.down(key); await page.keyboard.up(key);
    expect((await read(page)).storage.record.muted).toBe(!muted);
    const events = await page.evaluate(() => (window as unknown as { __g022Keys: { kind: string; trusted: boolean; repeat?: boolean; prevented?: boolean }[] }).__g022Keys);
    expect(events).toContainEqual({ kind: 'key', trusted: true, repeat: true, prevented: true });
    expect(events.filter(e => e.kind === 'click')).toEqual([{ kind: 'click', trusted: true }]); observations.push({ key, events });
  }
  await attach(info, 'native-activation-repeat', observations);
});

test('G022-08-07 locked preview/cancel writes zero; basic apply writes once', async ({ page, context }) => {
  await storageProbe(context); await open(page); await press(page, '#wardrobe-open');
  const initial = (await read(page)).storage.record;
  for (const set of ['star', 'explorer', 'carrot']) {
    await press(page, `[data-set="${set}"]`); await expect(page.locator('#wardrobe-apply')).toBeDisabled();
    await expect(page.locator('#preview-ears')).toHaveAttribute('href', `./assets/kit.svg#${set}-ears-idle`);
  }
  for (const pose of ['idle', 'rise', 'fall', 'land', 'hit']) {
    await press(page, `[data-pose="${pose}"]`); await expect(page.locator('#preview-base')).toHaveAttribute('href', `./assets/kit.svg#base-${pose}`);
  }
  await press(page, '#wardrobe-cancel'); expect((await read(page)).storage.record).toEqual(initial);
  expect((await probe(page)).calls.filter(c => c.operation === 'setItem')).toHaveLength(0);
  await press(page, '#wardrobe-open'); await press(page, '[data-set="basic"]'); await press(page, '#wardrobe-apply');
  expect((await probe(page)).calls.filter(c => c.operation === 'setItem')).toHaveLength(1); await isolatedKeys(page);
});

for (const viewport of [{ width: 320, height: 720 }, { width: 375, height: 812 }, { width: 667, height: 375 }, { width: 1366, height: 900 }]) {
  test(`G022-08-08 layout ${viewport.width}x${viewport.height} 44px/overflow/modal scroll`, async ({ page }, info) => {
    await page.setViewportSize(viewport); await open(page); await layout(page, info, 'ready-layout');
    for (const [button, dialog] of [['#wardrobe-open', 'wardrobe'], ['#help', 'help-dialog'], ['#menu-open', 'menu']]) {
      await press(page, button); await layout(page, info, `${dialog}-layout`); await cycleDialog(page, dialog); await page.keyboard.press('Escape');
    }
    await start(page); await press(page, '#restart'); await layout(page, info, 'confirm-layout'); await page.keyboard.press('Escape');
    await layout(page, info, 'paused-layout');
  });
}

for (const mode of ['getter', 'get', 'set']) {
  test(`G022-08-09 isolated Storage ${mode} exception; memory play and own key only`, async ({ page, context }) => {
    await storageProbe(context, mode); await open(page);
    if (mode === 'set') await press(page, '#mute');
    expect((await read(page)).storage.blocked).toBe(true); await expect(page.locator('#storage-notice')).toContainText('기록이 저장되지 않습니다');
    await start(page); await press(page, '#restart'); await press(page, '#confirm-ok');
    expect((await read(page)).storage.record).toMatchObject({ plays: 1, quits: 1 });
    await press(page, '#mute'); await press(page, '#mute');
    await expect(page.locator('#storage-notice')).toContainText('기록이 저장되지 않습니다');
    const p = await isolatedKeys(page);
    expect(p.calls.filter(c => c.operation === 'setItem')).toHaveLength(mode === 'set' ? 1 : 0);
    expect(p.calls.filter(c => c.operation === 'getter')).toHaveLength(mode === 'getter' ? 1 : 0);
  });
}

// Run only after readiness, never at --list/collection. Pure save API creates achievable histories.
// No dependency on ignored artifacts or on the other worktree is introduced into the real spec.
async function saveHistory(metrics: number[]): Promise<RecordData> {
  const url = new URL('../../public/games/08-doodle/save.mjs', import.meta.url).href;
  const { defaultRecord, settleRecord } = await import(url);
  let record = defaultRecord();
  for (const metric of metrics) record = settleRecord(record, { reason: 'fall', metric, score: Math.floor(metric / 10) }).record;
  return record;
}
for (const name of ['corrupt JSON', 'old version', 'invalid cross-fields']) {
  test(`G022-08-10 isolated known-save fixture: ${name} recovery, no automatic write`, async ({ page, context }) => {
    const fixture = await saveHistory([1000]);
    const raw = name === 'corrupt JSON' ? '{' : JSON.stringify(name === 'old version' ? { ...fixture, version: 0 } : { ...fixture, losses: 0 });
    await storageProbe(context, 'normal', raw); await open(page);
    expect((await read(page)).storage).toMatchObject({ recovered: true, blocked: false, record: { plays: 0, totalScore: 0 } });
    await expect(page.locator('#storage-notice')).toContainText('복구');
    expect((await probe(page)).calls.filter(c => c.operation === 'setItem')).toHaveLength(0); await isolatedKeys(page);
  });
}

test('G022-08-11 isolated known-save fixture: unlocked mixed costume cancel/apply once; not earned play', async ({ page, context }) => {
  await storageProbe(context, 'normal', JSON.stringify(await saveHistory([1000]))); await open(page);
  expect((await read(page)).storage.recovered).toBe(false);
  await press(page, '#wardrobe-open'); await press(page, '[data-set="star"]'); await expect(page.locator('#wardrobe-apply')).toBeEnabled();
  await press(page, '#wardrobe-cancel'); expect((await probe(page)).calls.filter(c => c.operation === 'setItem')).toHaveLength(0);
  await press(page, '#wardrobe-open'); await press(page, '#part-ears [data-item="star-ears"]'); await press(page, '#wardrobe-apply');
  expect((await read(page)).storage.record.equipped).toEqual({ ears: 'star-ears', body: 'none', bag: 'none' });
  expect((await read(page)).storage.record.plays).toBe(1); // supplied fixture, not a completed browser round.
  expect((await probe(page)).calls.filter(c => c.operation === 'setItem')).toHaveLength(1); await isolatedKeys(page);
});

test('G022-08-12 isolated known-save fixture: atomic saturation, no retries, settings still save', async ({ page, context }) => {
  const record = await saveHistory([Number.MAX_SAFE_INTEGER]);
  await storageProbe(context, 'normal', JSON.stringify(record)); await open(page);
  expect((await read(page)).storage.recovered).toBe(false);
  for (let round = 0; round < 2; round++) {
    await start(page); await press(page, '#restart');
    expect((await read(page)).engine.metric).toBeGreaterThan(0);
    await press(page, '#confirm-ok');
    expect((await read(page)).storage.record).toEqual(record); expect((await read(page)).storage.saturated).toBe(true);
    await expect(page.locator('#storage-notice')).toContainText('누적기록 상한');
  }
  expect((await probe(page)).calls.filter(c => c.operation === 'setItem')).toHaveLength(0);
  await press(page, '#mute'); expect((await read(page)).storage.record).toEqual({ ...record, muted: false });
  expect((await probe(page)).calls.filter(c => c.operation === 'setItem')).toHaveLength(1); await isolatedKeys(page);
});

for (const fixture of [{ name: 'impossible minimum aggregate', metrics: [109, 10], totalMetric: 110 },
  { name: 'impossible maximum aggregate', metrics: [10, 10, 9], totalMetric: 30 }]) {
  test(`G022-08-QA001 isolated known-invalid save: ${fixture.name}`, async ({ page, context }) => {
    const record = { ...await saveHistory(fixture.metrics), totalMetric: fixture.totalMetric };
    await storageProbe(context, 'normal', JSON.stringify(record)); await open(page);
    expect((await read(page)).storage).toMatchObject({ recovered: true, record: { plays: 0, bestMetric: 0, totalMetric: 0, totalScore: 0 } });
    await expect(page.locator('#storage-notice')).toContainText('복구');
    expect((await probe(page)).calls.filter(c => c.operation === 'setItem')).toHaveLength(0); await isolatedKeys(page);
  });
}
for (const fixture of [{ name: 'feasible minimum', metrics: [109, 10] }, { name: 'feasible maximum', metrics: [10, 10, 9] }]) {
  test(`G022-08-QA001 isolated achievable boundary save: ${fixture.name}`, async ({ page, context }) => {
    const record = await saveHistory(fixture.metrics);
    await storageProbe(context, 'normal', JSON.stringify(record)); await open(page);
    expect((await read(page)).storage.recovered).toBe(false); expect((await read(page)).storage.record).toEqual(record);
    await expect(page.locator('#storage-notice')).toHaveText('');
    expect((await probe(page)).calls.filter(c => c.operation === 'setItem')).toHaveLength(0); await isolatedKeys(page);
  });
}

test('G022-08-QA002 @smoke trusted help trigger focus immediately and 250ms after Escape, including nested dialogs', async ({ page }) => {
  await open(page); await start(page); await press(page, '#pause');
  await press(page, '#help'); await cycleDialog(page, 'help-dialog'); await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('help');
  await page.waitForTimeout(250); await expect(page.locator('#help')).toBeFocused(); await frozen(page);
  for (const [nested, dialog] of [['#menu-help', 'help-dialog'], ['#menu-wardrobe', 'wardrobe'], ['#menu-restart', 'confirm']]) {
    await press(page, '#menu-open'); await press(page, nested); await cycleDialog(page, dialog); await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('menu-open');
    await page.waitForTimeout(250); await expect(page.locator('#menu-open')).toBeFocused(); await frozen(page);
  }
});

test('G022-08-14 home card launch, new favorite and quit return persist without changing the existing favorites', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#intro-preview')).toHaveText('플레이 가능 10 · 준비 중 29');
  await press(page, '.favorite-button[data-id="number-garden"]');
  await press(page, '.favorite-button[data-id="cloud-bunny"]');
  await expect(page.locator('.game-card[data-id="cloud-bunny"] a.card-action')).toHaveAttribute('href', GAME);
  await press(page, '.game-card[data-id="cloud-bunny"] a.card-action');
  await expect(page).toHaveURL(new RegExp(`${GAME.replaceAll('.', '\\.')}$`));
  await start(page); await press(page, '#home'); await press(page, '#confirm-ok');
  await expect(page).toHaveURL(/\/$/); await expect(page.locator('#favorite-count')).toHaveText('2');
  await page.reload(); await expect(page.locator('#favorite-count')).toHaveText('2');
  const saved = await page.evaluate(() => ({ favorites: JSON.parse(localStorage.getItem('simplegames.library.favorites.v1')!),
    doodle: JSON.parse(localStorage.getItem('simplegames.doodle.v1')!) }));
  expect(saved.favorites).toEqual(['number-garden', 'cloud-bunny']); expect(saved.doodle).toMatchObject({ plays: 1, quits: 1, losses: 0 });
});

test('G022-08-13 audio constructor failure and reduced-motion remain playable', async ({ page, context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: class { constructor() { throw new Error('G022 isolated unavailable audio'); } } });
    Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: undefined });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await open(page); await press(page, '#mute'); await start(page);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(90); await page.keyboard.up('ArrowRight');
  expect((await read(page)).engine.body.x).toBeGreaterThan(180); expect((await read(page)).engine.score).toBeGreaterThan(0);
  await press(page, '#pause'); await frozen(page);
});

// 07 helpers use its actual independent public snapshot and pure save API.
const DINO = '/games/07-dino/index.html', DINO_KEY = 'simplegames.dino.v1';
const DINO_FOREIGN = FOREIGN.filter(k => k !== DINO_KEY).concat(KEY);
type DinoRecord = Omit<RecordData, 'equipped'> & { equipped: { hat: string; body: string; bag: string } };
interface DinoSnapshot {
  engine: { state: string; round: number; time: number; metric: number; score: number; speed: number;
    body: { x: number; width: number; height: number; foot: number; grounded: boolean; vy: number };
    duckHeld: boolean; jumpHeld: boolean; pauseReason: string | null;
    obstacles: { id: number; type: string; x: number; width: number; top: number; bottom: number }[];
    result: { reason: string; metric: number; score: number } | null };
  storage: Omit<Snapshot['storage'], 'record'> & { record: DinoRecord };
  ui: { activeDialog: string | null; held: string[]; multi: boolean; previewPose: string };
}
const dinoRead = (page: Page): Promise<DinoSnapshot> => page.evaluate(async () => {
  const url = '/games/07-dino/main.mjs'; return (await import(url)).getSnapshot();
});
async function dinoOpen(page: Page) {
  const r = await page.goto(DINO); expect(r?.status()).toBe(200);
  expect(r?.headers()['content-security-policy']).toBe(CSP); expect(r?.headers()['x-content-type-options']).toBe('nosniff');
  await expect(page.locator('#state-label')).toHaveText('준비');
}
async function dinoStart(page: Page) {
  await press(page, '#primary'); await expect(page.locator('#state-label')).toHaveText('배달 중');
  await expect(page.locator('#game-area')).toBeFocused();
}
async function dinoFrozen(page: Page) {
  const a = await dinoRead(page); expect(a.engine.state).toBe('paused'); expect(a.ui.held).toEqual([]);
  expect(a.engine.duckHeld).toBe(false); expect(a.engine.jumpHeld).toBe(false);
  await page.waitForTimeout(180); expect((await dinoRead(page)).engine).toEqual(a.engine);
}
const dinoProbe = (context: BrowserContext, mode = 'normal', raw: string | null = null) => storageProbe(context, mode, raw, DINO_KEY, DINO_FOREIGN);
async function dinoKeys(page: Page) {
  const p = await probe(page); expect(p.foreign).toEqual(DINO_FOREIGN.map((_, i) => `g022-foreign-${i}`));
  expect(p.calls.every(c => c.key === DINO_KEY && !['clear', 'removeItem'].includes(c.operation))).toBe(true); return p;
}
async function dinoHistory(metrics: number[]): Promise<DinoRecord> {
  const url = new URL('../../public/games/07-dino/save.mjs', import.meta.url).href;
  const { defaultRecord, settleRecord, validateRecord } = await import(url);
  let r = defaultRecord();
  for (const metric of metrics) r = settleRecord(r, { metric, score: Math.floor(metric / 10), reason: 'collision' }).record;
  expect(validateRecord(r).recovered).toBe(false); return r;
}

async function dinoDialogLayout(page: Page, info: TestInfo, id: string) {
  const dialog = page.locator(`#${id}`), name = `07-open-${id}-${(await page.viewportSize())!.width}`;
  await expect(dialog).toBeVisible(); await layout(page, info, name);
  const geometry = await dialog.evaluate(node => {
    const r = node.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight };
  });
  await attach(info, `${name}-bounds`, geometry);
  expect(geometry.left).toBeGreaterThanOrEqual(0); expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.width); expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);
  const controls = dialog.locator('button,a[href]'), reached = [];
  expect(await controls.count()).toBeGreaterThan(0);
  try {
  for (let i = 0; i < await controls.count(); i++) {
    const control = controls.nth(i);
    // Center within the real modal scrollport: nearest-edge scrolling can leave
    // fractional pixels clipped by native integer scroll offsets.
    await control.evaluate(node => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
    await expect(control).toBeVisible();
    const actual = await control.evaluate(node => {
      const r = node.getBoundingClientRect(), d = node.closest('dialog')!, b = d.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { id: node.id || node.getAttribute('data-pose') || node.getAttribute('data-item') || node.getAttribute('data-set'),
        width: r.width, height: r.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom,
        clipLeft: Math.max(0, b.left + d.clientLeft), clipTop: Math.max(0, b.top + d.clientTop),
        clipRight: Math.min(innerWidth, b.left + d.clientLeft + d.clientWidth),
        clipBottom: Math.min(innerHeight, b.top + d.clientTop + d.clientHeight), hit: hit === node || node.contains(hit), scrollTop: d.scrollTop };
    });
    reached.push(actual);
    expect(actual.width).toBeGreaterThanOrEqual(44); expect(actual.height).toBeGreaterThanOrEqual(44);
    expect(actual.left).toBeGreaterThanOrEqual(actual.clipLeft); expect(actual.top).toBeGreaterThanOrEqual(actual.clipTop);
    expect(actual.right).toBeLessThanOrEqual(actual.clipRight); expect(actual.bottom).toBeLessThanOrEqual(actual.clipBottom);
    expect(actual.hit, `${id}/${actual.id} reachable after modal scroll`).toBe(true);
  }
  } finally { await attach(info, `${name}-reached-controls`, reached); }
}

test('G022-07-01 @smoke unfrozen HTTP trusted 80ms start jump duck pause resume mute wardrobe and stable button text', async ({ page, context }, info) => {
  await dinoProbe(context); await dinoOpen(page); const initial = await dinoRead(page);
  expect(initial.storage).toMatchObject({ firstVisit: true, recovered: false, blocked: false, record: { plays: 0, muted: true } });
  await watchText(page, '#primary,#mute,#pause,#jump,#duck'); await page.waitForTimeout(180);
  expect((await dinoRead(page)).engine).toEqual(initial.engine); expect(await textMutations(page)).toEqual({ count: 0, redundant: [] });
  expect((await probe(page)).calls.filter(c => c.operation === 'setItem')).toHaveLength(0);
  await dinoStart(page); await press(page, '#jump'); expect((await dinoRead(page)).engine.body.foot).toBeLessThan(300);
  await page.waitForTimeout(730); await press(page, '#duck'); expect((await dinoRead(page)).engine.body.height).toBe(48);
  await press(page, '#pause'); await dinoFrozen(page); await dinoStart(page); await press(page, '#pause');
  await press(page, '#mute'); await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'false');
  await press(page, '#mute'); await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'true');
  expect((await textMutations(page)).redundant).toEqual([]);
  await press(page, '#wardrobe-open'); await expect(page.locator('#wardrobe')).toBeVisible();
  await watchText(page, '#wardrobe button,#primary,#mute'); await page.waitForTimeout(180);
  expect(await textMutations(page)).toEqual({ count: 0, redundant: [] });
  await press(page, '#wardrobe-cancel'); await dinoFrozen(page);
  expect((await dinoRead(page)).storage.record.plays).toBe(0); expect((await textMutations(page)).redundant).toEqual([]);
  await dinoKeys(page); await attach(info, '07-smoke-readonly', await dinoRead(page));
});

test('G022-07-02 normal trusted cactus avoidance scoring natural collision one settlement reload and 320px result', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 320, height: 720 }); await dinoProbe(context); await dinoOpen(page); await dinoStart(page);
  let firstId = -1, jumped = false, passed = false;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const s = await dinoRead(page); if (s.engine.state === 'result') break;
    expect(s.storage.record.plays).toBe(0); expect(s.engine.score).toBe(Math.floor(s.engine.metric / 10));
    const o = s.engine.obstacles.find(o => o.x + o.width >= 120);
    if (!jumped && o && o.x - 156 <= s.engine.speed * .21) {
      firstId = o.id; await page.keyboard.press('Space'); jumped = true;
    }
    const first = s.engine.obstacles.find(o => o.id === firstId);
    if (jumped && (!first || first.x + first.width < 120)) passed = true;
    await page.waitForTimeout(20);
  }
  const s = await dinoRead(page); expect(jumped).toBe(true); expect(passed).toBe(true);
  expect(s.engine.result?.reason).toBe('collision'); expect(s.engine.score).toBeGreaterThan(88);
  expect(s.storage.record).toMatchObject({ plays: 1, losses: 1, quits: 0, bestScore: s.engine.score, totalScore: s.engine.score,
    bestMetric: s.engine.metric, totalMetric: s.engine.metric });
  await layout(page, info, '07-natural-result-320'); await attach(info, '07-normal-earned-result', s);
  const p = await dinoKeys(page); expect(p.calls.filter(c => c.operation === 'setItem')).toHaveLength(1);
  await page.waitForTimeout(250); expect((await dinoRead(page)).storage.record).toEqual(s.storage.record);
  await page.reload(); expect((await dinoRead(page)).storage.record).toEqual(s.storage.record);
  expect((await dinoRead(page)).engine.state).toBe('ready'); await dinoStart(page);
  expect((await dinoRead(page)).storage.record).toEqual(s.storage.record);
});

test('G022-07-03 jump hold repeat no auto jump scoped modifiers duck up and multi-key release', async ({ page }) => {
  await dinoOpen(page); await dinoStart(page);
  await page.keyboard.down('Space'); await page.waitForTimeout(100); await page.keyboard.down('Space');
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(700);
  expect((await dinoRead(page)).engine.body.grounded).toBe(true);
  await page.waitForTimeout(100); expect((await dinoRead(page)).engine.body.foot).toBe(300);
  await page.keyboard.up('Space'); await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowDown'); expect((await dinoRead(page)).engine.body.height).toBe(24);
  await page.keyboard.press('Space'); expect((await dinoRead(page)).engine.body.grounded).toBe(true);
  await page.keyboard.up('ArrowDown'); expect((await dinoRead(page)).engine.body.height).toBe(48);
  for (const mod of ['Control', 'Alt', 'Meta']) { await page.keyboard.down(mod); await page.keyboard.press('ArrowUp'); await page.keyboard.up(mod); expect((await dinoRead(page)).engine.body.grounded).toBe(true); }
  await page.locator('#mute').focus(); await page.keyboard.press('ArrowUp'); expect((await dinoRead(page)).engine.body.grounded).toBe(true);
});

test('G022-07-04 protection blur longframe pointercancel and explicit resume; restart/home cancel and quit once', async ({ page, context }) => {
  await dinoProbe(context); await dinoOpen(page); await dinoStart(page);
  await page.keyboard.down('ArrowDown'); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.keyboard.up('ArrowDown');
  expect((await dinoRead(page)).engine.pauseReason).toBe('blur'); await dinoFrozen(page); await dinoStart(page);
  const before = await page.evaluate(async () => { const url='/games/07-dino/main.mjs'; const e=(await import(url)).getSnapshot().engine;
    const end=performance.now()+300; while(performance.now()<end){} return e; });
  await expect.poll(async () => (await dinoRead(page)).engine.pauseReason).toBe('longframe');
  expect((await dinoRead(page)).engine.time).toBe(before.time); await dinoFrozen(page); await dinoStart(page);
  await page.locator('#duck').dispatchEvent('pointercancel', { pointerId: 61, pointerType: 'touch' });
  expect((await dinoRead(page)).engine.pauseReason).toBe('pointercancel'); await dinoFrozen(page);
  for (const opener of ['#restart', '#home']) { await press(page, opener); await press(page, '#confirm-cancel'); await dinoFrozen(page); expect((await dinoRead(page)).storage.record.plays).toBe(0); }
  await press(page, '#restart'); await press(page, '#confirm-ok'); expect((await dinoRead(page)).engine.state).toBe('ready');
  expect((await dinoRead(page)).storage.record).toMatchObject({ plays: 1, quits: 1, losses: 0 });
  await page.waitForTimeout(180); expect((await probe(page)).calls.filter(c => c.operation === 'setItem')).toHaveLength(1);
  await dinoStart(page); await dinoKeys(page); await press(page, '#home'); await press(page, '#confirm-ok');
  await expect(page).toHaveURL(/\/$/); await expect(page.locator('#intro-preview')).toHaveText('플레이 가능 10 · 준비 중 29');
  expect(JSON.parse((await probe(page)).raw!)).toMatchObject({ plays: 2, quits: 2 });
});

test('G022-07-05 trusted duck hold up outside release and board-outside second contact', async ({ page, context, browserName, isMobile }, info) => {
  await dinoOpen(page); await dinoStart(page); const duck=page.locator('#duck'); await duck.scrollIntoViewIfNeeded();
  const r=(await duck.boundingBox())!; await page.mouse.move(r.x+r.width/2,r.y+r.height/2); await page.mouse.down();
  await page.waitForTimeout(90); expect((await dinoRead(page)).engine.body.height).toBe(24);
  await page.mouse.move(1,1); expect((await dinoRead(page)).engine.body.height).toBe(48); await page.mouse.up();
  // Observe a real mouse hold; only the matching cancel below is synthetic.
  await duck.evaluate(node => {
    const events: { type: string; pointerId: number; pointerType: string; trusted: boolean }[] = [];
    (window as unknown as { __g022DinoPointers: typeof events }).__g022DinoPointers = events;
    for (const type of ['pointerdown', 'pointercancel']) node.addEventListener(type, event => {
      const e = event as PointerEvent; events.push({ type, pointerId: e.pointerId, pointerType: e.pointerType, trusted: e.isTrusted });
    });
  });
  await duck.scrollIntoViewIfNeeded(); await page.mouse.move(r.x+r.width/2,r.y+r.height/2); await page.mouse.down();
  try {
    await page.waitForTimeout(90); const held = await dinoRead(page);
    expect(held.engine.body.height).toBe(24); expect(held.engine.duckHeld).toBe(true);
    const down = await page.evaluate(() => (window as unknown as { __g022DinoPointers: { pointerId: number; pointerType: string; trusted: boolean }[] }).__g022DinoPointers.at(-1)!);
    expect(down.trusted).toBe(true);
    await duck.dispatchEvent('pointercancel', { pointerId: down.pointerId, pointerType: down.pointerType, isPrimary: true });
    const cancelled = await dinoRead(page);
    expect(cancelled.engine).toMatchObject({ state: 'paused', pauseReason: 'pointercancel', duckHeld: false, jumpHeld: false, body: { height: 48 } });
    expect(cancelled.ui.held).toEqual([]); await dinoFrozen(page);
    await attach(info, '07-active-hold-cancel', { held, cancelled, events: await page.evaluate(() => (window as unknown as { __g022DinoPointers: unknown[] }).__g022DinoPointers) });
  } finally { await page.mouse.up(); }
  await dinoFrozen(page); await dinoStart(page);
  const area=page.locator('#game-area'); await area.scrollIntoViewIfNeeded(); const b=(await area.boundingBox())!;
  const point={x:b.x+b.width*.25,y:b.y+b.height*.6,id:11}; let transport:string;
  if(browserName==='chromium'&&isMobile){ const session=await context.newCDPSession(page); try{
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]}); expect((await dinoRead(page)).engine.body.height).toBe(24);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point,{x:20,y:20,id:12}]});
    expect((await dinoRead(page)).engine.pauseReason).toBe('multitouch'); await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); transport='trusted CDP';
  }finally{await session.detach();}}else{
    await area.dispatchEvent('pointerdown',{pointerId:91,pointerType:'touch',isPrimary:true,button:0,clientX:point.x,clientY:point.y});
    expect((await dinoRead(page)).engine.body.height).toBe(24);
    await page.locator('header').dispatchEvent('pointerdown',{pointerId:92,pointerType:'touch',isPrimary:false,button:0,clientX:20,clientY:20});
    expect((await dinoRead(page)).engine.pauseReason).toBe('multitouch');
    await page.locator('header').dispatchEvent('pointerup',{pointerId:92,pointerType:'touch'}); await area.dispatchEvent('pointerup',{pointerId:91,pointerType:'touch'}); transport='synthetic extra contacts / trusted mouse hold';
  }
  await dinoFrozen(page); await attach(info,'07-input-transport',{transport,physicalDevice:false});
});

test('G022-07-06 @smoke actual modal trigger focus native close immediate RAF 250ms and nested menu', async ({ page }, info) => {
  await dinoOpen(page); await dinoStart(page); await press(page,'#pause');
  for(const [opener,dialog] of [['#help','help-dialog'],['#wardrobe-open','wardrobe'],['#restart','confirm'],['#menu-open','menu']]){
    await press(page,opener); await cycleDialog(page,dialog); await page.keyboard.press('Escape');
    expect(await page.evaluate(()=>document.activeElement?.id)).toBe(opener.slice(1));
    await page.evaluate(()=>new Promise(requestAnimationFrame)); await expect(page.locator(opener)).toBeFocused();
    await page.waitForTimeout(250); await expect(page.locator(opener)).toBeFocused(); await dinoFrozen(page);
  }
  for(const [opener,dialog] of [['#menu-help','help-dialog'],['#menu-wardrobe','wardrobe'],['#menu-restart','confirm'],['#menu-home','confirm']]){
    await press(page,'#menu-open'); await press(page,opener); await cycleDialog(page,dialog); await page.keyboard.press('Escape');
    expect(await page.evaluate(()=>document.activeElement?.id)).toBe('menu-open'); await page.evaluate(()=>new Promise(requestAnimationFrame));
    await expect(page.locator('#menu-open')).toBeFocused(); await page.waitForTimeout(250); await expect(page.locator('#menu-open')).toBeFocused(); await dinoFrozen(page);
  }
  for (const viewport of [{ width: 320, height: 667 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    for (const [opener, dialog] of [['#help','help-dialog'],['#menu-open','menu'],['#wardrobe-open','wardrobe'],['#restart','confirm']]) {
      await press(page, opener); await dinoDialogLayout(page, info, dialog); await cycleDialog(page, dialog);
      await page.keyboard.press('Escape'); await expect(page.locator(`#${dialog}`)).toBeHidden(); await dinoFrozen(page);
    }
  }
});

for(const mode of ['getter','get','set']) test(`G022-07-07 Storage ${mode} separated memory play own key`,async({page,context})=>{
  await dinoProbe(context,mode); await dinoOpen(page); if(mode==='set')await press(page,'#mute');
  expect((await dinoRead(page)).storage.blocked).toBe(true); await expect(page.locator('#storage-notice')).toContainText('기록이 저장되지 않습니다');
  await dinoStart(page); await press(page,'#restart'); await press(page,'#confirm-ok'); expect((await dinoRead(page)).storage.record).toMatchObject({plays:1,quits:1});
  await press(page,'#mute'); const p=await dinoKeys(page); expect(p.calls.filter(c=>c.operation==='setItem')).toHaveLength(mode==='set'?1:0);
});
for(const mode of ['JSON','old','impossible minimum','impossible maximum']) test(`G022-07-08 save recovery ${mode} no automatic writes`,async({page,context})=>{
  const r=await dinoHistory(mode==='impossible maximum'?[10,10,9]:[109,10]);
  const raw=mode==='JSON'?'{':JSON.stringify(mode==='old'?{...r,version:0}:{...r,totalMetric:mode==='impossible minimum'?110:30});
  await dinoProbe(context,'normal',raw); await dinoOpen(page); expect((await dinoRead(page)).storage).toMatchObject({recovered:true,record:{plays:0,totalMetric:0,totalScore:0}});
  await expect(page.locator('#storage-notice')).toContainText('복구'); expect((await dinoKeys(page)).calls.filter(c=>c.operation==='setItem')).toHaveLength(0);
});
// Contract oracle, independent of settleRecord/validateRecord/UI ownership output.
const dinoUnlockBoundaries = [
  { metrics: [4999], expected: { sport: false, space: false } },
  { metrics: [5000], expected: { sport: true, space: false } },
  { metrics: [4990,5000,20000], expected: { sport: true, space: false } },
  { metrics: [4990,5000,20000,10], expected: { sport: true, space: true } },
];
for(const { metrics, expected } of dinoUnlockBoundaries) test(`G022-07-09 achievable unlock boundary ${metrics.join('+')}`,async({page,context},info)=>{
  const r=await dinoHistory(metrics);
  for (const set of ['sport','space'] as const) expect(r.unlockedSets.includes(set), `fixture/API ${set}`).toBe(expected[set]);
  await dinoProbe(context,'normal',JSON.stringify(r)); await dinoOpen(page);
  expect((await dinoRead(page)).storage.recovered).toBe(false); expect((await dinoRead(page)).storage.record).toEqual(r);
  await press(page,'#wardrobe-open'); const actual: Partial<typeof expected> = {};
  for(const set of ['sport','space'] as const){await press(page,`[data-set="${set}"]`); actual[set]=await page.locator('#wardrobe-apply').isEnabled(); expect(actual[set], `UI ${set}`).toBe(expected[set]);}
  await attach(info, '07-independent-unlock-boundary', { metrics, expected, fixtureUnlocked: r.unlockedSets, actual });
  await press(page,'#wardrobe-cancel'); expect((await dinoKeys(page)).calls.filter(c=>c.operation==='setItem')).toHaveLength(0);
});
test('G022-07-10 achievable mixed three parts eight poses cancel/apply once no mid-round settlement',async({page,context},info)=>{
  await dinoProbe(context,'normal',JSON.stringify(await dinoHistory([30000]))); await dinoOpen(page); await dinoStart(page); await press(page,'#wardrobe-open');
  const before=(await dinoRead(page)).storage.record;
  for(const [part,item]of [['hat','space-hat'],['body','sport-body'],['bag','postal-bag']])await press(page,`#part-${part} [data-item="${item}"]`);
  const poses = [];
  for(const pose of ['run0','run1','run2','run3','jump','duck0','duck1','hit']){
    await press(page,`[data-pose="${pose}"]`); await page.locator('#preview').scrollIntoViewIfNeeded();
    for (const [part,item] of [['base','base'],['hat','space-hat'],['body','sport-body'],['bag','postal-bag']]) {
      const layer = page.locator(`#preview-${part}`);
      await expect(layer).toHaveAttribute('href',`./assets/kit.svg#${item}-${pose}`); await expect(layer).toBeVisible();
      await expect(layer).toHaveCSS('visibility', 'visible'); await expect(layer).toHaveCSS('opacity', '1');
      poses.push({ pose, part, href: await layer.getAttribute('href'), box: await layer.boundingBox() });
    }
  }
  await attach(info, '07-eight-poses-all-layers', poses);
  await press(page,'#wardrobe-cancel'); expect((await dinoRead(page)).storage.record).toEqual(before); expect((await probe(page)).calls.filter(c=>c.operation==='setItem')).toHaveLength(0);
  await press(page,'#wardrobe-open'); for(const [part,item]of [['hat','space-hat'],['body','sport-body'],['bag','postal-bag']])await press(page,`#part-${part} [data-item="${item}"]`);
  await press(page,'#wardrobe-apply'); expect((await dinoRead(page)).storage.record).toEqual({...before,equipped:{hat:'space-hat',body:'sport-body',bag:'postal-bag'}});
  expect((await dinoKeys(page)).calls.filter(c=>c.operation==='setItem')).toHaveLength(1); await dinoFrozen(page); await layout(page,info,'07-mixed-paused');
});
test('G022-07-11 atomic cap preserves whole record repeated rounds zero aggregate writes settings persist',async({page,context})=>{
  const r=await dinoHistory([Number.MAX_SAFE_INTEGER]);await dinoProbe(context,'normal',JSON.stringify(r));await dinoOpen(page);
  for(let i=0;i<2;i++){await dinoStart(page);await press(page,'#restart');expect((await dinoRead(page)).engine.metric).toBeGreaterThan(0);await press(page,'#confirm-ok');expect((await dinoRead(page)).storage.record).toEqual(r);expect((await dinoRead(page)).storage.saturated).toBe(true);await expect(page.locator('#storage-notice')).toContainText('누적기록 상한');}
  expect((await probe(page)).calls.filter(c=>c.operation==='setItem')).toHaveLength(0);await press(page,'#mute');expect((await dinoRead(page)).storage.record).toEqual({...r,muted:false});expect((await dinoKeys(page)).calls.filter(c=>c.operation==='setItem')).toHaveLength(1);
});
test('G022-07-12 compiled real home 39 cards pagination 12 24 36 39 10 playable 29 pending and dino launch return',async({page})=>{
  const r=await page.goto('/');expect(r?.status()).toBe(200);await expect(page.locator('#intro-preview')).toHaveText('플레이 가능 10 · 준비 중 29');
  for(const count of [12,24,36,39]){if(count!==12)await press(page,'#load-more');await expect(page.locator('.game-card')).toHaveCount(count);}
  await expect(page.locator('button.card-action:disabled')).toHaveCount(29);await expect(page.locator('a.card-action')).toHaveCount(10);
  await press(page,'.game-card[data-id="desert-post"] a.card-action');await expect(page).toHaveURL(new RegExp(`${DINO.replaceAll('.','\\.')}$`));
  await dinoStart(page);await press(page,'#home');await press(page,'#confirm-ok');await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('simplegames.dino.v1')!))).toMatchObject({plays:1,quits:1,losses:0});
});
