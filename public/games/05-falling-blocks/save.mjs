export const STORAGE_KEY='simplegames.fallingblocks.v1';
export const THEMES=Object.freeze(['clay','porcelain','ink']);
export const CAP_WARNING='누적기록 상한에 도달해 이번 기록은 합산되지 않았습니다';
export function defaultSave(){return {version:1,bestScore:0,bestLines:0,totalScore:0,totalLines:0,plays:0,wins:0,losses:0,quits:0,theme:'clay',muted:true};}
const ints=['bestScore','bestLines','totalScore','totalLines','plays','wins','losses','quits'];
export function validateSave(v){return !!v&&v.version===1&&ints.every(k=>Number.isSafeInteger(v[k])&&v[k]>=0)&&v.bestLines<=23&&v.bestScore<=v.totalScore&&v.bestLines<=v.totalLines&&BigInt(v.plays)===BigInt(v.wins)+BigInt(v.losses)+BigInt(v.quits)&&THEMES.includes(v.theme)&&typeof v.muted==='boolean';}
export function createStore(getStorage=()=>globalThis.localStorage){let data=defaultSave(),storage,blocked=false,warning='',capped=false;const seen=new WeakSet();let raw=null;
  try{storage=getStorage();raw=storage.getItem(STORAGE_KEY);}catch{blocked=true;warning='이 환경에서는 기록이 저장되지 않습니다. 이 탭의 메모리로 계속합니다.';}
  if(!blocked&&raw!==null){try{const parsed=JSON.parse(raw);if(validateSave(parsed))data=Object.fromEntries(Object.keys(data).map(k=>[k,parsed[k]]));else warning='저장 내용이 올바르지 않아 기본 기록으로 복구했습니다.';}catch{warning='저장 내용이 올바르지 않아 기본 기록으로 복구했습니다.';}}
  const snapshot=()=>({...data});
  function persist(){try{if(blocked)throw Error('blocked');storage.setItem(STORAGE_KEY,JSON.stringify(data));}catch{blocked=true;warning='이 환경에서는 기록이 저장되지 않습니다. 이 탭의 메모리로 계속합니다.';}return snapshot();}
  return {snapshot,get warning(){return [warning,capped?CAP_WARNING:''].filter(Boolean).join(' ');},get capped(){return capped;},
    settings(patch){if(THEMES.includes(patch.theme))data.theme=patch.theme;if(typeof patch.muted==='boolean')data.muted=patch.muted;return persist();},
    record(s){if(s.status!=='finished'||seen.has(s))return {attempted:false,applied:false,newBest:false,capped};seen.add(s);if(capped)return {attempted:true,applied:false,newBest:false,capped:true};
      const next={...data,plays:data.plays+1,wins:data.wins+(s.endReason==='won'?1:0),losses:data.losses+(s.endReason==='lost'?1:0),quits:data.quits+(s.endReason==='quit'?1:0),totalScore:data.totalScore+s.score,totalLines:data.totalLines+s.lines,bestScore:Math.max(data.bestScore,s.score),bestLines:Math.max(data.bestLines,s.lines)};
      if(!validateSave(next)){capped=true;return {attempted:true,applied:false,newBest:false,capped:true};}
      const newBest=s.score>data.bestScore;data=next;persist();return {attempted:true,applied:true,newBest,capped:false};}
  };
}
