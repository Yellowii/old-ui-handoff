const num=(v,d=0)=>v===undefined?d:Number(v),flag=(v,d=0)=>typeof v==='string'&&/^(true|false)$/i.test(v)?Number(v.toLowerCase()==='true'):num(v,d);
const vec=(v,d)=>{if(v===undefined)return d;const a=Array.isArray(v)?v:JSON.parse(String(v).trim().startsWith('[')?v:'['+v+']');if(a.length!==d.length||!a.every(Number.isFinite))throw Error('无效原向量');return a;};
const lit=v=>{if(!Number.isFinite(v))throw Error('无效原标量');return v.toFixed(8);},gl=v=>`vec${v.length}(${v.map(lit).join(',')})`;

// Original fire2 tangent-view parallax and glitch01 post-skin local block effect.
export async function configureCharLocalEffects(m,p,macros,load,warnings,o={},family='glitch01'){
 try{
  const fire=family==='fire2',q=flag(macros.RENDER_QUALITY),low=q===2,tbn=flag(macros.NORMAL_MAP_ENABLE,1)!==0&&(fire||!low);
  const n=(k,d=0)=>num(p[k],d),f=(k,d=0)=>lit(n(k,d)),v=(k,d)=>vec(p[k],d),c=(k,d=[1,1,1,1])=>gl(v(k,d).slice(0,3));
  if(![0,1,2].includes(q))throw Error('未知质量');
  if(tbn&&(!o.sourceTangents||flag(macros.LIGHT_ENABLE,1)===0))throw Error('缺少活动原TBN');
  if(fire&&(!o.sourceSecondUv||flag(macros.TEXCOORD1_ENABLE,1)!==1))throw Error('缺少活动第二UV');
  if(!low&&!tbn)throw Error('未闭合关闭法线分支');
  if(flag(macros.ENABLE_SOFT_BODY2)&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>v(k,[0,0,0]).some(x=>x!==0)))throw Error('活动软体未接入');
  const maps=[];for(let i=0;i<(fire?4:3);i++){maps[i]=await load('Tex'+i,false,i===0?o.baseColor:i===1?o.normal:undefined);if(!maps[i]||maps[i].isCubeTexture)throw Error('缺少原Tex'+i);}
  const intensity=v('Intensity',[1,1,1,0]),base=v('BaseColor',[1,1,1,1]),np1=fire?v('emisNoisePara1',[0,0,1,0]):null,np2=fire?v('emisNoisePara2',[0,0,1,1]):null;
  const linear=x=>`pow(max(${x},vec3(0)),vec3(${low?'2.0':'2.2'}))`;
  const u={neoTime:{value:0},neoEmissionScale:{value:1},neoFaceOffset:{value:n('FaceUVOffset')}};maps.forEach((t,i)=>u['ceTex'+i]={value:t});
  m.map=maps[0];m.normalMap=null;m.vertexColors=false;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;m.defines={...m.defines,...(tbn?{USE_TANGENT:''}:{}),...(fire?{USE_UV1:''}:{})};
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);const vary='varying vec2 ceUv,ceUv1;varying vec3 ceN,ceT,ceB,ceLocal;\n';
   s.vertexShader=vary+s.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>\nceUv=uv;ceUv1=${fire?'uv1':'uv'};`)
    .replace('#include <normal_vertex>',`#include <normal_vertex>
     vec3 ceNormal=transformedNormal;
     #ifdef FLIP_SIDED
     ceNormal=-ceNormal;
     #endif
     ceN=inverseTransformDirection(ceNormal,viewMatrix)*vec3(-1,1,1);ceT=vec3(1,0,0);ceB=vec3(0,1,0);
     ${tbn?'ceT=inverseTransformDirection(transformedTangent,viewMatrix)*vec3(-1,1,1);ceB=cross(ceN,ceT)*tangent.w;':''}`)
    .replace('#include <project_vertex>','ceLocal=transformed;\n#include <project_vertex>');
   s.fragmentShader=vary+`uniform sampler2D ceTex0,ceTex1,ceTex2${fire?',ceTex3':''};uniform float neoTime,neoEmissionScale,neoFaceOffset;\n`+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec2 ceMainUv=ceUv;${fire?'':`ceMainUv.x+=ceMainUv.y<.25?neoFaceOffset*${f('CharOffset',1)}:0.0;`}
    vec4 ceBase=texture2D(ceTex0,ceMainUv),ceNormalMap=texture2D(ceTex1,ceMainUv),ceMix=${fire?'vec4(1)':'texture2D(ceTex2,ceMainUv)'};
    vec3 ceView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1,1,1),ceSurfaceN=ceN;
    ${!low?`vec3 ceSampleN=ceNormalMap.xyz*2.0-1.0;ceSampleN.xy*=${lit(intensity[0])};ceSurfaceN=mat3(ceT,ceB,ceN)*normalize(ceSampleN);`:''}
    vec3 ceAlbedo;float ceAlpha,ceHair=0.0;vec2 ceEffectUv=vec2(0);
    ${fire?`
     vec3 ceTangentView=${tbn?'vec3(dot(ceT,ceView),dot(ceB,ceView),dot(ceN,ceView))':'ceView'};
     float ceHeight=pow(texture2D(ceTex2,ceUv1*${f('baseTexTile',1)}).r,${f('heightV_Pow',1)})*${f('heightV_Mult',1)};
     vec2 ceNoiseUv=ceUv1*${lit(np1[2])}+neoTime*vec2(${lit(np1[3])},${lit(np2[0])});
     float ceNoise=texture2D(ceTex2,ceNoiseUv).g;
     ceEffectUv=ceUv1*${f('baseTexTile',1)}-ceHeight*ceTangentView.xy+neoTime*vec2(.015,-.02)+ceNoise*.05;
     float ceGradient=texture2D(ceTex3,ceMainUv).a;vec4 ceFire=pow(texture2D(ceTex3,ceEffectUv),vec4(${lit(np2[2])}))*${lit(np2[3])};
     ceFire=mix(ceFire,${gl(v('FireColor',[1,1,1,1]))}*2.0,pow(ceGradient,${f('fireGradMPow',1)}));
     ceFire=mix(ceFire,pow(ceBase,vec4(1.2))*1.5,1.0-ceBase.a);
     ceAlbedo=${linear(`${flag(macros.CHAR_CHANGE_COLOR,1)?'vec3(dot(ceBase.rgb,vec3(.2125,.7154,.0721)))':'ceFire.rgb'}*${gl(base.slice(0,3))}`)}*${f('TintValue',1)};
     ceAlpha=ceBase.a*${lit(base[3])};
    `:`
     float ceBlock=fract(sin(dot(floor(ceMainUv*${f('GlitchSize',40)})*neoTime,vec2(12.9898,78.233)))*43758.5453123);
     float ceShift=step(.8,ceBlock)*ceBlock*.02*step(ceMainUv.y,.25)*step(.5,fract(ceMainUv.y*20.0+neoTime))*clamp(sin(neoTime)-.5,0.0,1.0);
     ceBase=vec4(ceBase.r,texture2D(ceTex0,ceMainUv+vec2(ceShift,0)).g,texture2D(ceTex0,ceMainUv-vec2(ceShift,0)).b,1);
     // HLSL float3 -> scalar selects x. InverseWorld * world position is post-skin local.
     vec3 ceBlockPos=ceil(ceLocal*${f('HairGlitchSize',5)});float ceD=fract(dot(ceBlockPos,vec3(1.54,2.87,3.87))/6.28);
     ceHair=(fract((ceD*6.28-660.46*ceD*ceD*ceD)*(neoTime*.005))*2.0-1.0+1.0)*.5;
     ceHair*=pow(step(.1,ceNormalMap.a)*(1.0-ceNormalMap.a),3.0);
     vec3 ceLinearBase=${linear('ceBase.rgb')};vec3 ceFinal=(ceLinearBase+ceHair*ceLinearBase*20.0+vec3(ceHair)*5.0)*${f('TintValue',1)};
     ceAlbedo=${flag(macros.CHAR_CHANGE_COLOR,1)?linear(`vec3(dot(ceFinal,vec3(.2125,.7154,.0721)))*${gl(base.slice(0,3))}`)+'*'+f('TintValue',1):'ceFinal'};
     ceAlpha=clamp(1.0-ceHair,0.0,1.0);
    `}
    diffuseColor=vec4(ceAlbedo,ceAlpha*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>','normal=normalize(mat3(viewMatrix)*(ceSurfaceN*vec3(-1,1,1)));')
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${low?'.5':`clamp(${fire?'': 'ceMix.g*'}${lit(intensity[1])},0.0,1.0)`};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${low?'0.0':`clamp(${fire?'':'ceMix.b*'}${lit(intensity[2])},0.0,1.0)`};`)
    .replace('#include <emissivemap_fragment>',`
     float ceFresnel=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-dot(ceSurfaceN,ceView),5.0),0.0,1.0);
     vec3 ceEmission=ceFresnel*${c('RimColor',[0,0,0,0])}*${lit(intensity[3])};
     ${fire?`ceEmission+=${c('EmissiveColor')}*clamp(${lit(v('CustomFresnel',[0,1,0])[0])}+pow(clamp(1.0-dot(ceSurfaceN,ceView),0.0,1.0),${lit(v('CustomFresnel',[0,1,0])[1])}),0.0,1.0)*${lit(v('CustomFresnel',[0,1,0])[2])};`:''}
     totalEmissiveRadiance=ceEmission*neoEmissionScale;`)
    .replace('#include <aomap_fragment>',fire||low?'':`reflectedLight.indirectDiffuse*=ceMix.r;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.0,1.0),ceMix.r,material.roughness);
     #endif`);
  };
  warnings.push(family+' 原UV/局部坐标与质量公式已接入；原场景光照和噪声浮点精度仍未完全等价');return u;
 }catch(e){warnings.push(family+' 未适配：'+e.message);return null;}
}
