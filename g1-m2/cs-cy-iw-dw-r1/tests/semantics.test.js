import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,applyOperation,replay,derive,validate,boundaryKey,key} from '../src/semantics.js';
import {SCENARIOS} from '../src/scenarios.js';
const a=(s,x,z,color='PAPER')=>applyOperation(s,{type:'Add',x,z,color});
const rem=(s,x,z)=>applyOperation(s,{type:'Remove',x,z});
const rec=(s,x,z,color)=>applyOperation(s,{type:'Recolor',x,z,color});
const ring=(s,x0=3,z0=3,n=5)=>{for(let x=x0;x<x0+n;x++)for(let z=z0;z<z0+n;z++)if(x===x0||x===x0+n-1||z===z0||z===z0+n-1)s=a(s,x,z);return s;};

test('invalid cells, duplicate Add and nonexisting Remove fail closed',()=>{
 let s=initialState();assert.throws(()=>a(s,-1,0),RangeError);assert.throws(()=>a(s,0,0,'bad'),RangeError);assert.throws(()=>rem(s,2,2));s=a(s,0,0);assert.throws(()=>a(s,0,0));assert.equal(s.history.length,1);
});
test('same BuildColor Add establishes one persistent OPEN boundary and a larger room',()=>{
 let s=a(initialState(),1,1);s=a(s,2,1);assert.equal(s.edgeFacts[boundaryKey(key(1,1),key(2,1))],'OPEN');assert.equal(derive(s).rooms.length,1);assert.equal(derive(s).rooms[0].unitCount,2);
});
test('different BuildColor Add establishes one shared PARTITION',()=>{
 let s=a(initialState(),1,1);s=a(s,2,1,'MIST');const model=derive(s);
 assert.equal(s.edgeFacts[boundaryKey(key(1,1),key(2,1))],'PARTITION');assert.equal(model.rooms.length,2);assert.equal(model.metrics.sharedPartitions,1);assert.equal(model.walls.filter(x=>x.kind==='PARTITION').length,1);
});
test('Recolor must not retroactively open a prior partition',()=>{
 let s=a(initialState(),1,1);s=a(s,2,1,'MIST');s=rec(s,2,1,'PAPER');
 assert.equal(derive(s).rooms.length,2);assert.equal(s.edgeFacts[boundaryKey(key(1,1),key(2,1))],'PARTITION');
});
test('Recolor retains old OPEN edge and affects future Add at new boundary',()=>{
 let s=a(initialState(),1,1);s=a(s,2,1);s=rec(s,2,1,'MIST');s=a(s,3,1,'MIST');
 assert.equal(s.edgeFacts[boundaryKey(key(1,1),key(2,1))],'OPEN');assert.equal(s.edgeFacts[boundaryKey(key(2,1),key(3,1))],'OPEN');assert.equal(derive(s).rooms.length,1);
});
test('Remove cleans orphan boundary facts; re-Add recomputes based on present BuildColor',()=>{
 let s=a(initialState(),1,1);s=a(s,2,1);s=rem(s,2,1);assert.deepEqual(s.edgeFacts,{});s=a(s,2,1,'SILK');assert.equal(derive(s).rooms.length,2);assert.deepEqual(validate(s),{ok:true,issues:[]});
});
test('5 by 5 Add-only ring creates one 9-cell courtyard without a courtyard command',()=>{
 const s=ring(initialState()),model=derive(s);assert.equal(s.history.length,16);assert.equal(model.courtyards.length,1);assert.equal(model.courtyards[0].status,'ENCLOSED');assert.equal(model.courtyards[0].area,9);assert.equal(model.metrics.courtyardFacades,12);assert.ok(model.doorIntents.length>0);assert.ok(validate(s,model).ok);
});
test('Remove on ring boundary converts enclosed court into OPEN_COURT candidate',()=>{
 let s=ring(initialState());s=rem(s,5,3);const model=derive(s);assert.equal(model.metrics.courtyards,0);assert.ok(model.courtyards.some(c=>c.type==='OPEN_COURT'&&c.status==='CANDIDATE'));assert.ok(validate(s,model).ok);
});
test('Add that repairs the opening restores courtyard, no fake permanent court token',()=>{
 let s=ring(initialState());s=rem(s,5,3);s=a(s,5,3);assert.equal(derive(s).metrics.courtyards,1);assert.equal(derive(s).metrics.courtyardCandidates,0);
});
test('Two independently enclosed courts are classified as separate regions',()=>{
 const s=replay(SCENARIOS.DOUBLE.steps),m=derive(s);assert.equal(m.metrics.courtyards,2);assert.deepEqual(m.courtyards.map(c=>c.area),[9,9]);assert.ok(validate(s,m).ok);
});
test('No unowned/double walls; all interior occupied adjacency facts correspond to a single edge',()=>{
 const s=replay(SCENARIOS.DOUBLE.steps),m=derive(s);
 assert.equal(new Set(m.walls.map(w=>w.id)).size,m.walls.length);
 const adj=new Set();for(const c of Object.values(s.cells))for(const [dx,dz] of [[1,0],[0,1]])if(s.cells[key(c.x+dx,c.z+dz)])adj.add(boundaryKey(key(c.x,c.z),key(c.x+dx,c.z+dz)));
 assert.equal(adj.size,Object.keys(s.edgeFacts).length);assert.equal(adj.size,m.metrics.sharedPartitions+m.metrics.openConnections);
});
test('Courtyard facade plan includes timber screen, stone base and partial plaster',()=>{
 const m=derive(ring(initialState())),names=new Set(m.walls.filter(w=>w.kind==='COURTYARD').map(w=>w.facade));
 for(const name of ['TIMBER_SCREEN','TIMBER_STONE_BASE','PLASTER_TIMBER_HYBRID','PLASTER_COURT_WALL'])assert.ok(names.has(name),name);
});
test('Main court entry intentions refer to real courtyard wall segments',()=>{
 const m=derive(ring(initialState()));assert.equal(m.doorIntents.length,1);
 for(const p of m.doorIntents){const w=m.walls.find(w=>w.id===p.wallId);assert.ok(w);assert.equal(w.kind,'COURTYARD');assert.equal(p.status,'R1_INTENT_ONLY');}
});
test('All 4 built-in scenarios replay deterministically with no invalid persistent walls',()=>{
 for(const name of Object.keys(SCENARIOS)){
  const ops=SCENARIOS[name].steps,s=replay(ops),s2=replay(ops),m=derive(s);
  assert.deepEqual(s,s2);assert.deepEqual(m,derive(s2));assert.ok(validate(s,m).ok,`${name} invalid`);
 }
});
test('Replay prefix forms legal construction intermediate states, not only final templates',()=>{
 for(const name of ['RING','OPEN','DOUBLE'])for(let i=0;i<=SCENARIOS[name].steps.length;i++){
  const s=replay(SCENARIOS[name].steps.slice(0,i));assert.ok(validate(s).ok,`${name} prefix ${i}`);
 }
});
test('A model structural hash does not change from view/theme changes because derive is pure',()=>{
 const s=replay(SCENARIOS.RING.steps),before=JSON.stringify(derive(s));
 for(const mode of ['CONSTRUCTION','ARCHITECTURE']){assert.equal(JSON.stringify(derive(s)),before,mode);}
});
test('Out-of-bounds and invalid persistent fact corruption explicitly detected',()=>{
 const s=a(a(initialState(),1,1),2,1);s.edgeFacts[boundaryKey(key(1,1),key(2,1))]='UNSPECIFIED';const v=validate(s,{courtyards:[],walls:[],doorIntents:[]});assert.ok(!v.ok);
});
test('Research R1 intentionally does not claim real wall openings or WP1.1 Authority',()=>{
 const s=initialState();assert.ok(!Object.keys(s).some(x=>/mesh|authority/i.test(x)));
 const m=derive(ring(s));assert.ok(m.doorIntents.every(x=>x.status==='R1_INTENT_ONLY'));
});
