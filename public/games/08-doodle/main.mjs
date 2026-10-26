import {createEngine} from './engine.mjs';
import {createRecords,createWardrobe,PARTS,SETS,BLOCKED_MESSAGE,SATURATION_MESSAGE} from './save.mjs';
const $=id=>document.getElementById(id), engine=createEngine(), records=createRecords();
const wardrobe=createWardrobe(()=>records.snapshot().record,draft=>records.equip(draft));
const names={basic:'기본 토끼',star:'별빛',explorer:'탐험가',carrot:'당근'}, partNames={ears:'귀',body:'몸',bag:'가방'};
const poseNames={idle:'기본 자세',rise:'상승',fall:'하강',land:'착지',hit:'실패'};
const stateNames={ready:'준비',playing:'도약 중',paused:'잠깐 쉬기',result:'도약 종료'};
let last=performance.now(), activeDialog=null, returnFocus=null, confirmAction=null, resultInfo=null, resultAt=-Infinity, previewPose='idle';
let audio=null, multi=false, gesture=null, liveAnnouncement='';
const tones=new Set(), pointers=new Map(), held=new Set(), pressTimes=new WeakMap(), suppressedClicks=new WeakSet();
function setText(id,value){const node=typeof id==='string'?$(id):id;const text=String(value);if(node.textContent!==text)node.textContent=text;}
function attr(node,key,value){const text=String(value);if(node.getAttribute(key)!==text)node.setAttribute(key,text);}
function silence(){for(const tone of tones){try{tone.stop();}catch{}}tones.clear();}
function audioGesture(){if(records.snapshot().record.muted)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();const promise=audio.resume();promise?.catch(()=>{silence();audio=null;});}catch{audio=null;}}
function sound(kind){if(records.snapshot().record.muted||document.hidden||activeDialog||!audio)return;try{const oscillator=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime;oscillator.type='sine';oscillator.frequency.setValueAtTime(kind==='bounce'?540:140,at);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.07,at+.01);gain.gain.exponentialRampToValueAtTime(.0001,at+.13);oscillator.connect(gain);gain.connect(audio.destination);tones.add(oscillator);oscillator.onended=()=>{tones.delete(oscillator);oscillator.disconnect();gain.disconnect();};oscillator.start(at);oscillator.stop(at+.14);}catch{silence();}}
function releaseInput(){held.clear();if(gesture){engine.directionUp(gesture.token);try{gesture.target.releasePointerCapture(gesture.id);}catch{}gesture=null;}engine.release();silence();}
function process(events,now){for(const event of events){if(event.type==='bounce')sound('bounce');if(event.type==='result'){resultInfo=records.settle(event);resultAt=now;releaseInput();liveAnnouncement=`${event.score}점 · ${event.metric}px · ${event.reason==='fall'?'구름 아래로 내려왔어요.':'직접 도약을 마쳤어요.'}`;sound('result');}}}
function pump(now=performance.now()){
  const elapsed=Math.max(0,(now-last)/1000);last=now;
  if(elapsed>.25){if(engine.pause('longframe'))releaseInput();return;}
  process(engine.advance(elapsed),now);
}
function pause(reason='manual'){pump();engine.pause(reason);releaseInput();render();}
function protect(reason){engine.pause(reason);releaseInput();last=performance.now();render();}
function drawBunny(prefix,equipment,pose){
  attr($(`${prefix}-base`),'href',`./assets/kit.svg#base-${pose}`);
  for(const part of PARTS){const node=$(`${prefix}-${part}`),item=equipment[part];attr(node,'visibility',item==='none'?'hidden':'visible');if(item!=='none')attr(node,'href',`./assets/kit.svg#${item}-${pose}`);}
}
function renderPlatforms(platforms,cameraTop){const group=$('platforms'),ns='http://www.w3.org/2000/svg';while(group.children.length>platforms.length)group.lastElementChild.remove();platforms.forEach((p,i)=>{let node=group.children[i];if(!node){node=document.createElementNS(ns,'rect');node.setAttribute('width','72');node.setAttribute('height','12');node.setAttribute('rx','6');group.append(node);}attr(node,'x',p.x-36);attr(node,'y',p.top-cameraTop);attr(node,'fill',p.moving?'#527e9a':'#719f8b');attr(node,'data-platform-id',p.id);});}
function pendingUnlocks(score,record){return SETS.filter(set=>!record.unlockedSets.includes(set)&&((set==='star'&&score>=100)||(set==='carrot'&&score>=500)||(set==='explorer'&&record.totalScore+score>=2000)));}
function render(){
  const s=engine.snapshot(),storage=records.snapshot(),record=storage.record;
  for(const [id,value]of Object.entries({'score':s.score,'best-score':record.bestScore,'total-score':record.totalScore,'best-metric':record.bestMetric,'total-metric':record.totalMetric,'plays':record.plays,'ending-counts':`낙하 ${record.losses}회 · 중도 종료 ${record.quits}회`,'state-label':stateNames[s.state]}))setText(id,value);
  setText('mute',record.muted?'소리 꺼짐':'소리 켜짐');attr($('mute'),'aria-pressed',record.muted);
  attr($('bunny'),'x',s.body.x-38.4);attr($('bunny'),'y',s.body.foot-s.cameraTop-67.2);
  const pose=s.state==='result'&&s.result.reason==='fall'?'hit':s.state==='ready'?'idle':s.time-s.lastLandingTime<.1?'land':s.body.vy<0?'rise':'fall';
  drawBunny('bunny',record.equipped,pose);drawBunny('outfit',record.equipped,'idle');renderPlatforms(s.platforms,s.cameraTop);
  setText('equipped-label',PARTS.map(p=>`${partNames[p]}: ${record.equipped[p]==='none'?'기본':names[record.equipped[p].split('-')[0]]}`).join(' · '));
  $('overlay').hidden=s.state==='playing';$('result-actions').hidden=s.state!=='result';
  $('pause').disabled=!['playing','paused'].includes(s.state);$('menu-resume').disabled=s.state!=='paused';
  setText('pause',s.state==='paused'?'▶ 게임 재개':'Ⅱ 잠깐 쉬기');
  for(const [side,id]of [[-1,'left'],[1,'right']]){const button=$(id);button.disabled=s.state!=='playing';attr(button,'aria-pressed',s.state==='playing'&&s.direction===side);}
  if(s.state==='ready'){setText('overlay-title','다음 구름을 향해.');setText('overlay-copy','좌우만 고르세요. 점프는 자동이에요.');setText('primary','첫 도약 시작 ↑');}
  if(s.state==='paused'){setText('overlay-title','하늘도 잠깐, 쉬어갑니다.');setText('overlay-copy',s.pauseReason==='manual'?'토끼와 구름은 그대로예요. 직접 이어서 뛰어 주세요.':'입력을 안전하게 멈췄어요. 직접 게임을 재개해 주세요.');setText('primary',s.pauseReason==='manual'?'이어서 뛰기 ↑':'게임 재개 ↑');}
  if(s.state==='result'){
    setText('overlay-title',`${s.score}점의 작은 도약.`);
    const comparison=resultInfo?.comparison==='new'?'개인 최고 기록을 새로 썼어요!':resultInfo?.comparison==='tie'?'최고 기록과 동점이에요.':'다음 도약도 기다릴게요.';
    setText('overlay-copy',`${s.metric}px · ${s.result.reason==='fall'?'구름 아래로 내려왔어요.':'직접 도약을 마쳤어요.'} ${comparison}${storage.saturated?' '+SATURATION_MESSAGE:''}`);setText('primary','다시 도약 시작 ↑');
  }
  setText('result-unlocks',resultInfo?.newSets?.length?`${resultInfo.newSets.map(set=>names[set]).join(' · ')} 해금!`: '');
  const pending=['playing','paused'].includes(s.state)?pendingUnlocks(s.score,record):[];
  setText('announcement',pending.length?`${pending.map(set=>names[set]).join(' · ')}: 이번 판 종료 후 해금`:(liveAnnouncement||'진행 중인 판은 복원되지 않으며 완료 기록과 차림만 저장합니다.'));
  setText('storage-notice',[storage.blocked?BLOCKED_MESSAGE:'',storage.recovered?'저장 기록에 잘못된 값이 있어 안전한 기록과 기본 차림으로 복구했습니다.':'',storage.saturated?SATURATION_MESSAGE:''].filter(Boolean).join(' · '));
}
function resume(){if(activeDialog)closeDialog();releaseInput();if(engine.resume()){last=performance.now();$('game-area').focus({preventScroll:true});}render();}
function start(button){if(activeDialog||multi)return;pump();const s=engine.snapshot();if(s.state==='paused'){resume();return;}if(s.state==='result'&&(pressTimes.get(button)??performance.now())<resultAt)return;if(s.state!=='ready'&&s.state!=='result')return;audioGesture();resultInfo=null;liveAnnouncement='';engine.start();last=performance.now();$('game-area').focus({preventScroll:true});render();}
function closeDialog(){if(!activeDialog)return;const id=activeDialog;activeDialog=null;$(id).close();if(id==='wardrobe')wardrobe.cancel();releaseInput();last=performance.now();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});render();}
function openDialog(id){pump();engine.pause('menu');releaseInput();if(!activeDialog)returnFocus=document.activeElement;if(activeDialog){if(activeDialog==='wardrobe')wardrobe.cancel();$(activeDialog).close();}activeDialog=id;$(id).showModal();render();}
function requestAction(action){pump();const s=engine.snapshot();if(['playing','paused'].includes(s.state)){confirmAction=action;setText('confirm-copy',`현재 ${s.score}점 · ${s.metric}px를 중도 종료 기록으로 한 번 저장한 뒤 ${action==='home'?'홈으로 돌아갑니다.':'준비 화면으로 돌아갑니다.'}`);openDialog('confirm');}else if(action==='home')location.assign('/');else{if(activeDialog)closeDialog();engine.ready();liveAnnouncement='';render();}}
function wardrobeRender(){
  const draft=wardrobe.snapshot(),record=records.snapshot().record,s=engine.snapshot(),pending=pendingUnlocks(s.score,record);
  const descriptions={basic:'항상 보유',star:`한 판 100점 · 완료 최고 ${record.bestScore}`,carrot:`한 판 500점 · 완료 최고 ${record.bestScore}`,explorer:`누적 2000점 · 완료 누적 ${record.totalScore}`};
  for(const part of PARTS)for(const button of $(`part-${part}`).querySelectorAll('button')){const set=button.dataset.item==='none'?'basic':button.dataset.item.split('-')[0],own=record.unlockedSets.includes(set);attr(button,'aria-pressed',draft[part]===button.dataset.item);setText(button,`${names[set]} · ${own?'보유':'잠김'}`);attr(button,'aria-label',`${names[set]} · ${partNames[part]} · ${own?'보유':'잠김, 미리보기 가능'}`);}
  for(const set of SETS){setText(`progress-${set}`,`${descriptions[set]} · ${record.unlockedSets.includes(set)?'보유':pending.includes(set)&&['playing','paused'].includes(s.state)?'이번 판 종료 후 해금':'잠김'}`);attr(document.querySelector(`[data-set="${set}"]`),'aria-pressed',PARTS.every(p=>draft[p]===(set==='basic'?'none':`${set}-${p}`)));}
  for(const button of document.querySelectorAll('[data-pose]'))attr(button,'aria-pressed',button.dataset.pose===previewPose);
  setText('preview-label',`${poseNames[previewPose]} · 조합 미리보기`);drawBunny('preview',draft,previewPose);
  $('wardrobe-apply').disabled=!wardrobe.canApply();setText('wardrobe-notice',wardrobe.canApply()?'선택 적용을 누르면 부위 조합을 한 번 저장합니다. 차림은 물리와 점수를 바꾸지 않아요.':'잠긴 차림은 미리보기만 가능합니다. 진행 중인 해금은 이번 판 종료 후 확정됩니다.');
}
function openWardrobe(){openDialog('wardrobe');wardrobe.open();previewPose='idle';wardrobeRender();}
function onClick(id,callback){$(id).addEventListener('click',event=>{if(multi||suppressedClicks.has(event.currentTarget)){event.preventDefault();return;}callback(event);});}
for(const part of PARTS){for(const set of SETS){const button=document.createElement('button');button.type='button';button.dataset.item=set==='basic'?'none':`${set}-${part}`;button.addEventListener('click',()=>{wardrobe.previewPart(part,button.dataset.item);wardrobeRender();});$(`part-${part}`).append(button);}}
for(const button of document.querySelectorAll('[data-set]'))button.addEventListener('click',()=>{wardrobe.previewSet(button.dataset.set);wardrobeRender();});
for(const button of document.querySelectorAll('[data-pose]'))button.addEventListener('click',()=>{previewPose=button.dataset.pose;wardrobeRender();});
for(const id of ['wardrobe-open','result-wardrobe','menu-wardrobe'])onClick(id,openWardrobe);
for(const id of ['help','menu-help'])onClick(id,()=>openDialog('help-dialog'));
onClick('wardrobe-apply',()=>{if(wardrobe.apply())closeDialog();});
for(const id of ['wardrobe-cancel','close-help','menu-close','confirm-cancel'])onClick(id,closeDialog);
onClick('menu-open',()=>openDialog('menu'));onClick('menu-resume',resume);
onClick('confirm-ok',()=>{const action=confirmAction;closeDialog();process(engine.quit(),performance.now());if(action==='home')location.assign('/');else{engine.ready();liveAnnouncement='이전 도약을 정산했어요. 새 판은 직접 시작해 주세요.';render();}});
for(const id of ['home','result-home','menu-home'])onClick(id,event=>{event.preventDefault();requestAction('home');});
for(const id of ['restart','menu-restart'])onClick(id,()=>requestAction('restart'));
onClick('primary',()=>start($('primary')));
onClick('pause',()=>{if(engine.snapshot().state==='paused')resume();else pause();});
onClick('mute',()=>{records.mute(!records.snapshot().record.muted);silence();audioGesture();render();});
// This page-wide observer also sees a second finger outside the board.
document.addEventListener('pointerdown',event=>{const button=event.target.closest?.('button,a');if(button){pressTimes.set(button,performance.now());suppressedClicks.delete(button);}pointers.set(event.pointerId,{button});if(pointers.size>1){multi=true;for(const contact of pointers.values())if(contact.button)suppressedClicks.add(contact.button);protect('multitouch');}},true);
document.addEventListener('click',event=>{const button=event.target.closest?.('button,a');if(button&&(multi||suppressedClicks.has(button))){event.preventDefault();event.stopImmediatePropagation();}},true);
function hold(event,target,side){if(activeDialog||multi||event.button!==0||!event.isPrimary||pointers.size!==1||engine.snapshot().state!=='playing')return;event.preventDefault();pump();if(engine.snapshot().state!=='playing')return;$('game-area').focus({preventScroll:true});audioGesture();gesture={id:event.pointerId,target,side,token:`pointer-${event.pointerId}`};engine.directionDown(side,gesture.token);try{target.setPointerCapture(event.pointerId);}catch{}render();}
$('game-area').addEventListener('pointerdown',event=>{if(event.target.closest?.('button,a,.overlay-card'))return;const rect=$('game-area').getBoundingClientRect();hold(event,$('game-area'),event.clientX<rect.left+rect.width/2?-1:1);});
for(const [id,side]of [['left',-1],['right',1]])$(id).addEventListener('pointerdown',event=>hold(event,$(id),side));
document.addEventListener('pointermove',event=>{if(gesture?.id!==event.pointerId)return;const rect=gesture.target.getBoundingClientRect();pump();if(gesture?.id!==event.pointerId)return;if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom){engine.directionUp(gesture.token);try{gesture.target.releasePointerCapture(gesture.id);}catch{}gesture=null;}else if(gesture.target===$('game-area')){const side=event.clientX<rect.left+rect.width/2?-1:1;if(side!==gesture.side){engine.directionUp(gesture.token);gesture.side=side;engine.directionDown(side,gesture.token);}}render();},true);
function pointerEnd(event,cancelled){if(gesture?.id===event.pointerId){const token=gesture.token;pump();engine.directionUp(token);gesture=null;}pointers.delete(event.pointerId);if(cancelled)protect('pointercancel');if(!pointers.size)multi=false;render();}
document.addEventListener('pointerup',event=>pointerEnd(event,false),true);
document.addEventListener('pointercancel',event=>pointerEnd(event,true),true);
document.addEventListener('lostpointercapture',event=>{if(gesture?.id===event.pointerId){engine.directionUp(gesture.token);gesture=null;render();}},true);
const directions={ArrowLeft:-1,KeyA:-1,ArrowRight:1,KeyD:1};
document.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.altKey||event.metaKey)return;
  const button=event.target.closest?.('button,a');
  if(button&&(event.code==='Space'||event.code==='Enter')){if(event.repeat||held.has(event.code)){event.preventDefault();return;}held.add(event.code);pressTimes.set(button,performance.now());suppressedClicks.delete(button);}
  if(activeDialog||event.target!==$('game-area')||!['Space','KeyP','Escape',...Object.keys(directions)].includes(event.code))return;
  event.preventDefault();if(event.repeat||held.has(event.code))return;held.add(event.code);pump();
  if(directions[event.code])engine.directionDown(directions[event.code],event.code);
  else if(event.code==='Space'){if(engine.snapshot().state!=='playing'){pressTimes.set($('primary'),performance.now());start($('primary'));}}
  else if(engine.snapshot().state==='playing')pause();else if(engine.snapshot().state==='paused'&&event.code==='KeyP')resume();
  render();
});
document.addEventListener('keyup',event=>{held.delete(event.code);if(directions[event.code]){pump();engine.directionUp(event.code);render();}});
$('game-area').addEventListener('focusout',event=>{if(!event.currentTarget.contains(event.relatedTarget))releaseInput();});
for(const dialog of document.querySelectorAll('dialog')){
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
  dialog.addEventListener('keydown',event=>{if(event.key!=='Tab'||event.ctrlKey||event.altKey||event.metaKey)return;const nodes=[...dialog.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')].filter(node=>node.getClientRects().length&&!node.closest('[hidden]'));const first=nodes[0],lastNode=nodes.at(-1);if(!first){event.preventDefault();return;}if(event.shiftKey&&(document.activeElement===first||!nodes.includes(document.activeElement))){event.preventDefault();lastNode.focus();}else if(!event.shiftKey&&(document.activeElement===lastNode||!nodes.includes(document.activeElement))){event.preventDefault();first.focus();}});
}
window.addEventListener('blur',()=>{protect('blur');pointers.clear();multi=false;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){protect('hidden');pointers.clear();multi=false;}last=performance.now();});
window.addEventListener('pagehide',()=>{protect('pagehide');pointers.clear();multi=false;});
// Read-only inspection; no state setter, auto-player or outcome injection.
export function getSnapshot(){return structuredClone({engine:engine.snapshot(),storage:records.snapshot(),ui:{activeDialog,previewPose,draft:wardrobe.snapshot(),multi,held:[...held]}});}
function frame(now){pump(now);render();requestAnimationFrame(frame);}
render();requestAnimationFrame(frame);
