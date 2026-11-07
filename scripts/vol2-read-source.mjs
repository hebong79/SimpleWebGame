// Read-only review helper, restricted to the new game sources in this project.
import { readFile } from 'node:fs/promises';
const paths=process.argv.slice(2);
if(!paths.length||paths.length>12)throw new Error('Provide 1~12 Vol. 2 source paths.');
for(const path of paths){
 if(!/^(?:vol2|(?:2[1-9]|3\d|40)-[a-z-]+)\/[a-zA-Z0-9_.-]+\.(?:mjs|css|html)$/.test(path))throw new Error(`Not an allowed source path: ${path}`);
 console.log(`\nFILE public/games/${path}\n${await readFile(new URL(`../public/games/${path}`,import.meta.url),'utf8')}`);
}
