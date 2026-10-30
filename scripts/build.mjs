import { cp, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve, sep } from 'node:path';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--out-dir')) {
  throw new Error('Usage: node scripts/build.mjs [--out-dir artifacts/<build-directory>]');
}
const output = resolve(root, args[1] ?? 'dist');
const relativeOutput = relative(root, output);
if (relativeOutput !== 'dist' && !relativeOutput.startsWith(`artifacts${sep}`)) {
  throw new Error('Build output must be dist or a directory inside artifacts.');
}
const compiler = join(dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
const result = spawnSync(process.execPath, [compiler, '-p', 'tsconfig.json', '--outDir', output], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
await mkdir(join(output, 'public'), { recursive: true });
await cp(join(root, 'public'), join(output, 'public'), { recursive: true, filter: (source) => !source.endsWith('.ts') });
await cp(join(output, 'src/client'), join(output, 'public/scripts'), { recursive: true });
console.log(`Build complete: ${relativeOutput}/public + ${relativeOutput}/src/server/index.js`);
