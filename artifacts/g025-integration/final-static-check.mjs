// Final static delta check only. Do not repeat missing-game failures or launch browsers.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { ROOT, NODE, guarded } from '../../scripts/g025-verify.mjs';
const reports = `artifacts/g025-integration/final-${new Date().toISOString().replace(/[^0-9TZ]/g, '')}-${randomUUID()}`;
const out = await guarded(ROOT, reports); await mkdir(out, { recursive: true });
const sha = b => createHash('sha256').update(b).digest('hex');
const json = (name, data) => writeFile(join(out, name), JSON.stringify(data, null, 2) + '\n');
const specs = ['library-integration', 'multi-game-integration', 'breakout-integration', 'runner-jumper', 'live-server', 'flappy-input', 'g024-new-games', 'g025-new-games'].map(n => `tests/e2e/${n}.spec.ts`);
const owned = ['src/client/library.ts', 'package.json', 'ecosystem.config.cjs', 'scripts/g025-verify.mjs', 'tests/g025-playwright.config.ts', ...specs,
  'docs/G025_SHARED_IMPLEMENTATION.md', 'artifacts/g025-integration/browser-gate.py', 'artifacts/g025-integration/prep-check.mjs', 'artifacts/g025-integration/final-static-check.mjs'];
const results = { reports, root: ROOT, started: new Date().toISOString(), status: 'CHECKING', staticCommands: [], reusedMissingGameBlocks: [], browserExecuted: 0, gameplayPassed: 0, buildExecuted: 0, independentReview: false };
try {
  const command = async (label, executable, args) => {
    const env = { ...process.env, GAME_TEST_ARTIFACT_DIR: `${reports}/children/${label}-${randomUUID()}`, GAME_TEST_BUILD_DIR: 'artifacts/g025-build' };
    const r = spawnSync(executable, args, { cwd: ROOT, env, shell: false, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    await writeFile(join(out, label + '.stdout.log'), r.stdout ?? '', { flag: 'wx' }); await writeFile(join(out, label + '.stderr.log'), r.stderr ?? '', { flag: 'wx' });
    results.staticCommands.push({ label, executable, args, exitCode: r.status, error: r.error?.message ?? null });
    assert.equal(r.error, undefined); assert.equal(r.status, 0, `${label}: ${r.stderr}`); return r.stdout;
  };
  await command('typecheck-project', NODE, ['node_modules/typescript/bin/tsc', '--noEmit']);
  await command('typecheck-common-e2e', NODE, ['node_modules/typescript/bin/tsc', '--ignoreConfig', '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--lib', 'ES2022,DOM,DOM.Iterable', '--types', 'node', '--skipLibCheck', 'tests/g025-playwright.config.ts', ...specs]);
  await command('syntax-runner', NODE, ['--check', 'scripts/g025-verify.mjs']);
  await command('syntax-final-check', NODE, ['--check', 'artifacts/g025-integration/final-static-check.mjs']);
  await command('diff-check', 'git', ['diff', '--check']);
  const diff = await command('scoped-diff', 'git', ['diff', '--', ...owned]);
  const base = await command('catalog-base', 'git', ['show', '7d72954896845e7cf2152e4a4857a6f00a6c14b7:src/client/library.ts']);
  const library = await readFile(resolve(ROOT, 'src/client/library.ts'), 'utf8');
  const records = s => s.split(/\r?\n/).filter(l => /^  \{ id: /.test(l));
  const old = records(base), current = records(library); assert.equal(old.length, 39); assert.equal(current.length, 41); assert.deepEqual(current.slice(0, 39), old);
  assert.equal(current.filter(s => s.includes("status: 'available'")).length, 12); assert.equal(current.filter(s => s.includes("status: 'upcoming'")).length, 29);
  const favoritesCode = s => s.replaceAll('\r\n', '\n').split('const FAVORITES_KEY')[1].split('function artwork')[0]; assert.equal(favoritesCode(library), favoritesCode(base));
  const availableIds = current.filter(s => s.includes("status: 'available'")).map(s => s.match(/id: '([^']+)'/)[1]);
  const multi = await readFile(resolve(ROOT, 'tests/e2e/multi-game-integration.spec.ts'), 'utf8');
  const idAssertion = multi.split('expect(await cardIds(page)).toEqual([')[1].split(']);')[0]; assert.deepEqual([...idAssertion.matchAll(/'([^']+)'/g)].map(m => m[1]), availableIds);
  results.catalog = { originalRecordsPreserved: old.length, total: current.length, available: availableIds.length, upcoming: 29, favoritesCodePreserved: true, existingMultiGameIdAssertionAligned: true };
  const firstPrep = 'artifacts/g025-integration/prep-20261029T122724057Z-b3a46514-d9a6-4830-8434-4113e8b2a486';
  const prep = JSON.parse(await readFile(resolve(ROOT, firstPrep, 'results.json'), 'utf8'));
  const prepSource = JSON.parse(await readFile(resolve(ROOT, firstPrep, 'source-sha256.json'), 'utf8')).source;
  // These files contain all invocation/precondition/mutex logic and are byte-identical.
  for (const p of ['scripts/g025-verify.mjs', 'tests/g025-playwright.config.ts', 'artifacts/g025-integration/browser-gate.py']) assert.equal(sha(await readFile(resolve(ROOT, p))), prepSource[p], `guard evidence invalidated by ${p}`);
  results.guardCoreUnchanged = true; results.reusedMissingGameBlocks = prep.prerequisiteBlocks;
  results.preparationEvidence = firstPrep; results.invalidInvocations = prep.invalidInvocations.length; results.directGuardChecks = prep.guardChecks.length;
  // Preserve all pre-task historical evidence. No old artifacts are rewritten.
  const historical = JSON.parse(await readFile(resolve(ROOT, 'artifacts/g025-integration/prep-historical-before.json'), 'utf8'));
  const changed = [], counts = {};
  for (const [label, basePath] of Object.entries({ integration: resolve(ROOT, 'artifacts'), original: 'E:/Work2/Project/SimpleGames/01-2048/artifacts' })) {
    counts[label] = 0;
    for (const [p, expected] of Object.entries(historical[label])) {
      const target = resolve(basePath, p), s = await stat(target, { bigint: true }); const actual = { sha256: sha(await readFile(target)), size: Number(s.size), mtimeNs: String(s.mtimeNs) };
      if (JSON.stringify(actual) !== JSON.stringify(expected)) changed.push({ root: label, path: p, expected, actual }); else counts[label]++;
    }
  }
  await json('historical-preservation.json', { unchanged: counts, changed }); assert.deepEqual(changed, []); results.historicalPreserved = counts;
  const source = {};
  for (const p of owned) source[p] = sha(await readFile(resolve(ROOT, p)));
  // Existing games/server/build/lockfile/launcher are read-only evidence inputs too.
  const readOnlyInputs = ['scripts/g024-verify.mjs', 'tests/g024-playwright.config.ts', 'artifacts/g024-integration/browser-gate.py', 'scripts/build.mjs', 'scripts/serve_local.mjs', 'src/server/index.ts', 'package-lock.json', 'tests/launch-local.test.mjs'];
  const protectedSource = {}; for (const p of readOnlyInputs) protectedSource[p] = sha(await readFile(resolve(ROOT, p)));
  await json('source-sha256.json', { physicalRoot: ROOT, baseHead: '7d72954896845e7cf2152e4a4857a6f00a6c14b7', source, protectedSource, pmOwnedExcluded: ['docs/G025_DESIGN_DECISIONS.md'] });
  results.status = 'STATIC_DELTA_VERIFIED_GAME_EXECUTION_BLOCKED';
} catch (e) { results.status = 'FAILED'; results.error = e.stack ?? String(e); process.exitCode = 1; }
finally { results.finished = new Date().toISOString(); await json('results.json', results); console.log(JSON.stringify(results, null, 2)); }
