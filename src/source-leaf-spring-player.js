import {Matrix4,Vector3} from 'three';
import {SourceLeafSpring} from './source-leaf-spring.js';

export class SourceLeafSpringPlayer{
 constructor(root,config){
  if(config.version!==1||config.rule!=='legacy-type0-leaf-no-wind-no-collision')throw Error('Unknown leaf spring rule');
  this.root=root;this.config=config;this.frames=0;this.maxOffset=0;
  this.bones=config.bones.map(c=>{
   const matches=[];root.traverse(n=>{if(n.isBone&&n.name===c.name)matches.push(n);});
   if(matches.length!==1||matches[0].children.some(n=>n.isBone))throw Error('Source leaf spring bone binding differs');
   const node=matches[0];return {node,autoUpdate:node.matrixAutoUpdate,config:c,authored:{position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone()}};
  });
 }
 restore(){for(const b of this.bones){b.node.position.copy(b.authored.position);b.node.quaternion.copy(b.authored.quaternion);b.node.scale.copy(b.authored.scale);b.node.matrixAutoUpdate=b.autoUpdate;b.node.updateMatrix();}}
 update(dt){
  this.root.updateWorldMatrix(true,true);const scale=this.root.getWorldScale(new Vector3());scale.set(Math.abs(scale.x),Math.abs(scale.y),Math.abs(scale.z));this.ownerScale=scale.toArray();
  if(!scale.toArray().every(x=>Number.isFinite(x)&&x>0))throw Error('Invalid leaf spring owner scale');
  for(const b of this.bones){
   b.authored.position.copy(b.node.position);b.authored.quaternion.copy(b.node.quaternion);b.authored.scale.copy(b.node.scale);
   if(!b.solver){b.solver=new SourceLeafSpring({...b.config,scale:scale.x,idleFriction:this.config.idleFriction,speed:this.config.speed},b.node.matrixWorld,1);}
   b.solver.config.scale=scale.x;
   if(dt<=0)continue;
   const output=b.solver.step(b.node.matrixWorld,dt),local=new Matrix4().copy(b.node.parent.matrixWorld).invert().multiply(output);
   local.decompose(b.node.position,b.node.quaternion,b.node.scale);this.maxOffset=Math.max(this.maxOffset,b.node.position.distanceTo(b.authored.position));b.node.matrix.copy(local);b.node.matrixAutoUpdate=false;b.node.updateMatrixWorld(true);
  }
  if(dt>0)this.frames++;
 }
 state(){return {modelId:this.root.userData.modelId,chains:this.bones.length,frames:this.frames,maxOffset:this.maxOffset,ownerScale:this.ownerScale,finite:this.bones.every(b=>[...b.node.position,...b.node.quaternion,...b.node.scale].every(Number.isFinite))};}
 dispose(){this.restore();this.bones.length=0;}
}
