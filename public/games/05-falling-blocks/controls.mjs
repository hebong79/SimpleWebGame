// The same repeat clock is shared by keyboard and touch. Physics advances up to
// each repeat deadline before that action occurs; OS key-repeat is not used.
export function createControls(perform,elapse){let time=0,order=0;const held=new Map();
  const horizontal=()=>[...held].filter(([a])=>a==='left'||a==='right').sort((a,b)=>b[1].order-a[1].order)[0]?.[0];
  function press(action){if(held.has(action))return;held.set(action,{order:++order,next:time+(action==='down'?50:160)});perform(action);}
  function release(action){const previous=horizontal();held.delete(action);const next=horizontal();if(next&&previous!==next)held.get(next).next=time+160;}
  function advance(ms){let end=time+ms;if(!Number.isFinite(ms)||ms<=0)return;while(time<end){const direction=horizontal(),actions=[direction,held.has('down')?'down':null].filter(Boolean);const due=Math.min(end,...actions.map(a=>held.get(a).next));elapse(due-time);time=due;for(const a of actions){const record=held.get(a);if(record&&record.next<=time+1e-7){record.next=time+(a==='down'?50:60);perform(a);}}}}
  return {press,release,advance,reset(){held.clear();time=0;},snapshot(){return {time,held:[...held.keys()],direction:horizontal()??null};}};
}
