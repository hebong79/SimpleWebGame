import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { missingPrerequisites } from './readiness.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const modeArg = args.find(arg => arg.startsWith('--mode='));
const phaseArg = args.find(arg => arg.startsWith('--phase='));
const mode = modeArg?.slice(7) ?? 'candidate';
const phase = phaseArg?.slice(8) ?? 'full';
const list = args.includes('--list');
if (args.some(arg => arg !== modeArg && arg !== phaseArg && arg !== '--list') ||
  !['candidate', 'live'].includes(mode) || !['smoke', 'full'].includes(phase))
  throw new Error('Usage: node artifacts/g022-integration/run-playwright.mjs [--mode=candidate|live] [--phase=smoke|full] [--list]');
if (mode === 'candidate' && process.env.GAME_LIVE_ORIGIN) throw new Error('Do not inherit a live origin in candidate mode.');
if (mode === 'live' && process.env.GAME_LIVE_ORIGIN !== 'http://192.168.0.195:3116')
  throw new Error('Live mode needs explicit GAME_LIVE_ORIGIN=http://192.168.0.195:3116.');
const build = 'artifacts/g022-build';
const id = `${new Date().toISOString().replace(/[^0-9TZ]/g, '')}-${randomUUID().slice(0, 8)}`;
const reports = `artifacts/g022-integration/runs/${id}/${mode}`;
const out = resolve(root, reports);
if (existsSync(out)) throw new Error('Refusing to overwrite a previous run.');
mkdirSync(out, { recursive: true });
const env = { ...process.env, GAME_TEST_BUILD_DIR: build, GAME_TEST_ARTIFACT_DIR: reports,
  GAME_G022_MODE: mode, GAME_G022_PHASE: phase };
const command = [resolve(root, 'node_modules/@playwright/test/cli.js'), 'test',
  '--config', resolve(root, 'artifacts/g022-integration/playwright.config.ts'), ...(list ? ['--list'] : [])];
const missing = missingPrerequisites(build);
const meta = { task: 'G022-INTEGRATION', mode, phase, listOnly: list, build, reports,
  origin: mode === 'live' ? env.GAME_LIVE_ORIGIN : 'http://127.0.0.1:3130',
  envBeforeChild: { GAME_TEST_BUILD_DIR: build, GAME_TEST_ARTIFACT_DIR: reports, GAME_G022_MODE: mode, GAME_G022_PHASE: phase },
  command: [process.execPath, ...command], missingPrerequisites: missing,
  serverLifecycleActions: false, releaseAcceptance: false };
if (!list && missing.length) {
  writeFileSync(resolve(out, 'invocation.json'), JSON.stringify({ ...meta, status: 'blocked_before_child', exitCode: 2 }, null, 2));
  console.error('G022 BLOCKED before browser child: approved game intake/root/candidate prerequisites missing.');
  console.error(missing.join('\n')); process.exitCode = 2;
} else {
  const result = spawnSync(process.execPath, command, { cwd: root, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  writeFileSync(resolve(out, 'stdout.log'), result.stdout ?? ''); writeFileSync(resolve(out, 'stderr.log'), result.stderr ?? '');
  writeFileSync(resolve(out, 'invocation.json'), JSON.stringify({ ...meta, status: list ? 'collection_only' : 'executed',
    exitCode: result.status, error: result.error?.message }, null, 2));
  process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
console.log(`G022 evidence: ${reports}`);
