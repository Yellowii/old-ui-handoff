const finite=(v,d)=>{if(v===undefined)return d;if((typeof v!=='number'&&typeof v!=='string')||(typeof v==='string'&&!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim()))||!Number.isFinite(Number(v)))throw Error('无效有限数值');return Number(v);};
const vector=(v,d)=>{if(v===undefined)return d;let a;try{a=typeof v==='string'?JSON.parse(v):v;}catch{throw Error('无效向量参数');}if(!Array.isArray(a)||a.length!==4||!a.every(Number.isFinite))throw Error('无效向量参数');return a;};
const lit=v=>Number(v).toFixed(8);
const vec3=v=>`vec3(${v.slice(0,3).map(lit).join(',')})`;

export async function configureSdg(m,p,macros,load,warnings,overrides={}){
  try{
    if(overrides.sourceTangents!==true){warnings.push('standard_char_sdg 需要已验证的源切线，保持未适配');return null;}
    const quality=finite(macros.RENDER_QUALITY,0),change=finite(macros.CHAR_CHANGE_COLOR,1);
    if(![0,1,2].includes(quality)||![0,1].includes(change)||finite(macros.NORMAL_MAP_ENABLE,1)!==0&&finite(macros.NORMAL_MAP_ENABLE,1)!==1||finite(macros.LIGHT_ENABLE,1)!==0&&finite(macros.LIGHT_ENABLE,1)!==1){warnings.push('standard_char_sdg 宏参数超出已证范围，保持未适配');return null;}
    const intensity=vector(p.Intensity,[1,1,1,0]);
    const knownMacros=new Set(['CHAR_CHANGE_COLOR','RENDER_QUALITY','NORMAL_MAP_ENABLE','LIGHT_ENABLE','ENABLE_SOFT_BODY2','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','USE_LOCAL_PARAMATER']);
    if(Object.entries(macros).some(([k,v])=>!knownMacros.has(k)&&finite(v,0)!==0))throw Error('未知活动宏');
    for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ']){
      if(p[k]===undefined)continue;
      const a=typeof p[k]==='string'?JSON.parse(p[k]):p[k];
      if(!Array.isArray(a)||a.length!==3||!a.every(v=>typeof v==='number'&&v===0))throw Error('活动或无效软体参数');
    }
    if(intensity[3]!==0||finite(p.FaceUVOffset,0)*finite(p.CharOffset,1)!==0){warnings.push('standard_char_sdg FaceUVOffset/Intensity.a 非限定值，保持未适配');return null;}
    const base=vector(p.BaseColor,[1,1,1,1]),emissive=vector(p.EmissiveColor,[1,1,1,1]);
    const strength=finite(p.EmissiveStrength,1),speed=finite(p.EmissiveSpeed,1),clamp=finite(p.EmissiveClamp,1),aoPow=finite(p.EmissiveAoPow,1),mask=finite(p.EmissiveMask02,1),tint=finite(p.TintValue,1),emValue=finite(p.EmissiveValue,1);
    if([strength,speed,clamp,aoPow,mask,tint,emValue].some(v=>v<0)){warnings.push('standard_char_sdg 发光参数超出非负域，保持未适配');return null;}
    const d=await load('Tex0',false,overrides.baseColor),n=await load('Tex1',false,overrides.normal),orm=await load('Tex2',false),e=await load('Tex3',false);
    if([d,n,orm,e].some(t=>!t?.isTexture||t.isCubeTexture)){warnings.push('standard_char_sdg 缺少 Tex0-Tex3，保持未适配');return null;}
    const maskTexture=await load('Tex4',false),maskName=p.Tex4??'white';
    if(maskTexture?(!maskTexture.isTexture||maskTexture.isCubeTexture):!['black','white'].includes(maskName))throw Error('缺少源 Tex4');
    const useNormal=quality!==2&&finite(macros.NORMAL_MAP_ENABLE,1)===1&&finite(macros.LIGHT_ENABLE,1)===1;
    m.map=d;m.normalMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;m.normalScale.setScalar(intensity[0]);
    const uniforms={neoSdgDiffuse:{value:d},neoSdgNormal:{value:n},neoSdgOrm:{value:orm},neoSdgEmission:{value:e},neoSdgMask:{value:maskTexture},neoTime:{value:0},neoEmissionScale:{value:1}};
    m.defines={...m.defines,USE_TANGENT:''};
    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      const vary='varying vec2 neoSdgUv;varying vec3 neoSdgN;varying vec3 neoSdgT;varying vec3 neoSdgB;\n';
      shader.vertexShader=vary+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoSdgUv=uv;').replace('#include <normal_vertex>',`#include <normal_vertex>
        vec3 neoSdgSourceN=transformedNormal;
        #ifdef FLIP_SIDED
        neoSdgSourceN=-neoSdgSourceN;
        #endif
        neoSdgN=inverseTransformDirection(neoSdgSourceN,viewMatrix)*vec3(-1.0,1.0,1.0);
        neoSdgT=inverseTransformDirection(transformedTangent,viewMatrix)*vec3(-1.0,1.0,1.0);
        neoSdgB=cross(neoSdgN,neoSdgT)*tangent.w;`);
      shader.fragmentShader=vary+`uniform sampler2D neoSdgDiffuse,neoSdgNormal,neoSdgOrm,neoSdgEmission,neoSdgMask;uniform float neoTime,neoEmissionScale;
        vec3 neoSdgLinear(vec3 c){return ${quality===2?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))'};}
      `+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec4 neoSdgD=texture2D(neoSdgDiffuse,neoSdgUv);vec4 neoSdgM=texture2D(neoSdgOrm,neoSdgUv);diffuseColor.rgb=neoSdgLinear(${change===1?'vec3(dot(neoSdgD.rgb,vec3(.2125,.7154,.0721)))':'neoSdgD.rgb'}*${vec3(base)})*${lit(tint)};diffuseColor.a=neoSdgD.a*${lit(base[3])}*opacity;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=${quality===2?'.5':`clamp(neoSdgM.g*${lit(intensity[1])},0.0,1.0)`};`).replace('#include <metalnessmap_fragment>',`float metalnessFactor=${quality===2?'0.0':`clamp(neoSdgM.b*${lit(intensity[2])},0.0,1.0)`};`).replace('#include <aomap_fragment>',quality===2?'':`reflectedLight.indirectDiffuse*=neoSdgM.r;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',useNormal?`vec3 neoSdgSn=texture2D(neoSdgNormal,neoSdgUv).xyz*2.0-1.0;neoSdgSn.xy*=${lit(intensity[0])};vec3 neoSdgSurfaceN=mat3(neoSdgT,neoSdgB,neoSdgN)*normalize(neoSdgSn);normal=normalize(mat3(viewMatrix)*(neoSdgSurfaceN*vec3(-1.0,1.0,1.0)));`:`normal=normalize(mat3(viewMatrix)*(neoSdgN*vec3(-1.0,1.0,1.0)));`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`vec4 neoSdgE=texture2D(neoSdgEmission,neoSdgUv);float neoSdgMaskValue=${maskTexture?'texture2D(neoSdgMask,neoSdgUv).r':maskName==='black'?'0.0':'1.0'};float neoSdgCycle=clamp(sin(neoTime*${lit(speed)})+1.0,0.0,${lit(clamp)});totalEmissiveRadiance=(neoSdgM.a*${vec3(emissive)}*${lit(emValue)}+neoSdgLinear(neoSdgE.rgb)*pow(neoSdgE.a,${lit(aoPow)})*(1.0-neoSdgMaskValue*${lit(mask)})*${lit(strength)}*neoSdgCycle)*neoEmissionScale;`);
    };
    warnings.push('standard_char_sdg 使用源切线、Tex0-Tex3 与呼吸发光公式');
    return uniforms;
  }catch(error){warnings.push('standard_char_sdg 参数拒绝：'+error.message);return null;}
}
