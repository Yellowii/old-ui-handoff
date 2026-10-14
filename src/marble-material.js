const finite=(v,d=0)=>{
  const n=Number(v);if(v===undefined)return d;
  if(!Number.isFinite(n))throw Error('无效原标量');return n;
};
const vector=(v,d)=>{
  if(v===undefined)return d;
  const a=Array.isArray(v)?v:JSON.parse(String(v));
  if(!Array.isArray(a)||a.length!==d.length||!a.every(Number.isFinite))throw Error('无效原向量');
  return a;
};
const f=v=>Number(v).toFixed(8),rgb=v=>`vec3(${v.slice(0,3).map(f).join(',')})`;

// char_marble(.hlsl) and char_marble_emissive(.hlsl), translated at their source branches.
export async function configureMarble(m,p,macros,load,warnings,overrides={},emissive=false){
 try{
  const quality=finite(macros.RENDER_QUALITY,0),change=finite(macros.CHAR_CHANGE_COLOR,0);
  const normalMap=finite(macros.NORMAL_MAP_ENABLE,1),light=finite(macros.LIGHT_ENABLE,1);
  const known=new Set(['RENDER_QUALITY','CHAR_CHANGE_COLOR','NORMAL_MAP_ENABLE','LIGHT_ENABLE','ENABLE_SOFT_BODY2','ENABLE_POINT_LIGHT_AND_SPOTLIGHT']);
  if(![0,1,2].includes(quality)||[change,normalMap,light].some(v=>v!==0&&v!==1)||Object.entries(macros).some(([k,v])=>!known.has(k)&&finite(v,0)!==0))throw Error('未验证活动宏');
  if(quality!==2&&normalMap&&(!overrides.sourceTangents||!light))throw Error('缺少活动原TBN');
  const base=vector(p.BaseColor,[1,1,1,1]),rim=vector(p.RimColor,[0,0,0,0]),emission=vector(p.EmissiveColor,[1,1,1,1]);
  const intensity=vector(p.Intensity,[1,1,1,0]),i1=vector(p.Intensity01,[1,1,1,0]);
  const tint=finite(p.TintValue,1),depth=finite(p.Depth,.5),fresnel=finite(p.FresnelScale,0),emissionValue=finite(p.EmissiveValue,1);
  const maps=await Promise.all(['Tex0','Tex1','Tex2'].map((key,index)=>load(key,index===0)));
  if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('缺少源 Tex0/Tex1/Tex2 二维贴图');
  const u={marbleTex0:{value:maps[0]},marbleTex1:{value:maps[1]},marbleTex2:{value:maps[2]},neoEmissionScale:{value:1}};
  m.map=null;m.normalMap=null;m.aoMap=null;m.roughnessMap=null;m.metalnessMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  if(quality!==2&&normalMap)m.defines={...m.defines,USE_TANGENT:''};
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);
   const vary='varying vec2 marbleUv;varying vec3 marbleN,marbleT,marbleB;\n';
   s.vertexShader=vary+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nmarbleUv=uv;')
    .replace('#include <normal_vertex>',`#include <normal_vertex>
      vec3 marbleNormal=transformedNormal;
      #ifdef FLIP_SIDED
      marbleNormal=-marbleNormal;
      #endif
      marbleN=normalize(inverseTransformDirection(marbleNormal,viewMatrix))*vec3(-1.0,1.0,1.0);
      marbleT=vec3(1.0,0.0,0.0);marbleB=vec3(0.0,1.0,0.0);
      ${quality!==2&&normalMap?`marbleT=normalize(inverseTransformDirection(transformedTangent,viewMatrix))*vec3(-1.0,1.0,1.0);
      marbleB=cross(marbleN,marbleT)*tangent.w;`:''}`);
   s.fragmentShader=vary+`uniform sampler2D marbleTex0,marbleTex1,marbleTex2;uniform float neoEmissionScale;\n`+s.fragmentShader;
   const mainUv=emissive?`vec2 marbleMainUv=marbleUv;marbleMainUv.x+=marbleMainUv.y<.25?${f(finite(p.FaceUVOffset,0)*finite(p.CharOffset,1))}:0.0;`:'vec2 marbleMainUv=marbleUv;';
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
      ${mainUv}
      vec4 marbleD=texture2D(marbleTex0,marbleMainUv),marbleNormalMap=texture2D(marbleTex1,marbleMainUv);
      vec3 marbleSurfaceN=marbleN;
      ${quality!==2&&normalMap?`vec3 marbleSampleN=marbleNormalMap.xyz*2.0-1.0;marbleSampleN.xy*=${f(intensity[0])};marbleSurfaceN=mat3(marbleT,marbleB,marbleN)*normalize(marbleSampleN);`:''}
      vec3 marbleView=normalize(vViewPosition)*vec3(-1.0,1.0,1.0);
      vec3 marbleTangentView=vec3(dot(marbleT,marbleView),dot(marbleB,marbleView),dot(marbleN,marbleView));
      vec2 marbleOffset=marbleTangentView.xy*${f(depth)};
      vec4 marbleM0=texture2D(marbleTex2,marbleMainUv*${f(i1[3])}+marbleOffset);
      vec4 marbleM1=texture2D(marbleTex2,marbleMainUv*${f(i1[1])}+marbleOffset*.1);
      vec4 marbleM2=texture2D(marbleTex2,marbleMainUv*${f(i1[3]*3.5)});
      ${change?quality===2?`float marbleLum=dot(marbleD.rgb,vec3(.2125,.7154,.0721));diffuseColor.rgb=pow(max(vec3(marbleLum)*${rgb(base)},vec3(0.0)),vec3(2.0))*${f(tint)};`:`float marbleLum=dot(marbleD.rgb,vec3(.2125,.7154,.0721));diffuseColor.rgb=pow(max(mix(marbleD.rgb,vec3(marbleLum)*${rgb(base)},marbleNormalMap.a),vec3(0.0)),vec3(2.2))*${f(tint)};`:`vec3 marbleDiffuse=pow(max(mix(marbleD.rgb,${rgb(base)},marbleM0.b*${f(i1[2]-.2)}),vec3(0.0)),vec3(${quality===2?'2.0':'2.2'}))*${f(tint)};
      marbleDiffuse+=pow(max(vec3(marbleM1.r*${f(i1[0])}),vec3(0.0)),vec3(${quality===2?'2.0':'2.2'}))*${f(tint)};
      marbleDiffuse+=pow(max(mix(marbleD.rgb,${rgb(base)},marbleM2.b*2.0),vec3(0.0)),vec3(${quality===2?'2.0':'2.2'}))*${f(tint)};
      diffuseColor.rgb=marbleDiffuse*${f(tint)};`}
      diffuseColor.a=marbleD.a*${f(base[3])}*opacity;
   `).replace('#include <normal_fragment_maps>',`normal=normalize(${quality===2?'marbleN':'marbleSurfaceN'}*vec3(-1.0,1.0,1.0));`)
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${quality===2?'.5':`clamp(${f(intensity[1])},0.0,1.0)`};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${quality===2?'0.0':`clamp(${f(intensity[2])},0.0,1.0)`};`)
    .replace('#include <aomap_fragment>','');
   const emissionCode=emissive?`
      vec3 marbleViewN=normalize(vViewPosition);
      float marbleFres=clamp(${f(fresnel)}+(1.0-${f(fresnel)})*pow(1.0-dot(normal,marbleViewN),5.0),0.0,1.0);
      totalEmissiveRadiance=(${rgb(emission)}*${f(emissionValue)}*marbleNormalMap.a+marbleFres*${rgb(rim)}*${f(intensity[3])}+pow(max(marbleD.rgb*${rgb(emission)},vec3(0.0)),vec3(${quality===2?'2.0':'2.2'}))*.2)*neoEmissionScale;
    `:`
      vec3 marbleCameraT=normalize(cross(marbleView,vec3(0.0,1.0,0.0))),marbleCameraB=normalize(cross(marbleView,marbleCameraT));
      vec2 marbleCapUv=vec2(dot(marbleSurfaceN,marbleCameraT),dot(marbleSurfaceN,marbleCameraB))*.5+.5;
      vec3 marbleCap=texture2D(marbleTex2,marbleCapUv).rgb;
      float marbleFres=clamp(${f(fresnel)}+(1.0-${f(fresnel)})*pow(1.0-dot(normal,normalize(vViewPosition)),5.0),0.0,1.0);
      totalEmissiveRadiance=(pow(max(vec3(marbleCap.g),vec3(0.0)),vec3(${quality===2?'2.0':'2.2'}))*${f(tint)}+marbleFres*${rgb(rim)}*${f(intensity[3])})*neoEmissionScale;
    `;
   s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',emissionCode);
  };
  warnings.push(`${emissive?'char_marble_emissive':'char_marble'} 原多UV混合、质量与发光分支已接入；原场景光照仍待标定`);
  return u;
 }catch(e){warnings.push(`${emissive?'char_marble_emissive':'char_marble'} 保持未适配：${e.message}`);return null;}
}
