// water_painting: source flow, mask, matcap and star channels.
export async function configureWaterPainting(m,p,macros,load,warnings){
 const n=(k,d=0)=>Number.isFinite(Number(p[k]))?Number(p[k]):d;
 const v=(k,d)=>{try{const a=JSON.parse(p[k]);return Array.isArray(a)?a:d}catch{return d}};
 const base=v('BaseColor',[1,1,1,1]),rim=v('RimColor',[0,0,0,0]),emis=v('EmissiveColor',[1,1,1,1]);
 const tex0=await load('Tex0',false),normal=await load('Tex1',false),mask=await load('Tex2',false),matcap=await load('Tex3',false),flow=await load('Tex4',false);
 if(!tex0)return null;
 m.map=tex0;m.normalMap=normal;m.color.set(0xffffff);m.roughness=1;m.metalness=0;m.emissive.set(0xffffff);m.emissiveIntensity=1;
 const neoTime={value:0},u={neoWaterMask:{value:mask},neoWaterMatcap:{value:matcap},neoWaterFlow:{value:flow},neoWaterTime:neoTime,neoTime};
 const b=base.slice(0,3).map(x=>Number(x).toFixed(8)).join(','),r=rim.slice(0,3).map(x=>Number(x).toFixed(8)).join(','),e=emis.slice(0,3).map(x=>Number(x).toFixed(8)).join(',');
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,u);s.fragmentShader=`uniform sampler2D neoWaterMask;uniform sampler2D neoWaterMatcap;uniform sampler2D neoWaterFlow;uniform float neoWaterTime;\n${s.fragmentShader}`;
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>\nvec4 waterBase=texture2D(map,vMapUv);vec4 waterMask=${mask?'texture2D(neoWaterMask,vMapUv)':'vec4(0.0)'};vec4 waterFlow=${flow?'texture2D(neoWaterFlow,vMapUv)':'vec4(0.5)'};vec2 waterUv=vMapUv+(waterFlow.rg*2.0-1.0)*${n('FlowInten',1).toFixed(8)}*fract(neoWaterTime*.2*${n('FlowSpeed',1).toFixed(8)});waterBase=texture2D(map,waterUv);float waterPaint=waterMask.a;diffuseColor.rgb=pow(max(waterBase.rgb,vec3(0.0)),vec3(${n('BaseColorPow',1).toFixed(8)}))*vec3(${b})*${n('TintValue',1).toFixed(8)};diffuseColor.a=waterBase.a*${Number(base[3]??1).toFixed(8)};`).replace('#include <emissivemap_fragment>',`float waterF=pow(1.0-saturate(dot(normalize(vNormal),normalize(vViewPosition))),${n('FresnelPow',5).toFixed(8)})*${n('FresnelStr',1).toFixed(8)};vec3 waterCap=${matcap?'texture2D(neoWaterMatcap,vec2(.5)+normal.xy*.5).rgb':'vec3(0.0)'};totalEmissiveRadiance=(vec3(${e})*${n('EmissiveValue',0).toFixed(8)}+waterF*vec3(${r})+waterCap*${n('MatcapReflect',1).toFixed(8)}+waterMask.b*${n('StarStr1',1).toFixed(8)})*neoWaterTime*.0+vec3(${e})*${n('BaseColorEmis',0).toFixed(8)};`);};
 warnings.push('water_painting 已按源 Tex0-4、流动遮罩、MatCap、星光与 Fresnel 通道接入；软体顶点噪声和完整质量分支仍待校准');return u;
}
