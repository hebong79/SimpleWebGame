export const STORAGE_KEY='simplegames.breakout.v1';
export const THEMES=Object.freeze(['mint','solar','mono']);
export function defaultSave(){return {version:1,bestScore:0,plays:0,wins:0,totalBricks:0,bestStage:0,muted:false,paddleTheme:'mint'};}
const integer=(n,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
export function validateSave(v){return !!v&&v.version===1&&integer(v.bestScore,1410)&&integer(v.plays)&&integer(v.wins)&&v.wins<=v.plays&&integer(v.totalBricks)&&integer(v.bestStage,3)&&typeof v.muted==='boolean'&&THEMES.includes(v.paddleTheme);}
const inc=(a,b)=>Math.min(Number.MAX_SAFE_INTEGER,a+b);
export function createStore(getStorage=()=>globalThis.localStorage){
  let data=defaultSave(),warning='',storage,failed=false;const recorded=new WeakSet();
  let raw=null;
  try {storage=getStorage();raw=storage.getItem(STORAGE_KEY);}
  catch {failed=true;warning='기록을 저장할 수 없습니다. 이 탭에서만 기록을 유지합니다.';}
  if(!failed&&raw!==null){try{const parsed=JSON.parse(raw);if(validateSave(parsed))data={...data,...parsed};else warning='저장 내용을 복구했습니다. 새 기록으로 계속합니다.';}catch{warning='저장 내용을 복구했습니다. 새 기록으로 계속합니다.';}}
  function persist(){try{if(failed)throw Error('unavailable');storage.setItem(STORAGE_KEY,JSON.stringify(data));}catch{failed=true;warning='기록을 저장할 수 없습니다. 이 탭에서만 기록을 유지합니다.';}return snapshot();}
  function snapshot(){return {...data};}
  return {snapshot,get warning(){return warning;},save:persist,
    settings(patch){if(typeof patch.muted==='boolean')data.muted=patch.muted;if(THEMES.includes(patch.paddleTheme))data.paddleTheme=patch.paddleTheme;return persist();},
    record(s){if(s.status!=='finished'||recorded.has(s))return {recorded:false,newBest:false};recorded.add(s);const newBest=s.score>data.bestScore;data.bestScore=Math.max(data.bestScore,s.score);data.plays=inc(data.plays,1);data.wins=Math.min(data.plays,inc(data.wins,s.endReason==='won'?1:0));data.totalBricks=inc(data.totalBricks,s.totalBricks);data.bestStage=Math.max(data.bestStage,s.stage);persist();return {recorded:true,newBest};}
  };
}
