// standard_common_yp.hlsl + DefaultVF. Keep source camera coordinates (+Z forward).
const number=(v,d)=>{
  if(v===undefined)return d;
  if((typeof v!=='number'&&typeof v!=='string')||(typeof v==='string'&&!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim()))||!Number.isFinite(Number(v)))throw Error('无效有限数值');
  return Number(v);
};
const vector=(v,d)=>{
  if(v===undefined)return d;
  const a=typeof v==='string'?JSON.parse(v):v;
  if(!Array.isArray(a)||a.length!==4||!a.every(Number.isFinite))throw Error('无效float4');
  return a;
};
const f=v=>Number(v).toFixed(8),rgb=v=>`vec3(${v.slice(0,3).map(f).join(',')})`;

export async function configureCommonYp(m,p,macros,load,warnings,overrides={}){
  try{
    const quality=number(macros.RENDER_QUALITY,0),change=number(macros.CHAR_CHANGE_COLOR,0);
    const normalMap=number(macros.NORMAL_MAP_ENABLE,1),light=number(macros.LIGHT_ENABLE,1),character=number(macros.IS_CHARACTER,0);
    const known=new Set(['RENDER_QUALITY','CHAR_CHANGE_COLOR','NORMAL_MAP_ENABLE','LIGHT_ENABLE','IS_CHARACTER','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','USE_LOCAL_PARAMATER']);
    if(![0,1,2].includes(quality)||[change,normalMap,light,character].some(v=>v!==0&&v!==1)||Object.entries(macros).some(([k,v])=>!known.has(k)&&number(v,0)!==0))throw Error('未验证活动宏');
    if(normalMap&&(overrides.sourceTangents!==true||!light))throw Error('缺少源切线或关闭光照时切线初始化未闭合');
    const base=vector(p.BaseColor,[1,1,1,1]),intensity=vector(p.Intensity,[1,1,1,0]);
    const emission=vector(p.EmissiveColor,[0,0,0,0]),rim=vector(p.frenelColor,[1,1,1,1]);
    const tint=number(p.TintValue,1),rimPower=number(p.frenelPow,1),rimStrength=number(p.frenelMult,0),ball=number(p.qiuMult,1);
    if(rimPower<=0)throw Error('frenelPow零或负数边界尚未验证');
    const textures=await Promise.all(['Tex0','Tex1','Tex2','Tex3','Tex4'].map(k=>load(k,false)));
    if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('缺少源Tex0–Tex4二维贴图');
    const u={neoEmissionScale:{value:1}};
    textures.forEach((t,i)=>{u['neoYpTex'+i]={value:t};});
    m.map=null;m.normalMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
    if(normalMap)m.defines={...m.defines,USE_TANGENT:''};
    m.onBeforeCompile=s=>{
      Object.assign(s.uniforms,u);
      const varying='varying vec2 neoYpUv;varying vec3 neoYpN,neoYpT,neoYpB;\n';
      s.vertexShader=varying+s.vertexShader
        .replace('#include <uv_vertex>','#include <uv_vertex>\nneoYpUv=uv;')
        .replace('#include <normal_vertex>',`#include <normal_vertex>
          vec3 neoYpNormal=transformedNormal;
          #ifdef FLIP_SIDED
          neoYpNormal=-neoYpNormal;
          #endif
          neoYpN=normalize(neoYpNormal)*vec3(1.0,1.0,-1.0);
          neoYpT=vec3(0.0);neoYpB=vec3(0.0);
          ${normalMap?`neoYpT=normalize(transformedTangent)*vec3(1.0,1.0,-1.0);
          float neoYpMirror=tangent.w${character?'':'*sign(dot(cross(modelMatrix[0].xyz,modelMatrix[1].xyz),modelMatrix[2].xyz))'};
          neoYpB=cross(neoYpN,neoYpT)*neoYpMirror;`:''}
        `);
      s.fragmentShader=varying+`uniform sampler2D neoYpTex0,neoYpTex1,neoYpTex2,neoYpTex3,neoYpTex4;
        uniform float neoEmissionScale;
        vec3 neoYpLinear(vec3 x){return ${quality===2?'x*x':'pow(max(x,vec3(0.0)),vec3(2.2))'};}
      `+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
        vec4 neoYpD=texture2D(neoYpTex0,neoYpUv),neoYpM=texture2D(neoYpTex2,neoYpUv),neoYpMask=texture2D(neoYpTex3,neoYpUv);
        vec3 neoYpRawNormal=neoYpN;
        ${normalMap?`vec3 neoYpSample=texture2D(neoYpTex1,neoYpUv).xyz*2.0-1.0;
        neoYpSample.xy*=${f(intensity[0])};
        neoYpRawNormal=mat3(neoYpT,neoYpB,neoYpN)*normalize(neoYpSample);`:''}
        vec3 neoYpView=vViewPosition*vec3(1.0,1.0,-1.0);
        vec3 neoYpCameraT=normalize(cross(neoYpView,vec3(0.0,1.0,0.0)));
        vec3 neoYpCameraB=normalize(cross(neoYpView,neoYpCameraT));
        vec2 neoYpCapUv=vec2(dot(neoYpRawNormal,neoYpCameraT),dot(neoYpRawNormal,neoYpCameraB))*.5+.5;
        vec3 neoYpCap=texture2D(neoYpTex4,neoYpCapUv).rgb;
        vec3 neoYpFinal=mix(neoYpD.rgb,mix(neoYpCap,neoYpD.rgb,.5)*neoYpD.rgb,neoYpMask.b);
        diffuseColor.rgb=neoYpLinear(${change?'vec3(dot(neoYpFinal,vec3(.2125,.7154,.0721)))':'neoYpFinal'}*${rgb(base)})*${f(tint)};
        diffuseColor.a=neoYpD.a*${f(base[3])}*opacity;
      `).replace('#include <normal_fragment_maps>',`
        normal=normalize(${quality===2?'neoYpN':'neoYpRawNormal'}*vec3(1.0,1.0,-1.0));
      `).replace('#include <roughnessmap_fragment>',`float roughnessFactor=${quality===2?'.5':`clamp(neoYpM.g*${f(intensity[1])},0.0,1.0)`};`)
        .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${quality===2?'0.0':`clamp(neoYpM.b*${f(intensity[2])},0.0,1.0)`};`)
        .replace('#include <aomap_fragment>',quality===2?'':`
          reflectedLight.indirectDiffuse*=neoYpM.r;
          #if defined(USE_ENVMAP) && defined(STANDARD)
          reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.0,1.0),neoYpM.r,material.roughness);
          #endif
        `).replace('#include <emissivemap_fragment>',`
          float neoYpF=pow(1.0-clamp(dot(neoYpN,normalize(neoYpView)),0.0,1.0),${f(rimPower)});
          vec3 neoYpRim=neoYpF*${rgb(rim)}*${f(rimStrength)}*neoYpMask.r;
          vec3 neoYpBall=mix(neoYpCap,neoYpD.rgb,.8)*neoYpD.rgb*neoYpMask.b*${f(ball)};
          totalEmissiveRadiance=(neoYpM.a*${rgb(emission)}*${f(intensity[3]*tint)}+neoYpRim+neoYpBall)*neoEmissionScale;
        `);
    };
    warnings.push('common_yp源Matcap/顶点边缘光/ORM已接入；原场景光照及BRDF仍待标定');
    return u;
  }catch(e){warnings.push('common_yp保持未适配：'+e.message);return null;}
}
