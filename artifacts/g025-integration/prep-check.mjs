// Preparation-only verification. Never creates dummy games/builds or starts a browser.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { ROOT, NODE, guarded, verifyManifest } from '../../scripts/g025-verify.mjs';
const id = `prep-${new Date().toISOString().replace(/[^0-9TZ]/g, '')}-${randomUUID()}`;
const reports = `artifacts/g025-integration/${id}`, out = await guarded(ROOT, reports);
assert(!existsSync(out)); await mkdir(out, { recursive: true });
const json = (name, value) => writeFile(join(out, name), `${JSON.stringify(value, null, 2)}\n`);
const sha = b => createHash('sha256').update(b).digest('hex');
const results = { task: 'G025-SHARED-PREP', root: ROOT, reports, started: new Date().toISOString(), staticChecks: [], invalidInvocations: [], prerequisiteBlocks: [], guardChecks: [],
  browserExecuted: 0, gameplayPassed: 0, buildExecuted: 0, independentReview: false };
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GAME_')));
function command(label, executable, args, expected = 0, env = {}) {
  const childReports = `${reports}/children/${label}-${randomUUID()}`;
  const r = spawnSync(executable, args, { cwd: ROOT, env: { ...cleanEnv, GAME_TEST_ARTIFACT_DIR: childReports, GAME_TEST_BUILD_DIR: 'artifacts/g025-build',
    TEMP: 'C:/Users/hebon/AppData/Local/hermes/cache/scratch', TMP: 'C:/Users/hebon/AppData/Local/hermes/cache/scratch', ...env }, encoding: 'utf8', shell: false, maxBuffer: 16 * 1024 * 1024 });
  return { label, executable, args, expectedExit: expected, actualExit: r.status, signal: r.signal, error: r.error?.message ?? null, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}
async function retain(r) {
  await writeFile(join(out, `${r.label}.stdout.log`), r.stdout, { flag: 'wx' }); await writeFile(join(out, `${r.label}.stderr.log`), r.stderr, { flag: 'wx' });
  await json(`${r.label}.json`, { ...r, stdout: `${r.label}.stdout.log`, stderr: `${r.label}.stderr.log` });
  assert.equal(r.error, null); assert.equal(r.actualExit, r.expectedExit, `${r.label}: ${r.stderr}`);
  return { label: r.label, exitCode: r.actualExit, stdout: `${r.label}.stdout.log`, stderr: `${r.label}.stderr.log` };
}
try {
  for (const p of ['public/games/11-mines', 'public/games/12-fifteen', 'tests/games/11-mines.test.mjs', 'tests/games/12-fifteen.test.mjs', 'artifacts/g025-build']) assert(!existsSync(resolve(ROOT, p)), `Intake state changed: ${p}; stop preparation and request PM's final verification assignment`);
  const specs = ['library-integration', 'multi-game-integration', 'breakout-integration', 'runner-jumper', 'live-server', 'flappy-input', 'g024-new-games', 'g025-new-games'].map(n => `tests/e2e/${n}.spec.ts`);
  const staticCommands = [
    ['node-version', NODE, ['-e', "console.log(JSON.stringify({execPath:process.execPath,node:process.version,typescript:require('typescript/package.json').version,playwright:require('@playwright/test/package.json').version}))"]],
    ['syntax-runner', NODE, ['--check', 'scripts/g025-verify.mjs']],
    ['syntax-ecosystem', NODE, ['--check', 'ecosystem.config.cjs']],
    ['syntax-prep', NODE, ['--check', 'artifacts/g025-integration/prep-check.mjs']],
    ['syntax-python-gate', 'python', ['-c', "import ast,pathlib; p=pathlib.Path('artifacts/g025-integration/browser-gate.py'); ast.parse(p.read_text(encoding='utf-8')); print('browser gate AST syntax OK; no browser invoked')"]],
    ['typecheck-project', NODE, ['node_modules/typescript/bin/tsc', '--noEmit']],
    ['typecheck-common-e2e', NODE, ['node_modules/typescript/bin/tsc', '--ignoreConfig', '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--lib', 'ES2022,DOM,DOM.Iterable', '--types', 'node', '--skipLibCheck', 'tests/g025-playwright.config.ts', ...specs]],
  ];
  for (const [label, executable, argv] of staticCommands) results.staticChecks.push(await retain(command(label, executable, argv)));
  const toolchain = JSON.parse((await readFile(join(out, 'node-version.stdout.log'), 'utf8')).trim());
  assert.equal(toolchain.node, 'v24.16.0'); assert.equal(toolchain.typescript, '7.0.2'); assert.equal(toolchain.playwright, '1.64.1'); results.toolchain = toolchain;
  const before = command('catalog-base', 'git', ['show', '7d72954896845e7cf2152e4a4857a6f00a6c14b7:src/client/library.ts']); await retain(before);
  const after = await readFile(resolve(ROOT, 'src/client/library.ts'), 'utf8');
  const records = text => text.split(/\r?\n/).filter(s => /^  \{ id: /.test(s));
  const original = records(before.stdout), candidate = records(after); assert.equal(original.length, 39); assert.equal(candidate.length, 41);
  assert.deepEqual(candidate.slice(0, 39), original, 'all original catalog record literals/order must remain exact');
  const oldStorage = text => text.replaceAll('\r\n', '\n').split('const FAVORITES_KEY')[1].split('function artwork')[0];
  assert.equal(oldStorage(after), oldStorage(before.stdout), 'favorite storage key/read/write/filter code changed');
  assert.equal(candidate.filter(s => s.includes("status: 'available'")).length, 12); assert.equal(candidate.filter(s => s.includes("status: 'upcoming'")).length, 29);
  for (const [id, title, route] of [['gem-survey', '보석 탐사 지도', '/games/11-mines/index.html'], ['number-postbox', '숫자 우체통', '/games/12-fifteen/index.html']]) {
    const r = candidate.find(s => s.includes(`id: '${id}'`)); for (const token of [title, "genre: '숫자'", route, "status: 'available'"]) assert(r.includes(token));
  }
  await json('catalog-preservation.json', { originalRecords: original.length, total: candidate.length, available: 12, upcoming: 29, originalRecordLiteralsAndOrderPreserved: true, favoritesStorageCodePreserved: true,
    originalRecordsSha256: original.map(line => ({ id: line.match(/id: '([^']+)'/)[1], sha256: sha(line) })) });
  const invalid = [
    ['duplicate-target', ['--target', 'candidate', '--mode', 'smoke', '--target', 'live']],
    ['duplicate-mode', ['--target', 'candidate', '--mode', 'smoke', '--mode', 'full']],
    ['duplicate-origin', ['--target', 'live', '--mode', 'smoke', '--origin', 'http://192.168.0.195:3116', '--origin', 'http://192.168.0.195:3116']],
    ['candidate-explicit-origin', ['--target', 'candidate', '--mode', 'smoke', '--origin', 'http://127.0.0.1:3155']],
    ['live-origin-missing', ['--target', 'live', '--mode', 'smoke']],
    ['live-origin-loopback', ['--target', 'live', '--mode', 'full', '--origin', 'http://127.0.0.1:3116']],
    ['live-build-forbidden', ['--target', 'live', '--mode', 'build', '--origin', 'http://192.168.0.195:3116']],
    ['build-list-conflict', ['--target', 'candidate', '--mode', 'build', '--list']],
    ['list-unit-conflict', ['--target', 'candidate', '--mode', 'full', '--list', '--units-only']],
    ['duplicate-list', ['--target', 'candidate', '--mode', 'smoke', '--list', '--list']],
    ['unknown-port', ['--target', 'candidate', '--mode', 'smoke', '--port', '3116']],
    ['candidate-inherited-live', ['--target', 'candidate', '--mode', 'smoke'], { GAME_LIVE_ORIGIN: 'http://192.168.0.195:3116' }],
  ];
  for (const [label, argv, env] of invalid) {
    const r = command(label, NODE, ['scripts/g025-verify.mjs', ...argv], 64, env); results.invalidInvocations.push(await retain(r)); assert(r.stderr.includes('INVALID_INVOCATION'));
  }
  // Exactly two prerequisite observations, then stop: no retry loop on absent games.
  for (const [label, argv] of [
    ['candidate-smoke-missing-games', ['--target', 'candidate', '--mode', 'smoke']],
    ['live-full-list-missing-games', ['--target', 'live', '--mode', 'full', '--origin', 'http://192.168.0.195:3116', '--list']],
  ]) {
    const r = command(label, NODE, ['scripts/g025-verify.mjs', ...argv], 2); await retain(r);
    const matches = [...r.stdout.matchAll(/"reports": "([^"]+)"/g)]; assert.equal(matches.length, 1);
    const invocation = JSON.parse(await readFile(resolve(ROOT, matches[0][1], 'invocation.json'), 'utf8'));
    assert.equal(invocation.status, 'BLOCKED'); assert.equal(invocation.commands.length, 0); assert.equal(invocation.browserExecuted, 0); assert.equal(invocation.unitExecuted, 0); assert.equal(invocation.discovered, 0);
    assert.equal(invocation.blockers.length, 12); assert.equal(invocation.historicalPreserved.shaSizeMtime, true);
    results.prerequisiteBlocks.push({ label, expectedStatus: 'BLOCKED', actualStatus: invocation.status, exitCode: r.actualExit, reports: matches[0][1], missingFiles: invocation.blockers, childrenStarted: invocation.commands.length, browserExecuted: 0, notCountedAsGamePass: true });
  }
  await assert.rejects(() => verifyManifest(ROOT), /BLOCKED: fresh G025 build manifest missing/); results.guardChecks.push({ check: 'missing-fresh-manifest', rejected: true, gameplayPassed: 0 });
  await assert.rejects(() => guarded(ROOT, '../outside-scope'), /path escapes root/); results.guardChecks.push({ check: 'path-traversal', rejected: true });
  await assert.rejects(() => guarded(ROOT, 'node_modules'), /symlink\/junction forbidden/); results.guardChecks.push({ check: 'read-only-dependency-junction-not-writable', rejected: true });
  const baseline = JSON.parse(await readFile(resolve(ROOT, 'artifacts/g025-integration/prep-historical-before.json'), 'utf8'));
  const unchanged = {}, changes = [];
  for (const [label, base] of Object.entries({ integration: resolve(ROOT, 'artifacts'), original: 'E:/Work2/Project/SimpleGames/01-2048/artifacts' })) {
    let count = 0;
    for (const [p, expected] of Object.entries(baseline[label])) {
      try {
        const actual = resolve(base, p), s = await stat(actual, { bigint: true });
        const observed = { sha256: sha(await readFile(actual)), size: Number(s.size), mtimeNs: String(s.mtimeNs) };
        if (JSON.stringify(observed) !== JSON.stringify(expected)) changes.push({ root: label, path: p, expected, observed }); else count++;
      } catch (e) { changes.push({ root: label, path: p, error: e.message }); }
    }
    unchanged[label] = count;
  }
  await json('historical-preservation.json', { unchanged, changes, scope: 'every pre-existing file SHA256/size/mtimeNs; concurrent new PM artifacts are not historical overwrites' }); assert.deepEqual(changes, []); results.historicalPreserved = unchanged;
  const owned = ['src/client/library.ts', 'package.json', 'ecosystem.config.cjs', 'scripts/g025-verify.mjs', 'tests/g025-playwright.config.ts', ...specs, 'artifacts/g025-integration/browser-gate.py', 'artifacts/g025-integration/prep-check.mjs'];
  const source = {};
  for (const p of owned) source[p] = sha(await readFile(resolve(ROOT, p)));
  await json('source-sha256.json', { physicalRoot: ROOT, source });
  results.status = 'PREPARATION_VERIFIED_GAME_EXECUTION_BLOCKED';
} catch (e) { results.status = 'PREPARATION_CHECK_FAILED'; results.error = e.stack ?? String(e); process.exitCode = 1; }
finally { results.finished = new Date().toISOString(); await json('results.json', results); console.log(JSON.stringify(results, null, 2)); }
