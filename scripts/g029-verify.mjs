// G029 INTEGRATE harness. PM2 and Git are never touched; the only server is the candidate
// build started on loopback 3283 by this script itself (its own PID alone is stopped).
//   node scripts/g029-verify.mjs --mode build              -> artifacts/g029-build (+ manifest)
//   node scripts/g029-verify.mjs --mode smoke --run <dir>  -> real HTTP/browser smoke, evidence in <dir>
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { connect } from 'node:net';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const BUILD = 'artifacts/g029-build';
const PORT = 3283;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const NEW_GAMES = [
  { id: 'starlight-switch', title: '별빛 스위치', dir: '17-flip', duration: '0.5–4분 예상' },
  { id: 'jelly-bite', title: '젤리 한입', dir: '18-samegame', duration: '1–2분 예상' },
];
const GAME_FILES = ['audio.mjs', 'engine.mjs', 'index.html', 'main.mjs', 'save.mjs', 'styles.css'];
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const FAVORITES = 'simplegames.library.favorites.v1';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sleep = ms => new Promise(done => setTimeout(done, ms));

async function walk(path) {
  const found = [];
  for (const entry of await readdir(resolve(ROOT, path), { withFileTypes: true })) {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) found.push(...await walk(child)); else found.push(child);
  }
  return found.sort();
}
async function hashAll(paths) {
  const out = {};
  for (const path of paths) out[path] = sha(await readFile(resolve(ROOT, path)));
  return out;
}

async function buildMode() {
  if (existsSync(resolve(ROOT, BUILD)) && process.env.G029_REBUILD !== '1') throw new Error(`BLOCKED: ${BUILD} already exists; never overwrite a candidate`);
  const result = spawnSync(process.execPath, ['scripts/build.mjs', '--out-dir', BUILD], { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`build failed with ${result.status}`);
  const source = await hashAll([...(await Promise.all(['src', 'public'].map(walk))).flat(), 'package.json', 'tsconfig.json', 'ecosystem.config.cjs']);
  const output = await hashAll((await walk(BUILD)).filter(path => !path.endsWith('g029-build-manifest.json')));
  const mismatches = [];
  for (const game of NEW_GAMES) for (const file of GAME_FILES) {
    const src = `public/games/${game.dir}/${file}`, built = `${BUILD}/public/games/${game.dir}/${file}`;
    if (!output[built] || output[built] !== source[src]) mismatches.push(src);
  }
  const manifest = { schema: 1, task: 'G029', root: ROOT, build: BUILD, nodeVersion: process.version, buildId: randomUUID(), created: new Date().toISOString(), newGameFilesByteEqual: mismatches.length === 0, source, output };
  await writeFile(resolve(ROOT, BUILD, 'g029-build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`manifest written; new game files byte-equal: ${mismatches.length === 0}; output files: ${Object.keys(output).length}`);
  if (mismatches.length) throw new Error(`BLOCKED: build differs from source: ${mismatches.join(', ')}`);
}

async function portOpen() {
  return new Promise(done => {
    const socket = connect({ host: '127.0.0.1', port: PORT });
    socket.once('connect', () => { socket.destroy(); done(true); });
    socket.once('error', () => done(false));
  });
}

async function smokeMode(run) {
  if (!run) throw new Error('--run <evidence dir> required');
  const evidence = resolve(ROOT, run);
  await mkdir(evidence, { recursive: true });
  if (await portOpen()) throw new Error(`BLOCKED: ${PORT} already occupied; a foreign server is never reused or stopped`);
  const manifest = JSON.parse(await readFile(resolve(ROOT, BUILD, 'g029-build-manifest.json'), 'utf8'));
  const drift = [];
  for (const [path, hash] of Object.entries(manifest.output)) if (sha(await readFile(resolve(ROOT, path))) !== hash) drift.push(path);
  const oldIds = [...(await readFile(resolve(ROOT, 'artifacts/g028-build-fix2/public/scripts/library.js'), 'utf8')).matchAll(/\bid: '([a-z0-9-]+)'/g)].map(m => m[1]);

  const server = spawn(process.execPath, [join(BUILD, 'src/server/index.js'), '--host', '127.0.0.1', '--port', String(PORT)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  let serverLog = '';
  server.stdout.on('data', d => { serverLog += d; }); server.stderr.on('data', d => { serverLog += d; });
  const results = [];
  const startedAt = new Date().toISOString();
  try {
    for (let i = 0; i < 100 && !(await portOpen()); i++) await sleep(100);
    if (!(await portOpen())) throw new Error('candidate server did not listen');
    results.push({ env: 'run', name: `own server pid ${server.pid} LISTEN ${PORT}; build ${BUILD}`, pass: true });
    results.push({ env: 'run', name: 'build output unchanged since manifest', pass: drift.length === 0, detail: drift });
    results.push({ env: 'run', name: 'previous catalog parsed from g028 build = 45 ids', pass: oldIds.length === 45, detail: oldIds.length });
    const require = createRequire(resolve(ROOT, 'package.json'));
    const { chromium, webkit, devices } = require('@playwright/test');
    const environments = [
      { name: 'chromium-pc-1366', type: chromium, touch: false, options: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } }, shots: true },
      { name: 'chromium-mobile-320', type: chromium, touch: true, options: { ...devices['Pixel 7'], viewport: { width: 320, height: 640 } }, shots: true },
      { name: 'webkit-mobile-320', type: webkit, touch: false, options: { ...devices['iPhone 13'], viewport: { width: 320, height: 640 } }, shots: false },
    ];
    for (const env of environments.filter(e => !process.env.G029_ONLY || e.name === process.env.G029_ONLY)) results.push(...await runEnvironment(env, evidence, oldIds));
  } finally {
    server.kill();
    for (let i = 0; i < 50 && await portOpen(); i++) await sleep(100);
    results.push({ env: 'run', name: `own server pid ${server.pid} stopped, ${PORT} no longer listening`, pass: !(await portOpen()) });
    await writeFile(join(evidence, 'server.log'), serverLog);
  }
  const failed = results.filter(r => !r.pass);
  await writeFile(join(evidence, 'results.json'), `${JSON.stringify({ task: 'G029-INTEGRATE', startedAt, finishedAt: new Date().toISOString(), node: process.version, build: BUILD, origin: ORIGIN, checks: results.length, failed: failed.length, results }, null, 2)}\n`);
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} [${r.env}] ${r.name}${r.pass || r.detail === undefined ? '' : ` :: ${JSON.stringify(r.detail)}`}`);
  console.log(`TOTAL ${results.length} checks, ${failed.length} failed`);
  if (failed.length) process.exitCode = 1;
}

async function runEnvironment(env, evidence, oldIds) {
  const out = [];
  const check = (name, pass, detail) => out.push({ env: env.name, name, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
  const audit = { console: [], pageErrors: [], csp: [], external: [], failedHTTP: [], failedRequests: [], holds: [] };
  const browser = await env.type.launch();
  const context = await browser.newContext({ ...env.options, locale: 'ko-KR', baseURL: ORIGIN });
  try {
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin !== ORIGIN) { audit.external.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    await context.exposeBinding('__g029Csp', (_s, data) => audit.csp.push(data));
    await context.exposeBinding('__g029Hold', (_s, data) => audit.holds.push(data));
    await context.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', e => window.__g029Csp({ directive: e.violatedDirective, blocked: e.blockedURI }));
      const downs = new Map();
      document.addEventListener('pointerdown', e => { const t = e.target instanceof Element ? e.target.closest('button,a') : null; if (t) downs.set(e.pointerId, { t, at: performance.now(), trusted: e.isTrusted }); }, true);
      document.addEventListener('pointerup', e => {
        const d = downs.get(e.pointerId); downs.delete(e.pointerId);
        if (d) window.__g029Hold({ target: d.t.id || d.t.className || d.t.tagName, holdMs: Math.round(performance.now() - d.at), trusted: d.trusted && e.isTrusted, pointerType: e.pointerType });
      }, true);
    });
    context.on('response', r => { if (r.status() >= 400) audit.failedHTTP.push({ url: r.url(), status: r.status() }); });
    context.on('requestfailed', r => audit.failedRequests.push({ url: r.url(), failure: r.failure()?.errorText }));
    const page = await context.newPage();
    page.on('console', m => audit.console.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', e => audit.pageErrors.push(e.stack ?? e.message));
    const cdp = env.touch ? await context.newCDPSession(page) : null;
    // Real-clock press held longer than 80 ms; touch uses CDP touchStart/touchEnd, others native mouse down/up.
    const press = async locator => {
      if (!cdp) return locator.click({ delay: 110 });
      await locator.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
      let box = await locator.boundingBox();
      for (let i = 0; i < 20; i++) { await sleep(60); const next = await locator.boundingBox(); const steady = next.x === box.x && next.y === box.y; box = next; if (steady) break; }
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const hit = await locator.evaluate((el, p) => { const top = document.elementFromPoint(p.x, p.y); return !!top && (el === top || el.contains(top)); }, point);
      if (!hit) throw new Error(`touch target obstructed: ${await locator.evaluate(el => el.id || el.className)}`);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await sleep(110);
      return cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const storage = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
    const snap = () => page.evaluate(() => window.__g029Snapshot());
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const smallControls = () => page.evaluate(() => [...document.querySelectorAll('button,a')].filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 43.5 || r.height < 43.5) && getComputedStyle(n).visibility !== 'hidden'; }).map(n => `${n.id || n.className || n.tagName}:${Math.round(n.getBoundingClientRect().width)}x${Math.round(n.getBoundingClientRect().height)}`));
    const shot = async (target, name) => { if (env.shots) await target.screenshot({ path: join(evidence, `${env.name}-${name}.png`) }); };
    const cardIds = () => page.locator('.game-card').evaluateAll(nodes => nodes.map(n => n.dataset.id));
    const layout = async label => { const small = await smallControls(); const over = await overflow(); check(`${label} layout (no horizontal overflow, controls >= 44px)`, over <= 0 && small.length === 0, { overflow: over, small }); };

    // ---- Home: catalog, new cards, regression of old ids.
    const home = await page.goto('/');
    check('home HTTP 200 with strict CSP header', home.status() === 200 && home.headers()['content-security-policy'] === CSP);
    check('home catalog total 47', (await page.locator('#catalog-total').textContent()) === '47');
    check('home intro 플레이 가능 18 · 준비 중 29', (await page.locator('#intro-preview').textContent()) === '플레이 가능 18 · 준비 중 29');
    check('first page shows 12 cards', await page.locator('.game-card').count() === 12);
    for (const count of [24, 36, 47]) { await press(page.locator('#load-more')); await page.waitForFunction(n => document.querySelectorAll('.game-card').length === n, count); }
    const ids = await cardIds();
    check('47 unique ids; old 45 ids kept in original order (new two only inserted)', ids.length === 47 && new Set(ids).size === 47 && JSON.stringify(ids.filter(id => !NEW_GAMES.some(g => g.id === id))) === JSON.stringify(oldIds), { ids });
    check('available 18 / upcoming 29 cards', await page.locator('.game-card.available').count() === 18 && await page.locator('.game-card.upcoming').count() === 29);
    check('upcoming 29 stay disabled buttons without links', await page.locator('.game-card.upcoming a').count() === 0 && await page.locator('.game-card.upcoming button.card-action:disabled').count() === 29);
    for (const game of NEW_GAMES) {
      const card = page.locator(`.game-card[data-id="${game.id}"]`);
      const info = { title: await card.locator('h3').textContent(), pill: await card.locator('.status-pill').textContent(), genre: await card.locator('.genre-label').textContent(), duration: await card.locator('.duration').textContent(), href: await card.locator('a.card-action').getAttribute('href'), label: await card.locator('a.card-action').getAttribute('aria-label'), svgNodes: await card.locator('.card-art svg.mini-g022 > *').count(), artHidden: await card.locator('.card-art').getAttribute('aria-hidden') };
      check(`card ${game.id}`, info.title === game.title && info.pill === '플레이 가능' && info.genre === '퍼즐' && info.duration === game.duration && info.href === `/games/${game.dir}/index.html` && info.label === `${game.title} 게임 시작` && info.svgNodes > 10 && info.artHidden === 'true', info);
      await card.scrollIntoViewIfNeeded(); await shot(card, `card-${game.id}`);
    }
    await page.locator('#game-search').fill('별빛'); check('search 별빛 -> starlight-switch only', JSON.stringify(await cardIds()) === '["starlight-switch"]');
    await page.locator('#game-search').fill('samegame'); check('search samegame -> jelly-bite only', JSON.stringify(await cardIds()) === '["jelly-bite"]');
    await press(page.locator('#clear-search'));
    check('home itself wrote no storage key', JSON.stringify(await storage()) === '{}');

    // ---- Favorites keep old ids and accept new ids; storage key unchanged.
    await page.evaluate(key => localStorage.setItem(key, JSON.stringify(['number-garden', 'snack-pairs'])), FAVORITES);
    await page.reload();
    check('seeded old favorites restored after reload (count 2)', (await page.locator('#favorite-count').textContent()) === '2' && await page.locator('.favorite-button[data-id="number-garden"][aria-pressed="true"]').count() === 1);
    await page.locator('#game-search').fill('젤리');
    await press(page.locator('.favorite-button[data-id="jelly-bite"]'));
    await press(page.locator('#clear-search'));
    const favs = JSON.parse((await storage())[FAVORITES]);
    check('new id favorite appended, old favorites intact, only the favorites key exists', JSON.stringify(favs) === '["number-garden","snack-pairs","jelly-bite"]' && Object.keys(await storage()).length === 1, favs);
    await page.reload();
    check('favorites persist after reload (3)', (await page.locator('#favorite-count').textContent()) === '3');

    // ---- Regression: two existing games launch from home and come back.
    for (const [id, dir, query] of [['number-garden', '01-2048', '숫자 정원'], ['four-star-song', '16-simon', '네 별의 노래']]) {
      await page.locator('#game-search').fill(query);
      const response = page.waitForResponse(r => r.url() === `${ORIGIN}/games/${dir}/index.html`);
      await press(page.locator(`.game-card[data-id="${id}"] a.card-action`));
      const reached = await response;
      await page.waitForURL(`${ORIGIN}/games/${dir}/index.html`);
      check(`regression ${id}: card opens ${dir} (HTTP 200)`, reached.status() === 200 && page.url() === `${ORIGIN}/games/${dir}/index.html`, { status: reached.status(), url: page.url() });
      await page.waitForLoadState('load');
      check(`regression ${id}: game page has heading and no horizontal overflow`, await page.locator('h1').first().isVisible() && await overflow() <= 0);
      await page.goBack(); await page.waitForSelector('.game-card');
    }
    check('home counters intact after returning', (await page.locator('#catalog-total').textContent()) === '47');
    await page.evaluate(key => localStorage.removeItem(key), FAVORITES);

    // ---- Game 17.
    const verifyFiles = async game => {
      const detail = {};
      for (const file of GAME_FILES) {
        const r = await page.request.get(`${ORIGIN}/games/${game.dir}/${file}`);
        const same = sha(await r.body()) === sha(await readFile(resolve(ROOT, 'public/games', game.dir, file)));
        detail[file] = `${r.status()}${same ? '' : ' MISMATCH'}`;
      }
      check(`${game.dir}: 6 files HTTP 200 and byte-equal to public/ source`, Object.values(detail).every(v => v === '200'), detail);
    };
    await page.goto('/');
    await press(page.locator('#load-more'));
    let response = page.waitForResponse(r => r.url() === `${ORIGIN}/games/17-flip/index.html`);
    await press(page.locator('.game-card[data-id="starlight-switch"] a.card-action'));
    const r17 = await response;
    await page.waitForURL(`${ORIGIN}/games/17-flip/index.html`);
    check('17: card click loads /games/17-flip/index.html (200, strict CSP)', r17.status() === 200 && r17.headers()['content-security-policy'] === CSP && page.url() === `${ORIGIN}/games/17-flip/index.html`);
    await page.waitForSelector('#start');
    await page.waitForFunction(() => typeof window.__g029Snapshot === 'function');
    await verifyFiles(NEW_GAMES[0]);
    let s = await snap();
    check('17: ready phase before explicit start, no storage written', s.phase === 'ready' && (await storage())['simplegames.starlight-switch.v1'] === undefined, s.phase);
    await layout('17 ready');
    await press(page.locator('#start'));
    await page.waitForFunction(() => window.__g029Snapshot().phase === 'playing');
    s = await snap();
    check('17: start -> playing, stage 1 (3x3), moves 0', s.phase === 'playing' && s.size === 3 && s.moves === 0 && s.stage === 1, { phase: s.phase, size: s.size, moves: s.moves });
    const before = s.board.slice();
    await press(page.locator('.star[data-cell="4"]'));
    await page.waitForFunction(() => window.__g029Snapshot().moves === 1);
    s = await snap();
    const flipped = s.board.map((v, i) => (v !== before[i] ? i : -1)).filter(i => i >= 0);
    check('17: trusted press on centre toggles exactly centre + 4 neighbours, moves 1', JSON.stringify(flipped) === '[1,3,4,5,7]' && s.moves === 1, { flipped });
    await sleep(250);
    await press(page.locator('.star[data-cell="4"]'));
    await page.waitForFunction(() => window.__g029Snapshot().moves === 2);
    s = await snap();
    check('17: second press restores original board (double toggle), moves 2', JSON.stringify(s.board) === JSON.stringify(before) && s.moves === 2);
    await sleep(250);
    await press(page.locator('#undo'));
    await page.waitForFunction(() => window.__g029Snapshot().moves === 1);
    check('17: undo -> moves 1', (await snap()).moves === 1);
    // Wait out the 120 ms feedback lock: the status text changes length when it ends (layout shift seen on WebKit 320, see INTEGRATION.md).
    await page.waitForFunction(() => window.__g029Snapshot().remaining === 0);
    await layout('17 playing');
    await shot(page, 'game17-playing');
    await press(page.locator('#pause'));
    await page.waitForFunction(() => window.__g029Snapshot().phase === 'paused');
    const pausedBoard = (await snap()).board;
    check('17: pause shows 이어서하기', await page.getByRole('button', { name: '이어서하기' }).isVisible());
    await press(page.getByRole('button', { name: '이어서하기' }));
    await page.waitForFunction(() => window.__g029Snapshot().phase === 'playing');
    check('17: resume -> playing with same board', JSON.stringify((await snap()).board) === JSON.stringify(pausedBoard));
    await press(page.locator('#pause'));
    await page.waitForFunction(() => window.__g029Snapshot().phase === 'paused');
    await press(page.locator('#home'));
    await page.waitForFunction(() => window.__g029Snapshot().modal === 'home');
    check('17: home during a run asks first (modal home), no storage settlement', (await storage())['simplegames.starlight-switch.v1'] === undefined);
    await press(page.getByRole('button', { name: '게임 목록으로' }));
    await page.waitForURL(`${ORIGIN}/`);
    check('17: confirm returns to home; abandoned run left no game key', (await storage())['simplegames.starlight-switch.v1'] === undefined && (await page.locator('#catalog-total').textContent()) === '47');

    // ---- Game 18.
    await press(page.locator('#load-more'));
    response = page.waitForResponse(r => r.url() === `${ORIGIN}/games/18-samegame/index.html`);
    await press(page.locator('.game-card[data-id="jelly-bite"] a.card-action'));
    const r18 = await response;
    await page.waitForURL(`${ORIGIN}/games/18-samegame/index.html`);
    check('18: card click loads /games/18-samegame/index.html (200, strict CSP)', r18.status() === 200 && r18.headers()['content-security-policy'] === CSP && page.url() === `${ORIGIN}/games/18-samegame/index.html`);
    await page.waitForSelector('#start');
    await page.waitForFunction(() => typeof window.__g029Snapshot === 'function');
    await verifyFiles(NEW_GAMES[1]);
    s = await snap();
    check('18: ready before explicit start, default mode normal, no storage written', s.phase === 'ready' && s.mode === 'normal' && (await storage())['simplegames.jelly-bite.v1'] === undefined, { phase: s.phase, mode: s.mode });
    await layout('18 ready');
    await press(page.locator('#start'));
    await page.waitForFunction(() => window.__g029Snapshot().phase === 'playing');
    s = await snap();
    check('18: start -> playing 10x10, score 0, remaining 100', s.board.length === 10 && s.board[0].length === 10 && s.score === 0 && s.remaining === 100, { rows: s.board.length, remaining: s.remaining });
    // Independent flood fill over the snapshot board to find two legal groups.
    const groupAt = (board, r0, c0) => {
      const colour = board[r0][c0]; const seen = new Set([`${r0},${c0}`]); const queue = [[r0, c0]];
      while (queue.length) { const [r, c] = queue.pop(); for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nr = r + dr, nc = c + dc; if (colour !== null && board[nr]?.[nc] === colour && !seen.has(`${nr},${nc}`)) { seen.add(`${nr},${nc}`); queue.push([nr, nc]); } } }
      return [...seen].map(k => k.split(',').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    };
    const groups = [];
    for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) { const g = groupAt(s.board, r, c); if (g.length >= 2 && !groups.some(o => o.some(([rr, cc]) => rr === r && cc === c))) groups.push(g); }
    check('18: board has at least two legal groups to exercise', groups.length >= 2, groups.length);
    const [first, second] = groups;
    const cell = ([r, c]) => page.locator(`#cell-${r}-${c}`);
    await press(cell(first[0]));
    await page.waitForFunction(() => window.__g029Snapshot().selection.length > 0);
    s = await snap();
    check('18: first press previews the whole same-colour group (selection = flood fill)', JSON.stringify(s.selection) === JSON.stringify(first) && s.score === 0 && s.remaining === 100, { expected: first.length, got: s.selection.length });
    await press(page.locator('#cancel-selection'));
    await page.waitForFunction(() => window.__g029Snapshot().selection.length === 0);
    s = await snap();
    check('18: 선택 취소 clears preview, board and score unchanged', s.score === 0 && s.remaining === 100);
    await press(cell(second[0]));
    await page.waitForFunction(() => window.__g029Snapshot().selection.length > 0);
    await shot(page, 'game18-selection');
    await press(cell(second[second.length - 1]));
    await page.waitForFunction(() => window.__g029Snapshot().remaining < 100);
    s = await snap();
    const expectedScore = (second.length - 2) ** 2;
    check(`18: second press on same group removes it atomically (n=${second.length}, score ${expectedScore}, remaining ${100 - second.length})`, s.score === expectedScore && s.remaining === 100 - second.length && s.selection.length === 0, { score: s.score, remaining: s.remaining });
    await page.waitForFunction(() => window.__g029Snapshot().lockRemaining === 0 && window.__g029Snapshot().phase === 'playing', null, { timeout: 5000 });
    await layout('18 playing');
    await press(page.locator('#pause'));
    await page.waitForFunction(() => window.__g029Snapshot().phase === 'paused');
    check('18: pause shows 이어서하기', await page.getByRole('button', { name: '이어서하기' }).isVisible());
    await press(page.getByRole('button', { name: '이어서하기' }));
    await page.waitForFunction(() => window.__g029Snapshot().phase === 'playing');
    await press(page.locator('#pause'));
    await page.waitForFunction(() => window.__g029Snapshot().phase === 'paused');
    await press(page.locator('#home'));
    await page.waitForFunction(() => window.__g029Snapshot().modal === 'home');
    check('18: home during a run asks first (modal home), no storage settlement', (await storage())['simplegames.jelly-bite.v1'] === undefined);
    await press(page.getByRole('button', { name: '나가기' }));
    await page.waitForURL(`${ORIGIN}/`);
    check('18: confirm returns to home; abandoned run left no game key', (await storage())['simplegames.jelly-bite.v1'] === undefined && (await page.locator('#catalog-total').textContent()) === '47');

    // ---- Audit.
    const holds = audit.holds;
    check(`all ${holds.length} button/link presses were trusted and held >= 80 ms`, holds.length > 25 && holds.every(h => h.trusted && h.holdMs >= 80), { min: Math.min(...holds.map(h => h.holdMs)), untrusted: holds.filter(h => !h.trusted).length });
    const noisy = audit.console.filter(m => ['error', 'warning'].includes(m.type));
    check('console error/warning 0', noisy.length === 0, noisy);
    check('page error 0', audit.pageErrors.length === 0, audit.pageErrors);
    check('external request 0', audit.external.length === 0, audit.external);
    check('CSP violation 0', audit.csp.length === 0, audit.csp);
    check('HTTP >= 400 response 0', audit.failedHTTP.length === 0, audit.failedHTTP);
    check('failed request 0', audit.failedRequests.length === 0, audit.failedRequests);
  } catch (error) {
    check('environment run completed without exception', false, String(error?.stack ?? error));
  } finally {
    await writeFile(join(evidence, `${env.name}-audit.json`), `${JSON.stringify(audit, null, 2)}\n`);
    await browser.close();
  }
  return out;
}

const args = process.argv.slice(2);
const flag = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const mode = flag('--mode');
try {
  if (mode === 'build') await buildMode();
  else if (mode === 'smoke') await smokeMode(flag('--run'));
  else throw new Error('Usage: node scripts/g029-verify.mjs --mode build | --mode smoke --run <evidence dir>');
} catch (error) {
  console.error(String(error?.message ?? error));
  process.exitCode = 2;
}
