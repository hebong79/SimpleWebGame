import {writeFile} from 'node:fs/promises';
import {edges as loopEdges,perimeter,clueCounts,solve as loopSolve,valid as loopValid} from '../43-loopy/engine.mjs';
import {edges as railEdges,pathMarks,solve as railSolve} from '../44-tracks/engine.mjs';
const patches=[
 {n:4,cells:[0,1,2,4,5,6,8,9,10]},
 {n:4,cells:[0,1,4,5,8,9,10,11]},
 {n:4,cells:[1,2,5,6,7,9,10,13,14]},
 {n:4,cells:[0,1,2,3,4,8,9,10,11]},
 {n:4,cells:[0,1,4,5,6,7,10,11,14,15]},
 {n:4,cells:[2,3,5,6,7,8,9,10,12,13]},
 {n:5,cells:[0,1,2,5,6,7,8,10,11,12,13,14,17,18,19,23,24]},
 {n:5,cells:[1,2,3,6,7,8,10,11,12,13,15,16,17,20,21]}
];
const loops=[];for(const [k,p]of patches.entries()){const solution=perimeter(p.n,p.cells),level={name:`산책로 ${k+1} · ${p.n}×${p.n}`,n:p.n,clues:[]};level.clues=clueCounts(level,solution);if(!loopValid(level,solution))throw Error('Invalid loop '+k);const count=loopSolve(level).length;if(count!==1)throw Error('Nonunique loop '+k+' '+count);loops.push({...level,solution});}
await writeFile(new URL('../43-loopy/levels.mjs',import.meta.url),'// Eight distinct connected garden outlines; full clues and unique loop checks.\nexport const LEVELS='+JSON.stringify(loops)+';\n');
const paths=[
 [0,1,2,7,12,13,14,19,24],
 [5,6,11,16,17,18,13,8,3,4],
 [20,15,10,11,12,7,8,9],
 [1,6,5,10,15,16,21,22,23,18,19],
 [4,3,8,7,12,17,16,15,20],
 [10,11,6,7,8,13,18,17,22,23,24],
 [0,6,7,8,14,20,21,22,16,17,23,29,35],
 [30,31,25,19,13,14,8,9,10,16,22,23]
];
const rails=[];for(const [k,path]of paths.entries()){const n=k<6?5:6,solution=pathMarks(n,path),indices=solution.map((v,i)=>v?i:-1).filter(i=>i>=0),level={name:`철길 ${k+1} · ${n}×${n}`,n,start:path[0],end:path.at(-1),rows:Array.from({length:n},(_,r)=>path.filter(i=>Math.floor(i/n)===r).length),cols:Array.from({length:n},(_,c)=>path.filter(i=>i%n===c).length),fixed:indices.filter((_,i)=>i%5===2)};while(railSolve(level).length!==1){const next=indices.find(i=>!level.fixed.includes(i));if(next===undefined)throw Error('No unique rail');level.fixed.push(next);}rails.push({...level,path,solution});}
await writeFile(new URL('../44-tracks/levels.mjs',import.meta.url),'// Eight separately authored rail routes. Fixed brown rails are immutable clues.\nexport const LEVELS='+JSON.stringify(rails)+';\n');
console.log(JSON.stringify({loops:loops.map(l=>({n:l.n,solutions:loopSolve(l).length})),rails:rails.map(l=>({n:l.n,length:l.path.length,fixed:l.fixed.length,solutions:railSolve(l).length}))}));
