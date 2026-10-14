// 2025_t0_stage_luckydraw/firenoise.hlsl: dissolve edge and animated fire mask.
export async function configureFirenoise(m,p,macros,load,warnings,overrides={}){
 const n=(k,d=0)=>Number.isFinite(Number(p[k]))?Number(p[k]):d;
 const v=(k,d)=>{try{const a=JSON.parse(p[k]);if(Array.isArray(a)&&a.length>=3)return a;}catch{}return d;};
 const f=(k,d=0)=>n(k,d).toFixed(8),rgb=(k,d)=>`vec3(${v(k,d).slice(0,3).map(x=>Number(x).toFixed(8)).join(',')})`;
 const low=Number(macros.RENDER_QUALITY??0)<2,tex0=await load('Tex0',false,overrides.baseColor),tex1=low?await load('Tex1',false,overrides.normal):null,tex2=await load('Tex2',false);
 if(!tex0||!tex2)return null;
 m.defines={...m.defines,USE_UV1:''};m.map=tex0;m.normalMap=tex1;m.color.set(0xffffff);m.roughness=1;m.metalness=0;m.emissive.set(0xffffff);m.emissiveIntensity=1;
 const u={neoTime:{value:0},neoFireNoise0:{value:tex0},neoFireNoise1:{value:tex1},neoFireNoise2:{value:tex2},neoEmissionScale:{value:1}};
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,u);s.vertexShader='varying vec2 neoFireNoiseUv1;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoFireNoiseUv1=uv1;');s.fragmentShader=`varying vec2 neoFireNoiseUv1;uniform sampler2D neoFireNoise0,neoFireNoise1,neoFireNoise2;uniform float neoTime,neoEmissionScale;\n${s.fragmentShader}`;
  const normal=low&&tex1?`vec3 neoFireNoiseN=texture2D(neoFireNoise1,vMapUv).xyz*2.0-1.0;normal=normalize(tbn*normalize(vec3(neoFireNoiseN.xy*${f('NormalIntensity',1)},neoFireNoiseN.z)));`:'';
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>\n${normal}`);
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    vec2 neoFireNoiseUv=neoFireNoiseUv1*${f('fireTiling',.25)};
    vec2 neoFireDissolveUv=neoFireNoiseUv+neoTime*vec2(-.2,.1)*${f('timeKey',0)};
    vec2 neoFireDissolveUvR=neoFireNoiseUv+neoTime*vec2(.6,0.0)*${f('timeKey',0)};
    float neoFireR=texture2D(neoFireNoise2,neoFireDissolveUvR).r;
    float neoFireR2=texture2D(neoFireNoise2,neoFireDissolveUv).r;
    float neoFireMask=mix(neoFireR,neoFireR2*neoFireR,${f('finrKey',0)});
    float neoFireText=neoFireNoiseUv1.x-(${f('dissolve',2)}+${f('dissolveoffset',0)})*pow(max(neoFireMask,0.0),${f('firepow',.5)});
    float neoFire=ceil(neoFireText),neoFireA=ceil(neoFireText-.02);
    diffuseColor.rgb=vec3(0.0);diffuseColor.a=mix(1.0,mix(1.0,${f('OPIntensity',.55)},1.0),neoFireA)*neoFire*opacity;
  `);
  const edge=`float neoFireColorFr=clamp(pow(max(dot(normal,normalize(vViewPosition))-.3,0.0),.6)*2.0,0.0,1.0);vec3 neoFireBase=mix(${rgb('Color0',[1,1,1,1])}*3.0*${f('EmissiveIntensity',1)},vec3(0.0),neoFireColorFr);vec3 neoFireBody=mix(${rgb('Color2',[1,1,1,1])}*${f('EmissiveIntensity',1)},mix(${rgb('Color0',[1,1,1,1])},${rgb('Color1',[1,1,1,1])},diffuseColor.a),neoFireA);totalEmissiveRadiance=(neoFireBody+neoFireBase)*neoFire*neoEmissionScale;`;
  s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',edge);
 };
 warnings.push('firenoise 已接入源第二 UV 溶解遮罩、火焰滚动、法线和边缘发光；源低画质噪声细节和完整颜色时序仍待 GPU 标定');
 return u;
}
