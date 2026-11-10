import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,apply,derive,runScenario,validate} from '../src/vertical.js';
import {EXTENDED} from '../src/extended-scenarios.js';
import {SPATIAL_CONTRACT,voidTopology,slabInterfaces,supportLineages,compareSupportLineages,stairProposals,assessStairRequest,spatialSnapshot} from '../src/void-and-circulation.js';

const add=(s,x,z,level=0,color='PAPER')=>apply(s,{type:'Add',x,z,level,color});
const remove=(s,x,z,level=0)=>apply(s,{type:'Remove',x,z,level});
const recolor=(s,x,z,level,color)=>apply(s,{type:'Recolor',x,z,level,color});
const patch=(s,x,z,level,color='PAPER')=>[...Array(2)].reduce((acc,_,dz)=>[...Array(2)].reduce((cur,__,dx)=>add(cur,x+dx,z+dz,level,color),acc),s);

const snapshot=steps=>spatialSnapshot(runScenario(steps).state);
const at=(s,courtId)=>voidTopology(s).courtyards.find(c=>c.id===courtId);

test('R2-V stage2 preserves V01-V04 replay determinism, and derived probes are read-only',()=>{
 for(const [id,scene] of Object.entries(EXTENDED)){
  const original=runScenario(scene.steps),bytes=JSON.stringify(original.state);
  const first=JSON.stringify(spatialSnapshot(original.state));
  assert.equal(spatialSnapshot(original.state).contract,SPATIAL_CONTRACT,id);
  for(let n=0;n<4;n++)assert.equal(JSON.stringify(snapshot(scene.steps)),first,id);
  assert.equal(JSON.stringify(original.state),bytes,'semantic probe mutated state '+id);
  assert.ok(validate(original.state).ok,id);
 }
});
test('V02 has real 3D vacant-cell reachability: open → sealed by level1 bridge → reopened',()=>{
 const ops=EXTENDED.V02.steps;
 const s0=runScenario(ops.slice(0,16)).state;
 const s1=runScenario(ops.slice(0,17)).state;
 const s2=runScenario(ops.slice(0,18)).state;
 const c0=at(s0,'court:0:4,4'),c1=at(s1,'court:0:4,4'),c2=at(s2,'court:0:4,4');
 assert.ok(c0&&c1&&c2);
 assert.deepEqual([c0.directSky,c1.directSky,c2.directSky],['OPEN','BLOCKED','OPEN']);
 assert.deepEqual([c0.atmosphericStatus,c1.atmosphericStatus,c2.atmosphericStatus],['VENTILATED_TO_SKY','SEALED_FROM_SKY','VENTILATED_TO_SKY']);
 assert.ok(voidTopology(s1).voidComponents.some(v=>!v.skyConnected&&v.cells.some(c=>c.x===4&&c.z===4&&c.level===0)));
 assert.equal(voidTopology(s1).shafts.find(v=>v.cellKeys.includes('0:4,4')).reachesSky,false);
 assert.equal(voidTopology(s2).shafts.find(v=>v.cellKeys.includes('0:4,4')).reachesSky,true);
});
test('V07 3x4 courtyard has PARTIAL direct sky but its covered corner still reaches sky laterally',()=>{
 const r=runScenario(EXTENDED.V07.steps);
 const c=at(r.state,'court:0:3,3');
 assert.ok(c);
 assert.equal(c.area,2);
 assert.equal(c.directSky,'PARTIAL');
 assert.equal(c.atmosphericStatus,'VENTILATED_TO_SKY');
 assert.equal(c.blockedColumns,1);
 assert.equal(c.reachableSkyCells,2);
 assert.equal(c.cells.filter(p=>!p.clearToTop&&p.connectedSky).length,1);
});
test('3D connectivity is not conflated with planar enclosure or an actual roof',()=>{
 const r=runScenario(EXTENDED.V02.steps.slice(0,16));
 const result=spatialSnapshot(r.state);
 assert.ok(result.space.courtyards.some(c=>c.level===0&&c.atmosphericStatus==='VENTILATED_TO_SKY'));
 assert.ok(result.space.shafts.some(c=>c.levels.length===2&&c.reachesSky));
 assert.ok(result.space.courtyards.every(c=>c.actualRoofGeometry===false));
 assert.equal(result.metrics.actualPassages,0);
});
test('V01 overlapping 2x2 yields an eligible system stair proposal but never a traversable stair',()=>{
 const r=runScenario(EXTENDED.V01.steps),v=spatialSnapshot(r.state);
 assert.ok(v.proposals.length>=1);
 assert.equal(v.proposals[0].status,'ELIGIBLE_UNREALIZED');
 assert.equal(v.proposals[0].passable,false);
 assert.equal(v.proposals[0].upperFloorHoleRealized,false);
 assert.ok(v.slabs.every(s=>s.status==='SOLID_UNOPENED'&&!s.passable&&!s.holeRealized));
 assert.equal(v.metrics.actualPassages,0);
 const assessment=assessStairRequest(r.state,{x:2,z:2,lowerLevel:0});
 assert.equal(assessment.ok,true);
 assert.equal(assessment.passable,false);
});
test('V06 loses 2x2 stair eligibility after removing one upper cell; Recolor does not rewrite OPEN history',()=>{
 const ops=EXTENDED.V06.steps;
 const s8=runScenario(ops.slice(0,8)).state;
 const s9=runScenario(ops.slice(0,9)).state;
 const s10=runScenario(ops.slice(0,10)).state;
 assert.ok(stairProposals(s8).length>0);
 assert.ok(stairProposals(s9).length>0);
 assert.equal(s9.edges['1:2,2|1:3,2'],'OPEN');
 assert.equal(stairProposals(s10).length,0);
 assert.equal(assessStairRequest(s10,{x:2,z:2,lowerLevel:0}).code,'NO_VALID_2X2_OPEN_CONNECTED_FOOTPRINT');
});
test('1x1 stack, disconnected 2x2 and malformed requests fail stair proposal gates',()=>{
 let single=add(initialState(),4,4);single=add(single,4,4,1);
 assert.equal(stairProposals(single).length,0);
 let two=patch(initialState(),2,2,0);
 two=patch(two,2,2,1,'MIST');
 // Create partition on a last cell before completion; 2x2 upper local OPEN cannot be assumed.
 let mixed=patch(initialState(),2,2,0);
 for(const [x,z,color] of [[2,2,'PAPER'],[3,2,'MIST'],[2,3,'MIST'],[3,3,'PAPER']])mixed=add(mixed,x,z,1,color);
 assert.equal(stairProposals(mixed).length,0);
 assert.ok(stairProposals(two).length>0); // Different floor palette is NOT automatically same building; proposal only.
 assert.equal(assessStairRequest(mixed,{x:2,z:2,lowerLevel:0}).ok,false);
 assert.equal(assessStairRequest(mixed,{x:99,z:0,lowerLevel:0}).code,'INVALID_REQUEST');
});
test('V05 Remove safely transitions upper support lineage DIRECT → ONE_BAY_BRIDGE_EW',()=>{
 const ops=EXTENDED.V05.steps;
 const before=runScenario(ops.slice(0,4)).state;
 const after=runScenario(ops.slice(0,5)).state;
 const trace=compareSupportLineages(before,after);
 assert.equal(trace.length,1);
 assert.equal(trace[0].unitId,2);
 assert.equal(trace[0].before.mode,'DIRECT');
 assert.equal(trace[0].after.mode,'ONE_BAY_BRIDGE_EW');
 assert.deepEqual(trace[0].before.ground,[1]);
 assert.deepEqual(trace[0].after.ground,[3,4]);
 assert.equal(after.cells['1:4,4'].id,2);
 assert.ok(validate(after).ok);
});
test('V05 rejects deletion of remaining bridge anchor, and re-Add restores DIRECT support',()=>{
 const ops=EXTENDED.V05.steps;
 const s5=runScenario(ops.slice(0,5)).state;
 const s6=runScenario(ops.slice(0,6)).state;
 const s7=runScenario(ops.slice(0,7)).state;
 assert.deepEqual(s5,s6);
 assert.equal(runScenario(ops.slice(0,6)).rejections.at(-1).code,'SUPPORT_DEPENDENCY');
 assert.equal(supportLineages(s7).find(s=>s.unitId===2).mode,'DIRECT');
 assert.notEqual(s7.cells['0:4,4'].id,1);
 assert.equal(s7.edges['0:3,4|0:4,4'],'PARTITION');
});
test('three-level support lineage propagates a ground source replacement without changing upper IDs',()=>{
 let s=add(initialState(),4,4);s=add(s,4,4,1);s=add(s,4,4,2);
 s=add(s,3,4);s=add(s,5,4);
 const before=s;
 s=remove(s,4,4,0);
 const changes=compareSupportLineages(before,s);
 assert.deepEqual(changes.map(x=>x.unitId),[2,3]);
 assert.equal(supportLineages(s).find(x=>x.unitId===3).terminalGroundUnitIds.join(','),'4,5');
 assert.equal(s.cells['2:4,4'].id,3);
});
test('unrelated edits do not change an established stair candidate or support source identity',()=>{
 let s=runScenario(EXTENDED.V01.steps).state;
 const p=stairProposals(s)[0];
 const prior=supportLineages(s).filter(v=>v.level>0);
 s=add(s,9,9);
 assert.equal(stairProposals(s)[0].id,p.id);
 assert.deepEqual(supportLineages(s).filter(v=>v.level>0),prior);
});
test('semantic probes reject malformed base state, do not mutate it or authorize novel user actions',()=>{
 const s=runScenario(EXTENDED.V01.steps).state;
 const bytes=JSON.stringify(s);
 voidTopology(s);slabInterfaces(s);supportLineages(s);stairProposals(s);
 assert.equal(JSON.stringify(s),bytes);
 assert.throws(()=>apply(s,{type:'SetStairs',x:2,z:2,level:0}),e=>e.code==='BAD_OPERATION');
 s.edges['0:2,2|0:3,2']='BROKEN';
 assert.throws(()=>voidTopology(s),/invalid base state/);
});
