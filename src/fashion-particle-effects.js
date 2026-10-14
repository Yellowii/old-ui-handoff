import * as THREE from 'three';
import {compileSourceSfxPolyProfile} from './source-sfx-poly.js';
import {compileSourceSfxTrackProfile} from './source-sfx-track.js';
import {createSourceSfxFloatCurve,createSourceSfxPackedColorCurve} from './source-sfx-curves.js';
import {sourceSfxInheritTransform,sourceSfxTransformMatrix,createSourceSfxPolyTransformBindings} from './source-sfx-controller.js';
import {initializeSourceSfxPolyStorage} from './source-sfx-poly-initialize.js';
import {createSourceSfxPolySpawnBatch} from './source-sfx-spawn.js';
import {sourceSfxStepEmitter} from './source-sfx-emitter.js';
import {sourceSfxParticleQuad} from './source-sfx-particle-quad.js';
import {sourceSfxParticleAtlasTime,sourceSfxAtlasFrameIndex} from './source-sfx-atlas.js';

import {requestJSON} from './handoff/services.js';
import {isReviewedEffect} from './handoff/runtime-contracts.js';

export const FASHION_PARTICLE_PROFILE='champion-belt-particle-poly-v1';
const f=Math.fround,parent=p=>p.slice(0,p.lastIndexOf('/'));
const identity=()=>({translation:[0,0,0],rotation:[1,0,0,0,1,0,0,0,1],scale:[1,1,1],flags:0});
let registry;
const resources=()=>registry??=requestJSON('/data/fashion-sfx-resources.json').then(r=>{if(!r.ok)throw Error('服饰特效资源不可用');return r.json();}).catch(e=>{registry=null;throw e;});
const children=(nodes,path)=>nodes.filter(n=>parent(n.path)===path);
const kind=n=>n.path.split('/').at(-1).replace(/\[\d+\]$/,'');

export function compileFashionParticleEffect(data,effect){
  if(!isReviewedEffect(FASHION_PARTICLE_PROFILE,effect))throw Error('Unreviewed fashion effect; provide runtimePolicy.reviewedEffects');
  const nodes=effect.orderedNodes,root=nodes.find(n=>n.path==='FxGroup');
  if(root.attributes.EndLessPlay!=='true')throw Error('Unreviewed fashion effect lifecycle');
  const controllers=nodes.filter(n=>['Dummy','ParticleSystem'].includes(kind(n))).map(n=>{
    const tracks=children(nodes,n.path).filter(c=>kind(c).startsWith('Track'));
    if(tracks.length!==1||n.attributes.InheritPrsOnce==='true'||n.attributes.FxIgnore!=='false'||Number(n.attributes.FxStartTime)!==0)throw Error('Unreviewed fashion controller');
    const track=compileSourceSfxTrackProfile(nodes,tracks[0].path);
    if(!track.isStatic)throw Error('Animated fashion track not connected');
    const local=track.sample(0);local.translation=local.translation.map((v,i)=>f(v+JSON.parse(n.attributes.PosOffset)[i]));
    return {path:n.path,parent:parent(n.path),local,world:identity(),source:n};
  });
  const particles=controllers.filter(c=>kind(c.source)==='ParticleSystem').map(c=>{
    const a=c.source.attributes,profile=compileSourceSfxPolyProfile(nodes,c.path),cs=children(nodes,c.path);
    for(const [key,value] of Object.entries({ColorType:'1',DirType:'0',SoftSprite:'false',TextureClockRotate:'0',TextureFlip:'false',NearCullEnable:'false',FarCullEnable:'false',InheritEndLessPlay:'true',EnableZBuffer:'true',IsDerive:'false',BindBonesHead:'false'}))if(a[key]!==value)throw Error(`Unreviewed fashion ${key}`);
    if(![2,5].includes(Number(a.BlendMode))||profile.birth.originalAngle!==0||profile.birth.originalAngleRandom!==0||profile.birth.randomAngularSpeed!==0)throw Error('Unreviewed fashion blend/spin');
    const child=name=>{const n=cs.find(n=>kind(n)===name);if(!n)throw Error(`Missing ${name}`);return n;};
    if(child('RotDegreeSpeedFrame').frames.some(k=>Number(k.Value)!==0))throw Error('Spinning fashion particles unsupported');
    if(profile.config.emissionType===3&&child('EmissionRadiusFrame').frames.some(k=>Number(k.Value)!==0))throw Error('Type3 radius unsupported');
    const width=createSourceSfxFloatCurve(child('SpriteScaleFrame')),height=createSourceSfxFloatCurve(child(Number(a.ScaleStyle)===0?'HWRatioFrame':'SpriteHeightFrame'));
    const colorNode=child('ColorFramePar');
    const color=createSourceSfxPackedColorCurve({...colorNode,frames:colorNode.frames.map(k=>{const v=JSON.parse(k.Value);if(v.length!==4||v.some(x=>!Number.isInteger(x)||x<0||x>255))throw Error('Source ARGB byte tuple required');return {...k,Value:((v[0]<<24)|(v[1]<<16)|(v[2]<<8)|v[3])>>>0};})});
    const atlas=data.atlases.find(t=>t.path===profile.texturePath),paths=atlas?[...new Set(Object.values(atlas.images))]:[profile.texturePath];
    if(paths.length!==1)throw Error('Multi-image fashion atlas unsupported');
    const image=data.images.find(i=>i.path===paths[0]);if(image?.publicationStatus!=='published')throw Error('Fashion particle image missing');
    return {controller:c,profile,width,height,color,atlas,image,alongMove:a.AlongMoveDir==='true',scaleStyle:Number(a.ScaleStyle),blendMode:Number(a.BlendMode)};
  });
  if(particles.length!==6||controllers.length!==8)throw Error('Fashion effect node shape changed');
  return {controllers,particles};
}

export function createFashionParticleMaterial(texture,{greyColor=0,multiply=1,blendMode=2}={}){
  // Original mix permits authored extrapolation (soda splash greycolor=-0.2).
  if(!Number.isFinite(greyColor)||![1,2,4].includes(multiply)||![0,2,5,8].includes(blendMode))throw Error('Unsupported source particle color parameters');
  const destination=blendMode===0?THREE.OneMinusSrcAlphaFactor:THREE.OneFactor;
  const sampler=texture.clone();sampler.flipY=false;sampler.colorSpace=THREE.NoColorSpace;sampler.wrapS=sampler.wrapT=THREE.RepeatWrapping;sampler.needsUpdate=true;
  const material=new THREE.ShaderMaterial({uniforms:{sourceImage:{value:sampler},sourceGreyColor:{value:greyColor},sourceMultiply:{value:multiply}},
    vertexShader:`#include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec4 particleColor;varying vec4 sourceColor;varying vec2 sourceUv;
      void main(){sourceColor=particleColor;sourceUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`#include <logdepthbuf_pars_fragment>
      uniform sampler2D sourceImage;uniform float sourceGreyColor;uniform float sourceMultiply;varying vec4 sourceColor;varying vec2 sourceUv;
      void main(){
      #include <logdepthbuf_fragment>
      vec4 texel=texture2D(sourceImage,sourceUv,-2.0);
      texel.rgb=mix(texel.rgb,vec3(dot(texel.rgb,vec3(0.3,0.59,0.11))),sourceGreyColor);
      gl_FragColor=clamp(texel*sourceMultiply*sourceColor,0.0,1.0);}`,
    transparent:true,depthTest:true,depthWrite:false,depthFunc:THREE.LessEqualDepth,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false,
    blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.SrcAlphaFactor,blendDst:destination,
    blendEquationAlpha:THREE.AddEquation,blendSrcAlpha:THREE.SrcAlphaFactor,blendDstAlpha:destination});
  material.userData={sourceFashionParticle:FASHION_PARTICLE_PROFILE,baseTransparent:true,baseAlphaTest:0,baseDepthWrite:false,baseDepthTest:true,baseBlending:THREE.CustomBlending,baseEmission:0};
  material.addEventListener('dispose',()=>sampler.dispose());return material;
}

function sourceTRS(matrix){
  const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();matrix.decompose(p,q,s);
  const r=new THREE.Matrix4().makeRotationFromQuaternion(q).elements;
  return {translation:p.toArray().map(f),scale:s.toArray().map(f),rotation:[...r.slice(0,3),...r.slice(4,7),...r.slice(8,11)].map(f),flags:2};
}

// This viewer explicitly requests full particle quality and no additional global
// cap. These are preview policy inputs, not invented original scene settings.
export async function attachFashionParticleEffects(root,entries,loadTexture,{seed=crypto.getRandomValues(new Uint32Array(1))[0]}={}){
  if(!entries?.length)return;
  const data=await resources();
  for(const entry of entries){
    if(entry.profile!==FASHION_PARTICLE_PROFILE)throw Error('服饰粒子配置版本不受支持');
    const effect=data.effects.find(e=>e.path===entry.path),socket=root.getObjectByName(entry.socket);
    if(!effect||!socket?.userData.sourceSocket||entry.sourceSha256!==effect.source.sha256)throw Error('服饰特效来源或挂点不匹配');
    const compiled=compileFashionParticleEffect(data,effect),group=new THREE.Group();group.name='fashion-particles';root.add(group);
    const stream={seed},budget={requested:0,dropped:0},controllerMap=new Map(compiled.controllers.map(c=>[c.path,c]));let groupTransform=identity();
    const transforms=createSourceSfxPolyTransformBindings({getController:n=>n.controller,getGroupTransform:()=>groupTransform,extraScaleEnabled:()=>false});
    const systems=[];
    for(const spec of compiled.particles){
      const p=spec.profile,node={controller:spec.controller,actionMode:p.actionMode,loop:false,endless:true,state:1,time:0,previousTickLiveCount:0,config:p.config,particlesPerSecond:p.particlesPerSecond,emissionLife:p.emissionLife};
      initializeSourceSfxPolyStorage(node,p,{globalParticleLimit:p.maxSpriteNum});
      const geometry=new THREE.BufferGeometry();
      for(const [name,size] of [['position',3],['uv',2],['particleColor',4]])geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(node.capacity*4*size),size).setUsage(THREE.DynamicDrawUsage));
      geometry.setIndex(Array.from({length:node.capacity},(_,i)=>[0,1,2,0,2,3].map(v=>v+i*4)).flat());geometry.setDrawRange(0,0);
      const mesh=new THREE.Mesh(geometry,createFashionParticleMaterial(await loadTexture(spec.image.url)));mesh.frustumCulled=false;mesh.name=spec.controller.source.attributes.Name;group.add(mesh);
      const spawnBatch=createSourceSfxPolySpawnBatch({stream,prepareSpawn:()=>({...p.birth,...transforms.prepareSpawnTransform(node),
        inheritedVelocity:[0,0,0],positionDrift:[0,0,0],rotationScale:1,textureType:spec.atlas?3:1,atlasDuration:spec.atlas?.timingExtent,
        radiusCurve:p.curves.radius,minVelocity:p.curves.minVelocity(node.time),maxVelocity:p.curves.maxVelocity(node.time)})});
      systems.push({...spec,node,mesh,spawnBatch});
    }
    group.userData.fashionParticles={profile:FASHION_PARTICLE_PROFILE,systems,elapsed:0,update(dt,camera){
      const inverse=root.matrixWorld.clone().invert();groupTransform=sourceTRS(inverse.clone().multiply(socket.matrixWorld));
      for(const c of compiled.controllers)c.world=sourceSfxInheritTransform(c.local,controllerMap.get(c.parent)?.world||groupTransform,7);
      camera.updateMatrixWorld();const basis=inverse.clone().multiply(camera.matrixWorld).elements;
      const axis=i=>new THREE.Vector3(basis[i],basis[i+1],basis[i+2]).normalize().toArray();
      // NeoX camera +Z looks into the scene; Three camera +Z points out.
      // The actor's inherited X reflection is already in inverse.
      const right=axis(0),up=axis(4),forward=axis(8).map(v=>-v);
      this.elapsed+=dt;
      for(const sys of systems){
        const {node,profile:p,mesh}=sys;transforms.refreshFrameTransform(node,p.actionMode);
        if(dt>0){node.time=f(node.time+dt);node.previousTickLiveCount=0;sourceSfxStepEmitter(node,f(dt),{budget,qualityFactor:1,spawnMode:'inline',spawnBatch:sys.spawnBatch,
          motion:()=>({friction:p.friction,gravityDirection:p.gravityDirection,gravityCurve:p.curves.gravity,angularCurve:p.curves.angular,oldRotationMode:p.birth.oldRotationMode,actionMode:p.actionMode,scaleLength:1,randomSum:p.randomSum,randomSumInterval:p.randomSumInterval,stream}),expire:()=>{},finishUpdate:()=>{}});}
        const g=mesh.geometry,frame=sourceSfxTransformMatrix(node.particleFrameTransform);
        for(let i=0;i<node.liveCount;i++){
          const particle=node.pool[i],phase=particle.normalizedAge,width=sys.width(phase),height=f(sys.height(phase)*(sys.scaleStyle===0?width:1));
          particle.lastDirection??=[0,0,0];
          const vertices=sourceSfxParticleQuad({...particle,frame,frameScale:node.particleFrameTransform.scale,width,height,alongMove:sys.alongMove,right,up,forward});g.attributes.position.array.set(vertices,i*12);
          const color=sys.color(phase);for(let j=0;j<4;j++)g.attributes.particleColor.array.set(color,(i*4+j)*4);
          const atlas=sys.atlas,uv=atlas?atlas.frames[sourceSfxAtlasFrameIndex(sourceSfxParticleAtlasTime({mode:p.atlasMode,rate:p.atlasRate,startTime:particle.atlasStartTime,age:particle.age,normalizedAge:phase,duration:atlas.timingExtent}),atlas.timingExtent,atlas.frames.length)].uv:[0,0,1,1];
          g.attributes.uv.array.set([uv[0],uv[1],uv[2],uv[1],uv[2],uv[3],uv[0],uv[3]],i*8);
        }
        for(const attr of Object.values(g.attributes))attr.needsUpdate=true;g.setDrawRange(0,node.liveCount*6);
      }
    }};
  }
}
