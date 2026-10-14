import {sourceSfxInheritTransform} from './source-sfx-controller.js';
const f32=Math.fround;
const identity=()=>({translation:[0,0,0],scale:[1,1,1],rotation:[1,0,0,0,1,0,0,0,1],flags:0});
const copy=t=>({translation:t.translation.map(f32),scale:t.scale.map(f32),rotation:t.rotation.map(f32),flags:t.flags});
const required=(fn,name)=>{if(typeof fn!=='function')throw new TypeError(`${name} required`);return fn;};
const negative=t=>f32(f32(t.scale[0]*t.scale[1])*t.scale[2])<0;

// 2a0945c: a controller-owned scene object uses the canonical controller's
// world TRS, not its visual parent. Missing controller/parent returns native
// identity; a bound attachment must resolve through its own source binding.
export function sourceSfxSceneParentTransform(scene){
  if(scene.controllerGroup){
    return scene.controllerGroup.canonicalControllers[scene.controllerIndex]?.world??identity();
  }
  if(!scene.parent)return identity();
  if(scene.parentBinding)return required(scene.parentBinding.getTransform,'parent binding transform')(scene.parent,scene);
  return scene.parent.world;
}

// 2a0a7b8 plus the common bounds block of 2a0a594/2a0a9b8. The spatial record
// is optional; its absence does not justify inventing bounds or allocating one.
export function sourceSfxRefreshSceneTransform(scene){
  scene.transformDirty=false; // byte13b is cleared by the caller before recomposition.
  scene.world=(!scene.parent&&!scene.component&&(scene.inheritanceMask&7)!==0)
    ?copy(scene.local):sourceSfxInheritTransform(scene.local,sourceSfxSceneParentTransform(scene),scene.inheritanceMask);
  if(scene.spatialRecord){
    const {maximum,minimum}=scene.localBounds;
    const center=maximum.map((value,i)=>f32(f32(f32(value)+f32(minimum[i]))*.5));
    const half=maximum.map((value,i)=>f32(f32(f32(value)-f32(minimum[i]))*.5));
    const rows=[0,1,2].map(i=>scene.world.rotation.slice(3*i,3*i+3).map(x=>f32(x*scene.world.scale[i])));
    scene.spatialRecord.center=[0,1,2].map(j=>{
      let value=f32(f32(rows[0][j]*center[0])+scene.world.translation[j]);
      value=f32(f32(rows[1][j]*center[1])+value);
      return f32(f32(rows[2][j]*center[2])+value);
    });
    scene.spatialRecord.halfExtents=[0,1,2].map(j=>f32(f32(Math.abs(f32(rows[0][j]*half[0]))+
      Math.abs(f32(rows[1][j]*half[1])))+Math.abs(f32(rows[2][j]*half[2]))));
  }
}

const notifyActor=actor=>required(actor.transformChanged,'actor virtual88').call(actor);

// Immediate2a0a594. The two flags control scene virtual38 propagation, not
// actor simulation. Suppressed group maintenance passes false,false.
export function sourceSfxNotifySceneImmediate(scene,skipPropagation,checkActor,hooks={}){
  sourceSfxRefreshSceneTransform(scene);
  if(scene.component)required(hooks.refreshComponent,'scene component refresh')(scene.component);
  if(!skipPropagation&&(!checkActor||!scene.actor||required(scene.actor.canPropagateTransform,'actor virtualc8').call(scene.actor))){
    required(scene.propagateTransform,'scene virtual38').call(scene);
  }
  scene.mirrored=negative(scene.world);
  if(scene.actor)notifyActor(scene.actor);
}

// 2a0a9b8 schedules independent component/actor notifications if the source
// task context exists. Actor reference capture matches 4974d24/2a0e970: resolve
// the live referent when the task runs, not merely when it is queued.
export function sourceSfxNotifyScenePhased(scene,hooks={}){
  sourceSfxRefreshSceneTransform(scene);
  if(scene.component){
    const component=scene.component,run=()=>required(hooks.refreshComponent,'scene component refresh')(component);
    if(hooks.enqueueTask)hooks.enqueueTask(run);else run();
  }
  scene.mirrored=negative(scene.world)||Boolean(scene.parent&&negative(scene.parent.world));
  if(scene.actor){
    if(hooks.enqueueTask){
      const resolve=required(hooks.captureActorReference,'capture source actor reference')(scene.actor);
      required(resolve,'resolve source actor reference');
      hooks.enqueueTask(()=>{const actor=resolve();if(actor)notifyActor(actor);});
    }else notifyActor(scene.actor);
  }
}

// Native deferred-transform queue128/head8947b28. Keep pointer-list semantics;
// a Set would silently change the tail re-enqueue behavior of the source.
export function createSourceSfxSceneQueue(enabled){
  if(typeof enabled!=='boolean')throw new TypeError('Explicit source deferred-transform gate required');
  return {enabled,head:null};
}
export function sourceSfxNotifySceneSync(scene,skipPropagation,{transformQueue,...hooks}){
  if(!transformQueue||typeof transformQueue.enabled!=='boolean')throw new TypeError('Source transform queue required');
  if(transformQueue.enabled){
    scene.pendingSkipPropagation=Boolean(scene.pendingSkipPropagation&&skipPropagation); // byte139.
    if(scene.pendingTransformNext)return;
    // Native would produce a linked-list cycle if the current null-linked tail
    // were enqueued twice. Reject that unresolved calling sequence explicitly.
    for(let cursor=transformQueue.head;cursor;cursor=cursor.pendingTransformNext){
      if(cursor===scene)throw new Error('Source deferred-transform tail re-enqueue would form a cycle');
    }
    scene.pendingTransformNext=transformQueue.head;transformQueue.head=scene;
    return;
  }
  if(scene.transformUpdateHeld){
    scene.pendingSkipPropagation=Boolean(scene.pendingSkipPropagation&&skipPropagation);
    return;
  }
  sourceSfxNotifySceneImmediate(scene,skipPropagation,true,hooks);
}

// 2a0a734 reverses the detached list, clears each link before callbacks, and
// resets byte139 to1. New notifications during callbacks belong to a later flush.
export function flushSourceSfxSceneQueue(queue,hooks={}){
  let head=queue.head;queue.head=null;
  if(!head)return false;
  let reversed=null;
  while(head){const next=head.pendingTransformNext;head.pendingTransformNext=reversed;reversed=head;head=next;}
  while(reversed){
    const scene=reversed;reversed=scene.pendingTransformNext;
    scene.pendingTransformNext=null;scene.pendingSkipPropagation=true;
    sourceSfxNotifySceneImmediate(scene,true,true,hooks);
  }
  return true;
}

// Bind to the existing scheduler's owner notifications. These loops read the
// active prefix afresh after every callback, just like the native group loops.
export function bindSourceSfxGroupSceneNotifications(group,hooks){
  const visit=fn=>{
    for(let i=0;i<group.activeControllerCount;i++){
      const node=group.controllers[i].node;
      if(node)fn(node.sceneObject);
    }
  };
  group.owner={...group.owner,
    notifySuppressed:(skip,check)=>visit(scene=>sourceSfxNotifySceneImmediate(scene,Boolean(skip),Boolean(check),hooks)),
    notifySync:skip=>visit(scene=>sourceSfxNotifySceneSync(scene,Boolean(skip),hooks)),
    notifyPhase1:()=>visit(scene=>sourceSfxNotifyScenePhased(scene,hooks)),
  };
  return group;
}
