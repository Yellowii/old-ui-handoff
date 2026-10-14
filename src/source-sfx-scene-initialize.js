import {sourceSfxNotifySceneSync} from './source-sfx-scene.js';
const identity=()=>({translation:[0,0,0],scale:[1,1,1],rotation:[1,0,0,0,1,0,0,0,1],flags:0});

// Pool zeroing2a7d928 followed by SpaceNode2a06344. Two constructor globals
// remain explicit; these initial bounds are original sentinel values, not
// replacement geometry bounds or evidence of rendered-asset equivalence.
export function createSourceSfxScene({defaultFlag48,defaultParentBinding}){
  if(!Number.isInteger(defaultFlag48)||defaultFlag48<0||defaultFlag48>255)throw new TypeError('Explicit source constructor flag byte required');
  if(defaultParentBinding===undefined)throw new TypeError('Explicit source default parent binding required (null if absent)');
  return {local:identity(),world:identity(),inheritanceMask:65535,flags38:0n,flags48:(defaultFlag48<<4)&255,
    parentBinding:defaultParentBinding,parent:null,actor:null,spatialRecord:null,scene:null,component:null,
    pendingRegistration:false,sceneAttachment:null,
    children:[],listeners:[],childIndex:-1,word40:0,byte44:0,mask4a:65535,
    controllerGroup:null,controllerIndex:0,updateOrder:0,updateIndex:-1,
    localBounds:{maximum:[100000,100000,100000],minimum:[-100000,-100000,-100000]},
    transformUpdateHeld:false,pendingSkipPropagation:true,transformDirty:false,mirrored:false,pendingTransformNext:null};
}

// Scene virtual38=2a0c194, preserving the live child vector after callbacks.
export function bindSourceSfxSceneHierarchy(scene,hooks){
  if(!Array.isArray(scene.children))throw new TypeError('Source scene children required');
  scene.propagateTransform=()=>{
    for(let i=0;i<scene.children.length;i++)sourceSfxNotifySceneSync(scene.children[i],false,hooks);
  };
  return scene;
}

// SfxBase virtualc8=2b52288 → ownerGroup2b67cbc. Group uses the same body
// directly. The global gate short-circuits the per-group byte391, then writes
// dirty392 even if the returned answer is false.
export function sourceSfxCanPropagateTransform(actor,{readGlobalPropagationGate}){
  const group=actor.isGroup?actor:actor.ownerGroup;
  if(!group)return true;
  if(typeof readGlobalPropagationGate!=='function')throw new TypeError('Source global propagation gate required');
  const global=readGlobalPropagationGate();
  if(typeof global!=='boolean'||(!global&&typeof group.flag391!=='boolean'))throw new TypeError('Source propagation booleans required');
  const permitted=global||group.flag391;
  group.dirty392=!permitted;
  return permitted;
}
