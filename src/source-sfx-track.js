import {createSourceSfxFloatCurve} from './source-sfx-curves.js';
import {sourceSfxInheritTransform} from './source-sfx-controller.js';
import {compileSourceSfxRotateProfile} from './source-sfx-rotate.js';
import {compileSourceSfxCircleProfile} from './source-sfx-circle.js';
import {compileSourceSfxDirectionProfile} from './source-sfx-direction.js';

const f32=Math.fround,epsilon=f32(0.0001),milliseconds=1000,seconds=f32(0.001);
const rotation=[1,0,0,0,1,0,0,0,1];
const identity=()=>({translation:[0,0,0],scale:[1,1,1],rotation:[...rotation],flags:0});
const copy=t=>({...t,translation:[...t.translation],scale:[...t.scale],rotation:[...t.rotation]});
const number=(x,name)=>{const n=Number(x);if(x==null||!Number.isFinite(n))throw new TypeError(`${name} required`);return f32(n);};
const boolean=(x,name)=>{if(x==='true'||x===true)return true;if(x==='false'||x===false)return false;throw new TypeError(`${name} required`);};
const vector=(x,name)=>{const v=typeof x==='string'?JSON.parse(x):x;if(!Array.isArray(v)||v.length!==3)throw new TypeError(`${name} requires three components`);return v.map(n=>number(n,name));};
const parentPath=p=>p.slice(0,p.lastIndexOf('/'));

// XML Line1 and Scale4: source readers and initializers 2e70e88,
// 2e72ea4 -> 2e71a50, 2e72830. Clock advancement belongs to the caller.
export function compileSourceSfxTrackProfile(orderedNodes,path,options={}){
  const node=orderedNodes.find(n=>n.path===path);
  if(!node)throw new Error(`Missing source track ${path}`);
  const kind=path.slice(path.lastIndexOf('/')+1).replace(/\[\d+\]$/,''),a=node.attributes;
  if(kind==='TrackFixPoint')return compileSourceSfxDirectionProfile(a,options);
  if(kind==='TrackRotate')return compileSourceSfxRotateProfile(a);
  if(kind==='TrackCircle')return compileSourceSfxCircleProfile(node,orderedNodes.filter(n=>parentPath(n.path)===path));
  const duration=number(a.TimeLen,'TimeLen'),cycle=number(a.CycleType,'CycleType');
  if(![0,1,2].includes(cycle))throw new RangeError('Unresolved track cycle');
  if(kind==='TrackLine'){
    if(boolean(a.RotByTan,'RotByTan'))throw new RangeError('TrackLine tangent orientation is not yet ported');
    if(!(duration>0))throw new RangeError('TrackLine requires positive source TimeLen');
    const start=vector(a.StartPos,'StartPos'),end=vector(a.EndPos,'EndPos');
    const delta=end.map((x,i)=>f32(x-start[i]));
    const length=f32(Math.sqrt(f32(f32(f32(delta[0]*delta[0])+f32(delta[1]*delta[1]))+f32(delta[2]*delta[2]))));
    const direction=length>epsilon?delta.map(x=>f32(x*f32(1/length))):delta;
    const staticTrack=length<epsilon;
    const durationSeconds=f32(f32(duration*milliseconds)*seconds);
    const period=staticTrack?0:f32(f32(durationSeconds*milliseconds)*(cycle===1?2:1));
    const coefficient=staticTrack?0:f32(f32(length/durationSeconds)*seconds);
    return {kind,periodMilliseconds:period,loop:cycle!==2,isStatic:staticTrack,sample(time){
      let phase=0;
      if(!staticTrack){
        const t=f32(time);
        if(cycle===0){
          // FCVTZS W saturates; converting back to float also rounds.
          const q=Math.max(-2147483648,Math.min(2147483647,Math.trunc(f32(t/period))));
          phase=f32(t-f32(period*f32(q)));
        }else if(cycle===1){const q=f32(t/period);phase=f32(period*(q<0.5?q:f32(1-q)));}
        else phase=Math.min(period,t);
      }
      const distance=f32(phase*coefficient),result=identity();
      result.translation=start.map((x,i)=>f32(x+f32(distance*direction[i])));
      return result;
    }};
  }
  if(kind!=='TrackScale')throw new RangeError(`Unported source track ${kind}`);
  const copyX=boolean(a.YZCopyFromX,'YZCopyFromX');
  const children=orderedNodes.filter(n=>parentPath(n.path)===path);
  const curves=['X','Y','Z'].map(axis=>{
    const name=`${copyX?'X':axis}Scale`;
    const child=children.find(n=>n.path.slice(path.length+1).replace(/\[\d+\]$/,'')===name);
    // Zero duration skips the source curve copy entirely; empty axes default to 1.
    if(duration===0||!child?.frames.length)return {sample:()=>1,count:0};
    return {sample:createSourceSfxFloatCurve(child),count:new Set(child.frames.map(k=>f32(Number(k.Time)))).size};
  });
  const period=f32(f32(cycle===1?f32(duration+duration):duration)*milliseconds);
  return {kind,periodMilliseconds:period,loop:cycle!==2,isStatic:curves.every(c=>c.count<=1),sample(time){
    const t=f32(time),half=f32(f32(period)*0.5);
    const phase=cycle===1?f32(f32(half-f32(Math.abs(f32(t-half))))/half):f32(t/f32(period));
    const result=identity();result.scale=curves.map(c=>c.sample(phase));
    // Native prevents a fully collapsed scale, not each near-zero axis individually.
    if(result.scale.every(x=>x>=-epsilon&&x<=epsilon))result.scale.fill(f32(0.00001));
    return result;
  }};
}

// 2e77744 composes parent * sampled-local * base, then clears scale/rotation
// outputs by mask. Bit0 does not suppress translation in this routine.
export function sourceSfxComposeTrackTransform(sampled,{parentTransform,baseTransform,inheritanceMask}){
  if(!Number.isInteger(inheritanceMask)||inheritanceMask<0)throw new TypeError('Track inheritanceMask required');
  const local=parentTransform?sourceSfxInheritTransform(parentTransform,sampled,7):copy(sampled);
  const result=sourceSfxInheritTransform(local,baseTransform,7);
  if(!(inheritanceMask&4))result.scale=[1,1,1];
  if(!(inheritanceMask&2)){result.rotation=[...rotation];result.flags=0;}
  return result;
}

// Implements the controller's actual getTransform interface. The resolved clock
// time is supplied in milliseconds, after the generic track clock has processed it.
export function bindSourceSfxTrack(profile,{parentTrack,baseTransform,inheritanceMask,initialTransform}){
  let transform=initialTransform&&copy(initialTransform),angle=0,deltaAngle=0;
  return {
    periodMilliseconds:profile.periodMilliseconds,loop:profile.loop,isStatic:profile.isStatic,
    get angle(){return angle;},
    get deltaAngle(){return deltaAngle;},
    getBaseTransform:()=>copy(baseTransform),
    setBaseTransform(value,timeMilliseconds){baseTransform=copy(value);return this.sampleClock(timeMilliseconds);},
    setTransform(value){transform=copy(value);},
    sampleClock(timeMilliseconds){
      if(!Number.isFinite(timeMilliseconds))throw new TypeError('Resolved finite track clock required');
      if(profile.angleAt){const next=profile.angleAt(timeMilliseconds);deltaAngle=f32(next-angle);angle=next;}
      transform=sourceSfxComposeTrackTransform(profile.sample(timeMilliseconds,transform),{
        parentTransform:parentTrack?.getTransform(),baseTransform,inheritanceMask});
      return copy(transform);
    },
    getTransform(){if(!transform)throw new Error('Source track has not been sampled');return copy(transform);},
  };
}
