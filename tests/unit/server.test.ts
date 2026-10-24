import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdir, mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createGameServer, parseOptions } from '../../src/server/index.js';

const scratch = process.env.HERMES_HOME
  ? join(process.env.HERMES_HOME, 'cache', 'scratch')
  : join(process.env.LOCALAPPDATA ?? 'C:/Users/hebon/AppData/Local', 'hermes', 'cache', 'scratch');

function fetchRaw(port: number, path: string, method = 'GET'): Promise<{ status: number; body: string; headers: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString(), headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('server options default to loopback and validate ports and explicit LAN opt-in', () => {
  assert.deepEqual(parseOptions([], {}), { host: '127.0.0.1', port: 3101 });
  assert.deepEqual(parseOptions(['--port', '3456', '--host', '0.0.0.0'], {}), { host: '0.0.0.0', port: 3456 });
  for (const port of ['0', '65536', '-1', '12x', '1.2', '']) assert.throws(() => parseOptions(['--port', port], {}));
  assert.throws(() => parseOptions(['--wat'], {}));
  assert.throws(() => parseOptions(['--host', 'example.com'], {}));
});

test('static server validates raw paths, methods, headers, MIME and symlink containment', async (t) => {
  await mkdir(scratch, { recursive: true });
  const folder = await mkdtemp(join(scratch, 'number-garden-server-'));
  const root = join(folder, 'public');
  await mkdir(join(root, 'assets'), { recursive: true });
  await writeFile(join(root, 'index.html'), '<!doctype html><title>Garden</title>');
  await writeFile(join(root, 'style.css'), 'body{color:green}');
  await mkdir(join(root, 'games', '02-snake'), { recursive: true });
  await writeFile(join(root, 'games', '02-snake', 'index.html'), '<title>Snake</title>');
  await writeFile(join(root, 'games', '02-snake', 'engine.mjs'), 'export const size = 20;');
  await writeFile(join(root, 'assets', 'leaf.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await writeFile(join(folder, 'private.html'), 'DO_NOT_SERVE');
  const server = createGameServer(root);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as AddressInfo).port;
  t.after(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); await rm(folder, { recursive: true, force: true }); });
  await t.test('GET index and query use correct headers', async () => {
    const r = await fetchRaw(port, '/?a=1');
    assert.equal(r.status, 200); assert.match(r.body, /Garden/);
    assert.match(String(r.headers['content-type']), /text\/html/);
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.match(String(r.headers['content-security-policy']), /connect-src 'none'/);
  });
  await t.test('HEAD is bodyless with content length and correct CSS/SVG types', async () => {
    const r = await fetchRaw(port, '/style.css', 'HEAD');
    assert.equal(r.status, 200); assert.equal(r.body, '');
    assert.equal(Number(r.headers['content-length']), Buffer.byteLength('body{color:green}'));
    assert.match(String(r.headers['content-type']), /text\/css/);
    assert.equal((await fetchRaw(port, '/assets/leaf.svg')).headers['content-type'], 'image/svg+xml');
  });
  await t.test('missing files and methods are not served', async () => {
    assert.equal((await fetchRaw(port, '/missing.svg')).status, 404);
    assert.equal((await fetchRaw(port, '/assets/')).status, 404);
    const r = await fetchRaw(port, '/', 'POST');
    assert.equal(r.status, 405); assert.equal(r.headers.allow, 'GET, HEAD');
    assert.equal((await fetchRaw(port, '/missing.svg', 'HEAD')).body, '');
  });
  await t.test('nested game pages and ES modules retain MIME, HEAD and CSP protections', async () => {
    assert.equal((await fetchRaw(port, '/games/02-snake/index.html')).status, 200);
    const module = await fetchRaw(port, '/games/02-snake/engine.mjs');
    assert.equal(module.status, 200);
    assert.match(String(module.headers['content-type']), /text\/javascript/);
    assert.equal(module.body, 'export const size = 20;');
    assert.match(String(module.headers['content-security-policy']), /connect-src 'none'/);
    const head = await fetchRaw(port, '/games/02-snake/engine.mjs', 'HEAD');
    assert.equal(head.status, 200); assert.equal(head.body, '');
    assert.equal(Number(head.headers['content-length']), Buffer.byteLength(module.body));
    assert.equal((await fetchRaw(port, '/games/02-snake/')).status, 404);
  });
  const attacks = ['/../private.html','/%2e%2e/private.html','/%252e%252e/private.html','/%','/%00index.html','/assets%5c..%5cprivate.html','/C:/private.html','//server/private.html','/index.html:stream','/.env','/.git/config','/../public/index.html','/src/server/index.ts','/assets/%2e%2e/%2e%2e/private.html'];
  for (const path of attacks) await t.test(`reject raw path ${path}`, async () => {
    const r = await fetchRaw(port, path); assert.ok(r.status >= 400 && r.status < 500, `${path}: ${r.status}`);
    assert.ok(!r.body.includes('DO_NOT_SERVE')); assert.ok(!r.body.includes(folder));
  });
  await t.test('outside directory junction is blocked after realpath', async () => {
    const outside = join(folder, 'outside'); await mkdir(outside); await writeFile(join(outside, 'secret.html'), 'DO_NOT_SERVE');
    await symlink(outside, join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    const r = await fetchRaw(port, '/escape/secret.html'); assert.equal(r.status, 403); assert.ok(!r.body.includes('DO_NOT_SERVE'));
  });
});
