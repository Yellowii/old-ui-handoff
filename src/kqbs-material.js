import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// Original kqbs.hlsl. BaseNormal, depth normal and the blended material normal
// are distinct inputs; neither MatCap uses the blended material normal.
export async function configureKqbs(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,1),light=scalar(macros.LIGHT_ENABLE,1),soft=scalar(macros.ENABLE_SOFT_BODY2,1),high=q<2,on=high&&normal===1;
  if(![0,1,2].includes(q)||[normal,change,light,soft].some(v=>![0,1].includes(v)))throw Error('Unknown source permutation');
  if(on&&!o.sourceTangents)throw Error('Original tangent basis required');
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','CHAR_CHANGE_COLOR','LIGHT_ENABLE','ENABLE_SOFT_BODY2','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','IS_CHARACTER','USE_LOCAL_PARAMATER','ALPHA_TEST_ENABLE','TWO_SIDED']);
  if(Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Active source macro unsupported');
  if(soft&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>vector(p[k],[0,0,0]).some(v=>v!==0)))throw Error('Active soft-body offset not connected');
  if(scalar(macros.TWO_SIDED,0)!==0)throw Error('Source two-sided normal sign not connected');
  const base=vector(p.BaseColor,[1,1,1,1]),rim=vector(p.RimColor,[0,0,0,0]),I=vector(p.Intensity,[1,1,1,0]);
  const c=vector(p.TestColor,[1,1,1,1]),b=vector(p.TestColorB,[1,1,1,1]),cc=vector(p.TestColorC,[1,1,1,1]);
  const depth=scalar(p.DepthOffset,-.08),ta=scalar(p.DepthNormalUVTilingA,1),tb=scalar(p.DepthNormalUVTilingB,1),di=scalar(p.DepthNormalIntensity,.5);
  const fa=scalar(p.MatCapBFA,.8),fb=scalar(p.MatCapBFB,.1),ia=scalar(p.MatCapAIntensity,1),ib=scalar(p.MatCapBIntensity,5),custom=scalar(p.CustomMaskSwitch,0);
  const op=scalar(p.FresOpacityPow,1),oo=scalar(p.FresOpacityOffset,0),oe=scalar(p.FresOpacityEnable,0),os=scalar(p.FresOpacityNormalSw,0),tint=scalar(p.TintValue,1),fs=scalar(p.FresnelScale,0);
  if(op<0||fb<0||[custom,oe,os].some(v=>v<0||v>1))throw Error('Unresolved source power/interpolation input');
  const keys=['Tex0',...(high?['MatCap','MatCapB','MixTex']:[]),...(on?['BaseNormal','DepthNormal']:[])],u={neoEmissionScale:{value:1}};
  for(const k of keys){const t=await load(k,false,k==='Tex0'?o.baseColor:k==='BaseNormal'?o.normal:undefined);if(!t?.isTexture||t.isCubeTexture)throw Error('Original 2D texture required: '+k);u['kq'+k]={value:t};}
  setup(m,on);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,on);
   s.fragmentShader=`uniform sampler2D kqTex0,kqBaseNormal,kqDepthNormal,kqMatCap,kqMatCapB,kqMixTex;uniform float neoEmissionScale;
    vec3 kqLinear(vec3 c){return ${high?'pow(max(c,vec3(0.)),vec3(2.2))':'c*c'};}
    float kqPow5(float x){return x*x*x*x*x;}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 kqBase=texture2D(kqTex0,t107Uv);kqBase.rgb=kqLinear(kqBase.rgb);
    kqBase.rgb=${change?`vec3(dot(kqBase.rgb,vec3(.2125,.7154,.0721)))*kqLinear(${rgb(base)})`: 'kqBase.rgb'}*${f(tint)};
    vec3 kqView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 kqNormal=vec3(0.),kqNormalA=vec3(0.),kqLerpNormal=t107N;float kqNormalMask=1.;vec2 kqDepthUv=vec2(0.);
    ${on?`mat3 kqTbn=mat3(t107T,t107B,t107N);
     vec3 kqTv=normalize(vec3(dot(kqTbn[0],kqView),dot(kqTbn[1],kqView),dot(kqTbn[2],kqView)));
     vec2 kqBaseUv=t107Uv+(-0.)*(kqTv.xy/kqTv.z);
     vec4 kqN=texture2D(kqBaseNormal,kqBaseUv);kqNormalMask=texture2D(kqBaseNormal,t107Uv).a;
     vec3 kqN0=kqN.xyz*2.-1.;kqN0.xy*=2.;kqNormal=kqTbn*normalize(kqN0);
     kqDepthUv=mix(t107Uv*${f(ta)},t107Uv*${f(tb)},kqBase.a)+${f(depth)}*(kqTv.xy/kqTv.z);
     vec3 kqN1=texture2D(kqDepthNormal,kqDepthUv).xyz*2.-1.;kqN1.xy*=${f(di)};kqNormalA=kqTbn*normalize(kqN1);
     vec3 kqBN=vec3(kqN0.xy*.5,kqN0.z+1.),kqAN=vec3(-kqN1.xy,kqN1.z);
     vec3 kqBlend=kqTbn*normalize(kqBN*dot(kqBN,kqAN)-(kqBN.z+1.)*kqAN);
     float kqNF=1.-clamp(pow(max(dot(kqView,t107N)-1.,0.),.1)*2.,0.,1.);kqLerpNormal=mix(kqBlend,kqNormal,kqNF);`:''}
    vec3 kqAdd=vec3(0.);vec4 kqMix=vec4(1.,1.,0.,0.);vec2 kqCapUv=vec2(0.),kqCapBUv=vec2(0.);
    ${high?`kqCapUv=(mat3(viewMatrix)*(kqNormalA*vec3(-1.,1.,1.))).xy*.5+.5;kqCapUv.y*=-1.;
     kqCapBUv=(mat3(viewMatrix)*(kqNormal*vec3(-1.,1.,1.))).xy*.5+.5;kqCapBUv.y*=-1.;
     vec3 kqCap=kqLinear(texture2D(kqMatCap,kqCapUv).rgb)*${rgb(cc)}*${f(3.5*ia)},kqCapB=kqLinear(texture2D(kqMatCapB,kqCapBUv).rgb)*${rgb(c)}*${f(ib)};
     float kqFM=1.-clamp(pow(max(dot(kqView,kqNormalA)-.48,0.),.1)*3.,0.,1.);
     float kqFMB=1.-clamp(pow(max(dot(kqView,kqNormal)-.8,0.),.2)*2.,0.,1.);
     float kqFMBA=1.-clamp(pow(max(dot(kqView,t107N)-${f(fa)},0.),${f(fb)})*2.,0.,1.);
     float kqCF=clamp(pow(max(dot(kqView,t107N)-.08,0.),.6)*2.,0.,1.);
     float kqEF=clamp(pow(max(dot(kqView,t107N)-.4,0.),.7)*2.,0.,1.);
     kqAdd=kqCap*kqNormalMask*(1.-kqFM)+kqCapB*kqFMB*kqFMBA+mix(${rgb(b)}*.3,kqBase.rgb,kqEF)+${rgb(c)}*(1.-kqCF);
     kqMix=texture2D(kqMixTex,t107Uv);`:''}
    float kqOpacityN=dot(kqView,mix(kqLerpNormal,kqNormalA,${f(os)}));
    float kqOpacity=pow(1.-clamp(clamp(kqOpacityN-${f(oo)},0.,1.)*2.,0.,1.),${f(op)});
    float kqAlpha=mix(kqBase.a,kqBase.a*kqOpacity,${f(oe)});
    float kqRough=mix(.2,mix(kqMix.g,.2,kqNormalMask),${f(custom)}),kqMetal=mix(.8,mix(kqMix.b,.8,kqNormalMask),${f(custom)});
    vec3 kqMaterialNormal=${light&&normal?'normalize(kqLerpNormal)':'normalize(t107N)'};
    float kqFresnel=clamp(${f(fs)}+(1.-${f(fs)})*kqPow5(1.-dot(kqMaterialNormal,kqView)),0.,1.);
    vec3 kqEmission=kqAdd+kqFresnel*${rgb(rim)}*${f(I[3])};
    diffuseColor=vec4(kqBase.rgb,kqAlpha*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(kqMaterialNormal*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=kqRough;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=kqMetal;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=kqEmission*neoEmissionScale;')
    .replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\nmaterial.specularColor=vec3(.08);material.specularColorBlended=mix(material.specularColor,diffuseColor.rgb,metalnessFactor);');
  };
   warnings.push('kqbs: original depth normals, dual MatCap masks and opacity connected; original scene lighting remains uncalibrated');return u;
 }catch(e){warnings.push('kqbs unsupported: '+e.message);return null;}
}
