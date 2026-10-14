// standard_snow.hlsl: this surface intentionally has no Tex0.
export async function configureSnow(m,p,macros,load,warnings){
 const low=Number(macros.RENDER_QUALITY??0)===2,n=k=>Number.isFinite(Number(p[k]))?Number(p[k]):0;
 const v=(k,d)=>{try{const a=JSON.parse(p[k]);return Array.isArray(a)&&a.length>=3?a:d;}catch{return d;}};
 const f=k=>n(k).toFixed(8),rgb=k=>`vec3(${v(k,[1,1,1]).slice(0,3).map(x=>Number(x).toFixed(8)).join(',')})`;
 const keys=['Tex1','Tex2','Tex3'],maps={};for(const k of keys)maps[k]=await load(k);
 if(keys.some(k=>!maps[k]||maps[k].isCubeTexture)){warnings.push('standard_snow 缺少源 Tex1/Tex2/Tex3');return null;}
 const i=v('Intensity',[1,1,1,0]),base=v('BaseColor',[1,1,1,1]);
 m.map=null;m.normalMap=null;m.color.set(0xffffff);m.vertexColors=false;m.roughness=.2;m.metalness=0;m.defines={...m.defines,USE_TANGENT:''};
 const u={snowTex1:{value:maps.Tex1},snowTex2:{value:maps.Tex2},snowTex3:{value:maps.Tex3},snowTime:{value:0}};
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,u);s.vertexShader='varying vec2 snowUv;varying vec3 snowLocal,snowN,snowT,snowB,snowWorld;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nsnowUv=uv;').replace('#include <begin_vertex>','#include <begin_vertex>\nsnowLocal=transformed;').replace('#include <normal_vertex>','#include <normal_vertex>\nsnowN=normalize(transformedNormal);snowT=normalize(transformedTangent);snowB=normalize(cross(snowN,snowT)*tangent.w);').replace('#include <project_vertex>','#include <project_vertex>\nsnowWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  s.fragmentShader='varying vec2 snowUv;varying vec3 snowLocal,snowN,snowT,snowB,snowWorld;uniform sampler2D snowTex1,snowTex2,snowTex3;uniform float snowTime;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`vec3 snowBase=vec3(1.0);vec4 snow2=vec4(1.0),snow1=vec4(0.5,0.5,1.0,1.0),snow3=vec4(0.5,0.5,1.0,1.0);${low?'':`vec2 snowBaseUv=snowLocal.xy*${f('BaseTiling')}+vec2(${f('ADDUVX')},${f('ADDUVY')});snow2=texture2D(snowTex2,snowBaseUv);snow2.a=texture2D(snowTex2,snowUv*${f('SparkScale')}).a;snow1=texture2D(snowTex1,snowUv);snow3=texture2D(snowTex3,snowLocal.xy*${f('DetailNormalTiling')})*2.0-1.0;`}vec3 snowColor=mix(${rgb('SnowColorA')},${rgb('SnowColorB')},snow2.g);${Number(macros.CHAR_CHANGE_COLOR??1)!==0?`snowColor=vec3(dot(snowColor,vec3(.2125,.7154,.0721)))*${rgb('BaseColor')}*${f('TintValue')};`:`snowColor*= ${f('TintValue')};`}diffuseColor=vec4(pow(max(snowColor,vec3(0.0)),vec3(2.2)),${low?'1.0':`snow2.a`});`)
   .replace('#include <normal_fragment_maps>','')
   .replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>${low?'normal=normalize(vNormal);':`vec3 snowN0=snow1.xyz*2.0-1.0;snowN0.xy*=${Number(i[0]).toFixed(8)};vec3 snowD=vec3(snow3.xy*${f('DetailNormalIntensity')},snow3.z);vec3 snowBlend=normalize(mix(snowN0,snowD,snow1.a));normal=normalize(mat3(snowT,snowB,normalize(snowN))*snowBlend);`}`)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=${low?'.5':'.2'};`)
   .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=0.0;')
   .replace('#include <emissivemap_fragment>',`vec3 snowView=normalize(cameraPosition*vec3(-1.0,1.0,1.0)-snowWorld);float snowFR=${low?'0.0':`clamp(pow(max(dot(snowView,normalize(snowN))-.25,0.0),1.0)*2.0,0.0,1.0)`};vec3 snowLE=${low?'vec3(0.0)':`mix(${rgb('FRColor')}*1.5,${rgb('SnowColorA')}*1.5,snowFR)`};totalEmissiveRadiance=snowLE+${low?'vec3(0.0)':`vec3(snow2.a*pow(max(snow2.g,0.0),5.0))`};`)
   .replace('#include <aomap_fragment>','reflectedLight.indirectDiffuse*=1.0;');
 };
 warnings.push('standard_snow：已按源三图、局部坐标平铺、质量分支和细节法线接入；原场景 Sun/BRDF 未等价还原');return u;
}
