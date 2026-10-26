import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// Decode an observed canvas PNG in Node, not repeated getImageData inside the live game.
const require = createRequire(import.meta.url);
const { PNG } = require(join(dirname(require.resolve('playwright-core/package.json')), 'lib/utilsBundle.js')) as {
  PNG: { sync: { read: (data: Buffer) => { width: number; height: number; data: Buffer } } };
};
async function canvasPNG(page: Page, selector: string) {
  const url = await page.locator(selector).evaluate(node => (node as HTMLCanvasElement).toDataURL('image/png'));
  return PNG.sync.read(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
}

// 실제 서버의 수명은 변경하지 않습니다. PM이 지정한 동일-origin 연결만 검사합니다.
const REQUESTED_ORIGIN = process.env.GAME_LIVE_ORIGIN;
const GAMES = [
  { id: 'number-garden', href: '/game.html' },
  { id: 'little-dragon', href: '/games/02-snake/index.html' },
  { id: 'neon-rally', href: '/games/03-pong/index.html' },
  { id: 'cosmic-cleanup', href: '/games/04-breakout/index.html' },
  { id: 'block-workshop', href: '/games/05-falling-blocks/index.html' },
  { id: 'balloon-sparrow', href: '/games/06-flappy/index.html' },
] as const;
const STRICT_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
interface Audit {
  requests: unknown[];
  responses: unknown[];
  external: unknown[];
  console: { type: string; text: string; location: unknown }[];
  pageErrors: string[];
  csp: unknown[];
  failedResponses: unknown[];
  failedRequests: unknown[];
}
async function attachJSON(info: TestInfo, name: string, value: unknown) {
  await info.attach(name, { body: JSON.stringify(value, null, 2), contentType: 'application/json' });
}
async function attachDOM(page: Page, info: TestInfo, name: string) {
  // WebKit도 DOM/기하 JSON만 수집합니다. screenshot 도구/CSP 예외는 없습니다.
  await attachJSON(info, name, await page.evaluate(() => ({
    url: location.href,
    viewport: { width: innerWidth, height: innerHeight },
    scrollWidth: document.documentElement.scrollWidth,
    text: document.body.innerText,
    controls: Array.from(document.querySelectorAll('a,button,input,canvas,#board')).map(node => {
      const r = node.getBoundingClientRect();
      return { tag: node.tagName, id: node.id, text: node.textContent, href: node.getAttribute('href'),
        hidden: (node as HTMLElement).hidden, x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  })));
}
const test = base.extend<{ audit: Audit }>({
  audit: [async ({ context, page, baseURL }, use, info) => {
    const origin = new URL(baseURL!).origin;
    if (REQUESTED_ORIGIN) expect(origin, '명시한 실제 서버 origin').toBe(REQUESTED_ORIGIN);
    const audit: Audit = { requests: [], responses: [], external: [], console: [], pageErrors: [], csp: [], failedResponses: [], failedRequests: [] };
    const watch = (target: Page) => {
      target.on('console', message => audit.console.push({ type: message.type(), text: message.text(), location: message.location() }));
      target.on('pageerror', error => audit.pageErrors.push(error.stack || error.message));
      target.on('websocket', socket => { if (new URL(socket.url()).origin !== origin) audit.external.push({ websocket: socket.url() }); });
    };
    context.pages().forEach(watch);
    context.on('page', watch);
    context.on('request', request => {
      const url = new URL(request.url());
      const entry = { url: request.url(), method: request.method(), resourceType: request.resourceType() };
      audit.requests.push(entry);
      if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && url.origin !== origin) audit.external.push(entry);
    });
    context.on('response', response => {
      const entry = { status: response.status(), url: response.url() };
      audit.responses.push(entry);
      // 자산/페이지 실패는 URL이나 오류 문구로 제외하지 않습니다.
      if (response.status() >= 400) audit.failedResponses.push(entry);
    });
    context.on('requestfailed', request => audit.failedRequests.push({ url: request.url(), failure: request.failure() }));
    await context.exposeBinding('__g017ObserveCsp', ({ frame }, value) => { audit.csp.push({ frame: frame.url(), value }); });
    await context.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', event => {
        const report = (window as unknown as { __g017ObserveCsp: (value: unknown) => Promise<void> }).__g017ObserveCsp;
        void report({ documentURI: event.documentURI, blockedURI: event.blockedURI,
          violatedDirective: event.violatedDirective, effectiveDirective: event.effectiveDirective,
          originalPolicy: event.originalPolicy, disposition: event.disposition, sourceFile: event.sourceFile,
          lineNumber: event.lineNumber, columnNumber: event.columnNumber });
      });
    });
    try { await use(audit); }
    finally {
      try { if (!page.isClosed() && page.url() !== 'about:blank') await attachDOM(page, info, 'final-dom-layout'); }
      finally {
        await attachJSON(info, 'unfiltered-browser-diagnostics', audit);
        expect.soft(audit.external, '외부 요청은 0건이어야 합니다.').toEqual([]);
        expect.soft(audit.pageErrors, 'pageerror는 0건이어야 합니다.').toEqual([]);
        expect.soft(audit.console.filter(message => ['error', 'warning', 'warn'].includes(message.type)), '모든 console 오류/경고는 0건이어야 합니다.').toEqual([]);
        expect.soft(audit.csp, '모든 문서에서 발생한 CSP 위반은 0건이어야 합니다.').toEqual([]);
        expect.soft(audit.failedResponses, '실제 탐색/자산 HTTP 실패는 0건이어야 합니다.').toEqual([]);
        expect.soft(audit.failedRequests, '실제 브라우저 요청 실패는 0건이어야 합니다.').toEqual([]);
      }
    }
  }, { auto: true }],
});
async function home(page: Page, origin: string) {
  await expect(page).toHaveURL(`${origin}/`);
  await expect(page.locator('#catalog-total')).toHaveText('35');
  await expect(page.locator('#intro-preview')).toHaveText('플레이 가능 6 · 준비 중 29');
  await expect(page.getByText('시안 보기', { exact: false })).toHaveCount(0);
  await expect(page.locator('a[href*="prototype"]')).toHaveCount(0);
}
async function available(page: Page) {
  await page.locator('#include-upcoming').uncheck();
  await expect(page.locator('.game-card')).toHaveCount(6);
  await expect(page.locator('#result-count')).toHaveText('6개');
  expect(await page.locator('.game-card').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.id))).toEqual(GAMES.map(game => game.id));
  const hrefs: string[] = [];
  for (const game of GAMES) {
    const link = page.locator(`.game-card[data-id="${game.id}"] a.card-action`);
    await expect(link).toHaveAttribute('href', game.href);
    hrefs.push((await link.getAttribute('href'))!);
  }
  expect(new Set(hrefs).size, '여섯 게임의 주소는 모두 달라야 합니다.').toBe(6);
}
async function freeze(page: Page) {
  const time = new Date('2026-10-25T12:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
}
async function raster(page: Page, selector: string) {
  return page.locator(selector).evaluate(node => (node as HTMLCanvasElement).toDataURL('image/png'));
}
async function snakeHeadY(page: Page) {
  // Observe the sizeable dark pupils (#294b3a), not subpixel white highlights.
  const image = await canvasPNG(page, '#board');
  const ys: number[] = [];
  for (let i = 0; i < image.data.length; i += 4) {
    const [r, g, b] = image.data.subarray(i, i + 3);
    if (r >= 35 && r <= 50 && g >= 65 && g <= 85 && b >= 45 && b <= 68) ys.push(Math.floor(i / 4 / image.width));
  }
  if (!ys.length) throw new Error('화면에서 아기 용의 눈동자를 찾지 못했습니다.');
  return ys.reduce((sum, value) => sum + value, 0) / ys.length;
}
async function paddle(page: Page, kind: 'pong' | 'breakout') {
  const image = await canvasPNG(page, kind === 'pong' ? '#court' : '#canvas');
  const positions: number[] = [];
  const length = kind === 'pong' ? image.height : image.width;
  for (let n = 0; n < length; n++) {
    const i = (kind === 'pong' ? n * image.width + 42 : 895 * image.width + n) * 4;
    const [r, g, b] = image.data.subarray(i, i + 3);
    if (kind === 'pong' ? r >= 90 && r <= 115 && g >= 235 && b >= 195 && b <= 220
      : r >= 160 && r <= 175 && g >= 210 && g <= 225 && b >= 195 && b <= 215) positions.push(n);
  }
  if (!positions.length) throw new Error(`${kind}: 화면의 플레이어 패들을 찾지 못했습니다.`);
  return positions.reduce((sum, value) => sum + value, 0) / positions.length;
}

test('G019-LIVE01 홈 35/6/29, 시안 제거, 정확한 여섯 링크와 375/320 레이아웃을 확인합니다.', async ({ page, baseURL }, info) => {
  const origin = new URL(baseURL!).origin;
  await page.goto('/');
  await home(page, origin);
  await expect(page.locator('#result-count')).toHaveText('35개');
  await page.locator('#load-more').click();
  await expect(page.locator('.game-card')).toHaveCount(24);
  await page.locator('#load-more').click();
  await expect(page.locator('.game-card')).toHaveCount(35);
  await expect(page.locator('.game-card.available')).toHaveCount(6);
  await expect(page.locator('.game-card.upcoming')).toHaveCount(29);
  await expect(page.locator('.game-card.upcoming a')).toHaveCount(0);
  expect(await page.locator('.game-card.upcoming .card-action').evaluateAll(nodes => nodes.every(node => (node as HTMLButtonElement).disabled))).toBe(true);
  await available(page);
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 667 });
    const layout = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    await attachJSON(info, `home-${width}-layout`, layout);
    expect(layout.document, `${width}px 홈 문서 가로 넘침`).toBeLessThanOrEqual(layout.viewport);
    expect(layout.body, `${width}px 홈 본문 가로 넘침`).toBeLessThanOrEqual(layout.viewport);
    await attachDOM(page, info, `home-${width}-dom`);
  }
});

test('G019-LIVE02 여섯 게임을 카드로 시작·정상 입력·정지·게임 내 홈 복귀하고 즐겨찾기를 보존합니다.', async ({ page, baseURL }, info) => {
  const origin = new URL(baseURL!).origin;
  await freeze(page);
  await page.goto('/');
  await home(page, origin);
  const favorite = page.locator('.favorite-button[data-id="number-garden"]');
  await expect(favorite).toHaveAttribute('aria-pressed', 'false');
  await favorite.click(); // 정상 UI로 즐겨찾기 하나만 변경합니다.
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#favorite-count')).toHaveText('1');
  await page.reload();
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#favorite-count')).toHaveText('1');
  for (const game of GAMES) {
    await test.step(`${game.id} 실제 시작·입력·일시정지·홈 복귀`, async () => {
      await available(page);
      await page.locator(`.game-card[data-id="${game.id}"] a.card-action`).click();
      await expect(page).toHaveURL(`${origin}${game.href}`);
      if (game.id === 'number-garden') {
        await expect(page.locator('#board .cell')).toHaveCount(16);
        await expect(page.locator('#board .cell:not([data-value="0"])')).toHaveCount(2);
        await expect(page.locator('#ready-panel')).toBeHidden(); // 실제 2048은 진입 즉시 새 판을 시작합니다.
        await expect(page.locator('#play-status')).toContainText('플레이 중');
        await expect(page.locator('#board')).toBeFocused();
        const initial = await page.locator('#board .cell').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-value')));
        for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
          await page.keyboard.press(key);
          await page.clock.runFor(160);
          if ((await page.locator('#move-count').innerText()) !== '0회 이동') break;
        }
        await expect(page.locator('#move-count')).not.toHaveText('0회 이동');
        const changed = await page.locator('#board .cell').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-value')));
        expect(changed).not.toEqual(initial);
        await page.locator('#pause-button').click();
        await expect(page.locator('#play-status')).toContainText('일시정지');
        await expect(page.locator('#game-dialog')).toBeVisible();
        await page.clock.runFor(600);
        expect(await page.locator('#board .cell').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-value')))).toEqual(changed);
        await page.locator('#resume-button').click();
        const score = await page.locator('#score').innerText();
        await expect(page.locator('a.exit-home').first()).toHaveAttribute('href', '/');
        await page.locator('a.exit-home').first().click();
        await expect(page.locator('#game-dialog')).toBeVisible();
        await expect(page.locator('#result-summary strong')).toHaveText(score);
        await expect(page.locator('#dialog-content')).toContainText('사용자 종료');
        await attachDOM(page, info, 'garden-result-dom');
        await expect(page.locator('#result-home')).toHaveAttribute('href', '/');
        await page.locator('#result-home').click();
      } else if (game.id === 'little-dragon') {
        await expect(page.locator('#board')).toBeVisible();
        await expect(page.locator('#primary')).toHaveText('여행 시작');
        await expect(page.locator('#game-status')).toContainText('준비 완료');
        await page.locator('#primary').click();
        await expect(page.locator('#playfield')).toBeFocused();
        await expect(page.locator('#overlay')).toBeHidden();
        await expect(page.locator('#game-status')).toContainText('여행 중');
        await page.clock.runFor(32);
        const before = await raster(page, '#board');
        const initialHeadY = await snakeHeadY(page);
        await page.keyboard.press('ArrowDown');
        await page.clock.runFor(432);
        const movedHeadY = await snakeHeadY(page);
        expect(movedHeadY, '정상 아래 방향 입력으로 용의 머리가 아래로 이동해야 합니다.').toBeGreaterThan(initialHeadY + 30);
        expect(await raster(page, '#board')).not.toBe(before);
        await attachJSON(info, 'snake-input-observation', { initialHeadY, movedHeadY });
        await page.locator('#pause').click();
        await expect(page.locator('#game-status')).toContainText('일시정지');
        await expect(page.locator('#primary')).toHaveText('여행 재개');
        await page.clock.runFor(32);
        const paused = await raster(page, '#board');
        await page.clock.runFor(600);
        expect(await raster(page, '#board')).toBe(paused);
        await attachDOM(page, info, 'snake-paused-dom');
        await expect(page.locator('.home-link')).toHaveAttribute('href', '/');
        await page.locator('.home-link').click();
      } else if (game.id === 'neon-rally') {
        await expect(page.locator('#court')).toBeVisible();
        await expect(page.locator('#status-label')).toHaveText('경기 준비');
        await page.locator('#primary-action').click();
        await expect(page.locator('#arena')).toBeFocused();
        await expect(page.locator('#overlay')).toBeHidden();
        await page.clock.runFor(32);
        const initial = await paddle(page, 'pong');
        await page.keyboard.down('ArrowDown');
        await page.clock.runFor(224);
        await page.keyboard.up('ArrowDown');
        const moved = await paddle(page, 'pong');
        expect(moved).toBeGreaterThan(initial + 60);
        await page.clock.runFor(1100);
        await expect(page.locator('#status-label')).toHaveText('경기 중');
        await page.locator('#pause').click();
        await expect(page.locator('#status-label')).toHaveText('일시정지');
        const paused = await raster(page, '#court');
        await page.clock.runFor(600);
        expect(await raster(page, '#court')).toBe(paused);
        await attachJSON(info, 'pong-input-observation', { initialPaddleY: initial, movedPaddleY: moved });
        await attachDOM(page, info, 'pong-paused-dom');
        await expect(page.locator('.back-link')).toHaveAttribute('href', '/');
        await page.locator('.back-link').click();
      } else if (game.id === 'block-workshop') {
        await expect(page.locator('#state-label')).toHaveText('준비');
        await page.locator('#primary').click();
        await expect(page.locator('#game-area')).toBeFocused();
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('Space');
        await expect(page.locator('#board .cell:not(.active)[data-type]:not([data-type=""])')).toHaveCount(4);
        await page.locator('#pause').click();
        await expect(page.locator('#state-label')).toHaveText('잠깐 쉬기');
        const board = await page.locator('#board').innerHTML();
        await page.clock.runFor(600);
        expect(await page.locator('#board').innerHTML()).toBe(board);
        await page.locator('#home').click();
        await expect(page.locator('#menu-dialog')).toBeVisible();
        await page.locator('#dialog-close').click();
        await expect(page.locator('#state-label')).toHaveText('잠깐 쉬기');
        await page.locator('#home').click();
        await page.locator('#dialog-confirm').click();
      } else if (game.id === 'balloon-sparrow') {
        await expect(page.locator('#state-label')).toHaveText('준비');
        await page.locator('#primary').click();
        await expect(page.locator('#flight-field')).toBeFocused();
        await page.clock.runFor(32);
        const before = await page.locator('#bird').getAttribute('transform');
        await page.keyboard.press('Space');
        await page.clock.runFor(128);
        expect(await page.locator('#bird').getAttribute('transform')).not.toBe(before);
        await page.locator('#pause').click();
        await expect(page.locator('#state-label')).toHaveText('잠깐 쉬기');
        const bird = await page.locator('#bird').getAttribute('transform');
        await page.clock.runFor(600);
        expect(await page.locator('#bird').getAttribute('transform')).toBe(bird);
        await page.locator('#home').click();
        await expect(page.locator('#confirm')).toBeVisible();
        await page.locator('#confirm-cancel').click();
        await expect(page.locator('#state-label')).toHaveText('잠깐 쉬기');
        await page.locator('#home').click();
        await page.locator('#confirm-ok').click();
      } else {
        await expect(page.locator('#canvas')).toBeVisible();
        await expect(page.locator('#status')).toHaveText('발사 준비');
        await page.locator('#primary').click();
        await expect(page.locator('#court')).toBeFocused();
        await expect(page.locator('#status')).toHaveText('공 발사 대기');
        await expect(page.locator('#overlay')).toBeHidden();
        await page.clock.runFor(32);
        const initial = await paddle(page, 'breakout');
        await page.keyboard.down('ArrowRight');
        await page.clock.runFor(224);
        await page.keyboard.up('ArrowRight');
        const moved = await paddle(page, 'breakout');
        expect(moved).toBeGreaterThan(initial + 60);
        const attached = await raster(page, '#canvas');
        await page.locator('#launch').click();
        await expect(page.locator('#status')).toHaveText('임무 진행 중');
        await page.clock.runFor(320);
        expect(await raster(page, '#canvas')).not.toBe(attached);
        await page.locator('#pause').click();
        await expect(page.locator('#status')).toHaveText('일시정지');
        const paused = await raster(page, '#canvas');
        await page.clock.runFor(600);
        expect(await raster(page, '#canvas')).toBe(paused);
        await attachJSON(info, 'breakout-input-observation', { initialPaddleX: initial, movedPaddleX: moved });
        await attachDOM(page, info, 'breakout-paused-dom');
        await expect(page.locator('#home')).toHaveAttribute('href', '/');
        await page.locator('#home').click();
        await expect(page.locator('#confirm-dialog')).toBeVisible();
        await page.locator('#confirm-cancel').click();
        await expect(page.locator('#confirm-dialog')).toBeHidden();
        await expect(page.locator('#status')).toHaveText('일시정지');
        await page.locator('#primary').click();
        await page.locator('#home').click();
        await expect(page.locator('#confirm-dialog')).toBeVisible();
        await page.locator('#confirm-ok').click();
      }
      await home(page, origin);
      await expect(page.locator('#favorite-count')).toHaveText('1');
      await expect(page.locator('.favorite-button[data-id="number-garden"]')).toHaveAttribute('aria-pressed', 'true');
    });
  }
  await page.locator('#favorites-only').click();
  await expect(page.locator('.game-card')).toHaveCount(1);
  await expect(page.locator('.game-card')).toHaveAttribute('data-id', 'number-garden');
  await attachDOM(page, info, 'four-games-returned-favorite-preserved');
});

test('G019-LIVE03 실제 홈·6게임·모듈 GET/HEAD MIME/nosniff/엄격 CSP와 비공개 경로 404를 확인합니다.', async ({ request }, info) => {
  const targets: { path: string; mime: string }[] = [
    ...['/', '/index.html', ...GAMES.map(game => game.href)].map(path => ({ path, mime: 'text/html' })),
    ...['library', 'main', 'engine', 'audio', 'input', 'state', 'storage'].map(name => ({ path: `/scripts/${name}.js`, mime: 'text/javascript' })),
    ...['/home.css', '/style.css'].map(path => ({ path, mime: 'text/css' })),
    { path: '/assets/favicon.svg', mime: 'image/svg+xml' },
  ];
  for (const directory of ['02-snake', '03-pong', '04-breakout', '05-falling-blocks', '06-flappy']) {
    for (const file of ['main.mjs', 'engine.mjs', ...(directory === '02-snake' ? [] : ['save.mjs']), 'styles.css']) {
      targets.push({ path: `/games/${directory}/${file}`, mime: file.endsWith('.mjs') ? 'text/javascript' : 'text/css' });
    }
  }
  const observations: unknown[] = [];
  const privateChecks: unknown[] = [];
  try {
    for (const target of targets) {
      for (const method of ['GET', 'HEAD']) {
        // APIRequestContext로 분리하여 의도적인 비공개 404가 실제 자산 실패를 가리지 않습니다.
        const response = await request.fetch(target.path, { method, maxRedirects: 0, failOnStatusCode: false });
        const body = await response.body();
        const headers = response.headers();
        observations.push({ path: target.path, method, status: response.status(), headers, bytes: body.byteLength });
        expect(response.status(), `${method} ${target.path}`).toBe(200);
        expect(headers['content-type']?.split(';')[0].trim(), target.path).toBe(target.mime);
        expect(headers['x-content-type-options'], target.path).toBe('nosniff');
        expect(headers['content-security-policy'], target.path).toBe(STRICT_CSP);
        if (method === 'HEAD') expect(body.byteLength, target.path).toBe(0);
        else {
          expect(body.byteLength, target.path).toBeGreaterThan(0);
          if (target.mime === 'text/javascript') expect(body.toString('utf8').trimStart()).not.toMatch(/^<!doctype|^<html/i);
        }
        await response.dispose();
      }
    }
    for (const path of ['/docs/HANDOFF.md', '/docs/G016_GAME_DESIGN.md', '/package.json']) {
      for (const method of ['GET', 'HEAD']) {
        const response = await request.fetch(path, { method, maxRedirects: 0, failOnStatusCode: false });
        privateChecks.push({ path, method, status: response.status(), headers: response.headers() });
        expect(response.status(), `비공개 경로 ${method} ${path}`).toBe(404);
        expect(response.headers()['x-content-type-options']).toBe('nosniff');
        expect(response.headers()['content-security-policy']).toBe(STRICT_CSP);
        if (method === 'HEAD') expect((await response.body()).byteLength).toBe(0);
        await response.dispose();
      }
    }
  } finally {
    await attachJSON(info, 'public-routes-get-head', observations);
    await attachJSON(info, 'private-path-404-api-only', privateChecks);
  }
});

async function usableLayout(page: Page, info: TestInfo, name: string) {
  const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
    small: Array.from(document.querySelectorAll('button,a,select')).filter(node => {
      const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(node).visibility !== 'hidden';
    }).map(node => ({ id: node.id, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })).filter(r => r.width < 43.9 || r.height < 43.9) }));
  await attachJSON(info, name, layout);
  expect(layout.scroll).toBeLessThanOrEqual(layout.width); expect(layout.small).toEqual([]);
}

test('G019-05 실제 블록 입력 자연종료·1회저장·재질·새로고침·320/가로 배치', async ({ page }, info) => {
  await freeze(page); await page.goto('/games/05-falling-blocks/index.html');
  for (const viewport of [{ width: 320, height: 667 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport); await usableLayout(page, info, `05-ready-${viewport.width}`);
  }
  await page.setViewportSize({ width: 375, height: 667 });
  await page.locator('#primary').click();
  for (let n = 0; n < 40 && await page.locator('#state-label').innerText() === '작업 중'; n++) {
    await page.keyboard.press('Space'); await page.clock.runFor(16);
  }
  await expect(page.locator('#state-label')).toHaveText('작업 종료');
  await expect(page.locator('#plays')).toHaveText('1');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('simplegames.fallingblocks.v1')!));
  expect(saved).toMatchObject({ plays: 1, losses: 1, wins: 0, quits: 0 });
  await page.clock.runFor(1000); await expect(page.locator('#plays')).toHaveText('1');
  await page.locator('[data-theme="ink"]').click(); await page.locator('#dialog-apply').click();
  await expect(page.locator('#board')).toHaveClass(/material-ink/);
  await page.reload(); await expect(page.locator('#state-label')).toHaveText('준비');
  await expect(page.locator('#plays')).toHaveText('1'); await expect(page.locator('#board')).toHaveClass(/material-ink/);
  await attachDOM(page, info, '05-reloaded-record-and-theme');
});

test('G019-06 실제 자연충돌·재도전잠금·옷장미리보기취소·1회기록·320/가로 배치', async ({ page }, info) => {
  await freeze(page); await page.goto('/games/06-flappy/index.html');
  for (const viewport of [{ width: 320, height: 667 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport); await usableLayout(page, info, `06-ready-${viewport.width}`);
  }
  await page.setViewportSize({ width: 375, height: 667 }); await page.locator('#primary').click();
  for (let n = 0; n < 150 && await page.locator('#state-label').innerText() === '비행 중'; n++) await page.clock.runFor(16);
  await expect(page.locator('#state-label')).toHaveText('비행 종료');
  await expect(page.locator('#plays')).toHaveText('1'); await expect(page.locator('#primary')).toBeDisabled();
  await page.clock.runFor(400); await expect(page.locator('#primary')).toBeDisabled();
  await page.clock.runFor(136); await expect(page.locator('#primary')).toBeEnabled();
  const key = 'simplegames.flappy.v1'; const saved = await page.evaluate(k => localStorage.getItem(k), key);
  expect(JSON.parse(saved!)).toMatchObject({ plays: 1, collisions: 1, quits: 0 });
  await page.locator('#result-wardrobe').click(); await expect(page.locator('#wardrobe')).toBeVisible();
  await usableLayout(page, info, '06-wardrobe');
  await page.locator('[data-outfit="pilot"]').click(); await expect(page.locator('#wardrobe-apply')).toBeDisabled();
  await page.locator('#wardrobe-cancel').click(); expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(saved);
  await page.reload(); await expect(page.locator('#state-label')).toHaveText('준비'); await expect(page.locator('#plays')).toHaveText('1');
  await attachDOM(page, info, '06-reloaded-record-and-unlock');
});
