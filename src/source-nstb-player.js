import {Matrix4,Vector3} from 'three';
import {SourceNstbChain} from './source-nstb-chain.js';

export class SourceNstbPlayer {
 constructor(root,config){
  if(config.version!==1||!['nstb-serial-no-wind-no-angular-no-collision','nstb-serial-spatial-v1'].includes(config.rule))throw Error('Unknown source chain rule');
  this.root=root;this.config=config;this.frames=0;this.maxOffset=0;this.bones=[];
  const visit=n=>{if(n!==root&&n.userData.sourceSubmodel)return;if(n.isBone&&config.paletteNames.includes(n.userData.sourceBone||n.name))this.bones.push({node:n,autoUpdate:n.matrixAutoUpdate});for(const child of n.children)visit(child);};visit(root);
  this.chains=config.chains.map(c=>({...c,nodes:c.bones.map(b=>{
   const matches=this.bones.filter(x=>(x.node.userData.sourceBone||x.node.name)===b.bone_name);if(matches.length!==1)throw Error('Source NSTB chain binding differs');return matches[0].node;
  })}));
  this.spatialConstraints=(config.spatialConstraints||[]).map(config=>{
   const matches=this.bones.filter(x=>(x.node.userData.sourceBone||x.node.name)===config.binded_bone_name);
   if(matches.length!==1)throw Error('Source spatial bone binding differs');
   return {config,node:matches[0].node};
  });this.contacts=0;
 }
 restore(){for(const b of this.bones){b.node.matrixAutoUpdate=b.autoUpdate;b.node.updateMatrix();}}
 update(dt,distanceSquared=0){
  // 2c48c08 compares squared scene distance; 2c48d7c reseeds on re-entry.
  // The isolated appearance preview supplies near distance (0). Scene callers
  // must supply their original observer distance, not an inferred camera value.
  if(!Number.isFinite(distanceSquared)||distanceSquared<0)throw Error('Invalid NSTB distance');
  this.distanceCulled=distanceSquared>=(this.config.updateDistanceSquared??Infinity);
  if(this.distanceCulled){this.restore();for(const c of this.chains)c.solver=null;return;}
  this.root.updateWorldMatrix(true,true);const scale=this.root.getWorldScale(new Vector3());const ownerScale=Math.abs(scale.x);if(!(ownerScale>0&&Number.isFinite(ownerScale)))throw Error('Invalid chain owner scale');
  // Native 2c48eb8 reads the authored model matrices once. Every chain
  // reads this same snapshot; 2c20f90 replaces only selected palette entries.
  const outputs=new Map(this.bones.map(b=>[b.node,b.node.matrixWorld.clone()]));
  for(const c of this.chains){
   const inputs=c.nodes.map(n=>n.matrixWorld.clone());
   if(!c.solver)c.solver=new SourceNstbChain({...c,speed:this.config.speed,steps:this.config.steps,gravity:c.parameters.use_override_gravity?c.parameters.override_gravity:this.config.gravity,modelSpaceGravity:this.config.modelSpaceGravity});
   const spatialInputs=this.spatialConstraints.filter(s=>s.config.chain_influenced===c.parameters.chain_name).map(s=>({config:s.config,boneMatrix:s.node.matrixWorld.elements}));
   const result=c.solver.step(inputs.map(m=>m.elements),dt,ownerScale,this.root.matrixWorld.elements,spatialInputs);this.contacts+=result.contacts;
   const matrices=result.matrices.map(m=>new Matrix4().fromArray(m));
   matrices.forEach((m,i)=>{this.maxOffset=Math.max(this.maxOffset,new Vector3().setFromMatrixPosition(m).distanceTo(new Vector3().setFromMatrixPosition(inputs[i])));outputs.set(c.nodes[i],m);});
  }
  for(const {node} of this.bones){node.matrix.copy(new Matrix4().copy(node.parent.matrixWorld).invert().multiply(outputs.get(node)));node.matrixAutoUpdate=false;node.updateMatrixWorld(true);}
  // Keep authored TRS untouched: SourcePartPose restores those after render.
  // Decomposing here would feed a physics/add-pose result back into animation.
  this.frames++;
 }
 state(){return {modelId:this.root.userData.modelId,chains:this.chains.length,bones:this.chains.reduce((n,c)=>n+c.nodes.length,0),frames:this.frames,spatialConstraints:this.spatialConstraints.length,contacts:this.contacts,distanceCulled:!!this.distanceCulled,maxOffset:this.maxOffset,finite:this.bones.every(b=>b.node.matrix.elements.every(Number.isFinite))};}
 dispose(){this.restore();this.bones.length=0;this.chains.length=0;}
}
