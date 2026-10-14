import {sourceSfxNormalize3,sourceSfxCross3} from './source-sfx-vector.js';
import {sourceSfxPortableSinCos} from './source-sfx-direction.js';
const f=Math.fround,epsilon=f(.0001);
const vec=(v,n)=>{if(!Array.isArray(v)||v.length!==n||v.some(x=>!Number.isFinite(x)))throw new TypeError('Finite source quad input required');return v.map(f);};
const rotate=(v,m)=>[0,1,2].map(i=>f(f(f(v[0]*m[i])+f(v[1]*m[4+i]))+f(v[2]*m[8+i])));
const tiny=v=>v.every(x=>x<=epsilon&&x>=-epsilon);

// ParticlePoly 2edd8a4, DirType0 and SpinAxis zero. AlongMoveDir
// anchors one end at the particle position; a centered Sprite is incorrect.
export function sourceSfxParticleQuad(input){
 const {alongMove=false,originalAngle=0,accumulatedAngle=0}=input;
 if(!Number.isFinite(originalAngle)||!Number.isFinite(accumulatedAngle))throw new RangeError('Finite particle angle required');
 const p=vec(input.position,3),old=vec(input.previousPosition,3),m=vec(input.frame,16),scale=vec(input.particleScale,3),frameScale=vec(input.frameScale,3);
 let up=vec(input.up,3),right=vec(input.right,3);const forward=vec(input.forward,3);
 const width=f(f(input.width)*f(f(f(input.radius)*scale[0])*frameScale[0]));
 const height=f(f(input.height)*f(f(f(input.radius)*scale[1])*frameScale[1]));
 if(!Number.isFinite(width)||!Number.isFinite(height))throw new RangeError('Finite source quad dimensions required');
 const center=[0,1,2].map(i=>f(m[12+i]+p[2]*m[8+i]+p[1]*m[4+i]+p[0]*m[i]));
 if(alongMove){
  let delta=p.map((x,i)=>f(x-old[i]));
  if(tiny(delta))delta=input.lastDirection?vec(input.lastDirection,3):[0,0,0];
  else if(input.lastDirection)input.lastDirection.splice(0,3,...delta);
  if(tiny(delta))delta=vec(input.velocity,3);
  delta=rotate(delta,m);
  if(f(f(Math.abs(delta[0])+Math.abs(delta[1]))+Math.abs(delta[2]))>=epsilon)up=sourceSfxNormalize3(delta);
  right=sourceSfxCross3(up,forward);
  if(!tiny(right))right=sourceSfxNormalize3(right);
  for(let i=0;i<3;i++)center[i]=f(center[i]+f(height*up[i]));
 }
 // 2eddca0..2edddb0: default rotationScale1/base rotation0. The source
 // rotates the camera basis after the AlongMoveDir center adjustment.
 if(originalAngle!==0||accumulatedAngle!==0){
  const {sin,cos}=(input.sinCos||sourceSfxPortableSinCos)(f(f(originalAngle)+f(accumulatedAngle)));
  const beforeUp=up,beforeRight=right;
  right=beforeUp.map((v,i)=>f(f(v*sin)+f(beforeRight[i]*cos)));
  up=beforeUp.map((v,i)=>f(f(v*cos)-f(beforeRight[i]*sin)));
 }
 const sum=right.map((x,i)=>f(f(width*x)+f(height*up[i]))),difference=right.map((x,i)=>f(f(width*x)-f(height*up[i])));
 return [center.map((x,i)=>f(x-difference[i])),center.map((x,i)=>f(x+sum[i])),center.map((x,i)=>f(x+difference[i])),center.map((x,i)=>f(x-sum[i]))].flat();
}
