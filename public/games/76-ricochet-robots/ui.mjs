import{el,button}from'../vol4/shared.mjs';
export{el,button};
export function row(...nodes){const n=el('div','c-row');n.append(...nodes);return n;}
export function section(title,...nodes){const n=el('section','c-section');n.append(el('h3','',title),...nodes);return n;}
export function action(label,fn,key,selected=false){const n=button(label,fn,selected?'selected':'');if(key)n.dataset.focus=key;n.setAttribute('aria-pressed',String(selected));return n;}
export function draw(ctx,fn){const previous=document.activeElement?.dataset?.focus;ctx.board.replaceChildren();ctx.tools.replaceChildren();fn();if(previous){const node=[...document.querySelectorAll('[data-focus]')].find(n=>n.dataset.focus===previous);node?.focus({preventScroll:true});}}
export function cells(size,fn){const wrap=el('div','c-scroll');const g=el('div','c-cells');g.style.setProperty('--size',String(size));for(let i=0;i<size*size;i++)g.append(fn(i));wrap.append(g);return wrap;}
export function mark(text,cls=''){return el('span','c-mark '+cls,text);}
export function card(text,fn,key,selected=false){const n=fn?action(text,fn,key,selected):el('div','c-card',text);n.classList.add('c-card');return n;}
export const safeCount=r=>Number.isInteger(r?.wins)&&r.wins>=0&&r.wins<=1e9?r.wins:0;
export const completed=r=>Array.isArray(r?.completed)?[...new Set(r.completed.filter(n=>Number.isInteger(n)&&n>=0&&n<8))]:[];
