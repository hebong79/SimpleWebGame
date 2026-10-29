import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, lstat, realpath, copyFile } from 'node:fs/promises';
import { existsSync, appendFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname, relative, isAbsolute, sep, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { connect } from 'node:net';

export const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
export const NODE = 'C:/Program Files/nodejs/node.exe';
export const BUILD = 'artifacts/g025-build';
export const MANIFEST = `${BUILD}/g025-build-manifest.json`;
export const GATE = 'Local\\SimpleGamesG025BrowserGate';
export const SPECS = ['live-server', 'library-integration', 'multi-game-integration', 'breakout-integration', 'runner-jumper', 'flappy-input', 'g024-new-games', 'g025-new-games'].map(n => `${n}.spec.ts`);
const hash = b => createHash('sha256').update(b).digest('hex');
class Blocked extends Error { constructor(message, details = []) { super(`BLOCKED: ${message}`); this.details = details; } }
const need = (condition, message, details) => { if (!condition) throw new Blocked(message, details); };
const inside = (base, path) => { const r = relative(base, path); return r !== '..' && !r.startsWith(`..${sep}`) && !isAbsolute(r); };

// No writable symlinks/junctions, even if their real target happens to be inside root.
// node_modules is never traversed or written; it is an explicitly read-only dependency junction.
export async function guarded(root, path) {
  const base = resolve(root), target = resolve(base, path);
  need(inside(base, target), `path escapes root: ${path}`);
  const parts = relative(base, target).split(sep).filter(Boolean);
  let current = base;
  for (const part of parts) {
    current = join(current, part);
    try {
      const s = await lstat(current);
      need(!s.isSymbolicLink(), `symlink/junction forbidden: ${current}`);
      need(inside(base, await realpath(current)), `realpath escapes root: ${current}`);
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return target;
}
async function files(root, path) {
  const target = await guarded(root, path);
  if (!existsSync(target)) return [];
  const result = [];
  for (const e of await readdir(target, { withFileTypes: true })) {
    const p = `${path}/${e.name}`;
    await guarded(root, p);
    if (e.isDirectory()) result.push(...await files(root, p));
    else { need(e.isFile(), `nonregular file: ${p}`); result.push(p); }
  }
  return result.sort();
}
async function hashes(root, paths, metadata = false) {
  const result = {};
  for (const p of [...new Set(paths)].sort()) {
    const target = await guarded(root, p), s = await lstat(target, { bigint: true });
    need(s.isFile(), `regular file required: ${p}`);
    const sha256 = hash(await readFile(target));
    result[p] = metadata ? { sha256, size: Number(s.size), mtimeNs: String(s.mtimeNs) } : sha256;
  }
  return result;
}
export async function prerequisites(root = ROOT) {
  const missing = [];
  for (const game of ['11-mines', '12-fifteen']) {
    for (const name of ['index.html', 'styles.css', 'engine.mjs', 'save.mjs', 'main.mjs']) {
      const p = `public/games/${game}/${name}`, target = await guarded(root, p);
      if (!existsSync(target) || !(await lstat(target)).isFile() || !(await readFile(target, 'utf8')).trim()) missing.push(p);
    }
    const p = `tests/games/${game}.test.mjs`, target = await guarded(root, p);
    if (!existsSync(target) || !(await lstat(target)).isFile() || !(await readFile(target, 'utf8')).trim()) missing.push(p);
  }
  need(missing.length === 0, 'required 11/12 game implementation and dedicated tests are missing/empty; no browser/build may start', missing);
  // These are minimum intake contracts, not a proof of gameplay completion.
  for (const game of ['11-mines', '12-fifteen']) {
    const html = await readFile(resolve(root, `public/games/${game}/index.html`), 'utf8');
    const main = await readFile(resolve(root, `public/games/${game}/main.mjs`), 'utf8');
    const test = await readFile(resolve(root, `tests/games/${game}.test.mjs`), 'utf8');
    need(/<script\b[^>]*type=["']module["'][^>]*src=["'](?:\.\/)?main\.mjs["']/.test(html), `${game}: local module entry contract missing`);
    need(main.includes('__g025Snapshot'), `${game}: read-only __g025Snapshot intake contract missing`);
    need(test.includes('node:test') && test.includes(`/games/${game}/`) && /\btest\s*\(/.test(test), `${game}: dedicated executable engine tests missing`);
    need(!/\b(?:test|it)\.(?:skip|todo)\s*\(/.test(test), `${game}: skipped/todo tests are not completed prerequisites`);
  }
}
async function sources(root) {
  return hashes(root, [...await files(root, 'src'), ...await files(root, 'public'), ...await files(root, 'tests'), ...await files(root, 'scripts'), ...await files(root, 'docs/g022-design'),
    'package.json', 'package-lock.json', 'tsconfig.json', 'ecosystem.config.cjs', 'artifacts/g025-integration/browser-gate.py',
    'docs/G025_PM_CONTRACT.md', 'docs/G025_11_DESIGN.md', 'docs/G025_12_DESIGN.md', 'docs/G025_DESIGN_DECISIONS.md', 'docs/G025_DESIGN_BOARD.html']);
}
export async function assertReady(root = ROOT) {
  await prerequisites(root);
  need(process.version === 'v24.16.0' && resolve(process.execPath).toLowerCase() === resolve(NODE).toLowerCase(), 'contracted absolute Node required');
  for (const [pkg, version] of [['typescript', '7.0.2'], ['@playwright/test', '1.64.1']]) need(JSON.parse(await readFile(resolve(root, `node_modules/${pkg}/package.json`), 'utf8')).version === version, `installed ${pkg} differs from contract`);
  return verifyManifest(root);
}
export async function verifyManifest(root = ROOT) {
  const manifestPath = await guarded(root, MANIFEST);
  need(existsSync(manifestPath), 'fresh G025 build manifest missing; run explicit candidate/build after game intake');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  need(manifest.schema === 1 && manifest.task === 'G025' && manifest.root === resolve(root) && typeof manifest.buildId === 'string' && manifest.nodeVersion === 'v24.16.0', 'invalid manifest provenance');
  const source = await sources(root);
  try { assert.deepEqual(source, manifest.source); } catch { throw new Blocked('build/source SHA mismatch; preserve old build and request a fresh build'); }
  const paths = (await files(root, BUILD)).filter(p => p !== MANIFEST);
  try { assert.deepEqual(await hashes(root, paths), manifest.output); } catch { throw new Blocked('build/output SHA mismatch'); }
  for (const p of ['src/server/index.js', 'public/scripts/library.js', 'public/games/11-mines/index.html', 'public/games/12-fifteen/index.html']) need(existsSync(resolve(root, BUILD, p)), `compiled output missing: ${p}`);
  return manifest;
}
function parse(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!['--target', '--mode', '--origin', '--list', '--units-only'].includes(key) || Object.hasOwn(options, key)) throw new Error(`Unknown/duplicate option: ${key}`);
    if (key === '--list' || key === '--units-only') options[key] = true;
    else { if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value: ${key}`); options[key] = args[++i]; }
  }
  const target = options['--target'], mode = options['--mode'];
  assert(['candidate', 'live'].includes(target) && ['build', 'smoke', 'full'].includes(mode), 'Explicit --target candidate|live --mode build|smoke|full required');
  assert(!(options['--list'] && options['--units-only']), '--list is discovery only, not units/execution');
  assert(!options['--units-only'] || (target === 'candidate' && mode === 'full'), 'units-only is candidate/full only');
  assert(target !== 'live' || (mode !== 'build' && options['--origin'] === 'http://192.168.0.195:3116'), 'live requires the exact explicitly authorized LAN origin and never builds');
  assert(target !== 'candidate' || (!Object.hasOwn(options, '--origin') && !process.env.GAME_LIVE_ORIGIN && !process.env.GAME_G025_ORIGIN), 'candidate must not inherit/specify an origin');
  assert(mode !== 'build' || (!options['--list'] && !options['--units-only']), 'build is not discovery/units');
  return { options, target, mode };
}
function tap(text) {
  const n = name => { const m = text.match(new RegExp(`^# ${name} (\\d+)\\s*$`, 'm')); assert(m, `Missing TAP ${name}`); return Number(m[1]); };
  const result = { tests: n('tests'), passed: n('pass'), failed: n('fail'), skipped: n('skipped'), todo: n('todo') };
  assert(result.tests > 0); assert.equal(result.failed + result.skipped + result.todo, 0); assert.equal(result.tests, result.passed);
  return result;
}
function collected(data) {
  const walk = s => (s.specs ?? []).reduce((n, p) => n + p.tests.length, 0) + (s.suites ?? []).reduce((n, p) => n + walk(p), 0);
  return data.suites.reduce((n, s) => n + walk(s), 0);
}
async function refused() {
  await new Promise((accept, reject) => {
    const socket = connect({ host: '127.0.0.1', port: 3155 });
    socket.once('connect', () => { socket.destroy(); reject(new Blocked('3155 occupied; never reuse/stop a foreign process')); });
    socket.once('error', e => e.code === 'ECONNREFUSED' ? accept() : reject(e));
    socket.setTimeout(3000, () => { socket.destroy(); reject(new Error('3155 refusal check timed out')); });
  });
}
export async function main(args = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parse(args);
    assert.equal(resolve(process.execPath).toLowerCase(), resolve(NODE).toLowerCase(), 'Use C:/Program Files/nodejs/node.exe');
    assert.equal(process.version, 'v24.16.0');
  } catch (e) { console.error(`INVALID_INVOCATION: ${e.message}`); process.exitCode = 64; return; }
  const { options, target, mode } = parsed;
  const origin = target === 'candidate' ? 'http://127.0.0.1:3155' : options['--origin'];
  const id = `${new Date().toISOString().replace(/[^0-9TZ]/g, '')}-${randomUUID()}`;
  const reports = `artifacts/g025-integration/runs/${id}`, out = await guarded(ROOT, reports);
  need(!existsSync(out), 'report collision'); await mkdir(out, { recursive: true });
  const json = (name, value) => writeFile(join(out, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'w' });
  const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GAME_')));
  const env = { ...clean, TEMP: 'C:/Users/hebon/AppData/Local/hermes/cache/scratch', TMP: 'C:/Users/hebon/AppData/Local/hermes/cache/scratch',
    GAME_TEST_BUILD_DIR: BUILD, GAME_TEST_ARTIFACT_DIR: reports, GAME_G025_TARGET: target, GAME_G025_MODE: mode, GAME_G025_ORIGIN: origin,
    GAME_LIVE_ORIGIN: target === 'live' ? origin : '', GAME_G025_LIST: options['--list'] ? '1' : '0' };
  const meta = { task: 'G025-SHARED', root: ROOT, runId: id, target, mode, origin, build: BUILD, reports, node: process.execPath, nodeVersion: process.version,
    listOnly: !!options['--list'], unitsOnly: !!options['--units-only'], commands: [], browserExecuted: 0, discovered: 0, unitExecuted: 0,
    independentAcceptance: false, liveServerLifecycleActions: false, envBeforeChild: Object.fromEntries(Object.entries(env).filter(([k]) => k.startsWith('GAME_'))) };
  let historical, beforeSource, server, createdBuild = false;
  async function command(label, executable, argv, cwd = ROOT, extra = {}, allowFailure = false) {
    const childId = `${label}-${randomUUID()}`, report = `${reports}/children/${childId}`;
    const childOut = await guarded(ROOT, report); await mkdir(childOut, { recursive: true });
    // Parent overrides precede every child, including compiler, launcher and discovery.
    const childEnv = { ...env, GAME_TEST_ARTIFACT_DIR: report, ...extra };
    const entry = { label, childId, executable, argv, cwd, reports: report, started: new Date().toISOString() };
    meta.commands.push(entry); await json('invocation.json', meta);
    const stdoutPath = join(childOut, 'stdout.log'), stderrPath = join(childOut, 'stderr.log');
    writeFileSync(stdoutPath, ''); writeFileSync(stderrPath, '');
    console.log(`[${label}] ${report}`);
    const result = await new Promise((accept, reject) => {
      const child = spawn(executable, argv, { cwd, env: childEnv, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      child.stdout.on('data', b => { stdout += b; appendFileSync(stdoutPath, b); process.stdout.write(b); });
      child.stderr.on('data', b => { stderr += b; appendFileSync(stderrPath, b); process.stderr.write(b); });
      child.once('error', reject); child.once('close', (code, signal) => accept({ code, signal, stdout, stderr }));
    });
    Object.assign(entry, { exitCode: result.code, signal: result.signal, ended: new Date().toISOString() }); await json('invocation.json', meta);
    if (!allowFailure) assert.equal(result.code, 0, `${label} failed; raw output is immutable in ${report}`);
    return { ...result, report, childOut };
  }
  async function outputAudit() {
    const audit = [];
    for (const p of await files(ROOT, 'tests')) {
      if (!/\.(?:ts|mjs)$/.test(p)) continue;
      const lines = (await readFile(resolve(ROOT, p), 'utf8')).split(/\r?\n/);
      const selected = p.startsWith('tests/e2e/') && SPECS.includes(p.slice('tests/e2e/'.length));
      const matches = lines.flatMap((text, i) => /artifacts[\\/]|ARTIFACT|writeFile|screenshot\(|outputPath|\.attach\(/.test(text) ? [{ line: i + 1, text }] : []);
      audit.push({ path: p, selected, policy: p === 'tests/launch-local.test.mjs' ? 'unchanged-byte snapshot only; fixed g017 paths remain inside snapshot' : selected ? 'fresh child environment + TestInfo outputPath/attach' : 'not selected for G025 browser execution', matches });
      if (selected) need(!matches.some(m => /["'`]artifacts[\\/]/.test(m.text) && !/GAME_TEST_ARTIFACT_DIR/.test(m.text)), `unredirected legacy artifact path in selected spec ${p}`);
    }
    await json('legacy-output-audit.json', audit);
  }
  async function units() {
    const base = await command('unit-common', NODE, ['--test', '--test-reporter=tap', ...(await files(ROOT, `${BUILD}/tests/unit`)).filter(p => p.endsWith('.test.js'))]);
    const games = await command('unit-games', NODE, ['--test', '--test-reporter=tap', ...(await files(ROOT, 'tests/games')).filter(p => p.endsWith('.test.mjs'))]);
    const snapshot = join(out, 'l'), proof = []; // The run UUID isolates this short Windows fixture cwd.
    for (const path of ['tests/launch-local.test.mjs', 'scripts/serve_local.mjs', 'package.json']) {
      const dest = join(snapshot, path); await mkdir(dirname(dest), { recursive: true }); await copyFile(resolve(ROOT, path), dest);
      const source = hash(await readFile(resolve(ROOT, path))), copy = hash(await readFile(dest)); assert.equal(copy, source);
      proof.push({ physicalSource: resolve(ROOT, path), physicalSnapshot: dest, sourceSha256: source, snapshotSha256: copy });
    }
    await json('launcher-same-byte-snapshot.json', proof);
    const launcher = await command('unit-launcher', NODE, ['--test', '--test-reporter=tap', 'tests/launch-local.test.mjs'], snapshot);
    const counts = { common: tap(base.stdout), games: tap(games.stdout), launcher: tap(launcher.stdout) };
    counts.total = Object.values(counts).reduce((n, v) => n + v.tests, 0);
    meta.unitExecuted = counts.total; meta.unitSummary = counts; await json('unit-summary.json', counts);
  }
  async function httpBytes() {
    const { CSP } = await import(pathToFileURL(resolve(ROOT, BUILD, 'src/server/index.js')).href);
    const observations = [], notPublic = [];
    try {
      for (const p of await files(ROOT, `${BUILD}/public`)) {
        if (!['.html', '.js', '.mjs', '.css', '.svg', '.png', '.webp', '.ico'].includes(extname(p))) { notPublic.push(p); continue; }
        const route = p.slice(`${BUILD}/public`.length), expected = await readFile(resolve(ROOT, p));
        const response = await fetch(`${origin}${route}`, { redirect: 'error', signal: AbortSignal.timeout(10000) });
        const actual = Buffer.from(await response.arrayBuffer());
        observations.push({ route, method: 'GET', status: response.status, expectedSha256: hash(expected), responseSha256: hash(actual), bytes: actual.length, csp: response.headers.get('content-security-policy') });
        assert.equal(response.status, 200, route); assert.equal(response.headers.get('content-security-policy'), CSP, route);
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff', route); assert.deepEqual(actual, expected, route);
      }
    } finally { await json('http-bytecheck.json', { observations, notPublic, note: 'source maps/unknown MIME are output-hashed but not publicly served by the existing server' }); }
    meta.httpBytecheck = { verified: observations.length, failed: 0 };
  }
  try {
    historical = await hashes(ROOT, (await files(ROOT, 'artifacts')).filter(p => !p.startsWith(`${reports}/`)), true);
    await json('historical-before.json', historical);
    beforeSource = await sources(ROOT); await json('source-sha256.json', beforeSource);
    await outputAudit();
    await prerequisites(ROOT); // Before compiler/build/server/Playwright children.
    const versions = JSON.parse(await readFile(resolve(ROOT, 'node_modules/typescript/package.json'), 'utf8'));
    const pw = JSON.parse(await readFile(resolve(ROOT, 'node_modules/@playwright/test/package.json'), 'utf8'));
    need(versions.version === '7.0.2' && pw.version === '1.64.1', 'installed toolchain differs from contracted versions');
    meta.toolchain = { typescript: versions.version, playwright: pw.version };
    if (mode === 'build') {
      await guarded(ROOT, BUILD); need(!existsSync(resolve(ROOT, BUILD)), 'g025-build already exists; never overwrite/auto-rename evidence; PM must preserve the old build explicitly');
      createdBuild = true;
      await command('typecheck', NODE, [resolve(ROOT, 'node_modules/typescript/bin/tsc'), '--noEmit']);
      for (const game of ['11-mines', '12-fifteen']) {
        for (const p of (await files(ROOT, `public/games/${game}`)).filter(p => p.endsWith('.mjs'))) await command(`syntax-${game}-${p.split('/').at(-1)}`, NODE, ['--check', p]);
        await command(`syntax-test-${game}`, NODE, ['--check', `tests/games/${game}.test.mjs`]);
      }
      await command('build', NODE, ['scripts/build.mjs', '--out-dir', BUILD]);
      assert.deepEqual(await sources(ROOT), beforeSource, 'source changed during build');
      const manifest = { schema: 1, task: 'G025', root: ROOT, buildId: randomUUID(), created: new Date().toISOString(), nodeVersion: process.version,
        toolchain: meta.toolchain, source: beforeSource, output: await hashes(ROOT, await files(ROOT, BUILD)) };
      await writeFile(resolve(ROOT, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
      await assertReady(ROOT); meta.status = 'build_created_gameplay_not_executed'; meta.buildId = manifest.buildId;
    } else {
      const manifest = await assertReady(ROOT); meta.buildId = manifest.buildId; meta.manifestSha256 = hash(await readFile(resolve(ROOT, MANIFEST)));
      if (options['--units-only']) { await units(); meta.status = 'unit_execution_passed_browser_not_executed'; }
      else {
        if (!options['--list']) {
          if (target === 'candidate') {
            await refused(); const { createGameServer } = await import(pathToFileURL(resolve(ROOT, BUILD, 'src/server/index.js')).href);
            server = createGameServer(resolve(ROOT, BUILD, 'public'));
            await new Promise((accept, reject) => { server.once('error', reject); server.listen(3155, '127.0.0.1', accept); });
            meta.candidateServer = { owned: true, host: '127.0.0.1', port: 3155 };
          }
          await httpBytes();
        }
        // One Python HANDLE is held over discovery AND actual browser execution.
        const run = await command('browser-session', 'python', [resolve(ROOT, 'artifacts/g025-integration/browser-gate.py'), NODE,
          resolve(ROOT, 'node_modules/@playwright/test/cli.js'), resolve(ROOT, 'tests/g025-playwright.config.ts')], ROOT, {}, true);
        const session = JSON.parse(await readFile(join(run.childOut, 'browser-session.json'), 'utf8'));
        const discovery = JSON.parse(await readFile(resolve(ROOT, session.discovery, 'discovery.json'), 'utf8'));
        meta.discovered = collected(discovery); assert(meta.discovered > 0); assert.equal(discovery.errors.length, 0);
        if (options['--list']) { assert.equal(run.code, 0, 'discovery child failed'); meta.status = 'discovery_only_not_executed'; }
        else {
          const result = JSON.parse(await readFile(resolve(ROOT, session.execution, 'playwright-results.json'), 'utf8'));
          meta.browserStats = result.stats;
          const walk = suite => [...(suite.specs ?? []).flatMap(s => s.tests), ...(suite.suites ?? []).flatMap(walk)];
          const tests = result.suites.flatMap(walk);
          meta.browserExecuted = tests.filter(t => t.results.some(r => r.status !== 'skipped')).length;
          assert.equal(run.code, 0, 'browser child failed; retain raw failure results without retry');
          assert.equal(result.errors.length, 0); assert.equal(result.stats.unexpected + result.stats.skipped + result.stats.flaky, 0);
          assert.equal(result.stats.expected, meta.discovered); assert.equal(meta.browserExecuted, meta.discovered);
          if (target === 'candidate' && mode === 'full') await units();
          meta.status = 'execution_passed';
        }
      }
    }
  } catch (e) {
    meta.status = e instanceof Blocked ? 'BLOCKED' : 'FAILED'; meta.error = e.stack ?? String(e); meta.blockers = e.details ?? [];
    process.exitCode = e instanceof Blocked ? 2 : 1; console.error(meta.error); if (meta.blockers.length) console.error(JSON.stringify(meta.blockers));
  } finally {
    try {
      if (server) {
        await new Promise((accept, reject) => { server.close(e => e ? reject(e) : accept()); server.closeAllConnections(); });
        await refused(); if (meta.candidateServer) meta.candidateServer.stoppedAndRefused = true;
      }
      if (beforeSource) assert.deepEqual(await sources(ROOT), beforeSource, 'verification changed/fell behind source bytes');
      if (historical) {
        const after = await hashes(ROOT, (await files(ROOT, 'artifacts')).filter(p => !p.startsWith(`${reports}/`) && !(createdBuild && p.startsWith(`${BUILD}/`))), true);
        await json('historical-after.json', after); assert.deepEqual(after, historical, 'historical artifact SHA/size/mtime changed');
        meta.historicalPreserved = { files: Object.keys(after).length, shaSizeMtime: true };
      }
    } catch (e) { meta.status = 'FAILED_PRESERVATION_OR_CLEANUP'; meta.finalizationError = e.stack ?? String(e); process.exitCode = 1; }
    meta.finished = new Date().toISOString(); await json('invocation.json', meta);
    console.log(JSON.stringify({ reports, status: meta.status, discovered: meta.discovered, browserExecuted: meta.browserExecuted, unitExecuted: meta.unitExecuted,
      browser: meta.browserStats, historicalPreserved: meta.historicalPreserved, blockers: meta.blockers }, null, 2));
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
