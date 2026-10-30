import { test, expect } from '@playwright/test';

const route = '/games/04-breakout/index.html';
const key = 'simplegames.breakout.v1';
const favorites = 'simplegames.library.favorites.v1';

test('G016-INT01 home launch, favorites, confirmed quit and four storage keys stay independent', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#catalog-total')).toHaveText('43');
  await expect(page.locator('#intro-preview')).toHaveText('플레이 가능 14 · 준비 중 29');
  const others = ['number-garden:profile:v1', 'little-dragon.snake.v1', 'neon-rally.pong.v1'];
  // Foreign-game sentinel fixtures: Breakout must never read, migrate or overwrite them.
  await page.evaluate(keys => keys.forEach((item, i) => localStorage.setItem(item, `foreign-sentinel-${i}`)), others);
  await page.locator('.favorite-button[data-id="cosmic-cleanup"]').click();
  const link = page.locator('.game-card[data-id="cosmic-cleanup"] a.card-action');
  await expect(link).toHaveAttribute('href', route);
  await link.click();
  await expect(page).toHaveURL(new RegExp(route.replaceAll('.', '\\.')));
  await expect(page.locator('#status')).toHaveText('발사 준비');
  await expect(page.locator('#plays')).toHaveText('0');
  await page.locator('[data-skin="solar"]').click();
  await page.locator('#mute').click();
  await page.locator('#primary').click();
  await expect(page.locator('#court')).toBeFocused();
  await page.locator('#home').click();
  await expect(page.locator('#confirm-dialog')).toBeVisible();
  await page.locator('#confirm-cancel').click();
  await expect(page.locator('#status')).toHaveText('일시정지');
  await expect(page.locator('#plays')).toHaveText('0');
  await page.locator('#primary').click();
  await page.locator('#home').click();
  await page.locator('#confirm-ok').click();
  await expect(page.locator('#game-grid')).toBeVisible();
  const stored = await page.evaluate(({ key, others, favorites }) => ({ game: JSON.parse(localStorage.getItem(key)!), others: others.map(k => localStorage.getItem(k)), favorites: JSON.parse(localStorage.getItem(favorites)!) }), { key, others, favorites });
  expect(stored.game).toMatchObject({ plays: 1, wins: 0, bestScore: 0, totalBricks: 0, bestStage: 1, muted: true, paddleTheme: 'solar' });
  expect(stored.others).toEqual(others.map((_, i) => `foreign-sentinel-${i}`));
  expect(stored.favorites).toEqual(['cosmic-cleanup']);
  await page.locator('#favorites-only').click();
  await page.locator('#game-search').fill('breakout');
  await expect(page.locator('.game-card')).toHaveCount(1);
  await page.locator('.game-card[data-id="cosmic-cleanup"] a.card-action').click();
  await expect(page.locator('#plays')).toHaveText('1');
  await expect(page.locator('#status')).toHaveText('발사 준비');
  await expect(page.locator('[data-skin="solar"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('G016-INT02 integrated HTTP serves the exact modules and keeps the strict CSP', async ({ request }) => {
  for (const file of ['index.html', 'engine.mjs', 'save.mjs', 'main.mjs', 'styles.css']) {
    const response = await request.get(`/games/04-breakout/${file}`);
    expect(response.status(), file).toBe(200);
    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toContain("script-src 'self'");
    expect(headers['content-security-policy']).toContain("connect-src 'none'");
    expect(headers['content-security-policy']).not.toContain('unsafe-inline');
    if (file.endsWith('.mjs')) expect(headers['content-type']).toContain('text/javascript');
    const head = await request.head(`/games/04-breakout/${file}`);
    expect(head.status()).toBe(200);
    expect((await head.body()).byteLength).toBe(0);
  }
  expect((await request.get('/docs/04-breakout/20261026-230956_G016_GAME_DESIGN.md')).status()).toBe(404);
  expect((await request.get('/package.json')).status()).toBe(404);
});
