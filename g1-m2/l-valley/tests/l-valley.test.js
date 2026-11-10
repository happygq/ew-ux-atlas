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

// G203 owner finding: gable and L-house were in different vertical datums.
for(const settings of [DEFAULT,{mainLength:7.1,wingLength:4.6}]){
 test(`gable wall-bottom and stone base seats align with L-house finished floor (${settings.mainLength} m)`,()=>{
  const g=buildLValley(settings);
  const finish=find(g,'L-floor-stone-surface').bounds().max[1];
  assert.ok(sep(finish,.025));
  assert.ok(sep(g.metadata.gables.finishedFloorY,finish));
  assert.ok(sep(g.metadata.gables.seatOffsetY,-.255));
  for(const arm of ['main','wing']){
   const wall=g.parts.find(p=>p.id.includes(`gable-${arm}-positive/MH-01/wall-body/`));
   const stone=g.parts.find(p=>p.id.includes(`gable-${arm}-positive/MH-01/stone-socle/`));
   assert.ok(wall&&stone);
   assert.ok(sep(wall.bounds().min[1],finish),`${arm} wall floating over finished floor`);
   const b=stone.bounds();assert.ok(b.min[1]<=finish&&b.max[1]>=finish);
  }
 });
}
test('contract independently detects gable vertical misregistration',()=>{
 const g=buildLValley(),wall=g.parts.find(p=>p.id.includes('gable-main-positive/MH-01/wall-body/'));
 assert.ok(wall);
 for(let i=1;i<wall.positions.length;i+=3)wall.positions[i]+=.20;
 const result=checkCornerContract(g.params,g.parts,{width:g.seams.flashingWidth,
   outlet:g.seams.drain,valleyPath:g.seams.valley.map(v=>[v[0],v[1]-.028,v[2]])});
 assert.ok(result.issues.includes('gable_floor_datum_mismatch'),result.issues.join(','));
});

// G203 v0.3 user findings: (1) visual gable base/platform gap above grade;
// (2) asymmetric exposed gray-brick façade must face OUTWARD at both ends.
import {buildGablePlacement,GABLE_ASSEMBLY_CONTRACT} from '../src/l-valley.js';
const contractProof=g=>checkCornerContract(g.params,g.parts,{width:g.seams.flashingWidth,
 outlet:g.seams.drain,valleyPath:g.seams.valley.map(v=>[v[0],v[1]-.028,v[2]])});
const surfacePoints=part=>{
 const a=part.positions,res=[];
 for(let i=0;i<a.length;i+=3)res.push(a.slice(i,i+3).map(v=>v.toFixed(7)).join(','));
 return res.sort();
};
for(const settings of [DEFAULT,{mainLength:7.1,wingLength:4.6}]){
 const label=`${settings.mainLength}x${settings.wingLength}`;
 test(`${label} both perimeter wall and all structural piers physically touch finished floor`,()=>{
  const g=buildLValley(settings),floor=find(g,'L-floor-stone-surface').bounds().max[1];
  for(const id of ['L-perimeter-plaster-walls','structural-piers']){
   const part=find(g,id);assert.ok(part,id);assert.ok(sep(part.bounds().min[1],floor),id);
  }
  assert.equal(g.validation.ok,true,g.validation.issues.join(','));
 });
 test(`${label} full-width gable foundation supports the exterior leaf outside roof plane`,()=>{
  const g=buildLValley(settings),d=g.metadata.gables.wallDepth;
  for(const [arm,end] of [['main',g.params.mainLength],['wing',g.params.wingLength]]){
   const stone=find(g,`gable-${arm}-bearing-foundation`),top=find(g,`gable-${arm}-bearing-finished-floor`);
   assert.ok(stone&&top);assert.equal(stone.count,12);assert.equal(top.count,12);
   const axis=arm==='main'?0:2,across=arm==='main'?2:0;
   const body=g.parts.find(p=>p.id.includes(`gable-${arm}-positive/MH-01/wall-body/`));
   const masonry=g.parts.find(p=>p.id.includes(`gable-${arm}-positive/MH-01/exposed-masonry/`));
   assert.ok(body&&masonry);
   assert.ok(sep(body.bounds().min[axis],end));
   assert.ok(sep(body.bounds().max[axis],end+d));
   assert.ok(sep(body.bounds().min[1],.025));
   assert.ok(masonry.bounds().min[axis]>end+d-.015,'decorative brick must not be on the inner plane');
   const b=top.bounds();assert.ok(b.min[across]<=-1.8&&b.max[across]>=1.8,'bearing width fully covers gable');
  }
  assert.deepEqual(contractProof(g).issues,[]);
 });
 test(`${label} contract rejects deliberately lifted perimeter wall, not just gable`,()=>{
  const g=buildLValley(settings),wall=find(g,'L-perimeter-plaster-walls');
  for(let i=1;i<wall.positions.length;i+=3)wall.positions[i]+=.125;
  assert.ok(contractProof(g).issues.includes('house_wall_or_pier_floor_gap'));
 });
 test(`${label} contract rejects inward-shifted decorative brick masonry`,()=>{
  const g=buildLValley(settings),brick=g.parts.find(x=>x.id.includes('gable-main-positive/MH-01/exposed-masonry/'));
  for(let i=0;i<brick.positions.length;i+=3)brick.positions[i]-=.38;
  assert.ok(contractProof(g).issues.includes('decorated_exterior_faces_inward'));
 });
 test(`${label} contract rejects missing physical end footing`,()=>{
  const g=buildLValley(settings);const footing=find(g,'gable-main-bearing-finished-floor');
  // Lifts only the bearing: it no longer seats on floor even though the gable's wallSeat matches.
  for(let i=1;i<footing.positions.length;i+=3)footing.positions[i]+=.2;
  assert.ok(contractProof(g).issues.includes('gable_footing_missing_or_unlevel'));
 });
}
for(const axis of ['main','wing']){
 test(`opposite ${axis} roof ends are exact mirrored masonry/gable placements (Y unaffected)`,()=>{
  const positive=buildGablePlacement(axis,6,1),negative=buildGablePlacement(axis,-6,-1);
  const k=axis==='main'?0:2;
  assert.equal(positive.metadata.outward[k],1);assert.equal(negative.metadata.outward[k],-1);
  assert.equal(positive.metadata.decoratedWorldFace,6+.38);
  assert.equal(negative.metadata.decoratedWorldFace,-6-.38);
  assert.equal(positive.parts.length,negative.parts.length);
  for(let i=0;i<positive.parts.length;i++){
   const pa=positive.parts[i],pb=negative.parts[i];assert.equal(pa.material,pb.material);
   const mirrored=[];for(let j=0;j<pa.positions.length;j+=3){let q=pa.positions.slice(j,j+3);q[k]*=-1;mirrored.push(q.map(v=>v.toFixed(7)).join(','));}
   assert.deepEqual(mirrored.sort(),surfacePoints(pb),`${axis} ${pa.id} differs after mirroring`);
  }
 });
 test(`outward wall face and exposed masonry aligned at ${axis} +/- exterior sides`,()=>{
  for(const dir of [-1,1]){
   const g=buildGablePlacement(axis,dir*4,dir),k=axis==='main'?0:2;
   const bricks=g.parts.find(x=>x.id.includes('exposed-masonry'));
   const walls=g.parts.find(x=>x.id.includes('/wall-body/'));
   assert.ok(bricks&&walls);
   const outer=dir===1?walls.bounds().max[k]:walls.bounds().min[k];
   const nearest=dir===1?bricks.bounds().min[k]:bricks.bounds().max[k];
   assert.ok(dir*(nearest-outer)>-.015,`masonry should be outside for ${axis} ${dir}`);
   assert.ok(sep(walls.bounds().min[1],.025));
  }
 });
}
test('v0.3 new architectural assembly contract is declared in model metadata',()=>{
 const g=buildLValley();assert.equal(g.metadata.gables.contract,GABLE_ASSEMBLY_CONTRACT);
 for(const m of g.metadata.gables.placements)assert.equal(m.decoratedWorldFace,m.outerFace);
});

// Golden first-26 parts are the entire owner-accepted roof+hip+valley+eave build
// from v0.2; shell/gable corrections must never mutate them.
for(const [settings,expected] of [
 [DEFAULT,'e75e94ca74800c721e941fc3dbd2ffb346286494ec8f172a9ceef8e8afa494e0'],
 [{mainLength:7.1,wingLength:4.6},'55550cb318d46f25b2a113ca1e97b4546c0c9ae6d2327eb8605c84bccb28a2e9']
]){
 test(`${settings.mainLength}x${settings.wingLength} accepted roof, valley, hip, and eave vertices+normals remain byte-identical to v0.2`,()=>{
  const g=buildLValley(settings);
  const data=g.parts.slice(0,26).map(p=>[p.id,p.material,p.positions,p.normals]);
  const hash=createHash('sha256').update(JSON.stringify(data)).digest('hex');
  assert.equal(hash,expected);
 });
}
test('gable outer wall face normals follow the outward direction after reflection',()=>{
 for(const arm of ['main','wing'])for(const direction of [-1,1]){
  const g=buildGablePlacement(arm,direction*4,direction),body=g.parts.find(p=>p.id.includes('/wall-body/'));
  const k=arm==='main'?0:2,outer=g.metadata.outerFace;
  let count=0,inverted=0;
  for(let i=0;i<body.positions.length;i+=3){
   if(Math.abs(body.positions[i+k]-outer)>1e-8)continue;
   const n=direction*body.normals[i+k];
   if(n>.98)count++;
   if(n<-.98)inverted++;
  }
  assert.ok(count>20,`${arm} ${direction}: no outward oriented face`);
  assert.equal(inverted,0,`${arm} ${direction}: mirrored face winding inverted`);
 }
});
test('outer wall and pier roof-side upper elevations preserved while bottom seats reach the same finished floor',()=>{
 const g=buildLValley(),wall=find(g,'L-perimeter-plaster-walls'),piers=find(g,'structural-piers');
 assert.ok(sep(wall.bounds().min[1],.025));assert.ok(sep(wall.bounds().max[1],1.63));
 assert.ok(sep(piers.bounds().min[1],.025));assert.ok(sep(piers.bounds().max[1],1.67));
});
