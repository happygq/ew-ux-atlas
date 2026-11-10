import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTU,checkTUContract} from '../site/src/t-u-roof.js';
import {gableProfile,buildStyledGablePlacement,GABLE_PROFILE_CONTRACT,GABLE_SURFACE} from '../site/src/gable-profile.js';

const near=(a,b,e=1e-6)=>Math.abs(a-b)<=e;
const gables=m=>m.metadata.foundation.gableMeta;
for(const [width,expectedTiers] of [[2.85,2],[3.54,3],[5.1,4]]){
 test(`bilateral effective width ${width}m selects ${expectedTiers} tiers, with long horizontal treads`,()=>{
  const p=gableProfile({width,mode:'BILATERAL'});
  assert.equal(p.tierCount,expectedTiers);
  assert.equal(p.plateaus.length,expectedTiers*2-1);
  assert.ok(p.minTread>=.49,p.minTread);
  assert.ok(p.crestWidth>=.84,p.crestWidth);
  assert.ok(p.crestWidth/width>=.2);
  for(let i=0;i<p.plateaus.length;i++){
   const a=p.plateaus[i],b=p.plateaus.at(-1-i);
   assert.ok(near(a.start,-b.end)&&near(a.end,-b.start)&&near(a.height,b.height));
  }
 });
}
for(const width of [2.85,3.54,5.1]){
 test(`half-fan width ${width}m has spacious, directionally ascending steps`,()=>{
  const p=gableProfile({width,mode:'HALF_FAN'});
  assert.equal(p.plateaus.length,p.tierCount);
  assert.ok(p.minTread>=.55,p.minTread);
  assert.ok(p.plateaus.every((a,i)=>i===0||a.height>p.plateaus[i-1].height));
  assert.ok(p.plateaus[0].end-p.plateaus[0].start > p.plateaus.at(-1).end-p.plateaus.at(-1).start);
 });
}
test('ASYMMETRIC is an actual off-axis peak rather than renamed HALF_FAN',()=>{
 const a=gableProfile({mode:'ASYMMETRIC'}),b=gableProfile({mode:'HALF_FAN'});
 assert.notDeepEqual(a.heights,b.heights);
 assert.ok(a.heights.at(-2)>a.heights.at(-1));
});
for(const [kind,modes] of [['T',['HALF_FAN','HALF_FAN','BILATERAL']],['U',['BILATERAL','BILATERAL','HALF_FAN','HALF_FAN']]]){
 test(`${kind} AUTO uses controlled family diversity, not all one profile`,()=>{
  const model=buildTU({kind});assert.equal(model.validation.ok,true,model.validation.issues.join(';'));
  assert.deepEqual(gables(model).map(x=>x.profileMode),modes);
  assert.deepEqual([...new Set(gables(model).map(x=>x.profileMode))].sort(),['BILATERAL','HALF_FAN']);
  assert.ok(gables(model).every(q=>q.width===3.54&&q.minTread>=.49&&q.surfaceDetail==='PLAIN'));
  assert.ok(gables(model).every(q=>q.facadeWorldFace===q.outerFace&&q.decoratedWorldFace===null));
 });
 test(`${kind}: full gables are always a single manifold-intent wall body, never two overlapping halves`,()=>{
  const m=buildTU({kind});
  for(const q of gables(m)){
   const stem=q.arm==='main'?`gable-main-${q.direction===1?'positive':'negative'}`:`branch-${q.branchCenter}/gable-wing-positive`;
   const walls=m.parts.filter(x=>x.id.includes(`${stem}/MH-01/wall-body/`));
   assert.equal(walls.length,1);
   assert.ok(near(walls[0].bounds().min[1],.025));
  }
 });
 test(`${kind}: optional deliberate all-bilateral and all-half-fan selections remain valid`,()=>{
  for(const gableStyle of ['BILATERAL','HALF_FAN']){
   const m=buildTU({kind,gableStyle});assert.equal(m.validation.ok,true,m.validation.issues.join(';'));
   assert.ok(gables(m).every(q=>q.profileMode===gableStyle));
  }
 });
}
test('U courtyard pair are true reflected physical profiles with independent outward facing',()=>{
 const m=buildTU({kind:'U',gableSurface:GABLE_SURFACE.LEGACY_DECORATED});
 assert.ok(m.validation.ok,m.validation.issues.join(';'));
 const wings=gables(m).filter(q=>q.arm==='wing');assert.deepEqual(wings.map(q=>q.handedness),[1,-1]);
 assert.deepEqual(wings.map(q=>q.profileMode),['HALF_FAN','HALF_FAN']);
 assert.ok(wings.every(q=>q.decoratedWorldFace===q.outerFace));
 for(let i=0;i<wings[0].localCapSpans.length;i++){
  const l=wings[0].localCapSpans[i],r=wings[1].localCapSpans.at(-1-i);
  assert.ok(near(l.start,-r.end)&&near(l.end,-r.start)&&near(l.level,r.level));
 }
});
for(const halfSpan of [1.3,1.55,1.7]){
 test(`physical walls and foundation adapt to roof halfSpan ${halfSpan} without cap mismatch`,()=>{
  for(const kind of ['T','U']){
   const m=buildTU({kind,halfSpan,...(kind==='U'&&halfSpan>1.6?{wingSpacing:3.65,mainHalfLength:6.2}:{})});assert.ok(m.validation.ok,m.validation.issues.join(';'));
   const expected=2*halfSpan+.44;
   assert.ok(gables(m).every(q=>near(q.width,expected)));
   assert.ok(gables(m).every(q=>q.minTread>=.49));
   assert.ok(gables(m).every(q=>q.gableProfileContract===GABLE_PROFILE_CONTRACT));
  }
 });
}
test('forged physical cap geometry is rejected although metadata stays unchanged',()=>{
 const m=buildTU({kind:'T'}),cap=m.parts.find(x=>x.id.includes('branch-0/gable-wing-positive/')&&x.id.includes('/cap-stone/'));
 assert.ok(cap);for(let i=0;i<cap.positions.length;i+=3)cap.positions[i]+=.065;
 const r=checkTUContract(m.params,m.parts,[],m.metadata.foundation);
 assert.ok(r.issues.includes('gable_cap_contract_mismatch'));
});
test('forged profile metadata tier/width, or lost diversity is rejected',()=>{
 const m=buildTU({kind:'T'}),q=gables(m)[0];q.minTread=.23;q.width+=.22;
 const r=checkTUContract(m.params,m.parts,[],m.metadata.foundation);
 assert.ok(r.issues.includes('gable_tread_too_short'));
 assert.ok(r.issues.includes('gable_effective_width_mismatch'));
});
test('invalid dimensions and mode are rejected without silent variant fallback',()=>{
 for(const width of [0,-2,Infinity,NaN,6])assert.throws(()=>gableProfile({width}),/invalid/);
 for(const mode of ['SLOPE',null])assert.throws(()=>gableProfile({mode}),/invalid/);
 for(const gableStyle of ['UNKNOWN',null,3])assert.throws(()=>buildTU({gableStyle}),/invalid/);
 assert.throws(()=>buildStyledGablePlacement('wing',5,1,{width:0}),/invalid/);
});
test('same input always produces identical full mesh positions and normals',()=>{
 const keys=m=>JSON.stringify(m.parts.map(x=>[x.id,x.positions,x.normals]));
 for(const kind of ['T','U'])assert.equal(keys(buildTU({kind})),keys(buildTU({kind})));
});
