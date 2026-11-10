/**
 * EW-UX G204 v0.3 — Proportional Gable Family.
 * One semantic profile -> one continuous wall mesh. Ornament face (outward)
 * and silhouette handedness are independent. No WP1.1 or Authority dependency.
 */
import {PartSet,Mesh,tileCap} from './mesh.js';

export const GABLE_PROFILE_CONTRACT='ew/ux/gable-profile-composition/v0.3';
export const GABLE_STYLE=Object.freeze({AUTO:'AUTO',BILATERAL:'BILATERAL',HALF_FAN:'HALF_FAN',ASYMMETRIC:'ASYMMETRIC'});
export const GABLE_SURFACE=Object.freeze({PLAIN:'PLAIN',LEGACY_DECORATED:'LEGACY_DECORATED'});
export const GABLE_DEPTH=.38,FINISHED_FLOOR_Y=.025;
const BASE_Y=.28, BASE_HEIGHT=2.30,EPS=1e-8;
const R=n=>Math.round(n*1e8)/1e8;
const sum=xs=>xs.reduce((a,b)=>a+b,0);
const exactBands=(width,weights)=>{
 const scale=width/sum(weights),bands=weights.map(w=>R(w*scale));
 bands[bands.length-1]=R(width-sum(bands.slice(0,-1)));return bands;
};
function tierPlan(width,mode){
 if(!Number.isFinite(width)||width<2.5||width>5.8)throw new RangeError('invalid gable effective width');
 if(mode==='BILATERAL'){
  // 2/3/4 height tiers => 3/5/7 cap sections. Never force seven into a narrow wall.
  const tiers=width<3.22?2:width<4.55?3:4;
  const crest=R(Math.max(.86,Math.min(1.18,width*.285)));
  const side=R((width-crest)/2);
  const weights=tiers===2?[1]:tiers===3?[1.2,1]:[1.24,1.10,1.02];
  const bands=exactBands(side,weights);
  return {tierCount:tiers,bands:[...bands,crest,...bands.toReversed()],levels:[...bands.map((_,i)=>i),tiers-1,...bands.map((_,i)=>tiers-2-i).toReversed().toReversed()]};
 }
 // A half-fan uses the FULL wall width, so each section has room to breathe.
 if(mode==='HALF_FAN'||mode==='ASYMMETRIC'){
  const tiers=width<3.15?3:width<4.55?4:5;
  const weights=tiers===3?[1.28,1.03,.82]:tiers===4?[1.3,1.15,.98,.84]:[1.34,1.18,1.07,.94,.82];
  const bands=exactBands(width,weights);
  const levels=bands.map((_,i)=>i);
  if(mode==='ASYMMETRIC'){levels[tiers-2]=tiers-1;levels[tiers-1]=tiers-2;} // off-center crest, not a forced mirror
  return {tierCount:tiers,bands,levels};
 }
 throw new RangeError('invalid gable profile mode');
}
/** Design-space proportions, in metres; heights are not enforced by topology grid. */
export function gableProfile({width=3.56,mode='BILATERAL',baseY=BASE_Y,wallHeight=BASE_HEIGHT,stepRise=.40}={}){
 if(!Number.isFinite(baseY)||!Number.isFinite(wallHeight)||wallHeight<=1||!Number.isFinite(stepRise)||stepRise<=.1||stepRise>.7)throw new RangeError('invalid gable profile heights');
 const plan=tierPlan(width,mode), {bands,levels,tierCount}=plan;
 // Exact arithmetic for the two mirrored halves: preserve symmetrical x stations.
 const stations=[R(-width/2)];for(const span of bands)stations.push(R(stations.at(-1)+span));stations[stations.length-1]=R(width/2);
 const heights=levels.map(n=>R(wallHeight+n*stepRise));
 const plateaus=heights.map((height,i)=>({start:stations[i],end:stations[i+1],height}));
 const polygon=[[stations[0],baseY],[stations.at(-1),baseY],[stations.at(-1),heights.at(-1)]];
 for(let i=plateaus.length-1;i>=0;i--){polygon.push([stations[i],heights[i]]);if(i>0)polygon.push([stations[i],heights[i-1]]);}
 return {mode,plateaus,polygon,width:R(width),baseY,heights,tierCount,
  minTread:Math.min(...bands),bandWidths:bands,crestWidth:mode==='BILATERAL'?bands[tierCount-1]:bands.at(-1),
  axis:0,centerPlateau:mode==='BILATERAL'?plateaus[tierCount-1]:null};
}
export const bilateralProfile=({width=3.56,baseY=BASE_Y,wallHeight=BASE_HEIGHT,stepRise=.40}={})=>
 gableProfile({width,mode:'BILATERAL',baseY,wallHeight,stepRise});

function buildModule({width,mode,surfaceDetail,stepRise=.40}){
 const profile=gableProfile({width,mode,stepRise}),out=new PartSet('MH-01'),depth=GABLE_DEPTH;
 out.part('plaster','wall-body').extrudeXY(profile.polygon,depth);
 out.part('stone','stone-socle').box(0,BASE_Y+.08,0,width+.1,.19,depth+.06);
 out.part('plasterShade','plaster-trim').box(0,BASE_Y+.27,depth/2+.012,width-.11,.042,.025);
 const shade=out.part('plasterShade','raised-cornice-shadows');
 for(let i=0;i<profile.plateaus.length;i++){
  const q=profile.plateaus[i],a=q.start-(i===0?.07:0),b=q.end+(i===profile.plateaus.length-1?.07:0);
  shade.box((q.start+q.end)/2,q.height-.155,depth/2+.038,q.end-q.start,.063,.08);
  out.part('stone','cap-stone').box((a+b)/2,q.height+.018,0,b-a,.12,.61);
  out.part('slateDark','cap-shaded-underlip').box((a+b)/2,q.height+.105,0,b-a,.065,.7);
  tileCap(out.part('slate','curved-cap'),a,b,q.height+.18,.24,{rise:.12});
  out.part('slateLight','cap-ridge').tube([[a,q.height+.265,0],[b,q.height+.265,0]],.086,12);
 }
 // Generate ONE canonical finial then truly mirror its triangles; independently
 // generated tube frame phases are not reflection-invariant.
 const center=mode==='BILATERAL'?profile.centerPlateau:profile.plateaus.at(-1);
 const x=center.end,right=out.part('slateDark','flying-finial');
 right.tube([[x-.13,center.height+.23,0],[x-.05,center.height+.30,0],[x+.05,center.height+.40,0]],.065,11);
 if(mode==='BILATERAL'){
  const left=out.part('slateDark','flying-finial');
  for(let i=0;i<right.positions.length;i+=9){
   const reflect=j=>[-right.positions[j],right.positions[j+1],right.positions[j+2]];
   left.tri(reflect(i),reflect(i+6),reflect(i+3));
  }
 }
 if(surfaceDetail===GABLE_SURFACE.LEGACY_DECORATED){
  const piers=out.part('plaster','raised-step-piers'),reveal=out.part('plasterShade','step-corner-reveals');
  for(let i=1;i<profile.plateaus.length;i++){
   const x=profile.plateaus[i].start,h=Math.max(profile.plateaus[i].height,profile.plateaus[i-1].height)-BASE_Y;
   piers.box(x,BASE_Y+h/2,depth/2+.052,.105,h+.025,.09);
   reveal.box(x+.035,BASE_Y+h/2,depth/2+.053,.02,h+.028,.07);
  }
  const masonry=out.part('stone','exposed-masonry'),joints=out.part('slateEdge','masonry-joints');
  for(const sign of [-1,1])for(let row=0;row<6;row++)for(let col=0;col<2;col++){
   const x=sign*(width/2-.19-col*.22+(row%2)*.045),y=BASE_Y+.19+row*.23;
   masonry.box(x,y,depth/2+.019,.20,.20,.043);
   if((row+col)%3===0)joints.box(x,y+.07,depth/2+.049,.17,.024,.018);
  }
 }
 return {parts:out.parts,profile};
}
function remesh(source,fn,flip=false){
 const dst=new Mesh(source.id,source.material);
 for(let i=0;i<source.positions.length;i+=9){
  // Normalize interpolation round-off symmetrically before handedness transform.
  // Max error 5e-9 m; all physically different cap stations remain distinct.
  const clean=j=>source.positions.slice(j,j+3).map(v=>Math.sign(v)*Math.round(Math.abs(v)*1e8)/1e8);
  const a=fn(clean(i)),b=fn(clean(i+3)),c=fn(clean(i+6));dst.tri(a,flip?c:b,flip?b:c);
 }
 return dst;
}
/** Handedness mirrors only the X-section, NEVER the external decorative plane. */
export function buildStyledGablePlacement(arm,end,direction=1,{profile='BILATERAL',handedness=1,surfaceDetail=GABLE_SURFACE.PLAIN,width=3.56,stepRise=.40,role='UNSPECIFIED'}={}){
 if(!['main','wing'].includes(arm)||![1,-1].includes(direction)||!Number.isFinite(end))throw new RangeError('invalid gable placement');
 if(!['BILATERAL','HALF_FAN','ASYMMETRIC'].includes(profile)||![1,-1].includes(handedness))throw new RangeError('invalid gable profile or handedness');
 if(!Object.values(GABLE_SURFACE).includes(surfaceDetail))throw new RangeError('invalid gable surfaceDetail');
 const base=buildModule({width,mode:profile,surfaceDetail,stepRise});
 const seatOffset=FINISHED_FLOOR_Y-BASE_Y,center=end+direction*GABLE_DEPTH/2;
 const map=q=>arm==='main'?[center+direction*q[2],q[1]+seatOffset,handedness*q[0]]:
  [handedness*q[0],q[1]+seatOffset,center+direction*q[2]];
 const flip=(arm==='main'?direction===1:direction===-1)!==(handedness===-1);
 const tag=`gable-${arm}-${direction===1?'positive':'negative'}`;
 const parts=base.parts.map(m=>{const dest=remesh(m,map,flip);dest.id=`${tag}/${m.id}`;return dest;});
 const spans=base.profile.plateaus.map(q=>({start:Math.min(handedness*q.start,handedness*q.end),end:Math.max(handedness*q.start,handedness*q.end),level:R(q.height+seatOffset)})).sort((a,b)=>a.start-b.start);
 return {parts,metadata:{arm,direction,role,outward:arm==='main'?[direction,0,0]:[0,0,direction],
  innerFace:end,outerFace:end+direction*GABLE_DEPTH,width,wallDepth:GABLE_DEPTH,
  floorY:FINISHED_FLOOR_Y,localSeatY:BASE_Y,seatOffsetY:seatOffset,
  profileMode:profile,handedness,surfaceDetail,stepRise,profileCenter:0,
  tierCount:base.profile.tierCount,minTread:base.profile.minTread,crestWidth:base.profile.crestWidth,
  facadeWorldFace:end+direction*GABLE_DEPTH,
  decoratedWorldFace:surfaceDetail===GABLE_SURFACE.LEGACY_DECORATED?end+direction*GABLE_DEPTH:null,
  gableProfileContract:GABLE_PROFILE_CONTRACT,mirroredTransform:flip,localCapSpans:spans}};
}
