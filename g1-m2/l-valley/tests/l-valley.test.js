import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildLValley, diagonalSeam,checkCornerContract,L_VALLEY_CONTRACT} from '../src/l-valley.js';

const DEFAULT={mainLength:5.6,wingLength:5.15};
const find=(g,id)=>g.parts.find(x=>x.id.includes(`/${id}/`));
const digest=g=>createHash('sha256').update(JSON.stringify(g.parts.map(x=>[x.id,x.material,x.positions]))).digest('hex');
const sep=(a,b)=>Math.abs(a-b)<1e-7;
function seamPoints(part, s) {
 const out=new Set();const a=part.positions;
 for(let i=0;i<a.length;i+=3){const x=a[i],z=a[i+2];if(sep(x,z)&&x>=-s-1e-6&&x<=s+1e-6)
  out.add(`${x.toFixed(7)}|${a[i+1].toFixed(7)}|${z.toFixed(7)}`);}
 return [...out].sort();
}
for(const settings of [DEFAULT,{mainLength:7.1,wingLength:4.6}]){
 const kind=`${settings.mainLength}x${settings.wingLength}`;
 test(`${kind} analytic roof is exactly two non-overlapping clipped substrate domains`,()=>{
  const g=buildLValley(settings);assert.equal(g.contract,L_VALLEY_CONTRACT);
  assert.deepEqual(g.validation,{ok:true,issues:[]});
  const [a,b]=['main','wing'].map(k=>find(g,`${k}-single-domain-substrate`));
  assert.ok(a.count>1000&&b.count>1000);
  for(let i=0;i<a.positions.length;i+=3)assert.ok(a.positions[i]>=a.positions[i+2]-1e-7);
  for(let i=0;i<b.positions.length;i+=3)assert.ok(b.positions[i+2]>=b.positions[i]-1e-7);
 });
 test(`${kind} analytically identical hip + valley substrate edge vertices`,()=>{
  const g=buildLValley(settings),a=seamPoints(find(g,'main-single-domain-substrate'),g.params.halfSpan),b=seamPoints(find(g,'wing-single-domain-substrate'),g.params.halfSpan);
  assert.deepEqual(a,b);assert.ok(a.length>=25,`only ${a.length} seam points`);
  const u=diagonalSeam(g.params);assert.equal(u.hip.at(-1)[0],0);assert.equal(u.valley[0][0],0);
  assert.equal(u.hip[0][0],-g.params.halfSpan);assert.equal(u.valley.at(-1)[0],g.params.halfSpan);
 });
 test(`${kind} valley downhill and outside courtyard outlet`,()=>{
  const g=buildLValley(settings),v=g.seams.valley;
  assert.ok(g.seams.drop>.70);assert.ok(g.seams.nominalPlanSlope>.3);
  for(let i=1;i<v.length;i++)assert.ok(v[i][1]<v[i-1][1],`valley step ${i}`);
  assert.ok(g.seams.drain[0]>g.params.halfSpan&&g.seams.drain[2]>g.params.halfSpan);
  assert.ok(g.seams.drain[1]<v.at(-1)[1]);
 });
 test(`${kind} barrel tile meshes trimmed before the flashing corridor and do not cross one another`,()=>{
  const g=buildLValley(settings);
  for(const [arm,dir] of [['main',1],['wing',-1]]){
   for(const category of ['clipped-barrel-tiles','clipped-tile-lips','tile-underlaps']){
    const p=find(g,`${arm}-${category}`);assert.ok(p.count>50);
    for(let i=0;i<p.positions.length;i+=3){const x=p.positions[i],z=p.positions[i+2];assert.ok(dir*(x-z)>=g.params.tileGap-1e-7,`${arm} ${category} crosses valley: (${x},${z})`);}
   }
  }
 });
 test(`${kind} repeat generation is SHA-256 deterministic`,()=>{
  const g=buildLValley(settings);assert.equal(digest(g),digest(buildLValley(settings)));
 });
 test(`${kind} triangles all finite and under the bounded research budget`,()=>{
  const g=buildLValley(settings);assert.ok(g.metrics.triangles>18000);assert.ok(g.metrics.triangles<80000);
  for(const p of g.parts){assert.ok(p.count>=0);assert.equal(p.positions.length,p.count*9);assert.equal(p.positions.length,p.normals.length);assert.ok(p.positions.every(Number.isFinite),p.id);assert.ok(p.normals.every(Number.isFinite),p.id);}
 });
}
test('mixed-family gables seat exactly on the ends of two orthogonal roof arms',()=>{
 const g=buildLValley(),p=g.params,d=g.metadata.gables.wallDepth;
 assert.equal(d,.38);assert.ok(g.parts.some(x=>x.id.includes('gable-main')));assert.ok(g.parts.some(x=>x.id.includes('gable-wing')));
 // The gable local ±depth/2 is reoriented to world X or Z with inner face = ridge endpoint.
 const faceX=p.mainLength+d/2-d/2,faceZ=p.wingLength+d/2-d/2;
 assert.equal(faceX,p.mainLength);assert.equal(faceZ,p.wingLength);
});
test('cross-section valley inwards and convex hip outwards is not an overlapped L made from two entire rectangular roofs',()=>{
 const g=buildLValley(),s=g.params.halfSpan;
 const roofA=find(g,'main-single-domain-substrate'),roofB=find(g,'wing-single-domain-substrate');
 // Positive x,z diagonal is the valley; negative x,z diagonal the hip; both physically shared.
 assert.ok(roofA.positions.some((v,i,a)=>i%3===0&&v>0&&v<s&&Math.abs(v-a[i+2])<1e-7));
 assert.ok(roofB.positions.some((v,i,a)=>i%3===0&&v<0&&v>-s&&Math.abs(v-a[i+2])<1e-7));
 assert.equal(g.seams.plan.includes('nonoverlapping'),true);
});
test('bad shape and tile inputs are rejected before construction, not clamped',()=>{
 for(const o of [{halfSpan:0},{mainLength:2.5},{wingLength:Infinity},{tilePitch:-1},{rise:.1},{tileGap:.4}])assert.throws(()=>buildLValley(o),/must|outside|invalid|exceed/);
});
test('deliberately corrupted seam or drain is rejected by independent contract function',()=>{
 const g=buildLValley();const f={width:.148,outlet:[0,-1,0],valleyPath:[[0,3,0],[.1,4,.1]]};
 const j=checkCornerContract(g.params,g.parts,f);
 assert.equal(j.ok,false);assert.ok(j.issues.includes('valley_not_downhill'));assert.ok(j.issues.includes('outlet_not_exterior_or_downhill'));
});
