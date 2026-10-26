import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const host = '127.0.0.1';
const buildDirectory = 'artifacts/local-server-build';

/** CLI-only configuration: deliberately never consult HOST or PORT. */
export function parsePort(args = []) {
  if (args.length === 0) return 3102;
  if (args.length !== 2 || args[0] !== '--port' ||
      typeof args[1] !== 'string' || !/^\d+$/.test(args[1])) {
    throw new Error('사용법: node scripts/serve_local.mjs [--port <1-65535>]');
  }
  const port = Number(args[1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('포트는 1~65535의 정수여야 합니다.');
  }
  return port;
}

async function main() {
  const port = parsePort(process.argv.slice(2));
  console.log('현재 게임 소스를 빌드합니다. 기존 실행본으로 대체하지 않습니다.');
  const build = spawnSync(process.execPath,
    [resolve(root, 'scripts/build.mjs'), '--out-dir', buildDirectory],
    { cwd: root, stdio: 'inherit', shell: false });
  if (build.error || build.status !== 0) {
    const error = new Error(`로컬 게임 빌드 실패 (${build.error?.message ?? build.signal ?? build.status ?? 'unknown'}). 서버를 시작하지 않습니다.`);
    error.exitCode = Number.isInteger(build.status) && build.status > 0 ? build.status : 1;
    throw error;
  }

  const { createGameServer } = await import(pathToFileURL(
    resolve(root, buildDirectory, 'src/server/index.js')).href);
  const server = createGameServer(resolve(root, buildDirectory, 'public'));
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close();
    server.closeAllConnections();
  };
  const removeSignals = () => {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  };
  server.once('close', removeSignals);
  server.on('error', error => {
    removeSignals();
    console.error(error.code === 'EADDRINUSE'
      ? `로컬 서버 오류: ${host}:${port} 포트가 이미 사용 중입니다 (EADDRINUSE). 기존 프로세스는 종료하지 않습니다. --port로 명시적으로 다른 포트를 선택하세요.`
      : `로컬 서버 오류 (${error.code ?? 'unknown'}): ${error.message}`);
    process.exitCode = 1;
  });
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  server.listen(port, host, () => {
    console.log(`SimpleGames 실제 게임 — http://${host}:${port}/`);
    console.log('이 컴퓨터에서만 접근합니다. Ctrl+C로 종료합니다.');
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : '로컬 서버 실행 오류');
    process.exitCode = error?.exitCode ?? 1;
  });
}
