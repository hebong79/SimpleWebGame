import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
export function missingPrerequisites(build = process.env.GAME_TEST_BUILD_DIR) {
  const required = [
    'docs/G022_07_IMPLEMENTATION.md', 'docs/G022_08_IMPLEMENTATION.md',
    ...['07-dino', '08-doodle'].flatMap(game => ['index.html', 'main.mjs', 'engine.mjs', 'save.mjs', 'styles.css', 'assets/kit.svg']
      .map(file => `public/games/${game}/${file}`)),
  ];
  if (build) required.push(`${build}/src/server/index.js`, ...['07-dino', '08-doodle'].flatMap(game =>
    ['index.html', 'main.mjs', 'engine.mjs', 'save.mjs', 'styles.css', 'assets/kit.svg'].map(file => `${build}/public/games/${game}/${file}`)));
  else required.push('GAME_TEST_BUILD_DIR (explicit new G022 candidate build)');
  return required.filter(path => !existsSync(resolve(root, path)));
}
export default async function readiness() {
  const missing = missingPrerequisites();
  if (missing.length) throw new Error(`G022 BLOCKED: approved 07/08 root intake and candidate build are required; nothing is skipped or stubbed.\n${missing.join('\n')}`);
  const build = resolve(root, process.env.GAME_TEST_BUILD_DIR);
  const actual = realpathSync(build), rel = relative(realpathSync(root), actual);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) throw new Error('Candidate build escapes repository.');
  for (const game of ['07-dino', '08-doodle']) {
    for (const file of ['index.html', 'main.mjs', 'engine.mjs', 'save.mjs', 'styles.css', 'assets/kit.svg']) {
      const source = readFileSync(resolve(root, `public/games/${game}/${file}`));
      const built = readFileSync(resolve(build, `public/games/${game}/${file}`));
      if (!source.equals(built)) throw new Error(`Candidate/source byte mismatch: ${game}/${file}`);
    }
  }
  // This local preflight is not production byte/PID/LISTEN verification or 07 lifecycle acceptance.
}
