export function neighbors(i,n=5){return [i%n?i-1:-1,i%n<n-1?i+1:-1,i>=n?i-n:-1,i<n*(n-1)?i+n:-1].filter(x=>x>=0);}
export function groups(board){const seen=new Set(),out=[];for(let i=0;i<board.length;i++){if(!board[i]||seen.has(i))continue;const cells=[i];seen.add(i);for(let j=0;j<cells.length;j++)for(const k of neighbors(cells[j]))if(board[k]===board[i]&&!seen.has(k)){seen.add(k);cells.push(k);}out.push({value:board[i],cells});}return out;}
export function analyze(board){const gs=groups(board),errors=gs.filter(g=>g.cells.length>g.value).flatMap(g=>g.cells);return {groups:gs,errors,won:board.every(v=>v>=1&&v<=5)&&gs.every(g=>g.cells.length===g.value)};}
function partial(board){
  for(const g of groups(board)){
    if(g.cells.length>g.value)return false;
    const reach=new Set(g.cells),q=[...g.cells];for(let j=0;j<q.length;j++)for(const k of neighbors(q[j]))if(!reach.has(k)&&(board[k]===0||board[k]===g.value)){reach.add(k);q.push(k);}
    if(reach.size<g.value)return false;
  }return true;
}
export function countSolutions(clues,limit=2){
  const board=[...clues];let count=0;
  function search(){if(count>=limit)return;let index=-1,choices=null;
    for(let i=0;i<25;i++)if(!board[i]){const ds=[];for(let v=1;v<=5;v++){board[i]=v;if(partial(board))ds.push(v);}board[i]=0;if(!ds.length)return;if(!choices||ds.length<choices.length){index=i;choices=ds;if(ds.length===1)break;}}
    if(index<0){if(analyze(board).won)count++;return;}
    for(const v of choices){board[index]=v;search();if(count>=limit)break;}board[index]=0;
  }if(partial(board))search();return count;
}
export const create=l=>({board:[...l.clues],moves:0,hints:0});
export function enter(s,l,i,v){if(!Number.isInteger(i)||i<0||i>=25||l.clues[i]||!Number.isInteger(v)||v<0||v>5||s.board[i]===v)return s;const board=[...s.board];board[i]=v;return {...s,board,moves:s.moves+1};}
