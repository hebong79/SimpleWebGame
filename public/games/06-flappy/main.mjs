import {createEngine,createRetryGate} from './engine.mjs';
import {createRecords,createWardrobe,PARTS,SETS,BLOCKED_MESSAGE,SATURATION_MESSAGE} from './save.mjs';
const $=id=>document.getElementById(id), engine=createEngine(), records=createRecords(), gate=createRetryGate();
const wardrobe=createWardrobe(()=>records.snapshot().record,draft=>records.equip(draft));
const names={basic:'기본 참새',pilot:'파일럿 모자',rain:'비옷',bee:'꿀벌 옷'};
const partNames={head:'머리',body:'몸',ankle:'발목'};
function setText(id,value){const node=$(id);if(node.textContent!==value)node.textContent=value;}
const reasons={arch:'정원 아치에 닿았어요',ceiling:'하늘 끝에 닿았어요',ground:'정원 바닥에 닿았어요',quit:'직접 비행을 마쳤어요'};
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let last=performance.now(), activeDialog=null, returnFocus=null, confirmAction=null, resultInfo=null, resultAt=0, previewTime=0, liveAnnouncement='';
let audio=null;const tones=new Set(),pointers=new Map(),held=new Set(),tokens=new WeakMap();let gesture=null,multi=false;
function silence(){for(const tone of tones){try{tone.stop();}catch{}}tones.clear();}
function audioGesture(){if(records.snapshot().record.muted)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();const resumed=audio.resume();resumed?.catch(()=>{});}catch{audio=null;}}
function sound(kind){if(records.snapshot().record.muted||document.hidden||activeDialog||!audio)return;try{const oscillator=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime;oscillator.type='sine';oscillator.frequency.setValueAtTime(kind==='pass'?620:160,at);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.09,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+.12);oscillator.connect(gain);gain.connect(audio.destination);tones.add(oscillator);oscillator.onended=()=>{tones.delete(oscillator);oscillator.disconnect();gain.disconnect();};oscillator.start(at);oscillator.stop(at+.13);}catch{silence();}}
function process(events,now){for(const event of events){if(event.type==='pass'){liveAnnouncement=`${event.score}개의 아치를 통과했어요!`;sound('pass');}if(event.type==='result'){resultInfo=records.settle(event);resultAt=now;gate.end(now);silence();sound('collision');held.clear();gesture=null;liveAnnouncement=`${event.score}점 · ${reasons[event.reason]}`;}}}
function pump(now=performance.now()){const delta=Math.max(0,(now-last)/1000);last=now;process(engine.advance(delta),now);}
function clearInput(){held.clear();gesture=null;silence();}
function pause(reason='manual'){pump();engine.pause(reason);clearInput();render();}
function protect(reason){if(engine.snapshot().state==='playing')pause(reason);else clearInput();}
function setUse(id,href){const target=$(id);const exists=document.getElementById(href.slice(1));target.setAttribute('href',exists?href:'#empty');}
function drawBird(prefix,equipment,frame){setUse(`${prefix}-base`,`#sparrow-${frame}`);for(const part of ['body','head','ankle'])setUse(`${prefix}-${part}`,equipment[part]==='none'?'#empty':`#${equipment[part]}-${frame}`);setUse(`${prefix}-face`,`#face-${frame}`);}
function renderArches(arches){const group=$('arches');const ns='http://www.w3.org/2000/svg';while(group.children.length>arches.length*2)group.lastElementChild.remove();arches.forEach((arch,i)=>{const top=arch.center-arch.height/2,bottom=arch.center+arch.height/2;for(let side=0;side<2;side++){let node=group.children[i*2+side];if(!node){node=document.createElementNS(ns,'use');node.setAttribute('href','#garden-arch');node.setAttribute('width','52');node.setAttribute('preserveAspectRatio','none');group.append(node);}node.setAttribute('x',arch.x);node.setAttribute('y',side?bottom:0);node.setAttribute('height',side?640-bottom:top);}});}
function storageNotice(){const state=records.snapshot();$('storage-notice').textContent=[state.blocked?BLOCKED_MESSAGE:'',state.recovered?'저장 기록에 잘못된 값이 있어 기본값 또는 기본 차림으로 복구했습니다.':'',state.saturated?SATURATION_MESSAGE:''].filter(Boolean).join(' · ');}
function render(){const s=engine.snapshot(),record=records.snapshot().record,now=performance.now();
  $('score').textContent=s.score;$('best-score').textContent=record.bestScore;$('total-passed').textContent=record.totalPassed;$('plays').textContent=record.plays;$('ending-counts').textContent=`충돌 ${record.collisions}회 · 중도 종료 ${record.quits}회`;
  $('state-label').textContent=({ready:'준비',playing:'비행 중',paused:'잠깐 쉬기',result:'비행 종료'})[s.state];
  setText('mute',record.muted?'소리 꺼짐':'소리 켜짐');$('mute').setAttribute('aria-pressed',String(record.muted));
  $('bird').setAttribute('transform',`translate(72 ${s.bird.y-24})`);
  const frame=s.state==='result'&&s.result.reason!=='quit'?'hit':s.state==='playing'&&!reduced.matches?`fly${Math.floor(s.time/.13)%3}`:'fly0';
  drawBird('bird',record.equipped,frame);drawBird('outfit',record.equipped,'fly0');renderArches(s.arches);
  $('equipped-label').textContent=PARTS.map(p=>`${partNames[p]}: ${record.equipped[p]==='none'?'기본':names[record.equipped[p].split('-')[0]]}`).join(' · ');
  $('overlay').hidden=s.state==='playing';$('result-actions').hidden=s.state!=='result';
  $('result-unlocks').textContent=s.state==='result'&&resultInfo?.newSets?.length?`${resultInfo.newSets.map(x=>names[x]).join(' · ')} 해금! 각 3부위를 옷장에서 골라 보세요.`:'';
  $('retry-lock').textContent=s.state==='result'&&gate.remaining(now)>0?`새로운 날갯짓까지 ${(gate.remaining(now)/1000).toFixed(1)}초`:'';
  const locked=s.state==='result'&&gate.remaining(now)>0;$('primary').disabled=locked;$('flap').disabled=locked||s.state==='paused';$('restart').disabled=locked;
  $('menu-resume').disabled=s.state!=='paused';$('pause').disabled=!['playing','paused'].includes(s.state);setText('pause',s.state==='paused'?'▶ 게임 재개':'Ⅱ 잠깐 쉬기');
  if(s.state==='ready'){$('overlay-title').textContent='작은 날개로 조금 더 멀리.';$('overlay-copy').textContent='톡 누르면 위로, 놓으면 아래로. 정원 아치의 빈틈을 지나가세요.';setText('primary','첫 비행 시작 ↗');}
  if(s.state==='paused'){$('overlay-title').textContent='정원도 잠깐, 쉬어갑니다.';$('overlay-copy').textContent=s.pauseReason==='manual'?'참새와 아치는 그대로예요. 직접 이어서 날아 주세요.':'입력을 안전하게 멈췄어요. 직접 게임을 재개해 주세요.';setText('primary',s.pauseReason==='manual'?'이어서 날기 ↗':'게임 재개 ↗');}
  if(s.state==='result'){const comparison=resultInfo?.comparison==='new'?'개인 최고 기록을 새로 썼어요!':resultInfo?.comparison==='tie'?'최고 기록과 동점이에요.':'다음 비행도 기다릴게요.';$('overlay-title').textContent=`${s.score}번의 작은 도약.`;$('overlay-copy').textContent=`${s.score}점 · ${reasons[s.result.reason]}. ${comparison}${resultInfo?.saturated?' '+SATURATION_MESSAGE:''}`;setText('primary','다시 날아볼까요?');}
  const pending=s.state==='playing'||s.state==='paused'?pendingUnlocks(s.score,record):[];
  const announcement=pending.length?`${liveAnnouncement||`${s.score}점`} · ${pending.map(x=>names[x]).join(' · ')}: 이번 비행 종료 후 해금`:(liveAnnouncement||'진행 중인 비행은 저장되지 않으며 완료 기록과 차림은 유지됩니다.');
  if($('announcement').textContent!==announcement)$('announcement').textContent=announcement;storageNotice();
}
function pendingUnlocks(score,record){return SETS.filter(set=>!record.unlockedSets.includes(set)&&((set==='pilot'&&score>=1)||(set==='rain'&&score>=10)||(set==='bee'&&record.totalPassed+score>=100)));}
function intent(token){if(activeDialog||multi)return;audioGesture();pump();const s=engine.snapshot(),now=performance.now();if(s.state==='ready'||(s.state==='result'&&gate.allows(token,now))){liveAnnouncement='';resultInfo=null;process(engine.start(),now);last=now;$('flight-field').focus({preventScroll:true});}else if(s.state==='playing')engine.flap();render();}
function resume(){if(activeDialog)closeDialog();clearInput();if(engine.resume()){last=performance.now();$('flight-field').focus({preventScroll:true});}render();}
function openDialog(id){pump();if(engine.snapshot().state==='playing')engine.pause('menu');clearInput();if(!activeDialog)returnFocus=document.activeElement;if(activeDialog)$(activeDialog).close();activeDialog=id;$(id).showModal();render();}
function closeDialog(){if(!activeDialog)return;const id=activeDialog;activeDialog=null;$(id).close();if(id==='wardrobe')wardrobe.cancel();clearInput();last=performance.now();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});render();}
function requestAction(action,token){pump();const s=engine.snapshot();if(s.state==='playing'||s.state==='paused'){confirmAction=action;$('confirm-copy').textContent=`현재 ${s.score}점을 중도 종료 기록으로 한 번 저장한 뒤 ${action==='home'?'홈으로 돌아갑니다.':'준비 화면으로 돌아갑니다.'}`;openDialog('confirm');}else if(action==='home')location.assign('/');else if(s.state==='result'){closeDialog();intent(token);}else{closeDialog();render();}}
function wardrobeRender(){const draft=wardrobe.snapshot(),record=records.snapshot().record,s=engine.snapshot(),pending=pendingUnlocks(s.score,record);for(const part of PARTS)for(const button of $(`part-${part}`).querySelectorAll('button[data-item]')){const set=button.dataset.item==='none'?'basic':button.dataset.item.split('-')[0],own=record.unlockedSets.includes(set),selected=button.dataset.item===draft[part];button.setAttribute('aria-pressed',String(selected));button.setAttribute('aria-label',`${names[set]} · ${partNames[part]} · ${own?'보유':'잠김, 미리보기 가능'}`);const label=`${names[set]} · ${own?'보유':'잠김'}`;if(button.textContent!==label)button.textContent=label;button.classList.toggle('selected',selected);}
  const descriptions={basic:'항상 보유',pilot:`한 판 1점 · 완료 최고 ${record.bestScore}`,rain:`한 판 10점 · 완료 최고 ${record.bestScore}`,bee:`누적 100점 · 완료 누적 ${record.totalPassed}`};
  for(const set of SETS){const own=record.unlockedSets.includes(set);setText(`progress-${set}`,`${descriptions[set]} · ${own?'보유':pending.includes(set)?'이번 비행 종료 후 해금':'잠김'}`);const selected=PARTS.every(p=>draft[p]===(set==='basic'?'none':`${set}-${p}`));document.querySelector(`[data-outfit="${set}"]`).classList.toggle('selected',selected);document.querySelector(`[data-outfit="${set}"]`).setAttribute('aria-pressed',String(selected));}
  $('wardrobe-apply').disabled=!wardrobe.canApply();$('wardrobe-notice').textContent=wardrobe.canApply()?'장착하기를 누르면 선택한 부위만 저장합니다. 차림은 비행 성능을 바꾸지 않아요.':'잠긴 차림은 미리보기만 가능합니다. 진행 중인 해금은 이번 비행 종료 후 확정됩니다.';
  const frame=reduced.matches?'fly0':`fly${Math.floor(previewTime/.26)%3}`;drawBird('w',draft,frame);
}
function openWardrobe(){openDialog('wardrobe');wardrobe.open();previewTime=0;wardrobeRender();}
for(const part of PARTS){const group=$(`part-${part}`);for(const set of SETS){const button=document.createElement('button');button.type='button';button.dataset.part=part;button.dataset.item=set==='basic'?'none':`${set}-${part}`;button.textContent=`${names[set]} · ${partNames[part]}`;button.setAttribute('aria-label',button.textContent);button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{wardrobe.previewPart(button.dataset.part,button.dataset.item);wardrobeRender();});group.append(button);}}
document.querySelectorAll('[data-outfit]').forEach(button=>button.addEventListener('click',()=>{wardrobe.previewSet(button.dataset.outfit);wardrobeRender();}));
$('wardrobe-apply').addEventListener('click',()=>{if(wardrobe.apply())closeDialog();});$('wardrobe-cancel').addEventListener('click',closeDialog);
for(const id of ['wardrobe-open','result-wardrobe','menu-wardrobe'])$(id).addEventListener('click',openWardrobe);
for(const id of ['help','menu-help'])$(id).addEventListener('click',()=>openDialog('info-dialog'));
$('close-info').addEventListener('click',closeDialog);$('menu-close').addEventListener('click',closeDialog);$('menu-open').addEventListener('click',()=>openDialog('menu'));$('menu-resume').addEventListener('click',resume);
$('confirm-cancel').addEventListener('click',closeDialog);$('confirm-ok').addEventListener('click',()=>{const action=confirmAction;closeDialog();process(engine.quit(),performance.now());if(action==='home')location.assign('/');else{engine.ready();liveAnnouncement='이전 비행 기록을 저장했어요. 새 비행을 시작해 주세요.';render();}});
for(const id of ['home','result-home','menu-home'])$(id).addEventListener('click',event=>{event.preventDefault();requestAction('home');});
for(const id of ['restart','menu-restart'])$(id).addEventListener('click',()=>requestAction('restart',tokens.get($(id))));
$('primary').addEventListener('click',()=>{if(engine.snapshot().state==='paused')resume();else intent(tokens.get($('primary')));});
$('flap').addEventListener('click',event=>{if(event.detail===0)intent(tokens.get($('flap')));});
$('pause').addEventListener('click',()=>{if(engine.snapshot().state==='paused')resume();else pause();});
$('mute').addEventListener('click',()=>{records.mute(!records.snapshot().record.muted);silence();audioGesture();render();});
// Observe every contact on the page before any game target handles a tap.
document.addEventListener('pointerdown',event=>{pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});const button=event.target.closest('button');if(button)tokens.set(button,gate.press(performance.now()));if(pointers.size>1){multi=true;protect('multitouch');}},true);
for(const id of ['flight-field','flap'])$(id).addEventListener('pointerdown',event=>{if(activeDialog||event.target.closest('button')&&id==='flight-field'||event.button!==0||!event.isPrimary||multi||pointers.size!==1)return;event.preventDefault();$(id).focus({preventScroll:true});try{$(id).setPointerCapture(event.pointerId);}catch{}gesture={id:event.pointerId,x:event.clientX,y:event.clientY};intent(gate.press(performance.now()));});
document.addEventListener('pointermove',event=>{if(gesture?.id===event.pointerId&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>=30){gesture=null;protect('drag');}},true);
document.addEventListener('pointerup',event=>{pointers.delete(event.pointerId);if(gesture?.id===event.pointerId)gesture=null;if(!pointers.size)multi=false;},true);
document.addEventListener('pointercancel',event=>{pointers.delete(event.pointerId);gesture=null;protect('pointercancel');if(!pointers.size)multi=false;},true);
document.addEventListener('keydown',event=>{const button=event.target.closest?.('button');if(button&&(event.code==='Space'||event.code==='Enter')){if(event.repeat){event.preventDefault();return;}tokens.set(button,gate.press(performance.now()));}if(event.ctrlKey||event.altKey||event.metaKey)return;if(activeDialog)return;if(event.target!==$('flight-field'))return;if(!['Space','KeyP','Escape'].includes(event.code))return;event.preventDefault();if(event.repeat||held.has(event.code))return;held.add(event.code);if(event.code==='Space')intent(gate.press(performance.now()));else if(engine.snapshot().state==='playing')pause();else if(engine.snapshot().state==='paused')resume();});
document.addEventListener('keyup',event=>held.delete(event.code));
for(const dialog of document.querySelectorAll('dialog')){dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});dialog.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const focusable=[...dialog.querySelectorAll('button:not(:disabled),select:not(:disabled),a[href]')].filter(x=>!x.hidden);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});}
window.addEventListener('blur',()=>{protect('blur');pointers.clear();multi=false;});document.addEventListener('visibilitychange',()=>{if(document.hidden){protect('hidden');pointers.clear();multi=false;}last=performance.now();});
window.addEventListener('pagehide',()=>{protect('pagehide');silence();});
let previousFrame=performance.now();function frame(now){const delta=(now-previousFrame)/1000;previousFrame=now;pump(now);if(activeDialog==='wardrobe'&&!document.hidden){previewTime+=delta;wardrobeRender();}render();requestAnimationFrame(frame);}render();requestAnimationFrame(frame);
