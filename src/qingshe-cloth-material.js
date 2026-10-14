import {runtimeContract} from './handoff/runtime-contracts.js';
const textureDefaults=runtimeContract("qingshe-cloth-texture-defaults");

const number=(value,fallback)=>{const n=value===undefined?fallback:Number(value);if(!Number.isFinite(n))throw Error('无效原标量');return n;};
const vector=(value,fallback)=>{const a=value===undefined?fallback:Array.isArray(value)?value:JSON.parse(String(value));if(!Array.isArray(a)||a.length!==fallback.length||!a.every(Number.isFinite))throw Error(`无效原 float${fallback.length}`);return a;};
const f=value=>value.toFixed(8),gv=value=>`vec${value.length}(${value.map(f).join(',')})`;

// s31/qingshe_cloth.hlsl has its own flow-light path, so it must not inherit
// rainbow_film's face offset or dissolve behavior.
export async function configureQingsheCloth(m,p,macros,load,warnings,overrides={}){
  try{
    const quality=number(macros.RENDER_QUALITY,0),low=quality===2,change=number(macros.CHAR_CHANGE_COLOR,1),normalEnabled=number(macros.NORMAL_MAP_ENABLE,1);
    if(![0,1,2].includes(quality)||![0,1].includes(change)||![0,1].includes(normalEnabled))throw Error('未知活动宏');
    if(!low&&normalEnabled&&!overrides.sourceTangents)throw Error('缺少有效原切线');
    for(const key of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(vector(p[key],[0,0,0]).some(value=>value!==0))throw Error('活动软体位移未接入');
    const n=(key,fallback)=>number(p[key],fallback),v=(key,fallback)=>vector(p[key],fallback);
    const base=v('BaseColor',[1,1,1,1]),intensity=v('Intensity',[1.5,.1,.5,0]),rainbow=v('RainbowColor',[.580,.678,1,1]),hue=v('RainbowHue',[.235,.772,1,1]),emissive=v('EmissiveColor',[1,1,1,1]),rim=v('RimColor',[0,0,0,0]),flowColor=v('FlowColor',[1,1,1,1]);
    const a={TintValue:n('TintValue',1),MatcapNoiseIntensity:n('MatcapNoiseIntensity',.8),MatcapIntensity:n('MatcapIntensity',1),RainbowToBaseColorKey:n('RainbowToBaseColorKey',0),Rainbow_Key:n('Rainbow_Key',1),COA:n('COA',.4),COB:n('COB',1),OPA:n('OPA',.3),OPB:n('OPB',.6),OPLerpA:n('OPLerpA',.6),OPLerpB:n('OPLerpB',1),NoiseNormalIntensity:n('NoiseNormalIntensity',.5),RainbowNoiseTiling:n('RainbowNoiseTiling',8),RainbowTiling:n('RainbowTiling',.8),BaseRainbowIntensity:n('BaseRainbowIntensity',1.5),FlowRainbowSpeed:n('FlowRainbowSpeed',.8),EmissiveIntensity:n('EmissiveIntensity',1),FresnelScale:n('FresnelScale',0),FlowStr:n('FlowStr',1),FlowTilingX:n('FlowTilingX',1),FlowTilingY:n('FlowTilingY',1),FlowLSpeed:n('FlowLSpeed',1)};
    if(a.COB<=0||a.OPB<=0||hue.slice(0,3).every(value=>value===0))throw Error('原 pow 或 Hue 轴未定义');
    const maps=await Promise.all([0,1,2,3].map(index=>load(`Tex${index}`,index===0)));
    const capDefault=textureDefaults.Tex4;
    if(!capDefault||typeof capDefault.url!=='string'||!capDefault.url)throw Error('Host qingshe-cloth Tex4 default required');
    maps.push(await load('Tex4',false,capDefault.url));
    if(maps.some(texture=>!texture?.isTexture||texture.isCubeTexture))throw Error('缺少原 Tex0-Tex4');
    const s=key=>f(a[key]),uniforms={neoQsTime:{value:0},neoQsEmissionScale:{value:1}};
    maps.forEach((texture,index)=>{uniforms[`neoQsTex${index}`]={value:texture};});
    m.map=null;m.normalMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
    m.defines={...m.defines,...(!low&&normalEnabled?{USE_TANGENT:''}:{})};
    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      const vary='varying vec2 neoQsUv;varying vec3 neoQsN,neoQsT,neoQsB;\n';
      shader.vertexShader=vary+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoQsUv=uv;').replace('#include <normal_vertex>',`#include <normal_vertex>
        vec3 neoQsNormal=transformedNormal;
        #ifdef FLIP_SIDED
        neoQsNormal=-neoQsNormal;
        #endif
        neoQsN=normalize(neoQsNormal)*vec3(1.0,1.0,-1.0);neoQsT=vec3(0.0);neoQsB=vec3(0.0);
        ${!low&&normalEnabled?'neoQsT=normalize(transformedTangent)*vec3(1.0,1.0,-1.0);neoQsB=cross(neoQsN,neoQsT)*tangent.w;':''}`);
      shader.fragmentShader=vary+`uniform sampler2D neoQsTex0,neoQsTex1,neoQsTex2,neoQsTex3,neoQsTex4;
        uniform float neoQsTime,neoQsEmissionScale;
        vec3 neoQsLinear(vec3 value){return ${low?'value*value':'pow(max(value,vec3(0.0)),vec3(2.2))'};}
        vec3 neoQsHue(float key){float angle=(key+neoQsTime*${s('FlowRainbowSpeed')})*${s('RainbowTiling')}*6.283185308;vec3 axis=normalize(${gv(hue.slice(0,3))}),color=vec3(.8,1.0,.8);return color*cos(angle)+cross(axis,color)*sin(angle)+axis*dot(axis,color)*(1.0-cos(angle));}
      `+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
        vec3 neoQsView=normalize(vViewPosition)*vec3(1.0,1.0,-1.0);
        vec4 neoQsBase=texture2D(neoQsTex0,neoQsUv),neoQsMask=vec4(1.0,1.0,0.0,0.0);
        neoQsBase.rgb=${change?`vec3(dot(neoQsBase.rgb,vec3(.2125,.7154,.0721)))*neoQsLinear(${gv(base.slice(0,3))})`:'neoQsBase.rgb'}*${s('TintValue')};
        vec3 neoQsNormal=neoQsN,neoQsNoiseN=vec3(0.0),neoQsFlow=vec3(0.0);
        ${!low?`vec4 neoQsNormalTex=texture2D(neoQsTex1,neoQsUv),neoQsNoiseTex=texture2D(neoQsTex3,neoQsUv*${s('RainbowNoiseTiling')});
        mat3 neoQsTbn=${normalEnabled?'mat3(neoQsT,neoQsB,neoQsN)':'mat3(1.0)'};
        vec3 neoQsBaseN=neoQsNormalTex.xyz*2.0-1.0;neoQsBaseN.z=sqrt(clamp(1.0-dot(neoQsBaseN.xy,neoQsBaseN.xy),0.0,1.0));neoQsBaseN.xy*=${f(intensity[0])};
        vec3 neoQsNoiseSample=neoQsNoiseTex.xyz*2.0-1.0;neoQsNoiseSample.xy*=${s('NoiseNormalIntensity')};
        neoQsNormal=neoQsTbn*normalize(neoQsBaseN);neoQsNoiseN=neoQsTbn*normalize(neoQsNoiseSample);
        vec3 neoQsAaaN=neoQsTbn*normalize(vec3(neoQsNoiseTex.xy*${s('MatcapNoiseIntensity')},neoQsNoiseTex.z));
        vec2 neoQsCapUv=(mat3(viewMatrix)*neoQsAaaN).xy*.5+.5;neoQsCapUv.y*=-1.0;neoQsMask=texture2D(neoQsTex2,neoQsUv);
        float neoQsCo=clamp(pow(clamp(dot(neoQsView,neoQsNormal)-${s('COA')},0.0,1.0),${s('COB')})*2.0,0.0,1.0);
        vec3 neoQsSwitch=mix(${gv(rainbow.slice(0,3))},neoQsBase.rgb,${s('RainbowToBaseColorKey')});
        diffuseColor.rgb=neoQsLinear(texture2D(neoQsTex4,neoQsCapUv).rgb*${s('MatcapIntensity')})+mix(neoQsHue(dot(neoQsView,neoQsNormal+neoQsNoiseN))*${s('BaseRainbowIntensity')},neoQsLinear(neoQsSwitch),neoQsCo);
        vec2 neoQsFlowUv=neoQsUv*vec2(${s('FlowTilingX')},${s('FlowTilingY')})+neoQsTime*vec2(0.0,.5*${s('FlowLSpeed')});
        neoQsFlow=pow(texture2D(neoQsTex3,neoQsFlowUv).aaa,vec3(2.0))*neoQsMask.a*${gv(flowColor.slice(0,3))}*${s('FlowStr')};`:'diffuseColor.rgb=neoQsBase.rgb;'}
        float neoQsOp=clamp(pow(clamp(dot(neoQsView,neoQsN)-${s('OPA')},0.0,1.0),${s('OPB')})*2.0,0.0,1.0);
        diffuseColor.a=mix(neoQsBase.a,mix(${s('OPLerpA')},${s('OPLerpB')},neoQsBase.a*neoQsOp),${s('Rainbow_Key')})*opacity;`)
        .replace('#include <normal_fragment_maps>','normal=normalize(neoQsNormal*vec3(1.0,1.0,-1.0));')
        .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${f(intensity[1])};`).replace('#include <metalnessmap_fragment>',`float metalnessFactor=${f(intensity[2])};`)
        .replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\nmaterial.specularColor=vec3(.08);material.specularColorBlended=mix(material.specularColor,diffuseColor.rgb,metalnessFactor);')
        .replace('#include <emissivemap_fragment>',`float neoQsF=clamp(${s('FresnelScale')}+(1.0-${s('FresnelScale')})*pow(1.0-dot(neoQsNormal,neoQsView),5.0),0.0,1.0);
          vec3 neoQsBaseEmissive=neoQsLinear(clamp(pow(neoQsBase.rgb,vec3(4.0)),0.0,1.0)*${gv(emissive.slice(0,3))}*${s('EmissiveIntensity')})*neoQsMask.a;
          totalEmissiveRadiance=(neoQsF*${gv(rim.slice(0,3))}*${f(intensity[3])}+neoQsBaseEmissive+neoQsFlow)*neoQsEmissionScale;`);
    };
    warnings.push('qingshe_cloth 原虹彩、Matcap、透明和流光通道已接入；原场景光照与 BRDF 仍待标定');return uniforms;
  }catch(error){warnings.push('qingshe_cloth 保持未适配：'+error.message);return null;}
}
