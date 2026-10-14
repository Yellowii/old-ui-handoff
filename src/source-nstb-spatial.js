import {Matrix4} from 'three';
import {sourceInverseSqrt} from './source-nstb-rsqrt.js';
const F=Math.fround,add=(a,b)=>F(a+b),sub=(a,b)=>F(a-b),mul=(a,b)=>F(a*b),div=(a,b)=>F(a/b);
const dot=(a,b)=>add(add(mul(a[0],b[0]),mul(a[1],b[1])),mul(a[2],b[2]));
const norm=v=>{const r=sourceInverseSqrt(dot(v,v));return v.map(x=>mul(x,r));};
const point=(m,p)=>[0,1,2].map(i=>add(mul(m[i+8],p[2]),add(mul(m[i+4],p[1]),add(mul(m[i],p[0]),m[i+12]))));
const root=(a,b,c,linear)=>{
 const epsilon=F(.0001);
 if(linear&&Math.abs(a)<epsilon){if(Math.abs(b)<epsilon)return null;const t=div(-c,b);return t>0&&t<=1?t:null;}
 const disc=add(mul(b,b),mul(mul(a,-4),c));if(disc<epsilon)return null;
 const d=F(Math.sqrt(disc)),scale=div(.5,a),first=mul(scale,sub(-b,d)),second=mul(scale,sub(d,b));
 return first>=0&&first<=1?first:second>=0&&second<=1?second:null;
};
function sourceLocalMatrix(config){
 const [sx,sy,sz]=config.local_euler_rotation.map(x=>F(Math.sin(mul(F(x),.5)))),[cx,cy,cz]=config.local_euler_rotation.map(x=>F(Math.cos(mul(F(x),.5))));
 const w=sub(mul(mul(cy,cz),cx),mul(mul(sy,sz),sx)),x=add(mul(mul(sy,sz),cx),mul(mul(cy,cz),sx)),y=add(mul(mul(sy,cz),cx),mul(mul(cy,sz),sx)),z=sub(mul(mul(cy,sz),cx),mul(mul(sy,cz),sx));
 const xx=F(2*x*x),yy=F(2*y*y),zz=F(2*z*z),xy=F(2*x*y),xz=F(2*x*z),yz=F(2*y*z),xw=F(2*x*w),yw=F(2*y*w),zw=F(2*z*w);
 return [sub(sub(1,yy),zz),add(xy,zw),sub(xz,yw),0,sub(xy,zw),sub(sub(1,xx),zz),add(yz,xw),0,add(xz,yw),sub(yz,xw),sub(sub(1,xx),yy),0,...config.local_position.map(F),1];
}

// Android 2c4b2e8: type 0 is a quadratic surface; type 1 is a sphere.
// Quadratic local_scale is coefficients, not a transform scale. The original
// YZX Euler constructor and contact equations are retained, including the
// previous-X projection and world-X normal in its fully-inside branch.
export class SourceNstbSpatial {
 constructor(config,boneMatrix,ownerScale=1){
  this.config=config;const bone=boneMatrix.map(F);
  if(config.type===0){
   const local=sourceLocalMatrix(config);
   this.matrix=local.map((_,index)=>{const col=Math.floor(index/4)*4,row=index%4;return add(add(mul(bone[row],local[col]),mul(bone[row+8],local[col+2])),add(mul(bone[row+4],local[col+1]),mul(bone[row+12],local[col+3])));});this.inverse=new Matrix4().fromArray(this.matrix).invert().elements.map(F);
  }else if(config.type===1){this.center=point(bone,config.local_position.map(F));this.radius=mul(F(config.local_scale[0]),F(ownerScale));}
  else throw Error('Unimplemented source spatial constraint');
 }
 contact(previous,current){
  previous=previous.map(F);current=current.map(F);let contact,normal;
  if(this.config.type===1){
   const a=previous.map((x,i)=>sub(x,this.center[i])),b=current.map((x,i)=>sub(x,this.center[i]));
   if(F(Math.sqrt(dot(a,a)))<=this.radius&&F(Math.sqrt(dot(b,b)))<=this.radius){contact=norm(b).map((x,i)=>add(this.center[i],mul(this.radius,x)));}
   else{
    const d=current.map((x,i)=>sub(x,previous[i])),A=dot(d,d);if(A<F(.0001))return null;
    const t=root(A,mul(2,dot(d,a)),sub(dot(a,a),mul(this.radius,this.radius)),false);if(t===null)return null;
    contact=d.map((x,i)=>add(previous[i],mul(x,t)));
   }
   normal=norm(contact.map((x,i)=>sub(x,this.center[i])));
  }else{
   const a=point(this.inverse,previous),b=point(this.inverse,current),invA=div(1,F(this.config.local_scale[0])),invC=div(1,F(this.config.local_scale[2])),square=mul(invA,invA),oldX=mul(a[0],invA),oldZ=mul(a[2],invC),oldSquare=mul(oldX,oldX),C=F(this.config.local_scale[2]);
   if(oldZ>oldSquare&&mul(b[2],invC)>mul(mul(b[0],invA),mul(b[0],invA))){
    contact=point(this.matrix,[b[0],b[1],mul(oldSquare,C)]);
    normal=[mul(mul(square,add(C,C)),contact[0]),0,-1];
   }else{
    const d=b.map((x,i)=>sub(x,a[i]));if(add(mul(d[0],d[0]),mul(d[2],d[2]))<F(.0001))return null;
    const A=mul(square,mul(d[0],d[0])),B=sub(mul(square,mul(add(a[0],a[0]),d[0])),mul(invC,d[2])),D=sub(mul(mul(a[0],a[0]),square),oldZ);
    const t=root(A,B,D,true);if(t===null)return null;
    const localX=add(a[0],mul(d[0],t));contact=current.map((x,i)=>add(previous[i],mul(sub(x,previous[i]),t)));
    normal=[mul(mul(square,add(C,C)),localX),0,-1];
   }
   // The original applies the world basis (not inverse transpose) to this normal.
   normal=norm(point(this.matrix,normal).map((x,i)=>sub(x,this.matrix[12+i])));
  }
  return {point:contact,normal,bounce:this.config.bounce_factor,friction:this.config.surface_friction_factor};
 }
}

export function projectSpatialContact(position,contact){const d=position.map((x,i)=>sub(x,contact.point[i])),depth=dot(d,contact.normal);return position.map((x,i)=>sub(x,mul(contact.normal[i],depth)));}
export function spatialVelocity(velocity,contact,bounce=1,friction=0){
 const along=dot(velocity,contact.normal),keep=sub(1,Math.min(F(friction),F(contact.friction)));
 return velocity.map((x,i)=>add(mul(sub(x,mul(contact.normal[i],along)),keep),mul(mul(mul(contact.normal[i],Math.abs(along)),F(bounce)),F(contact.bounce))));
}
