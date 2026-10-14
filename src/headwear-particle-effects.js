import * as THREE from 'three';
import {compileSourceSfxPolyProfile} from './source-sfx-poly.js';
import {compileSourceModelSfxControllers} from './source-model-sfx-controllers.js';
import {sourceSfxInheritTransform,sourceSfxTransformMatrix,createSourceSfxPolyTransformBindings} from './source-sfx-controller.js';
import {initializeSourceSfxPolyStorage} from './source-sfx-poly-initialize.js';
import {createSourceSfxPolySpawnBatch} from './source-sfx-spawn.js';
import {sourceSfxTickEmitter} from './source-sfx-emitter.js';
import {sourceSfxDistanceFade} from './source-sfx-node.js';
import {createSourceSfxFloatCurve,createSourceSfxPackedColorCurve} from './source-sfx-curves.js';
import {sourceSfxParticleQuad} from './source-sfx-particle-quad.js';
import {sourceSfxParticleAtlasTime,sourceSfxAtlasFrameIndex} from './source-sfx-atlas.js';
import {createFashionParticleMaterial} from './fashion-particle-effects.js';

import {requestJSON} from './handoff/services.js';
import {isReviewedEffect} from './handoff/runtime-contracts.js';

export const HEADWEAR_PARTICLE_PROFILE='source-headwear-cone-particles-v1';
const f=Math.fround,parent=p=>p.slice(0,p.lastIndexOf('/')),kind=n=>n.path.split('/').at(-1).replace(/\[\d+\]$/,'');
let registry;
const resources=()=>registry??=requestJSON('/data/headwear-particle-effects.json').then(r=>{if(!r.ok)throw Error('头饰粒子目录缺失');return r.json();}).catch(e=>{registry=null;throw e;});
function sourceTRS(matrix){
 const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();matrix.decompose(p,q,s);const r=new THREE.Matrix4().makeRotationFromQuaternion(q).elements;
 return {translation:p.toArray().map(f),scale:s.toArray().map(f),rotation:[...r.slice(0,3),...r.slice(4,7),...r.slice(8,11)].map(f),flags:2};
}
export function compileHeadwearParticles(data,effect){
 if(!isReviewedEffect(HEADWEAR_PARTICLE_PROFILE,effect))throw Error('Unreviewed headwear particles; provide runtimePolicy.reviewedEffects');
 const nodes=effect.orderedNodes,runtime=compileSourceModelSfxControllers({...effect,orderedNodes:effect.orderedNodes.filter(n=>!(effect.ignoredRoots||effect.ignoredNodes||[]).some(p=>n.path===p||n.path.startsWith(p+'/')))});
 const particles=effect.particles.map(spec=>{
  const n=nodes.find(n=>n.path===spec.path),a=n.attributes,p=compileSourceSfxPolyProfile(nodes,n.path);
  for(const [k,v] of Object.entries({DirType:'0',ColorType:'1',SoftSprite:'false',TextureClockRotate:'0',TextureFlip:'false',InheritEndLessPlay:'true',EnableZBuffer:'true',FxIgnore:'false',FxStartTime:'0.0',SpinAxis:'[0.0, 0.0, 0.0]',IsDerive:'false',BindBonesHead:'false'}))if(a[k]!==v)throw Error('Unreviewed headwear particle '+k);
  if(![1,2].includes(p.actionMode)||![0,3].includes(p.config.emissionType)||!['0','2'].includes(a.BlendMode)||p.start!==0)throw Error('Unreviewed headwear particle mode');
  const child=name=>{const n=nodes.find(n=>parent(n.path)===spec.path&&kind(n)===name);if(!n)throw Error('Missing particle '+name);return n;};
  const color=child('ColorFramePar'),packed=createSourceSfxPackedColorCurve({...color,frames:color.frames.map(k=>{const c=JSON.parse(k.Value);if(c.length!==4||c.some(x=>!Number.isInteger(x)||x<0||x>255))throw Error('ARGB source bytes required');return {...k,Value:((c[0]<<24)|(c[1]<<16)|(c[2]<<8)|c[3])>>>0};})});
  const grey=nodes.find(n=>n.path.startsWith(spec.path+'/ShaderComponent[')&&kind(n)==='greycolor_Keyframe');
  if(grey&&(grey.frames.length!==1||Number(grey.frames[0].Value)!==f(-.2)))throw Error('Unreviewed headwear greycolor');
  const atlas=data.atlases.find(t=>t.path===p.texturePath),paths=atlas?[...new Set(Object.values(atlas.images))]:[p.texturePath];if(paths.length!==1)throw Error('Multi-image particle atlas not connected');
  const image=data.images.find(i=>i.path===paths[0]);if(image?.publicationStatus!=='published')throw Error('Original particle image missing');
  return {path:n.path,original:runtime.controllers.get(n.path),profile:p,atlas,image,color:packed,width:createSourceSfxFloatCurve(child('SpriteScaleFrame')),height:createSourceSfxFloatCurve(child(a.ScaleStyle==='0'?'HWRatioFrame':'SpriteHeightFrame')),scaleStyle:Number(a.ScaleStyle),alongMove:a.AlongMoveDir==='true',render:{greyColor:grey?Number(grey.frames[0].Value):0,multiply:1,blendMode:Number(a.BlendMode)},renderBias:Math.max(-15,Math.min(16,Number(a.RenderBias)))};
 });
 return {runtime,particles};
}

// Viewer policy: authored capacity at full quality, fresh shared RNG per SFX.
// Source spawn, atlas, motion and pre-emission all use that same stream.
export async function attachHeadwearParticleEffects(root,desc,loadTexture,{sourceWorld,seed}={}){
 const data=await resources();if(data.version!==1||data.profile!==HEADWEAR_PARTICLE_PROFILE)throw Error('头饰粒子目录版本不受支持');
 const host=data.models[desc.id];if(!host)return;
 if(host.source.sha256!==desc.sourceBounds?.source?.sha256)throw Error('头饰粒子来源已变化，请重新生成');
 if(!sourceWorld?.isObject3D)throw Error('Original particle scene root required');
 const groups=[];
 for(const entry of host.entries){
  const socket=root.getObjectByName(entry.socket);if(!socket?.userData.sourceSocket)throw Error('头饰粒子原挂点缺失');
  const effect=data.effects[entry.path],compiled=compileHeadwearParticles(data,effect),group=new THREE.Group();group.name='source-headwear-particles';group.matrixAutoUpdate=false;root.add(group);
  const stream={seed:seed??crypto.getRandomValues(new Uint32Array(1))[0]},budget={requested:0,dropped:0},systems=[],transforms=createSourceSfxPolyTransformBindings({getController:n=>n.controller,extraScaleEnabled:()=>false});
  for(const spec of compiled.particles){
   const p=spec.profile,node={controller:{world:spec.original.world},actionMode:p.actionMode,loop:false,endless:true,state:1,time:0,previousTickLiveCount:0,config:p.config,particlesPerSecond:p.particlesPerSecond,emissionLife:p.emissionLife,totalBirths:0};
   initializeSourceSfxPolyStorage(node,p,{globalParticleLimit:p.maxSpriteNum});
   const geometry=new THREE.BufferGeometry();for(const [key,size]of [['position',3],['uv',2],['particleColor',4]])geometry.setAttribute(key,new THREE.BufferAttribute(new Float32Array(node.capacity*4*size),size).setUsage(THREE.DynamicDrawUsage));
   geometry.setIndex(Array.from({length:node.capacity},(_,i)=>[0,1,2,0,2,3].map(v=>v+i*4)).flat());geometry.setDrawRange(0,0);
   const material=createFashionParticleMaterial(await loadTexture(spec.image.url),spec.render);delete material.userData.sourceFashionParticle;material.userData.sourceHeadwearParticle=HEADWEAR_PARTICLE_PROFILE;
   const mesh=new THREE.Mesh(geometry,material);mesh.name='source-headwear-water';mesh.frustumCulled=false;mesh.renderOrder=spec.renderBias+15;group.add(mesh);
   const spawn=createSourceSfxPolySpawnBatch({stream,prepareSpawn:()=>({...p.birth,...transforms.prepareSpawnTransform(node),inheritedVelocity:[0,0,0],positionDrift:[0,0,0],rotationScale:1,textureType:spec.atlas?3:1,atlasDuration:spec.atlas?.timingExtent,radiusCurve:p.curves.radius,minVelocity:p.curves.minVelocity(node.time),maxVelocity:p.curves.maxVelocity(node.time)})});
   systems.push({...spec,node,mesh,spawnBatch:(...args)=>{const n=spawn(...args);node.totalBirths+=n;return n;}});
  }
  groups.push({path:entry.path,socket:entry.socket,systems,ignoredNodes:effect.ignoredNodes||[],elapsed:0,update(dt,camera){
   this.elapsed=f(this.elapsed+f(dt));compiled.runtime.update(dt);
   // Simulate in the original scene space, before the one handedness
   // reflection. The owned render group cancels the animated head transform:
   // action1 particles retain their birth-world position while action2 follows.
   const inverse=sourceWorld.matrixWorld.clone().invert(),attachment=sourceTRS(inverse.clone().multiply(socket.matrixWorld));
   group.matrix.copy(root.matrixWorld).invert().multiply(sourceWorld.matrixWorld);group.updateMatrixWorld(true);
   camera.updateMatrixWorld();const basis=inverse.clone().multiply(camera.matrixWorld).elements,axis=i=>new THREE.Vector3(basis[i],basis[i+1],basis[i+2]).normalize().toArray();
   const right=axis(0),up=axis(4),forward=axis(8).map(v=>-v),eye=camera.getWorldPosition(new THREE.Vector3()).toArray();
   for(const sys of systems){
    const {node,profile:p,mesh}=sys;node.controller.world=sourceSfxInheritTransform(sys.original.world,attachment,7);transforms.refreshFrameTransform(node,p.actionMode);
    if(dt>0){node.time=f(node.time+f(dt));node.previousTickLiveCount=0;sourceSfxTickEmitter(node,f(dt),{budget,qualityFactor:1,spawnMode:'inline',spawnBatch:sys.spawnBatch,motion:()=>({friction:p.friction,gravityDirection:p.gravityDirection,gravityCurve:p.curves.gravity,angularCurve:p.curves.angular,oldRotationMode:p.birth.oldRotationMode,actionMode:p.actionMode,scaleLength:transforms.motionScaleLength(node),randomSum:p.randomSum,randomSumInterval:p.randomSumInterval,stream}),expire:()=>{},finishUpdate:()=>{}});}
    const position=new THREE.Vector3().fromArray(node.controller.world.translation).applyMatrix4(sourceWorld.matrixWorld).toArray(),fade=sourceSfxDistanceFade({position,distanceFade:p.distanceFade},eye),frame=sourceSfxTransformMatrix(node.particleFrameTransform),g=mesh.geometry;
    for(let i=0;i<node.liveCount;i++){
     const particle=node.pool[i],phase=particle.normalizedAge,width=sys.width(phase),height=f(sys.height(phase)*(sys.scaleStyle===0?width:1));particle.lastDirection??=[0,0,0];
     g.attributes.position.array.set(sourceSfxParticleQuad({...particle,frame,frameScale:node.particleFrameTransform.scale,width,height,alongMove:sys.alongMove,right,up,forward}),i*12);
     const color=sys.color(phase);color[3]=f(color[3]*fade);for(let j=0;j<4;j++)g.attributes.particleColor.array.set(color,(i*4+j)*4);
     const atlas=sys.atlas,index=atlas?sourceSfxAtlasFrameIndex(sourceSfxParticleAtlasTime({mode:p.atlasMode,rate:p.atlasRate,startTime:particle.atlasStartTime,age:particle.age,normalizedAge:phase,duration:atlas.timingExtent}),atlas.timingExtent,atlas.frames.length):null,uv=atlas?atlas.frames[index].uv:[0,0,1,1];
     particle.sourceAtlasFrame=index;g.attributes.uv.array.set([uv[0],uv[1],uv[2],uv[1],uv[2],uv[3],uv[0],uv[3]],i*8);
    }
    for(const attr of Object.values(g.attributes))attr.needsUpdate=true;g.setDrawRange(0,node.liveCount*6);mesh.visible=fade>0;
   }
  }});
 }
 // Keep the source inventories intact; report completion at the active-node
 // layer so re-running either independent publisher cannot erase another's work.
 root.userData.headwearParticleEffects={groups,pending:host.pending,update(dt,camera){for(const g of groups)g.update(dt,camera);}};
}
