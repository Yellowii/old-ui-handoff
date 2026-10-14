import {SceneRefraction} from './scene-refraction.js';
import {SceneMaterialShadow} from './scene-material-shadow.js';
import {attachVehicleWheelParticles} from './vehicle-wheel-particles.js';
import {SourceLeafSpringPlayer} from './source-leaf-spring-player.js';
import {SourceNstbPlayer} from './source-nstb-player.js';
import {SourceChainSpringPlayer} from './source-chain-spring-player.js';
import {bindMotionClip,resolveMotionEntries,sourceMotionRepeats,SourceMotionSequence} from './source-motion-sequence.js';
import {SourceOverlayMotion} from './source-motion-overlay.js';
import {applySourceExtraAngle,SourceAdditiveMotionExtra,SourceMotionExtra} from './source-motion-extras.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {installAssetLoaders} from './handoff/asset-loaders.js';
import {getHandoffServices,requestJSON} from './handoff/services.js';
import {addSourceSockets} from './source-rig.js';
import {sourceMaterial} from './materials.js';
import {SourceFaceAnimation} from './face-animation.js';
import {bindMaterialPasses} from './material-passes.js';
import {loadSourceCube} from './cube-texture.js';
import {applySourceMips} from './texture-mips.js';
import {modelTextureOverrides} from './model-textures.js';
import {attachAssemblyMeshes} from './source-fragment-assembly.js';
import {composeSourceBlocks} from './source-fashion-assembly.js';
import {SourcePartPose} from './source-part-pose.js';
import {SourceSubmodel,belongsToModel} from './source-submodel.js';
import {attachHeadwearModelEffects} from './headwear-model-effects.js';
import {attachModelSpriteEffects} from './model-sprite-effects.js';
import {attachHeadwearSpriteEffects} from './headwear-sprite-effects.js';
import {attachHeadwearParticleEffects} from './headwear-particle-effects.js';
import {attachFashionParticleEffects} from './fashion-particle-effects.js';
import {attachVehicleHoofModelEffects} from './vehicle-hoof-effects.js';
const sourceBoundsVector=value=>{try{const parsed=typeof value==='string'?JSON.parse(value):value;return Array.isArray(parsed)&&parsed.length>=3&&parsed.slice(0,3).every(Number.isFinite)?parsed.slice(0,3):null;}catch{return null;}};
const sourceSlotBounds=(desc,materialIndex)=>{const row=desc.slots?.find(slot=>slot.materialIndex===materialIndex)?.source;if(!row)return null;const center=sourceBoundsVector(row.BoundingCenter),half=sourceBoundsVector(row.BoundingHalf);return center&&half?{center,half}:null;};

export class WardrobeViewer {
  constructor(host,onChange,options={}){
    // Isolated wardrobe preview uses the verified authored default BAG inputs.
    // Other callers can explicitly pass null; this is not a live scene capture.
    this.sourceLightingProfile=options.sourceLightingProfile===undefined?'authored-bag':options.sourceLightingProfile;
    this.host=host;this.onChange=onChange;this.radius=2;this.actor=null;this.descriptor=null;this.equipped=new Map();this.companions=new Map();this.generation=0;this.companionGeneration=0;
    this.scene=new THREE.Scene();this.scene.background=options.transparentBackground?null:new THREE.Color('#e9edee');
    this.camera=new THREE.PerspectiveCamera(38,1,.001,100000);
    this.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:Boolean(options.transparentBackground),logarithmicDepthBuffer:true});
    this.refraction=new SceneRefraction();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.0;
    host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','角色三维预览');
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;
    this.controls.dampingFactor=.09;this.controls.zoomSpeed=1.2;this.controls.screenSpacePanning=true;
    this.controls.addEventListener('change',()=>{this.updateDepthRange();this.onChange?.(this.stats());});
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x778d93,1.4));
    const key=new THREE.DirectionalLight(0xffffff,2.0);key.position.set(4,7,5);this.scene.add(key);
    const fill=new THREE.DirectionalLight(0xffffff,0.8);fill.position.set(-4,3,-4);this.scene.add(fill);
    this.world=new THREE.Group();this.world.scale.x=-1;this.world.name='NeoXLeftHandedToThree';this.scene.add(this.world);
    this.materialShadow=new SceneMaterialShadow(this.renderer,this.scene,this.world);
    this.grid=new THREE.GridHelper(30,30,0xb5c2c4,0xd3dcdd);this.grid.position.y=-.025;this.grid.material.transparent=true;this.grid.material.opacity=.45;this.scene.add(this.grid);
    const {runtimePolicy}=getHandoffServices();this.runtimePolicy=runtimePolicy||{};const assetLoaders=installAssetLoaders(this.runtimePolicy);
    this.loader=assetLoaders.gltf;this.textures=assetLoaders.texture;this.imageLoader=assetLoaders.image;this.textureCache=new Map();
    this.wireframe=false;this.emission=1;this.alphaMode='source';this.autoRotate=false;
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
    this.camera.position.set(0,2.5,7);this.controls.target.set(0,1,0);
    this.lastFrame=null;this.mixer=null;this.action=null;this.motionRate=1;this.animationGeneration=0;this.idleClip=null;this.idleEntry=null;this.idleTime=0;this.playingIdle=false;
    this.face=new SourceFaceAnimation(value=>this.actor?.traverse(n=>{if(n.isMesh)for(const m of Array.isArray(n.material)?n.material:[n.material]){if(m.userData.faceFrames)m.map=m.userData.faceFrames[Math.round(value*4)]||m.userData.faceFrames[0];if(m.userData.uniforms?.neoFaceOffset)m.userData.uniforms.neoFaceOffset.value=m.userData.faceFrames?0:value;}}));
    this.faceData=requestJSON('/data/face-animations.json').then(r=>{if(!r.ok)throw new Error('Face data unavailable');return r.json();}).catch(()=>null);
    this.renderer.setAnimationLoop(time=>{const elapsed=this.lastFrame===null?0:Math.max(0,(time-this.lastFrame)/1000),dt=Math.min(elapsed,.1);this.lastFrame=time;this.world.traverse(n=>{n.userData.nstbPlayer?.restore();n.userData.chainSpringPlayer?.restore();n.userData.leafSpringPlayer?.restore();});if(this.motionSequence){this.motionSequence.update(dt);if(this.motionSequence?.finished)this.stopMotion();}else {this.updateVehicleLoop(elapsed);this.mixer?.update(dt);}for(const companion of this.companions.values()){companion.sequence?.update(dt);companion.mixer?.update(dt);}if(this.playingIdle&&this.action)this.idleTime=this.action.time;this.updateMotionExtras(dt);this.updateSubModels(dt);this.world.traverse(n=>n.userData.sourceHoofModelEffects?.update(dt));this.face.update(dt,(!this.action&&!this.motionSequence)||this.motionEntry?.name==='idle_show');this.world.traverse(n=>n.userData.headwearModelEffects?.update(dt));this.world.traverse(n=>{if(n.isMesh)for(const m of Array.isArray(n.material)?n.material:[n.material]){const u=m.userData.uniforms;if(u?.neoTime)u.neoTime.value=time/1000;if(u?.neoT120Time)u.neoT120Time.value=time/1000;if(u?.neoT125Time)u.neoT125Time.value=time/1000;if(u?.neoT124Time)u.neoT124Time.value=time/1000;if(u?.neoT121Time)u.neoT121Time.value=time/1000;if(u?.casTime)u.casTime.value=time/1000;if(u?.casResolution)u.casResolution.value.set(this.renderer.domElement.width,this.renderer.domElement.height);}});this.controls.autoRotate=this.autoRotate;this.controls.update();this.particleDelta=dt;this.render();this.onFrame?.(this.motionState());});
  }
  resize(){const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;const previous=Math.max(1,1/this.camera.aspect);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);
    if(this.actor&&this.controls){const offset=this.camera.position.clone().sub(this.controls.target);this.camera.position.copy(this.controls.target).add(offset.multiplyScalar(Math.max(1,1/this.camera.aspect)/previous));this.controls.update();}
  }
  async texture(url,color=false,mipmaps,compositeCache=new Map()){
    if(!url)return null;const key=JSON.stringify([url,color,mipmaps||null]);
    if(typeof url==='object'){
      if(!compositeCache.has(key))compositeCache.set(key,composeSourceBlocks(url,async path=>{const r=await requestJSON(path);if(!r.ok)throw new Error('源纹理像素未发布');return new Uint8Array(await r.arrayBuffer());}).then(({data,width,height})=>{
        const texture=new THREE.DataTexture(data,width,height);texture.userData.sourceComposite=true;texture.flipY=false;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());return texture;
      }).catch(error=>{compositeCache.delete(key);throw error;}));
      return compositeCache.get(key);
    }
    const isSourceCube=typeof this.runtimePolicy?.sourceCubeMatcher==='function'&&this.runtimePolicy.sourceCubeMatcher(url,{kind:'cube-texture'})===true;
    if(isSourceCube){
      if(!this.textureCache.has(key))this.textureCache.set(key,loadSourceCube(url).catch(e=>{this.textureCache.delete(key);throw e;}));
      return this.textureCache.get(key);
    }
    if(!this.textureCache.has(key))this.textureCache.set(key,this.textures.loadAsync(url).then(async t=>{
      try{
        t.flipY=false;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
        if(mipmaps){
          if(mipmaps[0]?.url!==url)throw new Error('Source mip base URL mismatch');
          const images=await Promise.all(mipmaps.map((level,i)=>i?this.imageLoader.loadAsync(level.url):Promise.resolve(t.image)));
          applySourceMips(t,mipmaps,images);
        }
        return t;
      }catch(error){t.dispose();throw error;}
    }).catch(e=>{this.textureCache.delete(key);throw e;}));
    return this.textureCache.get(key);
  }
  async loadModel(id,overrides={},compositeCache=new Map()){
    const response=await requestJSON(`/data/models/${id}.json`);if(!response.ok)throw new Error('模型描述文件缺失');
    const desc=await response.json();if(!desc.url)throw new Error('几何资源尚未解析');
    const {scene:root}=await this.loader.loadAsync(desc.url);const materials=[];const warnings=[];
    const secondUvByMaterial=new Map(),vertexColorsByMaterial=new Map(),tangentsByMaterial=new Map();let sourcePrimitive=0;
    root.traverse(node=>{
      if(!node.isMesh)return;
      const primitive=Number(/_(\d+)$/.exec(node.name)?.[1]??sourcePrimitive);sourcePrimitive++;
      const slot=desc.slots[primitive]?.materialIndex??primitive;
      const verified=Boolean(desc.uvLayerExport&&desc.uvLayerExport.partUvCounts[primitive]>=2&&node.geometry.attributes.uv1);
      secondUvByMaterial.set(slot,(secondUvByMaterial.get(slot)??true)&&verified);
      const color=node.geometry.attributes.color;
      vertexColorsByMaterial.set(slot,(vertexColorsByMaterial.get(slot)??true)&&Boolean(color&&color.count===node.geometry.attributes.position.count&&color.itemSize>=3));
      const tangent=node.geometry.attributes.tangent;
      tangentsByMaterial.set(slot,(tangentsByMaterial.get(slot)??true)&&Boolean(desc.sourceTangentExport&&tangent&&tangent.count===node.geometry.attributes.position.count&&tangent.itemSize===4));
    });
    for(const [mi,m] of desc.materials.entries()){
      const slot=overrides.materials?.[mi],effective=slot?.isolated?slot:{...overrides,...slot};
      const source=effective.sourceMaterialOverride?{...m,parameters:{...m.parameters,...effective.sourceMaterialOverride.parameters},textures:{...m.textures,...effective.sourceMaterialOverride.textures}}:effective.faceFrames?{...m,parameters:{...m.parameters,CharOffset:'0'}}:m;
      const result=await sourceMaterial(source,(url,color,mipmaps)=>this.texture(url,color,mipmaps,compositeCache),{...effective,sourceLightingProfile:this.sourceLightingProfile,sourceTangents:tangentsByMaterial.get(mi)===true,sourceSecondUv:secondUvByMaterial.get(mi)===true,sourceVertexColors:vertexColorsByMaterial.get(mi)===true,sourceBounds:desc.sourceBounds,sourceSlotBounds:sourceSlotBounds(desc,mi)});
      if(effective.faceFrames){const color=result.material.map?result.material.map.colorSpace===THREE.SRGBColorSpace:true;const frames=await Promise.all(effective.faceFrames.map(url=>this.texture(url,color)));for(const material of result.passes||[result.material])material.userData.faceFrames=frames;}
      materials.push(result.passes||[result.material]);warnings.push(...result.warnings);
    }
    const replacedGeometry=new Set();let index=0;root.traverse(node=>{
      if(!node.isMesh)return;
      const primitive=Number(/_(\d+)$/.exec(node.name)?.[1]??index);
      const mi=desc.slots[primitive]?.materialIndex??primitive;
      if(materials[mi]){const oldGeometry=node.geometry;node.material.dispose();bindMaterialPasses(node,materials[mi],warnings);if(node.geometry!==oldGeometry)replacedGeometry.add(oldGeometry);}
      else {node.material.color?.set(0xbcc9c9);node.material.userData={baseEmission:0,baseTransparent:false,baseAlphaTest:0};warnings.push('缺少材质槽');}
      node.frustumCulled=false;index++;
    });
    root.traverse(node=>{if(node.isMesh)replacedGeometry.delete(node.geometry);});
    for(const geometry of replacedGeometry)geometry.dispose();
    if(desc.skeletonUrl){
      try{const r=await requestJSON(desc.skeletonUrl);if(!r.ok)throw new Error('skeleton');root.userData.sourceSockets=addSourceSockets(root,await r.json());}
      catch{warnings.push('辅助挂点加载失败');}
    }
    try{await attachModelSpriteEffects(root,desc,url=>this.texture(url));await attachHeadwearModelEffects(root,desc,modelId=>this.loadModel(modelId));await attachHeadwearSpriteEffects(root,desc,url=>this.texture(url));await attachHeadwearParticleEffects(root,desc,url=>this.texture(url),{sourceWorld:this.world});if(root.userData.headwearModelEffects?.pending.length||root.userData.headwearSpriteEffects?.pending.length)warnings.push('部分头饰特效仍待补齐');}
    catch(error){this.dispose(root);throw error;}
    root.userData.modelId=id;return {root,desc,warnings:[...new Set(warnings)]};
  }
  dispose(root){if(!root)return;const mats=new Set(),geometries=new Set(),skeletons=new Set(),textures=new Set();root.traverse(n=>{n.userData.submodelPlayer?.dispose();n.userData.leafSpringPlayer?.dispose();n.userData.nstbPlayer?.dispose();n.userData.chainSpringPlayer?.dispose();if(n.isMesh){geometries.add(n.geometry);if(n.skeleton)skeletons.add(n.skeleton);for(const m of Array.isArray(n.material)?n.material:[n.material])mats.add(m);}});for(const g of geometries)g.dispose();for(const m of mats){for(const value of [...Object.values(m),...Object.values(m.userData.uniforms||{}).map(u=>u.value)])if(value?.isTexture&&value.userData.sourceComposite)textures.add(value);m.dispose();}for(const texture of textures)texture.dispose();for(const s of skeletons)s.dispose();}
  async loadAssembly(id,overrides={},assembly=null,poseOffsets=assembly?.poseOffsets){
    const compositeCache=new Map(),model=await this.loadModel(id,assembly?.overrides?.[id]||overrides,compositeCache);
    if(assembly?.additions?.length){
      const loaded=await Promise.allSettled(assembly.additions.map(modelId=>this.loadModel(modelId,assembly.overrides?.[modelId]||{},compositeCache)));
      try{
        const failure=loaded.find(result=>result.status==='rejected');if(failure)throw failure.reason;
        for(const result of loaded){const extra=result.value;attachAssemblyMeshes(THREE,model.root,extra.root,extra.desc,model.desc);model.warnings.push(...extra.warnings);}
      }catch(error){this.dispose(model.root);for(const result of loaded)if(result.status==='fulfilled')this.dispose(result.value.root);throw error;}
    }
    if(assembly?.subModels?.length){
      try{
        for(const row of assembly.subModels){
          let socket;model.root.traverse(n=>{if(belongsToModel(n,model.root)&&(n.userData.sourceBone||n.name)===row.socket)socket=n;});
          if(!socket)throw Error(`缺少服饰附属模型挂点：${row.socket}`);
          const child=await this.loadModel(row.modelId);child.root.userData.sourceSubmodel=true;socket.add(child.root);
          const clips={};for(const [key,player]of Object.entries(row.graph.players))clips[key]=bindMotionClip(await this.loader.loadAsync(player.clip.url),child.root);
          child.root.userData.submodelPlayer=new SourceSubmodel(child.root,row.graph,clips);if(child.desc.sourceLeafSpring)child.root.userData.leafSpringPlayer=new SourceLeafSpringPlayer(child.root,child.desc.sourceLeafSpring);model.warnings.push(...child.warnings);
        }
      }catch(error){this.dispose(model.root);throw error;}
    }
    if(assembly?.vehicleSocketModels?.length){
      try{
        for(const row of assembly.vehicleSocketModels){
          let socket;model.root.traverse(n=>{if(belongsToModel(n,model.root)&&n.userData.sourceSocket&&n.name===row.socket)socket=n;});
          if(!socket)throw Error(`载具原挂点未就绪：${row.socket}`);
          const child=await this.loadModel(row.modelId);
          child.root.userData.sourceSubmodel=true;child.root.userData.vehicleSocket=row.socket;socket.add(child.root);model.warnings.push(...child.warnings);
        }
      }catch(error){this.dispose(model.root);throw error;}
    }
    if(assembly?.vehicleSocketModels?.length&&assembly.pendingEffects?.length){try{await attachVehicleWheelParticles(model.root,assembly.pendingEffects,url=>this.texture(url));}catch(error){this.dispose(model.root);throw error;}}
    if(model.desc.sourceNstb)model.root.userData.nstbPlayer=new SourceNstbPlayer(model.root,model.desc.sourceNstb);
    if(model.desc.sourceChainSpring)model.root.userData.chainSpringPlayer=new SourceChainSpringPlayer(model.root,model.desc.sourceChainSpring);
    if(assembly?.vehicleHoofEffects?.length){try{await attachVehicleHoofModelEffects(model.root,assembly.vehicleHoofEffects,(partId,overrides)=>this.loadModel(partId,overrides),url=>this.texture(url));}catch(error){this.dispose(model.root);throw error;}}
    if(poseOffsets){
      try{
        const clips={};
        for(const [name,row] of Object.entries(poseOffsets.clips))clips[name]=bindMotionClip(await this.loader.loadAsync(row.url),model.root);
        model.root.userData.sourcePartPose=new SourcePartPose(model.root,clips,poseOffsets.selected,poseOffsets.roots);
      }catch(error){this.dispose(model.root);throw error;}
    }
    try{await attachFashionParticleEffects(model.root,assembly?.specialEffects,url=>this.texture(url));}
    catch(error){this.dispose(model.root);throw error;}
    if(assembly)model.root.userData.fragmentAssembly=assembly;
    return model;
  }
  async show(id,overrides={},options={}){
    const token=++this.generation;const model=await this.loadAssembly(id,overrides,options.assembly,options.poseOffsets||options.assembly?.poseOffsets);
    if(token!==this.generation){this.dispose(model.root);return null;}
    this.stopMotion();
    this.clearCompanions();
    this.idleClip=null;this.idleEntry=null;this.idleTime=0;
    this.clearEquipped();if(this.actor){this.world.remove(this.actor);this.dispose(this.actor);}
    this.actor=model.root;this.actor.traverse(n=>{if(n.isBone)n.userData.motionRest={position:n.position.toArray(),quaternion:n.quaternion.toArray(),scale:n.scale.toArray()};});this.descriptor=model.desc;this.world.add(this.actor);this.world.position.set(0,0,0);this.world.updateMatrixWorld(true);
    this.face.reset();this.faceData.then(data=>{if(token===this.generation&&options.defaultFace)this.face.reset(data?.common_blink);});
    const box=new THREE.Box3().setFromObject(this.actor);const size=box.getSize(new THREE.Vector3());const center=box.getCenter(new THREE.Vector3());
    this.world.position.set(-center.x,-box.min.y,-center.z);this.radius=Math.max(size.length()/2,.01);this.height=size.y;
    this.grid.scale.setScalar(Math.max(this.radius/3,.05));
    this.controls.minDistance=this.radius*.02;this.controls.maxDistance=this.radius*200;
    this.updateDepthRange();
    this.fit();this.applyDisplay();return model;
  }
  applySourceDisplayConfig(config={}){
    if(!this.actor)throw new Error('请先载入模型');
    const scale=Number(config.model_scale??1),angle=Number(config.y_rotate_angle??0);
    const position=config.model_pos??[0,0,0];
    if(!Number.isFinite(scale)||scale<=0||!Number.isFinite(angle)||!Array.isArray(position)||position.length!==3||position.some(value=>!Number.isFinite(Number(value))))throw new Error('载具展示变换无效');
    this.actor.scale.setScalar(scale);this.actor.position.fromArray(position.map(Number));this.actor.rotation.set(0,THREE.MathUtils.degToRad(angle),0);
    this.world.position.set(0,0,0);this.world.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(this.actor);const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    if(box.isEmpty()||!Number.isFinite(size.length()))throw new Error('载具展示边界无效');
    this.world.position.set(-center.x,-box.min.y,-center.z);this.radius=Math.max(size.length()/2,.01);this.height=size.y;
    this.grid.scale.setScalar(Math.max(this.radius/3,.05));this.controls.minDistance=this.radius*.02;this.controls.maxDistance=this.radius*200;
    this.updateDepthRange();this.fit();
  }
  fit(){this.controls.target.set(0,(this.height||2)/2,0);const distance=this.radius*3.3*Math.max(1,1/this.camera.aspect);this.camera.position.set(this.radius*.3,(this.height||2)/2+this.radius*.18,distance);this.controls.update();}
  updateDepthRange(){
    const distance=this.camera.position.distanceTo(this.controls.target),r=this.radius;
    this.camera.near=Math.max(r*.0001,distance-r*3);
    this.camera.far=Math.max(r*60,distance+r*20);
    this.camera.updateProjectionMatrix();
  }
  setDistance(factor){const direction=this.camera.position.clone().sub(this.controls.target).normalize();this.camera.position.copy(this.controls.target).addScaledVector(direction,Math.max(.02,Math.min(200,factor))*this.radius);this.controls.update();}
  zoom(multiplier){this.setDistance(this.camera.position.distanceTo(this.controls.target)/this.radius*multiplier);}
  headwearParticleEffects(){const rows=[];this.world.traverse(n=>{const fx=n.userData.headwearParticleEffects;if(fx)rows.push({model:n.userData.modelId,pending:fx.pending,groups:fx.groups.map(g=>({path:g.path,socket:g.socket,elapsed:g.elapsed,ignoredNodes:g.ignoredNodes,systems:g.systems.map(s=>({path:s.path,actionMode:s.node.actionMode,live:s.node.liveCount,births:s.node.totalBirths,preEmission:s.node.preEmissionElapsed,capacity:s.node.capacity,frames:s.node.pool.slice(0,s.node.liveCount).map(p=>p.sourceAtlasFrame),finite:s.mesh.geometry.attributes.position.array.every(Number.isFinite)}))}))});});return rows;}
  headwearSpriteEffects(){const rows=[];this.world.traverse(n=>{const fx=n.userData.headwearSpriteEffects;if(fx)rows.push({model:n.userData.modelId,pending:n.userData.headwearParticleEffects?.pending||fx.pending,nodes:fx.active.map(i=>({path:i.path,socket:i.socket,nodePath:i.nodePath,ignoredNodes:n.userData.headwearParticleEffects?.groups.filter(g=>g.path===i.path).flatMap(g=>g.ignoredNodes)||[],pendingNodes:i.pendingNodes.filter(p=>!n.userData.headwearParticleEffects?.groups.some(g=>g.path===i.path&&(g.systems.some(s=>s.path===p)||g.ignoredNodes.includes(p)))),color:i.mesh.material.uniforms.sourceColor.value.toArray(),matrix:i.mesh.matrix.toArray(),world:i.mesh.matrixWorld.toArray()}))});});return rows;}
  headwearEffects(){const rows=[];this.world.traverse(n=>{const fx=n.userData.headwearModelEffects;if(fx)rows.push({model:n.userData.modelId,elapsed:fx.elapsed,pending:n.userData.headwearParticleEffects?.pending||fx.pending,nodes:fx.active.map(i=>({path:i.path,socket:i.socket,scale:i.scaleValue,parameters:i.parameters,matrix:i.node.matrix.toArray()}))});});return rows;}
  spriteEffects(){const effects=[];this.world.traverse(n=>{if(n.userData.sourceSprite)effects.push({path:n.userData.sourceSprite,position:n.getWorldPosition(new THREE.Vector3()).toArray(),radius:n.geometry.parameters.width/2});});return effects;}
  vehicleSocketState(){const rows=[];this.actor?.traverse(n=>{if(n.userData.vehicleSocket)rows.push({socket:n.userData.vehicleSocket,modelId:n.userData.modelId,parent:n.parent.name,local:n.matrix.toArray(),world:n.matrixWorld.toArray()});});return rows;}
  stats(){let vertices=0,triangles=0,bones=0;this.world.traverse(n=>{if(n.isMesh){vertices+=n.geometry.attributes.position?.count||0;triangles+=(n.geometry.index?.count||n.geometry.attributes.position?.count||0)/3;}if(n.isBone)bones++;});return {vertices,triangles:Math.round(triangles),bones,distance:this.camera.position.distanceTo(this.controls.target)/this.radius,range:[.02,200],equipped:this.equipped.size};}
  async equip(slot,item,variant){
    if(!this.actor)throw new Error('请先选择角色');
    if(['hair','upper','lower'].includes(slot))throw new Error('部件替换与遮挡规则待验证；当前仅支持单品预览');
    const token=this.generation;const highQuality=Boolean(this.descriptor?.capabilities?.previewQuality);const id=highQuality?(variant.preview||variant.runtime):(variant.runtime||variant.preview);if(!id)throw new Error('配饰几何资源缺失');
    const obj=await this.loadModel(id,modelTextureOverrides(item,variant,id));
    if(token!==this.generation){this.dispose(obj.root);throw new Error('角色已切换，请重新装配');}
    const names=Array.isArray(item.socket)?item.socket:[];
    const bones=new Map();this.actor.traverse(n=>{if(n.isBone&&belongsToModel(n,this.actor))bones.set(n.userData.sourceBone||n.name,n);});
    let method='';const skinned=[];obj.root.traverse(n=>{if(n.isSkinnedMesh)skinned.push(n);});
    const socket=names.map(n=>bones.get(n)||this.actor.getObjectByName(n)).find(Boolean);
    if(socket){
      socket.add(obj.root);method=`挂点 ${socket.userData.sourceBone||socket.name}`;
    }else if(!names.length&&skinned.length&&skinned.every(m=>m.skeleton.bones.every(b=>bones.has(b.userData.sourceBone||b.name)))){
      obj.root.updateMatrixWorld(true);
      for(const m of skinned){const skeleton=new THREE.Skeleton(m.skeleton.bones.map(b=>bones.get(b.userData.sourceBone||b.name)),m.skeleton.boneInverses.map(x=>x.clone()));m.bind(skeleton,m.bindMatrix.clone());}
      this.world.add(obj.root);method='共享同名骨骼';
    }else{
      this.dispose(obj.root);throw new Error(`未找到源挂点：${names.join(' / ')||'配置未提供'}。可切换到单品预览。`);
    }
    this.removeSlot(slot);this.equipped.set(slot,{...obj,itemId:item.id,variantId:variant.id,method});this.applyDisplay();this.onChange?.(this.stats());return method;
  }
  removeSlot(slot){const old=this.equipped.get(slot);if(old){old.root.removeFromParent();this.dispose(old.root);this.equipped.delete(slot);}this.onChange?.(this.stats());}
  clearEquipped(){for(const slot of [...this.equipped.keys()])this.removeSlot(slot);}
  async showCompanion(key,id,{position=[0,0,0],animation=null}={}){
    if(!this.actor)throw new Error('请先选择角色');
    this.companions??=new Map();this.companionGeneration??=0;
    const token=++this.companionGeneration,actor=this.actor;
    const results=await Promise.allSettled([this.loadModel(id),animation?.url?this.loader.loadAsync(animation.url):Promise.resolve(null)]);
    if(results[0].status==='rejected')throw results[0].reason;
    const model=results[0].value;
    if(results[1].status==='rejected'){this.dispose(model.root);throw results[1].reason;}
    if(token!==this.companionGeneration||actor!==this.actor){this.dispose(model.root);return null;}
    this.removeCompanion(key,false);
    model.root.position.fromArray(position.map(Number));
    let mixer=null;
    if(results[1].value){
      const clip=bindMotionClip(results[1].value,model.root);mixer=new THREE.AnimationMixer(model.root);
      const action=mixer.clipAction(clip);action.setLoop(animation.properties?.DefaultLoop==='false'?THREE.LoopOnce:THREE.LoopRepeat,Infinity);action.clampWhenFinished=true;action.timeScale=Number(animation.properties?.DefaultRate)||1;action.play();mixer.update(0);
    }
    this.world.add(model.root);this.companions.set(key,{...model,mixer});this.applyDisplay();this.frameVisible(32);return model;
  }
  async showMotionCompanion(key,id,item,rows,{position=[0,0,0],angle=0,scale=1,overrides={},idle=null,idleTime=0,assembly=null}={}){
    if(!this.actor)throw new Error('请先选择角色');
    const entries=resolveMotionEntries(item,rows);
    if(item.rule.anim_layer===1&&!idle?.url)throw new Error('多人叠加动作缺少基础待机片段');
    this.companions??=new Map();this.companionGeneration??=0;
    const token=++this.companionGeneration,actor=this.actor;
    const results=await Promise.allSettled([this.loadAssembly(id,overrides,assembly),Promise.all([...entries.map(entry=>this.loader.loadAsync(entry.url)),...(item.rule.anim_layer===1?[this.loader.loadAsync(idle.url)]:[])])]);
    if(results[0].status==='rejected')throw results[0].reason;
    const model=results[0].value;
    if(results[1].status==='rejected'){this.dispose(model.root);throw results[1].reason;}
    if(token!==this.companionGeneration||actor!==this.actor){this.dispose(model.root);return null;}
    this.removeCompanion(key,false);
    model.root.position.fromArray(position.map(Number));model.root.rotation.set(0,THREE.MathUtils.degToRad(Number(angle)||0),0);
    model.root.scale.setScalar(scale);
    const loaded=results[1].value,idleClip=item.rule.anim_layer===1?bindMotionClip(loaded.pop(),model.root):null;
    const clips=loaded.map(gltf=>bindMotionClip(gltf,model.root));
    let sequence=null,mixer=null,action=null;
    if(item.rule.anim_layer===1)sequence=new SourceOverlayMotion(model.root,idleClip,clips.length===1?clips[0]:clips,item.rule,{baseTime:idleTime,baseRate:Number(idle.properties?.DefaultRate)||1});
    else if(clips.length===2)sequence=new SourceMotionSequence(model.root,clips,item.rule);
    else{
      mixer=new THREE.AnimationMixer(model.root);action=mixer.clipAction(clips[0]);
      action.setLoop(sourceMotionRepeats(item.rule)?THREE.LoopRepeat:THREE.LoopOnce,Infinity);action.clampWhenFinished=true;
      action.timeScale=(Number(entries[0].properties?.DefaultRate)||1)*Math.max(0,Number(item.rule.anim_play_speed??1));action.play();mixer.update(0);
    }
    let extra;
    try{extra=await this.loadMotionExtras(item,model.root);if(item.rule.extra_model_infos?.length&&extra.groups.length!==item.rule.extra_model_infos.length)throw new Error(extra.warnings.join('；')||'接收角色附件加载失败');}
    catch(error){mixer?.stopAllAction();sequence?.stop?.();this.dispose(model.root);throw error;}
    if(token!==this.companionGeneration||actor!==this.actor){this.disposeMotionExtras(extra.groups);mixer?.stopAllAction();sequence?.stop?.();this.dispose(model.root);return null;}
    for(const group of extra.groups)group.socket.add(group.root);
    this.world.add(model.root);this.companions.set(key,{...model,mixer,action,sequence,motionParticipant:true,motionExtras:extra.groups,sourceSpeed:Math.max(0,Number(item.rule.anim_play_speed??1))*(Number(entries[0].properties?.DefaultRate)||1)});
    this.applyDisplay();this.frameVisible(0);return model;
  }
  beginMultiLayout(config){
    if(!this.actor)throw new Error('请先选择角色');
    const layout=config.previewLayout;
    if(layout?.rule!=='source-bag-dual-v1'||![layout.scale,layout.sendX,layout.receiveX,layout.sendAngle,layout.receiveAngle].every(Number.isFinite)||layout.scale<=0)throw new Error('多人预览站位配置尚未接入');
    this.clearMultiMotion();
    this.multiActorTransform={position:this.actor.position.toArray(),quaternion:this.actor.quaternion.toArray(),scale:this.actor.scale.toArray()};
    this.actor.position.x+=layout.sendX;
    this.actor.rotation.set(0,THREE.MathUtils.degToRad(layout.sendAngle),0);
    this.actor.scale.setScalar(layout.scale);
    return {sendPosition:this.actor.position.toArray(),receivePosition:[this.multiActorTransform.position[0]+layout.receiveX,this.actor.position.y,this.actor.position.z],receiveAngle:layout.receiveAngle,scale:layout.scale};
  }
  clearMultiMotion(){
    for(const [key,companion] of [...this.companions])if(companion.motionParticipant)this.removeCompanion(key,false);
    if(this.actor&&this.multiActorTransform){
      this.actor.position.fromArray(this.multiActorTransform.position);this.actor.quaternion.fromArray(this.multiActorTransform.quaternion);this.actor.scale.fromArray(this.multiActorTransform.scale);
      this.multiActorTransform=null;this.frameVisible();
    }
  }
  removeCompanion(key,invalidate=true){
    this.companions??=new Map();this.companionGeneration??=0;if(invalidate)this.companionGeneration++;
    const companion=this.companions.get(key);if(!companion)return;
    this.disposeMotionExtras(companion.motionExtras);companion.sequence?.stop?.();companion.mixer?.stopAllAction();companion.mixer?.uncacheRoot(companion.root);companion.root.removeFromParent();this.dispose(companion.root);this.companions.delete(key);if(this.actor&&!this.companions.size&&!this.multiActorTransform)this.frameVisible();
  }
  clearCompanions(){this.companions??=new Map();this.companionGeneration=(this.companionGeneration??0)+1;for(const key of [...this.companions.keys()])this.removeCompanion(key,false);if(this.actor&&this.multiActorTransform){this.actor.position.fromArray(this.multiActorTransform.position);this.actor.quaternion.fromArray(this.multiActorTransform.quaternion);this.actor.scale.fromArray(this.multiActorTransform.scale);this.multiActorTransform=null;}}
  frameVisible(azimuth=0){
    if(!this.actor)return;
    this.world.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(this.actor);for(const companion of this.companions.values())box.expandByObject(companion.root);
    this.frameBounds(box,azimuth);
  }
  frameBounds(box,azimuth=0){
    if(box.isEmpty())return;const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    this.radius=Math.max(size.length()/2,.01);this.height=size.y;this.grid.scale.setScalar(Math.max(this.radius/3,.05));
    this.controls.minDistance=this.radius*.02;this.controls.maxDistance=this.radius*200;this.controls.target.copy(center);
    const angle=THREE.MathUtils.degToRad(azimuth),distance=this.radius*3.3*Math.max(1,1/this.camera.aspect);
    this.camera.position.set(center.x+Math.sin(angle)*distance,center.y+this.radius*.18,center.z+Math.cos(angle)*distance);this.updateDepthRange();this.controls.update();
  }
  applyDisplay(){this.world.traverse(n=>{if(n.isMesh)for(const m of Array.isArray(n.material)?n.material:[n.material]){m.wireframe=this.wireframe;m.emissiveIntensity=(m.userData.baseEmission||0)*this.emission;
    m.transparent=this.alphaMode==='blend'||(this.alphaMode==='source'&&m.userData.baseTransparent);
    m.alphaTest=this.alphaMode==='cutout'?.1:this.alphaMode==='source'?(m.userData.baseAlphaTest||0):0;
    m.depthWrite=this.alphaMode==='source'?(m.userData.baseDepthWrite??true):!m.transparent;
    m.depthTest=this.alphaMode==='source'?(m.userData.baseDepthTest??true):true;
    m.blending=this.alphaMode==='source'?(m.userData.baseBlending??THREE.NormalBlending):THREE.NormalBlending;
    if(m.userData.uniforms?.neoEmissionScale)m.userData.uniforms.neoEmissionScale.value=this.emission;
    m.needsUpdate=true;}});}
  wheelEffects(){const result=[];this.actor?.traverse(n=>{const fx=n.userData.wheelParticles;if(fx)result.push({source:fx.source,socket:fx.socket,elapsed:fx.elapsed,trails:fx.trails.systems.map(s=>({path:s.spec.controllerPath,rows:s.rows,drawCount:s.mesh.geometry.drawRange.count,finite:s.mesh.geometry.attributes.position.array.every(Number.isFinite),colorStyle:s.colorStyle})),systems:fx.systems.map(s=>({path:s.original.path,live:s.node.liveCount,births:s.node.totalBirths,actionMode:s.node.actionMode,atlasFrame:s.lastAtlasFrame,atlasCount:s.atlas.frames.length,blend:s.blendMode,drawCount:s.mesh.geometry.drawRange.count,finite:s.mesh.geometry.attributes.position.array.every(Number.isFinite)}))});});return result;}
  fashionEffects(){const result=[];this.actor?.traverse(n=>{const fx=n.userData.fashionParticles;if(fx)result.push({profile:fx.profile,elapsed:fx.elapsed,systems:fx.systems.map(s=>({path:s.controller.path,live:s.node.liveCount,capacity:s.node.capacity,actionMode:s.node.actionMode,drawCount:s.mesh.geometry.drawRange.count,position:s.controller.world.translation,finite:[...s.mesh.geometry.attributes.position.array].every(Number.isFinite)}))});});return result;}
  render(){
    const poses=[];this.world.traverse(n=>{if(n.userData.sourcePartPose)poses.push(n.userData.sourcePartPose);});
    try{for(const pose of poses)pose.apply();this.scene.updateMatrixWorld(true);const dt=this.particleDelta||0;this.particleDelta=0;if(dt>0)this.world.traverse(n=>{n.userData.nstbPlayer?.update(dt);n.userData.chainSpringPlayer?.update(dt);n.userData.leafSpringPlayer?.update(dt);});this.updatePreviewFraming?.();this.world.traverse(n=>n.userData.headwearParticleEffects?.update(dt,this.camera));this.world.traverse(n=>n.userData.fashionParticles?.update(dt,this.camera));this.world.traverse(n=>n.userData.wheelParticles?.update(dt,this.camera));this.world.traverse(n=>n.userData.sourceHoofModelEffects?.render(this.camera,dt));this.materialShadow.update(this.sourceLightingProfile==='authored-bag');this.refraction.render(this.renderer,this.scene,this.camera);}
    finally{for(const pose of poses)pose.restore();}
  }
  screenshot(){this.render();return this.renderer.domElement.toDataURL('image/png');}
  setVehicleLoop(sequence){
    if(sequence.length!==1||!this.action)throw Error('Unsupported vehicle loop sequence');
    const row=sequence[0],period=Number(row.continueTime??3.83);
    if(!(period>0&&Number.isFinite(period)))throw Error('Invalid vehicle loop interval');
    this.action.setLoop(row.loop?THREE.LoopRepeat:THREE.LoopOnce,row.loop?Infinity:1);
    this.vehicleLoop={action:this.action,period,elapsed:0,dispatches:1,loop:!!row.loop};
  }
  updateVehicleLoop(dt){
    const clock=this.vehicleLoop;if(!clock)return;
    if(clock.action!==this.action){this.vehicleLoop=null;return;}
    // VehicleLoopAnimSupport re-registers its callback after each dispatch;
    // missed intervals do not produce a burst of callbacks.
    clock.elapsed+=dt;
    if(clock.elapsed>=clock.period){clock.elapsed=0;clock.dispatches++;clock.action.reset().play();}
  }
  async playMotion(entry,{rememberIdle=false}={}){
    this.vehicleLoop=null;
    if(!this.actor||!entry.url)throw new Error('动作资源不可用');
    this.clearMotionExtras();
    const token=++this.animationGeneration,actor=this.actor;
    const gltf=await this.loader.loadAsync(entry.url);if(token!==this.animationGeneration||actor!==this.actor)return;
    const clip=bindMotionClip(gltf,actor);this.motionSequence?.stop?.();this.motionSequence=null;
    this.mixer?.stopAllAction();this.mixer?.uncacheRoot(actor);this.mixer=new THREE.AnimationMixer(actor);
    this.action=this.mixer.clipAction(clip);this.action.setLoop(entry.properties?.DefaultLoop==='false'?THREE.LoopOnce:THREE.LoopRepeat,Infinity);this.action.clampWhenFinished=true;
    this.action.timeScale=Number(entry.properties?.DefaultRate)||1;this.action.play();this.motionEntry=entry;this.playingIdle=rememberIdle;
    if(rememberIdle){this.idleClip=clip;this.idleEntry=entry;this.idleTime=0;}
    this.mixer.update(0);
  }
  async playEntranceThenIdle(entrance,idle){
    if(!this.actor||!entrance?.url)throw new Error('入场动作资源不可用');
    this.clearMotionExtras();
    const token=++this.animationGeneration,actor=this.actor;
    const loaded=await Promise.all([this.loader.loadAsync(entrance.url),idle?.url?this.loader.loadAsync(idle.url):null]);
    if(token!==this.animationGeneration||actor!==this.actor)return false;
    const entranceClip=bindMotionClip(loaded[0],actor),idleClip=loaded[1]?bindMotionClip(loaded[1],actor):null;
    this.motionSequence?.stop?.();this.motionSequence=null;
    this.mixer?.stopAllAction();this.mixer?.uncacheRoot(actor);const mixer=new THREE.AnimationMixer(actor);this.mixer=mixer;
    const action=mixer.clipAction(entranceClip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;
    action.timeScale=Number(entrance.properties?.DefaultRate)||1;action.play();this.action=action;this.motionEntry=entrance;this.playingIdle=false;
    this.idleClip=idleClip;this.idleEntry=idle||null;this.idleTime=0;
    const finished=()=>{
      mixer.removeEventListener('finished',finished);
      if(token!==this.animationGeneration||this.mixer!==mixer||this.action!==action)return;
      if(!idleClip){this.stopMotion();return;}
      const idleAction=mixer.clipAction(idleClip);idleAction.setLoop(idle.properties?.DefaultLoop==='false'?THREE.LoopOnce:THREE.LoopRepeat,Infinity);idleAction.clampWhenFinished=true;
      idleAction.timeScale=Number(idle.properties?.DefaultRate)||1;idleAction.play();this.action=idleAction;this.motionEntry=idle;this.playingIdle=true;mixer.update(0);
    };
    mixer.addEventListener('finished',finished);mixer.update(0);return true;
  }
  async playMotionItem(item,rows,catalogPath){
    if(!this.runtimePolicy?.sharedMotionCatalogPath||catalogPath!==this.runtimePolicy.sharedMotionCatalogPath)throw new Error('此角色的动作编排图尚未接入');
    const entries=resolveMotionEntries(item,rows);
    if(!this.actor)throw new Error('请先选择角色');
    this.clearMotionExtras();this.motionExtraWarnings=[];
    const token=++this.animationGeneration,actor=this.actor;
    // Keep extras detached until actor bindings are captured: props often use
    // identical bone names and must never become actor animation targets.
    const results=await Promise.allSettled([
      Promise.all(entries.map(entry=>this.loader.loadAsync(entry.url))),
      this.loadMotionExtras(item,actor),
    ]);
    const extra=results[1].status==='fulfilled'?results[1].value:{groups:[],warnings:['附件加载失败']};
    if(token!==this.animationGeneration||actor!==this.actor||results[0].status==='rejected'){
      this.disposeMotionExtras(extra.groups);
      if(token===this.animationGeneration&&results[0].status==='rejected')throw results[0].reason;
      return;
    }
    const loaded=results[0].value;
    let clips,sequence=null,action=null,mixer=null;
    try{
      clips=loaded.map(gltf=>bindMotionClip(gltf,actor));
      this.motionSequence?.stop?.();this.mixer?.stopAllAction();if(this.mixer)this.mixer.uncacheRoot(this.mixer.getRoot());
      if(item.rule.anim_layer===1){
        if(!this.idleClip)throw new Error('上身动作需要当前角色的自动待机片段');
        sequence=new SourceOverlayMotion(actor,this.idleClip,clips.length===1?clips[0]:clips,item.rule,{baseTime:this.idleTime,baseRate:Number(this.idleEntry?.properties?.DefaultRate)||1});
      }else if(clips.length===2)sequence=new SourceMotionSequence(actor,clips,item.rule);
      else{
        mixer=new THREE.AnimationMixer(actor);action=mixer.clipAction(clips[0]);
        action.setLoop(sourceMotionRepeats(item.rule)?THREE.LoopRepeat:THREE.LoopOnce,Infinity);
        action.clampWhenFinished=true;action.timeScale=(Number(entries[0].properties?.DefaultRate)||1)*Math.max(0,Number(item.rule.anim_play_speed??1));action.play();mixer.update(0);
        if(Number(item.rule.auto_stop)===1)mixer.addEventListener('finished',()=>{if(this.mixer===mixer&&this.action===action)this.stopMotion();});
      }
    }
    catch(error){this.disposeMotionExtras(extra.groups);throw error;}
    this.mixer=mixer;this.action=action;
    this.motionSequence=sequence;this.playingIdle=false;
    this.motionExtras=extra.groups;this.motionExtraWarnings=extra.warnings;
    for(const group of extra.groups)group.socket.add(group.root);
    this.applyDisplay();
    this.motionEntry={name:item.animKey,properties:entries[0].properties,sourceSpeed:Math.max(0,Number(item.rule.anim_play_speed??1))};return true;
  }
  async loadMotionExtras(item,actor){
    if(!item.rule.extra_model_infos?.length)return {groups:[],warnings:[]};
    this.motionExtraCatalog??=requestJSON('/data/action-extras.json').then(r=>{if(!r.ok)throw new Error('附件目录不可用');return r.json();});
    const catalogRow=(await this.motionExtraCatalog).items[String(item.id)];
    const row=catalogRow?.roles?.[item.animKey]||
      (catalogRow?.animKey===item.animKey?catalogRow:null);
    if(row?.status!=='ready')return {groups:[],warnings:['附件资源或编排尚未完整还原']};
    const bones=new Map();actor.traverse(n=>{if(n.isBone&&belongsToModel(n,actor))bones.set(n.userData.sourceBone||n.name,n);});
    const loaded=await Promise.allSettled(row.extras.map(async entry=>{
      const rule=entry.rule,socket=rule.extra_model_socket?(bones.get(rule.extra_model_socket)||actor.getObjectByName(rule.extra_model_socket)):actor.parent;
      if(!socket)throw new Error(`缺少附件挂点：${rule.extra_model_socket}`);
      const additive=rule.extra_model_enable_addpose&&entry.playback==='graph-additive-appear-loop'&&entry.graphAnimations?.length===3;
      if((rule.extra_model_enable_addpose&&!additive)||rule.extra_model_anim_type!=null||rule.extra_model_mtg_path||rule.extra_model_paint_infos)
        throw new Error('此附件的特殊变换或动画规则尚未接入');
      const model=await this.loadModel(entry.modelId);
      try{
        const gltfs=await Promise.all([...entry.animations,...(entry.graphAnimations||[])].map(a=>this.loader.loadAsync(a.url)));
        const bound=gltfs.map(g=>bindMotionClip(g,model.root)),clips=bound.slice(0,entry.animations.length),graphClips=bound.slice(entry.animations.length);
        model.root.scale.setScalar(rule.extra_model_scale??1);
        if(rule.extra_model_offset)model.root.position.fromArray(rule.extra_model_offset);
        else if(!rule.extra_model_socket)model.root.position.copy(actor.position);
        if(!rule.extra_model_socket)model.root.quaternion.copy(actor.quaternion);
        if(rule.extra_model_angle)applySourceExtraAngle(model.root,rule.extra_model_angle);
        const playback=additive?new SourceAdditiveMotionExtra(model.root,clips,graphClips):new SourceMotionExtra(model.root,clips,entry.playback);
        return {...model,socket,playback};
      }catch(error){this.dispose(model.root);throw error;}
    }));
    const groups=loaded.filter(r=>r.status==='fulfilled').map(r=>r.value),failed=loaded.find(r=>r.status==='rejected');
    if(failed){this.disposeMotionExtras(groups);return {groups:[],warnings:[failed.reason.message]};}
    return {groups,warnings:[...new Set(groups.flatMap(g=>g.warnings))]};
  }
  nstbState(){const rows=[];this.world.traverse(n=>{if(n.userData.nstbPlayer)rows.push(n.userData.nstbPlayer.state());});return rows;}
  chainSpringState(){const rows=[];this.world.traverse(n=>{if(n.userData.chainSpringPlayer)rows.push(n.userData.chainSpringPlayer.state());});return rows;}
  leafSpringState(){const rows=[];this.world.traverse(n=>{if(n.userData.leafSpringPlayer)rows.push(n.userData.leafSpringPlayer.state());});return rows;}
  submodelState(){
    const rows=[];this.world.traverse(n=>{const player=n.userData.submodelPlayer;if(player)rows.push({modelId:n.userData.modelId,state:player.graph.states[player.state].name,times:{...player.times},weights:{...player.weights}});});return rows;
  }
  updateSubModels(dt){
    const paused=this.motionSequence?.paused??this.action?.paused??false;
    this.world.traverse(n=>{if(n.userData.submodelPlayer)n.userData.submodelPlayer.update(dt,this.submodelVariables||{},paused||this.mixer?.timeScale===0);});
  }
  updateMotionExtras(dt){
    const p=this.motionSequence,rate=p?p.sourceSpeed*p.rate:(this.action?.timeScale??1),paused=p?.paused??this.action?.paused??true;
    for(const g of this.motionExtras||[])g.playback.update(dt,rate,paused);
    for(const participant of this.companions.values()){
      const playback=participant.sequence||participant.action;
      const extraRate=participant.sequence?participant.sequence.sourceSpeed*participant.sequence.rate:(participant.action?.timeScale??1);
      for(const g of participant.motionExtras||[])g.playback.update(dt,extraRate,playback?.paused??true);
    }
  }
  disposeMotionExtras(groups){for(const g of groups||[]){g.playback.stop();g.root.removeFromParent();this.dispose(g.root);}}
  clearMotionExtras(){this.disposeMotionExtras(this.motionExtras);this.motionExtras=[];}
  setMotionSpeed(rate){const value=Math.max(0,Number(rate));if(!Number.isFinite(value))return;this.motionRate=value;if(this.motionSequence)this.motionSequence.rate=value;else if(this.action)this.action.timeScale=value*(Number(this.motionEntry?.properties?.DefaultRate)||1)*(this.motionEntry?.sourceSpeed??1);for(const participant of this.companions.values())if(participant.motionParticipant){if(participant.sequence)participant.sequence.rate=value;else if(participant.action)participant.action.timeScale=value*(participant.sourceSpeed??1);}}
  pauseMotion(){const playback=this.motionSequence||this.action;if(!playback)return;playback.paused=!playback.paused;for(const participant of this.companions.values())if(participant.motionParticipant){if(participant.sequence)participant.sequence.paused=playback.paused;else if(participant.action)participant.action.paused=playback.paused;}}
  seekMotion(fraction){const f=THREE.MathUtils.clamp(fraction,0,1);if(this.motionSequence){const time=f*this.motionSequence.duration;this.motionSequence.seek(time);for(const g of this.motionExtras||[])g.playback.seek(time);}else if(this.action){const time=f*this.action.getClip().duration;this.action.time=time;this.mixer.update(0);for(const g of this.motionExtras||[])g.playback.seek(time);}for(const participant of this.companions.values())if(participant.motionParticipant){if(participant.sequence)participant.sequence.seek(f*participant.sequence.duration);else if(participant.action){participant.action.time=f*participant.action.getClip().duration;participant.mixer.update(0);}const time=participant.sequence?.time??participant.action?.time??0;for(const g of participant.motionExtras||[])g.playback.seek(time);}}
  stopMotion(){this.vehicleLoop=null;this.animationGeneration++;this.clearMotionExtras();this.motionSequence?.stop?.();this.motionSequence=null;this.mixer?.stopAllAction();if(this.mixer)this.mixer.uncacheRoot(this.mixer.getRoot());this.mixer=null;this.action=null;this.motionEntry=null;this.motionRate=1;this.playingIdle=false;}
  motionState(){const p=this.motionSequence;return {vehicleLoop:this.vehicleLoop?{period:this.vehicleLoop.period,dispatches:this.vehicleLoop.dispatches,elapsed:this.vehicleLoop.elapsed}:null,name:this.motionEntry?.name||'',time:p?.time??this.action?.time??0,duration:p?.duration??this.action?.getClip().duration??0,paused:p?.paused??this.action?.paused??true,rate:this.motionRate,phase:p?.sequencePhase||p?.phase||'clip',blendPhase:p?.phase,controller:p?.controllerType,fullBodyBlendTime:p?.fullBodyBlendTime};}
  motionExtraState(){
    const read=(group,owner)=>{
      group.root.updateMatrixWorld(true);
      const world=group.root.getWorldPosition(new THREE.Vector3());
      return {modelId:group.modelId||group.root.userData.modelId||null,socket:group.socket?.name||group.socket?.userData?.sourceBone||null,localPosition:group.root.position.toArray(),worldPosition:world.toArray(),finite:group.root.matrixWorld.elements.every(Number.isFinite),elapsed:group.playback?.elapsed??0,phase:group.playback?.phase||'static',owner};
    };
    return [...(this.motionExtras||[]).map(group=>read(group,'sender')),...[...this.companions.values()].flatMap(row=>(row.motionExtras||[]).map(group=>read(group,'receiver')))];
  }
  setMotionLoop(repeat){
    const apply=action=>{if(action)action.setLoop(repeat?THREE.LoopRepeat:THREE.LoopOnce,repeat?Infinity:1);};
    apply(this.action);
    for(const participant of this.companions.values())if(participant.motionParticipant)apply(participant.action);
  }
  multiMotionState(){
    const actorBones=new Set();this.actor?.traverse(n=>{if(n.isBone)actorBones.add(n);});
    const participants=[...this.companions.entries()].filter(([,row])=>row.motionParticipant).map(([key,row])=>{
      let boneCount=0,sharedBoneCount=0;
      row.root.traverse(n=>{if(n.isBone){boneCount++;if(actorBones.has(n))sharedBoneCount++;}});
      return {key,modelId:row.root.userData.modelId,assemblyParts:row.root.userData.fragmentAssembly?.parts||null,
        boneCount,sharedBoneCount,extraCount:row.motionExtras?.length||0,
        extraTimes:(row.motionExtras||[]).map(g=>g.playback.elapsed),position:row.root.position.toArray(),
        angle:THREE.MathUtils.radToDeg(row.root.rotation.y),time:row.sequence?.time??row.action?.time??0,
        paused:row.sequence?.paused??row.action?.paused??true,
        rate:row.sequence?.rate??(row.action&&row.sourceSpeed?row.action.timeScale/row.sourceSpeed:1)};
    });
    return {actorPosition:this.actor?.position.toArray()||null,actorAngle:this.actor?THREE.MathUtils.radToDeg(this.actor.rotation.y):null,participants};
  }
  destroy(){this.generation++;this.stopMotion();this.clearCompanions();this.renderer.setAnimationLoop(null);this.observer.disconnect();this.controls.dispose();this.clearEquipped();this.dispose(this.actor);this.actor=null;for(const promise of this.textureCache.values())promise.then(t=>t.dispose()).catch(()=>{});this.materialShadow.dispose();this.refraction.dispose();this.renderer.dispose();}
}
