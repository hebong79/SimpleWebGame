// Original vector drawing code; no imported images, fonts, or game art.
export const PALETTES = Object.freeze({
  basic: { cloth:'#cba77f', hat:'#be9974', bag:'#c8a17e' },
  delivery: { cloth:'#47735c', hat:'#3d6a52', bag:'#c39455' },
  mechanic: { cloth:'#527a9a', hat:'#3d607e', bag:'#947347' },
  chef: { cloth:'#f4eee0', hat:'#fffdf7', bag:'#bf7870' },
});
function round(ctx,x,y,w,h,r,fill,stroke) {
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
}
function ellipse(ctx,x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
export function drawHamster(ctx, x, y, size, equipment, direction='D', pose='walk', frame=0) {
  ctx.save();ctx.translate(x,y);ctx.scale(size/64,size/64);
  const side=direction==='L'||direction==='R', sign=direction==='L'?-1:1, back=direction==='U';
  const bounce=frame?1:0, push=pose==='push';
  ellipse(ctx,0,23,21,6,'#594b3530');
  ctx.translate(0,-bounce);
  if(equipment.bag!=='basic')round(ctx,side?-sign*21:-18,0,side?12:36,23,5,PALETTES[equipment.bag].bag,'#82694d');
  ellipse(ctx,-10,23+(frame?1:0),7,4,'#a58364');ellipse(ctx,10,23-(frame?1:0),7,4,'#a58364');
  ellipse(ctx,0,6,22,23,'#b28e68');ellipse(ctx,0,8,18,20,'#d8b58c');
  if(equipment.workwear!=='basic'){
    round(ctx,-18,5,36,19,6,PALETTES[equipment.workwear].cloth,'#8d785a');
    ctx.fillStyle=equipment.workwear==='chef'?'#b97066':'#e8d7b2';
    ctx.fillRect(-13,5,4,17);ctx.fillRect(9,5,4,17);
    if(!back){round(ctx,-7,11,14,9,2,PALETTES[equipment.workwear].cloth,'#ede2c6');ctx.fillStyle='#e7d8bb';ctx.fillRect(-2,13,4,4);}
  }
  ellipse(ctx,-14,-16,8,9,'#b28e68');ellipse(ctx,14,-16,8,9,'#b28e68');
  ellipse(ctx,-14,-16,4,5,'#dca797');ellipse(ctx,14,-16,4,5,'#dca797');
  ellipse(ctx,0,-6,23,19,'#caa479');
  if(!back){
    if(side){ellipse(ctx,sign*13,1,10,9,'#f1dfbf');ellipse(ctx,sign*13,-8,2.3,3.2,'#3b352c');ellipse(ctx,sign*22,0,2.5,2,'#755245');ellipse(ctx,sign*12,4,4,2.5,'#d7a298');}
    else{ellipse(ctx,-10,2,10,9,'#f1dfbf');ellipse(ctx,10,2,10,9,'#f1dfbf');ellipse(ctx,-8,-7,2.4,3.2,'#3b352c');ellipse(ctx,8,-7,2.4,3.2,'#3b352c');ellipse(ctx,0,0,3,2,'#755245');ctx.strokeStyle='#755245';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(0,2);ctx.lineTo(0,5);ctx.stroke();}
  } else {ellipse(ctx,0,-9,13,9,'#bf9a71');}
  if(equipment.hat==='delivery'||equipment.hat==='mechanic'){
    round(ctx,-20,-25,40,10,5,PALETTES[equipment.hat].hat,'#4d5a42');
    round(ctx,side?sign*9-12:-19,-19,side?26:38,5,3,PALETTES[equipment.hat].hat);
    if(!back){ctx.fillStyle='#f0dbb1';ctx.fillRect(-3,-23,6,4);}
  } else if(equipment.hat==='chef'){
    round(ctx,-16,-28,32,13,4,'#faf8ec','#b8b09c');
    ellipse(ctx,-10,-29,9,7,'#fffef8');ellipse(ctx,1,-32,10,8,'#fffef8');ellipse(ctx,12,-29,8,7,'#fffef8');
  }
  if(push){
    if(side){ellipse(ctx,sign*23,7,6,5,'#d3ae83');}
    else{ellipse(ctx,-21,back?-9:10,5,7,'#d3ae83');ellipse(ctx,21,back?-9:10,5,7,'#d3ae83');}
  } else {ellipse(ctx,-20,9+(frame?2:0),4,6,'#d3ae83');ellipse(ctx,20,9-(frame?2:0),4,6,'#d3ae83');}
  ctx.restore();
}
export function drawBoard(ctx, state, equipment, direction, pose, frame=0) {
  const {board}=state, size=ctx.canvas.width;
  ctx.clearRect(0,0,size,size);ctx.fillStyle='#e9ddc9';ctx.fillRect(0,0,size,size);
  const cell=Math.floor((size-24)/Math.max(board.width,board.height));
  const ox=(size-board.width*cell)/2,oy=(size-board.height*cell)/2;
  ctx.save();ctx.translate(ox,oy);ctx.lineWidth=1;
  for(let y=0;y<board.height;y++)for(let x=0;x<board.width;x++){
    const p=y*board.width+x,xx=x*cell,yy=y*cell;
    if(board.walls.includes(p)){
      round(ctx,xx+2,yy+2,cell-4,cell-4,7,'#9caa90');
      round(ctx,xx+2,yy+2,cell-4,cell-10,6,'#b6c0a6');
      ctx.fillStyle='#cbd2be';ctx.fillRect(xx+9,yy+8,cell-18,3);
      ctx.fillStyle='#99a58c';ctx.fillRect(xx+8,yy+cell-16,cell-16,2);
      if((x+y)%3===0){ctx.fillStyle='#8c9b7c';ctx.fillRect(xx+cell/2-2,yy+12,4,cell-27);}
    }else{
      round(ctx,xx+1,yy+1,cell-2,cell-2,4,(x+y)%2?'#f4e8d1':'#efe0c4','#e2d2b2');
      ctx.fillStyle='#d4c09c';ellipse(ctx,xx+7,yy+8,1.2,1.2,'#d4c09c');
      if(board.goals.includes(p)){
        ctx.save();ctx.strokeStyle='#557950';ctx.lineWidth=2;ctx.setLineDash([5,4]);round(ctx,xx+8,yy+8,cell-16,cell-16,8,null,'#557950');ctx.restore();
        ellipse(ctx,xx+cell/2,yy+cell/2,8,8,'#c2cfab');ctx.fillStyle='#f8f3df';ctx.fillRect(xx+cell/2-4,yy+cell/2-1,8,2);ctx.fillRect(xx+cell/2-1,yy+cell/2-4,2,8);
      }
    }
  }
  for(const p of state.boxes){
    const x=p%board.width*cell,y=Math.floor(p/board.width)*cell,done=board.goals.includes(p);
    round(ctx,x+8,y+10,cell-16,cell-16,7,'#71573d35');
    round(ctx,x+7,y+6,cell-14,cell-15,6,done?'#7f9b70':'#cd995b',done?'#476a40':'#a97840');
    round(ctx,x+9,y+8,cell-18,cell-23,4,done?'#9bb789':'#dfb77d');
    ctx.fillStyle=done?'#d2ddbb':'#f0d29f';ctx.fillRect(x+cell/2-5,y+8,10,cell-23);
    round(ctx,x+cell/2-12,y+cell/2-8,24,18,3,'#fff8e3');
    ctx.fillStyle=done?'#476a40':'#8f693f';ctx.font=`bold ${Math.max(12,cell*.23)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(done?'✓':'H',x+cell/2,y+cell/2+1);
    if(done){ctx.strokeStyle='#e5ecd4';ctx.lineWidth=2;round(ctx,x+4,y+3,cell-8,cell-10,8,null,'#eef1d7');}
  }
  const px=(state.player%board.width+.5)*cell,py=(Math.floor(state.player/board.width)+.5)*cell;
  drawHamster(ctx,px,py,cell*.88,equipment,direction,pose,frame);
  ctx.restore();
}
export function drawPreview(ctx, equipment, direction, pose, frame=0) {
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
  round(ctx,18,127,204,24,12,'#e4d4b6');
  ctx.save();ctx.setLineDash([4,4]);round(ctx,65,117,110,38,12,null,'#b9bc99');ctx.restore();
  drawHamster(ctx,120,97,112,equipment,direction,pose,frame);
}
