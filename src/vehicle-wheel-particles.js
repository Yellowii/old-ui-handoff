import {requestJSON} from './handoff/services.js';

import {attachWheelTrails} from './wheel-trails.js';
import * as THREE from 'three';
import {compileSourceSfxPolyProfile} from './source-sfx-poly.js';
import {createSourceSfxFloatCurve,createSourceSfxPackedColorCurve} from './source-sfx-curves.js';
import {sourceSfxInheritTransform,sourceSfxTransformMatrix,createSourceSfxPolyTransformBindings} from './source-sfx-controller.js';
import {initializeSourceSfxPolyStorage} from './source-sfx-poly-initialize.js';
import {createSourceSfxPolySpawnBatch} from './source-sfx-spawn.js';
import {sourceSfxStepEmitter} from './source-sfx-emitter.js';
import {sourceSfxParticleQuad} from './source-sfx-particle-quad.js';
import {sourceSfxParticleAtlasTime,sourceSfxAtlasFrameIndex} from './source-sfx-atlas.js';
import {compileSourceModelSfxControllers} from './source-model-sfx-controllers.js';
import {createFashionParticleMaterial} from './fashion-particle-effects.js';

export const WHEEL_PARTICLE_PROFILE='source-wheel-particles-v1';
const f=Math.fround;
function sourceTRS(matrix){
 const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();matrix.decompose(p,q,s);
 const r=new THREE.Matrix4().makeRotationFromQuaternion(q).elements;
 return {translation:p.toArray().map(f),scale:s.toArray().map(f),rotation:[...r.slice(0,3),...r.slice(4,7),...r.slice(8,11)].map(f),flags:2};
}

export function compileWheelParticle(effect,spec,atlas){
 if(effect.profile!==WHEEL_PARTICLE_PROFILE)throw Error('Unsupported wheel particle profile');
 const path=spec.controllerPath,p=compileSourceSfxPolyProfile(effect.orderedNodes,path),a=effect.orderedNodes.find(n=>n.path===path).attributes;
 if(![0,4].includes(p.config.emissionType)||![1,2].includes(p.actionMode)||!['0','2'].includes(a.BlendMode)||a.DirType!=='0'||a.SpinAxis!=='[0.0, 0.0, 0.0]'||a.ScaleStyle!=='0'||a.AlongMoveDir!=='false'||a.SoftSprite!=='false'||a.TextureClockRotate!=='0'||a.TextureFlip!=='false'||!atlas?.frames.length)throw Error('Unreviewed wheel particle branch');
 const child=name=>{const n=effect.orderedNodes.find(n=>n.path.startsWith(path+'/'+name+'[')&&n.path.split('/').length===path.split('/').length+1);if(!n)throw Error('Missing source '+name);return n;};
 const color=child('ColorFramePar');
 return {profile:p,atlas,blendMode:Number(a.BlendMode),width:createSourceSfxFloatCurve(child('SpriteScaleFrame')),ratio:createSourceSfxFloatCurve(child('HWRatioFrame')),color:createSourceSfxPackedColorCurve({...color,frames:color.frames.map(k=>{const v=JSON.parse(k.Value);if(v.length!==4||v.some(x=>!Number.isInteger(x)||x<0||x>255))throw Error('ARGB source bytes required');return {...k,Value:((v[0]<<24)|(v[1]<<16)|(v[2]<<8)|v[3])>>>0};})})};
}

// Preview policy: full particle quality, authored capacity, a fresh random stream.
// These are explicit viewer inputs, not a claim of the original scene's seed.
export async function attachWheelParticleGroup(root,socket,effect,atlases,loadTexture,{seed=crypto.getRandomValues(new Uint32Array(1))[0]}={}){
 const runtime=compileSourceModelSfxControllers(effect),controllers=runtime.controllers;
 const group=new THREE.Group();group.name='source-wheel-particles';root.add(group);
 const stream={seed},budget={requested:0,dropped:0},systems=[];
 let socketTransform;const transforms=createSourceSfxPolyTransformBindings({getController:n=>n.controller,getGroupTransform:()=>socketTransform,extraScaleEnabled:()=>false});
 for(const spec of effect.particles){
  const compiled=compileWheelParticle(effect,spec,atlases[spec.atlas]),p=compiled.profile;
  const original=controllers.get(spec.controllerPath);if(!original)throw Error('Wheel particle controller missing');
  const node={controller:{path:original.path,world:original.world},actionMode:p.actionMode,loop:false,endless:true,state:1,time:0,
   previousTickLiveCount:0,config:p.config,particlesPerSecond:p.particlesPerSecond,emissionLife:p.emissionLife,totalBirths:0};
  initializeSourceSfxPolyStorage(node,p,{globalParticleLimit:p.maxSpriteNum});
  const geometry=new THREE.BufferGeometry();
  for(const [key,size] of [['position',3],['uv',2],['particleColor',4]])geometry.setAttribute(key,new THREE.BufferAttribute(new Float32Array(node.capacity*4*size),size).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(Array.from({length:node.capacity},(_,i)=>[0,1,2,0,2,3].map(v=>v+i*4)).flat());geometry.setDrawRange(0,0);
  const material=createFashionParticleMaterial(await loadTexture(compiled.atlas.image.url));
  delete material.userData.sourceFashionParticle;material.userData.sourceWheelParticle=WHEEL_PARTICLE_PROFILE;if(compiled.blendMode===0)material.blendDst=material.blendDstAlpha=THREE.OneMinusSrcAlphaFactor;
  const mesh=new THREE.Mesh(geometry,material);mesh.name='source-wheel-particle';mesh.frustumCulled=false;group.add(mesh);
  const spawn=createSourceSfxPolySpawnBatch({stream,prepareSpawn:()=>({...p.birth,...transforms.prepareSpawnTransform(node),
   inheritedVelocity:[0,0,0],positionDrift:[0,0,0],rotationScale:1,textureType:3,atlasDuration:compiled.atlas.timingExtent,
   radiusCurve:p.curves.radius,minVelocity:p.curves.minVelocity(node.time),maxVelocity:p.curves.maxVelocity(node.time)})});
  const spawnBatch=(...args)=>{const count=spawn(...args);node.totalBirths+=count;return count;};
  systems.push({...compiled,node,mesh,original,spawnBatch,socket:socket.name});
 }
 const trails=await attachWheelTrails(root,socket,effect,controllers,loadTexture);
 const state={profile:WHEEL_PARTICLE_PROFILE,systems,trails,source:effect.source.path,socket:socket.name,elapsed:0,update(dt,camera){
  runtime.update(dt);this.elapsed+=dt;trails.update(dt,camera);
  // The renderer has already applied the actor pose and current socket matrix.
  const inverse=root.matrixWorld.clone().invert();socketTransform=sourceTRS(inverse.clone().multiply(socket.matrixWorld));
  camera.updateMatrixWorld();const basis=inverse.clone().multiply(camera.matrixWorld).elements;
  const axis=i=>new THREE.Vector3(basis[i],basis[i+1],basis[i+2]).normalize().toArray();
  const right=axis(0),up=axis(4),forward=axis(8).map(v=>-v),eye=camera.getWorldPosition(new THREE.Vector3());
  const distance=socket.getWorldPosition(new THREE.Vector3()).distanceTo(eye);
  for(const sys of systems){
   const {node,profile:p,mesh}=sys;
   node.controller.world=sourceSfxInheritTransform(sys.original.world,socketTransform,7);
   transforms.refreshFrameTransform(node,p.actionMode);
   if(dt>0){
    node.time=f(node.time+dt);node.previousTickLiveCount=0;
    sourceSfxStepEmitter(node,f(dt),{budget,qualityFactor:1,spawnMode:'inline',spawnBatch:sys.spawnBatch,
     motion:()=>({friction:p.friction,gravityDirection:p.gravityDirection,gravityCurve:p.curves.gravity,
      angularCurve:p.curves.angular,oldRotationMode:p.birth.oldRotationMode,actionMode:p.actionMode,
      scaleLength:transforms.motionScaleLength(node),randomSum:p.randomSum,randomSumInterval:p.randomSumInterval,stream}),
     expire:()=>{},finishUpdate:()=>{}});
   }
   const frame=sourceSfxTransformMatrix(node.particleFrameTransform),g=mesh.geometry;
   const df=p.distanceFade;const fade=df.farEnabled?(distance>=df.farEnd?0:distance<=df.farStart?1:(df.farEnd-distance)/(df.farEnd-df.farStart)):1;
   for(let i=0;i<node.liveCount;i++){
    const particle=node.pool[i],phase=particle.normalizedAge,width=sys.width(phase),height=f(sys.ratio(phase)*width);
    const vertices=sourceSfxParticleQuad({...particle,frame,frameScale:node.particleFrameTransform.scale,width,height,right,up,forward});
    g.attributes.position.array.set(vertices,i*12);
    const color=sys.color(phase);color[3]*=fade;
    for(let j=0;j<4;j++)g.attributes.particleColor.array.set(color,(i*4+j)*4);
    const atlas=sys.atlas,index=sourceSfxAtlasFrameIndex(sourceSfxParticleAtlasTime({mode:p.atlasMode,rate:p.atlasRate,startTime:particle.atlasStartTime,age:particle.age,normalizedAge:phase,duration:atlas.timingExtent}),atlas.timingExtent,atlas.frames.length),uv=atlas.frames[index].uv;
    g.attributes.uv.array.set([uv[0],uv[1],uv[2],uv[1],uv[2],uv[3],uv[0],uv[3]],i*8);sys.lastAtlasFrame=index;
   }
   for(const attr of Object.values(g.attributes))attr.needsUpdate=true;
   g.setDrawRange(0,node.liveCount*6);mesh.visible=fade>0;
  }
 }};group.userData.wheelParticles=state;return state;
}

let registry;
const resources=()=>registry??=requestJSON('/data/vehicle-wheel-effects.json').then(r=>{if(!r.ok)throw Error('Wheel effect catalog unavailable');return r.json();}).catch(e=>{registry=null;throw e;});
export async function attachVehicleWheelParticles(root,entries,loadTexture){
 const data=await resources();if(data.version!==2||data.attachmentPolicy!=='show-fashion-base-model-socket')throw Error('Unknown wheel catalog version');
 for(const entry of entries){const effect=data.effects[entry.path];if(!effect)throw Error('Unpublished wheel effect');if(!effect.particles.length)continue;let socket;root.traverse(n=>{if(n.isBone&&(n.userData.sourceBone||n.name)===entry.socket)socket=n;});if(!socket)throw Error('Original wheel effect socket missing: '+entry.socket);await attachWheelParticleGroup(root,socket,effect,data.atlases,loadTexture);}
}
