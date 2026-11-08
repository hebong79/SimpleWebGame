export const CARDS=Object.freeze(Array.from({length:38},(_,i)=>i+2));
export function shuffled(seed=81){let a=[...CARDS],n=seed>>>0;for(let i=a.length-1;i>0;i--){n=(1664525*n+1013904223)>>>0;let j=n%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function create(seed=81){let deck=shuffled(seed);return {piles:[1,1,40,40],hand:deck.splice(0,6).sort((a,b)=>a-b),deck,played:0,total:0,turn:1,result:null};}
export function legal(top,value,pile){return Number.isInteger(value)&&value>=2&&value<=39&&(pile<2?value>top||value===top-10:value<top||value===top+10);}
export function minimum(s){return s.deck.length?2:1;}
export function canFinishTurn(s){return s.played>=minimum(s);}
export function canMeetMinimum(s){const need=minimum(s)-s.played;if(need<=0)return true;function search(piles,hand,n){if(!n)return true;for(let h=0;h<hand.length;h++)for(let p=0;p<4;p++)if(legal(piles[p],hand[h],p)){let next=[...piles];next[p]=hand[h];if(search(next,hand.filter((_,i)=>i!==h),n-1))return true;}return false;}return search(s.piles,s.hand,need);}
export function place(s,value,pile){if(s.result||!Number.isInteger(pile)||pile<0||pile>3||!s.hand.includes(value)||!legal(s.piles[pile],value,pile))return false;s.piles[pile]=value;s.hand.splice(s.hand.indexOf(value),1);s.played++;s.total++;if(!s.deck.length&&!s.hand.length)s.result='win';else if(!canMeetMinimum(s))s.result='blocked';return true;}
export function endTurn(s){if(s.result||!canFinishTurn(s))return false;while(s.hand.length<6&&s.deck.length)s.hand.push(s.deck.shift());s.hand.sort((a,b)=>a-b);s.played=0;s.turn++;if(!canMeetMinimum(s))s.result='blocked';return true;}
export function snapshot(s){return {piles:[...s.piles],handCount:s.hand.length,deckCount:s.deck.length,played:s.played,total:s.total,turn:s.turn,result:s.result};}
