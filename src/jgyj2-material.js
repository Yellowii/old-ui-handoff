// standard_common_jgyj_2.hlsl + DefaultVF. Keep source camera coordinates (+Z forward).
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

export async function configureJgyj2(m,p,macros,load,warnings,overrides={}){
  try{
    const quality=number(macros.RENDER_QUALITY,0),change=number(macros.CHAR_CHANGE_COLOR,0);
    const normalMap=number(macros.NORMAL_MAP_ENABLE,1),light=number(macros.LIGHT_ENABLE,1),character=number(macros.IS_CHARACTER,0);
    const known=new Set(['RENDER_QUALITY','CHAR_CHANGE_COLOR','NORMAL_MAP_ENABLE','LIGHT_ENABLE','IS_CHARACTER','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','USE_LOCAL_PARAMATER']);
    if(![0,1,2].includes(quality)||[change,normalMap,light,character].some(v=>v!==0&&v!==1)||Object.entries(macros).some(([k,v])=>!known.has(k)&&number(v,0)!==0))throw Error('未验证活动宏');
    if(quality!==2&&normalMap&&(overrides.sourceTangents!==true||!light))throw Error('缺少源切线或关闭光照时切线初始化未闭合');
    const base=vector(p.BaseColor,[1,1,1,1]),intensity=vector(p.Intensity,[1,1,1,0]);
    const emission=vector(p.EmissiveColor,[0,0,0,0]),emission1=vector(p.EmissiveC1,[0,0,0,0]);
    const tint=number(p.TintValue,1),emissionStrength=number(p.EmisStrength01,1),reflectStrength=number(p.reflectMult,1);
    // ENABLE_TILING requires original pos_tiling. Unknown nonzero macros stay gated.
    const textures=await Promise.all(['Tex0','Tex1','Tex2','Tex3','Tex5'].map(k=>load(k,false)));
    if(textures.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('缺少源Tex0/1/2/3/5二维贴图');
    const u={neoEmissionScale:{value:1}};
    textures.forEach((t,i)=>{u['neoJg2Tex'+[0,1,2,3,5][i]]={value:t};});
    m.map=null;m.normalMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
    if(quality!==2&&normalMap)m.defines={...m.defines,USE_TANGENT:''};
    m.onBeforeCompile=s=>{
      Object.assign(s.uniforms,u);
      const varying='varying vec2 neoJg2Uv;varying vec3 neoJg2N,neoJg2T,neoJg2B;\n';
      s.vertexShader=varying+s.vertexShader
        .replace('#include <uv_vertex>','#include <uv_vertex>\nneoJg2Uv=uv;')
        .replace('#include <normal_vertex>',`#include <normal_vertex>
          vec3 neoJg2Normal=transformedNormal;
          #ifdef FLIP_SIDED
          neoJg2Normal=-neoJg2Normal;
          #endif
          neoJg2N=normalize(neoJg2Normal)*vec3(1.0,1.0,-1.0);
          neoJg2T=vec3(0.0);neoJg2B=vec3(0.0);
          ${quality!==2&&normalMap?`neoJg2T=normalize(transformedTangent)*vec3(1.0,1.0,-1.0);
          float neoJg2Mirror=tangent.w${character?'':'*sign(dot(cross(modelMatrix[0].xyz,modelMatrix[1].xyz),modelMatrix[2].xyz))'};
          neoJg2B=cross(neoJg2N,neoJg2T)*neoJg2Mirror;`:''}
        `);
      s.fragmentShader=varying+`uniform sampler2D neoJg2Tex0,neoJg2Tex1,neoJg2Tex2,neoJg2Tex3,neoJg2Tex5;
        uniform float neoEmissionScale;
        vec3 neoJg2Linear(vec3 x){return ${quality===2?'x*x':'pow(max(x,vec3(0.0)),vec3(2.2))'};}
      `+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
        vec4 neoJg2D=texture2D(neoJg2Tex0,neoJg2Uv),neoJg2M=texture2D(neoJg2Tex2,neoJg2Uv),neoJg2Mask=texture2D(neoJg2Tex3,neoJg2Uv);
        vec3 neoJg2RawNormal=neoJg2N;
        ${quality!==2&&normalMap?`vec3 neoJg2Sample=texture2D(neoJg2Tex1,neoJg2Uv).xyz*2.0-1.0;
        neoJg2Sample.xy*=${f(intensity[0])};
        neoJg2RawNormal=mat3(neoJg2T,neoJg2B,neoJg2N)*normalize(neoJg2Sample);`:''}
        vec3 neoJg2View=vViewPosition*vec3(1.0,1.0,-1.0);
        vec3 neoJg2CameraT=normalize(cross(neoJg2View,vec3(0.0,1.0,0.0)));
        vec3 neoJg2CameraB=normalize(cross(neoJg2View,neoJg2CameraT));
        vec2 neoJg2CapUv=vec2(dot(neoJg2N,neoJg2CameraT),dot(neoJg2N,neoJg2CameraB))*.5+.5;
        vec3 neoJg2Cap=texture2D(neoJg2Tex5,neoJg2CapUv).rgb;
        vec3 neoJg2Final=mix(neoJg2D.rgb,mix(neoJg2Cap,neoJg2D.rgb,.5)*${f(reflectStrength)}*neoJg2D.rgb,neoJg2Mask.g);
        vec3 neoJg2Emission1=${rgb(emission1)}*neoJg2Mask.r*${f(emissionStrength)};
        diffuseColor.rgb=neoJg2Linear(neoJg2Final*${rgb(base)}${quality===2?`+neoJg2Emission1+neoJg2M.a*${rgb(emission)}*${f(intensity[3])}`:''})*${f(tint)};
        diffuseColor.a=neoJg2D.a*${f(base[3])}*opacity;
      `).replace('#include <normal_fragment_maps>',`
        normal=normalize(${quality===2?'neoJg2N':'neoJg2RawNormal'}*vec3(1.0,1.0,-1.0));
      `).replace('#include <roughnessmap_fragment>',`float roughnessFactor=${quality===2?'.5':`clamp(neoJg2M.g*${f(intensity[1])},0.0,1.0)`};`)
        .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${quality===2?'0.0':`clamp(neoJg2M.b*${f(intensity[2])},0.0,1.0)`};`)
        .replace('#include <aomap_fragment>',quality===2?'':`
          reflectedLight.indirectDiffuse*=neoJg2M.r;
          #if defined(USE_ENVMAP) && defined(STANDARD)
          reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.0,1.0),neoJg2M.r,material.roughness);
          #endif
        `).replace('#include <emissivemap_fragment>',`
          totalEmissiveRadiance=(neoJg2M.a*${rgb(emission)}*${f(intensity[3]*tint)}+neoJg2Emission1)*neoEmissionScale;
        `);
    };
    warnings.push('jgyj_2源几何法线Matcap/遮罩发光/ORM已接入；原场景光照及BRDF仍待标定');
    return u;
  }catch(e){warnings.push('jgyj_2保持未适配：'+e.message);return null;}
}
