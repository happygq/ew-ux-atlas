/**
 * G204 T/U junctions: non-overlapping analytic roof domains.
 * Main ridge is global X, branches run positive Z. At each junction j:
 *  - main owns z <= |x-j| (including all negative Z)
 *  - branch owns z >= |x-j|.
 * Their seam comprises TWO downhill courtyard-facing valleys z=|x-j|,
 * not crossing rectangular roof sheets. All measurements in metres.
 * Research only: no WP1.1 / Authority input or mutation.
 */
import {Mesh,PartSet} from './mesh.js';
import {roofY} from './contracts.js';
import {GABLE_ASSEMBLY_CONTRACT} from './l-valley.js';
import {buildStyledGablePlacement,GABLE_PROFILE_CONTRACT,GABLE_STYLE,GABLE_SURFACE} from './gable-profile.js';
import {lerp,noise} from './math.js';

export const TU_ROOF_CONTRACT='ew/ux/t-u-junctions/v0.3';
const EPS=1e-7;
const round=(x,n=8)=>Math.round(x*10**n)/10**n;
const FLOOR=.025, S=.0;
const DEFAULT={kind:'T',gableStyle:'AUTO',gableSurface:GABLE_SURFACE.PLAIN,halfSpan:1.55,mainHalfLength:5.3,wingLength:5.2,wingSpacing:3.38,
 eaveHeight:1.68,rise:1.02,tilePitch:.32,tileRow:.37,tileArch:.082,tileGap:.16};

function parse(input){
 const p={...DEFAULT,...input};
 if(!['T','U'].includes(p.kind))throw new RangeError('kind must be T or U');
 if(!Object.values(GABLE_STYLE).includes(p.gableStyle))throw new RangeError('invalid gableStyle');
 if(!Object.values(GABLE_SURFACE).includes(p.gableSurface))throw new RangeError('invalid gableSurface');
 for(const [k,[a,b]] of Object.entries({halfSpan:[1.3,1.7],mainHalfLength:[4.8,8],wingLength:[4.1,7.5],wingSpacing:[2.8,4.7],eaveHeight:[1.45,2.05],rise:[.75,1.30],tilePitch:[.28,.37],tileRow:[.32,.44],tileArch:[.06,.12],tileGap:[.105,.22]})){
  if(!Number.isFinite(p[k])||p[k]<a||p[k]>b)throw new RangeError(`invalid ${k}`);
 }
 if(p.kind==='U'&&(p.wingSpacing<=p.halfSpan+.65 || p.mainHalfLength-p.wingSpacing<p.halfSpan+.36))throw new RangeError('U-wing spacing or terminal main roof clearance invalid');
 if(p.kind==='T'&&p.mainHalfLength<p.halfSpan+1.8)throw new RangeError('T main roof too short');
 return {...p,branches:p.kind==='T'?[0]:[-p.wingSpacing,p.wingSpacing]};
}
const Y=(p,dist)=>roofY({halfSpan:p.halfSpan,eaveHeight:p.eaveHeight,rise:p.rise},Math.abs(dist));
const TOP=p=>Y(p,0);
const part=(out,mat,name)=>out.part(mat,name);
function uniqueSorted(values){return [...new Set(values.map(v=>round(v,10)))].sort((a,b)=>a-b)}
function splits(a,b,stations){return [a,...stations.filter(x=>x>a+1e-9&&x<b-1e-9),b].sort((x,y)=>x-y)};
function clip(poly,fn){
 const output=[];for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],fa=fn(a),fb=fn(b),ai=fa>=-1e-9,bi=fb>=-1e-9;
  if(ai)output.push(a);
  if(ai!==bi){const t=fa/(fa-fb);output.push({x:a.x+t*(b.x-a.x),z:a.z+t*(b.z-a.z)});}
 }
 const out=[];for(const q of output)if(!out.length||Math.hypot(q.x-out.at(-1).x,q.z-out.at(-1).z)>1e-9)out.push(q);
 if(out.length>1&&Math.hypot(out[0].x-out.at(-1).x,out[0].z-out.at(-1).z)<1e-9)out.pop();
 return out;
}
function acceptedPoly(poly,p,domain,branch,clearance=0){
 if(domain==='wing')return clip(clip(poly,q=>q.z-(q.x-branch)-clearance),q=>q.z+(q.x-branch)-clearance);
 // Main domain is the union of the two OUTER halfspaces at each junction.
 // Each elementary x-slice has already been split at the branch center.
 let out=poly,mid=poly.reduce((n,q)=>n+q.x,0)/poly.length;
 for(const center of p.branches){
  if(Math.abs(mid-center)>p.halfSpan+clearance+.3)continue;
  const side=mid<center?-1:1;
  out=clip(out,q=>side*(q.x-center)-q.z-clearance);
  if(out.length<3)break;
 }
 return out;
}
function emit(mesh,poly,yfn,p,domain,branch,clearance=0){
 const valid=acceptedPoly(poly,p,domain,branch,clearance);if(valid.length<3)return;
 const q=valid.map(c=>[round(c.x,9),round(yfn(c.x,c.z),9),round(c.z,9)]);
 for(let i=1;i+1<q.length;i++){
  const a=q[0],b=q[i],c=q[i+1];const signed=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
  if(Math.abs(signed)<1e-11)continue;
  if(signed>0)mesh.tri(a,b,c);else mesh.tri(a,c,b);
 }
}
function grid(mesh,x0,x1,z0,z1,nx,nz,yfn,p,domain,branch=0,clearance=0){
 for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
  const x0i=lerp(x0,x1,i/nx),x1i=lerp(x0,x1,(i+1)/nx),z0j=lerp(z0,z1,j/nz),z1j=lerp(z0,z1,(j+1)/nz);
  // Both triangle families reference exactly the same analytic plane value.
  emit(mesh,[{x:x0i,z:z0j},{x:x1i,z:z0j},{x:x1i,z:z1j}],yfn,p,domain,branch,clearance);
  emit(mesh,[{x:x0i,z:z0j},{x:x1i,z:z1j},{x:x0i,z:z1j}],yfn,p,domain,branch,clearance);
 }
}
function buildShell(out,p){
 const main=part(out,'slateDark','main-domain-roof-skin');
 const mainUnder=part(out,'cut','main-domain-underside');
 const cuts=uniqueSorted([-p.mainHalfLength,p.mainHalfLength,...p.branches.flatMap(c=>[c-p.halfSpan,c,c+p.halfSpan])]);
 for(let i=0;i<cuts.length-1;i++){
  const [xa,xb]=[cuts[i],cuts[i+1]],nx=(Math.abs(xb-xa-p.halfSpan)<1e-7?24:Math.max(4,Math.ceil((xb-xa)/.065)));
  for(const [z0,z1] of [[-p.halfSpan,0],[0,p.halfSpan]]){
   grid(main,xa,xb,z0,z1,nx,24,(x,z)=>Y(p,z)+.015,p,'main');
   grid(mainUnder,xa,xb,z0,z1,nx,24,(x,z)=>Y(p,z)-.108,p,'main');
  }
 }
 for(const center of p.branches){
  const wing=part(out,'slateDark',`wing-${center}-domain-roof-skin`);
  const underside=part(out,'cut',`wing-${center}-domain-underside`);
  const s=p.halfSpan;
  for(const [xa,xb] of [[center-s,center],[center,center+s]]){
   grid(wing,xa,xb,0,s,24,24,(x,z)=>Y(p,x-center)+.015,p,'wing',center);
   grid(underside,xa,xb,0,s,24,24,(x,z)=>Y(p,x-center)-.108,p,'wing',center);
   grid(wing,xa,xb,s,p.wingLength,24,Math.ceil((p.wingLength-s)/.065),(x,z)=>Y(p,x-center)+.015,p,'wing',center);
   grid(underside,xa,xb,s,p.wingLength,24,Math.ceil((p.wingLength-s)/.065),(x,z)=>Y(p,x-center)-.108,p,'wing',center);
  }
 }
}
function buildTiles(out,p){
 const main=part(out,'slate','main-clipped-tile-courses'),lip=part(out,'slateEdge','main-tile-drip-edges');
 for(let col=Math.floor(-p.mainHalfLength/p.tilePitch)-1;col<=Math.ceil(p.mainHalfLength/p.tilePitch)+1;col++){
  const center=col*p.tilePitch,a=Math.max(-p.mainHalfLength,center-p.tilePitch*.475),b=Math.min(p.mainHalfLength,center+p.tilePitch*.475);
  if(b-a<.008)continue;
  const sub=splits(a,b,p.branches.flatMap(c=>[c-p.halfSpan,c,c+p.halfSpan]));
  for(let k=0;k<sub.length-1;k++){
   const xa=sub[k],xb=sub[k+1];if(xb-xa<.002)continue;
   for(const sign of [-1,1])for(let r=0;r<Math.ceil(p.halfSpan/p.tileRow);r++){
    const lo=Math.max(.035,r*p.tileRow-.018),hi=Math.min(p.halfSpan,(r+1)*p.tileRow+.036);if(hi-lo<.005)continue;
    const h=(x,z)=>Y(p,z)+.065+p.tileArch*Math.sqrt(Math.max(0,1-((x-center)/(p.tilePitch*.475))**2))+.009*noise(`main:${col}:${r}:${sign}`);
    grid(main,xa,xb,sign*lo,sign*hi,4,3,h,p,'main',0,p.tileGap);
    grid(lip,xa,xb,sign*(hi-.022),sign*hi,4,1,(x,z)=>h(x,z)-.009,p,'main',0,p.tileGap);
   }
  }
 }
 for(const center of p.branches){
  const tile=part(out,'slate',`wing-${center}-clipped-tile-courses`);
  const tileLip=part(out,'slateEdge',`wing-${center}-tile-drip-edges`);
  for(let col=-1;col<=Math.ceil(p.wingLength/p.tilePitch)+1;col++){
   const zmid=col*p.tilePitch,a=Math.max(0,zmid-p.tilePitch*.475),b=Math.min(p.wingLength,zmid+p.tilePitch*.475);if(b-a<.008)continue;
   for(const sign of [-1,1])for(let r=0;r<Math.ceil(p.halfSpan/p.tileRow);r++){
    const lo=Math.max(.035,r*p.tileRow-.018),hi=Math.min(p.halfSpan,(r+1)*p.tileRow+.036);if(hi-lo<.005)continue;
    const h=(x,z)=>Y(p,x-center)+.065+p.tileArch*Math.sqrt(Math.max(0,1-((z-zmid)/(p.tilePitch*.475))**2))+.009*noise(`wing:${center}:${col}:${r}:${sign}`);
    grid(tile,center+sign*lo,center+sign*hi,a,b,3,4,h,p,'wing',center,p.tileGap);
    grid(tileLip,center+sign*(hi-.022),center+sign*hi,a,b,1,4,(x,z)=>h(x,z)-.009,p,'wing',center,p.tileGap);
   }
  }
 }
}
export function valleyPaths(p,center,side){
 const n=32,path=[];for(let i=0;i<=n;i++){const u=p.halfSpan*i/n;path.push([round(center+side*u,8),round(Y(p,u)+.015,8),round(u,8)]);}return path;
}
function buildValleys(out,p){
 const paths=[];
 for(const center of p.branches)for(const side of [-1,1]){
  const label=`wing-${center}-${side===-1?'left':'right'}`;
  const surface=part(out,'slateEdge',`${label}-V-trough`);
  const trim=part(out,'slateDark',`${label}-trough-edges`);
  const spout=part(out,'slateDark',`${label}-drain`);
  const N=44,w=.14;
  // U-shaped pan section: both edges track their raised adjacent roof surfaces,
  // while the channel floor is lower and descends from the ridge junction.
  surface.grid((u,v)=>{
   const t=lerp(.018,p.halfSpan-.018,u),q=(v*2-1)*w;
   const x=center+side*t+q/Math.SQRT2,z=t-side*q/Math.SQRT2;
   const parent=Math.max(Y(p,z),Y(p,x-center));
   return [x, parent+.023-(1-Math.abs(q)/w)*.047,z];
  },N,6);
  for(const dir of [-1,1]){
   const line=[];for(let i=0;i<=N;i++){
    const t=lerp(.018,p.halfSpan-.018,i/N),q=dir*w;
    const x=center+side*t+q/Math.SQRT2,z=t-side*q/Math.SQRT2;
    line.push([x,Math.max(Y(p,z),Y(p,x-center))+.025,z]);
   }
   trim.tube(line,.021,7);
  }
  const end=p.halfSpan-.018,y=Y(p,end)+.004;
  const drain=[[center+side*(end-.17),y+.11,end-.17],
   [center+side*end,y,end],[center+side*(end+.12),y-.11,end+.12],[center+side*(end+.28),y-.19,end+.28]];
  spout.tube(drain,.068,10);
  paths.push({center,side,points:valleyPaths(p,center,side),outlet:drain.at(-1),label});
 }
 return paths;
}
function buildRidges(out,p){
 const caps=part(out,'slateLight','single-continuous-main-ridge');
 const keys=part(out,'slateDark','ridge-crown-cross-laps');
 const y=TOP(p)+.16;
 caps.tube([[-p.mainHalfLength,y,0],[p.mainHalfLength,y,0]],.135,13);
 for(let x=-p.mainHalfLength+.17;x<p.mainHalfLength-.1;x+=.32){keys.tube([[x,-.065+y,-.12],[x,y+.09,0],[x,y-.065,.12]],.022,7);}
 for(const center of p.branches){
  const wing=part(out,'slateLight',`wing-${center}-continuous-ridge`);
  wing.tube([[center,y,0],[center,y,p.wingLength+.05]],.133,13);
  const node=part(out,'slateEdge',`wing-${center}-three-way-ridge-junction`);
  node.tube([[center-.12,y,0],[center,y+.125,.035],[center+.12,y,0]],.085,12);
  const finial=part(out,'slateDark',`wing-${center}-ridge-finial`);
  finial.tube([[center,y,p.wingLength],[center,y+.09,p.wingLength+.13],[center,y+.17,p.wingLength+.19]],.07,10);
 }
}
function eaveSegments(p){
 const s=p.halfSpan,cut=p.branches.flatMap(c=>[c-s,c+s]);
 const edges=[{axis:'main',sign:-1,a:-p.mainHalfLength,b:p.mainHalfLength}];
 const marks=uniqueSorted([-p.mainHalfLength,...cut,p.mainHalfLength]);
 for(let i=0;i<marks.length-1;i++){
  const a=marks[i],b=marks[i+1],mid=(a+b)/2;
  if(!p.branches.some(c=>Math.abs(mid-c)<s-1e-8))edges.push({axis:'main',sign:1,a,b});
 }
 for(const center of p.branches)for(const sign of [-1,1])edges.push({axis:'wing',center,sign,a:s,b:p.wingLength});
 return edges;
}
function eaveAt(e,t,p,dOverride=undefined){
 const d=dOverride??e.sign*p.halfSpan;
 return e.axis==='main'?[t,Y(p,d)-.15,d]:[e.center+d,Y(p,d)-.15,t];
}
function buildEavesAndWalls(out,p){
 const wood=part(out,'wood','continuous-timber-rafters');
 const fascia=part(out,'woodDark','exposed-eave-fascia');
 const drip=part(out,'slateEdge','contiguous-eave-drip-lines');
 const wall=part(out,'plaster','facade-perimeter-walls');
 const trim=part(out,'plasterShade','facade-cornice');
 const piers=part(out,'plaster','facade-bearing-piers');
 const edges=eaveSegments(p);
 for(const e of edges){
  const a=eaveAt(e,e.a,p),b=eaveAt(e,e.b,p),width=b[0]===a[0]?'z':'x';
  fascia.beam(a,b,.18,.20);drip.tube([a.map((v,k)=>k===1?v+.20:v),b.map((v,k)=>k===1?v+.20:v)],.044,8);
  const d=e.sign*p.halfSpan;
  for(let t=Math.ceil((e.a+.05)/.32)*.32;t<e.b-.04;t+=.32){
   wood.beam(eaveAt(e,t,p,e.sign*(p.halfSpan-.55)),eaveAt(e,t,p,e.sign*(p.halfSpan+.09)),.11,.11);
  }
  // Walls and piers meet the identical floor surface, not an over-ground dummy.
  const tmid=(e.a+e.b)/2,extent=e.b-e.a,wallHeight=1.63-FLOOR;
  const c=eaveAt(e,tmid,p);
  const cy=(1.63+FLOOR)/2;
  if(e.axis==='main'){
   wall.box(c[0],cy,e.sign*(p.halfSpan-.16),extent,wallHeight,.28);
   trim.box(c[0],1.60,e.sign*(p.halfSpan-.16),extent,.073,.34);
  }else{
   wall.box(e.center+e.sign*(p.halfSpan-.16),cy,c[2],.28,wallHeight,extent);
   trim.box(e.center+e.sign*(p.halfSpan-.16),1.60,c[2],.34,.073,extent);
  }
  const supportH=1.57-FLOOR;
  for(let t=e.a+.34;t<e.b-.20;t+=1.4){const c=eaveAt(e,t,p);if(e.axis==='main')piers.box(c[0],(1.57+FLOOR)/2,e.sign*(p.halfSpan-.16),.13,supportH,.36);
  else piers.box(e.center+e.sign*(p.halfSpan-.16),(1.57+FLOOR)/2,c[2],.36,supportH,.13);}
 }
 return edges;
}
function buildFloorGables(out,p){
 const s=p.halfSpan;
 const stone=part(out,'platform','T-U-continuous-stone-podium');
 const finish=part(out,'platformTop','T-U-finished-floor');
 const all=[[-p.mainHalfLength,p.mainHalfLength,-s,s],...p.branches.map(c=>[c-s,c+s,s,p.wingLength])];
 for(const [xa,xb,za,zb] of all){stone.box((xa+xb)/2,-.18,(za+zb)/2,xb-xa,.35,zb-za);finish.box((xa+xb)/2,.01,(za+zb)/2,xb-xa,.03,zb-za);}
 const gableMeta=[];
 for(const item of [{axis:'main',end:-p.mainHalfLength,dir:-1},{axis:'main',end:p.mainHalfLength,dir:1},...p.branches.map(c=>({axis:'wing',end:p.wingLength,dir:1,center:c}))]){
  let {axis,end,dir,center=0}=item;
  // One coherent family, two profile roles: main axes retain strong bilateral rhythm,
  // secondary gables extend as HALF_FAN. Courtyard wing pairs mirror one another.
  // Effective width follows the actual roof span, not the legacy 3.6m mesh template.
  const width=round(2*p.halfSpan+.44,8),style=p.gableStyle;
  const profile=style==='BILATERAL'?'BILATERAL':style==='HALF_FAN'?'HALF_FAN':
   style==='ASYMMETRIC'?'ASYMMETRIC':
   axis==='wing'?(p.kind==='T'?'BILATERAL':'HALF_FAN'):
   p.kind==='T'?'HALF_FAN':'BILATERAL';
  const handedness=(style!=='ASYMMETRIC'&&axis==='wing'&&p.kind==='U'&&center>0)?-1:1;
  const role=axis==='wing'?(p.kind==='T'?'PRIMARY_AXIS':'COURTYARD_WING'):
   p.kind==='T'?'SECONDARY_END':'MAIN_END';
  const g=buildStyledGablePlacement(axis,end,dir,{profile,handedness,surfaceDetail:p.gableSurface,width,stepRise:(p.kind==='U'&&axis==='wing'?.31:.40),role});
  // Wing gables share the same floor datum, only their perpendicular X station moves.

  if(axis==='wing'){for(const m of g.parts){m.id=`branch-${center}/${m.id}`;if(center!==0)for(let i=0;i<m.positions.length;i+=3)m.positions[i]+=center;}}
  out.parts.push(...g.parts);
  const b=part(out,'platform',`gable-${axis}-${center}-${end}-bearing-stone`);
  const f=part(out,'platformTop',`gable-${axis}-${center}-${end}-bearing-floor`);
  if(axis==='main'){
   const x=end+dir*.19;b.box(x,-.18,0,.38,.35,width+.15);f.box(x,.01,0,.38,.03,width+.15);
  }else{
   const z=end+dir*.19;b.box(center,-.18,z,width+.15,.35,.38);f.box(center,.01,z,width+.15,.03,.38);
  }
  gableMeta.push({...g.metadata,branchCenter:center,worldEnd:end+dir*.38});
 }
 return {gableMeta,foundationFootprint:all};
}
function seamVertices(mesh,c,side,s){
 const a=new Set();for(let i=0;i<mesh.positions.length;i+=3){const x=mesh.positions[i],y=mesh.positions[i+1],z=mesh.positions[i+2];
  if(z>=-EPS&&z<=s+EPS&&Math.abs(x-(c+side*z))<EPS){a.add(`${round(x,6)}|${round(y,6)}|${round(z,6)}`);}}
 return a;
}
export function checkTUContract(p,parts,paths,foundation){
 const issues=[],s=p.halfSpan;
 const main=parts.find(q=>q.id.includes('/main-domain-roof-skin/'));
 if(!main)issues.push('main_roof_missing');
 for(const c of p.branches){
  const wing=parts.find(q=>q.id.includes(`/wing-${c}-domain-roof-skin/`));
  if(!wing){issues.push('wing_roof_missing');continue;}
  for(const side of [-1,1]){
   const A=seamVertices(main,c,side,s),B=seamVertices(wing,c,side,s);
   if(A.size<18||B.size<18||A.size!==B.size||[...A].some(v=>!B.has(v)))issues.push(`joint_${c}_${side}_edge_mismatch`);
  }
 }
 for(const pt of parts.filter(x=>x.id.includes('domain-roof-skin'))){
  if(!pt.positions.every(Number.isFinite)||!pt.normals.every(Number.isFinite))issues.push('nonfinite_roof');
 }
 // Domain ownership checks on individual triangles, not merely analytic probes.
 if(main)for(let i=0;i<main.positions.length;i+=3){const x=main.positions[i],z=main.positions[i+2];
  if(z>EPS&&p.branches.some(c=>Math.abs(x-c)<z-EPS))issues.push('main_crosses_wing_domain');}
 for(const c of p.branches){const wing=parts.find(x=>x.id.includes(`/wing-${c}-domain-roof-skin/`));if(!wing)continue;
  for(let i=0;i<wing.positions.length;i+=3){const x=wing.positions[i],z=wing.positions[i+2];if(z+EPS<Math.abs(x-c))issues.push('wing_crosses_main_domain');}
 }
 const outlets=[];
 for(const v of paths){
  let drop=Y(p,0)-Y(p,s);
  if(drop<.50)issues.push('insufficient_valley_drop');
  for(let i=1;i<v.points.length;i++)if(v.points[i][1]>=v.points[i-1][1]-1e-7)issues.push('non_descending_valley');
  const e=v.outlet;
  if(e[2]<=s||Math.abs(e[0]-v.center)<=s||e[1]>=v.points.at(-1)[1])issues.push('drain_not_exterior_downhill');
  outlets.push(e);
 }
 const floor=parts.find(x=>x.id.includes('/T-U-finished-floor/'));
 if(!floor||Math.abs(floor.bounds().max[1]-FLOOR)>EPS)issues.push('floor_datum');
 for(const id of ['facade-perimeter-walls','facade-bearing-piers']){
  const m=parts.find(x=>x.id.includes('/'+id+'/'));if(!m||Math.abs(m.bounds().min[1]-FLOOR)>EPS)issues.push('wall_or_pier_floating');
 }
 // Every gable has a verified outside face and complete pedestal bearing;
 // decoration is optional and must not be used as the orientation anchor. Count and match by branch identity, not by ID prefix alone.
 for(const placement of foundation.gableMeta){
  const {arm,direction,innerFace,outerFace,branchCenter}=placement,axis=arm==='main'?0:2;
  const label=direction===1?'positive':'negative';
  const stem=arm==='wing'?`branch-${branchCenter}/gable-${arm}-${label}`:`gable-${arm}-${label}`;
  const findPart=id=>parts.find(x=>x.id.includes(`${stem}/MH-01/${id}/`));
  const wall=findPart('wall-body'),masonry=findPart('exposed-masonry'),cornice=findPart('plaster-trim');
  const footing=parts.find(x=>x.id.includes(`/gable-${arm}-${branchCenter}-${innerFace}-bearing-floor/`));
  const bearing=parts.find(x=>x.id.includes(`/gable-${arm}-${branchCenter}-${innerFace}-bearing-stone/`));
  if(!wall||!cornice||!footing||!bearing){issues.push('gable_or_footing_missing');continue;}
  const forbidden=['exposed-masonry','masonry-joints','raised-step-piers','step-corner-reveals','endwall-corner-reveal'];
  if(p.gableSurface===GABLE_SURFACE.PLAIN&&forbidden.some(id=>parts.some(m=>m.id.includes(`${stem}/MH-01/${id}/`))))issues.push('plain_gable_has_applied_ornament');
  if(p.gableSurface===GABLE_SURFACE.LEGACY_DECORATED&&!masonry)issues.push('legacy_gable_ornament_missing');
  if(placement.surfaceDetail!==p.gableSurface)issues.push('gable_surface_metadata_mismatch');
  if(Math.abs(wall.bounds().min[1]-FLOOR)>EPS)issues.push('gable_floor_gap');
  // Compare REAL cap-stone mesh bounds to localCapSpans, not only the
  // declarative profile metadata. The outer two caps have 7cm end lips.
  const crossAxis=arm==='main'?2:0,crossCenter=arm==='main'?0:branchCenter;
  const caps=parts.filter(x=>x.id.includes(`${stem}/MH-01/cap-stone/`))
   .sort((a,b)=>a.bounds().min[crossAxis]-b.bounds().min[crossAxis]);
  const declared=placement.localCapSpans;
  if(caps.length!==declared.length)issues.push('gable_cap_count_mismatch');
  else for(let i=0;i<caps.length;i++){
   const bounds=caps[i].bounds();
   const min=round(bounds.min[crossAxis]-crossCenter+(i===0?.07:0),6);
   const max=round(bounds.max[crossAxis]-crossCenter-(i===caps.length-1?.07:0),6);
   if(Math.abs(min-declared[i].start)>1e-5||Math.abs(max-declared[i].end)>1e-5||
      Math.abs(bounds.max[1]-declared[i].level-.078)>1e-5)
    issues.push('gable_cap_contract_mismatch');
  }

  const extreme=direction===1?wall.bounds().max[axis]:wall.bounds().min[axis];
  if(Math.abs(extreme-outerFace)>EPS)issues.push('gable_outer_plane_mismatch');
  const corniceExtreme=direction===1?cornice.bounds().min[axis]:cornice.bounds().max[axis];
  if(direction*(corniceExtreme-outerFace)<-.016)issues.push('gable_exterior_facing_inward');
  if(masonry){const decoExtreme=direction===1?masonry.bounds().min[axis]:masonry.bounds().max[axis];
   if(direction*(decoExtreme-outerFace)<-.016)issues.push('gable_exterior_facing_inward');}
  const span=axis===0?2:0;
  const fb=footing.bounds(),bb=bearing.bounds();
  const center=axis===0?0:branchCenter;
  if(fb.min[span]>center-placement.width/2+EPS||fb.max[span]<center+placement.width/2-EPS||
     bb.min[span]>center-placement.width/2+EPS||bb.max[span]<center+placement.width/2-EPS||
     Math.abs(fb.max[1]-FLOOR)>EPS||Math.abs(bb.min[1]+.355)>EPS||
     fb.min[axis]>Math.min(innerFace,outerFace)+EPS||fb.max[axis]<Math.max(innerFace,outerFace)-EPS)
   issues.push('gable_no_full_bearing');
 }
 // Physically inspect generated wall/cap mesh, not just declared profile tags.
 const keyAt=(positions,i,axis=-1,center=0,mirror=false)=>{
  const q=positions.slice(i,i+3);
  // Compare coordinates relative to the symmetry axis before quantization.
  // Direct global rounding at e.g. x=3.38 loses sign symmetry at half ticks.
  if(axis>=0){const v=q[axis]-center;q[axis]=(mirror?-1:1)*Math.sign(v)*Math.round(Math.abs(v)*1e8)/1e8;}
  return q.map(v=>Math.sign(v)*Math.round(Math.abs(v)*1e5)/1e5).join('|');
 };
 const profileMeshSet=(prefix,name,axis=-1,center=0,mirror=false)=>{
  const result=new Set();
  for(const m of parts.filter(q=>q.id.startsWith(prefix)&&q.id.includes(`/MH-01/${name}/`)))
   for(let i=0;i<m.positions.length;i+=3)result.add(keyAt(m.positions,i,axis,center,mirror));
  return result;
 };
 const equalSets=(a,b)=>a.size===b.size&&[...a].every(v=>b.has(v));
 const categories=['wall-body','curved-cap','cap-stone','flying-finial',...(p.gableSurface===GABLE_SURFACE.LEGACY_DECORATED?['exposed-masonry']:[])];
 // Symmetry contract is checked on actual generated cap geometry, not only labels.
 const gables=foundation.gableMeta;
 const style=p.gableStyle;
 const expectation=(q)=>style!=='AUTO'?style:
  q.arm==='wing'?(p.kind==='T'?'BILATERAL':'HALF_FAN'):
  p.kind==='T'?'HALF_FAN':'BILATERAL';
 for(const q of gables){
  if(q.profileMode!==expectation(q))issues.push('auto_gable_role_mismatch');
  if(Math.abs(q.width-(2*p.halfSpan+.44))>EPS)issues.push('gable_effective_width_mismatch');
  if(q.minTread<.49-EPS)issues.push('gable_tread_too_short');
  if(q.profileMode==='BILATERAL'&&q.crestWidth<.84-EPS)issues.push('gable_crest_too_narrow');
  const allowed=q.width<3.22?2:q.width<4.55?3:4;
  if(q.profileMode==='BILATERAL'&&q.tierCount!==allowed)issues.push('gable_tier_count_not_width_driven');
  if(q.localCapSpans.some(v=>v.end-v.start<.49-EPS))issues.push('gable_cap_section_too_short');
 }
 if(style==='AUTO'){
  const profiles=new Set(gables.map(x=>x.profileMode));
  if(profiles.size!==2||!profiles.has('HALF_FAN')||!profiles.has('BILATERAL'))issues.push('gable_family_lacks_controlled_diversity');
 }
 if(style==='AUTO'&&p.kind==='T'){
  const mid=gables.find(x=>x.arm==='wing'),ends=gables.filter(x=>x.arm==='main');
  if(!mid||mid.profileMode!=='BILATERAL'||ends.length!==2||ends.some(x=>x.profileMode!=='HALF_FAN')||ends[0].handedness!==ends[1].handedness)issues.push('T_gable_hierarchy_invalid');
 }
 if(style==='AUTO'&&p.kind==='T'){
  const ends=gables.filter(q=>q.arm==='main').sort((a,b)=>a.direction-b.direction);
  if(ends.length===2){
   const a=ends[0].localCapSpans,b=ends[1].localCapSpans;
   if(a.length!==b.length||a.some((q,i)=>Math.abs(q.start-b[i].start)>EPS||Math.abs(q.end-b[i].end)>EPS||Math.abs(q.level-b[i].level)>EPS))
    issues.push('T_terminal_gables_not_worldX_mirrored');
  }
 }
 if(style==='AUTO'&&p.kind==='U'){
  if(gables.filter(q=>q.arm==='wing').some(q=>q.stepRise>=.40)||gables.filter(q=>q.arm==='main').some(q=>q.stepRise!==.40))issues.push('U_open_wings_not_subordinate');
  const left=gables.find(q=>q.arm==='wing'&&q.branchCenter<0),right=gables.find(q=>q.arm==='wing'&&q.branchCenter>0);
  if(!left||!right||left.profileMode!=='HALF_FAN'||right.profileMode!=='HALF_FAN'||left.handedness!==1||right.handedness!==-1)issues.push('U_wing_pair_not_mirrored');
  if(left&&right){const l=left.localCapSpans,r=right.localCapSpans;
   if(l.length!==r.length||l.some((a,i)=>{const b=r.at(-1-i);return !b||Math.abs(a.start+b.end)>EPS||Math.abs(a.end+b.start)>EPS||Math.abs(a.level-b.level)>EPS;}))issues.push('U_wing_cap_profile_mismatch');}
 }
 if(style==='AUTO'&&p.kind==='T'){
  const prefix='branch-0/gable-wing-positive/';
  for(const name of categories){const raw=profileMeshSet(prefix,name,0,0),mirrored=profileMeshSet(prefix,name,0,0,true);
   if(raw.size<6||!equalSets(raw,mirrored))issues.push(`T_center_geometry_not_bilateral_${name}`);}
 }
 if(style==='AUTO'&&p.kind==='U'){
  const neg=`branch-${-p.wingSpacing}/gable-wing-positive/`;
  const pos=`branch-${p.wingSpacing}/gable-wing-positive/`;
  for(const name of categories){const L=profileMeshSet(neg,name,0,0,true),R=profileMeshSet(pos,name);
   if(L.size<6||R.size<6||!equalSets(L,R))issues.push(`U_wing_geometry_not_mirrored_${name}`);}
 }
 if(style==='BILATERAL')for(const g of gables){
  const spans=g.localCapSpans;
  if(g.profileMode!=='BILATERAL'||spans.length!==2*g.tierCount-1||spans.some((q,i)=>{
   const m=spans.at(-1-i);
   return Math.abs(q.start+m.end)>EPS||Math.abs(q.end+m.start)>EPS||Math.abs(q.level-m.level)>EPS;
  }))issues.push('bilateral_gable_profile_invalid');
  const prefix=g.arm==='main'?`gable-main-${g.direction===1?'positive':'negative'}/`:
   `branch-${g.branchCenter}/gable-wing-${g.direction===1?'positive':'negative'}/`;
  const axis=g.arm==='main'?2:0,center=g.arm==='main'?0:g.branchCenter;
  for(const name of categories){const raw=profileMeshSet(prefix,name,axis,center),mirrored=profileMeshSet(prefix,name,axis,center,true);
   if(raw.size<6||!equalSets(raw,mirrored))issues.push(`bilateral_geometry_not_symmetric_${g.arm}_${name}`);}
 }
 if(p.kind==='U' && 2*(p.wingSpacing-p.halfSpan)<1.25)issues.push('courtyard_clearance_insufficient');
 return {ok:issues.length===0,issues:[...new Set(issues)],contract:TU_ROOF_CONTRACT,branchCount:p.branches.length,
  valleyCount:paths.length,valleys:paths.map(v=>({center:v.center,side:v.side,drop:round(Y(p,0)-Y(p,s)),outlet:v.outlet,stations:v.points.length})),
  courtyardWidth:p.kind==='U'?2*(p.wingSpacing-p.halfSpan):null,
  distinctDomainCount:1+p.branches.length};
}
export function buildTU(input={}){
 const p=parse(input),out=new PartSet('G204-TU');
 buildShell(out,p);buildTiles(out,p);const valleyPathsData=buildValleys(out,p);buildRidges(out,p);
 const eaveEdges=buildEavesAndWalls(out,p),foundation=buildFloorGables(out,p);
 const seam=checkTUContract(p,out.parts,valleyPathsData,foundation);
 return {id:'G204-TU',contract:TU_ROOF_CONTRACT,params:p,parts:out.parts,
  items:[{module:{parts:out.parts},pos:[0,0,0],plinth:false,kind:'T-U-roof'}],
  seams:seam,metadata:{stage:'G1-M2-G204',notAuthority:true,gableContract:GABLE_ASSEMBLY_CONTRACT,
   gableProfileContract:GABLE_PROFILE_CONTRACT,gableStyle:p.gableStyle,gableSurface:p.gableSurface,
   branchCenters:p.branches,assemblyEdges:eaveEdges,foundation},metrics:out.metrics(),validation:{ok:seam.ok,issues:seam.issues}};
}
