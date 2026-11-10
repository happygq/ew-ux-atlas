import {add,sub,mul,cross,norm,PI,lerp} from './math.js';

/** All meshes use metres, X along the eave, Y up, Z roof-span. No external geometry engine. */
export class Mesh {
  constructor(id, material, offset=[0,0,0]) {this.id=id;this.material=material;this.offset=offset;this.positions=[];this.normals=[];this.count=0;}
  tri(a,b,c) {
    const n=norm(cross(sub(b,a),sub(c,a)));
    for(const p of [a,b,c]) {this.positions.push(...p);this.normals.push(...n);}
    this.count++;
    return this;
  }
  quad(a,b,c,d) {this.tri(a,b,c);this.tri(a,c,d);return this;}
  box(cx,cy,cz,sx,sy,sz) {
    const x0=cx-sx/2,x1=cx+sx/2,y0=cy-sy/2,y1=cy+sy/2,z0=cz-sz/2,z1=cz+sz/2;
    const a=[x0,y0,z0],b=[x1,y0,z0],c=[x1,y1,z0],d=[x0,y1,z0],e=[x0,y0,z1],f=[x1,y0,z1],g=[x1,y1,z1],h=[x0,y1,z1];
    this.quad(a,d,c,b).quad(e,f,g,h).quad(a,e,h,d).quad(b,c,g,f).quad(a,b,f,e).quad(d,h,g,c); return this;
  }
  /** Vertices are planar XY polygon. Side walls and caps extruded to +/-depth/2. */
  extrudeXY(points,depth,centerZ=0) {
    const z0=centerZ-depth/2,z1=centerZ+depth/2;
    // Stepped wall profiles are X-monotone, so triangulate continuous front/back
    // as deterministic vertical strips. No internal box joints / spurious faces.
    const xs=[...new Set(points.map(p=>p[0]))].sort((a,b)=>a-b);
    const heightAt=x=>{
      const ys=[];
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length];
        if(Math.abs(a[0]-b[0])<1e-10)continue;
        if(x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0]))
          ys.push(a[1]+(x-a[0])/(b[0]-a[0])*(b[1]-a[1]));
      }
      if(ys.length<2)throw new Error('Non-x-monotone polygon');
      return [Math.min(...ys),Math.max(...ys)];
    };
    for(let i=0;i<xs.length-1;i++){
      const x0=xs[i],x1=xs[i+1],mid=(x0+x1)/2, [lo,hi]=heightAt(mid);
      this.quad([x0,lo,z1],[x1,lo,z1],[x1,hi,z1],[x0,hi,z1]);
      this.quad([x0,hi,z0],[x1,hi,z0],[x1,lo,z0],[x0,lo,z0]);
    }
    const area=points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1]},0);
    const ccw=area>0;
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];
      const v0=[a[0],a[1],z0],v1=[b[0],b[1],z0],v2=[b[0],b[1],z1],v3=[a[0],a[1],z1];
      if(ccw)this.quad(v0,v1,v2,v3);else this.quad(v3,v2,v1,v0);
    }
    return this;
  }
  tube(path,rad=0.1,sides=10){
    // parallel transport approximation: choose a fixed reference axis per segment
    for(let i=0;i<path.length-1;i++){
      const A=path[i],B=path[i+1],dir=norm(sub(B,A));
      const ref=Math.abs(dir[1])<0.94?[0,1,0]:[1,0,0]; const u=norm(cross(dir,ref)),v=norm(cross(dir,u));
      for(let k=0;k<sides;k++){
        const q=k/sides*2*PI,r=(k+1)/sides*2*PI;
        const off=t=>add(mul(u,Math.cos(t)*rad),mul(v,Math.sin(t)*rad));
        this.quad(add(A,off(q)),add(A,off(r)),add(B,off(r)),add(B,off(q)));
      }
    }
    return this;
  }
  beam(a,b,width,height){ // axis along a->b, rectangular cross section
    const axis=norm(sub(b,a));let u=norm(cross(axis,Math.abs(axis[1])<0.95?[0,1,0]:[1,0,0]));let v=norm(cross(axis,u));
    const pts=(p)=>[add(add(p,mul(u,width/2)),mul(v,height/2)),add(add(p,mul(u,-width/2)),mul(v,height/2)),add(add(p,mul(u,-width/2)),mul(v,-height/2)),add(add(p,mul(u,width/2)),mul(v,-height/2))];
    const aa=pts(a),bb=pts(b);
    for(let i=0;i<4;i++)this.quad(aa[i],aa[(i+1)%4],bb[(i+1)%4],bb[i]);
    this.quad(aa[3],aa[2],aa[1],aa[0]).quad(bb[0],bb[1],bb[2],bb[3]);return this;
  }
  grid(fn,nu,nv){
    for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){
      const a=fn(i/nu,j/nv),b=fn((i+1)/nu,j/nv),c=fn((i+1)/nu,(j+1)/nv),d=fn(i/nu,(j+1)/nv);
      this.quad(a,b,c,d);
    }
    return this;
  }
  get vertices(){return this.positions.length/3}
  bounds(){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<this.positions.length;i+=3){for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],this.positions[i+k]);hi[k]=Math.max(hi[k],this.positions[i+k]);}}return {min:lo,max:hi};}
  serialize(){return {id:this.id,material:this.material,offset:this.offset,positions:this.positions,normals:this.normals,triangles:this.count};}
}

export class PartSet {
 constructor(id){this.id=id;this.parts=[];this._n=0;}
 part(material,name,offset=[0,0,0]) {let m=new Mesh(`${this.id}/${name}/${this._n++}`,material,offset);this.parts.push(m);return m;}
 metrics(){return {meshes:this.parts.length,triangles:this.parts.reduce((n,p)=>n+p.count,0),vertices:this.parts.reduce((n,p)=>n+p.vertices,0)};}
 bounds(){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const m of this.parts){const b=m.bounds();if(!Number.isFinite(b.min[0]))continue;for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],b.min[k]);hi[k]=Math.max(hi[k],b.max[k]);}}return {min:lo,max:hi};}
}

/** Build a full-rounded eave/cap curved profile swept along X with a slightly upswept end. */
export function tileCap(mesh,x0,x1,y,zwidth,{rise=.11,overhang=.04,ends=0}={}){
 const sections=12,steps=20;
 const sweep=(x,z)=>{
   const zz=z/zwidth;const edge=Math.pow(Math.abs(zz),1.5);
   const endDist=Math.min((x-x0)/(x1-x0),(x1-x)/(x1-x0));
   const tip=ends*Math.max(0,1-endDist*8)**2;
   return y+rise*(1-zz*zz)-.11*edge+tip;
 };
 // roof-shaped face
 mesh.grid((u,v)=>{const x=lerp(x0,x1,u),z=lerp(-zwidth-overhang,zwidth+overhang,v);return [x,sweep(x,z),z]},steps,sections);
 for(const sg of [-1,1]){
   const z=sg*(zwidth+overhang);
   mesh.grid((u,v)=>{const x=lerp(x0,x1,u);return [x,lerp(sweep(x,z)-.055,sweep(x,z),v),z]},steps,2);
 }
 return mesh;
}
