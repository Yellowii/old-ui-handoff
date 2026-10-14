const num=(v,d=0)=>v===undefined?d:Number(v);
const flag=(v,d=0)=>typeof v==='string'&&/^(true|false)$/i.test(v)?Number(v.toLowerCase()==='true'):num(v,d);
const vector=(v,d)=>{if(v===undefined)return d;const a=Array.isArray(v)?v:JSON.parse(String(v).trim().startsWith('[')?v:'['+v+']');if(a.length!==d.length||!a.every(Number.isFinite))throw Error('无效原向量');return a;};
const lit=v=>{if(!Number.isFinite(v))throw Error('无效原标量');return v.toFixed(8);},rgb=v=>`vec3(${v.slice(0,3).map(lit).join(',')})`;

// Original standard_char_elec_music / standard_char_elec01_music HLSL.
export async function configureElecMusic(m,p,macros,load,warnings,o={},variant=0){
 try{
  const q=flag(macros.RENDER_QUALITY),low=q===2,normalOn=!low&&flag(macros.NORMAL_MAP_ENABLE,1)!==0&&flag(macros.LIGHT_ENABLE,1)!==0;
  const n=(k,d=0)=>num(p[k],d),f=(k,d=0)=>lit(n(k,d)),v=(k,d)=>vector(p[k],d),c=(k,d=[1,1,1,1])=>rgb(v(k,d));
  if(![0,1,2].includes(q))throw Error('未知质量');
  if(!o.sourceSecondUv||flag(macros.TEXCOORD1_ENABLE,1)!==1)throw Error('缺少活动原第二UV');
  if(normalOn&&!o.sourceTangents)throw Error('缺少活动原切线');
  if(!low&&!normalOn)throw Error('关闭光照/法线的原GetNormal分支尚未闭合');
  if(flag(macros.ENABLE_SOFT_BODY2)&&['SoftBodyX','SoftBodyY','SoftBodyZ','SoftBodyNX','SoftBodyNY','SoftBodyNZ'].some(k=>v(k,[0,0,0]).some(x=>x!==0)))throw Error('活动软体未接入');
  const maps=[];for(let i=0;i<4;i++){maps[i]=await load('Tex'+i,false,i===0?o.baseColor:i===1?o.normal:undefined);if(!maps[i]||maps[i].isCubeTexture)throw Error('缺少原Tex'+i);}
  const intensity=v('Intensity',[1,1,1,0]),base=v('BaseColor',[1,1,1,1]);
  const linear=x=>`pow(max(${x},vec3(0.0)),vec3(${low?'2.0':'2.2'}))`;
  const u={neoTime:{value:0},neoEmissionScale:{value:1}};maps.forEach((t,i)=>u['elTex'+i]={value:t});
  m.map=maps[0];m.normalMap=null;m.vertexColors=false;m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
  m.defines={...m.defines,USE_UV1:'',...(normalOn?{USE_TANGENT:''}:{})};
  m.onBeforeCompile=s=>{
   Object.assign(s.uniforms,u);const varying='varying vec2 elUv,elUv1;varying vec3 elN,elT,elB;\n';
   s.vertexShader=varying+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nelUv=uv;elUv1=uv1;')
    .replace('#include <normal_vertex>',`#include <normal_vertex>
     vec3 elNormal=transformedNormal;
     #ifdef FLIP_SIDED
     elNormal=-elNormal;
     #endif
     elN=inverseTransformDirection(elNormal,viewMatrix)*vec3(-1,1,1);elT=vec3(1,0,0);elB=vec3(0,1,0);
     ${normalOn?'elT=inverseTransformDirection(transformedTangent,viewMatrix)*vec3(-1,1,1);elB=cross(elN,elT)*tangent.w;':''}`);
   s.fragmentShader=varying+'uniform sampler2D elTex0,elTex1,elTex2,elTex3;uniform float neoTime,neoEmissionScale;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
    vec4 elBase=texture2D(elTex0,elUv),elNormalMap=texture2D(elTex1,elUv),elMix=texture2D(elTex2,elUv);
    vec2 elEffectUv;vec3 elDigital;
    ${variant===0?`
     // MakeCustomRotator(uv, .1), source pai=3.14159.
     vec2 elCentered=vec2(elUv1.x,elUv1.y*.5)-.5;
     float elAngle=.1*2.0*3.14159;
     elEffectUv=.5+vec2(dot(elCentered,vec2(cos(elAngle),-sin(elAngle))),dot(elCentered,vec2(sin(elAngle),cos(elAngle))));
     vec3 elEffect=${linear('texture2D(elTex3,elEffectUv*'+f('ElecTiling',1)+').rgb')};
     vec3 elNoise=${linear('texture2D(elTex3,elEffectUv-vec2(neoTime*.03)).rgb')};
     float elMask=step(1.0,elEffect.r),elRandom=clamp(fract(elEffect.g+neoTime*.4)*elMask*elEffect.g,0.0,1.0);
     float elTransition=clamp(sin((elUv1.x*2.0+elUv1.y+neoTime*.2+elNoise.b*.3)*8.0),0.0,1.0);
     vec3 elBelow=elTransition*${linear(c('Color03'))}*elEffect.r*elNoise.b;
     vec3 elUp=pow(elTransition,10.0)*${linear(c('Color04'))}*elEffect.r*elNoise.b*3.0+elBelow;
     float elMaskBase=smoothstep(.2,1.5,elTransition)*elRandom,elMaskLight=pow(smoothstep(.5,1.2,elTransition),4.0)*elRandom;
     elDigital=elMaskBase*${linear(c('Color01'))}*4.0+elMaskLight*${linear(c('Color02'))}*25.0+elMask*elBelow.r*elNoise.b*${linear(c('Color01'))}*4.0+elUp;
     elDigital*=pow(texture2D(elTex3,elUv).a,${low?'2.0':'2.2'});
    `:`
     elEffectUv=vec2(elUv.x*4.0+.1,elUv.y*10.0+.7+neoTime*.05);
     vec4 elEffect=texture2D(elTex3,elEffectUv),elMask=texture2D(elTex3,elUv),elNoise=texture2D(elTex3,elUv*2.0+vec2(neoTime*.01,neoTime*.05));
     float elPower=pow(elEffect.r,2.0)*pow(elMask.a,2.0)*pow(elNoise.b,6.0)*5.0+pow(elEffect.r,2.0)*.03;
     float elColorMask=elUv1.y<.5?elUv1.x:1.0-elUv1.x;
     elDigital=${linear(`mix(${c('Color01')},${c('Color02')},elColorMask)`)}*10.0*elPower;
    `}
    vec3 elFinal=${linear('elBase.rgb')}+elDigital;
    vec3 elAlbedo=${flag(macros.CHAR_CHANGE_COLOR,1)?linear(`vec3(dot(elFinal,vec3(.2125,.7154,.0721)))*${rgb(base)}`):'elFinal'}*${f('TintValue',1)};
    diffuseColor=vec4(elAlbedo,elBase.a*${lit(base[3])}*opacity);
   `).replace('#include <color_fragment>','')
    .replace('#include <normal_fragment_maps>',`
     vec3 elSurfaceN=elN;
     ${normalOn?`vec3 elSampleN=elNormalMap.xyz*2.0-1.0;elSampleN.xy*=${lit(intensity[0])};elSurfaceN=mat3(elT,elB,elN)*normalize(elSampleN);`:''}
     normal=normalize(mat3(viewMatrix)*(elSurfaceN*vec3(-1,1,1)));`)
    .replace('#include <roughnessmap_fragment>',`float roughnessFactor=${low?'.5':`clamp(elMix.g*${lit(intensity[1])},0.0,1.0)`};`)
    .replace('#include <metalnessmap_fragment>',`float metalnessFactor=${low?'0.0':`clamp(elMix.b*${lit(intensity[2])},0.0,1.0)`};`)
    .replace('#include <emissivemap_fragment>',`
     vec3 elView=inverseTransformDirection(normalize(vViewPosition),viewMatrix)*vec3(-1,1,1);
     float elFresnel=clamp(${f('FresnelScale')}+(1.0-${f('FresnelScale')})*pow(1.0-dot(elSurfaceN,elView),5.0),0.0,1.0);
     totalEmissiveRadiance=(elFresnel*${c('RimColor',[0,0,0,0])}*${lit(intensity[3])}${variant===0?`+elMix.a*${c('EmissiveColor')}*${f('EmissiveValue',1)}`:''})*neoEmissionScale;`)
    .replace('#include <aomap_fragment>',low?'':`reflectedLight.indirectDiffuse*=elMix.r;
     #if defined(USE_ENVMAP) && defined(STANDARD)
     reflectedLight.indirectSpecular*=computeSpecularOcclusion(clamp(dot(geometryNormal,geometryViewDir),0.0,1.0),elMix.r,material.roughness);
     #endif`);
  };
  warnings.push('elec_music 已接入原第二UV/数字纹理/时间与质量公式；原场景光照仍未完全等价');return u;
 }catch(e){warnings.push('elec_music 未适配：'+e.message);return null;}
}
