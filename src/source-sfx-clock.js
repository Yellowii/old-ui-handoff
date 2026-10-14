const f32=Math.fround;

// world.sfx(source, scene=None), 0x2a49d64: loop defaults to 2, with
// def_shutdown=false and shutdown_visible=false. Other creation routes must
// supply their own flags; this constant does not select the SfxProxy route.
export const SOURCE_SFX_DIRECT_CREATE_FLAGS=2;

// FxGroup tick 0x2b63bd8..0x2b63c08. The caller supplies the source manager's
// two delta fields and scene factor; culling/scheduling are separate concerns.
export function sourceSfxAdvanceGroupTime(time,primaryDelta,fallbackDelta,rate,sceneFactor){
  primaryDelta=f32(primaryDelta);fallbackDelta=f32(fallbackDelta);
  const delta=primaryDelta!==0?primaryDelta:fallbackDelta;
  const scaled=f32(f32(delta*f32(rate))*f32(sceneFactor));
  return f32(f32(time)+scaled);
}

// SfxBase tick 0x2b51c34..0x2b51c58 and group seek 0x2b65430..0x2b65440.
// Child time derives from the owning group's clock, never accumulates its own dt.
export function sourceSfxChildTime(ownerTime,start,ownerDelay){
  return Math.max(f32(f32(f32(ownerTime)-f32(start))-f32(ownerDelay)),0);
}

const finite=(value,name)=>{
  if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(`${name}: finite number required`);
  return f32(value);
};

// Native manager frame writer 0x29b0b48. The upper cap belongs only to this
// timestamp delta path; FrameTimeControl setters intentionally have no cap.
export function sourceSfxNormalFrameMilliseconds(currentTimestampMs,previousTimestampMs){
  if(typeof currentTimestampMs!=='number'||!Number.isFinite(currentTimestampMs)||typeof previousTimestampMs!=='number'||!Number.isFinite(previousTimestampMs)){
    throw new TypeError('Finite millisecond timestamps required');
  }
  return Math.min(f32(currentTimestampMs-previousTimestampMs),500);
}

// Generic FrameTimeControl 0x4946300/18/48 and SfxFrameTimeControl
// 0x2b6bbe4/c04/c48, represented together because manager writes broadcast
// the same explicit milliseconds, factors, and override to both controls.
export function createSourceSfxFrameControls({frameMilliseconds,scaleFactors,overrideMilliseconds}){
  let frameMs=finite(frameMilliseconds,'frameMilliseconds');
  if(!Array.isArray(scaleFactors)||scaleFactors.length!==3)throw new TypeError('scaleFactors: three factors required');
  let factors=scaleFactors.map((value,index)=>finite(value,`scaleFactors[${index}]`));
  let overrideMs=finite(overrideMilliseconds,'overrideMilliseconds');
  const computed=()=>{
    const full=f32(f32(factors[0]*factors[1])*factors[2]);
    const withoutScale1=f32(factors[0]*factors[2]);
    return {
      track:f32(full*frameMs),
      sfxFull:f32(f32(full*frameMs)/1000),
      sfxWithoutScale1:f32(f32(withoutScale1*frameMs)/1000),
    };
  };
  const snapshot=()=>{
    const values=computed();
    return {
      frameMilliseconds:frameMs,scaleFactors:[...factors],overrideMilliseconds:overrideMs,
      trackDeltaMilliseconds:overrideMs!==0?overrideMs:values.track,
      sfxPrimarySeconds:f32(overrideMs/1000),
      sfxFallbackSeconds:values.sfxFull,
      sfxWithoutScale1Seconds:values.sfxWithoutScale1,
    };
  };
  return {
    setFrameMilliseconds(value){frameMs=finite(value,'frameMilliseconds');return snapshot();},
    setScale(index,value){
      if(!Number.isInteger(index)||index<0||index>2)throw new RangeError('scale index must be 0, 1, or 2');
      factors[index]=finite(value,`scaleFactors[${index}]`);return snapshot();
    },
    setOverrideMilliseconds(value){overrideMs=finite(value,'overrideMilliseconds');return snapshot();},
    snapshot,
  };
}
