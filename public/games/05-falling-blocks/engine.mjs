// Original Block Workshop rules. Coordinates include two hidden rows (-2,-1).
export const TYPES=Object.freeze(['I','J','L','O','S','T','Z']);
export const RULES=Object.freeze({columns:10,rows:20,hiddenRows:2,goal:20,lockMs:300,repeatDelayMs:160,repeatMs:60,softDropMs:50});
const definitions={I:['....','IIII','....','....'],J:['J...','JJJ.','....','....'],L:['..L.','LLL.','....','....'],O:['.OO.','.OO.','....','....'],S:['.SS.','SS..','....','....'],T:['.T..','TTT.','....','....'],Z:['ZZ..','.ZZ.','....','....']};
const randomSources=new WeakMap(),EPS=1e-7;
export const emptyBoard=()=>Array.from({length:22},()=>Array(10).fill(null));
export function matrixFor(type){return definitions[type].map(row=>[...row].map(c=>c==='.'?null:c));}
export function cells(piece){const out=[];if(piece)piece.matrix.forEach((row,y)=>row.forEach((type,x)=>{if(type)out.push({x:piece.x+x,y:piece.y+y,type});}));return out;}
export function canPlace(s,piece){return cells(piece).every(({x,y})=>x>=0&&x<10&&y>=-2&&y<20&&!s.board[y+2][x]);}
export function gravityMs(lines){return lines<5?900:lines<10?750:lines<15?600:450;}
export function createGame(rng=Math.random){const s={status:'ready',endReason:null,resultDetail:null,board:emptyBoard(),active:null,next:null,bag:[],score:0,lines:0,gravityElapsed:0,contactElapsed:null,elapsed:0,locked:0};randomSources.set(s,rng);return s;}
function draw(s){if(!s.bag.length){s.bag=[...TYPES];const rng=randomSources.get(s);for(let i=6;i>0;i--){const raw=rng();if(!Number.isFinite(raw)||raw<0||raw>=1)throw RangeError('RNG must return a finite value in [0,1).');const j=Math.floor(raw*(i+1));[s.bag[i],s.bag[j]]=[s.bag[j],s.bag[i]];}}return s.bag.shift();}
function newPiece(type){return {type,matrix:matrixFor(type),x:3,y:-2,rotation:0};}
export function finishGame(s,reason='quit',detail=reason){if(!['playing','paused'].includes(s.status)||!['won','lost','quit'].includes(reason))return [];s.status='finished';s.endReason=reason;s.resultDetail=detail;return [{type:'finish',reason,detail,score:s.score,lines:s.lines}];}
function spawn(s,type){const p=newPiece(type);s.gravityElapsed=0;s.contactElapsed=null;if(!canPlace(s,p)){s.active=null;return finishGame(s,'lost','spawn-blocked');}s.active=p;s.next=draw(s);touch(s);return [{type:'spawn',piece:type}];}
export function startGame(s){if(s.status!=='ready')return [];s.status='playing';return [{type:'start'},...spawn(s,draw(s))];}
export function pauseGame(s,reason='manual'){if(s.status!=='playing')return [];s.status='paused';s.pauseReason=reason;return [{type:'pause',reason}];}
export function resumeGame(s){if(s.status!=='paused')return [];s.status='playing';delete s.pauseReason;return [{type:'resume'}];}
export function grounded(s){return !!s.active&&!canPlace(s,{...s.active,y:s.active.y+1});}
function touch(s){if(s.active&&grounded(s)&&s.contactElapsed===null)s.contactElapsed=0;}
function lock(s){const events=[];for(const c of cells(s.active))s.board[c.y+2][c.x]=c.type;s.locked++;events.push({type:'lock',piece:s.active.type});s.active=null;
  const removed=[];for(let y=0;y<20;y++)if(s.board[y+2].every(Boolean))removed.push(y);
  if(removed.length){const indices=new Set(removed.map(y=>y+2));s.board=s.board.filter((_,i)=>!indices.has(i));while(s.board.length<22)s.board.unshift(Array(10).fill(null));const points=[0,100,300,500,800][removed.length];s.score+=points;s.lines+=removed.length;events.push({type:'clear',rows:removed,count:removed.length,points});}
  if(s.lines>=20)return [...events,...finishGame(s,'won','twenty-lines')];
  return [...events,...spawn(s,s.next)];
}
function settle(s,events){touch(s);if(s.contactElapsed!==null&&s.contactElapsed>=300-EPS&&grounded(s))events.push(...lock(s));return events;}
export function move(s,direction){if(s.status!=='playing'||![-1,1].includes(direction))return [];const p={...s.active,x:s.active.x+direction};if(!canPlace(s,p))return [];s.active=p;return settle(s,[{type:'move',direction}]);}
export function rotate(s){if(s.status!=='playing'||s.active.type==='O')return [];const a=s.active,matrix=Array.from({length:4},(_,y)=>Array.from({length:4},(_,x)=>a.matrix[3-x][y]));for(const dx of [0,-1,1]){const p={...a,matrix,x:a.x+dx,rotation:(a.rotation+1)%4};if(canPlace(s,p)){s.active=p;return settle(s,[{type:'rotate',offset:dx}]);}}return [];}
export function softDrop(s){if(s.status!=='playing')return [];const p={...s.active,y:s.active.y+1};if(!canPlace(s,p)){touch(s);return [];}s.active=p;return settle(s,[{type:'softDrop'}]);}
export function hardDrop(s){if(s.status!=='playing')return [];let distance=0;while(canPlace(s,{...s.active,y:s.active.y+1})){s.active.y++;distance++;}return [{type:'hardDrop',distance},...lock(s)];}
// Event deadlines, rather than per-frame falling, make long and split frames
// process gravity/contact/locking/spawn in chronological order.
export function advance(s,dtMs){if(s.status!=='playing'||!Number.isFinite(dtMs)||dtMs<=0)return [];let left=dtMs;const events=[];touch(s);
  while(s.status==='playing'&&left>EPS){
    if(s.contactElapsed!==null&&s.contactElapsed>=300-EPS&&grounded(s)){events.push(...lock(s));continue;}
    const toGravity=Math.max(0,gravityMs(s.lines)-s.gravityElapsed),toLock=s.contactElapsed!==null&&grounded(s)?Math.max(0,300-s.contactElapsed):Infinity;
    const delta=Math.min(left,toGravity,toLock);s.elapsed+=delta;s.gravityElapsed+=delta;if(s.contactElapsed!==null)s.contactElapsed=Math.min(300,s.contactElapsed+delta);left-=delta;
    // Existing contact wins ties with a gravity deadline.
    if(s.contactElapsed!==null&&s.contactElapsed>=300-EPS&&grounded(s)){events.push(...lock(s));continue;}
    if(s.gravityElapsed>=gravityMs(s.lines)-EPS){s.gravityElapsed=0;events.push(...softDrop(s));continue;}
    if(delta<=EPS)break;
  }
  return events;
}
