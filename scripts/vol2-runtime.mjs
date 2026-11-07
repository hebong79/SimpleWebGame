import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const appName='number-garden-2048', build=resolve(root,'artifacts/g032-build'), expected=join(build,'src/server/index.js');
const deploy=process.argv.includes('--deploy');
function command(text){const r=spawnSync('cmd.exe',['/d','/s','/c',text],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});if(r.error)throw r.error;return r;}
function pmList(){const r=command('pm2 jlist');if(r.status!==0)throw new Error('PM2 jlist failed. Raw environment output is deliberately not printed.');const candidates=[r.stdout.trim(),...r.stdout.trim().split(/\r?\n/).reverse()];for(const value of candidates){try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parsed;}catch{}}throw new Error('PM2 list was not valid JSON; raw environment output is not printed.');}
function safeItem(p){return{name:p.name,id:p.pm_id,pid:p.pid,status:p.pm2_env?.status,restarts:p.pm2_env?.restart_time,script:p.name===appName?p.pm2_env?.pm_exec_path:undefined};}
function listeners(){const r=spawnSync('powershell.exe',['-NoProfile','-Command',"Get-NetTCPConnection -LocalPort 15010 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess | ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true});if(!r.stdout.trim())return[];const value=JSON.parse(r.stdout);return Array.isArray(value)?value:[value];}
const before=pmList();
if(before.filter(p=>p.name===appName).length>1)throw new Error('Multiple game applications with the same name; scope is ambiguous.');
const beforeSafe=before.map(safeItem);
if(!deploy){console.log(JSON.stringify({applications:beforeSafe,listeners:listeners()},null,2));process.exit(0);}
// The user's 2026-11-07 instruction authorizes proceeding without another approval question.
// Only this one game application may change. No global save, other app restart, firewall or ACL edits.
await readFile(expected);
for(let n=21;n<=40;n++){
 const dirs=await readdir(join(build,'public/games'));
 const folder=dirs.find(d=>d.startsWith(`${n}-`));
 if(!folder)throw new Error(`Missing game ${n}`);
 await readFile(join(build,'public/games',folder,'index.html'));
}
const config=await readFile(join(root,'ecosystem.config.cjs'),'utf8');
if(!config.includes('artifacts/g032-build/src/server/index.js')||!config.includes('15010'))throw new Error('Ecosystem must explicitly select g032-build and port15010.');
const evidence=resolve(root,`artifacts/g032-release/${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(evidence,{recursive:true});
await writeFile(join(evidence,'before.json'),JSON.stringify({applications:beforeSafe,listeners:listeners()},null,2));
const previous=before.find(p=>p.name===appName);
await writeFile(join(evidence,'previous-game.json'),JSON.stringify(previous?{...safeItem(previous),args:previous.pm2_env?.args,cwd:previous.pm2_env?.pm_cwd,interpreter:previous.pm2_env?.exec_interpreter}:null,null,2));
let result;
if(previous)result=command('pm2 restart ecosystem.config.cjs --only number-garden-2048 --update-env');
else result=command('pm2 start ecosystem.config.cjs --only number-garden-2048');
await writeFile(join(evidence,'transition.log'),(result.stdout||'')+(result.stderr||''));
const correct=p=>p&&p.pm2_env?.status==='online'&&resolve(p.pm2_env.pm_exec_path).toLowerCase()===expected.toLowerCase();
let current=pmList().find(p=>p.name===appName);
if(!correct(current)){
 if(current){const removal=command('pm2 delete number-garden-2048');await writeFile(join(evidence,'reregister.log'),(removal.stdout||'')+(removal.stderr||''));if(removal.status!==0)throw new Error('Could not unregister the scoped game app.');}
 const start=command('pm2 start ecosystem.config.cjs --only number-garden-2048');
 await writeFile(join(evidence,'start.log'),(start.stdout||'')+(start.stderr||''));
 if(start.status!==0)throw new Error('Scoped game app startup failed. Previous script/config recorded.');
}
for(let i=0;i<20;i++){current=pmList().find(p=>p.name===appName);if(correct(current)&&listeners().some(l=>l.OwningProcess===current.pid))break;await new Promise(r=>setTimeout(r,200));}
const listen=listeners();
if(!correct(current)||!listen.some(l=>l.OwningProcess===current.pid))throw new Error('Actual PM2 script/PID/LISTEN do not agree. Do not report a deployment success.');
const after=pmList();
const others=before.filter(p=>p.name!==appName);
for(const previousOther of others){const now=after.find(p=>p.pm_id===previousOther.pm_id&&p.name===previousOther.name);if(!now||now.pid!==previousOther.pid||now.pm2_env?.restart_time!==previousOther.pm2_env?.restart_time)throw new Error('An unrelated application changed during the release.');}
const manifest=[];
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())await walk(path);else if(/\.(?:html|css|mjs|js|svg|png|webp|ico)$/.test(item.name)){
 const urlPath='/'+relative(join(build,'public'),path).replaceAll('\\','/');
 const response=await fetch('http://192.168.0.195:15010'+urlPath,{signal:AbortSignal.timeout(10000)});
 const bytes=Buffer.from(await response.arrayBuffer()),source=await readFile(path);
 if(response.status!==200||!source.equals(bytes))throw new Error(`Live bytes do not match verified build: ${urlPath}`);
 if(!response.headers.get('content-security-policy')?.includes("script-src 'self'")||response.headers.get('x-content-type-options')!=='nosniff')throw new Error(`Security headers differ: ${urlPath}`);
 manifest.push({path:urlPath,sha256:createHash('sha256').update(bytes).digest('hex')});
}}}
await walk(join(build,'public'));
const loopback=await fetch('http://127.0.0.1:15010/',{signal:AbortSignal.timeout(10000)});if(loopback.status!==200)throw new Error('Loopback home did not respond.');
await writeFile(join(evidence,'live-manifest.json'),JSON.stringify(manifest,null,2));
const receipt={applications:after.map(safeItem),listeners:listen,verifiedHttpFiles:manifest.length,primaryUrl:'http://192.168.0.195:15010/',pm2Save:false,operatingBrowserAcceptance:'pending separate trusted-input browser run'};
await writeFile(join(evidence,'after.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({evidence:relative(root,evidence),game:safeItem(current),listeners:listen,verifiedHttpFiles:manifest.length,otherApplicationsPreserved:others.length,pm2Save:false},null,2));
