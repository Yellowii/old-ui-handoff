import {sourceSceneSunGlsl,sourceSceneLightWarning} from './source-scene-light.js';

const number=(value,fallback)=>{const n=value===undefined?fallback:Number(value);if(!Number.isFinite(n))throw Error('invalid source scalar');return n;};
const vector=(value,fallback,required=false)=>{if(value===undefined){if(required)throw Error('missing complete source vector');return fallback;}const a=Array.isArray(value)?value:JSON.parse(String(value));if(!Array.isArray(a)||a.length!==fallback.length||!a.every(Number.isFinite))throw Error('invalid source vector');return a;};
const f=value=>Number(value).toFixed(8),v3=value=>`vec3(${value.slice(0,3).map(f).join(',')})`;

function frame(shader,prefix,normalOn){
  const vary=`varying vec2 ${prefix}Uv;varying vec3 ${prefix}N,${prefix}T,${prefix}B;\n`;
  shader.vertexShader=vary+shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>\n${prefix}Uv=uv;`).replace('#include <normal_vertex>',`#include <normal_vertex>
    vec3 ${prefix}Normal=transformedNormal;
    #ifdef FLIP_SIDED
    ${prefix}Normal=-${prefix}Normal;
    #endif
    ${prefix}N=normalize(inverseTransformDirection(${prefix}Normal,viewMatrix))*vec3(-1.0,1.0,1.0);
    ${prefix}T=vec3(0.0);${prefix}B=vec3(0.0);
    ${normalOn?`${prefix}T=normalize(inverseTransformDirection(transformedTangent,viewMatrix))*vec3(-1.0,1.0,1.0);${prefix}B=cross(${prefix}N,${prefix}T)*tangent.w;`:''}`);
  shader.fragmentShader=vary+shader.fragmentShader;
}

export async function configureBgz(m,p,macros,load,warnings,overrides={}){
 try{
  const quality=number(macros.RENDER_QUALITY,0),normal=number(macros.NORMAL_MAP_ENABLE,1),change=number(macros.CHAR_CHANGE_COLOR,0);
  if(![0,1,2].includes(quality)||![0,1].includes(normal)||![0,1].includes(change))throw Error('unknown active macro');
  const low=quality<2;if(low&&normal&&!overrides.sourceTangents)throw Error('missing original tangent basis');
  const base=vector(p.BaseColor,[.8,.9,1,.6]),intensity=vector(p.Intensity,[1,1,1,0],true),rim=vector(p.RimColor,[0,0,0,0]),emissive=vector(p.EmissiveColor,[1,1,1,1]);
  const n=(key,fallback)=>number(p[key],fallback);
  const a={tint:n('TintValue',1),face:n('FaceUVOffset',0),offset:n('CharOffset',1),parallaxTiling:n('ParallaxTiling',20),parallax:n('ParallaxIntensity',1),cap:n('MatCapIntensity',.3),fresnel:n('FresnelScale',.04)};
  const maps=await Promise.all([load('Tex0',true),load('Tex1'),load('Tex2'),load('MatCap',true),load('Tex4',true)]);
  if(maps.some(texture=>!texture?.isTexture||texture.isCubeTexture))throw Error('missing original Tex0/Tex1/Tex2/MatCap/Tex4');
  const u={neoT120EmissionScale:{value:1}};maps.forEach((texture,index)=>u[`bgzTex${index}`]={value:texture});
  m.map=null;m.normalMap=null;m.roughnessMap=null;m.metalnessMap=null;m.aoMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;m.vertexColors=false;
  if(low&&normal)m.defines={...m.defines,USE_TANGENT:''};
  m.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,u);frame(shader,'bgz',low&&normal);
   shader.fragmentShader=`uniform sampler2D bgzTex0,bgzTex1,bgzTex2,bgzTex3,bgzTex4;uniform float neoT120EmissionScale;
     vec3 bgzLinear(vec3 c){return pow(max(c,vec3(0.0)),vec3(2.2));}
   `+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
     vec2 bgzFaceUv=bgzUv;bgzFaceUv.x+=bgzFaceUv.y<.25?${f(a.face*a.offset)}:0.0;
     vec4 bgzBase=texture2D(bgzTex0,bgzFaceUv);bgzBase.rgb=bgzLinear(bgzBase.rgb);
     ${change?`bgzBase.rgb=vec3(dot(bgzBase.rgb,vec3(.2125,.7154,.0721)))*${v3(base)}*${f(a.tint)};`:`bgzBase.rgb*=${f(a.tint)};`}
     vec3 bgzView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.0,1.0,1.0),bgzNormal=bgzN,bgzInner=vec3(0.0),bgzEmission=vec3(0.0);float bgzOpacity=1.0;
     ${low?`vec4 bgzMix=texture2D(bgzTex2,bgzFaceUv);${normal?`mat3 bgzTbn=mat3(bgzT,bgzB,bgzN);vec3 bgzSample=texture2D(bgzTex1,bgzFaceUv).xyz*2.0-1.0;bgzSample.xy*=${f(intensity[0])};bgzNormal=bgzTbn*normalize(bgzSample);vec3 bgzTangentView=normalize(transpose(bgzTbn)*bgzView);vec2 bgzParallax=bgzFaceUv*${f(a.parallaxTiling)}-.2*(bgzTangentView.xy/max(bgzTangentView.z,.1));bgzInner=bgzLinear(texture2D(bgzTex4,bgzParallax).rrr)*bgzBase.rgb*${f(a.parallax)};`:''}
     vec2 bgzCapUv=(mat3(viewMatrix)*bgzNormal).xy*.5+.5;bgzCapUv.y=1.0-bgzCapUv.y;vec3 bgzCap=bgzLinear(texture2D(bgzTex3,bgzCapUv).rgb)*${f(a.cap)};
     float bgzFo=clamp(pow(clamp(1.0-dot(bgzView,bgzNormal)-.2,0.0,1.0),.4)*2.0,0.0,1.0);bgzOpacity=mix(mix(.4,1.0,bgzFo),1.0,bgzBase.a);
     float bgzFa=clamp(pow(clamp(1.0-dot(bgzView,bgzNormal)-.4,0.0,1.0),.5)*2.0,0.0,1.0);bgzBase.rgb=mix(bgzBase.rgb,pow(bgzBase.rgb*.5,vec3(1.7)),bgzFa);
     float bgzLambert=dot(bgzNormal,${sourceSceneSunGlsl()})*.5+.5;float bgzPop=smoothstep(0.0,.2,bgzLambert-.1);vec3 bgzFre=mix(bgzMix.aaa,bgzMix.aaa*.2,bgzFa)*bgzBase.rgb;bgzEmission=bgzFre*${f(intensity[3])}+bgzCap+bgzInner*clamp(1.0-bgzFa,0.0,1.0)+bgzBase.rgb*bgzPop*.3;`: 'bgzOpacity=1.0;'}
     diffuseColor=vec4(bgzBase.rgb,bgzOpacity*opacity);`)
    .replace('#include <color_fragment>','').replace('#include <normal_fragment_maps>',`normal=normalize(mat3(viewMatrix)*(bgzNormal*vec3(-1.0,1.0,1.0)));`)
    .replace('#include <roughnessmap_fragment>','float roughnessFactor=.3;').replace('#include <metalnessmap_fragment>','float metalnessFactor=0.0;')
    .replace('#include <emissivemap_fragment>',`float bgzF=clamp(${f(a.fresnel)}+(1.0-${f(a.fresnel)})*pow(1.0-dot(bgzNormal,bgzView),5.0),0.0,1.0);totalEmissiveRadiance=(bgzF*${v3(rim)}*${f(intensity[3])}+bgzEmission)*neoT120EmissionScale;`);
  };
  warnings.push(`bgz 原低画质法线、视差、MatCap、透明和 SunDirection 通道已接入；${sourceSceneLightWarning}`);return u;
 }catch(error){warnings.push('bgz 保持未适配：'+error.message);return null;}
}

export async function configureHouyiYifu(m,p,macros,load,warnings,overrides={}){
 try{
  const quality=number(macros.RENDER_QUALITY,0),normal=number(macros.NORMAL_MAP_ENABLE,1),change=number(macros.CHAR_CHANGE_COLOR,0);if(![0,1,2].includes(quality)||![0,1].includes(normal)||![0,1].includes(change))throw Error('unknown active macro');
  const low=quality<2;if(low&&normal&&!overrides.sourceTangents)throw Error('missing original tangent basis');
  const base=vector(p.BaseColor,[1,1,1,1]),intensity=vector(p.Intensity,[1,1,1,0]),rim=vector(p.RimColor,[0,0,0,0]),emA=vector(p.EmColorA,[1,1,1,1]);
  const n=(key,fallback)=>number(p[key],fallback),a={tint:n('TintValue',1),face:n('FaceUVOffset',0),offset:n('CharOffset',1),noise:n('NoiseUVkey',0),aNoise:n('AnoiseIntensity',6),bNoise:n('BnoiseIntensity',10),noiseUv:n('NoiseGuv',.8),noiseTime:n('NoiseGtime',.1),addTiling:n('Addnormaltiling',5),mask:n('MaskEmIntensity',0),fresnel:n('FresnelScale',0)};
  const maps=[];for(const key of ['Tex0','Tex1','Tex2','Tex3','Tex4'])maps.push(await load(key,key==='Tex0'));
  if(maps.some(texture=>!texture?.isTexture||texture.isCubeTexture))throw Error('missing original Tex0-Tex4');
  const u={neoT120Time:{value:0},neoT120EmissionScale:{value:1}};maps.forEach((texture,index)=>u[`hyTex${index}`]={value:texture});m.map=null;m.normalMap=null;m.roughnessMap=null;m.metalnessMap=null;m.aoMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;m.vertexColors=false;if(low&&normal)m.defines={...m.defines,USE_TANGENT:''};
  m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,u);frame(shader,'hy',low&&normal);shader.fragmentShader=`uniform sampler2D hyTex0,hyTex1,hyTex2,hyTex3,hyTex4;uniform float neoT120Time,neoT120EmissionScale;float hyRandom(vec2 st){return fract(sin(dot(st,vec2(12.,78.)))*43758.); }float hyNoise(vec2 st){vec2 i=floor(st),q=fract(st),u=q*q*(3.-2.*q);float x=hyRandom(i),y=hyRandom(i+vec2(1,0)),z=hyRandom(i+vec2(0,1)),w=hyRandom(i+vec2(1));return mix(x,y,u.x)+(z-x)*u.y*(1.-u.x)+(w-y)*u.x*u.y;}vec3 hyLinear(vec3 c){return pow(max(c,vec3(0.)),vec3(2.2));}\n`+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec2 hyFaceUv=hyUv;hyFaceUv.x+=hyFaceUv.y<.25?${f(a.face*a.offset)}:0.;vec4 hyMix=${low?'texture2D(hyTex2,hyFaceUv)':'vec4(1.,1.,0.,0.)'};float hyOffset=${low?`clamp(hyNoise(hyFaceUv*60.+neoT120Time*vec2(3.,0.)),0.,1.)*.01*hyMix.r*${f(a.noise)}`:'0.'};vec4 hyBase=texture2D(hyTex0,hyFaceUv+hyOffset);hyBase.rgb=hyLinear(hyBase.rgb);${change?`hyBase.rgb=vec3(dot(hyBase.rgb,vec3(.2125,.7154,.0721)))*${v3(base)}*${f(a.tint)};`:`hyBase.rgb*=${f(a.tint)};`}vec3 hyView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1.,1.,1.),hyNormal=hyN,hyOpacityNormal=hyN,hyEm=vec3(0.);float hyOpacity=hyBase.a;${low?`${normal?`mat3 hyTbn=mat3(hyT,hyB,hyN);vec4 hyBaseN=texture2D(hyTex1,hyFaceUv+hyOffset),hyAdd=texture2D(hyTex4,hyFaceUv*${f(a.addTiling)});vec3 hyB=hyBaseN.xyz*2.-1.;hyB.xy*=${f(intensity[0])};vec3 hyA=hyAdd.xyz*2.-1.;hyA.xy*=.5;vec3 hyBaseBlend=vec3(hyB.xy*.5,hyB.z+1.),hyAddBlend=vec3(-hyA.xy,hyA.z),hyBlend=hyBaseBlend*dot(hyBaseBlend,hyAddBlend)-(hyBaseBlend.z+1.)*hyAddBlend;hyOpacityNormal=hyTbn*normalize(hyB);hyNormal=mix(hyOpacityNormal,hyTbn*normalize(hyBlend),hyBaseN.a);`:''}vec4 hyNoiseTex=texture2D(hyTex3,hyFaceUv*${f(a.noiseUv)}+neoT120Time*vec2(0.,${f(a.noiseTime)}));float hyBch=texture2D(hyTex3,hyFaceUv*8.+neoT120Time*vec2(.1,0.)).b,hyAch=texture2D(hyTex3,hyFaceUv).a;vec3 hyAEm=hyBch*${v3(emA)}*texture2D(hyTex4,hyFaceUv*${f(a.addTiling)}).a*texture2D(hyTex1,hyFaceUv+hyOffset).a*${f(a.aNoise)};vec3 hyBEm=mix(hyBase.rgb*${f(a.mask)},hyBase.rgb*hyNoiseTex.g*${f(a.bNoise)},hyMix.a);vec3 hyTrick=mix(hyBase.rgb*.2*hyAch,pow(hyBase.rgb,vec3(2.))*2.*hyAch,clamp(dot(hyView,${sourceSceneSunGlsl()})-.1,0.,1.));hyEm=mix(hyAEm,hyBEm,hyMix.a)+hyTrick;float hyFr=clamp((dot(hyView,hyOpacityNormal)-.6)*2.,0.,1.);hyOpacity=mix(1.,hyBase.a,hyFr);`:''}diffuseColor=vec4(hyBase.rgb,hyOpacity*opacity);`)
    .replace('#include <color_fragment>','').replace('#include <normal_fragment_maps>',`normal=normalize(mat3(viewMatrix)*(hyNormal*vec3(-1.,1.,1.)));`).replace('#include <roughnessmap_fragment>',`float roughnessFactor=${low?`clamp(hyMix.g*${f(intensity[1])},0.,1.)`:'.5'};`).replace('#include <metalnessmap_fragment>',`float metalnessFactor=${low?`clamp(hyMix.b*${f(intensity[2])},0.,1.)`:'0.'};`).replace('#include <emissivemap_fragment>',`float hyF=clamp(${f(a.fresnel)}+(1.-${f(a.fresnel)})*pow(1.-dot(hyNormal,hyView),5.),0.,1.);totalEmissiveRadiance=(hyF*${v3(rim)}*${f(intensity[3])}+hyEm)*neoT120EmissionScale;`);
  };warnings.push(`houyiyifu 原低画质噪声、混合 normal、动画、透明与 SunDirection 通道已接入；${sourceSceneLightWarning}`);return u;
 }catch(error){warnings.push('houyiyifu 保持未适配：'+error.message);return null;}
}
