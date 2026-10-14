import * as THREE from 'three';
import {runtimeContract} from './handoff/runtime-contracts.js';
const defaults=runtimeContract("wing-obj-defaults.json");
import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// Both original NFX passes use the same formula and distinct cull/blend states.
export async function configureWingObj(m,parameters,macros,load,warnings,pass=0){
 try{
  if(Object.values(macros).some(v=>scalar(v,0)!==0))throw Error('Unknown active NFX macro');
  const p={...defaults.parameters,...parameters},c1=vector(p.Color01,[1,1,1,1]),c2=vector(p.Color02,[1,1,1,1]),rim=vector(p.FresnelCol,[1,1,1,1]);
  const scale=scalar(p.Scale,1),power=scalar(p.Power,1),strength=scalar(p.FresnelStrength,1),a=scalar(p.strength01,1),b=scalar(p.strength02,1);
  if(power<=0)throw Error('Undefined Fresnel power boundary');
  const input=await load('Tex0',false);if(!input?.isCubeTexture)throw Error('Missing original cube texture');
  // NFX FILTER_BILINEAR/ADDRESS_CLAMP owns its sampler; leave shared DDS intact.
  const cube=input.clone();cube.minFilter=cube.magFilter=THREE.LinearFilter;cube.wrapS=cube.wrapT=THREE.ClampToEdgeWrapping;cube.generateMipmaps=false;cube.colorSpace=THREE.NoColorSpace;cube.needsUpdate=true;
  m.addEventListener('dispose',()=>cube.dispose());
  const u={woCube:{value:cube},neoEmissionScale:{value:1}};setup(m,false);
  m.side=pass===0?THREE.BackSide:THREE.FrontSide;m.transparent=pass===1;
  m.blending=pass===0?THREE.NoBlending:THREE.CustomBlending;
  if(pass===1){m.blendEquation=m.blendEquationAlpha=THREE.AddEquation;m.blendSrc=m.blendDst=THREE.OneFactor;m.blendSrcAlpha=THREE.SrcAlphaFactor;m.blendDstAlpha=THREE.OneMinusSrcAlphaFactor;}
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,false);
   const vary='varying vec3 woWorldView;\n';
   s.vertexShader=vary+s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nwoWorldView=normalize(cameraPosition-(modelMatrix*vec4(transformed,1.)).xyz)*vec3(-1.,1.,1.);');
   s.fragmentShader=vary+'uniform samplerCube woCube;uniform float neoEmissionScale;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    // Preserve vertex-normalized varyings: do not normalize again per fragment.
    float woF=clamp(${f(scale)}+(1.-${f(scale)})*pow(1.-abs(dot(t107N,woWorldView)),${f(power)}),0.,1.);
    vec3 woReflection=reflect(-woWorldView,t107N);
    vec3 woSample=pow(textureCube(woCube,woReflection).rgb,vec3(2.2));
    vec3 woGradient=mix(${rgb(c1)}*${f(a)},${rgb(c2)}*${f(b)},t107Uv.y);
    vec3 woColor=(woSample+woF*${rgb(rim)}*${f(strength)})*woGradient;
    float woAlpha=clamp(1.-t107Uv.y+.2,0.,1.)*opacity;
    diffuseColor=vec4(0.,0.,0.,woAlpha);
   `).replace('#include <opaque_fragment>','gl_FragColor=vec4(woColor*neoEmissionScale,woAlpha);');
  };
  warnings.push('nfx_wing_obj: original cube, vertex-view Fresnel and two source passes connected');return u;
 }catch(e){warnings.push('nfx_wing_obj unsupported: '+e.message);return null;}
}

// nfx_wing is the single-pass sibling of nfx_wing_obj. It consumes only the
// authored cube and scalar/color parameters; no UV1, tangent or vertex color.
export async function configureNfxWing(m,parameters,macros,load,warnings){
 try{
  if(Object.values(macros).some(v=>scalar(v,0)!==0))throw Error('Unknown active NFX macro');
  const p=parameters||{},c1=vector(p.Color01,[1,1,1,1]),c2=vector(p.Color02,[1,1,1,1]),rim=vector(p.FresnelCol,[1,1,1,1]);
  const scale=scalar(p.Scale,1),power=scalar(p.Power,1),tiling=scalar(p.Tiling,1),speedU=scalar(p.speedU,1),speedV=scalar(p.speedV,1),a=scalar(p.strength01,1),b=scalar(p.strength02,1);
  if(power<=0)throw Error('Undefined Fresnel power boundary');
  const input=await load('Tex1',false);if(!input?.isCubeTexture)throw Error('Missing original cube texture Tex1');
  const cube=input.clone();cube.minFilter=cube.magFilter=THREE.LinearFilter;cube.wrapS=cube.wrapT=THREE.ClampToEdgeWrapping;cube.generateMipmaps=false;cube.colorSpace=THREE.NoColorSpace;cube.needsUpdate=true;
  m.addEventListener('dispose',()=>cube.dispose());
  const u={nwCube:{value:cube},nwTime:{value:0}};
  m.map=null;m.normalMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);
   s.vertexShader=`varying vec2 nwUv;varying vec3 nwWorldView;varying vec3 nwWorldNormal;varying vec3 nwWorldPos;\n${s.vertexShader}`
    .replace('#include <uv_vertex>','#include <uv_vertex>\nnwUv=uv;')
    .replace('#include <project_vertex>','#include <project_vertex>\nnwWorldPos=(modelMatrix*vec4(transformed,1.0)).xyz;nwWorldView=normalize(cameraPosition-nwWorldPos);nwWorldNormal=normalize(mat3(modelMatrix)*transformedNormal);');
   s.fragmentShader=`varying vec2 nwUv;varying vec3 nwWorldView;varying vec3 nwWorldNormal;varying vec3 nwWorldPos;uniform samplerCube nwCube;uniform float nwTime;\nfloat nwHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat nwNoise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);float a=nwHash(i),b=nwHash(i+vec2(1.0,0.0)),c=nwHash(i+vec2(0.0,1.0)),d=nwHash(i+vec2(1.0,1.0));return mix(mix(a,b,u.x),mix(c,d,u.x),u.y)*2.0-1.0;}\n${s.fragmentShader}`;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`vec2 nwP=nwUv*${f(tiling)}-nwTime*vec2(${f(speedU)},${f(speedV)});vec3 nwN=nwWorldNormal+vec3(nwNoise(nwP));vec3 nwV=normalize(nwWorldView);float nwF=clamp(${f(scale)}+(1.0-${f(scale)})*pow(1.0-abs(dot(normalize(nwN),nwV)),${f(power)}),0.0,1.0);vec3 nwCube=pow(max(textureCube(nwCube,reflect(-nwV,normalize(nwN))).rgb,vec3(0.0)),vec3(2.2));vec3 nwGrad=mix(${rgb(c1)}*${f(a)},${rgb(c2)}*${f(b)},nwUv.y);vec3 nwOut=(nwCube+nwF*${rgb(rim)})*nwGrad;diffuseColor=vec4(nwOut,clamp(1.0-nwUv.y+0.3,0.0,1.0)*opacity);`).replace('#include <emissivemap_fragment>','totalEmissiveRadiance=vec3(0.0);');
  };
  warnings.push('nfx_wing: original cube, Panner/Perlin normal perturbation, Fresnel and gradient channels connected; source half precision and post effects remain unverified');
  return u;
 }catch(e){warnings.push('nfx_wing unsupported: '+e.message);return null;}
}
