import {scalar,vector,f,rgb,frame,setup} from './t107-frame.js';

// Original standard_change_color_mix.hlsl: two RG/BA pairs, with the second
// color source in Tex5.gba and an independently sampled, untransformed mask UV.
export async function configureChangeColorMix(m,p,macros,load,warnings,o={}){
 try{
  const q=scalar(macros.RENDER_QUALITY,0),normalFlag=scalar(macros.NORMAL_MAP_ENABLE,1),tiling=scalar(macros.ENABLE_TILING,0);
  if(![0,1,2].includes(q)||![0,1].includes(normalFlag)||![0,1].includes(tiling))throw Error('Unknown source quality/normal/tiling');
  const known=new Set(['RENDER_QUALITY','NORMAL_MAP_ENABLE','ENABLE_TILING','IS_CHARACTER','USE_LOCAL_PARAMATER','ALPHA_TEST_ENABLE','TWO_SIDED','LIGHT_ENABLE','ENABLE_POINT_LIGHT_AND_SPOTLIGHT']);
  if(Object.entries(macros).some(([k,v])=>!known.has(k)&&scalar(v,0)!==0))throw Error('Active source macro unsupported');
  const normalOn=q<2&&normalFlag===1;if(normalOn&&!o.sourceTangents)throw Error('Original tangent basis required');
  const intensity=vector(p.Intensity,[1,1,1,0]),base=vector(p.BaseColor,[1,1,1,1]),colors=[0,1,2,3].map(i=>vector(p['MaskColor'+i],[[1,0,0,1],[0,1,0,1],[0,0,1,1],[1,1,1,1]][i]));
  const emis=vector(p.EmissiveIntensity,[0,0,0,0]),rough=vector(p.UGCRoughness,[1,1,1,1]),metal=vector(p.UGCMetalness,[0,0,0,0]);
  const para=vector(p.TexturePara,[1,1,0,0]),repeat=scalar(p.RepeatScale,1),angle=scalar(p.RotationAngle,0)*6.283/360;
  const mixLerp=scalar(p.MixLerp,0),lerpKey=scalar(p.LerpKey,0),change=scalar(p.ChangeColorKey,0),colorIntensity=scalar(p.ColorIntensity,0);
  const fresnel=vector(p.FresnelColor,[1,1,1,1]),power=scalar(p.FresnelPow,4),strength=scalar(p.FresnelIntensity,0);
  const r=scalar(p.UGCKey_R,1),mt=scalar(p.UGCKey_M,1),r4=scalar(p.UGCKey_R4,0),m4=scalar(p.UGCKey_M4,0);
  if(power<=0||[...base,...fresnel].some(v=>v<0))throw Error('Unresolved power input');
  if([mixLerp,lerpKey,change,r,mt,r4,m4].some(v=>v<0||v>1))throw Error('Source interpolation key outside supported range');
  const keys=q<2?[0,1,2,3,4,5]:[0,5],maps=await Promise.all(keys.map(i=>load('Tex'+i,false)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('Original 2D texture required');
  const u={neoEmissionScale:{value:1}};keys.forEach((n,i)=>u['cmTex'+n]={value:maps[i]});setup(m,normalOn);
  const pair=values=>`mix(cmMask.r*${values[0]}+cmMask.g*${values[1]},cmMask.b*${values[2]}+cmMask.a*${values[3]},cmWeight)`;
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);frame(m,s,normalOn);
   if(tiling){s.vertexShader='varying vec3 cmWorld;\n'+s.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\ncmWorld=(modelMatrix*vec4(transformed,1.)).xyz*vec3(-1.,1.,1.);');s.fragmentShader='varying vec3 cmWorld;\n'+s.fragmentShader;}
   s.fragmentShader=`uniform sampler2D cmTex0,cmTex1,cmTex2,cmTex3,cmTex4,cmTex5;uniform float neoEmissionScale;
    vec3 cmLinear(vec3 c){return ${q===2?'c*c':'pow(max(c,vec3(0.)),vec3(2.2))'};}
   `+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 cmUv=t107Uv;
    ${tiling?'vec3 cmAbs=abs(t107N);float cmMax=max(max(cmAbs.x,cmAbs.y),cmAbs.z);cmUv=(cmMax==cmAbs.x?cmWorld.zy:cmMax==cmAbs.y?cmWorld.zx:cmWorld.xy)*.1;':''}
    vec4 cmSecond=texture2D(cmTex5,t107Uv);
    float cmWeight=mix(cmSecond.r,1.-smoothstep(${f(mixLerp-.1)},${f(mixLerp)},cmSecond.r),${f(lerpKey)});
    vec2 cmScale=vec2(${f(repeat*para[0])},${f(repeat*para[1])});cmUv=(cmUv-.5)*cmScale;
    cmUv=vec2(cmUv.x*${f(Math.cos(angle))}-cmUv.y*${f(Math.sin(angle))},cmUv.y*${f(Math.cos(angle))}+cmUv.x*${f(Math.sin(angle))});cmUv+=.5*cmScale+vec2(${f(para[2])},${f(para[3])});
    vec4 cmMask=texture2D(cmTex0,cmUv),cmNormal=vec4(.5,.5,1.,1.),cmOrm=vec4(0.);
    ${q<2?'cmNormal=mix(texture2D(cmTex1,cmUv),texture2D(cmTex3,cmUv),cmWeight);cmOrm=mix(texture2D(cmTex2,cmUv),texture2D(cmTex4,cmUv),cmWeight);':''}
    vec3 cmColor=cmLinear(clamp(mix(${pair(colors.map(rgb))},mix(cmMask.rgb,cmSecond.gba,cmWeight),${f(change)}),0.,1.));
    vec3 cmAlbedo=cmColor*cmLinear(${rgb(base)});
    vec3 cmEmissive=mix(${pair(colors.map((c,i)=>`${rgb(c)}*${f(emis[i])}`))},cmColor*${f(colorIntensity)},${f(change)});
    vec3 cmN=normalize(t107N);
    ${normalOn?`vec3 cmSample=cmNormal.xyz*2.-1.;cmSample.xy*=${f(intensity[0])};cmN=mat3(t107T,t107B,t107N)*normalize(cmSample);`:''}
    vec3 cmView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.);
    vec3 cmEmission=cmOrm.a*(cmEmissive+pow(clamp(1.-dot(cmN,cmView),0.,1.),${f(power)})*${f(strength)}*cmColor*cmLinear(${rgb(fresnel)}));
    float cmRough=${q===2?'.5':`mix(mix(${f(intensity[1])},clamp(cmOrm.g*${f(intensity[1])},0.,1.),${f(r)}),clamp(${pair(rough.map(f))},0.,1.),${f(r4)})`};
    float cmMetal=${q===2?'0.':`mix(mix(${f(intensity[2])},clamp(cmOrm.b*${f(intensity[2])},0.,1.),${f(mt)}),clamp(${pair(metal.map(f))},0.,1.),${f(m4)})`};
    float cmAo=${q===2?'1.':'cmOrm.r'};diffuseColor=vec4(cmAlbedo,cmNormal.a*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(cmN*vec3(-1.,1.,1.)));')
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=cmRough;')
    .replace('#include <metalnessmap_fragment>','float metalnessFactor=cmMetal;')
    .replace('#include <emissivemap_fragment>','totalEmissiveRadiance=cmEmission*neoEmissionScale;')
    .replace('#include <aomap_fragment>',`reflectedLight.indirectDiffuse*=cmAo;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.,1.),cmAo,material.roughness);
     #endif`);
  };
  warnings.push('change-color-mix: original channels connected; full original scene lighting remains uncalibrated');return u;
 }catch(e){warnings.push('change-color-mix unsupported: '+e.message);return null;}
}
