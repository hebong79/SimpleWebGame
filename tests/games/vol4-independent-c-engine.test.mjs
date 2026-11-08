import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as R from '../../public/games/76-ricochet-robots/engine.mjs';
import * as O from '../../public/games/77-onitama/engine.mjs';
import * as H from '../../public/games/78-hanabi/engine.mjs';
import * as L from '../../public/games/79-love-letter/engine.mjs';
import * as C from '../../public/games/80-cant-stop/engine.mjs';
const evidence='artifacts/g034-qa-c';
fs.mkdirSync(evidence,{recursive:true});
const copy=structuredClone;
const vector=[[-1,0],[0,1],[1,0],[0,-1]];
// Independent coordinate oracle: no production slide/edge/solve calls.
function robotEnd(level,positions,who,d){
  let row=Math.floor(positions[who]/7),col=positions[who]%7;
  for(let steps=0;steps<7;steps++){
    const nr=row+vector[d][0],nc=col+vector[d][1];
    if(nr<0||nr>=7||nc<0||nc>=7)break;
    const a=row*7+col,b=nr*7+nc;
    if(positions.some((v,i)=>i!==who&&v===b)||level.walls.some(w=>{const[x,y]=w.split(':').map(Number);return x===a&&y===b||x===b&&y===a;}))break;
    row=nr;col=nc;
  }
  return row*7+col;
}
function independentSearch(level,only=false){
  const queue=[[...level.robots]],memo=new Map([[level.robots.join(','),null]]);
  for(let head=0;head<queue.length;head++){
    const pos=queue[head],k=pos.join(',');
    if(pos[level.robot]===level.target){const path=[];let at=k;while(memo.get(at)){const p=memo.get(at);path.push(p.action);at=p.parent;}return{path:path.reverse(),states:memo.size};}
    for(const who of only?[level.robot]:[0,1,2])for(let d=0;d<4;d++){
      const end=robotEnd(level,pos,who,d);if(end===pos[who])continue;
      const next=[...pos];next[who]=end;const nk=next.join(',');
      if(!memo.has(nk)){memo.set(nk,{parent:k,action:[who,d]});queue.push(next);}
    }
  }
  return{path:null,states:memo.size};
}
const witnesses=[];
test('76: eight independent BFS witnesses replay through real move; last four need other robots',()=>{
  assert.equal(R.LEVELS.length,8);assert.equal(new Set(R.LEVELS.map(x=>JSON.stringify(x))).size,8);
  R.LEVELS.forEach((level,i)=>{
    assert.equal(level.robots.length,3);assert.equal(new Set(level.robots).size,3);assert.ok(level.walls.length);
    const found=independentSearch(level);assert.ok(found.path?.length>0,`level ${i+1}`);
    let s=R.createState(level);
    for(const[r,d]of found.path){const old=copy(s),end=robotEnd(level,s.robots,r,d);const n=R.move(level,s,r,d);assert.deepEqual(s,old);assert.equal(n.robots[r],end);assert.equal(n.moves,s.moves+1);s=n;}
    assert.equal(s.won,true);assert.equal(s.robots[level.robot],level.target);
    const solo=independentSearch(level,true);if(i>=4)assert.equal(solo.path,null);
    witnesses.push({level:i+1,...found,soloReachable:solo.path!==null});
  });
  fs.writeFileSync(`${evidence}/76-independent-witnesses.json`,JSON.stringify(witnesses,null,2));
});
test('76: target traversal is not completion, robot blocks, walls symmetric, no-op exact identity',()=>{
  const lev={robots:[0,48,42],robot:0,target:3,walls:['2:9']};
  let s=R.createState(lev);s=R.move(lev,s,0,1);assert.equal(s.robots[0],6);assert.equal(s.won,false);
  const blocked={...lev,robots:[1,2,48]};s=R.createState(blocked);assert.equal(R.move(blocked,s,0,1),s);
  for(const pos of [[2,47,48],[9,47,48]])for(const d of [0,2])assert.equal(R.slide(lev,pos,0,d),robotEnd(lev,pos,0,d));
  assert.equal(R.move(lev,s,8,0),s);
});
function legalOracle(s,slot,index){
  const unit=s.pieces[index];if(s.result||!unit||unit.p!==s.turn||![0,1].includes(slot))return[];
  const steps=O.CARDS[s.cards[s.turn][slot]].steps;
  return steps.map(([dy,dx])=>[Math.floor(unit.at/5)+(s.turn? -dy:dy),unit.at%5+(s.turn?-dx:dx)])
    .filter(([r,c])=>r>=0&&r<5&&c>=0&&c<5)
    .map(([r,c])=>r*5+c).filter(v=>!s.pieces.some(q=>q.p===s.turn&&q.at===v));
}
test('77: all card shapes/sets, independent forward coordinates and legal game transitions',()=>{
  assert.equal(O.CARDS.length,8);assert.equal(new Set(O.CARDS.map(c=>JSON.stringify([...c.steps].sort()))).size,8);assert.equal(O.SETS.length,3);
  for(let set=0;set<3;set++){
    assert.equal(new Set(O.SETS[set]).size,5);let s=O.createState(set);
    assert.deepEqual([0,1].map(p=>s.pieces.filter(q=>q.p===p&&q.master).length),[1,1]);
    const supply=[...s.cards.flat(),s.common].sort();
    for(let k=0;k<60&&!s.result;k++){
      const candidates=[];
      for(let i=0;i<s.pieces.length;i++)for(let slot=0;slot<2;slot++){
        const expected=legalOracle(s,slot,i);assert.deepEqual(O.legal(s,slot,i),expected);
        expected.forEach(to=>candidates.push({piece:i,card:slot,to}));
      }
      const a=candidates.length?candidates[(k*13+set)%candidates.length]:{card:1,pass:true};
      const old=copy(s),used=s.cards[s.turn][a.card],center=s.common,p=s.turn;
      const next=O.act(s,a);assert.notEqual(next,s);assert.deepEqual(s,old);
      assert.equal(next.common,used);assert.equal(next.cards[p][a.card],center);assert.equal(next.turn,1-p);
      assert.deepEqual([...next.cards.flat(),next.common].sort(),supply);s=next;
    }
    assert.ok(s.result);
  }
});
test('77: asymmetric card reverses both axes, impossible movement exchanges card only; illegal pass no-op',()=>{
  for(const turn of [0,1]){const s=O.createState();s.turn=turn;s.pieces=[{p:turn,master:true,at:12}];s.cards[turn]=[7,0];assert.deepEqual(O.legal(s,0,0).sort((a,b)=>a-b),(turn===0?[1,13,16]:[8,11,23]).sort((a,b)=>a-b));}
  const s=O.createState();assert.equal(O.act(s,{card:0,pass:true}),s);
  const trapped={pieces:[{p:0,master:true,at:0},{p:1,master:true,at:24}],cards:[[2,2],[0,1]],common:4,turn:0,turns:59,result:null};
  // Card 2 can move right, so fill its one in-bounds target with own unit.
  trapped.pieces.push({p:0,master:false,at:1});
  trapped.pieces.push(...[2,3,4].map(at=>({p:0,master:false,at})));
  assert.equal(O.allMoves(trapped).length,0);
  const n=O.act(trapped,{card:1,pass:true});assert.deepEqual(n.pieces,trapped.pieces);assert.equal(n.common,2);assert.equal(n.cards[0][1],4);assert.equal(n.turns,60);assert.equal(n.result.winner,null);
});
test('77: master-only temple victory and capture, friendly occupancy immutable',()=>{
  const fixture=master=>({pieces:[{p:0,master,at:7},{p:1,master:true,at:24}],cards:[[0,1],[2,3]],common:4,turn:0,turns:0,result:null});
  assert.equal(O.act(fixture(true),{piece:0,card:0,to:2}).result.winner,0);
  assert.equal(O.act(fixture(false),{piece:0,card:0,to:2}).result,null);
  const s=fixture(true);s.pieces[1].at=2;assert.equal(O.act(s,{piece:0,card:0,to:2}).result.reason,'사범 포획');
  s.pieces[1].p=0;assert.equal(O.act(s,{piece:0,card:0,to:2}),s);
});
const hc=(color,n)=>({color,n,hints:{colors:{},numbers:{}}});
test('78: deck multiplicities, all matching and nonmatching hint locations; invalid hint atomic',()=>{
  assert.equal(H.deck().length,18);
  for(let color=0;color<3;color++)for(let n=1;n<=3;n++)assert.equal(H.deck().filter(c=>c.color===color&&c.n===n).length,4-n);
  const s=H.createState(()=>0.3);s.hands[1]=[hc(1,1),hc(1,2),hc(2,1)];
  const n=H.act(s,{type:'hint',kind:'color',value:1});assert.deepEqual(n.hands[1].map(c=>c.hints.colors[1]),[true,true,false]);assert.equal(n.hints,3);
  assert.equal(H.act(s,{type:'hint',kind:'color',value:0}),s);
  s.hints=0;assert.equal(H.act(s,{type:'hint',kind:'number',value:1}),s);
});
test('78: exact two final turns after last draw, hints consume final turns, 2 failures and 9 immediate',()=>{
  const s=H.createState(()=>0.1);s.deck=[hc(2,3)];
  let n=H.act(s,{type:'discard',index:0});assert.equal(n.finalRemaining,2);assert.equal(n.result,null);assert.equal(n.turn,1);
  n=H.act(n,{type:'hint',kind:'number',value:n.hands[0][0].n});assert.equal(n.finalRemaining,1);assert.equal(n.result,null);assert.equal(n.turn,0);
  n=H.act(n,{type:'discard',index:0});assert.equal(n.finalRemaining,0);assert.match(n.result.reason,/마지막/);
  const bad=H.createState();bad.hands[0][0]=hc(0,3);bad.failures=1;assert.equal(H.act(bad,{type:'play',index:0}).result.reason,'실패표 2개');
  const win=H.createState();win.stacks=[3,3,2];win.hands[0][0]=hc(2,3);assert.equal(H.act(win,{type:'play',index:0}).result.score,9);
});
test('78: public views never expose own values; curtain exposes neither hand; hints retained only for current owner',()=>{
  const s=H.createState(()=>0.4);s.hands[0][0].hints.numbers[2]=false;
  for(const p of [0,1]){s.turn=p;const v=H.view(s,true);for(const c of v.hands[p]){assert.equal('color'in c,false);assert.equal('n'in c,false);assert.equal(c.back,true);}assert.ok(v.hands[1-p].every(c=>Number.isInteger(c.n)));}
  assert.ok(H.view(s,false).hands.flat().every(c=>!('color'in c)&&!('n'in c)));assert.equal('deck'in H.view(s,true),false);
});
function llFixture(value,opponent=2){return{deck:[4,1],removed:3,hands:[[value,4],[opponent]],turn:0,turns:0,protected:[false,false],discards:[[],[]],scores:[0,0],round:1,result:null,peek:null,pending:false,last:''};}
test('79: protection blocks both effects and expires precisely when protected player next becomes active',()=>{
  for(const value of [1,2]){const s=llFixture(value);s.protected[1]=true;const n=L.act(s,0,2);assert.equal(n.result,null);assert.equal(n.peek,null);assert.equal(n.pending,false);assert.equal(n.turn,1);assert.equal(n.protected[1],false);}
  let s=L.act(llFixture(3),0);assert.equal(s.protected[0],true);assert.equal(s.turn,1);s=L.act(s,1,3);assert.equal(s.protected[0],false);assert.equal(s.turn,0);
});
test('79: private peek belongs only to current viewer, acknowledgement removes it, excluded card never public',()=>{
  let s=L.act(llFixture(2,3),0);assert.equal(s.pending,true);assert.equal(s.turn,0);assert.equal(L.view(s,true).peek,3);assert.equal(L.view(s,false).peek,null);
  assert.equal('removed'in L.view(s,true),false);assert.equal('deck'in L.view(s,true),false);assert.deepEqual(L.view(s,true).hands[1],[null]);
  assert.equal(L.act(s,0,3),s);s=L.acknowledge(s);assert.equal(s.turn,1);assert.equal(s.peek,null);assert.equal(L.view(s,true).peek,null);
});
test('79: 10-card supply, no win for tie; match needs three wins rather than three rounds',()=>{
  assert.deepEqual(L.VALUES,[1,1,1,1,2,2,2,3,3,4]);
  const s=L.createState(()=>0.2);assert.deepEqual([...s.deck,...s.hands.flat(),s.removed].sort(),L.VALUES);
  const tie=llFixture(4,2);tie.deck=[];tie.hands[0]=[4,2];tie.round=3;
  const draw=L.act(tie,0);assert.equal(draw.result.winner,null);assert.deepEqual(draw.scores,[0,0]);assert.equal(draw.result.matchWinner,-1);assert.equal(L.nextRound(draw).round,4);
  const third=llFixture(1,2);third.scores=[2,0];third.round=7;const won=L.act(third,0,2);assert.equal(won.result.matchWinner,0);assert.deepEqual(won.scores,[3,0]);assert.equal(L.nextRound(won),won);
});
function pairOracle(s,pair){const expected=copy(s.temp),moved=[];for(const sum of pair){const lane=sum-2;if(s.claimed[lane]!==null)continue;let start=Object.hasOwn(expected,lane)?expected[lane]:s.saved[s.turn][lane];if(!Object.hasOwn(expected,lane)&&Object.keys(expected).length===3)continue;if(start<C.LENGTHS[lane]){expected[lane]=start+1;moved.push(lane);}}return{temp:expected,moved};}
test('80: independent exhaustive 1,296 rolls × four marker configurations × three pairs × both orders',()=>{
  assert.deepEqual(C.LENGTHS,[3,5,7,9,11,13,11,9,7,5,3]);
  for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)for(let d=1;d<=6;d++){
    const dice=[a,b,c,d],pairs=[[a+b,c+d],[a+c,b+d],[a+d,b+c]];assert.deepEqual(C.sums(dice),pairs);
    for(const temp of [{},{0:1,3:2},{0:1,3:2,6:4},{5:12,10:2}]){
      const s=C.createState();s.temp=copy(temp);s.saved[0][2]=2;s.claimed[9]=1;
      for(const p of pairs)for(const pair of [p,[...p].reverse()])assert.deepEqual(C.applyPair(s,pair),pairOracle(s,pair));
    }
  }
});
test('80: doubles advance twice, fourth marker rejected, bust preserves all saved and bank claims three',()=>{
  let s=C.createState();let n=C.choose(C.roll(s,undefined,[1,1,1,1]),0);assert.equal(n.temp[0],2);assert.equal(n.phase,'decide');assert.equal(C.choose(n,0),n);
  s.temp={0:1,1:1,2:1};s.saved[0][5]=4;const expected=copy(s.saved);n=C.roll(s,undefined,[6,6,6,6]);assert.deepEqual(n.saved,expected);assert.deepEqual(n.temp,{});assert.equal(n.turn,1);
  s=C.createState();s.phase='decide';s.claimed[0]=0;s.claimed[1]=0;s.saved[0][0]=3;s.saved[0][1]=5;s.temp={2:7};n=C.bank(s);assert.equal(n.result.winner,0);assert.equal(n.saved[0][2],7);assert.equal(n.claimed[2],0);
});
