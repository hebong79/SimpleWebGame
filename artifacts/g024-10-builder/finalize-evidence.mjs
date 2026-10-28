import {readFile,writeFile,readdir}from'node:fs/promises';
import {spawnSync}from'node:child_process';
import {createHash}from'node:crypto';
import {resolve}from'node:path';
const dir='artifacts/g024-10-builder',node=process.execPath;
const runtime=(await readdir('public/games/10-sokoban')).map(n=>'public/games/10-sokoban/'+n).sort();
const sourceFiles=[...runtime,'tests/games/10-sokoban.test.mjs','docs/G024_10_IMPLEMENTATION.md'].sort();
const hashes={}, aggregate=createHash('sha256'),runtimeAggregate=createHash('sha256');
for(const file of sourceFiles){const bytes=await readFile(file);hashes[file]={sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};aggregate.update(file+'\0').update(bytes);if(runtime.includes(file))runtimeAggregate.update(file+'\0').update(bytes);}
const manifest={task_id:'G024-10',root:resolve('.'),branch:'feature/g024-10-sokoban',base:'1e40850c41b46bd6190f10d1407d731fac4ddbf4',generated_at:new Date().toISOString(),algorithm:'SHA-256; aggregate sorts paths then updates path+NUL+bytes',source_sha256:aggregate.digest('hex'),runtime_sha256:runtimeAggregate.digest('hex'),files:hashes};
await writeFile(dir+'/source-manifest.json',JSON.stringify(manifest,null,2)+'\n');
const checks=[];
for(const file of [...runtime.filter(f=>f.endsWith('.mjs')),'tests/games/10-sokoban.test.mjs',dir+'/http-initial.mjs',dir+'/http-full.mjs',dir+'/solve-levels.mjs',dir+'/design-levels.mjs',dir+'/finalize-levels.mjs']){
 const args=['--check',file],r=spawnSync(node,args,{encoding:'utf8'});checks.push({command:[node,...args],exit:r.status,stdout:r.stdout,stderr:r.stderr});
}
const args=['--test','--test-reporter=tap','tests/games/10-sokoban.test.mjs'];
const unit=spawnSync(node,args,{encoding:'utf8'});await writeFile(dir+'/unit-final.tap',unit.stdout+unit.stderr);
const unitCounts={executed:Number(unit.stdout.match(/^# tests (\d+)$/m)?.[1]),passed:Number(unit.stdout.match(/^# pass (\d+)$/m)?.[1]),failed:Number(unit.stdout.match(/^# fail (\d+)$/m)?.[1]),skipped:Number(unit.stdout.match(/^# skipped (\d+)$/m)?.[1])};
const early=JSON.parse(await readFile(dir+'/http-initial-observer-corrected/results.json','utf8'));
const full=JSON.parse(await readFile(dir+'/http-full/results.json','utf8'));
const scanPatterns=[['dynamic-eval',/\beval\s*\(|new\s+Function\s*\(/],['HTML-injection',/innerHTML|outerHTML|document\.write/],['external-network',/https?:\/\/|\bfetch\s*\(|XMLHttpRequest|WebSocket/],['inline-style',/\.style\.|setAttribute\(\s*['"]style['"]|\bstyle\s*=/],['storage-delete',/removeItem|localStorage\.clear/],['node-shell',/child_process|\bexec\s*\(|\bspawn\s*\(/]];
const scan=[];for(const file of runtime){const lines=(await readFile(file,'utf8')).split(/\r?\n/);for(const [category,regex]of scanPatterns)lines.forEach((line,i)=>{if(regex.test(line))scan.push({file,line:i+1,category});});}
const review={kind:'implementer self-review, NOT independent acceptance',passed:scan.length===0&&checks.every(c=>c.exit===0)&&unit.status===0,security_concerns:scan,logic_errors:[],suggestions:['Independent QA10 should separately validate all 20 levels and storage/UI boundaries.','Physical touch, listening and human duration remain outside automatic acceptance.'],inputs_sha256:hashes,scope:'7 shipping files, pure-engine/save tests, implementation document; no shared writes',checks:['Synchronous win transition is only settlement caller','Invalid moves return original state, immutable terrain/history','Result does not permit undo and reload creates ready state','Dialogs preserve return phase/reason, trap Tab and restore actual trigger','Cosmetics are absent from pure engine and cannot alter movement','Strict existing CSP and source setter absence verified over actual HTTP'],scan};
await writeFile(dir+'/self-review.json',JSON.stringify(review,null,2)+'\n');
const verification={task_id:'G024-10',node,version:process.version,created_at:new Date().toISOString(),source_sha256:manifest.source_sha256,syntax:{executed:checks.length,passed:checks.filter(c=>c.exit===0).length,failed:checks.filter(c=>c.exit!==0).length,checks},unit:{command:[node,...args],exit:unit.status,...unitCounts,output:dir+'/unit-final.tap'},initial_http:{command:[node,dir+'/http-initial.mjs'],executed:early.cases,passed:early.passed,failed:early.failed,skipped:early.skipped,env:{GAME_TEST_ARTIFACT_DIR:dir,GAME_TEST_BUILD_DIR:dir+'/build'},output:dir+'/http-initial-observer-corrected/results.json'},full_http:{command:[node,dir+'/http-full.mjs'],executed:full.executed,passed:full.passed,failed:full.failed,skipped:full.skipped,console_and_page_errors:full.diagnostics.length,external_requests:full.external.length,env:{GAME_TEST_ARTIFACT_DIR:dir,GAME_TEST_BUILD_DIR:dir+'/build'},output:dir+'/http-full/results.json'},preserved_failures:[dir+'/http-initial/results.json',dir+'/http-initial.log'],implementation_fix_cycles:0,observer_corrections:1,independent_acceptance:false,limits:full.limits};
await writeFile(dir+'/verification.json',JSON.stringify(verification,null,2)+'\n');
console.log(JSON.stringify({source_sha256:manifest.source_sha256,runtime_sha256:manifest.runtime_sha256,syntax:verification.syntax.executed,syntax_failed:verification.syntax.failed,unit:unitCounts,http_initial:verification.initial_http.passed,http_full:verification.full_http.passed,security_candidates:scan.length},null,2));
if(!review.passed||full.failed||early.failed)process.exitCode=1;
