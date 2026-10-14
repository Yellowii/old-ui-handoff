import {sourceSfxNormalize3,sourceSfxCross3} from './source-sfx-vector.js';
import {sourceSfxComposeRotation} from './source-sfx-controller.js';

const f32=Math.fround,epsilon=f32(.0001),threshold=f32(.9999),radians=0.01745329238474369;
const identity=[1,0,0,0,1,0,0,0,1];

// The source imports Android sincosf. This portable implementation rounds the
// argument/results to float32, but is not a claim of that library's bit parity.
// Keep it replaceable when the original platform library becomes available.
export function sourceSfxPortableSinCos(angle){
  angle=f32(angle);
  return {sin:f32(Math.sin(angle)),cos:f32(Math.cos(angle))};
}

// Direction reader2e70d1c accepts xyz and optional degree roll. Init2e725cc
// substitutes +Z for a near-zero Forward; helper2b4de14 builds and rolls basis.
export function compileSourceSfxDirectionProfile(attributes,{sinCos=sourceSfxPortableSinCos}={}){
  let forward=typeof attributes.Forward==='string'?JSON.parse(attributes.Forward):attributes.Forward;
  if(!Array.isArray(forward)||![3,4].includes(forward.length)||forward.some(x=>typeof x!=='number'||!Number.isFinite(x)))throw new TypeError('Finite source Forward xyz with optional roll required');
  if(typeof sinCos!=='function')throw new TypeError('sinCos required');
  const roll=f32(f32(forward[3]??0)*radians);
  forward=forward.slice(0,3).map(f32);
  if(forward.every(x=>x>=-epsilon&&x<=epsilon))forward=[0,0,1];
  const f=sourceSfxNormalize3(forward);
  let basis=[...identity];
  if(f[2]<threshold){
    const reference=Math.abs(f[1])>threshold?[1,0,0]:[0,1,0];
    const right=sourceSfxNormalize3(sourceSfxCross3(reference,f));
    basis=[...right,...sourceSfxCross3(f,right),...f];
  }
  const values=sinCos(roll),sin=f32(values.sin),cos=f32(values.cos);
  if(!Number.isFinite(sin)||!Number.isFinite(cos))throw new TypeError('Finite sinCos output required');
  const rotation=sourceSfxComposeRotation([cos,sin,0,-sin,cos,0,0,0,1],basis);
  const flags=rotation.every((x,i)=>Object.is(x,identity[i]))?0:2;
  return {kind:'TrackFixPoint',periodMilliseconds:0,loop:true,isStatic:true,
    numericalStatus:roll===0?'zero-roll-exact':'nonzero-roll-platform-libm-unverified',
    sample(){return {translation:[0,0,0],scale:[1,1,1],rotation:[...rotation],flags};},
  };
}
