/**
 * EW-UX G1-M2 Stage 02 — deterministic L roof / true shared hip + valley.
 * Research geometry only. No WP1.1, R2.3, Authority or world topology mutation.
 * Plan axis: main ridge = X+, wing ridge = Z+, Y up.
 * Overlap square [-s,s]^2 is partitioned by x=z, never full-surface overlap.
 * x>=z belongs to main roof, x<=z belongs to wing roof.
 * The diagonal SW->origin is an outer convex HIP;
 * origin->NE concave courtyard is a descending drainage VALLEY.
 */
import {Mesh,PartSet} from './mesh.js';
import {roofY,roofSlope,MODULES,resolve} from './contracts.js';
import {buildModule} from './modules.js';
import {lerp,noise} from './math.js';

export const L_VALLEY_CONTRACT = 'ew/ux/l-valley-v0.1';
const ROOF_MAT = {under:'slateDark',slate:'slate',edge:'slateEdge',light:'slateLight',wood:'wood',woodDark:'woodDark'};
const WALL=MODULES.find(m=>m.id==='MH-01');
const EPS=1e-8;
// One architectural datum for slab finish and imported gable base seats.
const FLOOR_SURFACE={centerY:.01,thickness:.03};
const FINISHED_FLOOR_Y=FLOOR_SURFACE.centerY+FLOOR_SURFACE.thickness/2;
const round=n=>Math.round(n*1e8)/1e8;

function assertConfig(o){
 const cfg={mainLength:5.6,wingLength:5.15,halfSpan:1.55,eaveHeight:1.68,rise:1.02,
  tilePitch:.32,tileRow:.37,tileArch:.082,tileGap:.17, ...o};
 for(const k of ['mainLength','wingLength','halfSpan','eaveHeight','rise','tilePitch','tileRow','tileArch','tileGap']) {
  if(!Number.isFinite(cfg[k]))throw new TypeError(`${k} must be finite`);
 }
 if(cfg.halfSpan<1.15||cfg.halfSpan>1.7)throw new RangeError('halfSpan outside 1.15..1.7');
 for(const k of ['mainLength','wingLength'])if(cfg[k]<cfg.halfSpan+2.4||cfg[k]>9)throw new RangeError(`${k} must exceed the corner by at least 2.4 m and not exceed 9 m`);
 if(cfg.eaveHeight<1.4||cfg.eaveHeight>2.2||cfg.rise<.65||cfg.rise>1.4)throw new RangeError('invalid roof elevation');
 if(cfg.tilePitch<.26||cfg.tilePitch>.38||cfg.tileRow<.29||cfg.tileRow>.43||cfg.tileArch<.055||cfg.tileArch>.13)throw new RangeError('invalid tile section');
 if(cfg.tileGap<.10||cfg.tileGap>.22)throw new RangeError('invalid valley tile clearance');
 return cfg;
}
const roofParams=p=>({halfSpan:p.halfSpan,eaveHeight:p.eaveHeight,rise:p.rise});
const height=(p,d)=>roofY(roofParams(p),d);
const at=(arm,t,d,y)=>arm==='main'?[t,y,d]:[d,y,t];
function triUp(mesh,a,b,c){
 const yy=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
 if(Math.abs(yy)<1e-12)return;
 if(yy>0)mesh.tri(a,b,c);else mesh.tri(a,c,b);
}
/** Polygon clipping happens in (ridge-coordinate t, cross-coordinate d) space.
 * Re-evaluate the analytic roof height AFTER clipping: no linear interpolation
 * seam drift between perpendicular roof fields. */
function clipToPartition(vertices,clearance=0){
 let out=[];
 for(let i=0;i<vertices.length;i++){
  const a=vertices[i],b=vertices[(i+1)%vertices.length],fa=a.t-a.d-clearance,fb=b.t-b.d-clearance;
  if(fa>=-EPS)out.push(a);
  if((fa>EPS&&fb< -EPS)||(fa< -EPS&&fb>EPS)){
   const alpha=fa/(fa-fb),t=a.t+alpha*(b.t-a.t),d=a.d+alpha*(b.d-a.d);
   // If line t-d=0, snap both to same absolute station. Otherwise preserve clearance.
   out.push({t,d});
  }
 }
 // Remove adjacent geometric duplicates so no near-zero-area fan triangles.
 const clean=[];
 for(const v of out)if(!clean.length||Math.hypot(v.t-clean.at(-1).t,v.d-clean.at(-1).d)>1e-10)clean.push(v);
 if(clean.length>1&&Math.hypot(clean[0].t-clean.at(-1).t,clean[0].d-clean.at(-1).d)<1e-10)clean.pop();
 return clean;
}
function emitPatch(mesh,arm,vertices,yfn,clearance=0){
 const poly=clipToPartition(vertices,clearance);if(poly.length<3)return;
 for(let i=1;i+1<poly.length;i++){
  const q=[poly[0],poly[i],poly[i+1]].map(p=>at(arm,p.t,p.d,yfn(p.t,p.d)));
  triUp(mesh,q[0],q[1],q[2]);
 }
}
function patchGrid(mesh,arm,t0,t1,d0,d1,nu,nv,yfn,clearance=0){
 for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){
  const tA=lerp(t0,t1,i/nu),tB=lerp(t0,t1,(i+1)/nu);
  const dA=lerp(d0,d1,j/nv),dB=lerp(d0,d1,(j+1)/nv);
  const a={t:tA,d:dA},b={t:tB,d:dA},c={t:tB,d:dB},d={t:tA,d:dB};
  emitPatch(mesh,arm,[a,b,c],yfn,clearance);
  emitPatch(mesh,arm,[a,c,d],yfn,clearance);
 }
}
function makeRoofShell(out,p,arm,end){
 const sub=out.part(ROOF_MAT.under,`${arm}-single-domain-substrate`);
 const lining=out.part('cut',`${arm}-underside-lining`);
 for(const zside of [-1,1]){
  patchGrid(sub,arm,-p.halfSpan,p.halfSpan,0,zside*p.halfSpan,28,14,(t,d)=>height(p,d)+.015,0);
  patchGrid(lining,arm,-p.halfSpan,p.halfSpan,0,zside*p.halfSpan,28,14,(t,d)=>height(p,d)-.11,0);
  patchGrid(sub,arm,p.halfSpan,end,0,zside*p.halfSpan,Math.ceil((end-p.halfSpan)/.22),14,(t,d)=>height(p,d)+.015,0);
  patchGrid(lining,arm,p.halfSpan,end,0,zside*p.halfSpan,Math.ceil((end-p.halfSpan)/.22),14,(t,d)=>height(p,d)-.11,0);
 }
}
function tiledRoof(out,p,arm,end){
 const tile=out.part('slate',`${arm}-clipped-barrel-tiles`);
 const lips=out.part('slateEdge',`${arm}-clipped-tile-lips`);
 const grout=out.part('slateDark',`${arm}-tile-underlaps`);
 const limit=p.halfSpan,endT=end,step=p.tilePitch;
 // Global t-axis sampling continues from shared world origin; no restart per section.
 for(let col=Math.floor(-limit/step)-1;col<=Math.ceil(endT/step)+1;col++){
  const center=col*step,lo=Math.max(-limit,center-step*.475),hi=Math.min(endT,center+step*.475);
  if(hi-lo<.004)continue;
  for(const side of [-1,1])for(let row=0;row<Math.ceil(limit/p.tileRow);row++){
   const r0=Math.max(.035,row*p.tileRow-.022),r1=Math.min(limit,(row+1)*p.tileRow+.036);
   if(r1-r0<.006)continue;
   const shade=noise(`Ltile:${arm}:${col}:${row}:${side}`);
   const tileY=(t,d)=>{
    const u=(t-center)/(step*.475),arch=p.tileArch*Math.sqrt(Math.max(0,1-u*u));
    return height(p,d)+.062+arch+shade*.012+(row===0?.006:0);
   };
   patchGrid(tile,arm,lo,hi,side*r0,side*r1,7,3,tileY,p.tileGap);
   const lip0=Math.max(r0,r1-.027);
   patchGrid(lips,arm,lo,hi,side*lip0,side*r1,7,1,(t,d)=>tileY(t,d)-.008,p.tileGap);
   if(row>0&&row%2===0)patchGrid(grout,arm,lo,hi,side*r0,side*(r0+.018),5,1,(t,d)=>tileY(t,d)-.020,p.tileGap);
  }
 }
}
function centerlineY(p,u){return height(p,u)}
/** All seam stations lie on exactly x=z. The same analytic curve is used on both sides. */
export function diagonalSeam(p){
 const s=p.halfSpan,segments=32;
 const hip=Array.from({length:segments+1},(_,i)=>{const u=-s+(s*i/segments);return [round(u),round(centerlineY(p,u)+.015),round(u)]});
 const valley=Array.from({length:segments+1},(_,i)=>{const u=s*i/segments;return [round(u),round(centerlineY(p,u)+.015),round(u)]});
 return {hip,valley};
}
function buildValleyFlashing(out,p){
 const gutter=out.part('slateEdge','valley-zinc-V-trough');
 const flashingEdge=out.part('slateDark','valley-clipped-tile-edge-finishes');
 const gold=out.part('brass','valley-thin-miter-guide');
 const N=48,w=.148;
 const sample=(u,v)=>{
  const q=(v*2-1)*w, x=u+q/Math.SQRT2,z=u-q/Math.SQRT2;
  // Edges follow their parent surface and remain lower than the cut barrel tile crowns.
  const base=height(p,Math.min(x,z));
  const y=base+.010-.023*(1-Math.abs(q)/w);
  return [x,y,z];
 };
 gutter.grid((u,v)=>sample(lerp(.023,p.halfSpan-.006,u),v),N,8);
 for(const side of [-1,1]){
  const rail=[];const thin=[];
  for(let i=0;i<=N;i++){
   const u=lerp(.025,p.halfSpan-.005,i/N),q=side*w;
   const x=u+q/Math.SQRT2,z=u-q/Math.SQRT2;
   rail.push([x,height(p,Math.min(x,z))+.026,z]);
   thin.push([u+side*(w*.45)/Math.SQRT2,height(p,u)+.012,u-side*(w*.45)/Math.SQRT2]);
  }
  flashingEdge.tube(rail,.021,7);
  gold.tube(thin,.007,5);
 }
 // Drain terminus protrudes into the inner L courtyard, with verifiable downhill exit.
 const outlet=out.part('slateDark','valley-spout-discharge');
 const u=p.halfSpan-.006,y=height(p,u)+.006;
 const path=[[u-.18,y+.12,u-.18],[u,y,u],[u+.12,y-.11,u+.12],[u+.28,y-.20,u+.28]];
 outlet.tube(path,.077,12);
 const mouth=out.part('slateLight','valley-outlet-lip');
 mouth.tube([[u+.27,y-.20,u+.27],[u+.31,y-.22,u+.31]],.096,10);
 return {width:w,outlet:path.at(-1),valleyPath:Array.from({length:N+1},(_,i)=>{
  const u=lerp(.025,p.halfSpan-.005,i/N);return [round(u),round(height(p,u)-.013),round(u)];})};
}
function buildHipAndRidges(out,p){
 const hip=out.part('slateLight','outer-hip-roll');
 const straps=out.part('slateEdge','hip-slate-staggered-caps');
 const ridge=out.part('slateLight','two-intersecting-main-ridges');
 const detail=out.part('slateDark','ridge-crown-straps');
 const span=p.halfSpan;
 const hipPath=Array.from({length:45},(_,i)=>{const u=-span+span*i/44;return [u,height(p,u)+.165,u]});
 hip.tube(hipPath,.137,14);
 for(let k=1;k<9;k++){
  const u=-span+span*k/9;
  const a=[u-.08,height(p,u)+.156,u-.08],b=[u+.08,height(p,u)+.156,u+.08];straps.tube([a,b],.031,8);
 }
 for(const arm of ['main','wing']){
  const end=arm==='main'?p.mainLength:p.wingLength;
  const y=height(p,0)+.162;
  ridge.tube([at(arm,0,0,y),at(arm,end+.05,0,y)],.140,14);
  for(let t=.25;t<end-.1;t+=.32){detail.tube([at(arm,t,-.12,y-.05),at(arm,t,0,y+.095),at(arm,t,.12,y-.05)],.027,7);}
  const endcap=out.part('slateDark',`${arm}-gable-ridge-finial`);
  endcap.tube([at(arm,end,0,y),at(arm,end+.12,0,y+.068),at(arm,end+.16,0,y+.16)],.083,11);
 }
 const junction=out.part('slateLight','ridge-hip-valley-4way-knot');
 junction.tube([[0,height(p,0)+.23,-.018],[0,height(p,0)+.30,0],[.08,height(p,0)+.22,.08]],.085,11);
}
function addEaveConstruction(out,p){
 const beam=out.part('woodDark','continuous-L-eave-fascia');
 const wood=out.part('wood','L-cantilever-rafters');
 const endCaps=out.part('woodLight','rafter-head-keys');
 const stone=out.part('slateEdge','eave-drip-line');
 const segments=[];
 for(const arm of ['main','wing']){
  const end=arm==='main'?p.mainLength:p.wingLength;
  segments.push({arm,side:-1,a:-p.halfSpan,b:end});
  segments.push({arm,side:1,a:p.halfSpan,b:end});
 }
 for(const e of segments){
  const d=e.side*p.halfSpan,yy=height(p,d)-.16;
  beam.beam(at(e.arm,e.a,d,yy-.02),at(e.arm,e.b,d,yy-.02),.21,.18);
  stone.tube([at(e.arm,e.a,d,yy+.205),at(e.arm,e.b,d,yy+.205)],.045,9);
  // Rafters follow exposed eave boundary only: never span the concave courtyard.
  for(let t=Math.ceil((e.a+.065)/.32)*.32;t<e.b-.065;t+=.32){
   wood.beam(at(e.arm,t,e.side*(p.halfSpan-.56),height(p,e.side*(p.halfSpan-.56))-.23),
    at(e.arm,t,e.side*(p.halfSpan+.09),yy-.06),.105,.115);
   const c=at(e.arm,t,e.side*(p.halfSpan+.12),yy-.045);endCaps.box(c[0],c[1],c[2],.13,.11,.13);
  }
 }
 return {segments:segments.map(e=>({...e,start:at(e.arm,e.a,e.side*p.halfSpan,0),end:at(e.arm,e.b,e.side*p.halfSpan,0)}))};
}
function remeshPart(part,fn,tag){const out=new Mesh(`${tag}/${part.id}`,part.material);for(let i=0;i<part.positions.length;i+=9)out.tri(fn(part.positions.slice(i,i+3)),fn(part.positions.slice(i+3,i+6)),fn(part.positions.slice(i+6,i+9)));return out;}
function addGables(out,p){
 const params={width:3.6,depth:.38,wallHeight:2.30,stepRise:.48,steps:4};
 const g=buildModule(WALL,params); const depth=.38;
 // G1-M1 gables are independent modules with a local baseY (0.28 m).
 // Register that semantic wallSeat to the L-house's *finished floor* datum;
 // do not reinterpret module wallHeight, which would alter the accepted profile.
 const localSeatY=g.metadata.anchors.wallSeat.y;
 const seatOffsetY=FINISHED_FLOOR_Y-localSeatY;
 // Both gable inner planes coincide with their respective roof ends.
 for(const [arm,end] of [['main',p.mainLength],['wing',p.wingLength]]){
  const transformed=g.parts.map(part=>remeshPart(part,q=>arm==='main'?[end+depth/2-q[2],q[1]+seatOffsetY,q[0]]:[q[0],q[1]+seatOffsetY,end+depth/2-q[2]],`gable-${arm}`));
  out.parts.push(...transformed);
 }
 return {wallDepth:depth,localSeatY,finishedFloorY:FINISHED_FLOOR_Y,seatOffsetY,
  wallCapSpans:g.metadata.anchors.capSpans.map(span=>({...span,level:span.level+seatOffsetY}))};
}
function addShell(out,p){
 const s=p.halfSpan;
 const stone=out.part('platform','L-floor-podium');
 const top=out.part('platformTop','L-floor-stone-surface');
 const plaster=out.part('plaster','L-perimeter-plaster-walls');
 const trim=out.part('plasterShade','perimeter-plaster-cornice');
 const supports=out.part('plaster','structural-piers');
 // Two abutting slabs, not overlapping rectangular slabs.
 stone.box((p.mainLength-s)/2,-.18,0,p.mainLength+s,.35,2*s);
 stone.box(0,-.18,(p.wingLength+s)/2,2*s,.35,p.wingLength-s);
 top.box((p.mainLength-s)/2,FLOOR_SURFACE.centerY,0,p.mainLength+s,FLOOR_SURFACE.thickness,2*s);
 top.box(0,FLOOR_SURFACE.centerY,(p.wingLength+s)/2,2*s,FLOOR_SURFACE.thickness,p.wingLength-s);
 const lines=[
  ['main',-1,-s,p.mainLength],['main',1,s,p.mainLength],
  ['wing',-1,-s,p.wingLength],['wing',1,s,p.wingLength]
 ];
 for(const [arm,side,a,b] of lines){
  const center=(a+b)/2,extent=b-a,dd=side*(s-.16);
  const world=at(arm,center,dd,.89);
  const sy=1.48;
  if(arm==='main'){
   plaster.box(world[0],world[1],world[2],extent,sy,.30);
   trim.box(world[0],1.60,world[2],extent,.075,.34);
  }else{
   plaster.box(world[0],world[1],world[2],.30,sy,extent);
   trim.box(world[0],1.60,world[2],.34,.075,extent);
  }
  for(let t=a+.35;t<b-.15;t+=1.40){const c=at(arm,t,dd,.86);if(arm==='main')supports.box(c[0],c[1],c[2],.125,1.42,.35);else supports.box(c[0],c[1],c[2],.35,1.42,.125);}
 }
 // Inner corner's shared supporting pier beneath the rainwater outlet.
 supports.box(s-.20,.92,s-.20,.38,1.50,.38);
}
export function checkCornerContract(p,parts,flash){
 const issues=[],s=p.halfSpan,diag=diagonalSeam(p);
 // True corner classification: plan region assigned to exactly one panel,
 // except the shared diagonal with identical analytic heights and tangents along the line.
 for(let i=0;i<33;i++){
  const u=-s+2*s*i/32;
  const mainY=height(p,u),wingY=height(p,u);
  if(Math.abs(mainY-wingY)>1e-9)issues.push('seam_height');
  if(i>0&&i<32){
   const delta=.035;const lateral=height(p,u-delta);
   if(u>.08&&!(lateral>mainY))issues.push('valley_not_V_shaped');
   if(u<-.08&&!(lateral<mainY))issues.push('hip_not_convex');
  }
 }
 const roofA=parts.find(x=>x.id.includes('/main-single-domain-substrate/'));
 const seamStations=part=>{const pts=new Set();if(!part)return pts;for(let i=0;i<part.positions.length;i+=3){const x=part.positions[i],z=part.positions[i+2];if(Math.abs(x-z)<1e-7 && x>=-s-1e-7 && x<=s+1e-7)pts.add(`${x.toFixed(7)}|${part.positions[i+1].toFixed(7)}|${z.toFixed(7)}`);}return pts;};
 const roofB=parts.find(x=>x.id.includes('/wing-single-domain-substrate/'));
 const tilesA=parts.find(x=>x.id.includes('/main-clipped-barrel-tiles/'));
 const tilesB=parts.find(x=>x.id.includes('/wing-clipped-barrel-tiles/'));
 if(!roofA||!roofB||!tilesA||!tilesB)issues.push('missing_roof_domain');
 const pointsA=seamStations(roofA),pointsB=seamStations(roofB);
 if(pointsA.size<25||pointsA.size!==pointsB.size||[...pointsA].some(x=>!pointsB.has(x)))issues.push('diagonal_substrate_edge_mismatch');
 for(const [part,side] of [[roofA,1],[roofB,-1]])if(part){
  for(let i=0;i<part.positions.length;i+=3){const x=part.positions[i],z=part.positions[i+2];if(side*(x-z)<-EPS){issues.push('substrate_partition_overlap');break;}}
 }
 for(const [part,side] of [[tilesA,1],[tilesB,-1]])if(part){
  for(let i=0;i<part.positions.length;i+=3){const x=part.positions[i],z=part.positions[i+2];if(side*(x-z)<p.tileGap-1e-7){issues.push('tile_crosses_valley_or_hip_band');break;}}
 }
 if(diag.hip.at(-1)[0]!==0||diag.valley[0][0]!==0||Math.abs(diag.valley.at(-1)[0]-s)>1e-7)issues.push('wrong_diagonal_termination');
 // Water must flow entirely downhill along the inward valley, with a real outlet.
 const drop=height(p,0)-height(p,s);
 if(drop<=.5)issues.push('insufficient_valley_drop');
 for(let i=0;i<flash.valleyPath.length-1;i++)if(flash.valleyPath[i+1][1]>=flash.valleyPath[i][1]-1e-8)issues.push('valley_not_downhill');
 if(!(flash.outlet[0]>s&&flash.outlet[2]>s&&flash.outlet[1]<flash.valleyPath.at(-1)[1]))issues.push('outlet_not_exterior_or_downhill');
 // Mixed-family contract: the gable body's physical bottom must seat on
 // the same finished-floor surface as the connected L-house, not at local baseY.
 const floor=parts.find(x=>x.id.includes('/L-floor-stone-surface/'));
 const floorTop=floor?.bounds().max[1];
 if(!Number.isFinite(floorTop)||Math.abs(floorTop-FINISHED_FLOOR_Y)>EPS)issues.push('floor_datum_mismatch');
 for(const arm of ['main','wing']){
  const wall=parts.find(x=>x.id.includes(`gable-${arm}/MH-01/wall-body/`));
  const socle=parts.find(x=>x.id.includes(`gable-${arm}/MH-01/stone-socle/`));
  if(!wall||!socle){issues.push('missing_gable_seat');continue;}
  const base=wall.bounds().min[1],stoneBounds=socle.bounds();
  if(Math.abs(base-floorTop)>EPS)issues.push('gable_floor_datum_mismatch');
  if(stoneBounds.min[1]>floorTop+EPS||stoneBounds.max[1]<floorTop-EPS)issues.push('gable_socle_not_seated');
 }
 const normalDelta=Math.abs(roofSlope(roofParams(p),.0001));
 if(normalDelta<=0)issues.push('invalid_valley_cross_slope');
 return {ok:issues.length===0,issues:[...new Set(issues)],contract:L_VALLEY_CONTRACT,
  plan:'nonoverlapping analytic XY foot-print of two perpendicular gable surfaces',hipFrom:[-s,-s],junction:[0,0],valleyTo:[s,s],
  ridgeDirections:[[1,0],[0,1]],drop:round(drop),flowLength:round(Math.SQRT2*s),nominalPlanSlope:round(drop/(Math.SQRT2*s)),
  flashingWidth:flash.width,minimumTileStripGap:p.tileGap/Math.SQRT2,sharedDiagonalVertexCount:pointsA.size,triangles:(roofA?.count??0)+(roofB?.count??0)};
}
export function buildLValley(input={}){
 const p=assertConfig(input),out=new PartSet('L-valley');
 makeRoofShell(out,p,'main',p.mainLength);makeRoofShell(out,p,'wing',p.wingLength);
 tiledRoof(out,p,'main',p.mainLength);tiledRoof(out,p,'wing',p.wingLength);
 const flashing=buildValleyFlashing(out,p);
 buildHipAndRidges(out,p);
 const eaves=addEaveConstruction(out,p);
 addShell(out,p);
 const gables=addGables(out,p);
 const check=checkCornerContract(p,out.parts,flashing);
 const complexity=out.metrics();
 const geometryHashInput={contract:L_VALLEY_CONTRACT,params:p};
 return {id:'G203-L-valley',contract:L_VALLEY_CONTRACT,params:p,parts:out.parts,items:[{module:{parts:out.parts},pos:[0,0,0],plinth:false,kind:'l-valley'}],
  seams:{...check,hip:diagonalSeam(p).hip,valley:diagonalSeam(p).valley,drain:flashing.outlet},
  metadata:{independentAuthority:true,stage:'G1-M2-Stage02',topology:'L-gable-hip-valley',materialBasis:'G1-M1 v0.3' ,eaves,gables,geometryHashInput},
  metrics:complexity,validation:{ok:check.ok,issues:check.issues}};
}
