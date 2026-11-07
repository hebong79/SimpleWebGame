import { mount, el, button } from '../vol2/shared.mjs';
import { LEVELS, valid, runs } from './engine.mjs';
import { campaign, cells, selected, arrow, memory, modeButtons } from './puzzle-ui.mjs';
mount({id:'21-pattern',title:'잉크 엽서',subtitle:'숫자 단서로 복원하는 작은 그림 · 8장의 엽서',theme:'ink',help:'행과 열의 숫자는 연속해서 칠할 칸 수예요. 숫자 묶음 사이에는 빈칸 하나 이상을 두세요.\n클릭·드래그로 채우고, F 채움 · X 빈칸 · E 지우개를 골라요. 방향키 + Enter로도 칠할 수 있어요.\n모든 행과 열이 맞으면 엽서가 보관돼요. ×는 메모이며 미표시 칸도 빈칸으로 검사해요.',create(ctx){
 let board=[],buttons=[],at=0,mode=1,hints=0,seconds=0,history=[],stroke=null;
 const stage=el('div','puzzle-stage'),heading=el('p','puzzle-heading'),layout=el('div','clue-layout'),corner=el('span','corner','열 ↓ / 행 →'),cols=el('div','column-clues'),rows=el('div','row-clues'),field=el('div'),collection=el('div','collection');layout.append(corner,cols,rows,field);stage.append(heading,layout,collection);ctx.board.append(stage);
 const tour=campaign(ctx,LEVELS,reset),setModeButtons=modeButtons(ctx,[[1,'채움 F'],[-1,'빈칸 × X'],[0,'지우개 E']],choose);
 const hintButton=button('줄 힌트',()=>{
  if(!ctx.active())return;
  const n=tour.level.n,row=tour.level.clues.rows.findIndex((clue,i)=>JSON.stringify(runs(board.slice(i*n,(i+1)*n)))!==JSON.stringify(clue));
  const column=row<0?tour.level.clues.cols.findIndex((clue,c)=>JSON.stringify(runs(Array.from({length:n},(_,r)=>board[r*n+c])))!==JSON.stringify(clue)):-1;
  const axis=row>=0?'row':'column',index=row>=0?row:column;
  if(index<0){ctx.status('모든 행과 열의 단서가 맞아요. 엽서를 완성했어요.');return;}
  hints++;paint();
  buttons.forEach((b,i)=>b.classList.toggle('highlight-line',axis==='row'?Math.floor(i/n)===index:i%n===index));
  rows.querySelectorAll('.clue').forEach((node,i)=>node.classList.toggle('highlight-line',axis==='row'&&i===index));
  cols.querySelectorAll('.clue').forEach((node,i)=>node.classList.toggle('highlight-line',axis==='column'&&i===index));
  const clue=axis==='row'?tour.level.clues.rows[index]:tour.level.clues.cols[index];
  ctx.status(`${index+1}${axis==='row'?'행':'열'}의 단서 ${clue.join(' · ')}부터 비교해 보세요. 답은 칠하지 않아요.`);
 });
 const paper=button('푸른 종이 · 4장 보관',()=>{if(ctx.record.completed.length<4)return;stage.classList.toggle('blue-paper');ctx.record.paper=stage.classList.contains('blue-paper');ctx.persist();});ctx.tools.append(hintButton,paper);
 function choose(value){mode=value;setModeButtons(mode);ctx.status(`선택 도구: ${mode===1?'채움':mode===-1?'빈칸 ×':'지우개'}`);}
 function reset(){const level=tour.level;board=Array(level.n**2).fill(0);at=0;hints=0;seconds=0;history=[];stroke=null;buttons=cells(field,level.n,()=>{});buttons.forEach(b=>b.addEventListener('click',e=>e.preventDefault()));cols.style.setProperty('--n',level.n);rows.style.setProperty('--n',level.n);cols.replaceChildren(...level.clues.cols.map(c=>el('span','clue',c.join('\n'))));rows.replaceChildren(...level.clues.rows.map(c=>el('span','clue',c.join(' '))));paper.disabled=ctx.record.completed.length<4;stage.classList.toggle('blue-paper',!!ctx.record.paper&&ctx.record.completed.length>=4);setModeButtons(mode);tour.refresh();ctx.score(0);ctx.status('채움·빈칸·지우개 중 도구를 고르고 엽서를 복원하세요.');paint();}
 function paint(){const n=tour.level.n;selected(buttons,at);buttons.forEach((b,i)=>{b.textContent=board[i]===-1?'×':'';b.classList.toggle('filled',board[i]===1);b.classList.toggle('marked',board[i]===-1);b.setAttribute('aria-label',`${Math.floor(i/n)+1}행 ${i%n+1}열 ${board[i]===1?'채움':board[i]===-1?'빈칸 표식':'미확정'}`);});heading.textContent=`${tour.level.n}×${tour.level.n} · ${mode===1?'채움':mode===-1?'빈칸 ×':'지우개'} · ${hints?'힌트 사용':'힌트 없이 도전'}`;rows.querySelectorAll('.clue').forEach((b,r)=>b.classList.toggle('satisfied',JSON.stringify(runs(board.slice(r*n,(r+1)*n)))===JSON.stringify(tour.level.clues.rows[r])));cols.querySelectorAll('.clue').forEach((b,c)=>b.classList.toggle('satisfied',JSON.stringify(runs(Array.from({length:n},(_,r)=>board[r*n+c])))===JSON.stringify(tour.level.clues.cols[c])));collection.replaceChildren(...LEVELS.map((l,i)=>el('span',ctx.record.completed.includes(i)?'collected':'',`${ctx.record.completed.includes(i)?'✓':'◇'} ${l.name}`)));ctx.score(board.filter(v=>v===1).length);}
 function check(){if(valid(board,tour.level)){tour.complete(hints,seconds);paint();paper.disabled=ctx.record.completed.length<4;ctx.win(`「${tour.level.name}」 엽서를 보관했어요! 다음 문제 버튼으로 새 도안을 고르세요.`,Math.max(1,1000-Math.floor(seconds)-hints*50));}}
 function apply(i,value,remember=true){if(!ctx.active()||i<0||i>=board.length)return;at=i;if(board[i]===value){paint();return;}if(remember)memory(history,board);board[i]=value;paint();}
 field.addEventListener('pointerdown',event=>{if(!ctx.active()||stroke||event.button!==0||!event.isPrimary)return;const target=event.target.closest('[data-index]');if(!target)return;event.preventDefault();memory(history,board);stroke={id:event.pointerId,visited:new Set(),value:mode};field.setPointerCapture(event.pointerId);const i=Number(target.dataset.index);stroke.visited.add(i);apply(i,mode,false);});
 field.addEventListener('pointermove',event=>{if(!stroke||stroke.id!==event.pointerId||!ctx.active())return;const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-index]');if(!target||!field.contains(target))return;const i=Number(target.dataset.index);if(!stroke.visited.has(i)){stroke.visited.add(i);apply(i,stroke.value,false);}});
 field.addEventListener('pointerup',event=>{if(stroke?.id!==event.pointerId)return;stroke=null;check();ctx.board.focus({preventScroll:true});});field.addEventListener('pointercancel',event=>{if(stroke?.id===event.pointerId)stroke=null;});field.style.touchAction='none';
 return{reset,undo(){if(history.length){board=history.pop();paint();}},key(e){if(arrow(e,tour.level.n,at,i=>{at=i;paint();}))return;if(['f','x','e'].includes(e.key.toLowerCase())){e.preventDefault();choose({f:1,x:-1,e:0}[e.key.toLowerCase()]);}if(e.key==='Enter'||e.key===' '){e.preventDefault();apply(at,mode);check();}if(e.key.toLowerCase()==='z'&&history.length){e.preventDefault();board=history.pop();paint();}},tick(dt){seconds+=dt;},pause(){stroke=null;},snapshot(){return{level:tour.index,n:tour.level.n,board:[...board],mode,hints,seconds,completed:[...ctx.record.completed]};}};
}});
