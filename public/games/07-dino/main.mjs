import {createEngine} from './engine.mjs';
import {createRecords,createWardrobe,PARTS,SETS,BLOCKED_MESSAGE,SATURATION_MESSAGE} from './save.mjs';
const $=id=>document.getElementById(id), engine=createEngine(), records=createRecords();
const wardrobe=createWardrobe(()=>records.snapshot().record,draft=>records.equip(draft));
const names={basic:'기본 도마뱀',postal:'우체부',space:'우주복',sport:'운동복'}, partNames={hat:'모자',body:'몸',bag:'가방'};
const poseNames={run0:'달리기 1',run1:'달리기 2',run2:'달리기 3',run3:'달리기 4',jump:'점프',duck0:'숙이기 1',duck1:'숙이기 2',hit:'실패'};
const stateNames={ready:'준비',playing:'배달 중',paused:'잠깐 쉬기',result:'배달 종료'};
let last=performance.now(), activeDialog=null, returnFocus=null, confirmAction=null, resultInfo=null, resultAt=-Infinity, previewPose='run0';
let audio=null, multi=false, gesture=null, liveAnnouncement='', dialogRevision=0;
const tones=new Set(), pointers=new Map(), held=new Set(), pressTimes=new WeakMap(), suppressedClicks=new WeakSet();
function setText(id,value){const node=typeof id==='string'?$(id):id;const text=String(value);if(node.textContent!==text)node.textContent=text;}
function attr(node,key,value){const text=String(value);if(node.getAttribute(key)!==text)node.setAttribute(key,text);}
function silence(){for(const tone of tones){try{tone.stop();}catch{}}tones.clear();}
function audioGesture(){if(records.snapshot().record.muted)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();const promise=audio.resume();promise?.catch(()=>{silence();audio=null;});}catch{audio=null;}}
function sound(kind){if(records.snapshot().record.muted||document.hidden||activeDialog||!audio)return;try{const oscillator=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime;oscillator.type='sine';oscillator.frequency.setValueAtTime(kind==='jump'?540:140,at);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.07,at+.01);gain.gain.exponentialRampToValueAtTime(.0001,at+.13);oscillator.connect(gain);gain.connect(audio.destination);tones.add(oscillator);oscillator.onended=()=>{tones.delete(oscillator);oscillator.disconnect();gain.disconnect();};oscillator.start(at);oscillator.stop(at+.14);}catch{silence();}}
function releaseInput(){held.clear();if(gesture){try{gesture.target.releasePointerCapture(gesture.id);}catch{}gesture=null;}const events=engine.release();silence();if(events.length)process(events,performance.now());}
function process(events,now){for(const event of events){if(event.type==='jump')sound('jump');if(event.type==='result'){resultInfo=records.settle(event);resultAt=now;releaseInput();liveAnnouncement=`${event.score}점 · ${event.metric}px · ${event.reason==='collision'?'장애물에 닿았어요.':'직접 배달을 마쳤어요.'}`;sound('result');}}}
function pump(now=performance.now()){
  const elapsed=Math.max(0,(now-last)/1000);last=now;
  if(elapsed>.25){if(engine.pause('longframe'))releaseInput();return;}
  process(engine.advance(elapsed),now);
}
function pause(reason='manual'){pump();engine.pause(reason);releaseInput();render();}
function protect(reason){engine.pause(reason);releaseInput();last=performance.now();render();}
function drawCourier(prefix,equipment,pose){
  attr($(`${prefix}-base`),'href',`./assets/kit.svg#base-${pose}`);
  for(const part of PARTS){const node=$(`${prefix}-${part}`),item=equipment[part];attr(node,'visibility',item==='none'?'hidden':'visible');if(item!=='none')attr(node,'href',`./assets/kit.svg#${item}-${pose}`);}
}
function renderObstacles(obstacles){const group=$('obstacles'),ns='http://www.w3.org/2000/svg';while(group.children.length>obstacles.length)group.lastElementChild.remove();obstacles.forEach((o,i)=>{let node=group.children[i];if(!node){node=document.createElementNS(ns,'svg');const use=document.createElementNS(ns,'use');use.setAttribute('width','96');use.setAttribute('height','96');node.append(use);node.setAttribute('preserveAspectRatio','none');group.append(node);}attr(node,'viewBox',o.type==='bird'?'7 23 82 49':'14 9 69 83');attr(node,'x',o.x);attr(node,'y',o.top);attr(node,'width',o.width);attr(node,'height',o.bottom-o.top);attr(node.firstElementChild,'href',`./assets/kit.svg#${o.type}`);attr(node,'data-obstacle-id',o.id);});}
function pendingUnlocks(score,record){return SETS.filter(set=>!record.unlockedSets.includes(set)&&((set==='sport'&&score>=500)||(set==='space'&&record.totalScore+score>=3000)));}
function render(){
  const s=engine.snapshot(),storage=records.snapshot(),record=storage.record;
  for(const [id,value]of Object.entries({'score':s.score,'best-score':record.bestScore,'total-score':record.totalScore,'best-metric':record.bestMetric,'total-metric':record.totalMetric,'plays':record.plays,'ending-counts':`충돌 ${record.losses}회 · 중도 종료 ${record.quits}회`,'speed':s.speed,'distance':Math.floor(s.distance),'state-label':stateNames[s.state]}))setText(id,value);
  setText('mute',record.muted?'소리 꺼짐':'소리 켜짐');attr($('mute'),'aria-pressed',record.muted);
  attr($('courier'),'x',s.body.x+s.body.width/2-38.4);attr($('courier'),'y',s.body.foot-67.2);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pose=s.state==='result'&&s.result.reason==='collision'?'hit':!s.body.grounded?'jump':s.body.height===24?`duck${reduced?0:Math.floor(s.time*10)%2}`:`run${reduced?0:Math.floor(s.time*10)%4}`;
  drawCourier('courier',record.equipped,pose);drawCourier('outfit',record.equipped,'run0');renderObstacles(s.obstacles);
  setText('equipped-label',PARTS.map(p=>`${partNames[p]}: ${record.equipped[p]==='none'?'기본':names[record.equipped[p].split('-')[0]]}`).join(' · '));
  $('overlay').hidden=s.state==='playing';$('result-actions').hidden=s.state!=='result';
  $('pause').disabled=!['playing','paused'].includes(s.state);$('menu-resume').disabled=s.state!=='paused';
  setText('pause',s.state==='paused'?'▶ 게임 재개':'Ⅱ 잠깐 쉬기');
  for(const id of ['duck','jump']){const button=$(id);button.disabled=s.state!=='playing';attr(button,'aria-pressed',s.state==='playing'&&(id==='duck'?s.duckHeld:s.jumpHeld));}
  if(s.state==='ready'){setText('overlay-title','모래길로 배달을 떠나요.');setText('overlay-copy','선인장은 점프, 낮은 비행물은 숙여서 피해요.');setText('primary','배달 시작 →');}
  if(s.state==='paused'){setText('overlay-title','모래길도 잠깐, 쉬어갑니다.');setText('overlay-copy',s.pauseReason==='manual'?'우체부와 모래길은 그대로예요. 직접 이어서 달려 주세요.':'입력을 안전하게 멈췄어요. 직접 게임을 재개해 주세요.');setText('primary',s.pauseReason==='manual'?'이어서 달리기 →':'게임 재개 →');}
  if(s.state==='result'){
    setText('overlay-title',`${s.score}점의 작은 배달.`);
    const comparison=resultInfo?.comparison==='new'?'개인 최고 기록을 새로 썼어요!':resultInfo?.comparison==='tie'?'최고 기록과 동점이에요.':'다음 배달도 기다릴게요.';
    setText('overlay-copy',`${s.metric}px · ${s.result.reason==='collision'?`장애물에 닿았어요 (x ${s.result.collision.body.x}, 발 y ${s.result.collision.body.foot.toFixed(1)}).`:'직접 배달을 마쳤어요.'} ${comparison}${storage.saturated?' '+SATURATION_MESSAGE:''}`);setText('primary','다시 배달 시작 →');
  }
  setText('result-unlocks',resultInfo?.newSets?.length?`${resultInfo.newSets.map(set=>names[set]).join(' · ')} 해금!`: '');
  const pending=['playing','paused'].includes(s.state)?pendingUnlocks(s.score,record):[];
  setText('announcement',pending.length?`${pending.map(set=>names[set]).join(' · ')}: 이번 판 종료 후 해금`:(liveAnnouncement||'진행 중인 판은 복원되지 않으며 완료 기록과 차림만 저장합니다.'));
  setText('storage-notice',[storage.blocked?BLOCKED_MESSAGE:'',storage.recovered?'저장 기록에 잘못된 값이 있어 안전한 기록과 기본 차림으로 복구했습니다.':'',storage.saturated?SATURATION_MESSAGE:''].filter(Boolean).join(' · '));
}
function resume(){if(activeDialog)closeDialog();releaseInput();const events=engine.resume();process(events,performance.now());if(engine.snapshot().state==='playing'){last=performance.now();$('game-area').focus({preventScroll:true});}render();}
function start(button){if(activeDialog||multi)return;pump();const s=engine.snapshot();if(s.state==='paused'){resume();return;}if(s.state==='result'&&(pressTimes.get(button)??performance.now())<resultAt)return;if(s.state!=='ready'&&s.state!=='result')return;audioGesture();resultInfo=null;liveAnnouncement='';engine.start();last=performance.now();$('game-area').focus({preventScroll:true});render();}
function externalFocus(node){return node instanceof HTMLElement&&node.isConnected&&node.tabIndex>=0&&!node.matches(':disabled,[aria-disabled="true"]')&&!node.closest('dialog,[hidden],[inert]')&&node.getClientRects().length>0&&getComputedStyle(node).visibility==='visible';}
function restoreFocus(){const target=[returnFocus,$('menu-open'),$('game-area')].find(externalFocus);target?.focus({preventScroll:true});}
function repairFocus(revision){if(revision===dialogRevision&&!activeDialog&&!externalFocus(document.activeElement))restoreFocus();}
function closeDialog(){if(!activeDialog)return;const id=activeDialog,revision=++dialogRevision;activeDialog=null;$(id).close();if(id==='wardrobe')wardrobe.cancel();releaseInput();last=performance.now();render();restoreFocus();requestAnimationFrame(()=>repairFocus(revision));}
function openDialog(id,trigger){
  pump();engine.pause('menu');releaseInput();
  // Pointer clicks need not focus buttons in WebKit. Keep the actual external
  // opener through menu -> child transitions, never a soon-to-be-hidden button.
  if(!activeDialog)returnFocus=externalFocus(trigger)?trigger:externalFocus(document.activeElement)?document.activeElement:null;
  if(activeDialog){if(activeDialog==='wardrobe')wardrobe.cancel();$(activeDialog).close();}
  activeDialog=id;dialogRevision++;
  // Give native dialog restoration the same valid opener as our explicit path.
  restoreFocus();$(id).showModal();render();
}
function requestAction(action,trigger){pump();const s=engine.snapshot();if(['playing','paused'].includes(s.state)){confirmAction=action;setText('confirm-copy',`현재 ${s.score}점 · ${s.metric}px를 중도 종료 기록으로 한 번 저장한 뒤 ${action==='home'?'홈으로 돌아갑니다.':'준비 화면으로 돌아갑니다.'}`);openDialog('confirm',trigger);}else if(action==='home')location.assign('/');else{if(activeDialog)closeDialog();engine.ready();liveAnnouncement='';render();}}
function wardrobeRender(){
  const draft=wardrobe.snapshot(),record=records.snapshot().record,s=engine.snapshot(),pending=pendingUnlocks(s.score,record);
  const descriptions={basic:'항상 보유',postal:'기본 보유',sport:`한 판 500점 · 완료 최고 ${record.bestScore}`,space:`누적 3000점 · 완료 누적 ${record.totalScore}`};
  for(const part of PARTS)for(const button of $(`part-${part}`).querySelectorAll('button')){const set=button.dataset.item==='none'?'basic':button.dataset.item.split('-')[0],own=record.unlockedSets.includes(set);attr(button,'aria-pressed',draft[part]===button.dataset.item);setText(button,`${names[set]} · ${own?'보유':'잠김'}`);attr(button,'aria-label',`${names[set]} · ${partNames[part]} · ${own?'보유':'잠김, 미리보기 가능'}`);}
  for(const set of SETS){setText(`progress-${set}`,`${descriptions[set]} · ${record.unlockedSets.includes(set)?'보유':pending.includes(set)&&['playing','paused'].includes(s.state)?'이번 판 종료 후 해금':'잠김'}`);attr(document.querySelector(`[data-set="${set}"]`),'aria-pressed',PARTS.every(p=>draft[p]===(set==='basic'?'none':`${set}-${p}`)));}
  for(const button of document.querySelectorAll('[data-pose]'))attr(button,'aria-pressed',button.dataset.pose===previewPose);
  setText('preview-label',`${poseNames[previewPose]} · 조합 미리보기`);drawCourier('preview',draft,previewPose);
  $('wardrobe-apply').disabled=!wardrobe.canApply();setText('wardrobe-notice',wardrobe.canApply()?'선택 적용을 누르면 부위 조합을 한 번 저장합니다. 차림은 물리와 점수를 바꾸지 않아요.':'잠긴 차림은 미리보기만 가능합니다. 진행 중인 해금은 이번 판 종료 후 확정됩니다.');
}
function openWardrobe(trigger){openDialog('wardrobe',trigger);wardrobe.open();previewPose='run0';wardrobeRender();}
function onClick(id,callback){$(id).addEventListener('click',event=>{if(multi||suppressedClicks.has(event.currentTarget)){event.preventDefault();return;}callback(event);});}
for(const part of PARTS){for(const set of SETS){const button=document.createElement('button');button.type='button';button.dataset.item=set==='basic'?'none':`${set}-${part}`;button.addEventListener('click',()=>{wardrobe.previewPart(part,button.dataset.item);wardrobeRender();});$(`part-${part}`).append(button);}}
for(const button of document.querySelectorAll('[data-set]'))button.addEventListener('click',()=>{wardrobe.previewSet(button.dataset.set);wardrobeRender();});
for(const button of document.querySelectorAll('[data-pose]'))button.addEventListener('click',()=>{previewPose=button.dataset.pose;wardrobeRender();});
for(const id of ['wardrobe-open','result-wardrobe','menu-wardrobe'])onClick(id,event=>openWardrobe(event.currentTarget));
for(const id of ['help','menu-help'])onClick(id,event=>openDialog('help-dialog',event.currentTarget));
onClick('wardrobe-apply',()=>{if(wardrobe.apply())closeDialog();});
for(const id of ['wardrobe-cancel','close-help','menu-close','confirm-cancel'])onClick(id,closeDialog);
onClick('menu-open',event=>openDialog('menu',event.currentTarget));onClick('menu-resume',resume);
onClick('confirm-ok',()=>{const action=confirmAction;closeDialog();process(engine.quit(),performance.now());if(action==='home')location.assign('/');else{engine.ready();liveAnnouncement='이전 배달을 정산했어요. 새 판은 직접 시작해 주세요.';render();}});
for(const id of ['home','result-home','menu-home'])onClick(id,event=>{event.preventDefault();requestAction('home',event.currentTarget);});
for(const id of ['restart','menu-restart'])onClick(id,event=>requestAction('restart',event.currentTarget));
onClick('primary',()=>start($('primary')));
onClick('pause',()=>{if(engine.snapshot().state==='paused')resume();else pause();});
onClick('mute',()=>{records.mute(!records.snapshot().record.muted);silence();audioGesture();render();});
// This page-wide observer also sees a second finger outside the board.
document.addEventListener('pointerdown',event=>{const button=event.target.closest?.('button,a');if(button){pressTimes.set(button,performance.now());suppressedClicks.delete(button);}pointers.set(event.pointerId,{button});if(pointers.size>1){multi=true;for(const contact of pointers.values())if(contact.button)suppressedClicks.add(contact.button);protect('multitouch');}},true);
document.addEventListener('click',event=>{const button=event.target.closest?.('button,a');if(button&&(multi||suppressedClicks.has(button))){event.preventDefault();event.stopImmediatePropagation();}},true);
function hold(event,target,action){if(activeDialog||multi||event.button!==0||!event.isPrimary||pointers.size!==1||engine.snapshot().state!=='playing')return;event.preventDefault();pump();if(engine.snapshot().state!=='playing')return;$('game-area').focus({preventScroll:true});audioGesture();gesture={id:event.pointerId,target,action,token:`pointer-${event.pointerId}`};process(action==='duck'?engine.duckDown(gesture.token):engine.jumpDown(gesture.token),performance.now());try{target.setPointerCapture(event.pointerId);}catch{}render();}
$('game-area').addEventListener('pointerdown',event=>{if(event.target.closest?.('button,a,.overlay-card'))return;const rect=$('game-area').getBoundingClientRect();hold(event,$('game-area'),event.clientX<rect.left+rect.width/2?'duck':'jump');});
for(const id of ['duck','jump'])$(id).addEventListener('pointerdown',event=>hold(event,$(id),id));
onClick('jump',event=>{if(event.detail===0&&engine.snapshot().state==='playing'){pump();process(engine.jumpDown('button'),performance.now());engine.jumpUp('button');render();}});
onClick('duck',event=>{if(event.detail===0&&engine.snapshot().state==='playing'){pump();process(engine.duckDown('button'),performance.now());render();}});
function releaseGesture(){if(!gesture)return;const g=gesture;gesture=null;process(g.action==='duck'?engine.duckUp(g.token):(engine.jumpUp(g.token),[]),performance.now());try{g.target.releasePointerCapture(g.id);}catch{}}
document.addEventListener('pointermove',event=>{if(gesture?.id!==event.pointerId)return;const rect=gesture.target.getBoundingClientRect();pump();if(gesture?.id!==event.pointerId)return;if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)releaseGesture();render();},true);
function pointerEnd(event,cancelled){if(gesture?.id===event.pointerId){pump();releaseGesture();}pointers.delete(event.pointerId);if(cancelled)protect('pointercancel');if(!pointers.size)multi=false;render();}
document.addEventListener('pointerup',event=>pointerEnd(event,false),true);
document.addEventListener('pointercancel',event=>pointerEnd(event,true),true);
document.addEventListener('lostpointercapture',event=>{if(gesture?.id===event.pointerId){releaseGesture();render();}},true);
const jumpKeys=new Set(['Space','ArrowUp']);
document.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.altKey||event.metaKey)return;
  const button=event.target.closest?.('button,a');
  if(button&&(event.code==='Space'||event.code==='Enter')){if(event.repeat||held.has(event.code)){event.preventDefault();return;}held.add(event.code);pressTimes.set(button,performance.now());suppressedClicks.delete(button);if(button.id==='duck'&&engine.snapshot().state==='playing'){event.preventDefault();pump();process(engine.duckDown(event.code),performance.now());render();return;}}
  if(activeDialog||event.target!==$('game-area')||!['Space','ArrowUp','ArrowDown','KeyP','Escape'].includes(event.code))return;
  event.preventDefault();if(event.repeat||held.has(event.code))return;held.add(event.code);pump();
  if(jumpKeys.has(event.code)){if(engine.snapshot().state==='playing')process(engine.jumpDown(event.code),performance.now());else if(event.code==='Space'){pressTimes.set($('primary'),performance.now());start($('primary'));}}
  else if(event.code==='ArrowDown')process(engine.duckDown(event.code),performance.now());
  else if(engine.snapshot().state==='playing')pause();else if(engine.snapshot().state==='paused'&&event.code==='KeyP')resume();
  render();
});
document.addEventListener('keyup',event=>{held.delete(event.code);if(jumpKeys.has(event.code))engine.jumpUp(event.code);if(event.code==='ArrowDown'||event.code==='Space'||event.code==='Enter'){pump();process(engine.duckUp(event.code),performance.now());if(event.code==='Space'||event.code==='Enter')process(engine.duckUp('button'),performance.now());render();}});
$('game-area').addEventListener('focusout',event=>{if(!event.currentTarget.contains(event.relatedTarget))releaseInput();});
for(const dialog of document.querySelectorAll('dialog')){
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
  dialog.addEventListener('close',()=>{if(activeDialog===dialog.id&&!dialog.open)closeDialog();else repairFocus(dialogRevision);});
  dialog.addEventListener('keydown',event=>{if(event.key!=='Tab'||event.ctrlKey||event.altKey||event.metaKey)return;const nodes=[...dialog.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')].filter(node=>node.getClientRects().length&&!node.closest('[hidden]'));const first=nodes[0],lastNode=nodes.at(-1);if(!first){event.preventDefault();return;}if(event.shiftKey&&(document.activeElement===first||!nodes.includes(document.activeElement))){event.preventDefault();lastNode.focus();}else if(!event.shiftKey&&(document.activeElement===lastNode||!nodes.includes(document.activeElement))){event.preventDefault();first.focus();}});
}
window.addEventListener('blur',()=>{protect('blur');pointers.clear();multi=false;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){protect('hidden');pointers.clear();multi=false;}last=performance.now();});
window.addEventListener('pagehide',()=>{protect('pagehide');pointers.clear();multi=false;});
// Read-only inspection; no state setter, auto-player or outcome injection.
export function getSnapshot(){return structuredClone({engine:engine.snapshot(),storage:records.snapshot(),ui:{activeDialog,previewPose,draft:wardrobe.snapshot(),multi,held:[...held]}});}
function frame(now){pump(now);render();requestAnimationFrame(frame);}
render();requestAnimationFrame(frame);
