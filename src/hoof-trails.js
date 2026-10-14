import * as THREE from 'three';
import {createSourceSfxTrail} from './source-sfx-trail.js';
import {createSourceSfxFloatCurve,createSourceSfxPackedColorCurve} from './source-sfx-curves.js';
import {createFashionParticleMaterial} from './fashion-particle-effects.js';
const f=Math.fround;
export async function attachHoofTrails(group,effect,controllers,loadTexture){
 const systems=[];
 for(const spec of effect.trails){
  if(spec.profile!=='source-hoof-trail-v1'||spec.sourceAttributes.ParentLevel!=='1'||spec.sourceAttributes.Alignment!=='0'||spec.sourceAttributes.TexStyle!=='0'||spec.sourceAttributes.TextureClockRotate!=='1'||spec.image.kind!=='2d')throw Error('Unsupported hoof trail branch');
  const controller=controllers.get(spec.controllerPath);if(!controller)throw Error('Trail controller missing');
  const color=createSourceSfxPackedColorCurve(spec.color),colorCache=Array.from({length:100},(_,i)=>{
   const c=color(f(f(1/100)*i)).map(v=>Math.round(v*255));return ((c[3]<<24)|(c[0]<<16)|(c[1]<<8)|c[2])>>>0;
  });
  const trail=createSourceSfxTrail({...spec,colorCache,colorCacheEpsilon:f(.48),widthCurve:spec.widthCurve.frames.length?createSourceSfxFloatCurve(spec.widthCurve):()=>1});
  const geometry=new THREE.BufferGeometry();
  for(const [key,size] of [['position',3],['uv',2],['particleColor',4]])geometry.setAttribute(key,new THREE.BufferAttribute(new Float32Array(spec.maxNodes*2*size),size).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(Array.from({length:spec.maxNodes-1},(_,i)=>[0,1,2,1,3,2].map(v=>v+i*2)).flat());geometry.setDrawRange(0,0);
  const material=createFashionParticleMaterial(await loadTexture(spec.image.url));
  material.blendDst=material.blendDstAlpha=THREE.OneMinusSrcAlphaFactor;
  delete material.userData.sourceFashionParticle;material.userData.sourceHoofTrail=true;
  const mesh=new THREE.Mesh(geometry,material);mesh.name='source-hoof-trail';mesh.frustumCulled=false;group.add(mesh);
  const world=controller.world;
  trail.state.previousPosition=world.translation.map(f);trail.state.previousAxis=world.rotation.slice(6,9).map(f);
  systems.push({controller,trail,mesh,spec,rows:0});
 }
 return {systems,update(dt,camera){
  const inverse=group.matrixWorld.clone().invert(),view=new THREE.Vector3(0,0,1).transformDirection(camera.matrixWorld).transformDirection(inverse).toArray();
  for(const s of systems){
   const w=s.controller.world;
   if(dt>0)s.trail.update(dt,{position:w.translation,axis:w.rotation.slice(3,6),orientation:w.rotation.slice(6,9),scale:w.scale[0],view});
   const rows=s.trail.ribbon(),g=s.mesh.geometry;
   if(rows.length>s.spec.maxNodes)throw Error('Source trail vertex capacity exceeded');
   rows.forEach((r,i)=>{
    g.attributes.position.array.set(r.positions,i*6);g.attributes.uv.array.set(r.uv,i*4);
    const color=[(r.color>>>16&255)/255,(r.color>>>8&255)/255,(r.color&255)/255,(r.color>>>24)/255];
    g.attributes.particleColor.array.set(color,i*8);g.attributes.particleColor.array.set(color,i*8+4);
   });
   s.rows=rows.length;g.setDrawRange(0,Math.max(0,rows.length-1)*6);for(const a of Object.values(g.attributes))a.needsUpdate=true;
  }
 }};
}
