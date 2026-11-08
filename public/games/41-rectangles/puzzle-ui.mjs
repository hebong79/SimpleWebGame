import {el,button} from '../vol3/shared.mjs';
export {el,button};
export function write(node,value){const s=String(value);if(node.textContent!==s)node.textContent=s;}
export function historyPush(history,value){history.push(structuredClone(value));if(history.length>250)history.shift();}
export function campaign(ctx,levels,reload){
 const record=ctx.record;
 record.completed=Array.isArray(record.completed)?[...new Set(record.completed.filter(i=>Number.isInteger(i)&&i>=0&&i<levels.length))]:[];
 record.hints=Number.isSafeInteger(record.hints)&&record.hints>=0?record.hints:0;
 record.minHints=record.minHints&&typeof record.minHints==='object'&&!Array.isArray(record.minHints)?Object.fromEntries(Object.entries(record.minHints).filter(([k,v])=>/^\d+$/.test(k)&&Number(k)<levels.length&&Number.isSafeInteger(v)&&v>=0)):{};
 let index=Number.isInteger(record.level)&&record.level>=0&&record.level<levels.length?record.level:0;
 const strip=el('div','level-strip'),label=el('strong','level-label'),prev=button('← 이전 문제',()=>change(-1)),next=button('다음 문제 →',()=>change(1));strip.append(prev,label,next);ctx.tools.append(strip);
 function refresh(){write(label,`${index+1} / ${levels.length}${record.completed.includes(index)?' ✓':''}`);prev.disabled=index===0;next.disabled=index===levels.length-1;ctx.meta(`${levels[index].name} · 완료 ${record.completed.length}/${levels.length}`);}
 function change(delta){const nextIndex=Math.max(0,Math.min(levels.length-1,index+delta));if(ctx.newRound){ctx.newRound(()=>{index=nextIndex;record.level=index;ctx.persist();});}else{index=nextIndex;record.level=index;ctx.persist();reload();}}
 function complete(hints){if(!record.completed.includes(index))record.completed.push(index);if(!Number.isFinite(record.minHints[index])||hints<record.minHints[index])record.minHints[index]=hints;ctx.persist();refresh();}
 return {get index(){return index;},get level(){return levels[index];},refresh,complete,hint(){record.hints++;ctx.persist();}};
}
export function makeCells(parent,rows,cols,onClick){parent.replaceChildren();parent.className='puzzle-grid';parent.style.setProperty('--cols',cols);return Array.from({length:rows*cols},(_,i)=>{const b=button('',()=>onClick(i),'puzzle-cell');b.dataset.cell=String(i);parent.append(b);return b;});}
export function focusCells(nodes,at){nodes.forEach((node,i)=>{node.classList.toggle('cursor',i===at);node.tabIndex=i===at?0:-1;});}
export function arrows(e,at,rows,cols,set){const dirs={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]};if(!dirs[e.key])return false;e.preventDefault();const [dr,dc]=dirs[e.key],r=Math.floor(at/cols),c=at%cols;set(Math.max(0,Math.min(rows-1,r+dr))*cols+Math.max(0,Math.min(cols-1,c+dc)));return true;}
