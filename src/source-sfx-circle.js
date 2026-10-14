import {sourceSfxNormalize3,sourceSfxCross3} from './source-sfx-vector.js';
import {sourceSfxAxisRotation} from './source-sfx-rotate.js';
import {sourceSfxComposeRotation} from './source-sfx-controller.js';
import {createSourceSfxFloatCurve} from './source-sfx-curves.js';

const f32=Math.fround,epsilon=f32(.0001),threshold=f32(.9999),radians=0.01745329238474369;
const identity=[1,0,0,0,1,0,0,0,1];
const nearZero=v=>v.every(x=>x>=-epsilon&&x<=epsilon);
const number=(x,name)=>{const n=Number(x);if(x==null||!Number.isFinite(n))throw new TypeError(`${name} required`);return f32(n);};

// 2e73054 builds an initial basis around canonical +Z. The supplied axis
// defines the rotation applied to that basis; it is not the basis' third row.
export function compileSourceSfxCircleProfile(node,children){
  const a=node.attributes,duration=number(a.TimeLen,'TimeLen'),cycle=number(a.CycleType,'CycleType');
  if(duration<=0||![0,1,2].includes(cycle))throw new RangeError('Unresolved Circle duration/cycle');
  const input=typeof a.AxesDir==='string'?JSON.parse(a.AxesDir):a.AxesDir;
  if(!Array.isArray(input)||input.length!==3)throw new TypeError('AxesDir requires three components');
  let axis=input.map(x=>number(x,'AxesDir'));
  if(!nearZero(axis))axis=sourceSfxNormalize3(axis);
  let reference=sourceSfxNormalize3(axis);
  const forward=sourceSfxNormalize3([0,0,1]);
  if(reference[2]>threshold||reference[2]<-threshold)reference=[1,0,0];
  const right=sourceSfxNormalize3(sourceSfxCross3(reference,forward));
  const up=sourceSfxCross3(forward,right),basis=[...right,...up,...forward];
  // A near-zero axis changes to +Y at sampling, after basis construction.
  if(nearZero(axis))axis=[0,1,0];
  const start=f32(number(a.StartAngle,'StartAngle')*radians);
  const delta=f32(f32(number(a.EndAngle,'EndAngle')*radians)-start);
  const isStatic=Math.abs(delta)<epsilon;
  const durationSeconds=f32(f32(duration*1000)*f32(.001));
  const period=isStatic?0:f32(f32(durationSeconds*1000)*(cycle===1?2:1));
  const coefficient=isStatic?0:f32(f32(delta/durationSeconds)*f32(.001));
  // Generic clock setter keeps an internal minimum duration separately from end.
  const clockDuration=period>epsilon?Math.max(period,66.66666666666667):0;
  const curve=children.find(n=>n.path.slice(node.path.length+1).replace(/\[\d+\]$/,'')==='RadiusFrame');
  // Initializer copies ChangeType and keys; runtime interpolation stays at its default 0.
  const radius=createSourceSfxFloatCurve({attributes:{ChangeType:curve?.attributes.ChangeType??0,Interpolator:0},
    frames:curve?.frames.length?curve.frames:[{Time:0,Value:0}]});
  const angleAt=time=>{
    if(isStatic)return start;
    const t=f32(time);let phase;
    if(cycle===0){const q=Math.max(-2147483648,Math.min(2147483647,Math.trunc(f32(t/period))));phase=f32(t-f32(period*f32(q)));}
    else if(cycle===1){const q=f32(t/period);phase=f32(period*(q<.5?q:f32(1-q)));}
    else phase=Math.min(t,period);
    return f32(start+f32(phase*coefficient));
  };
  return {kind:'TrackCircle',periodMilliseconds:period,loop:cycle!==2,isStatic,angleAt,sample(time){
    const rotation=sourceSfxComposeRotation(basis,sourceSfxAxisRotation(axis,angleAt(time)));
    const negativeRadius=-radius(f32(f32(time)/f32(clockDuration)));
    return {translation:rotation.slice(0,3).map(x=>f32(x*negativeRadius)),scale:[1,1,1],rotation,
      flags:rotation.every((x,i)=>Object.is(x,identity[i]))?0:2};
  }};
}
