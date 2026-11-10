import {PALETTE,DIRS,key} from './semantics.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colorLabel={PAPER:'宣纸白',MIST:'雾青',SILK:'暖绢',MOUNTAIN:'远山灰'};
const FACADES={
 PLASTER_OUTER:['#efece3','#b0a99c'],
 TIMBER_SCREEN:['#c7a990','#624b3d'],
 TIMBER_STONE_BASE:['#c5b5a0','#6f5849'],
 PLASTER_TIMBER_HYBRID:['#e1d8c9','#887361'],
 PLASTER_COURT_WALL:['#ecebe2','#9f9687'],
 INTERIOR_PARTITION:['#e9e2d8','#77634e']
};
const COURT_COLOR={'ENCLOSED':'#cfded3','CANDIDATE':'#e6e3c8'};
const SEQUENCES={N:[[0,1],[1,1]],E:[[1,0],[1,1]],S:[[0,0],[1,0]],W:[[0,0],[0,1]]};
const strokeFor={EXTERIOR:'#625a50',COURTYARD:'#8e694c',PARTITION:'#464e46'};
export function buildPlanSvg(state,model,{construction=true,selected=null}={}){
 const S=38,p=14,W=state.width*S+2*p,H=state.height*S+2*p;
 const px=x=>p+x*S,py=z=>p+(state.height-1-z)*S;
 let out=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="可点击的建筑建造平面图"><rect width="${W}" height="${H}" fill="#f4efe6"/>`;
 for(let z=0;z<state.height;z++)for(let x=0;x<state.width;x++){
  out+=`<rect x="${px(x)}" y="${py(z)}" width="${S}" height="${S}" fill="none" stroke="#e6dccc" stroke-width=".7"/>`;
 }
 for(const court of model.courtyards)for(const c of court.cells){out+=`<rect x="${px(c.x)+1}" y="${py(c.z)+1}" width="${S-2}" height="${S-2}" fill="${COURT_COLOR[court.status]}" opacity=".98"/>`;
  out+=`<circle cx="${px(c.x)+S/2}" cy="${py(c.z)+S/2}" r="2.4" fill="${court.status==='ENCLOSED'?'#81a993':'#bbab75'}" opacity=".7"/>`;
 }
 for(const cell of Object.values(state.cells)){
  const base=construction?PALETTE[cell.color]:'#f1ece1';
  out+=`<rect x="${px(cell.x)+1}" y="${py(cell.z)+1}" width="${S-2}" height="${S-2}" rx="1.5" fill="${base}"/>`;
  if(construction)out+=`<rect x="${px(cell.x)+5}" y="${py(cell.z)+5}" width="8" height="8" rx="2" fill="${PALETTE[cell.color]}" stroke="#746a5b" stroke-width="1.2"/>`;
  if(construction)out+=`<text x="${px(cell.x)+S/2}" y="${py(cell.z)+S/2+4}" font-size="10" font-family="system-ui" fill="#625b52" text-anchor="middle">${cell.id}</text>`;
 }
 for(const w of model.walls){
  const [[ax,az],[bx,bz]]=SEQUENCES[w.dir];
  const P={x1:px(w.x+ax),y1:py(w.z+az)+S,x2:px(w.x+bx),y2:py(w.z+bz)+S};
  const color=w.kind==='COURTYARD'?(w.facade==='PLASTER_COURT_WALL'?'#899286':'#8d6e53'):strokeFor[w.kind];
  const dash=w.kind==='COURTYARD'?'':'',width=w.kind==='PARTITION'?4:3;
  out+=`<line x1="${P.x1}" y1="${P.y1}" x2="${P.x2}" y2="${P.y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${dash}/>`;
 }
 // Explicit openings / connection facts, not inferred from final BuildColor.
 for(const edge of model.openEdges){const [a,b]=[edge.a,edge.b].map(s=>s.split(',').map(Number)),x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
  let cx,cy;if(a[0]!==b[0]){cx=px(Math.max(a[0],b[0]));cy=py(a[1])+S/2;}else{cx=px(a[0])+S/2;cy=py(Math.min(a[1],b[1]));}
  out+=`<circle cx="${cx}" cy="${cy}" r="4" fill="#6eaa8f" stroke="#faf9f2" stroke-width="1.5"/>`;
 }
 for(const d of model.doorIntents){const w=model.walls.find(w=>w.id===d.wallId);if(!w)continue;
  const anchor=w.dir==='N'?[px(w.x)+S/2,py(w.z)]:w.dir==='S'?[px(w.x)+S/2,py(w.z)+S]:w.dir==='E'?[px(w.x)+S,py(w.z)+S/2]:[px(w.x),py(w.z)+S/2];
  out+=`<circle cx="${anchor[0]}" cy="${anchor[1]}" r="6" fill="#b88a46" stroke="#fff5e4" stroke-width="1.5"/><circle cx="${anchor[0]}" cy="${anchor[1]}" r="2" fill="#fff"/>`;
 }
 const selectKey=selected?key(selected.x,selected.z):null;
 if(selectKey&&state.cells[selectKey])out+=`<rect x="${px(selected.x)+2}" y="${py(selected.z)+2}" width="${S-4}" height="${S-4}" fill="none" stroke="#b27b3e" stroke-width="3"/>`;
 for(let z=0;z<state.height;z++)for(let x=0;x<state.width;x++){
  out+=`<rect data-x="${x}" data-z="${z}" x="${px(x)}" y="${py(z)}" width="${S}" height="${S}" fill="transparent" style="cursor:crosshair" tabindex="0"><title>${x},${z}${state.cells[key(x,z)]?' · '+colorLabel[state.cells[key(x,z)].color]:' · 空地'}</title></rect>`;
 }
 out+=`<g transform="translate(${W-38},35)" font-size="12" font-weight="700" text-anchor="middle"><path d="M0 -25 L-7 -11 L0 -16 L7 -11Z" fill="#a44e42"/><text y="-29" fill="#8a463a">N</text></g>`;
 out+='</svg>';return out;
}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function renderIsometric(canvas,state,model,{construction=false}={}){
 if(!canvas)return;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
 const dpr=Math.min(2,window.devicePixelRatio||1),W=Math.round(rect.width*dpr),H=Math.round(rect.height*dpr);
 if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}
 const ctx=canvas.getContext('2d');if(!ctx)return;
 ctx.setTransform(dpr,0,0,dpr,0,0);const cw=W/dpr,ch=H/dpr;
 const bg=ctx.createLinearGradient(0,0,0,ch);bg.addColorStop(0,'#f8f4eb');bg.addColorStop(1,'#e6dace');ctx.fillStyle=bg;ctx.fillRect(0,0,cw,ch);
 const T=clamp(Math.min(cw/(state.width*.83+3),ch/(state.height*.39+4))*1.55,17,46),tw=T,th=T*.48,wallHeight=T*.78;
 const originX=cw/2,originY=ch*.20;
 const p=(x,z,y=0)=>[originX+(x-z)*tw*.5,originY+(x+z)*th*.5-y*wallHeight];
 const poly=(points,fill,stroke=null,lineWidth=1)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();}};
 // Ground tiles and courtyard stones are actual topology-derived footprints.
 for(let z=0;z<state.height;z++)for(let x=0;x<state.width;x++){
  const court=model.courtyards.find(c=>c.cells.some(v=>v.x===x&&v.z===z));
  poly([p(x,z),p(x+1,z),p(x+1,z+1),p(x,z+1)],court?(court.status==='ENCLOSED'?'#cbd9cd':'#e0dec6'):'#efe8db','#e0d7c8',.7);
  if(court&&((x+z)%2===0)){const center=p(x+.5,z+.5,.018);ctx.fillStyle='#98aca1';ctx.beginPath();ctx.arc(...center,1.7,0,2*Math.PI);ctx.fill();}
 }
 const cells=Object.values(state.cells).sort((a,b)=>a.x+a.z-(b.x+b.z));
 for(const cell of cells){
  const x=cell.x,z=cell.z,base=construction?PALETTE[cell.color]:'#eee8dd';
  poly([p(x,z,0),p(x+1,z,0),p(x+1,z+1,0),p(x,z+1,0)],base,'#b0a59a',.7);
 }
 // Painter: walls nearest the far (northwest) side first, with low cutaway height.
 const WALL={N:[[0,1],[1,1]],E:[[1,0],[1,1]],S:[[0,0],[1,0]],W:[[0,0],[0,1]]};
 const walls=model.walls.toSorted((a,b)=>a.x+a.z-(b.x+b.z)||a.kind.localeCompare(b.kind));
 const intentSet=new Set(model.doorIntents.map(d=>d.wallId));
 for(const w of walls){
  const [[dx1,dz1],[dx2,dz2]]=WALL[w.dir],a=[w.x+dx1,w.z+dz1],b=[w.x+dx2,w.z+dz2],mat=FACADES[w.facade]||FACADES.PLASTER_OUTER;
  const heights=w.kind==='PARTITION'?.69:.94;
  const A=p(...a,0),B=p(...b,0),AT=p(...a,heights),BT=p(...b,heights);
  poly([A,B,BT,AT],mat[0],mat[1],1.0);
  const lower1=p(...a,heights*.22),lower2=p(...b,heights*.22);
  if(w.kind==='COURTYARD'){poly([A,B,lower2,lower1],'#989892','#797b78',.55);}
  const line=(q1,q2,color,width)=>{ctx.beginPath();ctx.moveTo(...q1);ctx.lineTo(...q2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();};
  line(AT,BT,mat[1],2.2);line(A,AT,mat[1],1.8);line(B,BT,mat[1],1.8);
  if(w.facade==='TIMBER_SCREEN'||w.facade==='TIMBER_STONE_BASE'||w.facade==='PLASTER_TIMBER_HYBRID'){
   for(const t of [.25,.5,.75]){
    const xx=a[0]+(b[0]-a[0])*t,zz=a[1]+(b[1]-a[1])*t;
    line(p(xx,zz,.24),p(xx,zz,heights*.92),mat[1],w.facade==='TIMBER_SCREEN'?1.6:.9);
   }
   if(w.facade==='TIMBER_SCREEN')for(const ht of [.52,.72])line(p(...a,ht),p(...b,ht),mat[1],1);
  }
  if(intentSet.has(w.id)){
   // R1 door intention is an overlay only. R2 must make a true hole.
   const t1=.38,t2=.62,q=(t,y)=>p(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,y);
   poly([q(t1,.22),q(t2,.22),q(t2,.70),q(t1,.70)],'#9a79554f','#a87743',1.4);
  }
 }
 const count=model.metrics.units,courtCount=model.metrics.courtyards;
 ctx.fillStyle='#455b51';ctx.font='600 12px system-ui';ctx.fillText('OPEN-ROOF STRUCTURAL STUDY · R1',17,23);
 ctx.font='11px system-ui';ctx.fillStyle='#7c7569';ctx.fillText(`${count} 单元  ·  ${courtCount} 个封闭院  ·  门洞仅为意图标记`,17,43);
}
