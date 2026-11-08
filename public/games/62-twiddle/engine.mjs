export const goal=()=>Array.from({length:9},(_,i)=>i+1);
export function rotate(board,corner,clockwise=true){
  if(!Number.isInteger(corner)||corner<0||corner>3||board.length!==9)return board;
  const r=Math.floor(corner/2),c=corner%2,a=r*3+c,ids=[a,a+1,a+4,a+3],out=[...board];
  ids.forEach((id,i)=>{out[ids[(i+(clockwise?1:3))%4]]=board[id];});return out;
}
export const solved=b=>b.every((v,i)=>v===i+1);
export const create=l=>({board:[...l.board],moves:0,won:false});
export function move(s,corner,clockwise){if(s.won)return s;const board=rotate(s.board,corner,clockwise);return board===s.board?s:{board,moves:s.moves+1,won:solved(board)};}
