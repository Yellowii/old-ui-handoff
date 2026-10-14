import * as THREE from 'three';
import {scalar,vector,f,rgb,setup} from './t107-frame.js';

// anglel_wing_crystal.surf: crystal back faces followed by crystal01 front faces.
// Both original programs sample Tex0 as a cube with explicit reflectionMip.
export async function configureWingCrystal(m,p,macros,load,warnings,o={}){
 try{
  const pass=o.wingCrystalPass??0,q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,0),low=q===2,tbn=!low&&normal===1;
  if(![0,1].includes(pass)||![0,1,2].includes(q)||![0,1].includes(normal)||![0,1].includes(change))throw Error('Unknown source permutation');
  if(tbn&&!o.sourceTangents)throw Error('Missing original tangent basis');
  for(const key of ['CHAR_OFFSET','INSTANCE_TYPE','ENABLE_SCALE_9','ENABLE_TILING','ENABLE_VAT','LIGHT_MAP_ENABLE'])if(scalar(macros[key],0)!==0)throw Error('Unconnected source '+key);
  if(scalar(macros.ENABLE_SOFT_BODY2,1)!==0&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(key=>vector(p[key],[0,0,0]).some(v=>v!==0)))throw Error('Active source soft body unresolved');
  const n=(k,d=0)=>f(scalar(p[k],d)),v=(k,d=[1,1,1,1])=>vector(p[k],d),c=(k,d)=>rgb(v(k,d));
  const intensity=v('Intensity',[1,1,0,0]),u={neoEmissionScale:{value:1}};
  for(const key of ['Tex0','Tex1','Tex2']){
   const texture=await load(key,false);
   if(!texture?.isTexture||(key==='Tex0'?!texture.isCubeTexture:texture.isCubeTexture))throw Error('Missing source '+key+' ('+(key==='Tex0'?'cube':'2D')+')');
   u['awc'+key]={value:texture};
  }
  setup(m,tbn);m.side=pass?THREE.FrontSide:THREE.BackSide;
  // Surface BlendState overrides blending on the second DrawCall only. Preserve
  // the descriptor depth state, as in the original Surface draw-call contract.
  if(pass){m.transparent=true;m.blending=THREE.NormalBlending;}
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);
   const vary='varying vec2 awcUv;varying vec3 awcN,awcT,awcB;\n';
   s.vertexShader=vary+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nawcUv=uv;')
    .replace('#include <normal_vertex>',`#include <normal_vertex>
     vec3 awcViewNormal=transformedNormal;
     #ifdef FLIP_SIDED
      awcViewNormal=-awcViewNormal;
     #endif
     awcN=inverseTransformDirection(awcViewNormal,viewMatrix)*vec3(-1.,1.,1.);
     awcT=vec3(1.,0.,0.);awcB=vec3(0.,1.,0.);
     ${tbn?`awcT=inverseTransformDirection(transformedTangent,viewMatrix)*vec3(-1.,1.,1.);
     awcB=cross(awcN,awcT)*tangent.w*-sign(determinant(mat3(modelMatrix)));`:''}`);
   s.fragmentShader=vary+`uniform samplerCube awcTex0;uniform sampler2D awcTex1,awcTex2;uniform float neoEmissionScale;
    vec3 awcLinear(vec3 value){return ${low?'value*value':'pow(value,vec3(2.2))'};}
    float awcFresnel(float scale,vec3 n,vec3 v){float x=1.-abs(dot(n,v));return clamp(scale+(1.-scale)*x*x*x*x*x,0.,1.);}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 awcDirTex=texture2D(awcTex1,awcUv*${n('crystalTiling',1)}),awcNormalTex=texture2D(awcTex2,awcUv);
    vec3 awcSample=awcNormalTex.xyz*2.-1.;awcSample.xy*=${f(intensity[0])};
    vec3 awcSurfaceN=${low?'awcN':tbn?'mat3(awcT,awcB,awcN)*normalize(awcSample)':'normalize(awcSample)'};
    vec3 awcView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 awcCustom=awcLinear(awcDirTex.rgb)-.5;
    vec3 awcNormalMix=vec3(awcSurfaceN.xy+awcCustom.xy,awcSurfaceN.z*awcCustom.z);
    vec3 awcReflection=reflect(-awcView,normalize(awcNormalMix));
    vec3 awcEnvironment=textureLod(awcTex0,awcReflection,${n('reflectionMip',1)}).rgb;
    float awcF0=awcFresnel(${n('Scale')},awcSurfaceN,awcView),awcF=awcFresnel(${n('FresnelScale')},awcSurfaceN,awcView);
    vec3 awcColor=awcLinear(awcEnvironment+awcF0*${c('FresnelCol')}*${n('FresnelStrength',1)});
    vec3 awcLerpColor=awcLinear(mix(${c('Color01')}*${n('strength01',1)},${c('Color02')}*${n('strength02',1)},awcNormalTex.a));
    vec3 awcFinal=awcColor*awcLerpColor*clamp(${n('TintValue',1)}+.1,0.,1.);
    vec3 awcRim=awcF*${c('RimColor',[0,0,0,1])}*${f(intensity[3])};
    vec3 awcEmission=${change?`vec3(dot(awcFinal,vec3(.2125,.7154,.0721)))*awcLinear(${c('BaseColor')})`:'awcFinal'}${pass?'*'+n('upLightness',1.5):''}+awcRim;
    diffuseColor=vec4(0.,0.,0.,${pass?n('upOpaticty',.8):'1.'}*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=mat3(viewMatrix)*(awcSurfaceN*vec3(-1.,1.,1.));')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=awcEmission*neoEmissionScale;')
    .replace('#include <opaque_fragment>','outgoingLight=totalEmissiveRadiance;\n#include <opaque_fragment>');
  };
  warnings.push('原水晶双遍、立方反射与配色已接入；原设备精度/后处理未整体验收');return u;
 }catch(error){warnings.push('wing-crystal unsupported: '+error.message);return null;}
}
