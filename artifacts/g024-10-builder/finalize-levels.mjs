import { drafts } from './design-levels.mjs';
import {solve} from './solve-levels.mjs';
import {writeFileSync}from'node:fs';
const edits = {
12: ['########','# .  # #','# #    #','#  $ $ #','# #  #.#','#   @  #','#      #','########'],
19: ['########','# . # .#','#   #  #','# $  $ #','## #   #','#  $   #','# @ .  #','########'],
20: ['########','# .  # #','# # .  #','# $ #  #','#   $  #','# .$   #','#  @   #','########'],
};
for (const [id,rows] of Object.entries(edits)) {drafts[+id-1][2]=rows;console.log(id,solve(rows));}
// Curriculum: teach turning before longer route, then shelf access before mixed goals.
[drafts[3],drafts[4]]=[drafts[4],drafts[3]];
[drafts[9],drafts[10]]=[drafts[10],drafts[9]];
const verified=drafts.map(([name,hint,rows],i)=>({id:i+1,name,hint,rows,...solve(rows)}));
writeFileSync(new URL('./level-verification-final.json',import.meta.url),JSON.stringify(verified,null,2));
writeFileSync(new URL('../../public/games/10-sokoban/levels.mjs',import.meta.url),`// Original Hamster Depot layouts. See implementation provenance and offline solver.\nconst definitions = ${JSON.stringify(verified.map(({visited,...r})=>r),null,2)};\nexport const LEVELS = Object.freeze(definitions.map(level => Object.freeze({...level, rows:Object.freeze(level.rows)})));\n`);
console.log(verified.map(r=>({id:r.id,pushes:r.pushes,moves:r.moves,solved:!!r.solution})));
