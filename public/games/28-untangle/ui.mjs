import {el,button} from '../vol2/shared.mjs';
export {el,button};
export function optionBar(ctx,options,onChange){const row=el('div','option-bar');for(const [label,value] of options){const b=button(label,()=>onChange(value));b.dataset.value=value;row.append(b);}ctx.tools.append(row);return row;}
export function levelBar(ctx,count,get,set){const row=el('div','option-bar');row.append(button('◀ 이전',()=>{if(get()>0)set(get()-1);}),button('다음 ▶',()=>{if(get()<count-1)set(get()+1);}));ctx.tools.append(row);return row;}
export function sanitizeMap(record,name){if(!record[name]||typeof record[name]!=='object'||Array.isArray(record[name]))record[name]={};return record[name];}
export function finite(v,otherwise=0){return Number.isFinite(v)&&v>=0?v:otherwise;}
export function keepBoardFocus(ctx,paint){return (...args)=>{const hadFocus=ctx.board.contains(document.activeElement);paint(...args);if(hadFocus&&!ctx.board.contains(document.activeElement))ctx.board.focus({preventScroll:true});};}
export function stylesheet(){const l=el('link');l.rel='stylesheet';l.href='/games/28-untangle/ui.css';document.head.append(l);}
export function changeMode(ctx,mode,set){if(ctx.active()){ctx.status('모드를 바꾸려면 먼저 일시정지 후 새 판을 시작해 주세요.');return;}set(mode);}
