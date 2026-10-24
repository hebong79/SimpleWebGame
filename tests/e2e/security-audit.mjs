import { request } from 'node:http';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const results=[];
function raw(path,method='GET'){return new Promise((resolve,reject)=>{const r=request({hostname:'127.0.0.1',port:3101,path,method},res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({path,method,status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));});r.on('error',reject);r.end();});}
const attacks=['/../package.json','/%2e%2e/package.json','/%252e%252e/package.json','/%','/%00index.html','/assets%5c..%5cpackage.json','/C:/Windows/win.ini','//server/share/file.html','/index.html:stream','/.env','/.git/config','/src/client/main.ts','/docs/ACCEPTANCE.md','/assets/'];
for(const path of attacks){const r=await raw(path);assert(r.status>=400&&r.status<500);assert(!/E:\\Work|stack|node_modules/.test(r.body));results.push(r);}
const head=await raw('/style.css','HEAD');assert.equal(head.status,200);assert.equal(head.body,'');assert.equal(head.headers['x-content-type-options'],'nosniff');results.push(head);
const post=await raw('/','POST');assert.equal(post.status,405);results.push(post);
const found=[];const imports=[];
for(const dir of ['src/client','src/server'])for(const file of await readdir(dir)){if(!file.endsWith('.ts'))continue;const source=await readFile(join(dir,file),'utf8');for(const [i,line] of source.split('\n').entries()){
 if(/\b(?:eval|Function)\s*\(|\.innerHTML\s*=|insertAdjacentHTML|document\.write|localStorage\.(?:clear|removeItem)\s*\(/.test(line))found.push({file:join(dir,file),line:i+1,source:line});
 if(/^import /.test(line))imports.push({file:join(dir,file),line:i+1,source:line});
}}
assert.deepEqual(found,[]);
const data={host:'127.0.0.1',port:3101,results,unsafeSinks:found,imports,runtimeDependencies:JSON.parse(await readFile('package.json','utf8')).dependencies??{},symlinkEvidence:'artifacts/qa/unit-tests.log:40 (outside junction ->403)'};
await writeFile('artifacts/qa/security-http-static.json',JSON.stringify(data,null,2));console.log(JSON.stringify({rawRequests:results.length,unsafeSinks:found.length,status:'pass'}));
