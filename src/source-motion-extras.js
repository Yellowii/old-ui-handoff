import * as THREE from 'three';
import {applyAdditivePose,generateAdditivePose} from './source-pose-additive.js';

export function motionExtrasReady(item,catalog){
  if(!item?.rule?.extra_model_infos?.length)return true;
  const row=catalog?.items?.[String(item.id)];
  const selected=row?.roles?.[item.animKey]||
    (row?.animKey===item.animKey?row:null);
  return selected?.status==='ready';
}

export function applySourceExtraAngle(root,angle){
  if(!Array.isArray(angle)||angle.length!==3||angle.some(value=>!Number.isFinite(Number(value))))throw new Error('附件角度配置无效');
  const radians=angle.map(value=>Number(value)*Math.PI/180);
  root.rotation.set(radians[0],radians[1],radians[2],'ZXY');
}

// ModelPlayAnimMgr's default NONE rule: appear once, then idle with zero
// transition duration. This is separate from the actor's 0.2-second blend.
export class SourceMotionExtra {
  constructor(root,clips,playback='appear-loop'){
    this.root=root;this.clips=clips;this.elapsed=0;this.phase='static';
    if(!clips.length)return;
    if(!(((playback==='appear-loop'||playback==='graph-open-idle')&&clips.length===2)||(['loop','single'].includes(playback)&&clips.length===1)))throw new Error('附件动画规则尚未接入');
    this.playback=playback;
    this.mixer=new THREE.AnimationMixer(root);
    this.actions=clips.map((clip,i)=>{
      const action=this.mixer.clipAction(clip);
      action.setLoop(playback==='loop'||i?THREE.LoopRepeat:THREE.LoopOnce,Infinity);
      action.clampWhenFinished=true;return action;
    });
    this.seek(0);
  }
  update(dt,rate=1,paused=false){if(!paused&&this.mixer)this.seek(this.elapsed+dt*rate);}
  seek(seconds){
    this.elapsed=Math.max(0,seconds);
    if(!this.mixer)return;
    if(this.playback==='loop'){
      if(this.phase!=='loop'){this.mixer.stopAllAction();this.actions[0].reset().play();this.phase='loop';}
      this.actions[0].time=this.clips[0].duration>0?this.elapsed%this.clips[0].duration:this.elapsed;
      this.mixer.update(0);return;
    }
    if(this.playback==='single'){
      if(this.phase!=='single'){this.mixer.stopAllAction();this.actions[0].reset().play();this.phase='single';}
      this.actions[0].time=Math.min(this.elapsed,this.clips[0].duration);this.mixer.update(0);return;
    }
    if(this.playback==='graph-open-idle'){
      const transitionStart=Math.max(0,this.clips[0].duration-.01),transitionEnd=transitionStart+.2;
      const phase=this.elapsed<transitionStart?'intro':this.elapsed<transitionEnd?'transition':'loop';
      if(this.phase!==phase){
        this.mixer.stopAllAction();
        if(phase==='intro')this.actions[0].reset().play();
        else if(phase==='transition'){this.actions[0].reset().play();this.actions[1].reset().play();}
        else this.actions[1].reset().play();
        this.phase=phase;
      }
      if(phase==='intro'){
        this.actions[0].time=this.elapsed;this.actions[0].setEffectiveWeight(1);
      }else if(phase==='transition'){
        const weight=(this.elapsed-transitionStart)/.2;
        this.actions[0].time=Math.min(this.elapsed,this.clips[0].duration);
        this.actions[1].time=this.elapsed-transitionStart;
        this.actions[0].setEffectiveWeight(1-weight);this.actions[1].setEffectiveWeight(weight);
      }else{
        const duration=this.clips[1].duration,time=this.elapsed-transitionStart;
        this.actions[1].time=duration>0?time%duration:time;this.actions[1].setEffectiveWeight(1);
      }
      this.mixer.update(0);return;
    }
    const intro=this.clips[0].duration,index=this.elapsed<intro?0:1,phase=index?'loop':'intro';
    if(this.phase!==phase){this.mixer.stopAllAction();this.actions[index].reset().play();this.phase=phase;}
    const duration=this.clips[index].duration,time=index?this.elapsed-intro:this.elapsed;
    this.actions[index].time=index&&duration>0?time%duration:time;
    this.mixer.update(0);
  }
  stop(){this.mixer?.stopAllAction();this.mixer?.uncacheRoot(this.root);}
}

const clamp=(value,low,high)=>Math.min(high,Math.max(low,value));
const modulo=(value,length)=>length>0?((value%length)+length)%length:0;

function clipSamplers(root,clip){
  return new Map(clip.tracks.map(track=>{
    const dot=track.name.lastIndexOf('.'),property=track.name.slice(dot+1);
    const target=root.getObjectByProperty('uuid',track.name.slice(0,dot));
    if(!target||!['position','quaternion','scale'].includes(property))throw new Error('叠加动画包含未支持的骨骼轨道');
    return [`${target.uuid}.${property}`,track.createInterpolant()];
  }));
}

function blendQuaternion(out,offset,first,second,weight){
  let dot=0;
  for(let i=0;i<4;i++)dot+=first[offset+i]*second[offset+i];
  const sign=dot<0?-1:1;
  let length=0;
  for(let i=0;i<4;i++){
    const value=first[offset+i]*(1-weight)+second[offset+i]*sign*weight;
    out[offset+i]=value;length+=value*value;
  }
  length=Math.sqrt(length)||1;
  for(let i=0;i<4;i++)out[offset+i]/=length;
}

// T173's danzai graph: AnimShow uses two 0.2-second transitions and applies the
// constant base_bskq-minus-base local pose after evaluating the selected clip.
export class SourceAdditiveMotionExtra {
  constructor(root,clips,graphClips){
    if(clips.length!==2||graphClips.length!==3)throw new Error('叠加附件动画图资源不完整');
    this.root=root;this.clips=clips;this.graphClips=graphClips;this.elapsed=0;
    this.samplers=[...clips,...graphClips].map(clip=>clipSamplers(root,clip));
    const reference=this.samplers[3],target=this.samplers[4],bones=new Map();
    for(const key of reference.keys()){
      if(!target.has(key))throw new Error('叠加姿态骨骼不匹配');
      const dot=key.lastIndexOf('.'),uuid=key.slice(0,dot),property=key.slice(dot+1),bone=root.getObjectByProperty('uuid',uuid);
      if(!bones.has(uuid))bones.set(uuid,{bone,properties:new Set()});
      bones.get(uuid).properties.add(property);
    }
    this.bindings=[...bones.values()];
    if(!this.bindings.length||this.bindings.some(({properties})=>properties.size!==3))throw new Error('叠加姿态缺少完整TRS');
    this.rest=new Float32Array(this.bindings.length*10);
    this.bindings.forEach(({bone},index)=>{
      const offset=index*10;
      bone.position.toArray(this.rest,offset);bone.quaternion.toArray(this.rest,offset+3);bone.scale.toArray(this.rest,offset+7);
    });
    const referencePose=this.samplePose(3,0),targetPose=this.samplePose(4,0);
    this.delta=generateAdditivePose(targetPose,referencePose);
    this.base=new Float32Array(this.rest.length);this.other=new Float32Array(this.rest.length);this.output=new Float32Array(this.rest.length);
    this.seek(0);
  }
  samplePose(index,time,out=new Float32Array(this.rest.length)){
    const samplers=this.samplers[index];out.set(this.rest);
    this.bindings.forEach(({bone},boneIndex)=>{
      const offset=boneIndex*10;
      const position=samplers.get(`${bone.uuid}.position`)?.evaluate(time);
      const quaternion=samplers.get(`${bone.uuid}.quaternion`)?.evaluate(time);
      const scale=samplers.get(`${bone.uuid}.scale`)?.evaluate(time);
      if(position)out.set(position,offset);if(quaternion)out.set(quaternion,offset+3);if(scale)out.set(scale,offset+7);
    });
    return out;
  }
  blend(first,second,weight,out){
    for(let offset=0;offset<out.length;offset+=10){
      for(let i=0;i<3;i++)out[offset+i]=first[offset+i]*(1-weight)+second[offset+i]*weight;
      blendQuaternion(out,offset+3,first,second,weight);
      for(let i=7;i<10;i++)out[offset+i]=first[offset+i]*(1-weight)+second[offset+i]*weight;
    }
    return out;
  }
  write(pose){
    this.bindings.forEach(({bone},index)=>{
      const offset=index*10;
      bone.position.fromArray(pose,offset);bone.quaternion.fromArray(pose,offset+3);bone.scale.fromArray(pose,offset+7);
    });
  }
  sample(){
    const introDuration=this.clips[0].duration;
    if(this.phase==='initial-transition'){
      this.samplePose(2,modulo(this.introTime,this.graphClips[0].duration),this.base);
      this.samplePose(0,this.introTime,this.other);
      this.blend(this.base,this.other,clamp(this.initialBlendTime/.2,0,1),this.base);
    }else if(this.phase==='intro')this.samplePose(0,this.introTime,this.base);
    else if(this.phase==='loop-transition'){
      this.samplePose(0,introDuration,this.base);this.samplePose(1,modulo(this.loopTime,this.clips[1].duration),this.other);
      this.blend(this.base,this.other,clamp(this.loopBlendTime/.2,0,1),this.base);
    }else this.samplePose(1,modulo(this.loopTime,this.clips[1].duration),this.base);
    applyAdditivePose(this.base,this.delta,1,this.output);this.write(this.output);
  }
  seek(seconds){
    this.elapsed=Math.max(0,seconds);this.introTime=Math.min(this.elapsed,this.clips[0].duration);
    this.initialBlendTime=Math.min(this.elapsed,.2);this.loopTime=Math.max(0,this.elapsed-this.clips[0].duration);
    this.loopBlendTime=Math.min(this.loopTime,.2);
    this.phase=this.elapsed<.2?'initial-transition':this.elapsed<this.clips[0].duration?'intro':this.loopTime<.2?'loop-transition':'loop';
    this.sample();
  }
  update(dt,rate=1,paused=false){
    if(paused||!(dt>0))return;
    const speed=Math.max(0,rate),advance=dt*speed;this.elapsed+=advance;
    this.initialBlendTime=Math.min(.2,this.initialBlendTime+dt);
    const priorIntro=this.introTime;this.introTime=Math.min(this.clips[0].duration,this.introTime+advance);
    const loopAdvance=Math.max(0,priorIntro+advance-this.clips[0].duration);
    if(loopAdvance>0||this.introTime>=this.clips[0].duration){
      this.loopTime+=loopAdvance;
      const wallAfterIntro=advance>0?dt*loopAdvance/advance:dt;
      this.loopBlendTime=Math.min(.2,this.loopBlendTime+wallAfterIntro);
    }
    this.phase=this.initialBlendTime<.2?'initial-transition':this.introTime<this.clips[0].duration?'intro':this.loopBlendTime<.2?'loop-transition':'loop';
    this.sample();
  }
  stop(){this.stopped=true;}
}
