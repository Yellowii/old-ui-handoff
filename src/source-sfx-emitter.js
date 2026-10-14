import {sourceSfxAdvanceParticle} from './source-sfx-particle.js';

const f32=Math.fround;
const required=(fn,name)=>{
  if(typeof fn!=='function')throw new TypeError(`${name}: callback required`);
  return fn;
};
const finite=(x,name)=>{
  if(typeof x!=='number'||!Number.isFinite(x))throw new TypeError(`${name}: finite source value required`);
  return f32(x);
};
const count=(x,name)=>{
  if(!Number.isInteger(x)||x<0||x>0x7fffffff)throw new RangeError(`${name}: nonnegative int32 required`);
  return x;
};

// T191 even emitters plus T404 spherical-shell birth. Reject other configurations;
// this guard is also the boundary for unimplemented pause/movement/RNG paths.
function selectedEmitter(config){
  if(![0,3,4].includes(config?.emissionType))throw new RangeError('Unsupported emitter emissionType');
  if(typeof config.emitAtBegin!=='boolean'||!Number.isFinite(config.preEmitTime)||config.preEmitTime<0||config.preEmitTime>3)throw new RangeError('Invalid source initial emission profile');
  const exact={emitEven:true,emitEvenRandom:0,
    emitMove:false,activeLimit:-1,sleepLimit:-1,anchorSum:0,emitAtGround:false};
  for(const [key,value] of Object.entries(exact)){
    if(config?.[key]!==value)throw new RangeError(`Unsupported or unresolved emitter ${key}`);
  }
}

// group words68/6c are cumulative int32 counters, not per-frame floats.
export function sourceSfxAdmitParticleQuality(requested,budget,factor){
  count(requested,'requested');
  if(!Number.isInteger(budget?.requested)||!Number.isInteger(budget?.dropped))throw new TypeError('Explicit cumulative budget counters required');
  factor=finite(factor,'quality factor');
  const a=budget.requested|0,b=budget.dropped|0;
  if(a===0){budget.requested=requested;return requested;}
  let admitted=requested;
  if(f32(1-f32(f32(b)/f32(a)))>factor){
    admitted=Math.trunc(f32(f32(requested)*factor));
    budget.dropped=(b+requested-admitted)|0;
  }
  budget.requested=(a+requested)|0;
  return admitted;
}

// Requires an already resolved group/global quality factor; no assumed scene
// quality, seed, capacity, or emission scale is introduced here.
export function sourceSfxEmissionCount(emitter,dt,{budget,qualityFactor}){
  selectedEmitter(emitter.config);
  dt=finite(dt,'dt');
  if(dt<0)throw new RangeError('Reverse particle simulation is unresolved');
  const capacity=count(emitter.capacity,'capacity');
  const live=count(emitter.liveCount,'liveCount');
  const previous=count(emitter.previousTickLiveCount,'previousTickLiveCount');
  if(live>capacity||previous>capacity)throw new RangeError('Particle counts exceed capacity');
  const time=finite(emitter.time,'node time');
  const lifespan=finite(emitter.emissionLife,'emissionLife');
  if(emitter.state!==1||(!emitter.endless&&time>lifespan))return 0;
  const pps=finite(emitter.particlesPerSecond,'particlesPerSecond');
  const scale=finite(emitter.emissionScale,'emissionScale');
  let carry=finite(emitter.fractionalCarry,'fractionalCarry');
  if(pps<0||scale<0||carry<0)throw new RangeError('Negative emission input is unresolved');
  let amount=f32(f32(pps*dt)*scale);
  // Original2b47604..640; clamping precedes truncation and fractional carry.
  if(emitter.config.emitAtBegin&&time>0&&time<=dt&&amount<1)amount=1;
  let requested=Math.trunc(amount);
  count(requested,'emission amount');
  carry=f32(carry+f32(amount-f32(requested)));
  if(capacity<=live)requested=0; // Carry survives a full pool.
  else if(carry>=1){const extra=Math.trunc(carry);requested+=extra;carry=f32(carry-f32(extra));}
  emitter.fractionalCarry=carry;
  const admitted=sourceSfxAdmitParticleQuality(requested,budget,qualityFactor);
  count(admitted,'quality admitted');
  // Selected nodes have moveCount==0. Previous-tick count and live count are
  // deliberately separate: actual spawning applies its own current capacity.
  return Math.min(admitted,capacity-previous);
}

// Preserve the allocated vector. Retirement swaps the last live pointer into
// the vacated slot and processes that replacement without incrementing i.
export function sourceSfxUpdateParticlePool(emitter,dt,hooks){
  const {pool}=emitter;
  if(!Array.isArray(pool)||pool.length<emitter.liveCount)throw new TypeError('Allocated particle pool required');
  const motion=required(hooks.motion,'motion');
  const expire=required(hooks.expire,'expire');
  const finish=required(hooks.finishUpdate,'finishUpdate'); // Native virtual998.
  for(let i=0;i<emitter.liveCount;){
    const particle=pool[i];
    const result=sourceSfxAdvanceParticle(particle,{...motion(particle,emitter),dt,
      onExpire:expired=>{
        // Preserve identity for source retirement/influence bindings.
        Object.assign(particle,expired);
        expire(particle,emitter);
      }});
    if(result.expired){
      const last=--emitter.liveCount;
      pool[i]=pool[last];pool[last]=particle;
    }else{Object.assign(particle,result.particle);i++;}
  }
  finish(emitter);
}

// One native step, AFTER base tick and velocity-curve sampling. The spawn
// adapter owns source geometry/transform/RNG and fills the existing pool.
// Deferred jobs queue births but do not postpone this step's update loop.
export function sourceSfxStepEmitter(emitter,dt,hooks){
  const spawn=required(hooks.spawnBatch,'spawnBatch');
  required(hooks.motion,'motion');required(hooks.expire,'expire');required(hooks.finishUpdate,'finishUpdate');
  if(!['inline','deferred'].includes(hooks.spawnMode))throw new TypeError('Resolved spawnMode required');
  if(hooks.spawnMode==='deferred')required(hooks.enqueueSpawn,'enqueueSpawn');
  const births=sourceSfxEmissionCount(emitter,dt,hooks);
  if(births!==0){
    const run=()=>spawn(emitter,births,f32(dt));
    if(hooks.spawnMode==='deferred')hooks.enqueueSpawn(run);else run();
  }
  sourceSfxUpdateParticlePool(emitter,f32(dt),hooks);
  // Set by the enclosing native tick after step, before any deferred spawn.
  emitter.previousTickLiveCount=emitter.liveCount;
  return births;
}

// Tick2b48060..2b480dc. Warm steps leave node time and sampled velocity
// unchanged. previousTickLiveCount is written only after the final normal step.
export function sourceSfxTickEmitter(emitter,dt,hooks){
  dt=finite(dt,'dt');selectedEmitter(emitter.config);
  if(dt<0)throw new RangeError('Reverse particle simulation is unresolved');
  const previous=emitter.previousTickLiveCount;
  let elapsed=emitter.preEmissionElapsed??0,total=0;
  const step=delta=>{emitter.previousTickLiveCount=previous;total+=sourceSfxStepEmitter(emitter,delta,hooks);};
  if(elapsed<emitter.config.preEmitTime&&dt>0&&emitter.state===1){
    const warm=Math.max(dt,f32(.033));
    do{step(warm);elapsed=f32(elapsed+warm);}while(elapsed<=emitter.config.preEmitTime);
    emitter.preEmissionElapsed=elapsed;
  }
  step(dt);return total;
}
