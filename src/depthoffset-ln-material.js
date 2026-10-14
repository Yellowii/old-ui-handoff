import {Vector2,Vector4} from 'three';

// Original standard_char_depthoffset_ln.hlsl, GLES path. Native RTSize and
// BuiltInFragCoord evidence: reports/source-shaders/android-native/*-t82.json.
const number=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const vector=(v,f)=>{try{const a=JSON.parse(v);if(Array.isArray(a)&&a.length===f.length&&a.every(Number.isFinite))return a;}catch{}return f;};
const scalar=v=>Number(v).toFixed(8),rgb=v=>`vec3(${v.slice(0,3).map(scalar).join(',')})`;

export async function configureDepthOffsetLn(m,p,macros,load,warnings,overrides={}){
  const n=(k,f=0)=>number(p[k],f),f=(k,d=0)=>scalar(n(k,d));
  const quality=Number(macros.RENDER_QUALITY),low=quality===2,change=Number(macros.CHAR_CHANGE_COLOR)!==0;
  const base=vector(p.BaseColor,[1,1,1,1]),intensity=vector(p.Intensity,[1,1,1,0]);
  const depth=vector(p.DepthPara,[1,0,0,1]),dot=vector(p.DotPara,[1,0,0,1]);
  const hasTbn=!low&&Number(macros.NORMAL_MAP_ENABLE)!==0&&overrides.sourceTangents===true;
  const useNormal=!low&&Number(macros.NORMAL_MAP_ENABLE)!==0&&Number(macros.LIGHT_ENABLE)!==0;
  const sparkle=quality===0&&n('DotPower')!==0;
  const diffuse=await load('Tex0',false,overrides.baseColor),normal=useNormal?await load('Tex1',false,overrides.normal):null;
  const mix=low?null:await load('Tex2'),depthMap=await load('Tex3');
  const required=[['Tex0',diffuse],['Tex3',depthMap],...(!low?[['Tex2',mix]]:[]),...(useNormal?[['Tex1',normal]]:[])];
  const missing=required.filter(([,t])=>!t);
  if(missing.length){warnings.push(...missing.map(([key])=>`depthoffset_ln 缺少实际源贴图：${key}`));return null;}
  m.color.set(0xffffff);m.map=diffuse;m.normalMap=null;m.vertexColors=false;
  if(hasTbn)m.defines={...m.defines,USE_TANGENT:''};
  m.emissive.set(0xffffff);m.emissiveIntensity=1;
  const uniforms={neoTime:{value:0},neoEmissionScale:{value:1},lnRTSize:{value:new Vector4()},lnTex0:{value:diffuse},lnTex1:{value:normal},lnTex2:{value:mix},lnTex3:{value:depthMap}};
  const drawingSize=new Vector2();
  m.onBeforeRender=renderer=>{
    const target=renderer.getRenderTarget();
    if(target){const mipScale=2**renderer.getActiveMipmapLevel();drawingSize.set(Math.max(1,Math.floor(target.width/mipScale)),Math.max(1,Math.floor(target.height/mipScale)));}
    else renderer.getDrawingBufferSize(drawingSize);
    const {x:w,y:h}=drawingSize;
    // Source stores target size separately from viewport rect. gl_FragCoord is
    // already in framebuffer pixels (including viewport origin and pixel center).
    uniforms.lnRTSize.value.set(w,h,1/w,1/h);
  };
  const linear=x=>low?`(${x})*(${x})`:`pow(max(${x},vec3(0.0)),vec3(2.2))`;
  const rawEmission=`lnBase.rgb*${rgb(vector(p.EmissiveColor,[1,1,1,1]))}*${f('EmissiveValue',1)}`;
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    const varyings='varying vec2 lnUv;varying vec3 lnVertexNormal;varying vec3 lnTangent;varying vec3 lnBinormal;\n';
    shader.vertexShader=varyings+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nlnUv=uv;').replace('#include <normal_vertex>',`#include <normal_vertex>
      vec3 lnN=transformedNormal;
      #ifdef FLIP_SIDED
      lnN=-lnN;
      #endif
      lnVertexNormal=inverseTransformDirection(lnN,viewMatrix)*vec3(-1.0,1.0,1.0);
      lnTangent=vec3(1.0,0.0,0.0);lnBinormal=vec3(0.0,1.0,0.0);
      ${hasTbn?`lnTangent=inverseTransformDirection(transformedTangent,viewMatrix)*vec3(-1.0,1.0,1.0);
      lnBinormal=cross(lnVertexNormal,lnTangent)*tangent.w;`:''}
    `);
    shader.fragmentShader=varyings+'uniform sampler2D lnTex0,lnTex1,lnTex2,lnTex3;uniform vec4 lnRTSize;uniform float neoTime,neoEmissionScale;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec4 lnBase=texture2D(lnTex0,lnUv),lnMix=${low?'vec4(1.0,1.0,0.0,1.0)':'texture2D(lnTex2,lnUv)'};
      vec3 lnWorldView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.0,1.0,1.0);
      vec3 lnTangentView=${hasTbn?'vec3(dot(lnTangent,lnWorldView),dot(lnBinormal,lnWorldView),dot(lnVertexNormal,lnWorldView))':'lnWorldView'};
      vec2 lnScreenUv=gl_FragCoord.xy*lnRTSize.zw;
      vec2 lnDepthOffset=${depth[1]===0?'vec2(0.0)':`lnTangentView.xy*${scalar(depth[1])}/(-lnTangentView.z)`};
      vec2 lnDepthUv=lnScreenUv*${scalar(depth[0])}+lnDepthOffset;
      vec4 lnDepth=texture2D(lnTex3,lnDepthUv);
      float lnMask=pow(lnBase.a,${scalar(depth[3])});
      vec3 lnLinearDepth=${linear('lnDepth.rgb')};
      vec3 lnDepthEmission=lnLinearDepth*${scalar(depth[2])}*(1.0-lnMask);
      vec3 lnRawEmission=${rawEmission};
      vec3 lnAlbedo=${change?`vec3(dot(lnBase.rgb,vec3(.2125,.7154,.0721)))*${rgb(base)}`:low?`lnBase.rgb*${rgb(base)}+lnDepthEmission+lnRawEmission`:`mix(lnDepth.rgb,lnBase.rgb,lnMask)*${rgb(base)}`};
      diffuseColor.rgb=${linear('lnAlbedo')}*${f('TintValue',1)};
      diffuseColor.a=${scalar(base[3])}*opacity;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      vec3 lnSurfaceNormal=lnVertexNormal;
      ${useNormal?`vec3 lnNormalSample=texture2D(lnTex1,lnUv).xyz*2.0-1.0;lnNormalSample.xy*=${scalar(intensity[0])};
      lnSurfaceNormal=mat3(lnTangent,lnBinormal,lnVertexNormal)*normalize(lnNormalSample);`:''}
      normal=normalize(mat3(viewMatrix)*(lnSurfaceNormal*vec3(-1.0,1.0,1.0)));
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=${low?'.5':`clamp(lnMix.g*${scalar(intensity[1])},0.0,1.0)`};`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`float metalnessFactor=${low?'0.0':`clamp(lnMix.b*${scalar(intensity[2])},0.0,1.0)`};`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',low?'':`
      reflectedLight.indirectDiffuse*=lnMix.r;
      #if defined(USE_ENVMAP) && defined(STANDARD)
      reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.0,1.0),lnMix.r,material.roughness);
      #endif
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`
      float lnEdge=1.0-dot(lnSurfaceNormal,lnWorldView);
      float lnFresnel=clamp(lnEdge*lnEdge*lnEdge*lnBase.a,0.0,1.0);
      lnFresnel=clamp((lnFresnel-.05)/.15,0.0,1.0);
      lnFresnel=lnFresnel*lnFresnel*(3.0-2.0*lnFresnel);
      float lnStar=0.0;
      ${sparkle?`vec2 lnStarOffset=lnTangentView.xy*${scalar(.01*dot[2])};
      vec2 lnStarUvA=lnUv*${scalar(dot[0])}+vec2(.3,neoTime)*${scalar(dot[1])}+lnStarOffset;
      vec2 lnStarUvB=lnUv*${scalar(dot[0]*1.5)}+vec2(neoTime,.3)*${scalar(dot[1])}+lnStarOffset;
      lnStar=pow(texture2D(lnTex3,lnStarUvA).a*texture2D(lnTex3,lnStarUvB).a,${scalar(dot[3])})*(1.0-lnMix.a)*${f('DotPower')};`:''}
      totalEmissiveRadiance=(lnFresnel*${rgb(vector(p.RimColor,[0,0,0,0]))}*${scalar(intensity[3])}
        +lnMix.a*lnRawEmission+lnDepthEmission+lnLinearDepth*lnStar)*neoEmissionScale;
    `);
  };
  warnings.push('depthoffset_ln 已接入原 GLES 屏幕坐标、目标尺寸与源质量分支；原场景光照/BRDF及精确掠射角除零行为仍未等价');
  return uniforms;
}
