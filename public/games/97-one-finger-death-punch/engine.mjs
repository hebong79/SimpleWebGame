export function create(mode=0){return{mode:mode?1:0,time:45,elapsed:0,life:3,score:0,combo:0,bestCombo:0,kills:0,spawned:0,cooldown:0,lastInput:-1,won:false,lost:false,dolls:[],feedback:'사정거리 안의 인형을 기다리세요.'};}
export function attack(s,side,stamp=s.elapsed){
 if(s.won||s.lost||![-1,1].includes(side)||s.cooldown>1e-9||stamp===s.lastInput)return false;s.lastInput=stamp;
 const targets=s.dolls.filter(d=>d.side===side&&d.distance<=80&&d.distance>0).sort((a,b)=>a.distance-b.distance);
 if(!targets.length){s.cooldown=.22;s.combo=0;s.feedback='헛입력 · 220ms 준비';return false;}
 s.dolls.splice(s.dolls.indexOf(targets[0]),1);s.kills++;s.combo++;s.bestCombo=Math.max(s.bestCombo,s.combo);s.score+=10+(s.combo%5===0?20:0);s.feedback=`${s.combo}연속!`;
 if(s.kills===20)s.won=true;return true;
}
export function tick(s,dt){if(s.won||s.lost||!Number.isFinite(dt)||dt<=0)return;let rem=Math.min(dt,s.time);while(rem>1e-9&&!s.lost&&!s.won){const t=Math.min(.01,rem);rem-=t;s.elapsed+=t;s.time=Math.max(0,45-s.elapsed);s.cooldown=Math.max(0,s.cooldown-t);
 const gap=s.mode?1.1:1.3;while(s.spawned<20&&s.elapsed>=s.spawned*gap){const i=s.spawned++;s.dolls.push({id:i,side:i%2?-1:1,speed:(i%3===0?75:50)*(s.mode?1.3:1),distance:240});}
 for(const d of [...s.dolls]){d.distance-=d.speed*t;if(d.distance<=0){s.dolls.splice(s.dolls.indexOf(d),1);s.life--;s.combo=0;s.feedback='중앙 접촉 · 생명 감소';if(s.life<=0)s.lost=true;}}
 }if(!s.won&&s.time<=1e-8){s.time=0;s.lost=true;}}
