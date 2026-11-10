/**
 * EW-UX / Layered Gable Streetscape v0.1
 * Actual multi-building geometry; no free-floating gable props or copied photos.
 * Local world: X along ridge, Y vertical, Z across roof span.
 * Rows are indexed in depth along X from front to back in the signature camera.
 * All choices are deterministic design grammar, not random scatter.
 */
import {Mesh,PartSet} from './mesh.js';
import {buildStyledGablePlacement,GABLE_SURFACE} from './gable-profile.js';

export const STREETSCAPE_CONTRACT='ew/ux/layered-gable-streetscape/v0.1';
export const COMPOSITIONS=['BALANCED','HERO','DENSE'];
const FLOOR=.025;
const R=x=>Math.round(x*1e7)/1e7;
const TEMPLATES={
 BALANCED:[
  {x:3.05,z:-4.80,role:'foreground',height:.90,span:1.47,length:3.65,profile:'HALF_FAN',hand:1},
  {x:3.15,z: 2.35,role:'foreground',height:.96,span:1.47,length:3.62,profile:'BILATERAL',hand:1},
  {x:-1.60,z:-2.35,role:'middle',height:1.16,span:1.60,length:4.25,profile:'BILATERAL',hand:1},
  {x:-1.65,z: 4.20,role:'middle',height:1.07,span:1.51,length:4.12,profile:'HALF_FAN',hand:-1},
  {x:-6.70,z:-5.25,role:'background',height:1.04,span:1.49,length:4.10,profile:'BILATERAL',hand:1},
  {x:-6.72,z: 1.05,role:'background',height:1.11,span:1.56,length:4.22,profile:'HALF_FAN',hand:1},
  {x:-6.80,z: 7.05,role:'background',height:.97,span:1.42,length:3.95,profile:'BILATERAL',hand:1},
 ],
 HERO:[
  {x:3.15,z:-5.05,role:'foreground',height:.86,span:1.45,length:3.72,profile:'HALF_FAN',hand:-1},
  {x:3.02,z: 3.48,role:'foreground',height:.91,span:1.46,length:3.60,profile:'HALF_FAN',hand:1},
  {x:-1.45,z:-2.15,role:'middle',height:1.26,span:1.69,length:4.12,profile:'BILATERAL',hand:1},
  {x:-1.52,z: 4.20,role:'middle',height:1.18,span:1.62,length:4.12,profile:'BILATERAL',hand:1},
  {x:-6.66,z:-4.30,role:'background',height:.99,span:1.46,length:4.08,profile:'HALF_FAN',hand:1},
  {x:-6.65,z: 2.20,role:'background',height:1.04,span:1.52,length:3.97,profile:'BILATERAL',hand:1},
 ],
 DENSE:[
  {x:3.07,z:-7.55,role:'foreground',height:.84,span:1.30,length:3.60,profile:'HALF_FAN',hand:1},
  {x:3.06,z:-1.97,role:'foreground',height:.94,span:1.36,length:3.62,profile:'BILATERAL',hand:1},
  {x:3.08,z: 4.32,role:'foreground',height:.88,span:1.33,length:3.54,profile:'HALF_FAN',hand:-1},
  {x:-1.54,z:-5.32,role:'middle',height:1.08,span:1.45,length:4.00,profile:'HALF_FAN',hand:-1},
  {x:-1.60,z: .65,role:'middle',height:1.18,span:1.57,length:4.02,profile:'BILATERAL',hand:1},
  {x:-1.48,z: 6.65,role:'middle',height:1.05,span:1.44,length:4.14,profile:'HALF_FAN',hand:1},
  {x:-6.60,z:-7.15,role:'background',height:.94,span:1.34,length:3.95,profile:'HALF_FAN',hand:1},
  {x:-6.68,z:-1.76,role:'background',height:1.13,span:1.48,length:4.05,profile:'BILATERAL',hand:1},
  {x:-6.64,z: 4.44,role:'background',height:1.04,span:1.38,length:4.04,profile:'HALF_FAN',hand:-1},
  {x:-6.66,z:10.0,role:'background',height:.98,span:1.36,length:4.10,profile:'BILATERAL',hand:1},
 ]
};
function assertNumber(v,name,a,b){if(!Number.isFinite(v)||v<a||v>b)throw new RangeError(`${name} must be in [${a},${b}]`)}
/** Visible proscenium can adjust with bounded controls but footprints always revalidate. */
export function planStreetscape({composition='BALANCED',stagger=1,heightContrast=1,depthGap=1}={}){
 if(!COMPOSITIONS.includes(composition))throw new RangeError('invalid composition');
 assertNumber(stagger,'stagger',0,1.5);assertNumber(heightContrast,'heightContrast',0,1.2);assertNumber(depthGap,'depthGap',.85,1.25);
 const names={BALANCED:'均衡层叠',HERO:'主墙突出',DENSE:'密集鳞次'};
 const plans=TEMPLATES[composition].map((q,i)=>{
  const row=q.role==='foreground'?0:q.role==='middle'?1:2;
  // Depth control translates row center without scaling the actual buildings.
  const x=R(q.x+(1-row)*2.2*(depthGap-1));
  // Stagger has a neutral baseline at 1, cannot introduce arbitrary grid jitter.
  const z=R(1+(q.z-1)*.72+(1-stagger)*(.30*Math.sin(i*2.14+row)));
  // Maintain a common plinth elevation even with roof and wall height variation.
  const scale=R(1+(q.height-1)*heightContrast);
  return {...q,index:i,row,x,z,scale,width:R(2*q.span+.44)};
 });
 return {contract:STREETSCAPE_CONTRACT,composition,name:names[composition],placements:plans,controls:{stagger,heightContrast,depthGap}};
}
function addRoof(out,length,span){
 const eave=1.70,ridge=2.76,level=z=>eave+(ridge-eave)*(1-Math.abs(z)/span);
 const roof=out.part('slateDark','roof-skin');const under=out.part('cut','roof-underside');
 for(const sign of [-1,1]){
  roof.grid((u,v)=>[-length/2+u*length,level(sign*v*span),sign*v*span],18,12);
  under.grid((u,v)=>[-length/2+u*length,level(sign*v*span)-.095,sign*v*span],18,12);
 }
 const shingles=out.part('slate','rolled-tile-courses');
 const cols=Math.max(9,Math.ceil(length/.32));
 for(let j=0;j<cols;j++){
  const pitch=length/cols,center=-length/2+(j+.5)*pitch;
  for(const sign of [-1,1]){
   shingles.grid((u,v)=>{
    const z=sign*(span*(1-u));const x=center+(v-.5)*pitch*.94;
    const arch=Math.sin(Math.PI*v)**2*.064;
    return [x,level(z)+.022+arch,z];
   },14,6);
  }
 }
 const ridgeCap=out.part('slateLight','continuous-ridge');
 ridgeCap.tube([[-length/2-.02,ridge+.09,0],[length/2+.02,ridge+.09,0]],.085,10);
 const fascia=out.part('woodDark','eave-front-brown'),rafter=out.part('wood','eave-rafter-tail');
 for(const sign of [-1,1]){
  fascia.beam([-length/2,eave-.12,sign*span],[length/2,eave-.12,sign*span],.16,.19);
  for(let j=0;j<=cols;j++){
   const x=-length/2+length*j/cols;
   rafter.beam([x,eave-.24,sign*(span-.32)],[x,eave-.25,sign*(span+.12)],.10,.08);
  }
 }
}
function createBuilding(plan){
 const out=new PartSet(`layered-${plan.index}`),{length,span,profile,hand}=plan;
 const podium=out.part('platform','bearing-podium');podium.box(0,-.176,0,length+.55,.36,2*span+.62);
 out.part('platformTop','finished-floor').box(0,.010,0,length+.55,.03,2*span+.62);
 const walls=out.part('plaster','continuous-side-walls');
 const edge=out.part('plasterShade','wall-cornice');
 for(const sign of [-1,1]){
  walls.box(0,(1.64+FLOOR)/2,sign*(span-.12),length,1.64-FLOOR,.24);
  edge.box(0,1.615,sign*(span-.12),length,.06,.31);
 }
 addRoof(out,length,span);
 // Both X-facing end walls remain at their actual roof-span-end plane.
 // World-X mirror retains Z; it MUST NOT flip silhouette Z handedness.
 const ends=[];
 for(const dir of [-1,1]){
  const end=dir*length/2;
  const g=buildStyledGablePlacement('main',end,dir,{profile,handedness:hand,
   surfaceDetail:GABLE_SURFACE.PLAIN,width:plan.width,role:plan.role});
  out.parts.push(...g.parts);ends.push({...g.metadata});
  const f=out.part('platform','wall-footing');f.box(end+dir*.19,-.18,0,.45,.35,plan.width+.12);
  out.part('platformTop','wall-footing-floor').box(end+dir*.19,.01,0,.45,.03,plan.width+.12);
 }
 const scaled=[];
 for(const source of out.parts){
  const m=new Mesh(`row-${plan.row}/${plan.index}/${source.id}`,source.material);
  const project=i=>[R(source.positions[i]+plan.x),R(FLOOR+(source.positions[i+1]-FLOOR)*plan.scale),R(source.positions[i+2]+plan.z)];
  for(let i=0;i<source.positions.length;i+=9)m.tri(project(i),project(i+3),project(i+6));
  scaled.push(m);
 }
 return {parts:scaled,ends,footprint:{x0:plan.x-length/2-.25,x1:plan.x+length/2+.25,
   z0:plan.z-span-.31,z1:plan.z+span+.31},plan};
}
const footprintsOverlap=(a,b)=>Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0)>.025&&Math.min(a.z1,b.z1)-Math.max(a.z0,b.z0)>.025;
export function validateStreetscape(plan,buildings){
 const issues=[];
 for(let i=0;i<buildings.length;i++)for(let j=i+1;j<buildings.length;j++)if(footprintsOverlap(buildings[i].footprint,buildings[j].footprint))issues.push(`overlap_${i}_${j}`);
 const roles=new Set(plan.placements.map(x=>x.role));if(roles.size!==3)issues.push('missing_depth_layers');
 const silhouettes=new Set(plan.placements.map(x=>`${x.profile}_${x.hand}`));if(silhouettes.size<3)issues.push('no_gable_diversity');
 const middle=plan.placements.filter(x=>x.role==='middle').map(x=>x.scale);if(!middle.length||Math.max(...middle)<1.01)issues.push('missing_middle_dominant_gable');
 for(const building of buildings){
  const {plan:p,parts,ends}=building;
  if(ends.length!==2||ends.some(g=>g.handedness!==p.hand||g.surfaceDetail!==GABLE_SURFACE.PLAIN||g.floorY!==FLOOR))issues.push(`gable_orientation_${p.index}`);
  const plaster=parts.find(m=>m.id.includes('/wall-body/'));
  if(!plaster||Math.abs(plaster.bounds().min[1]-FLOOR)>1e-6)issues.push(`gable_floor_${p.index}`);
  if(parts.some(m=>m.positions.some(v=>!Number.isFinite(v))||m.normals.some(v=>!Number.isFinite(v))))issues.push(`nonfinite_${p.index}`);
  if(parts.some(m=>m.positions.length!==m.normals.length))issues.push(`normals_${p.index}`);
  const external=parts.filter(m=>m.id.includes('/exposed-masonry/')||m.id.includes('/raised-step-piers/'));
  if(external.length)issues.push(`ornament_violation_${p.index}`);
 }
 return {ok:issues.length===0,issues,contract:STREETSCAPE_CONTRACT,depthBands:roles.size,profileVariants:silhouettes.size,buildingCount:buildings.length};
}
export function buildStreetscape(input={}){
 const plan=planStreetscape(input),buildings=plan.placements.map(createBuilding),parts=buildings.flatMap(b=>b.parts);
 const validation=validateStreetscape(plan,buildings);
 const triangles=parts.reduce((s,p)=>s+p.count,0);
 return {id:'EW-G205A',plan,buildings,parts,items:[{module:{parts},pos:[0,0,0],plinth:false}],
  metrics:{buildings:buildings.length,triangles,meshes:parts.length},validation};
}
