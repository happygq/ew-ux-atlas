/**
 * EW-UX R2-V v0.1, isolated three-level *semantic* prototype.
 * Coordinates: +X east, +Z north, level 0..levels-1; no 3D mesh or structural certification.
 * User operations remain Add / Recolor / Remove; test 'ExpectReject' is not an operation.
 */
export const CONTRACT = 'ew/ux/r2-vertical-semantics/candidate-v0.1';
export const COLORS = Object.freeze(['PAPER','MIST','SILK','MOUNTAIN']);
const DIRS = Object.freeze([[1,0],[-1,0],[0,1],[0,-1]]);
export const key = (x,z,level) => `${level}:${x},${z}`;
const clone = o => JSON.parse(JSON.stringify(o));
const order = (a,b) => a.level-b.level||a.z-b.z||a.x-b.x;
const edgeKey = (a,b) => [a,b].sort().join('|');
const has = (s,x,z,l) => s.cells[key(x,z,l)];
const inside = (s,x,z,l) => Number.isInteger(x)&&Number.isInteger(z)&&Number.isInteger(l)&&x>=0&&x<s.width&&z>=0&&z<s.height&&l>=0&&l<s.levels;
const adjacent = (s,c) => DIRS.map(([dx,dz])=>[c.x+dx,c.z+dz]).filter(([x,z])=>inside(s,x,z,c.level));
const fail = (code) => {const e=new Error(code);e.code=code;throw e;};
export function initialState(width=11,height=11,levels=3){
 if(!Number.isInteger(width)||!Number.isInteger(height)||!Number.isInteger(levels)||width<3||height<3||width>32||height>32||levels<2||levels>3)fail('INVALID_GRID');
 return {contract:CONTRACT,width,height,levels,cells:{},edges:{},history:[],nextId:1};
}
/** One-bay bridge is a *semantic support candidate*, not a verified beam/span. */
export function supportFor(s,c){
 if(c.level===0)return {mode:'GROUND',sources:[],verifiedGeometry:false};
 const l=c.level-1,below=has(s,c.x,c.z,l);
 if(below)return {mode:'DIRECT',sources:[key(c.x,c.z,l)],verifiedGeometry:false};
 for(const [dx,dz,label] of [[1,0,'ONE_BAY_BRIDGE_EW'],[0,1,'ONE_BAY_BRIDGE_NS']]){
  const a=has(s,c.x-dx,c.z-dz,l),b=has(s,c.x+dx,c.z+dz,l);
  if(a&&b)return {mode:label,sources:[key(a.x,a.z,l),key(b.x,b.z,l)].sort(),verifiedGeometry:false};
 }
 return null;
}
export function apply(state,op){
 if(!state||state.contract!==CONTRACT)fail('BAD_CONTRACT');
 if(!op||!['Add','Recolor','Remove'].includes(op.type))fail('BAD_OPERATION');
 const {x,z,level}=op;
 if(!inside(state,x,z,level))fail('INVALID_POSITION');
 const k=key(x,z,level),present=!!state.cells[k];
 if(op.type==='Add'&&present)fail('OCCUPIED');
 if(op.type!=='Add'&&!present)fail('NOT_OCCUPIED');
 if(op.type!=='Remove'&&!COLORS.includes(op.color))fail('INVALID_COLOR');
 const s=clone(state),log={type:op.type,x,z,level};
 if(op.type==='Add'){
  const cell={id:s.nextId++,x,z,level,color:op.color};s.cells[k]=cell;
  if(!supportFor(s,cell))fail('UNSUPPORTED_ADD');
  for(const [nx,nz] of adjacent(s,cell)){
   const n=has(s,nx,nz,level);
   if(n)s.edges[edgeKey(k,key(nx,nz,level))]=n.color===cell.color?'OPEN':'PARTITION';
  }
  log.color=op.color;
 } else if(op.type==='Recolor'){
  s.cells[k].color=op.color;log.color=op.color;
 } else {
  delete s.cells[k];
  for(const [nx,nz] of adjacent(s,{x,z,level}))delete s.edges[edgeKey(k,key(nx,nz,level))];
  if(Object.values(s.cells).some(c=>c.level>0&&!supportFor(s,c)))fail('SUPPORT_DEPENDENCY');
 }
 s.history.push(log);
 return s;
}
export function replay(ops,width=11,height=11,levels=3){return ops.reduce((s,o)=>apply(s,o),initialState(width,height,levels));}
function enclosedAtLevel(s,level){
 const vacant=new Set();for(let z=0;z<s.height;z++)for(let x=0;x<s.width;x++)if(!has(s,x,z,level))vacant.add(`${x},${z}`);
 const exterior=new Set(),q=[];
 for(const p of vacant){const [x,z]=p.split(',').map(Number);if(x===0||z===0||x===s.width-1||z===s.height-1){exterior.add(p);q.push(p);}}
 for(let i=0;i<q.length;i++){
  const [x,z]=q[i].split(',').map(Number);for(const [dx,dz] of DIRS){const p=`${x+dx},${z+dz}`;if(vacant.has(p)&&!exterior.has(p)){exterior.add(p);q.push(p);}}
 }
 const candidates=new Set([...vacant].filter(x=>!exterior.has(x))),out=[];
 while(candidates.size){
  const start=[...candidates].sort()[0];candidates.delete(start);const group=[start];
  for(let i=0;i<group.length;i++){
   const [x,z]=group[i].split(',').map(Number);
   for(const [dx,dz] of DIRS){const p=`${x+dx},${z+dz}`;if(candidates.delete(p))group.push(p);}
  }
  const cells=group.map(p=>{const [x,z]=p.split(',').map(Number);return {x,z};}).sort((a,b)=>a.z-b.z||a.x-b.x);
  const openColumns=cells.filter(c=>{for(let l=level+1;l<s.levels;l++)if(has(s,c.x,c.z,l))return false;return true;}).length;
  out.push({id:`court:${level}:${cells[0].x},${cells[0].z}`,level,area:cells.length,cells,
   skyProxy:openColumns===cells.length?'OPEN':openColumns===0?'BLOCKED':'PARTIAL',openColumns,blockedColumns:cells.length-openColumns,
   actualRoofGeometry:false});
 }
 return out.sort((a,b)=>a.id.localeCompare(b.id));
}
function roomsForLevel(s,level){
 const rem=new Set(Object.values(s.cells).filter(c=>c.level===level).map(c=>key(c.x,c.z,level))),rooms=[];
 while(rem.size){
  const start=[...rem].sort()[0],q=[start];rem.delete(start);
  for(let i=0;i<q.length;i++){
   const k=q[i],c=s.cells[k];for(const [nx,nz] of adjacent(s,c)){
    const other=key(nx,nz,level);
    if(rem.has(other)&&s.edges[edgeKey(k,other)]==='OPEN'){rem.delete(other);q.push(other);}
   }
  }
  const cells=q.map(k=>s.cells[k]).sort(order);rooms.push({id:`room:${Math.min(...cells.map(c=>c.id))}`,level,unitIds:cells.map(c=>c.id)});
 }
 return rooms.sort((a,b)=>a.id.localeCompare(b.id));
}
export function derive(s){
 const supports=Object.values(s.cells).filter(c=>c.level>0).sort(order).map(c=>({cell:key(c.x,c.z,c.level),...supportFor(s,c)}));
 const verticalContacts=Object.values(s.cells).filter(c=>c.level>0&&has(s,c.x,c.z,c.level-1)).sort(order)
  .map(c=>({upper:key(c.x,c.z,c.level),lower:key(c.x,c.z,c.level-1),relation:'CONTACT_ONLY',passable:false}));
 const courts=[],rooms=[];
 for(let level=0;level<s.levels;level++){courts.push(...enclosedAtLevel(s,level));rooms.push(...roomsForLevel(s,level));}
 const occupied=Object.values(s.cells).sort(order);
 return {contract:CONTRACT,levels:s.levels,occupied,edges:Object.entries(s.edges).sort((a,b)=>a[0].localeCompare(b[0])),
  supports,verticalContacts,verticalPassages:[],rooms,courtyards:courts,
  metrics:{units:occupied.length,rooms:rooms.length,skyOpen:courts.filter(c=>c.skyProxy==='OPEN').length,skyBlocked:courts.filter(c=>c.skyProxy==='BLOCKED').length}};
}
export function validate(s){
 const issues=[],actual=new Set();
 for(const c of Object.values(s.cells)){
  if(c.level>0&&!supportFor(s,c))issues.push(`unsupported:${key(c.x,c.z,c.level)}`);
  for(const [nx,nz] of adjacent(s,c))if(has(s,nx,nz,c.level))actual.add(edgeKey(key(c.x,c.z,c.level),key(nx,nz,c.level)));
 }
 for(const e of actual)if(!['OPEN','PARTITION'].includes(s.edges[e]))issues.push('missing-edge:'+e);
 for(const [e,v] of Object.entries(s.edges))if(!actual.has(e)||!['OPEN','PARTITION'].includes(v))issues.push('orphan-or-bad-edge:'+e);
 return {ok:issues.length===0,issues};
}
/** FNV fingerprint is a deterministic *comparison label*, NOT a security digest. */
export function fingerprint(value){const s=JSON.stringify(value);let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
export function runScenario(steps){
 let state=initialState(),rejections=[];const trace=[{step:0,fingerprint:fingerprint(derive(state))}];
 for(let i=0;i<steps.length;i++){
  const st=steps[i];if(st.type==='ExpectReject'){
   const before=JSON.stringify(state);
   try{apply(state,st.operation);fail('EXPECTED_REJECTION_NOT_OBSERVED');}catch(e){
    if(e.code!==st.code)throw new Error(`step ${i+1}: expected ${st.code}, got ${e.code||e.message}`);
   }
   if(JSON.stringify(state)!==before)throw new Error('Rejected operation mutated state');
   rejections.push({step:i+1,code:st.code});
  }else{state=apply(state,st);if(!validate(state).ok)throw new Error('Invalid construction state at step '+(i+1));}
  trace.push({step:i+1,fingerprint:fingerprint(derive(state))});
 }
 return {state,model:derive(state),trace,rejections};
}
