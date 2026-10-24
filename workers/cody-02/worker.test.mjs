import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { parseArgs, loadContext, resolveTask, acquireLock, buildArgs, execute, redact } from './worker.mjs';

// Explicit mocks only. No Codex executable/model is invoked by this suite.
const scratch = 'C:/Users/hebon/AppData/Local/hermes/cache/scratch/cody-02-cw2-fix-tests';
const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const forbidden = '01a16428-a3ce-7a10-a8b6-73d159372174';
function fixture(t, state) {
  fs.mkdirSync(scratch, { recursive: true });
  const root = fs.mkdtempSync(path.join(scratch, 'unit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'workers', 'cody-02');
  fs.mkdirSync(dir, { recursive: true });
  const config = { schemaVersion: 1, workerId: 'cody-02', displayName: '코디 02', pm: '대현자',
    projectRoot: root, model: 'gpt-6.1-sol', codexExecutable: path.join(root, 'DO-NOT-INVOKE.exe'),
    defaultSandbox: 'read-only', mode: 'on-demand', timeoutSeconds: 0.1, forbiddenSessionIds: [forbidden] };
  fs.writeFileSync(path.join(dir, 'worker.json'), JSON.stringify(config));
  fs.writeFileSync(path.join(root, 'task.md'), '# test task\nRead only.');
  if (state) fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ workerId: 'cody-02', sessionId: state }));
  return { root, dir, config, ctx: () => loadContext(dir) };
}
function mock(options = {}) {
  const calls = [], stopped = [];
  function spawn(exe, args, spawnOptions) {
    const child = new EventEmitter();
    child.pid = 123456789; // Sentinel, never passed to native taskkill.
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    let prompt = '';
    child.stdin = new Writable({ write(chunk, encoding, next) { prompt += chunk; next(); } });
    let closed = false;
    child.close = (code = 0) => { if (!closed) { closed = true; child.stdout.end(); child.stderr.end(); child.emit('close', code, null); } };
    calls.push({ exe, args, spawnOptions, child, get prompt() { return prompt; } });
    child.stdin.on('finish', () => setImmediate(() => {
      if (options.spawnError) { child.emit('error', new Error('SECRET=never-print-this')); return; }
      if (options.hang) return;
      const challenge = /"challenge":"([a-f0-9]+)"/.exec(prompt)?.[1];
      const final = options.final ?? (challenge ? JSON.stringify({ worker_id: 'cody-02', pm: '대현자', challenge, status: 'ready', tools_used: false }) : 'Mock result; not model evidence.');
      const events = options.events ?? [
        { type: 'thread.started', thread_id: options.id ?? id },
        { type: 'item.completed', item: { type: 'agent_message', text: final } },
        { type: 'turn.completed' }
      ];
      if (!options.noFile) fs.writeFileSync(args[args.indexOf('-o') + 1], options.output ?? final);
      for (const event of events) child.stdout.write(JSON.stringify(event) + '\n');
      if (options.stderr) {
        // Split a secret across chunks; the runner must redact after line assembly.
        child.stderr.write(options.stderr.slice(0, 10)); child.stderr.write(options.stderr.slice(10) + '\n');
      }
      child.close(options.code ?? 0);
    }));
    return child;
  }
  return { spawn, stop(child) { stopped.push(child); setImmediate(() => child.close(null)); }, calls, stopped };
}
const run = { command: 'run', task: 'task.md', allowWrite: false };
const smoke = { command: 'smoke', allowWrite: false };
function resultDir(f, result) { return path.join(f.dir, 'runs', result.runId); }

test('CLI strict parsing, empty/missing/duplicate/unknown flags rejected', () => {
  assert.deepEqual(parseArgs(['run', '--task', 'a.md']), { command: 'run', task: 'a.md', allowWrite: false });
  assert.equal(parseArgs(['run', '--allow-write', '--task', 'a.md']).allowWrite, true);
  for (const args of [[], ['foo'], ['run'], ['run', '--task', ''], ['run', '--task'], ['status', '--allow-write'], ['smoke', '--task', 'a.md'], ['run', '--task', 'a.md', '--last'], ['run', '--task', 'a.md', '--allow-write', '--allow-write'], ['run', '--task', 'a.md', '--task', 'b.md']]) assert.throws(() => parseArgs(args));
});
test('task containment, .., extension, empty and directory rejected before spawn', async t => {
  const f = fixture(t); const deps = mock();
  fs.writeFileSync(path.join(f.root, 'empty.md'), '  ');
  fs.mkdirSync(path.join(f.root, 'directory.md'));
  for (const task of ['../outside.md', 'x/../task.md', 'a.txt', 'empty.md', 'directory.md', path.join(scratch, 'outside.md')]) {
    await assert.rejects(execute(f.ctx(), { ...run, task }, deps));
  }
  assert.equal(deps.calls.length, 0); assert.equal(fs.existsSync(path.join(f.dir, 'run.lock')), false);
  assert.equal(resolveTask(f.root, 'task.md').text.startsWith('# test'), true);
});
test('junction/symlink task escape and output escape are rejected', async t => {
  const f = fixture(t);
  const outside = fs.mkdtempSync(path.join(scratch, 'unit-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outside, 'task.md'), 'outside');
  fs.symlinkSync(outside, path.join(f.root, 'escape'), 'junction');
  assert.throws(() => resolveTask(f.root, 'escape/task.md'), /symlink/);
  fs.symlinkSync(outside, path.join(f.dir, 'runs'), 'junction');
  await assert.rejects(execute(f.ctx(), run, mock()), /runner_error/);
  assert.equal(fs.existsSync(path.join(f.dir, 'run.lock')), false);
  assert.deepEqual(fs.readdirSync(outside), ['task.md']);
});
test('config root and literal model validation; default timeout 180', t => {
  const f = fixture(t); const file = path.join(f.dir, 'worker.json');
  fs.writeFileSync(file, JSON.stringify({ ...f.config, timeoutSeconds: undefined }));
  assert.equal(f.ctx().timeoutSeconds, 180);
  fs.writeFileSync(file, JSON.stringify({ ...f.config, model: 'gp6.1sol' })); assert.throws(f.ctx, /invalid_worker_config/);
  fs.writeFileSync(file, JSON.stringify({ ...f.config, projectRoot: scratch })); assert.throws(f.ctx, /invalid_worker_config/);
});
test('exact UUID state validation and forbidden existing Cody rejected', t => {
  const f = fixture(t);
  for (const sessionId of [forbidden, forbidden.toUpperCase(), `${id}-extra`, 'name', '--last', '', 123]) {
    fs.writeFileSync(path.join(f.dir, 'state.json'), JSON.stringify({ workerId: 'cody-02', sessionId }));
    assert.throws(f.ctx, /session_id/);
  }
});
test('duplicate/stale lock never removed; owner only cleanup', t => {
  const f = fixture(t); const ctx = f.ctx(); const file = path.join(f.dir, 'run.lock');
  const release = acquireLock(ctx); assert.throws(() => acquireLock(ctx), /run_locked/); release();
  assert.equal(fs.existsSync(file), false);
  const release2 = acquireLock(ctx); fs.writeFileSync(file, '{"token":"someone-else","pid":1}'); release2();
  assert.equal(fs.existsSync(file), true); assert.throws(() => acquireLock(ctx), /run_locked/);
});
test('new run uses shell:false, exact cwd/model/read-only and archives artifacts', async t => {
  const f = fixture(t); const ctx = f.ctx(); const deps = mock(); const result = await execute(ctx, run, deps);
  assert.equal(result.status, 'succeeded');
  const call = deps.calls[0];
  assert.equal(call.exe, f.config.codexExecutable); assert.equal(call.spawnOptions.cwd, f.root); assert.equal(call.spawnOptions.shell, false);
  assert.deepEqual(call.args.slice(0, 7), ['-a', 'never', '-s', 'read-only', '-m', 'gpt-6.1-sol', 'exec']);
  assert.equal(call.args.includes('resume'), false); assert.equal(JSON.stringify(call).includes(forbidden), false);
  assert.equal(call.args.includes('--skip-git-repo-check'), true); assert.equal(call.args.includes('--json'), true);
  assert.equal(call.args.some(x => x.includes('dangerously')), false);
  assert.match(call.prompt, /자격증명/); assert.match(call.prompt, /대현자/); assert.match(call.prompt, /OS 보안 격리가 아닙니다/);
  assert.deepEqual(fs.readdirSync(resultDir(f, result)).sort(), ['request.json', 'response.md', 'result.json', 'stderr.log', 'stdout.jsonl']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir, 'state.json'))).sessionId, id);
  assert.match(fs.readFileSync(path.join(f.dir, 'LATEST.log'), 'utf8'), /succeeded/);
  assert.match(fs.readFileSync(path.join(f.dir, 'STATUS.md'), 'utf8'), /succeeded/);
  assert.equal(fs.existsSync(path.join(f.dir, 'run.lock')), false);
});
test('exact resume ID; workspace-write only explicit; successive run dirs differ', async t => {
  const f = fixture(t, id); const deps = mock(); const ctx = f.ctx();
  const result = await execute(ctx, { ...run, allowWrite: true }, deps);
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(deps.calls[0].args.slice(0, 9), ['-a', 'never', '-s', 'workspace-write', '-m', 'gpt-6.1-sol', 'exec', 'resume', id]);
  const second = await execute(f.ctx(), run, mock()); assert.notEqual(result.runId, second.runId);
  assert.equal(buildArgs(f.ctx(), smoke, 'out.md')[3], 'read-only');
});
for (const [name, options, expected] of [
  ['forbidden native ID', { id: forbidden }, 'invalid_or_mismatched_thread'],
  ['malformed native ID', { id: `${id}extra` }, 'invalid_or_mismatched_thread'],
  ['resume ID mismatch', { id: other }, 'invalid_or_mismatched_thread'],
  ['turn.failed', { events: [{ type: 'turn.failed', error: { message: 'secret' } }] }, 'codex_turn_failed'],
  ['nonzero exit', { code: 7 }, 'nonzero_exit'],
  ['missing final', { final: '' }, 'missing_final_message'],
  ['missing -o output', { noFile: true }, 'missing_response_file'],
  ['output mismatch', { output: 'not the event text' }, 'response_mismatch'],
  ['missing native ID', { events: [{ type: 'turn.completed' }] }, 'missing_thread_started']
]) test(`failure: ${name}; preserve previous session`, async t => {
  const f = fixture(t, id); const result = await execute(f.ctx(), run, mock(options));
  assert.equal(result.status, 'failed'); assert.equal(result.error, expected);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir, 'state.json'))).sessionId, id);
  assert.equal(fs.existsSync(path.join(f.dir, 'run.lock')), false);
});
test('new invalid/forbidden ID never stored', async t => {
  const f = fixture(t); const result = await execute(f.ctx(), run, mock({ id: forbidden }));
  assert.equal(result.status, 'failed'); assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir, 'state.json'))).sessionId, null);
});
test('timeout stops only own spawned mock and releases lock', async t => {
  const f = fixture(t, id); const deps = mock({ hang: true });
  const result = await execute(f.ctx(), run, deps);
  assert.equal(result.error, 'timeout'); assert.deepEqual(deps.stopped, [deps.calls[0].child]);
  assert.equal(fs.existsSync(path.join(f.dir, 'run.lock')), false);
});
test('asynchronous spawn error and synchronous spawn throw cleanup', async t => {
  const f = fixture(t, id); const deps = mock({ spawnError: true });
  const first = await execute(f.ctx(), run, deps); assert.equal(first.error, 'spawn_error');
  assert.equal(fs.existsSync(path.join(f.dir, 'run.lock')), false);
  const second = await execute(f.ctx(), run, { spawn() { throw new Error('API_KEY=do-not-leak'); } });
  assert.equal(second.error, 'spawn_error'); assert.equal(fs.existsSync(path.join(f.dir, 'run.lock')), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir, 'state.json'))).sessionId, id);
});
test('smoke checks challenge/identity/ready/no-tools; not real model evidence', async t => {
  const f = fixture(t); const deps = mock(); const result = await execute(f.ctx(), smoke, deps);
  assert.equal(result.status, 'succeeded'); assert.match(result.challenge, /^[a-f0-9]{40}$/); assert.equal(result.toolEvents, 0);
  const bad = await execute(f.ctx(), smoke, mock({ final: '{"status":"ready"}' })); assert.equal(bad.error, 'smoke_handshake_failed');
  const tool = await execute(f.ctx(), smoke, mock({ events: [{ type: 'thread.started', thread_id: id }, { type: 'item.started', item: { type: 'command_execution', command: 'do not run' } }] }));
  assert.equal(tool.error, 'smoke_tool_event');
});
test('recognizable secrets redacted in stdout/stderr/response/request, no env dump', async t => {
  const f = fixture(t); const secret = 'sk-unitsecretvalue123456';
  fs.writeFileSync(path.join(f.root, 'task.md'), `# Test\nAPI_KEY=${secret}`);
  const result = await execute(f.ctx(), run, mock({ final: `API_KEY=${secret}`, stderr: `TOKEN=${secret}` }));
  assert.equal(result.status, 'succeeded');
  for (const name of fs.readdirSync(resultDir(f, result))) {
    const content = fs.readFileSync(path.join(resultDir(f, result), name), 'utf8');
    assert.equal(content.includes(secret), false, name); assert.equal(content.includes('process.env'), false);
  }
  assert.equal(redact('Authorization: Bearer abc123 TOKEN=topsecret').includes('topsecret'), false);
});

test('concurrent invocation fails before spawn and leaves active owner lock intact', async t => {
  const f = fixture(t); const deps = mock(); const release = acquireLock(f.ctx());
  await assert.rejects(execute(f.ctx(), run, deps), /run_locked/);
  assert.equal(deps.calls.length, 0); assert.equal(fs.existsSync(path.join(f.dir, 'run.lock')), true);
  release(); assert.equal(fs.existsSync(path.join(f.dir, 'run.lock')), false);
});
test('stale in-memory state is reloaded under lock before selecting new/resume', async t => {
  const f = fixture(t); const stale = f.ctx(); await execute(f.ctx(), run, mock());
  const deps = mock(); const result = await execute(stale, run, deps);
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(deps.calls[0].args.slice(7, 9), ['resume', id]);
});
test('smoke cannot opt into writes, even through the internal API', async t => {
  const f = fixture(t); const deps = mock();
  await assert.rejects(execute(f.ctx(), { ...smoke, allowWrite: true }, deps), /invalid_execution_options/);
  assert.equal(deps.calls.length, 0);
});
test('commentary-only agent message is not accepted as a final response', async t => {
  const f = fixture(t);
  const result = await execute(f.ctx(), run, mock({ events: [
    { type: 'thread.started', thread_id: id },
    { type: 'item.completed', item: { type: 'agent_message', text: 'still working', phase: 'commentary' } },
    { type: 'turn.completed' }
  ] }));
  assert.equal(result.error, 'missing_final_message');
});

test('CW2-S1: plain quoted/unquoted credential assignments and authorization are masked', () => {
  const dummy = 'dummy-test-secret-123';
  for (const text of [
    `API_KEY="${dummy}"`, `TOKEN='${dummy}'`, `PASSWORD=${dummy}`, `SECRET="${dummy} with spaces"`,
    `API_KEY="${dummy}\\"escaped\\path\nsecond line"`, `TOKEN='${dummy}\\'escaped'`,
    `Authorization: Bearer ${dummy}`, `Authorization: Basic ${dummy}`, `Bearer ${dummy}`,
    `https://dummy-user:${dummy}@example.invalid`, `sk-dummy-test-secret-123`
  ]) {
    const masked = redact(text);
    assert.equal(masked.includes(dummy), false, 'dummy credential must not survive');
    assert.match(masked, /\[REDACTED\]/);
  }
  assert.equal(redact(`API_KEY="${dummy}"`), 'API_KEY="[REDACTED]"');
  assert.equal(redact(`TOKEN='${dummy}'`), "TOKEN='[REDACTED]'");
});

test('CW2-S1/L1: serialized and nested JSON mask values without damaging metadata', () => {
  const dummy = 'dummy-test-secret-123';
  const metadata = { total: 17, input_tokens: 11, output_tokens: 6, sessionId: id,
    challenge: 'dummy-challenge', workerId: 'cody-02', pm: '대현자' };
  const source = { ...metadata, prompt: `API_KEY="${dummy}" TOKEN='${dummy}'`,
    API_KEY: dummy, access_token: dummy, PASSWORD: dummy, secret: { value: dummy },
    Authorization: `Bearer ${dummy}`, nested: [{ TOKEN: dummy, text: `PASSWORD="${dummy}"` }],
    embedded: JSON.stringify({ api_key: dummy, nested: { note: `SECRET='${dummy}'` } }) };
  const masked = redact(JSON.stringify(source));
  assert.equal(masked.includes(dummy), false);
  const parsed = JSON.parse(masked);
  for (const [key, value] of Object.entries(metadata)) assert.deepEqual(parsed[key], value, key);
  for (const key of ['API_KEY', 'access_token', 'PASSWORD', 'secret', 'Authorization']) assert.equal(parsed[key], '[REDACTED]');
  assert.equal(parsed.nested[0].TOKEN, '[REDACTED]');
  assert.equal(JSON.parse(parsed.embedded).api_key, '[REDACTED]');
});

test('CW2-L1: JSON escaping, Windows paths and newlines survive outside credential values', () => {
  const dummy = 'dummy-test-secret-123';
  const untouched = 'quote " and slash \\; C:\\dummy\\folder\\file.md\nnext line';
  const source = { untouched, nested: { text: `${untouched}\nAPI_KEY="${dummy}\\"tail\\folder\nnext"\nend` } };
  const masked = redact(JSON.stringify(source, null, 2));
  const parsed = JSON.parse(masked);
  assert.equal(masked.includes(dummy), false);
  assert.equal(parsed.untouched, untouched);
  assert.equal(parsed.nested.text, `${untouched}\nAPI_KEY="[REDACTED]"\nend`);
});

test('CW2-S1/L1: mock archives reparse request, every stdout event and JSON response', async t => {
  const f = fixture(t); const dummy = 'dummy-test-secret-123';
  fs.writeFileSync(path.join(f.root, 'task.md'), `# Dummy only\nAPI_KEY="${dummy}"\nTOKEN='${dummy}'`);
  const final = JSON.stringify({ API_KEY: dummy, text: `PASSWORD="${dummy}\\"tail\\folder\nnext"`,
    nested: [JSON.stringify({ Authorization: `Bearer ${dummy}` })], path: 'C:\\dummy\\file.md\nnext' });
  const events = [
    { type: 'thread.started', thread_id: id },
    { type: 'item.completed', item: { type: 'agent_message', text: final, nested: { token: dummy } } },
    { type: 'turn.completed', usage: { total: 17, input_tokens: 11, output_tokens: 6 } }
  ];
  const result = await execute(f.ctx(), run, mock({ final, events, stderr: `Authorization: Bearer ${dummy}` }));
  assert.equal(result.status, 'succeeded'); assert.equal(result.sessionId, id);
  const dir = resultDir(f, result);
  const request = JSON.parse(fs.readFileSync(path.join(dir, 'request.json'), 'utf8'));
  assert.match(request.prompt, /API_KEY="\[REDACTED\]"/);
  assert.equal(request.workerId, 'cody-02'); assert.equal(request.pm, '대현자');
  const archived = fs.readFileSync(path.join(dir, 'stdout.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.equal(archived.length, events.length);
  assert.equal(archived[0].thread_id, id);
  assert.deepEqual(archived[2].usage, events[2].usage);
  assert.equal(JSON.parse(archived[1].item.text).API_KEY, '[REDACTED]');
  const response = JSON.parse(fs.readFileSync(path.join(dir, 'response.md'), 'utf8'));
  assert.equal(response.API_KEY, '[REDACTED]');
  assert.equal(JSON.parse(response.nested[0]).Authorization, '[REDACTED]');
  assert.equal(response.path, 'C:\\dummy\\file.md\nnext');
  for (const name of fs.readdirSync(dir)) assert.equal(fs.readFileSync(path.join(dir, name), 'utf8').includes(dummy), false, name);
});

test('CW2 masking never turns different raw response evidence into success', async t => {
  const f = fixture(t);
  const result = await execute(f.ctx(), run, mock({ final: 'API_KEY="dummy-test-secret-123"', output: 'API_KEY="dummy-other-secret-456"' }));
  assert.equal(result.status, 'failed'); assert.equal(result.error, 'response_mismatch');
});
