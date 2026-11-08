import {el,button} from '../vol5/shared.mjs';
export {el,button};
export const dirs={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
export function safeIds(value,max){return Array.isArray(value)?[...new Set(value.filter(v=>Number.isInteger(v)&&v>=0&&v<max))]:[];}
export function controls(ctx){const releases=[];return {hold(label,down,up=()=>{},name=label){const b=el('button','control',label);b.type='button';b.dataset.control=name;let pointer=null,keyboard=false;
 const stop=()=>{if(pointer!==null||keyboard){pointer=null;keyboard=false;up();}};
 b.addEventListener('pointerdown',e=>{if(!ctx.active()||pointer!==null)return;e.preventDefault();pointer=e.pointerId;b.setPointerCapture(e.pointerId);down(e);});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,stop);
 b.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key))return;e.preventDefault();if(!e.repeat&&!keyboard&&ctx.active()){keyboard=true;down(e);}});
 b.addEventListener('keyup',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();stop();}});
 b.addEventListener('click',e=>{if(e.detail===0&&ctx.active()&&!keyboard){down(e);up();}});
 releases.push(stop);ctx.tools.append(b);return b;},clear(){for(const f of releases)f();}};}
export function directionControls(ctx,act,release=()=>{}){const c=controls(ctx);for(const[d,label]of[['left','←'],['up','↑'],['down','↓'],['right','→']])c.hold(label,()=>act(d),()=>release(d),d);return c;}
export function canvas(ctx,w=600,h=420){const c=el('canvas');c.width=w;c.height=h;c.setAttribute('aria-label','게임 화면 · 아래 화면 조작 또는 방향키를 사용하세요');ctx.board.append(c);return[c,c.getContext('2d')];}
export function cells(ctx,columns,rows,onClick){const scroller=el('div','board-scroll');const g=el('div','tile-grid');g.style.setProperty('--cols',columns);const out=[];
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const b=button('',()=>{if(ctx.active())onClick(x,y);},'cell');b.dataset.cell=x+','+y;g.append(b);out.push(b);}scroller.append(g);ctx.board.append(scroller);return out;}
export function costume(g,x,y,variant=0,scale=1){g.save();g.translate(x,y);g.scale(scale,scale);g.fillStyle='#63b7a8';g.beginPath();g.arc(0,0,12,0,7);g.fill();g.fillStyle='#18394a';g.fillRect(-5,-4,3,3);g.fillRect(3,-4,3,3);g.strokeStyle='#18394a';g.lineWidth=2;g.beginPath();g.moveTo(-4,5);g.lineTo(4,5);g.stroke();
 if(variant){g.fillStyle=variant===2?'#f2bb57':'#8c79b5';g.beginPath();g.moveTo(-13,-9);g.lineTo(0,-24);g.lineTo(13,-9);g.fill();g.fillStyle='#e5faf4';g.beginPath();g.ellipse(-15,4,8,4,-.5,0,7);g.ellipse(15,4,8,4,.5,0,7);g.fill();}g.restore();}
