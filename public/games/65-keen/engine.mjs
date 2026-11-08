export function cageValue(values,op){return op==='+'?values.reduce((a,b)=>a+b,0):op==='×'?values.reduce((a,b)=>a*b,1):values[0];}
export function analyze(board,cages){
 const duplicates=new Set();for(let a=0;a<4;a++)for(let b=0;b<4;b++)for(let c=b+1;c<4;c++){const i=a*4+b,j=a*4+c,k=b*4+a,l=c*4+a;if(board[i]&&board[i]===board[j]){duplicates.add(i);duplicates.add(j);}if(board[k]&&board[k]===board[l]){duplicates.add(k);duplicates.add(l);}}
 const badCages=cages.filter(g=>g.cells.every(i=>board[i])&&cageValue(g.cells.map(i=>board[i]),g.op)!==g.target);
 return {duplicates:[...duplicates],badCages,won:board.every(v=>v>=1&&v<=4)&&!duplicates.size&&!badCages.length};
}
export function countSolutions(cages,limit=2){const b=Array(16).fill(0);let count=0;function search(i){if(count>=limit)return;if(i===16){if(analyze(b,cages).won)count++;return;}for(let v=1;v<=4;v++){if(b.slice(Math.floor(i/4)*4,i).includes(v))continue;let ok=true;for(let j=i%4;j<i;j+=4)if(b[j]===v)ok=false;if(!ok)continue;b[i]=v;if(!analyze(b,cages).badCages.length)search(i+1);b[i]=0;}}search(0);return count;}
export const create=l=>({board:Array(16).fill(0),notes:Array.from({length:16},()=>[]),moves:0,hints:0});
export function enter(s,i,v,note=false){if(!Number.isInteger(i)||i<0||i>=16||!Number.isInteger(v)||v<0||v>4)return s;const board=[...s.board],notes=s.notes.map(a=>[...a]);if(note&&v){if(board[i])return s;notes[i]=notes[i].includes(v)?notes[i].filter(n=>n!==v):[...notes[i],v].sort();}else{if(board[i]===v)return s;board[i]=v;notes[i]=[];}return {...s,board,notes,moves:s.moves+1};}
