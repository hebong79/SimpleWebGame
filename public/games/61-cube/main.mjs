import {mount,el} from '../vol4/shared.mjs';
import {layout,directions,arrow,complete} from './puzzle-ui.mjs';
import {create,move} from './engine.mjs';import {levels} from './levels.mjs';
mount({id:'61-cube',title:'여섯 면 도장',subtitle:'작은 상자를 굴려 여섯 도장을 모아요',theme:'wood',help:'4×5 작업대의 도장 6개를 큐브의 여섯 면으로 옮기세요. 방향키 또는 방향 버튼으로 굴리면 착지 칸과 바닥 면의 도장이 교환됩니다. 전개도의 면 번호는 고정입니다. 굴리는 동안 다음 입력은 하나만 예약됩니다.',themeNames:['종이 상자','푸른 상자 · 2회 완료','기념 상자 · 5회 완료'],create(ctx){
 let level=0,s,history=[],lock=0,pending=null;
 const ui=layout(ctx,levels,5,i=>{level=i;});ui.cells.splice(20).forEach(b=>b.remove());
 const net=el('div','cube-net'),netCells=[];const positions=[[2,2],[4,2],[1,2],[3,2],[2,1],[2,3]];
 positions.forEach(([r,c],id)=>{const n=el('div','cube-face');n.style.gridRow=r;n.style.gridColumn=c;net.append(n);netCells.push(n);});
 ctx.board.append(el('p','net-caption','고정 면 번호 · ● 도장 / ○ 빈 면'),net);
 function render(){ui.level(level);ui.cells.forEach((b,i)=>{b.className='puzzle-cell'+(s.floor[i]?' stamped':'')+(i===s.y*5+s.x?' cube':'');b.textContent=s.floor[i]?'●':'';b.setAttribute('aria-label',`${Math.floor(i/5)+1}행 ${i%5+1}열 ${s.floor[i]?'도장':''}${i===s.y*5+s.x?' 큐브':''}`);});netCells.forEach((n,id)=>{n.textContent=`${id+1} ${s.faces[id]?'●':'○'}`;n.classList.toggle('filled',!!s.faces[id]);});s.orientation.forEach((id,side)=>{netCells[id].style.gridRow=positions[side][0];netCells[id].style.gridColumn=positions[side][1];netCells[id].setAttribute('aria-label',`${['위','바닥','북','남','서','동'][side]}쪽 ${id+1}번 면 ${s.faces[id]?'도장 있음':'빈 면'}`);});ctx.meta(`${level+1}/8 · ${levels[level].name} · 이동 ${s.moves}`);ctx.score(s.faces.filter(Boolean).length);ctx.status(`도장 ${s.faces.filter(Boolean).length}/6 · 위 ${s.orientation[0]+1} / 바닥 ${s.orientation[1]+1}번 면`);}
 function act(d){if(!ctx.active())return;if(lock>0){pending=d;return;}const next=move(s,d);if(next===s)return;history.push(s);s=next;lock=.14;render();if(s.won)complete(ctx,level,s.moves);}
 directions(ctx,act);
 return {reset(){s=create(levels[level]);history=[];lock=0;pending=null;render();},undo(){if(history.length){s=history.pop();lock=0;pending=null;render();}},pause(){pending=null;lock=0;},tick(dt){if(lock>0){lock-=dt;if(lock<=0&&pending){const d=pending;pending=null;act(d);}}},key(e){if(arrow[e.key]){e.preventDefault();act(arrow[e.key]);}},snapshot:()=>({...s,level,queued:pending})};
}});
