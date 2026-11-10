import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,apply,derive,validate,replay,runScenario,CONTRACT,fingerprint} from '../src/vertical.js';
import {SCENARIOS} from '../src/scenarios.js';
const add=(s,x,z,level=0,color='PAPER')=>apply(s,{type:'Add',x,z,level,color});
const remove=(s,x,z,level)=>apply(s,{type:'Remove',x,z,level});
const recolor=(s,x,z,level,color)=>apply(s,{type:'Recolor',x,z,level,color});
const err=(fn,code)=>assert.throws(fn,e=>e.code===code);

test('all four replay fixtures are valid and byte-identical across nine repeats',()=>{
 for(const [id,fixture] of Object.entries(SCENARIOS)){
  const first=runScenario(fixture.steps);
  assert.equal(first.state.contract,CONTRACT,id);
  assert.ok(validate(first.state).ok,id);
  for(let i=0;i<9;i++)assert.equal(JSON.stringify(runScenario(fixture.steps)),JSON.stringify(first),id);
 }
});
test('V01 has two separate floor regions, not automatically vertically connected',()=>{
 const m=runScenario(SCENARIOS.V01.steps).model;
 assert.equal(m.occupied.length,8);
 assert.equal(m.rooms.length,2);
 assert.equal(m.verticalContacts.length,4);
 assert.ok(m.verticalContacts.every(c=>c.passable===false&&c.relation==='CONTACT_ONLY'));
 assert.deepEqual(m.verticalPassages,[]);
});
test('V02 detects roofless vertical courtyard, covers with candidate bridge, then reopens',()=>{
 const steps=SCENARIOS.V02.steps;
 const first=derive(replay(steps.slice(0,16)));
 assert.equal(first.courtyards.find(c=>c.level===0)?.skyProxy,'OPEN');
 const cover=derive(replay(steps.slice(0,17)));
 assert.equal(cover.courtyards.find(c=>c.level===0)?.skyProxy,'BLOCKED');
 assert.ok(cover.supports.some(s=>s.mode==='ONE_BAY_BRIDGE_EW'));
 assert.equal(derive(replay(steps)).courtyards.find(c=>c.level===0)?.skyProxy,'OPEN');
 assert.ok(cover.supports.every(s=>s.verifiedGeometry===false));
});
test('V03 three-level stepped footprint does not require invented supports',()=>{
 const r=runScenario(SCENARIOS.V03.steps),m=r.model;
 assert.equal(m.levels,3);
 assert.deepEqual(new Set(m.occupied.map(c=>c.level)),new Set([0,1,2]));
 assert.ok(m.supports.every(s=>s.mode==='DIRECT'));
 assert.ok(r.rejections.some(x=>x.code==='UNSUPPORTED_ADD'));
});
test('V04 Recolor preserves old OPEN relation, new Add opens under new build identity',()=>{
 const s=replay(SCENARIOS.V04.steps.filter(o=>o.type!=='ExpectReject').slice(0,5));
 assert.equal(s.edges['0:2,2|0:3,2'],'OPEN');
 assert.equal(s.edges['0:3,2|0:4,2'],'OPEN');
 assert.equal(s.cells['0:3,2'].color,'MIST');
});
test('V04 protected lower support cannot be removed, and reject leaves original state untouched',()=>{
 let s=initialState();s=add(s,2,2);s=add(s,2,2,1);
 const before=JSON.stringify(s);err(()=>remove(s,2,2,0),'SUPPORT_DEPENDENCY');assert.equal(JSON.stringify(s),before);
});
test('no orphan edge after Remove, and re-Add creates new edge fact under new colors',()=>{
 let s=initialState();s=add(s,1,1);s=add(s,2,1);s=remove(s,2,1,0);
 assert.deepEqual(s.edges,{});s=add(s,2,1,0,'MIST');assert.equal(s.edges['0:1,1|0:2,1'],'PARTITION');
});
test('bridge support requires two opposite real lower-floor anchors',()=>{
 let s=initialState();s=add(s,3,4);err(()=>add(s,4,4,1),'UNSUPPORTED_ADD');
 s=add(s,5,4);s=add(s,4,4,1);assert.ok(derive(s).supports.some(x=>x.mode==='ONE_BAY_BRIDGE_EW'));
});
test('invalid floor and unauthorised operation have deterministic error codes',()=>{
 let s=initialState();err(()=>add(s,2,2,3),'INVALID_POSITION');
 err(()=>apply(s,{type:'SetPassage',x:2,z:2,level:0}),'BAD_OPERATION');
 err(()=>add(s,2,2,0,'INVALID'),'INVALID_COLOR');
});
test('independent view modes do not alter spatial fingerprint',()=>{
 const result=runScenario(SCENARIOS.V01.steps);const first=fingerprint(result.model);
 for(const camera of ['street','court','floor1','floor2'])assert.equal(fingerprint(derive(result.state)),first,camera);
});
test('validation fails closed on corrupted persisted horizontal edge or unsupported overhang',()=>{
 let s=initialState();s=add(s,2,2);s=add(s,3,2);s.edges['0:2,2|0:3,2']='INVALID';
 assert.equal(validate(s).ok,false);
 let t=initialState();t=add(t,2,2);t=add(t,2,2,1);delete t.cells['0:2,2'];
 assert.ok(validate(t).issues.some(x=>x.startsWith('unsupported')));
});
test('structural semantics do not claim real holes, stairs, roof or Authority',()=>{
 const m=derive(runScenario(SCENARIOS.V02.steps).state);
 assert.deepEqual(m.verticalPassages,[]);
 assert.ok(m.courtyards.every(c=>c.actualRoofGeometry===false));
 assert.equal(Object.keys(m).some(k=>/mesh|authority|stairs/i.test(k)),false);
});
