import { test, expect } from '@playwright/test';

test('17 held touch keyboard feedback lock outside second touch cancels gesture', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/game.html');
  await page.evaluate(() => {
    const board = document.querySelector('#board') as HTMLElement;
    // Test adapter only: allow deterministic PointerEvent ordering without a physical finger.
    board.setPointerCapture = () => {};
    const r = board.getBoundingClientRect();
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    board.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 31, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }));
    // Synchronous keyboard move enables the 120ms feedback lock.
    board.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown', code: 'ArrowDown' }));
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 32, pointerType: 'touch', isPrimary: false, clientX: 20, clientY: 20 }));
  });
  await expect(page.locator('#move-count')).toHaveText('1회 이동');
  await page.waitForTimeout(160);
  const before = await page.locator('#board .cell').evaluateAll(cells => cells.map(cell => (cell as HTMLElement).dataset.value));
  await page.evaluate(() => {
    const board = document.querySelector('#board') as HTMLElement;
    const r = board.getBoundingClientRect();
    board.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 31, pointerType: 'touch', isPrimary: true, clientX: r.x + r.width / 2 + 60, clientY: r.y + r.height / 2 }));
    document.body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 32, pointerType: 'touch', isPrimary: false, clientX: 20, clientY: 20 }));
    board.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'ArrowDown', code: 'ArrowDown' }));
  });
  await expect(page.locator('#move-count')).toHaveText('1회 이동');
  expect(await page.locator('#board .cell').evaluateAll(cells => cells.map(cell => (cell as HTMLElement).dataset.value))).toEqual(before);
});
