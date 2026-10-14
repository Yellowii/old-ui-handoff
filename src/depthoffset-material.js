// Effective APK standard_char_depthoffset + current DefaultVF; source inputs only.
import {configureDepthOffsetLn} from './depthoffset-ln-material.js';
const number=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const vector=(v,f)=>{try{const a=JSON.parse(v);if(Array.isArray(a)&&a.length===f.length&&a.every(Number.isFinite))return a;}catch{}return f;};
const scalar=v=>Number(v).toFixed(8),rgb=v=>`vec3(${v.slice(0,3).map(scalar).join(',')})`;

export function depthOffsetGaps(p,macros,overrides={}){
  const gaps=[],low=Number(macros.RENDER_QUALITY)===2,normal=Number(macros.NORMAL_MAP_ENABLE)!==0;
  const depth=vector(p.DepthPara,[1,0,0,1]),dot=vector(p.DotPara,[1,0,0,1]);
  if(p.__depthLn&&Number(macros.NEOX_METAL||0)!==0)gaps.push('depthoffset_ln 当前接入原 GLES 屏幕映射，不支持 Metal 平台分支');
  if(!p.__depthLn&&depth[0]===0)gaps.push('DepthPara.r=0 的源除零语义尚未验证');
  const needsBasis=normal&&!(p.__depthLn&&low)&&(depth[1]!==0||(!low&&(!p.__depthLn||Number(macros.RENDER_QUALITY)===0)&&number(p.DotPower)!==0&&dot[2]!==0)||(!low&&Number(macros.LIGHT_ENABLE)!==0));
  if(needsBasis&&overrides.sourceTangents!==true)gaps.push('depthoffset 需要已验证的原生切线，此模型尚未提供');
  if(needsBasis&&Number(macros.LIGHT_ENABLE)===0)gaps.push('关闭光照后源切线初始化为零，需核验退化基底');
  if(Number(macros.ENABLE_SOFT_BODY2)!==0&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>vector(p[k],[0,0,0]).some(x=>x!==0)))gaps.push('depthoffset 活动软体输入尚未接入');
  return gaps;
}

export async function configureDepthOffset(m,p,macros,load,warnings,overrides={}){
  const gaps=depthOffsetGaps(p,macros,overrides);if(gaps.length){
    warnings.push(...gaps,'仅保留源底图预览，未完成 depthoffset 材质适配');
    m.map=await load('Tex0',true,overrides.baseColor);
    return null;
  }
  if(p.__depthLn)return configureDepthOffsetLn(m,p,macros,load,warnings,overrides);
  const n=(k,f=0)=>number(p[k],f),f=(k,d=0)=>scalar(n(k,d));
  const base=vector(p.BaseColor,[1,1,1,1]),intensity=vector(p.Intensity,[1,1,1,0]);
  const depth=vector(p.DepthPara,[1,0,0,1]),dot=vector(p.DotPara,[1,0,0,1]);
  const low=Number(macros.RENDER_QUALITY)===2,change=Number(macros.CHAR_CHANGE_COLOR)===1;
  const normalEnabled=Number(macros.NORMAL_MAP_ENABLE)!==0,useNormal=!low&&normalEnabled&&Number(macros.LIGHT_ENABLE)!==0;
  const sparkle=!low&&n('DotPower')!==0,hasTbn=normalEnabled&&overrides.sourceTangents===true;
  const diffuse=await load('Tex0',false,overrides.baseColor),normal=useNormal?await load('Tex1',false,overrides.normal):null;
  // At quality 2, Tex2.a still drives ordinary depthoffset emission, unlike the _ln variant.
  const mix=await load('Tex2'),depthMap=await load('Tex3');
  const required=[['Tex0',diffuse],['Tex2',mix],['Tex3',depthMap],...(useNormal?[['Tex1',normal]]:[])];
  const missing=required.filter(([,t])=>!t);if(missing.length){warnings.push(...missing.map(([key])=>`depthoffset 缺少实际源贴图：${key}`));return null;}
  m.color.set(0xffffff);m.map=diffuse;m.normalMap=null;
  if(hasTbn)m.defines={...m.defines,USE_TANGENT:''};
  m.emissive.set(0xffffff);m.emissiveIntensity=1;
  const uniforms={neoTime:{value:0},neoEmissionScale:{value:1},doTex0:{value:diffuse},doTex1:{value:normal},doTex2:{value:mix},doTex3:{value:depthMap}};
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    const varyings='varying vec2 doUv;varying vec3 doVertexNormal;varying vec3 doTangent;varying vec3 doBinormal;\n';
    shader.vertexShader=varyings+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\ndoUv=uv;').replace('#include <normal_vertex>',`#include <normal_vertex>
      vec3 doN=transformedNormal;
      #ifdef FLIP_SIDED
      doN=-doN;
      #endif
      doVertexNormal=inverseTransformDirection(doN,viewMatrix)*vec3(-1.0,1.0,1.0);
      doTangent=vec3(1.0,0.0,0.0);doBinormal=vec3(0.0,1.0,0.0);
      ${hasTbn?`doTangent=inverseTransformDirection(transformedTangent,viewMatrix)*vec3(-1.0,1.0,1.0);
      doBinormal=cross(doVertexNormal,doTangent)*tangent.w;`:''}
    `);
    shader.fragmentShader=varyings+`uniform sampler2D doTex0,doTex1,doTex2,doTex3;uniform float neoTime,neoEmissionScale;\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec4 doBase=texture2D(doTex0,doUv),doMix=texture2D(doTex2,doUv);
      vec3 doWorldView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.0,1.0,1.0);
      vec3 doTangentView=${hasTbn?'vec3(dot(doTangent,doWorldView),dot(doBinormal,doWorldView),dot(doVertexNormal,doWorldView))':'doWorldView'};
      // No invented epsilon at the source grazing-angle singularity.
      vec2 doDepthOffset=${depth[1]===0?'vec2(0.0)':`doTangentView.xy*${scalar(depth[1])}/(-doTangentView.z)`};
      vec2 doDepthUv=doUv/${scalar(depth[0])}+vec2(.5)-vec2(.5)/${scalar(depth[0])}+doDepthOffset;
      vec4 doDepth=texture2D(doTex3,doDepthUv);
      float doMask=pow(doBase.a,${scalar(depth[3])});
      vec3 doAlbedo=${change?'vec3(dot(doBase.rgb,vec3(.2125,.7154,.0721)))':'mix(doDepth.rgb,doBase.rgb,doMask)'}*${rgb(base)};
      diffuseColor.rgb=${low?'doAlbedo*doAlbedo':'pow(max(doAlbedo,vec3(0.0)),vec3(2.2))'}*${f('TintValue',1)};
      diffuseColor.a=${scalar(base[3])}*opacity;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      vec3 doSurfaceNormal=doVertexNormal;
      ${useNormal?`vec3 doNormalSample=texture2D(doTex1,doUv).xyz*2.0-1.0;doNormalSample.xy*=${scalar(intensity[0])};
      doSurfaceNormal=mat3(doTangent,doBinormal,doVertexNormal)*normalize(doNormalSample);`:''}
      normal=normalize(mat3(viewMatrix)*(doSurfaceNormal*vec3(-1.0,1.0,1.0)));
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=${low?'.5':`clamp(doMix.g*${scalar(intensity[1])},0.0,1.0)`};`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`float metalnessFactor=${low?'0.0':`clamp(doMix.b*${scalar(intensity[2])},0.0,1.0)`};`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',low?'':`
      reflectedLight.indirectDiffuse*=doMix.r;
      #if defined(USE_ENVMAP) && defined(STANDARD)
      reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.0,1.0),doMix.r,material.roughness);
      #endif
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`
      float doEdge=1.0-dot(doSurfaceNormal,doWorldView);
      float doFresnel=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*doEdge*doEdge*doEdge*doEdge*doEdge,0.0,1.0);
      vec3 doLinearDepth=${low?'doDepth.rgb*doDepth.rgb':'pow(max(doDepth.rgb,vec3(0.0)),vec3(2.2))'};
      vec3 doDepthEmission=doLinearDepth*${scalar(depth[2])}*(1.0-doMask);
      float doStar=0.0;
      ${sparkle?`vec2 doStarOffset=doTangentView.xy*${scalar(.01*dot[2])};
      vec2 doStarUvA=doUv*${scalar(dot[0])}+vec2(.3,neoTime)*${scalar(dot[1])}+doStarOffset;
      vec2 doStarUvB=doUv*${scalar(dot[0]*1.5)}+vec2(neoTime,.3)*${scalar(dot[1])}+doStarOffset;
      doStar=pow(texture2D(doTex3,doStarUvA).a*texture2D(doTex3,doStarUvB).a,${scalar(dot[3])})*(1.0-doMix.a)*${f('DotPower')};`:''}
      totalEmissiveRadiance=(doFresnel*${rgb(vector(p.RimColor,[0,0,0,0]))}*${scalar(intensity[3])}
        +doMix.a*${rgb(vector(p.EmissiveColor,[1,1,1,1]))}*${f('EmissiveValue',1)}+doDepthEmission+doLinearDepth*doStar)*neoEmissionScale;
    `);
  };
  warnings.push('depthoffset 使用源切线/视差/法线/发光与质量分支；原场景光照、BRDF 及精确掠射角除零行为仍未等价');
  return uniforms;
}
