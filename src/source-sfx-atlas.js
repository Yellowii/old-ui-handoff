import {sourceSfxRandom} from './source-sfx-random.js';

const f32=Math.fround;

const sourceFmod=(value,divisor)=>f32(value%divisor);

// Native SPR reader: epsilon precedes a double-precision quotient; the
// count+1 sentinel is clamped to the final image after wrapping.
export function sourceSfxAtlasFrameIndex(time,duration,count){
  if(!Number.isFinite(time)||!(duration>0)||!Number.isInteger(count)||count<1||count>=65535)throw new RangeError('Finite source SPR clock and frame count required');
  let q=Math.max(-2147483648,Math.min(2147483647,Math.trunc(f32(f32(time)+f32(.0001))/duration*count)));
  if(q>=count+1)q%=count+1;
  return Math.min(q&65535,count-1);
}

// SpriteFx 0x2b81de0. Duration is source atlas timing extent; no unit is
// assigned here and this module intentionally does not choose or flip UVs.
export function sourceSfxSpriteAtlasTime({nodeTime,lifespan,startFraction,mode,rate,duration}){
  nodeTime=f32(nodeTime);lifespan=f32(lifespan);startFraction=f32(startFraction);
  rate=f32(rate);duration=f32(duration);
  let fraction=f32(nodeTime/lifespan);
  if(fraction>=1)fraction=f32(fraction-f32(0.0001));
  if(mode===0)return sourceFmod(f32(f32(startFraction+fraction)*duration),duration);
  return sourceFmod(f32(f32(startFraction*duration)+f32(f32(fraction*1000)*rate)),duration);
}

// ParticlePoly sampling 0x2edb974/0x2edb79c. Other source modes deliberately
// retain the duration sentinel until their semantics are closed.
export function sourceSfxParticleAtlasTime({mode,rate,startTime,age,normalizedAge,duration,interpolated=false}){
  rate=f32(rate);startTime=f32(startTime);age=f32(age);normalizedAge=f32(normalizedAge);
  duration=f32(duration);
  if(mode===0){
    if(!interpolated&&normalizedAge>=1)normalizedAge=f32(normalizedAge-f32(0.0001));
    return sourceFmod(f32(startTime+f32(duration*normalizedAge)),duration);
  }
  if(mode===1)return sourceFmod(f32(f32(f32(1000*age)*rate)+startTime),duration);
  return duration;
}

// Spawn phase 0x2ee0030. Callers own all preceding emitter RNG draws.
export function sourceSfxAtlasStartPhase({textureType,randomStartEnabled,duration,seed}){
  if(textureType!==3||!randomStartEnabled)return {seed:seed>>>0,startTime:0};
  const draw=sourceSfxRandom({seed,min:0,max:duration});
  return {seed:draw.seed,startTime:draw.value};
}
