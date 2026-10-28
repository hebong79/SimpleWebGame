import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, stat, copyFile } from 'node:fs/promises';
import { existsSync, appendFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { connect } from 'node:net';

const root = fileURLToPath(new URL('../', import.meta.url));
const NODE = 'C:/Program Files/nodejs/node.exe';
const BUILD = 'artifacts/g024-build';
const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i++) {
  const key = args[i];
  if (key === '--list' || key === '--units-only') { assert(!options[key], 'Duplicate option'); options[key] = true; continue; }
  assert(['--target', '--mode', '--origin'].includes(key) && args[i + 1] && !options[key], 'Usage: g024-verify.mjs --target candidate|live --mode smoke|full [--origin http://192.168.0.195:3116] [--list|--units-only]');
  options[key] = args[++i];
}
const target = options['--target'], mode = options['--mode'];
assert(['candidate', 'live'].includes(target) && ['smoke', 'full'].includes(mode), 'Explicit target/mode required');
assert(!(options['--list'] && options['--units-only']), 'List and units-only are distinct modes');
assert(!options['--units-only'] || (target === 'candidate' && mode === 'full'), 'Units-only is candidate/full only');
assert(target !== 'live' || options['--origin'] === 'http://192.168.0.195:3116', 'Live requires explicit authorized --origin');
assert(target !== 'candidate' || (!options['--origin'] && !process.env.GAME_LIVE_ORIGIN), 'Candidate must not inherit or specify live origin');
assert(target !== 'live' || !options['--units-only'], 'Live never builds or executes server unit fixtures');
assert.equal(process.version, 'v24.16.0', 'Use the contracted absolute Node executable');
const origin = target === 'live' ? options['--origin'] : 'http://127.0.0.1:3145';
const id = `${new Date().toISOString().replace(/[^0-9TZ]/g, '')}-${randomUUID().slice(0, 8)}`;
const reports = `artifacts/g024-integration/runs/${id}`;
const out = resolve(root, reports);
assert(!existsSync(out)); await mkdir(out, { recursive: true });
// Overrides are set in the PARENT before *any* test/config/launcher child starts.
const env = { ...process.env, GAME_TEST_BUILD_DIR: BUILD, GAME_TEST_ARTIFACT_DIR: reports,
  GAME_G024_TARGET: target, GAME_G024_MODE: mode, GAME_G024_ORIGIN: origin,
  GAME_LIVE_ORIGIN: target === 'live' ? origin : '', GAME_G024_LIST: '0' };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = (name, value) => writeFile(join(out, name), `${JSON.stringify(value, null, 2)}\n`);
const meta = { task: 'G024-SHARED', root, target, mode, origin, build: BUILD, reports,
  node: process.execPath, version: process.version, listOnly: !!options['--list'], unitsOnly: !!options['--units-only'],
  envBeforeChild: Object.fromEntries(Object.entries(env).filter(([k]) => k.startsWith('GAME_'))),
  commands: [], independentAcceptance: false, liveServerLifecycleActions: false };
let server, historical, failure;
async function files(dir) {
  const entries = await readdir(resolve(root, dir), { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]))).flat().sort();
}
async function hashes(paths, metadata = false) {
  const result = {};
  for (const path of paths) {
    const bytes = await readFile(resolve(root, path));
    const s = await stat(resolve(root, path));
    result[path] = metadata ? { sha256: sha(bytes), size: s.size, mtimeMs: s.mtimeMs } : sha(bytes);
  }
  return result;
}
async function command(label, executable, argv, cwd = root, childEnv = env) {
  const entry = { label, executable, argv, cwd, started: new Date().toISOString() };
  meta.commands.push(entry); await json('invocation.json', meta);
  const stdoutPath = join(out, `${label}.stdout.log`), stderrPath = join(out, `${label}.stderr.log`);
  writeFileSync(stdoutPath, ''); writeFileSync(stderrPath, '');
  console.log(`[${label}] started; streaming raw evidence to ${reports}`);
  const result = await new Promise((accept, reject) => {
    const child = spawn(executable, argv, { cwd, env: childEnv, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', b => { stdout += b; appendFileSync(stdoutPath, b); });
    child.stderr.on('data', b => { stderr += b; appendFileSync(stderrPath, b); });
    child.on('error', reject); child.on('close', (code, signal) => accept({ code, signal, stdout, stderr }));
  });
  await writeFile(join(out, `${label}.stdout.log`), result.stdout); await writeFile(join(out, `${label}.stderr.log`), result.stderr);
  Object.assign(entry, { exitCode: result.code, signal: result.signal, ended: new Date().toISOString() });
  await json('invocation.json', meta);
  process.stdout.write(`[${label}] exit=${result.code}\n`);
  if (result.code !== 0) { process.stderr.write(result.stdout + result.stderr); throw new Error(`${label} failed (${result.code})`); }
  return result;
}
function tap(text) {
  const n = name => { const m = text.match(new RegExp(`^# ${name} (\\d+)\\s*$`, 'm')); assert(m, `Missing TAP ${name}`); return Number(m[1]); };
  const result = { tests: n('tests'), passed: n('pass'), failed: n('fail'), skipped: n('skipped'), todo: n('todo') };
  assert.equal(result.failed + result.skipped + result.todo, 0); assert.equal(result.tests, result.passed); return result;
}
function collected(data) {
  return data.suites.reduce((sum, s) => sum + walk(s), 0);
  function walk(s) { return (s.specs ?? []).reduce((n, p) => n + p.tests.length, 0) + (s.suites ?? []).reduce((n, p) => n + walk(p), 0); }
}
async function refused() {
  return new Promise((accept, reject) => {
    const socket = connect({ host: '127.0.0.1', port: 3145 });
    socket.once('connect', () => { socket.destroy(); reject(new Error('Port3145 is occupied; refusing to reuse or stop it')); });
    socket.once('error', e => e.code === 'ECONNREFUSED' ? accept(true) : reject(e));
    socket.setTimeout(3000, () => { socket.destroy(); reject(new Error('Port3145 refusal check timed out')); });
  });
}
async function units() {
  const compiler = resolve(root, 'node_modules/typescript/bin/tsc');
  await command('typecheck', NODE, [compiler, '--noEmit']);
  const base = await command('unit-common', NODE, ['--test', '--test-reporter=tap', ...(await files(`${BUILD}/tests/unit`)).filter(p => p.endsWith('.test.js'))]);
  const games = await command('unit-games', NODE, ['--test', '--test-reporter=tap', ...(await files('tests/games')).filter(p => p.endsWith('.test.mjs'))]);
  // Original launcher hardwrites artifacts/g017-builder. Execute unchanged bytes in a fresh snapshot instead.
  const snapshot = join(out, 'launcher-snapshot'), proof = [];
  for (const path of ['tests/launch-local.test.mjs', 'scripts/serve_local.mjs', 'package.json']) {
    const dest = join(snapshot, path); await mkdir(dirname(dest), { recursive: true }); await copyFile(resolve(root, path), dest);
    const source = sha(await readFile(resolve(root, path))), copy = sha(await readFile(dest)); assert.equal(copy, source);
    proof.push({ path, sourceSha256: source, snapshotSha256: copy });
  }
  await json('launcher-same-byte-snapshot.json', proof);
  const launcher = await command('unit-launcher', NODE, ['--test', '--test-reporter=tap', 'tests/launch-local.test.mjs'], snapshot);
  const counts = { common: tap(base.stdout), games: tap(games.stdout), launcher: tap(launcher.stdout) };
  counts.total = Object.values(counts).reduce((sum, v) => sum + v.tests, 0);
  await json('unit-summary.json', counts); meta.unitSummary = counts;
}
async function httpBytes() {
  const { CSP } = await import(pathToFileURL(resolve(root, BUILD, 'src/server/index.js')).href);
  const observations = [];
  try {
    for (const path of (await files(`${BUILD}/public`)).filter(p => ['.html', '.js', '.mjs', '.css', '.svg', '.png', '.webp', '.ico'].includes(extname(p)))) {
      const route = path.slice(`${BUILD}/public`.length), expected = await readFile(resolve(root, path));
      const response = await fetch(`${origin}${route}`, { redirect: 'error', signal: AbortSignal.timeout(10000) });
      const actual = Buffer.from(await response.arrayBuffer());
      observations.push({ route, status: response.status, expectedSha256: sha(expected), responseSha256: sha(actual), bytes: actual.length, csp: response.headers.get('content-security-policy') });
      assert.equal(response.status, 200, route); assert.equal(response.headers.get('content-security-policy'), CSP, route);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff', route); assert.deepEqual(actual, expected, route);
    }
  } finally { await json('http-bytecheck.json', observations); }
  meta.httpBytecheck = { verified: observations.length, failed: 0 };
}
async function browsers() {
  const cli = resolve(root, 'node_modules/@playwright/test/cli.js');
  const cmd = [resolve(root, 'artifacts/g024-integration/browser-gate.py'), NODE, cli, 'test', '--config', resolve(root, 'tests/g024-playwright.config.ts')];
  await command('browser-discovery', 'python', [...cmd, '--list'], root, { ...env, GAME_G024_LIST: '1' });
  const discovery = JSON.parse(await readFile(join(out, 'discovery.json'), 'utf8'));
  meta.discovered = collected(discovery); assert(meta.discovered > 0); await json('invocation.json', meta);
  if (options['--list']) { meta.status = 'discovery_only_not_executed'; return; }
  let result;
  try { await command('browser-execution', 'python', cmd); }
  finally {
    if (existsSync(join(out, 'playwright-results.json'))) {
      result = JSON.parse(await readFile(join(out, 'playwright-results.json'), 'utf8'));
      meta.browserStats = result.stats;
    }
  }
  assert.equal(result.errors.length, 0); assert.equal(result.stats.unexpected + result.stats.skipped + result.stats.flaky, 0);
  assert.equal(result.stats.expected, meta.discovered); meta.status = 'passed';
}
try {
  const protectedPaths = (await files('artifacts')).filter(p => !p.startsWith('artifacts/g024-integration/') && !p.startsWith(`${BUILD}/`));
  historical = await hashes(protectedPaths, true); await json('historical-before.json', historical);
  const runtimePaths = [...await files('src'), ...await files('public'), 'scripts/build.mjs', 'tsconfig.json', 'package.json', 'package-lock.json'];
  const source = await hashes(runtimePaths); await json('runtime-source-sha256.json', source);
  const own = ['src/client/library.ts', 'package.json', 'ecosystem.config.cjs', 'scripts/g024-verify.mjs', 'tests/g024-playwright.config.ts', 'artifacts/g024-integration/browser-gate.py',
    ...['g024-new-games', 'library-integration', 'multi-game-integration', 'breakout-integration', 'runner-jumper', 'live-server', 'flappy-input'].map(n => `tests/e2e/${n}.spec.ts`)];
  await json('verification-input-sha256.json', await hashes(own));
  const manifestPath = resolve(root, BUILD, 'g024-build-manifest.json');
  if (!existsSync(resolve(root, BUILD))) {
    assert(target === 'candidate' && !options['--list'], 'BLOCKED: expected fresh G024 build is missing; live/list never builds');
    await command('build', NODE, ['scripts/build.mjs', '--out-dir', BUILD]);
    assert.deepEqual(await hashes(runtimePaths), source, 'Runtime changed during build');
    const output = await hashes(await files(BUILD));
    await writeFile(manifestPath, `${JSON.stringify({ source, output }, null, 2)}\n`);
  }
  assert(existsSync(manifestPath), 'BLOCKED: build manifest missing; do not silently reuse an unverified build');
  const buildManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.deepEqual(source, buildManifest.source, 'BLOCKED: build/source mismatch');
  assert.deepEqual(await hashes((await files(BUILD)).filter(p => p !== `${BUILD}/g024-build-manifest.json`)), buildManifest.output, 'BLOCKED: build bytes changed');
  if (options['--units-only']) { await units(); meta.status = 'units_passed_browser_not_executed'; }
  else if (options['--list']) await browsers();
  else {
    if (target === 'candidate') {
      await refused();
      const { createGameServer } = await import(pathToFileURL(resolve(root, BUILD, 'src/server/index.js')).href);
      server = createGameServer(resolve(root, BUILD, 'public'));
      await new Promise((accept, reject) => { server.once('error', reject); server.listen(3145, '127.0.0.1', accept); });
      meta.candidateServer = { owned: true, host: '127.0.0.1', port: 3145 };
    }
    await httpBytes(); // before any browser, and before full regressions
    await browsers();
    if (target === 'candidate' && mode === 'full') await units();
  }
} catch (error) {
  failure = error; meta.status = 'failed_or_blocked'; meta.error = error.stack ?? String(error); console.error(meta.error); process.exitCode = 1;
} finally {
  if (server) {
    await new Promise((accept, reject) => { server.close(e => e ? reject(e) : accept()); server.closeAllConnections(); });
    await refused(); meta.candidateServer.stoppedAndRefused = true;
  }
  if (historical) {
    const afterPaths = (await files('artifacts')).filter(p => !p.startsWith('artifacts/g024-integration/') && !p.startsWith(`${BUILD}/`));
    const after = await hashes(afterPaths, true); await json('historical-after.json', after);
    try { assert.deepEqual(after, historical); meta.historicalPreserved = { files: Object.keys(after).length, bytesAndMtime: true }; }
    catch (error) { meta.historicalPreserved = false; meta.preservationError = error.message; process.exitCode = 1; }
  }
  meta.finished = new Date().toISOString(); await json('invocation.json', meta);
  console.log(JSON.stringify({ reports, status: meta.status, discovered: meta.discovered, browser: meta.browserStats, units: meta.unitSummary, http: meta.httpBytecheck, historicalPreserved: meta.historicalPreserved, server: meta.candidateServer }, null, 2));
}
