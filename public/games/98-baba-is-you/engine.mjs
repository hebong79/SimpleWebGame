export const LABELS={robot:'로봇',door:'문',box:'상자',wall:'담',rock:'돌',is:'이다',you:'조작',win:'도착',stop:'벽',push:'밀기'};
const nouns=['robot','door','box','wall','rock'],props=['you','win','stop','push'];
const clone=x=>JSON.parse(JSON.stringify(x));
function sentence(words,n,p,x,y){for(const [i,word]of[n,'is',p].entries())words.push({id:`w${words.length}`,word,x:x+i,y});}
function makeLevel(kind,variant){const words=[];const objects=[];const add=(noun,x,y)=>objects.push({id:noun,noun,x,y});
 if(kind===0){sentence(words,'robot','you',0,0);sentence(words,'door','win',1,1);words.find(w=>w.word==='win').y=2;sentence(words,'wall','stop',0,5);sentence(words,'rock','push',0,6);add('robot',3,3);add('door',variant?5:5,variant?4:3);add('wall',6,5);add('rock',variant?4:1,4);add('box',6,6);}
 if(kind===1){sentence(words,'door','win',0,0);sentence(words,'box','you',1,2);words.find(w=>w.word==='you').y=3;sentence(words,'wall','stop',0,5);sentence(words,'robot','you',0,6);sentence(words,'rock','push',4,6);add('robot',3,4);add('box',4,4);add('door',variant?5:5,variant?3:4);add('wall',6,5);add('rock',1,4);}
 if(kind===2){sentence(words,'robot','you',0,0);sentence(words,'box','win',1,2);words.find(w=>w.word==='win').y=3;sentence(words,'wall','stop',0,5);sentence(words,'rock','push',0,6);add('robot',3,4);add('box',5,variant?3:4);add('door',6,6);add('wall',6,5);add('rock',1,4);}
 return{title:['도착 문장 잇기','조작 대상을 상자로','도착 대상을 상자로'][kind]+(variant?' · 응용':''),words,objects,kind,variant};}
export const LEVELS=[makeLevel(0,0),makeLevel(0,1),makeLevel(1,0),makeLevel(1,1),makeLevel(2,0),makeLevel(2,1)];
export const SOLUTIONS=[['up','down','right','right'],['up','down','right','right','down'],['up','right'],['up','right','up'],['up','right','right','down'],['up','right','right']];
export function rules(s){const result=[];for(let y=0;y<7;y++)for(let x=0;x<7;x++)for(const [dx,dy,axis]of[[1,0,'h'],[0,1,'v']]){const a=s.words.find(w=>w.x===x&&w.y===y),b=s.words.find(w=>w.x===x+dx&&w.y===y+dy),c=s.words.find(w=>w.x===x+dx*2&&w.y===y+dy*2);if(a&&b&&c&&nouns.includes(a.word)&&b.word==='is'&&props.includes(c.word))result.push({noun:a.word,prop:c.word,x,y,axis});}return result;}
export function create(level=0){const data=clone(LEVELS[((level%6)+6)%6]);return{...data,level:((level%6)+6)%6,moves:0,won:false,history:[],rules:[]};}
export function read(s){s.rules=rules(s);return s.rules;}
export function controlled(s){const rule=rules(s).find(r=>r.prop==='you');return rule?s.objects.find(o=>o.noun===rule.noun):undefined;}
export function move(s,dir){if(s.won)return false;const [dx,dy]=({left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]})[dir]||[0,0];if(!dx&&!dy)return false;const r=rules(s),player=controlled(s);if(!player)return false;const before=clone({words:s.words,objects:s.objects,moves:s.moves,won:s.won});
 const has=(o,p)=>r.some(q=>q.noun===o.noun&&q.prop===p);
 const shifted=new Set();function push(entity){const x=entity.x+dx,y=entity.y+dy;if(x<0||y<0||x>=7||y>=7)return false;const at=s.objects.filter(o=>o!==entity&&o.x===x&&o.y===y);if(at.some(o=>has(o,'stop')))return false;const blockers=[...s.words.filter(w=>w!==entity&&w.x===x&&w.y===y),...at.filter(o=>has(o,'push'))];for(const b of blockers)if(!shifted.has(b.id)&&!push(b))return false;entity.x=x;entity.y=y;shifted.add(entity.id);return true;}
 if(!push(player)){s.words=before.words;s.objects=before.objects;return false;}s.history.push(before);s.moves++;read(s);const now=controlled(s);if(now&&s.objects.some(o=>o.x===now.x&&o.y===now.y&&s.rules.some(q=>q.noun===o.noun&&q.prop==='win')))s.won=true;return true;}
export function undo(s){const b=s.history.pop();if(!b)return false;Object.assign(s,b);read(s);return true;}
export function snapshot(s){return{level:s.level,moves:s.moves,won:s.won,words:clone(s.words),objects:clone(s.objects),rules:rules(s),controlled:controlled(s)?.noun||null};}
