export const INGREDIENTS=['당근','감자','양파'];
export const RECIPES=[[0,1],[1,2]];
export const RECIPE_NAMES=['당근 + 감자','감자 + 양파'];
export function stations(room=0){return room?[{kind:'source',type:0,x:0,y:0},{kind:'source',type:1,x:1,y:0},{kind:'source',type:2,x:2,y:0},{kind:'chop',x:4,y:0},{kind:'pot',x:5,y:0},{kind:'plate',x:6,y:0},{kind:'serve',x:4,y:4},{kind:'trash',x:6,y:4},{kind:'counter',x:2,y:2}]:[{kind:'source',type:0,x:0,y:0},{kind:'source',type:1,x:1,y:0},{kind:'source',type:2,x:2,y:0},{kind:'chop',x:4,y:0},{kind:'pot',x:5,y:0},{kind:'plate',x:6,y:0},{kind:'serve',x:5,y:4},{kind:'trash',x:6,y:4}];}
export function create(room=0){return{room:room%2,x:3,y:2,face:'up',time:60,elapsed:0,held:null,chop:0,chopping:false,pot:{items:[],phase:'empty',timer:0,recipe:null},orders:[{id:0,recipe:0}],nextOrder:9,issued:1,served:0,score:0,won:false,lost:false,message:'재료를 집어 손질대 앞에서 1초 누르세요.'};}
const vectors={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};
export function facing(s){const[dX,dY]=vectors[s.face];return stations(s.room).find(t=>t.x===s.x+dX&&t.y===s.y+dY);}
export function move(s,dir){if(s.won||s.lost||!vectors[dir])return false;s.chopping=false;s.chop=0;s.face=dir;const[dx,dy]=vectors[dir],x=s.x+dx,y=s.y+dy;if(x<0||x>6||y<0||y>4||stations(s.room).some(t=>t.x===x&&t.y===y))return false;s.x=x;s.y=y;return true;}
export function release(s){s.chopping=false;s.chop=0;}
export function interact(s){if(s.won||s.lost)return false;const t=facing(s);if(!t){s.message='조리대 쪽을 바라보고 가까이 가세요.';return false;}
 if(t.kind==='source'){if(s.held)return false;s.held={kind:'raw',type:t.type};s.message=`${INGREDIENTS[t.type]} · 생재료`;return true;}
 if(t.kind==='chop'){if(s.held?.kind!=='raw')return false;s.chopping=true;s.chop=0;s.message='제자리에서 1초 누르세요.';return true;}
 if(t.kind==='plate'){if(s.held)return false;s.held={kind:'plate'};s.message='빈 그릇을 집었어요.';return true;}
 if(t.kind==='trash'){s.held=null;s.message='손의 물건을 비웠어요.';return true;}
 if(t.kind==='pot'){
   if(s.pot.phase==='burnt'){s.pot={items:[],phase:'empty',timer:0,recipe:null};s.message='탄 냄비를 비웠어요.';return true;}
   if(s.pot.phase==='ready'&&s.held?.kind==='plate'){s.held={kind:'dish',recipe:s.pot.recipe};s.pot={items:[],phase:'empty',timer:0,recipe:null};s.message='수프를 담았어요. 제출대로!';return true;}
   if(!['empty','filling'].includes(s.pot.phase)||s.held?.kind!=='prepared'){s.message='손질 재료만 냄비에 넣을 수 있어요. 완성 수프에는 빈 그릇이 필요해요.';return false;}
   const items=[...s.pot.items,s.held.type];const match=RECIPES.findIndex(r=>items.length===1?r.includes(items[0]):r.slice().sort().join()===items.slice().sort().join());
   if(match<0){s.message='두 레시피에 맞는 서로 다른 재료를 넣으세요.';return false;}s.pot.items=items;s.held=null;s.pot.phase=items.length===2?'cooking':'filling';s.pot.timer=0;s.pot.recipe=items.length===2?match:null;s.message=items.length===2?'5초 조리 시작':'재료 하나 더 필요해요.';return true;
 }
 if(t.kind==='serve'&&s.held?.kind==='dish') {const order=s.orders[0];if(order&&order.recipe===s.held.recipe){s.orders.shift();s.served++;s.score+=100;s.message=`${s.served}그릇 성공!`;if(s.served>=5)s.won=true;}else{s.score-=20;s.message='다른 주문이에요. −20점';}s.held=null;return true;}
 return false;
}
export function tick(s,dt,holding=false){if(s.won||s.lost||!Number.isFinite(dt)||dt<=0)return;let rem=Math.min(dt,s.time);while(rem>1e-9&&!s.won){const t=Math.min(.02,rem);rem-=t;s.elapsed+=t;s.time=Math.max(0,60-s.elapsed);
 if(s.chopping&&holding&&facing(s)?.kind==='chop'&&s.held?.kind==='raw'){s.chop+=t;if(s.chop>=1-1e-9){s.held.kind='prepared';s.chop=0;s.chopping=false;s.message='손질 완료 · 냄비에 넣으세요.';}}else if(s.chopping)release(s);
 if(s.pot.phase==='cooking'){s.pot.timer+=t;if(s.pot.timer>=5-1e-9){s.pot.phase='ready';s.pot.timer=Math.max(0,s.pot.timer-5);s.message='수프 완성! 8초 안에 빈 그릇으로 담으세요.';}}
 else if(s.pot.phase==='ready'){s.pot.timer+=t;if(s.pot.timer>8){s.pot.phase='burnt';s.message='! 탄 냄비 · 상호작용해서 비우세요.';}}
 if(s.elapsed>=s.nextOrder&&s.issued<8){s.orders.push({id:s.issued,recipe:s.issued%2});s.issued++;s.nextOrder+=s.issued>=4?7:9;}
 }if(!s.won&&s.time<=1e-8){s.time=0;s.lost=true;}}
