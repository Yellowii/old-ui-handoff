import {sourceSpecular} from './source-specular.js';
import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// standard_common_ice: preserve its nonstandard normal blend and low-quality
// zero-initialized CameraVector; neither is the usual RNM/Fresnel shortcut.
export async function configureCommonIce(m,p,macros,load,o={},warnings=[]){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normal=scalar(macros.NORMAL_MAP_ENABLE,1);
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','TWO_SIDED','ALPHA_TEST_ENABLE']);
  if(![0,1,2].includes(q)||![0,1].includes(normal)||Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Unverified ice tiling/permutation');
  if(normal&&!o.sourceTangents)throw Error('Original ice tangent basis required');
  const defaults={RepeatScale:1,UVSampleKey:0,Speed_U:0,Speed_V:0,DepthNormalUVTiling:1,DepthOffset:-.1,DepthNormalIntensity:1,BaseNormalIntensity:1,SnowUp:0,SnowUp_Power:2,SwitchSnowUp:0,IceRoughness:.3,SnowRoughness:1,FresneloffsetE_A:1,FresneloffsetE_B:1.6,Emissive_Intensity_A:1,Emissive_Intensity_B:1,SnowUp_E_Intensity:0};
  const n=Object.fromEntries(Object.entries(defaults).map(([k,d])=>[k,scalar(p[k],d)])),v=Object.fromEntries(Object.entries(n).map(([k,x])=>[k,f(x)]));
  if(n.SnowUp_Power<=0||n.FresneloffsetE_A<=0||n.FresneloffsetE_B<1)throw Error('Unverified ice power boundary');
  const c=Object.fromEntries(['MaskColor0','MaskColor1','MaskColor2','Fresnel_Emissive_B'].map(k=>[k,rgb(vector(p[k],k==='Fresnel_Emissive_B'?[0,0,0,0]:[1,1,1,1]))]));
  const uv=vector(p.UVPara,[1,1,0,0]),keys=q<2?['Tex0','Tex1','Tex2']:['Tex0','Tex1'],maps=await Promise.all(keys.map(k=>load(k,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Missing original ice texture');
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};keys.forEach((k,i)=>u['ci'+k]={value:maps[i]});setup(m,normal===1);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normal===1);
   s.vertexShader='varying vec3 ciLocal;\n'+s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nciLocal=transformed;');
   s.fragmentShader=`varying vec3 ciLocal;uniform float neoTime,neoEmissionScale;${keys.map(k=>'uniform sampler2D ci'+k+';').join('')}
    vec3 ciLinear(vec3 x){return ${q===2?'x*x':'pow(max(x,vec3(0.)),vec3(2.2))'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 ciUv=${n.UVSampleKey!==0?`t107Uv*vec2(${f(uv[0])},${f(uv[1])})+vec2(${f(uv[2])},${f(uv[3])})+neoTime*vec2(${v.Speed_U},${v.Speed_V})`:`t107Uv*${v.RepeatScale}`};
    vec4 ciMask=texture2D(ciTex0,ciUv),ciBase=texture2D(ciTex1,ciUv);
    mat3 ciTbn=${normal?'mat3(t107T,t107B,t107N)':'mat3(1.)'};
    vec3 ciV=vec3(0.),ciN;vec2 ciDepthUv=vec2(0.);
    ${q<2?`
     ciV=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
     vec3 ciTV=normalize(vec3(dot(ciTbn[0],ciV),dot(ciTbn[1],ciV),dot(ciTbn[2],ciV)));
     ciDepthUv=ciUv*${v.DepthNormalUVTiling}+${v.DepthOffset}*(ciTV.xy/ciTV.z);
     vec3 ciDepth=texture2D(ciTex2,ciDepthUv).xyz;
     vec3 ciA=mix(vec3(.5,.5,1.),ciBase.xyz,${v.BaseNormalIntensity})*2.-1.;
     vec3 ciB=mix(vec3(.5,.5,1.),ciDepth,${v.DepthNormalIntensity})*2.-1.;
     vec3 ciBN=vec3(ciA.xy,ciA.z+1.),ciAdd=vec3(-ciB.xy,ciB.z);
     vec3 ciBlend=ciBN*dot(ciBN,ciAdd)-(ciBN.z+1.)*ciB;
     float ciNormalFresnel=clamp(dot(t107N,ciV)-.6,0.,1.);
     ciN=ciTbn*normalize(mix(ciA,mix(ciA,ciBlend,ciNormalFresnel),ciMask.r));
    `:'ciN=ciTbn*normalize(ciBase.xyz*2.-1.);'}
    vec3 ciColor=mix(clamp(${c.MaskColor0},0.,1.),${c.MaskColor1},ciMask.g);
    float ciHeight=pow(clamp(ciLocal.y/8.-(${v.SnowUp}),0.,1.),${v.SnowUp_Power});
    float ciFresnel=clamp(pow(1.5-dot(t107N,ciV),1.2),0.,1.);
    vec3 ciAlbedo=mix(mix(clamp(ciColor,0.,1.),${c.MaskColor2},ciMask.b),mix(ciFresnel*${c.MaskColor2},ciColor,ciHeight),${v.SwitchSnowUp});
    float ciRoughness=${q===2?'.5':`mix(${v.IceRoughness}*.3,${v.SnowRoughness}*ciMask.a,clamp(ciMask.g,0.,1.))`};
    float ciMetalness=mix(.25,0.,clamp(ciMask.g,0.,1.));
    float ciEF=clamp(pow(${v.FresneloffsetE_B}-dot(t107N,ciV),${v.FresneloffsetE_A}),0.,1.);
    vec3 ciEA=mix(ciLinear(${c.MaskColor0})*${v.Emissive_Intensity_A},ciLinear(${c.Fresnel_Emissive_B})*${v.Emissive_Intensity_B},ciEF)*ciMask.r;
    vec3 ciEmission=mix(ciEA+${c.MaskColor2}*${v.SnowUp_E_Intensity},ciEA,ciHeight);
    diffuseColor=vec4(ciAlbedo,opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(ciN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=ciRoughness;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=ciMetalness;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=ciEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>','')
    .replace('#include <lights_physical_fragment>',sourceSpecular('1.'));
  };return u;
 }catch(e){warnings.push('Common ice remains unsupported: '+e.message);return null;}
}
