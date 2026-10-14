import {requestJSON} from './handoff/services.js';

import {compileSourceModelSfxControllers} from './source-model-sfx-controllers.js';
import * as THREE from 'three';
import {initializeSourceSfxNodeTrack} from './source-sfx-track-initialize.js';
import {sourceSfxRecomposeController,sourceSfxTransformMatrix} from './source-sfx-controller.js';
import {createSourceSfxPackedColorCurve} from './source-sfx-curves.js';
import {attachHoofSphereParticles} from './hoof-sphere-particles.js';
import {attachHoofTrails} from './hoof-trails.js';

export const HOOF_MODEL_PROFILE='source-hoof-model-hierarchy-v2';
const identity=()=>({translation:[0,0,0],scale:[1,1,1],rotation:[1,0,0,0,1,0,0,0,1],flags:0});
const kind=n=>n.path.split('/').at(-1).replace(/\[\d+\]$/,'');
let registry;
const resources=()=>registry??=requestJSON('/data/vehicle-hoof-effects.json').then(r=>{if(!r.ok)throw Error('蹄部特效目录缺失');return r.json();}).catch(e=>{registry=null;throw e;});

// Original controller/track code owns rotation, scale, clocks and inheritance.
// Model DirType2 sets scene billboard mode0 (2b70904..2b70944).
export function compileHoofModelControllers(effect){
 if(effect.profile!==HOOF_MODEL_PROFILE)throw Error('蹄部模型特效版本未支持');
 return compileSourceModelSfxControllers(effect);
}

// Each socket gets the complete source controller ancestry of its model nodes.
// Only the published additive sphere-particle profile is admitted.
export async function attachVehicleHoofModelEffects(root,entries,loadModel,loadTexture){
 if(!entries?.length)return null;
 const data=await resources();if(data.version!==6)throw Error('蹄部特效目录版本不受支持');
 const groups=new Map(),active=[],sprites=[],particles=[],particleRuntimes=[],trails=[],trailRuntimes=[],ignored=[],pending=[],runtimes=[];
 for(const entry of entries){
  const effect=data.effects[entry.path],spec=effect?.models.find(m=>m.controllerPath===entry.controllerPath&&m.modelId===entry.modelId);
  if(!spec)throw Error('蹄部模型特效来源已变化，请重新生成');
  const key=entry.socket+'|'+entry.path;let g=groups.get(key);
   if(!g){
   const socket=root.getObjectByName(entry.socket);if(!socket)throw Error(`缺少蹄部特效挂点：${entry.socket}`);
   const group=new THREE.Group();group.name='source-hoof-model-effects';socket.add(group);
   g={group,runtime:compileHoofModelControllers(effect)};groups.set(key,g);runtimes.push(g.runtime);
    g.spriteAttached=false;pending.push(...effect.pendingComponents.map(n=>({...n,socket:entry.socket,source:entry.path})));
   const ps=await attachHoofSphereParticles(root,socket,effect,g.runtime.controllers,loadTexture);particleRuntimes.push(ps);particles.push(...ps.systems);
   const ts=await attachHoofTrails(group,effect,g.runtime.controllers,loadTexture);trailRuntimes.push(ts);trails.push(...ts.systems);
   ignored.push(...effect.ignoredComponents.map(n=>({...n,socket:entry.socket,source:entry.path})));
   }
  const loaded=await loadModel(spec.modelId,spec.materialOverrides),node=loaded.root;
  node.userData.sourceHoofModel=true;node.userData.sourceHoofController=spec.controllerPath;node.userData.sourceHoofParameters=spec.materialOverrides.materials[0].sourceMaterialOverride.parameters;
  node.matrixAutoUpdate=false;g.group.add(node);
  node.traverse(n=>{if(n.isMesh)for(const m of Array.isArray(n.material)?n.material:[n.material])if(!m.userData.adapter||m.userData.adapter==='unsupported')throw Error('蹄部模型材质未适配：'+loaded.warnings.join('、'));});
  active.push({node,controller:g.runtime.controllers.get(spec.controllerPath),scale:spec.scale,socket:entry.socket});
  if(!g.spriteAttached){
   const effectSprites=effect.sprites||[];
   for(const specSprite of effectSprites){
    const controller=g.runtime.controllers.get(specSprite.controllerPath);if(!controller)throw Error('蹄部 Sprite 控制器缺失');
    if(typeof loadTexture!=='function')throw Error('蹄部 Sprite 纹理加载器缺失');
    const texture=await loadTexture(specSprite.image.url);
    const sampler=texture.clone();sampler.flipY=false;sampler.colorSpace=THREE.NoColorSpace;sampler.wrapS=sampler.wrapT=THREE.RepeatWrapping;sampler.needsUpdate=true;
    const material=new THREE.ShaderMaterial({uniforms:{sourceImage:{value:sampler},sourceColor:{value:new THREE.Vector4(1,1,1,1)}},vertexShader:`varying vec2 sourceUv;void main(){sourceUv=vec2(uv.x,1.0-uv.y);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`uniform sampler2D sourceImage;uniform vec4 sourceColor;varying vec2 sourceUv;void main(){gl_FragColor=clamp(texture2D(sourceImage,sourceUv,-2.0)*sourceColor,0.0,1.0);}`,transparent:true,depthTest:true,depthWrite:false,depthFunc:THREE.LessEqualDepth,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneFactor,blendEquationAlpha:THREE.AddEquation,blendSrcAlpha:THREE.SrcAlphaFactor,blendDstAlpha:THREE.OneFactor});
    material.userData={sourceHoofSprite:true,sourceProfile:specSprite.profile,baseDepthWrite:false};material.addEventListener('dispose',()=>sampler.dispose());
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2*(specSprite.ratio>0?specSprite.ratio:specSprite.image.height/specSprite.image.width)),material);mesh.name='source-hoof-sprite';mesh.frustumCulled=false;g.group.add(mesh);
    sprites.push({mesh,controller,source:specSprite,color:createSourceSfxPackedColorCurve(specSprite.color),elapsed:0,parent:g.group});
   }
   g.spriteAttached=true;

  }
 }
 const state={partial:pending.length>0,profile:HOOF_MODEL_PROFILE,active,sprites,particles,trails,ignored,pending,controllers:runtimes.reduce((n,r)=>n+r.controllers.size,0),frames:0,
  update(dt){
   for(const runtime of runtimes)runtime.update(dt);
   for(const sprite of sprites){sprite.elapsed+=dt;const phase=((sprite.elapsed/sprite.source.lifespan)%1);sprite.mesh.matrix.fromArray(sourceSfxTransformMatrix(sprite.controller.world));sprite.mesh.matrixAutoUpdate=false;sprite.mesh.matrix.scale(new THREE.Vector3(sprite.source.radius,sprite.source.radius,sprite.source.radius));sprite.mesh.material.uniforms.sourceColor.value.set(...sprite.color(phase));sprite.mesh.matrixWorldNeedsUpdate=true;}
   for(const item of active){item.node.matrix.fromArray(sourceSfxTransformMatrix(item.controller.world)).scale(new THREE.Vector3(item.scale,item.scale,item.scale));item.node.matrixWorldNeedsUpdate=true;}
   this.frames++;
  },
   render(camera,dt=0){
   camera.updateMatrixWorld();const cameraPosition=camera.getWorldPosition(new THREE.Vector3());for(const sprite of sprites){const p=sprite.mesh.getWorldPosition(new THREE.Vector3()),d=p.distanceTo(cameraPosition),fade=d>80?0:d>50?(80-d)/30:1;const color=sprite.color((sprite.elapsed/sprite.source.lifespan)%1);color[3]*=Math.max(0,Math.min(1,fade));sprite.mesh.material.uniforms.sourceColor.value.set(...color);sprite.mesh.visible=fade>0;}
   for(const ps of particleRuntimes)ps.update(dt,camera);
   for(const ts of trailRuntimes)ts.update(dt,camera);

  }};
 state.update(0);root.userData.sourceHoofModelEffects=state;return state;
}
