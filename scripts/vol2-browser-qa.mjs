import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createGameServer } from '../artifacts/g032-build/src/server/index.js';
const output=`artifacts/g032-independent-browser/${new Date().toISOString().replace(/[:.]/g,'-')}`;
await mkdir(output,{recursive:true});
const server=createGameServer(resolve('artifacts/g032-build/public'));
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
const origin=`http://127.0.0.1:${server.address().port}`,results=[];
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7);
async function run(name,args,extra={}){
 const result=await new Promise((ok,fail)=>{const child=spawn(process.execPath,args,{env:{...process.env,...extra},windowsHide:true});let log='';child.stdout.on('data',chunk=>log+=chunk);child.stderr.on('data',chunk=>log+=chunk);child.once('error',fail);child.once('close',status=>ok({status,log}));});
 await writeFile(`${output}/${name}.log`,result.log);
 const count=result.log.match(/(?:#|ℹ) tests (\d+)/),pass=result.log.match(/(?:#|ℹ) pass (\d+)/),fail=result.log.match(/(?:#|ℹ) fail (\d+)/);
 const item={name,status:result.status,tests:count?Number(count[1]):undefined,passed:pass?Number(pass[1]):undefined,failed:fail?Number(fail[1]):undefined};results.push(item);console.log(JSON.stringify(item));
 if(result.status!==0)console.log(result.log.slice(-5000));
}
try{
 if(!only||only==='action')await run('action',['--test','--test-reporter=tap','tests/games/vol2-action-qa.test.mjs'],{VOL2_ACTION_BROWSER:'1'});
 if(!only||only==='strategy')await run('strategy',['--test','--test-reporter=tap','tests/games/vol2-strategy-qa.test.mjs'],{VOL2_STRATEGY_BROWSER:'1'});
 if(!only||only==='logic')await run('logic',['tests/games/vol2-logic-qa.test.mjs','--browser'],{VOL2_LOGIC_QA_URL:origin});
}finally{server.closeAllConnections();await new Promise(ok=>server.close(ok));await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));console.log(`Evidence ${output}`);}
if(results.some(r=>r.status!==0))process.exitCode=1;
