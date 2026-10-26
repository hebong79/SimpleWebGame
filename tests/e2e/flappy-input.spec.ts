import { test, expect } from '@playwright/test';

test('G019-06-INPUT Enter 유지의 trusted repeat가 추가 날갯짓을 만들지 않습니다.', async ({ browser }, info) => {
  const diagnostics: unknown[] = [];
  async function trial(repeat: boolean) {
    const use = info.project.use;
    const context = await browser.newContext({ baseURL: use.baseURL, viewport: use.viewport, isMobile: use.isMobile, hasTouch: use.hasTouch, userAgent: use.userAgent, deviceScaleFactor: use.deviceScaleFactor, locale: 'ko-KR' });
    const page = await context.newPage();
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) diagnostics.push({ type: m.type(), text: m.text() }); });
    page.on('pageerror', e => diagnostics.push({ error: e.message }));
    const time = new Date('2026-10-26T13:00:00Z');
    await page.clock.install({ time }); await page.clock.pauseAt(time);
    await page.goto('/games/06-flappy/index.html');
    await page.locator('#primary').click(); await page.clock.runFor(32);
    await page.locator('#flap').focus();
    await page.evaluate(() => {
      const observed: { trusted: boolean; repeat: boolean; prevented: boolean }[] = [];
      const clicks: { trusted: boolean; detail: number }[] = [];
      (window as unknown as { __g019Clicks: typeof clicks }).__g019Clicks = clicks;
      document.addEventListener('click', e => { if ((e.target as HTMLElement).closest('#flap')) clicks.push({ trusted: e.isTrusted, detail: e.detail }); });
      (window as unknown as { __g019Keys: typeof observed }).__g019Keys = observed;
      document.addEventListener('keydown', e => { if (e.code === 'Enter') observed.push({ trusted: e.isTrusted, repeat: e.repeat, prevented: e.defaultPrevented }); });
    });
    await page.keyboard.down('Enter'); await page.clock.runFor(100);
    const before = await page.locator('#bird').getAttribute('transform');
    if (repeat) await page.keyboard.down('Enter');
    await page.clock.runFor(25);
    const after = await page.locator('#bird').getAttribute('transform');
    const keys = await page.evaluate(() => (window as unknown as { __g019Keys: unknown[] }).__g019Keys);
    const clicks = await page.evaluate(() => (window as unknown as { __g019Clicks: unknown[] }).__g019Clicks);
    await page.keyboard.up('Enter'); await context.close();
    return { before, after, keys, clicks };
  }
  const control = await trial(false); const repeated = await trial(true);
  await info.attach('trusted-enter-control-versus-repeat', { body: JSON.stringify({ control, repeated, diagnostics }, null, 2), contentType: 'application/json' });
  expect(repeated.keys).toContainEqual({ trusted: true, repeat: true, prevented: true });
  // Verify the native activation directly: separate WebKit pages need not share a RAF phase.
  expect(control.clicks).toEqual([{ trusted: true, detail: 0 }]);
  expect(repeated.clicks).toEqual(control.clicks);
  expect(diagnostics).toEqual([]);
});

test('G019-06-PARTS 세 부위의 버튼 선택·잠금 미리보기·취소·초점 순환을 확인합니다.', async ({ page }, info) => {
  const diagnostics: unknown[] = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) diagnostics.push({ type: m.type(), text: m.text() }); });
  page.on('pageerror', e => diagnostics.push({ error: e.message }));
  await page.goto('/games/06-flappy/index.html');
  const before = await page.evaluate(() => localStorage.getItem('simplegames.flappy.v1'));
  await page.locator('#wardrobe-open').click();
  await expect(page.locator('#wardrobe')).toBeVisible();
  await expect(page.locator('#wardrobe select')).toHaveCount(0);
  await page.locator('[data-outfit="pilot"]').click({ delay: 80 });
  await expect(page.locator('[data-outfit="pilot"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#wardrobe-apply')).toBeDisabled();
  await page.locator('[data-outfit="basic"]').click({ delay: 80 });
  for (const part of ['head', 'body', 'ankle']) {
    await expect(page.locator(`#part-${part} button`)).toHaveCount(4);
    const choice = page.locator(`#part-${part} [data-item="pilot-${part}"]`);
    await choice.click({ delay: 80 }); await expect(choice).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#wardrobe-apply')).toBeDisabled();
    await page.locator(`#part-${part} [data-item="none"]`).click({ delay: 80 });
  }
  await expect(page.locator('#wardrobe-apply')).toBeEnabled();
  await page.locator('#wardrobe-apply').focus(); await page.keyboard.press('Tab');
  await expect(page.locator('[data-outfit="basic"]')).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(page.locator('#wardrobe-apply')).toBeFocused();
  const geometry = await page.locator('#wardrobe button').evaluateAll(nodes => nodes.map(node => ({ id: node.id, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  expect(geometry.every(r => r.width >= 43.9 && r.height >= 43.9)).toBe(true);
  await page.locator('#wardrobe-cancel').click(); await expect(page.locator('#wardrobe')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('simplegames.flappy.v1'))).toBe(before);
  await info.attach('part-button-geometry-and-diagnostics', { body: JSON.stringify({ geometry, diagnostics }, null, 2), contentType: 'application/json' });
  expect(diagnostics).toEqual([]);
});

test('G019-REAL-PRESS 실제 시계의80ms 시작·정지·음소거·재개가 두 신규게임에서 동작합니다.', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  const observations: unknown[] = [];
  for (const game of [{ folder: '05-falling-blocks', playing: '작업 중' }, { folder: '06-flappy', playing: '비행 중' }]) {
    await page.goto(`/games/${game.folder}/index.html`);
    await expect(page.locator('#state-label')).toHaveText('준비');
    await page.locator('#primary').click({ delay: 80 });
    await expect(page.locator('#state-label')).toHaveText(game.playing);
    await page.locator('#pause').click({ delay: 80 });
    await expect(page.locator('#state-label')).toHaveText('잠깐 쉬기');
    await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#mute').click({ delay: 80 });
    await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#mute').click({ delay: 80 });
    await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#primary').click({ delay: 80 });
    await expect(page.locator('#state-label')).toHaveText(game.playing);
    observations.push({ game: game.folder, pressMs: 80, start: true, pause: true, muteToggle: true, resume: true });
  }
  await info.attach('real-clock-native-press', { body: JSON.stringify({ observations, errors }, null, 2), contentType: 'application/json' });
  expect(errors).toEqual([]);
});
