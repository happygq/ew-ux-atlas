import {PartSet,tileCap} from './mesh.js';
import {V,add,sub,mul,norm,lerp,PI,noise} from './math.js';
import {resolve,roofY,roofBoundary,stableModuleId} from './contracts.js';

/** World-space layout for parallel architectural details. No local tile/rafter reset at a join. */
function worldStations(x0,x1,worldX,pitch,phase=0){
  const lo=x0+worldX,hi=x1+worldX,eps=1e-7;
  const out=[];
  for(let k=Math.ceil((lo-phase-eps)/pitch);k<=Math.floor((hi-phase+eps)/pitch);k++){
    const x=k*pitch+phase-worldX;
    if(x>=x0-eps&&x<=x1+eps)out.push({local:x,global:k*pitch+phase,index:k});
  }
  return out;
}
const M={plaster:'plaster',plasterShade:'plasterShade',stone:'stone',slate:'slate',slateEdge:'slateEdge',slateLight:'slateLight',slateDark:'slateDark',wood:'wood',woodDark:'woodDark',woodLight:'woodLight',cut:'cut',brass:'brass'};

/** Deterministic roof tile strip, cut to [x0,x1] exactly. Tile columns follow global world X. */
function tiledPitch(out,p,{x0=-p.length/2,x1=p.length/2,side=1,upper=.0,lower=p.halfSpan,xOrigin=0,small=false}={}){
  const step=p.tilePitch,overlap=.046;
  const tiles=out.part(M.slate,'barrel-tiles', [0,.018,0]);
  const tileLip=out.part(M.slateEdge,'tile-lips');
  const gap=out.part(M.slateDark,'underlap-gaps');
  const nCol=Math.ceil((x1-x0)/step)+4;
  for(let k=-2;k<nCol;k++){
    const column=Math.floor((x0+xOrigin-p.xPhase)/step)+k;
    const center=column*step+p.xPhase-xOrigin;
    const lo=Math.max(center-step*.47,x0),hi=Math.min(center+step*.47,x1);
    if(hi-lo<.005)continue;
    const capHalf=step*.47;
    const nRow=Math.ceil((lower-upper)/p.tileRow);
    for(let r=0;r<nRow;r++){
      const r0=upper+r*p.tileRow-overlap*.55,r1=Math.min(lower,upper+(r+1)*p.tileRow+overlap);
      if(r1-r0<.008)continue;
      const shade=noise(`tile:${p.tilePitch}:${column}:${r}:${side}`);
      const lift=.012*shade+(r===nRow-1?.008:0);
      const f=(u,v)=>{
        const x=lerp(lo,hi,u),z=side*lerp(r0,r1,v),local=(x-center)/capHalf;
        const arch=p.tileArch*Math.sqrt(Math.max(0,1-local*local));
        return [x,roofY(p,z)+.067+arch+lift,z];
      };
      tiles.grid(f,Math.max(3,Math.round((hi-lo)/step*8)),3);
      // Shaded lip at the downhill (visible) end, curved like a real barrel section
      tileLip.grid((u,v)=>{
        const x=lerp(lo,hi,u), z=side*lerp(r1-.021,r1,v),local=(x-center)/capHalf;
        return [x,roofY(p,z)+.063+p.tileArch*Math.sqrt(Math.max(0,1-local*local))+lift-(v*.015),z];
      },7,1);
      if(r>0&&r%2===0) gap.grid((u,v)=>{
        const x=lerp(lo,hi,u),z=side*lerp(r0,r0+.022,v),q=(x-center)/capHalf;
        return [x,roofY(p,z)+.062+p.tileArch*Math.sqrt(Math.max(0,1-q*q))+lift-.018,z];
      },4,1);
    }
  }
  return {tiles,tileLip};
}
function addRidge(out,p,x0=-p.length/2,x1=p.length/2,joins={},worldX=0){
 const y=roofY(p,0)+.18;
 const r=out.part(M.slateLight,'ridge-crown');r.tube([[x0+(joins.left?0:-.05),y,0],[x1+(joins.right?0:.05),y,0]],.142,16);
 const cap=out.part(M.slateEdge,'ridge-axis-bands');
 for(const {local:x} of worldStations(x0+.10,x1-.10,worldX,.32,.16)){
  // arched ridge straps registered to the same world-X phase
  cap.tube([[x,y-.09,-.12],[x,y+.08,-.13],[x,y+.16,0],[x,y+.08,.13],[x,y-.09,.12]],.025,7);
 }
 for(const [i,x] of [x0,x1].entries()){
  if(i===0&&joins.left||i===1&&joins.right)continue;
  const end=out.part(M.slateDark,'ridge-scroll');end.tube([[x,y,.0],[x+(i===0?-.14:.14),y+.055,0],[x+(i===0?-.16:.16),y+.14,0]],.087,12);
  const rosette=out.part(M.slateLight,'ridge-rosette');
  for(let q=0;q<12;q++){
   const a=q/12*PI*2,b=(q+1)/12*PI*2;
   rosette.tri([x,y,0],[x,y+.092*Math.cos(a),.092*Math.sin(a)],[x,y+.092*Math.cos(b),.092*Math.sin(b)]);
  }
 }
}
function addRoofWood(out,p,{x0=-p.length/2,x1=p.length/2,worldX=0}={}){
 const beams=out.part(M.wood,'rafters');
 const dark=out.part(M.woodDark,'fascia');
 const light=out.part(M.woodLight,'carved-stops');
 for(const side of [-1,1]){
   const zEnd=side*(p.halfSpan+.09),yEnd=roofY(p,side*p.halfSpan)-.14;
   dark.beam([x0-.08,yEnd-.09,zEnd],[x1+.08,yEnd-.09,zEnd],.13,.22);
   for(const {local:x} of worldStations(x0+.055,x1-.055,worldX,.31,.06)){
     beams.beam([x,roofY(p,side*.2)-.22,side*.2],[x,yEnd-.12,side*(p.halfSpan+.14)],.105,.125);
     light.box(x,yEnd-.16,side*(p.halfSpan+.17),.12,.12,.15);
   }
 }
 const roofCore=out.part(M.cut,'under-roof-lining');
 for(const side of [-1,1]){
  roofCore.grid((u,v)=>{
   const x=lerp(x0,x1,u),z=side*lerp(.02,p.halfSpan,v);
   return [x,roofY(p,z)-.12,z];
  },12,8);
 }
}
function buildRoof(meta,context={}){
 const worldX=context.worldX??0,joins=context.joins??{};
 const p=meta.params,out=new PartSet(meta.id);
 const core=out.part(M.slateDark,'continuous-substrate');
 // continuous sloped substrate, unlike modular box roofs
 for(const side of [-1,1])core.grid((u,v)=>{const x=lerp(-p.length/2,p.length/2,u),z=side*lerp(0,p.halfSpan,v);return [x,roofY(p,z)+.01,z];},14,10);
 for(const side of [-1,1])tiledPitch(out,p,{side,x0:-p.length/2,x1:p.length/2,xOrigin:worldX});
 const edging=out.part(M.slateEdge,'verge-rolls');
 for(const [idx,x] of [-p.length/2,p.length/2].entries())for(const side of [-1,1]){
  if(idx===0&&joins.left||idx===1&&joins.right)continue;
  const path=[];for(let k=0;k<=24;k++){const z=side*p.halfSpan*k/24;path.push([x,roofY(p,z)+.095,z]);}
  edging.tube(path,.065,8);
 }
 // Eave-facing tip pieces; clear outline at close range
 const drip=out.part(M.slateLight,'drip-caps');
 for(const side of [-1,1])for(const {local:x} of worldStations(-p.length/2+.05,p.length/2-.05,worldX,p.tilePitch,.14)){
   drip.tube([[x,roofY(p,side*p.halfSpan)+.09,side*p.halfSpan],[x,roofY(p,side*p.halfSpan)-.012,side*(p.halfSpan+.12)]],.043,9);
 }
 addRoofWood(out,p,{worldX});
 addRidge(out,p,-p.length/2,p.length/2,joins,worldX);
 return {parts:out.parts,metrics:out.metrics(),bounds:out.bounds(),metadata:{...meta,anchors:{left:roofBoundary(p,'left',worldX),right:roofBoundary(p,'right',worldX)},stableId:stableModuleId(meta)}};
}

function wallProfile(p){
 // Each station owns the *following* horizontal wall plateau. Earlier code
 // accidentally used the next station's height for the wall mesh, while the
 // slate cap used the current station's height: caps visibly floated above
 // their supports. Generate both the extrusion and cap seats from one list.
 const L=-p.width/2,R=p.width/2,bottom=p.baseY,n=p.steps;
 const unit=p.width/(n+1);
 const rising=Array.from({length:n},(_,i)=>({x:L+i*unit,y:p.wallHeight+i*p.stepRise}));
 const descending={x:L+n*unit,y:p.wallHeight+(n-2)*p.stepRise*.93};
 const stops=[...rising,descending,{x:R,y:descending.y}];
 const plateaus=stops.slice(0,-1).map((s,i)=>({x0:s.x,x1:stops[i+1].x,y:s.y}));
 // Clockwise boundary: base L->R, roofline R->L with exact vertical risers.
 const pts=[[L,bottom],[R,bottom],[R,plateaus.at(-1).y]];
 for(let i=plateaus.length-1;i>=0;i--){
  const q=plateaus[i];pts.push([q.x0,q.y]);
  if(i>0)pts.push([q.x0,plateaus[i-1].y]);
 }
 return {polygon:pts,stops,plateaus};
}
function buildWall(meta){
 const p=meta.params,out=new PartSet(meta.id),profile=wallProfile(p);
 const body=out.part(M.plaster,'wall-body');body.extrudeXY(profile.polygon,p.depth,0);
 // soft raised strips cast gentle shadow over the wall near base and sides
 const base=out.part(M.stone,'stone-socle');
 base.box(0,p.baseY+.08,0,p.width+.10,.19,p.depth+.06);
 const line=out.part(M.plasterShade,'plaster-trim');
 line.box(0,p.baseY+.27,p.depth/2+.012,p.width-.11,.042,.025);
 // stepped pilasters and plaster archivolts give the silhouette physical thickness.
 // They sit in front of the continuous wall skin, not as disconnected boxes.
 const piers=out.part(M.plaster,'raised-step-piers');
 const shadowPiers=out.part(M.plasterShade,'step-corner-reveals');
 for(let i=1;i<profile.stops.length-1;i++){
   const s=profile.stops[i],height=s.y-p.baseY;
   if(height<.4)continue;
   piers.box(s.x+.018,p.baseY+height/2,p.depth/2+.052,.155,height+.025,.11);
   shadowPiers.box(s.x+.111,p.baseY+height/2,p.depth/2+.055,.032,height+.028,.08);
 }
 const courses=out.part(M.plasterShade,'raised-cornice-shadows');
 profile.stops.forEach((s,i)=>{
   const x1=profile.stops[i+1]?.x??p.width/2;
   if(x1-s.x>.07)courses.box((s.x+x1)/2,s.y-.155,p.depth/2+.038,x1-s.x,.063,.08);
 });
 // For each horizontal stop add compound tiles: stone undercourse, curved double-roll roof, finial
 profile.stops.forEach((s,i)=>{
  const x0=s.x, x1=profile.stops[i+1]?.x??p.width/2;
  if(x1-x0<.06)return;
  // Cap segments meet exactly at the staircase stations. Only the two external
  // ends may overhang; overlapping end-rosettes were a visible false seam.
  const first=i===0,last=i===profile.stops.length-1;
  const capL=x0-(first?.07:0),capR=x1+(last?.07:0);
  const y=s.y;
  const stone=out.part(M.stone,'cap-stone');stone.box((capL+capR)/2,y+.018,0,capR-capL,.12,p.capWidth*2+.13);
  const dark=out.part(M.slateDark,'cap-shaded-underlip');dark.box((capL+capR)/2,y+.105,0,capR-capL,.065,p.capWidth*2+.22);
  const tile=out.part(M.slate,'curved-cap');tileCap(tile,capL,capR,y+.18,p.capWidth,{rise:.12,ends:last?p.finial*.25:0});
  const ridge=out.part(M.slateLight,'cap-ridge');ridge.tube([[capL,y+.265,0],[capR,y+.265,0]],.086,12);
  for(const x of [first?capL:null,last?capR:null].filter(v=>v!==null)){
   const plug=out.part(M.slateEdge,'cap-end-rosette');
   for(let j=0;j<10;j++){
    const a=j/10*PI*2,b=(j+1)/10*PI*2;
    plug.tri([x,y+.266,0],[x,y+.266+.065*Math.cos(a),.065*Math.sin(a)],[x,y+.266+.065*Math.cos(b),.065*Math.sin(b)]);
   }
  }
  if(i===profile.stops.length-2||i===profile.stops.length-3){
    const fin=out.part(M.slateDark,'flying-finial');const x=x1+.06,f=p.finial;
    fin.tube([[x-.10,y+.20,0],[x+.02,y+.26,0],[x+.11,y+.30+f*.3,0],[x+.15,y+.32+f,0]],.075,12);
  }
 });
 // A few intentionally shaped stone reveals at an end, not a flat texture
 const stone=out.part(M.stone,'exposed-masonry');
 const darkStone=out.part(M.slateEdge,'masonry-joints');
 for(let row=0;row<8;row++){
  for(let col=0;col<2;col++){
   const x=p.width/2-.18-col*.23+(row%2)*.06;
   const y=p.baseY+.19+row*.23;
   if(y>p.wallHeight-0.13)continue;
   stone.box(x,y,p.depth/2+.019,.21,.20,.043);
   if((row+col)%3===0)darkStone.box(x,y+.07,p.depth/2+.049,.18,.024,.018);
  }
 }
 // cut in the white wall: narrow vertical cove at side face
 const reveal=out.part(M.plasterShade,'endwall-corner-reveal');
 reveal.box(-p.width/2+.075,p.baseY+.37,p.depth/2+.02,.09,.55,.045);
 return {parts:out.parts,metrics:out.metrics(),bounds:out.bounds(),metadata:{...meta,anchors:{wallSeat:{x:0,y:p.baseY,z:0,depth:p.depth},left:{x:-p.width/2,y:p.baseY,z:0},right:{x:p.width/2,y:p.baseY,z:0},capAxisZ:0,capSpans:profile.stops.map((s,i)=>({start:s.x,end:profile.stops[i+1]?.x??p.width/2,level:s.y}))},profile:profile.stops,wallRim:profile.plateaus,stableId:stableModuleId(meta)}};
}
function buildEave(meta,context={}){
 const p=meta.params,out=new PartSet(meta.id),worldX=context.worldX??0;
 const refLength=context.referenceLength??p.length,joins=context.joins??{};
 const rafterPitch=refLength/(p.rafterCount-1),bracketPitch=refLength/(p.bracketCount-1);
 const start=-p.length/2,end=p.length/2,front=p.projection;
 const wall=out.part(M.plaster,'wall-slice');wall.box(0,.82,-.43,p.length,1.62,.32);
 const socle=out.part(M.stone,'socle');socle.box(0,.17,-.43,p.length,.32,.40);
 // roof section: sloping back toward front, with curvature in tile shafts
 const roofParams={length:p.length,halfSpan:1.08,eaveHeight:2.14,rise:.66,tilePitch:.32,tileRow:.31,tileArch:.092,xPhase:0};
 // A self-standing eave roof with front fascia at z=projection
 const ro=out.part(M.slateDark,'eave-arch-support');
 ro.grid((u,v)=>{const x=lerp(start-(joins.left?0:.11),end+(joins.right?0:.11),u),z=lerp(-.62,front+.08,v);return [x,2.86-.64*((z+.62)/(front+.70))+.055*Math.pow((z+.62)/(front+.7),5),z];},16,12);
 const tile=out.part(M.slate,'overlapping-eave-tiles');
 const lips=out.part(M.slateEdge,'overlapping-tile-lips');
 const nR=Math.max(4,Math.round((front+.62)/.31)), tilePitch=.31;
 for(const station of worldStations(start-tilePitch,end+tilePitch,worldX,tilePitch,0))for(let r=0;r<nR;r++){
  const x=station.local,lo=Math.max(start,x-tilePitch*.5),hi=Math.min(end,x+tilePitch*.5);
  if(hi-lo<.005)continue;
  const z0=-.62+r*(front+.7)/nR,z1=z0+(front+.7)/nR+.028;
  const shade=noise(`eave:${station.index}:${r}`);
  const f=(u,v,drop=0)=>{const xx=lerp(lo,hi,u),z=lerp(z0,z1,v),q=(xx-x)/(tilePitch*.5),arch=.086*Math.sqrt(Math.max(0,1-q*q));
   const t=(z+.62)/(front+.70);return [xx,2.86-.64*t+.055*t**5+.055+arch+shade*.01-drop,z];};
  tile.grid((u,v)=>f(u,v),7,3);lips.grid((u,v)=>f(u,lerp(.92,1,v),v*.018),7,1);
 }
 const wood=out.part(M.wood,'rafters-and-cantilevers');
 const light=out.part(M.woodLight,'mortise-stops');
 const dark=out.part(M.woodDark,'timber-mouldings');
 // multiple layered horizontal fascia profiles
 const yFace=2.23;
 for(const [q,z,sy] of [[0,front+.16,.17],[1,front+.04,.12],[2,front-.10,.12],[3,front-.28,.17]]){
  const w=q===0?M.wood:M.woodDark;
  const over=(.21-q*.09)/2,x0=start-(joins.left?0:over),x1=end+(joins.right?0:over);
  out.part(w,`multi-tier-fascia-${q}`).box((x0+x1)/2,yFace-.10-q*.125,z,x1-x0,sy,.12);
 }
 for(const {local:x} of worldStations(start+.08,end-.08,worldX,rafterPitch,0)){
  wood.beam([x,2.62,-.49],[x,2.13,front+.18],.10,.12);
  light.box(x,2.145,front+.23,.125,.115,.15);
 }
 // bracket groups at support points, profiled descending dougong stacks not a single box
 for(const {local:x,index:i} of worldStations(start+.3,end-.3,worldX,bracketPitch,0)){
  const crown=out.part(M.woodLight,`carved-bracket-${i}`);
  const bracket=out.part(M.woodDark,`dovetail-stack-${i}`);
  const beam=out.part(M.wood,`strut-${i}`);
  bracket.box(x,1.63,-.01,.44,.23,.39);
  bracket.box(x,1.81,.19,.57,.22,.45);
  beam.beam([x,1.64,-.28],[x,2.22,front-.12],.155,.17);
  crown.box(x,1.91,.45,.49,.17,.40);
  crown.box(x,2.04,.71,.37,.13,.39);
  // round pin and stepped corbel moulding
  crown.tube([[x-.17,1.99,.81],[x,2.08,.84],[x+.17,1.99,.81]],.043,8);
 }
 const beam=out.part(M.woodDark,'longitudinal-wall-beam');
 {const x0=start-(joins.left?0:.045),x1=end+(joins.right?0:.045);beam.box((x0+x1)/2,1.58,-.29,x1-x0,.20,.31);}
 const endCap=out.part(M.slateLight,'slate-edge-rounded-tip');
 endCap.tube([[start-(joins.left?0:.1),2.30,front+.14],[end+(joins.right?0:.1),2.30,front+.14]],.077,12);
 return {parts:out.parts,metrics:out.metrics(),bounds:out.bounds(),metadata:{...meta,anchors:{bearingY:1.58,startX:start,endX:end,frontZ:front,wallPlaneZ:-.43,axisZ:0,worldX,rafterPitch,bracketPitch,tilePitch:.31,joins:{left:!!joins.left,right:!!joins.right}},stableId:stableModuleId(meta)}};
}

export function buildModule(def,overrides={},context={}){
 const meta=resolve(def,overrides);
 switch(meta.type){case 'wall':return buildWall(meta);case 'roof':return buildRoof(meta,context);case 'eave':return buildEave(meta,context);default:throw new Error(`Unknown module ${meta.type}`);}
}
/** Test how a roof module boundary can be read without introducing new topology. */
export function roofSplitSpec(def,splitRatio=.5){
 const p=resolve(def).params;const a={...p,length:p.length*splitRatio},b={...p,length:p.length*(1-splitRatio)};
 const offsetA=-p.length/2+a.length/2,offsetB=p.length/2-b.length/2;
 return [{...a,xOrigin:offsetA},{...b,xOrigin:offsetB}];
}
