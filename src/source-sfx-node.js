import {sourceSfxChildTime} from './source-sfx-clock.js';
import {sourceSfxActivationChange} from './source-sfx-time.js';
import {sourceSfxActivate} from './source-sfx-lifecycle.js';

const f32=Math.fround;
const required=(value,name)=>{
  if(typeof value!=='function')throw new TypeError(`${name}: callback required`);
  return value;
};
const hook=(node,name,hooks)=>node.typeHooks?.[name]??hooks.typeHooks?.[name];

// Source SfxBase 0x2b521c4. The force-advance call remains last so callers
// can preserve its side effects and the source short-circuit behavior.
export function sourceSfxBaseEligible(node,{globalQuality,qualityEligible}={}){
  if(node.state!==3&&node.flag9&&required(qualityEligible??node.qualityEligible,'qualityEligible')(node)&&
    f32(node.minimumQuality)<=Math.min(f32(node.quality),f32(globalQuality)))return true;
  return Boolean(node.ownerGroup?.forceAdvance?.(node));
}

export function sourceSfxParticlePolyEligible(node){
  node.counter700=0;
  node.previousTickLiveCount=0;
  return Boolean(node.flag9&&node.state!==3);
}

function fadeConfig(node){
  const fade=node.distanceFade??node;
  return {
    nearEnabled:Boolean(fade.nearEnabled??fade.flag10c),farEnabled:Boolean(fade.farEnabled??fade.flag10d),
    farEnd:fade.farEnd??fade.f8,farStart:fade.farStart??fade.fc,
    nearStart:fade.nearStart??fade['100'],nearEnd:fade.nearEnd??fade['104'],
  };
}
const cameraPosition=camera=>camera?.position??camera;

// 2b520b8: far runs first, then near deliberately replaces the result.
export function sourceSfxDistanceFade(node,camera){
  const fade=fadeConfig(node);
  let factor=1;
  if(!(fade.nearEnabled||fade.farEnabled))return factor;
  if(camera===null)return factor;
  const position=cameraPosition(camera);
  // 2b52104..2b52118 reads the actor's scene world position every call. Keep
  // explicit position input for adapters without a scene record, but never
  // prefer a stale cached position over a connected source scene.
  const nodePosition=node.sceneObject?node.sceneObject.world?.translation:node.position;
  if(!Array.isArray(position)||!Array.isArray(nodePosition))throw new TypeError('Explicit camera and node positions required');
  const delta=nodePosition.map((value,index)=>f32(f32(value)-f32(position[index])));
  const squares=delta.map(value=>f32(value*value));
  const distance=f32(Math.sqrt(f32(f32(squares[0]+squares[1])+squares[2])));
  if(fade.farEnabled){
    if(distance>f32(fade.farEnd))factor=0;
    else if(distance>f32(fade.farStart))factor=f32(f32(fade.farEnd-distance)/f32(fade.farEnd-fade.farStart));
  }
  if(fade.nearEnabled){
    if(distance<f32(fade.nearStart))factor=0;
    else if(distance<f32(fade.nearEnd))factor=f32(f32(distance-fade.nearStart)/f32(fade.nearEnd-fade.nearStart));
  }
  return factor;
}

// Dummy/base virtual940. Other simulators must provide their own tick hook.
export function sourceSfxBaseTick(node,hooks={}){
  const owner=node.ownerGroup;
  if(!owner)throw new TypeError('ownerGroup required');
  const activation=sourceSfxActivationChange({state:node.state,time:owner.time,start:node.start,delay:owner.delay,lifespan:node.lifespan,endless:node.endless});
  if(activation!==null){
    const activate=hook(node,'activation',hooks);
    if(activate)activate(node,activation);
    else sourceSfxActivate(node,activation,hooks.lifecycleHooks??hooks);
  }
  // Activation may restart/seek its owner. Source reads both fields again.
  node.time=sourceSfxChildTime(owner.time,node.start,owner.delay);
  node.distanceFade170=sourceSfxDistanceFade(node,required(hooks.camera,'camera')(node));
  if(node.binding158)required(hooks.attachTransform,'attachTransform')(node);
  const expired=hook(node,'expired',hooks);
  if(expired?.(node)){
    required(hook(node,'shutdown',hooks),'type shutdown')(node);
  }
  if(node.flag83&&node.sceneObject)required(hooks.resetBounds,'resetBounds')(node);
}

function retireNow(node,group,hooks){
  const controllerBranch=node.sceneObject!=null;
  const key=controllerBranch?'controllers':'nodes';
  const countKey=controllerBranch?'activeControllerCount':'activeNodeCount';
  const entries=group[key]??[];
  const count=group[countKey]??entries.length;
  let index=-1;
  for(let i=count-1;i>=0;i--){
    const entry=entries[i];
    if(controllerBranch?entry?.node===node:entry===node){index=i;break;}
  }
  if(index<0)return false;
  const [removed]=entries.splice(index,1);
  entries.push(removed);
  group[countKey]=count-1;
  if(controllerBranch){
    required(hooks.detachSceneObject,'detachSceneObject')(node.sceneObject);
    (group.detached??=[]).push(node);
    required(hooks.notifyGroupSceneObject,'notifyGroupSceneObject')(group.sceneObject,0);
  }
  return true;
}

export function sourceSfxRetireNode(node,hooks={}){
  const group=node.ownerGroup;
  if(!group)throw new TypeError('ownerGroup required');
  const run=()=>retireNow(node,group,hooks);
  const context=node.sourceContext??hooks.sourceContext;
  if((context?.flags??0)&1){required(hooks.enqueueRetirement,'enqueueRetirement')(run);return undefined;}
  return run();
}

// SfxBase virtual78. It is bound directly as node.update for the T205 child loop.
export function sourceSfxNodeUpdate(node,hooks={}){
  const eligible=hook(node,'eligible',hooks)??((candidate)=>sourceSfxBaseEligible(candidate,hooks));
  if(eligible(node)){
    const owner=node.ownerGroup;
    if(Boolean(hooks.globalSuppressionGate?.()??hooks.globalSuppressionGate)&&owner?.flag81&&!owner?.flagD2)return;
    required(hook(node,'tick',hooks)??sourceSfxBaseTick,'type tick')(node,hooks);
    if(node.state===3)sourceSfxRetireNode(node,hooks);
  }else if(hook(node,'retire9',hooks)?.(node,9))sourceSfxRetireNode(node,hooks);
}

export function bindSourceSfxNode(node,hooks={}){
  node.update=()=>sourceSfxNodeUpdate(node,hooks);
  return node;
}
