export const CARDS=Object.freeze(Array.from({length:20},(_,i)=>i+3));
export function shuffle(seed=83){let a=[...CARDS];for(let i=19;i>0;i--){seed=(seed*1664525+1013904223)>>>0;let j=seed%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function create(seed=83){let a=shuffle(seed);return {players:Array.from({length:3},()=>({chips:8,cards:[]})),deck:a.slice(4),removed:a.slice(0,4),current:0,pot:0,card:null,result:null,taken:0,...{card:a[4],deck:a.slice(5)}};}
export function penalty(cards,chips=0){let a=[...new Set(cards)].sort((a,b)=>a-b);return a.reduce((n,v,i)=>n+(i&&a[i-1]===v-1?0:v),0)-chips;}
export function take(s){if(s.result)return false;let p=s.players[s.current];p.cards.push(s.card);p.cards.sort((a,b)=>a-b);p.chips+=s.pot;s.pot=0;s.taken++;if(!s.deck.length){const scores=s.players.map(p=>penalty(p.cards,p.chips));let min=Math.min(...scores);s.result={scores,winners:scores.map((n,i)=>n===min?i:-1).filter(i=>i>=0)};s.card=null;}else s.card=s.deck.shift();return true;}
export function pass(s){let p=s.players[s.current];if(s.result||!p.chips)return false;p.chips--;s.pot++;s.current=(s.current+1)%3;return true;}
export function snapshot(s){return {players:s.players.map(p=>({chips:p.chips,cards:[...p.cards],score:penalty(p.cards,p.chips)})),card:s.card,pot:s.pot,current:s.current,remaining:s.deck.length,taken:s.taken,result:s.result};}
