// Existing PBR/MatCap preview. Source formula parity remains under audit.
export async function configurePbrMatcap(m,p,macros,load,warnings){
 const n=(k,d=0)=>Number.isFinite(Number(p[k]))?Number(p[k]):d;
 const v=(k,d)=>{try{const a=JSON.parse(p[k]);return Array.isArray(a)?a:d}catch{return d}};
 const base=v('BaseColor',[1,1,1,1]),em=v('EmissiveColor',[1,1,1,1]),rim=v('RimColor',[0,0,0,0]),i=v('Intensity',[1,1,1,0]),mp=v('matcapPara',[1,0,1,0]);
 const al=await load('Tex0',false),nm=await load('Tex1',false),mix=await load('Tex2'),cap=await load('Tex3',false),mask=await load('Tex4',false);if(!al)return null;
 m.map=al;m.normalMap=nm;m.roughness=i[1];m.metalness=i[2];m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=1;
 const u={neoPbrMix:{value:mix},neoPbrCap:{value:cap},neoPbrMask:{value:mask}};
 const rgb=a=>'vec3('+a.slice(0,3).map(x=>Number(x).toFixed(8)).join(',')+')',f=x=>Number(x).toFixed(8);
 m.onBeforeCompile=s=>{
  Object.assign(s.uniforms,u);
  s.fragmentShader='uniform sampler2D neoPbrMix,neoPbrCap,neoPbrMask;\n'+s.fragmentShader;
  // ORM is consumed BEFORE normal_fragment_begin: sample it locally here.
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nvec4 neoPbrMixValue='+(mix?'texture2D(neoPbrMix,vMapUv)':'vec4(1.0)')+';\ndiffuseColor.rgb=pow(max(diffuseColor.rgb,vec3(0.0)),vec3('+f(n('BaseColorPow',1))+'))*'+rgb(base)+'*'+f(n('TintValue',1))+';');
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','float roughnessFactor=clamp(neoPbrMixValue.g*'+f(i[1])+',0.0,1.0);');
  s.fragmentShader=s.fragmentShader.replace('#include <metalnessmap_fragment>','float metalnessFactor=clamp(neoPbrMixValue.b*'+f(i[2])+',0.0,1.0);');
  // Preserve this preview's geometric-normal MatCap input.
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nvec3 neoPbrCapValue='+(cap?'texture2D(neoPbrCap,vec2(.5)+normal.xy*.5).rgb':'vec3(0.0)')+';');
  s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>','float pbrF=pow(1.0-saturate(dot(normalize(normal),normalize(vViewPosition))),5.0);\ntotalEmissiveRadiance=neoPbrCapValue*'+f(mp[1])+'+pbrF*'+rgb(rim)+'*'+f(i[3])+'+'+rgb(em)+'*'+f(n('EmissiveValue',1))+';');
 };
 warnings.push('standard_pbrwithmatcap 通道预览：ORM 采样顺序已修正；完整源 MatCap、遮罩与发光公式仍待核验');return u;
}
