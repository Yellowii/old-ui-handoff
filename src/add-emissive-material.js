import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// add_emissive.hlsl: raw texture RGB is decoded once; BaseColor is already linear.
export async function configureAddEmissive(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),light=scalar(macros.LIGHT_ENABLE,1),normal=scalar(macros.NORMAL_MAP_ENABLE,1),border=scalar(macros.ENABLE_BORDER,0);
  if(![0,1,2].includes(q)||[light,normal,border].some(v=>![0,1].includes(v)))throw Error('Unknown source quality/light/normal/border');
  const known=new Set(['RENDER_QUALITY','LIGHT_ENABLE','NORMAL_MAP_ENABLE','ENABLE_BORDER','IS_CHARACTER','USE_LOCAL_PARAMATER','ALPHA_TEST_ENABLE','TWO_SIDED','ENABLE_POINT_LIGHT_AND_SPOTLIGHT']);
  if(Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Active source macro unsupported');
  const normalOn=!!(light&&normal);if(normalOn&&!o.sourceTangents)throw Error('Original tangent basis required');
  const i=vector(p.Intensity,[1,1,1,1]),base=vector(p.BaseColor,[1,1,1,1]),bc=vector(p.BorderColor,[1,.8,.3,1]);
  const mix=scalar(p.EmissiveMix,0),max=scalar(p.EmissiveMax,1),r=scalar(p.UGCKey_R,1),metal=scalar(p.UGCKey_M,1),scale=scalar(p.BorderScale,.03),strength=scalar(p.BorderIntensity,3),power=scalar(p.BorderPow,5);
  const audioKey=scalar(p.AudioKey,0),audioRange=scalar(p.AudioRange,0);
  if(audioKey!==0&&audioRange!==0)throw Error('Original WindSpeed audio input not connected');
  if([r,metal,audioKey].some(v=>v<0||v>1)||(border&&power<=0))throw Error('Unresolved source interpolation/power');
  const keys=normalOn?[0,1,2,3]:[0,2,3],maps=await Promise.all(keys.map(k=>load('Tex'+k,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Original 2D texture required');
  const u={neoEmissionScale:{value:1}};keys.forEach((k,j)=>u['aeTex'+k]={value:maps[j]});setup(m,normalOn);
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normalOn);
   s.fragmentShader=`uniform sampler2D aeTex0,aeTex1,aeTex2,aeTex3;uniform float neoEmissionScale;
    vec3 aeLinear(vec3 c){return ${q===2?'c*c':'pow(max(c,vec3(0.)),vec3(2.2))'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 aeBase=texture2D(aeTex0,t107Uv),aeOrm=texture2D(aeTex2,t107Uv),aeGlow=texture2D(aeTex3,t107Uv);
    aeBase.rgb=mix(aeBase.rgb,aeGlow.rgb,aeGlow.a*clamp(${f(mix*i[3]*max)},0.,1.));
    vec3 aeGlowLinear=aeLinear(aeGlow.rgb)*aeGlow.a*${f(i[3])};
    vec3 aeAlbedo=aeLinear(aeBase.rgb)*${rgb(base)}+aeGlowLinear;
    vec3 aeN=normalize(t107N);
    ${normalOn?`vec3 aeSample=texture2D(aeTex1,t107Uv).xyz*2.-1.;aeSample.xy*=${f(i[0])};aeN=mat3(t107T,t107B,t107N)*normalize(aeSample);`:''}
    vec3 aeBorder=vec3(0.);
    ${border?`vec3 aeView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
     float aeFc=pow(clamp(1.-dot(aeN,aeView),0.,1.),${f(power)});
     aeBorder=${rgb(bc)}*clamp(${f(scale)}+aeFc*(1.-${f(scale)}),0.,1.)*${f(strength)};`:''}
    vec3 aeEmission=aeGlowLinear*${f(max)}*(1.+${f(audioRange)})+aeBorder;
    float aeRough=mix(${f(i[1])},clamp(aeOrm.g*${f(i[1])},0.,1.),${f(r)});
    float aeMetal=mix(${f(i[2])},clamp(aeOrm.b*${f(i[2])},0.,1.),${f(metal)});
    diffuseColor=vec4(aeAlbedo,aeBase.a*${f(base[3])}*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(aeN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=aeRough;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=aeMetal;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=aeEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=aeOrm.r;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),aeOrm.r,material.roughness);
     #endif`);
  };
  warnings.push('add-emissive: original color, ORM and border channels connected; original scene lighting remains uncalibrated');return u;
 }catch(e){warnings.push('add-emissive unsupported: '+e.message);return null;}
}
