// Isolate test-generated artifacts, including historical suites with fixed output paths.
import fs from'node:fs';import fsp from'node:fs/promises';import{syncBuiltinESMExports}from'node:module';import{resolve,relative,dirname,isAbsolute,sep}from'node:path';import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),artifactRoot=resolve(root,'artifacts'),base=process.env.GAME_TEST_EVIDENCE_SCOPE;
if(!base)throw Error('GAME_TEST_EVIDENCE_SCOPE must name a new G035 evidence directory');const scope=resolve(root,base);if(!scope.startsWith(artifactRoot+sep+'g035-')&&!scope.startsWith(artifactRoot+sep+'game-tests'+sep))throw Error('Evidence scope must be within G035 artifacts');
const original={};for(const n of['mkdirSync','existsSync','writeFileSync','appendFileSync','createWriteStream','readFileSync','statSync','lstatSync','readdirSync','accessSync','copyFileSync','renameSync'])original[n]=fs[n].bind(fs);const asyncOriginal={};for(const n of['mkdir','writeFile','appendFile','readFile','stat','lstat','readdir','access','copyFile','rename'])asyncOriginal[n]=fsp[n].bind(fsp);
function toPath(p){if(p instanceof URL)return p.protocol==='file:'?fileURLToPath(p):null;if(Buffer.isBuffer(p))return p.toString();return typeof p==='string'?p:null;}
function target(p){const text=toPath(p);if(text===null)return p;const full=resolve(text);if(full===scope||full.startsWith(scope+sep))return p;if(full.startsWith(artifactRoot+sep))return resolve(scope,relative(artifactRoot,full));return p;}
function readTarget(p){const t=target(p);return t!==p&&original.existsSync(t)?t:p;}
function ensure(p){const t=target(p);const text=toPath(t);if(text)original.mkdirSync(dirname(text),{recursive:true});return t;}
fs.mkdirSync=(p,...a)=>original.mkdirSync(target(p),...a);fsp.mkdir=(p,...a)=>asyncOriginal.mkdir(target(p),...a);
for(const n of['writeFileSync','appendFileSync','createWriteStream'])fs[n]=(p,...a)=>original[n](ensure(p),...a);
for(const n of['writeFile','appendFile'])fsp[n]=(p,...a)=>asyncOriginal[n](ensure(p),...a);
for(const n of['readFileSync','statSync','lstatSync','readdirSync','accessSync'])fs[n]=(p,...a)=>original[n](readTarget(p),...a);
for(const n of['readFile','stat','lstat','readdir','access'])fsp[n]=(p,...a)=>asyncOriginal[n](readTarget(p),...a);
fs.existsSync=p=>original.existsSync(readTarget(p));fs.copyFileSync=(a,b,...rest)=>original.copyFileSync(readTarget(a),ensure(b),...rest);fsp.copyFile=(a,b,...rest)=>asyncOriginal.copyFile(readTarget(a),ensure(b),...rest);fs.renameSync=(a,b,...rest)=>original.renameSync(readTarget(a),ensure(b),...rest);fsp.rename=(a,b,...rest)=>asyncOriginal.rename(readTarget(a),ensure(b),...rest);
// Callback forms are used by a few older helpers and browser drivers.
const callbackOriginal={};for(const n of['writeFile','appendFile','mkdir']){callbackOriginal[n]=fs[n].bind(fs);fs[n]=(p,...a)=>callbackOriginal[n](n==='mkdir'?target(p):ensure(p),...a);}
syncBuiltinESMExports();
