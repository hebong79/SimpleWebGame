import { createServer, type Server } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon',
};
export const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const within = (root: string, target: string): boolean => {
  const rel = relative(root, target);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};

/** A read-only server; only the compiled public tree is reachable. */
export function createGameServer(publicDirectory: string): Server {
  const root = resolve(publicDirectory);
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-cache');
    const fail = (code: number, message: string): void => {
      res.statusCode = code;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(req.method === 'HEAD' ? undefined : message);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      fail(405, 'Method not allowed');
      return;
    }
    try {
      const raw = (req.url ?? '/').split(/[?#]/, 1)[0];
      if (!raw.startsWith('/') || raw.startsWith('//')) {
        fail(400, 'Invalid path'); return;
      }
      let pathname: string;
      try { pathname = decodeURIComponent(raw); }
      catch { fail(400, 'Invalid path'); return; }
      // Reject encoded-twice paths, Windows syntax, dotfiles and traversal
      // before a URL parser can normalize away evidence of traversal.
      if (/[\u0000-\u001f\\:%]/.test(pathname) ||
          pathname.split('/').some((part) => part.startsWith('.'))) {
        fail(400, 'Invalid path'); return;
      }
      const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
      const type = MIME[extname(requested).toLowerCase()];
      if (!type) { fail(404, 'Not found'); return; }
      const candidate = resolve(root, requested);
      if (!within(root, candidate)) { fail(403, 'Forbidden'); return; }
      const [realRoot, realTarget] = await Promise.all([realpath(root), realpath(candidate)]);
      if (!within(realRoot, realTarget)) { fail(403, 'Forbidden'); return; }
      const info = await stat(realTarget);
      if (!info.isFile() || info.size > 5 * 1024 * 1024) {
        fail(404, 'Not found'); return;
      }
      const content = req.method === 'HEAD' ? undefined : await readFile(realTarget);
      res.statusCode = 200;
      res.setHeader('Content-Type', type);
      res.setHeader('Content-Length', info.size);
      res.end(content);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      fail(code === 'ENOENT' || code === 'ENOTDIR' ? 404 : 500,
        code === 'ENOENT' || code === 'ENOTDIR' ? 'Not found' : 'Unable to serve file');
    }
  });
}

export function parseOptions(args: string[], env: NodeJS.ProcessEnv = process.env): {host: string; port: number} {
  let host = env.HOST ?? '127.0.0.1';
  let portText = env.PORT ?? '3101';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--host' && args[i + 1]) host = args[++i];
    else if (args[i] === '--port' && args[i + 1]) portText = args[++i];
    else throw new Error('Use --host <address> and --port <1-65535>');
  }
  if (!/^\d+$/.test(portText) || !Number.isInteger(Number(portText)) || Number(portText) < 1 || Number(portText) > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }
  if (!['127.0.0.1', 'localhost', '::1', '0.0.0.0'].includes(host)) {
    throw new Error('HOST must be 127.0.0.1, localhost, ::1, or explicitly 0.0.0.0 for LAN');
  }
  return { host, port: Number(portText) };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const { host, port } = parseOptions(process.argv.slice(2));
    const publicRoot = fileURLToPath(new URL('../../public/', import.meta.url));
    const server = createGameServer(publicRoot);
    server.on('error', (error: NodeJS.ErrnoException) => {
      console.error(error.code === 'EADDRINUSE'
        ? `Port ${port} is in use. Choose another with --port.`
        : `Server could not start (${error.code ?? 'unknown'}).`);
      process.exitCode = 1;
    });
    server.listen(port, host, () => {
      console.log(`숫자 정원 · 2048 — http://${host === '::1' ? '[::1]' : host}:${port}`);
      if (host === '0.0.0.0') console.log('LAN mode: reachable on your local network. Do not expose this port to the Internet.');
    });
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.on(signal, () => { server.close(); server.closeAllConnections(); });
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Server configuration error');
    process.exitCode = 1;
  }
}
