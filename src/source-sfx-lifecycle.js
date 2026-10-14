import {sourceSfxAdvanceGroupTime,sourceSfxChildTime} from './source-sfx-clock.js';
import {sourceSfxActivationChange,sourceSfxGroupExpired} from './source-sfx-time.js';
import {sourceSfxRandom} from './source-sfx-random.js';

const f32=Math.fround;
const required=(value,name)=>{if(typeof value!=='function')throw new TypeError(`${name}: callback required`);return value;};
const restoreEndless=node=>{if(node.savedEndless)node.endless=true;};

export function sourceSfxSetState(node,state,hooks={}){
  node.state=state;
  if(state===2){if(node.endless){node.endless=false;node.savedEndless=true;}return;}
  restoreEndless(node);
  if(state===3){
    required(hooks.refreshQuality,'refreshQuality')(node);
    const owner=node.ownerGroup??(node.isGroup?node:null);
    if(!node.isGroup&&owner)required(hooks.notifyParent,'notifyParent')(owner);
    if(node.retirementHandler&&owner?.sceneObject?.scene)required(hooks.queueScene,'queueScene')(owner.sceneObject.scene,node);
  }
}

export function sourceSfxActivate(node,enabled,hooks={}){
  if(enabled){
    required(hooks.writeQualityToken,'writeQualityToken')(node);
    node.state=1;restoreEndless(node);
    if(!node.isGroup)required(hooks.controllerSeek,'controllerSeek')(node,0);
  }else{
    node.state=0;restoreEndless(node);
    if(!node.isGroup)required(hooks.controllerStop,'controllerStop')(node);
  }
}

export function sourceSfxReset(node,{environmentFrame,cacheInvalidation=false,...hooks}={}){
  if(!Number.isInteger(environmentFrame)||environmentFrame<0||environmentFrame>0xffffffff||!Number.isInteger(node.lastFrame)||node.lastFrame<0||node.lastFrame>0xffffffff)throw new TypeError('Explicit uint32 frame counters required');
  node.time=0;node.word68=0;node.word6c=0;node.state=0;restoreEndless(node);
  if(!node.isGroup){required(hooks.controllerSeek,'controllerSeek')(node,0);required(hooks.controllerStop,'controllerStop')(node);}
  node.lastFrame=Math.min(node.lastFrame,environmentFrame);
  if(cacheInvalidation)node.cache=-1;
}

export function sourceSfxSeek(node,time,hooks={}){
  node.time=f32(time);
  if(node.time<=0){node.state=0;restoreEndless(node);}
  else if(node.time<=f32(node.lifespan)){node.state=1;restoreEndless(node);}
  else sourceSfxActivate(node,false,hooks);
  if(!node.isGroup)required(hooks.controllerSeek,'controllerSeek')(node,f32(node.time*1000));
}

export function sourceSfxRestoreGroup(group,hooks={}){
  group.activeNodeCount=(group.nodes??[]).length;group.activeControllerCount=(group.controllers??[]).length;
  for(const item of group.detached??[])required(hooks.detachSceneObject,'detachSceneObject')(item,0);
  group.detached=[];
  for(const [index,controller] of (group.canonicalControllers??[]).entries())required(hooks.attachController,'attachController')(controller,group,index);
  required(hooks.notifyRootOwner,'notifyRootOwner')(group,0);
  group.controllers=[...(group.canonicalControllers??[])];group.nodes=[...(group.canonicalNodes??[])];
}

export function sourceSfxGroupSeek(group,input,hooks={}){
  sourceSfxRestoreGroup(group,hooks);sourceSfxSeek(group,input,hooks);
  const offset=item=>sourceSfxChildTime(input,item.start,group.delay);
  for(const controller of group.controllers)required(hooks.seekController,'seekController')(controller,offset(controller));
  for(const node of group.nodes)required(hooks.seekNode,'seekNode')(node,offset(node));
}

export function sourceSfxGroupRestart(group,hooks={}){
  if(!group.sceneObject?.scene)return false;
  if(group.autoSmoothFollow)required(hooks.enableAutoSmoothFollow,'enableAutoSmoothFollow')(group.autoSmoothFollow);
  group.dirty390=true;sourceSfxRestoreGroup(group,hooks);sourceSfxReset(group,hooks);
  for(const controller of group.canonicalControllers??[])required(hooks.restartController,'restartController')(controller);
  for(const node of group.nodes)required(hooks.restartNode,'restartNode')(node);
  required(hooks.refreshGroupQuality,'refreshGroupQuality')(group);
  return true;
}

// Mirrors the deferred 2b680e0 callback as well as the inline expiry branch.
function finishExpiry(group,savedTime,hooks){
  if(group.loop&&group.state!==2){
    group.time=savedTime;
    sourceSfxGroupSeek(group,f32(.01),hooks);
    if(group.time!==0&&group.lifespan!==0){
      const min=f32(group.delayMin),max=f32(group.delayMax);
      if(max>min){
        const stream=group.sharedDelayStream;
        if(!stream||!Number.isInteger(stream.seed)||stream.seed<0||stream.seed>0xffffffff)throw new TypeError('Explicit shared delay stream required');
        const draw=sourceSfxRandom({seed:stream.seed,min,max});
        stream.seed=draw.seed;group.delay=draw.value;
      }else group.delay=min;
    }
  }else if(group.activeControllerCount===0&&group.activeNodeCount===0){
    sourceSfxSetState(group,3,hooks);group.velocity=[0,0,0];
  }
}

export function sourceSfxGroupAdvance(group,hooks={}){
  const position=required(hooks.readPosition,'readPosition')(group.sceneObject).map(f32);
  const delta=f32(group.primaryDelta)!==0?f32(group.primaryDelta):f32(group.fallbackDelta);
  if(group.time>0&&!group.previousPosition)throw new TypeError('Previous source position required after time zero');
  group.velocity=group.time>0?position.map((value,index)=>f32(f32(value-f32(group.previousPosition[index]))*f32(1/delta))):[0,0,0];
  group.position=position;group.previousPosition=[...position];
  group.time=sourceSfxAdvanceGroupTime(group.time,group.primaryDelta,group.fallbackDelta,group.rate,group.sceneFactor);
  const activation=sourceSfxActivationChange(group);
  if(activation!==null)sourceSfxActivate(group,activation,hooks);
  if(sourceSfxGroupExpired(group)){
    const savedTime=group.time;
    if(group.loop&&group.state!==2)group.time=f32(.01);
    const finish=()=>finishExpiry(group,savedTime,hooks);
    // The caller provides the source scheduler's deferred queue when active.
    // Queueing does not run the completion work inline or delay binding updates.
    if(hooks.enqueueExpiry)required(hooks.enqueueExpiry,'enqueueExpiry')(finish);
    else finish();
  }else if(group.dirty393&&hooks.transformRefreshEnabled){
    group.dirty393=false;
    required(hooks.refreshTransform,'refreshTransform')(group);
  }
  if(group.binding38e)required(hooks.updateBinding,'updateBinding')(group);
}

export function bindSourceSfxGroupLifecycle(group,hooks){return {advance:()=>sourceSfxGroupAdvance(group,hooks)};}
