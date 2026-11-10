import {clamp,rounded,vecNear,norm} from './math.js';

export const CONTRACT_VERSION='ew/ux/module-boundary/v0.1';
export const INTERFACE_VERSION='ew/ux/module-interface/v0.1';
export const DEFAULTS=Object.freeze({
  wall:{width:4.0,depth:.42,baseY:.28,steps:4,stepRise:.55,wallHeight:2.25,capWidth:.35,finial:.28},
  roof:{length:4.4,halfSpan:1.55,eaveHeight:1.68,rise:1.02,tilePitch:.32,tileRow:.37,tileArch:.082,xPhase:0},
  eave:{length:4.2,projection:1.06,bracketCount:5,rafterCount:13,beamDepth:.20}
});
export const MODULES=Object.freeze([
  {id:'MH-01',type:'wall',name:'典型四级马头墙',en:'Stepped gable / signature',params:{}},
  {id:'MH-02',type:'wall',name:'高耸五级马头墙',en:'Rising stepped silhouette',params:{steps:5,stepRise:.52,wallHeight:2.53}},
  {id:'MH-03',type:'wall',name:'鹊尾卷翘收头',en:'Upturned quetail finials',params:{steps:4,finial:.58}},
  {id:'MH-04',type:'wall',name:'矮式宽墙与叠压顶',en:'Low broad parapet',params:{width:4.7,stepRise:.38,wallHeight:1.95}},
  {id:'RF-01',type:'roof',name:'曲面灰瓦双坡屋顶',en:'Double pitch · barrel tiles',params:{}},
  {id:'RF-02',type:'roof',name:'陡坡细瓦屋顶',en:'Steeper and tighter tile rhythm',params:{rise:1.38,tilePitch:.285}},
  {id:'RF-03',type:'roof',name:'深出檐低坡瓦面',en:'Broad profile · deep overhang',params:{halfSpan:1.83,rise:.78,length:4.85}},
  {id:'RF-04',type:'roof',name:'屋脊及滴水瓦特写',en:'Ridge caps & drip tiles',params:{length:3.6,tilePitch:.26,tileArch:.115}},
  {id:'EV-01',type:'eave',name:'五组木斗拱檐口',en:'Layered timber eave',params:{}},
  {id:'EV-02',type:'eave',name:'密椽小斗拱',en:'Fine rafters & compact brackets',params:{rafterCount:17,bracketCount:7}},
  {id:'EV-03',type:'eave',name:'深挑叠梁重檐',en:'Deep cantilever & stratified timber',params:{projection:1.38,beamDepth:.26}},
  {id:'EV-04',type:'eave',name:'短跨精刻端檐',en:'Carved timber terminus',params:{length:3.2,projection:.95,bracketCount:4}}
]);
const BOUNDS={
 wall:{width:[2.8,5],depth:[.25,.7],baseY:[.12,.6],steps:[3,5],stepRise:[.28,.85],wallHeight:[1.7,2.85],capWidth:[.25,.48],finial:[0,.7]},
 roof:{length:[1.4,5],halfSpan:[1.1,2],eaveHeight:[1.3,2.2],rise:[.55,1.55],tilePitch:[.24,.42],tileRow:[.25,.44],tileArch:[.04,.15],xPhase:[-10,10]},
 eave:{length:[2.8,5],projection:[.7,1.55],bracketCount:[3,8],rafterCount:[8,24],beamDepth:[.14,.32]}
};
export function resolve(def,override={}){
 const type=def.type,params={...DEFAULTS[type],...def.params,...override};
 for(const [key,v] of Object.entries(params)){
  const r=BOUNDS[type][key]; if(!r)throw new Error(`Unexpected ${type} parameter: ${key}`);
  if(!Number.isFinite(v)||v<r[0]||v>r[1])throw new RangeError(`${type}.${key}=${v} outside [${r}]`);
  if(['steps','bracketCount','rafterCount'].includes(key)&&!Number.isInteger(v))throw new TypeError(`${key} must be integer`);
 }
 return {id:def.id,type,params,interface:INTERFACE_VERSION,contract:CONTRACT_VERSION,source:'deterministic-procedural',replacementKey:def.id};
}
export const roofSlope=(p,z)=>z===0?0:Math.sign(z)*(-p.rise/p.halfSpan+(.052*8/p.halfSpan)*Math.pow(Math.abs(z)/p.halfSpan,7));
export const roofY=(p,z)=>p.eaveHeight+p.rise*(1-Math.min(1,Math.abs(z)/p.halfSpan))+.052*Math.pow(Math.abs(z)/p.halfSpan,8);
/** X-aligned boundary; samples refer to the exposed roof substrate and repeating tile phase.
 * Phase is measured in *world* X, never restarted at a tile module boundary. */
export function roofBoundary(p,side,xOrigin=0){
 const x=xOrigin+(side==='left'?-p.length/2:p.length/2),zValues=Array.from({length:33},(_,i)=>-p.halfSpan+i*p.halfSpan/16);
 return {version:CONTRACT_VERSION,side,planeX:rounded(x,8),
   profile:zValues.map(z=>[rounded(z,7),rounded(roofY(p,z),7)]),
   normals:zValues.map(z=>norm([0,1,-roofSlope(p,z)]).map(q=>rounded(q,7))),
   crossTangent:zValues.map(z=>norm([0,roofSlope(p,z),1]).map(q=>rounded(q,7))),
   tilePhase:rounded(((x-p.xPhase)/p.tilePitch%1+1)%1,7),
   tilePitch:p.tilePitch, tileRow:p.tileRow,tileArch:p.tileArch,
   tangent:[1,0,0],normalRule:'roofY derivative; same at adjacent X boundaries',
   seamPolicy:'abutting-no-overlap; substrate coincident; tile geometry clipped to seam plane',
   units:'m'};
}
export function checkRoofSeam(a,b,positionTolerance=1e-5){
 const issues=[];if(a.version!==b.version)issues.push('contract_version');
 if(Math.abs(a.planeX-b.planeX)>positionTolerance)issues.push('position');
 if(a.profile.length!==b.profile.length||a.profile.some((p,i)=>!b.profile[i]||!vecNear(p,b.profile[i],positionTolerance)))issues.push('height_profile');
 for(const key of ['normals','crossTangent'])if(a[key]?.length!==b[key]?.length||a[key].some((p,i)=>!b[key][i]||!vecNear(p,b[key][i],positionTolerance)))issues.push(key);
 for(const key of ['tilePitch','tileRow','tileArch'])if(Math.abs(a[key]-b[key])>positionTolerance)issues.push(key);
 const da=Math.abs(a.tilePhase-b.tilePhase);if(Math.min(da,1-da)>positionTolerance)issues.push('tile_phase');
 if(a.seamPolicy!==b.seamPolicy)issues.push('policy');
 return {ok:issues.length===0,issues,maxProfileDelta:Math.max(0,...a.profile.map((p,i)=>Math.abs(p[1]-(b.profile[i]?.[1]??Infinity))))};
}
export function stableModuleId({id,type,params}){
 const sorted=Object.fromEntries(Object.keys(params).sort().map(k=>[k,params[k]]));
 return `${INTERFACE_VERSION}:${id}:${type}:${JSON.stringify(sorted)}`;
}
/** Hook for a future artist-made mesh. The override has to advertise the same contract, anchors and ID. */
export function applyReplacement(generated,custom){
 if(!custom)return generated;
 const a=generated.metadata,b=custom.metadata;
 if(!a||!b||a.id!==b.id||a.contract!==b.contract||a.stableId!==b.stableId||JSON.stringify(a.anchors)!==JSON.stringify(b.anchors))
  throw new Error('Artist replacement violates stable module identity / boundary anchors');
 if(!Array.isArray(custom.parts)||custom.parts.length===0)throw new Error('Replacement has no geometry');
 return custom;
}
