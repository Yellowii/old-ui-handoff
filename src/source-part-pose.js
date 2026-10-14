import {generateAdditivePose,applyAdditivePose} from './source-pose-additive.js';

// CharAnimationUtils + the source multi_base_replace graph, type 1.
// Rendering temporarily applies the constant local offset. Animation mixers,
// seeking and paused frames always retain their original unmodified pose.
export class SourcePartPose {
  constructor(root,clips,selected,roots) {
    this.bones=[];root.traverse(n=>{if(n.isBone)this.bones.push(n);});
    const maps=Object.fromEntries(Object.entries(clips).map(([name,clip])=>[name,new Map(clip.tracks.map(t=>[t.name,t.createInterpolant()]))]));
    const targetByBone=new Map();
    for(const slot of ['lower','upper','hair']){
      const branch=this.bones.find(n=>(n.userData.sourceBone||n.name)===roots[slot]);
      if(!branch)throw new Error('分部姿势缺少源分层骨骼');
      branch.traverse(n=>{if(n.isBone)targetByBone.set(n,selected[slot]||'base_replace');});
    }
    this.bones=this.bones.filter(n=>targetByBone.has(n));
    const reference=new Float32Array(this.bones.length*10),target=new Float32Array(reference.length);
    this.bones.forEach((bone,i)=>{
      for(const [property,offset,size] of [['position',0,3],['quaternion',3,4],['scale',7,3]]){
        // Restored source parents outside the compressed track palette keep
        // their authored rest TRS, as in the existing animation samplers.
        const key=`${bone.uuid}.${property}`,rest=bone[property].toArray(),r=maps.base.get(key)?.evaluate(0)||rest,t=maps[targetByBone.get(bone)]?.get(key)?.evaluate(0)||rest;
        if(!r||!t||r.length!==size||t.length!==size)throw new Error('分部姿势源轨道不完整');
        reference.set(r,i*10+offset);target.set(t,i*10+offset);
      }
    });
    this.delta=generateAdditivePose(target,reference);this.base=new Float64Array(reference.length);this.output=new Float32Array(reference.length);this.active=false;
  }
  write(pose){this.bones.forEach((bone,i)=>{bone.position.fromArray(pose,i*10);bone.quaternion.fromArray(pose,i*10+3);bone.scale.fromArray(pose,i*10+7);});}
  apply(){
    if(this.active)throw new Error('分部姿势不能重复累加');
    this.bones.forEach((bone,i)=>{bone.position.toArray(this.base,i*10);bone.quaternion.toArray(this.base,i*10+3);bone.scale.toArray(this.base,i*10+7);});
    applyAdditivePose(this.base,this.delta,1,this.output);this.write(this.output);this.active=true;
  }
  restore(){if(this.active){this.write(this.base);this.active=false;}}
}
