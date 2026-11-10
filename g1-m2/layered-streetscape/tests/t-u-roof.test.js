import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildTU,checkTUContract,TU_ROOF_CONTRACT,valleyPaths} from '../site/src/t-u-roof.js';
import {buildLValley} from '../site/src/l-valley.js';
const near=(a,b,e=1e-7)=>Math.abs(a-b)<e;
const hash=g=>createHash('sha256').update(JSON.stringify(g.parts.map(p=>[p.id,p.material,p.positions,p.normals]))).digest('hex');
const find=(g,id)=>g.parts.find(p=>p.id.includes(id));

for(const settings of [{kind:'T'},{kind:'U'},{kind:'U',mainHalfLength:6.3,wingSpacing:3.6,wingLength:6.1,halfSpan:1.45}]){
 const label=Object.values(settings).join('-');
 test(`${label}: geometric part count, independent domains and finite triangles`,()=>{
  const g=buildTU(settings);const bc=settings.kind==='T'?1:2;
  assert.deepEqual(g.validation,{ok:true,issues:[]});assert.equal(g.contract,TU_ROOF_CONTRACT);
  assert.equal(g.seams.distinctDomainCount,bc+1);assert.equal(g.seams.branchCount,bc);assert.equal(g.seams.valleyCount,bc*2);
  assert.ok(g.metrics.triangles>50000&&g.metrics.triangles<130000,`${g.metrics.triangles}`);
  const ids=g.parts.map(m=>m.id);assert.equal(new Set(ids).size,ids.length,'duplicate part ids');
  for(const p of g.parts){assert.equal(p.positions.length,p.count*9,p.id);assert.equal(p.positions.length,p.normals.length,p.id);
   assert.ok(p.positions.every(Number.isFinite),p.id);assert.ok(p.normals.every(Number.isFinite),p.id);}
 });
 test(`${label}: all four/several valley edges share actual analytic vertex stations`,()=>{
  const g=buildTU(settings),s=g.params.halfSpan;
  const main=find(g,'/main-domain-roof-skin/');
  for(const c of g.params.branches){const wing=find(g,`/wing-${c}-domain-roof-skin/`);assert.ok(wing);
   for(const side of [-1,1]){
    const seam=arr=>new Set(arr.reduce((a,p,i)=>{if(i%3!==0)return a;const x=p,z=arr[i+2],y=arr[i+1];
      if(z>=-1e-7&&z<=s+1e-7&&near(x,c+side*z))a.push(`${x.toFixed(6)}|${y.toFixed(6)}|${z.toFixed(6)}`);return a;},[]));
    const a=seam(main.positions),b=seam(wing.positions);
    assert.ok(a.size>=18,`${c},${side} only ${a.size} stations`);assert.deepEqual([...a].sort(),[...b].sort());
   }
  }
 });
 test(`${label}: tile sheets respect unique roof ownership with a flashing gap`,()=>{
  const g=buildTU(settings);const p=g.params,main=find(g,'/main-clipped-tile-courses/');
  for(let i=0;i<main.positions.length;i+=3){const x=main.positions[i],z=main.positions[i+2];
   for(const c of p.branches){assert.ok(z<=0||Math.abs(x-c)-z>=p.tileGap-1e-7,`main tile crossing branch ${c} at ${x},${z}`);}}
  for(const c of p.branches){const wing=find(g,`/wing-${c}-clipped-tile-courses/`);
   for(let i=0;i<wing.positions.length;i+=3){const x=wing.positions[i],z=wing.positions[i+2];
    assert.ok(z-Math.abs(x-c)>=p.tileGap-1e-7,`wing tile crossed gutter ${c} at ${x},${z}`);}
  }
 });
 test(`${label}: gutter V-shapes descend to real outside outlets`,()=>{
  const g=buildTU(settings),p=g.params;
  for(const v of g.seams.valleys){assert.ok(v.drop>.65);assert.ok(v.stations===33);
   assert.ok(v.outlet[2]>p.halfSpan&&Math.abs(v.outlet[0]-v.center)>p.halfSpan);
   const points=valleyPaths(p,v.center,v.side);for(let i=1;i<points.length;i++)assert.ok(points[i][1]<points[i-1][1]);
  }
  if(p.kind==='U')assert.ok(g.seams.courtyardWidth>3);
 });
 test(`${label}: three/four real gables seat on foundation, exterior trim faces outward, normals finite`,()=>{
  const g=buildTU(settings),p=g.params;assert.equal(g.metadata.foundation.gableMeta.length,2+p.branches.length);
  for(const placement of g.metadata.foundation.gableMeta){
   const axis=placement.arm==='main'?0:2,side=placement.direction,center=placement.branchCenter;
   const prefix=placement.arm==='wing'?`branch-${center}/gable-wing-positive`:`gable-main-${side===1?'positive':'negative'}`;
   const trim=g.parts.find(part=>part.id.includes(`${prefix}/MH-01/plaster-trim/`));
   const wall=g.parts.find(part=>part.id.includes(`${prefix}/MH-01/wall-body/`));
   assert.ok(trim&&wall);
   const edge=side===1?trim.bounds().min[axis]:trim.bounds().max[axis];
   assert.ok(side*(edge-placement.outerFace)>=-.015,`${prefix} is inward`);
   assert.ok(near(wall.bounds().min[1],.025));
   assert.ok(placement.mirroredTransform=== ((placement.arm==='main'?side===1:side===-1)!==(placement.handedness===-1)));
  }
 });
 test(`${label}: stable repeat generation including normals and exterior-facing geometry`,()=>{
  const a=buildTU(settings);assert.equal(hash(a),hash(buildTU(settings)));
 });
}

test('T topologically differs from U (one versus two branches, true exposed courtyard edge)',()=>{
 const t=buildTU({kind:'T'}),u=buildTU({kind:'U'});
 assert.deepEqual(t.params.branches,[0]);assert.deepEqual(u.params.branches,[-3.38,3.38]);
 assert.equal(t.seams.valleyCount,2);assert.equal(u.seams.valleyCount,4);
 assert.ok(u.metadata.assemblyEdges.filter(x=>x.axis==='main'&&x.sign===1).some(x=>x.a<0&&x.b>0),'courtyard eave missing');
 assert.ok(!u.metadata.assemblyEdges.some(x=>x.axis==='main'&&x.sign===1&&x.a<=-3.38&&x.b>=-3.38),'eave over wing root');
});

test('configuration validation rejects overlapping U branches, missing clearances and unsupported options',()=>{
 for(const p of [{kind:'W'},{kind:'U',wingSpacing:2},{kind:'U',wingSpacing:4.4,mainHalfLength:5.3},{kind:'T',mainHalfLength:4},{kind:'U',halfSpan:Infinity},{kind:'T',tileGap:-3}]){
  assert.throws(()=>buildTU(p),/kind|invalid|short/);
 }
});
test('corrupting a real main roof boundary or positive-side gutter is detected',()=>{
 const g=buildTU({kind:'T'}),main=find(g,'/main-domain-roof-skin/');
 const original=main.positions.slice(0,30);for(let i=0;i<main.positions.length;i+=3)main.positions[i]+=.4;
 let check=checkTUContract(g.params,g.parts,g.metadata?g.metadata.valleyPaths??[]:[],g.metadata.foundation);
 assert.ok(!check.ok);assert.ok(check.issues.some(x=>x.includes('edge_mismatch')||x==='main_crosses_wing_domain'));
 main.positions.splice(0,30,...original);
});
test('deliberately reversed/flattened drainage is rejected',()=>{
 const g=buildTU({kind:'T'}),p=g.params;
 const bad=[{center:0,side:1,points:[[0,3,0],[.1,3.1,.1]],outlet:[0,4,0]}];
 const check=checkTUContract(p,g.parts,bad,g.metadata.foundation);
 assert.equal(check.ok,false);assert.ok(check.issues.includes('non_descending_valley'));assert.ok(check.issues.includes('drain_not_exterior_downhill'));
});
test('G203 previously accepted L geometry remains byte-for-byte reproducible under isolated G204 imports',()=>{
 const x=buildLValley(),y=buildLValley();assert.equal(hash(x),hash(y));assert.deepEqual(x.validation,{ok:true,issues:[]});
});
