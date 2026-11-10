/** Deterministic Add/Recolor/Remove operation logs; not pre-baked final meshes. */
const add=(x,z,color)=>({type:'Add',x,z,color});
const remove=(x,z)=>({type:'Remove',x,z});
const recolor=(x,z,color)=>({type:'Recolor',x,z,color});
const RING=(startX,startZ,size,scheme)=>{
 const ops=[];for(let z=startZ;z<startZ+size;z++)for(let x=startX;x<startX+size;x++){
  if(x===startX||x===startX+size-1||z===startZ||z===startZ+size-1){
   const type=z===startZ+size-1?'PAPER':z===startZ?'MIST':x===startX?'SILK':'MOUNTAIN';
   ops.push(add(x,z,scheme?scheme(type):type));
  }
 }
 return ops;
};
const intro=[add(3,5,'PAPER'),add(4,5,'PAPER'),add(5,5,'PAPER'),add(6,5,'PAPER'),
 add(3,6,'MIST'),add(4,6,'MIST'),recolor(5,5,'MIST'),add(5,6,'MIST'),
 add(6,6,'SILK'),remove(4,5),add(4,5,'SILK')];
const ring=RING(3,3,5);
const open=[...ring,remove(5,3)];
const double=[...RING(1,3,5),...RING(7,3,5,c=>({PAPER:'MIST',MIST:'PAPER',SILK:'MOUNTAIN',MOUNTAIN:'SILK'}[c]))];
export const SCENARIOS=Object.freeze({
 ROOMS:{label:'01 · 连通与建造顺序',subtitle:'同色合并、不同色隔墙与 Recolor 非追溯',steps:intro},
 RING:{label:'02 · 围合自动成院',subtitle:'从空场景连续 Add，最终自动识别主庭院',steps:ring},
 OPEN:{label:'03 · Remove 打开半院',subtitle:'先构成封闭院，再删除一侧，观察类型转换',steps:open},
 DOUBLE:{label:'04 · 双院与中间通巷',subtitle:'两组独立围合，中间保留连续开敞通道',steps:double}
});
