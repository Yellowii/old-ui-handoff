import * as THREE from 'three';
import {calculateAnimationStart} from './source-animation-start.js';

const clamp01=value=>Math.min(1,Math.max(0,value));
const modulo=(value,length)=>length>0?((value%length)+length)%length:0;

function clipSamplers(clip){
  return new Map(clip.tracks.map(track=>[track.name,track.createInterpolant()]));
}

function poseValue(samplers,bone,property,time){
  const value=samplers.get(`${bone.uuid}.${property}`)?.evaluate(time);
  return value||bone.userData.motionRest?.[property]||bone[property].toArray();
}

function normalized(values){
  return new THREE.Quaternion(values[0],values[1],values[2],values[3]).normalize();
}

function nlerpQuaternion(first,second,weight){
  const sign=first.dot(second)<0?-1:1;
  return new THREE.Quaternion(
    first.x*(1-weight)+second.x*sign*weight,
    first.y*(1-weight)+second.y*sign*weight,
    first.z*(1-weight)+second.z*sign*weight,
    first.w*(1-weight)+second.w*sign*weight,
  ).normalize();
}

function lerpValues(first,second,weight){
  return first.map((value,index)=>value*(1-weight)+second[index]*weight);
}

// The danzai graph blends the overlay from biped spine downward and requests
// component-space rotation blending. Translation and scale remain local-space.
export class SourceOverlayMotion{
  constructor(actor,baseClip,overlayInput,rule,{baseTime=0,baseRate=1}={}){
    const clips=Array.isArray(overlayInput)?overlayInput:[overlayInput];
    const expected=rule?.anim_type===2?2:[0,1].includes(rule?.anim_type)?1:0;
    if(rule?.anim_layer!==1||rule.use_independent_node||clips.length!==expected)
      throw new Error('此分层动作的图规则尚未接入');
    this.actor=actor;this.baseClip=baseClip;this.overlayClip=clips[0];this.clips=clips;this.rule=rule;
    this.controllerType='SourceOverlayMotion';
    this.baseSamplers=clipSamplers(baseClip);this.overlaySamplers=clips.map(clipSamplers);
    this.sourceSpeed=Math.max(0,Number(rule.anim_play_speed??1));this.baseRate=Math.max(0,Number(baseRate)||0);
    this.baseTime=modulo(Math.max(0,baseTime),baseClip.duration);this.overlayTime=0;
    this.sequencePhase=rule.anim_type===2?'intro':null;this.introTime=0;this.loopTime=0;this.sequenceBlendTime=0;this.finished=false;
    this.elapsed=0;this.blendTime=rule.blend_immediately ? .2 : 0;this.fullBodyBlendTime=0;this.paused=false;this.rate=1;
    this.bones=[];this.bonesByObject=new Set();
    actor.traverse(node=>{if(node.isBone){this.bones.push(node);this.bonesByObject.add(node);}});
    const spine=this.bones.find(node=>(node.userData.sourceBone||node.name)==='biped spine');
    if(!spine)throw new Error('当前骨骼缺少上身分层根节点：biped spine');
    this.upperBones=new Set();spine.traverse(node=>{if(node.isBone)this.upperBones.add(node);});
    this.phase=this.blendTime>=.2&&!rule.upper_cover_idle?'loop':'transition';this.sample();
  }
  update(dt){
    if(this.paused||!(dt>0))return;
    this.baseTime=modulo(this.baseTime+dt*this.baseRate,this.baseClip.duration);
    const advance=dt*this.sourceSpeed*this.rate;
    if(this.rule.anim_type===2){
      if(this.sequencePhase==='intro'){
        this.introTime=Math.min(this.clips[0].duration,this.introTime+advance);
        if(this.clips[0].duration-this.introTime<.01){this.sequencePhase='transition';this.sequenceBlendTime=0;this.loopTime=0;}
      }else{
        this.loopTime=modulo(this.loopTime+advance,this.clips[1].duration);
        if(this.sequencePhase==='transition'){
          this.introTime=Math.min(this.clips[0].duration,this.introTime+advance);
          this.sequenceBlendTime+=dt;if(this.sequenceBlendTime>=.2)this.sequencePhase='loop';
        }
      }
    }else if(this.rule.anim_type===0){
      this.overlayTime=Math.min(this.overlayTime+advance,this.overlayClip.duration);
      if(this.overlayTime>=this.overlayClip.duration&&Number(this.rule.auto_stop)===1)this.finished=true;
    }else this.overlayTime=modulo(this.overlayTime+advance,this.overlayClip.duration);
    this.elapsed+=dt;
    if(this.blendTime<.2)this.blendTime=Math.min(.2,this.blendTime+dt);
    if(this.rule.upper_cover_idle)this.fullBodyBlendTime=Math.min(.4,Math.max(0,this.elapsed-(this.rule.blend_immediately?0:.1)));
    if(this.blendTime>=.2&&(!this.rule.upper_cover_idle||this.fullBodyBlendTime>=.4))this.phase='loop';
    this.sample();
  }
  seek(time){
    if(this.rule.anim_type===2){
      const start=calculateAnimationStart(this.rule,Math.max(0,time),name=>this.clips[this.rule.anim_names.indexOf(name)].duration);
      this.sequencePhase=start.animType===2?'intro':'loop';this.introTime=this.sequencePhase==='intro'?start.startTime:this.clips[0].duration;
      this.loopTime=this.sequencePhase==='loop'?start.startTime:0;this.sequenceBlendTime=0;
    }else if(this.rule.anim_type===0)this.overlayTime=Math.min(Math.max(0,time),this.overlayClip.duration);
    else this.overlayTime=modulo(Math.max(0,time),this.overlayClip.duration);
    this.finished=false;
    this.blendTime=.2;this.fullBodyBlendTime=this.rule.upper_cover_idle ? .4 : 0;this.phase='loop';this.sample();
  }
  sample(){
    const weight=clamp01(this.blendTime/.2),fullBodyWeight=this.rule.upper_cover_idle?clamp01(this.fullBodyBlendTime/.4):0;
    const baseLocal=new Map(),overlayLocal=new Map(),basePoseLocal=new Map();
    for(const bone of this.bones){
      baseLocal.set(bone,{
        position:poseValue(this.baseSamplers,bone,'position',this.baseTime),
        quaternion:normalized(poseValue(this.baseSamplers,bone,'quaternion',this.baseTime)),
        scale:poseValue(this.baseSamplers,bone,'scale',this.baseTime),
      });
      const overlay={};
      for(const property of ['position','quaternion','scale']){
        if(this.rule.anim_type!==2)overlay[property]=property==='quaternion'?normalized(poseValue(this.overlaySamplers[0],bone,property,this.overlayTime)):poseValue(this.overlaySamplers[0],bone,property,this.overlayTime);
        else{
          const first=poseValue(this.overlaySamplers[0],bone,property,this.introTime),second=poseValue(this.overlaySamplers[1],bone,property,this.loopTime);
          const sequenceWeight=this.sequencePhase==='intro'?0:this.sequencePhase==='loop'?1:clamp01(this.sequenceBlendTime/.2);
          overlay[property]=property==='quaternion'?nlerpQuaternion(normalized(first),normalized(second),sequenceWeight):lerpValues(first,second,sequenceWeight);
        }
      }
      overlayLocal.set(bone,overlay);
      const base=baseLocal.get(bone),overlayPose=overlayLocal.get(bone);
      basePoseLocal.set(bone,{
        position:lerpValues(base.position,overlayPose.position,fullBodyWeight),
        quaternion:nlerpQuaternion(base.quaternion,overlayPose.quaternion,fullBodyWeight),
        scale:lerpValues(base.scale,overlayPose.scale,fullBodyWeight),
      });
    }
    const baseComponent=new Map(),overlayComponent=new Map(),outputComponent=new Map();
    for(const bone of this.bones){
      const parent=this.bonesByObject.has(bone.parent)?bone.parent:null;
      const base=basePoseLocal.get(bone),overlay=overlayLocal.get(bone);
      const baseWorld=parent?baseComponent.get(parent).clone().multiply(base.quaternion):base.quaternion.clone();
      const overlayWorld=parent?overlayComponent.get(parent).clone().multiply(overlay.quaternion):overlay.quaternion.clone();
      baseComponent.set(bone,baseWorld);overlayComponent.set(bone,overlayWorld);
      const upper=this.upperBones.has(bone),world=upper?nlerpQuaternion(baseWorld,overlayWorld,weight):baseWorld.clone();
      outputComponent.set(bone,world);
      if(upper){
        const p=lerpValues(base.position,overlay.position,weight);
        const s=lerpValues(base.scale,overlay.scale,weight);
        bone.position.fromArray(p);bone.scale.fromArray(s);
      }else{bone.position.fromArray(base.position);bone.scale.fromArray(base.scale);}
      bone.quaternion.copy(parent?outputComponent.get(parent).clone().invert().multiply(world):world);
    }
  }
  stop(){this.elapsed=0;this.blendTime=0;this.fullBodyBlendTime=0;this.phase='transition';this.sample();}
  get duration(){return this.rule.anim_type===2?this.clips[0].duration+this.clips[1].duration:this.overlayClip.duration;}
  get time(){return this.rule.anim_type===2?(this.sequencePhase==='intro'?this.introTime:this.clips[0].duration+this.loopTime):this.overlayTime;}
}
