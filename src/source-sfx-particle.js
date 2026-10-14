import {sourceSfxRandom} from './source-sfx-random.js';
import {sourceSfxNormalize3} from './source-sfx-vector.js';
const f32=Math.fround;

const vec3=(value)=>[f32(value[0]),f32(value[1]),f32(value[2])];
const hasRandomSum=(value)=>value&&value.some(component=>component!==0);

// 2b4a1cc: perturb direction at the configured tick interval, preserving speed.
// The input age is already advanced by the particle lifetime update.
export function sourceSfxRandomVelocity(velocity,{randomSum,interval,age,dt,stream}){
  if(!Array.isArray(randomSum)||randomSum.length!==3||randomSum.some(v=>!Number.isFinite(v)))throw new TypeError('Finite source RandomSum required');
  if(!Number.isInteger(interval)||interval<0||interval>=0x7fffffff)throw new TypeError('Nonnegative RandomSumInterval required');
  velocity=vec3(velocity);randomSum=vec3(randomSum);dt=f32(dt);age=f32(age);
  if(!(dt>0)||!Number.isFinite(age))throw new TypeError('Positive dt and finite age required');
  const epsilon=f32(.0001);
  if(randomSum.every(v=>Math.abs(v)<=epsilon)||(interval!==0&&Math.trunc(f32(age/dt))%(interval+1)!==1))return velocity;
  if(!Number.isInteger(stream?.seed)||stream.seed<0||stream.seed>0xffffffff)throw new TypeError('Live source RNG stream required');
  const changed=velocity.map((v,i)=>{const amount=Math.abs(randomSum[i]),draw=sourceSfxRandom({seed:stream.seed,min:-amount,max:amount});stream.seed=draw.seed;return f32(v+draw.value);});
  if(changed.every(v=>Math.abs(v)<=epsilon))return changed;
  const speed=f32(Math.sqrt(f32(f32(f32(velocity[0]*velocity[0])+f32(velocity[1]*velocity[1]))+f32(velocity[2]*velocity[2]))));
  return sourceSfxNormalize3(changed).map(v=>f32(v*speed));
}

// Closed ParticlePoly motion path from 0x2b4a1cc. Curves and child influences
// remain explicit runtime inputs; collision stays gated while RandomSum uses
// the recovered branch above.
export function sourceSfxAdvanceParticle(particle,{
  dt,friction,gravityDirection,gravityCurve,angularCurve,oldRotationMode=false,
  actionMode=0,scaleLength=1,randomSum=[0,0,0],randomSumInterval=0,stream,collision=false,onExpire,influences=[],
}){
  if(collision)throw new RangeError('sourceSfxAdvanceParticle does not implement collision');
  dt=f32(dt);
  const life=f32(particle.life);
  const oldAge=f32(particle.age);
  const nextAge=f32(oldAge+dt);
  if(nextAge>=life){
    const expired={...particle,normalizedAge:100};
    onExpire?.(expired);
    return {expired:true,particle:expired};
  }
  if(dt===0)return {expired:false,particle};

  let angularSpeed=f32(angularCurve(oldAge));
  if(oldRotationMode)angularSpeed=f32(angularSpeed/life);
  angularSpeed=f32(angularSpeed+f32(particle.randomAngularSpeed));
  const accumulatedAngle=f32(f32(particle.accumulatedAngle)+f32(angularSpeed*dt));
  const age=nextAge;
  const normalizedAge=f32(age/life);
  const curveValue=f32(gravityCurve(age));
  const gravity=vec3(gravityDirection).map(component=>f32(f32(component*curveValue)*dt));
  const damping=Math.max(f32(1-f32(f32(friction)*dt)),0);
  const position=vec3(particle.position);
  const velocity=hasRandomSum(randomSum)?sourceSfxRandomVelocity(particle.velocity,{randomSum,interval:randomSumInterval,age,dt,stream}):vec3(particle.velocity);
  const previousPosition=[...position];
  const nextPosition=position.map((component,index)=>f32(component+f32(velocity[index]*dt)));
  const impulseScale=actionMode===1?f32(scaleLength):1;
  const nextVelocity=velocity.map((component,index)=>f32(f32(component*damping)+f32(gravity[index]*impulseScale)));
  let next={...particle,age,normalizedAge,angularSpeed,accumulatedAngle,previousPosition,position:nextPosition,velocity:nextVelocity};
  for(const influence of influences)next=influence(next);
  return {expired:false,particle:next};
}
