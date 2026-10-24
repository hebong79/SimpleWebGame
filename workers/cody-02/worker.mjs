import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ownDir = path.dirname(fileURLToPath(import.meta.url));
const fail = code => { throw new Error(code); };
const sensitiveKey = /^(?:(?:[a-z0-9]+[_-])*(?:api[_-]?key|token|password|passwd|secret)|authorization)$/i;
function redactText(text) {
  return text.replace(/(\b(?:(?:[a-z0-9]+[_-])*(?:api[_-]?key|token|password|passwd|secret)|authorization)["']?\s*[:=]\s*)("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|(?:Bearer|Basic)\s+[^\s,"'}]+|[^\s,"'\r\n}]+)/gi,
    (_, prefix, value) => prefix + (/^["']/.test(value) ? `${value[0]}[REDACTED]${value[0]}` : '[REDACTED]'))
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, '[REDACTED]')
    .replace(/\bBearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@');
}
function sanitize(value) {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, sensitiveKey.test(key) ? '[REDACTED]' : sanitize(item)]));
  return value;
}
export function redact(text) {
  text = String(text);
  let value;
  try { value = JSON.parse(text); } catch { return redactText(text); }
  // Never run text regexes over serialized JSON: they can break escapes and leak values.
  return JSON.stringify(sanitize(value), null, text.includes('\n') ? 2 : undefined);
}
export function parseArgs(args) {
  const [command, ...rest] = args;
  if (!['status', 'smoke', 'run'].includes(command)) fail('usage: status | smoke | run --task <project.md> [--allow-write]');
  let task, allowWrite = false;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--task' && command === 'run' && task === undefined) {
      task = rest[++i];
      if (!task?.trim() || task.startsWith('--')) fail('invalid_task_argument');
    } else if (rest[i] === '--allow-write' && command === 'run' && !allowWrite) allowWrite = true;
    else fail('unknown_or_duplicate_argument');
  }
  if (command === 'run' && task === undefined) fail('task_required');
  return { command, task, allowWrite };
}
function inside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}
// Check every existing component, including junctions, before reading/writing.
function noLinks(root, target) {
  if (!inside(root, target)) fail('path_outside_project');
  let current = root;
  for (const part of path.relative(root, target).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) fail('symlink_not_allowed'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return target;
}
export function resolveTask(root, input) {
  if (input.split(/[\\/]/).includes('..')) fail('parent_path_not_allowed');
  const target = noLinks(root, path.resolve(root, input));
  if (path.extname(target).toLowerCase() !== '.md') fail('markdown_task_required');
  if (!inside(root, fs.realpathSync(target)) || !fs.statSync(target).isFile()) fail('invalid_task_path');
  if (fs.statSync(target).size > 1024 * 1024) fail('task_too_large');
  const text = fs.readFileSync(target, 'utf8');
  if (!text.trim()) fail('empty_task');
  return { target, text };
}
function readJSON(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
export function loadContext(workerDir = ownDir) {
  const dir = fs.realpathSync(workerDir);
  const root = fs.realpathSync(path.resolve(dir, '../..'));
  noLinks(root, dir);
  const config = readJSON(noLinks(root, path.join(dir, 'worker.json')));
  if (config.workerId !== 'cody-02' || config.pm !== '대현자' || config.model !== 'gpt-6.1-sol'
    || config.defaultSandbox !== 'read-only' || config.mode !== 'on-demand'
    || typeof config.displayName !== 'string' || !path.isAbsolute(config.codexExecutable)
    || !path.isAbsolute(config.projectRoot) || fs.realpathSync(config.projectRoot) !== root
    || path.resolve(config.projectRoot) !== root) fail('invalid_worker_config');
  if (!Array.isArray(config.forbiddenSessionIds) || !config.forbiddenSessionIds.length
    || config.forbiddenSessionIds.some(id => typeof id !== 'string' || !UUID.test(id))) fail('invalid_forbidden_sessions');
  const timeoutSeconds = config.timeoutSeconds ?? 180;
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) fail('invalid_timeout');
  function validId(id) {
    if (typeof id !== 'string' || !UUID.test(id)) fail('invalid_session_id');
    if (config.forbiddenSessionIds.some(x => x.toLowerCase() === id.toLowerCase())) fail('forbidden_session_id');
    return id;
  }
  const stateFile = noLinks(root, path.join(dir, 'state.json'));
  let state = { schemaVersion: 1, workerId: config.workerId, sessionId: null, phase: 'disconnected', lastRun: null, latestSummary: '미연결: 실제 모델 호출 미실행' };
  if (fs.existsSync(stateFile)) {
    const previous = readJSON(stateFile);
    if (previous.workerId !== config.workerId) fail('state_worker_mismatch');
    if (previous.sessionId !== null && previous.sessionId !== undefined) validId(previous.sessionId);
    state = { ...state, ...previous };
  }
  return { dir, root, config, timeoutSeconds, validId, state, stateFile };
}
function safeWrite(ctx, file, text) {
  noLinks(ctx.root, file);
  fs.writeFileSync(file, redact(text), 'utf8');
}
function publish(ctx) {
  const { state, config } = ctx;
  // Only deliberate public fields; never serialize process.env or config/auth blobs.
  const publicState = { schemaVersion: 1, workerId: config.workerId, sessionId: state.sessionId,
    phase: state.phase, lastRun: state.lastRun, latestSummary: redact(state.latestSummary), updatedAt: new Date().toISOString() };
  const temp = `${ctx.stateFile}.${randomUUID()}.tmp`;
  safeWrite(ctx, temp, JSON.stringify(publicState, null, 2) + '\n');
  noLinks(ctx.root, ctx.stateFile);
  fs.renameSync(temp, ctx.stateFile);
  safeWrite(ctx, path.join(ctx.dir, 'STATUS.md'), `# ${config.displayName}\n\n- workerId: ${config.workerId}\n- PM: ${config.pm}\n- 모델: ${config.model}\n- phase: ${state.phase}\n- sessionId: ${state.sessionId ?? '미연결'}\n- lastRun: ${state.lastRun?.runId ?? '없음'}\n- 요약: ${state.latestSummary}\n\n기본 읽기 전용 / on-demand. per-file 허용 범위는 지시이며 OS 보안 격리가 아닙니다.\n`);
}
export function acquireLock(ctx) {
  const file = noLinks(ctx.root, path.join(ctx.dir, 'run.lock'));
  const token = randomUUID();
  let fd;
  try { fd = fs.openSync(file, 'wx'); }
  catch (e) { if (e.code === 'EEXIST') fail('run_locked: active/stale lock; inspect manually, never auto-delete'); throw e; }
  try { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token, createdAt: new Date().toISOString() })); }
  finally { fs.closeSync(fd); }
  return () => {
    // Only remove a lock still bearing this invocation's ownership token.
    noLinks(ctx.root, file);
    if (fs.existsSync(file) && readJSON(file).token === token) fs.unlinkSync(file);
  };
}
export function buildArgs(ctx, options, responseFile) {
  const args = ['-a', 'never', '-s', options.allowWrite ? 'workspace-write' : 'read-only', '-m', ctx.config.model,
    'exec'];
  if (ctx.state.sessionId) args.push('resume', ctx.validId(ctx.state.sessionId));
  args.push('--skip-git-repo-check', '--json', '-o', responseFile, '-');
  return args;
}
function promptFor(ctx, options, task, challenge) {
  const rules = `\n\n[PM 계약 — 상위 작업 경계]\n당신은 ${ctx.config.pm} PM 전용 worker ${ctx.config.workerId}입니다. 허용 프로젝트: ${ctx.root}. 다른 앱/세션/기존 코디를 조회·재개·변경·종료하지 마세요. 자격증명, auth/env 파일, 토큰을 읽거나 출력하지 마세요. 환경 전체 덤프 금지. 승인 없는 네트워크·배포·설치·결제 금지. 자동 재시도/재시작/상시서비스 금지. 프로젝트 밖 쓰기 금지. per-file 허용 범위는 지시이며 OS 보안 격리가 아닙니다. ${options.allowWrite ? 'workspace-write 명시 승인: 작업 문서의 allowed_write_paths 범위만 수정하세요.' : '읽기 전용: 게임 파일을 포함한 프로젝트 파일을 수정하지 마세요.'}`;
  if (options.command === 'smoke') return `도구를 전혀 사용하지 말고 다음 JSON 하나만 그대로 최종 응답하세요. 세션 ID를 추측하거나 응답에 추가하지 마세요.\n${JSON.stringify({ worker_id: ctx.config.workerId, pm: ctx.config.pm, challenge, status: 'ready', tools_used: false })}${rules}`;
  return `${task.text}${rules}`;
}
// The injected spawn/stop are exclusively for explicit tests; CLI always uses native spawn.
export async function execute(ctx, options, deps = {}) {
  if (!['run', 'smoke'].includes(options.command) || (options.command === 'smoke' && options.allowWrite)) fail('invalid_execution_options');
  const task = options.command === 'run' ? resolveTask(ctx.root, options.task) : null;
  if (ctx.state.sessionId) ctx.validId(ctx.state.sessionId);
  const release = acquireLock(ctx);
  // Re-read only after owning the lock: a previous invocation may just have finished.
  try { ctx.state = loadContext(ctx.dir).state; } catch (e) { release(); throw e; }
  let child, timer, killTimer, deadline, stopped = false, finished = false, runDir;
  const previousId = ctx.state.sessionId;
  let seenId = null, failure = null, finalMessage = '', completed = false, toolEvents = 0;
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(5).toString('hex')}`;
  const challenge = options.command === 'smoke' ? randomBytes(20).toString('hex') : null;
  const stop = () => {
    if (!child || stopped || finished) return;
    stopped = true;
    if (deps.stop) { deps.stop(child); return; }
    if (process.platform === 'win32' && Number.isInteger(child.pid) && child.pid > 0) {
      // This is exclusively the child created below; no global process enumeration.
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
      killer.on('error', () => child.kill());
    } else child.kill('SIGTERM');
    killTimer = setTimeout(() => { if (!finished) child.kill('SIGKILL'); }, 1000);
  };
  const onSignal = () => { failure ??= 'interrupted'; stop(); };
  try {
    const runs = noLinks(ctx.root, path.join(ctx.dir, 'runs'));
    fs.mkdirSync(runs, { recursive: true });
    runDir = path.join(runs, runId);
    fs.mkdirSync(runDir);
    const responseFile = path.join(runDir, 'response.md');
    for (const file of ['stdout.jsonl', 'stderr.log', 'response.md']) fs.writeFileSync(path.join(runDir, file), '', { flag: 'wx' });
    const args = buildArgs(ctx, options, responseFile);
    const prompt = promptFor(ctx, options, task, challenge);
    safeWrite(ctx, path.join(runDir, 'request.json'), JSON.stringify({ workerId: ctx.config.workerId, pm: ctx.config.pm,
      model: ctx.config.model, command: options.command, sandbox: options.allowWrite ? 'workspace-write' : 'read-only',
      sessionMode: previousId ? 'resume' : 'new', sessionId: previousId, task: task ? path.relative(ctx.root, task.target) : null,
      challenge, prompt }, null, 2));
    ctx.state.lastRun = { runId, command: options.command, startedAt: new Date().toISOString(), phase: 'running' };
    ctx.state.phase = 'running'; ctx.state.latestSummary = 'Codex 실행 중';
    safeWrite(ctx, path.join(ctx.dir, 'LATEST.log'), `${runId} running\n`); publish(ctx);
    function progress(label) {
      fs.appendFileSync(noLinks(ctx.root, path.join(ctx.dir, 'LATEST.log')), `${new Date().toISOString()} ${label}\n`);
      ctx.state.latestSummary = label; publish(ctx);
    }
    function event(line) {
      if (finished) return;
      let e;
      try { e = JSON.parse(line); } catch { failure ??= 'invalid_json_event'; stop(); return; }
      if (e.type === 'thread.started') {
        if (failure) return;
        try {
          const id = ctx.validId(e.thread_id);
          if ((previousId && id !== previousId) || (seenId && id !== seenId)) fail('session_mismatch');
          seenId = id; ctx.state.sessionId = id; progress('thread.started: 네이티브 세션 ID 검증 완료');
        } catch { failure ??= 'invalid_or_mismatched_thread'; stop(); }
      }
      if (e.type === 'turn.failed' || e.type === 'error') { failure ??= 'codex_turn_failed'; stop(); }
      if (e.type === 'turn.completed') completed = true;
      if (e.type?.startsWith('item.') && e.item) {
        if (!['agent_message', 'reasoning'].includes(e.item.type)) {
          toolEvents++;
          if (options.command === 'smoke') { failure ??= 'smoke_tool_event'; stop(); }
        }
        if (e.type === 'item.completed' && e.item.type === 'agent_message' && e.item.phase !== 'commentary') finalMessage = e.item.text ?? '';
      }
      if (e.type !== 'thread.started') progress(`event: ${/^[a-z._]+$/.test(e.type ?? '') ? e.type : 'unknown'}`);
    }
    function capture(stream, file, parse) {
      let pending = '';
      stream.setEncoding('utf8');
      const consume = line => { fs.appendFileSync(noLinks(ctx.root, file), redact(line) + '\n'); if (parse && line.trim()) event(line); };
      stream.on('data', chunk => {
        try {
          pending += chunk;
          let i;
          while ((i = pending.indexOf('\n')) >= 0) { const line = pending.slice(0, i).replace(/\r$/, ''); pending = pending.slice(i + 1); consume(line); }
          if (pending.length > 2 * 1024 * 1024) { pending = ''; failure ??= 'event_line_too_large'; stop(); }
        } catch { failure ??= 'log_write_failed'; stop(); }
      });
      return () => { if (pending) { consume(pending); pending = ''; } };
    }
    process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
    const exit = await new Promise(resolve => {
      let settled = false;
      const settle = value => { if (!settled) { settled = true; resolve(value); } };
      try { child = (deps.spawn ?? spawn)(ctx.config.codexExecutable, args, { cwd: ctx.root, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); }
      catch { failure = 'spawn_error'; settle({ code: null }); return; }
      const flushOut = capture(child.stdout, path.join(runDir, 'stdout.jsonl'), true);
      const flushErr = capture(child.stderr, path.join(runDir, 'stderr.log'), false);
      child.on('error', () => {
        failure ??= 'spawn_error'; stop();
        // Native spawn emits close after error; wait so no callbacks outlive the lock.
        deadline = setTimeout(() => { finished = true; settle({ code: null }); }, 2000);
      });
      child.on('close', (code, signal) => {
        try { flushOut(); flushErr(); } catch { failure ??= 'log_write_failed'; }
        finished = true;
        settle({ code, signal });
      });
      child.stdin.on('error', () => { failure ??= 'stdin_error'; stop(); });
      child.stdin.end(prompt);
      timer = setTimeout(() => { failure ??= 'timeout'; stop();
        // Never hang forever on a broken spawn adapter/OS close notification.
        deadline = setTimeout(() => { finished = true; settle({ code: null }); }, 2000);
      }, ctx.timeoutSeconds * 1000);
    });
    if (exit.code !== 0) failure ??= 'nonzero_exit';
    if (!seenId) failure ??= 'missing_thread_started';
    if (!completed) failure ??= 'missing_turn_completed';
    if (!finalMessage.trim()) failure ??= 'missing_final_message';
    const output = fs.readFileSync(noLinks(ctx.root, responseFile), 'utf8');
    if (!output.trim()) failure ??= 'missing_response_file';
    if (output.trim() !== finalMessage.trim()) failure ??= 'response_mismatch';
    if (options.command === 'smoke') {
      try {
        const obj = JSON.parse(finalMessage);
        if (obj.worker_id !== ctx.config.workerId || obj.pm !== ctx.config.pm || obj.challenge !== challenge
          || obj.status !== 'ready' || obj.tools_used !== false || toolEvents !== 0
          || Object.keys(obj).length !== 5) fail('smoke_handshake_failed');
      } catch { failure ??= 'smoke_handshake_failed'; }
    }
    safeWrite(ctx, responseFile, output);
    const result = { runId, workerId: ctx.config.workerId, command: options.command,
      status: failure ? 'failed' : 'succeeded', error: failure, exitCode: exit.code, sessionId: seenId,
      challenge, toolEvents, completed, finishedAt: new Date().toISOString() };
    safeWrite(ctx, path.join(runDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    ctx.state.phase = result.status;
    ctx.state.lastRun = { ...ctx.state.lastRun, phase: result.status, finishedAt: result.finishedAt, error: failure };
    ctx.state.latestSummary = failure ? `실패: ${failure}` : (options.command === 'smoke' ? 'handshake 검증 완료 (도구 미사용)' : '작업 완료');
    publish(ctx); fs.appendFileSync(path.join(ctx.dir, 'LATEST.log'), `${result.status}${failure ? `: ${failure}` : ''}\n`);
    return result;
  } catch {
    stop();
    if (runDir) {
      try {
        const response = noLinks(ctx.root, path.join(runDir, 'response.md'));
        if (fs.existsSync(response)) safeWrite(ctx, response, fs.readFileSync(response, 'utf8'));
      } catch { /* Never follow an unsafe output link, even during failure cleanup. */ }
    }
    ctx.state.phase = 'failed'; ctx.state.latestSummary = '실패: runner_error';
    if (ctx.state.lastRun?.runId === runId) ctx.state.lastRun = { ...ctx.state.lastRun, phase: 'failed', error: 'runner_error', finishedAt: new Date().toISOString() };
    if (runDir) safeWrite(ctx, path.join(runDir, 'result.json'), JSON.stringify({ runId, status: 'failed', error: 'runner_error', sessionId: seenId }));
    publish(ctx);
    throw new Error('runner_error');
  } finally {
    clearTimeout(timer); clearTimeout(killTimer); clearTimeout(deadline);
    process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
    release();
  }
}
export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const ctx = loadContext();
  if (options.command === 'status') {
    const lock = noLinks(ctx.root, path.join(ctx.dir, 'run.lock'));
    if (!fs.existsSync(lock)) {
      const release = acquireLock(ctx);
      try {
        ctx.state = loadContext(ctx.dir).state; publish(ctx);
        const latest = noLinks(ctx.root, path.join(ctx.dir, 'LATEST.log'));
        if (!fs.existsSync(latest)) safeWrite(ctx, latest, `${ctx.state.phase}: ${ctx.state.latestSummary}\n`);
      } finally { release(); }
    }
    console.log(JSON.stringify({ workerId: ctx.config.workerId, phase: ctx.state.phase,
      sessionId: ctx.state.sessionId, lastRun: ctx.state.lastRun, latestSummary: redact(ctx.state.latestSummary), locked: fs.existsSync(lock) }, null, 2));
    return 0;
  }
  const result = await execute(ctx, options);
  console.log(JSON.stringify(result, null, 2));
  return result.status === 'succeeded' ? 0 : 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(() => { console.error('cody-02: 요청 거부 또는 실행 실패 (설정·경로·state·run.lock을 확인하세요). 비밀값은 출력하지 않습니다.'); process.exitCode = 1; });
}
