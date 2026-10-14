import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// standard_common_djhdj02.hlsl: sparkle is view parallax, not a time animation.
export async function configureDjhdj02(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1),light=scalar(macros.LIGHT_ENABLE,1),change=scalar(macros.CHAR_CHANGE_COLOR,0);
  if(![0,1,2].includes(q)||[normal,light,change].some(v=>![0,1].includes(v)))throw Error('Unknown source quality/normal/light/color');
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','CHAR_CHANGE_COLOR','IS_CHARACTER','USE_LOCAL_PARAMATER','ALPHA_TEST_ENABLE','TWO_SIDED','ENABLE_POINT_LIGHT_AND_SPOTLIGHT']);
  if(Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Active source macro unsupported');
  if(normal&&!o.sourceTangents)throw Error('Original tangent basis required for parallax');
  const i=vector(p.Intensity,[1,1,1,0]),base=vector(p.BaseColor,[1,1,1,1]),par=vector(p.Parameter,[0,10,1,1]);
  const sparkle=vector(p.SparkleColor,[1,1,1,1]),fresnel=vector(p.frenelColor,[1,1,1,1]),emissive=vector(p.EmissiveColor,[0,0,0,0]);
  const tint=scalar(p.TintValue,1),power=scalar(p.frenelPow,1),mult=scalar(p.frenelMult,1);
  if(par[1]<=0||par[3]<0||power<=0)throw Error('Unresolved source power input');
  const normalOn=q<2&&normal&&light,keys=normalOn?[0,1,2,3]:[0,2,3],maps=await Promise.all(keys.map(k=>load('Tex'+k,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Original 2D texture required');
  const u={neoEmissionScale:{value:1}};keys.forEach((k,j)=>u['djTex'+k]={value:maps[j]});setup(m,!!normal);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,!!normal);
   s.fragmentShader=`uniform sampler2D djTex0,djTex1,djTex2,djTex3;uniform float neoEmissionScale;
    vec3 djLinear(vec3 c){return ${q===2?'c*c':'pow(max(c,vec3(0.)),vec3(2.2))'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec3 djView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec2 djOffset=${normal?'vec2(dot(t107T,djView),dot(t107B,djView))':'djView.xy'}*${f(par[0])};
    vec2 djUv=t107Uv*${f(par[2])}+djOffset,djUv2=t107Uv*${f(par[2]*1.4)};
    vec4 djBase=texture2D(djTex0,t107Uv),djOrm=texture2D(djTex2,t107Uv);
    float djS1=texture2D(djTex3,djUv).r,djS2=texture2D(djTex3,djUv2).r;
    vec3 djColor=${change?'vec3(dot(djBase.rgb,vec3(.2125,.7154,.0721)))':'djBase.rgb'};
    vec3 djAlbedo=djLinear(djColor*${rgb(base)})*${f(tint)};
    vec3 djN=normalize(t107N);
    ${normalOn?`vec3 djSample=texture2D(djTex1,t107Uv).xyz*2.-1.;djSample.xy*=${f(i[0])};djN=mat3(t107T,t107B,t107N)*normalize(djSample);`:''}
    vec3 djSparkle=pow(djS1*djS2*${f(par[3])},${f(par[1])})*${rgb(sparkle)};
    vec3 djFresnel=pow(1.-clamp(dot(djN,djView),0.,1.),${f(power)})*${rgb(fresnel)}*${f(mult)};
    vec3 djEmission=djOrm.a*${rgb(emissive)}*${f(i[3]*tint)}+djSparkle+djFresnel;
    float djRough=${q===2?'.5':`clamp(djOrm.g*${f(i[1])},0.,1.)`},djMetal=${q===2?'0.':`clamp(djOrm.b*${f(i[2])},0.,1.)`},djAo=${q===2?'1.':'djOrm.r'};
    diffuseColor=vec4(djAlbedo,djBase.a*${f(base[3])}*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(djN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=djRough;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=djMetal;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=djEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=djAo;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),djAo,material.roughness);
     #endif`);
  };
  warnings.push('djhdj02: original parallax, sparkle and material channels connected; original scene lighting remains uncalibrated');return u;
 }catch(e){warnings.push('djhdj02 unsupported: '+e.message);return null;}
}
