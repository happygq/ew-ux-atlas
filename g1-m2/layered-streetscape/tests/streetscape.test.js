import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildStreetscape,planStreetscape,validateStreetscape,COMPOSITIONS} from '../site/src/streetscape.js';
import {buildTU} from '../site/src/t-u-roof.js';

const fingerprint=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
for(const composition of COMPOSITIONS){
 test(`${composition}: a genuine three-row architectural cluster has correct grounded mesh`,()=>{
  const m=buildStreetscape({composition});assert.ok(m.validation.ok,m.validation.issues.join('; '));
  assert.equal(m.validation.depthBands,3);assert.ok(m.validation.profileVariants>=3);
  assert.equal(m.buildings.length,m.plan.placements.length);assert.ok(m.metrics.triangles<140000);
  for(const b of m.buildings){
   assert.ok(b.parts.some(x=>x.id.includes('roof-skin')));
   assert.ok(b.parts.some(x=>x.id.includes('continuous-side-walls')));
   assert.ok(b.parts.some(x=>x.id.includes('wall-body')));
   const gable=b.parts.find(x=>x.id.includes('wall-body'));
   assert.ok(Math.abs(gable.bounds().min[1]-.025)<2e-7);
   assert.equal(b.ends[0].handedness,b.ends[1].handedness);
  }
 });
 test(`${composition}: same design inputs reproduce identical geometry`,()=>{
  const a=buildStreetscape({composition}),b=buildStreetscape({composition});
  assert.equal(fingerprint(a.parts.map(x=>x.positions)),fingerprint(b.parts.map(x=>x.positions)));
  assert.equal(fingerprint(a.plan.placements),fingerprint(b.plan.placements));
 });
 test(`${composition}: bounded layout dials preserve semantic and footprint constraints`,()=>{
  for(const settings of [{depthGap:.92,stagger:.5,heightContrast:.8},{depthGap:1.15,stagger:1.5,heightContrast:1.1}]){
   const m=buildStreetscape({composition,...settings});assert.equal(m.validation.ok,true,m.validation.issues.join(';'));
  }
 });
}
test('a built building is never a stand-alone wall prop; side walls, two end-walls, roof and foundation are mandatory',()=>{
 const b=buildStreetscape({composition:'BALANCED'}).buildings[0];
 const parts=b.parts.map(x=>x.id);
 for(const part of ['wall-body','bearing-podium','roof-skin','rolled-tile-courses','finished-floor','continuous-side-walls'])assert.ok(parts.some(x=>x.includes(part)),part);
 assert.equal(parts.filter(x=>x.includes('/wall-body/')).length,2);
});
test('there is no extraneous face decoration in the plain default',()=>{
 for(const kind of COMPOSITIONS){const m=buildStreetscape({composition:kind});assert.ok(m.parts.every(x=>!/(exposed-masonry|raised-step-piers|step-corner-reveals)/.test(x.id)));}
});
test('a profile family uses a balanced bilateral + mirrored single-sided variation instead of a single repeated silhouette',()=>{
 const p=planStreetscape();assert.ok(p.placements.some(x=>x.profile==='BILATERAL'));assert.ok(p.placements.some(x=>x.profile==='HALF_FAN'&&x.hand===1));assert.ok(p.placements.some(x=>x.profile==='HALF_FAN'&&x.hand===-1));
 const mid=p.placements.filter(x=>x.role==='middle').map(x=>x.scale);
 assert.ok(Math.max(...mid)>Math.max(...p.placements.filter(x=>x.role==='foreground').map(x=>x.scale)));
});
test('refuses invalid commands and exposed collision rather than silently allowing them',()=>{
 for(const v of ['x',null,'T'])assert.throws(()=>planStreetscape({composition:v}),/invalid/);
 for(const inp of [{stagger:3},{depthGap:0},{heightContrast:2},{stagger:Infinity}])assert.throws(()=>planStreetscape(inp),/must be/);
 const p=planStreetscape();const m=buildStreetscape();
 const bad=m.buildings.slice();bad[1]={...bad[1],footprint:{...bad[0].footprint}};
 const v=validateStreetscape(p,bad);assert.equal(v.ok,false);assert.ok(v.issues.some(x=>x.startsWith('overlap_')));
});
test('G204 T outer terminal gables are truly mirrored in world X, preserving Z silhouette',()=>{
 const m=buildTU({kind:'T'});assert.ok(m.validation.ok,m.validation.issues.join(';'));
 const left=m.metadata.foundation.gableMeta.find(x=>x.arm==='main'&&x.direction===-1);
 const right=m.metadata.foundation.gableMeta.find(x=>x.arm==='main'&&x.direction===1);
 assert.ok(left&&right);assert.equal(left.handedness,right.handedness);
 assert.deepEqual(left.localCapSpans,right.localCapSpans);
 const quant=x=>Math.round(x*1e5)/1e5;
 const gather=(direction,reflect)=>{
  const prefix=`gable-main-${direction===-1?'negative':'positive'}/`;
  const s=new Set();for(const part of m.parts.filter(x=>x.id.includes(prefix)&&x.id.includes('/MH-01/wall-body/')))
   for(let k=0;k<part.positions.length;k+=3)s.add([quant(reflect?-part.positions[k]:part.positions[k]),quant(part.positions[k+1]),quant(part.positions[k+2])].join('/'));
  return s;
 };
 const a=gather(-1,true),b=gather(1,false);assert.equal(a.size,b.size);assert.ok([...a].every(x=>b.has(x)));
});
test('U open-end gables remain outward-facing and their heights are subordinate to main gables',()=>{
 const m=buildTU({kind:'U'});assert.ok(m.validation.ok,m.validation.issues.join(';'));
 const g=m.metadata.foundation.gableMeta;
 assert.ok(g.filter(x=>x.arm==='wing').every(x=>x.profileMode==='HALF_FAN'&&x.stepRise===.31));
 assert.ok(g.filter(x=>x.arm==='main').every(x=>x.profileMode==='BILATERAL'&&x.stepRise===.4));
 assert.deepEqual(g.filter(x=>x.arm==='wing').map(x=>x.handedness),[1,-1]);
});
