import {LEVELS} from './levels.mjs';
export {LEVELS};
export function conflicts(level,colors){return level.edges.filter(([a,b])=>colors[a]>0&&colors[a]===colors[b]);}
export function setColor(level,colors,index,color){if(!Number.isInteger(index)||index<0||index>=level.polygons.length||![0,1,2,3,4].includes(color))return {ok:false,reason:'구역과 색을 골라 주세요.'};if(level.fixed[index]>0)return {ok:false,reason:'자물쇠가 있는 단서 구역은 바꿀 수 없어요.'};const next=[...colors];next[index]=color;return {ok:true,colors:next};}
export function valid(level,colors){return colors.length===level.polygons.length&&colors.every((v,i)=>[1,2,3,4].includes(v)&&(!level.fixed[i]||v===level.fixed[i]))&&!conflicts(level,colors).length;}
export function adjacency(polygons){const key=p=>`${p[0]},${p[1]}`,edgeKey=(a,b)=>[key(a),key(b)].sort().join('|'),owners=new Map(),edges=[];polygons.forEach((poly,i)=>poly.forEach((a,k)=>{const e=edgeKey(a,poly[(k+1)%poly.length]);if(owners.has(e))edges.push([owners.get(e),i]);else owners.set(e,i);}));return edges;}
