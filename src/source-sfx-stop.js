import {sourceSfxSetState} from './source-sfx-lifecycle.js';
const required=(fn,name)=>{if(typeof fn!=='function')throw new TypeError(`${name} required`);return fn;};
const call=(node,key,...args)=>required(node[key],key).call(node,...args);
const bit=value=>Boolean(Number(value)&1);

// virtual258=2b51560, distinct from restart/reset. Preserve the previous state
// only when entering state4 from outside the unsigned range2..4.
export function sourceSfxPause(node){
  if(((node.state-2)>>>0)<3)return;
  node.previousState=node.state;node.state=4;
  if(node.savedEndless)node.endless=true;
}

// Basevirtual270=2b52ee8 is a command dispatch, not a direct state setter.
export function sourceSfxStateCommand(node,state,hooks={}){
  if(!Number.isInteger(state)||state< -2147483648||state>0x7fffffff)throw new TypeError('Source int32 state command required');
  if(state===3)return call(node,'shutdownRequested',false);
  if(state===4)return call(node,'pauseRequested');
  if(state!==2)required(hooks.diagnosticState,'source invalid-state diagnostic')(node,state);
  sourceSfxSetState(node,state,hooks);
}

export function sourceSfxStopParticlePoly(node,force,hooks={}){
  if(bit(force)){
    for(let i=0;i<node.liveCount;i++)required(hooks.expireParticle,'particle virtual980')(node,node.pool[i]);
    node.liveCount=0;
  }
  if(node.state===2)return;
  if(typeof node.flag8a!=='boolean')throw new TypeError('Source emitter shutdown-tail flag required');
  if(node.flag8a){node.stopTime=node.time;sourceSfxSetState(node,2,hooks.lifecycleHooks??hooks);}
  else sourceSfxSetState(node,3,hooks.lifecycleHooks??hooks);
}

function* active(group){
  for(let i=0;i<group.activeControllerCount;i++)yield group.controllers[i].node;
  for(let i=0;i<group.activeNodeCount;i++)yield group.nodes[i];
}
function prune(group){
  for(const [key,countKey,actor] of [['controllers','activeControllerCount',c=>c.node],['nodes','activeNodeCount',n=>n]]){
    for(let i=0;i<group[countKey];){
      if(call(actor(group[key][i]),'getState')===3){
        const last=--group[countKey];[group[key][i],group[key][last]]=[group[key][last],group[key][i]];
      }else i++;
    }
  }
}

// Groupvirtual270=2b650dc, active prefixes reread after each child callback.
export function sourceSfxGroupStateCommand(group,state,hooks={}){
  sourceSfxStateCommand(group,state,hooks);
  for(const node of active(group))call(node,'requestState',state);
  if(state===3)prune(group);
}

// Groupvirtual250=2b64c78. Stop active children, then walk the complete lists
// backwards to propagate draining state2, and finally swap retired entries out
// of the active prefixes. Canonical vectors and scene ownership are untouched.
export function sourceSfxStopGroup(group,force,hooks={}){
  sourceSfxSetState(group,3,hooks); // Direct base250 ignores the force flag.
  for(const node of active(group))call(node,'shutdownRequested',bit(force));
  for(let i=group.controllers.length-1;i>=0;i--){
    if(call(group.controllers[i].node,'getState')===2){
      const c=group.controllers[i];call(c.parentController?c.parentController.node:c.ownerGroup,'requestState',2);
    }
  }
  for(let i=group.nodes.length-1;i>=0;i--){
    if(call(group.nodes[i],'getState')===2)sourceSfxGroupStateCommand(group,2,hooks);
  }
  prune(group);
}

export function bindSourceSfxStopCallbacks(node,type,hooks={}){
  if(!['FxDummy','ParticlePoly','FxGroup'].includes(type))throw new RangeError('Confirmed source stop type required');
  const life=hooks.lifecycleHooks??hooks;
  node.getState=()=>node.state; //2b52ee0.
  node.pauseRequested=()=>sourceSfxPause(node);
  node.shutdownRequested=force=>type==='FxGroup'?sourceSfxStopGroup(node,force,life):
    type==='ParticlePoly'?sourceSfxStopParticlePoly(node,force,hooks):sourceSfxSetState(node,3,life);
  node.requestState=state=>{
    if(type==='ParticlePoly'&&state===2)node.stopTime=node.time; //2b4b44c before base dispatch.
    return type==='FxGroup'?sourceSfxGroupStateCommand(node,state,life):sourceSfxStateCommand(node,state,life);
  };
  return node;
}
