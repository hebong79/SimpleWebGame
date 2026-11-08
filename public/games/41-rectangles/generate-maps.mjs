import {writeFile} from 'node:fs/promises';
import {adjacency,valid} from '../45-map/engine.mjs';
// Eight hand-authored vertex offset matrices; no map generator runs in the game.
const offsets=[
 [[-9,4],[7,-7],[5,-3],[-8,7]],
 [[7,-8],[-8,4],[-11,7],[9,-5]],
 [[-6,-10],[11,6],[9,4],[-5,-9]],
 [[11,8],[-9,-4],[-7,-8],[5,10]],
 [[-7,6],[9,-4],[-6,-8],[8,7],[-9,-6],[7,3]],
 [[9,-6],[-8,8],[8,5],[-5,-7],[10,6],[-7,-4]],
 [[-8,-7],[6,4],[-5,8],[9,5],[-6,-8],[11,-3]],
 [[6,9],[-9,-6],[9,3],[-7,4],[8,-5],[-8,8]]
];
const levels=offsets.map((offset,k)=>{const cols=k<4?3:4,rows=3,step=cols===3?88:66,points=Array.from({length:(rows+1)*(cols+1)},(_,i)=>{const r=Math.floor(i/(cols+1)),c=i%(cols+1);return[c*step,r*step];});let count=0;for(let r=1;r<rows;r++)for(let c=1;c<cols;c++){const p=points[r*(cols+1)+c],o=offset[count++];p[0]+=o[0];p[1]+=o[1];}const polygons=Array.from({length:rows*cols},(_,i)=>{const r=Math.floor(i/cols),c=i%cols;return[points[r*(cols+1)+c],points[r*(cols+1)+c+1],points[(r+1)*(cols+1)+c+1],points[(r+1)*(cols+1)+c]];}),solution=Array.from({length:rows*cols},(_,i)=>(Math.floor(i/cols)+i%cols+k)%4+1),locked=k<3?[0,2,4,6]:k<6?[0,cols+1,rows*cols-1]:[1,cols+2],fixed=solution.map((v,i)=>locked.includes(i)?v:0),level={name:`우편 지도 ${k+1} · ${rows*cols}구역`,rows,cols,width:264,height:rows*step,polygons,edges:adjacency(polygons),fixed,solution};if(!valid(level,solution))throw Error('Bad map');return level;});
await writeFile(new URL('../45-map/levels.mjs',import.meta.url),'// Eight fixed postal maps with shared polygon vertices and matching edge adjacency.\nexport const LEVELS='+JSON.stringify(levels)+';\n');
console.log(JSON.stringify(levels.map(l=>({regions:l.polygons.length,edges:l.edges.length,valid:valid(l,l.solution)}))));
