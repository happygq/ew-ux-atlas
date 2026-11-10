import test from 'node:test';
import assert from 'node:assert/strict';
import {EXTENDED} from '../src/extended-scenarios.js';
import {explainStep} from '../src/explanations.js';
import {runScenario} from '../src/vertical.js';

test('all seven fixture timelines have accurate step targets and explicit rejection status',()=>{
 for(const [id,scene] of Object.entries(EXTENDED)){
  for(let step=0;step<=scene.steps.length;step++){
   const before=JSON.stringify(scene.steps),explanation=explainStep(id,scene,step);
   assert.ok(explanation.title&&explanation.desc,`${id}:${step}`);
   if(step){
    const op=scene.steps[step-1],attempt=op.type==='ExpectReject'?op.operation:op;
    assert.deepEqual({...explanation.target}, {x:attempt.x,z:attempt.z,level:attempt.level,rejected:op.type==='ExpectReject'});
    if(op.type==='ExpectReject'){
     assert.equal(explanation.status,'rejected');
     assert.equal(explanation.failureCode,op.code);
     assert.deepEqual(runScenario(scene.steps.slice(0,step-1)).state,runScenario(scene.steps.slice(0,step)).state);
    }
   }
   assert.equal(JSON.stringify(scene.steps),before,'guidance should not mutate operations');
  }
 }
});
test('V05 step five explicitly names the lineage migration, and V07 step eleven the partial roof',()=>{
 assert.match(explainStep('V05',EXTENDED.V05,5).desc,/DIRECT/);
 assert.match(explainStep('V05',EXTENDED.V05,5).desc,/ONE_BAY_BRIDGE_EW/);
 assert.match(explainStep('V07',EXTENDED.V07,11).desc,/PARTIAL/);
 assert.throws(()=>explainStep('V07',EXTENDED.V07,999),RangeError);
});
