import * as THREE from 'three';
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const vec=(v,d)=>{try{const a=Array.isArray(v)?v:JSON.parse(v);return a.length===d.length?a:d;}catch{return d;}};
const rgb=v=>`vec3(${v.slice(0,3).map(x=>num(x).toFixed(8)).join(',')})`;
export async function configureUgcCrystal(m,p,macros,load,warnings,o={},up=false){try{
 const quality=num(macros.RENDER_QUALITY,0),low=quality===2,normalOn=num(macros.NORMAL_MAP_ENABLE,1)!==0;
 if(![0,1,2].includes(quality))throw Error('unknown source quality');
 if(p.Tex2 && p.Tex2!=='black')throw Error('non-default sparkle texture requires source sparkle path');
 if(!o.sourceTangents||!o.sourceBounds?.half?.[1])throw Error('missing source TBN or bounds');const cube=await load('Tex0'),normal=await load('Tex1');if(!cube?.isCubeTexture||!normal||normal.isCubeTexture)throw Error('missing source cube or normal');
 const h=o.sourceBounds.half,c=o.sourceBounds.center,i=vec(p.Intensity,[1,1,1,0]),a=vec(p.Color01,[1,1,1,1]),b=vec(p.Color02,[1,1,1,1]),f=(v,d=0)=>num(v,d).toFixed(8),u={ucCube:{value:cube},ucNMap:{value:normal},neoTime:{value:0},neoEmissionScale:{value:1}};
 m.map=null;m.normalMap=null;m.color.set(0);m.emissive.set(0xffffff);m.emissiveIntensity=1;m.defines={...m.defines,USE_TANGENT:''};m.transparent=up;m.blending=up?THREE.NormalBlending:THREE.NoBlending;m.depthTest=true;m.depthWrite=true;m.depthFunc=THREE.LessEqualDepth;m.side=up?THREE.FrontSide:THREE.BackSide;
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,u);const vary='varying vec2 ucUv;varying vec3 ucL,ucW,ucN,ucT,ucB;\n';
  s.vertexShader=vary+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nucUv=uv;').replace('#include <normal_vertex>',`#include <normal_vertex>
vec3 ucSourceNormal=transformedNormal;
#ifdef FLIP_SIDED
ucSourceNormal=-ucSourceNormal;
#endif
ucN=inverseTransformDirection(ucSourceNormal,viewMatrix)*vec3(-1.,1.,1.);
ucT=inverseTransformDirection(transformedTangent,viewMatrix)*vec3(-1.,1.,1.);
ucB=cross(ucN,ucT)*tangent.w*-sign(determinant(mat3(modelMatrix)));`).replace('#include <project_vertex>','ucL=transformed*vec3(-1.,1.,1.);ucW=(modelMatrix*vec4(transformed,1.)).xyz;\n#include <project_vertex>');
  s.fragmentShader=vary+'uniform samplerCube ucCube;uniform sampler2D ucNMap;uniform float neoTime,neoEmissionScale;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`vec3 ucS=texture2D(ucNMap,ucUv).xyz*2.-1.;ucS.xy*=${f(i[0],1)};vec3 ucSN=${low||!normalOn?'ucN':'mat3(ucT,ucB,ucN)*normalize(ucS)'},ucWV=normalize(cameraPosition-ucW)*vec3(-1.,1.,1.);float ucY=abs((ucL.y-(${f(c[1])}-${f(h[1])}))/(2.*${f(h[1])}));vec3 ucC=mix(${rgb(a)},${rgb(b)},ucY);float ucF=clamp(${f(p.Scale,.1)}+(1.-${f(p.Scale,.1)})*pow(1.-abs(dot(ucSN,ucWV)),4.),0.,1.);vec3 ucE=(pow(max(textureLod(ucCube,reflect(-ucWV,ucSN),${f(p.reflectionMip,0)}).rgb,vec3(0.)),vec3(${low?'2.0':'2.2'}))+ucF*ucC*${f(p.FresnelStrength,10)})*${f(p.RefLightness,7)}*ucF;diffuseColor=vec4(0.,0.,0.,${f(p.upOpaticty,1)}*opacity);`).replace('#include <color_fragment>','').replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(ucSN*vec3(-1.,1.,1.)));').replace('#include <roughnessmap_fragment>',`float roughnessFactor=${f(i[1])};`).replace('#include <metalnessmap_fragment>',`float metalnessFactor=${f(i[2])};`).replace('#include <emissivemap_fragment>','totalEmissiveRadiance=ucE*neoEmissionScale;').replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
 };warnings.push('ugc_crystal source below/up passes, root-Y gradient, cube and TBN enabled');return u;
}catch(e){warnings.push('ugc_crystal unsupported: '+e.message);return null;}}
