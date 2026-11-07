export function runs(line) { const result=[]; let n=0; for(const v of [...line,0]) { if(v===1)n++;else if(n){result.push(n);n=0;} } return result.length?result:[0]; }
export function clues(board,n) { return {rows:Array.from({length:n},(_,r)=>runs(board.slice(r*n,(r+1)*n))),cols:Array.from({length:n},(_,c)=>runs(Array.from({length:n},(_,r)=>board[r*n+c])))}; }
export function valid(board,level) { const a=clues(board,level.n);return JSON.stringify(a)===JSON.stringify(level.clues); }
export function lineOptions(n,clue) { return Array.from({length:2**n},(_,mask)=>Array.from({length:n},(_,i)=>(mask>>i)&1)).filter(line=>JSON.stringify(runs(line))===JSON.stringify(clue)); }
export function solve(level,limit=2) { const n=level.n, opts=level.clues.rows.map(c=>lineOptions(n,c)), colOpts=level.clues.cols.map(c=>lineOptions(n,c)), result=[]; const chosen=[]; function visit(r){if(result.length>=limit)return;if(r===n){result.push(chosen.flat());return;}for(const row of opts[r]){chosen.push(row);if(colOpts.every((options,c)=>options.some(line=>chosen.every((v,k)=>v[c]===line[k]))))visit(r+1);chosen.pop();}}visit(0);return result; }
const art=[
 ['새싹','00100/00100/11111/01110/00100'],
 ['찻잔','00000/11110/10111/11110/01100'],
 ['작은 집','00100/01110/11111/11011/11011'],
 ['돛단배','00100/01110/00111/11111/01110'],
 ['튤립','0101010/0111110/0011100/0001000/0101000/0011000/0001000'],
 ['우산','0011100/0111110/1111111/0001000/0001000/0101000/0011000'],
 ['하트 편지','0110110/1111111/1111111/0111110/0011100/0001000/0000000'],
 ['숲 엽서','0001000/0011100/0111110/0011100/0111110/1111111/0001000']
];
export const LEVELS=art.map(([name,map])=>{const lines=map.split('/'),n=lines.length,solution=lines.join('').split('').map(Number);return {name,n,solution,clues:clues(solution,n)};});
