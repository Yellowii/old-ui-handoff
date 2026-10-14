// s29/rainbow_star.hlsl. Source camera coordinates have +Z forward.
import {runtimeContract} from './handoff/runtime-contracts.js';
const textureDefaults=runtimeContract("rainbow-star-texture-defaults");
const number=(v,d)=>{if(v===undefined)return d;if((typeof v!=='number'&&typeof v!=='string')||(typeof v==='string'&&!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim()))||!Number.isFinite(Number(v)))throw Error('无效数值');return Number(v);};
const vector=(v,d)=>{if(v===undefined)return d;const a=typeof v==='string'?JSON.parse(v):v;if(!Array.isArray(a)||a.length!==d.length||!a.every(Number.isFinite))throw Error('无效向量');return a;};
const f=v=>Number(v).toFixed(8),gv=v=>`vec${v.length}(${v.map(f).join(',')})`;

export async function configureRainbowStar(m,p,macros,load,warnings,overrides={}){
  try{
    const n=(k,d)=>number(p[k],d),v=(k,d)=>vector(p[k],d);
    const quality=number(macros.RENDER_QUALITY,0),change=number(macros.CHAR_CHANGE_COLOR,1),hasNormal=number(macros.NORMAL_MAP_ENABLE,1),light=number(macros.LIGHT_ENABLE,1),low=quality===2;
    const known=new Set(['RENDER_QUALITY','CHAR_CHANGE_COLOR','NORMAL_MAP_ENABLE','LIGHT_ENABLE','TEXCOORD1_ENABLE','USE_TEXCOORD1','ENABLE_SOFT_BODY2','ENABLE_POINT_LIGHT_AND_SPOTLIGHT','USE_LOCAL_PARAMATER']);
    if(![0,1,2].includes(quality)||[change,hasNormal,light].some(x=>x!==0&&x!==1)||Object.entries(macros).some(([k,x])=>!known.has(k)&&number(x,0)!==0))throw Error('未知活动宏');
    const meteorUv=n('MeteorUseUV2',0),needUv=!low&&meteorUv!==0;
    // A small set of published rainbow-star meshes has UV0/UV1/normal but no
    // authored tangent stream.  The source shader consumes the regular UV
    // tangent basis; reconstructing that basis from screen-space position and
    // UV derivatives is the standard equivalent when the source tangent
    // attribute was omitted by the mesh exporter.  Keep the original lighting
    // gate intact: the derivative path is only valid while source lighting is
    // active (the disabled-light permutation still has no verified init).
    const derivedTangent=!low&&hasNormal&&!overrides.sourceTangents;
    if(!low&&hasNormal&&!light)throw Error('关闭光照时原切线初始化未闭合');
    if(needUv&&(!overrides.sourceSecondUv||number(macros.USE_TEXCOORD1,1)!==1))throw Error('缺少原第二UV');
    for(const k of ['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'])if(v(k,[0,0,0]).some(x=>x!==0))throw Error('活动软体未接入');
    const base=v('BaseColor',[1,1,1,1]),intensity=v('Intensity',[1.5,.1,.5,0]),rim=v('RimColor',[0,0,0,0]),em=v('EmissiveColor',[1,1,1,1]);
    const rainbow=v('RainbowColor',[.580,.678,1,1]),axis=v('RainbowHue',[.235,.772,1,1]),meteor=v('MeteorColor',[1,1,1,1]),meteorScale=v('MeteorUVScale',[20,3]);
    const defaults={TintValue:1,FresnelScale:0,OPA:.3,OPB:.6,COA:.4,COB:1,NoiseNormalIntensity:.5,OPLerpA:.6,OPLerpB:1,Rainbow_Key:1,fresnelKye:0,EmissiveIntensity:1,BaseRainbowIntensity:1.5,RainbowToBaseColorKey:0,FlowRainbowSpeed:.8,RainbowNoiseTiling:8,RainbowTiling:.8,MatcapNoiseIntensity:.8,MatcapIntensity:1,MeteorEmis:1,MeteorSpeed:1};
    const a=Object.fromEntries(Object.entries(defaults).map(([k,d])=>[k,n(k,d)])),s=k=>f(a[k]);
    if(a.OPB<=0||a.COB<=0||!axis.slice(0,3).some(x=>x!==0))throw Error('pow边界或零Hue轴未定义');
    const maps=await Promise.all([0,1,2,3,4].map(i=>load('Tex'+i,false)));
    if(!maps[4]){
      const capDefault=textureDefaults.Tex4;
      if(!capDefault||typeof capDefault.path!=='string'||!capDefault.path||typeof capDefault.url!=='string'||!capDefault.url)throw Error('Host rainbow-star Tex4 default required');
      if(p.Tex4===undefined||String(p.Tex4).replaceAll('\\','/').toLowerCase()===capDefault.path)maps[4]=await load('Tex4',false,capDefault.url);
    }
    if(maps.some(t=>!t?.isTexture||t.isCubeTexture))throw Error('缺少原Tex0–Tex4');
    const u={neoTime:{value:0},neoEmissionScale:{value:1}};
    maps.forEach((t,i)=>{u['neoRsTex'+i]={value:t};});
    m.map=null;m.normalMap=null;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
    m.defines={...m.defines,...(needUv?{USE_UV1:''}:{}),...(!low&&hasNormal&&!derivedTangent?{USE_TANGENT:''}:{})};
    if(derivedTangent){m.userData.rainbowDerivedTangent=true;warnings.push('rainbow_star 使用 UV/屏幕导数重建原切线基；网格未发布 TANGENT，未改变源法线贴图语义');}
    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,u);
      const vary='varying vec2 neoRsUv,neoRsUv1;varying vec3 neoRsN,neoRsT,neoRsB;\n';
      shader.vertexShader=vary+shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>\nneoRsUv=uv;neoRsUv1=${needUv?'uv1':'uv'};`)
        .replace('#include <normal_vertex>',`#include <normal_vertex>
          vec3 neoRsNormal=transformedNormal;
          #ifdef FLIP_SIDED
          neoRsNormal=-neoRsNormal;
          #endif
          neoRsN=normalize(neoRsNormal)*vec3(1.0,1.0,-1.0);neoRsT=vec3(0.0);neoRsB=vec3(0.0);
          ${!low&&hasNormal&&!derivedTangent?`neoRsT=normalize(transformedTangent)*vec3(1.0,1.0,-1.0);neoRsB=cross(neoRsN,neoRsT)*tangent.w;`:''}
        `);
      shader.fragmentShader=vary+`uniform sampler2D neoRsTex0,neoRsTex1,neoRsTex2,neoRsTex3,neoRsTex4;
        uniform float neoTime,neoEmissionScale;
        vec3 neoRsLinear(vec3 x){return ${low?'x*x':'pow(max(x,vec3(0.0)),vec3(2.2))'};}
        vec3 neoRsSourceView(vec3 x){return (mat3(viewMatrix)*(x*vec3(-1.0,1.0,1.0)))*vec3(1.0,1.0,-1.0);}
        float neoRsRandom(vec2 x){return fract(sin(dot(x,vec2(12.0,78.0)))*43758.0);}
        float neoRsNoise(vec2 x){vec2 i=floor(x),t=fract(x),u=t*t*(3.0-2.0*t);float a=neoRsRandom(i),b=neoRsRandom(i+vec2(1,0)),c=neoRsRandom(i+vec2(0,1)),d=neoRsRandom(i+vec2(1,1));return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;}
        vec3 neoRsHue(float key){float angle=(key+neoTime*${s('FlowRainbowSpeed')})*${s('RainbowTiling')}*6.283185308;vec3 axis=normalize(${gv(axis.slice(0,3))}),c=vec3(.8,1.0,.8);return c*cos(angle)+cross(axis,c)*sin(angle)+axis*dot(axis,c)*(1.0-cos(angle));}
      `+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
        vec3 neoRsView=normalize(vViewPosition)*vec3(1.0,1.0,-1.0);
        vec4 neoRsD=texture2D(neoRsTex0,neoRsUv),neoRsMask=vec4(1.0,1.0,0.0,0.0);
        neoRsD.rgb=${change?`vec3(dot(neoRsD.rgb,vec3(.2125,.7154,.0721)))*neoRsLinear(${gv(base.slice(0,3))})`:'neoRsD.rgb'}*${s('TintValue')};
        vec3 neoRsSurfaceN=neoRsN,neoRsNoiseN=vec3(0.0),neoRsMeteor=vec3(0.0),neoRsCap=vec3(0.0);
        ${!low?`
        vec4 neoRsNormalMap=texture2D(neoRsTex1,neoRsUv),neoRsNoiseMap=texture2D(neoRsTex3,neoRsUv*${s('RainbowNoiseTiling')});
        mat3 neoRsTbn;
        ${hasNormal?(derivedTangent?`vec3 neoRsDp1=dFdx(vViewPosition),neoRsDp2=dFdy(vViewPosition);vec2 neoRsDu1=dFdx(neoRsUv),neoRsDu2=dFdy(neoRsUv);vec3 neoRsDt=normalize(neoRsDp1*neoRsDu2.y-neoRsDp2*neoRsDu1.y);vec3 neoRsDb=normalize(-neoRsDp1*neoRsDu2.x+neoRsDp2*neoRsDu1.x);if(dot(cross(neoRsDt,neoRsDb),neoRsN)<0.0)neoRsDb=-neoRsDb;neoRsTbn=mat3(neoRsDt,neoRsDb,neoRsN);`:'neoRsTbn=mat3(neoRsT,neoRsB,neoRsN);'):`neoRsTbn=mat3(neoRsSourceView(vec3(1,0,0)),neoRsSourceView(vec3(0,1,0)),neoRsSourceView(vec3(0,0,1)));`}
        vec3 neoRsBaseN=neoRsNormalMap.xyz*2.0-1.0;neoRsBaseN.z=sqrt(clamp(1.0-dot(neoRsBaseN.xy,neoRsBaseN.xy),0.0,1.0));neoRsBaseN.xy*=${f(intensity[0])};
        vec3 neoRsNoiseSample=neoRsNoiseMap.xyz*2.0-1.0;neoRsNoiseSample.xy*=${s('NoiseNormalIntensity')};
        neoRsSurfaceN=neoRsTbn*normalize(neoRsBaseN);neoRsNoiseN=neoRsTbn*normalize(neoRsNoiseSample);
        vec3 neoRsCapN=neoRsTbn*normalize(vec3(neoRsNoiseMap.xy*${s('MatcapNoiseIntensity')},neoRsNoiseMap.z));
        vec2 neoRsCapUv=neoRsCapN.xy*.5+.5;neoRsCapUv.y*=-1.0;neoRsCap=texture2D(neoRsTex4,neoRsCapUv).rgb;
        vec2 neoRsMeteorUv=mix(neoRsUv,neoRsUv1,${f(meteorUv)});
        float neoRsNoiseX=neoRsNoise(vec2(floor(neoRsMeteorUv.x*20.0*${f(meteorScale[0])})*.1));
        vec2 neoRsMeteorMaskUv=neoRsMeteorUv*${gv(meteorScale)}+vec2(0.0,-1.0)*(neoTime*${s('MeteorSpeed')}+neoRsNoiseX)*mix(.75,.1,neoRsNoiseX);
        neoRsMeteor=texture2D(neoRsTex2,neoRsMeteorMaskUv).r*${s('MeteorEmis')}*${gv(meteor.slice(0,3))}*neoRsNormalMap.a;
        neoRsMask=texture2D(neoRsTex2,neoRsUv);
        float neoRsCo=clamp(pow(clamp(dot(neoRsView,neoRsSurfaceN)-${s('COA')},0.0,1.0),${s('COB')})*2.0,0.0,1.0);
        vec3 neoRsSwitch=mix(${gv(rainbow.slice(0,3))},neoRsD.rgb,${s('RainbowToBaseColorKey')});
        diffuseColor.rgb=neoRsLinear(neoRsCap*${s('MatcapIntensity')})+mix(neoRsHue(dot(neoRsView,neoRsSurfaceN+neoRsNoiseN))*${s('BaseRainbowIntensity')},neoRsLinear(neoRsSwitch),neoRsCo);
        `:'diffuseColor.rgb=neoRsD.rgb;'}
        float neoRsOp=clamp(pow(clamp(dot(neoRsView,neoRsN)-${s('OPA')},0.0,1.0),${s('OPB')})*2.0,0.0,1.0);
        diffuseColor.a=mix(neoRsD.a,mix(${s('OPLerpA')},${s('OPLerpB')},neoRsD.a*neoRsOp),${s('Rainbow_Key')})*opacity;
      `).replace('#include <normal_fragment_maps>','normal=normalize(neoRsSurfaceN*vec3(1.0,1.0,-1.0));')
        .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${f(intensity[1])};`)
        .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${f(intensity[2])};`)
        .replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\nmaterial.specularColor=vec3(.08);material.specularColorBlended=mix(material.specularColor,diffuseColor.rgb,metalnessFactor);')
        .replace('#include <emissivemap_fragment>',`
          float neoRsA=1.0-dot(neoRsSurfaceN,neoRsView);float neoRsF=clamp(${s('FresnelScale')}+(1.0-${s('FresnelScale')})*neoRsA*neoRsA*neoRsA*neoRsA*neoRsA,0.0,1.0);
          totalEmissiveRadiance=neoRsF*${gv(rim.slice(0,3))}*${f(intensity[3])}+neoRsLinear(clamp(pow(neoRsD.rgb,vec3(4.0)),0.0,1.0)*${gv(em.slice(0,3))}*${s('EmissiveIntensity')})*neoRsMask.a;
          ${!low?`float neoRsBy=clamp(pow(clamp(dot(neoRsView,neoRsN)-.3,0.0,1.0),.1)*1.5,0.0,1.0);totalEmissiveRadiance+=vec3(mix(.4,0.0,neoRsBy)*${s('fresnelKye')})+neoRsMeteor;`:''}
          totalEmissiveRadiance*=neoEmissionScale;
        `);
    };
    warnings.push('rainbow_star源Hue/流星/透明/Matcap已接入；原场景光照及BRDF仍待标定');return u;
  }catch(e){warnings.push('rainbow_star保持未适配：'+e.message);return null;}
}
