import { spawnSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
const candidate=process.argv[2];
if(!/^artifacts\/g032-git-[a-z0-9-]+$/.test(candidate||''))throw new Error('Select a new G032 Git verification build.');
function git(args){const r=spawnSync('git',args,{encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw new Error(`git ${args[0]} failed: ${r.stderr}`);return r.stdout;}
git(['diff','--cached','--check']);
const staged=git(['diff','--cached','--name-only','-z']).split('\0').filter(Boolean);
if(!staged.length)throw new Error('No staged changes.');
for(const path of staged){
 if(/^(?:\.claude\/|\.game-team\/(?:verification|worker-connections)\/|artifacts\/|releases\/|\.aws\/|\.codex\/)|(?:^|\/)\.env(?:\.|$)/.test(path))throw new Error(`Session/secret/generated path must not be committed: ${path}`);
 const content=git(['show',`:${path}`]);
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgithub_pat_[A-Za-z0-9_]{20,}|\bgh[pousr]_[A-Za-z0-9]{30,}|\bAKIA[A-Z0-9]{16}|\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}/.test(content))throw new Error(`Review potential credential in ${path}; secret value is not printed.`);
}
let equal=0;
async function compare(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await compare(path);else if(/\.(?:html|css|mjs|js|svg|png|webp|ico)$/.test(entry.name)){
 const rel=relative(join(candidate,'public'),path),a=await readFile(path),b=await readFile(join('artifacts/g032-build/public',rel));
 if(!a.equals(b))throw new Error(`Fresh Git build differs from the verified live build: ${rel}`);equal++;
}}}
await compare(join(candidate,'public'));
const freshServer=await readFile(join(candidate,'src/server/index.js'));
if(!freshServer.equals(await readFile('artifacts/g032-build/src/server/index.js')))throw new Error('Fresh server differs from the live release.');
const result={stagedFiles:staged.length,stagedWhitespace:'PASS',credentialPatterns:'none detected',forbiddenPaths:'none',freshPublicFilesEqualToLive:equal,serverEqualToLive:true,staged};
await writeFile(join(candidate,'git-check.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,staged:undefined}));
