import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,apply,derive,validate,replay,runScenario,CONTRACT,fingerprint} from '../src/vertical.js';
import {SCENARIOS} from '../src/scenarios.js';
const add=(s,x,z,l=0,color='PAPER')=>apply(s,{type:'Add',x,z,level:l,color});
const rm=(s,x,z,l)=>apply(s,{type:'Remove',x,z,level:l});
const reject=(fn,code)=>assert.throws(fn,e=>e.code===code);
test('V01-V04 replay deterministically 9 times, including rejected operations',()=>{
 for(const [id,v] of Object.entries(SCENARIOS)){
  const first=runScenario(v.steps);
  assert.equal(first.state.contract,CONTRACT,id);
  assert.equal(validate(first.state).ok,true,id);
  for(let n=0;n<9;n++)assert.equal(JSON.stringify(runScenario(v.steps)),JSON.stringify(first),id);
 }
});
test('V01 floor rooms are distinct; CONTACT_ONLY never implies stairs',()=>{
 const m=runScenario(SCENARIOS.V01.steps).model;
 assert.equal(m.occupied.length,8);assert.equal(m.rooms.length,2);
 assert.equal(m.verticalContacts.length,4);
 assert.ok(m.verticalContacts.every(c=>c.relation==='CONTACT_ONLY'&&!c.passable));
 assert.deepEqual(m.verticalPassages,[]);
});
test('V02 courtyard sky proxy closes under candidate one-bay covering, then reopens',()=>{
 const steps=SCENARIOS.V02.steps;
 const m0=derive(replay(steps.slice(0,16)));
 const m1=derive(replay(steps.slice(0,17)));
 const m2=derive(replay(steps));
 assert.equal(m0.courtyards.find(c=>c.level===0).skyProxy,'OPEN');
 assert.equal(m1.courtyards.find(c=>c.level===0).skyProxy,'BLOCKED');
 assert.equal(m2.courtyards.find(c=>c.level===0).skyProxy,'OPEN');
 assert.ok(m1.supports.some(s=>s.mode==='ONE_BAY_BRIDGE_EW'));
 assert.ok(m1.supports.every(s=>s.verifiedGeometry===false));
});
test('V03 has three explicitly identified levels and rejects unsupported Add',()=>{
 const out=runScenario(SCENARIOS.V03.steps);
 assert.deepEqual([...new Set(out.model.occupied.map(c=>c.level))],[0,1,2]);
 assert.ok(out.model.supports.every(s=>s.mode==='DIRECT'));
 assert.ok(out.rejections.some(r=>r.code==='UNSUPPORTED_ADD'));
});
test('V04 Recolor keeps historical edge facts for old and new neighbors',()=>{
 const steps=SCENARIOS.V04.steps.slice(0,5);
 const s=replay(steps);
 assert.equal(s.edges['0:2,2|0:3,2'],'OPEN');
 assert.equal(s.edges['0:3,2|0:4,2'],'OPEN');
 assert.equal(s.cells['0:3,2'].color,'MIST');
});
test('dependent lower-floor Remove is refused without mutating the original state',()=>{
 let s=add(initialState(),2,2);s=add(s,2,2,1);
 const before=JSON.stringify(s);
 reject(()=>rm(s,2,2,0),'SUPPORT_DEPENDENCY');
 assert.equal(JSON.stringify(s),before);
});
test('Remove clears orphan horizontal edges and re-Add uses current colors',()=>{
 let s=add(initialState(),1,1);s=add(s,2,1);s=rm(s,2,1,0);
 assert.deepEqual(s.edges,{});
 s=add(s,2,1,0,'MIST');
 assert.equal(s.edges['0:1,1|0:2,1'],'PARTITION');
});
test('bridge requires real supports on opposite sides',()=>{
 let s=add(initialState(),3,4);
 reject(()=>add(s,4,4,1),'UNSUPPORTED_ADD');
 s=add(s,5,4);s=add(s,4,4,1);
 assert.ok(derive(s).supports.some(x=>x.mode==='ONE_BAY_BRIDGE_EW'));
});
test('invalid level/color and unauthorized operation are rejected',()=>{
 const s=initialState();
 reject(()=>add(s,2,2,3),'INVALID_POSITION');
 reject(()=>add(s,2,2,0,'INVALID'),'INVALID_COLOR');
 reject(()=>apply(s,{type:'SetPassage',x:2,z:2,level:0}),'BAD_OPERATION');
});
test('view changes cannot change topology or canonical comparison fingerprint',()=>{
 const s=runScenario(SCENARIOS.V01.steps).state,expected=fingerprint(derive(s));
 for(const name of ['street','court','floor1','floor2'])assert.equal(fingerprint(derive(s)),expected,name);
});
test('validator detects corrupted facts and unsupported occupied units',()=>{
 let s=add(initialState(),2,2);s=add(s,3,2);s.edges['0:2,2|0:3,2']='INVALID';
 assert.equal(validate(s).ok,false);
 let t=add(initialState(),2,2);t=add(t,2,2,1);delete t.cells['0:2,2'];
 assert.ok(validate(t).issues.some(x=>x.startsWith('unsupported')));
});
test('prototype explicitly excludes physical roofs, vertical passages and production mesh',()=>{
 const m=runScenario(SCENARIOS.V02.steps).model;
 assert.deepEqual(m.verticalPassages,[]);
 assert.ok(m.courtyards.every(c=>c.actualRoofGeometry===false));
 assert.equal(Object.keys(m).some(x=>/mesh|authority|stairs/i.test(x)),false);
});
