export const DIRS=[[-1,0],[0,1],[1,0],[0,-1]];
export const edge=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
export function slide(level,robots,robot,dir){let at=robots[robot];const [dy,dx]=DIRS[dir];for(;;){const y=Math.floor(at/7)+dy,x=at%7+dx,next=y*7+x;if(y<0||y>6||x<0||x>6||robots.includes(next)||level.walls.includes(edge(at,next)))break;at=next;}return at;}
export const createState=level=>({robots:[...level.robots],moves:0,won:false});
export function move(level,state,robot,dir){if(state.won||![0,1,2].includes(robot)||![0,1,2,3].includes(dir))return state;const at=slide(level,state.robots,robot,dir);if(at===state.robots[robot])return state;const robots=[...state.robots];robots[robot]=at;return{robots,moves:state.moves+1,won:robots[level.robot]===level.target};}
export function solve(level,onlyTarget=false){const initial=level.robots.join(','),queue=[level.robots],parents=new Map([[initial,null]]);for(let h=0;h<queue.length;h++){const robots=queue[h],key=robots.join(',');if(robots[level.robot]===level.target){const path=[];let k=key;while(parents.get(k)){const p=parents.get(k);path.push(p.action);k=p.prev;}return path.reverse();}for(let r=0;r<3;r++){if(onlyTarget&&r!==level.robot)continue;for(let d=0;d<4;d++){const at=slide(level,robots,r,d);if(at===robots[r])continue;const next=[...robots];next[r]=at;const k=next.join(',');if(!parents.has(k)){parents.set(k,{prev:key,action:[r,d]});queue.push(next);}}}}return null;}
export const LEVELS=[
{robots:[42,6,27],robot:0,target:17,walls:['10:17','15:16','31:38','26:27']},
{robots:[2,45,28],robot:1,target:24,walls:['24:31','8:9','19:20','37:38','12:19']},
{robots:[0,48,30],robot:2,target:12,walls:['12:13','22:29','15:16','32:33','9:16']},
{robots:[43,5,21],robot:0,target:33,walls:['33:40','10:11','16:23','29:30','18:19']},
{robots:[0,47,20],robot:1,target:24,walls:['8:9','11:18','29:36','38:39','16:17']},
{robots:[42,6,34],robot:2,target:17,walls:['15:16','22:29','30:31','39:40','11:12']},
{robots:[1,46,27],robot:0,target:32,walls:['8:15','18:19','23:24','37:38','12:13']},
{robots:[7,41,48],robot:1,target:25,walls:['9:10','16:23','29:30','36:43','11:12']}
];
