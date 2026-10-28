import { LEVELS } from './levels.mjs';
import { createGame, move, undo, cornerDeadlocks, snapshot } from './engine.mjs';
import { createPersistence, PARTS, SETS, availableSets, canEquip, equipRecord, settleClear } from './save.mjs';
import { drawBoard, drawPreview } from './art.mjs';

const $ = id => document.getElementById(id);
const text = (element, value) => { const next=String(value); if(element.textContent!==next) element.textContent=next; };
const arena=$('arena'), canvas=$('board'), ctx=canvas.getContext('2d'), dialog=$('modal');
const previewCtx=$('preview').getContext('2d');
const persistence=createPersistence(() => window.localStorage, message => { text($('storage-warning'),message);$('storage-warning').hidden=false; });
let record=persistence.load(), game=createGame(1), phase='ready', pauseReason='', direction='D', pose='walk', feedbackUntil=0;
let settlements=0, lastImproved=false, frames=[], draft={...record.equipped}, previewDirection='D', previewPose='walk';
let gesture=null;
const touches=new Set();
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const labels={basic:'기본',delivery:'택배',mechanic:'정비사',chef:'요리사'};
const fullLabels={basic:'기본 햄스터',delivery:'택배 유니폼',mechanic:'정비사 작업복',chef:'요리사 옷'};
const partLabels={hat:'모자',workwear:'작업복',bag:'가방'};
const directionLabels={U:'위',R:'오른쪽',D:'아래',L:'왼쪽'};
const panels=[...document.querySelectorAll('[data-panel]')];
const setButtons=[],partButtons=[],levelButtons=[];
let audio=null;
const voices=new Set();
function stopSound(){for(const voice of voices){try{voice.stop();}catch{/* Already stopped. */}}voices.clear();}
function sound(kind){
  if(record.muted)return;
  try{
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
    audio??=new Audio();if(audio.state==='suspended')void audio.resume().catch(()=>{});
    const tones=kind==='clear'?[523,659,784]:kind==='push'?[196]:[330];
    tones.forEach((frequency,index)=>{const oscillator=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime+index*.075;
      oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,start);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.045,start+.01);gain.gain.exponentialRampToValueAtTime(.001,start+.085);oscillator.connect(gain);gain.connect(audio.destination);voices.add(oscillator);oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};oscillator.start(start);oscillator.stop(start+.09);
    });
  }catch{stopSound();/* Sound is optional; gameplay and mute remain available. */}
}
const activePanel=()=>frames.at(-1)?.name??null;
function clearInput(){gesture=null;touches.clear();feedbackUntil=0;pose='walk';stopSound();}
function focusSafely(target){
  const destination=target?.isConnected&&!target.disabled&&!target.closest('[hidden]')?target:$('primary');
  destination.focus({preventScroll:true});
  // Native close may restore body after script focus, particularly on WebKit.
  requestAnimationFrame(()=>{if(!dialog.open&&(document.activeElement===document.body||dialog.contains(document.activeElement)))destination.focus({preventScroll:true});});
}
function showPanel(name){
  for(const panel of panels)panel.hidden=panel.dataset.panel!==name;
  text($('modal-title'),({help:'처음 오셨나요?',levels:'오늘의 배송 창고',wardrobe:'햄스터 옷장',confirm:'잠깐 확인해 주세요',result:game.board.id===20?'모든 배송을 마쳤어요!':'배송 완료!'})[name]);
}
function openPanel(name,trigger,action=null){
  const frame={name,trigger,returnPhase:phase,returnReason:pauseReason,action};
  clearInput();
  if(phase==='playing'){phase='paused';pauseReason='menu';}
  frames.push(frame);
  if(name==='wardrobe'){draft={...record.equipped};previewDirection='D';previewPose='walk';updateWardrobe();}
  if(name==='levels')updateLevels();
  showPanel(name);render();
  if(!dialog.open)dialog.showModal();
  const first=name==='confirm'?$('confirm-cancel'):name==='result'?$('next').disabled?$('result-retry'):$('next'):$('modal-close');
  first.focus({preventScroll:true});
}
function closePanel(){
  const previous=frames.pop();if(!previous)return;
  clearInput();
  if(frames.length){showPanel(activePanel());render();focusSafely(previous.trigger);return;}
  dialog.close();phase=previous.returnPhase;pauseReason=previous.returnReason;render();focusSafely(previous.trigger);
}
function closeAll(){frames=[];if(dialog.open)dialog.close();clearInput();}
function protect(reason){
  if(phase==='playing'){clearInput();phase='paused';pauseReason=reason;text($('game-status'),'보호 정지했습니다. 배송 재개를 눌러 계속해 주세요.');render();}
  else if(frames.length&&frames[0].returnPhase==='playing'){
    clearInput();frames[0].returnPhase='paused';frames[0].returnReason=reason;
  }
}
function newLevel(id){
  if(!Number.isInteger(id)||id<1||id>record.unlocked)return;
  closeAll();game=createGame(id);phase='ready';pauseReason='';direction='D';pose='walk';
  text($('game-status'),'시간제한은 없어요. 천천히 길을 찾아보세요.');render();$('primary').focus({preventScroll:true});
}
function confirm(action,trigger,copy){text($('confirm-copy'),copy);openPanel('confirm',trigger,action);}
function requestRestart(trigger){confirm(()=>newLevel(game.board.id),trigger,'현재 창고를 처음부터 다시 정리할까요? 아직 완료하지 않은 이동은 초기화됩니다.');}
function requestHome(trigger){
  if(phase==='won'||(phase==='ready'&&game.moves===0)){location.assign('/');return;}
  confirm(()=>location.assign('/'),trigger,'현재 배송을 그만두고 게임 목록으로 돌아갈까요? 진행 중인 창고는 저장되지 않습니다.');
}
function render(){
  const id=game.board.id, level=LEVELS[id-1], best=record.bests[id];
  text($('stage-number'),`배송 ${String(id).padStart(2,'0')} / 20`);text($('stage-name'),level.name);
  text($('stage-stamp'),record.cleared.includes(id)?'배송 완료 기록':'신입 배송원');
  text($('moves'),game.moves);text($('pushes'),game.pushes);text($('goals'),`${game.boxes.filter(p=>game.board.goals.includes(p)).length} / ${game.boxes.length}`);
  text($('progress'),`${record.cleared.length} / 20`);text($('best'),best?`밀기 ${best.pushes} · 이동 ${best.moves}`:'아직 배송 전');text($('level-hint'),level.hint);
  text($('mute'),record.muted?'소리 꺼짐':'소리 켜짐');$('mute').setAttribute('aria-pressed',String(record.muted));
  text($('primary'),phase==='ready'?'배송 시작':phase==='playing'?'일시정지':phase==='paused'?'배송 재개':'결과 보기');
  $('board-curtain').hidden=phase==='playing'||phase==='won';
  text($('curtain-title'),phase==='ready'?'오늘의 배송을 시작할까요?':'잠시 쉬어 가요');
  text($('curtain-description'),phase==='ready'?'상자를 점선 목표 위에 모두 올려 주세요.':pauseReason==='manual'?'준비되면 배송 재개를 눌러 주세요.':'창이나 메뉴를 벗어나 안전하게 멈췄습니다. 직접 재개해 주세요.');
  $('undo').disabled=phase!=='playing'||!game.history.length;
  for(const button of document.querySelectorAll('[data-direction]'))button.disabled=phase!=='playing';
  canvas.setAttribute('aria-label',`${id}단계 ${level.name}, 이동 ${game.moves}, 밀기 ${game.pushes}, 도착 ${game.boxes.filter(p=>game.board.goals.includes(p)).length}/${game.boxes.length}. 상자와 벽의 위치는 시각 보드에 표시됩니다.`);
  drawBoard(ctx,game,record.equipped,direction,pose);
}
function settle(){
  // Only the transition into won calls this function, never opening a result.
  const before=record.cleared.length;
  const settled=settleClear(record,game.board.id,{pushes:game.pushes,moves:game.moves});
  record=settled.record;lastImproved=settled.improved;settlements++;persistence.save(record);
  phase='won';pauseReason='';
  text($('result-message'),game.board.id===20?'20개 창고, 모두 배송 완료!':`${game.board.id}단계 배송 완료!`);
  text($('result-pushes'),game.pushes);text($('result-moves'),game.moves);
  text($('result-best'),lastImproved?'새 개인 기록입니다!':`개인 기록 · 밀기 ${record.bests[game.board.id].pushes} / 이동 ${record.bests[game.board.id].moves}`);
  text($('result-unlock'),before<5&&record.cleared.length>=5?'정비사 작업복이 열렸어요!':before<15&&record.cleared.length>=15?'요리사 옷이 열렸어요!':game.board.id===20?'창고의 달인! 모든 단계를 다시 도전할 수 있어요.':`${Math.min(20,game.board.id+1)}단계를 선택할 수 있어요.`);
  $('next').disabled=game.board.id===20;text($('next'),game.board.id===20?'모든 배송 완료':'다음 창고');
  text($('game-status'),'배송 완료! 기록을 저장했습니다. 완료 후에는 되돌릴 수 없어요.');
  openPanel('result',$('primary'));sound('clear');
}
function act(code){
  if(phase!=='playing'||dialog.open||document.hidden)return;
  const next=move(game,code);if(next===game)return;
  const pushed=next.pushes!==game.pushes;game=next;direction=code;pose=pushed?'push':'walk';feedbackUntil=performance.now()+150;
  sound(pushed?'push':'move');
  if(game.won){settle();return;}
  const dead=cornerDeadlocks(game);
  text($('game-status'),dead.length?'상자가 구석에 걸린 것 같아요. 되돌리기나 재시작을 사용할 수 있어요.':pushed?'택배를 한 칸 밀었어요. 돌아갈 길을 남겨 주세요.':'차근차근, 상자 뒤로 돌아가 보세요.');render();
}
function undoAction(){
  if(phase!=='playing'||dialog.open)return;
  const next=undo(game);if(next===game)return;
  game=next;clearInput();text($('game-status'),'한 걸음을 되돌렸어요. 이동과 밀기 수도 복원했습니다.');render();arena.focus({preventScroll:true});
}
function updateLevels(){
  levelButtons.forEach((button,index)=>{
    const id=index+1,best=record.bests[id];button.disabled=id>record.unlocked;
    button.classList.toggle('completed',!!best);button.classList.toggle('current',id===game.board.id);
    text(button.querySelector('small'),id>record.unlocked?'이전 단계 완료':best?`밀기 ${best.pushes} · 이동 ${best.moves}`:'도전 가능');
    button.setAttribute('aria-label',`${id}단계 ${LEVELS[index].name}, ${id>record.unlocked?'잠김':best?'완료':'도전 가능'}`);
    if(id===game.board.id)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
  });
}
function updateWardrobe(){
  const owned=availableSets(record);
  for(const button of setButtons){
    const set=button.dataset.set,matched=PARTS.every(p=>draft[p]===set);
    button.setAttribute('aria-pressed',String(matched));button.classList.toggle('locked',!owned.includes(set));
    text(button.querySelector('small'),set==='mechanic'?`5단계 완료 · ${Math.min(5,record.cleared.length)}/5`:set==='chef'?`15단계 완료 · ${Math.min(15,record.cleared.length)}/15`:'기본 지급');
  }
  for(const button of partButtons){button.setAttribute('aria-pressed',String(draft[button.dataset.part]===button.dataset.set));button.classList.toggle('locked',!owned.includes(button.dataset.set));}
  const allowed=canEquip(record,draft);$('wardrobe-apply').disabled=!allowed;
  text($('wardrobe-lock'),allowed?'적용할 때만 의상이 저장됩니다. 취소하면 이전 조합을 유지해요.':'잠긴 부위가 있습니다. 미리보기만 가능하며 적용할 수 없어요.');
  const same=PARTS.every(p=>draft[p]===draft.hat);
  text($('preview-description'),same?fullLabels[draft.hat]:PARTS.map(p=>`${partLabels[p]} ${labels[draft[p]]}`).join(' · '));
  text($('preview-pose'),`${directionLabels[previewDirection]} · ${previewPose==='push'?'밀기':'걷기'}`);
  text($('preview-action'),previewPose==='push'?'걷기 자세':'밀기 자세');
  drawPreview(previewCtx,draft,previewDirection,previewPose);
}
function makeOptions(){
  for(const level of LEVELS){
    const button=document.createElement('button');button.type='button';
    const strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=String(level.id);button.append(strong,small);
    button.addEventListener('click',()=>{if(level.id>record.unlocked)return;if(game.moves&&!game.won)confirm(()=>newLevel(level.id),button,'진행 중인 창고를 닫고 선택한 단계로 갈까요?');else newLevel(level.id);});
    $('level-grid').append(button);levelButtons.push(button);
  }
  for(const set of SETS){
    const button=document.createElement('button');button.type='button';button.dataset.set=set;
    const name=document.createElement('span'),small=document.createElement('small');name.textContent=fullLabels[set];button.append(name,small);
    button.addEventListener('click',()=>{draft=Object.fromEntries(PARTS.map(p=>[p,set]));updateWardrobe();});
    $('set-options').append(button);setButtons.push(button);
  }
  for(const part of PARTS){
    const row=document.createElement('div');row.className='part-row';const label=document.createElement('span');label.textContent=partLabels[part];row.append(label);
    for(const set of SETS){const button=document.createElement('button');button.type='button';button.dataset.part=part;button.dataset.set=set;button.textContent=labels[set];button.setAttribute('aria-label',`${partLabels[part]} ${fullLabels[set]} 미리보기`);button.addEventListener('click',()=>{draft={...draft,[part]:set};updateWardrobe();});row.append(button);partButtons.push(button);}
    $('part-options').append(row);
  }
}
$('primary').addEventListener('click',()=>{
  if(dialog.open)return;
  clearInput();
  if(phase==='won'){openPanel('result',$('primary'));return;}
  if(phase==='playing'){phase='paused';pauseReason='manual';text($('game-status'),'배송을 잠시 멈췄습니다.');}
  else{phase='playing';pauseReason='';text($('game-status'),'택배를 점선 목표로 옮겨 주세요.');arena.focus({preventScroll:true});}
  render();
});
$('undo').addEventListener('click',undoAction);
$('restart').addEventListener('click',event=>requestRestart(event.currentTarget));
$('home').addEventListener('click',event=>requestHome(event.currentTarget));
$('help').addEventListener('click',event=>openPanel('help',event.currentTarget));
$('levels').addEventListener('click',event=>openPanel('levels',event.currentTarget));
$('wardrobe').addEventListener('click',event=>openPanel('wardrobe',event.currentTarget));
$('mute').addEventListener('click',()=>{record={...record,muted:!record.muted};stopSound();persistence.save(record);render();if(!record.muted)sound('move');});
$('modal-close').addEventListener('click',closePanel);
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',closePanel);
$('confirm-cancel').addEventListener('click',closePanel);
$('confirm-yes').addEventListener('click',()=>{const action=frames.at(-1)?.action;if(action){frames.at(-1).action=null;action();}});
$('wardrobe-cancel').addEventListener('click',closePanel);
$('wardrobe-apply').addEventListener('click',()=>{const equipped=equipRecord(record,draft);if(!equipped)return;record=equipped;persistence.save(record);closePanel();render();});
$('preview-turn').addEventListener('click',()=>{const order=['D','L','U','R'];previewDirection=order[(order.indexOf(previewDirection)+1)%4];updateWardrobe();});
$('preview-action').addEventListener('click',()=>{previewPose=previewPose==='walk'?'push':'walk';updateWardrobe();});
$('next').addEventListener('click',()=>{if(game.board.id<20)newLevel(game.board.id+1);});
$('result-retry').addEventListener('click',()=>newLevel(game.board.id));
$('result-wardrobe').addEventListener('click',event=>openPanel('wardrobe',event.currentTarget));
$('result-levels').addEventListener('click',event=>openPanel('levels',event.currentTarget));
$('result-home').addEventListener('click',()=>location.assign('/'));
for(const button of document.querySelectorAll('[data-direction]'))button.addEventListener('click',()=>{act(button.dataset.direction);if(!dialog.open)arena.focus({preventScroll:true});});
const keyMap={ArrowUp:'U',ArrowRight:'R',ArrowDown:'D',ArrowLeft:'L',w:'U',d:'R',s:'D',a:'L'};
arena.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.repeat||dialog.open)return;
  const key=event.key.length===1?event.key.toLowerCase():event.key,code=keyMap[key];
  if(code){event.preventDefault();act(code);}
  else if(key==='z'){event.preventDefault();undoAction();}
  else if(key==='r'){event.preventDefault();requestRestart(arena);}
  else if(key==='Escape'&&phase==='playing'){event.preventDefault();clearInput();phase='paused';pauseReason='manual';render();$('primary').focus({preventScroll:true});}
});
document.addEventListener('keydown',event=>{
  if(event.repeat&&(event.key==='Enter'||event.key===' ')&&event.target.closest?.('button'))event.preventDefault();
  if(!dialog.open)return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closePanel();return;}
  if(event.key==='Tab'&&!event.ctrlKey&&!event.altKey&&!event.metaKey){
    const tabbable=[...dialog.querySelectorAll('button,[href],[tabindex]')].filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length&&!el.closest('[hidden]'));
    const first=tabbable[0],last=tabbable.at(-1);
    if(!first){event.preventDefault();dialog.focus();return;}
    if(event.shiftKey&&(document.activeElement===first||!tabbable.includes(document.activeElement))){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!tabbable.includes(document.activeElement))){event.preventDefault();first.focus();}
  }
},true);
dialog.addEventListener('cancel',event=>{event.preventDefault();closePanel();});
// Observe all contacts, including a second finger outside the arena. Never cancel outside scrolling.
document.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'){touches.add(event.pointerId);if(touches.size>1||!event.isPrimary)gesture=null;}},true);
arena.addEventListener('pointerdown',event=>{
  if(event.button!==0||!event.isPrimary||phase!=='playing'||dialog.open||(event.pointerType==='touch'&&touches.size>1))return;
  arena.focus({preventScroll:true});gesture={id:event.pointerId,x:event.clientX,y:event.clientY};
  try{arena.setPointerCapture(event.pointerId);}catch{/* Capture unsupported; global up still cancels safely. */}
});
arena.addEventListener('pointerup',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;
  const {x,y}=gesture;gesture=null;const dx=event.clientX-x,dy=event.clientY-y;
  if(Math.max(Math.abs(dx),Math.abs(dy))<24||Math.abs(dx)===Math.abs(dy))return;
  act(Math.abs(dx)>Math.abs(dy)?dx>0?'R':'L':dy>0?'D':'U');
});
for(const type of ['pointerup','pointercancel'])document.addEventListener(type,event=>{touches.delete(event.pointerId);if(gesture?.id===event.pointerId)gesture=null;});
window.addEventListener('blur',()=>protect('blur'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)protect('hidden');});
Object.defineProperty(window,'__simpleGames10Snapshot',{value:()=>structuredClone({phase,pauseReason,activePanel:activePanel(),game:snapshot(game),record,preview:activePanel()==='wardrobe'?{equipped:draft,direction:previewDirection,pose:previewPose}:null,settlements,storageWarning:persistence.warning}),writable:false,configurable:false});
makeOptions();render();
let lastVisual=-1;
function animate(now){
  const visual=reduced.matches?0:Math.floor(now/200)%2;
  if(activePanel()==='wardrobe'&&visual!==lastVisual)drawPreview(previewCtx,draft,previewDirection,previewPose,visual);
  if(phase==='playing'&&feedbackUntil){if(now>=feedbackUntil){feedbackUntil=0;pose='walk';drawBoard(ctx,game,record.equipped,direction,pose);}else if(visual!==lastVisual)drawBoard(ctx,game,record.equipped,direction,pose,visual);}
  lastVisual=visual;requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
