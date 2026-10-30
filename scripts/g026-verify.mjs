import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, lstat, realpath, copyFile } from 'node:fs/promises';
import { existsSync, appendFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname, relative, isAbsolute, sep, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { connect } from 'node:net';
import { createRequire } from 'node:module';

export const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
export const NODE = 'C:/Program Files/nodejs/node.exe';
export const ORIGIN = 'http://127.0.0.1:3171';
export const GATE = 'Local\\SimpleGamesG026BrowserGate';
export const SPECS = ['live-server', 'library-integration', 'multi-game-integration', 'breakout-integration', 'runner-jumper', 'flappy-input', 'g024-new-games', 'g025-new-games', 'g026-new-games'].map(n => `${n}.spec.ts`);
const INPUT_DOCS = ['docs/20261030-130251_G026_PM_CONTRACT_PREV.md', 'docs/13-memory/20261030-130251_G026_13_DESIGN.md', 'docs/14-tic-tac-toe/20261030-130251_G026_14_DESIGN.md', 'docs/20261030-130251_G026_ACCEPTANCE.md', 'docs/13-memory/20261030-130251_G026_13_IMPLEMENTATION_PREV.md', 'docs/14-tic-tac-toe/20261030-130251_G026_14_IMPLEMENTATION_PREV.md'];
const hash = b => createHash('sha256').update(b).digest('hex');
class Blocked extends Error { constructor(message, details = []) { super(`BLOCKED: ${message}`); this.details = details; } }
const need = (condition, message, details) => { if (!condition) throw new Blocked(message, details); };
const inside = (base, path) => { const r = relative(base, path); return r !== '..' && !r.startsWith(`..${sep}`) && !isAbsolute(r); };
export async function guarded(root, path) {
  const base = resolve(root), target = resolve(base, path);
  need(inside(base, target), `path escapes root: ${path}`);
  let current = base;
  for (const part of relative(base, target).split(sep).filter(Boolean)) {
    current = join(current, part);
    try {
      need(!(await lstat(current)).isSymbolicLink(), `writable junction/symlink forbidden: ${current}`);
      need(inside(base, await realpath(current)), `realpath escapes root: ${current}`);
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return target;
}
async function files(root, path, exclude = () => false) {
  if (exclude(path)) return [];
  const target = await guarded(root, path);
  if (!existsSync(target)) return [];
  const result = [];
  for (const e of await readdir(target, { withFileTypes: true })) {
    const p = `${path}/${e.name}`; if (exclude(p)) continue; await guarded(root, p);
    if (e.isDirectory()) result.push(...await files(root, p, exclude));
    else { need(e.isFile(), `nonregular input: ${p}`); result.push(p); }
  }
  return result.sort();
}
async function hashes(root, paths, metadata = false) {
  const result = {};
  for (const p of [...new Set(paths)].sort()) {
    const target = await guarded(root, p), s = await lstat(target, { bigint: true });
    need(s.isFile(), `regular file required: ${p}`);
    result[p] = metadata ? { sha256: hash(await readFile(target)), size: Number(s.size), mtimeNs: String(s.mtimeNs) } : hash(await readFile(target));
  }
  return result;
}
async function sources(root) {
  return hashes(root, [...(await Promise.all(['src', 'public', 'tests', 'scripts'].map(p => files(root, p)))).flat(),
    'package.json', 'package-lock.json', 'tsconfig.json', 'ecosystem.config.cjs', ...INPUT_DOCS]);
}
export async function prerequisites(root = ROOT) {
  const missing = [];
  for (const game of ['13-memory', '14-tic-tac-toe']) {
    for (const path of [`public/games/${game}/index.html`, `tests/games/${game}.test.mjs`]) {
      const p = await guarded(root, path);
      if (!existsSync(p) || !(await lstat(p)).isFile() || !(await readFile(p, 'utf8')).trim()) missing.push(path);
    }
    const modules = (await files(root, `public/games/${game}`)).filter(p => /\.(mjs|js)$/.test(p));
    if (modules.length === 0) missing.push(`public/games/${game}/<actual local modules>`);
  }
  for (const p of INPUT_DOCS) if (!existsSync(await guarded(root, p)) || !(await readFile(resolve(root, p), 'utf8')).trim()) missing.push(p);
  need(missing.length === 0, '13/14 source, dedicated unit tests or actual builder handoff missing; no waiting/build/server/browser', missing);
  for (const game of ['13-memory', '14-tic-tac-toe']) {
    const text = await readFile(resolve(root, `tests/games/${game}.test.mjs`), 'utf8');
    need(text.includes('node:test') && !/\b(?:test|it)\.(?:skip|todo)\s*\(/.test(text), `${game}: executable unskipped product unit tests required`);
    const html = await readFile(resolve(root, `public/games/${game}/index.html`), 'utf8');
    need(/<script\b[^>]*type=["']module["'][^>]*src=["'][^"']+["']/.test(html), `${game}: local module entry required`);
  }
  // Set only after reading BOTH actual implementation handoffs; never infer a snapshot schema.
  const spec = await readFile(resolve(root, 'tests/e2e/g026-new-games.spec.ts'), 'utf8');
  need(spec.includes('export const G026_ADAPTERS_READY = true;'), 'actual 13/14 UI/snapshot adapter intake pending; integration follow-up required');
}
async function toolchain(root) {
  need(process.platform === 'win32' && process.version === 'v24.16.0' && resolve(process.execPath).toLowerCase() === resolve(NODE).toLowerCase(), 'Windows + contracted absolute Node24.16.0 required');
  const versions = {};
  for (const [pkg, expected] of [['typescript', '7.0.2'], ['@playwright/test', '1.64.1']]) {
    versions[pkg] = JSON.parse(await readFile(resolve(root, `node_modules/${pkg}/package.json`), 'utf8')).version;
    need(versions[pkg] === expected, `installed ${pkg} must be ${expected}`);
  }
  const require = createRequire(resolve(root, 'package.json'));
  const { chromium, webkit } = require('@playwright/test');
  versions.browserExecutables = { chromium: chromium.executablePath(), webkit: webkit.executablePath() };
  for (const [name, p] of Object.entries(versions.browserExecutables)) need(existsSync(p), `${name} executable missing; no installation or fallback browser authorized`);
  return versions;
}
export async function assertReady(root = ROOT, build = 'artifacts/g027-build') {
  need(/^artifacts\/g027-build(?:-[a-zA-Z0-9_-]+)?$/.test(build), 'fresh G026 candidate build path required');
  await toolchain(root); await prerequisites(root);
  const path = await guarded(root, `${build}/g027-build-manifest.json`);
  need(existsSync(path), 'candidate manifest missing; PM must run --mode build AFTER both intakes');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  need(manifest.schema === 1 && manifest.task === 'G027' && manifest.root === resolve(root) && manifest.build === build && manifest.nodeVersion === process.version, 'build provenance mismatch');
  try {
    assert.deepEqual(await sources(root), manifest.source);
    assert.deepEqual(await hashes(root, (await files(root, build)).filter(p => p !== `${build}/g027-build-manifest.json`)), manifest.output);
  } catch { throw new Blocked('source/build SHA mismatch; preserve old candidate and build a new --build artifacts/g027-build-<revision>'); }
  for (const p of ['src/server/index.js', 'public/scripts/library.js', 'public/games/13-memory/index.html', 'public/games/14-tic-tac-toe/index.html']) need(existsSync(resolve(root, build, p)), `compiled output missing: ${p}`);
  return manifest;
}
export function tapCounts(text) {
  const n = label => { const match = text.match(new RegExp(`^# ${label} (\\d+)\\s*$`, 'm')); assert(match, `Missing actual TAP ${label}`); return Number(match[1]); };
  return { tests: n('tests'), passed: n('pass'), failed: n('fail'), skipped: n('skipped'), todo: n('todo') };
}
export function browserCounts(data) {
  const walk = s => [...(s.specs ?? []).flatMap(p => p.tests), ...(s.suites ?? []).flatMap(walk)];
  const tests = (data.suites ?? []).flatMap(walk);
  return { discovered: tests.length, executed: tests.filter(t => (t.results ?? []).some(r => !['skipped', 'interrupted'].includes(r.status))).length,
    passed: tests.filter(t => t.status === 'expected' && t.expectedStatus === 'passed' && t.results?.length === 1 && t.results[0].status === 'passed').length,
    failed: tests.filter(t => t.status === 'unexpected').length, skipped: tests.filter(t => t.status === 'skipped').length,
    pending: tests.filter(t => !t.results?.length || t.results.every(r => ['skipped', 'interrupted'].includes(r.status))).length };
}
async function refused() {
  await new Promise((accept, reject) => {
    const socket = connect({ host: '127.0.0.1', port: 3171 });
    socket.once('connect', () => { socket.destroy(); reject(new Blocked('3171 occupied; foreign server never reused/stopped')); });
    socket.once('error', e => e.code === 'ECONNREFUSED' ? accept() : reject(e));
    socket.setTimeout(3000, () => { socket.destroy(); reject(new Error('3171 port probe timed out')); });
  });
}
// Python owns the HANDLE for the WHOLE browser child, and releases it on every exit.
// Normal blocking acquire serializes the whole child against independent QA.
// No external polling, timeout retry, or terminating another gate owner.
export const MUTEX_PY = `import ctypes, os, subprocess, sys, json
from ctypes import wintypes
k = ctypes.WinDLL('kernel32', use_last_error=True)
k.CreateMutexW.argtypes = [ctypes.c_void_p, wintypes.BOOL, wintypes.LPCWSTR]
k.CreateMutexW.restype = wintypes.HANDLE
k.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
k.WaitForSingleObject.restype = wintypes.DWORD
k.ReleaseMutex.argtypes = [wintypes.HANDLE]
k.ReleaseMutex.restype = wintypes.BOOL
k.CloseHandle.argtypes = [wintypes.HANDLE]
k.CloseHandle.restype = wintypes.BOOL
h = k.CreateMutexW(None, False, r'Local\\SimpleGamesG026BrowserGate')
if not h: raise ctypes.WinError(ctypes.get_last_error())
owned = False
try:
    print('G026_BROWSER_GATE_WAIT blocking Local\\\\SimpleGamesG026BrowserGate', flush=True)
    wait = k.WaitForSingleObject(h, 0xFFFFFFFF)
    if wait not in (0, 128): raise ctypes.WinError(ctypes.get_last_error())
    owned = True
    print('G026_BROWSER_GATE_ACQUIRED', flush=True)
    env = dict(os.environ, GAME_G026_BROWSER_GATE=r'Local\\SimpleGamesG026BrowserGate')
    code = subprocess.call(sys.argv[1:], env=env)
    sys.exit(code)
finally:
    try:
        if owned:
            if not k.ReleaseMutex(h): raise ctypes.WinError(ctypes.get_last_error())
            print('G026_BROWSER_GATE_RELEASED', flush=True)
    finally:
        if not k.CloseHandle(h): raise ctypes.WinError(ctypes.get_last_error())
`;
function parse(args) {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const k = args[i]; assert(['--mode', '--build', '--origin', '--list'].includes(k) && !Object.hasOwn(opts, k), `Unknown/duplicate option ${k}`);
    if (k === '--list') opts[k] = true;
    else { assert(args[i + 1] && !args[i + 1].startsWith('--'), `Missing ${k}`); opts[k] = args[++i]; }
  }
  assert(['build', 'smoke', 'full'].includes(opts['--mode']), 'Explicit --mode build|smoke|full required');
  assert(!opts['--origin'] || opts['--origin'] === ORIGIN, 'Only candidate http://127.0.0.1:3171 authorized; no live profile');
  assert(!opts['--list'] || opts['--mode'] !== 'build', '--list is discovery only');
  const build = opts['--build'] ?? 'artifacts/g027-build';
  assert(/^artifacts\/g027-build(?:-[A-Za-z0-9_-]+)?$/.test(build), 'Invalid candidate --build');
  return { mode: opts['--mode'], build, list: !!opts['--list'] };
}
export async function main(args = process.argv.slice(2)) {
  let options;
  try { options = parse(args); } catch (e) { console.error(`INVALID_INVOCATION: ${e.message}`); process.exitCode = 64; return; }
  const { mode, build, list } = options;
  const reports = `artifacts/g027-builder/runs/${randomUUID().slice(0, 8)}`; // short fixture cwd, exclusive mkdir below
  const out = await guarded(ROOT, reports); await mkdir(dirname(out), { recursive: true }); await mkdir(out);
  const json = (name, value) => writeFile(join(out, name), `${JSON.stringify(value, null, 2)}\n`);
  const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GAME_')));
  const env = { ...clean, GAME_TEST_BUILD_DIR: build, GAME_G026_MODE: mode, GAME_G026_ORIGIN: ORIGIN,
    GAME_TEST_ARTIFACT_DIR: reports, GAME_G026_LIST: list ? '1' : '0',
    TEMP: 'C:/Users/hebon/AppData/Local/hermes/cache/scratch', TMP: 'C:/Users/hebon/AppData/Local/hermes/cache/scratch' };
  const report = { task: 'G026-INTEGRATE', root: ROOT, mode, build, origin: ORIGIN, reports, started: new Date().toISOString(),
    node: process.execPath, nodeVersion: process.version, commands: [], discovered: 0, browserExecuted: 0, unitExecuted: 0,
    baselineReusedAsExecution: false, independentAcceptance: false, deploymentActions: false, listOnly: list,
    envBeforeChildren: Object.fromEntries(Object.entries(env).filter(([k]) => k.startsWith('GAME_'))) };
  async function command(label, executable, argv, cwd = ROOT, extra = {}) {
    const folder = join(out, label); await mkdir(folder);
    const childEnv = { ...env, GAME_TEST_ARTIFACT_DIR: `${reports}/${label}`, ...extra };
    const entry = { label, executable, argv, cwd, cwdLength: cwd.length, env: Object.fromEntries(Object.entries(childEnv).filter(([k]) => k.startsWith('GAME_'))), started: new Date().toISOString() };
    report.commands.push(entry); await json('report.json', report);
    for (const name of ['stdout', 'stderr']) writeFileSync(join(folder, `${name}.log`), '');
    const result = await new Promise(accept => {
      const child = spawn(executable, argv, { cwd, env: childEnv, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      child.stdout.on('data', b => { stdout += b; appendFileSync(join(folder, 'stdout.log'), b); process.stdout.write(b); });
      child.stderr.on('data', b => { stderr += b; appendFileSync(join(folder, 'stderr.log'), b); process.stderr.write(b); });
      child.once('error', e => { entry.spawnError = String(e); });
      child.once('close', (code, signal) => accept({ code, signal, stdout, stderr }));
    });
    Object.assign(entry, { exitCode: result.code, signal: result.signal, ended: new Date().toISOString() }); await json('report.json', report);
    return result;
  }
  const success = (r, label) => assert.equal(r.code, 0, `${label}: child failed; raw logs preserved, no auto-retry`);
  const excluded = p => p === reports || p.startsWith(`${reports}/`) || /^artifacts\/(?:g026-(?:pm|qa13|qa14|13-builder|14-builder)|g027-builder)(?:\/|$)/.test(p);
  let historical, before, server, createdBuild = false;
  try {
    report.preflightSource = await hashes(ROOT, [...(await Promise.all(['src', 'public', 'tests', 'scripts'].map(p => files(ROOT, p)))).flat()]);
    await json('preflight-source-sha256.json', report.preflightSource);
    report.toolchain = await toolchain(ROOT);
    success(await command('environment-python', 'python', ['--version']), 'Python environment');
    await prerequisites(ROOT); // No compiler/build/server/browser before actual ready handoffs.
    before = await sources(ROOT); await json('source-sha256.json', before);
    historical = await hashes(ROOT, await files(ROOT, 'artifacts', excluded), true); await json('historical-before.json', historical);
    const outputAudit = [];
    for (const p of (await files(ROOT, 'tests')).filter(p => /\.(ts|mjs)$/.test(p))) {
      const selected = SPECS.some(name => p === `tests/e2e/${name}`);
      const lines = (await readFile(resolve(ROOT, p), 'utf8')).split(/\r?\n/);
      const matches = lines.flatMap((text, i) => /artifacts[\\/]|ARTIFACT|writeFile|screenshot\(|outputPath|\.attach\(/.test(text) ? [{ line: i + 1, text }] : []);
      outputAudit.push({ path: p, selected, policy: p === 'tests/launch-local.test.mjs' ? 'unchanged short same-byte snapshot only' : selected ? 'child env set before import; task-owned TestInfo outputPath/attach' : 'not selected for browser execution', matches });
      if (selected) need(!matches.some(m => /["'`]artifacts[\\/]/.test(m.text) && !/GAME_TEST_ARTIFACT_DIR/.test(m.text)), `unredirected spec output: ${p}`);
    }
    await json('spec-output-audit.json', outputAudit);
    const tsc = resolve(ROOT, 'node_modules/typescript/bin/tsc');
    success(await command('typecheck', NODE, [tsc, '--noEmit']), 'typecheck');
    success(await command('typecheck-e2e', NODE, [tsc, '--ignoreConfig', '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--types', 'node', 'tests/g026-playwright.config.ts', ...SPECS.map(p => `tests/e2e/${p}`)]), 'typecheck-e2e');
    if (mode === 'build') {
      const syntax = [...await files(ROOT, 'public/games/13-memory'), ...await files(ROOT, 'public/games/14-tic-tac-toe'),
        'tests/games/13-memory.test.mjs', 'tests/games/14-tic-tac-toe.test.mjs', 'scripts/g026-verify.mjs'].filter(p => /\.(mjs|js)$/.test(p));
      for (const [i, p] of syntax.entries()) success(await command(`syntax-${i}`, NODE, ['--check', p]), `syntax ${p}`);
      await guarded(ROOT, build); need(!existsSync(resolve(ROOT, build)), 'candidate exists; never overwrite; use a NEW --build revision');
      createdBuild = true;
      success(await command('build', NODE, ['scripts/build.mjs', '--out-dir', build]), 'build');
      assert.deepEqual(await sources(ROOT), before, 'source changed during build');
      const manifest = { schema: 1, task: 'G027', root: ROOT, build, nodeVersion: process.version, buildId: randomUUID(), created: new Date().toISOString(), source: before, output: await hashes(ROOT, await files(ROOT, build)) };
      await writeFile(resolve(ROOT, build, 'g027-build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
      await assertReady(ROOT, build); report.status = 'BUILD_CREATED_NOT_PLAYTESTED';
    } else {
      const manifest = await assertReady(ROOT, build); report.buildId = manifest.buildId;
      report.manifestSha256 = hash(await readFile(resolve(ROOT, build, 'g027-build-manifest.json')));
      if (!list) {
        if (mode === 'full') {
          const unitGroups = { common: (await files(ROOT, `${build}/tests/unit`)).filter(p => p.endsWith('.test.js')), games: (await files(ROOT, 'tests/games')).filter(p => p.endsWith('.test.mjs')) };
          const snapshot = join(out, 'l'), proof = [];
          for (const p of ['tests/launch-local.test.mjs', 'scripts/serve_local.mjs', 'package.json']) {
            const dest = join(snapshot, p); await mkdir(dirname(dest), { recursive: true }); await copyFile(resolve(ROOT, p), dest);
            const a = hash(await readFile(resolve(ROOT, p))), b = hash(await readFile(dest)); assert.equal(a, b); proof.push({ source: resolve(ROOT, p), snapshot: dest, sha256: a });
          }
          // Deepest fixture cwd + original fixture path stays below Windows260.
          need(join(snapshot, 'artifacts/g017-builder/fixtures', randomUUID(), 'occupied', 'scripts/serve_local.mjs').length < 260, 'launcher fixture path exceeds Windows260');
          await json('launcher-byte-identical.json', proof);
          for (const [name, paths] of [...Object.entries(unitGroups), ['launcher', ['tests/launch-local.test.mjs']]]) {
            need(paths.length > 0, `empty unit group ${name}`);
            const r = await command(`unit-${name}`, NODE, ['--test', '--test-reporter=tap', ...paths], name === 'launcher' ? snapshot : ROOT);
            const counts = tapCounts(r.stdout); report.units ??= {}; report.units[name] = counts; report.unitExecuted += counts.tests;
            success(r, name); assert(counts.tests > 0 && counts.tests === counts.passed && counts.failed + counts.skipped + counts.todo === 0, `unit ${name} incomplete`);
          }
        }
        await refused();
        const { createGameServer, CSP } = await import(pathToFileURL(resolve(ROOT, build, 'src/server/index.js')).href);
        server = createGameServer(resolve(ROOT, build, 'public'));
        await new Promise((accept, reject) => { server.once('error', reject); server.listen(3171, '127.0.0.1', accept); });
        report.server = { owned: true, host: '127.0.0.1', port: 3171 };
        const observations = [];
        try {
          for (const p of await files(ROOT, `${build}/public`)) {
            if (!['.html', '.js', '.mjs', '.css', '.svg', '.png', '.webp', '.ico'].includes(extname(p))) continue;
            const route = p.slice(`${build}/public`.length), expected = await readFile(resolve(ROOT, p));
            const r = await fetch(`${ORIGIN}${route}`, { redirect: 'error', signal: AbortSignal.timeout(10000) }), bytes = Buffer.from(await r.arrayBuffer());
            observations.push({ route, status: r.status, sha256: hash(bytes), expectedSha256: hash(expected), csp: r.headers.get('content-security-policy') });
            assert.equal(r.status, 200, route); assert.equal(r.headers.get('content-security-policy'), CSP); assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.deepEqual(bytes, expected, route);
          }
        } finally { await json('http-bytes.json', observations); }
      }
      const cli = resolve(ROOT, 'node_modules/@playwright/test/cli.js'), config = 'tests/g026-playwright.config.ts';
      const discovery = await command('discovery', NODE, [cli, 'test', '--config', config, '--list'], ROOT, { GAME_G026_LIST: '1' });
      const d = JSON.parse(await readFile(join(out, 'discovery/discovery.json'), 'utf8'));
      report.discovered = browserCounts(d).discovered; success(discovery, 'discovery'); assert(report.discovered > 0); assert.equal(d.errors.length, 0);
      if (list) report.status = 'DISCOVERY_ONLY_NOT_EXECUTED';
      else {
        const gate = join(out, 'browser-gate.py'); await writeFile(gate, MUTEX_PY, { flag: 'wx' });
        const r = await command('execution', 'python', [gate, NODE, cli, 'test', '--config', config], ROOT, { GAME_G026_LIST: '0' });

        const data = JSON.parse(await readFile(join(out, 'execution/playwright-results.json'), 'utf8'));
        report.browser = browserCounts(data); report.browserExecuted = report.browser.executed; report.browserStats = data.stats;
        const failures = suite => [...(suite.specs ?? []).flatMap(s => s.tests.flatMap(t => (t.results ?? []).filter(r => !['passed', 'skipped'].includes(r.status)).map(r => ({ title: s.title, project: t.projectName, status: r.status, errors: r.errors })))), ...(suite.suites ?? []).flatMap(failures)];
        report.failures = [...data.errors, ...data.suites.flatMap(failures)]; success(r, 'browser');
        assert.equal(data.errors.length, 0); assert.equal(data.stats.unexpected + data.stats.skipped + data.stats.flaky, 0);
        assert.equal(report.browser.passed, report.discovered); assert.equal(report.browserExecuted, report.discovered); assert.equal(report.browser.pending, 0);
        report.status = 'EXECUTION_PASSED';
      }
    }
  } catch (e) {
    report.status = e instanceof Blocked ? 'BLOCKED' : 'FAILED'; report.error = e.stack ?? String(e); report.blockers = e.details ?? [];
    process.exitCode = e instanceof Blocked ? 2 : 1;
  } finally {
    try {
      if (server) { await new Promise((accept, reject) => { server.close(e => e ? reject(e) : accept()); server.closeAllConnections(); }); await refused(); if (report.server) report.server.stoppedAndRefused = true; }
      if (before) assert.deepEqual(await sources(ROOT), before, 'source drift during verification');
      if (historical) {
        const after = await hashes(ROOT, await files(ROOT, 'artifacts', p => excluded(p) || (createdBuild && (p === build || p.startsWith(`${build}/`)))), true);
        await json('historical-after.json', after);
        // PM's explicitly protected read-only QA build may be created concurrently.
        // Preserve EVERY pre-existing byte/size/mtime; only its NEW paths are allowed.
        const prior = Object.fromEntries(Object.keys(historical).map(p => [p, after[p]]));
        assert.deepEqual(prior, historical, 'historical SHA/size/mtime changed or prior file deleted');
        const added = Object.keys(after).filter(p => !Object.hasOwn(historical, p));
        assert(added.every(p => p.startsWith('artifacts/g026-qa-build/')), `unowned added artifact paths: ${added.filter(p => !p.startsWith('artifacts/g026-qa-build/')).join(', ')}`);
        report.concurrentProtectedInput = { root: 'artifacts/g026-qa-build', newPaths: added, policy: 'new PM build inputs only; all pre-existing paths remain immutable' };
        report.historicalPreserved = Object.keys(historical).length;
      }
    } catch (e) { report.status = 'FAILED_PRESERVATION_OR_CLEANUP'; report.finalizationError = e.stack ?? String(e); process.exitCode = 1; }
    report.finished = new Date().toISOString(); await json('report.json', report);
    console.log(JSON.stringify({ reports, status: report.status, discovered: report.discovered, browserExecuted: report.browserExecuted, unitExecuted: report.unitExecuted, error: report.error }, null, 2));
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
