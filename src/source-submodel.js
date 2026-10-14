import {AnimationMixer,LoopOnce,LoopRepeat} from 'three';

export function belongsToModel(node,root){
 for(let parent=node;parent&&parent!==root;parent=parent.parent)if(parent.userData.sourceSubmodel)return false;
 return true;
}

// Reachable source boolean state machine; tuple attachment and graph controls
// come from fragment_submodels.py, not a replacement animation by item ID.
export class SourceSubmodel {
 constructor(root,graph,clips){
  if(graph.version!==1)throw Error('Unsupported submodel graph version');
  this.root=root;this.graph=graph;this.state=graph.initial;this.first=true;
  this.mixer=new AnimationMixer(root);this.actions={};this.times={};this.weights={};
  for(const [key,row]of Object.entries(graph.players)){
   const action=this.mixer.clipAction(clips[key]);action.setLoop(row.loop?LoopRepeat:LoopOnce,Infinity);action.clampWhenFinished=true;action.play();this.actions[key]=action;this.times[key]=row.start;this.weights[key]=key===graph.states[this.state].player?1:0;
  }
  this.sample();
 }
 condition(rule,vars){if('constant'in rule)return rule.constant;if(rule.variable)return Boolean(vars[rule.variable]);if(rule.not)return !this.condition(rule.not,vars);throw Error('Unsupported source condition');}
 resolve(vars){
  let state=this.state,duration=0;
  for(let count=0;count<this.graph.maxTransitions;count++){
   const candidates=this.graph.transitions.filter(t=>t.from===state&&this.condition(t.condition,vars)).sort((a,b)=>a.priority-b.priority);
   if(!candidates.length)break;
   const t=candidates[0];state=t.to;duration=t.duration;
   if(!this.graph.states[state].hub)break;
  }
  return this.graph.states[state].hub?{state:this.state,duration:0}:{state,duration};
 }
 update(dt,vars={},paused=false){
  if(paused)return;
  const input={...this.graph.defaults,...vars};
  const next=this.first&&this.graph.skipFirstTick?{state:this.state}:this.resolve(input);this.first=false;
  if(next.state!==this.state){
   this.state=next.state;const target=this.graph.states[this.state];
   if(target.reset)this.times[target.player]=this.graph.players[target.player].start;
   this.blend={start:{...this.weights},target:target.player,time:0,duration:next.duration};
  }
  const active=new Set(Object.keys(this.weights).filter(key=>this.weights[key]>0));if(this.blend)active.add(this.blend.target);
  for(const key of active)this.times[key]+=dt*this.graph.players[key].rate;
  if(this.blend){const b=this.blend;b.time+=dt;const t=b.duration>0?Math.min(1,b.time/b.duration):1;for(const key in this.weights)this.weights[key]=b.start[key]*(1-t)+(key===b.target?t:0);if(t===1)this.blend=null;}
  this.sample();
 }
 sample(){for(const [key,action]of Object.entries(this.actions)){const row=this.graph.players[key],duration=action.getClip().duration;action.enabled=true;action.paused=true;action.time=row.loop&&duration>0?this.times[key]%duration:Math.min(this.times[key],duration);action.setEffectiveWeight(this.weights[key]);}this.mixer.update(0);}
 dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.root);}
}
