export const SYMBOLS=['●','◆','▲','■','★','⬟'];
export function feedback(secret,guess){let exact=0;const a=Array(6).fill(0),b=Array(6).fill(0);for(let i=0;i<secret.length;i++){if(secret[i]===guess[i])exact++;else {a[secret[i]]++;b[guess[i]]++;}}return {exact,color:a.reduce((v,n,i)=>v+Math.min(n,b[i]),0)};}
export function newCode(mode='basic',rng=Math.random){const n=mode==='intro'?3:4,pool=[0,1,2,3,4,5],out=[];for(let i=0;i<n;i++){const p=Math.floor(rng()*(mode==='intro'?pool.length:6));out.push(mode==='intro'?pool.splice(p,1)[0]:p);}return out;}
export function validGuess(guess,mode){return guess.length===(mode==='intro'?3:4)&&guess.every(x=>Number.isInteger(x)&&x>=0&&x<6)&&(mode!=='intro'||new Set(guess).size===guess.length);}
