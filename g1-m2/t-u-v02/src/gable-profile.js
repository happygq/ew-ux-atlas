/**
 * EW-UX G204 v0.2 — symmetry-aware Huizhou gable composition.
 * Geometry remains independent of roof topology and Authority.
 * Two reflected half profiles produce ONE continuous wall, not two overlapped walls.
 * Gable cross-section handedness (local X) is distinct from decorated facade
 * orientation (local +Z always maps to the architectural outside).
 */
import {PartSet,Mesh,tileCap} from './mesh.js';
import {buildGablePlacement} from './l-valley.js';

export const GABLE_PROFILE_CONTRACT='ew/ux/gable-profile-composition/v0.2';
export const GABLE_STYLE=Object.freeze({AUTO:'AUTO',BILATERAL:'BILATERAL',ASYMMETRIC:'ASYMMETRIC'});
export const GABLE_SURFACE=Object.freeze({PLAIN:'PLAIN',LEGACY_DECORATED:'LEGACY_DECORATED'});
const LEGACY_ORNAMENTS=['raised-step-piers','step-corner-reveals','exposed-masonry','masonry-joints','endwall-corner-reveal'];
export const GABLE_WIDTH=3.6,GABLE_DEPTH=.38,FINISHED_FLOOR_Y=.025;
const P={width:GABLE_WIDTH,depth:GABLE_DEPTH,localFloor:.28,wallHeight:2.30,stepRise:.45,capWidth:.24};
const EPS=1e-8;
const round=x=>Math.round(x*1e8)/1e8;

/** Mirror one HALF-height pattern about x=0 with ONE center plateau, no central seam. */
export function bilateralProfile({width=P.width,baseY=P.localFloor,wallHeight=P.wallHeight,stepRise=P.stepRise}={}){
 if(!Number.isFinite(width)||width<2||width>5||!Number.isFinite(baseY)||!Number.isFinite(wallHeight)||!Number.isFinite(stepRise)||stepRise<=0)throw new RangeError('invalid bilateral profile');
 const half=(width-.72)/6, edge=-width/2;
 const heights=[0,1,2,3,2,1,0].map(n=>round(wallHeight+n*stepRise));
 const breaks=[edge,edge+half,edge+2*half,edge+3*half,edge+3*half+.72,
  edge+4*half+.72,edge+5*half+.72,width/2].map(x=>round(x));
 const plateaus=heights.map((height,i)=>({start:breaks[i],end:breaks[i+1],height}));
 const polygon=[[breaks[0],baseY],[breaks.at(-1),baseY],[breaks.at(-1),heights.at(-1)]];
 for(let i=plateaus.length-1;i>=0;i--){
  polygon.push([breaks[i],heights[i]]);
  if(i>0)polygon.push([breaks[i],heights[i-1]]);
 }
 return {plateaus,polygon,axis:0,centerPlateau:plateaus[3],width,baseY,heights};
}

function bilateralModule(surfaceDetail=GABLE_SURFACE.PLAIN){
 const profile=bilateralProfile(),out=new PartSet('MH-01');
 out.part('plaster','wall-body').extrudeXY(profile.polygon,P.depth);
 out.part('stone','stone-socle').box(0,P.localFloor+.08,0,P.width+.1,.19,P.depth+.06);
 out.part('plasterShade','plaster-trim').box(0,P.localFloor+.27,P.depth/2+.012,P.width-.11,.042,.025);
 if(surfaceDetail===GABLE_SURFACE.LEGACY_DECORATED){
 const piers=out.part('plaster','raised-step-piers'),reveal=out.part('plasterShade','step-corner-reveals');
 const stepXs=[...new Set(profile.plateaus.slice(1).map(v=>round(v.start)))];
 for(const x of stepXs){
  const i=profile.plateaus.findIndex(q=>Math.abs(q.start-x)<EPS);
  const h=Math.max(profile.plateaus[i-1].height,profile.plateaus[i].height)-P.localFloor;
  piers.box(x,P.localFloor+h/2,P.depth/2+.052,.135,h+.025,.10);
  reveal.box(x+Math.sign(x)*.056,P.localFloor+h/2,P.depth/2+.053,.022,h+.028,.07);
 }
 }
 const shadows=out.part('plasterShade','raised-cornice-shadows');
 for(let i=0;i<profile.plateaus.length;i++){
  const q=profile.plateaus[i],h=q.height;
  shadows.box((q.start+q.end)/2,h-.155,P.depth/2+.038,q.end-q.start,.063,.08);
  // All seven cap strips form exactly one connected stepped top profile.
  const a=q.start-(i===0?.07:0),b=q.end+(i===profile.plateaus.length-1?.07:0);
  out.part('stone','cap-stone').box((a+b)/2,h+.018,0,b-a,.12,P.capWidth*2+.13);
  out.part('slateDark','cap-shaded-underlip').box((a+b)/2,h+.105,0,b-a,.065,P.capWidth*2+.22);
  tileCap(out.part('slate','curved-cap'),a,b,h+.18,P.capWidth,{rise:.12});
  out.part('slateLight','cap-ridge').tube([[a,h+.265,0],[b,h+.265,0]],.086,12);
 }
 // Center finials share a single precisely mirrored source, not two independently
 // tessellated tubes with different sweep-reference phase.
 const rightFin=out.part('slateDark','flying-finial');
 const x=profile.centerPlateau.end;
 rightFin.tube([[x-.13,profile.centerPlateau.height+.23,0],
  [x-.05,profile.centerPlateau.height+.30,0],[x+.05,profile.centerPlateau.height+.40,0]],.065,11);
 const leftFin=out.part('slateDark','flying-finial');
 for(let i=0;i<rightFin.positions.length;i+=9){
  const mirror=j=>[-rightFin.positions[j],rightFin.positions[j+1],rightFin.positions[j+2]];
  leftFin.tri(mirror(i),mirror(i+6),mirror(i+3));
 }
 if(surfaceDetail===GABLE_SURFACE.LEGACY_DECORATED){
 const masonry=out.part('stone','exposed-masonry'),joints=out.part('slateEdge','masonry-joints');
 for(const sign of [-1,1])for(let row=0;row<7;row++)for(let col=0;col<2;col++){
  const x=sign*(P.width/2-.19-col*.22+(row%2)*.045),y=P.localFloor+.19+row*.23;
  if(y>profile.plateaus[0].height-.13)continue;
  masonry.box(x,y,P.depth/2+.019,.20,.20,.043);
  if((row+col)%3===0)joints.box(x,y+.07,P.depth/2+.049,.17,.024,.018);
 }
 const niches=out.part('plasterShade','endwall-corner-reveal');
 for(const sign of [-1,1])niches.box(sign*(P.width/2-.075),P.localFloor+.37,P.depth/2+.020,.09,.55,.045);
 }
 return {parts:out.parts,metadata:{profile,anchors:{wallSeat:{y:P.localFloor}}}};
}

function remesh(source,fn,negativeDeterminant=false){
 const dst=new Mesh(source.id,source.material);
 for(let i=0;i<source.positions.length;i+=9){
  const a=fn(source.positions.slice(i,i+3)),b=fn(source.positions.slice(i+3,i+6)),c=fn(source.positions.slice(i+6,i+9));
  dst.tri(a,negativeDeterminant?c:b,negativeDeterminant?b:c);
 }
 return dst;
}

/** Return buildGablePlacement-compatible data with explicit *independent* semantics. */
export function buildStyledGablePlacement(arm,end,direction=1,{profile='ASYMMETRIC',handedness=1,surfaceDetail=GABLE_SURFACE.PLAIN}={}){
 if(!['main','wing'].includes(arm)||![1,-1].includes(direction)||!Number.isFinite(end))throw new RangeError('invalid gable placement');
 if(!['BILATERAL','ASYMMETRIC'].includes(profile)||![1,-1].includes(handedness))throw new RangeError('invalid gable profile or handedness');
 if(!Object.values(GABLE_SURFACE).includes(surfaceDetail))throw new RangeError('invalid gable surfaceDetail');
 const tag=`gable-${arm}-${direction===1?'positive':'negative'}`;
 const base=profile==='BILATERAL'?bilateralModule(surfaceDetail):null;
 if(profile==='ASYMMETRIC'){
  const original=buildGablePlacement(arm,end,direction);
  const sourceParts=surfaceDetail===GABLE_SURFACE.PLAIN?original.parts.filter(m=>!LEGACY_ORNAMENTS.some(name=>m.id.includes(`/${name}/`))):original.parts;
  const finalParts=handedness===1?sourceParts:sourceParts.map(m=>{const out=remesh(m,q=>arm==='main'?[q[0],q[1],-q[2]]:[-q[0],q[1],q[2]],true);out.id=m.id;return out;});
  // The original placement is already in world coordinates: mirror only the CROSS-axis.
  // It does NOT change world decorative outward (+/- longitudinal axis).
  const w=original.metadata.wallCapSpans.map(q=>({...q,start:handedness*q.start,end:handedness*q.end}));
  const spans=w.map(q=>({...q,start:Math.min(q.start,q.end),end:Math.max(q.start,q.end)}))
   .filter(q=>q.end-q.start>EPS).sort((a,b)=>a.start-b.start);
  return {parts:finalParts,metadata:{...original.metadata,profileMode:profile,handedness,
   gableProfileContract:GABLE_PROFILE_CONTRACT,surfaceDetail,localCapSpans:spans,profileCenter:0}};
 }
 const localSeat=P.localFloor,seatOffset=FINISHED_FLOOR_Y-localSeat,center=end+direction*GABLE_DEPTH/2;
 const map=q=>arm==='main'?[center+direction*q[2],q[1]+seatOffset,handedness*q[0]]:
  [handedness*q[0],q[1]+seatOffset,center+direction*q[2]];
 const reflection=(arm==='main'?direction===1:direction===-1)!==(handedness===-1);
 const mapped=base.parts.map(m=>{
  const out=remesh(m,map,reflection);out.id=`${tag}/${m.id}`;return out;
 });
 return {parts:mapped,metadata:{arm,direction,outward:arm==='main'?[direction,0,0]:[0,0,direction],
  innerFace:end,outerFace:end+direction*GABLE_DEPTH,width:GABLE_WIDTH,wallDepth:GABLE_DEPTH,
  floorY:FINISHED_FLOOR_Y,localSeatY:localSeat,seatOffsetY:seatOffset,
  profileMode:profile,handedness,surfaceDetail,profileCenter:0,decoratedWorldFace:surfaceDetail===GABLE_SURFACE.LEGACY_DECORATED?end+direction*GABLE_DEPTH:null,
  gableProfileContract:GABLE_PROFILE_CONTRACT,mirroredTransform:reflection,
  localCapSpans:base.metadata.profile.plateaus.map(q=>({start:q.start,end:q.end,level:q.height+seatOffset}))}};
}
