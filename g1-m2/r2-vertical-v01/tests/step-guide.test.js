import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENARIOS} from '../src/scenarios.js';
import {stepGuide} from '../src/step-guide.js';
import {runScenario} from '../src/vertical.js';

test('V04 guides cover every step and match the real target operation',()=>{
 const {steps}=SCENARIOS.V04;
 assert.equal(steps.length,10);
 for(let step=1;step<=steps.length;step++){
  const g=stepGuide('V04',SCENARIOS.V04,step),op=steps[step-1];
  const attempted=op.type==='ExpectReject'?op.operation:op;
  assert.ok(g.title&&g.meaning&&g.outcome&&g.principle);
  assert.deepEqual({x:g.target.x,z:g.target.z,level:g.target.level},{x:attempted.x,z:attempted.z,level:attempted.level});
  assert.equal(g.status,op.type==='ExpectReject'?'rejected':'applied');
 }
});
test('V04 steps 6 and 10 are expected rejections and do not change geometry',()=>{
 for(const step of [6,10]){
  const guide=stepGuide('V04',SCENARIOS.V04,step);
  const prev=runScenario(SCENARIOS.V04.steps.slice(0,step-1));
  const next=runScenario(SCENARIOS.V04.steps.slice(0,step));
  assert.equal(guide.status,'rejected');
  assert.deepEqual(next.state,prev.state);
  assert.equal(next.trace.at(-1).fingerprint,prev.trace.at(-1).fingerprint);
  assert.equal(next.rejections.at(-1).step,step);
 }
});
test('V04 steps 7,8,9 have the expected disassembly/rebuild outcomes',()=>{
 const steps=SCENARIOS.V04.steps;
 const s7=runScenario(steps.slice(0,7)).state;
 assert.equal(s7.cells['1:2,2'],undefined);
 assert.ok(s7.cells['0:2,2']);
 const s8=runScenario(steps.slice(0,8)).state;
 assert.equal(s8.cells['0:2,2'],undefined);
 assert.equal(s8.edges['0:2,2|0:3,2'],undefined);
 const s9=runScenario(steps.slice(0,9)).state;
 assert.equal(s9.cells['0:2,2'].id,5);
 assert.equal(s9.edges['0:2,2|0:3,2'],'PARTITION');
 assert.equal(s9.edges['0:3,2|0:4,2'],'OPEN');
});
test('guidance never introduces an extra construction operation',()=>{
 for(const [id,scenario] of Object.entries(SCENARIOS)){
  for(let step=0;step<=scenario.steps.length;step++){
   const before=JSON.stringify(scenario.steps);
   const guide=stepGuide(id,scenario,step);
   assert.ok(guide);
   assert.equal(JSON.stringify(scenario.steps),before);
  }
 }
 assert.throws(()=>stepGuide('V04',SCENARIOS.V04,11),RangeError);
});
