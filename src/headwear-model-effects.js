import * as THREE from 'three';
import {compileSourceModelSfxControllers} from './source-model-sfx-controllers.js';
import {sourceSfxTransformMatrix} from './source-sfx-controller.js';
import {createSourceSfxFloatCurve,sourceSfxShaderPhase} from './source-sfx-curves.js';
import {createSourceSfxMaterialBinding} from './source-sfx-material-bindings.js';

import {requestJSON} from './handoff/services.js';
import {isReviewedEffect} from './handoff/runtime-contracts.js';

const PROFILE='source-headwear-model-curves-v1';
let registry;
const resources=()=>registry??=requestJSON('/data/headwear-model-effects.json').then(r=>{if(!r.ok)throw Error('头饰模型特效目录缺失');return r.json();}).catch(e=>{registry=null;throw e;});

export function compileHeadwearModelEffect(effect){
 if(effect.profile!==PROFILE||!isReviewedEffect(PROFILE,effect))throw Error('Unreviewed headwear Model effect; provide runtimePolicy.reviewedEffects');
 const nodes=effect.orderedNodes,node=nodes.find(n=>/^FxGroup\/Model\[\d+\]$/.test(n.path));
 if(!node||node.attributes.DirType!=='2'||node.attributes.FxStartTime!=='0.0'||node.attributes.InheritEndLessPlay!=='true')throw Error('Unreviewed Model lifecycle');
 const scale=nodes.find(n=>n.path.startsWith(node.path+'/ScaleFrame[')),uniforms=nodes.find(n=>n.path.startsWith(node.path+'/ShaderComponent[')&&/\/Uniforms\[\d+\]$/.test(n.path));
 if(!scale||!uniforms)throw Error('Missing original Model curves');
 return {controllerPath:node.path,scale:createSourceSfxFloatCurve(scale),uniformsPath:uniforms.path,lifespan:Number(node.attributes.FxLifeSpan),runtime:compileSourceModelSfxControllers(effect)};
}

export async function attachHeadwearModelEffects(root,desc,loadModel){
 const data=await resources();if(data.version!==1||data.profile!==PROFILE)throw Error('头饰模型特效目录版本不受支持');
 const host=data.models[desc.id];if(!host)return;
 if(host.source.sha256!==desc.sourceBounds?.source?.sha256)throw Error('头饰特效来源已变化，请重新生成');
 const active=[];
 for(const entry of host.entries){
  const socket=root.getObjectByName(entry.socket);if(!socket?.userData.sourceSocket)throw Error('头饰原挂点缺失：'+entry.socket);
  const effect=data.effects[entry.path],compiled=compileHeadwearModelEffect(effect),loaded=await loadModel(effect.modelId),node=loaded.root;
  node.matrixAutoUpdate=false;node.name='source-headwear-model-effect';socket.add(node);
  const materials=new Set();node.traverse(n=>{if(n.isMesh)for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);});
  for(const m of materials)if(m.userData.adapter!=='source-splendor-gl-channels'||typeof m.userData.uniforms?.setSourceParameters!=='function')throw Error('头饰特效模型材质未适配');
  const parameters={};
  const binding=createSourceSfxMaterialBinding(effect.orderedNodes,compiled.uniformsPath,{setParameters(changes){for(const m of materials)m.userData.uniforms.setSourceParameters(changes);Object.assign(parameters,changes);}});
  active.push({...compiled,node,binding,path:entry.path,socket:entry.socket,parameters,scaleValue:0});
 }
 const state={elapsed:0,active,pending:host.pending,update(dt){
  if(!Number.isFinite(dt)||dt<0)throw Error('Invalid Model effect delta');
  this.elapsed=Math.fround(this.elapsed+Math.fround(dt));
  for(const item of active){
   item.runtime.update(dt);
   // Model scale2b718a4 consumes time/lifespan without modulo or clamping.
   const phase=sourceSfxShaderPhase(this.elapsed,item.lifespan);item.scaleValue=item.scale(phase);
   const transform=item.runtime.controllers.get(item.controllerPath).world;
   item.node.matrix.fromArray(sourceSfxTransformMatrix(transform)).scale(new THREE.Vector3().setScalar(item.scaleValue));item.node.matrixWorldNeedsUpdate=true;
   item.binding.update(this.elapsed,item.lifespan);
   item.node.visible=this.elapsed>0;
  }
 }};
 state.update(0);root.userData.headwearModelEffects=state;
}
