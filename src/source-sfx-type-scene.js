import {bindSourceSfxVisibility,sourceSfxInheritParentVisibility} from './source-sfx-visibility.js';
import {sourceSfxLeaveActorServices} from './source-sfx-scene-services.js';
import {sourceSfxCanPropagateTransform} from './source-sfx-scene-initialize.js';
import {bindSourceSfxStopCallbacks} from './source-sfx-stop.js';
import {bindSourceSfxProperties} from './source-sfx-properties.js';

// Exact shared entries of FxDummy7cf0e78 and ParticlePoly7d13790. Group has
// different28/38/48/50/58/88 and must not inherit this binding by default.
export function bindSourceSfxBasicSceneCallbacks(node,type,hooks={}){
  if(type!=='FxDummy'&&type!=='ParticlePoly')throw new RangeError('Confirmed source basic scene type required');
  const {sceneServices={},readGlobalPropagationGate}=hooks;
  bindSourceSfxStopCallbacks(node,type,hooks);
  bindSourceSfxProperties(node,type,hooks);
  bindSourceSfxVisibility(node);
  node.bindSceneObject=scene=>{node.sceneObject=scene;}; //29dd1b8 /2b4be3c.
  node.sceneEntering=()=>{}; //2b515d8 ret.
  node.sceneEntered=()=>{}; //29eaf78 ret.
  node.sceneLeaving=context=>sourceSfxLeaveActorServices(node,context,sceneServices); //29ded80.
  node.parentAttached=parent=>sourceSfxInheritParentVisibility(node,parent);
  node.parentDetached=()=>{}; //29e9a70 ret.
  node.postUpdate=()=>{}; //29e9a88 ret.
  node.canPropagateTransform=()=>sourceSfxCanPropagateTransform(node,{readGlobalPropagationGate});
  node.groupSceneBound=()=>{}; //8d0 2b44d88 ret.
  node.groupSceneUnbound=()=>{}; //8d8 2b44d8c ret.
  node.groupParentAttached=()=>{}; //8e0 2b44d90 ret.
  node.groupParentDetached=()=>{}; //8e8 2b44d94 ret.
  if(type==='FxDummy')node.transformChanged=()=>{}; //29eaf94 ret.
  // ParticlePoly88 remains the initialized Emitter refreshFrameTransform path.
  return node;
}
