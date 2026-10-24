import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

// Loopback-only preview. The validated static handler confines each route to its own root.
try {
  const args = process.argv.slice(2);
  let port = 3102;
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--port' || !/^\d+$/.test(args[1])) {
      throw new Error('사용법: npm run preview -- --port <1-65535>');
    }
    port = Number(args[1]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('포트는 1~65535의 정수여야 합니다.');
    }
  }

  let createGameServer;
  try {
    ({ createGameServer } = await import('../dist/src/server/index.js'));
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error('기존 서버 빌드가 없습니다. npm run build 실행 후 다시 시도하세요.');
    }
    throw error;
  }

  const prototype = createGameServer(fileURLToPath(new URL('../docs/prototype/', import.meta.url)));
  const assets = createGameServer(fileURLToPath(new URL('../public/assets/', import.meta.url)));
  const assetPrefix = '/public/assets/';
  const server = createServer((req, res) => {
    if ((req.url ?? '').startsWith(assetPrefix)) {
      req.url = req.url.slice('/public/assets'.length);
      assets.emit('request', req, res);
    } else {
      prototype.emit('request', req, res);
    }
  });

  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE'
      ? `${port} 포트가 사용 중입니다. --port로 다른 포트를 선택하세요.`
      : `미리보기 서버를 시작하지 못했습니다 (${error.code ?? 'unknown'}).`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`작은 쉼표 · 홈 시안 — http://127.0.0.1:${port}/`);
    console.log('이 컴퓨터에서만 접근하는 로컬 미리보기입니다. Ctrl+C로 종료합니다.');
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => { server.close(); server.closeAllConnections(); });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : '미리보기 설정 오류');
  process.exitCode = 1;
}
