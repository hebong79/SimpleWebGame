import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const screenshots = path.join(root, 'screenshots');
await mkdir(screenshots, { recursive: true });
const evidence = { generatedAt: new Date().toISOString(), node: process.version,
  scope: 'Clickable UI prototype only; real 2048 movement and manual gameplay are not tested.',
  browser: '', checks: [], screenshots: [], errors: [], externalRequests: [], focusViolations: [] };
const browser = await chromium.launch();
evidence.browser = browser.version();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
page.on('pageerror', error => evidence.errors.push(error.message));
page.on('request', request => { if (/^https?:/.test(request.url())) evidence.externalRequests.push(request.url()); });
const url = name => pathToFileURL(path.join(root, name)).href;
const check = async (name, action) => {
  try { await action(); evidence.checks.push({ name, status: 'pass' }); }
  catch (error) { evidence.checks.push({ name, status: 'fail', error: error.message }); throw error; }
};
const capture = async name => {
  // Native dialog backdrops cover the viewport; use viewport captures for modal states.
  const modalOpen = await page.locator('dialog[open]').count() > 0;
  await page.screenshot({ path: path.join(screenshots, name), fullPage: !modalOpen });
  evidence.screenshots.push(`screenshots/${name}`);
};
const goGame = () => page.goto(url('game.html'));
const board = () => page.locator('#board').innerText();
const noResume = async () => assert.equal(await page.getByRole('button', { name: /이어서하기/ }).count(), 0);
const modalFocus = async selector => {
  if (!await page.locator(selector).evaluate(d => d.contains(document.activeElement))) evidence.focusViolations.push(`${selector}: initial focus outside dialog`);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    if (!await page.locator(selector).evaluate(d => d.contains(document.activeElement))) evidence.focusViolations.push(`${selector}: Tab ${i + 1} moved outside dialog`);
  }
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Shift+Tab');
    if (!await page.locator(selector).evaluate(d => d.contains(document.activeElement))) evidence.focusViolations.push(`${selector}: Shift+Tab ${i + 1} moved outside dialog`);
  }
};
const layout = async label => {
  const sizes = await page.evaluate(() => ({ width: innerWidth, body: document.body.scrollWidth, doc: document.documentElement.scrollWidth }));
  assert.ok(sizes.body <= sizes.width && sizes.doc <= sizes.width, `${label} overflow ${JSON.stringify(sizes)}`);
  const small = await page.locator('button:visible, a.button:visible').evaluateAll(els => els.map(el => ({ text: el.textContent.trim(), w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height })).filter(r => r.w < 43.9 || r.h < 43.9));
  assert.deepEqual(small, [], `${label}: interactive controls under 44px`);
};

try {
  await check('Home shows playable game and disabled upcoming games; no resume', async () => {
    await page.goto(url('index.html'));
    assert.equal(await page.locator('article.game-card').count(), 12);
    assert.equal(await page.locator('button.card-action:disabled').count(), 11);
    await noResume(); await layout('desktop home'); await capture('home-desktop.png');
  });
  await check('Game selection changes actual page URL', async () => {
    await page.locator('a.card-action').click();
    await page.waitForURL(url('game.html'));
    assert.equal(await page.locator('#board .tile').count(), 16);
    assert.match(await page.locator('.preview-strip').innerText(), /예시.*숫자 이동은 구현 전/);
    await noResume(); await layout('desktop game'); await capture('game-desktop.png');
  });
  const originalBoard = await board();
  await check('Pause alone reveals resume; modal traps focus; resume preserves board', async () => {
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#pause-dialog').isVisible(), true);
    assert.equal(await page.getByRole('button', { name: /이어서하기/ }).count(), 1);
    await modalFocus('#pause-dialog'); await layout('desktop pause'); await capture('paused-desktop.png');
    await page.locator('#resume-button').click();
    await noResume(); assert.equal(await board(), originalBoard);
    assert.equal(await page.locator('#pause-button').evaluate(b => b === document.activeElement), true);
  });
  await check('Restart cancellation from play preserves board and score', async () => {
    await page.locator('#restart-button').click(); await noResume(); await modalFocus('#restart-dialog');
    await page.locator('#cancel-restart').click(); assert.equal(await board(), originalBoard);
    assert.equal(await page.locator('#score').innerText(), '2,480');
  });
  await check('Restart cancellation from paused returns to pause', async () => {
    await page.locator('#pause-button').click(); await page.locator('#pause-restart').click(); await noResume();
    await page.locator('#cancel-restart').click(); assert.equal(await page.locator('#pause-dialog').isVisible(), true);
    assert.equal(await board(), originalBoard); await page.locator('#resume-button').click();
  });
  await check('Restart confirmation resets example score and board', async () => {
    await page.locator('#restart-button').click(); await page.locator('#confirm-restart').click();
    assert.equal(await page.locator('#score').innerText(), '0');
    assert.equal(await page.locator('#board .tile:not([data-value="0"])').count(), 2); await noResume();
  });
  await check('Exit shows result first, forbids resume and Escape dismissal, then navigates home', async () => {
    await goGame(); await page.locator('#exit-button').click();
    assert.equal(page.url(), url('game.html'));
    assert.match(await page.locator('#result-reason').innerText(), /게임을 종료/);
    assert.equal(await page.locator('#result-score').innerText(), '2,480');
    assert.equal(await page.locator('#result-tile').innerText(), '256');
    await noResume(); await modalFocus('#result-dialog'); await layout('desktop result'); await capture('result-desktop.png');
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#result-dialog').isVisible(), true);
    await page.locator('#result-dialog a').click(); await page.waitForURL(url('index.html')); await noResume();
  });
  await check('Paused exit reaches results without resume', async () => {
    await goGame(); await page.locator('#pause-button').click(); await page.locator('#pause-exit').click();
    assert.equal(await page.locator('#result-dialog').isVisible(), true); await noResume();
  });
  await check('All in-game home links route through result popup', async () => {
    await goGame(); const count = await page.locator('a.exit-home').count(); assert.ok(count > 0);
    for (let i = 0; i < count; i++) {
      await goGame(); await page.locator('a.exit-home').nth(i).click();
      assert.equal(page.url(), url('game.html')); assert.equal(await page.locator('#result-dialog').isVisible(), true);
      assert.match(await page.locator('#result-reason').innerText(), /게임을 종료/);
    }
  });
  await check('Natural-end preview uses blocked reason and result restart starts fresh', async () => {
    await goGame(); await page.locator('#preview-result').click();
    assert.match(await page.locator('#result-reason').innerText(), /더 이상 이동할 수 없/); await noResume();
    await page.locator('#result-restart').click(); assert.equal(await page.locator('#result-dialog').isVisible(), false);
    assert.equal(await page.locator('#score').innerText(), '0'); await noResume();
  });
  for (const width of [320, 390]) {
    await check(`${width}px home/play/pause/restart/result fit and all buttons meet 44px`, async () => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(url('index.html')); await layout(`${width} home`); if (width === 390) await capture('home-mobile.png');
      await goGame(); await layout(`${width} game`); if (width === 390) await capture('game-mobile.png');
      await page.locator('#pause-button').click(); await layout(`${width} pause`); await modalFocus('#pause-dialog');
      if (width === 390) await capture('paused-mobile.png');
      await page.locator('#pause-restart').click(); await layout(`${width} restart`); await page.locator('#cancel-restart').click();
      await page.locator('#pause-exit').click(); await layout(`${width} result`); await modalFocus('#result-dialog'); await noResume();
      if (width === 390) await capture('result-mobile.png');
    });
  }
  await check('No browser runtime errors or external HTTP requests', async () => {
    assert.deepEqual(evidence.errors, []); assert.deepEqual(evidence.externalRequests, []);
  });
  await check('Overview contact sheet generated from verified screenshots', async () => {
    const panels = await Promise.all([['홈 · 게임 목록', 'home-desktop.png'], ['플레이 · 예시 보드', 'game-desktop.png'], ['일시정지 · 이어서하기', 'paused-desktop.png'], ['게임 종료 · 결과', 'result-desktop.png']].map(async ([title, file]) => `<section><h2>${title}</h2><img src="data:image/png;base64,${(await readFile(path.join(screenshots, file))).toString('base64')}"></section>`));
    await page.setViewportSize({ width: 1504, height: 1200 });
    await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#e9e9e4;font-family:Arial,sans-serif;color:#223d30}main{display:grid;grid-template-columns:1fr 1fr;gap:24px}section{overflow:hidden;background:#fff;border-radius:8px}h2{margin:0;padding:14px 18px;font-size:20px}img{display:block;width:100%;height:auto}</style><main>${panels.join('')}</main></html>`);
    await capture('overview.png');
  });
  await check('All dialogs retain initial and cycling keyboard focus', async () => assert.deepEqual(evidence.focusViolations, []));
} catch (error) {
  evidence.failure = error.message;
  process.exitCode = 1;
} finally {
  evidence.summary = { passed: evidence.checks.filter(c => c.status === 'pass').length, failed: evidence.checks.filter(c => c.status === 'fail').length };
  await writeFile(path.join(root, 'verification.json'), JSON.stringify(evidence, null, 2) + '\n');
  await browser.close();
  console.log(JSON.stringify(evidence.summary));
  if (evidence.failure) console.error(evidence.failure);
}
