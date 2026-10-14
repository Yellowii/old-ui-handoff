import * as THREE from 'three';

// A real color/depth snapshot of the current preview before refractive surfaces.
// Owned by the viewer, so model switches do not retain texture/framebuffer state.
export class SceneRefraction {
 constructor(){this.target=null;this.size=new THREE.Vector2();this.frames=0;}
 render(renderer,scene,camera){
  const materials=new Set();scene.traverseVisible(n=>{if(n.isMesh)for(const m of Array.isArray(n.material)?n.material:[n.material])if(m.visible&&m.userData.sceneRefraction)materials.add(m);});
  if(!materials.size){this.dispose();renderer.render(scene,camera);return;}
  const previous=renderer.getRenderTarget();
  if(previous)this.size.set(previous.width,previous.height);else renderer.getDrawingBufferSize(this.size);
  if(!this.target){
   this.target=new THREE.WebGLRenderTarget(this.size.x,this.size.y,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,wrapS:THREE.RepeatWrapping,wrapT:THREE.RepeatWrapping});
   this.target.depthTexture=new THREE.DepthTexture(this.size.x,this.size.y,THREE.UnsignedIntType);
  }
  this.target.setSize(this.size.x,this.size.y);
  const autoClear=renderer.autoClear;
  try{
   for(const m of materials)m.visible=false;
   renderer.setRenderTarget(this.target);renderer.autoClear=true;renderer.render(scene,camera);this.frames++;
  }finally{
   for(const m of materials)m.visible=true;
   renderer.setRenderTarget(previous);renderer.autoClear=autoClear;
  }
  for(const m of materials){const u=m.userData.uniforms;
   u.ifSceneColor.value=this.target.texture;
   u.ifScreenSize.value.copy(this.size);
   if(u.ifSceneDepth)u.ifSceneDepth.value=this.target.depthTexture;
   if(u.ifNearFar)u.ifNearFar.value.set(camera.near,camera.far);
   if(u.ifLogDepth)u.ifLogDepth.value=renderer.capabilities.logarithmicDepthBuffer?1:0;
   if(u.ifPerspective)u.ifPerspective.value=camera.isPerspectiveCamera?1:0;
  }
  renderer.render(scene,camera);
 }
 dispose(){this.target?.dispose();this.target=null;}
}
