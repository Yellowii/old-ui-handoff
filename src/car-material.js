// 2025_t0_stage_luckydraw/car.hlsl: source base, packed ORM and low-quality detail branch.
export async function configureCar(m,p,macros,load,warnings,overrides={}){
 const n=(k,d=0)=>Number.isFinite(Number(p[k]))?Number(p[k]):d;
 const vec=(k,d)=>{try{const a=JSON.parse(p[k]);if(Array.isArray(a)&&a.length>=3)return a;}catch{}return d;};
 const f=(k,d=0)=>n(k,d).toFixed(8),rgb=(k,d)=>`vec3(${vec(k,d).slice(0,3).map(x=>Number(x).toFixed(8)).join(',')})`;
 const low=Number(macros.RENDER_QUALITY??0)<2,change=Number(macros.CHAR_CHANGE_COLOR??0)!==0;
 const tex0=await load('Tex0',false,overrides.baseColor),tex1=low?await load('Tex1',false,overrides.normal):null;
 const tex2=low?await load('Tex2'):null,tex3=low?await load('Tex3',false):null,tex4=low?await load('Tex4',false):null;
 if(!tex0)return null;
 if(low&&!tex3)warnings.push('car.surf 未声明 Tex3；按源分支关闭细节法线');
 m.defines={...m.defines,USE_UV1:''};m.map=tex0;m.normalMap=tex1;m.color.set(0xffffff);m.roughness=low?1:0.7;m.metalness=0;m.emissive.set(0xffffff);m.emissiveIntensity=1;
 const u={neoTime:{value:0},neoCarTex1:{value:tex1},neoCarTex2:{value:tex2},neoCarTex3:{value:tex3},neoCarTex4:{value:tex4},neoEmissionScale:{value:1}};
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,u);s.vertexShader='varying vec2 neoCarUv1;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nneoCarUv1=uv1;');s.fragmentShader=`varying vec2 neoCarUv1;uniform sampler2D neoCarTex1,neoCarTex2,neoCarTex3,neoCarTex4;uniform float neoTime,neoEmissionScale;\n${s.fragmentShader}`;
  const normal=low&&tex1?`vec3 neoCarN=texture2D(neoCarTex1,vMapUv).xyz*2.0-1.0;normal=normalize(tbn*normalize(vec3(neoCarN.xy*${f('Intensity',1)},neoCarN.z)));`:'';
  const orm=low&&tex2?`vec4 neoCarOrm=texture2D(neoCarTex2,vMapUv);roughnessFactor=neoCarOrm.g*${f('Intensity',1)};metalnessFactor=neoCarOrm.b*${f('Intensity',1)};`:'';
  const detail=low&&tex3?`vec3 neoCarDetail=texture2D(neoCarTex3,neoCarUv1*${f('DetailNormalUVTiling',1)}).xyz*2.0-1.0;normal=normalize(mix(normal,normalize(tbn*neoCarDetail),${f('DetailNormalIntensity',0)}));`:'';
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>\n${normal}${detail}`);
  // roughnessFactor/metalnessFactor are declared after roughnessmap_fragment in Three;
  // inject the packed ORM after both declarations are available.
  s.fragmentShader=s.fragmentShader.replace('float faceDirection = gl_FrontFacing',`${orm}\nfloat faceDirection = gl_FrontFacing`);
  const albedo=change?`vec3(dot(diffuseColor.rgb,vec3(.6,.7154,.0721)))*${rgb('BaseColor',[1,1,1,1])}`:'diffuseColor.rgb';
  const emission=low&&tex4?`texture2D(neoCarTex4,vec2(.5)+normal.xy*.5).rgb*${f('MatcapIntensity',0)}`:'vec3(0.0)';
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>\ndiffuseColor.rgb=${albedo}*${f('TintValue',1)};`).replace('#include <emissivemap_fragment>',`totalEmissiveRadiance=${emission}*${f('EmissiveIntensity',0)}*neoEmissionScale;`);
 };
 warnings.push('car.surf 已接入源基础色、画质分支、打包粗糙/金属、细节法线和 MatCap 发光；完整源噪声、TBN 细节混合仍待 GPU 标定');
 return u;
}
