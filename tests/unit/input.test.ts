import test from 'node:test';
import assert from 'node:assert/strict';
import { swipeDirection } from '../../public/games/01-2048/input.js';
test('swipe 24 CSS px boundaries, dominant axes and exact tie rejection',()=>{
 for(const [x,y,expected] of [[23,0,null],[24,0,'right'],[0,-24,'up'],[30,10,'right'],[24,24,null],[-24,0,'left'],[0,24,'down'],[20,30,'down'],[-40,-50,'up'],[0,0,null]] as const) assert.equal(swipeDirection(x,y),expected);
});
test('invalid pointer deltas cannot create a direction',()=>{assert.equal(swipeDirection(NaN,30),null);assert.equal(swipeDirection(Infinity,0),null)});
