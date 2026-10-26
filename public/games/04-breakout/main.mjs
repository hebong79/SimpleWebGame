import {RULES,createGame,startGame,launchBall,pauseGame,resumeGame,step,finishGame} from './engine.mjs';
import {createStore} from './save.mjs';
const $=id=>document.getElementById(id),court=$('court'),canvas=$('canvas'),ctx=canvas.getContext('2d'),dialog=$('confirm-dialog');
const store=createStore(),keys=new Set(),pointers=new Set();
let game=createGame(),targetX=null,drag=null,lastTime=null,pending=null,returnFocus=null,newBest=false,audio=null;
const notes=new Set(),trail=[],reduced=matchMedia('(prefers-reduced-motion: reduce)');
function frozen(value){if(value&&typeof value==='object'){for(const v of Object.values(value))frozen(v);Object.freeze(value);}return value;}
// QA may import this module for inspection; the live state is never exposed.
export function getSnapshot(){return frozen({game:structuredClone(game),save:store.snapshot(),warning:store.warning,dialogOpen:dialog.open});}
function soundUnlock(){try{const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!audio&&Audio)audio=new Audio();if(audio?.state==='suspended'&&!store.snapshot().muted)audio.resume().catch(()=>{});}catch{}}
function silence(){for(const node of notes)try{node.stop();}catch{}notes.clear();}
function tone(type){if(store.snapshot().muted||!(game.status==='playing'||(type==='lifeLost'&&game.status==='finished'&&game.endReason==='lost'))||document.hidden||!audio||audio.state!=='running')return;try{const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;oscillator.type=type==='lifeLost'?'sawtooth':type==='brick'?'triangle':'sine';const frequency=type==='brick'?620:type==='paddle'?340:140;oscillator.frequency.setValueAtTime(frequency,now);oscillator.frequency.exponentialRampToValueAtTime(frequency*.55,now+.11);gain.gain.setValueAtTime(.055,now);gain.gain.exponentialRampToValueAtTime(.001,now+.12);oscillator.connect(gain);gain.connect(audio.destination);notes.add(oscillator);oscillator.onended=()=>{notes.delete(oscillator);oscillator.disconnect();gain.disconnect();};oscillator.start();oscillator.stop(now+.13);}catch{}}
function resetInput(){keys.clear();targetX=null;const old=drag;drag=null;if(old&&court.hasPointerCapture(old.id))court.releasePointerCapture(old.id);lastTime=null;trail.length=0;silence();}
function accept(events){for(const event of events){if(event.type==='finish'){newBest=store.record(game).newBest;$('announcement').textContent='이번 판의 기록을 반영했습니다.';}else if(event.type==='lifeLost'){$('announcement').textContent=`공을 놓쳤어요. 남은 목숨 ${game.lives}개. 공을 직접 다시 발사하세요.`;tone('lifeLost');trail.length=0;}else if(event.type==='stage'){$('announcement').textContent=`${game.stage}구역 진입! 공을 직접 발사하세요.`;trail.length=0;}else if(event.type==='brick'||event.type==='paddle')tone(event.type);}render();}
function focusCourt(){court.focus({preventScroll:true});}
function pause(){if(game.status==='playing'){pauseGame(game);resetInput();render();}}
function resume(){if(dialog.open||document.hidden)return;soundUnlock();resumeGame(game);resetInput();focusCourt();render();}
function fresh(){resetInput();game=createGame();newBest=false;$('announcement').textContent='임무 시작 뒤 공을 직접 발사하세요.';render();$('primary').focus({preventScroll:true});}
function launch(){if(dialog.open)return;soundUnlock();accept(launchBall(game));focusCourt();}
function requestAction(action,source){
  if(game.status==='playing'||game.status==='paused'){pause();resetInput();pending=action;returnFocus=source;$('confirm-title').textContent=action==='home'?'게임 목록으로 돌아갈까요?':'새 임무를 시작할까요?';dialog.showModal();$('confirm-cancel').focus();}
  else if(action==='home')location.assign('/');else fresh();
}
function closeConfirm(confirmed){const action=pending;pending=null;dialog.close();resetInput();if(confirmed){accept(finishGame(game,'quit'));if(action==='home')location.assign('/');else fresh();}else {render();returnFocus?.focus({preventScroll:true});}}
$('primary').addEventListener('click',e=>{e.stopPropagation();soundUnlock();resetInput();if(game.status==='ready'){startGame(game);focusCourt();render();}else if(game.status==='paused')resume();else if(game.status==='finished')fresh();});
$('launch').addEventListener('click',launch);
$('pause').addEventListener('click',()=>{if(game.status==='paused')resume();else pause();});
$('restart').addEventListener('click',e=>requestAction('restart',e.currentTarget));
$('home').addEventListener('click',e=>{e.preventDefault();requestAction('home',e.currentTarget);});
$('confirm-cancel').addEventListener('click',()=>closeConfirm(false));$('confirm-ok').addEventListener('click',()=>closeConfirm(true));
dialog.addEventListener('cancel',e=>{e.preventDefault();closeConfirm(false);});
dialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Tab'){const first=$('confirm-cancel'),last=$('confirm-ok');if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
$('mute').addEventListener('click',()=>{soundUnlock();store.settings({muted:!store.snapshot().muted});if(store.snapshot().muted)silence();else soundUnlock();render();});
for(const button of document.querySelectorAll('[data-skin]'))button.addEventListener('click',()=>{store.settings({paddleTheme:button.dataset.skin});render();});
court.addEventListener('keydown',e=>{
  if(e.target!==court||dialog.open||e.ctrlKey||e.altKey||e.metaKey)return;
  const key=e.key.toLowerCase();if(!['arrowleft','arrowright','a','d',' ','p','escape'].includes(key))return;e.preventDefault();if(e.repeat)return;
  if(key==='p'||key==='escape'){if(game.status==='playing')pause();else if(game.status==='paused')resume();return;}
  if(game.status!=='playing')return;if(key===' ')launch();else {keys.add(key);targetX=null;}
});
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
document.addEventListener('focusin',e=>{if(e.target!==court){keys.clear();targetX=null;}});
function logicalX(event){const rect=court.getBoundingClientRect();return (event.clientX-rect.left)/rect.width*720;}
document.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;pointers.add(e.pointerId);if(pointers.size>1)resetInput();},{capture:true});
function endPointer(e){pointers.delete(e.pointerId);}
document.addEventListener('pointerup',endPointer);document.addEventListener('pointercancel',endPointer);
court.addEventListener('pointerdown',e=>{
  if(e.target.closest('button,a')||game.status!=='playing'||dialog.open||!e.isPrimary||e.button!==0||pointers.size>1)return;
  const rect=court.getBoundingClientRect();if(e.pointerType!=='mouse'&&e.clientY<rect.top+rect.height*.65)return;
  soundUnlock();focusCourt();targetX=logicalX(e);drag={id:e.pointerId,x:e.clientX,y:e.clientY,start:performance.now(),distance:0,type:e.pointerType};court.setPointerCapture(e.pointerId);e.preventDefault();
});
court.addEventListener('pointermove',e=>{
  if(game.status!=='playing'||dialog.open)return;
  if(e.pointerType==='mouse'&&!drag){if(!e.target.closest('button,a'))targetX=logicalX(e);return;}
  if(!drag||drag.id!==e.pointerId)return;
  drag.distance=Math.max(drag.distance,Math.hypot(e.clientX-drag.x,e.clientY-drag.y));targetX=logicalX(e);e.preventDefault();
});
court.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const ended=drag;ended.distance=Math.max(ended.distance,Math.hypot(e.clientX-ended.x,e.clientY-ended.y));drag=null;if(court.hasPointerCapture(e.pointerId))court.releasePointerCapture(e.pointerId);if(ended.type==='mouse'||(ended.distance<=8&&performance.now()-ended.start<=350)){// Apply the last attached position before launching.
    if(game.status==='playing'&&game.phase==='attached'&&targetX!==null)step(game,1e-6,{paddleX:targetX});launch();} });
court.addEventListener('pointercancel',()=>resetInput());court.addEventListener('lostpointercapture',()=>{if(drag)resetInput();});
function protect(){pause();resetInput();pointers.clear();}
window.addEventListener('blur',protect);window.addEventListener('pagehide',protect);document.addEventListener('visibilitychange',()=>{if(document.hidden)protect();else lastTime=null;});
function draw(){
  const c=ctx;c.clearRect(0,0,720,960);c.fillStyle='#101b2d';c.fillRect(0,0,720,960);
  for(let i=0;i<52;i++){c.globalAlpha=.18+(i%4)*.12;c.fillStyle='#dde8ef';c.beginPath();c.arc((41+i*137)%720,(53+i*i*71)%960,1+(i%3)*.45,0,Math.PI*2);c.fill();}c.globalAlpha=1;
  c.strokeStyle='#8299af1f';c.lineWidth=1;for(const r of [148,173]){c.beginPath();c.arc(560,590,r,0,Math.PI*2);c.stroke();}c.fillStyle='#b7c6d014';c.beginPath();c.arc(560,590,91,0,Math.PI*2);c.fill();c.save();c.translate(555,590);c.rotate(-.49);c.strokeStyle='#b7c6d01f';c.lineWidth=7;c.beginPath();c.ellipse(0,0,150,28,0,0,Math.PI*2);c.stroke();c.restore();
  c.strokeStyle='#8196ad1f';c.lineWidth=1;c.strokeRect(30,38,660,884);c.fillStyle='#8196ad70';c.font='12px Consolas, monospace';c.fillText(`ORBIT 0${game.stage} / ${['LOW EARTH','DEBRIS FIELD','FINAL ORBIT'][game.stage-1]}`,38,55);
  const live=game.bricks.filter(b=>b.alive),colors=['#f38b77','#f6d786','#a7dbcd','#b6b7e7'],symbols=['+','/','·','×'];
  for(const b of live){c.fillStyle=colors[b.row];c.beginPath();c.roundRect(b.x,b.y,b.width,b.height,4);c.fill();c.fillStyle='#142334';c.font='16px Consolas, monospace';c.textAlign='center';c.fillText(symbols[b.row],b.x+b.width/2,b.y+19);if(live.length===1){c.strokeStyle='#f5f0df';c.lineWidth=2;c.strokeRect(b.x-3,b.y-3,b.width+6,b.height+6);c.fillStyle='#f5f0df';c.fillText('✦',b.x+b.width/2,b.y-9);}}c.textAlign='left';
  if(!reduced.matches)for(let i=0;i<trail.length;i++){c.fillStyle=`rgba(248,242,216,${i/trail.length*.22})`;c.beginPath();c.arc(trail[i].x,trail[i].y,3+i/trail.length*4,0,Math.PI*2);c.fill();}
  c.fillStyle='#f8f2d8';c.beginPath();c.arc(game.ball.x,game.ball.y,9,0,Math.PI*2);c.fill();
  const theme=store.snapshot().paddleTheme,x=game.paddle.x-60;c.fillStyle=theme==='solar'?'#f6d786':theme==='mono'?'#f5f0df':'#a7dbcd';c.beginPath();c.roundRect(x,884,120,18,theme==='mint'?8:2);c.fill();c.fillStyle='#14223266';if(theme==='mono')for(let px=x+8;px<x+120;px+=14)c.fillRect(px,884,3,18);else c.fillRect(x+14,888,92,2);
  c.fillStyle='#8196ad80';c.font='11px Consolas, monospace';c.textAlign='center';c.fillText('← DRAG TO MOVE →',360,941);c.textAlign='left';
}
function render(){
  const data=store.snapshot();$('score').textContent=game.score.toLocaleString('ko-KR');$('stage').textContent=String(game.stage).padStart(2,'0');$('remaining').textContent=game.bricks.filter(b=>b.alive).length;$('lives').textContent=Array.from({length:3},(_,i)=>i<game.lives?'●':'○').join(' ');$('lives').setAttribute('aria-label',`남은 목숨 ${game.lives}개`);$('speed').textContent=`${RULES.speeds[game.stage-1]} PX/S`;
  for(const [id,value] of [['best-score',data.bestScore],['wins',data.wins],['plays',data.plays],['total-bricks',data.totalBricks],['best-stage',data.bestStage]])$(id).textContent=value.toLocaleString('ko-KR');
  $('save-warning').hidden=!store.warning;$('save-warning').textContent=store.warning;$('mute').textContent=data.muted?'소리 꺼짐':'소리 켜짐';$('mute').setAttribute('aria-pressed',String(data.muted));for(const b of document.querySelectorAll('[data-skin]'))b.setAttribute('aria-pressed',String(b.dataset.skin===data.paddleTheme));
  document.querySelectorAll('.progress-stages span').forEach((n,i)=>n.classList.toggle('current',i===game.stage-1));
  $('launch').disabled=game.status!=='playing'||game.phase!=='attached';$('pause').disabled=!['playing','paused'].includes(game.status);$('pause').textContent=game.status==='paused'?'▷ 계속하기':'Ⅱ 일시정지';
  $('overlay').hidden=game.status==='playing';$('result-home').hidden=game.status!=='finished';
  let status=game.phase==='attached'?'공 발사 대기':'임무 진행 중';
  if(game.status==='ready')status='발사 준비';else if(game.status==='paused')status='일시정지';else if(game.status==='finished')status=game.endReason==='won'?'임무 완료':'임무 종료';$('status').textContent=status;
  if(game.status!=='playing'){
    const mode=game.status==='ready'?['READY FOR LAUNCH','작은 우주를\n비워볼까요?','공을 튕겨 모든 잔해 블록을 없애세요.\n세 구역을 청소하면 임무 완료!','임무 시작 ↗']:game.status==='paused'?['TAKE A BREATHER','잠시, 궤도 정지.','공과 패들은 그대로 기다리고 있어요.\n준비되면 이어서 청소하세요.','계속하기 ▷']:[game.endReason==='won'?'MISSION COMPLETE':'NEXT ORBIT IS YOURS',game.endReason==='won'?'우주가 말끔해졌어요!':game.endReason==='quit'?'이번 항해를 마쳤어요.':'다음 궤도를 노려요.',`${game.endReason==='won'?'세 구역 청소 완료':game.endReason==='lost'?'남은 목숨 없음':'사용자 종료'} · 이번 판 ${game.score.toLocaleString('ko-KR')}점\n최고 기록 ${data.bestScore.toLocaleString('ko-KR')}점\n${newBest?'새로운 최고 기록을 세웠어요!':game.score===data.bestScore&&game.score>0?'최고점과 동점이에요.':'지금까지의 기록을 남겼어요.'}`,'다시 도전 ↗'];
    $('over-kicker').textContent=mode[0];$('over-title').textContent=mode[1];$('over-copy').textContent=mode[2];$('primary').textContent=mode[3];
  }draw();
}
function frame(time){const dt=lastTime===null?0:Math.min((time-lastTime)/1000,.05);lastTime=time;if(game.status==='playing'&&!dialog.open&&dt>0){const axis=(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0);accept(step(game,dt,targetX!==null?{paddleX:targetX}:{axis}));if(game.phase==='flight'&&!reduced.matches){trail.push({x:game.ball.x,y:game.ball.y});if(trail.length>10)trail.shift();}}requestAnimationFrame(frame);}
render();requestAnimationFrame(frame);
