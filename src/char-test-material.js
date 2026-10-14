import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';
import {sourceSceneSunGlsl,sourceSceneSunColorGlsl,sourceSceneLightWarning} from './source-scene-light.js';

export async function configureCharTest(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,1),offset=scalar(macros.CHAR_OFFSET,0);
  if(![0,1,2].includes(q)||[normal,change,offset].some(x=>![0,1].includes(x)))throw Error('Unknown source macro');
  if(scalar(macros.SWITCH_SHANPIANPBR,0)!==0)throw Error('Sparkle permutation unresolved');
  const derivedTbn=normal&&!o.sourceTangents;
  for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[k],[0,0,0]).some(x=>x!==0))throw Error('Active soft-body deformation unresolved');
  const num=(k,d)=>f(scalar(p[k],d)),col=(k,d=[1,1,1,1])=>rgb(vector(p[k],d)),intensity=vector(p.Intensity,[1,1,1,0]);
  const maps=await Promise.all([0,1,2,3].map(i=>load('Tex'+i,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original Tex0-Tex3');
  const u={};maps.forEach((t,i)=>u['charTestTex'+i]={value:t});setup(m,normal&&!derivedTbn);if(derivedTbn){m.extensions={...m.extensions,derivatives:true};m.userData.charTestDerivedTangent=true;}
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normal&&!derivedTbn);
   s.fragmentShader=`uniform sampler2D charTestTex0,charTestTex1,charTestTex2,charTestTex3;
    vec3 ctLinear(vec3 c){return ${q===2?'c*c':'pow(max(c,vec3(0.)),vec3(2.2))'};}
   `+s.fragmentShader;
   const body=`vec2 ctUv=t107Uv;${offset?`ctUv.x+=ctUv.y<.25?${num('FaceUVOffset',0)}:0.;`:''}
    vec4 ctBase=texture2D(charTestTex0,ctUv),ctMix=texture2D(charTestTex2,ctUv);
    vec3 ctV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    ${normal&&derivedTbn?'vec3 ctDt=normalize(dFdx(vViewPosition)*dFdy(t107Uv).y-dFdy(vViewPosition)*dFdx(t107Uv).y),ctDb=normalize(-dFdx(vViewPosition)*dFdy(t107Uv).x+dFdy(vViewPosition)*dFdx(t107Uv).x);if(dot(cross(ctDt,ctDb),t107N)<0.)ctDb=-ctDb;':''}mat3 ctTbn=${normal?(derivedTbn?'mat3(ctDt,ctDb,t107N)':'mat3(t107T,t107B,t107N)'):'mat3(1.)'};
    vec3 ctN1=texture2D(charTestTex1,ctUv).xyz*2.-1.,ctN3=texture2D(charTestTex3,ctUv*${num('DetailNormalUVTiling',5)}).xyz*2.-1.;
    vec3 ctA=vec3(ctN1.xy,ctN1.z+1.),ctB=vec3(-ctN3.xy*${num('DetailNormalIntensity',.2)},ctN3.z);
    vec3 ctBlend=ctA*dot(ctA,ctB)-(ctA.z+1.)*ctB;
    vec3 ctN=mix(ctTbn*normalize(ctN1),ctTbn*normalize(ctBlend),ctBase.a),ctDetail=ctTbn*normalize(vec3(ctN3.xy*.5,ctN3.z));
    float ctMao=clamp(pow(${num('FA',.8)}-dot(ctDetail,ctV),${num('FB',.3)}),0.,1.)*ctBase.a;
    vec3 ctAlbedo=${change?`ctLinear(vec3(dot(ctBase.rgb,vec3(.2125,.7154,.0721)))*${col('BaseColor')})*${num('TintValue',1)}`:`ctLinear(${col('FrenelColor')}*ctMao)+vec3(clamp(.3-dot(t107N,ctV),0.,1.))+ctLinear(ctBase.rgb*${col('BaseColor')})*${num('TintValue',1)}`};
    diffuseColor=vec4(ctAlbedo,1.);
   `;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(ctN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${q===2?'1.':`ctMix.g*${f(intensity[1])}`};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${q===2?'0.':`ctMix.b*${f(intensity[2])}`};`)
    .replace('#include <emissivemap_fragment>',`float ctF=clamp(${num('FresnelScale',0)}+(1.-${num('FresnelScale',0)})*pow(1.-dot(ctN,ctV),5.),0.,1.);
     vec3 ctSun=${sourceSceneSunGlsl()};
     float ctFront=clamp(dot(ctV,-(ctN*.1+ctSun)),0.,1.),ctBack=clamp(dot(ctV,-(ctN*.3-ctSun)),0.,1.),ctSss=clamp(ctFront*.5+ctBack,0.,1.);
     vec3 ctSssColor=mix(ctBase.rgb*vec3(.7,.4,.3),${sourceSceneSunColorGlsl()},pow(ctSss,5.))*ctSss*.3*${num('TintValue',1)};
     totalEmissiveRadiance=ctF*${col('RimColor',[0,0,0,0])}*${f(intensity[3])}+ctMix.a*${col('EmissiveColor')}*${num('EmissiveValue',1)}+ctSssColor;`)
    .replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\nmaterial.specularColor=vec3(.04);material.specularColorBlended=mix(material.specularColor,diffuseColor.rgb,metalnessFactor);')
    .replace('#include <aomap_fragment>',q===2?'':`reflectedLight.indirectDiffuse*=ctMix.r;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(saturate(dot(geometryNormal,geometryViewDir)),ctMix.r,material.roughness);
     #endif`);
  };
  warnings.push('standard_char_test source channels; '+sourceSceneLightWarning);return u;
 }catch(e){warnings.push('standard_char_test remains unsupported: '+e.message);return null;}
}
