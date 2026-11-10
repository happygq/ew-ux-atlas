/**
 * R2-V stage 2: independent, read-only semantic probes for 3D vacant air,
 * support ancestry, and proposed (NOT realized) stair/slab interfaces.
 * No Authority I/O, geometry claims, user commands, or R1 mutations.
 */
import {derive, key, supportFor, validate} from './vertical.js';

export const SPATIAL_CONTRACT='ew/ux/r2-v-spatial-probes/candidate-v0.2';
const DELTAS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const xyKey=(x,z)=>`${x},${z}`;
const decode=k=>{const m=/^(\d+):(-?\d+),(-?\d+)$/.exec(k);if(!m)throw new Error('invalid voxel key');return {level:Number(m[1]),x:Number(m[2]),z:Number(m[3])};};
const within=(s,x,z,l)=>x>=0&&x<s.width&&z>=0&&z<s.height&&l>=0&&l<s.levels;
const cellAt=(s,x,z,l)=>s.cells[key(x,z,l)];
const sortedKeys=s=>[...s].sort((a,b)=>{const x=decode(a),y=decode(b);return x.level-y.level||x.z-y.z||x.x-y.x;});

/** Airspace is an explicit 6-connected 3D voxel graph. Occupied footprint
 * blocks air at that level; there are NO fictional stairs through occupied
 * floor-slabs and NO roofing geometry. Top-open air cells are sky sources.
 */
export function voidTopology(state){
  if(!validate(state).ok)throw new Error('invalid base state');
  const empty=new Set();
  for(let level=0;level<state.levels;level++)for(let z=0;z<state.height;z++)for(let x=0;x<state.width;x++){
    if(!cellAt(state,x,z,level))empty.add(key(x,z,level));
  }
  const neighbors=k=>{
    const {x,z,level}=decode(k);
    return DELTAS.map(([dx,dz,dl])=>key(x+dx,z+dz,level+dl)).filter(p=>empty.has(p));
  };
  const flood=(seeds)=>{
    const seen=new Set(),q=[];
    for(const k of seeds){if(empty.has(k)&&!seen.has(k)){seen.add(k);q.push(k);}}
    for(let i=0;i<q.length;i++)for(const n of neighbors(q[i]))if(!seen.has(n)){seen.add(n);q.push(n);}
    return seen;
  };
  const skySeeds=[],sideSeeds=[];
  for(const k of empty){
    const {x,z,level}=decode(k);
    if(level===state.levels-1)skySeeds.push(k);
    if(x===0||z===0||x===state.width-1||z===state.height-1)sideSeeds.push(k);
  }
  const sky=flood(skySeeds),outside=flood(sideSeeds);
  const components=[],remaining=new Set(empty);
  while(remaining.size){
    const start=sortedKeys(remaining)[0],q=[start];remaining.delete(start);
    for(let i=0;i<q.length;i++)for(const n of neighbors(q[i]))if(remaining.delete(n))q.push(n);
    const sorted=sortedKeys(q);components.push({id:`void:${sorted[0]}`,count:q.length,skyConnected:q.some(k=>sky.has(k)),sideConnected:q.some(k=>outside.has(k)),cells:sorted.map(decode)});
  }
  components.sort((a,b)=>a.id.localeCompare(b.id));
  const roomModel=derive(state);
  const courtyards=roomModel.courtyards.map(court=>{
    const cells=court.cells.map(({x,z})=>{
      const id=key(x,z,court.level);
      let clear=true;
      for(let upper=court.level+1;upper<state.levels;upper++)if(cellAt(state,x,z,upper)){clear=false;break;}
      return {x,z,level:court.level,clearToTop:clear,connectedSky:sky.has(id),connectedSide:outside.has(id)};
    });
    const direct=cells.filter(c=>c.clearToTop).length;
    return {...court,skyProxy:undefined,cells,openColumns:direct,blockedColumns:cells.length-direct,
      directSky:direct===cells.length?'OPEN':direct===0?'BLOCKED':'PARTIAL',
      reachableSkyCells:cells.filter(c=>c.connectedSky).length,
      atmosphericStatus:cells.every(c=>c.connectedSky)?'VENTILATED_TO_SKY':cells.some(c=>c.connectedSky)?'PARTLY_CONNECTED':'SEALED_FROM_SKY',
      definition:'3D_VACANT_GRAPH_NO_ROOF_GEOMETRY'};
  });
  // Link courtyard floor patches only when adjacent VACANT voxels connect in
  // 3D. A cavity that merely looks over another cavity is not automatically a
  // stair or a physically occupied interior.
  const candidates=new Set(courtyards.flatMap(c=>c.cells.map(p=>key(p.x,p.z,p.level))));
  const shafts=[];
  while(candidates.size){
    const start=sortedKeys(candidates)[0],q=[start];candidates.delete(start);
    for(let i=0;i<q.length;i++)for(const n of neighbors(q[i]))if(candidates.delete(n))q.push(n);
    const sorted=sortedKeys(q),levels=[...new Set(sorted.map(p=>decode(p).level))].sort((a,b)=>a-b);
    shafts.push({id:`shaft:${sorted[0]}`,levels,cellCount:sorted.length,
      reachesSky:sorted.some(p=>sky.has(p)),
      directSky:sorted.some(p=>{const c=decode(p);return c.level===state.levels-1;}),
      cellKeys:sorted});
  }
  return {contract:SPATIAL_CONTRACT,freeAirCells:empty.size,
    skyConnectedFreeCells:sky.size,sideConnectedFreeCells:outside.size,
    voidComponents:components,courtyards,shafts,
    semantics:'3D_AIR_ONLY; NO_REAL_ROOFS_SLAB_HOLES_OR_STAIRS'};
}

/** Every stacked occupied interface is a closed slab UNTIL a real opening is
 * realized. An eligible automatic proposal never silently edits this fact. */
export function slabInterfaces(state){
  const out=[];
  for(const c of Object.values(state.cells)){
    if(c.level===0)continue;
    const below=cellAt(state,c.x,c.z,c.level-1);
    if(below)out.push({id:`slab:${key(c.x,c.z,c.level-1)}>${key(c.x,c.z,c.level)}`,
      lowerUnitId:below.id,upperUnitId:c.id,lowerLevel:c.level-1,
      position:{x:c.x,z:c.z},status:'SOLID_UNOPENED',holeRealized:false,passable:false});
  }
  return out.sort((a,b)=>a.id.localeCompare(b.id));
}

/** Support source chain is a dependency graph, not a load-bearing proof. */
export function supportLineages(state){
  if(!validate(state).ok)throw new Error('invalid base state');
  const memo=new Map();
  const trace=k=>{
    if(memo.has(k))return memo.get(k);
    const c=state.cells[k];if(!c)throw new Error('orphan-support-cell:'+k);
    const s=supportFor(state,c);
    if(!s)throw new Error('unsupported:'+k);
    const branches=s.sources.map(trace);
    const terminalIds=s.mode==='GROUND'?[c.id]:branches.flatMap(p=>p.terminalGroundUnitIds);
    const out={cellKey:k,unitId:c.id,level:c.level,mode:s.mode,
      sourceKeys:[...s.sources],sourceUnitIds:s.sources.map(id=>state.cells[id].id),
      terminalGroundUnitIds:[...new Set(terminalIds)].sort((a,b)=>a-b),
      verifiedGeometry:false};
    memo.set(k,out);return out;
  };
  return Object.keys(state.cells).sort().map(trace).sort((a,b)=>a.level-b.level||a.unitId-b.unitId);
}
export function compareSupportLineages(before,after){
  const a=new Map(supportLineages(before).map(x=>[x.unitId,x]));
  return supportLineages(after).filter(x=>a.has(x.unitId)).flatMap(x=>{
    const prev=a.get(x.unitId);
    const changed=JSON.stringify([prev.mode,prev.sourceUnitIds,prev.terminalGroundUnitIds])!==JSON.stringify([x.mode,x.sourceUnitIds,x.terminalGroundUnitIds]);
    return changed?[{unitId:x.unitId,cellKey:x.cellKey,before:{mode:prev.mode,sourceUnitIds:prev.sourceUnitIds,ground:prev.terminalGroundUnitIds},after:{mode:x.mode,sourceUnitIds:x.sourceUnitIds,ground:x.terminalGroundUnitIds}}]:[];
  });
}

/** Read-only SYSTEM proposal: require an overlapping 2x2 of units belonging
 * to one OPEN-connected room on each floor. Never claim PASSABLE. Cannot be
 * configured by an unauthorized new user command. */
export function stairProposals(state){
  const model=derive(state),byCell=new Map(),out=[];
  for(const room of model.rooms)for(const id of room.unitIds){
    const c=Object.values(state.cells).find(cell=>cell.id===id);
    if(c)byCell.set(key(c.x,c.z,c.level),room.id);
  }
  const locallyConnected=(square,level)=>{
    const all=new Set(square.map(([x,z])=>key(x,z,level)));
    const first=[...all][0],seen=new Set([first]),queue=[first];
    for(let i=0;i<queue.length;i++){
      const p=decode(queue[i]);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const n=key(p.x+dx,p.z+dz,level),e=[queue[i],n].sort().join('|');
        if(all.has(n)&&!seen.has(n)&&state.edges[e]==='OPEN'){seen.add(n);queue.push(n);}
      }
    }
    return seen.size===all.size;
  };
  for(let lower=0;lower<state.levels-1;lower++){
    for(let z=0;z<state.height-1;z++)for(let x=0;x<state.width-1;x++){
      const square=[[x,z],[x+1,z],[x,z+1],[x+1,z+1]];
      const group=(level)=>square.map(([xx,zz])=>byCell.get(key(xx,zz,level)));
      const a=group(lower),b=group(lower+1);
      if(a.every(Boolean)&&b.every(Boolean)&&new Set(a).size===1&&new Set(b).size===1&&locallyConnected(square,lower)&&locallyConnected(square,lower+1)){
        const base=key(x,z,lower),above=key(x,z,lower+1);
        out.push({id:`stair-proposal:${base}>${above}`,lowerLevel:lower,upperLevel:lower+1,
          lowerRoomId:a[0],upperRoomId:b[0],footprint:square.map(([xx,zz])=>({x:xx,z:zz})),
          landing:{x,z},source:'DETERMINISTIC_SYSTEM_PROPOSAL',status:'ELIGIBLE_UNREALIZED',
          upperFloorHoleRealized:false,stairGeometryVerified:false,passable:false,
          reason:'two overlapping 2x2 OPEN-connected room patches; actual staircase requires structural geometry validation'});
      }
    }
  }
  return out.sort((a,b)=>a.id.localeCompare(b.id));
}
export function assessStairRequest(state,request){
  const invalid=(code)=>({ok:false,code,passable:false});
  if(!request||!Number.isInteger(request.x)||!Number.isInteger(request.z)||!Number.isInteger(request.lowerLevel))return invalid('INVALID_REQUEST');
  if(!within(state,request.x,request.z,request.lowerLevel)||request.lowerLevel>=state.levels-1)return invalid('INVALID_REQUEST');
  const match=stairProposals(state).find(p=>p.lowerLevel===request.lowerLevel&&p.landing.x===request.x&&p.landing.z===request.z);
  if(!match)return invalid('NO_VALID_2X2_OPEN_CONNECTED_FOOTPRINT');
  return {ok:true,code:'PROPOSAL_ONLY',proposalId:match.id,passable:false,slabOpeningVerified:false};
}
export function spatialSnapshot(state){
  const base=derive(state),space=voidTopology(state),slabs=slabInterfaces(state),support=supportLineages(state),proposals=stairProposals(state);
  return {contract:SPATIAL_CONTRACT,base,space,slabs,support,proposals,
    metrics:{rooms:base.rooms.length,verticalContact:base.verticalContacts.length,
      actualPassages:0,unopenedSlabs:slabs.length,
      stairProposals:proposals.length,skyVentilatedCourtyards:space.courtyards.filter(x=>x.atmosphericStatus==='VENTILATED_TO_SKY').length,
      sealedCourtyards:space.courtyards.filter(x=>x.atmosphericStatus==='SEALED_FROM_SKY').length}};
}
