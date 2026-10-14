// unlit_compound_shell01/02: source matcap resin shell. DrawCall culling is preserved by source state.
export async function configureCompoundShell(m,p,macros,load,warnings,overrides={}){
 const n=(k,d=0)=>Number.isFinite(Number(p[k]))?Number(p[k]):d,v=(k,d)=>{try{const a=JSON.parse(p[k]);if(Array.isArray(a)&&a.length>=3)return a;}catch{}return d},f=(k,d=0)=>n(k,d).toFixed(8),rgb=(k,d)=>`vec3(${v(k,d).slice(0,3).map(x=>Number(x).toFixed(8)).join(',')})`;
 const base=await load('Tex0',false,overrides.baseColor),normal=await load('Tex1',false,overrides.normal),cap=await load('Tex2',false);if(!base||!cap)return null;
 const baseColor=v('BaseColor',[1,1,1,1]);
 const layer=overrides.shellLayer===true;
 m.defines={...m.defines,USE_UV1:''};m.map=base;m.normalMap=normal;m.color.set(0xffffff);m.roughness=n('Intensity',1);m.metalness=n('Intensity',0);m.side=layer?2:1;m.transparent=layer;m.depthWrite=!layer;m.emissive.set(0xffffff);m.emissiveIntensity=1;
 const u={neoTime:{value:0},neoShellBase:{value:base},neoShellCap:{value:cap},neoEmissionScale:{value:1}};
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,u);s.fragmentShader=`uniform sampler2D neoShellCap;uniform float neoEmissionScale;\n${s.fragmentShader}`;s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>\nvec4 shellBase=texture2D(map,vMapUv);vec3 shellCap=texture2D(neoShellCap,vec2(.5)+normal.xy*.5).rgb;float shellMask=pow(max(shellBase.a,0.0),2.2);vec3 resin=shellCap*${rgb('ResinColor',[1,1,1,1])}*${f('ResinLightness',1)};diffuseColor.rgb=vec3(0.0);diffuseColor.a=${layer?`clamp(1.0-shellMask+shellMask*${Number(baseColor[3]??1).toFixed(8)},0.0,1.0)`:'1.0'};`).replace('#include <emissivemap_fragment>',`totalEmissiveRadiance=mix(shellBase.rgb*${f('BlendLightness',1)},resin,1.0-shellMask)*${f('TintValue',1)}*neoEmissionScale;`);};
 warnings.push(layer?'compound shell02 Back Cull/透明 pass 已接入':'compound shell01 Front Cull 基础 pass 已接入');return u;
}
