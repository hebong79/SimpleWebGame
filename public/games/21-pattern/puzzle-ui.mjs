import { el, button } from '../vol2/shared.mjs';
export function campaign(ctx,levels,reload){
 const record=ctx.record;
 record.completed=Array.isArray(record.completed)?[...new Set(record.completed.filter(i=>Number.isInteger(i)&&i>=0&&i<levels.length))]:[];
 record.clean=Array.isArray(record.clean)?[...new Set(record.clean.filter(i=>Number.isInteger(i)&&i>=0&&i<levels.length))]:[];
 record.times=record.times&&typeof record.times==='object'&&!Array.isArray(record.times)?record.times:{};
 let index=Number.isInteger(record.level)&&record.level>=0&&record.level<levels.length?record.level:0;
 const label=el('span','level-label'),prev=button('← 이전 문제',()=>change(-1)),next=button('다음 문제 →',()=>change(1));
 ctx.tools.append(prev,label,next);
 function refresh(){label.textContent=`${index+1} / ${levels.length}${record.completed.includes(index)?' · ✓ 완료':''}`;prev.disabled=index===0;next.disabled=index===levels.length-1;ctx.meta(`${levels[index].name} · 보관 ${record.completed.length}/${levels.length}`);}
 function change(step){index=Math.max(0,Math.min(levels.length-1,index+step));record.level=index;ctx.persist();reload();}
 function complete(hints,seconds){if(!record.completed.includes(index))record.completed.push(index);if(!hints&&!record.clean.includes(index))record.clean.push(index);if(!Number.isFinite(record.times[index])||record.times[index]>seconds)record.times[index]=Math.round(seconds*10)/10;ctx.persist();refresh();}
 return{get index(){return index;},get level(){return levels[index];},refresh,complete};
}
export function arrow(event,n,current,set){const moves={ArrowLeft:-1,ArrowRight:1,ArrowUp:-n,ArrowDown:n};if(!(event.key in moves))return false;event.preventDefault();const r=Math.floor(current/n),c=current%n;let next=current+moves[event.key];if(event.key==='ArrowLeft'&&c===0||event.key==='ArrowRight'&&c===n-1||event.key==='ArrowUp'&&r===0||event.key==='ArrowDown'&&r===n-1)next=current;set(next);return true;}
export function cells(parent,n,onClick){parent.replaceChildren();parent.className='puzzle-grid';parent.style.setProperty('--n',n);return Array.from({length:n*n},(_,i)=>{const b=button('',()=>onClick(i),'puzzle-cell');b.dataset.index=String(i);b.setAttribute('aria-label',`${Math.floor(i/n)+1}행 ${i%n+1}열`);parent.append(b);return b;});}
export function selected(cells,index){cells.forEach((b,i)=>{b.classList.toggle('selected',i===index);b.tabIndex=i===index?0:-1;});}
export function memory(history,state){history.push(structuredClone(state));if(history.length>300)history.shift();}
export function modeButtons(ctx,items,choose){const buttons=items.map(([value,label])=>{const b=button(label,()=>choose(value));ctx.tools.append(b);return [value,b];});return value=>buttons.forEach(([v,b])=>b.setAttribute('aria-pressed',String(v===value)));}
