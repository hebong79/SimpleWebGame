import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import net from 'node:net';
const root = process.cwd(), own = 'artifacts/g024-09-builder';
const frozen = JSON.parse(readFileSync(`${own}/final-2026-10-28T15-08-51-056Z/source-sha256.json`));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
assert.equal(branch, 'feature/g024-09-crossy');
for (const [file, expected] of Object.entries(frozen)) {
  assert.equal(sha(readFileSync(file)), expected);
  if (file.startsWith('public/')) assert.equal(sha(readFileSync(`${own}/build/${file}`)), expected);
}
const earlyPath = `${own}/early-2026-10-28T15-08-51-767Z/report.json`;
const browserPath = `${own}/browser-2026-10-28T15-08-58-186Z/report.json`;
const early = JSON.parse(readFileSync(earlyPath)), browser = JSON.parse(readFileSync(browserPath));
assert.equal(early.executed, early.results.length); assert.equal(early.passed, 7); assert.equal(early.failed, 0);
assert.equal(browser.executed, browser.results.length); assert.equal(browser.passed, 33); assert.equal(browser.failed, 0);
const checksPath = `${own}/checks-2026-10-28T15-08-57-418Z`;
const commands = JSON.parse(readFileSync(`${checksPath}/commands.json`));
assert.equal(commands.length, 6); assert.ok(commands.every((c) => c.exit === 0));
const tap = readFileSync(`${checksPath}/command-6.log`, 'utf8');
assert.match(tap, /# tests 32/); assert.match(tap, /# pass 32/); assert.match(tap, /# fail 0/); assert.match(tap, /# skipped 0/);
const gitPaths = execFileSync('git', ['diff', '--cached', '--name-only', '-z']).toString('utf8').split('\0').filter(Boolean);
const allowed = (p) => p.startsWith('public/games/09-crossy/') || p === 'tests/games/09-crossy.test.mjs' || p === 'docs/G024_09_IMPLEMENTATION.md' || p.startsWith(`${own}/`);
assert.ok(gitPaths.every(allowed));
execFileSync('git', ['diff', '--cached', '--check']);
await new Promise((ok, no) => { const s = net.createServer(); s.once('error', no); s.listen(3141, '127.0.0.1', () => s.close(ok)); });
const xml = readFileSync('public/games/09-crossy/icon.svg', 'utf8');
assert.ok(!/<script|<foreignObject|href=|onload=/.test(xml));
const record = {
  kind: 'builder-self-review', independent: false, task_id: 'G024-09', passed: true,
  branch, physical_root: root, inputs_sha256: frozen,
  security_concerns: [], logic_errors: [],
  checked: ['Exact frozen hashes equal working bytes and built public bytes', 'Staged ownership allowlist and whitespace check', 'Source reviewed: closed swept slabs, seam images, score-loss priority, no-op RNG, one reserved input', 'Source reviewed: BigInt realizable aggregates, private-key-only writes, no recovery writes/deletes', 'Source reviewed: no eval, injected inline styles/scripts, remote requests, shell execution or secrets', 'SVG namespace is not an external asset reference', 'Actual HTTP strict CSP and trusted nonfrozen 80ms controls', 'Actual monotonic 300ms stall zero ticks in three browser profiles', 'Port 3141 free after own servers closed'],
  tests: { unit: { executed: 32, passed: 32, failed: 0, skipped: 0 }, early_http: { executed: 7, passed: 7, failed: 0, skipped: 0 }, extended_http: { executed: 33, passed: 33, failed: 0, skipped: 0 }, syntax: { executed: 5, passed: 5, failed: 0, skipped: 0 }, build: { executed: 1, passed: 1, failed: 0, skipped: 0 } },
  evidence_paths: [earlyPath, browserPath, checksPath, `${own}/final-2026-10-28T15-08-51-056Z/commands.json`],
  suggestions: ['PM must assign independent QA09 after source freeze; builder self-tests are not acceptance', 'Shared integration, main merge, production3116 verification are separate later tasks'],
  limitations: ['No physical mobile device', 'No human audio listening', 'No validated human 20s-to-2min play duration', 'No independent review or production deployment', 'WebKit snapshots/layout evidence, no WebKit screenshot due strict-CSP tooling concern'],
};
writeFileSync(`${own}/self-review.json`, JSON.stringify(record, null, 2));
console.log(JSON.stringify(record, null, 2));
