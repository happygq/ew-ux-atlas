/** Fixed operation sequences; ExpectReject is a test-only wrapper, not a user command. */
const a=(x,z,level=0,color='PAPER')=>({type:'Add',x,z,level,color});
const r=(x,z,level)=>({type:'Remove',x,z,level});
const c=(x,z,level,color)=>({type:'Recolor',x,z,level,color});
const bad=(operation,code)=>({type:'ExpectReject',operation,code});
const grid=(x0,z0,w,h,l,color)=>{const out=[];for(let z=z0;z<z0+h;z++)for(let x=x0;x<x0+w;x++)out.push(a(x,z,l,color));return out;};
const ring=(x0,z0,n,l,color)=>{const out=[];for(let z=z0;z<z0+n;z++)for(let x=x0;x<x0+n;x++)if(x===x0||x===x0+n-1||z===z0||z===z0+n-1)out.push(a(x,z,l,color));return out;};
export const SCENARIOS=Object.freeze({
 V01:{label:'V01 · 二层紧凑住宅',steps:[...grid(2,2,2,2,0,'PAPER'),...grid(2,2,2,2,1,'PAPER')]},
 V02:{label:'V02 · 贯通天井与遮盖反例',steps:[...ring(3,3,3,0,'PAPER'),...ring(3,3,3,1,'PAPER'),a(4,4,1),r(4,4,1)]},
 V03:{label:'V03 · 三层逐层错退',steps:[...grid(2,2,3,3,0,'MIST'),...grid(2,2,2,2,1,'MIST'),a(2,2,2,'MIST'),bad(a(8,8,2),'UNSUPPORTED_ADD')]},
 V04:{label:'V04 · 跨层操作与拒绝',steps:[a(2,2),a(3,2),a(2,2,1),c(3,2,0,'MIST'),a(4,2,0,'MIST'),bad(r(2,2,0),'SUPPORT_DEPENDENCY'),r(2,2,1),r(2,2,0),a(2,2,0,'SILK'),bad(a(8,8,1),'UNSUPPORTED_ADD')]}
});
