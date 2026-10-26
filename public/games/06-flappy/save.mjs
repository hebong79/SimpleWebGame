export const STORAGE_KEY='simplegames.flappy.v1';
export const PARTS=Object.freeze(['head','body','ankle']);
export const SETS=Object.freeze(['basic','pilot','rain','bee']);
export const SATURATION_MESSAGE='누적기록 상한에 도달해 이번 기록은 합산되지 않았습니다';
export const BLOCKED_MESSAGE='이 환경에서는 기록이 저장되지 않습니다';
const clone=value=>structuredClone(value);
const safe=value=>Number.isSafeInteger(value)&&value>=0;
export function ownedSets(best,total) {return ['basic',...(best>=1?['pilot']:[]),...(best>=10?['rain']:[]),...(total>=100?['bee']:[])];}
export function defaultRecord() {return {version:1,bestScore:0,totalPassed:0,plays:0,collisions:0,quits:0,unlockedSets:['basic'],equipped:{head:'none',body:'none',ankle:'none'},muted:true};}
export function validEquipment(equipped,unlockedSets) {
  return !!equipped&&PARTS.every(part=>equipped[part]==='none'||unlockedSets.some(set=>set!=='basic'&&equipped[part]===`${set}-${part}`));
}
export function validateRecord(input) {
  const empty=()=>({record:defaultRecord(),recovered:true});
  if(!input||typeof input!=='object'||Array.isArray(input)||input.version!==1) return empty();
  const fields=['bestScore','totalPassed','plays','collisions','quits'];
  if(!fields.every(k=>safe(input[k]))) return empty();
  const {bestScore:best,totalPassed:total,plays,collisions,quits}=input;
  if(!safe(collisions+quits)||plays!==collisions+quits||best>total||BigInt(total)>BigInt(best)*BigInt(plays)) return empty();
  const record=defaultRecord();for(const key of fields) record[key]=input[key];
  record.unlockedSets=ownedSets(best,total);
  let recovered=!Array.isArray(input.unlockedSets)||input.unlockedSets.length!==record.unlockedSets.length||!record.unlockedSets.every(x=>input.unlockedSets.includes(x));
  for(const part of PARTS) {
    const value=input.equipped?.[part];
    if(value==='none'||record.unlockedSets.some(set=>set!=='basic'&&value===`${set}-${part}`)) record.equipped[part]=value;
    else recovered=true;
  }
  if(typeof input.muted==='boolean') record.muted=input.muted;else recovered=true;
  return {record,recovered};
}
export function settleRecord(record,result) {
  if(!result||!safe(result.score)||!['arch','ceiling','ground','quit'].includes(result.reason)) throw new TypeError('invalid flight result');
  const comparison=result.score>record.bestScore?'new':result.score===record.bestScore?'tie':'below';
  const next=clone(record);
  next.plays++;next[result.reason==='quit'?'quits':'collisions']++;
  next.totalPassed+=result.score;next.bestScore=Math.max(next.bestScore,result.score);
  const saturated=['plays','collisions','quits','totalPassed','bestScore'].some(k=>record[k]===Number.MAX_SAFE_INTEGER)||!['plays','collisions','quits','totalPassed','bestScore'].every(k=>safe(next[k]))||!safe(next.collisions+next.quits);
  if(saturated) return {record:clone(record),saturated:true,newSets:[],comparison};
  next.unlockedSets=ownedSets(next.bestScore,next.totalPassed);
  return {record:next,saturated:false,newSets:next.unlockedSets.filter(x=>!record.unlockedSets.includes(x)),comparison};
}
export function createRecords(storageProvider=()=>globalThis.localStorage) {
  let record=defaultRecord(),blocked=false,recovered=false,firstVisit=false,saturated=false;
  const attempted=new Set();
  try {
    const raw=storageProvider().getItem(STORAGE_KEY);
    if(raw===null) firstVisit=true;
    else {try {const loaded=validateRecord(JSON.parse(raw));record=loaded.record;recovered=loaded.recovered;} catch {recovered=true;}}
  } catch {blocked=true;}
  const write=()=>{try{storageProvider().setItem(STORAGE_KEY,JSON.stringify(record));return true;}catch{blocked=true;return false;}};
  const snapshot=()=>clone({record,blocked,recovered,firstVisit,saturated});
  return Object.freeze({snapshot,
    settle(result) {
      if(!result||!Number.isSafeInteger(result.round)||result.round<1) throw new TypeError('result round');
      if(attempted.has(result.round)) return {duplicate:true,...snapshot(),newSets:[]};
      const outcome=settleRecord(record,result);attempted.add(result.round);
      if(saturated) {outcome.record=clone(record);outcome.saturated=true;outcome.newSets=[];}
      record=outcome.record;saturated||=outcome.saturated;
      write();return {...outcome,duplicate:false,blocked};
    },
    mute(value) {if(typeof value!=='boolean') return false;record={...record,muted:value};write();return true;},
    equip(value) {if(!validEquipment(value,record.unlockedSets)) return false;record={...record,equipped:clone(value)};write();return true;}
  });
}
export function createWardrobe(getRecord,apply) {
  let draft=clone(getRecord().equipped);
  return Object.freeze({open(){draft=clone(getRecord().equipped);return clone(draft);},snapshot(){return clone(draft);},
    previewSet(set){if(!SETS.includes(set)) return false;draft=Object.fromEntries(PARTS.map(p=>[p,set==='basic'?'none':`${set}-${p}`]));return true;},
    previewPart(part,item){if(!PARTS.includes(part)) return false;draft[part]=item;return true;},
    canApply(){return validEquipment(draft,getRecord().unlockedSets);},
    apply(){return validEquipment(draft,getRecord().unlockedSets)?apply(clone(draft)):false;},
    cancel(){draft=clone(getRecord().equipped);return clone(draft);}
  });
}
