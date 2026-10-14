import {Matrix4,Quaternion,Vector3} from 'three';
import {SourcePbd} from './source-nstb-pbd.js';
import {sourceInverseSqrt} from './source-nstb-rsqrt.js';
import {SourceNstbSpatial} from './source-nstb-spatial.js';
const F=Math.fround,add=(a,b)=>F(a+b),sub=(a,b)=>F(a-b),mul=(a,b)=>F(a*b);
const norm=a=>{const sq=add(add(mul(a[0],a[0]),mul(a[1],a[1])),mul(a[2],a[2]));return sq>F(.0001)?a.map(x=>mul(x,sourceInverseSqrt(sq))):a;};
const tip=(m,half)=>norm(m.slice(0,3)).map((x,i)=>add(m[12+i],mul(x,F(half))));
// d95768 uses Gram-Schmidt when the normalized determinant differs from one.
function sourceDecompose(matrix,position,quaternion,scale){
 const axes=[0,1,2].map(i=>new Vector3().setFromMatrixColumn(matrix,i)),lengths=axes.map(v=>v.length());
 if(lengths.some(x=>x<.0001))throw Error('Degenerate source NSTB bone basis');
 scale.fromArray(lengths);position.setFromMatrixPosition(matrix);axes.forEach((v,i)=>v.multiplyScalar(1/lengths[i]));
 const det=axes[0].dot(axes[1].clone().cross(axes[2]));if(det<0)throw Error('NSTB source basis must be right-handed');
 if((det-1)**2>.0001){axes[0].normalize();axes[1].addScaledVector(axes[0],-axes[1].dot(axes[0])).normalize();axes[2].sub(axes[0].clone().multiplyScalar(axes[2].dot(axes[0])).add(axes[1].clone().multiplyScalar(axes[2].dot(axes[1])))).normalize();}
 const r=new Matrix4().makeBasis(...axes).elements,x=r[0],y=r[5],z=r[10];
 const rows=[[1+x-y-z,r[4]+r[1],r[8]+r[2],r[6]-r[9]],[r[4]+r[1],1-x+y-z,r[9]+r[6],r[8]-r[2]],[r[8]+r[2],r[9]+r[6],1-x-y+z,r[1]-r[4]],[r[6]-r[9],r[8]-r[2],r[1]-r[4],1+x+y+z]];
 const index=z<=0?(y<=x?0:1):(y<=-x?2:3);quaternion.fromArray(rows[index]).normalize();return matrix;
}
// 2c4925c: model-space gravity uses scaled owner axes, then removes translation.
export function sourceNstbGravity(gravity,modelSpace,ownerMatrix){
 if(!modelSpace)return gravity.map(F);
 if(!ownerMatrix){if(gravity.some(x=>x!==0))throw Error('Source NSTB gravity needs its owner transform');return [0,0,0];}
 const m=ownerMatrix.map(F),g=gravity.map(F);
 return [0,1,2].map(i=>sub(add(add(add(m[i+12],mul(m[i],g[0])),mul(m[i+4],g[1])),mul(m[i+8],g[2])),m[i+12]));
}
export class SourceNstbChain {
 constructor(config){this.config=config;this.solver=null;}
 step(matrices,delta,scale=1,ownerMatrix,spatialInputs=[]){
  const worldGravity=sourceNstbGravity(this.config.gravity||[0,0,0],this.config.modelSpaceGravity!==false,ownerMatrix);
  const reflect=new Matrix4().fromArray(matrices[0]).determinant()<0;
  const gravity=worldGravity.map((x,i)=>reflect&&i===0?-x:x);
  const c=this.config,m=matrices.map(m=>m.map((x,i)=>F(reflect&&i%4===0?-x:x))),n=c.bones.length;
  if(!this.solver){const points=m.map(x=>x.slice(12,15));points.push(tip(m[n-1],c.bones[n-1].halfLength));this.solver=new SourcePbd({speed:c.speed,steps:c.steps,scale,particles:c.particles.map((p,i)=>({mass:i?p.mass_scale:0,position:points[i],velocity:[0,0,0],damping:p.linear_damping,drag:p.air_friction,area:.25})),links:c.bones.map((b,i)=>({a:i,b:i+1,length:b.length,stiffness:1,minimum:1,maximum:1,mode:1}))});}
  this.solver.config.scale=scale;
  this.solver.config.spatialConstraints=spatialInputs.map(({config,boneMatrix})=>new SourceNstbSpatial(config,boneMatrix.map((x,i)=>reflect&&i%4===0?-x:x),scale));
  const p=this.solver.particles;p[0].position=m[0].slice(12,15);
  for(let i=0;i<p.length;i++){p[i].bounce=c.particles[i].bounce_factor;p[i].friction=c.particles[i].surface_friction_factor;}
  for(let i=0;i<n;i++){const target=i+1<n?m[i+1].slice(12,15):tip(m[i],c.bones[i].halfLength),factor=mul(F(c.particles[i+1].stiffness),5);p[i+1].force=target.map((x,j)=>add(mul(sub(x,p[i+1].position[j]),factor),mul(gravity[j],p[i+1].mass)));}
  const prepared=p.map(x=>({position:[...x.position],force:[...x.force]}));const result=this.solver.step(delta);
  const out=m.map((mat,i)=>{
   const current=new Matrix4().fromArray(mat),pos=new Vector3(),q=new Quaternion(),scale=new Vector3();sourceDecompose(current,pos,q,scale);
   const target=i+1<n?m[i+1].slice(12,15):tip(mat,c.bones[i].halfLength);
   const from=new Vector3(...target).sub(pos).normalize(),to=new Vector3(...p[i+1].position).sub(new Vector3(...p[i].position)).normalize();
   const rotation=new Quaternion().setFromUnitVectors(from,to),normalized=current.clone();
   for(let column=0;column<3;column++){const axis=new Vector3().setFromMatrixColumn(normalized,column).normalize();for(let j=0;j<3;j++)normalized.elements[column*4+j]=axis.getComponent(j);}
   const desired=new Quaternion(),targetPosition=new Vector3(),targetScale=new Vector3();sourceDecompose(normalized.premultiply(new Matrix4().makeRotationFromQuaternion(rotation)),targetPosition,desired,targetScale);
   q.slerp(desired,c.bones[i].blend_ratio);pos.lerp(new Vector3(...p[i].position),c.bones[i].blend_ratio);
   const result=new Matrix4().compose(pos,q,new Vector3(1,1,1));for(let column=0;column<3;column++){const axis=new Vector3().setFromMatrixColumn(result,column).normalize().multiplyScalar(scale.getComponent(column));for(let j=0;j<3;j++)result.elements[column*4+j]=axis.getComponent(j);}return result.toArray();
  });if(reflect){for(const matrix of out)for(let i=0;i<16;i+=4)matrix[i]*=-1;for(const state of [...result.states,...prepared])for(const values of Object.values(state))values[0]*=-1;}return {...result,prepared,matrices:out};
 }
}
