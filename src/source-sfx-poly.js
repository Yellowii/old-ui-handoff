import {createSourceSfxFloatCurve} from './source-sfx-curves.js';
import {sourceSfxNormalize3} from './source-sfx-vector.js';
import {createSourceSfxPolySpawnBatch,sourceSfxType3Basis} from './source-sfx-spawn.js';
import {sourceSfxTickEmitter} from './source-sfx-emitter.js';
import {bindSourceSfxNode,sourceSfxBaseTick,sourceSfxParticlePolyEligible,sourceSfxRetireNode} from './source-sfx-node.js';
import {sourceSfxActivate,sourceSfxSetState} from './source-sfx-lifecycle.js';
import {initializeSourceSfxPolyStorage} from './source-sfx-poly-initialize.js';
import {readSourceSfxDistanceFade} from './source-sfx-base-reader.js';
import {bindSourceSfxBasicSceneCallbacks} from './source-sfx-type-scene.js';

const f32=Math.fround;
const required=(fn,name)=>{if(typeof fn!=='function')throw new TypeError(`${name} required`);return fn;};
const numeric=(value,name)=>{
  if(value===undefined||value===null||value==='')throw new TypeError(`${name}: source value missing`);
  const n=f32(Number(value));if(!Number.isFinite(n))throw new TypeError(`${name}: finite value required`);return n;
};
const boolean=(value,name)=>{if(value==='true')return true;if(value==='false')return false;throw new TypeError(`${name}: source boolean missing`);};
const vec=(value,name)=>{
  const a=typeof value==='string'?JSON.parse(value):value;
  if(!Array.isArray(a)||a.length!==3)throw new TypeError(`${name}: source vector required`);
  return a.map((x,i)=>numeric(x,`${name}[${i}]`));
};
const radians=value=>f32(f32(value/180)*f32(Math.PI));

// Compile directly from the published ordered XML tree. Curves retain their
// source times; only angular VALUES receive the reader's degree conversion.
export function compileSourceSfxPolyProfile(orderedNodes,path){
  const entry=orderedNodes.find(n=>n.path===path);
  if(!entry||!/^ParticleSystem\[\d+\]$/.test(path.split('/').at(-1)))throw new TypeError('ParticleSystem source path required');
  const a=entry.attributes,n=k=>numeric(a[k],k),b=k=>boolean(a[k],k);
  const children=orderedNodes.filter(item=>item.path.startsWith(path+'/')&&item.path.split('/').length===path.split('/').length+1);
  const curve=(name,angular=false)=>{
    const item=children.find(item=>item.path.split('/').at(-1).startsWith(name+'['));
    if(!item)throw new TypeError(`${name}: source curve missing`);
    return createSourceSfxFloatCurve({...item,frames:angular?item.frames.map(frame=>({...frame,Value:radians(numeric(frame.Value,name))})):item.frames});
  };
  const config={emissionType:n('EmissionType'),emitEven:b('EmitEven'),emitAtBegin:b('EmitAtBegin'),
    emitEvenRandom:n('EmitEvenRandom'),emitMove:b('EmitMove'),preEmitTime:n('PreEmitTime'),
    activeLimit:n('EmitActiveMin'),sleepLimit:n('EmitSleepMin'),anchorSum:n('AnchorSum'),emitAtGround:b('EmitAtGround')};
  if(![0,3,4].includes(config.emissionType))throw new RangeError('Unsupported ParticlePoly emissionType');
  config.preEmitTime=Math.min(3,config.preEmitTime);
  if(config.preEmitTime<0)throw new RangeError('Negative particle pre-emission');
  const expected={emitEven:true,emitEvenRandom:0,emitMove:false,activeLimit:-1,sleepLimit:-1,anchorSum:0,emitAtGround:false};
  for(const key of Object.keys(expected))if(config[key]!==expected[key])throw new RangeError(`Unsupported ParticlePoly ${key}`);
  if(n('EmitActiveMax')!==-1||n('EmitSleepMax')!==-1||n('EmitMoveRate')!==0||n('CollisionPlane')!==0||n('ParticleSortType')!==0)throw new RangeError('Unimplemented particle movement/sort profile');
  const trackAction=n('TrackActionType');
  if(![0,1,2].includes(trackAction))throw new RangeError('Unresolved particle action transform');
  if(!Number.isInteger(n('RandomSumInterval'))||n('RandomSumInterval')<0)throw new RangeError('Nonnegative integer RandomSumInterval required');
  const curves={radius:curve('EmissionRadiusFrame'),minVelocity:curve('MinSpriteVelocityFrame'),maxVelocity:curve('MaxSpriteVelocityFrame'),
    gravity:curve('GravityFrame'),angular:curve('RotDegreeSpeedFrame',true)};
  let type3Basis;
  if(config.emissionType===3&&children.find(n=>n.path.split('/').at(-1).startsWith('EmissionRadiusFrame['))?.frames.some(k=>Number(k.Value)!==0)){
    const direction=children.find(n=>n.path.split('/').at(-1).startsWith('EmissionDirDegreeFrame['));
    if(!direction?.frames.length||direction.frames.some(k=>Number(k.Value)!==0))throw new RangeError('Unimplemented type3 initial plane rotation');
    type3Basis=sourceSfxType3Basis(vec(a.PlaneDir,'PlaneDir'));
  }
  return {path,config,curves,particlesPerSecond:n('ParticlesPerSecond'),friction:n('Friction'),
    lifespan:n('FxLifeSpan'),emissionLife:a.EmissionLifeSpan===undefined?n('FxLifeSpan'):n('EmissionLifeSpan'),
    start:n('FxStartTime'),maxSpriteNum:n('MaxSpriteNum'),actionMode:trackAction===0?1:trackAction===1?2:0,
    randomSum:vec(a.RandomSum,'RandomSum'),randomSumInterval:n('RandomSumInterval'),
    gravityDirection:sourceSfxNormalize3(vec(a.AccelForward,'AccelForward')),earlierTime:n('EarlierTime'),shutdownFadeTime:n('ShutdownFadeOutTime'),
    birth:{planeDirection:vec(a.PlaneDir,'PlaneDir'),type3Basis,thickness:n('RefThickerLen'),height:n('EmissionHight'),inside:b('Inside'),
      minLife:n('MinSpriteLifespan'),maxLife:n('MaxSpriteLifespan'),minRadius:n('MinRadius'),maxRadius:n('MaxRadius'),
      randomAngularSpeed:radians(n('RotDegreeSpeedRandom')),originalAngle:radians(n('OrigDegree')),
      originalAngleRandom:radians(n('OrigDegreeRandom')),oldRotationMode:b('RotDegreeSpeedOld'),
      randomHalfTurn:b('RandomOrigRotate'),randomStartEnabled:b('SprStartRandom')},
    texturePath:a.Texture,atlasMode:n('SprWorkMode'),atlasRate:n('SprSpeedRate'),
    distanceFade:readSourceSfxDistanceFade(a)};
}

export function sourceSfxPolyExpired(node){
  return node.time>node.lifespan&&node.lifespan>0&&!node.endless&&node.liveCount===0;
}

// Fresh construction; caller still resolves base-node/scene state and live globals.
export function initializeSourceSfxParticlePoly(node,profile,hooks,{globalParticleLimit}){
  initializeSourceSfxPolyStorage(node,profile,{globalParticleLimit});
  return bindSourceSfxParticlePoly(node,profile,hooks);
}

// ParticlePoly virtual8b8=2ede3b8. Eligibility happens in phase0, simulation
// in phase1. Calling node.update here would repeat eligibility and its resets.
export function dispatchSourceSfxParticlePoly(node,stage,hooks={}){
  if(![0,1,2].includes(stage))throw new RangeError('Source particle phase required');
  if(stage===0){
    node.counter700=0;node.previousTickLiveCount=0;
    const flag=()=>Boolean(required(node.typeHooks?.retire9,'particle virtuale0')(node,9));
    if(flag()&&node.state!==3){
      const gate=Boolean(typeof hooks.globalSuppressionGate==='function'?hooks.globalSuppressionGate():hooks.globalSuppressionGate);
      return Number(!(gate&&node.ownerGroup?.flag81&&!node.ownerGroup?.flagD2));
    }
    // The source queries flag9 again on this branch; preserve possible effects.
    if(flag())sourceSfxRetireNode(node,hooks);
    return 0;
  }
  if(stage===1){
    required(node.typeHooks?.tick,'particle virtual940')(node,hooks);
    if(node.state===3){
      const retire=()=>sourceSfxRetireNode(node,hooks);
      if(hooks.enqueueTask)hooks.enqueueTask(retire);else retire();
    }
  }
  return 1;
}

// Bind an already initialized source node. Scene/controller state, capacity,
// quality budget, stream and stopTime are mandatory runtime inputs. This layer
// supplies real type240/940/948/950/930 behavior, not a generic simulator tick.
export function bindSourceSfxParticlePoly(node,profile,hooks){
  for(const key of ['frame','prepareSpawn','refreshFrameTransform','motionInputs','expireParticle','updateBounds'])required(hooks[key],key);
  const life=hooks.lifecycleHooks;
  if(!life)throw new TypeError('Lifecycle scene/controller hooks required');
  if(typeof node.hasMaterial!=='boolean')throw new TypeError('Resolved material presence required');
  if(node.hasMaterial)required(hooks.updateMaterial,'updateMaterial');
  numeric(node.stopTime,'stopTime528');
  Object.assign(node,{config:profile.config,particlesPerSecond:profile.particlesPerSecond,emissionLife:profile.emissionLife,
    lifespan:profile.lifespan,start:profile.start,actionMode:profile.actionMode,distanceFade:profile.distanceFade});
  const spawnBatch=createSourceSfxPolySpawnBatch({stream:hooks.stream,prepareSpawn:emitter=>({
    ...hooks.prepareSpawn(emitter),...profile.birth,radiusCurve:profile.curves.radius,
    minVelocity:emitter.minVelocity,maxVelocity:emitter.maxVelocity,
  })});
  // Scene virtual88 = Emitter2b4b4c8. This notification refreshes the frame
  // transform only; it must never invoke the virtual78 simulation wrapper.
  node.transformChanged=()=>hooks.refreshFrameTransform(node,profile.actionMode);
  node.flag8a=profile.earlierTime!==0||profile.shutdownFadeTime!==0; //2b45770..78c.
  node.sourceStageMask=3; // virtual8c0=2ede53c.
  node.dispatchPhase=stage=>dispatchSourceSfxParticlePoly(node,stage,hooks);
  node.typeHooks={
    eligible:sourceSfxParticlePolyEligible,
    retire9:n=>Boolean(n.flag9),expired:sourceSfxPolyExpired,
    activation:(n,enabled)=>{sourceSfxActivate(n,enabled,life);if(!enabled)sourceSfxSetState(n,2,life);},
    shutdown:n=>{sourceSfxSetState(n,3,life);n.velocity=[0,0,0];sourceSfxSetState(n,2,life);},
    tick:n=>{
      const frame=hooks.frame(n);
      const primary=numeric(frame.primaryDelta,'primaryDelta'),fallback=numeric(frame.fallbackDelta,'fallbackDelta');
      const scaled=f32((primary!==0?primary:fallback)*numeric(n.rate,'node rate'));
      const sceneFactor=numeric(frame.sceneFactor,'sceneFactor');
      sourceSfxBaseTick(n,hooks);
      hooks.refreshFrameTransform(n,profile.actionMode);
      const dt=f32(scaled*sceneFactor);
      n.minVelocity=profile.curves.minVelocity(n.time);
      n.maxVelocity=profile.curves.maxVelocity(n.time);
      sourceSfxTickEmitter(n,dt,{...frame,spawnBatch,
        motion:particle=>({randomSum:profile.randomSum,randomSumInterval:profile.randomSumInterval,stream:hooks.stream,...hooks.motionInputs(n,particle),friction:profile.friction,
          gravityDirection:profile.gravityDirection,gravityCurve:profile.curves.gravity,
          angularCurve:profile.curves.angular,oldRotationMode:profile.birth.oldRotationMode,actionMode:profile.actionMode}),
        expire:particle=>hooks.expireParticle(n,particle),
        finishUpdate:()=>{}, // Confirmed ParticleSortType0: virtual998 is no-op.
      });
      n.counter700=n.liveCount;
      if(n.state===2&&n.liveCount===0&&n.time>n.stopTime)sourceSfxSetState(n,3,life);
      hooks.updateBounds(n);
      if(profile.shutdownFadeTime>0&&n.state===2){
        n.shutdownFade=Math.min(f32(Math.max(f32(f32(profile.shutdownFadeTime+n.stopTime)-n.time),0)/profile.shutdownFadeTime),1);
      }
      if(n.hasMaterial)hooks.updateMaterial(n,n.time,n.lifespan);
    },
  };
  return bindSourceSfxBasicSceneCallbacks(bindSourceSfxNode(node,hooks),'ParticlePoly',hooks);
}
