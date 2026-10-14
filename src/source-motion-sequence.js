import {calculateAnimationStart} from './source-animation-start.js';
import {belongsToModel} from './source-submodel.js';

const clamp=(value,low,high)=>Math.min(high,Math.max(low,value));
const modulo=(value,length)=>length>0?((value%length)+length)%length:0;

export function bindMotionClip(gltf,actor){
  const clip=gltf.animations[0]?.clone();
  if(!clip)throw new Error('动作轨道缺失');
  const bones=new Map(),bindings=new Map();
  actor.traverse(n=>{if(n.isBone&&belongsToModel(n,actor))bones.set(n.userData.sourceBone||n.name,n);});
  gltf.scene.traverse(n=>{if(n.userData.sourceBone)bindings.set(n.name,n.userData.sourceBone);});
  clip.tracks=clip.tracks.filter(track=>{
    const dot=track.name.lastIndexOf('.'),target=bones.get(bindings.get(track.name.slice(0,dot)));
    if(!target)return false;
    track.name=target.uuid+track.name.slice(dot);return true;
  });
  if(!clip.tracks.length)throw new Error('动作与当前骨骼不兼容');
  return clip;
}

export function resolveSequenceEntries(item,rows){
  const rule=item?.rule;
  if(rule?.anim_type!==2||![0,1].includes(rule.anim_layer)||rule.use_independent_node||rule.anim_names?.length!==2)
    throw new Error('此动作的编排规则尚未接入');
  return rule.anim_names.map(name=>{
    const row=rows.find(r=>r.name===name);
    if(row?.status!=='ready'||!row.url)throw new Error(`动作片段未就绪：${name}`);
    return row;
  });
}

export function resolveMotionEntries(item,rows){
  const rule=item?.rule;
  if(rule?.anim_type===2)return resolveSequenceEntries(item,rows);
  const base=[0,1].includes(rule?.anim_type)&&rule.anim_layer===0;
  const overlay=[0,1].includes(rule?.anim_type)&&rule.anim_layer===1;
  if((!base&&!overlay)||rule.use_independent_node||rule.anim_names?.length!==1)
    throw new Error('此动作的编排规则尚未接入');
  const name=rule.anim_names[0],row=rows.find(entry=>entry.name===name);
  if(row?.status!=='ready'||!row.url)throw new Error(`动作片段未就绪：${name}`);
  return [row];
}

export function sourceMotionRepeats(rule){
  if(rule?.anim_type===0)return false;
  if(rule?.anim_type===1)return true;
  throw new Error('此动作的循环规则尚未接入');
}

// T159 original BASE SINGLE_LOOP graph and T161 StandardBlendTransitionEffect.
// Clip clocks use animation speed; the transition's 0.2 seconds use context dt.
export class SourceMotionSequence{
  constructor(actor,clips,rule){
    this.clips=clips;this.rule=rule;this.paused=false;this.rate=1;
    this.sourceSpeed=Math.max(0,Number(rule.anim_play_speed??1));
    this.bindings=new Map();
    this.samplers=clips.map(clip=>new Map(clip.tracks.map(track=>{
      const dot=track.name.lastIndexOf('.'),property=track.name.slice(dot+1);
      const target=actor.getObjectByProperty('uuid',track.name.slice(0,dot));
      if(!target||!['position','quaternion','scale'].includes(property))throw new Error('编排包含未支持的骨骼轨道');
      if(!this.bindings.has(track.name))this.bindings.set(track.name,{target,property,
        rest:target.userData.motionRest?.[property]||target[property].toArray()});
      return [track.name,track.createInterpolant()];
    })));
    this.seek(0);
  }
  seek(time){
    const start=calculateAnimationStart(this.rule,Math.max(0,time),name=>this.clips[this.rule.anim_names.indexOf(name)].duration);
    this.phase=start.animType===2?'intro':'loop';
    this.introTime=this.phase==='intro'?start.startTime:this.clips[0].duration;
    this.loopTime=this.phase==='loop'?start.startTime:0;this.blendTime=0;this.sample();
  }
  update(dt){
    if(this.paused||!(dt>0))return;
    const advance=dt*this.sourceSpeed*this.rate;
    if(this.phase==='intro'){
      this.introTime=Math.min(this.clips[0].duration,this.introTime+advance);
      if(this.clips[0].duration-this.introTime<0.01){this.phase='transition';this.blendTime=0;this.loopTime=0;}
    }else{
      this.loopTime=modulo(this.loopTime+advance,this.clips[1].duration);
      if(this.phase==='transition'){
        this.introTime=Math.min(this.clips[0].duration,this.introTime+advance);
        this.blendTime+=dt;if(this.blendTime>=0.2)this.phase='loop';
      }
    }
    this.sample();
  }
  sample(){
    const weight=this.phase==='intro'?0:this.phase==='loop'?1:clamp(this.blendTime/0.2,0,1);
    for(const [name,{target,property,rest}] of this.bindings){
      const first=this.samplers[0].get(name)?.evaluate(this.introTime)||rest;
      const second=this.samplers[1].get(name)?.evaluate(this.loopTime)||rest;
      if(property==='quaternion'){
        const sign=first.reduce((sum,v,i)=>sum+v*second[i],0)<0?-1:1;
        target.quaternion.set(...Array.from(first,(v,i)=>v*(1-weight)+second[i]*sign*weight)).normalize();
      }else target[property].set(...Array.from(first,(v,i)=>v*(1-weight)+second[i]*weight));
    }
  }
  get duration(){return this.clips[0].duration+this.clips[1].duration;}
  get time(){return this.phase==='intro'?this.introTime:this.clips[0].duration+this.loopTime;}
}
