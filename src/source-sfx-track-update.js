import {sourceSfxInheritTransform} from './source-sfx-controller.js';
import {sourceSfxNormalize3,sourceSfxCross3} from './source-sfx-vector.js';
const f32=Math.fround,epsilon=f32(.0001),threshold=f32(.9999);
const identity=[1,0,0,0,1,0,0,0,1];
const nearZero=v=>v.every(x=>x>=-epsilon&&x<=epsilon);

// 2e76e8c: keep or derive the up vector from the existing basis, resolve
// collinearity using the least-aligned canonical axis, then rebuild the basis.
export function sourceSfxOrientTrackTangent(transform,tangent,preserveUp){
  let up;
  const right=transform.rotation.slice(0,3),oldUp=transform.rotation.slice(3,6);
  if(preserveUp){up=oldUp;if(nearZero(sourceSfxCross3(up,tangent)))up=sourceSfxCross3(tangent,right);}
  else{up=sourceSfxCross3(tangent,right);if(nearZero(up))up=oldUp;}
  up=sourceSfxNormalize3(up);
  const forward=sourceSfxNormalize3(tangent);
  const dot=f32(f32(f32(forward[0]*up[0])+f32(forward[1]*up[1]))+f32(forward[2]*up[2]));
  if(dot>threshold||dot<-threshold){
    const [x,y,z]=forward.map(Math.abs);
    up=Math.min(x,y)>z?[0,0,1]:x>y?[0,1,0]:[1,0,0];
  }
  const newRight=sourceSfxNormalize3(sourceSfxCross3(up,forward));
  const rotation=[...newRight,...sourceSfxCross3(forward,newRight),...forward];
  return {...transform,rotation,flags:rotation.every((x,i)=>Object.is(x,identity[i]))?0:2};
}

// 2e77294 wraps the parent-first core clock update. Repeat virtual10 sets
// base and resamples, so angle deltas and the final tangent use the second sample.
export function bindSourceSfxTrackUpdate(runtime,sampled,{repeatEnabled,repeatTransform,tangentEnabled,preserveUp}){
  for(const [name,value] of Object.entries({repeatEnabled,tangentEnabled,preserveUp}))if(typeof value!=='boolean')throw new TypeError(`${name} required`);
  if(repeatEnabled&&!repeatTransform)throw new TypeError('Source repeatTransform required');
  const updateCore=runtime.update;
  const state={previousPosition:[0,0,0],tangent:[0,0,1],changed:false}; // 2e75f4c defaults.
  return {...runtime,updateCore,state,
    update(){
      state.previousPosition=sampled.getTransform().translation;
      state.changed=false;
      if(!updateCore())return false;
      if(repeatEnabled&&runtime.clock.state.event===1){
        const base=sourceSfxInheritTransform(repeatTransform,sampled.getBaseTransform(),7);
        sampled.setBaseTransform(base,runtime.clock.state.time);
      }
      if(tangentEnabled){
        const current=sampled.getTransform();
        const delta=current.translation.map((x,i)=>f32(x-state.previousPosition[i]));
        if(!nearZero(delta))state.tangent=sourceSfxNormalize3(delta);
        sampled.setTransform(sourceSfxOrientTrackTangent(current,state.tangent,preserveUp));
      }
      state.changed=true;return true;
    },
  };
}
