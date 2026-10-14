import {Matrix4,Vector3} from 'three';
import {SourceChainSpring} from './source-chain-spring.js';

export class SourceChainSpringPlayer {
 constructor(root,config){
  if(config.version!==1||config.rule!=='legacy-type0-serial-no-wind-no-collision')throw Error('Unknown source chain rule');
  this.root=root;this.config=config;this.frames=0;this.maxOffset=0;this.bones=[];
  const visit=n=>{if(n!==root&&n.userData.sourceSubmodel)return;if(n.isBone&&config.paletteNames.includes(n.userData.sourceBone||n.name))this.bones.push({node:n,autoUpdate:n.matrixAutoUpdate});for(const child of n.children)visit(child);};visit(root);
  this.chains=config.chains.map(c=>({...c,nodes:c.bones.map(b=>{
   const matches=this.bones.filter(x=>(x.node.userData.sourceBone||x.node.name)===b.name);if(matches.length!==1)throw Error('Source spring chain binding differs');return matches[0].node;
  })}));
 }
 restore(){for(const b of this.bones){b.node.matrixAutoUpdate=b.autoUpdate;b.node.updateMatrix();}}
 update(dt){
  this.root.updateWorldMatrix(true,true);const scale=this.root.getWorldScale(new Vector3());const ownerScale=Math.abs(scale.x);if(!(ownerScale>0&&Number.isFinite(ownerScale)))throw Error('Invalid chain owner scale');
  // Native 2a00470 snapshots the authored model matrices once. Every chain
  // reads this same snapshot; 2c20f90 replaces only selected palette entries.
  const outputs=new Map(this.bones.map(b=>[b.node,b.node.matrixWorld.clone()]));
  for(const c of this.chains){
   const inputs=c.nodes.map(n=>n.matrixWorld.clone());
   if(!c.solver)c.solver=new SourceChainSpring({...c,speed:this.config.speed,idleFriction:this.config.idleFriction,scale:ownerScale},inputs);
   c.solver.config.scale=ownerScale;const matrices=c.solver.step(inputs,dt);
   matrices.forEach((m,i)=>{this.maxOffset=Math.max(this.maxOffset,new Vector3().setFromMatrixPosition(m).distanceTo(new Vector3().setFromMatrixPosition(inputs[i])));outputs.set(c.nodes[i],m);});
  }
  for(const {node} of this.bones){node.matrix.copy(new Matrix4().copy(node.parent.matrixWorld).invert().multiply(outputs.get(node)));node.matrixAutoUpdate=false;node.updateMatrixWorld(true);}
  // Keep authored TRS untouched: SourcePartPose restores those after render.
  // Decomposing here would feed a physics/add-pose result back into animation.
  this.frames++;
 }
 state(){return {modelId:this.root.userData.modelId,chains:this.chains.length,bones:this.chains.reduce((n,c)=>n+c.nodes.length,0),frames:this.frames,maxOffset:this.maxOffset,finite:this.bones.every(b=>b.node.matrix.elements.every(Number.isFinite))};}
 dispose(){this.restore();this.bones.length=0;this.chains.length=0;}
}
