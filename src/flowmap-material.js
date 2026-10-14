// Verified standard_char_flowmap / flowmap02: source RGB flow, unflowed opacity.
export async function configureFlowmap(m,p,macros,load,warnings,overrides={},second=false){
  const n=(k,d=0)=>Number.isFinite(Number(p[k]))?Number(p[k]):d;
  const f=(k,d=0)=>n(k,d).toFixed(8);
  const vec=(k,d)=>{try{const v=JSON.parse(p[k]);if(Array.isArray(v)&&v.length===4&&v.every(Number.isFinite))return v;}catch{}return d;};
  const rgb=(k,d)=>`vec3(${vec(k,d).slice(0,3).map(v=>v.toFixed(8)).join(',')})`;
  const base=vec('BaseColor',[1,1,1,1]),intensity=vec('Intensity',[1,1,1,0]);
  const low=Number(macros.RENDER_QUALITY)===2,change=Number(macros.CHAR_CHANGE_COLOR)===1;
  const diffuse=await load('Tex0',false,overrides.baseColor),normal=await load('Tex1',false,overrides.normal),mix=await load('Tex2'),flow=await load('Tex3'),layer=second?await load('Tex4'):diffuse;
  const sample=(t,u,uv,fallback)=>t?`texture2D(${u},${uv})`:fallback;
  if(!mix)warnings.push('流动材质缺少源 ORM 贴图，ORM 预览值不代表原版');
  m.color.set(0xffffff);m.map=diffuse;
  m.normalMap=low||Number(macros.NORMAL_MAP_ENABLE)===0||Number(macros.LIGHT_ENABLE)===0?null:normal;
  m.normalScale.setScalar(intensity[0]);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  if(second)m.defines={...m.defines,USE_UV1:''};
  const uniforms={neoFlowDiffuse:{value:diffuse},neoFlowMix:{value:mix},neoFlowMap:{value:flow},neoFlowLayer:{value:layer},neoTime:{value:0},neoEmissionScale:{value:1}};
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    const varyings=`varying vec2 neoFlowUv;${second?'varying vec2 neoFlowSecondUv;':''}\n`;
    shader.vertexShader=varyings+shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>\nneoFlowUv=uv;${second?'neoFlowSecondUv=uv1;':''}`);
    shader.fragmentShader=varyings+`uniform sampler2D neoFlowDiffuse;uniform sampler2D neoFlowMix;uniform sampler2D neoFlowMap;uniform sampler2D neoFlowLayer;
      uniform float neoTime;uniform float neoEmissionScale;
      vec3 neoFlowLinear(vec3 c){return ${Number(macros.RENDER_QUALITY??0)>=2?'c*c':'pow(max(c,vec3(0.0)),vec3(2.2))'};}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec2 neoFlowBaseUv=neoFaceUv(neoFlowUv);
      vec2 neoFlowSampleUv=${second?'neoFlowSecondUv':'neoFlowBaseUv'};
      vec4 neoFlowD=${sample(diffuse,'neoFlowDiffuse','neoFlowBaseUv','vec4(0.0,1.0,0.0,1.0)')};
      vec4 neoFlowM=${sample(mix,'neoFlowMix','neoFlowBaseUv','vec4(1.0,1.0,0.0,0.0)')};
      vec4 neoFlowF=${sample(flow,'neoFlowMap','neoFlowSampleUv','vec4(1.0)')};
      float neoFlowPhase=neoTime*.1*${f('TimeSpeed',1)};
      vec2 neoFlowDirection=(neoFlowF.rg*2.0-1.0)*${f('FlowSpeed',1)};
      vec2 neoFlowA=neoFlowSampleUv*vec2(${f('UVtilingX',1)},${f('UVtilingY',1)})-fract(neoFlowPhase)*neoFlowDirection;
      vec2 neoFlowB=neoFlowSampleUv*vec2(${f('UVtilingX',1)},${f('UVtilingY',1)})-fract(neoFlowPhase+.5)*neoFlowDirection;
      vec3 neoFlowColor=mix(${sample(layer,'neoFlowLayer','neoFlowA',second?'vec4(1.0)':'vec4(0.0,1.0,0.0,1.0)')}.rgb,${sample(layer,'neoFlowLayer','neoFlowB',second?'vec4(1.0)':'vec4(0.0,1.0,0.0,1.0)')}.rgb,abs((fract(neoFlowPhase)-.5)/.5));
      neoFlowColor=mix(neoFlowD.rgb,neoFlowColor,neoFlowF.b);
      diffuseColor.rgb=neoFlowLinear(${change?'vec3(dot(neoFlowColor,vec3(.2125,.7154,.0721)))':'neoFlowColor'}*${rgb('BaseColor',[1,1,1,1])})*${f('TintValue',1)};
      diffuseColor.a=neoFlowD.a*${base[3].toFixed(8)}*opacity;
    `);
    // flowmap02 computes a second flow but never uses finalcolor2 in any output.
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=${low?'.5':`clamp(neoFlowM.g*${intensity[1].toFixed(8)},0.0,1.0)`};`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',`float metalnessFactor=${low?'0.0':`clamp(neoFlowM.b*${intensity[2].toFixed(8)},0.0,1.0)`};`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',low?'':`
      reflectedLight.indirectDiffuse*=neoFlowM.r;
      #if defined(USE_ENVMAP) && defined(STANDARD)
      reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.0,1.0),neoFlowM.r,material.roughness);
      #endif
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`
      float neoFlowFresnel=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-dot(normal,normalize(vViewPosition)),5.0),0.0,1.0);
      totalEmissiveRadiance=(neoFlowFresnel*${rgb('RimColor',[0,0,0,0])}*${intensity[3].toFixed(8)}+neoFlowM.a*${rgb('EmissiveColor',[1,1,1,1])}*${f('EmissiveValue',1)})*neoEmissionScale;
    `);
  };
  warnings.push('流动、遮罩、面部 UV、透明及发光按源公式接入；软体形变、源切线空间和场景光照仍未还原');
  return uniforms;
}
