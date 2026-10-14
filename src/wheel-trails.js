import * as THREE from 'three';
import {createSourceSfxTrail} from './source-sfx-trail.js';
import {createSourceSfxFloatCurve,createSourceSfxPackedColorCurve} from './source-sfx-curves.js';
import {sourceSfxInheritTransform} from './source-sfx-controller.js';
import {readSourceSfxDistanceFade} from './source-sfx-base-reader.js';
import {sourceSfxDistanceFade} from './source-sfx-node.js';
import {createFashionParticleMaterial} from './fashion-particle-effects.js';
const f=Math.fround;
const packed=c=>{const v=c.map(x=>Math.round(x*255));return ((v[3]<<24)|(v[0]<<16)|(v[1]<<8)|v[2])>>>0;};
function sourceTRS(matrix){
 const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();matrix.decompose(p,q,s);
 const r=new THREE.Matrix4().makeRotationFromQuaternion(q).elements;
 return {translation:p.toArray().map(f),scale:s.toArray().map(f),rotation:[...r.slice(0,3),...r.slice(4,7),...r.slice(8,11)].map(f),flags:2};
}

export async function attachWheelTrails(root,socket,effect,controllers,loadTexture){
 const group=new THREE.Group();group.name='source-wheel-trails';group.matrixAutoUpdate=false;root.add(group);
 const systems=[];
 for(const spec of effect.trails||[]){
  const a=spec.sourceAttributes;
  if(spec.profile!=='source-wheel-trail-v1'||a.ParentLevel!=='0'||a.Alignment!=='0'||a.TexStyle!=='0'||a.TextureClockRotate!=='1'||!['0','1'].includes(a.ColorStyle)||a.BlendMode!=='0'||spec.image.kind!=='2d')throw Error('Unsupported wheel trail branch');
  const controller=controllers.get(spec.controllerPath);if(!controller)throw Error('Wheel trail controller missing');
  const color=createSourceSfxPackedColorCurve(spec.color),colorCache=Array.from({length:100},(_,i)=>packed(color(f(f(1/100)*i))));
  const trail=createSourceSfxTrail({...spec,colorCache,colorCacheEpsilon:f(.48),widthCurve:spec.widthCurve.frames.length?createSourceSfxFloatCurve(spec.widthCurve):()=>1});
  const geometry=new THREE.BufferGeometry();
  for(const [key,size] of [['position',3],['uv',2],['particleColor',4]])geometry.setAttribute(key,new THREE.BufferAttribute(new Float32Array(spec.maxNodes*2*size),size).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(Array.from({length:spec.maxNodes-1},(_,i)=>[0,1,2,1,3,2].map(v=>v+i*2)).flat());geometry.setDrawRange(0,0);
  const material=createFashionParticleMaterial(await loadTexture(spec.image.url));material.blendDst=material.blendDstAlpha=THREE.OneMinusSrcAlphaFactor;
  delete material.userData.sourceFashionParticle;material.userData.sourceWheelTrail=true;
  const mesh=new THREE.Mesh(geometry,material);mesh.name='source-wheel-trail';mesh.frustumCulled=false;group.add(mesh);
  systems.push({spec,controller,trail,mesh,color,colorStyle:Number(a.ColorStyle),effectLife:f(Number(a.FxLifeSpan)),distanceFade:readSourceSfxDistanceFade(a),rows:0,initialized:false});
 }
 const state={systems,elapsed:0,update(dt,camera){
  if(!root.parent)throw Error('Wheel world-space trail requires the actor world');
  this.elapsed=f(this.elapsed+dt);camera.updateMatrixWorld();
  // ParentLevel0 keeps history in source scene space. Cancel the current actor
  // transform at render, so moving the actor cannot drag its older sections.
  const sourceWorldInverse=root.parent.matrixWorld.clone().invert();
  group.matrix.copy(root.matrix).invert();group.updateMatrixWorld(true);
  const attachment=sourceTRS(sourceWorldInverse.clone().multiply(socket.matrixWorld));
  const view=new THREE.Vector3(0,0,1).transformDirection(camera.matrixWorld).transformDirection(sourceWorldInverse).toArray();
  const eye=camera.getWorldPosition(new THREE.Vector3()).applyMatrix4(sourceWorldInverse).toArray();
  for(const s of systems){
   const w=sourceSfxInheritTransform(s.controller.world,attachment,7);
   if(!s.initialized){s.trail.state.previousPosition=w.translation.map(f);s.trail.state.previousAxis=w.rotation.slice(6,9).map(f);s.initialized=true;}
   if(dt>0)s.trail.update(dt,{position:w.translation,axis:w.rotation.slice(3,6),orientation:w.rotation.slice(6,9),scale:w.scale[0],view});
   const rows=s.trail.ribbon(),g=s.mesh.geometry;
   if(rows.length>s.spec.maxNodes)throw Error('Source wheel trail capacity exceeded');
   // 2b799b4..d0 samples ColorStyle1 at node time/FxLifeSpan; direct and
   // cubic rows copy that one packed color (2b79048 / 2b7951c).
   const wholeColor=s.colorStyle===1?packed(s.color(f(this.elapsed/s.effectLife))):null;
   const fade=sourceSfxDistanceFade({distanceFade:s.distanceFade,position:w.translation},eye);
   rows.forEach((r,i)=>{
    g.attributes.position.array.set(r.positions,i*6);g.attributes.uv.array.set(r.uv,i*4);
    const c=wholeColor??r.color,alpha=Math.trunc(f(f(c>>>24)*fade))/255;
    const color=[(c>>>16&255)/255,(c>>>8&255)/255,(c&255)/255,alpha];
    g.attributes.particleColor.array.set(color,i*8);g.attributes.particleColor.array.set(color,i*8+4);
   });
   s.rows=rows.length;g.setDrawRange(0,Math.max(0,rows.length-1)*6);for(const a of Object.values(g.attributes))a.needsUpdate=true;
  }
 }};group.userData.wheelTrails=state;return state;
}
