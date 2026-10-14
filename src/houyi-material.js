import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

const noiseGlsl=`
float hyRandom(vec2 st){return fract(sin(dot(st,vec2(12.,78.)))*43758.);}
float hyNoise(vec2 st){vec2 i=floor(st),q=fract(st),u=q*q*(3.-2.*q);
 float a=hyRandom(i),b=hyRandom(i+vec2(1.,0.)),c=hyRandom(i+vec2(0.,1.)),d=hyRandom(i+vec2(1.));
 return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;}
`;

export async function configureHouyi(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,0),ia=scalar(macros.IA_VERTEX_COLOR,1);
  if(![0,1,2].includes(q)||[normal,change,ia].some(x=>![0,1].includes(x)))throw Error('Unknown source macro');
  for(const key of ['INSTANCE_TYPE','ENABLE_SCALE_9','ENABLE_TILING','ENABLE_VAT','LIGHT_MAP_ENABLE'])if(scalar(macros[key],0)!==0)throw Error('Unsupported active '+key);
  for(const key of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[key],[0,0,0]).some(x=>x!==0))throw Error('Active soft-body unresolved');
  const low=q<2,tbn=low&&normal===1;
  if(!o.sourceVertexColors)throw Error('Missing original COLOR0');
  if(low&&!o.sourceSecondUv)throw Error('Missing original UV1');
  if(tbn&&!o.sourceTangents)throw Error('Missing original tangent basis');
  const n=(key,fallback)=>f(scalar(p[key],fallback)),col=(key,fallback=[0,0,0,1])=>rgb(vector(p[key],fallback));
  const intensity=vector(p.Intensity,[1,1,1,0]);
  const keys=low?['Tex0','Tex1','Tex2','Tex3']:['Tex0'];
  const u={neoTime:{value:0}};
  for(const key of keys){const texture=await load(key,false);if(!texture?.isTexture||texture.isCubeTexture)throw Error('Missing source '+key);u['hy'+key]={value:texture};}
  setup(m,tbn);
  m.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,u);frame(m,shader,tbn);
   shader.vertexShader=`attribute vec2 uv1;attribute vec3 color;varying vec2 hyUv1;varying float hyColorR;varying vec3 hyLocal;uniform float neoTime;${noiseGlsl}\n`+shader.vertexShader
    .replace('#include <uv_vertex>','#include <uv_vertex>\nhyUv1=uv1;hyColorR=color.r;')
    .replace('#include <skinning_vertex>',`#include <skinning_vertex>
      // The viewer reflects X; convert post-skin Three local space back to source local space.
      vec3 hySourceLocal=transformed*vec3(-1.,1.,1.);
      ${low?`float hyNoiseA=clamp(hyNoise(hyUv1*10.+neoTime*6.),0.,1.)*.1;
      vec3 hyMask=vec3(sin(hySourceLocal.x*10.+neoTime*3.)*.01,0.,0.);
      vec3 hyRotation=vec3(.03*sin(neoTime*5.),0.,.03*cos(neoTime*5.));
      hySourceLocal+=(hyRotation+hyMask+vec3(hyNoiseA))*hyColorR;
      transformed=hySourceLocal*vec3(-1.,1.,1.);`:''}
      hyLocal=hySourceLocal;`);
   shader.fragmentShader=`varying vec2 hyUv1;varying float hyColorR;varying vec3 hyLocal;uniform sampler2D hyTex0,hyTex1,hyTex2,hyTex3;uniform float neoTime;
    ${noiseGlsl}
    vec3 hyLinear(vec3 c){return ${low?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}
    float hyPow5(float x){float x2=x*x;return x2*x2*x;}
   `+shader.fragmentShader;
   let body=`vec2 hyUv=t107Uv;hyUv.x+=hyUv.y<.25?${n('FaceUVOffset',0)}*${n('CharOffset',1)}:0.;
    vec4 hyBase=texture2D(hyTex0,hyUv);hyBase.rgb=hyLinear(hyBase.rgb);
    ${change?`hyBase.rgb=vec3(dot(hyBase.rgb,vec3(.2125,.7154,.0721)))*${col('BaseColor',[1,1,1,1])}*${n('TintValue',1)};`:`hyBase.rgb*=${n('TintValue',1)};`}
    vec3 hyN=t107N,hyV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 hyEmission=vec3(0.);float hyRoughness=clamp(${f(intensity[1])},0.,1.),hyMetalness=0.,hyOcclusion=1.;`;
   if(low){
    body+=`vec4 hyOrm=texture2D(hyTex2,hyUv);hyOcclusion=hyOrm.r;hyRoughness=clamp(hyOrm.g*${f(intensity[1])},0.,1.);hyMetalness=clamp(hyOrm.b*${f(intensity[2])},0.,1.);
     ${tbn?`vec3 hySample=texture2D(hyTex1,hyUv).xyz*2.-1.;hySample.xy*=${f(intensity[0])};hyN=mat3(t107T,t107B,t107N)*normalize(hySample);`:''}
     float hyNoiseMask=clamp(hyNoise(hyLocal.xy*3.+vec2(0.,-6.*neoTime)),0.,1.)*2.;
     float hyEmfr=clamp(pow(clamp(dot(hyV,t107N)-.4,0.,1.),.6)*1.3,0.,1.);
     vec3 hyFire=mix(${col('EmColorB',[0,0,0,1])}*20.*hyNoiseMask*texture2D(hyTex3,hyUv1*vec2(6.,3.)+vec2(0.,neoTime)).r,${col('EmColorA',[0,0,0,1])},hyEmfr);
     float hyHairF=clamp(pow(clamp(dot(hyV,hyN)-.1,0.,1.),.8)*1.3,0.,1.);
     vec3 hyHair=mix(${col('EmColorC',[0,0,0,1])}*3.,vec3(0.),hyHairF);
     hyEmission=mix(hyHair,hyFire,hyColorR);
     hyEmission=mix(hyEmission,${col('EmColorD',[0,0,0,1])},hyOrm.b*clamp(1.-hyColorR,0.,1.));
     hyEmission=mix(hyHair,hyEmission,hyColorR*hyColorR*hyColorR);`;
   }else{
    body+=`hyEmission=${col('EmColorB',[0,0,0,1])}*hyColorR;`;
   }
   body+=`float hyFresnel=clamp(${n('FresnelScale',0)}+(1.-${n('FresnelScale',0)})*hyPow5(1.-dot(hyN,hyV)),0.,1.);
    hyEmission+=hyFresnel*${col('RimColor',[0,0,0,1])}*${f(intensity[3])};
    diffuseColor=vec4(hyBase.rgb*(1.-hyColorR),opacity);`;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',body).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(hyN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=hyRoughness;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=hyMetalness;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=hyEmission;')
    .replace('#include <aomap_fragment>','reflectedLight.indirectDiffuse*=hyOcclusion;');
  };
  warnings.push('houyi 原四图、COLOR0/UV1、低画质法线与 post-skin/pre-World 位移已接入；完整运行时光照不等价。');return u;
 }catch(error){warnings.push('houyi remains unsupported: '+error.message);return null;}
}
