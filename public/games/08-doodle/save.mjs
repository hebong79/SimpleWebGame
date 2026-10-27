export const STORAGE_KEY='simplegames.doodle.v1';
export const PARTS=Object.freeze(['ears','body','bag']);
export const SETS=Object.freeze(['basic','star','explorer','carrot']);
export const BLOCKED_MESSAGE='이 환경에서는 기록이 저장되지 않습니다. 현재 탭에서는 계속 플레이할 수 있습니다.';
export const SATURATION_MESSAGE='누적기록 상한에 도달해 이번 기록은 합산되지 않았습니다';
const clone=value=>structuredClone(value);
const safe=value=>Number.isSafeInteger(value)&&value>=0;
const FIELDS=['bestScore','totalScore','bestMetric','totalMetric','plays','losses','quits'];
export function ownedSets(best,total) {return ['basic',...(best>=100?['star']:[]),...(total>=2000?['explorer']:[]),...(best>=500?['carrot']:[])];}
export function defaultRecord() {return {version:1,bestScore:0,totalScore:0,bestMetric:0,totalMetric:0,plays:0,losses:0,quits:0,unlockedSets:['basic'],equipped:{ears:'none',body:'none',bag:'none'},muted:true};}
export function validEquipment(equipped,unlocked) {
  return !!equipped&&typeof equipped==='object'&&!Array.isArray(equipped)&&PARTS.every(part=>equipped[part]==='none'||unlocked.some(set=>set!=='basic'&&equipped[part]===`${set}-${part}`));
}
export function validateRecord(input) {
  const empty=()=>({record:defaultRecord(),recovered:true});
  if(!input||typeof input!=='object'||Array.isArray(input)||input.version!==1||!FIELDS.every(k=>safe(input[k])))return empty();
  const {bestScore:b,totalScore:t,bestMetric:bm,totalMetric:tm,plays:p,losses:l,quits:q}=input;
  const B=BigInt(bm),best=BigInt(b),P=BigInt(p),total=BigInt(t),metric=BigInt(tm);
  if(BigInt(l)+BigInt(q)!==P||best!==B/10n)return empty();
  if(P===0n){if(FIELDS.some(k=>input[k]!==0))return empty();}
  else {
    // Reserve one actual best round. Every remaining quotient is in [0,best].
    const n=P-1n,scores=total-best,remaining=metric-B;
    if(scores<0n||scores>n*best)return empty();
    // At least k rounds must have quotient best; their remainder is <= B%10,
    // not 9. Distributing scores below best first attains this minimum k.
    const excess=scores-n*(best-1n),k=excess>0n?excess:0n;
    const minimum=10n*scores,maximum=minimum+9n*n-(9n-B%10n)*k;
    // For that score allocation the independent remainder intervals fill every
    // integer between the two bounds (also covers best=0 and single rounds).
    if(remaining<minimum||remaining>maximum)return empty();
  }
  const record=defaultRecord();for(const k of FIELDS)record[k]=input[k];record.unlockedSets=ownedSets(b,t);
  let recovered=!Array.isArray(input.unlockedSets)||input.unlockedSets.length!==record.unlockedSets.length||!record.unlockedSets.every(set=>input.unlockedSets.includes(set));
  for(const part of PARTS) {
    const value=input.equipped?.[part];
    if(value==='none'||record.unlockedSets.some(set=>set!=='basic'&&value===`${set}-${part}`))record.equipped[part]=value;else recovered=true;
  }
  if(typeof input.muted==='boolean')record.muted=input.muted;else recovered=true;
  return {record,recovered};
}
function validResult(result) {return result&&safe(result.metric)&&safe(result.score)&&result.score===Math.floor(result.metric/10)&&['fall','quit'].includes(result.reason);}
export function settleRecord(record,result) {
  if(!validResult(result))throw new TypeError('invalid doodle result');
  const comparison=result.score>record.bestScore?'new':result.score===record.bestScore?'tie':'below';
  const values={bestScore:BigInt(Math.max(record.bestScore,result.score)),totalScore:BigInt(record.totalScore)+BigInt(result.score),bestMetric:BigInt(Math.max(record.bestMetric,result.metric)),totalMetric:BigInt(record.totalMetric)+BigInt(result.metric),plays:BigInt(record.plays)+1n,losses:BigInt(record.losses)+(result.reason==='fall'?1n:0n),quits:BigInt(record.quits)+(result.reason==='quit'?1n:0n)};
  if(Object.values(values).some(value=>value>BigInt(Number.MAX_SAFE_INTEGER)))return {record:clone(record),saturated:true,newSets:[],comparison};
  const next=clone(record);for(const k of FIELDS)next[k]=Number(values[k]);next.unlockedSets=ownedSets(next.bestScore,next.totalScore);
  return {record:next,saturated:false,newSets:next.unlockedSets.filter(set=>!record.unlockedSets.includes(set)),comparison};
}
export function createRecords(storageProvider=()=>globalThis.localStorage) {
  let record=defaultRecord(),blocked=false,recovered=false,firstVisit=false,saturated=false;
  const attempted=new Set();let storage;
  try {storage=storageProvider();const raw=storage.getItem(STORAGE_KEY);if(raw===null)firstVisit=true;else {try{const loaded=validateRecord(JSON.parse(raw));record=loaded.record;recovered=loaded.recovered;}catch{recovered=true;}}}catch{blocked=true;}
  const write=()=>{if(blocked)return false;try{storage.setItem(STORAGE_KEY,JSON.stringify(record));return true;}catch{blocked=true;return false;}};
  const snapshot=()=>clone({record,blocked,recovered,firstVisit,saturated});
  return Object.freeze({snapshot,
    settle(result) {
      if(!validResult(result)||!Number.isSafeInteger(result.round)||result.round<1)throw new TypeError('invalid round');
      if(attempted.has(result.round))return {duplicate:true,...snapshot(),newSets:[]};
      attempted.add(result.round);
      if(saturated)return {duplicate:false,...snapshot(),newSets:[],comparison:result.score>record.bestScore?'new':result.score===record.bestScore?'tie':'below'};
      const outcome=settleRecord(record,result);record=outcome.record;saturated=outcome.saturated;
      if(!saturated)write();return {...outcome,duplicate:false,blocked};
    },
    mute(value) {if(typeof value!=='boolean')return false;if(record.muted===value)return true;record={...record,muted:value};write();return true;},
    equip(value) {if(!validEquipment(value,record.unlockedSets))return false;record={...record,equipped:Object.fromEntries(PARTS.map(p=>[p,value[p]]))};write();return true;}
  });
}
export function createWardrobe(getRecord,apply) {
  let draft=clone(getRecord().equipped);
  return Object.freeze({open(){draft=clone(getRecord().equipped);return clone(draft);},snapshot(){return clone(draft);},
    previewSet(set){if(!SETS.includes(set))return false;draft=Object.fromEntries(PARTS.map(part=>[part,set==='basic'?'none':`${set}-${part}`]));return true;},
    previewPart(part,item){if(!PARTS.includes(part)||!(item==='none'||SETS.some(set=>set!=='basic'&&item===`${set}-${part}`)))return false;draft[part]=item;return true;},
    canApply(){return validEquipment(draft,getRecord().unlockedSets);},
    apply(){return validEquipment(draft,getRecord().unlockedSets)?apply(clone(draft)):false;},
    cancel(){draft=clone(getRecord().equipped);return clone(draft);}
  });
}
