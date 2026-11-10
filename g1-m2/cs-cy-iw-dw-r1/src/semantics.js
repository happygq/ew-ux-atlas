/**
 * EW-UX CS–CY–IW–DW / R1 · Pure, deterministic research topology engine.
 * No DOM, timers, randomness, network, or Authority I/O.
 * World: +X East, +Z North, Y up. Grid Z increases North.
 * R1 is a single-floor topological/structural-preview proof, NOT a roof or real
 * door/window mesh and NOT the production WP1.1 authority engine.
 */
export const CONTRACT='ew/ux/cs-cy-iw-dw-r1/v0.1';
export const PALETTE=Object.freeze({PAPER:'#EEEAE0',MIST:'#D8E4DF',SILK:'#EBDCCA',MOUNTAIN:'#D6DCE0'});
export const DIRS=Object.freeze([
  {name:'N',dx:0,dz:1}, {name:'E',dx:1,dz:0},
  {name:'S',dx:0,dz:-1},{name:'W',dx:-1,dz:0}
]);
const clone=v=>JSON.parse(JSON.stringify(v));
export const key=(x,z)=>`${x},${z}`;
const coords=s=>s.split(',').map(Number);
const order=(a,b)=>{const [ax,az]=coords(a),[bx,bz]=coords(b);return az-bz||ax-bx};
export const boundaryKey=(a,b)=>[a,b].sort(order).join('|');
const inside=(s,x,z)=>x>=0&&z>=0&&x<s.width&&z<s.height;
const neighbors=(s,x,z)=>DIRS.map(d=>({d,x:x+d.dx,z:z+d.dz,k:key(x+d.dx,z+d.dz)})).filter(p=>inside(s,p.x,p.z));
export function initialState(width=13,height=11){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<3||height<3||width>64||height>64)throw new RangeError('unsupported grid size');
 return {contract:CONTRACT,width,height,cells:{},edgeFacts:{},history:[],nextId:1};
}
export function applyOperation(state,op){
 if(!state||state.contract!==CONTRACT)throw new Error('invalid state contract');
 if(!op||!['Add','Remove','Recolor'].includes(op.type))throw new RangeError('invalid construction operation');
 if(!Number.isInteger(op.x)||!Number.isInteger(op.z)||!inside(state,op.x,op.z))throw new RangeError('outside buildable grid');
 const pos=key(op.x,op.z),occupied=!!state.cells[pos];
 if(op.type==='Add'&&occupied)throw new Error('cell already occupied');
 if(op.type!=='Add'&&!occupied)throw new Error('cell not occupied');
 if(op.type!=='Remove'&&!Object.hasOwn(PALETTE,op.color))throw new RangeError('invalid BuildColor');
 const next=clone(state),replayOp={type:op.type,x:op.x,z:op.z};
 if(op.type==='Add'){
   next.cells[pos]={id:next.nextId++,x:op.x,z:op.z,color:op.color};
   replayOp.color=op.color;
   for(const n of neighbors(next,op.x,op.z)){
     const other=next.cells[n.k];
     if(other)next.edgeFacts[boundaryKey(pos,n.k)]=other.color===op.color?'OPEN':'PARTITION';
   }
 } else if(op.type==='Recolor'){
   next.cells[pos].color=op.color;
   replayOp.color=op.color;
 } else {
   delete next.cells[pos];
   for(const n of neighbors(next,op.x,op.z))delete next.edgeFacts[boundaryKey(pos,n.k)];
 }
 next.history.push(replayOp);
 return next;
}
export function replay(ops,width=13,height=11){return ops.reduce((s,op)=>applyOperation(s,op),initialState(width,height));}
const asCells=members=>members.map(coords).map(([x,z])=>({x,z}));
const growComponent=(seed,set,state)=>{
 const found=[],q=[seed];set.delete(seed);
 for(let i=0;i<q.length;i++){
  const p=q[i];found.push(p);const [x,z]=coords(p);
  for(const n of neighbors(state,x,z))if(set.has(n.k)){set.delete(n.k);q.push(n.k);}
 }
 return found.sort(order);
};
function components(set,state){const copy=new Set(set),out=[];while(copy.size)out.push(growComponent([...copy].sort(order)[0],copy,state));return out;}
function occupiedBounds(state){
 const cs=Object.values(state.cells);
 if(!cs.length)return null;
 return {minX:Math.min(...cs.map(c=>c.x)),maxX:Math.max(...cs.map(c=>c.x)),minZ:Math.min(...cs.map(c=>c.z)),maxZ:Math.max(...cs.map(c=>c.z))};
}
function inferCourtyards(state){
 const allFree=new Set();for(let z=0;z<state.height;z++)for(let x=0;x<state.width;x++)if(!state.cells[key(x,z)])allFree.add(key(x,z));
 const outside=new Set(),queue=[];
 for(const p of allFree){const [x,z]=coords(p);if(x===0||z===0||x===state.width-1||z===state.height-1){outside.add(p);queue.push(p);}}
 for(let i=0;i<queue.length;i++){
  const [x,z]=coords(queue[i]);for(const n of neighbors(state,x,z))if(allFree.has(n.k)&&!outside.has(n.k)){outside.add(n.k);queue.push(n.k);}
 }
 const enclosed=new Set([...allFree].filter(p=>!outside.has(p)));
 const courts=[];
 for(const members of components(enclosed,state)){
  const cells=asCells(members),area=cells.length;
  courts.push({id:'court:'+members[0],type:area<=4?'SKYWELL':'MAIN_COURT',status:'ENCLOSED',cells,area});
 }
 // Near-enclosed open courts: expose candidates without falsely upgrading the
 // entire external free-space component. Require three distinct occupied-ray
 // directions within 5 modules and position inside the built footprint.
 const bounds=occupiedBounds(state),openSeeds=new Set();
 if(bounds){
  for(const p of outside){const [x,z]=coords(p);
   if(x<=bounds.minX||x>=bounds.maxX||z<=bounds.minZ||z>=bounds.maxZ)continue;
   let covered=0;
   for(const d of DIRS){for(let t=1;t<=5;t++){
     const xx=x+t*d.dx,zz=z+t*d.dz;
     if(!inside(state,xx,zz))break;
     if(state.cells[key(xx,zz)]){covered++;break;}
   }}
   if(covered>=3)openSeeds.add(p);
  }
 }
 for(const members of components(openSeeds,state)){
  if(members.length<1)continue;
  const cells=asCells(members);courts.push({id:'open-court:'+members[0],type:'OPEN_COURT',status:'CANDIDATE',cells,area:members.length});
 }
 return courts.sort((a,b)=>a.id.localeCompare(b.id));
}
function inferRooms(state){
 const all=new Set(Object.keys(state.cells));const seen=new Set();const rooms=[];
 for(const start of [...all].sort(order)){
  if(seen.has(start))continue;
  const q=[start];seen.add(start);
  for(let i=0;i<q.length;i++){
   const a=q[i],c=state.cells[a];
   for(const n of neighbors(state,c.x,c.z)){
    if(!state.cells[n.k]||seen.has(n.k))continue;
    if(state.edgeFacts[boundaryKey(a,n.k)]==='OPEN'){seen.add(n.k);q.push(n.k);}
   }
  }
  const keys=q.sort(order),minId=Math.min(...keys.map(k=>state.cells[k].id));
  rooms.push({id:'room:'+minId,cells:asCells(keys),unitCount:q.length});
 }
 return rooms;
}
function courtType(court,dir){
 if(court.status==='CANDIDATE')return 'PLASTER_TIMBER_HYBRID';
 if(dir==='S')return 'TIMBER_SCREEN';
 if(dir==='N')return 'TIMBER_STONE_BASE';
 if(dir==='E')return 'PLASTER_TIMBER_HYBRID';
 return 'PLASTER_COURT_WALL';
}
function inferWalls(state,courts,rooms){
 const courtByCell=new Map(),roomByCell=new Map(),walls=[],openEdges=[],seen=new Set();
 for(const c of courts)for(const p of c.cells){const k=key(p.x,p.z);if(!courtByCell.has(k)||c.status==='ENCLOSED')courtByCell.set(k,c);}
 for(const r of rooms)for(const p of r.cells)roomByCell.set(key(p.x,p.z),r.id);
 for(const cell of Object.values(state.cells).sort((a,b)=>a.z-b.z||a.x-b.x)){
  const pos=key(cell.x,cell.z);
  for(const d of DIRS){
   const xx=cell.x+d.dx,zz=cell.z+d.dz,other=key(xx,zz),insideGrid=inside(state,xx,zz),shared=insideGrid&&state.cells[other];
   if(shared){
    const edgeId=boundaryKey(pos,other);
    if(seen.has(edgeId))continue;seen.add(edgeId);
    const fact=state.edgeFacts[edgeId];
    if(!['OPEN','PARTITION'].includes(fact))throw new Error('missing persistent boundary fact: '+edgeId);
    if(fact==='OPEN')openEdges.push({edgeId,a:pos,b:other,kind:'OPEN',roomId:roomByCell.get(pos)});
    else walls.push({id:edgeId,x:cell.x,z:cell.z,dir:d.name,kind:'PARTITION',facade:'INTERIOR_PARTITION',other,roomId:roomByCell.get(pos)});
   }else{
    const court=courtByCell.get(other),kind=court?'COURTYARD':'EXTERIOR';
    walls.push({id:`wall:${pos}:${d.name}`,x:cell.x,z:cell.z,dir:d.name,kind,
     courtId:court?.id||null,facade:court?courtType(court,d.name):'PLASTER_OUTER',roomId:roomByCell.get(pos)});
   }
  }
 }
 const doors=[];
 for(const court of courts){
  const candidates=walls.filter(w=>w.courtId===court.id);
  if(!candidates.length)continue;
  const rank={S:0,E:1,W:2,N:3};
  candidates.sort((a,b)=>rank[a.dir]-rank[b.dir]||a.x-b.x||a.z-b.z);
  const selected=candidates[Math.floor(Math.min(2,candidates.length-1)/2)];
  doors.push({id:'intent:'+court.id,wallId:selected.id,kind:'COURT_ENTRY_INTENT',status:'R1_INTENT_ONLY'});
 }
 return {walls,openEdges,doorIntents:doors};
}
export function derive(state){
 const rooms=inferRooms(state),courtyards=inferCourtyards(state);
 const {walls,openEdges,doorIntents}=inferWalls(state,courtyards,rooms);
 const byKind={COURTYARD:0,EXTERIOR:0,PARTITION:0};
 for(const w of walls)byKind[w.kind]++;
 const occupied=Object.keys(state.cells).length;
 return {contract:CONTRACT,rooms,courtyards,walls,openEdges,doorIntents,
  metrics:{units:occupied,rooms:rooms.length,courtyards:courtyards.filter(c=>c.status==='ENCLOSED').length,
   courtyardCandidates:courtyards.filter(c=>c.status==='CANDIDATE').length,
   sharedPartitions:byKind.PARTITION,courtyardFacades:byKind.COURTYARD,openConnections:openEdges.length}};
}
/** Fail closed on malformed persistent boundary facts and unexpected duplicates. */
export function validate(state,model=derive(state)){
 const issues=[],expected=new Set();
 for(const c of Object.values(state.cells))for(const n of neighbors(state,c.x,c.z))if(state.cells[n.k])expected.add(boundaryKey(key(c.x,c.z),n.k));
 if(expected.size!==Object.keys(state.edgeFacts).length)issues.push('boundary-count-mismatch');
 for(const e of expected)if(!['OPEN','PARTITION'].includes(state.edgeFacts[e]))issues.push('invalid-boundary:'+e);
 const occupied=new Set(Object.keys(state.cells));
 for(const court of model.courtyards){for(const p of court.cells)if(occupied.has(key(p.x,p.z)))issues.push('court-occupied');}
 const ids=model.walls.map(w=>w.id);
 if(new Set(ids).size!==ids.length)issues.push('duplicate-wall');
 for(const door of model.doorIntents)if(!ids.includes(door.wallId))issues.push('orphan-door-intent');
 return {ok:!issues.length,issues};
}
