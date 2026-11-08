import {el,button} from '../vol4/shared.mjs';
export function layout(ctx,levels,columns,changeLevel){
 const picker=el('div','level-picker');picker.setAttribute('aria-label','단계 선택');
 const label=el('span','','문제');picker.append(label);
 const levelButtons=levels.map((l,i)=>{const b=button(String(i+1),()=>ctx.newRound(()=>changeLevel(i)));b.setAttribute('aria-label',`${i+1}단계 ${l.name}`);picker.append(b);return b;});
 ctx.tools.append(picker);
 const scroll=el('div','puzzle-scroll'),board=el('div','puzzle-grid');board.style.setProperty('--cols',columns);scroll.append(board);ctx.board.append(scroll);
 const cells=Array.from({length:columns===7?49:columns===3?9:columns===4?16:25},(_,i)=>{const b=button('',()=>{});b.className='puzzle-cell';b.dataset.index=i;board.append(b);return b;});
 return {cells,board,scroll,levelButtons,level(i){levelButtons.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));},select(i){cells.forEach((b,j)=>b.classList.toggle('cursor',i===j));}};
}
export function safeCompleted(record){return Array.isArray(record.completed)?[...new Set(record.completed.filter(v=>Number.isInteger(v)&&v>=0&&v<8))]:[];}
export function complete(ctx,index,moves,hints=0){
 const completed=safeCompleted(ctx.record);if(!completed.includes(index))completed.push(index);ctx.record.completed=completed;
 const previous=ctx.record.levelBest;ctx.record.levelBest=Array.isArray(previous)?previous.slice(0,8):[];
 const old=ctx.record.levelBest[index];if(!Number.isInteger(old)||old<1||moves<old)ctx.record.levelBest[index]=Math.max(1,moves);
 ctx.record.hints=(Number.isInteger(ctx.record.hints)&&ctx.record.hints>=0?ctx.record.hints:0)+hints;
 ctx.persist();ctx.win(`${index+1}단계 완료 · ${moves}회 · 힌트 ${hints}회`,Math.max(1,1000-moves*5-hints*50));
}
export function directions(ctx,move){for(const [d,name]of [['up','↑ 위'],['left','← 왼쪽'],['down','↓ 아래'],['right','→ 오른쪽']])ctx.tools.append(button(name,()=>{if(ctx.active())move(d);}));}
export const arrow={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
export function focusIndex(event,cells,selected,cols){
 const focused=cells.indexOf(event.target);let i=focused>=0?focused:selected;
 const delta={ArrowUp:-cols,ArrowDown:cols,ArrowLeft:-1,ArrowRight:1}[event.key];if(delta===undefined)return null;
 if((event.key==='ArrowLeft'&&i%cols===0)||(event.key==='ArrowRight'&&i%cols===cols-1))return i;
 i=Math.max(0,Math.min(cells.length-1,i+delta));cells[i].focus({preventScroll:true});cells[i].scrollIntoView({block:'nearest',inline:'nearest'});return i;
}
export function numberTools(ctx,max,enter){for(let n=1;n<=max;n++)ctx.tools.append(button(String(n),()=>ctx.active()&&enter(n)));ctx.tools.append(button('지우기',()=>ctx.active()&&enter(0)));}
