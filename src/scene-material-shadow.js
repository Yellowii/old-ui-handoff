import * as THREE from 'three';
import {sourceSceneSunDirection} from './source-scene-light.js';

export function previewShadowUniforms(){return {neoPreviewShadowMap:{value:null},neoPreviewShadowMatrix:{value:new THREE.Matrix4()},neoPreviewShadowTexel:{value:new THREE.Vector2(1/1024,1/1024)},neoPreviewShadowEnabled:{value:0}};}
export function bindPreviewShadow(shader){
 shader.vertexShader='uniform mat4 neoPreviewShadowMatrix;varying vec4 neoPreviewShadowCoord;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nneoPreviewShadowCoord=neoPreviewShadowMatrix*modelMatrix*vec4(transformed,1.);');
 shader.fragmentShader=`uniform sampler2D neoPreviewShadowMap;uniform vec2 neoPreviewShadowTexel;uniform float neoPreviewShadowEnabled;
 varying vec4 neoPreviewShadowCoord;
 float neoPreviewShadow(){
  if(neoPreviewShadowEnabled<.5)return 1.;
  vec3 p=neoPreviewShadowCoord.xyz/neoPreviewShadowCoord.w;
  if(any(lessThan(p,vec3(0.)))||any(greaterThan(p,vec3(1.))))return 1.;
  float result=0.;
  // WebGL raster bias and 3x3 PCF, not claimed as the original CSM filter.
  for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)result+=step(p.z-.00005,texture2D(neoPreviewShadowMap,p.xy+vec2(float(x),float(y))*neoPreviewShadowTexel).r);
  return result/9.;
 }\n`+shader.fragmentShader;
}

// Dedicated depth pass: inserting a zero-energy directional light into Three
// would reorder directionalLights[0], changing other materials' main-light input.
// Only explicitly supported opaque geometry casts; no invented alpha silhouettes.
export class SceneMaterialShadow {
 constructor(renderer,scene,root){
  this.renderer=renderer;this.scene=scene;this.root=root;this.target=null;this.receivers=new Set();
  this.box=new THREE.Box3();this.partBox=new THREE.Box3();this.sphere=new THREE.Sphere();
  this.camera=new THREE.OrthographicCamera();this.matrix=new THREE.Matrix4();
  this.biasMatrix=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
  this.toLight=new THREE.Vector3();
 }
 update(enabled=true){
  const casters=new Set(),receivers=new Set(),receiverMeshes=new Set();
  this.root.traverseVisible(n=>{if(n.isMesh){
   const mats=(Array.isArray(n.material)?n.material:[n.material]).filter(m=>m.visible);
   for(const m of mats)if(m.userData.previewShadowReceiver){receivers.add(m);receiverMeshes.add(n);}
   if(mats.length&&mats.every(m=>!m.transparent&&m.alphaTest===0&&m.opacity>0&&['standard-channels','source-ycymv-hair-channels','source-laserflash-channels','source-prop-metallica-channels','source-standard-crystal-ball-channels'].includes(m.userData.adapter)))casters.add(n);
  }});
  for(const m of this.receivers)if(!receivers.has(m)){m.userData.uniforms.neoPreviewShadowEnabled.value=0;m.userData.uniforms.neoPreviewShadowMap.value=null;}
  this.receivers=receivers;
  if(!enabled||!receivers.size){this.dispose();return;}
  const direction=sourceSceneSunDirection();
  this.toLight.set(-direction[0],direction[1],direction[2]).normalize().negate();
  if(!this.target){
   this.target=new THREE.WebGLRenderTarget(1024,1024,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
   this.target.depthTexture=new THREE.DepthTexture(1024,1024,THREE.UnsignedIntType);
   this.depthMaterial=new THREE.MeshDepthMaterial({side:THREE.BackSide});
  }
  this.box.makeEmpty();
  for(const n of new Set([...casters,...receiverMeshes])){
   if(n.isSkinnedMesh){n.computeBoundingBox();this.partBox.copy(n.boundingBox);}
   else{if(!n.geometry.boundingBox)n.geometry.computeBoundingBox();this.partBox.copy(n.geometry.boundingBox);}
   this.partBox.applyMatrix4(n.matrixWorld);this.box.union(this.partBox);
  }
  if(this.box.isEmpty()){this.dispose();return;}
  this.box.getBoundingSphere(this.sphere);const radius=Math.max(.001,this.sphere.radius)*1.05,camera=this.camera;
  camera.position.copy(this.sphere.center).addScaledVector(this.toLight,radius*2);camera.lookAt(this.sphere.center);
  camera.left=camera.bottom=-radius;camera.right=camera.top=radius;camera.near=radius*.5;camera.far=radius*3.5;
  camera.updateProjectionMatrix();camera.updateMatrixWorld();
  this.matrix.copy(this.biasMatrix).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
  const previous=this.renderer.getRenderTarget(),override=this.scene.overrideMaterial,autoClear=this.renderer.autoClear,hidden=[];
  try{
   this.scene.traverseVisible(n=>{if((n.isMesh||n.isLine||n.isPoints||n.isSprite)&&!casters.has(n))hidden.push(n);});
   for(const n of hidden)n.visible=false;
   this.scene.overrideMaterial=this.depthMaterial;this.renderer.autoClear=true;this.renderer.setRenderTarget(this.target);this.renderer.render(this.scene,camera);
  }finally{
   for(const n of hidden)n.visible=true;
   this.scene.overrideMaterial=override;this.renderer.autoClear=autoClear;this.renderer.setRenderTarget(previous);
  }
  for(const m of receivers){const u=m.userData.uniforms;u.neoPreviewShadowMap.value=this.target.depthTexture;u.neoPreviewShadowMatrix.value.copy(this.matrix);u.neoPreviewShadowEnabled.value=1;}
 }
 dispose(){
  for(const m of this.receivers){m.userData.uniforms.neoPreviewShadowEnabled.value=0;m.userData.uniforms.neoPreviewShadowMap.value=null;}this.receivers.clear();
  this.target?.dispose();this.target=null;this.depthMaterial?.dispose();this.depthMaterial=null;
 }
}
