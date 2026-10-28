import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const root = process.cwd(), own = resolve(root, 'artifacts/g024-09-builder');
const dir = resolve(own, `checks-${new Date().toISOString().replace(/[:.]/g, '-')}`); mkdirSync(dir, { recursive: true });
const node = 'C:/Program Files/nodejs/node.exe';
const env = { ...process.env, GAME_TEST_ARTIFACT_DIR: own, GAME_TEST_BUILD_DIR: resolve(own, 'build') };
const sources = readdirSync(resolve(root, 'public/games/09-crossy')).map((f) => `public/games/09-crossy/${f}`).concat('tests/games/09-crossy.test.mjs');
const manifest = Object.fromEntries(sources.map((f) => [f, createHash('sha256').update(readFileSync(resolve(root, f))).digest('hex')]));
writeFileSync(resolve(dir, 'source-sha256.json'), JSON.stringify(manifest, null, 2));
const checks = [];
const commands = sources.filter((f) => /\.m?js$/.test(f)).map((f) => ['--check', f]);
commands.push(['--test', '--test-reporter=tap', 'tests/games/09-crossy.test.mjs']);
for (const [i, args] of commands.entries()) {
  const p = spawnSync(node, args, { cwd: root, env, encoding: 'utf8', timeout: 120000 });
  const log = resolve(dir, `command-${i + 1}.log`);
  writeFileSync(log, `${node} ${args.join(' ')}\nexit=${p.status}\n${p.stdout || ''}${p.stderr || ''}${p.error || ''}`);
  checks.push({ command: [node, ...args], exit: p.status, log });
  console.log(`${args.join(' ')} => ${p.status}`); if (p.stdout) console.log(p.stdout); if (p.stderr) console.error(p.stderr);
}
writeFileSync(resolve(dir, 'commands.json'), JSON.stringify(checks, null, 2));
console.log(`Evidence: ${dir}`);
if (checks.some((c) => c.exit !== 0)) process.exitCode = 1;
