// standard_char_tpl.hlsl and material_function_zzy.hlsl (pai = 3.14159).
const num=(v,d)=>{
  if(v===undefined)return d;
  if((typeof v!=='number'&&typeof v!=='string')||(typeof v==='string'&&!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim()))||!Number.isFinite(Number(v)))throw Error('无效有限数值');
  return Number(v);
};
const vec=(v,d)=>{if(v===undefined)return d;const a=typeof v==='string'?JSON.parse(v):v;if(!Array.isArray(a)||a.length!==d.length||!a.every(Number.isFinite))throw Error('无效向量');return a;};
const f=v=>Number(v).toFixed(8),rgb=v=>`vec3(${v.slice(0,3).map(f).join(',')})`;

export async function configureTpl(m,p,macros,load,warnings,overrides={}){
  try{
    if(!overrides.sourceSecondUv||!overrides.sourceTangents)throw Error('缺少已交付原第二UV/切线');
    const quality=num(macros.RENDER_QUALITY,0),change=num(macros.CHAR_CHANGE_COLOR,1),hasNormal=num(macros.NORMAL_MAP_ENABLE,1),light=num(macros.LIGHT_ENABLE,1);
    const known=new Set(['RENDER_QUALITY','CHAR_CHANGE_COLOR','NORMAL_MAP_ENABLE','LIGHT_ENABLE','ENABLE_SOFT_BODY2','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','USE_LOCAL_PARAMATER','TEXCOORD1_ENABLE','USE_TEXCOORD1']);
    if(![0,1,2].includes(quality)||[change,hasNormal,light].some(v=>v!==0&&v!==1)||num(macros.TEXCOORD1_ENABLE,1)!==1||num(macros.USE_TEXCOORD1,1)!==1||Object.entries(macros).some(([k,v])=>!known.has(k)&&num(v,0)!==0))throw Error('未知或未启用原UV/顶点分支');
    if(hasNormal&&!light)throw Error('关闭光照时切线初始化未闭合');
    for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vec(p[k],[0,0,0]).some(v=>v!==0))throw Error('活动软体分支尚未接入');
    const base=vec(p.BaseColor,[1,1,1,1]),intensity=vec(p.Intensity,[0,1,1,0]),em=vec(p.EmissiveColor,[1,1,1,1]),rim=vec(p.RimColor,[0,0,0,0]);
    const tint=num(p.TintValue,1),emValue=num(p.EmissiveValue,0),fresnel=num(p.FresnelScale,0);
    const dotScale=num(p.DotScale,1),rotate=num(p.RotateSpeed,.1),center=num(p.CenterScale,1),bg=num(p.BG_DistortStrength,.1),distort=num(p.L1_DistortStrength,.1),distortPower=num(p.L1_DistortRS,.5);
    if(center===0||distortPower<=0)throw Error('除零或pow边界未闭合');
    const keys=[0,3,4,5,6],textures=await Promise.all(keys.map(i=>load('Tex'+i,false)));
    if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('缺少源Tex0/3/4/5/6');
    const u={neoTime:{value:0},neoEmissionScale:{value:1}};
    keys.forEach((k,i)=>{u['neoTplTex'+k]={value:textures[i]};});
    m.map=null;m.normalMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
    m.defines={...m.defines,USE_TANGENT:'',USE_UV1:''};
    m.onBeforeCompile=s=>{
      Object.assign(s.uniforms,u);
      const vary='varying vec2 neoTplUv,neoTplUv1;varying vec3 neoTplN,neoTplT,neoTplB;\n';
      s.vertexShader=vary+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoTplUv=uv;neoTplUv1=uv1;')
        .replace('#include <normal_vertex>',`#include <normal_vertex>
          vec3 neoTplNormal=transformedNormal;
          #ifdef FLIP_SIDED
          neoTplNormal=-neoTplNormal;
          #endif
          neoTplN=normalize(neoTplNormal)*vec3(1.0,1.0,-1.0);
          neoTplT=normalize(transformedTangent)*vec3(1.0,1.0,-1.0);
          neoTplB=cross(neoTplN,neoTplT)*tangent.w;
        `);
      s.fragmentShader=vary+`uniform sampler2D neoTplTex0,neoTplTex3,neoTplTex4,neoTplTex5,neoTplTex6;
        uniform float neoTime,neoEmissionScale;
        vec3 neoTplLinear(vec3 x){return ${quality===2?'x*x':'pow(max(x,vec3(0.0)),vec3(2.2))'};}
        vec2 neoTplRotate(vec2 uv,float angle){float a=angle*6.28318;vec2 x=uv-.5;return .5+vec2(dot(x,vec2(cos(a),-sin(a))),dot(x,vec2(sin(a),cos(a))));}
      `+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
        vec4 neoTplBase=texture2D(neoTplTex0,neoTplUv);
        vec4 neoTplNoise=texture2D(neoTplTex5,neoTplUv1+vec2(neoTime*.1));
        vec4 neoTplStill=texture2D(neoTplTex5,neoTplUv1);
        vec2 neoTplScaled=neoTplUv1/${f(center)}+.5-.5/${f(center)};
        vec2 neoTplRotated=neoTplRotate(neoTplScaled,-neoTime*${f(rotate)});
        vec4 neoTplBg=texture2D(neoTplTex3,neoTplUv1+neoTplNoise.r*${f(bg)});
        vec4 neoTplLayer=texture2D(neoTplTex4,neoTplRotated+neoTplNoise.r*${f(distort)}*pow(neoTplStill.g,${f(distortPower)}));
        vec3 neoTplWorldView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.0,1.0,1.0);
        vec4 neoTplStarA=texture2D(neoTplTex6,neoTplUv*${f(dotScale)}+neoTplWorldView.xy/5.0);
        vec4 neoTplStarB=texture2D(neoTplTex6,neoTplUv*${f(dotScale)}+vec2(neoTime*.003));
        vec3 neoTplFinal=mix(neoTplBg.rgb,neoTplLayer.rgb*1.3,neoTplLayer.a)+neoTplStarA.rgb*neoTplStarB.a*neoTplStarA.a*5000.0;
        diffuseColor.rgb=neoTplLinear(${change?'vec3(dot(neoTplFinal,vec3(.2125,.7154,.0721)))':'neoTplFinal'}*${rgb(base)})*${f(tint)};
        diffuseColor.a=neoTplBase.a*${f(base[3])}*opacity;
      `).replace('#include <normal_fragment_maps>',`
        vec3 neoTplSurfaceN=${quality!==2&&hasNormal?`mat3(neoTplT,neoTplB,neoTplN)*normalize(vec3(${f(-intensity[0])},${f(-intensity[0])},1.0))`:'neoTplN'};
        normal=normalize(neoTplSurfaceN*vec3(1.0,1.0,-1.0));
      `).replace('#include <roughnessmap_fragment>',`float roughnessFactor=${quality===2?'.5':`clamp(${f(intensity[1])},0.0,1.0)`};`)
        .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${quality===2?'0.0':`clamp(${f(intensity[2])},0.0,1.0)`};`)
        .replace('#include <emissivemap_fragment>',`
          float neoTplF=clamp(${f(fresnel)}+(1.0-${f(fresnel)})*pow(1.0-dot(neoTplSurfaceN,normalize(vViewPosition)*vec3(1.0,1.0,-1.0)),5.0),0.0,1.0);
          totalEmissiveRadiance=(neoTplF*${rgb(rim)}*${f(intensity[3])}+${rgb(em)}*${f(emValue)})*neoEmissionScale;
        `);
    };
    warnings.push('TPL原第二UV、旋转/噪声/视角星点已接入；原场景光照及BRDF仍待标定');
    return u;
  }catch(e){warnings.push('TPL保持未适配：'+e.message);return null;}
}
