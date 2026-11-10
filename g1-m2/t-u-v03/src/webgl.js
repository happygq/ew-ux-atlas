import {Mesh} from './mesh.js';
import {norm,sub,cross,dot,PI} from './math.js';
const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNorm;
uniform mat4 uVP;
uniform vec3 uOffset;
uniform vec3 uExplodeOffset;
uniform float uExplode;
out vec3 vN;out vec3 vWorld;out float vDepth;
void main(){vec3 p=aPos+uOffset+uExplodeOffset*uExplode;vN=aNorm;vWorld=p;vec4 q=uVP*vec4(p,1.0);vDepth=q.w;gl_Position=q;}`;
const FS=`#version 300 es
precision highp float;
in vec3 vN;in vec3 vWorld;in float vDepth;
uniform vec3 uColor;uniform float uRough;uniform float uAlpha;
out vec4 frag;
void main(){
 vec3 N=normalize(gl_FrontFacing?vN:-vN);vec3 sun=normalize(vec3(-0.55,0.88,0.65));vec3 fill=normalize(vec3(.6,.42,-.8));
 float l=max(dot(N,sun),0.0);float f=max(dot(N,fill),0.0);
 float ambient=.55;float soft=ambient+.48*l+.12*f;
 float edge=.88+.12*abs(N.y);float warm=.035*max(dot(N,sun),0.0);
 vec3 c=uColor*soft*edge+vec3(warm*.75,warm*.48,warm*.20);
 float fog=clamp((vDepth-8.)/23.,0.,1.)*.14;
 c=mix(c,vec3(.935,.892,.831),fog);
 frag=vec4(pow(max(c,vec3(.0)),vec3(.95)),uAlpha);
}`;
const MATERIALS={
 plaster:{color:'#f5e9d7',rough:1},plasterShade:{color:'#d7c9b3',rough:1},
 stone:{color:'#8f8a80',rough:1},slate:{color:'#54565a',rough:.8},slateEdge:{color:'#858589',rough:.85},
 slateLight:{color:'#777980',rough:.8},slateDark:{color:'#333a3b',rough:.95},
 wood:{color:'#885531',rough:.9},woodDark:{color:'#573922',rough:.95},woodLight:{color:'#ad7447',rough:.85},
 cut:{color:'#715b47',rough:1},brass:{color:'#a17b4a',rough:1},
 platform:{color:'#c4ad91',rough:1},platformTop:{color:'#ece0ce',rough:1},
 shadow:{color:'#726657',rough:1},floor:{color:'#e9dfd1',rough:1}
};
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)}
function shader(gl,t,s){let x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x));return x;}
function program(gl){let p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,VS));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
const perspective=(fov,aspect,n,f)=>{const y=1/Math.tan(fov/2),x=y/aspect,N=1/(n-f);return [x,0,0,0, 0,y,0,0, 0,0,(f+n)*N,-1, 0,0,2*f*n*N,0]};
const lookAt=(eye,target)=>{const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,eye),-dot(y,eye),-dot(z,eye),1]};
const multiply=(a,b)=>{const o=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)o[i*4+j]+=a[k*4+j]*b[i*4+k];return o};

/** Shared mouse / touch orbit: one finger rotates, two fingers pinch to zoom. */
function attachOrbit(view,canvas){
 const fingers=new Map();let lastCenter=null,lastGap=null;
 const clampDistance=()=>{view.distance=Math.max(3.5,Math.min(28,view.distance));};
 function centerAndGap(){const arr=[...fingers.values()];
  if(arr.length===1)return {center:arr[0],gap:null};
  if(arr.length>=2){const a=arr[0],b=arr[1];return {center:[(a[0]+b[0])/2,(a[1]+b[1])/2],gap:Math.hypot(a[0]-b[0],a[1]-b[1])};}
  return {center:null,gap:null};}
 const move=()=>{const v=centerAndGap();
   if(v.gap!==null&&lastGap!==null&&v.gap>2&&lastGap>2){view.distance*=lastGap/v.gap;clampDistance();}
   else if(fingers.size===1&&lastCenter){view.yaw-=(v.center[0]-lastCenter[0])*.008;view.pitch=Math.max(-.11,Math.min(1.28,view.pitch+(v.center[1]-lastCenter[1])*.006));}
   lastCenter=v.center;lastGap=v.gap;};
 canvas.addEventListener('pointerdown',e=>{fingers.set(e.pointerId,[e.clientX,e.clientY]);try{canvas.setPointerCapture(e.pointerId)}catch{};let v=centerAndGap();lastCenter=v.center;lastGap=v.gap;canvas.style.cursor='grabbing'});
 canvas.addEventListener('pointermove',e=>{if(!fingers.has(e.pointerId))return;fingers.set(e.pointerId,[e.clientX,e.clientY]);move()});
 const finish=e=>{fingers.delete(e.pointerId);let v=centerAndGap();lastCenter=v.center;lastGap=v.gap;if(!fingers.size)canvas.style.cursor='grab';};
 canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
 canvas.addEventListener('wheel',e=>{e.preventDefault();view.distance*=Math.exp(e.deltaY*.0011);clampDistance()},{passive:false});
}

export class Renderer {
 constructor(canvas){
  this.canvas=canvas;this.gl=canvas.getContext('webgl2',{antialias:true,alpha:true,preserveDrawingBuffer:true,premultipliedAlpha:false});
  if(!this.gl)throw new Error('WebGL2 unavailable. Use Chrome or Edge with hardware acceleration.');
  const gl=this.gl;this.p=program(gl);gl.useProgram(this.p);
  this.uniforms=Object.fromEntries(['uVP','uOffset','uExplodeOffset','uColor','uRough','uAlpha','uExplode'].map(k=>[k,gl.getUniformLocation(this.p,k)]));
  this.cache=new WeakMap();this.items=[];
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  this.yaw=.65;this.pitch=.29;this.distance=9.4;this.target=[0,1.72,0];this.explode=0;this.drawCalls=0;
  this.shared=this.makeGround();this.bindControls();this.resize();
  window.addEventListener('resize',()=>this.resize());
 }
 makeGround(){
  const base=new Mesh('ground','floor');base.quad([-60,-.28,-60],[60,-.28,-60],[60,-.28,60],[-60,-.28,60]);
  const platform=new Mesh('platform','platform');platform.box(0,-.08,0,5.7,.25,4.9);
  const top=new Mesh('top','platformTop');top.box(0,.048,0,5.75,.025,4.94);
  const shadows=[];for(let i=0;i<10;i++){
   const s=new Mesh(`shadow-${i}`,'shadow');let r=2.7+i*.12;
   s.grid((u,v)=>{let a=u*2*PI,z=r*Math.sin(a),x=r*Math.cos(a);return [(1-v)*x,-.272+i*.0002,(1-v)*z*.68]},44,1);
   shadows.push(s);
  }
  return {base,platform,top,shadows};
 }
 bindControls(){attachOrbit(this,this.canvas)}
 resize(){const s=window.devicePixelRatio||1,rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;this.canvas.width=Math.round(rect.width*Math.min(2,s));this.canvas.height=Math.round(rect.height*Math.min(2,s));this.gl.viewport(0,0,this.canvas.width,this.canvas.height);}
 compile(mesh){const gl=this.gl;let obj=this.cache.get(mesh);if(obj)return obj;
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  const data=new Float32Array(mesh.positions.length*2);for(let i=0;i<mesh.positions.length;i+=3){const o=i*2;for(let j=0;j<3;j++){data[o+j]=mesh.positions[i+j];data[o+3+j]=mesh.normals[i+j];}}
  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);gl.enableVertexAttribArray(1);gl.bindVertexArray(null);
  obj={vao,vertexCount:mesh.positions.length/3};this.cache.set(mesh,obj);return obj;
 }
 drawMesh(mesh,offset=[0,0,0],opacity=1,explodeOffset=[0,0,0]){
  if(!mesh.positions.length)return;
  const gl=this.gl,u=this.uniforms,obj=this.compile(mesh),mat=MATERIALS[mesh.material]||MATERIALS.plaster;
  gl.uniform3fv(u.uColor,rgb(mat.color));gl.uniform1f(u.uRough,mat.rough);gl.uniform1f(u.uAlpha,opacity);
  gl.uniform3fv(u.uOffset,offset);gl.uniform3fv(u.uExplodeOffset,explodeOffset);
  gl.bindVertexArray(obj.vao);gl.drawArrays(gl.TRIANGLES,0,obj.vertexCount);this.drawCalls++;
 }
 render(){
  const gl=this.gl;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const aspect=this.canvas.width/this.canvas.height||1;
  const eye=[this.target[0]+this.distance*Math.sin(this.yaw)*Math.cos(this.pitch),this.target[1]+this.distance*Math.sin(this.pitch),this.target[2]+this.distance*Math.cos(this.yaw)*Math.cos(this.pitch)];
  gl.useProgram(this.p);gl.uniformMatrix4fv(this.uniforms.uVP,false,new Float32Array(multiply(perspective(.76,aspect,.07,120),lookAt(eye,this.target))));
  gl.uniform1f(this.uniforms.uExplode,this.explode);this.drawCalls=0;
  this.drawMesh(this.shared.base);
  for(const item of this.items){
   const tx=item.pos[0],tz=item.pos[2];
   // draw soft ambient-occlusion-like ground shadow, behind the plinth
   gl.depthMask(false);for(let i=9;i>=0;i--)this.drawMesh(this.shared.shadows[i],[tx,0,tz],.012+(9-i)*.002);
   gl.depthMask(true);
   if(item.plinth!==false){this.drawMesh(this.shared.platform,[tx,0,tz]);this.drawMesh(this.shared.top,[tx,0,tz]);}
   for(const part of item.module.parts){
    const n=part.id.toLowerCase();const e=n.includes('ridge')?[0,.22,0]:n.includes('tiles')?[0,.06,.10]:n.includes('wood')||n.includes('bracket')||n.includes('rafter')?[0,-.25,.18]:n.includes('cap')?[0,.15,0]:[0,0,0];
    this.drawMesh(part,item.pos,1,e);
   }
  }
  gl.bindVertexArray(null);
 }
 setItems(items){this.items=items;}
 focus(mode='single'){
  this.target=[0,mode==='compare'?1.7:1.74,0];this.distance=mode==='compare'?17.8:9.3;this.yaw=.61;this.pitch=.31;if(window.innerWidth<=820){this.distance*=1.12;this.target[1]+=.38;}
 }
}

/** Portable read-only display fallback when WebGL2 is disabled by a sandbox or policy.
 * Draws the exact same parametric mesh with a CPU painter's algorithm; it is NOT
 * evidence of a successful real-WebGL visual Gate. */
export class CanvasRenderer {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');if(!this.ctx)throw new Error('Neither WebGL2 nor Canvas2D available');this.isFallback=true;
  this.yaw=.65;this.pitch=.29;this.distance=9.4;this.target=[0,1.72,0];this.explode=0;this.items=[];this.setPointer();this.resize();window.addEventListener('resize',()=>this.resize());}
 resize(){const d=Math.min(1.5,window.devicePixelRatio||1),r=this.canvas.getBoundingClientRect();this.canvas.width=Math.round(r.width*d);this.canvas.height=Math.round(r.height*d);}
 setPointer(){attachOrbit(this,this.canvas)}
 focus(mode='single'){this.target=[0,mode==='compare'?1.7:1.74,0];this.distance=mode==='compare'?17.8:9.3;this.yaw=.61;this.pitch=.31;if(window.innerWidth<=820){this.distance*=1.12;this.target[1]+=.38;}}
 setItems(items){this.items=items;}
 render(){const ctx=this.ctx,W=this.canvas.width,H=this.canvas.height;ctx.clearRect(0,0,W,H);
  const eye=[this.target[0]+this.distance*Math.sin(this.yaw)*Math.cos(this.pitch),this.target[1]+this.distance*Math.sin(this.pitch),this.target[2]+this.distance*Math.cos(this.yaw)*Math.cos(this.pitch)],
   z=norm(sub(eye,this.target)),x=norm(cross([0,1,0],z)),y=cross(z,x),scale=H*.5/Math.tan(.76/2);
  const project=p=>{let v=sub(p,eye),d=-dot(v,z);return [W*.5+dot(v,x)*scale/d,H*.5-dot(v,y)*scale/d,d]};
  const all=[];const sun=norm([-.55,.88,.65]);
  function emit(mesh,translate=[0,0,0],explode=[0,0,0],factor=0){
   const pp=mesh.positions,nn=mesh.normals;let shift=[translate[0]+explode[0]*factor,translate[1]+explode[1]*factor,translate[2]+explode[2]*factor];
   let color=rgb((MATERIALS[mesh.material]||MATERIALS.plaster).color);
   for(let i=0;i<pp.length;i+=9){let coords=[];for(let k=0;k<9;k+=3)coords.push(project([pp[i+k]+shift[0],pp[i+k+1]+shift[1],pp[i+k+2]+shift[2]]));
    if(coords.some(q=>q[2]<.04))continue;
    let n=[nn[i],nn[i+1],nn[i+2]],facing=dot(n,z)>=0?n:n.map(v=>-v),d=Math.max(.32,.50+Math.max(0,dot(facing,sun))*.56);
    const fog=Math.min(.17,Math.max(0,(coords[0][2]-7)/35));
    const col=color.map((v,k)=>Math.max(0,Math.min(255,Math.round(255*(v*d*(1-fog)+[.935,.892,.831][k]*fog)))));
    all.push({p:coords,z:(coords[0][2]+coords[1][2]+coords[2][2])/3,c:`rgb(${col.join(',')})`});
   }
  }
  for(const item of this.items){
   const pos=item.pos;const p0=[pos[0],-.10,pos[2]];const sc=project(p0);
   // Grounding shadow and clean stone studio plinth (separate from topology)
   const rx=2.55*scale/sc[2],ry=1.08*scale/sc[2];let grad=ctx.createRadialGradient(sc[0],sc[1],4,sc[0],sc[1],Math.max(rx,ry));grad.addColorStop(0,'rgba(38,37,32,.28)');grad.addColorStop(1,'rgba(52,52,45,0)');
   ctx.save();ctx.translate(sc[0],sc[1]);ctx.scale(1,ry/rx);ctx.fillStyle=grad;ctx.beginPath();ctx.arc(0,0,rx,0,PI*2);ctx.fill();ctx.restore();
   if(item.plinth!==false){const slab=new Mesh('slab','platform');slab.box(0,-.11,0,5.6,.24,4.8);emit(slab,pos);
   const slabTop=new Mesh('top','platformTop');slabTop.box(0,.02,0,5.65,.024,4.84);emit(slabTop,pos);}
   for(const part of item.module.parts){const n=part.id.toLowerCase(),e=n.includes('ridge')?[0,.22,0]:n.includes('tiles')?[0,.06,.10]:n.includes('wood')||n.includes('bracket')||n.includes('rafter')?[0,-.25,.18]:n.includes('cap')?[0,.15,0]:[0,0,0];emit(part,pos,e,this.explode);}
  }
  all.sort((a,b)=>b.z-a.z);
  for(const q of all){ctx.fillStyle=q.c;ctx.beginPath();ctx.moveTo(q.p[0][0],q.p[0][1]);ctx.lineTo(q.p[1][0],q.p[1][1]);ctx.lineTo(q.p[2][0],q.p[2][1]);ctx.closePath();ctx.fill();}
 }
}
