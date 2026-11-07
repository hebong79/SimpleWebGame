export function deck(attributes=4){return Array.from({length:3**attributes},(_,i)=>{const v=[];for(let j=0;j<attributes;j++)v.push(Math.floor(i/3**j)%3);return v;});}
export function mismatch(cards){if(cards.length!==3)return -1;return cards[0].findIndex((_,i)=>{const n=new Set(cards.map(c=>c[i])).size;return n!==1&&n!==3;});}
export function isSet(cards){return cards.length===3&&mismatch(cards)===-1;}
export function findSet(cards){for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++)for(let k=j+1;k<cards.length;k++)if(isSet([cards[i],cards[j],cards[k]]))return [i,j,k];return null;}
export function shuffle(cards,rng=Math.random){const a=[...cards];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function deal(state){let {shown,pile}=state;shown=[...shown];pile=[...pile];while(shown.length<12&&pile.length)shown.push(pile.pop());if(!findSet(shown)){const all=[...shown,...pile],set=findSet(all);if(!set)return {shown,pile,done:true};const chosen=set.map(i=>all[i]),rest=all.filter((_,i)=>!set.includes(i));shown=[...chosen,...rest.splice(0,9)];pile=rest;}return {shown,pile,done:false};}
