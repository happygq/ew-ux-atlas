import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildTU,checkTUContract} from '../site/src/t-u-roof.js';
import {buildStyledGablePlacement,bilateralProfile,GABLE_PROFILE_CONTRACT,GABLE_SURFACE} from '../site/src/gable-profile.js';

const eps=1e-7;
const eq=(x,y)=>Math.abs(x-y)<eps;
const mats=g=>g.parts.filter(m=>!m.id.includes('gable-'));
const hashNonGable=g=>{
 const h=createHash('sha256');
 for(const m of mats(g)){h.update(m.id+'\n'+m.material);h.update(JSON.stringify(m.positions));h.update(JSON.stringify(m.normals));}
 return h.digest('hex');
};
const hashes=[
 [{kind:'T'},'90e6a0a964349987dd6ac53f58c50355782c886b6839aa3b37bbe3e78ae6c9fd'],
 [{kind:'U'},'6279a2b6435070c39f324040e16cd409389151a8b627d8c9f4165d91757829a6'],
 [{kind:'U',mainHalfLength:6.3,wingSpacing:3.6,wingLength:6.1,halfSpan:1.45},'5e9da24e110634218468c9c69211f8b239769380e8d729b5e995213c12309d0c']
];

for(const [o,expected] of hashes){
 test(`${o.kind} baseline: roof skin, tiled courses, junctions, drainage and non-gable scene untouched`,()=>{
  for(const style of ['AUTO','ASYMMETRIC','BILATERAL']){
   const g=buildTU({...o,gableStyle:style});
   assert.equal(hashNonGable(g),expected,`unexpected non-gable change for ${style}`);
   assert.ok(g.validation.ok,g.validation.issues.join(';'));
  }
 });
}

test('BILATERAL profile: seven continuous plateaus, one center cap and mirrored levels',()=>{
 const a=bilateralProfile(),b=bilateralProfile();
 assert.deepEqual(a,b);
 assert.equal(a.plateaus.length,7);assert.equal(a.centerPlateau.start,-a.centerPlateau.end);
 assert.ok(a.centerPlateau.start<0&&a.centerPlateau.end>0);
 for(let i=0;i<7;i++){
  const p=a.plateaus[i],q=a.plateaus[6-i];
  assert.ok(eq(p.start,-q.end)&&eq(p.end,-q.start)&&eq(p.height,q.height));
 }
 assert.ok(a.polygon.length>=10);
 // A single full cross-sectional wall; no overlapping duplicated half-wall at x=0.
 const module=buildStyledGablePlacement('wing',5.2,1,{profile:'BILATERAL'});
 assert.equal(module.parts.filter(m=>m.id.includes('/wall-body/')).length,1);
 assert.equal(module.metadata.gableProfileContract,GABLE_PROFILE_CONTRACT);
 const body=module.parts.find(m=>m.id.includes('/wall-body/'));
 assert.ok(body.count>0&&body.positions.every(Number.isFinite));
});

test('T AUTO: branch front and the two main ends use physically bilateral gables',()=>{
 const g=buildTU({kind:'T'});
 assert.equal(g.validation.ok,true);
 assert.equal(g.metadata.foundation.gableMeta.length,3);
 assert.ok(g.metadata.foundation.gableMeta.every(x=>x.profileMode==='BILATERAL'));
 for(const x of g.metadata.foundation.gableMeta)assert.equal(x.localCapSpans.length,7);
 assert.equal(g.seams.valleyCount,2);
});

test('U AUTO: two wing gables are mirrored in cross-axis independently of +Z exterior decorations',()=>{
 const g=buildTU({kind:'U'}),wing=g.metadata.foundation.gableMeta.filter(q=>q.arm==='wing');
 assert.equal(g.validation.ok,true);assert.deepEqual(wing.map(q=>q.handedness),[1,-1]);
 assert.ok(wing.every(q=>q.profileMode==='ASYMMETRIC'));
 assert.ok(wing.every(q=>q.decoratedWorldFace===q.outerFace));
 assert.ok(wing.every(q=>eq(q.floorY,.025)));
 assert.equal(g.seams.valleyCount,4);
});

test('ASYMMETRIC option is an explicit creative variation and is not silently mirrored',()=>{
 const g=buildTU({kind:'U',gableStyle:'ASYMMETRIC'});
 assert.equal(g.validation.ok,true);
 const wing=g.metadata.foundation.gableMeta.filter(q=>q.arm==='wing');
 assert.deepEqual(wing.map(q=>q.handedness),[1,1]);
 assert.ok(wing.every(q=>q.profileMode==='ASYMMETRIC'));
});

test('BILATERAL option forms a complete single body for every T/U end wall',()=>{
 const g=buildTU({kind:'U',gableStyle:'BILATERAL'});
 assert.equal(g.validation.ok,true);
 assert.equal(g.metadata.foundation.gableMeta.length,4);
 assert.ok(g.metadata.foundation.gableMeta.every(x=>x.profileMode==='BILATERAL'));
});

test('bad gable style/handedness or unsupported axis is rejected',()=>{
 for(const gableStyle of ['MIRROR',null,1,{},'manual'])assert.throws(()=>buildTU({gableStyle}),/invalid gableStyle/);
 for(const params of [
 ['roof',3,1,{profile:'BILATERAL'}],['wing',3,0,{profile:'BILATERAL'}],
 ['wing',3,1,{profile:'INVALID'}],['wing',3,1,{profile:'ASYMMETRIC',handedness:0}]
 ])assert.throws(()=>buildStyledGablePlacement(...params),/invalid/);
});

test('U forged outer wall geometry that breaks mirror is detected, even when metadata is unchanged',()=>{
 const g=buildTU({kind:'U'});
 const m=g.parts.find(m=>m.id.includes('branch-3.38/')&&m.id.includes('/curved-cap/'));
 assert.ok(m);m.positions[0]+=.08;
 const result=checkTUContract(g.params,g.parts,[],g.metadata.foundation);
 assert.ok(result.issues.includes('U_wing_geometry_not_mirrored_curved-cap'));
});

test('T forged centered stair top geometry is rejected by the physical symmetry contract',()=>{
 const g=buildTU({kind:'T'});
 const m=g.parts.find(m=>m.id.includes('branch-0/')&&m.id.includes('/wall-body/'));
 assert.ok(m);m.positions[0]+=.09;
 const result=checkTUContract(g.params,g.parts,[],g.metadata.foundation);
 assert.ok(result.issues.includes('T_center_geometry_not_bilateral_wall-body'));
});

test('U forced bilateral surface irregularity is detected on an actual wall mesh',()=>{
 const g=buildTU({kind:'U',gableStyle:'BILATERAL'});
 const m=g.parts.find(m=>m.id.includes('branch-3.38/')&&m.id.includes('/wall-body/'));
 assert.ok(m);m.positions[0]+=.12;
 const result=checkTUContract(g.params,g.parts,[],g.metadata.foundation);
 assert.ok(result.issues.includes('bilateral_geometry_not_symmetric_wing_wall-body'));
});

const FORBIDDEN=['exposed-masonry','masonry-joints','raised-step-piers','step-corner-reveals','endwall-corner-reveal'];
for(const kind of ['T','U']){
 test(`${kind} default PURE wall has zero baked-on brick and vertical pilaster geometry`,()=>{
  const model=buildTU({kind});assert.equal(model.validation.ok,true,model.validation.issues.join(','));
  assert.equal(model.params.gableSurface,'PLAIN');
  for(const name of FORBIDDEN)assert.equal(model.parts.some(p=>p.id.includes('/gable-')&&p.id.includes(`/MH-01/${name}/`)),false,name);
  assert.ok(model.parts.some(p=>p.id.includes('/gable-')&&p.id.includes('/curved-cap/')));
  assert.ok(model.metadata.foundation.gableMeta.every(p=>p.surfaceDetail==='PLAIN'));
 });
 test(`${kind} LEGACY_DECORATED option stays available without altering roof/eave meshes`,()=>{
  const plain=buildTU({kind});const legacy=buildTU({kind,gableSurface:GABLE_SURFACE.LEGACY_DECORATED});
  assert.equal(legacy.validation.ok,true,legacy.validation.issues.join(','));
  assert.equal(hashNonGable(legacy),hashNonGable(plain));
  assert.ok(legacy.parts.some(p=>p.id.includes('/MH-01/exposed-masonry/')));
  assert.ok(legacy.parts.some(p=>p.id.includes('/MH-01/raised-step-piers/')));
  assert.ok(legacy.metrics.triangles>plain.metrics.triangles);
 });
 test(`${kind} injected ornament rejected from PLAIN even with valid metadata`,()=>{
  const model=buildTU({kind});const ornament=buildTU({kind,gableSurface:'LEGACY_DECORATED'}).parts.find(m=>m.id.includes('/MH-01/exposed-masonry/'));
  assert.ok(ornament);model.parts.push(ornament);
  const check=checkTUContract(model.params,model.parts,[],model.metadata.foundation);
  assert.ok(check.issues.includes('plain_gable_has_applied_ornament'));
 });
}
test('unsupported surface style cannot silently fall back to decorative defaults',()=>{
 for(const gableSurface of [null,'MIXED',1,'raw',{}])assert.throws(()=>buildTU({gableSurface}),/invalid gableSurface/);
 assert.throws(()=>buildStyledGablePlacement('wing',5,1,{surfaceDetail:'UNKNOWN'}),/invalid gable surfaceDetail/);
});
