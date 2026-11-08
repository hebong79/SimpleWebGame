import{binarySolve}from'../66-singles/engine.mjs';
export function around(i,n=6){const a=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=i%n+dx,y=Math.floor(i/n)+dy;if(x>=0&&x<n&&y>=0&&y<n)a.push(y*n+x);}return a;}
export function counts(a,n=6){return a.map((_,i)=>around(i,n).reduce((s,j)=>s+(a[j]===1?1:0),0));}
export function valid(a,l){return a.length===l.n*l.n&&a.every(v=>v===0||v===1)&&l.clues.every((v,i)=>v<0||around(i,l.n).reduce((s,j)=>s+a[j],0)===v);}
export function solve(l,limit=2){const cs=l.clues.flatMap((v,i)=>v<0?[]:[{cells:around(i,l.n),min:v,max:v}]);return binarySolve(l.n*l.n,cs,a=>valid(a,l),limit);}
