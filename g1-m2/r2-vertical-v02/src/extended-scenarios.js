/** Independent additional fixture candidates. No new construction operations. */
import {SCENARIOS as ORIGINAL} from './scenarios.js';
const a=(x,z,level=0,color='PAPER')=>({type:'Add',x,z,level,color});
const r=(x,z,level)=>({type:'Remove',x,z,level});
const c=(x,z,level,color)=>({type:'Recolor',x,z,level,color});
const bad=(operation,code)=>({type:'ExpectReject',operation,code});
const patch=(x0,z0,level,color='PAPER')=>[a(x0,z0,level,color),a(x0+1,z0,level,color),a(x0,z0+1,level,color),a(x0+1,z0+1,level,color)];
const ring=(x0,z0,w,h)=>{const out=[];for(let z=z0;z<z0+h;z++)for(let x=x0;x<x0+w;x++)if(x===x0||x===x0+w-1||z===z0||z===z0+h-1)out.push(a(x,z));return out;};
export const EXTENDED=Object.freeze({
  ...ORIGINAL,
  V05:{label:'V05 · 承托由直托改为桥接',steps:[
    a(4,4),a(4,4,1),a(3,4),a(5,4),r(4,4,0),
    bad(r(3,4,0),'SUPPORT_DEPENDENCY'),a(4,4,0,'MIST')
  ]},
  V06:{label:'V06 · 自动楼梯候选（未打通）',steps:[
    ...patch(2,2,0),...patch(2,2,1),c(2,2,1,'MIST'),r(2,2,1)
  ]},
  V07:{label:'V07 · 部分遮盖但仍与天空连通',steps:[
    ...ring(2,2,3,4),a(3,3,1)
  ]}
});
