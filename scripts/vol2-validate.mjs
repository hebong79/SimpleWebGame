import { spawnSync } from 'node:child_process';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const require=createRequire(import.meta.url);
const output=`artifacts/g032-validation/${new Date().toISOString().replace(/[:.]/g,'-')}`;
await mkdir(output,{recursive:true});
const results=[];
async function run(name,args){
 const result=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:30*1024*1024});
 const log=(result.stdout||'')+(result.stderr||'');
 await writeFile(`${output}/${name}.log`,log);
 const total=log.match(/# tests (\d+)/),passed=log.match(/# pass (\d+)/),failed=log.match(/# fail (\d+)/);
 const item={name,status:result.status,error:result.error?.message,tests:total?Number(total[1]):undefined,passed:passed?Number(passed[1]):undefined,failed:failed?Number(failed[1]):undefined};
 results.push(item);console.log(JSON.stringify(item));
 if(result.status!==0)throw new Error(`${name} failed; see ${output}/${name}.log`);
}
try{
 await run('typecheck',[join(dirname(require.resolve('typescript/package.json')),'bin','tsc'),'--noEmit']);
 await run('fresh-build',['scripts/build.mjs','--out-dir','artifacts/g032-build']);
 const unit=(await readdir('artifacts/g032-build/tests/unit')).filter(f=>f.endsWith('.test.js')).map(f=>`artifacts/g032-build/tests/unit/${f}`);
 await run('unit-server',['--test','--test-reporter=tap',...unit]);
 const games=(await readdir('tests/games')).filter(f=>f.endsWith('.test.mjs')).map(f=>`tests/games/${f}`);
 await run('game-engines',['--test','--test-reporter=tap',...games]);
 await run('launcher',['--test','--test-reporter=tap','tests/launch-local.test.mjs']);
 const dirs=(await readdir('public/games',{withFileTypes:true})).filter(d=>d.isDirectory()&&/^(2[1-9]|3\d|40)-|^vol2$/.test(d.name));
 for(const dir of dirs){for(const file of await readdir(`public/games/${dir.name}`)){if(file.endsWith('.mjs'))await run(`syntax-${dir.name}-${file}`,['--check',`public/games/${dir.name}/${file}`]);}}
}catch(e){console.error(e.message);process.exitCode=1;}
finally{await writeFile(`${output}/results.json`,JSON.stringify({results,passed:results.every(r=>r.status===0)},null,2));console.log(`Evidence ${output}`);}
