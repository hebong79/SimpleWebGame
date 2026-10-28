import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const root = process.cwd(), own = resolve(root, 'artifacts/g024-09-builder');
const out = resolve(own, `final-${new Date().toISOString().replace(/[:.]/g, '-')}`); mkdirSync(out, { recursive: true });
const node = 'C:/Program Files/nodejs/node.exe';
const env = { ...process.env, GAME_TEST_ARTIFACT_DIR: own, GAME_TEST_BUILD_DIR: resolve(own, 'build') };
const commands = [
  ['scripts/build.mjs', '--out-dir', 'artifacts/g024-09-builder/build'],
  ['artifacts/g024-09-builder/early-smoke.mjs'],
  ['artifacts/g024-09-builder/run-checks.mjs'],
  ['artifacts/g024-09-builder/browser-smoke.mjs'],
];
const results = [];
for (const [i, args] of commands.entries()) {
  const p = spawnSync(node, args, { cwd: root, env, encoding: 'utf8', timeout: 240000, maxBuffer: 10 * 1024 * 1024 });
  const log = resolve(out, `command-${i + 1}.log`);
  writeFileSync(log, `${node} ${args.join(' ')}\nexit=${p.status}\n${p.stdout || ''}${p.stderr || ''}${p.error || ''}`);
  const result = { command: [node, ...args], exit: p.status, log }; results.push(result); console.log(JSON.stringify(result));
  if (p.status !== 0) { console.error(p.stdout, p.stderr, p.error); process.exitCode = 1; break; }
}
const sources = readdirSync(resolve(root, 'public/games/09-crossy')).map((f) => `public/games/09-crossy/${f}`).concat('tests/games/09-crossy.test.mjs');
const source_sha256 = Object.fromEntries(sources.map((f) => [f, createHash('sha256').update(readFileSync(resolve(root, f))).digest('hex')]));
writeFileSync(resolve(out, 'source-sha256.json'), JSON.stringify(source_sha256, null, 2));
writeFileSync(resolve(out, 'commands.json'), JSON.stringify({ root, node, env: { GAME_TEST_ARTIFACT_DIR: env.GAME_TEST_ARTIFACT_DIR, GAME_TEST_BUILD_DIR: env.GAME_TEST_BUILD_DIR }, results, source_sha256 }, null, 2));
console.log(`Final evidence: ${out}`);
