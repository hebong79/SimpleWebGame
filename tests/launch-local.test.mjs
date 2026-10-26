import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { parsePort } from '../scripts/serve_local.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
test('default port is 3102', () => assert.equal(parsePort(), 3102));
for (const value of ['1', '3120', '65535']) {
  test(`accept explicit port ${value}`, () => assert.equal(parsePort(['--port', value]), Number(value)));
}
for (const args of [
  ['--port'], ['--host', '0.0.0.0'], ['--port=3120'], ['3120'],
  ['--port', '0'], ['--port', '65536'], ['--port', '-1'], ['--port', '+1'],
  ['--port', '1.5'], ['--port', '1e3'], ['--port', '0x10'], ['--port', 'NaN'],
  ['--port', 'Infinity'], ['--port', ''], ['--port', ' 3120'], ['--port', '3120 '],
  ['--port', '３１２０'], ['--port', '999999999999999999999999'],
  ['--port', '3120', '--port', '3121'], ['--port', '3120', 'extra'],
]) {
  test(`reject ${JSON.stringify(args)}`, () => assert.throws(() => parsePort(args)));
}

const source = await readFile(join(root, 'scripts/serve_local.mjs'), 'utf8');
const fixtures = join(root, 'artifacts/g017-builder/fixtures', randomUUID());
async function fixture(name, { buildExit = 0, occupied = false } = {}) {
  const dir = join(fixtures, name);
  await mkdir(join(dir, 'scripts'), { recursive: true });
  await mkdir(join(dir, 'artifacts/local-server-build/src/server'), { recursive: true });
  await writeFile(join(dir, 'scripts/serve_local.mjs'), source);
  await writeFile(join(dir, 'package.json'), '{"type":"module"}');
  await writeFile(join(dir, 'scripts/build.mjs'), `console.log('BUILD_ARGS', JSON.stringify(process.argv.slice(2))); process.exit(${buildExit});`);
  await writeFile(join(dir, 'artifacts/local-server-build/src/server/index.js'), `
import { EventEmitter } from 'node:events';
console.log('SERVER_IMPORTED');
export function createGameServer(root) {
  console.log('PUBLIC_ROOT', root);
  const server = new EventEmitter();
  server.listen = (port, host, callback) => {
    ${occupied ? "queueMicrotask(() => server.emit('error', Object.assign(new Error('occupied'), { code: 'EADDRINUSE' })));" : `
    process.on('message', signal => process.emit(signal));
    console.log('LISTEN', JSON.stringify({ port, host }));
    callback();`}
  };
  server.close = () => { console.log('SERVER_CLOSE'); server.emit('close'); };
  server.closeAllConnections = () => { console.log('CONNECTIONS_CLOSE'); process.disconnect?.(); };
  return server;
}`);
  return join(dir, 'scripts/serve_local.mjs');
}

test('import is inert: no build, server import or listening', async () => {
  const entry = await fixture('import');
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(entry).href)})`], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});
test('failed fresh build preserves exit code and never imports old server', async () => {
  const entry = await fixture('failure', { buildExit: 23 });
  const result = spawnSync(process.execPath, [entry], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 23);
  assert.match(result.stderr, /빌드 실패/);
  assert.doesNotMatch(result.stdout, /SERVER_IMPORTED|LISTEN/);
});
test('occupied port is an explicit nonzero error, never a fallback', async () => {
  const entry = await fixture('occupied', { occupied: true });
  const result = spawnSync(process.execPath, [entry, '--port', '3120'], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /127\.0\.0\.1:3120.*EADDRINUSE/);
  assert.doesNotMatch(result.stdout, /LISTEN/);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  test(`${signal}: loopback ignores HOST/PORT, fresh fixed build and both close calls`, { timeout: 10000 }, async () => {
    const entry = await fixture(signal);
    const child = spawn(process.execPath, [entry], {
      cwd: root, env: { ...process.env, HOST: '0.0.0.0', PORT: '65535' },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let stdout = '', stderr = '', sent = false;
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (!sent && stdout.includes('LISTEN')) { sent = true; child.send(signal); }
    });
    child.stderr.on('data', chunk => { stderr += chunk; });
    const timer = setTimeout(() => child.kill(), 8000);
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    clearTimeout(timer);
    assert.equal(code, 0, stderr);
    assert.match(stdout, /BUILD_ARGS \["--out-dir","artifacts\/local-server-build"\]/);
    assert.match(stdout, /LISTEN {"port":3102,"host":"127.0.0.1"}/);
    assert.match(stdout, /artifacts[\\/]local-server-build[\\/]public/);
    assert.match(stdout, /SERVER_CLOSE/);
    assert.match(stdout, /CONNECTIONS_CLOSE/);
  });
}
