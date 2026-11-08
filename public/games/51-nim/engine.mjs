export function initial(practice=false,first=0){return {piles:practice?[1,2,3]:[3,5,7],turn:first,turns:0,winner:null};}
export function take(state,pile,count){
 if(state.winner!==null||!Number.isInteger(pile)||pile<0||pile>2||!Number.isInteger(count)||count<1||count>state.piles[pile])return {ok:false,state};
 const next={...state,piles:[...state.piles],turns:state.turns+1}; next.piles[pile]-=count;
 if(next.piles.every(v=>v===0))next.winner=state.turn;else next.turn=1-state.turn;
 return {ok:true,state:next};
}
