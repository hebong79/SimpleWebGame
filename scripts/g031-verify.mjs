// G031 INTEGRATE harness. PM2 and Git are never touched; the only server is the candidate
// build started on loopback 3291 by this script itself (its own PID alone is stopped).
//   node scripts/g031-verify.mjs --mode build              -> artifacts/g031-build (+ manifest)
//   node scripts/g031-verify.mjs --mode smoke --run <dir>  -> real HTTP/browser smoke, evidence in <dir>
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { connect } from 'node:net';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const BUILD = 'artifacts/g031-build';
const PORT = 3291;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const NEW_GAMES = [
  { id: 'pebble-solo', title: '조약돌 하나', dir: '19-pegs', duration: '1–5분 예상' },
  { id: 'paint-spread', title: '물감 번지기', dir: '20-flood', duration: '1–3분 예상' },
];
const FIX_GAMES = ['17-flip', '18-samegame']; // G031: CSS layout fix only; all files must stay byte-equal to public/
const GAME_FILES = ['audio.mjs', 'engine.mjs', 'index.html', 'main.mjs', 'save.mjs', 'styles.css'];
const BUILD_FILES = [...GAME_FILES, 'ASSETS.md']; // ASSETS.md is copied into the build but the server does not serve .md
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
  if (existsSync(resolve(ROOT, BUILD)) && process.env.G031_REBUILD !== '1') throw new Error(`BLOCKED: ${BUILD} already exists; never overwrite a candidate`);
  const result = spawnSync(process.execPath, ['scripts/build.mjs', '--out-dir', BUILD], { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`build failed with ${result.status}`);
  const source = await hashAll([...(await Promise.all(['src', 'public'].map(walk))).flat(), 'package.json', 'tsconfig.json', 'ecosystem.config.cjs']);
  const output = await hashAll((await walk(BUILD)).filter(path => !path.endsWith('g031-build-manifest.json')));
  const mismatches = [];
  for (const game of NEW_GAMES) for (const file of BUILD_FILES) {
    const src = `public/games/${game.dir}/${file}`, built = `${BUILD}/public/games/${game.dir}/${file}`;
    if (!output[built] || output[built] !== source[src]) mismatches.push(src);
  }
  for (const dir of FIX_GAMES) for (const file of GAME_FILES) {
    const src = `public/games/${dir}/${file}`, built = `${BUILD}/public/games/${dir}/${file}`;
    if (!output[built] || output[built] !== source[src]) mismatches.push(src);
  }
  const manifest = { schema: 1, task: 'G031', root: ROOT, build: BUILD, nodeVersion: process.version, buildId: randomUUID(), created: new Date().toISOString(), newGameFilesByteEqual: mismatches.length === 0, source, output };
  await writeFile(resolve(ROOT, BUILD, 'g031-build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
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
  const manifest = JSON.parse(await readFile(resolve(ROOT, BUILD, 'g031-build-manifest.json'), 'utf8'));
  const drift = [];
  for (const [path, hash] of Object.entries(manifest.output)) if (sha(await readFile(resolve(ROOT, path))) !== hash) drift.push(path);
  const oldIds = [...(await readFile(resolve(ROOT, 'artifacts/g029-build/public/scripts/library.js'), 'utf8')).matchAll(/\bid: '([a-z0-9-]+)'/g)].map(m => m[1]);

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
    results.push({ env: 'run', name: 'previous catalog parsed from g029 build = 47 ids', pass: oldIds.length === 47, detail: oldIds.length });
    const require = createRequire(resolve(ROOT, 'package.json'));
    const { chromium, webkit, devices } = require('@playwright/test');
    const environments = [
      { name: 'chromium-pc-1366', type: chromium, touch: false, options: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } }, shots: true },
      { name: 'chromium-mobile-320', type: chromium, touch: true, options: { ...devices['Pixel 7'], viewport: { width: 320, height: 640 } }, shots: true },
      { name: 'webkit-mobile-320', type: webkit, touch: false, options: { ...devices['iPhone 13'], viewport: { width: 320, height: 640 } }, shots: false },
    ];
    for (const env of environments.filter(e => !process.env.G031_ONLY || e.name === process.env.G031_ONLY)) results.push(...await runEnvironment(env, evidence, oldIds));
  } finally {
    server.kill();
    for (let i = 0; i < 50 && await portOpen(); i++) await sleep(100);
    results.push({ env: 'run', name: `own server pid ${server.pid} stopped, ${PORT} no longer listening`, pass: !(await portOpen()) });
    await writeFile(join(evidence, 'server.log'), serverLog);
  }
  const failed = results.filter(r => !r.pass);
  await writeFile(join(evidence, 'results.json'), `${JSON.stringify({ task: 'G031-INTEGRATE', startedAt, finishedAt: new Date().toISOString(), node: process.version, build: BUILD, origin: ORIGIN, checks: results.length, failed: failed.length, results }, null, 2)}\n`);
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
    await context.exposeBinding('__g031Csp', (_s, data) => audit.csp.push(data));
    await context.exposeBinding('__g031Hold', (_s, data) => audit.holds.push(data));
    await context.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', e => window.__g031Csp({ directive: e.violatedDirective, blocked: e.blockedURI }));
      const downs = new Map();
      document.addEventListener('pointerdown', e => { const t = e.target instanceof Element ? e.target.closest('button,a') : null; if (t) downs.set(e.pointerId, { t, at: performance.now(), trusted: e.isTrusted }); }, true);
      document.addEventListener('pointerup', e => {
        const d = downs.get(e.pointerId); downs.delete(e.pointerId);
        if (d) window.__g031Hold({ target: d.t.id || d.t.className || d.t.tagName, holdMs: Math.round(performance.now() - d.at), trusted: d.trusted && e.isTrusted, pointerType: e.pointerType });
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
    const snap = () => page.evaluate(() => window.__g030Snapshot());
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const smallControls = () => page.evaluate(() => [...document.querySelectorAll('button,a')].filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 43.5 || r.height < 43.5) && getComputedStyle(n).visibility !== 'hidden'; }).map(n => `${n.id || n.className || n.tagName}:${Math.round(n.getBoundingClientRect().width)}x${Math.round(n.getBoundingClientRect().height)}`));
    const shot = async (target, name) => { if (env.shots) await target.screenshot({ path: join(evidence, `${env.name}-${name}.png`) }); };
    const cardIds = () => page.locator('.game-card').evaluateAll(nodes => nodes.map(n => n.dataset.id));
    const layout = async label => { const small = await smallControls(); const over = await overflow(); check(`${label} layout (no horizontal overflow, controls >= 44px)`, over <= 0 && small.length === 0, { overflow: over, small }); };

    // ---- Home: catalog, new cards, regression of old ids.
    const home = await page.goto('/');
    check('home HTTP 200 with strict CSP header', home.status() === 200 && home.headers()['content-security-policy'] === CSP);
    check('home catalog total 49', (await page.locator('#catalog-total').textContent()) === '49');
    check('home intro 플레이 가능 20 · 준비 중 29', (await page.locator('#intro-preview').textContent()) === '플레이 가능 20 · 준비 중 29');
    check('first page shows 12 cards', await page.locator('.game-card').count() === 12);
    for (const count of [24, 36, 48, 49]) { await press(page.locator('#load-more')); await page.waitForFunction(n => document.querySelectorAll('.game-card').length === n, count); }
    const ids = await cardIds();
    check('49 unique ids; old 47 ids kept in original order (new two only inserted)', ids.length === 49 && new Set(ids).size === 49 && JSON.stringify(ids.filter(id => !NEW_GAMES.some(g => g.id === id))) === JSON.stringify(oldIds), { ids });
    check('available 20 / upcoming 29 cards', await page.locator('.game-card.available').count() === 20 && await page.locator('.game-card.upcoming').count() === 29);
    check('upcoming 29 stay disabled buttons without links', await page.locator('.game-card.upcoming a').count() === 0 && await page.locator('.game-card.upcoming button.card-action:disabled').count() === 29);
    for (const game of NEW_GAMES) {
      const card = page.locator(`.game-card[data-id="${game.id}"]`);
      const info = { title: await card.locator('h3').textContent(), pill: await card.locator('.status-pill').textContent(), genre: await card.locator('.genre-label').textContent(), duration: await card.locator('.duration').textContent(), href: await card.locator('a.card-action').getAttribute('href'), label: await card.locator('a.card-action').getAttribute('aria-label'), svgNodes: await card.locator('.card-art svg.mini-g022 > *').count(), artHidden: await card.locator('.card-art').getAttribute('aria-hidden') };
      check(`card ${game.id}`, info.title === game.title && info.pill === '플레이 가능' && info.genre === '퍼즐' && info.duration === game.duration && info.href === `/games/${game.dir}/index.html` && info.label === `${game.title} 게임 시작` && info.svgNodes > 10 && info.artHidden === 'true', info);
      await card.scrollIntoViewIfNeeded(); await shot(card, `card-${game.id}`);
    }
    await page.locator('#game-search').fill('조약돌 하나'); check('search 조약돌 하나 -> pebble-solo only', JSON.stringify(await cardIds()) === '["pebble-solo"]');
    await page.locator('#game-search').fill('물감'); check('search 물감 -> paint-spread only', JSON.stringify(await cardIds()) === '["paint-spread"]');
    await press(page.locator('#clear-search'));
    check('home itself wrote no storage key', JSON.stringify(await storage()) === '{}');

    // ---- Favorites keep old ids and accept new ids; storage key unchanged.
    await page.evaluate(key => localStorage.setItem(key, JSON.stringify(['number-garden', 'snack-pairs'])), FAVORITES);
    await page.reload();
    check('seeded old favorites restored after reload (count 2)', (await page.locator('#favorite-count').textContent()) === '2' && await page.locator('.favorite-button[data-id="number-garden"][aria-pressed="true"]').count() === 1);
    await page.locator('#game-search').fill('물감');
    await press(page.locator('.favorite-button[data-id="paint-spread"]'));
    await press(page.locator('#clear-search'));
    const favs = JSON.parse((await storage())[FAVORITES]);
    check('new id favorite appended, old favorites intact, only the favorites key exists', JSON.stringify(favs) === '["number-garden","snack-pairs","paint-spread"]' && Object.keys(await storage()).length === 1, favs);
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
    check('home counters intact after returning', (await page.locator('#catalog-total').textContent()) === '49');
    await page.evaluate(key => localStorage.removeItem(key), FAVORITES);
    for (const dir of FIX_GAMES) {
      const detail = {};
      for (const file of GAME_FILES) {
        const r = await page.request.get(`${ORIGIN}/games/${dir}/${file}`);
        detail[file] = `${r.status()}${sha(await r.body()) === sha(await readFile(resolve(ROOT, 'public/games', dir, file))) ? '' : ' MISMATCH'}`;
      }
      check(`${dir}: 6 files HTTP 200 and byte-equal to public/ source (G031 layout fix)`, Object.values(detail).every(v => v === '200'), detail);
    }

    // ---- Game 19: 조약돌 하나.
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
    let response = page.waitForResponse(r => r.url() === `${ORIGIN}/games/19-pegs/index.html`);
    await press(page.locator('.game-card[data-id="pebble-solo"] a.card-action'));
    const r19 = await response;
    await page.waitForURL(`${ORIGIN}/games/19-pegs/index.html`);
    check('19: card click loads /games/19-pegs/index.html (200, strict CSP)', r19.status() === 200 && r19.headers()['content-security-policy'] === CSP && page.url() === `${ORIGIN}/games/19-pegs/index.html`);
    await page.waitForSelector('#start');
    await page.waitForFunction(() => typeof window.__g030Snapshot === 'function');
    await verifyFiles(NEW_GAMES[0]);
    let s = await snap();
    check('19: ready phase before explicit start (stage 1), no storage written', s.phase === 'ready' && s.readyStage === 1 && (await storage())['simplegames.pebble-solo.v1'] === undefined, { phase: s.phase, readyStage: s.readyStage });
    await layout('19 ready');
    await press(page.locator('#start'));
    await page.waitForFunction(() => window.__g030Snapshot().phase === 'playing');
    s = await snap();
    const pegsOf = cells => cells.reduce((n, v) => n + (v === 1 ? 1 : 0), 0);
    check('19: start -> playing, stage 1 on 5x5 cross, 4 pegs, no jumps yet', s.phase === 'playing' && s.stage === 1 && s.width === 5 && s.height === 5 && s.remaining === 4 && pegsOf(s.cells) === 4 && s.jumps === 0, { stage: s.stage, remaining: s.remaining, jumps: s.jumps });
    // Independent legal jump search over the snapshot board (orthogonal, distance 2, peg in the middle, empty landing).
    const jumpsOf = (cells, width, height) => {
      const found = [];
      for (let from = 0; from < cells.length; from++) {
        if (cells[from] !== 1) continue;
        const row = Math.floor(from / width), col = from % width;
        for (const [dr, dc] of [[0, -2], [0, 2], [-2, 0], [2, 0]]) {
          const r = row + dr, c = col + dc;
          if (r < 0 || c < 0 || r >= height || c >= width) continue;
          const to = r * width + c, over = (row + r) / 2 * width + (col + c) / 2;
          if (cells[to] === 0 && cells[over] === 1) found.push({ from, to, over });
        }
      }
      return found;
    };
    const legal = jumpsOf(s.cells, s.width, s.height);
    check('19: stage 1 has at least one independently found legal jump', legal.length >= 1, legal);
    // Prefer a jump that leaves the game running (the other legal jump can strand the board and end the stage with a stuck result).
    const jump = legal.find(j => { const after = s.cells.slice(); after[j.from] = 0; after[j.over] = 0; after[j.to] = 1; return jumpsOf(after, s.width, s.height).length > 0; }) ?? legal[0];
    const original = s.cells.slice();
    await press(page.locator(`.cell[data-cell="${jump.from}"]`));
    await page.waitForFunction(from => window.__g030Snapshot().selected === from, jump.from);
    s = await snap();
    check('19: trusted press on a peg selects it and offers only independently legal landing holes', s.selected === jump.from && s.targets.some(t => t.to === jump.to) && s.targets.every(t => legal.some(l => l.from === jump.from && l.to === t.to)) && s.remaining === 4, { selected: s.selected, targets: s.targets });
    await press(page.locator(`.cell[data-cell="${jump.to}"]`));
    await page.waitForFunction(() => window.__g030Snapshot().jumps === 1);
    s = await snap();
    check(`19: jump ${jump.from}->${jump.to} removes the jumped peg atomically (remaining 3)`, s.remaining === 3 && s.cells[jump.from] === 0 && s.cells[jump.over] === 0 && s.cells[jump.to] === 1 && s.selected === null && pegsOf(s.cells) === 3, { remaining: s.remaining });
    await layout('19 playing');
    await shot(page, 'game19-playing');
    await press(page.locator('#undo'));
    await page.waitForFunction(() => window.__g030Snapshot().historyLength === 0);
    s = await snap();
    check('19: undo restores the starting board, remaining 4, undo count 1', JSON.stringify(s.cells) === JSON.stringify(original) && s.remaining === 4 && s.undoCount === 1, { undoCount: s.undoCount });
    await press(page.locator('#pause'));
    await page.waitForFunction(() => window.__g030Snapshot().phase === 'paused');
    check('19: pause shows 이어서하기', await page.getByRole('button', { name: '이어서하기' }).isVisible());
    await press(page.getByRole('button', { name: '이어서하기' }));
    await page.waitForFunction(() => window.__g030Snapshot().phase === 'playing');
    check('19: resume -> playing with same board', JSON.stringify((await snap()).cells) === JSON.stringify(original));
    await press(page.locator('#pause'));
    await page.waitForFunction(() => window.__g030Snapshot().phase === 'paused');
    await press(page.locator('#home'));
    await page.waitForFunction(() => window.__g030Snapshot().modal === 'confirm-home');
    check('19: home during a run asks first (modal), no storage settlement', (await storage())['simplegames.pebble-solo.v1'] === undefined);
    await press(page.getByRole('button', { name: '게임 목록으로' }));
    await page.waitForURL(`${ORIGIN}/`);
    check('19: confirm returns to home; abandoned run left no game key', (await storage())['simplegames.pebble-solo.v1'] === undefined && (await page.locator('#catalog-total').textContent()) === '49');

    // ---- Game 20: 물감 번지기.
    await press(page.locator('#load-more'));
    response = page.waitForResponse(r => r.url() === `${ORIGIN}/games/20-flood/index.html`);
    await press(page.locator('.game-card[data-id="paint-spread"] a.card-action'));
    const r20 = await response;
    await page.waitForURL(`${ORIGIN}/games/20-flood/index.html`);
    check('20: card click loads /games/20-flood/index.html (200, strict CSP)', r20.status() === 200 && r20.headers()['content-security-policy'] === CSP && page.url() === `${ORIGIN}/games/20-flood/index.html`);
    await page.waitForSelector('#start');
    await page.waitForFunction(() => typeof window.__g030Snapshot === 'function');
    await verifyFiles(NEW_GAMES[1]);
    s = await snap();
    check('20: ready before explicit start (stage 1), no storage written', s.phase === 'ready' && s.stageId === 1 && (await storage())['simplegames.paint-spread.v1'] === undefined, { phase: s.phase, stageId: s.stageId });
    await layout('20 ready');
    await press(page.locator('#start'));
    await page.waitForFunction(() => window.__g030Snapshot().phase === 'playing');
    s = await snap();
    check('20: start -> playing, stage 1 (6x6, 3 colours, limit 7), used 0', s.phase === 'playing' && s.stageId === 1 && s.size === 6 && s.colors === 3 && s.limit === 7 && s.used === 0 && s.regionSize >= 1, { size: s.size, colors: s.colors, limit: s.limit, used: s.used });
    // Independent expectation: recolour the region, then flood from cell 0 over 4-connected cells of that colour.
    const spread = (snapshot, colour) => {
      const inside = new Set(snapshot.region);
      const colourOf = i => (inside.has(i) ? colour : snapshot.cells[i]);
      const seen = new Set([0]); const queue = [0];
      while (queue.length) {
        const i = queue.pop(), r = Math.floor(i / snapshot.size), c = i % snapshot.size;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nr = r + dr, nc = c + dc; if (nr < 0 || nc < 0 || nr >= snapshot.size || nc >= snapshot.size) continue;
          const n = nr * snapshot.size + nc; if (!seen.has(n) && colourOf(n) === colour) { seen.add(n); queue.push(n); }
        }
      }
      return [...seen].sort((a, b) => a - b);
    };
    const colour = (s.currentColor + 1) % s.colors;
    const expectedRegion = spread(s, colour);
    await press(page.locator(`.color-btn[data-color="${colour}"]`));
    await page.waitForFunction(() => window.__g030Snapshot().used === 1);
    s = await snap();
    check(`20: trusted press on colour ${colour} spreads the region exactly like an independent flood fill, used 1`, JSON.stringify([...s.region].sort((a, b) => a - b)) === JSON.stringify(expectedRegion) && s.currentColor === colour && s.used === 1 && s.remaining === 6 && s.lastEvent.kind === 'move', { region: s.region.length, expected: expectedRegion.length, used: s.used });
    const seq = s.lastEvent.seq;
    await press(page.locator(`.color-btn[data-color="${colour}"]`));
    await page.waitForFunction(n => window.__g030Snapshot().lastEvent.seq > n, seq);
    s = await snap();
    check('20: pressing the current colour again is free (used stays 1)', s.used === 1 && s.lastEvent.kind === 'same-color' && s.remaining === 6, { used: s.used, kind: s.lastEvent.kind });
    await layout('20 playing');
    await shot(page, 'game20-playing');
    const regionBeforePause = (await snap()).region.slice();
    await press(page.locator('#pause'));
    await page.waitForFunction(() => window.__g030Snapshot().phase === 'paused');
    check('20: pause shows 이어서하기', await page.getByRole('button', { name: '이어서하기' }).isVisible());
    await press(page.getByRole('button', { name: '이어서하기' }));
    await page.waitForFunction(() => window.__g030Snapshot().phase === 'playing');
    s = await snap();
    check('20: resume -> playing with same region and used 1', JSON.stringify(s.region) === JSON.stringify(regionBeforePause) && s.used === 1);
    await press(page.locator('#pause'));
    await page.waitForFunction(() => window.__g030Snapshot().phase === 'paused');
    await press(page.locator('#home'));
    await page.waitForFunction(() => window.__g030Snapshot().modal === 'home');
    check('20: home during a run asks first (modal home), no storage settlement', (await storage())['simplegames.paint-spread.v1'] === undefined);
    await press(page.getByRole('button', { name: '게임 목록으로' }));
    await page.waitForURL(`${ORIGIN}/`);
    check('20: confirm returns to home; abandoned run left no game key', (await storage())['simplegames.paint-spread.v1'] === undefined && (await page.locator('#catalog-total').textContent()) === '49');

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
  else throw new Error('Usage: node scripts/g031-verify.mjs --mode build | --mode smoke --run <evidence dir>');
} catch (error) {
  console.error(String(error?.message ?? error));
  process.exitCode = 2;
}
