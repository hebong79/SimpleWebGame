export const TYPES = ['단추','구슬','블록','팽이','별','조각','공','상자','인형','기차','쿠션','북'];
export const SIZES = [8,10,12,14,18,22,26,28,32,36,42,48];
export function create(room=0) {
  const positions=[[125,100],[220,80],[340,90],[450,110],[490,220],[430,310],[320,330],[200,300],[105,250],[180,190],[320,200],[410,230]];
  return {room:room%2,x:70,y:70,diameter:20,time:75,elapsed:0,collected:0,won:false,lost:false,blocked:false,objects:positions.flatMap(([x,y],i)=>[0,1].map(copy=>({id:i*2+copy,type:TYPES[i],size:SIZES[i],growth:copy?1:4,x:room?600-x-copy*28:x+copy*28,y:room?420-y-copy*22:y+copy*22,taken:false})))};
}
export function collect(s,o) { if(o.taken || o.size>s.diameter*.8+1e-9)return false; o.taken=true;s.diameter+=o.growth;s.collected++;return true; }
export function tick(s,dt,input={}) {
  if(s.won||s.lost||!Number.isFinite(dt)||dt<=0)return;
  let remaining=Math.min(dt,s.time);
  while(remaining>1e-9&&!s.won){const t=Math.min(.02,remaining);remaining-=t;s.elapsed+=t;s.time=Math.max(0,75-s.elapsed);
    let dx=Number(input.right||0)-Number(input.left||0),dy=Number(input.down||0)-Number(input.up||0);const n=Math.hypot(dx,dy)||1;
    let x=Math.max(s.diameter/2,Math.min(600-s.diameter/2,s.x+dx/n*150*t)),y=Math.max(s.diameter/2,Math.min(420-s.diameter/2,s.y+dy/n*150*t));s.blocked=false;
    for(const o of s.objects){if(o.taken)continue;if(Math.hypot(x-o.x,y-o.y)<=(s.diameter+o.size)/2){if(!collect(s,o)){x=s.x;y=s.y;s.blocked=true;}}}
    s.x=x;s.y=y;if(s.diameter>=65)s.won=true;
  }
  if(!s.won&&s.time<=1e-8){s.time=0;s.lost=true;}
}
