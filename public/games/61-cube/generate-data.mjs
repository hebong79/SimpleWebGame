// Reproducible authoring tool; emits fixed original puzzles, never runs in a browser.
import {writeFileSync} from 'node:fs';
import {roll,opposite} from './engine.mjs';
import {rotate,goal} from '../62-twiddle/engine.mjs';
import {solve} from '../63-inertia/engine.mjs';
import {countSolutions as fillingCount,neighbors,analyze as fillingAnalyze} from '../64-filling/engine.mjs';
import {countSolutions as keenCount,cageValue} from '../65-keen/engine.mjs';
let seed=610065;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed>>>8)%n;};
const shuffle=a=>{a=[...a];for(let i=a.length-1;i;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const dirs=['up','right','down','left'],delta={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
function save(slug,levels){writeFileSync(new URL('../'+slug+'/levels.mjs',import.meta.url),'// Fixed original levels; generated and verified by 61-cube/generate-data.mjs.\nexport const levels = '+JSON.stringify(levels,null,2)+';\n');}
const cubes=[];
for(let l=0;l<8;l++){
 for(let attempt=0;attempt<10000;attempt++){
  let x=2,y=2,o=[0,1,2,3,4,5],f=Array(6).fill(1),floor=Array(20).fill(0),path=[];
  for(let k=0;k<100;k++){
   const d=dirs[rand(4)],[dx,dy]=delta[d];if(x+dx<0||x+dx>4||y+dy<0||y+dy>3)continue;
   const i=y*5+x,b=o[1];[f[b],floor[i]]=[floor[i],f[b]];x+=dx;y+=dy;o=roll(o,d);path.push(d);
   if(path.length>=8+l*2&&f.every(v=>!v)) {cubes.push({name:l<3?'연속 도장 '+(l+1):'되놓기 작업 '+(l-2),x,y,orientation:o,floor,solution:path.reverse().map(opposite)});break;}
  }if(cubes.length===l+1)break;
 }if(cubes.length!==l+1)throw Error('cube authoring failed');
}save('61-cube',cubes);
const twiddles=[];
for(let l=0;l<8;l++){let board=goal(),scramble=[];for(let k=0;k<(l<3?l+2:l+5);k++){const c=rand(4),cw=!!rand(2);board=rotate(board,c,cw);scramble.push([c,cw]);}twiddles.push({name:'표지판 '+(l+1),board,solution:scramble.reverse().map(([c,cw])=>[c,!cw])});}save('62-twiddle',twiddles);
const inertia=[];const edge=Array.from({length:49},(_,i)=>i).filter(i=>i<7||i>41||i%7===0||i%7===6),inside=Array.from({length:49},(_,i)=>i).filter(i=>!edge.includes(i));
for(let l=0;l<8;l++)for(let attempt=0;attempt<2000;attempt++){
 const cells=shuffle(inside),start=cells.pop(),walls=[...edge,...cells.splice(0,l<3?1:3)],stops=cells.splice(0,4),cracks=cells.splice(0,l<3?0:2),gems=cells.splice(0,3+(l>4?1:0));
 const map={name:l<3?'안전 빙하 '+(l+1):'균열 우회 '+(l-2),start,walls,stops,cracks,gems};const solution=solve(map);
 if(solution&&solution.length>=3){inertia.push({...map,solution});break;}
}if(inertia.length!==8)throw Error('inertia authoring failed');save('63-inertia',inertia);
const fillings=[];
for(let l=0;l<8;l++){
 let solution;
 for(let attempt=0;attempt<20&&!solution;attempt++){
  const trial=Array(25).fill(0);let budget=50000;
  function partition(){if(--budget<0)return false;const start=trial.indexOf(0);if(start<0)return l<3||trial.includes(5);
   const shapes=[],seen=new Set();function grow(cells){const key=[...cells].sort((a,b)=>a-b).join(',');if(seen.has(key))return;seen.add(key);shapes.push(cells);if(cells.length>=(l<3?3:5))return;for(const i of [...new Set(cells.flatMap(i=>neighbors(i)))])if(!trial[i]&&!cells.includes(i))grow([...cells,i]);}grow([start]);
   for(const cells of shuffle(shapes)){const size=cells.length;if(cells.some(i=>neighbors(i).some(j=>trial[j]===size)))continue;cells.forEach(i=>trial[i]=size);if(partition())return true;cells.forEach(i=>trial[i]=0);}return false;
  }if(partition()&&fillingAnalyze(trial).won)solution=[...trial];
 }if(!solution)throw Error('filling partition authoring failed');
 const clues=[...solution];let removed=0;
 for(const i of shuffle(Array.from({length:25},(_,i)=>i))){const old=clues[i];clues[i]=0;if(fillingCount(clues)===1)removed++;else clues[i]=old;if(removed>=6+l)break;}
 if(fillingCount(clues)!==1)throw Error('nonunique filling');fillings.push({name:'화단 '+(l+1),clues,solution});
}save('64-filling',fillings);
const keens=[];
for(let l=0;l<8;l++)for(let attempt=0;attempt<10000;attempt++){
 const rows=shuffle([0,1,2,3]),cols=shuffle([0,1,2,3]),nums=shuffle([1,2,3,4]),solution=rows.flatMap(r=>cols.map(c=>nums[(r+c)%4])),unused=new Set(Array.from({length:16},(_,i)=>i)),cages=[];
 while(unused.size){const cells=[[...unused][0]];unused.delete(cells[0]);const size=1+rand(l<2?2:3);while(cells.length<size){const options=[...new Set(cells.flatMap(i=>[i%4?i-1:-1,i%4<3?i+1:-1,i>=4?i-4:-1,i<12?i+4:-1]))].filter(i=>unused.has(i));if(!options.length)break;const next=options[rand(options.length)];cells.push(next);unused.delete(next);}const op=cells.length===1?'=':(l<2||rand(2)?'+':'×');cages.push({cells:cells.sort((a,b)=>a-b),op,target:cageValue(cells.map(i=>solution[i]),op)});}
 if(l>=2&&!cages.some(c=>c.op==='×'&&c.cells.length===3))continue;
 if(keenCount(cages)===1){keens.push({name:'작업대 '+(l+1),cages,solution});break;}
}if(keens.length!==8)throw Error('keen authoring failed');save('65-keen',keens);
console.log('Authored 40 fixed levels; Filling and Keen each unique.');
