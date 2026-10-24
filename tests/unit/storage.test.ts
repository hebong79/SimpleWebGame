import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile, normalizeProfile, ProfileStore, STORAGE_KEY, type StorageLike } from '../../src/client/storage.js';
class Memory implements StorageLike { data=new Map<string,string>(); writes=0; getItem(key:string):string|null{return this.data.get(key)??null} setItem(key:string,value:string):void{this.writes++;this.data.set(key,value)} }
test('valid profile roundtrip and no board storage',()=>{
 const memory=new Memory();const store=new ProfileStore(memory);assert.deepEqual(store.load(),defaultProfile());assert.equal(memory.writes,0);
 const p={...defaultProfile(),bestScore:8,totalScore:12,bestTile:1024,gamesStarted:1,gamesWon:1,gamesFinished:1,unlockedGardens:['seed','grove','bloom'] as ('seed'|'grove'|'bloom')[],selectedGarden:'bloom' as const,muted:false};
 assert.equal(store.save(p),true);assert.deepEqual(new ProfileStore(memory).load(),p);assert.ok(!memory.getItem(STORAGE_KEY)!.includes('board'));
});
test('invalid numeric, versions and structures recover defaults',()=>{
 const valid=defaultProfile();
 for(const value of [null,[],1,'string',{...valid,version:0},{...valid,version:2},{...valid,bestScore:-1},{...valid,totalMoves:.5},{...valid,bestTile:3},{...valid,gamesStarted:'1'},{...valid,gamesFinished:1},{...valid,bestScore:8,totalScore:4},{...valid,totalScore:Infinity},{...valid,bestTile:2**52-1},{...valid,totalMoves:Number.MAX_SAFE_INTEGER+1},{}]) {
  const result=normalizeProfile(value);assert.equal(result.recovered,true);assert.deepEqual(result.profile,defaultProfile());
 }
});
test('safe numeric records survive invalid cosmetics and HTML-like IDs',()=>{
 const result=normalizeProfile({...defaultProfile(),bestScore:64,totalScore:80,bestTile:512,unlockedGardens:['seed','seed','bloom','fake'],selectedGarden:'<img src=x onerror=alert(1)>',muted:'false'});
 assert.equal(result.recovered,true);assert.equal(result.profile.bestScore,64);assert.deepEqual(result.profile.unlockedGardens,['seed','grove']);assert.equal(result.profile.selectedGarden,'seed');assert.equal(result.profile.muted,true);
});
test('malformed JSON and oversize input only normalize game-owned key',()=>{
 for(const raw of ['{broken','null',JSON.stringify({...defaultProfile(),version:99}),' '.repeat(16385)]){
  const memory=new Memory();memory.data.set('another-game','safe');memory.data.set(STORAGE_KEY,raw);
  const store=new ProfileStore(memory);assert.deepEqual(store.load(),defaultProfile());assert.equal(store.recovered,true);assert.equal(memory.writes,1);assert.equal(memory.data.get('another-game'),'safe');assert.deepEqual(JSON.parse(memory.data.get(STORAGE_KEY)!),defaultProfile());
 }
});
test('Storage read and write exceptions become sticky memory mode',()=>{
 const read=new ProfileStore({getItem(){throw new Error('denied')},setItem(){throw new Error('denied')}});assert.deepEqual(read.load(),defaultProfile());assert.equal(read.blocked,true);assert.equal(read.save(defaultProfile()),false);
 let calls=0;const write=new ProfileStore({getItem(){return null},setItem(){calls++;throw new Error('quota')}});assert.equal(write.save(defaultProfile()),false);assert.equal(write.save(defaultProfile()),false);assert.equal(calls,1);assert.equal(write.blocked,true);
 assert.equal(new ProfileStore().blocked,true);
});
test('reject invalid writes and count overlapping success/finish as valid',()=>{
 const memory=new Memory();const store=new ProfileStore(memory);assert.throws(()=>store.save({...defaultProfile(),totalScore:-1}),TypeError);assert.equal(memory.writes,0);
 const p={...defaultProfile(),gamesStarted:1,gamesWon:1,gamesFinished:1};assert.equal(normalizeProfile(p).recovered,false);assert.equal(store.save(p),true);
});
